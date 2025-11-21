import { GoogleSheetsService, SPREADSHEET_ID } from './sheets';
import { hydrateSettings, type SettingsStatus } from './settings';
import { REQUIRED_SHEETS, type SheetDefinition } from './ensure-sheets';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface ReadinessData {
  spreadsheetId: string;
  settings: {
    total: number;
    ok: number;
    missing: number;
    secret: number;
    warning: number;
    details: SettingsStatus[];
  };
  sheets: {
    total: number;
    present: number;
    missing: number;
    details: Array<{
      name: string;
      status: 'present' | 'missing';
      missingColumns: number;
      headers?: string[];
    }>;
  };
  products: {
    total: number;
    withCOGS: number;
    cogsNumericPercent: number;
    withMAP: number;
    withAutoPriceFlag: number;
    errors: string[];
  };
  growth: {
    apiKey: {
      present: boolean;
      source: 'env' | 'missing';
      warning?: string;
    };
    endpoints: string[];
    crmSheets: {
      total: number;
      present: number;
      missing: number;
      names: string[];
    };
    counters: {
      leadsTotal: number;
      leadsNew: number;
      leadsScored: number;
      leadsAssigned: number;
      leadsEnriched: number;
    };
    warnings: string[];
  };
  ready: boolean;
  issues: string[];
}

export interface SheetsStructureData {
  sheets: Array<{
    name: string;
    headers: string[];
    sampleRows: any[][];
    numericColumnWarnings: string[];
    totalRows: number;
  }>;
}

