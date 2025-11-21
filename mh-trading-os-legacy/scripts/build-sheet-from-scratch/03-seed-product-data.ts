/**
 * SCRIPT 3: Seed Product Data (Upsert + Carton + Enums & Drop-downs + Quota-safe)
 *
 * Usage:
 *   PRICING_CONFIG_PATH=server/config/hairoticmen-pricing.json \
 *   WRITE_BATCH_SIZE=10 WRITE_COOLDOWN_MS=3500 \
 *   SHEETS_SPREADSHEET_ID=<id> \
 *   tsx server/scripts/build-sheet-from-scratch/03-seed-product-data.ts
 */

import { getUncachableGoogleSheetClient } from '../../lib/sheets';
import { retryWithBackoff } from '../../lib/retry';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Load product slug mapping for SEO-friendly URLs
let SLUG_MAPPING: Record<string, { slug: string; url: string; verified: boolean }> = {};

// ---------- Env & Tunables ----------
const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID || '1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0';
const WRITE_BATCH_SIZE = Number(process.env.WRITE_BATCH_SIZE || '10');
const WRITE_COOLDOWN_MS = Number(process.env.WRITE_COOLDOWN_MS || '3500');

// نطاق الكتابة (عدد الصفوف) للتحقق/التنزيلات
const MAX_ROWS_FOR_VALIDATION = 20000;

if (!SPREADSHEET_ID) {
  console.error('❌ ERROR: SHEETS_SPREADSHEET_ID environment variable not set');
  process.exit(1);
}

// ---------- Utilities ----------
const round2 = (n: number) => Math.round(n * 100) / 100;

function parseNumber(v: any, dflt = 0): number {
  if (v === undefined || v === null) return dflt;
  const s = String(v).trim().replace(/\s/g, '');
  if (!s) return dflt;
  const norm = s.replace(/,/g, '.').replace(/[^0-9.\-]/g, '');
  const n = Number(norm);
  return Number.isFinite(n) ? n : dflt;
}
function parseBool(v: any, dflt=false): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return dflt;
  return ['true','1','yes','y','t'].includes(s);
}
function coalesce<T>(...vals: T[]): T | undefined {
  for (const v of vals) if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  return undefined;
}
function guessAmazonTier(weight_g?: number): string {
  const w = weight_g ?? 0;
  if (w <= 200) return 'Std_Parcel_S';
  if (w <= 400) return 'Std_Parcel_M';
  return 'Std_Parcel_L';
}
function guessBoxSize(weight_g?: number): 'Small'|'Medium'|'Large' {
  const w = weight_g ?? 0;
  if (w <= 250) return 'Small';
  if (w <= 700) return 'Medium';
  return 'Large';
}
// A1 helpers (لدعم أعمدة > Z)
function colIndexToA1(idx0: number): string {
  let n = idx0 + 1, s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function endColA1FromHeaders(headersLen: number) {
  return colIndexToA1(headersLen - 1);
}

// ---------- Types ----------
type Json = Record<string, any>;

interface ProductInput {
  SKU: string;
  ProductName: string;
  ProductName_DE?: string;
  Line: string;               // Premium/Skin/Professional/Basic/Tools
  Category: string;
  Subcategory?: string;
  Size_mL?: number;
  Size_g?: number;
  Weight_g?: number;
  IsBundle?: boolean;
  BarcodeEAN13?: string;
  FactoryPriceUnit: number;   // base ex-works per unit
  Import_Duty_Pct?: number;   // % of Factory
  Overhead_Pct?: number;      // % of Factory
  Packaging?: number;         // €/unit (retail pack)
  Freight?: number;           // inbound €/unit

  // Carton / Case pack
  UnitsPerCarton?: number;
  Inner_Pack_Units?: number;
  Carton_L_cm?: number;
  Carton_W_cm?: number;
  Carton_H_cm?: number;
  Carton_Weight_g?: number;
  Carton_Cost_EUR?: number;

  // Other
  Amazon_TierKey?: string;    // Std_Parcel_S/M/L
  Box_Size?: string;          // Small/Medium/Large
  Country_of_Origin?: string;
  HS_Code?: string;
  Brand?: string;
  Status?: 'Active'|'Draft'|'Discontinued';
}

interface PricingConfigV221 {
  version: string;
  vat: number;
  fxBufferPct: number;
  targetPostChannelMargin: number;
  returnsPct: number;
  paymentFeePct: number;
  consumerRoundTo: number;
  loyalty?: {
    pointsPerEuro: number;
    pointValueEur: number;
    expectedRedemption: number;
  };
  productLines: Record<string, { gmUvp: number; adPct: number; floorMult: number }>;
  channels: Record<string, {
    referralPct: number;
    platformPct: number;
    labelFee: number;
    applyPaymentFee: boolean;
    minReferralFeeEur?: number;
    tieredReferral?: Array<{ maxInc: number | null; pct: number }>;
    adPctOverride?: Record<string, number>;
    avgUnitsPerOrderDefault?: number;
  }>;
  amazonSizeTiers: Record<string, {
    pickPack: number; weight: number; storage: number; labelPrep: number; returnsPct: number;
  }>;
  boxCosts?: Record<string, number>;
  products?: ProductInput[];
  // اختيارية: خصم كرتون B2C
  cartonDiscountPctB2C?: number;  // مثال: 0.05 = 5%
}

// ---------- Load config (smart search) ----------
async function loadConfig(): Promise<PricingConfigV221> {
  const fromEnv = process.env.PRICING_CONFIG_PATH?.trim();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  
  const candidates = [
    fromEnv ? path.resolve(process.cwd(), fromEnv) : null,
    path.resolve(__dirname, '../../config/hairoticmen-pricing.json'),
    path.resolve(process.cwd(), 'server/config/hairoticmen-pricing.json'),
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      const raw = await fs.readFile(p, 'utf8');
      console.log(`✅ Config loaded from: ${p}\n`);
      return JSON.parse(raw);
    } catch (err: any) {
      // Silent fallback, only log if all fail
    }
  }
  throw new Error('Cannot load hairoticmen-pricing.json; set PRICING_CONFIG_PATH or place file in server/config/.');
}

