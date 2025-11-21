/**
 * SCRIPT 08: Complete Fixtures Seeder - HAIROTICMEN Trading OS (v4 - Dynamic Schema)
 * ===================================================================================
 * 
 * ✅ v4: Dynamic Schema Preservation
 * - Reads Google Sheets headers as source of truth
 * - Preserves column renames, reordering, and new columns
 * - Supports category name changes in Enums
 * - Validates critical columns (primary keys, formulas)
 * - Full user control over schema changes
 * 
 * ✅ v3: User Edit Preservation (23 FinalPriceList + 13 Packaging_Boxes fields)
 * ✅ v2: Schema fixes (Enums, Bundles, Packaging_Boxes)
 * 
 * See 08-SMART-MERGE-GUIDE-AR.md for complete documentation.
 */

import { getUncachableGoogleSheetClient, SPREADSHEET_ID as ENV_SPREADSHEET_ID } from '../../lib/sheets';
import { retryWithBackoff } from '../../lib/retry';
import type { sheets_v4 } from 'googleapis';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createSchemaSnapshot,
  compareSnapshots,
  loadSnapshotCache,
  saveSnapshotCache,
  validateLiveSchema,
  findColumnByName,
  remapRowToLiveSchema,
  printSchemaReport,
  type SheetSchemaSnapshot,
  type SchemaSnapshotCache
} from '../../lib/schema-snapshot';

// ---------- ENVIRONMENT CONFIGURATION ----------
const SPREADSHEET_ID = ENV_SPREADSHEET_ID;
const DRY_RUN = String(process.env.DRY_RUN ?? 'false').toLowerCase() === 'true';
const FULL_RESET = String(process.env.FULL_RESET ?? 'false').toLowerCase() === 'true';
const WRITE_BATCH_SIZE = Number(process.env.WRITE_BATCH_SIZE || '12');
const WRITE_COOLDOWN_MS = Number(process.env.WRITE_COOLDOWN_MS || '3000');
const RNG_SEED = Number(process.env.SEED || '1337');
const NUM_PRODUCTS = Number(process.env.NUM_PRODUCTS || '60');
const NUM_ORDERS = Number(process.env.NUM_ORDERS || '20');
const NUM_QUOTES = Number(process.env.NUM_QUOTES || '10');
const NUM_PARTNERS = Number(process.env.NUM_PARTNERS || '8');

if (!SPREADSHEET_ID) {
  console.error('❌ ERROR: SHEETS_SPREADSHEET_ID environment variable not set');
  console.error('   Set it in your environment or run 01-create-spreadsheet-structure.ts first');
  process.exit(1);
}

// ---------- MATH & UTILITY HELPERS ----------
const round2 = (n: number) => Math.round(n * 100) / 100;
const VAT = 0.19;
const FX_BUFFER = 0.03;

const LINE_CFG: Record<string, { gmUvp: number; adPct: number; floorMult: number }> = {
  Premium: { gmUvp: 0.75, adPct: 0.11, floorMult: 2.50 },
  Skin: { gmUvp: 0.75, adPct: 0.11, floorMult: 2.50 },
  Professional: { gmUvp: 0.62, adPct: 0.09, floorMult: 2.40 },
  Basic: { gmUvp: 0.50, adPct: 0.07, floorMult: 2.10 },
  Tools: { gmUvp: 0.48, adPct: 0.05, floorMult: 1.80 }
};

const toInc99 = (net: number): number => {
  const inc = net * (1 + VAT);
  const ceil = Math.ceil(inc);
  return round2(Math.max(0, ceil - 0.01));
};

function mulberry32(seed: number) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(RNG_SEED);
const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const rand = (min: number, max: number, decimals = 0) =>
  Number((min + (max - min) * rnd()).toFixed(decimals));

function ean13From(seed: number): string {
  const base = String(400700000000 + (seed % 99999999)).padStart(12, '0');
  const digits = base.split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + (i % 2 === 0 ? d : d * 3), 0);
  const checksum = (10 - (sum % 10)) % 10;
  return base + String(checksum);
}

function guessTier(weight_g: number): string {
  if (weight_g <= 200) return 'Std_Parcel_S';
  if (weight_g <= 400) return 'Std_Parcel_M';
  return 'Std_Parcel_L';
}

function guessBox(weight_g: number): 'Small' | 'Medium' | 'Large' {
  if (weight_g <= 250) return 'Small';
  if (weight_g <= 700) return 'Medium';
  return 'Large';
}

