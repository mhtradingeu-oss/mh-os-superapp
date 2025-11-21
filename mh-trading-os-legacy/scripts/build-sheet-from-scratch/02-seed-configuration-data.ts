/**
 * SCRIPT 2: Seed Configuration Data
 * 
 * Purpose: Populates configuration sheets with canonical reference data
 * 
 * What it does:
 * ✅ Seeds Settings (system configuration)
 * ✅ Seeds LineTargets (product line margin targets)
 * ✅ Seeds PartnerTiers (B2B tier definitions)
 * ✅ Seeds Channels (sales channel configurations)
 * ✅ Seeds AmazonSizeTiers (FBA fee structures)
 * ✅ Seeds Boxes (packaging inventory)
 * ✅ Seeds Enums (reference data)
 * ✅ Seeds Pricing_Params (V2.2 pricing configuration)
 * ✅ Seeds QuantityDiscounts, OrderDiscounts, DiscountCaps
 * 
 * Prerequisites:
 *   - Script 1 completed (01-create-spreadsheet-structure.ts)
 *   - SHEETS_SPREADSHEET_ID environment variable set
 * 
 * Usage:
 *   tsx server/scripts/build-sheet-from-scratch/02-seed-configuration-data.ts
 */

import { getUncachableGoogleSheetClient } from '../../lib/sheets';
import { REQUIRED_SHEETS } from '../../lib/ensure-sheets';
import { retryWithBackoff } from '../../lib/retry';

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID;

if (!SPREADSHEET_ID) {
  console.error('❌ ERROR: SHEETS_SPREADSHEET_ID environment variable not set');
  console.error('   Run 01-create-spreadsheet-structure.ts first and set SHEETS_SPREADSHEET_ID');
  process.exit(1);
}

/**
 * Seed all configuration sheets with canonical data
 */
async function seedConfigurationData() {
  console.log('📊 MH-Trading-OS - Configuration Data Seeder');
  console.log('=' + '='.repeat(70));
  console.log(`Spreadsheet ID: ${SPREADSHEET_ID}\n`);

  const client = await getUncachableGoogleSheetClient();

  // Verify spreadsheet exists
  try {
    await retryWithBackoff(() =>
      client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
    );
    console.log('✅ Spreadsheet verified\n');
  } catch (error: any) {
    console.error('❌ ERROR: Cannot access spreadsheet');
    console.error('   Ensure SHEETS_SPREADSHEET_ID is correct');
    process.exit(1);
  }

  const seedTasks: Array<{ name: string; task: () => Promise<void> }> = [];

  // For each sheet that has seedData, add to tasks
  for (const sheetDef of REQUIRED_SHEETS) {
    if (sheetDef.seedData && sheetDef.seedData.length > 0) {
      seedTasks.push({
        name: sheetDef.name,
        task: async () => {
          await retryWithBackoff(() =>
            client.spreadsheets.values.append({
              spreadsheetId: SPREADSHEET_ID,
              range: `${sheetDef.name}!A2`,
              valueInputOption: 'RAW',
              requestBody: {
                values: sheetDef.seedData
              }
            })
          );
          console.log(`  ✅ ${sheetDef.name}: ${sheetDef.seedData!.length} rows`);
        }
      });
    }
  }

  console.log(`Seeding ${seedTasks.length} configuration sheets...\n`);

  // Execute all seeding tasks
  for (const task of seedTasks) {
    await task.task();
  }

  console.log('\n✅ All configuration data seeded successfully!\n');
  console.log('⏭️  NEXT STEP:');
  console.log('   tsx server/scripts/build-sheet-from-scratch/03-seed-product-data.ts\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    await seedConfigurationData();
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

import { pathToFileURL } from "url";
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
