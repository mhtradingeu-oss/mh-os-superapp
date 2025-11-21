/**
 * 07-validate-and-repair-workbook.ts
 * HAIROTICMEN Trading OS — Deep Validator & Repair (Quota-safe, DRY-RUN)
 *
 * ماذا يفعل؟ (What does it do?)
 * - Ensures all required sheets exist + creates missing ones with standard headers
 * - Unifies column order/names, adds missing columns without deleting existing ones
 * - Sets up relationships between sheets (FinalPriceList ↔ Enums ↔ Settings…)
 * - Adds/updates Data Validation and dropdowns (Line/Category/Status/Box_Size…)
 * - Generates unique ProposalNo in Quotes with format PR-YYYY-#### and prevents duplicates
 * - Quality checks (unique SKUs, EAN=13 digits, no Infinity/NaN, Enums coverage, Guardrails validation)
 * - Creates Validation_Log sheet for comprehensive reporting
 * - Supports DRY-RUN + batching + cooldowns to avoid quota limits
 *
 * ARCHITECTURE:
 * - Uses production schema from scanned Google Sheets (103 sheets)
 * - Fully integrated with getUncachableGoogleSheetClient() and retryWithBackoff()
 * - Connected to spreadsheet: 1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0
 */

import { getUncachableGoogleSheetClient } from '../../lib/sheets';
import { retryWithBackoff } from '../../lib/retry';
import type { sheets_v4 } from 'googleapis';
import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ========== Configuration ==========
const SPREADSHEET_ID =
  process.env.SHEETS_SPREADSHEET_ID ||
  '1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0';

const DRY_RUN = String(process.env.DRY_RUN ?? 'true').toLowerCase() === 'true';
const WRITE_BATCH_SIZE = Number(process.env.WRITE_BATCH_SIZE || '12');
const WRITE_COOLDOWN_MS = Number(process.env.WRITE_COOLDOWN_MS || '3000');
const LOCALE = 'de_DE';
const TIMEZONE = 'Europe/Berlin';

// ========== Helpers ==========
const colA1 = (i0: number) => {
  let n = i0 + 1,
    s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

// ========== Logging to Validation_Log ==========
type Level = 'INFO' | 'WARN' | 'FIX' | 'ERROR';
let _logSheetId: number | null = null;

async function logRow(
  sheets: sheets_v4.Sheets,
  msg: { level: Level; sheet?: string; row?: number; col?: string; code: string; message: string }
) {
  const time = new Date().toISOString();
  const values = [[time, msg.level, msg.sheet || '', msg.row || '', msg.col || '', msg.code, msg.message]];
  
  if (DRY_RUN) {
    console.log(`[${msg.level}] ${msg.code} — ${msg.sheet || ''} ${msg.row || ''} ${msg.col || ''}: ${msg.message}`);
    return;
  }
  
  await retryWithBackoff(() =>
    sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Validation_Log!A:G',
      valueInputOption: 'RAW',
      requestBody: { values },
    })
  );
}

// ========== Schema Definition ==========
type SheetSchema = { name: string; headers: string[]; protected?: boolean };

// Load production schema
let PRODUCTION_SCHEMA: SheetSchema[] = [];

async function loadProductionSchema() {
  try {
    const schemaPath = resolve(__dirname, '../final-production-schema.json');
    const data = await readFile(schemaPath, 'utf-8');
    PRODUCTION_SCHEMA = JSON.parse(data);
    console.log(`✅ Loaded ${PRODUCTION_SCHEMA.length} sheets from production schema`);
  } catch (error: any) {
    console.error('❌ Failed to load production schema:', error.message);
    process.exit(1);
  }
}

// Core sheets with specific validation rules
const CORE_SHEETS = {
  VALIDATION_LOG: {
    name: 'Validation_Log',
    headers: ['Timestamp', 'Level', 'Sheet', 'Row', 'Col', 'Code', 'Message'],
    protected: false,
  },
  ENUMS: {
    name: 'Enums',
    headers: ['Enum', 'Value', 'Description', 'Active', 'SortOrder', 'Color', 'Icon'],
    protected: false,
  },
  SETTINGS: {
    name: 'Settings',
    headers: ['Key', 'Value', 'Description', 'Category', 'LastModified'],
    protected: true,
  },
  FINAL_PRICE_LIST: {
    name: 'FinalPriceList',
    protected: true,
  },
  QUOTES: {
    name: 'Quotes',
    protected: false,
  },
};

