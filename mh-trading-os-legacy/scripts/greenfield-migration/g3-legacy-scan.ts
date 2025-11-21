/**
 * G3 — Legacy Read-Only Scan
 * 
 * Reads the LEGACY sheet (read-only) and compares it with the new schema.
 * Identifies:
 * - Missing columns
 * - Extra columns
 * - Name mismatches
 * - Required transformations
 * 
 * Output: reports/LEGACY-DIFF.md
 */

import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateNewEnvFile, validateSchemaMap, type NewEnv } from './safety-guards.js';

const LEGACY_SHEET_ID = '1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0';

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token;
  if (!accessToken) {
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

async function getSheetHeaders(sheets: any, spreadsheetId: string, sheetName: string): Promise<string[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:ZZ1`
    });
    
    return response.data.values?.[0] || [];
  } catch (error) {
    return [];
  }
}

async function runG3LegacyScan() {
  console.log('🚀 Starting G3 — Legacy Read-Only Scan\n');

  // SAFETY CHECK 1: Validate NEW-ENV.json exists (ensures G0 completed)
  await validateNewEnvFile();

  // SAFETY CHECK 2: Validate schema.map.json exists (ensures G1 completed)
  const newSchema = await validateSchemaMap();

  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  console.log(`📊 Legacy Sheet ID: ${LEGACY_SHEET_ID}`);
  console.log(`📊 New Schema sheets: ${Object.keys(newSchema).length}\n`);

  // Scan legacy sheet
  console.log('🔍 Scanning legacy sheet structure...\n');
  const legacySheets = await getAllSheetNames(sheets, LEGACY_SHEET_ID);
  console.log(`✅ Found ${legacySheets.length} sheets in legacy spreadsheet\n`);

  const comparison: any = {
    timestamp: new Date().toISOString(),
    legacySheetId: LEGACY_SHEET_ID,
    legacySheetCount: legacySheets.length,
    newSchemaCount: Object.keys(newSchema).length,
    sheets: []
  };

  // Compare each new schema sheet with legacy
  for (const [newSheetName, newColumns] of Object.entries(newSchema)) {
    console.log(`📋 Comparing: ${newSheetName}...`);

    const sheetComparison: any = {
      name: newSheetName,
      existsInLegacy: false,
      legacyName: null,
      newColumnsCount: newColumns.length,
      legacyColumnsCount: 0,
      missingColumns: [],
      extraColumns: [],
      matchingColumns: [],
      transformationsNeeded: []
    };

    // Check if sheet exists in legacy (exact match or close match)
    const legacySheetName = legacySheets.find(s => 
      s.toLowerCase() === newSheetName.toLowerCase() || 
      s.replace(/[_\s]/g, '').toLowerCase() === newSheetName.replace(/[_\s]/g, '').toLowerCase()
    );

    if (legacySheetName) {
      sheetComparison.existsInLegacy = true;
      sheetComparison.legacyName = legacySheetName;

      // Get legacy headers
      const legacyHeaders = await getSheetHeaders(sheets, LEGACY_SHEET_ID, legacySheetName);
      sheetComparison.legacyColumnsCount = legacyHeaders.length;

      // Find missing columns (in new schema but not in legacy)
      sheetComparison.missingColumns = newColumns.filter(col => 
        !legacyHeaders.some(legacyCol => 
          legacyCol.toLowerCase().replace(/[_\s]/g, '') === col.toLowerCase().replace(/[_\s]/g, '')
        )
      );

      // Find extra columns (in legacy but not in new schema)
      sheetComparison.extraColumns = legacyHeaders.filter(legacyCol => 
        !newColumns.some(newCol => 
          newCol.toLowerCase().replace(/[_\s]/g, '') === legacyCol.toLowerCase().replace(/[_\s]/g, '')
        )
      );

      // Find matching columns
      sheetComparison.matchingColumns = newColumns.filter(col => 
        legacyHeaders.some(legacyCol => 
          legacyCol.toLowerCase().replace(/[_\s]/g, '') === col.toLowerCase().replace(/[_\s]/g, '')
        )
      );

      // Identify required transformations
      for (const newCol of newColumns) {
        const legacyMatch = legacyHeaders.find(legacyCol => 
          legacyCol.toLowerCase().replace(/[_\s]/g, '') === newCol.toLowerCase().replace(/[_\s]/g, '')
        );

        if (legacyMatch && legacyMatch !== newCol) {
          sheetComparison.transformationsNeeded.push({
            from: legacyMatch,
            to: newCol,
            type: 'rename'
          });
        }
      }

      console.log(`   Legacy: ${legacySheetName} (${legacyHeaders.length} columns)`);
      console.log(`   Matching: ${sheetComparison.matchingColumns.length}`);
      console.log(`   Missing: ${sheetComparison.missingColumns.length}`);
      console.log(`   Extra: ${sheetComparison.extraColumns.length}`);
    } else {
      console.log(`   ❌ Does not exist in legacy`);
    }

    comparison.sheets.push(sheetComparison);
    console.log('');
  }

  // Check for legacy sheets not in new schema
  const orphanedSheets = legacySheets.filter(legacyName => 
    !Object.keys(newSchema).some(newName => 
      newName.toLowerCase() === legacyName.toLowerCase() || 
      newName.replace(/[_\s]/g, '').toLowerCase() === legacyName.replace(/[_\s]/g, '').toLowerCase()
    )
  );

  comparison.orphanedSheets = orphanedSheets;

  // Write LEGACY-DIFF.md
  console.log('💾 Writing LEGACY-DIFF.md...\n');
  
  let diffMd = '# G3 Legacy Diff Report\n\n';
  diffMd += `**Timestamp:** ${comparison.timestamp}\n\n`;
  diffMd += `**Legacy Sheet ID:** ${LEGACY_SHEET_ID}\n\n`;
  diffMd += `**Legacy Sheets:** ${comparison.legacySheetCount}\n`;
  diffMd += `**New Schema Sheets:** ${comparison.newSchemaCount}\n\n`;
  diffMd += '## Summary\n\n';
  
  const existingCount = comparison.sheets.filter((s: any) => s.existsInLegacy).length;
  const missingCount = comparison.sheets.filter((s: any) => !s.existsInLegacy).length;
  
  diffMd += `- ✅ Sheets existing in both: ${existingCount}\n`;
  diffMd += `- ❌ New sheets not in legacy: ${missingCount}\n`;
  diffMd += `- 🗑️ Orphaned legacy sheets: ${orphanedSheets.length}\n\n`;

  diffMd += '## Detailed Comparison\n\n';

  for (const sheet of comparison.sheets) {
    diffMd += `### ${sheet.name}\n\n`;
    
    if (sheet.existsInLegacy) {
      diffMd += `**Status:** ✅ Exists in legacy as "${sheet.legacyName}"\n\n`;
      diffMd += `**Columns:** ${sheet.newColumnsCount} (new) vs ${sheet.legacyColumnsCount} (legacy)\n\n`;
      
      if (sheet.matchingColumns.length > 0) {
        diffMd += `**Matching columns (${sheet.matchingColumns.length}):** ${sheet.matchingColumns.join(', ')}\n\n`;
      }
      
      if (sheet.missingColumns.length > 0) {
        diffMd += `**❌ Missing in legacy (${sheet.missingColumns.length}):**\n`;
        for (const col of sheet.missingColumns) {
          diffMd += `- ${col}\n`;
        }
        diffMd += '\n';
      }
      
      if (sheet.extraColumns.length > 0) {
        diffMd += `**➕ Extra in legacy (${sheet.extraColumns.length}):**\n`;
        for (const col of sheet.extraColumns) {
          diffMd += `- ${col}\n`;
        }
        diffMd += '\n';
      }
      
      if (sheet.transformationsNeeded.length > 0) {
        diffMd += `**🔄 Transformations needed (${sheet.transformationsNeeded.length}):**\n`;
        for (const transform of sheet.transformationsNeeded) {
          diffMd += `- Rename: "${transform.from}" → "${transform.to}"\n`;
        }
        diffMd += '\n';
      }
    } else {
      diffMd += `**Status:** ❌ Does not exist in legacy (new sheet)\n\n`;
    }
  }

  if (orphanedSheets.length > 0) {
    diffMd += '## 🗑️ Orphaned Legacy Sheets\n\n';
    diffMd += 'These sheets exist in legacy but not in the new schema:\n\n';
    for (const orphan of orphanedSheets) {
      diffMd += `- ${orphan}\n`;
    }
    diffMd += '\n';
  }

  diffMd += '## Migration Recommendations\n\n';
  diffMd += '1. **New sheets:** These are intentional additions to the new schema\n';
  diffMd += '2. **Missing columns:** May need to be added to legacy data or marked as optional\n';
  diffMd += '3. **Extra columns:** Review if data should be migrated to new columns or archived\n';
  diffMd += '4. **Transformations:** Column renames - data can be mapped directly\n';
  diffMd += '5. **Orphaned sheets:** Review if any data should be migrated to new schema\n\n';
  diffMd += '⚠️ **Important:** This is a READ-ONLY scan. No changes have been made to the legacy sheet.\n';

  const reportsDir = path.join(process.cwd(), 'reports');
  const diffPath = path.join(reportsDir, 'LEGACY-DIFF.md');
  await fs.writeFile(diffPath, diffMd, 'utf-8');
  console.log(`✅ Diff report written to: ${diffPath}`);

  // Also save JSON for programmatic access
  const jsonPath = path.join(reportsDir, 'LEGACY-DIFF.json');
  await fs.writeFile(jsonPath, JSON.stringify(comparison, null, 2), 'utf-8');
  console.log(`✅ JSON data written to: ${jsonPath}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ DONE-G3: Legacy Read-Only Scan Complete');
  console.log('='.repeat(60));
  console.log(`\n📊 Legacy sheets scanned: ${comparison.legacySheetCount}`);
  console.log(`📊 Sheets in new schema: ${comparison.newSchemaCount}`);
  console.log(`✅ Matching sheets: ${existingCount}`);
  console.log(`❌ New sheets: ${missingCount}`);
  console.log(`🗑️ Orphaned legacy sheets: ${orphanedSheets.length}`);
  console.log('='.repeat(60));

  return comparison;
}

runG3LegacyScan()
  .then(() => {
    console.log('\n✅ G3 Legacy Scan completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ G3 Legacy Scan failed:', error);
    process.exit(1);
  });
