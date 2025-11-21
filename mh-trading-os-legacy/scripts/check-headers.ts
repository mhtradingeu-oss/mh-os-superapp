/**
 * Check headers in AffiliateProfiles sheet
 */

import { GoogleSheetsService } from '../lib/sheets.js';

const sheetsService = new GoogleSheetsService();

(async () => {
  const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID!;
  const sheets = await (sheetsService as any).getClient();
  
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'AffiliateProfiles!1:1',
  });

  const headers = headerResponse.data.values?.[0] || [];
  console.log('Current headers in AffiliateProfiles:');
  console.log(headers.join(', '));
  console.log(`\nTotal: ${headers.length} columns`);
  
  console.log('\n Expected headers (from schema):');
  const expected = ['AffiliateID', 'Name', 'Email', 'ReferralCode', 'Country', 'Tier', 'Status', 'JoinedDate', 'LastActive', 'Website', 'SocialMedia', 'Niche', 'TotalClicks', 'TotalConversions', 'TotalRevenue', 'TotalCommission', 'ConversionRate', 'EarningsPerClick', 'Score', 'CommissionPct'];
  console.log(expected.join(', '));
  console.log(`\nTotal: ${expected.length} columns`);
  
  const missing = expected.filter(h => !headers.includes(h));
  if (missing.length > 0) {
    console.log('\n❌ Missing headers:', missing.join(', '));
  } else {
    console.log('\n✅ All headers present!');
  }
  
  process.exit(0);
})();
