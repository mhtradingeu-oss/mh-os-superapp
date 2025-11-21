/**
 * GENERATE PRICING_REPORT SHEET
 * ==============================
 * 
 * Creates a unified Pricing_Report sheet in Google Sheets for control panel
 * 
 * Columns:
 * - SKU, Name, Status, Line
 * - UVP_Inc, MAP, Price_Web, Price_Amazon, Price_Salon
 * - Net_Dealer_Basic, Net_Dealer_Plus, Net_Stand, Net_Distributor
 * - Margin_B2C, Margin_Amazon, Floor_Protection
 * - FullCost, Factory_Cost, Grundpreis, Shipping_TierKey
 * 
 * Usage:
 *   npx tsx server/scripts/generate-pricing-report-sheet.ts [--dry-run]
 */

import { getUncachableGoogleSheetClient, SPREADSHEET_ID } from '../lib/sheets';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

async function main() {
  console.log('\n' + '='.repeat(100));
  console.log('📊 GENERATING PRICING_REPORT SHEET');
  console.log('='.repeat(100));
  console.log(`\n🔧 Mode: ${DRY_RUN ? '🔒 DRY RUN' : '✅ LIVE WRITE'}\n`);

  const sheets = await getUncachableGoogleSheetClient();

  try {
    // ============================================================================
    // PHASE 1: LOAD FINALPRICELIST DATA
    // ============================================================================
    console.log('📥 PHASE 1: Loading FinalPriceList Data');
    console.log('─'.repeat(100));

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'FinalPriceList!A1:CQ'
    });

    const rows = response.data.values || [];
    const headers = rows[0] || [];
    const dataRows = rows.slice(1);

    console.log(`   ✅ Loaded ${dataRows.length} products with ${headers.length} columns\n`);

    // ============================================================================
    // PHASE 2: BUILD PRICING_REPORT DATA
    // ============================================================================
    console.log('🏗️  PHASE 2: Building Pricing_Report Data');
    console.log('─'.repeat(100));

    // Column indices with validation
    const getIdx = (name: string) => headers.indexOf(name);
    
    const cols = {
      SKU: getIdx('SKU'),
      Name: getIdx('Name'),
      Status: getIdx('Status'),
      Line: getIdx('Line'),
      Factory_Cost_EUR: getIdx('Factory_Cost_EUR'),
      FullCost_EUR: getIdx('FullCost_EUR'),
      UVP_Inc: getIdx('UVP_Inc'),
      MAP: getIdx('MAP'),
      Price_Web: getIdx('Price_Web'),
      Price_Amazon: getIdx('Price_Amazon'),
      Price_Salon: getIdx('Price_Salon'),
      Net_Dealer_Basic: getIdx('Net_Dealer_Basic'),
      Net_Dealer_Plus: getIdx('Net_Dealer_Plus'),
      Net_Stand: getIdx('Net_Stand'),
      Net_Distributor: getIdx('Net_Distributor'),
      Grundpreis: getIdx('Grundpreis'),
      Shipping_TierKey: getIdx('Shipping_TierKey'),
    };

    // Validate critical columns exist
    const criticalColumns = ['SKU', 'Name', 'FullCost_EUR', 'UVP_Inc', 'Price_Web', 'Price_Amazon', 'MAP'];
    const missingColumns = criticalColumns.filter(col => cols[col as keyof typeof cols] === -1);
    
    if (missingColumns.length > 0) {
      console.error(`\n❌ ERROR: Missing critical columns in FinalPriceList:`);
      missingColumns.forEach(col => console.error(`   • ${col}`));
      console.error(`\nAvailable columns:`, headers.slice(0, 20).join(', '));
      throw new Error(`Missing critical columns: ${missingColumns.join(', ')}`);
    }

    console.log(`   ✅ All critical columns validated\n`);

    // Report headers
    const reportHeaders = [
      'SKU',
      'Name',
      'Status',
      'Line',
      'UVP_Inc',
      'MAP',
      'Price_Web',
      'Price_Amazon',
      'Price_Salon',
      'Net_Dealer_Basic',
      'Net_Dealer_Plus',
      'Net_Stand',
      'Net_Distributor',
      'Margin_B2C_%',
      'Margin_Amazon_%',
      'Floor_Protected',
      'FullCost',
      'Factory_Cost',
      'Grundpreis',
      'Shipping_TierKey'
    ];

    const reportData: any[][] = [reportHeaders];

    for (const row of dataRows) {
      const sku = row[cols.SKU];
      if (!sku) continue;

      // Extract values
      const fullCost = parseFloat((row[cols.FullCost_EUR] || '0').toString().replace(/[€,]/g, '')) || 0;
      const uvpInc = parseFloat((row[cols.UVP_Inc] || '0').toString().replace(/[€,]/g, '')) || 0;
      const priceWeb = parseFloat((row[cols.Price_Web] || '0').toString().replace(/[€,]/g, '')) || 0;
      const priceAmazon = parseFloat((row[cols.Price_Amazon] || '0').toString().replace(/[€,]/g, '')) || 0;
      const map = parseFloat((row[cols.MAP] || '0').toString().replace(/[€,]/g, '')) || 0;

      // Calculate margins
      const marginB2C = priceWeb > 0 ? ((priceWeb - fullCost) / priceWeb * 100).toFixed(1) : '0.0';
      const marginAmazon = priceAmazon > 0 ? ((priceAmazon - fullCost) / priceAmazon * 100).toFixed(1) : '0.0';

      // Check floor protection
      const floorProtected = (priceWeb >= map || priceAmazon >= map) ? 'Yes' : 'No';

      reportData.push([
        row[cols.SKU] || '',
        row[cols.Name] || '',
        row[cols.Status] || 'Active',
        row[cols.Line] || '',
        row[cols.UVP_Inc] || '',
        row[cols.MAP] || '',
        row[cols.Price_Web] || '',
        row[cols.Price_Amazon] || '',
        row[cols.Price_Salon] || '',
        row[cols.Net_Dealer_Basic] || '',
        row[cols.Net_Dealer_Plus] || '',
        row[cols.Net_Stand] || '',
        row[cols.Net_Distributor] || '',
        marginB2C,
        marginAmazon,
        floorProtected,
        row[cols.FullCost_EUR] || '',
        row[cols.Factory_Cost_EUR] || '',
        row[cols.Grundpreis] || '',
        row[cols.Shipping_TierKey] || ''
      ]);
    }

    console.log(`   ✅ Built ${reportData.length - 1} report rows\n`);

    // ============================================================================
    // PHASE 3: CHECK IF PRICING_REPORT SHEET EXISTS
    // ============================================================================
    console.log('🔍 PHASE 3: Checking Pricing_Report Sheet');
    console.log('─'.repeat(100));

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID
    });

    const existingSheets = spreadsheet.data.sheets || [];
    const reportSheetExists = existingSheets.some(s => s.properties?.title === 'Pricing_Report');

    if (reportSheetExists) {
      console.log(`   ✅ Pricing_Report sheet exists - will update\n`);
    } else {
      console.log(`   ⚠️  Pricing_Report sheet not found - will create\n`);
      
      if (!DRY_RUN) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: 'Pricing_Report',
                  gridProperties: {
                    rowCount: 200,
                    columnCount: 20,
                    frozenRowCount: 1
                  }
                }
              }
            }]
          }
        });
        console.log(`   ✅ Created Pricing_Report sheet\n`);
      }
    }

    // ============================================================================
    // PHASE 4: WRITE PRICING_REPORT DATA
    // ============================================================================
    if (!DRY_RUN) {
      console.log('✍️  PHASE 4: Writing Pricing_Report Data');
      console.log('─'.repeat(100));

      // Clear existing data first
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Pricing_Report!A:Z'
      });

      // Write new data
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Pricing_Report!A1',
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: reportData
        }
      });

      console.log(`   ✅ Written ${reportData.length} rows to Pricing_Report\n`);

      // Refresh sheet list to get the new sheetId
      const updatedSpreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID
      });
      const pricingReportSheet = updatedSpreadsheet.data.sheets?.find(s => s.properties?.title === 'Pricing_Report');
      
      if (pricingReportSheet?.properties?.sheetId !== undefined) {
        // Apply formatting
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [
              {
                repeatCell: {
                  range: {
                    sheetId: pricingReportSheet.properties.sheetId,
                    startRowIndex: 0,
                    endRowIndex: 1
                  },
                  cell: {
                    userEnteredFormat: {
                      backgroundColor: { red: 0.2, green: 0.6, blue: 0.6 },
                      textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } }
                    }
                  },
                  fields: 'userEnteredFormat(backgroundColor,textFormat)'
                }
              }
            ]
          }
        });

        console.log(`   ✅ Applied formatting\n`);
      }
    } else {
      console.log('🔒 PHASE 4: DRY RUN - Would write Pricing_Report data\n');
    }

    console.log('='.repeat(100));
    console.log('✅ PRICING_REPORT GENERATION COMPLETE');
    console.log('='.repeat(100));

    console.log(`\n📊 Summary:`);
    console.log(`   • Products: ${reportData.length - 1}`);
    console.log(`   • Columns: ${reportHeaders.length}`);
    console.log(`   • Sheet: Pricing_Report`);
    console.log(`   • Status: ${DRY_RUN ? 'DRY RUN (Not written)' : 'Written to Google Sheets'}\n`);

  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