const colA1 = (idx0: number): string => {
  let n = idx0 + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

// ---------- CANONICAL SHEET HEADERS (CORRECTED TO MATCH PRODUCTION) ----------
const HEADERS = {
  FinalPriceList: [
    'SKU', 'Name', 'Category', 'Brand', 'Barcode', 'Status',
    'Factory_Cost_EUR', 'Packaging_Cost_EUR', 'Freight_kg_EUR',
    'Import_Duty_Pct', 'Overhead_Pct', 'COGS_EUR',
    'Shipping_Inbound_per_unit', 'EPR_LUCID_per_unit', 'GS1_per_unit',
    'Retail_Packaging_per_unit', 'QC_PIF_per_unit', 'Operations_per_unit',
    'Marketing_per_unit', 'FullCost_EUR',
    'FactoryPriceUnit_Manual', 'TotalFactoryPriceCarton', 'UnitsPerCarton', 'FX_BufferPct',
    'Weight_g', 'Content_ml', 'Net_Content_ml', 'Dims_cm', 'VAT%',
    'Grundpreis', 'Grundpreis_Net', 'Grundpreis_Unit',
    'Amazon_TierKey', 'Line', 'Manual_UVP_Inc',
    'UVP_Net', 'UVP_Inc', 'UVP_Inc_99', 'UVP_vs_Floor_Flag',
    'Guardrail_OwnStore_Inc', 'Guardrail_Amazon_FBM_Inc', 'Guardrail_Amazon_FBA_Inc',
    'Box_Size', 'Box_Cost_Per_Unit', 'Gift_Cost_Expected_Unit',
    'Grundpreis_Inc_Per_L', 'Pricing_Engine_Version',
    'Shipping_Actual_Kg', 'Shipping_Volumetric_Kg', 'Shipping_Chargeable_Kg', 'Shipping_CarrierID',
    'ShipCost_per_Unit_OwnStore', 'ShipCost_per_Unit_FBM', 'ShipCost_per_Unit_FBA', 'ShipCost_per_Unit_B2B',
    'Ad_Pct', 'Returns_Pct', 'Loyalty_Pct', 'Payment_Pct', 'Amazon_Referral_Pct',
    'DHL_WeightBand', 'DHL_Zone',
    'Gift_SKU', 'Gift_SKU_Cost', 'Gift_Attach_Rate', 'Gift_Funding_Pct', 'Gift_Shipping_Increment',
    'PostChannel_Margin_Pct', 'Floor_B2C_Net', 'Guardrail_OK',
    'UVP_Recommended', 'UVP', 'MAP', 'AutoPriceFlag',
    'Price_Web', 'Price_Amazon', 'Price_Salon',
    'Net_Dealer_Basic', 'Net_Dealer_Plus', 'Net_Stand', 'Net_Distributor',
    'Competitor_Min', 'Competitor_Median',
    'Pricing_Version', 'QRUrl', 'Notes'
  ],
  
  // ✅ FIXED: Production schema uses ['List', 'Key', 'Label', 'Sort', 'Active']
  Enums: ['List', 'Key', 'Label', 'Sort', 'Active'],
  
  // ✅ FIXED: Production schema (17 columns)
  Packaging_Boxes: [
    'PackageID', 'BoxType', 'BoxSubtype',
    'Inner_L_cm', 'Inner_W_cm', 'Inner_H_cm',
    'Outer_L_cm', 'Outer_W_cm', 'Outer_H_cm',
    'Tare_Weight_g', 'Max_Weight_kg',
    'Unit_Cost_EUR', 'Units_Per_Carton', 'Carton_Cost_EUR',
    'Active', 'Supplier', 'Notes'
  ],
  
  ShippingWeightBands: [
    'CarrierID', 'ServiceLevel', 'Zone', 'Weight_Min_g', 'Weight_Max_g',
    'Base_Rate_EUR', 'Fuel_Surcharge_Pct', 'Active'
  ],
  
  ShippingCostsFixed: ['CostType', 'Channel', 'Cost_EUR', 'Notes'],
  
  PartnerRegistry: [
    'PartnerID', 'PartnerName', 'Tier', 'PartnerType', 'Email', 'Phone', 'Owner', 'Status',
    'Street', 'Postal', 'City', 'CountryCode',
    'ShippingStreet', 'ShippingPostal', 'ShippingCity', 'ShippingCountryCode',
    'Notes', 'PartnerFolderID', 'PartnerFolderURL'
  ],
  
  Orders: [
    'OrderID', 'QuoteID', 'PartnerID', 'OrderDate', 'Subtotal', 'DiscountAmt',
    'VATAmt', 'ShippingCost', 'Total', 'PaymentMethod', 'PaymentStatus',
    'FulfillmentStatus', 'Status', 'Notes'
  ],
  
  OrderLines: ['OrderID', 'LineNum', 'SKU', 'Qty', 'UnitPrice', 'Discount', 'LineTotal'],
  
  Quotes: [
    'QuoteID', 'PartnerID', 'QuoteDate', 'ExpiryDate', 'Subtotal', 'DiscountPct',
    'DiscountAmt', 'VATRate', 'VATAmt', 'Total', 'Status', 'Notes'
  ],
  
  QuoteLines: ['QuoteID', 'LineNum', 'SKU', 'Qty', 'UnitPrice', 'Discount', 'LineTotal'],
  
  // ✅ FIXED: Production schema uses ItemsJSON instead of component columns
  Bundles: ['BundleID', 'Name', 'ItemsJSON', 'Channel', 'Active', 'Notes'],
  
  Settings: ['Key', 'Value', 'Description', 'Category', 'LastModified'],
  
  Pricing_Params: ['ParamKey', 'Value', 'Unit', 'Category', 'Type', 'AppliesTo', 'Notes'],
  
  PartnerTiers: ['Tier', 'MinOrderVolume', 'DiscountPct', 'CommissionPct', 'Benefits', 'Payment Terms (Days)', 'CommissionRate_Pct'],
  
  Channels: [
    'ChannelID', 'ChannelName', 'Active',
    'Payment_Provider', 'Payment_Fee_Pct', 'Payment_Fee_Fixed_EUR',
    'Amazon_Referral_Pct_Low', 'Amazon_Referral_Pct_High', 'Amazon_Referral_Min_EUR',
    'FBA_Fee_Base_EUR', 'Returns_Pct', 'Loyalty_Accounting_Pct',
    'Uses_DHL', 'Uses_FBA', 'Notes'
  ],
  
  AmazonSizeTiers: [
    'TierKey', 'TierName',
    'Weight_Min_g', 'Weight_Max_g', 'Dims_Max_cm',
    'FBA_Fee_EUR', 'FBA_Surcharge_2025_EUR',
    'Active', 'Notes'
  ]
};

// Enum values (List, Key, Label, Sort, Active format)
const ENUM_DATA: Record<string, Array<{ key: string; label: string; sort: number }>> = {
  Line: [
    { key: 'Premium', label: 'Premium', sort: 1 },
    { key: 'Skin', label: 'Skin', sort: 2 },
    { key: 'Professional', label: 'Professional', sort: 3 },
    { key: 'Basic', label: 'Basic', sort: 4 },
    { key: 'Tools', label: 'Tools', sort: 5 }
  ],
  Category: [
    { key: 'Beard Care', label: 'Beard Care', sort: 1 },
    { key: 'Shaving', label: 'Shaving', sort: 2 },
    { key: 'Cologne', label: 'Cologne', sort: 3 },
    { key: 'Hair Gel', label: 'Hair Gel', sort: 4 },
    { key: 'Hair Wax', label: 'Hair Wax', sort: 5 },
    { key: 'Hair Care', label: 'Hair Care', sort: 6 },
    { key: 'Aftershave', label: 'Aftershave', sort: 7 },
    { key: 'Skin Care', label: 'Skin Care', sort: 8 },
    { key: 'Accessories', label: 'Accessories', sort: 9 },
    { key: 'Treatment Kits', label: 'Treatment Kits', sort: 10 }
  ],
  Amazon_TierKey: [
    { key: 'Std_Parcel_S', label: 'Standard Small Parcel', sort: 1 },
    { key: 'Std_Parcel_M', label: 'Standard Medium Parcel', sort: 2 },
    { key: 'Std_Parcel_L', label: 'Standard Large Parcel', sort: 3 }
  ],
  Box_Size: [
    { key: 'Small', label: 'Small', sort: 1 },
    { key: 'Medium', label: 'Medium', sort: 2 },
    { key: 'Large', label: 'Large', sort: 3 },
    { key: 'XL', label: 'Extra Large', sort: 4 }
  ],
  Status: [
    { key: 'Active', label: 'Active', sort: 1 },
    { key: 'Inactive', label: 'Inactive', sort: 2 },
    { key: 'Discontinued', label: 'Discontinued', sort: 3 },
    { key: 'Draft', label: 'Draft', sort: 4 }
  ]
};

// ---------- MERGE CONFIGURATION ----------
// Defines which fields are user-managed and should be preserved
// Note: Only sheets with UNIQUE primary keys are included here
const SHEET_MERGE_CONFIG: Record<string, {
  primaryKey: string;
  userManagedFields: string[];
}> = {
  FinalPriceList: {
    primaryKey: 'SKU',
    userManagedFields: [
      'Category', 'Line', 'Brand',
      'Factory_Cost_EUR', 'Packaging_Cost_EUR', 'Freight_kg_EUR',
      'Weight_g', 'Content_ml', 'Net_Content_ml', 'Dims_cm',
      'Box_Size', 'Box_Cost_Per_Unit',
      'Shipping_Actual_Kg', 'Shipping_Volumetric_Kg', 'Shipping_CarrierID',
      'ShipCost_per_Unit_OwnStore', 'ShipCost_per_Unit_FBA',
      'ShipCost_per_Unit_FBM', 'ShipCost_per_Unit_B2B',
      'Manual_UVP_Inc', 'DHL_Zone', 'Gift_SKU', 'Gift_SKU_Cost'
    ]
  },
  Packaging_Boxes: {
    primaryKey: 'PackageID',
    userManagedFields: [
      'BoxType', 'BoxSubtype',
      'Inner_L_cm', 'Inner_W_cm', 'Inner_H_cm',
      'Outer_L_cm', 'Outer_W_cm', 'Outer_H_cm',
      'Tare_Weight_g', 'Max_Weight_kg', 'Unit_Cost_EUR',
      'Units_Per_Carton', 'Carton_Cost_EUR', 'Supplier'
    ]
  }
  // Note: ShippingWeightBands excluded - CarrierID is not unique per row
  // Note: Other sheets typically don't need user edit preservation
};

const PRESERVE_EDITS = String(process.env.PRESERVE_EDITS ?? 'true').toLowerCase() === 'true';
const ALLOW_SCHEMA_MUTATIONS = String(process.env.ALLOW_SCHEMA_MUTATIONS ?? 'false').toLowerCase() === 'true';

// ---------- GOOGLE SHEETS API UTILITIES ----------
async function getHeaders(api: sheets_v4.Sheets, sheet: string): Promise<string[]> {
  try {
    const res = await retryWithBackoff(() =>
      api.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheet}!1:1`
      })
    );
    return (res.data.values?.[0] || []) as string[];
  } catch {
    return [];
  }
}

async function readSheetData(api: sheets_v4.Sheets, sheet: string): Promise<Record<string, any>[]> {
  try {
    const res = await retryWithBackoff(() =>
      api.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheet}!A:ZZ`
      })
    );
    
    const rows = res.data.values;
    if (!rows || rows.length < 2) return [];
    
    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj: Record<string, any> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
    
    return data;
  } catch {
    return [];
  }
}

