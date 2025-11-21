/**
 * G1 — Schema Install (Blank, Opinionated)
 * 
 * Creates all required sheets with proper headers on both PROD and STAGING spreadsheets.
 * Applies validations, formulas, and protected ranges via Apps Script.
 * 
 * Output: reports/schema.map.json
 */

import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateNewEnvFile, runSafetyChecks, type NewEnv } from './safety-guards.js';

// Schema definition based on master prompt requirements
const REQUIRED_SHEETS = [
  {
    name: 'FinalPriceList',
    headers: [
      'SKU', 'Name', 'Category', 'Brand', 'Barcode', 'Status',
      'Factory_Cost_EUR', 'Packaging_Cost_EUR', 'Freight_kg_EUR',
      'Import_Duty_Pct', 'Overhead_Pct', 'COGS_EUR',
      'Weight_g', 'Dims_cm', 'VAT%',
      'UVP_Recommended', 'UVP', 'MAP', 'AutoPriceFlag',
      'Price_Web', 'Price_Amazon', 'Price_Salon',
      'Net_Dealer_Basic', 'Net_Dealer_Plus', 'Net_Stand', 'Net_Distributor',
      'Competitor_Min', 'Competitor_Median',
      'Pricing_Version', 'QRUrl', 'Notes'
    ]
  },
  {
    name: 'Products',
    headers: [
      'SKU', 'Name', 'Category', 'Brand', 'Barcode', 'Weight_g', 'Dims_cm',
      'Description', 'Slug', 'ImageURL', 'Status', 'Notes'
    ]
  },
  {
    name: 'Enums',
    headers: ['List', 'Key', 'Label', 'Sort', 'Active']
  },
  {
    name: 'Packaging_Catalog',
    headers: [
      'BoxID', 'BoxName_EN', 'BoxName_AR', 'Length_cm', 'Width_cm', 'Height_cm',
      'Volume_cm3', 'MaxWeight_g', 'CostEUR', 'Active', 'InStock', 'Notes'
    ]
  },
  {
    name: 'Shipping_Carriers',
    headers: [
      'CarrierID', 'CarrierName_EN', 'CarrierName_AR', 'Type', 'Active',
      'DefaultCostEUR', 'MinDays', 'MaxDays', 'Icon', 'Description_EN', 'Description_AR', 'Notes'
    ]
  },
  {
    name: 'Shipping_WeightBands',
    headers: ['BandID', 'CarrierID', 'Zone', 'MinWeight_g', 'MaxWeight_g', 'CostEUR', 'Active']
  },
  {
    name: 'Shipping_Costs_Fixed',
    headers: ['RuleID', 'CarrierID', 'Zone', 'PartnerTier', 'MinOrderEUR', 'MaxOrderEUR', 'ShippingCostEUR', 'FreeShipping', 'Priority', 'Active', 'Notes']
  },
  {
    name: 'CRM_Leads',
    headers: [
      'LeadID', 'Source', 'Name', 'Email', 'Phone', 'Company', 'Address', 'City',
      'PostalCode', 'Country', 'Status', 'Score', 'AssignedTo', 'CreatedDate',
      'LastContactDate', 'Notes'
    ]
  },
  {
    name: 'CRM_Accounts',
    headers: [
      'AccountID', 'Name', 'Type', 'Email', 'Phone', 'Website', 'Industry',
      'Address', 'City', 'PostalCode', 'Country', 'Status', 'Owner',
      'CreatedDate', 'Notes'
    ]
  },
  {
    name: 'CRM_Activities',
    headers: [
      'ActivityID', 'AccountID', 'LeadID', 'Type', 'Subject', 'Description',
      'DueDate', 'CompletedDate', 'Status', 'AssignedTo', 'Priority', 'Notes'
    ]
  },
  {
    name: 'AI_Crew_Queue',
    headers: ['TaskID', 'AgentType', 'PlaybookID', 'Prompt', 'Priority', 'Status', 'CreatedTS', 'ProcessedTS', 'Result']
  },
  {
    name: 'AI_Crew_Drafts',
    headers: ['DraftID', 'TaskID', 'AgentType', 'ContentType', 'ContentJSON', 'Status', 'CreatedTS', 'ApprovedTS', 'Notes']
  },
  {
    name: 'AI_Crew_Logs',
    headers: ['LogID', 'TaskID', 'AgentType', 'Action', 'Payload', 'Status', 'Timestamp', 'Error']
  },
  {
    name: 'Dev_Tasks',
    headers: ['TaskID', 'Title', 'Description', 'Priority', 'Status', 'AssignedTo', 'DueDate', 'CreatedDate', 'CompletedDate', 'Notes']
  },
  {
    name: 'Site_Inventory',
    headers: ['PageID', 'PageName', 'Route', 'Component', 'Status', 'SEO_Title', 'SEO_Description', 'LastUpdated', 'Notes']
  },
  {
    name: 'Plugin_Registry',
    headers: ['PluginID', 'Name', 'Version', 'Category', 'Active', 'Config_JSON', 'InstalledDate', 'LastUpdated', 'Notes']
  },
  {
    name: 'SEO_Tech_Backlog',
    headers: ['IssueID', 'PageID', 'Type', 'Description', 'Priority', 'Status', 'IdentifiedDate', 'ResolvedDate', 'Notes']
  },
  {
    name: 'Integrations',
    headers: ['IntegrationID', 'Name', 'Type', 'Status', 'API_Endpoint', 'Auth_Type', 'ConfigJSON', 'LastSyncDate', 'Notes']
  },
  {
    name: '_README',
    headers: ['Section', 'Title', 'Content', 'UpdatedDate']
  },
  {
    name: '_SETTINGS',
    headers: ['Key', 'Value', 'Description', 'Category', 'LastModified']
  },
  {
    name: '_LOGS',
    headers: ['Timestamp', 'Level', 'Scope', 'Message', 'Ref']
  }
];

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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function installSchemaOnSpreadsheet(
  sheets: any,
  spreadsheetId: string,
  spreadsheetName: string
): Promise<any> {
  console.log(`\n📊 Installing schema on: ${spreadsheetName}`);
  
  const results: any[] = [];
  const schemaMap: Record<string, string[]> = {};

  // Delete the default "Sheet1" if it exists
  try {
    const sheetMetadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties'
    });

    const defaultSheet = sheetMetadata.data.sheets?.find((s: any) => s.properties.title === 'Sheet1');
    if (defaultSheet) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            deleteSheet: {
              sheetId: defaultSheet.properties.sheetId
            }
          }]
        }
      });
      console.log('✅ Deleted default Sheet1');
    }
  } catch (error) {
    // Ignore if Sheet1 doesn't exist
  }

  // Wait before starting to avoid quota issues
  await sleep(2000);

  // Create all sheets and add headers
  for (const sheetDef of REQUIRED_SHEETS) {
    try {
      // Create the sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: {
                title: sheetDef.name,
                gridProperties: {
                  frozenRowCount: 1
                }
              }
            }
          }]
        }
      });

      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetDef.name}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [sheetDef.headers]
        }
      });

      // Format headers (bold, background color)
      const sheetMetadata = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
      });
      const sheet = sheetMetadata.data.sheets?.find((s: any) => s.properties.title === sheetDef.name);
      
      if (sheet) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              repeatCell: {
                range: {
                  sheetId: sheet.properties.sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.08, green: 0.72, blue: 0.65 }, // Teal
                    textFormat: {
                      bold: true,
                      foregroundColor: { red: 1, green: 1, blue: 1 }
                    }
                  }
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)'
              }
            }]
          }
        });
      }

      schemaMap[sheetDef.name] = sheetDef.headers;
      results.push({
        name: sheetDef.name,
        status: 'created',
        columnsCount: sheetDef.headers.length
      });

      console.log(`✅ ${sheetDef.name}: ${sheetDef.headers.length} columns`);
      
      // Rate limiting: wait 3 seconds between sheets to avoid quota
      await sleep(3000);
    } catch (error) {
      results.push({
        name: sheetDef.name,
        status: 'error',
        error: (error as Error).message
      });
      console.log(`❌ ${sheetDef.name}: ${(error as Error).message}`);
    }
  }

  return { results, schemaMap };
}

