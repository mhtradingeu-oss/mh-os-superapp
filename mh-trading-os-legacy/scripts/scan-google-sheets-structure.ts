/**
 * Scan Google Sheets Structure
 * Extracts all sheets and their headers from the production spreadsheet
 */

import { getUncachableGoogleSheetClient, SPREADSHEET_ID } from '../lib/sheets';
import { retryWithBackoff } from '../lib/retry';
import { writeFile } from 'fs/promises';

interface SheetInfo {
  name: string;
  sheetId: number;
  headers: string[];
  rowCount: number;
  columnCount: number;
}

async function scanAllSheets() {
  console.log('🔍 Scanning Google Sheets Structure...');
  console.log(`📊 Spreadsheet ID: ${SPREADSHEET_ID}\n`);

  const sheets = await getUncachableGoogleSheetClient();

  // Get all sheet metadata
  const metadata = await retryWithBackoff(() =>
    sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      includeGridData: false,
    })
  );

  const allSheets: SheetInfo[] = [];

  for (const sheet of metadata.data.sheets || []) {
    const sheetName = sheet.properties?.title;
    const sheetId = sheet.properties?.sheetId;
    const rowCount = sheet.properties?.gridProperties?.rowCount || 0;
    const columnCount = sheet.properties?.gridProperties?.columnCount || 0;

    if (!sheetName) continue;

    console.log(`📄 Reading: ${sheetName} (ID: ${sheetId})`);

    // Read first row (headers)
    try {
      const response = await retryWithBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!1:1`,
        })
      );

      const headers = (response.data.values?.[0] || []) as string[];

      allSheets.push({
        name: sheetName,
        sheetId: sheetId!,
        headers,
        rowCount,
        columnCount,
      });

      console.log(`   ✅ Headers: ${headers.length} columns`);
    } catch (error: any) {
      console.error(`   ❌ Error reading ${sheetName}: ${error.message}`);
      allSheets.push({
        name: sheetName,
        sheetId: sheetId!,
        headers: [],
        rowCount,
        columnCount,
      });
    }
  }

  // Generate TypeScript schema
  const schemaOutput = generateSchemaCode(allSheets);
  await writeFile('server/scripts/scanned-sheets-schema.ts', schemaOutput);

  // Generate JSON report
  const jsonReport = JSON.stringify(allSheets, null, 2);
  await writeFile('server/scripts/scanned-sheets-report.json', jsonReport);

  console.log('\n========================================================================');
  console.log(`✅ Scanned ${allSheets.length} sheets`);
  console.log('📝 Output files:');
  console.log('   - server/scripts/scanned-sheets-schema.ts (TypeScript schema)');
  console.log('   - server/scripts/scanned-sheets-report.json (JSON report)');
  console.log('========================================================================\n');

  // Print summary
  console.log('📊 SUMMARY:');
  console.log('Sheet Name'.padEnd(35), 'Columns', 'Rows');
  console.log('─'.repeat(60));
  allSheets.forEach(sheet => {
    console.log(
      sheet.name.padEnd(35),
      String(sheet.headers.length).padStart(7),
      String(sheet.rowCount).padStart(6)
    );
  });

  return allSheets;
}

function generateSchemaCode(sheets: SheetInfo[]): string {
  let code = `/**
 * SCANNED GOOGLE SHEETS SCHEMA
 * Auto-generated from production spreadsheet
 * Date: ${new Date().toISOString()}
 * Spreadsheet ID: ${SPREADSHEET_ID}
 */

type SheetSchema = { name: string; headers: string[]; protected?: boolean };

export const SCANNED_SCHEMA: SheetSchema[] = [
`;

  sheets.forEach(sheet => {
    code += `  {\n`;
    code += `    name: "${sheet.name}",\n`;
    code += `    headers: [\n`;
    
    if (sheet.headers.length > 0) {
      sheet.headers.forEach((header, idx) => {
        const comma = idx < sheet.headers.length - 1 ? ',' : '';
        code += `      "${header}"${comma}\n`;
      });
    }
    
    code += `    ],\n`;
    code += `  },\n`;
  });

  code += `];\n\n`;

  code += `// Quick reference\n`;
  code += `export const SHEET_NAMES = [\n`;
  sheets.forEach(sheet => {
    code += `  "${sheet.name}",\n`;
  });
  code += `];\n`;

  return code;
}

// Run scan
scanAllSheets().catch((error) => {
  console.error('\n❌ ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
});
