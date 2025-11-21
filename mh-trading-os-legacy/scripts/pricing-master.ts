/**
 * HAIROTICMEN PRICING MASTER SCRIPT
 * ==================================
 * 
 * ONE unified script to rule all pricing calculations
 * 
 * Features:
 * ✅ Correct Grundpreis (with 19% VAT) - PAngV compliant
 * ✅ Full Google Sheets context loading (6 tabs)
 * ✅ Bidirectional sync to Google Sheets
 * ✅ Strict validation with error tracking
 * ✅ CSV + JSON export
 * ✅ Change tracking and diff reporting
 * 
 * Usage:
 *   npx tsx server/scripts/pricing-master.ts [--dry-run] [--export-csv]
 * 
 * Options:
 *   --dry-run     Calculate prices but don't write to Google Sheets
 *   --export-csv  Also export results to CSV + JSON files
 */

import { getUncachableGoogleSheetClient, SPREADSHEET_ID } from '../lib/sheets';
import { calculateHAIROTICMENPricing, buildHAIROTICMENContext } from '../lib/pricing-engine-hairoticmen';
import type { FinalPriceList } from '@shared/schema';
import * as fs from 'fs';

// Parse CLI arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const EXPORT_CSV = args.includes('--export-csv');

interface PricingResult {
  sku: string;
  name: string;
  rowNumber: number;
  changes: FieldChange[];
  warnings: string[];
  success: boolean;
}

interface FieldChange {
  field: string;
  oldValue: any;
  newValue: any;
  diff: number;
}

/**
 * Convert column index (0-based) to Excel A1 notation
 * 0 → A, 25 → Z, 26 → AA, 27 → AB, etc.
 */
function colIndexToA1(index: number): string {
  let column = '';
  let i = index;
  
  while (i >= 0) {
    column = String.fromCharCode(65 + (i % 26)) + column;
    i = Math.floor(i / 26) - 1;
  }
  
  return column;
}

/**
 * Strict number parser - returns null for invalid data
 */
function parseNumStrict(val: any, fieldName: string, sku: string, errors: string[]): number | null {
  if (val === null || val === undefined || val === '') return null;
  const str = val.toString().replace(/[€$,\s]/g, '').trim();
  const num = parseFloat(str);
  
  if (isNaN(num)) {
    errors.push(`${sku}: Invalid number in ${fieldName}: "${val}"`);
    return null;
  }
  
  return num;
}

/**
 * Normalize number for comparison
 */
function normalizeNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const str = val.toString().replace(/[€$,\s]/g, '').trim();
  return parseFloat(str) || 0;
}

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('💰 HAIROTICMEN PRICING MASTER - ONE SCRIPT TO RULE THEM ALL');
  console.log('='.repeat(100));
  console.log(`\n🔧 Mode: ${DRY_RUN ? '🔒 DRY RUN (No writes)' : '✅ LIVE SYNC (Will update Google Sheets)'}`);
  console.log(`📊 Export: ${EXPORT_CSV ? '✅ CSV + JSON' : '❌ No export'}\n`);

  const sheets = await getUncachableGoogleSheetClient();
  const allResults: PricingResult[] = [];
  const globalWarnings: string[] = [];
  const globalErrors: string[] = [];

  try {
    // ============================================================================
    // PHASE 1: LOAD ALL GOOGLE SHEETS DATA
    // ============================================================================
    console.log('📥 PHASE 1: Loading Google Sheets Data (6 tabs)');
    console.log('─'.repeat(100));

    const [
      finalPriceListResponse,
      pricingParamsResponse,
      partnerTiersResponse,
      amazonTiersResponse,
      shippingMatrixResponse,
      dhlSurchargeResponse,
    ] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'FinalPriceList!A1:CQ' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Pricing_Params!A1:B' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'PartnerTiers!A1:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'AmazonSizeTiers!A1:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'ShippingMatrixDHL!A1:Z' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'DHLSurcharge!A1:Z' }),
    ]);

    // Parse FinalPriceList
    const finalPriceListRows = finalPriceListResponse.data.values || [];
    const headers = finalPriceListRows[0] || [];
    const dataRows = finalPriceListRows.slice(1);

    console.log(`   ✅ FinalPriceList: ${dataRows.length} products, ${headers.length} columns`);

    // Parse Pricing_Params
    const pricingParamsRows = pricingParamsResponse.data.values || [];
    const pricingParams = pricingParamsRows.slice(1).map((row: any) => ({
      ParamKey: row[0],
      Value: row[1],
    }));
    console.log(`   ✅ Pricing_Params: ${pricingParams.length} parameters`);

    // Parse PartnerTiers
    const partnerTiersRows = partnerTiersResponse.data.values || [];
    const partnerHeaders = partnerTiersRows[0] || [];
    const partnerTiers = partnerTiersRows.slice(1).map((row: any) => {
      const tier: any = {};
      partnerHeaders.forEach((h: string, i: number) => {
        tier[h] = row[i];
      });
      return tier;
    });
    console.log(`   ✅ PartnerTiers: ${partnerTiers.length} tiers`);

    // Parse AmazonSizeTiers
    const amazonTiersRows = amazonTiersResponse.data.values || [];
    const amazonHeaders = amazonTiersRows[0] || [];
    const amazonTiers = amazonTiersRows.slice(1).map((row: any) => {
      const tier: any = {};
      amazonHeaders.forEach((h: string, i: number) => {
        tier[h] = row[i];
      });
      return tier;
    });
    console.log(`   ✅ AmazonSizeTiers: ${amazonTiers.length} tiers`);

    // Parse ShippingMatrixDHL
    const shippingRows = shippingMatrixResponse.data.values || [];
    const shippingHeaders = shippingRows[0] || [];
    const shippingMatrix = shippingRows.slice(1).map((row: any) => {
      const entry: any = {};
      shippingHeaders.forEach((h: string, i: number) => {
        entry[h] = row[i];
      });
      return entry;
    });
    console.log(`   ✅ ShippingMatrixDHL: ${shippingMatrix.length} entries`);

    // Parse DHLSurcharge
    const surchargeRows = dhlSurchargeResponse.data.values || [];
    const surchargeHeaders = surchargeRows[0] || [];
    const dhlSurcharges = surchargeRows.slice(1).map((row: any) => {
      const entry: any = {};
      surchargeHeaders.forEach((h: string, i: number) => {
        entry[h] = row[i];
      });
      return entry;
    });
    console.log(`   ✅ DHLSurcharge: ${dhlSurcharges.length} entries`);

    // ============================================================================
    // PHASE 2: BUILD PRICING CONTEXT
    // ============================================================================
    console.log('\n🏗️  PHASE 2: Building Pricing Context');
    console.log('─'.repeat(100));

    const pricingContext = buildHAIROTICMENContext(
      pricingParams,
      [], // channels - not needed for core pricing
      amazonTiers,
      shippingMatrix,
      dhlSurcharges
    );

    const targetMargin = pricingContext.params.get('Target_Margin_Pct') || 45;
    const floorMargin = pricingContext.params.get('Floor_Margin_Pct') || 25;

    console.log(`   ✅ Pricing Context Built Successfully`);
    console.log(`      🎯 Target Margin: ${targetMargin}%`);
    console.log(`      🛡️  Floor Margin: ${floorMargin}%`);
    console.log(`      💶 VAT: ${pricingContext.vat}%`);

    // ============================================================================
    // PHASE 3: CALCULATE PRICING FOR ALL PRODUCTS
    // ============================================================================
    console.log('\n💰 PHASE 3: Calculate Pricing with Validation');
    console.log('─'.repeat(100));

    // 🗺️  HEADER ALIAS MAP: Script names → Actual Google Sheets column names
    const HEADER_ALIASES: Record<string, string> = {
      // B2C/Channel pricing (legacy names in sheet)
      'B2C_Store_Net': 'Price_Web',
      'Amazon_Net': 'Price_Amazon',
      'Price_Salon': 'Price_Salon',
      
      // B2B tier pricing (reversed order in sheet)
      'Dealer_Basic_Net': 'Net_Dealer_Basic',
      'Dealer_Plus_Net': 'Net_Dealer_Plus',
      'Stand_Partner_Net': 'Net_Stand',
      'Distributor_Net': 'Net_Distributor',
    };

    const getColIdx = (header: string) => {
      // Try exact match first
      let idx = headers.indexOf(header);
      if (idx >= 0) return idx;
      
      // Try alias
      const alias = HEADER_ALIASES[header];
      if (alias) {
        idx = headers.indexOf(alias);
        if (idx >= 0) return idx;
      }
      
      // Not found
      return -1;
    };

    // Key column indices
    const cols = {
      SKU: getColIdx('SKU'),
      Name: getColIdx('Name'),
      Status: getColIdx('Status'),
      FullCost_EUR: getColIdx('FullCost_EUR'),
      UVP_Net: getColIdx('UVP_Net'),
      UVP_Inc: getColIdx('UVP_Inc'),
      MAP: getColIdx('MAP'),
      Grundpreis: getColIdx('Grundpreis'),
      B2C_Store_Net: getColIdx('B2C_Store_Net'),  // → Price_Web via alias
      B2C_Store_Inc: getColIdx('B2C_Store_Inc'),  // Missing - will be -1
      B2C_Margin_Pct: getColIdx('B2C_Margin_Pct'),  // Missing - will be -1
      Amazon_Net: getColIdx('Amazon_Net'),  // → Price_Amazon via alias
      Amazon_Inc: getColIdx('Amazon_Inc'),  // Missing - will be -1
      Amazon_Margin_Pct: getColIdx('Amazon_Margin_Pct'),  // Missing - will be -1
      Dealer_Basic_Net: getColIdx('Dealer_Basic_Net'),  // → Net_Dealer_Basic via alias
      Dealer_Plus_Net: getColIdx('Dealer_Plus_Net'),  // → Net_Dealer_Plus via alias
      Stand_Partner_Net: getColIdx('Stand_Partner_Net'),  // → Net_Stand via alias
      Distributor_Net: getColIdx('Distributor_Net'),  // → Net_Distributor via alias
    };

    let processedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const batchUpdates: any[] = [];
    let totalCellUpdates = 0; // Track total cells that would be updated (for dry-run reporting)

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // Excel row (1-indexed + header)
      
      const sku = row[cols.SKU]?.toString().trim();
      const name = row[cols.Name]?.toString().trim() || '';
      const status = row[cols.Status]?.toString().trim();
      
      if (!sku) continue;
      
      // Skip inactive products (only if Status column exists and is explicitly "Inactive")
      if (cols.Status >= 0 && status && status.toLowerCase() === 'inactive') {
        skippedCount++;
        continue;
      }

      try {
        // Convert row to product object with ALL fields
        const product: any = {};
        headers.forEach((header, idx) => {
          product[header] = row[idx];
        });

        // Validate required fields - try multiple factory price sources
        let factoryPrice = parseNumStrict(product.FactoryPriceUnit_Manual, 'FactoryPriceUnit_Manual', sku, globalErrors);
        if (!factoryPrice || factoryPrice === 0) {
          // Try Factory_Cost_EUR as fallback
          factoryPrice = parseNumStrict(product.Factory_Cost_EUR, 'Factory_Cost_EUR', sku, globalErrors);
        }
        
        if (!factoryPrice || factoryPrice === 0) {
          globalWarnings.push(`${sku}: Skipped - Missing both FactoryPriceUnit_Manual and Factory_Cost_EUR`);
          skippedCount++;
          allResults.push({
            sku,
            name,
            rowNumber,
            changes: [],
            warnings: [`Missing both FactoryPriceUnit_Manual and Factory_Cost_EUR`],
            success: false
          });
          continue;
        }

        // 🐛 FIX: Write parsed number back to product object!
        // Without this, product.Factory_Cost_EUR stays as "€11.25" (string)
        // and calculateHAIROTICMENPricing gets NaN when it checks > 0
        product.Factory_Cost_EUR = factoryPrice;
        product.FactoryPriceUnit_Manual = factoryPrice;

        // Calculate pricing using HAIROTICMEN engine (with CORRECT Grundpreis)
        const pricing = calculateHAIROTICMENPricing(product as FinalPriceList, pricingContext);

        if (!pricing) {
          globalWarnings.push(`${sku}: Pricing calculation returned null`);
          skippedCount++;
          continue;
        }

        // Track changes for this product
        const changes: FieldChange[] = [];
        const warnings: string[] = [];

        // Helper to check and track changes
        const checkAndUpdate = (
          colIdx: number, 
          newValue: any, 
          fieldName: string, 
          format: 'number' | 'string' = 'number'
        ) => {
          if (colIdx < 0) return; // Column doesn't exist

          const currentValue = row[colIdx];
          let shouldUpdate = false;
          let formattedNew = newValue;

          if (format === 'number') {
            const current = normalizeNumber(currentValue);
            const newNum = typeof newValue === 'number' ? newValue : normalizeNumber(newValue);
            shouldUpdate = Math.abs(current - newNum) > 0.01; // 1 cent tolerance
            formattedNew = newNum.toFixed(2);
            
            if (shouldUpdate) {
              changes.push({
                field: fieldName,
                oldValue: current.toFixed(2),
                newValue: formattedNew,
                diff: newNum - current
              });
            }
          } else {
            shouldUpdate = currentValue !== newValue;
            if (shouldUpdate) {
              changes.push({
                field: fieldName,
                oldValue: currentValue || '',
                newValue: newValue,
                diff: 0
              });
            }
          }

          // Queue update for batch write
          if (shouldUpdate) {
            totalCellUpdates++; // Count for dry-run reporting
            
            if (!DRY_RUN) {
              // Convert column index to A1 notation (supports columns beyond Z)
              const colLetter = colIndexToA1(colIdx);
              const cellAddress = `FinalPriceList!${colLetter}${rowNumber}`;
              batchUpdates.push({
                range: cellAddress,
                values: [[formattedNew]]
              });
            }
          }
        };

        // Update Core Pricing Fields
        checkAndUpdate(cols.FullCost_EUR, pricing.fullCostUnit, 'FullCost_EUR');
        checkAndUpdate(cols.UVP_Net, pricing.uvpNet, 'UVP_Net');
        checkAndUpdate(cols.UVP_Inc, pricing.uvpInc, 'UVP_Inc');
        checkAndUpdate(cols.MAP, pricing.floorB2CNet, 'MAP');
        checkAndUpdate(cols.Grundpreis, pricing.grundpreisFormatted, 'Grundpreis', 'string');

        // Update Channel Pricing
        if (pricing.b2cStore) {
          checkAndUpdate(cols.B2C_Store_Net, pricing.b2cStore.netRevenue, 'B2C_Store_Net');
          checkAndUpdate(cols.B2C_Store_Inc, pricing.b2cStore.grossRevenue, 'B2C_Store_Inc');
          checkAndUpdate(cols.B2C_Margin_Pct, pricing.b2cStore.marginPct, 'B2C_Margin_Pct');
        }

        if (pricing.amazon) {
          checkAndUpdate(cols.Amazon_Net, pricing.amazon.netRevenue, 'Amazon_Net');
          checkAndUpdate(cols.Amazon_Inc, pricing.amazon.grossRevenue, 'Amazon_Inc');
          checkAndUpdate(cols.Amazon_Margin_Pct, pricing.amazon.marginPct, 'Amazon_Margin_Pct');
        }

        // Update Partner Pricing
        if (pricing.dealerBasic) {
          checkAndUpdate(cols.Dealer_Basic_Net, pricing.dealerBasic.netPrice, 'Dealer_Basic_Net');
        }
        if (pricing.dealerPlus) {
          checkAndUpdate(cols.Dealer_Plus_Net, pricing.dealerPlus.netPrice, 'Dealer_Plus_Net');
        }
        if (pricing.standPartner) {
          checkAndUpdate(cols.Stand_Partner_Net, pricing.standPartner.netPrice, 'Stand_Partner_Net');
        }
        if (pricing.distributor) {
          checkAndUpdate(cols.Distributor_Net, pricing.distributor.netPrice, 'Distributor_Net');
        }

        // Add pricing warnings
        if (pricing.warnings && pricing.warnings.length > 0) {
          warnings.push(...pricing.warnings);
        }

        // Track result
        allResults.push({
          sku,
          name,
          rowNumber,
          changes,
          warnings,
          success: true
        });

        if (changes.length > 0) {
          updatedCount++;
        }
        processedCount++;

        // Progress indicator
        if (processedCount % 10 === 0) {
          console.log(`   ⏳ Processed ${processedCount}/${dataRows.length} products...`);
        }

      } catch (error: any) {
        globalErrors.push(`${sku}: ${error.message}`);
        allResults.push({
          sku,
          name,
          rowNumber,
          changes: [],
          warnings: [error.message],
          success: false
        });
      }
    }

    console.log(`\n   ✅ Calculation Complete!`);
    console.log(`      📊 Processed: ${processedCount}`);
    console.log(`      🔄 Updated: ${updatedCount}`);
    console.log(`      ⏭️  Skipped: ${skippedCount}`);

    // ============================================================================
    // PHASE 4: WRITE TO GOOGLE SHEETS (IF NOT DRY RUN)
    // ============================================================================
    if (!DRY_RUN && batchUpdates.length > 0) {
      console.log('\n✍️  PHASE 4: Writing Updates to Google Sheets');
      console.log('─'.repeat(100));
      console.log(`   📝 Total cells to update: ${batchUpdates.length}`);

      // Batch write in chunks of 100 to avoid API limits
      const BATCH_SIZE = 100;
      for (let i = 0; i < batchUpdates.length; i += BATCH_SIZE) {
        const chunk = batchUpdates.slice(i, i + BATCH_SIZE);
        
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: chunk
          }
        });

        console.log(`   ✅ Written batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(batchUpdates.length / BATCH_SIZE)}`);
      }

      console.log(`\n   🎉 Successfully wrote ${batchUpdates.length} updates to Google Sheets!`);
    } else if (DRY_RUN) {
      console.log('\n🔒 PHASE 4: DRY RUN - No writes to Google Sheets');
      console.log(`   💡 Would have updated ${totalCellUpdates} cells`);
    }

    // ============================================================================
    // PHASE 5: GENERATE REPORTS
    // ============================================================================
    console.log('\n📊 PHASE 5: Generate Reports');
    console.log('─'.repeat(100));

    // Show sample of changes
    const productsWithChanges = allResults.filter(r => r.changes.length > 0);
    console.log(`\n   📝 Products with changes: ${productsWithChanges.length}/${processedCount}`);
    
    if (productsWithChanges.length > 0) {
      console.log('\n   📦 Sample Changes (first 5):');
      productsWithChanges.slice(0, 5).forEach((result, idx) => {
        console.log(`\n   ${idx + 1}. ${result.sku} - ${result.name}`);
        result.changes.slice(0, 3).forEach(change => {
          console.log(`      • ${change.field}: ${change.oldValue} → ${change.newValue}`);
        });
        if (result.changes.length > 3) {
          console.log(`      ... and ${result.changes.length - 3} more changes`);
        }
      });
    }

    // Export to CSV + JSON if requested
    if (EXPORT_CSV) {
      console.log('\n   💾 Exporting results to files...');

      // JSON export
      const jsonOutput = {
        timestamp: new Date().toISOString(),
        mode: DRY_RUN ? 'DRY_RUN' : 'LIVE_SYNC',
        summary: {
          totalProducts: dataRows.length,
          processed: processedCount,
          updated: updatedCount,
          skipped: skippedCount,
          errors: globalErrors.length,
          warnings: globalWarnings.length
        },
        results: allResults
      };

      fs.writeFileSync('attached_assets/pricing-master-output.json', JSON.stringify(jsonOutput, null, 2));
      console.log(`      ✅ JSON: attached_assets/pricing-master-output.json`);

      // CSV export - extract key calculated values
      const csvHeader = 'SKU,Name,FullCost_EUR,UVP_Net,UVP_Inc,MAP,Grundpreis,Changes\n';
      const csvRows = allResults.filter(r => r.success).map(r => {
        // Extract calculated values from changes
        const getValue = (field: string) => {
          const change = r.changes.find(c => c.field === field);
          return change ? change.newValue : '';
        };
        
        const fullCost = getValue('FullCost_EUR');
        const uvpNet = getValue('UVP_Net');
        const uvpInc = getValue('UVP_Inc');
        const map = getValue('MAP');
        const grundpreis = getValue('Grundpreis');
        const changesCount = r.changes.length;
        
        return `${r.sku},"${r.name}",${fullCost},${uvpNet},${uvpInc},${map},"${grundpreis}",${changesCount}`;
      }).join('\n');

      fs.writeFileSync('attached_assets/pricing-master-output.csv', csvHeader + csvRows);
      console.log(`      ✅ CSV: attached_assets/pricing-master-output.csv`);
    }

    // ============================================================================
    // FINAL SUMMARY
    // ============================================================================
    console.log('\n' + '='.repeat(100));
    console.log('🎉 PRICING MASTER COMPLETE!');
    console.log('='.repeat(100));
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Processed: ${processedCount} products`);
    console.log(`   🔄 Updated: ${updatedCount} products`);
    console.log(`   ⏭️  Skipped: ${skippedCount} inactive products`);
    console.log(`   ⚠️  Warnings: ${globalWarnings.length}`);
    console.log(`   ❌ Errors: ${globalErrors.length}`);

    if (!DRY_RUN && batchUpdates.length > 0) {
      console.log(`\n   ✍️  Wrote ${batchUpdates.length} updates to Google Sheets`);
    }

    if (EXPORT_CSV) {
      console.log(`\n   💾 Exported results to:`);
      console.log(`      • attached_assets/pricing-master-output.json`);
      console.log(`      • attached_assets/pricing-master-output.csv`);
    }

    console.log('\n' + '='.repeat(100) + '\n');

  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