function mergeWithUserEdits(
  sheetName: string,
  configRows: any[][],
  existingData: Record<string, any>[],
  headers: string[]
): { rows: any[][], preservedCount: number } {
  if (!PRESERVE_EDITS || existingData.length === 0) {
    return { rows: configRows, preservedCount: 0 };
  }
  
  const mergeConfig = SHEET_MERGE_CONFIG[sheetName];
  if (!mergeConfig) {
    return { rows: configRows, preservedCount: 0 };
  }
  
  const primaryKey = mergeConfig.primaryKey;
  const userFields = mergeConfig.userManagedFields;
  const keyIndex = headers.indexOf(primaryKey);
  
  if (keyIndex === -1) {
    console.log(`  ⚠️  ${sheetName}: Primary key '${primaryKey}' not found in headers`);
    return { rows: configRows, preservedCount: 0 };
  }
  
  const existingMap = new Map<string, Record<string, any>>();
  existingData.forEach(row => {
    const key = row[primaryKey];
    if (key) existingMap.set(String(key), row);
  });
  
  const mergedRows: any[][] = [];
  let preservedCount = 0;
  
  configRows.forEach(configRow => {
    const recordID = String(configRow[keyIndex]);
    const existingRow = existingMap.get(recordID);
    
    if (!existingRow) {
      mergedRows.push(configRow);
      return;
    }
    
    const mergedRow = configRow.map((configValue, colIndex) => {
      const colName = headers[colIndex];
      
      if (userFields.includes(colName)) {
        const existingValue = existingRow[colName];
        if (existingValue !== undefined && existingValue !== '' && existingValue !== configValue) {
          preservedCount++;
          return existingValue;
        }
      }
      
      return configValue;
    });
    
    mergedRows.push(mergedRow);
  });
  
  return { rows: mergedRows, preservedCount };
}

