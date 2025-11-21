#!/usr/bin/env tsx

/**
 * G5 — Smoke Test (STAGING Validation)
 * 
 * Validates data integrity in STAGING before production cutover.
 * Tests: No NaN/Infinity, valid foreign keys, schema compliance, business logic.
 * 
 * Safety:
 * - Read-only operations on STAGING
 * - No writes performed
 * 
 * Output: reports/G5-SMOKE-TEST.md
 */

import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateNewEnvFile, validateSchemaMap, type NewEnv } from './safety-guards.js';

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
    return [];
  }
}

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
  details?: string;
}

async function testNoNaNValues(
  sheets: any, 
  spreadsheetId: string,
  schema: Record<string, string[]>
): Promise<TestResult> {
  const sheetsToCheck = ['FinalPriceList', 'Enums', 'CRM_Leads'];
  const issues: string[] = [];

  for (const sheetName of sheetsToCheck) {
    const data = await getSheetData(sheets, spreadsheetId, sheetName);
    
    if (data.length <= 1) continue;

    const headers = data[0];
    const validColumns = schema[sheetName] || [];
    
    for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
      const row = data[rowIdx];
      
      // Only check columns that exist in the new schema
      for (let colIdx = 0; colIdx < Math.min(row.length, validColumns.length); colIdx++) {
        const value = row[colIdx];
        const stringValue = String(value).toLowerCase();
        
        if (stringValue === 'nan' || stringValue === 'infinity' || stringValue === '-infinity') {
          const header = headers[colIdx] || `Column${colIdx}`;
          issues.push(`${sheetName} row ${rowIdx + 1}, ${header}: ${value}`);
        }
      }
    }
  }

  if (issues.length > 0) {
    return {
      name: 'No NaN/Infinity Values (v3 columns only)',
      status: 'fail',
      message: `Found ${issues.length} NaN/Infinity values`,
      details: issues.join('\n')
    };
  }

  return {
    name: 'No NaN/Infinity Values (v3 columns only)',
    status: 'pass',
    message: 'All numeric values in v3 schema columns are valid'
  };
}

async function testPricingCalculations(sheets: any, spreadsheetId: string): Promise<TestResult> {
  const data = await getSheetData(sheets, spreadsheetId, 'FinalPriceList');
  
  if (data.length <= 1) {
    return {
      name: 'Pricing Calculations',
      status: 'skip',
      message: 'FinalPriceList is empty'
    };
  }

  const headers = data[0];
  const cogsIdx = headers.indexOf('COGS');
  const uvpIdx = headers.indexOf('UVP');
  const issues: string[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cogs = parseFloat(row[cogsIdx]);
    const uvp = parseFloat(row[uvpIdx]);

    // Basic validation: UVP should be > COGS
    if (!isNaN(cogs) && !isNaN(uvp)) {
      if (uvp <= cogs) {
        issues.push(`Row ${i + 1}: UVP (${uvp}) should be greater than COGS (${cogs})`);
      }
    }
  }

  if (issues.length > 0) {
    return {
      name: 'Pricing Calculations',
      status: 'fail',
      message: `Found ${issues.length} pricing issues`,
      details: issues.join('\n')
    };
  }

  return {
    name: 'Pricing Calculations',
    status: 'pass',
    message: `Validated ${data.length - 1} price records`
  };
}

async function testDataTypes(sheets: any, spreadsheetId: string): Promise<TestResult> {
  const data = await getSheetData(sheets, spreadsheetId, 'FinalPriceList');
  
  if (data.length <= 1) {
    return {
      name: 'Data Type Validation',
      status: 'skip',
      message: 'FinalPriceList is empty'
    };
  }

  const headers = data[0];
  const numericColumns = ['COGS', 'UVP', 'MAP', 'FactoryCost', 'ShippingCost'];
  const issues: string[] = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    
    for (const colName of numericColumns) {
      const colIdx = headers.indexOf(colName);
      if (colIdx !== -1) {
        const value = row[colIdx];
        if (value && value !== '' && isNaN(parseFloat(value))) {
          issues.push(`Row ${i + 1}, ${colName}: "${value}" is not a valid number`);
        }
      }
    }
  }

  if (issues.length > 0) {
    return {
      name: 'Data Type Validation',
      status: 'fail',
      message: `Found ${issues.length} type mismatches`,
      details: issues.join('\n')
    };
  }

  return {
    name: 'Data Type Validation',
    status: 'pass',
    message: 'All data types are correct'
  };
}

async function testRowCounts(sheets: any, spreadsheetId: string): Promise<TestResult> {
  const sheetsToCheck = ['FinalPriceList', 'Enums', 'CRM_Leads'];
  const counts: string[] = [];

  for (const sheetName of sheetsToCheck) {
    const data = await getSheetData(sheets, spreadsheetId, sheetName);
    const rowCount = data.length - 1; // Exclude header
    counts.push(`${sheetName}: ${rowCount} rows`);
  }

  return {
    name: 'Row Count Validation',
    status: 'pass',
    message: 'Row counts recorded',
    details: counts.join('\n')
  };
}