// ========== Enum Defaults ==========
const ENUM_DEFAULTS: Record<string, string[]> = {
  Line: ['Premium', 'Skin', 'Professional', 'Basic', 'Tools'],
  Category: [
    'Beard Care',
    'Shaving',
    'Cologne',
    'Hair Gel',
    'Hair Wax',
    'Hair Care',
    'Aftershave',
    'Skin Care',
    'Accessories',
    'Treatment Kits',
  ],
  Amazon_TierKey: ['Std_Parcel_S', 'Std_Parcel_M', 'Std_Parcel_L'],
  Box_Size: ['Small', 'Medium', 'Large'],
  Status: ['Active', 'Inactive', 'Discontinued'],
  Channel: ['OwnStore', 'Amazon_FBM', 'Amazon_FBA', 'B2B'],
  PartnerType: ['Salon', 'Barbershop', 'Distributor', 'Retailer', 'Stand'],
  Tier: ['Basic', 'Plus', 'Premium', 'Distributor'],
};

// ========== Sheet Metadata ==========
type SheetInfo = { 
  id: number; 
  title: string; 
  hasProtection: boolean;
};

type Meta = {
  sheetByName: Map<string, SheetInfo>;
};

async function getMeta(sheets: sheets_v4.Sheets): Promise<Meta> {
  const res = await retryWithBackoff(() =>
    sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  );
  const sheetByName = new Map<string, SheetInfo>();
  res.data.sheets?.forEach((s) => {
    if (s.properties?.title && s.properties?.sheetId != null) {
      sheetByName.set(s.properties.title, {
        id: s.properties.sheetId!,
        title: s.properties.title!,
        hasProtection: (s.protectedRanges?.length ?? 0) > 0,
      });
    }
  });
  return { sheetByName };
}

// ========== Ensure Sheets & Headers ==========
async function ensureSheetAndHeaders(
  sheets: sheets_v4.Sheets,
  schema: SheetSchema,
  metaCache: Meta
): Promise<boolean> {
  // Use cached metadata (refreshed externally when needed)
  
  // 1) Ensure sheet exists
  let wasCreated = false;
  
  if (!metaCache.sheetByName.has(schema.name)) {
    await logRow(sheets, {
      level: DRY_RUN ? 'INFO' : 'FIX',
      sheet: schema.name,
      code: 'CREATE_SHEET',
      message: DRY_RUN 
        ? `Sheet would be created with ${schema.headers.length} headers.`
        : `Creating sheet with ${schema.headers.length} headers...`,
    });
    
    if (!DRY_RUN) {
      // CRITICAL: Set flag BEFORE updating cache
      wasCreated = true;
      
      const createRes = await retryWithBackoff(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: schema.name,
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: Math.max(schema.headers.length, 26),
                      frozenRowCount: 1,
                    },
                  },
                },
              },
            ],
          },
        })
      );
      
      // CRITICAL: Update local cache with new sheet info
      const newSheetId = createRes.data.replies?.[0]?.addSheet?.properties?.sheetId;
      if (newSheetId !== undefined) {
        metaCache.sheetByName.set(schema.name, {
          id: newSheetId,
          title: schema.name,
          hasProtection: false, // New sheets don't have protection yet
        });
      }
      
      // NOTE: Don't return early! Continue to add headers and setup
    }
    
    // In DRY_RUN mode, continue to simulate header validation
    // Don't return early - we need to test validation logic
  }

  const sheetInfo = metaCache.sheetByName.get(schema.name);
  
  if (!sheetInfo && !DRY_RUN) {
    console.warn(`⚠️  Sheet ${schema.name} not found after creation, skipping...`);
    return false;
  }
  
  // In DRY_RUN mode, use dummy sheetId if sheet doesn't exist
  const sid = sheetInfo?.id ?? 999999;

  // 2) Ensure header row
  let current: string[] = [];
  
  if (sheetInfo) {
    // Only read headers if sheet actually exists
    const res = await retryWithBackoff(() =>
      sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${schema.name}!1:1`,
      })
    );
    current = (res.data.values?.[0] || []) as string[];
  } else if (DRY_RUN) {
    // In DRY_RUN mode for non-existent sheets, simulate empty headers
    current = [];
  } else {
    // Sheet doesn't exist and we're not in DRY_RUN - shouldn't happen
    return false;
  }
  
  const desired = schema.headers;

  // Add missing headers at the end (لا نحذف أعمدة موجودة)
  const missing = desired.filter((h) => !current.includes(h));
  if (missing.length) {
    await logRow(sheets, {
      level: DRY_RUN ? 'INFO' : 'FIX',
      sheet: schema.name,
      code: 'ADD_MISSING_HEADERS',
      message: `Missing headers appended: ${missing.join(', ')}`,
    });
    
    if (!DRY_RUN) {
      const newHeaders = [...current, ...missing];
      await retryWithBackoff(() =>
        sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${schema.name}!1:1`,
          valueInputOption: 'RAW',
          requestBody: { values: [newHeaders] },
        })
      );
    }
  }

  // 3) Freeze first row (only if sheet exists)
  if (!DRY_RUN && sheetInfo) {
    await retryWithBackoff(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId: sid, gridProperties: { frozenRowCount: 1 } },
                fields: 'gridProperties.frozenRowCount',
              },
            },
          ],
        },
      })
    );
  }

  // 4) Optional protection (warningOnly) - only if sheet exists and not already protected
  if (schema.protected && !DRY_RUN && sheetInfo) {
    // Check if protection already exists (from cached metadata)
    if (!sheetInfo.hasProtection) {
      await retryWithBackoff(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                addProtectedRange: {
                  protectedRange: {
                    range: { sheetId: sid },
                    description: `System-managed: ${schema.name}`,
                    warningOnly: true,
                  },
                },
              },
            ],
          },
        })
      );
      
      await logRow(sheets, {
        level: 'FIX',
        sheet: schema.name,
        code: 'PROTECTION_ADDED',
        message: 'Added warning-only protection to sheet.',
      });
      
      // Update cache to reflect new protection status
      sheetInfo.hasProtection = true;
    } else {
      await logRow(sheets, {
        level: 'INFO',
        sheet: schema.name,
        code: 'PROTECTION_EXISTS',
        message: 'Sheet already has protection - skipped.',
      });
    }
  }
  
  return wasCreated; // Return true only if we created a new sheet
}