async function ensureHeaders(
  api: sheets_v4.Sheets,
  sheet: string,
  desired: string[],
  snapshotCache: SchemaSnapshotCache,
  primaryKey?: string
): Promise<{ headers: string[]; snapshot: SheetSchemaSnapshot | null }> {
  const current = await getHeaders(api, sheet).catch(() => []);
  const oldSnapshot = snapshotCache.snapshots[sheet];
  
  // If no headers exist, create them
  if (current.length === 0) {
    if (!DRY_RUN) {
      await retryWithBackoff(() =>
        api.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheet}!1:1`,
          valueInputOption: 'RAW',
          requestBody: { values: [desired] }
        })
      );
    }
    console.log(`  • Created headers for ${sheet}`);
    
    // Create initial snapshot
    const snapshot = createSchemaSnapshot(sheet, desired, desired, primaryKey);
    return { headers: desired, snapshot };
  }
  
  // Schema mutation mode: Use live headers as source of truth
  if (ALLOW_SCHEMA_MUTATIONS) {
    // Create snapshot from live headers (using previous snapshot for alias resolution)
    const liveSnapshot = createSchemaSnapshot(sheet, current, desired, primaryKey, oldSnapshot);
    
    // Validate critical columns
    const criticalColumns = primaryKey ? [primaryKey] : [];
    const validationErrors = validateLiveSchema(liveSnapshot, criticalColumns);
    
    // Check for comparison with previous snapshot
    const comparison = compareSnapshots(oldSnapshot, liveSnapshot);
    
    // Print report if there are changes
    if (comparison.hasChanges || validationErrors.length > 0) {
      printSchemaReport(sheet, comparison, validationErrors);
    }
    
    // Block writes if critical errors exist (unless FULL_RESET)
    const hasErrors = validationErrors.some(e => e.severity === 'error');
    if (hasErrors && !FULL_RESET) {
      console.error(`  ❌ ${sheet}: Critical schema errors detected. Use FULL_RESET=true to override.`);
      process.exit(1);
    }
    
    // Add missing columns from desired if they don't exist
    const liveNames = new Set(current);
    const missing = desired.filter(h => {
      const found = findColumnByName(liveSnapshot.columns, h);
      return !found;
    });
    
    if (missing.length > 0) {
      const merged = [...current, ...missing];
      if (!DRY_RUN) {
        await retryWithBackoff(() =>
          api.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheet}!1:1`,
            valueInputOption: 'RAW',
            requestBody: { values: [merged] }
          })
        );
      }
      console.log(`  ➕ ${sheet}: added ${missing.length} missing column(s) from config`);
      
      // Update snapshot with merged headers
      const updatedSnapshot = createSchemaSnapshot(sheet, merged, desired, primaryKey, oldSnapshot);
      return { headers: merged, snapshot: updatedSnapshot };
    }
    
    return { headers: current, snapshot: liveSnapshot };
  }
  
  // Legacy mode: Override with desired headers
  const missing = desired.filter(h => !current.includes(h));
  if (missing.length > 0) {
    const merged = [...current, ...missing];
    if (!DRY_RUN) {
      await retryWithBackoff(() =>
        api.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheet}!1:1`,
          valueInputOption: 'RAW',
          requestBody: { values: [merged] }
        })
      );
    }
    console.log(`  • ${sheet}: appended ${missing.length} missing header(s)`);
    return { headers: merged, snapshot: null };
  }
  
  return { headers: current, snapshot: null };
}

async function clearData(api: sheets_v4.Sheets, sheet: string, headersLen: number): Promise<void> {
  if (DRY_RUN) {
    console.log(`  • [DRY-RUN] Would clear data in ${sheet}`);
    return;
  }
  
  const endCol = colA1(Math.max(headersLen - 1, 0));
  await retryWithBackoff(() =>
    api.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheet}!A2:${endCol}`
    })
  );
  console.log(`  • Cleared data in ${sheet}`);
}

async function appendBatched(api: sheets_v4.Sheets, sheet: string, rows: any[][]): Promise<void> {
  if (rows.length === 0) {
    console.log(`  ⏭️  ${sheet}: no rows to append`);
    return;
  }
  
  for (let i = 0; i < rows.length; i += WRITE_BATCH_SIZE) {
    const batch = rows.slice(i, i + WRITE_BATCH_SIZE);
    
    if (!DRY_RUN) {
      await retryWithBackoff(() =>
        api.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheet}!A2`,
          valueInputOption: 'RAW',
          requestBody: { values: batch }
        })
      );
    }
    
    if (i + WRITE_BATCH_SIZE < rows.length) {
      await new Promise(resolve => setTimeout(resolve, WRITE_COOLDOWN_MS));
    }
  }
  
  console.log(`  ✅ ${sheet}: ${DRY_RUN ? '[DRY-RUN] would append' : 'appended'} ${rows.length} row(s)`);
}

// ---------- DATA BUILDERS ----------
function buildEnums(): any[][] {
  const rows: any[][] = [];
  Object.entries(ENUM_DATA).forEach(([listName, values]) => {
    values.forEach(({ key, label, sort }) => {
      rows.push([listName, key, label, sort, 'TRUE']);
    });
  });
  return rows;
}

function buildPackaging(): any[][] {
  return [
    ['BOX_XS', 'Shipping', 'Standard', 16, 13, 7, 16, 13, 7, 120, 2, 0.40, '', '', 'TRUE', 'Generic Supplier', ''],
    ['BOX_S', 'Shipping', 'Standard', 24.5, 17.5, 7.5, 24.5, 17.5, 7.5, 160, 5, 0.70, '', '', 'TRUE', 'Generic Supplier', ''],
    ['BOX_M', 'Shipping', 'Standard', 15, 15, 15, 15, 15, 15, 200, 7, 0.35, '', '', 'TRUE', 'Generic Supplier', ''],
    ['BOX_L', 'Shipping', 'Standard', 29, 14.5, 10, 29, 14.5, 10, 240, 10, 0.70, '', '', 'TRUE', 'Generic Supplier', ''],
    ['BOX_XL', 'Shipping', 'Standard', 40, 30, 20, 40, 30, 20, 350, 20, 1.20, '', '', 'TRUE', 'Generic Supplier', ''],
    ['CTN_24', 'Carton', 'B2B', 24, 17.5, 7.5, 24, 17.5, 7.5, 500, 31.5, 0, 24, 0, 'TRUE', 'Factory', 'Case pack 24 units'],
    ['CTN_12', 'Carton', 'B2B', 29, 14.5, 10, 29, 14.5, 10, 450, 31.5, 0, 12, 0, 'TRUE', 'Factory', 'Case pack 12 units']
  ];
}

function buildWeightBands(): any[][] {
  const dhl_de = [
    [0, 1, 3.45], [1, 2, 5.05], [2, 3, 5.55],
    [3, 5, 6.60], [5, 10, 8.65], [10, 20, 13.55], [20, 31.5, 16.90]
  ].map(([min, max, base]) => ['DHL_DE', 'Standard', 'DE', min * 1000, max * 1000, base, 15, 'TRUE']);
  
  return dhl_de;
}

function buildFixedCosts(): any[][] {
  return [
    ['Label_Fee', 'OwnStore', 0.40, 'Shipping label printing'],
    ['Label_Fee', 'Amazon_FBM', 0.50, 'Amazon label fee'],
    ['Filler_Materials', 'OwnStore', 0.25, 'Paper, tape, protective materials'],
    ['Pickup_Fee', 'B2B', 1.00, 'Courier pickup per shipment']
  ];
}

function buildPartners(count: number): any[][] {
  const tiers = ['Dealer Basic', 'Dealer Plus', 'Distributor', 'Partner', 'Stand Program'];
  const types = ['Dealer', 'Distributor', 'Salon', 'Barber', 'Retailer'];
  const rows: any[][] = [];
  
  for (let i = 1; i <= count; i++) {
    const partnerId = `P${String(i).padStart(3, '0')}`;
    const tier = pick(tiers);
    const partnerType = pick(types);
    rows.push([
      partnerId, `${partnerType} ${i}`, tier, partnerType,
      `partner${i}@example.com`, `+49-30-555${1000 + i}`,
      'Sales Team', 'Active',
      `Musterstraße ${i}`, `10${100 + i}`, 'Berlin', 'DE',
      '', '', '', '',
      `Seeded partner #${i}`, '', ''
    ]);
  }
  
  return rows;
}