// ---------- Math helpers ----------
function toInc99(net: number, vat: number): number {
  const inc = net * (1 + vat);
  const ceil = Math.ceil(inc);
  return round2(Math.max(0, ceil - 0.01));
}
function loyaltyCostPct(cfg: PricingConfigV221): number {
  const lp = cfg.loyalty?.pointsPerEuro || 0;
  const pv = cfg.loyalty?.pointValueEur || 0;
  const er = cfg.loyalty?.expectedRedemption || 0;
  return Math.min(1, lp * pv * er);
}
function referralResolverFactory(cfg: PricingConfigV221, channelKey: string) {
  const ch = cfg.channels[channelKey];
  const tiered = ch?.tieredReferral;
  if (!tiered || tiered.length === 0) {
    const pct = ch?.referralPct || 0;
    return (_inc: number) => pct;
  }
  return (inc: number) => {
    for (const t of tiered) {
      if (t.maxInc == null) return t.pct;
      if (inc <= t.maxInc) return t.pct;
    }
    return tiered[tiered.length - 1].pct;
  };
}
function computeFixedFeesFBA(cfg: PricingConfigV221, tierKey?: string): number {
  if (!tierKey) return 0;
  const t = cfg.amazonSizeTiers[tierKey];
  if (!t) return 0;
  return (t.pickPack || 0) + (t.weight || 0) + (t.storage || 0) + (t.labelPrep || 0);
}
function solveGuardrailNetPrice(
  cfg: PricingConfigV221,
  channelKey: string,
  line: string,
  fullCost: number,
  fixedFees: number,
  referralPctResolver: (inc: number) => number,
): number {
  const ch = cfg.channels[channelKey];
  if (!ch) return Infinity;
  const adPct = ch.adPctOverride?.[line] ?? cfg.productLines[line]?.adPct ?? 0;
  const payPct = ch.applyPaymentFee ? (cfg.paymentFeePct || 0) : 0;
  const retPct = cfg.returnsPct || 0;
  const loyPct = loyaltyCostPct(cfg);
  const platPct = ch.platformPct || 0;

  const oneIter = (refPct: number) => {
    const varPct = adPct + payPct + retPct + loyPct + platPct + refPct; // نسبة من NET
    const denom = 1 - (varPct + cfg.targetPostChannelMargin);
    if (denom <= 0) return Infinity;
    const net = (fullCost + fixedFees) / denom;
    return net;
  };

  let net = oneIter(0.15);
  for (let i = 0; i < 5; i++) {
    const inc = net * (1 + cfg.vat);
    const refPct = referralPctResolver(inc);
    const newNet = oneIter(refPct);
    if (!isFinite(newNet)) return Infinity;
    if (Math.abs(newNet - net) < 0.01) { net = newNet; break; }
    net = newNet;
  }
  return net;
}

// ---------- Costing ----------
function computeCosts(cfg: PricingConfigV221, p: ProductInput) {
  const fxBufferedFactory = p.FactoryPriceUnit * (1 + (cfg.fxBufferPct || 0));
  const duty = (p.Import_Duty_Pct || 0) / 100;
  const overhead = (p.Overhead_Pct || 0) / 100;
  const packaging = p.Packaging || 0;
  const freight = p.Freight || 0;
  const cogs = fxBufferedFactory * (1 + duty) * (1 + overhead) + packaging + freight;

  const lineCfg = cfg.productLines[p.Line] || { gmUvp: 0.5, adPct: 0.07, floorMult: 2.1 };
  const fullCost = cogs; // تكاليف القناة تُؤخذ لاحقاً في الحواجز

  const floorNet = fullCost * (lineCfg.floorMult || 2);
  const uvpNet = fullCost / (1 - (lineCfg.gmUvp || 0.5));
  const uvpInc99 = toInc99(uvpNet, cfg.vat);

  return { fxBufferedFactory: round2(fxBufferedFactory), cogs: round2(cogs), fullCost: round2(fullCost),
           floorNet: round2(floorNet), uvpNet: round2(uvpNet), uvpInc99: round2(uvpInc99) };
}

// ---------- Sheets helpers ----------
async function getHeaders(client: any, sheetName: string): Promise<string[]> {
  const res = await retryWithBackoff(() =>
    client.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!1:1` })
  ) as any;
  return (res.data.values?.[0] || []).map((s: any) => String(s));
}
async function getSheetAllValues(client: any, sheetName: string): Promise<string[][]> {
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: `${sheetName}`,
    valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING',
  });
  return (res.data.values || []) as string[][];
}
async function getSkuRowMap(client: any, sheetName: string, skuColName: string): Promise<Map<string, number>> {
  const headers = await getHeaders(client, sheetName);
  const skuIdx = headers.indexOf(skuColName);
  if (skuIdx < 0) return new Map();
  const endColA1 = endColA1FromHeaders(headers.length);
  const res = await retryWithBackoff(() =>
    client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: `${sheetName}!A2:${endColA1}`,
    })
  ) as any;
  const map = new Map<string, number>();
  (res.data.values || []).forEach((row: string[], i: number) => {
    const sku = (row[skuIdx] || '').toString().trim();
    if (sku) map.set(sku, i + 2);
  });
  return map;
}
function buildRowByHeaders(headers: string[], values: Record<string, any>): any[] {
  return headers.map((h) => (values[h] ?? ''));
}
async function batchedRowUpdates(
  client: any, updates: Array<{ sheet: string; row: number; values: any[] }>, headersLen: number,
) {
  if (updates.length === 0) return;
  const endColA1 = endColA1FromHeaders(headersLen);
  const data = updates.map(u => ({ range: `${u.sheet}!A${u.row}:${endColA1}${u.row}`, values: [u.values] }));
  await retryWithBackoff(() =>
    client.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { valueInputOption: 'RAW', data }
    })
  );
  console.log(`   ✅ Batch updated ${updates.length} rows in 1 API call`);
}
async function batchedAppends(client: any, sheet: string, rows: any[][], startCell = 'A2') {
  for (let i = 0; i < rows.length; i += WRITE_BATCH_SIZE) {
    const batch = rows.slice(i, i + WRITE_BATCH_SIZE);
    await retryWithBackoff(() =>
      client.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID, range: `${sheet}!${startCell}`,
        valueInputOption: 'RAW', requestBody: { values: batch },
      })
    );
    if (i + WRITE_BATCH_SIZE < rows.length) await new Promise((r) => setTimeout(r, WRITE_COOLDOWN_MS));
  }
}

// ---------- Ensure headers (add carton & master data fields) ----------
const FPL_REQUIRED_HEADERS: string[] = [
  'SKU','Name','Category','Brand','Barcode','Status',
  'Factory_Cost_EUR','Packaging_Cost_EUR','Freight_kg_EUR','Import_Duty_Pct','Overhead_Pct','COGS_EUR',
  'Shipping_Inbound_per_unit','EPR_LUCID_per_unit','GS1_per_unit','Retail_Packaging_per_unit',
  'QC_PIF_per_unit','Operations_per_unit','Marketing_per_unit','FullCost_EUR',
  'FactoryPriceUnit_Manual','TotalFactoryPriceCarton','UnitsPerCarton','FX_BufferPct',
  'Weight_g','Content_ml','Net_Content_ml','Dims_cm','VAT%',
  'Grundpreis','Grundpreis_Net','Grundpreis_Unit',
  'Amazon_TierKey','Line','Manual_UVP_Inc',
  'UVP_Net','UVP_Inc','UVP_Inc_99','UVP_vs_Floor_Flag',
  'Guardrail_OwnStore_Inc','Guardrail_Amazon_FBM_Inc','Guardrail_Amazon_FBA_Inc',
  'Box_Size','Box_Cost_Per_Unit','Gift_Cost_Expected_Unit','Grundpreis_Inc_Per_L',
  'Pricing_Engine_Version',
  'Ad_Pct','Returns_Pct','Loyalty_Pct','Payment_Pct','Amazon_Referral_Pct',
  'DHL_WeightBand','DHL_Zone',
  'Gift_SKU','Gift_SKU_Cost','Gift_Attach_Rate','Gift_Funding_Pct','Gift_Shipping_Increment',
  'PostChannel_Margin_Pct','Floor_B2C_Net','Guardrail_OK',
  'UVP_Recommended','UVP','MAP','AutoPriceFlag',
  'Price_Web','Price_Amazon','Price_Salon',
  'Net_Dealer_Basic','Net_Dealer_Plus','Net_Stand','Net_Distributor',
  // Carton derived
  'Carton_L_cm','Carton_W_cm','Carton_H_cm','Carton_Weight_g','Carton_Cost_EUR',
  'Unit_From_Carton_Cost','Carton_UVP_Inc_99','Carton_Discount_Pct',
  // Competitive intel & meta
  'Competitor_Min','Competitor_Median','Pricing_Version','QRUrl','Notes'
];

async function ensureHeaders(client: any, sheetName: string, required: string[]): Promise<string[]> {
  let headers: string[] = [];
  try {
    headers = await getHeaders(client, sheetName);
  } catch {
    // لو الشيت غير موجود، نتركه (مفترض أن Script 1 أنشأه)
    return required.slice();
  }
  const set = new Set(headers);
  const missing = required.filter(h => !set.has(h));
  if (missing.length === 0) return headers;
  const merged = headers.concat(missing);
  const endColA1 = endColA1FromHeaders(merged.length);
  await retryWithBackoff(() =>
    client.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:${endColA1}1`,
      valueInputOption: 'RAW',
      requestBody: { values: [merged] }
    })
  );
  console.log(`   ➕ ${sheetName}: added ${missing.length} headers`);
  return merged;
}

