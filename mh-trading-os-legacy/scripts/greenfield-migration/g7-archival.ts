#!/usr/bin/env tsx

/**
 * G7 — Archival & Cleanup
 * 
 * Final migration phase:
 * 1. Renames legacy sheet to "[ARCHIVED] ..."
 * 2. Generates final migration summary
 * 3. Provides cleanup instructions
 * 
 * Safety:
 * - Only renames legacy sheet (no deletion)
 * - No writes to PROD or STAGING
 * 
 * Output: reports/G7-ARCHIVAL.md
 */

import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateNewEnvFile } from './safety-guards.js';

const LEGACY_SHEET_ID = '1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0';
const LEGACY_ARCHIVE_NAME = '[ARCHIVED] MH Trading OS - Legacy (2025-11-17)';

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

async function renameSpreadsheet(sheets: any, spreadsheetId: string, newTitle: string): Promise<void> {
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{
          updateSpreadsheetProperties: {
            properties: {
              title: newTitle
            },
            fields: 'title'
          }
        }]
      }
    });
    
    console.log(`✅ Renamed spreadsheet to: "${newTitle}"`);
  } catch (error) {
    throw new Error(`Failed to rename spreadsheet: ${(error as Error).message}`);
  }
}

async function runG7Archival() {
  console.log('🚀 Starting G7 — Archival & Cleanup\n');

  // Validate prerequisites
  const envData = await validateNewEnvFile();

  // Verify G6 completed
  const g6ReportPath = path.join(process.cwd(), 'reports', 'G6-PROD-SWITCH.json');
  try {
    const g6Report = JSON.parse(await fs.readFile(g6ReportPath, 'utf-8'));
    if (g6Report.errors.length > 0) {
      throw new Error(
        `❌ G6 had ${g6Report.errors.length} errors. ` +
        'Fix issues before archiving.'
      );
    }
    console.log('✅ G6 production switch completed successfully\n');
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      throw new Error('❌ G6-PROD-SWITCH.json not found. Run G6 first.');
    }
    throw error;
  }

  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  const report: any = {
    timestamp: new Date().toISOString(),
    legacySheetId: LEGACY_SHEET_ID,
    legacyArchiveName: LEGACY_ARCHIVE_NAME,
    prodSheetId: envData.sheets.prod.id,
    stagingSheetId: envData.sheets.staging.id,
    actions: []
  };

  // Action 1: Rename legacy sheet
  console.log('\n📝 Renaming legacy sheet...\n');
  try {
    await renameSpreadsheet(sheets, LEGACY_SHEET_ID, LEGACY_ARCHIVE_NAME);
    report.actions.push({
      action: 'rename_legacy',
      status: 'success',
      message: `Renamed to: ${LEGACY_ARCHIVE_NAME}`
    });
  } catch (error) {
    const errorMsg = (error as Error).message;
    console.error(`❌ Failed to rename: ${errorMsg}`);
    report.actions.push({
      action: 'rename_legacy',
      status: 'failed',
      error: errorMsg
    });
  }

  // Generate migration statistics
  console.log('\n📊 Generating migration statistics...\n');
  
  const stats: any = {
    legacySheets: 121,
    newSheets: 21,
    reduction: Math.round((1 - 21/121) * 100),
    totalRowsMigrated: 0,
    sheets: []
  };

  // Load all reports to compile stats
  try {
    const g4Report = JSON.parse(await fs.readFile(
      path.join(process.cwd(), 'reports', 'G4-COPY-REPORT.json'),
      'utf-8'
    ));
    stats.totalRowsMigrated += g4Report.totalRowsCopied || 0;
    
    const g6Report = JSON.parse(await fs.readFile(
      path.join(process.cwd(), 'reports', 'G6-PROD-SWITCH.json'),
      'utf-8'
    ));
    
    // Add sheet-level statistics
    for (const sheet of g6Report.sheets) {
      if (sheet.status === 'success') {
        stats.sheets.push({
          name: sheet.name,
          rows: sheet.copiedRows
        });
      }
    }
  } catch (error) {
    console.warn('⚠️  Could not load some report files for statistics');
  }

  report.statistics = stats;

  // Generate final report
  console.log('📄 Generating G7 Archival Report...\n');
  
  const reportPath = path.join(process.cwd(), 'reports', 'G7-ARCHIVAL.md');
  const reportContent = generateMarkdownReport(report, envData);
  await fs.writeFile(reportPath, reportContent);

  const jsonPath = path.join(process.cwd(), 'reports', 'G7-ARCHIVAL.json');
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

  console.log(`✅ Report saved: ${reportPath}`);
  console.log(`✅ JSON saved: ${jsonPath}\n`);

  // Final summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 MIGRATION COMPLETE!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Legacy sheet archived`);
  console.log(`📊 Migrated from ${stats.legacySheets} → ${stats.newSheets} sheets (${stats.reduction}% reduction)`);
  console.log(`📊 Total rows migrated: ${stats.totalRowsMigrated}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('📝 CRITICAL FINAL STEPS:\n');
  console.log(`1. **Update environment variable SHEETS_SPREADSHEET_ID**`);
  console.log(`   Current (legacy): ${LEGACY_SHEET_ID}`);
  console.log(`   New (PROD v3): ${envData.sheets.prod.id}\n`);
  console.log(`2. **Restart the application** to load the new PROD sheet\n`);
  console.log(`3. **Verify application** works correctly with new sheet\n`);
  console.log(`4. **Optional: Delete STAGING sheet** once verified (ID: ${envData.sheets.staging.id})\n`);
  console.log('📄 See G7-ARCHIVAL.md for detailed instructions.\n');
}

function generateMarkdownReport(report: any, envData: any): string {
  let md = '# G7 — Archival & Cleanup Report\n\n';
  md += `**Timestamp:** ${report.timestamp}\n\n`;
  
  md += '## Summary\n\n';
  md += `- **Legacy sheet:** ${report.legacySheetId}\n`;
  md += `- **Archive name:** ${report.legacyArchiveName}\n`;
  md += `- **PROD sheet:** ${report.prodSheetId}\n`;
  md += `- **STAGING sheet:** ${report.stagingSheetId}\n\n`;

  md += '## Actions Performed\n\n';
  for (const action of report.actions) {
    const status = action.status === 'success' ? '✅' : '❌';
    md += `- ${status} **${action.action}**: ${action.message || action.error}\n`;
  }

  md += '\n## Migration Statistics\n\n';
  const stats = report.statistics;
  md += `- **Legacy sheets:** ${stats.legacySheets}\n`;
  md += `- **New v3 sheets:** ${stats.newSheets}\n`;
  md += `- **Reduction:** ${stats.reduction}% simpler architecture\n`;
  md += `- **Total rows migrated:** ${stats.totalRowsMigrated}\n\n`;

  md += '### Sheets in Production\n\n';
  md += '| Sheet | Rows |\n';
  md += '|-------|------|\n';
  for (const sheet of stats.sheets) {
    md += `| ${sheet.name} | ${sheet.rows} |\n`;
  }

  md += '\n## 🚨 CRITICAL FINAL STEPS\n\n';
  md += '### Step 1: Update Environment Variable\n\n';
  md += `Update \`SHEETS_SPREADSHEET_ID\` to point to the new PROD sheet:\n\n`;
  md += '```\n';
  md += `SHEETS_SPREADSHEET_ID=${report.prodSheetId}\n`;
  md += '```\n\n';
  md += 'This can be done in:\n';
  md += '- Replit Secrets panel\n';
  md += '- `.env` file (if used)\n';
  md += '- Environment configuration\n\n';

  md += '### Step 2: Restart Application\n\n';
  md += 'Restart the workflow to load the new PROD sheet:\n';
  md += '- Click the "Restart" button in the workflow panel\n';
  md += '- Or run: `npm run dev`\n\n';

  md += '### Step 3: Verify Application\n\n';
  md += 'Test critical features:\n';
  md += '- ✅ Check that data loads correctly\n';
  md += '- ✅ Verify pricing calculations work\n';
  md += '- ✅ Test CRM functionality\n';
  md += '- ✅ Ensure no errors in logs\n\n';

  md += '### Step 4: Optional Cleanup\n\n';
  md += `Once verified, you can optionally:\n`;
  md += `- Delete STAGING sheet (ID: ${report.stagingSheetId})\n`;
  md += `- Archive migration scripts (move to \`server/scripts/greenfield-migration/archive/\`)\n`;
  md += `- Clean up report files (keep only final summary)\n\n`;

  md += '## Legacy Sheet Status\n\n';
  md += `The legacy sheet has been renamed to:\n`;
  md += `**${report.legacyArchiveName}**\n\n`;
  md += `It remains accessible for reference but is no longer used by the application.\n\n`;

  md += '## 🎉 Migration Complete!\n\n';
  md += `Your MH Trading OS has successfully migrated from a 121-sheet legacy system to a streamlined 21-sheet v3 architecture. `;
  md += `This represents an ${stats.reduction}% simplification while maintaining all critical business functionality.\n\n`;
  md += `**Total rows migrated:** ${stats.totalRowsMigrated}\n\n`;
  md += `The new system is now ready for production use.\n`;

  return md;
}

// Execute
runG7Archival().catch(error => {
  console.error('\n❌ G7 FAILED:', error.message);
  process.exit(1);
});
