/**
 * MH TRADING OS — Clean and Reseed Affiliates
 * -------------------------------------------
 * 1. Deletes all data rows (keeps headers)
 * 2. Writes fresh data with ALL 20 fields
 */

import { GoogleSheetsService, SPREADSHEET_ID } from '../lib/sheets.js';
import { retryWithBackoff } from '../lib/retry.js';

async function cleanAndReseed() {
  console.log('🧹 Cleaning and reseeding AffiliateProfiles...\n');
  
  const sheetsService = new GoogleSheetsService();
  const sheets = await sheetsService['getClient']();
  
  // Step 1: Clear ALL data except headers
  console.log('Step 1: Clearing old data (keeping headers)...');
  await retryWithBackoff(() =>
    sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: 'AffiliateProfiles!A2:Z1000',
    })
  );
  console.log('✅ Data cleared\n');
  
  // Step 2: Write fresh data
  console.log('Step 2: Writing fresh profiles with ALL 20 fields...');
  
  const profiles = [
    {
      AffiliateID: 'AFF-001',
      Name: 'John Barber',
      Email: 'john@barberexample.com',
      ReferralCode: 'JOHN2025',
      Country: 'DE',
      Tier: 'Gold',
      Status: 'active',
      JoinedDate: new Date().toISOString(),
      LastActive: new Date().toISOString(),
      Website: 'https://johnbarber.de',
      SocialMedia: '@johnbarber_official',
      Niche: 'Barber supplies',
      TotalClicks: 150,
      TotalConversions: 12,
      TotalRevenue: 2400,
      TotalCommission: 360,
      ConversionRate: 8,
      EarningsPerClick: 2.4,
      Score: 85,
      CommissionPct: 15
    },
    {
      AffiliateID: 'AFF-002',
      Name: 'Max Grooming',
      Email: 'max@groomingpro.com',
      ReferralCode: 'MAXG2025',
      Country: 'AT',
      Tier: 'Partner',
      Status: 'active',
      JoinedDate: new Date().toISOString(),
      LastActive: new Date().toISOString(),
      Website: 'https://maxgrooming.at',
      SocialMedia: '@maxgrooming',
      Niche: "Men's grooming",
      TotalClicks: 200,
      TotalConversions: 18,
      TotalRevenue: 3600,
      TotalCommission: 432,
      ConversionRate: 9,
      EarningsPerClick: 1.8,
      Score: 90,
      CommissionPct: 12
    },
    {
      AffiliateID: 'AFF-003',
      Name: 'BeardLife Blog',
      Email: 'team@beardlife.com',
      ReferralCode: 'BEARD2025',
      Country: 'US',
      Tier: 'Standard',
      Status: 'active',
      JoinedDate: new Date().toISOString(),
      LastActive: new Date().toISOString(),
      Website: 'https://beardlife.com',
      SocialMedia: '@beardlifeblog',
      Niche: 'Beard care',
      TotalClicks: 100,
      TotalConversions: 8,
      TotalRevenue: 1600,
      TotalCommission: 160,
      ConversionRate: 8,
      EarningsPerClick: 1.6,
      Score: 75,
      CommissionPct: 10
    }
  ];
  
  await sheetsService.writeRows('AffiliateProfiles', profiles);
  console.log(`✅ Written ${profiles.length} profiles\n`);
  
  // Step 3: Verification
  console.log('Step 3: Verification...');
  
  // Check raw data
  const rawResponse = await retryWithBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'AffiliateProfiles!A1:T5',
    })
  );
  
  const rows = rawResponse.data.values || [];
  const headers = rows[0] || [];
  const firstData = rows[1] || [];
  
  console.log(`   Headers: ${headers.length} columns`);
  console.log(`   First data row: ${firstData.length} values`);
  
  if (firstData.length === 20) {
    console.log('\n✅ SUCCESS: All 20 fields written correctly!');
    console.log('\nSample data:');
    console.log(`   AffiliateID: ${firstData[0]}`);
    console.log(`   Name: ${firstData[1]}`);
    console.log(`   ReferralCode: ${firstData[3]}`);
    console.log(`   Website: ${firstData[9]}`);
    console.log(`   CommissionPct: ${firstData[19]}`);
  } else {
    console.log(`\n⚠️  WARNING: Expected 20 values, got ${firstData.length}`);
    console.log('First data row:', firstData);
  }
}

cleanAndReseed().catch(console.error);