export async function generateReadinessData(): Promise<ReadinessData> {
  const sheetsService = new GoogleSheetsService();
  const issues: string[] = [];

  // 1. Settings Status
  const config = await hydrateSettings();
  const settingsTotal = config.settingsStatus.length;
  const settingsOk = config.settingsStatus.filter(s => s.status === 'ok').length;
  const settingsMissing = config.settingsStatus.filter(s => s.status === 'missing').length;
  const settingsSecret = config.settingsStatus.filter(s => s.status === 'secret').length;
  const settingsWarning = config.settingsStatus.filter(s => s.status === 'warning').length;

  if (settingsMissing > 0) {
    issues.push(`${settingsMissing} critical settings missing`);
  }
  if (settingsWarning > 0) {
    issues.push(`${settingsWarning} settings have warnings (possible security issues)`);
  }

  // 2. Sheets Status
  const client = await sheetsService['getClient']();
  const metadata = await client.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  
  const existingSheetNames = metadata.data.sheets?.map(s => s.properties?.title || '') || [];
  
  const sheetsDetails = REQUIRED_SHEETS.map(sheet => {
    const exists = existingSheetNames.includes(sheet.name);
    return {
      name: sheet.name,
      status: exists ? 'present' as const : 'missing' as const,
      missingColumns: 0,
      headers: exists ? sheet.headers : undefined,
    };
  });

  const sheetsPresent = sheetsDetails.filter(s => s.status === 'present').length;
  const sheetsMissing = sheetsDetails.filter(s => s.status === 'missing').length;

  if (sheetsMissing > 0) {
    issues.push(`${sheetsMissing} required sheets missing`);
  }

  // 3. Product Metrics (FinalPriceList) - Read RAW VALUES to match structure report
  let productTotal = 0;
  let productWithCOGS = 0;
  let cogsNumericCount = 0;
  let productWithMAP = 0;
  let productWithAutoPriceFlag = 0;
  const productErrors: string[] = [];

  try {
    // Read RAW values directly (not parsed) to match structure report
    const client = await sheetsService['getClient']();
    const response = await client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'FinalPriceList!A:ZZ',
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      throw new Error('FinalPriceList has no data rows');
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);
    productTotal = dataRows.length;

    const cogsIndex = headers.indexOf('COGS_EUR');
    const mapIndex = headers.indexOf('MAP');
    const autoPriceIndex = headers.indexOf('AutoPriceFlag');
    const skuIndex = headers.indexOf('SKU');

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      
      // COGS_EUR validation (RAW VALUES - check for € symbols)
      if (cogsIndex !== -1) {
        const cogsValue = row[cogsIndex];
        if (cogsValue !== undefined && cogsValue !== null && cogsValue !== '') {
          productWithCOGS++;
          
          const stringValue = String(cogsValue).trim();
          // Check if purely numeric (no € symbols, commas, or errors)
          if (/^-?\d+\.?\d*$/.test(stringValue)) {
            cogsNumericCount++;
          } else {
            // Found non-numeric value (€, $, #ERROR, etc.)
            if (productErrors.length < 10) { // Limit error samples
              const sku = skuIndex !== -1 ? row[skuIndex] : 'Unknown';
              productErrors.push(`Product ${sku}: COGS_EUR contains non-numeric value: ${stringValue}`);
            }
          }
        }
      }

      // MAP validation
      if (mapIndex !== -1) {
        const mapValue = row[mapIndex];
        if (mapValue !== undefined && mapValue !== null && mapValue !== '') {
          const stringValue = String(mapValue).trim();
          if (stringValue && stringValue !== '#N/A' && stringValue !== '#ERROR!') {
            productWithMAP++;
          }
        }
      }

      // AutoPriceFlag validation
      if (autoPriceIndex !== -1) {
        const flagValue = row[autoPriceIndex];
        if (flagValue === true || flagValue === 'TRUE' || flagValue === 'true') {
          productWithAutoPriceFlag++;
        }
      }
    }

    const cogsNumericPercent = productWithCOGS > 0 
      ? Math.round((cogsNumericCount / productWithCOGS) * 100) 
      : 0;

    if (cogsNumericPercent < 100) {
      const nonNumericCount = productWithCOGS - cogsNumericCount;
      issues.push(`COGS_EUR numeric validation: ${cogsNumericPercent}% (${nonNumericCount} products have € symbols or non-numeric values)`);
    }

    if (productWithMAP === 0 && productTotal > 0) {
      issues.push('No products have MAP defined');
    }

  } catch (error: any) {
    productErrors.push(`Failed to read FinalPriceList: ${error.message}`);
    issues.push('FinalPriceList could not be read');
  }

  // 4. Growth Engine Metrics (CRM)
  const growthWarnings: string[] = [];
  const growthEndpoints = [
    'POST /api/growth/places/search',
    'GET /api/growth/places/normalize',
    'POST /api/growth/score',
    'GET /api/growth/assign',
    'POST /api/growth/enrich/queue',
    'POST /api/growth/enrich/run',
    'GET /api/growth/export'
  ];

  // API Key Status
  const apiPlacesKey = process.env.API_PLACES_KEY;
  const apiKeyPresent = !!apiPlacesKey;
  const apiKeySource: 'env' | 'missing' = apiKeyPresent ? 'env' : 'missing';
  let apiKeyWarning: string | undefined;
  
  if (!apiKeyPresent) {
    apiKeyWarning = 'API_PLACES_KEY missing - harvest will run in dry-run mode';
    growthWarnings.push(apiKeyWarning);
  }

  // CRM Sheets Status
  const crmSheetNames = ['CRM_Leads', 'Lead_Touches', 'Territories', 'Assignment_Rules', 'Enrichment_Queue', 'Dedupe_Index'];
  const crmSheetsPresent = crmSheetNames.filter(name => existingSheetNames.includes(name));
  const crmSheetsMissing = crmSheetNames.length - crmSheetsPresent.length;

  if (crmSheetsMissing > 0) {
    growthWarnings.push(`${crmSheetsMissing} CRM sheets missing`);
  }

  // Lead Counters
  let leadsTotal = 0;
  let leadsNew = 0;
  let leadsScored = 0;
  let leadsAssigned = 0;
  let leadsEnriched = 0;

  try {
    // Read CRM_Leads data
    const leadsResponse = await client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'CRM_Leads!A:ZZ',
    });

    const leadsRows = leadsResponse.data.values || [];
    if (leadsRows.length > 1) {
      const headers = leadsRows[0];
      const dataRows = leadsRows.slice(1);
      leadsTotal = dataRows.length;

      const statusIndex = headers.indexOf('Status');
      const scoreIndex = headers.indexOf('Score');
      const ownerIndex = headers.indexOf('Owner');
      const categoryNormIndex = headers.indexOf('CategoryNorm');
      const createdIndex = headers.indexOf('Created');

      // Calculate today's timestamp start
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.toISOString();

      for (const row of dataRows) {
        // Count NEW status
        if (statusIndex !== -1 && row[statusIndex] === 'NEW') {
          leadsNew++;
        }

        // Count scored (Score > 0)
        if (scoreIndex !== -1) {
          const score = parseInt(row[scoreIndex], 10);
          if (!isNaN(score) && score > 0) {
            leadsScored++;
          }
        }

        // Count assigned (Owner not empty)
        if (ownerIndex !== -1 && row[ownerIndex] && String(row[ownerIndex]).trim()) {
          leadsAssigned++;
        }

        // Count enriched (CategoryNorm not empty)
        if (categoryNormIndex !== -1 && row[categoryNormIndex] && String(row[categoryNormIndex]).trim()) {
          leadsEnriched++;
        }
      }
    }
  } catch (error: any) {
    growthWarnings.push(`Failed to read CRM_Leads: ${error.message}`);
  }

  // 5. Overall Readiness
  const ready = issues.length === 0;

  return {
    spreadsheetId: SPREADSHEET_ID,
    settings: {
      total: settingsTotal,
      ok: settingsOk,
      missing: settingsMissing,
      secret: settingsSecret,
      warning: settingsWarning,
      details: config.settingsStatus,
    },
    sheets: {
      total: REQUIRED_SHEETS.length,
      present: sheetsPresent,
      missing: sheetsMissing,
      details: sheetsDetails,
    },
    products: {
      total: productTotal,
      withCOGS: productWithCOGS,
      cogsNumericPercent: productWithCOGS > 0 ? Math.round((cogsNumericCount / productWithCOGS) * 100) : 0,
      withMAP: productWithMAP,
      withAutoPriceFlag: productWithAutoPriceFlag,
      errors: productErrors,
    },
    growth: {
      apiKey: {
        present: apiKeyPresent,
        source: apiKeySource,
        warning: apiKeyWarning,
      },
      endpoints: growthEndpoints,
      crmSheets: {
        total: crmSheetNames.length,
        present: crmSheetsPresent.length,
        missing: crmSheetsMissing,
        names: crmSheetNames,
      },
      counters: {
        leadsTotal,
        leadsNew,
        leadsScored,
        leadsAssigned,
        leadsEnriched,
      },
      warnings: growthWarnings,
    },
    ready,
    issues,
  };
}

