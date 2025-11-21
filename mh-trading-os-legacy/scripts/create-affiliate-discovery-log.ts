/**
 * MH TRADING OS — Create AffiliateDiscoveryLog Sheet
 * ---------------------------------------------------
 * Creates the AffiliateDiscoveryLog sheet in Google Sheets
 * This script ensures the 6th canonical affiliate sheet exists
 */

import { getUncachableGoogleSheetClient, SPREADSHEET_ID } from '../lib/sheets.js';
import { retryWithBackoff } from '../lib/retry.js';

const SHEET_NAME = 'AffiliateDiscoveryLog';
const HEADERS = [
  'DiscoveryID',
  'Timestamp',
  'Niches',
  'PersonTypes',
  'Platforms',
  'Countries',
  'MinFollowers',
  'MinEngagement',
  'Limit',
  'ResultsCount',
  'Duration',
  'Status',
  'ErrorMessage'
];

async function createAffiliateDiscoveryLog() {
  console.log(`🚀 Creating ${SHEET_NAME} sheet...`);
  
  try {
    const client = await getUncachableGoogleSheetClient();
    
    // Check if sheet already exists
    const metadata = await client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existingSheets = metadata.data.sheets || [];
    const sheetExists = existingSheets.some(sheet => sheet.properties?.title === SHEET_NAME);
    
    if (sheetExists) {
      console.log(`✅ ${SHEET_NAME} already exists!`);
      return;
    }
    
    // Create the sheet using batchUpdate
    await retryWithBackoff(() =>
      client.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { 
                title: SHEET_NAME,
                gridProperties: {
                  frozenRowCount: 1
                }
              }
            }
          }]
        }
      })
    );
    
    console.log(`   ✓ Sheet tab created`);
    
    // Add headers
    await retryWithBackoff(() =>
      client.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!1:1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [HEADERS]
        }
      })
    );
    
    console.log(`   ✓ Headers added`);
    console.log(`✅ ${SHEET_NAME} created successfully!`);
    console.log(`   Headers: ${HEADERS.join(', ')}`);
    console.log(`   Numeric columns: MinFollowers, MinEngagement, Limit, ResultsCount, Duration`);
    console.log(`\n🎉 AI Discovery v2.0 logging is now ready!`);
  } catch (error) {
    console.error(`❌ Failed to create ${SHEET_NAME}:`, error);
    process.exit(1);
  }
}

createAffiliateDiscoveryLog();