async function loadSlugMapping(): Promise<Record<string, { slug: string; url: string }>> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(__dirname, '../../config/product-slug-mapping-complete.json'),
    path.resolve(process.cwd(), 'server/config/product-slug-mapping-complete.json')
  ];
  
  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, 'utf8');
      return JSON.parse(raw);
    } catch {
      continue;
    }
  }
  
  return {};
}

async function buildProducts(count: number, slugMapping: Record<string, any>): Promise<any[][]> {
  const lines = ['Premium', 'Skin', 'Professional', 'Basic', 'Tools'];
  const categories = ['Beard Care', 'Shaving', 'Cologne', 'Hair Gel', 'Hair Wax', 'Hair Care', 'Aftershave', 'Skin Care', 'Accessories', 'Treatment Kits'];
  const rows: any[][] = [];
  
  for (let i = 1; i <= count; i++) {
    const line = pick(lines);
    const category = pick(categories);
    const size = pick([30, 50, 75, 100, 150, 200, 250]);
    const weight = Math.max(120, Math.round(size * 0.9 + rand(20, 180)));
    
    const sku = `HM-${line[0]}-${category.split(' ')[0].toUpperCase()}-${String(i).padStart(3, '0')}`;
    const name = `${category} ${size}ml`;
    const ean = ean13From(i * 97);
    
    const factoryPrice = round2(rand(1.2, 7.5, 2));
    const fxPrice = round2(factoryPrice * (1 + FX_BUFFER));
    const boxSize = guessBox(weight);
    const packaging = round2({ Small: 0.35, Medium: 0.55, Large: 0.70 }[boxSize]);
    const freight = round2(rand(0.25, 0.6, 2));
    const fullCost = round2(fxPrice + packaging + freight);
    const floor = round2(fullCost * LINE_CFG[line].floorMult);
    const uvpNet = round2(fullCost / (1 - LINE_CFG[line].gmUvp));
    const uvpInc99 = toInc99(uvpNet);
    
    const slugData = slugMapping[sku];
    const qrUrl = slugData?.url || `https://hairoticmen.de/product/${sku.toLowerCase()}/?utm_source=qr&utm_medium=physical&utm_campaign=product-scan&sku=${sku}`;
    
    rows.push([
      sku, name, category, 'HAIROTICMEN', ean, 'Active',
      factoryPrice, packaging, freight, 0, 0, fullCost,
      freight, 0, 0, packaging, 0, 0, 0, fullCost,
      '', '', '', FX_BUFFER * 100,
      weight, size, size, '', VAT * 100,
      '', '', 'L',
      guessTier(weight), line, '',
      uvpNet, round2(uvpNet * (1 + VAT)), uvpInc99, 'OK',
      uvpInc99, uvpInc99, uvpInc99,
      boxSize, { Small: 0.40, Medium: 0.70, Large: 0.70 }[boxSize], 0, '', 'V2.2.1',
      '', '', '', '',
      '', '', '', '',
      LINE_CFG[line].adPct * 100, 2, 1, 2.5, 15,
      '', 'DE',
      '', 0, 0, 0, 0,
      38, floor, 'YES',
      uvpNet, uvpNet, round2(uvpNet * 0.95), '',
      uvpInc99, uvpInc99, round2(uvpNet * 0.85),
      round2(uvpNet * 0.60), round2(uvpNet * 0.50), round2(uvpNet * 0.70), round2(uvpNet * 0.40),
      '', '', 'V2.2.1', qrUrl, 'Seeded product'
    ]);
  }
  
  return rows;
}

function buildBundles(products: any[][]): any[][] {
  const rows: any[][] = [];
  const bundleCount = Math.min(5, Math.floor(products.length / 2));
  
  for (let i = 1; i <= bundleCount; i++) {
    const bundleId = `BND-${String(i).padStart(2, '0')}`;
    const bundleName = `Bundle Set ${i}`;
    
    const componentsCount = rand(2, 3);
    const usedIndices = new Set<number>();
    const items: Array<{ sku: string; qty: number }> = [];
    
    for (let j = 0; j < componentsCount; j++) {
      let idx = Math.floor(rnd() * products.length);
      while (usedIndices.has(idx)) {
        idx = Math.floor(rnd() * products.length);
      }
      usedIndices.add(idx);
      
      const sku = products[idx][0];
      const qty = 1;
      items.push({ sku, qty });
    }
    
    const itemsJSON = JSON.stringify(items);
    rows.push([bundleId, bundleName, itemsJSON, 'OwnStore', 'TRUE', 'Seeded bundle']);
  }
  
  return rows;
}