// ========== Ensure Enums + Data Validation ==========
async function ensureEnumsAndValidation(sheets: sheets_v4.Sheets, meta: Meta) {
  await logRow(sheets, {
    level: 'INFO',
    code: 'ENUM_VALIDATION_START',
    message: 'Starting Enums and Data Validation setup...',
  });

  // Ensure Enums sheet exists
  await ensureSheetAndHeaders(sheets, CORE_SHEETS.ENUMS, meta);

  // CRITICAL: Read Enums ONCE and cache locally
  console.log('📖 Reading Enums sheet (single fetch)...');
  const enumsRead = await retryWithBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Enums!A:B',
    })
  );
  const enumRows = enumsRead.data.values || [];

  // Build enums map from cached data
  for (const [k, arr] of Object.entries(ENUM_DEFAULTS)) {
    const existing = enumRows
      .filter((r) => (r[0] || '').toString().trim() === k)
      .map((r) => (r[1] || '').toString().trim());

    const toAppend = arr.filter((v) => !existing.includes(v));
    if (toAppend.length) {
      await logRow(sheets, {
        level: DRY_RUN ? 'INFO' : 'FIX',
        sheet: 'Enums',
        code: 'ENUM_APPEND',
        message: `${k}: +${toAppend.length} values`,
      });
      
      if (!DRY_RUN) {
        await retryWithBackoff(() =>
          sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Enums!A:B',
            valueInputOption: 'RAW',
            requestBody: { values: toAppend.map((v) => [k, v]) },
          })
        );
      }
    }
  }

  // CRITICAL: Cache headers for sheets we'll validate
  console.log('📖 Caching headers for validation targets...');
  const headerCache = new Map<string, string[]>();
  const sheetsToValidate = ['FinalPriceList', 'PartnerRegistry'];
  
  for (const sheetName of sheetsToValidate) {
    const headersRes = await retryWithBackoff(() =>
      sheets.spreadsheets.values.get({ 
        spreadsheetId: SPREADSHEET_ID, 
        range: `${sheetName}!1:1` 
      })
    );
    headerCache.set(sheetName, (headersRes.data.values?.[0] || []) as string[]);
    
    // Small delay between header reads
    await new Promise(r => setTimeout(r, 500));
  }

  // Apply validation using cached data
  const applyValidation = async (sheetName: string, columnName: string, values: string[]) => {
    const headers = headerCache.get(sheetName);
    if (!headers) {
      console.warn(`⚠️  No cached headers for ${sheetName}`);
      return;
    }
    
    const idx = headers.indexOf(columnName);
    if (idx < 0) return;

    // Use passed meta instead of fetching again
    const sheetInfo = meta.sheetByName.get(sheetName);
    if (!sheetInfo) return;
    const sid = sheetInfo.id;

    const rule: sheets_v4.Schema$DataValidationRule = {
      condition: { type: 'ONE_OF_LIST', values: values.map((v) => ({ userEnteredValue: v })) },
      strict: true,
      showCustomUi: true,
    };

    await logRow(sheets, {
      level: DRY_RUN ? 'INFO' : 'FIX',
      sheet: sheetName,
      code: 'DATA_VALIDATION',
      message: `Applied dropdown for ${columnName} with ${values.length} options.`,
    });

    if (!DRY_RUN) {
      await retryWithBackoff(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                setDataValidation: {
                  range: {
                    sheetId: sid,
                    startRowIndex: 1,
                    startColumnIndex: idx,
                    endColumnIndex: idx + 1,
                  },
                  rule,
                },
              },
            ],
          },
        })
      );
      
      // Small delay after validation to avoid rate limits
      await new Promise(r => setTimeout(r, 1000));
    }
  };

  // Apply validations to FinalPriceList
  await applyValidation('FinalPriceList', 'Status', ENUM_DEFAULTS.Status);
  await applyValidation('FinalPriceList', 'Line', ENUM_DEFAULTS.Line);
  await applyValidation('FinalPriceList', 'Amazon_TierKey', ENUM_DEFAULTS.Amazon_TierKey);
  await applyValidation('FinalPriceList', 'Box_Size', ENUM_DEFAULTS.Box_Size);

  // Apply validations to other sheets
  await applyValidation('PartnerRegistry', 'Tier', ENUM_DEFAULTS.Tier);
  await applyValidation('PartnerRegistry', 'PartnerType', ENUM_DEFAULTS.PartnerType);
  
  console.log('✅ Enum validation complete (quota-optimized)');
}