export async function generateSheetsStructureData(): Promise<SheetsStructureData> {
  const sheetsService = new GoogleSheetsService();
  const client = await sheetsService['getClient']();
  
  const metadata = await client.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
  });
  
  const existingSheetNames = metadata.data.sheets?.map(s => s.properties?.title || '') || [];
  const existingSheets = REQUIRED_SHEETS.filter(s => existingSheetNames.includes(s.name));
  
  const sheetsData: SheetsStructureData['sheets'] = [];

  // Batch process sheets in chunks of 10 to avoid quota limits
  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 2000; // 2 seconds between batches

  for (let i = 0; i < existingSheets.length; i += BATCH_SIZE) {
    const batch = existingSheets.slice(i, i + BATCH_SIZE);
    
    // Add delay between batches (except first batch)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }

    // Use batchGet for efficient retrieval
    const ranges = batch.map(s => `${s.name}!A:ZZ`);
    
    try {
      const batchResponse = await client.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_ID,
        ranges,
      });

      const valueRanges = batchResponse.data.valueRanges || [];

      for (let j = 0; j < batch.length; j++) {
        const sheetDef = batch[j];
        const valueRange = valueRanges[j];
        const rows = valueRange?.values || [];
        const headers = rows[0] || [];
        const dataRows = rows.slice(1);
        const sampleRows = dataRows.slice(0, 3);
        const totalRows = dataRows.length;

        // Check for numeric column warnings (RAW VALUES from sheet)
        const numericColumnWarnings: string[] = [];
        if (sheetDef.numericColumns && dataRows.length > 0) {
          for (const colName of sheetDef.numericColumns) {
            const colIndex = headers.indexOf(colName);
            if (colIndex === -1) continue;

            let numericCount = 0;
            let nonNumericCount = 0;
            const nonNumericSamples: string[] = [];

            for (const row of dataRows) {
              const value = row[colIndex];
              if (value === undefined || value === null || value === '') continue;

              const stringValue = String(value).trim();
              // Check if value is purely numeric (no € symbols or commas)
              if (/^-?\d+\.?\d*$/.test(stringValue)) {
                numericCount++;
              } else {
                nonNumericCount++;
                if (nonNumericSamples.length < 3) {
                  nonNumericSamples.push(stringValue);
                }
              }
            }

            if (nonNumericCount > 0) {
              numericColumnWarnings.push(
                `Column "${colName}": ${nonNumericCount} non-numeric values found (e.g., ${nonNumericSamples.join(', ')})`
              );
            }
          }
        }

        sheetsData.push({
          name: sheetDef.name,
          headers,
          sampleRows,
          numericColumnWarnings,
          totalRows,
        });
      }

    } catch (error: any) {
      // If batch fails, add error for all sheets in batch
      for (const sheetDef of batch) {
        sheetsData.push({
          name: sheetDef.name,
          headers: [],
          sampleRows: [],
          numericColumnWarnings: [`Failed to read sheet: ${error.message}`],
          totalRows: 0,
        });
      }
    }
  }

  return { sheets: sheetsData };
}

