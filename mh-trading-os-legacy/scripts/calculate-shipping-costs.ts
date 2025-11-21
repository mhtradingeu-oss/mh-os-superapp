/**
 * Calculate and Write Shipping Costs to FinalPriceList
 * 
 * Reads product data, calculates per-channel shipping costs using unified V3 system,
 * and writes results to 8 new FinalPriceList columns.
 * 
 * Usage:
 *   SHEETS_SPREADSHEET_ID=<id> tsx server/scripts/calculate-shipping-costs.ts
 */

import { getUncachableGoogleSheetClient } from '../lib/sheets';
import { retryWithBackoff } from '../lib/retry';
import { ShippingService } from '../lib/shipping';
import { GoogleSheetsService } from '../lib/sheets';

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID || '1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  console.log('🚀 Starting Shipping Cost Calculation...\n');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE TO SHEETS'}`);
  console.log(`   Spreadsheet ID: ${SPREADSHEET_ID}\n`);

  const sheets = await getUncachableGoogleSheetClient();
  const sheetsService = new GoogleSheetsService();
  const shippingService = new ShippingService(sheetsService);

  // Load FinalPriceList
  console.log('📋 Loading FinalPriceList...');
  const response = await retryWithBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'FinalPriceList!A:ZZ'
    })
  );

  const rows = response.data.values || [];
  const headers = rows[0] || [];
  const dataRows = rows.slice(1);

  console.log(`   ✅ Loaded ${dataRows.length} products\n`);

  // Find column indices
  const getColIndex = (name: string) => headers.indexOf(name);
  
  const skuIdx = getColIndex('SKU');
  const weightIdx = getColIndex('Weight_g');
  const dimsIdx = getColIndex('Dims_cm');

  const actualKgIdx = getColIndex('Shipping_Actual_Kg');
  const volumetricKgIdx = getColIndex('Shipping_Volumetric_Kg');
  const chargeableKgIdx = getColIndex('Shipping_Chargeable_Kg');
  const carrierIdx = getColIndex('Shipping_CarrierID');
  const costOwnStoreIdx = getColIndex('ShipCost_per_Unit_OwnStore');
  const costFBMIdx = getColIndex('ShipCost_per_Unit_FBM');
  const costFBAIdx = getColIndex('ShipCost_per_Unit_FBA');
  const costB2BIdx = getColIndex('ShipCost_per_Unit_B2B');

  if (actualKgIdx === -1) {
    console.error('❌ ERROR: Shipping columns not found in FinalPriceList. Please run schema update first.');
    process.exit(1);
  }

  // Smart defaults by category
  const categoryIdx = getColIndex('Category');
  const getDefaultWeight = (category: string): number => {
    const cat = (category || '').toUpperCase();
    if (cat.includes('BEARD')) return 100; // Beard products ~100g
    if (cat.includes('SHAVE') || cat.includes('SHA-')) return 120; // Shave ~120g
    if (cat.includes('COLOGNE') || cat.includes('COL-')) return 200; // Cologne ~200g
    if (cat.includes('AFTERSHAVE') || cat.includes('AFT-')) return 150; // Aftershave ~150g
    if (cat.includes('WAX') || cat.includes('GEL')) return 180; // Styling ~180g
    if (cat.includes('HAIR')) return 350; // Hair care ~350g
    if (cat.includes('FACE') || cat.includes('FAC-')) return 120; // Face care ~120g
    if (cat.includes('TAN')) return 200; // Tanning ~200g
    if (cat.includes('KIT')) return 500; // Kits ~500g
    return 150; // Default fallback
  };

  const getDefaultDims = (category: string): [number, number, number] => {
    const cat = (category || '').toUpperCase();
    if (cat.includes('KIT')) return [20, 15, 10]; // Kits: larger
    if (cat.includes('COLOGNE') || cat.includes('COL-')) return [15, 10, 8]; // Cologne: medium
    if (cat.includes('WAX') || cat.includes('GEL')) return [12, 8, 8]; // Jars: small cube
    return [15, 10, 5]; // Default: typical bottle
  };

  // Process products
  const updates: Array<{ rowIndex: number; updates: Record<string, any> }> = [];
  let skippedCount = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const sku = row[skuIdx] || '';
    const category = row[categoryIdx] || '';

    if (!sku) {
      skippedCount++;
      continue; // Skip empty rows
    }

    // Use actual weight or smart default
    let weightG = Number(row[weightIdx]) || 0;
    if (weightG === 0) {
      weightG = getDefaultWeight(category);
      console.log(`   ℹ️  ${sku}: Using default weight ${weightG}g (${category})`);
    }

    // Parse dimensions or use smart defaults
    const dimsStr = row[dimsIdx] || '';
    let lengthCm: number, widthCm: number, heightCm: number;
    
    if (dimsStr) {
      const parts = dimsStr.split('×').map((s: string) => Number(s.trim()));
      if (parts.length === 3 && parts.every((p: number) => p > 0)) {
        [lengthCm, widthCm, heightCm] = parts;
      } else {
        [lengthCm, widthCm, heightCm] = getDefaultDims(category);
      }
    } else {
      [lengthCm, widthCm, heightCm] = getDefaultDims(category);
    }

    // Calculate weights
    const actualKg = weightG / 1000;
    const volumetricKg = await shippingService.calculateVolumetricWeight(lengthCm, widthCm, heightCm);

    // Calculate per-channel costs (assume 1 unit per shipment for per-unit cost)
    const costs = await shippingService.calculatePerChannelShippingCosts({
      actualKg,
      volumetricKg,
      unitsPerShipment: 1, // per-unit cost
      zone: 'DE',
      carrierId: 'DHL_DE'
    });

    updates.push({
      rowIndex: i + 2, // +2 for header row and 1-indexed
      updates: {
        Shipping_Actual_Kg: actualKg.toFixed(3),
        Shipping_Volumetric_Kg: volumetricKg.toFixed(3),
        Shipping_Chargeable_Kg: costs.chargeableKg.toFixed(3),
        Shipping_CarrierID: costs.carrierId,
        ShipCost_per_Unit_OwnStore: costs.costOwnStore.toFixed(2),
        ShipCost_per_Unit_FBM: costs.costFBM.toFixed(2),
        ShipCost_per_Unit_FBA: costs.costFBA.toFixed(2),
        ShipCost_per_Unit_B2B: costs.costB2B.toFixed(2)
      }
    });

    const volWeight = volumetricKg > actualKg ? ' (volumetric)' : '';
    console.log(`   ✅ ${sku}: ${actualKg.toFixed(2)}kg actual, ${volumetricKg.toFixed(2)}kg vol${volWeight} → €${costs.costOwnStore.toFixed(2)}`);
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Calculated: ${updates.length} products`);
  console.log(`   ⏭️  Skipped: ${skippedCount} empty rows\n`);

  // Write updates using BATCH API (critical for rate limits!)
  if (!DRY_RUN && updates.length > 0) {
    console.log('💾 Writing updates to FinalPriceList using BATCH API (8 columns only)...');

    // Build batch update data - ONLY write the 8 shipping columns (not entire row!)
    const batchData: Array<{ range: string; values: any[][] }> = [];
    
    for (const { rowIndex, updates: rowUpdates } of updates) {
      // Only update the 8 shipping columns (preserve other columns!)
      const shippingColumns = [
        'Shipping_Actual_Kg',
        'Shipping_Volumetric_Kg',
        'Shipping_Chargeable_Kg',
        'Shipping_CarrierID',
        'ShipCost_per_Unit_OwnStore',
        'ShipCost_per_Unit_FBM',
        'ShipCost_per_Unit_FBA',
        'ShipCost_per_Unit_B2B'
      ];

      for (const colName of shippingColumns) {
        const colIndex = headers.indexOf(colName);
        if (colIndex === -1) continue; // Column not found

        // Convert column index to letter (0=A, 25=Z, 26=AA, 27=AB, etc.)
        let colLetter = '';
        let num = colIndex;
        while (num >= 0) {
          colLetter = String.fromCharCode(65 + (num % 26)) + colLetter;
          num = Math.floor(num / 26) - 1;
        }

        batchData.push({
          range: `FinalPriceList!${colLetter}${rowIndex}`,
          values: [[rowUpdates[colName]]]
        });
      }
    }

    // Single batch update API call (8 columns × 89 products = ~712 cells in 1 call!)
    await retryWithBackoff(() =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: batchData
        }
      })
    );

    console.log(`   ✅ Wrote ${updates.length} products × 8 columns in 1 batch API call (preserves other columns)\n`);
  } else if (DRY_RUN) {
    console.log('⏭️  DRY RUN mode - no writes performed\n');
  }

  console.log('✅ Shipping cost calculation complete!');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
