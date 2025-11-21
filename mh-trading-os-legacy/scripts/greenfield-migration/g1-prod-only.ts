/**
 * G1 — Schema Install (PROD Only)
 * 
 * Creates all required sheets with proper headers on PROD spreadsheet only.
 * This is a continuation script after quota limits.
 */

import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';

interface NewEnv {
  sheets: {
    prod: { id: string };
  };
}

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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function runProdInstall() {
  console.log('🚀 Starting G1 — PROD Schema Install\n');

  const envPath = path.join(process.cwd(), 'reports', 'NEW-ENV.json');
  const envData: NewEnv = JSON.parse(await fs.readFile(envPath, 'utf-8'));

  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  const spreadsheetId = envData.sheets.prod.id;
  console.log(`📊 PROD Sheet ID: ${spreadsheetId}\n`);

  const results: any[] = [];

  // Delete default Sheet1
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
      console.log('✅ Deleted default Sheet1\n');
    }
  } catch (error) {
    // Ignore
  }

  await sleep(2000);

  // Create sheets with rate limiting
  for (const sheetDef of REQUIRED_SHEETS) {
    try {
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

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetDef.name}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [sheetDef.headers]
        }
      });

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
                    backgroundColor: { red: 0.08, green: 0.72, blue: 0.65 },
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

      results.push({ name: sheetDef.name, status: 'created', columnsCount: sheetDef.headers.length });
      console.log(`✅ ${sheetDef.name}: ${sheetDef.headers.length} columns`);
      
      await sleep(3000);
    } catch (error) {
      results.push({ name: sheetDef.name, status: 'error', error: (error as Error).message });
      console.log(`❌ ${sheetDef.name}: ${(error as Error).message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ PROD Schema Install Complete');
  console.log('='.repeat(60));
  console.log(`Sheets created: ${results.filter(r => r.status === 'created').length}`);
  console.log(`Errors: ${results.filter(r => r.status === 'error').length}`);
  console.log('='.repeat(60));
}

runProdInstall()
  .then(() => {
    console.log('\n✅ Complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });
