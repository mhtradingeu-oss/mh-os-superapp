/**
 * SCRIPT 6: Seed Unified Shipping Configuration (V3)
 * 
 * Populates:
 * - Packaging_Boxes (17 columns)
 * - ShippingWeightBands (DHL pricing tiers)
 * - ShippingCostsFixed (monthly fees, label costs)
 * - Settings (volumetricDivisor=5000)
 *
 * Usage:
 *   SHEETS_SPREADSHEET_ID=<id> \
 *   tsx server/scripts/build-sheet-from-scratch/06-seed-shipping-config.ts
 */

import { getUncachableGoogleSheetClient } from '../../lib/sheets';
import { retryWithBackoff } from '../../lib/retry';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID || '1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0';

if (!SPREADSHEET_ID) {
  console.error('❌ ERROR: SHEETS_SPREADSHEET_ID environment variable not set');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------- Utilities ----------
function colIndexToA1(idx0: number): string {
  let n = idx0 + 1, s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// ---------- Main ----------
async function main() {
  console.log('🚀 [06-seed-shipping-config] Starting unified shipping seed...\n');

  // 1) Load JSON config (use script-relative path for reliability)
  const configPath = path.resolve(__dirname, '../../config/hairoticmen-shipping-unified.json');
  console.log(`📦 Loading shipping config from: ${configPath}`);
  const configData = await fs.readFile(configPath, 'utf-8');
  const config = JSON.parse(configData);
  
  console.log(`✅ Loaded config version ${config.version} (effective: ${config.effectiveDate})\n`);

  // 2) Connect to Google Sheets
  const sheets = await getUncachableGoogleSheetClient();
  
  // 3) Seed Packaging_Boxes (17 columns)
  console.log('📦 Seeding Packaging_Boxes...');
  const packagingRows = config.packagingCatalog.map((box: any) => [
    box.code,
    box.name,
    box.boxType,
    box.inner_cm.L,
    box.inner_cm.W,
    box.inner_cm.H,
    box.outer_cm.L,
    box.outer_cm.W,
    box.outer_cm.H,
    box.tare_weight_g,
    box.unit_cost_eur,
    box.is_carton,
    box.units_per_carton ?? '',
    box.carton_cost_eur ?? '',
    box.max_units,
    box.max_weight_kg,
    box.active
  ]);

  await retryWithBackoff(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `Packaging_Boxes!A2:Q${packagingRows.length + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: packagingRows }
    });
  });
  console.log(`✅ Inserted ${packagingRows.length} packaging boxes\n`);

  // 4) Seed ShippingWeightBands
  console.log('📊 Seeding ShippingWeightBands...');
  const bandRows = config.weightBands.map((band: any) => [
    band.carrierId,
    band.serviceLevel,
    band.zone,
    band.minKg,
    band.maxKg,
    band.baseEur,
    band.fuelPct,
    band.active
  ]);

  await retryWithBackoff(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `ShippingWeightBands!A2:H${bandRows.length + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: bandRows }
    });
  });
  console.log(`✅ Inserted ${bandRows.length} weight bands\n`);

  // 5) Seed ShippingCostsFixed
  console.log('💰 Seeding ShippingCostsFixed...');
  const fixedRows = config.fixedCosts.map((cost: any) => [
    cost.costType,
    cost.channel,
    cost.costEur,
    cost.notes
  ]);

  await retryWithBackoff(async () => {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `ShippingCostsFixed!A2:D${fixedRows.length + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: fixedRows }
    });
  });
  console.log(`✅ Inserted ${fixedRows.length} fixed cost entries\n`);

  // 6) Update Settings sheet with volumetricDivisor
  console.log('⚙️  Updating Settings with volumetricDivisor...');
  await retryWithBackoff(async () => {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Settings!A:E',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'shipping_volumetric_divisor',
          String(config.defaults.volumetricDivisor),
          'Volumetric weight divisor (cm³/kg) for DHL',
          'shipping',
          new Date().toISOString()
        ]]
      }
    });
  });
  console.log(`✅ Added volumetricDivisor=${config.defaults.volumetricDivisor} to Settings\n`);

  console.log('✅ [06-seed-shipping-config] Completed successfully!');
  console.log('\n📋 Summary:');
  console.log(`   - Packaging Boxes: ${packagingRows.length}`);
  console.log(`   - Weight Bands: ${bandRows.length}`);
  console.log(`   - Fixed Costs: ${fixedRows.length}`);
  console.log(`   - Volumetric Divisor: ${config.defaults.volumetricDivisor}`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