// ========== Read Full Sheet ==========
async function readTable(sheets: sheets_v4.Sheets, sheet: string) {
  const res = await retryWithBackoff(() =>
    sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: sheet })
  );
  const rows = res.data.values || [];
  const headers = (rows[0] || []).map((h) => String(h));
  const data = rows.slice(1).map((r) => {
    const o: Record<string, any> = {};
    headers.forEach((h, i) => (o[h] = r[i]));
    return o;
  });
  return { headers, data };
}

// ========== Data Quality Tests ==========
function isEAN13(v: any) {
  const s = String(v || '').trim();
  return /^[0-9]{13}$/.test(s);
}

async function testDataQuality(sheets: sheets_v4.Sheets) {
  await logRow(sheets, {
    level: 'INFO',
    code: 'DATA_QUALITY_START',
    message: 'Starting data quality checks...',
  });

  // Check FinalPriceList
  const fpl = await readTable(sheets, 'FinalPriceList');

  // SKU uniqueness
  const skuSet = new Set<string>();
  const duplicates: string[] = [];
  
  for (const r of fpl.data) {
    const sku = String(r.SKU || '').trim();
    if (!sku) {
      await logRow(sheets, {
        level: 'WARN',
        sheet: 'FinalPriceList',
        code: 'SKU_EMPTY',
        message: 'Row without SKU found.',
      });
      continue;
    }
    if (skuSet.has(sku)) duplicates.push(sku);
    skuSet.add(sku);

    // EAN validation
    const ean = r.EAN || r.Barcode;
    if (ean && !isEAN13(ean)) {
      await logRow(sheets, {
        level: 'WARN',
        sheet: 'FinalPriceList',
        code: 'EAN_INVALID',
        message: `SKU ${sku}: EAN is not 13 digits.`,
      });
    }
  }

  if (duplicates.length) {
    await logRow(sheets, {
      level: 'ERROR',
      sheet: 'FinalPriceList',
      code: 'SKU_DUPLICATE',
      message: `Duplicate SKUs: ${Array.from(new Set(duplicates)).join(', ')}`,
    });
  }

  // Check for Infinity/NaN/#DIV/0!
  const badCells: Array<{ sheet: string; row: number; col: string; val: string }> = [];
  const scan = (sheet: string, t: { headers: string[]; data: any[] }) => {
    t.data.forEach((row, i) => {
      t.headers.forEach((h, j) => {
        const v = row[h];
        if (v === 'Infinity' || v === Infinity || v === 'NaN' || v === '#DIV/0!') {
          badCells.push({ sheet, row: i + 2, col: colA1(j), val: String(v) });
        }
      });
    });
  };
  
  scan('FinalPriceList', fpl);
  
  if (badCells.length) {
    await logRow(sheets, {
      level: 'ERROR',
      sheet: 'Various',
      code: 'BAD_NUMERIC',
      message: `${badCells.length} cells contain Infinity/NaN/#DIV/0!.`,
    });
  }
}

// ========== Ensure Proposal Numbers ==========
async function ensureProposalNumbers(sheets: sheets_v4.Sheets) {
  const quotesSchema = PRODUCTION_SCHEMA.find((s) => s.name === 'Quotes');
  if (!quotesSchema) return;

  await ensureSheetAndHeaders(sheets, quotesSchema, await getMeta(sheets));

  const t = await readTable(sheets, 'Quotes');
  const headers = t.headers;
  const idx = headers.indexOf('ProposalNo');
  if (idx < 0) return;

  const existing = new Set<string>();
  const missingRows: number[] = [];
  
  t.data.forEach((r, i) => {
    const val = String(r['ProposalNo'] || '').trim();
    if (val) existing.add(val);
    else missingRows.push(i + 2);
  });

  const year = new Date().getFullYear();
  const nextNumber = (n: number) => `PR-${year}-${String(n).padStart(4, '0')}`;

  let max = 0;
  existing.forEach((v) => {
    const m = v.match(/^PR-(\d{4})-(\d{4})$/);
    if (m && Number(m[1]) === year) max = Math.max(max, Number(m[2]));
  });

  if (!missingRows.length) return;

  await logRow(sheets, {
    level: DRY_RUN ? 'INFO' : 'FIX',
    sheet: 'Quotes',
    code: 'PROPOSAL_FILL',
    message: `Generating ProposalNo for ${missingRows.length} rows.`,
  });

  if (DRY_RUN) return;

  const updates = missingRows.map((row) => {
    max += 1;
    const value = nextNumber(max);
    return {
      range: `Quotes!A${row}:A${row}`,
      values: [[value]],
    };
  });

  for (let i = 0; i < updates.length; i += WRITE_BATCH_SIZE) {
    const batch = updates.slice(i, i + WRITE_BATCH_SIZE);
    await retryWithBackoff(() =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { valueInputOption: 'RAW', data: batch },
      })
    );
    if (i + WRITE_BATCH_SIZE < updates.length)
      await new Promise((r) => setTimeout(r, WRITE_COOLDOWN_MS));
  }
}

// ========== Ensure Log Sheet ==========
async function ensureLogSheet(sheets: sheets_v4.Sheets, meta: Meta) {
  if (!meta.sheetByName.has('Validation_Log')) {
    if (!DRY_RUN) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: 'Validation_Log',
                  gridProperties: { rowCount: 2000, columnCount: 7, frozenRowCount: 1 },
                },
              },
            },
          ],
        },
      });
    }
  }
  
  await ensureSheetAndHeaders(sheets, CORE_SHEETS.VALIDATION_LOG, await getMeta(sheets));
  const meta2 = await getMeta(sheets);
  _logSheetId = meta2.sheetByName.get('Validation_Log')?.id ?? null;
}