function buildOrders(products: any[][], partners: any[][]): any[][] {
  const rows: any[][] = [];
  
  for (let i = 1; i <= NUM_ORDERS; i++) {
    const orderId = `ORD-2025${String(i).padStart(4, '0')}`;
    const partnerId = partners[Math.floor(rnd() * partners.length)][0];
    const orderDate = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    
    const subtotal = round2(rand(150, 2500, 2));
    const discountAmt = round2(subtotal * rand(0, 0.10, 2));
    const netAfterDiscount = subtotal - discountAmt;
    const vatAmt = round2(netAfterDiscount * VAT);
    const shippingCost = round2(rand(5, 15, 2));
    const total = round2(netAfterDiscount + vatAmt + shippingCost);
    
    rows.push([
      orderId, '', partnerId, orderDate, subtotal, discountAmt,
      vatAmt, shippingCost, total,
      pick(['Bank Transfer', 'Credit Card', 'PayPal', 'Cash on Delivery']),
      pick(['Paid', 'Pending', 'Overdue']),
      pick(['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']),
      'Confirmed', `Seeded order ${i}`
    ]);
  }
  
  return rows;
}

function buildOrderLines(orders: any[][], products: any[][]): any[][] {
  const rows: any[][] = [];
  
  orders.forEach(order => {
    const orderId = order[0];
    const lineCount = rand(1, 5);
    
    for (let i = 1; i <= lineCount; i++) {
      const product = products[Math.floor(rnd() * products.length)];
      const sku = product[0];
      const qty = rand(1, 12);
      const uvpNet = Number(product[35]) || rand(5, 30, 2);
      const unitPrice = round2(uvpNet * rand(0.85, 1.0, 2));
      const discount = rand(0, 0.10, 2);
      const lineTotal = round2(qty * unitPrice * (1 - discount));
      
      rows.push([orderId, i, sku, qty, unitPrice, discount, lineTotal]);
    }
  });
  
  return rows;
}

function buildQuotes(products: any[][], partners: any[][]): any[][] {
  const rows: any[][] = [];
  
  for (let i = 1; i <= NUM_QUOTES; i++) {
    const quoteId = `QUO-2025${String(i).padStart(4, '0')}`;
    const partnerId = partners[Math.floor(rnd() * partners.length)][0];
    const quoteDate = new Date().toISOString().slice(0, 10);
    const expiryDate = new Date(Date.now() + (14 + i) * 86400000).toISOString().slice(0, 10);
    
    const subtotal = round2(rand(200, 3000, 2));
    const discountPct = rand(0, 0.15, 2);
    const discountAmt = round2(subtotal * discountPct);
    const netAfterDiscount = subtotal - discountAmt;
    const vatAmt = round2(netAfterDiscount * VAT);
    const total = round2(netAfterDiscount + vatAmt);
    
    rows.push([
      quoteId, partnerId, quoteDate, expiryDate, subtotal, discountPct,
      discountAmt, VAT, vatAmt, total,
      pick(['Draft', 'Sent', 'Accepted', 'Expired']), `Seeded quote ${i}`
    ]);
  }
  
  return rows;
}

function buildQuoteLines(quotes: any[][], products: any[][]): any[][] {
  const rows: any[][] = [];
  
  quotes.forEach(quote => {
    const quoteId = quote[0];
    const lineCount = rand(1, 6);
    
    for (let i = 1; i <= lineCount; i++) {
      const product = products[Math.floor(rnd() * products.length)];
      const sku = product[0];
      const qty = rand(6, 48);
      const uvpNet = Number(product[35]) || rand(5, 30, 2);
      const unitPrice = round2(uvpNet * rand(0.80, 0.95, 2));
      const discount = rand(0, 0.12, 2);
      const lineTotal = round2(qty * unitPrice * (1 - discount));
      
      rows.push([quoteId, i, sku, qty, unitPrice, discount, lineTotal]);
    }
  });
  
  return rows;
}

function buildSettings(): any[][] {
  return [
    ['SHEETS_SPREADSHEET_ID', SPREADSHEET_ID, 'Primary Google Sheets workbook ID', 'System', new Date().toISOString()],
    ['SchemaVersion', 'v2.2', 'Schema version', 'System', new Date().toISOString()],
    ['PricingVersion', 'V2.2.1', 'Pricing engine version', 'Pricing', new Date().toISOString()],
    ['Locale', 'de_DE', 'Default locale', 'System', new Date().toISOString()],
    ['TimeZone', 'Europe/Berlin', 'Default timezone', 'System', new Date().toISOString()],
    ['InvoiceCounter', '1000', 'Atomic invoice number counter', 'Sales', new Date().toISOString()],
    ['QuoteCounter', '5000', 'Atomic quote number counter', 'Sales', new Date().toISOString()]
  ];
}

function buildPricingParams(): any[][] {
  return [
    ['VAT_Rate', '0.19', '%', 'Tax', 'Number', 'All', 'German VAT rate'],
    ['FX_Buffer', '0.03', '%', 'Costs', 'Number', 'All', 'Currency conversion buffer'],
    ['Target_Margin', '0.38', '%', 'Pricing', 'Number', 'All', 'Target post-channel margin'],
    ['Returns_Rate', '0.02', '%', 'Operations', 'Number', 'All', 'Expected return rate'],
    ['Payment_Fee', '0.025', '%', 'Costs', 'Number', 'All', 'Payment processing fee'],
    ['Consumer_Rounding', '0.99', 'EUR', 'Pricing', 'Number', 'B2C', 'Round up to .99 pricing'],
    ['Loyalty_Points_Per_Euro', '1', 'points', 'Marketing', 'Number', 'All', 'Loyalty program conversion'],
    ['Loyalty_Point_Value', '0.01', 'EUR', 'Marketing', 'Number', 'All', 'Value per loyalty point']
  ];
}

function buildPartnerTiers(): any[][] {
  return [
    ['Partner', 0, 25, 0, 'Base tier', 30, 0],
    ['Sales Rep', 0, 25, 5, 'Field sales commission', 30, 5],
    ['Stand Program', 0, 30, 5, 'Physical stand placement', 30, 5],
    ['Dealer Basic', 0, 40, 0, 'Small retailer', 14, 0],
    ['Dealer Plus', 0, 50, 0, 'Medium retailer', 14, 0],
    ['Distributor', 0, 60, 0, 'Large distributor', 7, 0]
  ];
}

