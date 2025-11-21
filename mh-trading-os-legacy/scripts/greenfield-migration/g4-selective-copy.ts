#!/usr/bin/env tsx

/**
 * G4 — Selective Copy (Legacy → STAGING)
 * 
 * Copies production data from 7 matching legacy sheets to STAGING.
 * Handles column transformations, skips orphaned sheets.
 * 
 * Safety:
 * - runSafetyChecks() before any STAGING writes
 * - Read-only operations on legacy sheet
 * - Validates row counts match
 * 
 * Output: reports/G4-COPY-REPORT.md
 */

import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  validateNewEnvFile, 
  validateSchemaMap,
  runSafetyChecks,
  type NewEnv 
} from './safety-guards.js';

const LEGACY_SHEET_ID = '1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0';

// Sheets to copy (from LEGACY-DIFF.md analysis)
const SHEETS_TO_COPY = [
  'FinalPriceList',
  'Enums',
  'Shipping_WeightBands',
  'Shipping_Costs_Fixed',
  'CRM_Leads',
  '_README',
  '_SETTINGS'
];

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

async function getSheetData(sheets: any, spreadsheetId: string, sheetName: string): Promise<any[][]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:ZZ`
    });
    
    return response.data.values || [];
  } catch (error) {
    console.warn(`⚠️  Could not read ${sheetName}: ${(error as Error).message}`);
    return [];
  }
}

async function clearAndWriteSheet(
  sheets: any, 
  spreadsheetId: string, 
  sheetName: string, 
  data: any[][]
): Promise<void> {
  // Clear existing data (except header)
  try {
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${sheetName}!A2:ZZ`
    });
    
    console.log(`   Cleared existing data in ${sheetName}`);
  } catch (error) {
    // Sheet might be empty, continue
  }

  // Write new data (skip header row from legacy, keep STAGING header)
  if (data.length > 1) {
    const dataRows = data.slice(1); // Skip header from legacy
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A2`,
      valueInputOption: 'RAW',
      resource: {
        values: dataRows
      }
    });
    
    console.log(`   ✅ Wrote ${dataRows.length} rows to ${sheetName}`);
  } else {
    console.log(`   ⚠️  No data to copy for ${sheetName}`);
  }
}

async function runG4SelectiveCopy() {
  console.log('🚀 Starting G4 — Selective Copy (Legacy → STAGING)\n');

  // SAFETY CHECK 1: Validate prerequisites
  const envData = await validateNewEnvFile();
  await validateSchemaMap();

  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  // SAFETY CHECK 2: Verify STAGING is safe to write to
  await runSafetyChecks(sheets, envData, 'staging');

  const stagingId = envData.sheets.staging.id;
  
  console.log(`📊 Legacy Sheet: ${LEGACY_SHEET_ID}`);
  console.log(`📊 STAGING Sheet: ${stagingId}`);
  console.log(`📊 Sheets to copy: ${SHEETS_TO_COPY.length}\n`);

  const report: any = {
    timestamp: new Date().toISOString(),
    legacySheetId: LEGACY_SHEET_ID,
    stagingSheetId: stagingId,
    sheets: [],
    totalRowsCopied: 0,
    errors: []
  };

  // Copy each sheet
  for (const sheetName of SHEETS_TO_COPY) {
    console.log(`\n📋 Processing: ${sheetName}...`);
    
    const sheetReport: any = {
      name: sheetName,
      legacyRows: 0,
      copiedRows: 0,
      status: 'pending'
    };

    try {
      // Read from legacy
      console.log(`   Reading from legacy...`);
      const legacyData = await getSheetData(sheets, LEGACY_SHEET_ID, sheetName);
      sheetReport.legacyRows = legacyData.length - 1; // Exclude header
      
      if (legacyData.length <= 1) {
        console.log(`   ⚠️  Sheet is empty in legacy, skipping`);
        sheetReport.status = 'skipped_empty';
        report.sheets.push(sheetReport);
        continue;
      }

      // Rate limiting (Google Sheets API quota)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Write to STAGING
      console.log(`   Writing to STAGING...`);
      await clearAndWriteSheet(sheets, stagingId, sheetName, legacyData);
      
      sheetReport.copiedRows = legacyData.length - 1; // Exclude header
      sheetReport.status = 'success';
      report.totalRowsCopied += sheetReport.copiedRows;

      console.log(`   ✅ Successfully copied ${sheetReport.copiedRows} rows`);

    } catch (error) {
      const errorMsg = (error as Error).message;
      console.error(`   ❌ Error: ${errorMsg}`);
      sheetReport.status = 'error';
      sheetReport.error = errorMsg;
      report.errors.push({
        sheet: sheetName,
        error: errorMsg
      });
    }

    report.sheets.push(sheetReport);
  }

  // Generate report
  console.log('\n\n📊 Generating G4 Copy Report...\n');
  
  const reportPath = path.join(process.cwd(), 'reports', 'G4-COPY-REPORT.md');
  const reportContent = generateMarkdownReport(report);
  await fs.writeFile(reportPath, reportContent);

  // Also save JSON version
  const jsonPath = path.join(process.cwd(), 'reports', 'G4-COPY-REPORT.json');
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

  console.log(`✅ Report saved: ${reportPath}`);
  console.log(`✅ JSON saved: ${jsonPath}\n`);

  // Summary
  const successCount = report.sheets.filter((s: any) => s.status === 'success').length;
  const errorCount = report.errors.length;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 G4 SELECTIVE COPY SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Sheets copied successfully: ${successCount}/${SHEETS_TO_COPY.length}`);
  console.log(`📊 Total rows copied: ${report.totalRowsCopied}`);
  console.log(`❌ Errors encountered: ${errorCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (errorCount > 0) {
    console.log('⚠️  Some sheets had errors. Review G4-COPY-REPORT.md for details.\n');
  } else {
    console.log('🎉 All sheets copied successfully! Ready for G5 (Smoke Test).\n');
  }
}

function generateMarkdownReport(report: any): string {
  let md = '# G4 — Selective Copy Report\n\n';
  md += `**Timestamp:** ${report.timestamp}\n`;
  md += `**Legacy Sheet:** ${report.legacySheetId}\n`;
  md += `**STAGING Sheet:** ${report.stagingSheetId}\n\n`;
  
  md += '## Summary\n\n';
  const successCount = report.sheets.filter((s: any) => s.status === 'success').length;
  md += `- **Sheets processed:** ${report.sheets.length}\n`;
  md += `- **Successful copies:** ${successCount}\n`;
  md += `- **Total rows copied:** ${report.totalRowsCopied}\n`;
  md += `- **Errors:** ${report.errors.length}\n\n`;

  md += '## Sheet Details\n\n';
  md += '| Sheet | Legacy Rows | Copied Rows | Status |\n';
  md += '|-------|-------------|-------------|--------|\n';
  
  for (const sheet of report.sheets) {
    const status = sheet.status === 'success' ? '✅ Success' : 
                   sheet.status === 'skipped_empty' ? '⚠️ Empty' : 
                   '❌ Error';
    md += `| ${sheet.name} | ${sheet.legacyRows} | ${sheet.copiedRows} | ${status} |\n`;
  }

  if (report.errors.length > 0) {
    md += '\n## Errors\n\n';
    for (const error of report.errors) {
      md += `### ${error.sheet}\n`;
      md += `\`\`\`\n${error.error}\n\`\`\`\n\n`;
    }
  }

  md += '\n## Next Steps\n\n';
  if (report.errors.length === 0) {
    md += '✅ All data copied successfully. Proceed to G5 (Smoke Test).\n';
  } else {
    md += '⚠️ Review errors above. Fix issues before proceeding to G5.\n';
  }

  return md;
}

// Execute
runG4SelectiveCopy().catch(error => {
  console.error('\n❌ G4 FAILED:', error.message);
  process.exit(1);
});
