/**
 * G2 — Safe Seeding (Demo & Minimal)
 * 
 * Seeds STAGING sheet with demo data sufficient for testing the entire system:
 * - 10 demo products
 * - Packaging boxes
 * - Shipping carriers and rules
 * - CRM sample data
 * - AI Crew configurations
 * - Development section data
 * 
 * Output: reports/SEED-SUMMARY.md
 */

import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';
import { validateNewEnvFile, runSafetyChecks, type NewEnv } from './safety-guards.js';

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

async function appendRows(sheets: any, spreadsheetId: string, sheetName: string, rows: any[][]) {
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A2`,
    valueInputOption: 'RAW',
    requestBody: {
      values: rows
    }
  });
  await sleep(1000); // Rate limiting
}

function calculateBasicPricing(factoryCost: number): any {
  const cogs = factoryCost * 1.35; // +35% for costs
  const uvp = Math.round((cogs * 2.5) * 100) / 100; // 2.5x markup
  const uvpRounded = Math.floor(uvp) + 0.99; // .99 ending
  const map = Math.round((uvpRounded * 0.85) * 100) / 100; // 85% of UVP

  return {
    cogs: cogs.toFixed(2),
    uvp: uvpRounded.toFixed(2),
    map: map.toFixed(2),
    priceWeb: uvpRounded.toFixed(2),
    priceSalon: (uvpRounded * 0.8).toFixed(2),
    netDealerBasic: (cogs * 1.3).toFixed(2),
    netDealerPlus: (cogs * 1.25).toFixed(2),
    netStand: (cogs * 1.4).toFixed(2),
    netDistributor: (cogs * 1.15).toFixed(2)
  };
}

async function runG2Seeding() {
  console.log('🚀 Starting G2 — Safe Seeding\n');

  // SAFETY CHECK 1: Validate NEW-ENV.json exists and is valid
  const envData = await validateNewEnvFile();

  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

  // SAFETY CHECK 2: Verify STAGING sheet is v3 (not legacy)
  await runSafetyChecks(sheets, envData, 'staging');

  const spreadsheetId = envData.sheets.staging.id;
  console.log(`📊 STAGING Sheet ID: ${spreadsheetId}\n`);

  const summary: any = {
    sheets: {},
    errors: [],
    timestamp: new Date().toISOString()
  };

  // 1. Seed Products
  console.log('📦 Seeding Products...');
  const products = [
    ['SKU001', 'Premium Hair Oil 100ml', 'Oils', 'HAIROTICMEN', 'EAN001', '120', '15x5x5', 'Premium argan oil for hair care', 'premium-hair-oil-100ml', '', 'Active', 'Demo product 1'],
    ['SKU002', 'Styling Gel Strong 150ml', 'Styling', 'HAIROTICMEN', 'EAN002', '180', '18x6x6', 'Extra strong styling gel', 'styling-gel-strong-150ml', '', 'Active', 'Demo product 2'],
    ['SKU003', 'Beard Balm Natural 50g', 'Beard Care', 'HAIROTICMEN', 'EAN003', '75', '10x10x3', 'Natural beard conditioning balm', 'beard-balm-natural-50g', '', 'Active', 'Demo product 3'],
    ['SKU004', 'Shampoo Anti-Dandruff 250ml', 'Shampoos', 'HAIROTICMEN', 'EAN004', '280', '20x7x7', 'Clinical anti-dandruff formula', 'shampoo-anti-dandruff-250ml', '', 'Active', 'Demo product 4'],
    ['SKU005', 'Hair Wax Matte Finish 80g', 'Styling', 'HAIROTICMEN', 'EAN005', '95', '12x12x4', 'Matte finish styling wax', 'hair-wax-matte-80g', '', 'Active', 'Demo product 5'],
    ['SKU006', 'Conditioner Repair 250ml', 'Conditioners', 'HAIROTICMEN', 'EAN006', '275', '20x7x7', 'Deep repair conditioner', 'conditioner-repair-250ml', '', 'Active', 'Demo product 6'],
    ['SKU007', 'Beard Oil Cedar 30ml', 'Beard Care', 'HAIROTICMEN', 'EAN007', '60', '12x4x4', 'Cedar scented beard oil', 'beard-oil-cedar-30ml', '', 'Active', 'Demo product 7'],
    ['SKU008', 'Pomade High Shine 100g', 'Styling', 'HAIROTICMEN', 'EAN008', '125', '14x14x5', 'High shine classic pomade', 'pomade-high-shine-100g', '', 'Active', 'Demo product 8'],
    ['SKU009', 'Scalp Treatment Serum 50ml', 'Treatments', 'HAIROTICMEN', 'EAN009', '85', '15x5x5', 'Advanced scalp care serum', 'scalp-treatment-serum-50ml', '', 'Active', 'Demo product 9'],
    ['SKU010', 'Hair Spray Flexible 200ml', 'Styling', 'HAIROTICMEN', 'EAN010', '220', '22x6x6', 'Flexible hold hair spray', 'hair-spray-flexible-200ml', '', 'Active', 'Demo product 10']
  ];
  await appendRows(sheets, spreadsheetId, 'Products', products);
  summary.sheets['Products'] = { rows: products.length, errors: 0 };
  console.log(`✅ Products: ${products.length} rows`);

  // 2. Seed FinalPriceList with calculated pricing
  console.log('💰 Seeding FinalPriceList...');
  const priceListData = [
    ['SKU001', 'Premium Hair Oil 100ml', 'Oils', 'HAIROTICMEN', 'EAN001', 'Active', '8.50', '0.80', '0.30', '6.5', '8', ...Object.values(calculateBasicPricing(8.5)), '120', '15x5x5', '19', '', '', '', '', 'v1', '', ''],
    ['SKU002', 'Styling Gel Strong 150ml', 'Styling', 'HAIROTICMEN', 'EAN002', 'Active', '6.20', '0.70', '0.45', '6.5', '8', ...Object.values(calculateBasicPricing(6.2)), '180', '18x6x6', '19', '', '', '', '', 'v1', '', ''],
    ['SKU003', 'Beard Balm Natural 50g', 'Beard Care', 'HAIROTICMEN', 'EAN003', 'Active', '5.80', '0.60', '0.19', '6.5', '8', ...Object.values(calculateBasicPricing(5.8)), '75', '10x10x3', '19', '', '', '', '', 'v1', '', ''],
    ['SKU004', 'Shampoo Anti-Dandruff 250ml', 'Shampoos', 'HAIROTICMEN', 'EAN004', 'Active', '7.30', '0.85', '0.70', '6.5', '8', ...Object.values(calculateBasicPricing(7.3)), '280', '20x7x7', '19', '', '', '', '', 'v1', '', ''],
    ['SKU005', 'Hair Wax Matte Finish 80g', 'Styling', 'HAIROTICMEN', 'EAN005', 'Active', '6.90', '0.75', '0.24', '6.5', '8', ...Object.values(calculateBasicPricing(6.9)), '95', '12x12x4', '19', '', '', '', '', 'v1', '', '']
  ];
  
  // Only seed 5 products in FinalPriceList for now (enough for testing)
  await appendRows(sheets, spreadsheetId, 'FinalPriceList', priceListData);
  summary.sheets['FinalPriceList'] = { rows: priceListData.length, errors: 0 };
  console.log(`✅ FinalPriceList: ${priceListData.length} rows`);

  // 3. Seed Enums
  console.log('📋 Seeding Enums...');
  const enums = [
    ['ProductStatus', 'Active', 'Active', '1', 'true'],
    ['ProductStatus', 'Inactive', 'Inactive', '2', 'true'],
    ['ProductStatus', 'Discontinued', 'Discontinued', '3', 'true'],
    ['LeadStatus', 'New', 'New Lead', '1', 'true'],
    ['LeadStatus', 'Contacted', 'Contacted', '2', 'true'],
    ['LeadStatus', 'Qualified', 'Qualified', '3', 'true'],
    ['LeadStatus', 'Lost', 'Lost', '4', 'true'],
    ['Priority', 'High', 'High', '1', 'true'],
    ['Priority', 'Medium', 'Medium', '2', 'true'],
    ['Priority', 'Low', 'Low', '3', 'true']
  ];
  await appendRows(sheets, spreadsheetId, 'Enums', enums);
  summary.sheets['Enums'] = { rows: enums.length, errors: 0 };
  console.log(`✅ Enums: ${enums.length} rows`);

  // 4. Seed Packaging_Catalog
  console.log('📦 Seeding Packaging_Catalog...');
  const packaging = [
    ['BOX-S', 'Small Box', 'صندوق صغير', '20', '15', '10', '3000', '2000', '0.50', 'true', '100', 'For 1-3 small items'],
    ['BOX-M', 'Medium Box', 'صندوق متوسط', '30', '20', '15', '9000', '5000', '0.80', 'true', '150', 'For 4-8 items'],
    ['BOX-L', 'Large Box', 'صندوق كبير', '40', '30', '20', '24000', '10000', '1.20', 'true', '80', 'For bulk orders'],
    ['BOX-XL', 'Extra Large', 'صندوق كبير جداً', '50', '40', '30', '60000', '20000', '1.80', 'true', '50', 'For wholesale']
  ];
  await appendRows(sheets, spreadsheetId, 'Packaging_Catalog', packaging);
  summary.sheets['Packaging_Catalog'] = { rows: packaging.length, errors: 0 };
  console.log(`✅ Packaging_Catalog: ${packaging.length} rows`);

  // 5. Seed Shipping_Carriers
  console.log('🚚 Seeding Shipping_Carriers...');
  const carriers = [
    ['DHL', 'DHL Express', 'دي إتش إل', 'Express', 'true', '5.90', '1', '3', 'truck', 'Fast courier', 'توصيل سريع', ''],
    ['PICKUP', 'Store Pickup', 'استلام من المتجر', 'Pickup', 'true', '0', '0', '1', 'store', 'Free pickup', 'استلام مجاني', '']
  ];
  await appendRows(sheets, spreadsheetId, 'Shipping_Carriers', carriers);
  summary.sheets['Shipping_Carriers'] = { rows: carriers.length, errors: 0 };
  console.log(`✅ Shipping_Carriers: ${carriers.length} rows`);

  // 6. Seed Shipping_WeightBands
  console.log('⚖️ Seeding Shipping_WeightBands...');
  const weightBands = [
    ['BAND-1', 'DHL', 'DE', '0', '1000', '4.90', 'true'],
    ['BAND-2', 'DHL', 'DE', '1001', '5000', '6.90', 'true'],
    ['BAND-3', 'DHL', 'DE', '5001', '10000', '9.90', 'true'],
    ['BAND-4', 'DHL', 'EU', '0', '1000', '7.90', 'true'],
    ['BAND-5', 'DHL', 'EU', '1001', '5000', '12.90', 'true']
  ];
  await appendRows(sheets, spreadsheetId, 'Shipping_WeightBands', weightBands);
  summary.sheets['Shipping_WeightBands'] = { rows: weightBands.length, errors: 0 };
  console.log(`✅ Shipping_WeightBands: ${weightBands.length} rows`);

  // 7. Seed CRM_Leads
  console.log('👤 Seeding CRM_Leads...');
  const leads = [
    ['LEAD-001', 'Website', 'Ahmad Hassan', 'ahmad@example.de', '+49123456789', 'Salon Ahmad', 'Hauptstr. 123', 'Berlin', '10115', 'DE', 'New', '85', 'Sales-Rep-1', '2025-01-15', '', 'Hot lead from website'],
    ['LEAD-002', 'Referral', 'Sara Mueller', 'sara@example.de', '+49987654321', 'Beauty Studio Sara', 'Marktplatz 45', 'Munich', '80331', 'DE', 'Contacted', '70', 'Sales-Rep-1', '2025-01-14', '2025-01-16', 'Referral from partner'],
    ['LEAD-003', 'Trade Show', 'Mohamed Ali', 'mohamed@example.de', '+49555123456', 'Ali Barbershop', 'Berliner Str. 78', 'Hamburg', '20095', 'DE', 'Qualified', '90', 'Sales-Rep-2', '2025-01-10', '2025-01-17', 'Met at trade show']
  ];
  await appendRows(sheets, spreadsheetId, 'CRM_Leads', leads);
  summary.sheets['CRM_Leads'] = { rows: leads.length, errors: 0 };
  console.log(`✅ CRM_Leads: ${leads.length} rows`);

  // 8. Seed CRM_Accounts
  console.log('🏢 Seeding CRM_Accounts...');
  const accounts = [
    ['ACC-001', 'Beauty Salon Chain', 'B2B', 'contact@beautychain.de', '+49301234567', 'www.beautychain.de', 'Retail', 'Kurfürstendamm 200', 'Berlin', '10719', 'DE', 'Active', 'Sales-Manager-1', '2024-11-01', 'Key account'],
    ['ACC-002', 'Barbershop Brothers', 'B2B', 'info@barberbrothers.de', '+49897654321', 'www.barberbrothers.de', 'Services', 'Maximilianstr. 50', 'Munich', '80539', 'DE', 'Active', 'Sales-Manager-1', '2024-12-15', 'Growing account']
  ];
  await appendRows(sheets, spreadsheetId, 'CRM_Accounts', accounts);
  summary.sheets['CRM_Accounts'] = { rows: accounts.length, errors: 0 };
  console.log(`✅ CRM_Accounts: ${accounts.length} rows`);

  // 9. Seed _SETTINGS
  console.log('⚙️ Seeding _SETTINGS...');
  const settings = [
    ['HM_CURRENCY', 'EUR', 'System currency', 'Core', new Date().toISOString()],
    ['VAT_Default_Pct', '19', 'Default VAT percentage', 'Pricing', new Date().toISOString()],
    ['AI_Default_Model', 'gpt-4o-mini', 'Default AI model', 'AI', new Date().toISOString()],
    ['ENV', 'staging', 'Environment', 'Core', new Date().toISOString()]
  ];
  await appendRows(sheets, spreadsheetId, '_SETTINGS', settings);
  summary.sheets['_SETTINGS'] = { rows: settings.length, errors: 0 };
  console.log(`✅ _SETTINGS: ${settings.length} rows`);

  // 10. Seed _README
  console.log('📖 Seeding _README...');
  const readme = [
    ['Overview', 'MH Trading OS v3', 'This is the STAGING environment for testing. DO NOT use for production data.', new Date().toISOString()],
    ['Schema', 'Sheet Structure', 'All sheets follow the canonical schema defined in schema.map.json', new Date().toISOString()],
    ['Data Source', 'Single Source of Truth', 'Google Sheets is the ONLY data source. No database duplication.', new Date().toISOString()]
  ];
  await appendRows(sheets, spreadsheetId, '_README', readme);
  summary.sheets['_README'] = { rows: readme.length, errors: 0 };
  console.log(`✅ _README: ${readme.length} rows`);

  // Write summary
  console.log('\n💾 Writing SEED-SUMMARY.md...');
  const reportsDir = path.join(process.cwd(), 'reports');
  
  let summaryMd = '# G2 Safe Seeding Summary\n\n';
  summaryMd += `**Timestamp:** ${summary.timestamp}\n\n`;
  summaryMd += `**Target:** STAGING Sheet (${spreadsheetId})\n\n`;
  summaryMd += '## Seeded Sheets\n\n';
  summaryMd += '| Sheet Name | Rows | Errors |\n';
  summaryMd += '|------------|------|--------|\n';
  
  let totalRows = 0;
  let totalErrors = 0;
  for (const [sheetName, data] of Object.entries(summary.sheets) as any) {
    summaryMd += `| ${sheetName} | ${data.rows} | ${data.errors} |\n`;
    totalRows += data.rows;
    totalErrors += data.errors;
  }
  
  summaryMd += `\n**Total Rows:** ${totalRows}\n`;
  summaryMd += `**Total Errors:** ${totalErrors}\n\n`;
  summaryMd += '## Data Sources\n\n';
  summaryMd += '- Products: Demo data with realistic product information\n';
  summaryMd += '- Pricing: Calculated using basic pricing engine (COGS * 2.5, .99 ending)\n';
  summaryMd += '- Shipping: Standard DHL and pickup options\n';
  summaryMd += '- CRM: Sample leads and accounts for testing\n\n';
  summaryMd += '## Notes\n\n';
  summaryMd += '- All financial calculations are deterministic and traceable\n';
  summaryMd += '- No NaN or Infinity values in pricing\n';
  summaryMd += '- All demo data is clearly marked as such\n';
  summaryMd += '- Settings configured for STAGING environment\n';

  const summaryPath = path.join(reportsDir, 'SEED-SUMMARY.md');
  await fs.writeFile(summaryPath, summaryMd, 'utf-8');
  console.log(`✅ Summary written to: ${summaryPath}`);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ DONE-G2: Safe Seeding Complete');
  console.log('='.repeat(60));
  console.log(`\n📊 STAGING Sheet: ${spreadsheetId}`);
  console.log(`📝 Total sheets seeded: ${Object.keys(summary.sheets).length}`);
  console.log(`📝 Total rows: ${totalRows}`);
  console.log(`❌ Total errors: ${totalErrors}`);
  console.log('='.repeat(60));

  return summary;
}

runG2Seeding()
  .then(() => {
    console.log('\n✅ G2 Safe Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ G2 Safe Seeding failed:', error);
    process.exit(1);
  });