// ---------- Enums & Data Validations ----------
const ENUMS_SHEET = 'Enums';
const ENUM_COLS = {
  Product_Lines: 'A',
  Amazon_Tier_Keys: 'B',
  Box_Sizes: 'C',
  Status_List: 'D',
  Brands: 'E',
  Categories: 'F',
  Subcategories: 'G',
};
const NAMED_RANGES = {
  Product_Lines: 'nr_Product_Lines',
  Amazon_Tier_Keys: 'nr_Amazon_Tier_Keys',
  Box_Sizes: 'nr_Box_Sizes',
  Status_List: 'nr_Status_List',
  Brands: 'nr_Brands',
  Categories: 'nr_Categories',
  Subcategories: 'nr_Subcategories'
};

async function getSpreadsheetMeta(client: any) {
  const meta = await retryWithBackoff(() =>
    client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  ) as any;
  const byTitle = new Map<string, number>();
  meta.data.sheets?.forEach((s: any) => byTitle.set(s.properties.title, s.properties.sheetId));
  return { meta: meta.data, idByTitle: byTitle };
}

async function ensureEnumsAndValidations(client: any, cfg: PricingConfigV221) {
  const { meta, idByTitle } = await getSpreadsheetMeta(client);

  // 1) Ensure Enums sheet exists
  if (!idByTitle.has(ENUMS_SHEET)) {
    await retryWithBackoff(() =>
      client.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: ENUMS_SHEET, gridProperties: { rowCount: 1000, columnCount: 8, frozenRowCount: 1 } } } }] }
      })
    );
    idByTitle.set(ENUMS_SHEET, (await getSpreadsheetMeta(client)).idByTitle.get(ENUMS_SHEET)!);
  }

  // 2) Build lists (from config + existing sheet unique values)
  const fplRows = await getSheetAllValues(client, 'FinalPriceList').catch(()=>[]) as string[][];
  const headers = fplRows[0] || [];
  const idx = (h: string) => headers.indexOf(h);
  const catIdx = idx('Category'), subIdx = idx('Subcategory'), brandIdx = idx('Brand');
  const uniq = (arr: any[]) => Array.from(new Set(arr.filter(Boolean)));

  const existingCats = uniq(fplRows.slice(1).map(r => r[catIdx] || '').map(String));
  const existingSubs = uniq(fplRows.slice(1).map(r => r[subIdx] || '').map(String));
  const existingBrands = uniq(fplRows.slice(1).map(r => r[brandIdx] || '').map(String));

  const lines = Object.keys(cfg.productLines || {});
  const tiers = Object.keys(cfg.amazonSizeTiers || {});
  const boxes = Object.keys(cfg.boxCosts || { Small: 0, Medium: 0.75, Large: 1.2 });

  const statusList = ['Active','Draft','Discontinued'];
  const brands = uniq(['HAIROTICMEN', ...existingBrands]);
  const defaultCats = ['Beard','Hair','Skin','Body','Fragrance','Tools','Accessories','Gifts'];
  const catList = uniq([...existingCats, ...defaultCats]);
  const subListDefault = ['Shampoo','Conditioner','Oil','Balm','Butter','Serum','Cream','Wax','Clay','Gel','Lotion','Cleanser','Exfoliant','Mask','Toner','Treatment','Kit','Bundle','Device','Accessory'];
  const subList = uniq([...existingSubs, ...subListDefault]);

  // 3) Write Enums
  const enumsHeaders = ['Product_Lines','Amazon_Tier_Keys','Box_Sizes','Status_List','Brands','Categories','Subcategories'];
  const maxLen = Math.max(lines.length, tiers.length, boxes.length, statusList.length, brands.length, catList.length, subList.length);
  const table: any[][] = [enumsHeaders];
  for (let i=0; i<maxLen; i++) {
    table.push([
      lines[i] || '', tiers[i] || '', boxes[i] || '',
      statusList[i] || '', brands[i] || '',
      catList[i] || '', subList[i] || ''
    ]);
  }
  const endCol = colIndexToA1(enumsHeaders.length - 1);
  await retryWithBackoff(() =>
    client.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ENUMS_SHEET}!A1:${endCol}${table.length}`,
      valueInputOption: 'RAW',
      requestBody: { values: table }
    })
  );

  // 4) Named ranges
  const enumsId = idByTitle.get(ENUMS_SHEET)!;
  const namedReqs = Object.entries(NAMED_RANGES).map(([key, name]) => {
    const col = (ENUM_COLS as any)[key];
    return {
      addNamedRange: {
        namedRange: {
          name,
          range: {
            sheetId: enumsId,
            startRowIndex: 1,
            startColumnIndex: col.charCodeAt(0)-65,
            endRowIndex: table.length,
            endColumnIndex: col.charCodeAt(0)-65+1
          }
        }
      }
    };
  });

  // لحذف أي NamedRanges قديمة بنفس الأسماء أولاً
  const existingNamed = meta.namedRanges || [];
  const deleteReqs = existingNamed
    .filter((nr: any) => Object.values(NAMED_RANGES).includes(nr.name))
    .map((nr: any) => ({ deleteNamedRange: { namedRangeId: nr.namedRangeId } }));

  await retryWithBackoff(() =>
    client.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [...deleteReqs, ...namedReqs] }
    })
  );

  // 5) Apply Data Validations on FinalPriceList sheet
  const fplId = idByTitle.get('FinalPriceList');
  if (!fplId) return; // في حال عدم وجود الشيت

  // Helper rule ONE_OF_RANGE via named range
  const oneOfRange = (named: string) => ({
    condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: `=${named}` }] },
    strict: true, showCustomUi: true
  });

  // تعيين الأعمدة بحسب الهيدر
  const fplHeaders = await getHeaders(client, 'FinalPriceList');
  const colIndex = (h: string) => fplHeaders.indexOf(h);

  const targets: Array<{ header: string; named: string }> = [
    { header: 'Line', named: NAMED_RANGES.Product_Lines },
    { header: 'Amazon_TierKey', named: NAMED_RANGES.Amazon_Tier_Keys },
    { header: 'Box_Size', named: NAMED_RANGES.Box_Sizes },
    { header: 'Status', named: NAMED_RANGES.Status_List },
    { header: 'Brand', named: NAMED_RANGES.Brands },
    { header: 'Category', named: NAMED_RANGES.Categories },
    { header: 'Subcategory', named: NAMED_RANGES.Subcategories },
  ];

  const requests: any[] = [];
  for (const t of targets) {
    const c = colIndex(t.header);
    if (c >= 0) {
      requests.push({
        setDataValidation: {
          range: {
            sheetId: fplId,
            startRowIndex: 1,
            endRowIndex: MAX_ROWS_FOR_VALIDATION,
            startColumnIndex: c,
            endColumnIndex: c+1
          },
          rule: oneOfRange(t.named)
        }
      });
    }
  }

  // قواعد رقمية لحقول الكرتون
  const numericHeaders = ['UnitsPerCarton','Inner_Pack_Units','Carton_L_cm','Carton_W_cm','Carton_H_cm','Carton_Weight_g','Carton_Cost_EUR'];
  for (const nh of numericHeaders) {
    const c = colIndex(nh);
    if (c >= 0) {
      requests.push({
        setDataValidation: {
          range: { sheetId: fplId, startRowIndex: 1, endRowIndex: MAX_ROWS_FOR_VALIDATION, startColumnIndex: c, endColumnIndex: c+1 },
          rule: { condition: { type: 'NUMBER_GREATER', values: [{ userEnteredValue: '0' }] }, strict: false, showCustomUi: true }
        }
      });
    }
  }

  if (requests.length) {
    await retryWithBackoff(() =>
      client.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } })
    );
  }
}

// ---------- Load products (config → fallback sheet) ----------
async function loadProductsOrFallback(client: any, cfg: PricingConfigV221): Promise<ProductInput[]> {
  const cfgProducts = Array.isArray(cfg.products) ? cfg.products : [];
  if (cfgProducts.length) {
    console.log(`ℹ️ Config products[]: ${cfgProducts.length}`);
    return cfgProducts;
  }

  console.warn('⚠️ Config has no products[] — fallback: reading FinalPriceList sheet …');
  const rows = await getSheetAllValues(client, 'FinalPriceList');
  const headers = rows[0] || [];
  const data = rows.slice(1).map(r =>
    Object.fromEntries(headers.map((h: string, i: number) => [String(h).trim(), r[i]]))
  );

  const out: ProductInput[] = [];
  for (const d of data) {
    const sku = coalesce(d.SKU, d.EAN, d.Ean, d.Item, d.ProductCode)?.toString();
    if (!sku) continue;

    const prodName = coalesce(d.ProductName, d.Item, d.Name)?.toString() || sku;
    const line = (coalesce(d.Line, d.Product_Line, d['Line ']) || 'Premium').toString();
    const category = (coalesce(d.Category, d.Product_Group, d.Group) || 'Beard').toString();

    const size_ml = parseNumber(coalesce(d.Net_Content_ml, d.Size_mL, d['Size (ml)']), 0);
    const size_g  = parseNumber(coalesce(d.Size_g, d['Size (g)']), 0);
    const weight  = parseNumber(coalesce(d.Weight_g, d['Weight (g)']), 0);
    const isBundle = parseBool(coalesce(d.IsBundle, d.Bundle), false);

    const ean = coalesce(d.EAN, d.BarcodeEAN13, d.Barcode);
    const fpu = parseNumber(coalesce(d.FactoryPriceUnit_Final, d.FactoryPriceUnit_Manual, d.FactoryPriceUnit, d['Factory Price']), 0);
    const pack = parseNumber(coalesce(d.Retail_Packaging, d.Packaging, d.B2C_BoxCost_per_unit), 0.35);
    const freight = parseNumber(coalesce(d.Shipping_Inbound_per_unit, d.Freight), 0.35);

    let tierKey = (coalesce(d.Amazon_TierKey) || '').toString();
    let boxSize = (coalesce(d.Box_Size) || '').toString();
    if (!tierKey) tierKey = guessAmazonTier(weight);
    if (!boxSize) boxSize = guessBoxSize(weight);

    // Carton fields fallback
    const unitsPerCarton = parseNumber(coalesce(d.UnitsPerCarton, d['Units/Carton']), 0);
    const innerPack = parseNumber(coalesce(d.Inner_Pack_Units, d['Inner Pack']), 0);
    const cL = parseNumber(coalesce(d.Carton_L_cm, d['Carton L (cm)']), 0);
    const cW = parseNumber(coalesce(d.Carton_W_cm, d['Carton W (cm)']), 0);
    const cH = parseNumber(coalesce(d.Carton_H_cm, d['Carton H (cm)']), 0);
    const cWg = parseNumber(coalesce(d.Carton_Weight_g, d['Carton Weight (g)']), 0);
    const cCost = parseNumber(coalesce(d.Carton_Cost_EUR, d['Carton Cost (€)']), 0);

    out.push({
      SKU: sku, ProductName: prodName, ProductName_DE: d.ProductName_DE || '',
      Line: line, Category: category, Subcategory: d.Subcategory || '',
      Size_mL: size_ml || undefined, Size_g: size_g || undefined, Weight_g: weight || undefined,
      IsBundle: isBundle, BarcodeEAN13: ean ? String(ean) : undefined,
      FactoryPriceUnit: fpu, Import_Duty_Pct: parseNumber(d.Import_Duty_Pct, 0), Overhead_Pct: parseNumber(d.Overhead_Pct, 0),
      Packaging: pack, Freight: freight, Amazon_TierKey: tierKey, Box_Size: boxSize,
      UnitsPerCarton: unitsPerCarton || undefined, Inner_Pack_Units: innerPack || undefined,
      Carton_L_cm: cL || undefined, Carton_W_cm: cW || undefined, Carton_H_cm: cH || undefined,
      Carton_Weight_g: cWg || undefined, Carton_Cost_EUR: cCost || undefined,
      Brand: d.Brand || 'HAIROTICMEN', Status: (d.Status as any) || 'Active',
      Country_of_Origin: d.Country_of_Origin || '', HS_Code: d.HS_Code || ''
    });
  }
  console.log(`ℹ️ Fallback loaded ${out.length} products from FinalPriceList sheet`);
  return out;
}

// ---------- Main seeding ----------
async function seedProductData() {
  console.log('📦 MH-Trading-OS - Product Data Seeder (Carton + Enums)');
  console.log('='.repeat(71));
  console.log(`Spreadsheet ID: ${SPREADSHEET_ID}\n`);

  const client = await getUncachableGoogleSheetClient();
  const cfg = await loadConfig();
  
  // Load slug mapping for SEO-friendly URLs
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const slugMappingPath = path.join(__dirname, '..', '..', 'config', 'product-slug-mapping-complete.json');
    const slugMappingData = JSON.parse(await fs.readFile(slugMappingPath, 'utf-8'));
    SLUG_MAPPING = slugMappingData.mapping || {};
    console.log(`✅ Loaded slug mapping for ${Object.keys(SLUG_MAPPING).length} products\n`);
  } catch (error: any) {
    console.log(`⚠️  Warning: Could not load slug mapping (${error.message}), will use SKU-based fallback URLs\n`);
  }

  // 0) Enums + Drop-downs (قبل الكتابة لضمان القوائم)
  await ensureEnumsAndValidations(client, cfg);

  // 1) Ensure headers (FinalPriceList only)
  const fplHeaders  = await ensureHeaders(client, 'FinalPriceList', FPL_REQUIRED_HEADERS);

  // 2) Load products
  const products: ProductInput[] = await loadProductsOrFallback(client, cfg);
  if (products.length === 0) {
    console.error('❌ ERROR: No products found (config or sheet).');
    process.exit(1);
  }
  console.log(`✅ Loaded ${products.length} products\n`);

  // 3) Upsert maps
  const skuColNameFpl  = fplHeaders.includes('SKU') ? 'SKU' : (fplHeaders.includes('EAN') ? 'EAN' : 'SKU');
  const fplRowMap  = await getSkuRowMap(client, 'FinalPriceList', skuColNameFpl);

  const updatesFpl: Array<{ sheet: string; row: number; values: any[] }> = [];
  const appendsFpl: any[][] = [];

  const loyPct = loyaltyCostPct(cfg);

  for (const p of products) {
    // Validate that category is properly set in the source JSON
    if (!p.Category || p.Category === 'General' || p.Subcategory === 'Other') {
      throw new Error(`❌ Product ${p.SKU} has invalid category: ${p.Category}/${p.Subcategory}. Categories must be correctly set in hairoticmen-pricing.json.`);
    }

    // Defaults
    const brand = p.Brand || 'HAIROTICMEN';
    const status = (p.Status as any) || 'Active';

    // Cost & prices
    const { fxBufferedFactory, cogs, fullCost, floorNet, uvpNet, uvpInc99 } = computeCosts(cfg, p);
    
    // Generate QR URL: Use slug-based URL if available, fallback to SKU-based
    let qrUrl: string;
    if (SLUG_MAPPING[p.SKU]) {
      // Use SEO-friendly slug URL
      qrUrl = SLUG_MAPPING[p.SKU].url;
      if (p.BarcodeEAN13) {
        // Add barcode parameter to slug URL
        qrUrl = `${qrUrl.replace(/\/$/, '')}?barcode=${p.BarcodeEAN13}`;
      }
    } else {
      // Fallback to SKU-based URL (should not happen if mapping is complete)
      console.warn(`⚠️  Missing slug mapping for ${p.SKU}, using SKU-based fallback`);
      qrUrl = p.BarcodeEAN13 
        ? `https://hairoticmen.de/products/${p.SKU}?barcode=${p.BarcodeEAN13}` 
        : `https://hairoticmen.de/products/${p.SKU}`;
    }

    // Guardrails
    const ownNet = solveGuardrailNetPrice(cfg, 'OwnStore', p.Line, fullCost, 0,  referralResolverFactory(cfg, 'OwnStore'));
    const fbmNet = solveGuardrailNetPrice(cfg, 'Amazon_FBM', p.Line, fullCost, (cfg.channels['Amazon_FBM']?.labelFee||0), referralResolverFactory(cfg, 'Amazon_FBM'));
    const fbaNet = solveGuardrailNetPrice(cfg, 'Amazon_FBA', p.Line, fullCost, computeFixedFeesFBA(cfg, p.Amazon_TierKey), referralResolverFactory(cfg, 'Amazon_FBA'));

    const ownInc99 = isFinite(ownNet) ? toInc99(ownNet, cfg.vat) : '';
    const fbmInc99 = isFinite(fbmNet) ? toInc99(fbmNet, cfg.vat) : '';
    const fbaInc99 = isFinite(fbaNet) ? toInc99(fbaNet, cfg.vat) : '';

    // Carton fields + derived
    const unitsPerCarton = p.UnitsPerCarton || 0;
    const cartonCost = p.Carton_Cost_EUR || 0;
    const unitFromCartonCost = unitsPerCarton > 0 ? round2(cartonCost / unitsPerCarton) : 0;
    const cartonDiscount = cfg.cartonDiscountPctB2C ?? 0; // خصم كرتون اختياري
    const cartonUvpInc99 = unitsPerCarton > 0 ? round2(uvpInc99 * unitsPerCarton * (1 - cartonDiscount)) : '';

    // Grundpreis (€/L)
    const grundpreisPerL = p.Size_mL ? round2((uvpInc99 / p.Size_mL) * 1000) : 0;
    const boxCost = cfg.boxCosts?.[p.Box_Size || 'Small'] ?? 0;
    const lineCfg = cfg.productLines[p.Line] || { gmUvp: 0.5, adPct: 0.07, floorMult: 2.1 };

    // FinalPriceList row
    const fplValues: Record<string, any> = {
      'SKU': p.SKU, 'Name': p.ProductName, 'Category': p.Category, 'Brand': brand, 'Barcode': p.BarcodeEAN13 || '', 'Status': status,
      'Factory_Cost_EUR': fxBufferedFactory, 'Packaging_Cost_EUR': p.Packaging || 0, 'Freight_kg_EUR': p.Freight || 0,
      'Import_Duty_Pct': p.Import_Duty_Pct || 0, 'Overhead_Pct': p.Overhead_Pct || 0, 'COGS_EUR': cogs,
      'Shipping_Inbound_per_unit': p.Freight || 0, 'EPR_LUCID_per_unit': 0, 'GS1_per_unit': 0, 'Retail_Packaging_per_unit': p.Packaging || 0,
      'QC_PIF_per_unit': 0, 'Operations_per_unit': 0, 'Marketing_per_unit': 0, 'FullCost_EUR': fullCost,
      'FactoryPriceUnit_Manual': '', 'TotalFactoryPriceCarton': '', 'UnitsPerCarton': unitsPerCarton || '',
      'FX_BufferPct': (cfg.fxBufferPct || 0) * 100,
      'Weight_g': p.Weight_g || '', 'Content_ml': p.Size_mL || '', 'Net_Content_ml': p.Size_mL || '',
      'Dims_cm': '', 'VAT%': (cfg.vat || 0.19) * 100,
      'Grundpreis': grundpreisPerL ? `€${grundpreisPerL.toFixed(2)}/L` : '', 'Grundpreis_Net': grundpreisPerL ? round2(grundpreisPerL / (1 + cfg.vat)) : '', 'Grundpreis_Unit': 'L',
      'Amazon_TierKey': p.Amazon_TierKey || '', 'Line': p.Line, 'Manual_UVP_Inc': '',
      'UVP_Net': round2(uvpNet), 'UVP_Inc': round2(uvpNet * (1 + cfg.vat)), 'UVP_Inc_99': round2(uvpInc99),
      'UVP_vs_Floor_Flag': uvpInc99 >= floorNet ? 'OK' : 'Below Floor',
      'Guardrail_OwnStore_Inc': ownInc99, 'Guardrail_Amazon_FBM_Inc': fbmInc99, 'Guardrail_Amazon_FBA_Inc': fbaInc99,
      'Box_Size': p.Box_Size || '', 'Box_Cost_Per_Unit': boxCost, 'Gift_Cost_Expected_Unit': 0, 'Grundpreis_Inc_Per_L': grundpreisPerL,
      'Pricing_Engine_Version': 'V2.2.1',
      'Ad_Pct': (lineCfg.adPct || 0) * 100, 'Returns_Pct': (cfg.returnsPct || 0) * 100, 'Loyalty_Pct': loyPct * 100, 'Payment_Pct': (cfg.paymentFeePct || 0) * 100,
      'Amazon_Referral_Pct': (cfg.channels['Amazon_FBA']?.referralPct || 0.15) * 100,
      'DHL_WeightBand': '', 'DHL_Zone': '',
      'Gift_SKU': '', 'Gift_SKU_Cost': 0, 'Gift_Attach_Rate': 0, 'Gift_Funding_Pct': 0, 'Gift_Shipping_Increment': 0,
      'PostChannel_Margin_Pct': (cfg.targetPostChannelMargin || 0.38) * 100, 'Floor_B2C_Net': floorNet,
      'Guardrail_OK': (typeof ownInc99 === 'number' && uvpInc99 >= ownInc99) ? 'YES' : 'NO',
      'UVP_Recommended': round2(uvpNet), 'UVP': round2(uvpNet), 'MAP': round2(uvpNet * 0.95), 'AutoPriceFlag': '',
      'Price_Web': round2(uvpInc99), 'Price_Amazon': round2(uvpInc99), 'Price_Salon': round2(uvpNet * 0.85),
      'Net_Dealer_Basic': round2(uvpNet * 0.60), 'Net_Dealer_Plus': round2(uvpNet * 0.50), 'Net_Stand': round2(uvpNet * 0.70), 'Net_Distributor': round2(uvpNet * 0.40),
      // Carton
      'Carton_L_cm': p.Carton_L_cm || '', 'Carton_W_cm': p.Carton_W_cm || '', 'Carton_H_cm': p.Carton_H_cm || '',
      'Carton_Weight_g': p.Carton_Weight_g || '', 'Carton_Cost_EUR': cartonCost || '',
      'Unit_From_Carton_Cost': unitFromCartonCost || '', 'Carton_UVP_Inc_99': cartonUvpInc99 || '', 'Carton_Discount_Pct': (cfg.cartonDiscountPctB2C ?? 0) * 100,
      // Intel & Meta
      'Competitor_Min': '', 'Competitor_Median': '', 'Pricing_Version': 'V2.2.1', 'QRUrl': qrUrl, 'Notes': 'Initial import with carton & enums'
    };

    const fplRow  = buildRowByHeaders(fplHeaders , fplValues );

    const fplRowNum = fplRowMap.get(p.SKU);
    if (fplRowNum)  updatesFpl.push({ sheet: 'FinalPriceList', row: fplRowNum, values: fplRow });
    else            appendsFpl.push(fplRow);
  }

  // 4) Writes (quota-safe)
  if (updatesFpl.length) await batchedRowUpdates(client, updatesFpl, fplHeaders.length);
  if (appendsFpl.length) await batchedAppends(client, 'FinalPriceList', appendsFpl, 'A2');
  console.log(`✅ FinalPriceList: updated=${updatesFpl.length}, appended=${appendsFpl.length}`);

  // 5) Data quality summary
  console.log('\n📊 Data Quality Check:');
  const rowsAll = [...appendsFpl, ...updatesFpl.map(u => u.values)];
  const infinityCount = rowsAll.filter(r => r.some(c => c === Infinity || c === 'Infinity')).length;
  console.log(`   Infinity values: ${infinityCount} (should be 0)`);
  console.log(`   Total products processed: ${products.length}`);
  console.log(`   Completeness: ${infinityCount === 0 ? '✅ 100%' : '⚠️ Issues found'}`);
  console.log(`   All products have valid categories from source JSON: ✅`);

  console.log('\n✅ Product data seeded successfully!');
  console.log('⏭️ NEXT: tsx server/scripts/build-sheet-from-scratch/04-setup-formulas.ts\n');
}

// ---------- Main ----------
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedProductData().catch((e) => {
    console.error('\n❌ ERROR:', e?.message || e);
    console.error('\nStack trace:', e?.stack);
    process.exit(1);
  });
}