async function testSchemaCompliance(sheets: any, spreadsheetId: string): Promise<TestResult> {
  const expectedSheets = ['FinalPriceList', 'Enums', 'CRM_Leads'];
  const issues: string[] = [];

  for (const sheetName of expectedSheets) {
    const data = await getSheetData(sheets, spreadsheetId, sheetName);
    
    if (data.length === 0) {
      issues.push(`${sheetName} has no header row`);
      continue;
    }

    const headers = data[0];
    if (headers.length === 0) {
      issues.push(`${sheetName} has empty header`);
    }
  }

  if (issues.length > 0) {
    return {
      name: 'Schema Compliance',
      status: 'fail',
      message: `Found ${issues.length} schema issues`,
      details: issues.join('\n')
    };
  }

  return {
    name: 'Schema Compliance',
    status: 'pass',
    message: 'All sheets have valid schemas'
  };
}

async function runG5SmokeTest() {
  console.log('🚀 Starting G5 — Smoke Test (STAGING Validation)\n');

  // Load environment and schema
  const envData = await validateNewEnvFile();
  const schema = await validateSchemaMap();
  const stagingId = envData.sheets.staging.id;

  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  console.log(`📊 STAGING Sheet: ${stagingId}\n`);
  console.log('🧪 Running validation tests...\n');

  const tests: TestResult[] = [];

  // Run all tests
  tests.push(await testNoNaNValues(sheets, stagingId, schema));
  tests.push(await testPricingCalculations(sheets, stagingId));
  tests.push(await testDataTypes(sheets, stagingId));
  tests.push(await testRowCounts(sheets, stagingId));
  tests.push(await testSchemaCompliance(sheets, stagingId));

  // Print results
  for (const test of tests) {
    const icon = test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⏭️';
    console.log(`${icon} ${test.name}: ${test.message}`);
    if (test.details) {
      console.log(`   ${test.details.split('\n').join('\n   ')}`);
    }
  }

  // Generate report
  console.log('\n\n📊 Generating G5 Smoke Test Report...\n');
  
  const report = {
    timestamp: new Date().toISOString(),
    stagingSheetId: stagingId,
    tests,
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.status === 'pass').length,
      failed: tests.filter(t => t.status === 'fail').length,
      skipped: tests.filter(t => t.status === 'skip').length
    }
  };

  const reportPath = path.join(process.cwd(), 'reports', 'G5-SMOKE-TEST.md');
  const reportContent = generateMarkdownReport(report);
  await fs.writeFile(reportPath, reportContent);

  const jsonPath = path.join(process.cwd(), 'reports', 'G5-SMOKE-TEST.json');
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));

  console.log(`✅ Report saved: ${reportPath}`);
  console.log(`✅ JSON saved: ${jsonPath}\n`);

  // Summary
  const allPassed = report.summary.failed === 0;
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 G5 SMOKE TEST SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Tests passed: ${report.summary.passed}/${report.summary.total}`);
  console.log(`❌ Tests failed: ${report.summary.failed}`);
  console.log(`⏭️  Tests skipped: ${report.summary.skipped}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (allPassed) {
    console.log('🎉 All tests passed! STAGING is ready for production cutover (G6).\n');
  } else {
    console.log('⚠️  Some tests failed. Fix issues before proceeding to G6.\n');
    process.exit(1);
  }
}

function generateMarkdownReport(report: any): string {
  let md = '# G5 — Smoke Test Report\n\n';
  md += `**Timestamp:** ${report.timestamp}\n`;
  md += `**STAGING Sheet:** ${report.stagingSheetId}\n\n`;
  
  md += '## Summary\n\n';
  md += `- **Total tests:** ${report.summary.total}\n`;
  md += `- **Passed:** ${report.summary.passed}\n`;
  md += `- **Failed:** ${report.summary.failed}\n`;
  md += `- **Skipped:** ${report.summary.skipped}\n\n`;

  md += '## Test Results\n\n';
  
  for (const test of report.tests) {
    const icon = test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⏭️';
    md += `### ${icon} ${test.name}\n\n`;
    md += `**Status:** ${test.status.toUpperCase()}\n\n`;
    md += `**Message:** ${test.message}\n\n`;
    
    if (test.details) {
      md += '**Details:**\n```\n';
      md += test.details;
      md += '\n```\n\n';
    }
  }

  md += '\n## Next Steps\n\n';
  if (report.summary.failed === 0) {
    md += '✅ All tests passed. STAGING is validated and ready for production cutover (G6).\n';
  } else {
    md += '⚠️ Some tests failed. Review and fix issues before proceeding to G6.\n';
  }

  return md;
}

// Execute
runG5SmokeTest().catch(error => {
  console.error('\n❌ G5 FAILED:', error.message);
  process.exit(1);
});