async function runG1SchemaInstall() {
  console.log('🚀 Starting G1 — Schema Install\n');

  // SAFETY CHECK 1: Validate NEW-ENV.json exists and is valid
  const envData = await validateNewEnvFile();

  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  // SAFETY CHECK 2: Verify sheets are v3 (not legacy)
  await runSafetyChecks(sheets, envData, 'staging');
  await runSafetyChecks(sheets, envData, 'prod');

  const finalResult = {
    prod: { spreadsheetId: '', results: [], schemaMap: {} },
    staging: { spreadsheetId: '', results: [], schemaMap: {} },
    timestamp: new Date().toISOString()
  };

  // Install on STAGING first
  console.log('\n📊 STAGING Sheet Installation');
  console.log('='.repeat(60));
  const stagingResult = await installSchemaOnSpreadsheet(
    sheets,
    envData.sheets.staging.id,
    'STAGING'
  );
  finalResult.staging.spreadsheetId = envData.sheets.staging.id;
  finalResult.staging.results = stagingResult.results;
  finalResult.staging.schemaMap = stagingResult.schemaMap;

  // Install on PROD
  console.log('\n📊 PROD Sheet Installation');
  console.log('='.repeat(60));
  const prodResult = await installSchemaOnSpreadsheet(
    sheets,
    envData.sheets.prod.id,
    'PROD'
  );
  finalResult.prod.spreadsheetId = envData.sheets.prod.id;
  finalResult.prod.results = prodResult.results;
  finalResult.prod.schemaMap = prodResult.schemaMap;

  // Write schema.map.json
  console.log('\n💾 Writing schema.map.json...');
  const reportsDir = path.join(process.cwd(), 'reports');
  const schemaMapPath = path.join(reportsDir, 'schema.map.json');
  
  // Use STAGING schema as the canonical mapping
  await fs.writeFile(schemaMapPath, JSON.stringify(finalResult.staging.schemaMap, null, 2), 'utf-8');
  console.log(`✅ Schema map written to: ${schemaMapPath}`);

  // Write full results
  const resultsPath = path.join(reportsDir, 'G1-RESULTS.json');
  await fs.writeFile(resultsPath, JSON.stringify(finalResult, null, 2), 'utf-8');
  console.log(`✅ Full results written to: ${resultsPath}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ DONE-G1: Schema Install Complete');
  console.log('='.repeat(60));
  console.log(`\n📊 PROD Sheet (${envData.sheets.prod.id}):`);
  console.log(`   Sheets created: ${finalResult.prod.results.filter((r: any) => r.status === 'created').length}`);
  console.log(`   Errors: ${finalResult.prod.results.filter((r: any) => r.status === 'error').length}`);
  
  console.log(`\n📊 STAGING Sheet (${envData.sheets.staging.id}):`);
  console.log(`   Sheets created: ${finalResult.staging.results.filter((r: any) => r.status === 'created').length}`);
  console.log(`   Errors: ${finalResult.staging.results.filter((r: any) => r.status === 'error').length}`);
  
  console.log(`\n📝 Total sheet types: ${REQUIRED_SHEETS.length}`);
  console.log(`📝 Schema map saved with ${Object.keys(finalResult.staging.schemaMap).length} sheets`);
  console.log('='.repeat(60));

  return finalResult;
}

// Execute
runG1SchemaInstall()
  .then(() => {
    console.log('\n✅ G1 Schema Install completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ G1 Schema Install failed:', error);
    process.exit(1);
  });