function buildChannels(): any[][] {
  return [
    ['OwnStore', 'Own Webshop', 'TRUE', 'Stripe', 2.5, 0.30, 0, 0, 0, 0, 2, 1, 'TRUE', 'FALSE', 'Direct B2C sales'],
    ['Amazon_FBM', 'Amazon FBM', 'TRUE', 'Amazon', 0, 0, 8, 15, 0.50, 0, 3, 1, 'TRUE', 'FALSE', 'Fulfilled by merchant'],
    ['Amazon_FBA', 'Amazon FBA', 'TRUE', 'Amazon', 0, 0, 8, 15, 0.50, 5.50, 3, 1, 'FALSE', 'TRUE', 'Fulfilled by Amazon'],
    ['B2B', 'B2B Wholesale', 'TRUE', 'Invoice', 0, 0, 0, 0, 0, 0, 1, 0, 'TRUE', 'FALSE', 'Business to business']
  ];
}

function buildAmazonSizeTiers(): any[][] {
  return [
    ['Std_Parcel_S', 'Standard Small', 0, 200, '15x12x1', 3.50, 0.35, 'TRUE', 'Up to 200g'],
    ['Std_Parcel_M', 'Standard Medium', 201, 400, '35x30x2', 4.20, 0.42, 'TRUE', '201-400g'],
    ['Std_Parcel_L', 'Standard Large', 401, 1000, '45x34x26', 5.80, 0.58, 'TRUE', '401-1000g']
  ];
}