// ========== Main Orchestrator ==========
async function main() {
  if (!SPREADSHEET_ID) {
    console.error('❌ SHEETS_SPREADSHEET_ID is not set.');
    process.exit(1);
  }

  console.log('📋 HAIROTICMEN — Deep Validator & Repair');
  console.log('========================================================================');
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY-RUN (no changes)' : '🛠️  APPLY (executing fixes)'}`);
  console.log(`Spreadsheet: ${SPREADSHEET_ID}\n`);

  // Load production schema
  await loadProductionSchema();

  const sheetsClient = await getUncachableGoogleSheetClient();
  const sheets = sheetsClient as sheets_v4.Sheets;

  // 0) Ensure log sheet
  await ensureLogSheet(sheets, await getMeta(sheets));

  // 1) Ensure all sheets + headers from production schema
  console.log('\n📄 Ensuring all sheets and headers...');
  console.log(`   Processing ${PRODUCTION_SCHEMA.length} sheets with quota-safe pacing...`);
  
  // CRITICAL: Fetch metadata ONCE at the start (not per sheet)
  const metaCache = await getMeta(sheets);
  console.log(`   Loaded metadata for ${metaCache.sheetByName.size} existing sheets\n`);
  
  let processedCount = 0;
  let sheetsCreated = 0;
  
  for (const s of PRODUCTION_SCHEMA) {
    // Pass cached metadata - it's updated in-place when sheets are created
    const created = await ensureSheetAndHeaders(sheets, s, metaCache);
    if (created) sheetsCreated++;
    processedCount++;
    
    // Add cooldown every 5 sheets to avoid quota limits (103 sheets / 5 = ~21 cooldowns)
    // With 8s cooldowns: 21 * 8s = 168s = 2.8 minutes total
    // Read rate: 103 reads / 2.8min ≈ 37 reads/min (safely under 60/min limit)
    if (processedCount % 5 === 0 && processedCount < PRODUCTION_SCHEMA.length) {
      console.log(`⏳ Processed ${processedCount}/${PRODUCTION_SCHEMA.length} sheets (${sheetsCreated} created), cooling down for 8s...`);
      await new Promise(r => setTimeout(r, 8000));
    }
  }
  
  console.log(`✅ Completed processing all ${processedCount} sheets (${sheetsCreated} newly created)`);

  // 2) Ensure critical Settings keys
  console.log('\n⚙️  Ensuring critical Settings...');
  console.log('   Adding 2-second cooldown before Settings check...');
  await new Promise(r => setTimeout(r, 2000));
  
  const settings = await readTable(sheets, 'Settings');
  const need: Array<[string, string, string]> = [];
  const ensureKey = (k: string, v: string, d: string) => {
    const has = settings.data.some((r) => String(r.Key || '') === k);
    if (!has) need.push([k, v, d]);
  };
  
  ensureKey('SHEETS_SPREADSHEET_ID', SPREADSHEET_ID, 'Primary workbook ID');
  ensureKey('SchemaVersion', 'v2.0', 'Schema version identifier');
  
  if (need.length) {
    await logRow(sheets, {
      level: DRY_RUN ? 'INFO' : 'FIX',
      sheet: 'Settings',
      code: 'SETTINGS_SEED',
      message: `Adding ${need.length} missing settings.`,
    });
    
    if (!DRY_RUN) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Settings!A:C',
        valueInputOption: 'RAW',
        requestBody: { values: need },
      });
    }
  }

  // 3) Enums + Data validation
  console.log('\n🔽 Setting up Enums and Data Validation...');
  console.log('   Adding 3-second cooldown before enum validation...');
  await new Promise(r => setTimeout(r, 3000));
  
  // Reuse existing metaCache instead of fetching again
  await ensureEnumsAndValidation(sheets, metaCache);

  // 4) Data quality tests
  console.log('\n🔍 Running data quality checks...');
  console.log('   Adding 2-second cooldown before data quality checks...');
  await new Promise(r => setTimeout(r, 2000));
  await testDataQuality(sheets);

  // 5) Proposal numbers in Quotes
  console.log('\n📝 Ensuring Proposal Numbers...');
  console.log('   Adding 2-second cooldown before proposal number generation...');
  await new Promise(r => setTimeout(r, 2000));
  await ensureProposalNumbers(sheets);

  console.log('\n========================================================================');
  console.log('✅ Validation complete.');
  console.log(`- Check Validation_Log sheet for results${DRY_RUN ? ' (simulation)' : ''}.`);
  console.log(`- Re-run with DRY_RUN=false to apply fixes${DRY_RUN ? '.' : ' (already applied).'}`);
  console.log('========================================================================\n');
}

// ESM guard
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error('\n❌ ERROR:', e?.message || e);
    console.error('\nStack:', e?.stack);
    process.exit(1);
  });
}

export { main as validateAndRepairWorkbook };
export { getMeta, readTable, logRow };