export async function writeReadinessReport(data: ReadinessData): Promise<void> {
  const lines: string[] = [];

  lines.push('# MH Trading OS - Readiness Report');
  lines.push('');
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 1: Source of Truth
  lines.push('## 📊 Source of Truth');
  lines.push('');
  lines.push(`**Spreadsheet ID**: \`${data.spreadsheetId}\``);
  lines.push('');
  lines.push(`**Google Sheet URL**: [Open Spreadsheet](https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit)`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Section 2: Settings Status
  lines.push('## ⚙️ Settings Status');
  lines.push('');
  lines.push(`- **Total Settings**: ${data.settings.total}`);
  lines.push(`- **OK**: ${data.settings.ok} ✅`);
  lines.push(`- **Missing**: ${data.settings.missing} ${data.settings.missing > 0 ? '❌' : '✅'}`);
  lines.push(`- **Secret (from Replit)**: ${data.settings.secret} 🔐`);
  lines.push(`- **Warnings**: ${data.settings.warning} ${data.settings.warning > 0 ? '⚠️' : '✅'}`);
  lines.push('');

  if (data.settings.details.length > 0) {
    lines.push('### Settings Details');
    lines.push('');
    lines.push('| Key | Status | Source | Note |');
    lines.push('|-----|--------|--------|------|');
    for (const setting of data.settings.details) {
      const statusIcon = setting.status === 'ok' ? '✅' : 
                        setting.status === 'missing' ? '❌' : 
                        setting.status === 'secret' ? '🔐' : '⚠️';
      const note = setting.warning || '-';
      lines.push(`| ${setting.key} | ${statusIcon} ${setting.status} | ${setting.source} | ${note} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Section 3: Sheets Status
  lines.push('## 📑 Sheets Status');
  lines.push('');
  lines.push(`- **Total Required**: ${data.sheets.total}`);
  lines.push(`- **Present**: ${data.sheets.present} ${data.sheets.present === data.sheets.total ? '✅' : '⚠️'}`);
  lines.push(`- **Missing**: ${data.sheets.missing} ${data.sheets.missing > 0 ? '❌' : '✅'}`);
  lines.push('');

  if (data.sheets.details.length > 0) {
    lines.push('### Sheets Details');
    lines.push('');
    lines.push('| Sheet Name | Status | Columns |');
    lines.push('|------------|--------|---------|');
    for (const sheet of data.sheets.details) {
      const statusIcon = sheet.status === 'present' ? '✅' : '❌';
      const columns = sheet.headers ? sheet.headers.length : 0;
      lines.push(`| ${sheet.name} | ${statusIcon} ${sheet.status} | ${columns} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Section 4: Critical Metrics (Products)
  lines.push('## 🎯 Critical Metrics (FinalPriceList)');
  lines.push('');
  lines.push(`- **Total Products**: ${data.products.total}`);
  lines.push(`- **Products with COGS_EUR**: ${data.products.withCOGS} (${data.products.total > 0 ? Math.round((data.products.withCOGS / data.products.total) * 100) : 0}%)`);
  lines.push(`- **COGS_EUR Numeric Validation**: ${data.products.cogsNumericPercent}% ${data.products.cogsNumericPercent === 100 ? '✅' : '❌'}`);
  lines.push(`- **Products with MAP**: ${data.products.withMAP} (${data.products.total > 0 ? Math.round((data.products.withMAP / data.products.total) * 100) : 0}%)`);
  lines.push(`- **Products with AutoPriceFlag**: ${data.products.withAutoPriceFlag}`);
  lines.push('');

  if (data.products.errors.length > 0) {
    lines.push('### Product Errors');
    lines.push('');
    for (const error of data.products.errors.slice(0, 10)) {
      lines.push(`- ⚠️ ${error}`);
    }
    if (data.products.errors.length > 10) {
      lines.push(`- ... and ${data.products.errors.length - 10} more errors`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Section 5: Growth Engine
  lines.push('## 🌱 Growth Engine (CRM)');
  lines.push('');
  
  // API Key Status
  lines.push('### API Keys');
  lines.push('');
  const apiKeyIcon = data.growth.apiKey.present ? '✅' : '⚠️';
  const apiKeyStatus = data.growth.apiKey.present ? 'configured' : 'missing (dry-run mode)';
  lines.push(`- **API_PLACES_KEY**: ${apiKeyIcon} ${apiKeyStatus}`);
  if (data.growth.apiKey.warning) {
    lines.push(`  - ⚠️ ${data.growth.apiKey.warning}`);
  }
  lines.push('');

  // Endpoints
  lines.push('### Endpoints');
  lines.push('');
  lines.push('| Endpoint | Purpose |');
  lines.push('|----------|---------|');
  lines.push('| POST /api/growth/places/search | Harvest leads from Google Places |');
  lines.push('| GET /api/growth/places/normalize | Normalize phone/email data |');
  lines.push('| POST /api/growth/score | Score leads (0-30 points) |');
  lines.push('| GET /api/growth/assign | Assign leads to territories |');
  lines.push('| POST /api/growth/enrich/queue | Queue leads for AI enrichment |');
  lines.push('| POST /api/growth/enrich/run | Process enrichment queue |');
  lines.push('| GET /api/growth/export | Export leads as CSV |');
  lines.push('');

  // CRM Sheets
  lines.push('### CRM Worksheets');
  lines.push('');
  lines.push(`- **Total Required**: ${data.growth.crmSheets.total}`);
  lines.push(`- **Present**: ${data.growth.crmSheets.present} ${data.growth.crmSheets.present === data.growth.crmSheets.total ? '✅' : '⚠️'}`);
  lines.push(`- **Missing**: ${data.growth.crmSheets.missing} ${data.growth.crmSheets.missing > 0 ? '❌' : '✅'}`);
  lines.push('');
  lines.push('**Sheets**: ' + data.growth.crmSheets.names.join(', '));
  lines.push('');

  // Counters
  lines.push('### Lead Counters');
  lines.push('');
  lines.push(`- **Total Leads**: ${data.growth.counters.leadsTotal}`);
  lines.push(`- **New Leads (Status=NEW)**: ${data.growth.counters.leadsNew}`);
  lines.push(`- **Scored Leads (Score>0)**: ${data.growth.counters.leadsScored}`);
  lines.push(`- **Assigned Leads (Owner set)**: ${data.growth.counters.leadsAssigned}`);
  lines.push(`- **Enriched Leads (CategoryNorm set)**: ${data.growth.counters.leadsEnriched}`);
  lines.push('');

  // Warnings
  if (data.growth.warnings.length > 0) {
    lines.push('### Warnings');
    lines.push('');
    for (const warning of data.growth.warnings) {
      lines.push(`- ⚠️ ${warning}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  // Section 6: Overall Readiness
  lines.push('## ✅ Overall Readiness');
  lines.push('');
  if (data.ready) {
    lines.push('**Status**: ✅ READY');
    lines.push('');
    lines.push('All systems are operational. No critical issues detected.');
  } else {
    lines.push('**Status**: ⚠️ NOT READY');
    lines.push('');
    lines.push('### Issues Detected:');
    lines.push('');
    for (const issue of data.issues) {
      lines.push(`- ❌ ${issue}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('**Next Steps**:');
  lines.push('1. Review any warnings or missing settings');
  lines.push('2. Run `POST /admin/ensure-sheets` to fix missing sheets/columns');
  lines.push('3. Verify COGS_EUR and MAP values in FinalPriceList');
  lines.push('4. Check SHEETS_STRUCTURE_REPORT.md for detailed sheet structure');
  lines.push('');
  lines.push('**Note**: This endpoint may take several seconds. It is intended for operators and generates fresh reports on each request.');

  const reportPath = path.join(process.cwd(), 'READINESS_REPORT.md');
  await fs.writeFile(reportPath, lines.join('\n'), 'utf-8');
}

export async function writeSheetsStructureReport(data: SheetsStructureData): Promise<void> {
  const lines: string[] = [];

  lines.push('# MH Trading OS - Sheets Structure Report');
  lines.push('');
  lines.push(`**Generated**: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('This report shows the current structure of all Google Sheets worksheets, including headers, sample data, and validation warnings.');
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const sheet of data.sheets) {
    lines.push(`## 📄 ${sheet.name}`);
    lines.push('');
    lines.push(`**Total Rows**: ${sheet.totalRows}`);
    lines.push('');

    // Headers
    lines.push('### Headers');
    lines.push('');
    if (sheet.headers.length > 0) {
      lines.push('```');
      lines.push(sheet.headers.join(' | '));
      lines.push('```');
    } else {
      lines.push('*No headers found*');
    }
    lines.push('');

    // Sample Rows
    if (sheet.sampleRows.length > 0) {
      lines.push('### Sample Data (First 3 Rows)');
      lines.push('');
      lines.push('| ' + sheet.headers.join(' | ') + ' |');
      lines.push('|' + sheet.headers.map(() => '---').join('|') + '|');
      for (const row of sheet.sampleRows) {
        const cells = sheet.headers.map((_, idx) => {
          const val = row[idx];
          if (val === undefined || val === null || val === '') return '-';
          const strVal = String(val);
          // Truncate long values
          return strVal.length > 30 ? strVal.slice(0, 27) + '...' : strVal;
        });
        lines.push('| ' + cells.join(' | ') + ' |');
      }
      lines.push('');
    }

    // Numeric Column Warnings
    if (sheet.numericColumnWarnings.length > 0) {
      lines.push('### ⚠️ Validation Warnings');
      lines.push('');
      for (const warning of sheet.numericColumnWarnings) {
        lines.push(`- ${warning}`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  lines.push('## 📝 Summary');
  lines.push('');
  lines.push(`- **Total Sheets Analyzed**: ${data.sheets.length}`);
  lines.push(`- **Sheets with Warnings**: ${data.sheets.filter(s => s.numericColumnWarnings.length > 0).length}`);
  lines.push('');
  lines.push('**Recommendation**: Address all validation warnings to ensure data integrity.');

  const reportPath = path.join(process.cwd(), 'SHEETS_STRUCTURE_REPORT.md');
  await fs.writeFile(reportPath, lines.join('\n'), 'utf-8');
}
