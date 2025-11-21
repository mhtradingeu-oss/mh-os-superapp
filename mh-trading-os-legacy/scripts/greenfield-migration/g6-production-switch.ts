#!/usr/bin/env tsx

/**
 * G6 — Production Switch (STAGING → PROD)
 * 
 * Copies validated data from STAGING to PROD and prepares for environment cutover.
 * 
 * Safety:
 * - runSafetyChecks() before PROD writes
 * - Read-only operations on STAGING
 * - Validates STAGING passed smoke tests first
 * 
 * Output: reports/G6-PROD-SWITCH.md
 */

import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  validateNewEnvFile,
  runSafetyChecks,
  type NewEnv 
} from './safety-guards.js';

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

async function getAllSheetNames(sheets: any, spreadsheetId: string): Promise<string[]> {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title'
  });
  
  return response.data.sheets?.map((s: any) => s.properties.title) || [];
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
  } catch (error) {
    // Sheet might be empty, continue
  }

  // Write new data (skip header row from STAGING, keep PROD header)
  if (data.length > 1) {
    const dataRows = data.slice(1); // Skip header from STAGING
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A2`,
      valueInputOption: 'RAW',
      resource: {
        values: dataRows
      }
    });
    
    console.log(`   ✅ Wrote ${dataRows.length} rows to PROD ${sheetName}`);
  }
}

async function runG6ProductionSwitch() {
  console.log('🚀 Starting G6 — Production Switch (STAGING → PROD)\n');

  // Validate G5 passed
  const g5ReportPath = path.join(process.cwd(), 'reports', 'G5-SMOKE-TEST.json');
  try {
    const g5Report = JSON.parse(await fs.readFile(g5ReportPath, 'utf-8'));
    if (g5Report.summary.failed > 0) {
      throw new Error(
        `❌ G5 smoke tests failed (${g5Report.summary.failed} failures). ` +
        'Fix issues before proceeding to production switch.'
      );
    }
    console.log('✅ G5 smoke tests passed - proceeding with production switch\n');
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      throw new Error('❌ G5-SMOKE-TEST.json not found. Run G5 first.');
    }
    throw error;
  }

  // Load environment
  const envData = await validateNewEnvFile();

  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  // SAFETY CHECK: Verify PROD is safe to write to
  await runSafetyChecks(sheets, envData, 'prod');

  const stagingId = envData.sheets.staging.id;
  const prodId = envData.sheets.prod.id;
  
  console.log(`📊 STAGING Sheet: ${stagingId}`);
  console.log(`📊 PROD Sheet: ${prodId}\n`);

  // Get all sheet names from STAGING
  console.log('📋 Discovering STAGING sheets...\n');
  const stagingSheets = await getAllSheetNames(sheets, stagingId);
  console.log(`Found ${stagingSheets.length} sheets in STAGING\n`);

  const report: any = {
    timestamp: new Date().toISOString(),
    stagingSheetId: stagingId,
    prodSheetId: prodId,
    sheets: [],
    totalRowsCopied: 0,
    errors: []
  };

  // Copy each sheet from STAGING to PROD
  for (const sheetName of stagingSheets) {
    console.log(`\n📋 Processing: ${sheetName}...`);
    
    const sheetReport: any = {
      name: sheetName,
      stagingRows: 0,
      copiedRows: 0,
      status: 'pending'
    };

    try {
      // Read from STAGING
      console.log(`   Reading from STAGING...`);
      const stagingData = await getSheetData(sheets, stagingId, sheetName);
      sheetReport.stagingRows = stagingData.length - 1; // Exclude header
      
      if (stagingData.length <= 1) {
        console.log(`   ⚠️  Sheet is empty in STAGING, skipping`);
        sheetReport.status = 'skipped_empty';
        report.sheets.push(sheetReport);
        continue;
      }

      // Rate limiting (Google Sheets API quota)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Write to PROD
      console.log(`   Writing to PROD...`);
      await clearAndWriteSheet(sheets, prodId, sheetName, stagingData);
      
      sheetReport.copiedRows = stagingData.length - 1;
      sheetReport.status = 'success';
      report.totalRowsCopied += sheetReport.copiedRows;

      console.log(`   ✅ Successfully copied ${sheetReport.copiedRows} rows to PROD`);

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
  console.log('\n\n📊 Generating G6 Production Switch Report...\n');
  
  const reportPath = path.join(process.cwd(), 'reports', 'G6-PROD-SWITCH.md');
  const reportContent = generateMarkdownReport(report, prodId);
  await fs.writeFile(reportPath, reportContent);

  const jsonPath = path.join(process.cwd(), 'reports', 'G6-PROD-SWITCH.json');
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

  console.log(`✅ Report saved: ${reportPath}`);
  console.log(`✅ JSON saved: ${jsonPath}\n`);

  // Summary
  const successCount = report.sheets.filter((s: any) => s.status === 'success').length;
  const errorCount = report.errors.length;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 G6 PRODUCTION SWITCH SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Sheets copied successfully: ${successCount}/${stagingSheets.length}`);
  console.log(`📊 Total rows copied to PROD: ${report.totalRowsCopied}`);
  console.log(`❌ Errors encountered: ${errorCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (errorCount > 0) {
    console.log('⚠️  Some sheets had errors. Review G6-PROD-SWITCH.md for details.\n');
  } else {
    console.log('🎉 All data copied to PROD successfully!\n');
    console.log('📝 NEXT STEPS:\n');
    console.log(`1. Update environment variable GOOGLE_SHEET_ID to: ${prodId}`);
    console.log('2. Restart the application');
    console.log('3. Verify application works with new PROD sheet');
    console.log('4. Proceed to G7 (Archival & Cleanup)\n');
  }
}

function generateMarkdownReport(report: any, prodId: string): string {
  let md = '# G6 — Production Switch Report\n\n';
  md += `**Timestamp:** ${report.timestamp}\n`;
  md += `**STAGING Sheet:** ${report.stagingSheetId}\n`;
  md += `**PROD Sheet:** ${report.prodSheetId}\n\n`;
  
  md += '## Summary\n\n';
  const successCount = report.sheets.filter((s: any) => s.status === 'success').length;
  md += `- **Sheets processed:** ${report.sheets.length}\n`;
  md += `- **Successful copies:** ${successCount}\n`;
  md += `- **Total rows copied:** ${report.totalRowsCopied}\n`;
  md += `- **Errors:** ${report.errors.length}\n\n`;

  md += '## Sheet Details\n\n';
  md += '| Sheet | STAGING Rows | Copied Rows | Status |\n';
  md += '|-------|--------------|-------------|--------|\n';
  
  for (const sheet of report.sheets) {
    const status = sheet.status === 'success' ? '✅ Success' : 
                   sheet.status === 'skipped_empty' ? '⚠️ Empty' : 
                   '❌ Error';
    md += `| ${sheet.name} | ${sheet.stagingRows} | ${sheet.copiedRows} | ${status} |\n`;
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
    md += '### ✅ Production Switch Complete!\n\n';
    md += '**Critical Actions Required:**\n\n';
    md += `1. **Update Environment Variable**\n`;
    md += `   - Set \`GOOGLE_SHEET_ID\` to: \`${prodId}\`\n`;
    md += `   - This can be done in Replit Secrets or .env file\n\n`;
    md += `2. **Restart Application**\n`;
    md += `   - Restart the workflow to load the new PROD sheet\n\n`;
    md += `3. **Verify Application**\n`;
    md += `   - Test critical features to ensure they work with new PROD sheet\n`;
    md += `   - Check that data loads correctly\n`;
    md += `   - Monitor for errors\n\n`;
    md += `4. **Proceed to G7**\n`;
    md += `   - Once verified, run G7 (Archival & Cleanup) to archive legacy and clean up STAGING\n`;
  } else {
    md += '⚠️ Some sheets had errors. Review errors above and retry G6.\n';
  }

  return md;
}

// Execute
runG6ProductionSwitch().catch(error => {
  console.error('\n❌ G6 FAILED:', error.message);
  process.exit(1);
});