// ---------- MAIN SEEDER FUNCTION ----------
async function seedAllFixtures() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  HAIROTICMEN Smart Merge Seeder v4 - Dynamic Schema Support   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  console.log(`📎 Spreadsheet ID: ${SPREADSHEET_ID}`);
  console.log(`🔧 Mode: ${DRY_RUN ? '🔍 DRY-RUN (no writes)' : '🚀 WRITE MODE'}`);
  console.log(`🔄 Full Reset: ${FULL_RESET ? 'YES (clear existing data)' : 'NO (append only)'}`);
  console.log(`⭐ Preserve Edits: ${PRESERVE_EDITS ? 'YES (user edits override config)' : 'NO'}`);
  console.log(`🎨 Schema Mutations: ${ALLOW_SCHEMA_MUTATIONS ? 'YES (preserve column renames/reorder)' : 'NO (use config headers)'}`);
  console.log(`📊 Batch Size: ${WRITE_BATCH_SIZE} rows`);
  console.log(`⏱️  Cooldown: ${WRITE_COOLDOWN_MS}ms between batches`);
  console.log(`🎲 RNG Seed: ${RNG_SEED}\n`);
  console.log('═'.repeat(80));
  
  const api = await getUncachableGoogleSheetClient() as sheets_v4.Sheets;
  
  // Load schema snapshot cache (only if schema mutations enabled)
  const snapshotCache = ALLOW_SCHEMA_MUTATIONS ? loadSnapshotCache() : {
    version: '1.0.0',
    snapshots: {},
    lastUpdated: new Date().toISOString()
  };
  
  if (ALLOW_SCHEMA_MUTATIONS) {
    console.log(`\n📸 Loaded schema cache: ${Object.keys(snapshotCache.snapshots).length} sheet(s)`);
  }
  
  console.log('\n📝 PHASE 1: Sheet Setup & Schema Detection');
  console.log('─'.repeat(80));
  
  const sheetSnapshots: Record<string, SheetSchemaSnapshot | null> = {};
  
  const ensureSheet = async (name: keyof typeof HEADERS, primaryKey?: string) => {
    const result = await ensureHeaders(api, name, HEADERS[name], snapshotCache, primaryKey);
    if (ALLOW_SCHEMA_MUTATIONS && result.snapshot) {
      sheetSnapshots[name] = result.snapshot;
      snapshotCache.snapshots[name] = result.snapshot;
    }
    return result.headers;
  };
  
  await ensureSheet('FinalPriceList', 'SKU');
  await ensureSheet('Enums');
  await ensureSheet('Packaging_Boxes', 'PackageID');
  await ensureSheet('ShippingWeightBands');
  await ensureSheet('ShippingCostsFixed');
  await ensureSheet('PartnerRegistry', 'PartnerID');
  await ensureSheet('Bundles', 'BundleID');
  await ensureSheet('Orders', 'OrderID');
  await ensureSheet('OrderLines');
  await ensureSheet('Quotes', 'QuoteID');
  await ensureSheet('QuoteLines');
  await ensureSheet('Settings', 'SettingKey');
  await ensureSheet('Pricing_Params', 'Param');
  await ensureSheet('PartnerTiers', 'Tier');
  await ensureSheet('Channels', 'ChannelID');
  await ensureSheet('AmazonSizeTiers', 'TierKey');
  
  console.log('\n📖 PHASE 2: Reading Existing Data (for merge)');
  console.log('─'.repeat(80));
  
  const existingProducts = await readSheetData(api, 'FinalPriceList');
  const existingPackaging = await readSheetData(api, 'Packaging_Boxes');
  
  console.log(`  • FinalPriceList: ${existingProducts.length} existing rows`);
  console.log(`  • Packaging_Boxes: ${existingPackaging.length} existing rows`);
  
  console.log('\n🗑️  Clearing old data before writing merged results...');
  await clearData(api, 'FinalPriceList', HEADERS.FinalPriceList.length);
  await clearData(api, 'Enums', HEADERS.Enums.length);
  await clearData(api, 'Packaging_Boxes', HEADERS.Packaging_Boxes.length);
  await clearData(api, 'ShippingWeightBands', HEADERS.ShippingWeightBands.length);
  await clearData(api, 'ShippingCostsFixed', HEADERS.ShippingCostsFixed.length);
  await clearData(api, 'PartnerRegistry', HEADERS.PartnerRegistry.length);
  await clearData(api, 'Bundles', HEADERS.Bundles.length);
  await clearData(api, 'Orders', HEADERS.Orders.length);
  await clearData(api, 'OrderLines', HEADERS.OrderLines.length);
  await clearData(api, 'Quotes', HEADERS.Quotes.length);
  await clearData(api, 'QuoteLines', HEADERS.QuoteLines.length);
  await clearData(api, 'Settings', HEADERS.Settings.length);
  await clearData(api, 'Pricing_Params', HEADERS.Pricing_Params.length);
  await clearData(api, 'PartnerTiers', HEADERS.PartnerTiers.length);
  await clearData(api, 'Channels', HEADERS.Channels.length);
  await clearData(api, 'AmazonSizeTiers', HEADERS.AmazonSizeTiers.length);
  
  console.log('\n🏗️  PHASE 3: Building Config Data');
  console.log('─'.repeat(80));
  
  const slugMapping = await loadSlugMapping();
  const configProducts = await buildProducts(NUM_PRODUCTS, slugMapping);
  const enumsRows = buildEnums();
  const configPackaging = buildPackaging();
  const configBands = buildWeightBands();
  const fixedCostsRows = buildFixedCosts();
  const partnersRows = buildPartners(NUM_PARTNERS);
  const bundlesRows = buildBundles(configProducts);
  const ordersRows = buildOrders(configProducts, partnersRows);
  const orderLinesRows = buildOrderLines(ordersRows, configProducts);
  const quotesRows = buildQuotes(configProducts, partnersRows);
  const quoteLinesRows = buildQuoteLines(quotesRows, configProducts);
  const settingsRows = buildSettings();
  const pricingParamsRows = buildPricingParams();
  const partnerTiersRows = buildPartnerTiers();
  const channelsRows = buildChannels();
  const amazonTiersRows = buildAmazonSizeTiers();
  
  console.log(`  ✓ Config Products: ${configProducts.length} rows`);
  console.log(`  ✓ Enums: ${enumsRows.length} rows`);
  
  console.log('\n🔄 PHASE 4: Smart Merge (User Edits Override Config)');
  console.log('─'.repeat(80));
  
  const productsResult = mergeWithUserEdits('FinalPriceList', configProducts, existingProducts, HEADERS.FinalPriceList);
  const packagingResult = mergeWithUserEdits('Packaging_Boxes', configPackaging, existingPackaging, HEADERS.Packaging_Boxes);
  
  const productsRows = productsResult.rows;
  const packagingRows = packagingResult.rows;
  const bandsRows = configBands;
  
  const totalPreserved = productsResult.preservedCount + packagingResult.preservedCount;
  
  console.log(`  🔄 FinalPriceList: Merged ${productsRows.length} rows (${productsResult.preservedCount} user edits preserved)`);
  console.log(`  🔄 Packaging_Boxes: Merged ${packagingRows.length} rows (${packagingResult.preservedCount} user edits preserved)`);
  console.log(`  ⏭️  ShippingWeightBands: ${bandsRows.length} rows (no merge - uses config)`);
  console.log(`  ⭐ Total user edits preserved: ${totalPreserved}`);
  
  console.log('\n📤 PHASE 5: Writing to Google Sheets');
  console.log('─'.repeat(80));
  
  await appendBatched(api, 'FinalPriceList', productsRows);
  await appendBatched(api, 'Enums', enumsRows);
  await appendBatched(api, 'Packaging_Boxes', packagingRows);
  await appendBatched(api, 'ShippingWeightBands', bandsRows);
  await appendBatched(api, 'ShippingCostsFixed', fixedCostsRows);
  await appendBatched(api, 'PartnerRegistry', partnersRows);
  await appendBatched(api, 'Bundles', bundlesRows);
  await appendBatched(api, 'Orders', ordersRows);
  await appendBatched(api, 'OrderLines', orderLinesRows);
  await appendBatched(api, 'Quotes', quotesRows);
  await appendBatched(api, 'QuoteLines', quoteLinesRows);
  await appendBatched(api, 'Settings', settingsRows);
  await appendBatched(api, 'Pricing_Params', pricingParamsRows);
  await appendBatched(api, 'PartnerTiers', partnerTiersRows);
  await appendBatched(api, 'Channels', channelsRows);
  await appendBatched(api, 'AmazonSizeTiers', amazonTiersRows);
  
  // Save schema snapshot cache
  if (ALLOW_SCHEMA_MUTATIONS && !DRY_RUN && Object.keys(sheetSnapshots).length > 0) {
    saveSnapshotCache(snapshotCache);
    console.log(`\n📸 Saved schema snapshots for ${Object.keys(sheetSnapshots).length} sheet(s)`);
  }
  
  console.log('\n' + '═'.repeat(80));
  console.log('✅ SMART MERGE SEEDING COMPLETE!\n');
  console.log('📊 Summary:');
  console.log(`   • ${productsRows.length} products in FinalPriceList`);
  console.log(`   • ${partnersRows.length} B2B partners`);
  console.log(`   • ${ordersRows.length} orders with ${orderLinesRows.length} line items`);
  console.log(`   • ${quotesRows.length} quotes with ${quoteLinesRows.length} line items`);
  console.log(`   • ${bundlesRows.length} bundle definitions`);
  console.log(`   • ${enumsRows.length} enum values for dropdowns`);
  console.log(`   • ${packagingRows.length} packaging definitions`);
  console.log(`   • ${bandsRows.length} shipping weight bands`);
  
  if (totalPreserved > 0) {
    console.log(`\n⭐ USER EDIT PRESERVATION:`);
    console.log(`   • FinalPriceList: ${productsResult.preservedCount} user edits preserved`);
    console.log(`   • Packaging_Boxes: ${packagingResult.preservedCount} user edits preserved`);
    console.log(`   • Total: ${totalPreserved} manual edits kept intact!`);
  }
  
  if (ALLOW_SCHEMA_MUTATIONS) {
    const schemaChangesCount = Object.values(sheetSnapshots).filter(s => s !== null).length;
    if (schemaChangesCount > 0) {
      console.log(`\n🎨 SCHEMA MUTATIONS:`);
      console.log(`   • ${schemaChangesCount} sheet(s) tracked for schema changes`);
      console.log(`   • Column renames, reordering, and new columns preserved`);
    }
  }
  
  console.log('\n⏭️  NEXT STEPS:');
  console.log('   1. Run pricing-master.ts to calculate full pricing');
  console.log('   2. Run 07-validate-and-repair-workbook.ts for validation');
  console.log('   3. Review your Google Sheet to verify data');
  console.log('\n🔗 Open your sheet:');
  console.log(`   https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit\n`);
  console.log('═'.repeat(80));
}

// ---------- EXECUTION ----------
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedAllFixtures().catch((error: any) => {
    console.error('\n❌ SEEDING FAILED');
    console.error('═'.repeat(80));
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  });
}
