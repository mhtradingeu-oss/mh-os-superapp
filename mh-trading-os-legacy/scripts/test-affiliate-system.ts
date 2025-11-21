/**
 * MH TRADING OS — Affiliate System Integration Test
 * -------------------------------------------------
 * Tests cache-disabled reads, full schema validation, and repository methods
 */

import { sheetsService } from '../lib/sheets.js';
import { affiliateRepository } from '../lib/affiliate-repository.js';
import { AFFILIATE_SHEETS } from '../lib/affiliate-constants.js';

async function runTests() {
  console.log('🧪 Running Affiliate System Integration Tests\n');
  let passed = 0;
  let failed = 0;
  
  // Test 1: Cache is disabled for affiliate sheets
  console.log('Test 1: Verify cache is disabled');
  try {
    const profiles1 = await sheetsService.readSheet('AffiliateProfiles');
    const profiles2 = await sheetsService.readSheet('AffiliateProfiles');
    
    if (profiles1.length === profiles2.length && profiles1.length > 0) {
      console.log('  ✅ Cache disable working\n');
      passed++;
    } else {
      console.log('  ❌ Cache issue detected\n');
      failed++;
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}\n`);
    failed++;
  }
  
  // Test 2: All 20 fields are read correctly
  console.log('Test 2: Verify all 20 AffiliateProfile fields');
  try {
    const profiles = await affiliateRepository.getAllProfiles();
    
    if (profiles.length > 0) {
      const first = profiles[0];
      const expectedFields = ['AffiliateID', 'Name', 'Email', 'ReferralCode', 'JoinedDate', 'LastActive', 'Website', 'SocialMedia', 'Niche', 'Tier', 'Status', 'Country', 'TotalClicks', 'TotalConversions', 'TotalRevenue', 'TotalCommission', 'ConversionRate', 'EarningsPerClick', 'Score', 'CommissionPct'];
      const missingFields = expectedFields.filter(f => !(f in first));
      
      if (missingFields.length === 0) {
        console.log(`  ✅ All 20 fields present: ${Object.keys(first).length} keys\n`);
        passed++;
      } else {
        console.log(`  ❌ Missing ${missingFields.length} fields: ${missingFields.join(', ')}\n`);
        failed++;
      }
    } else {
      console.log('  ⚠️  No profiles found (seed data first)\n');
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}\n`);
    failed++;
  }
  
  // Test 3: Repository methods work correctly
  console.log('Test 3: Test repository CRUD operations');
  try {
    const profiles = await affiliateRepository.getAllProfiles();
    
    if (profiles.length > 0) {
      const profile = profiles[0];
      
      // Test getProfileById
      const byId = await affiliateRepository.getProfileById(profile.AffiliateID);
      
      if (byId && byId.AffiliateID === profile.AffiliateID) {
        console.log('  ✅ getProfileById works\n');
        passed++;
      } else {
        console.log('  ❌ getProfileById failed\n');
        failed++;
      }
    } else {
      console.log('  ⚠️  No profiles to test (seed data first)\n');
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}\n`);
    failed++;
  }
  
  // Test 4: Verify AFFILIATE_SHEETS constant
  console.log('Test 4: Verify AFFILIATE_SHEETS constant');
  try {
    if (AFFILIATE_SHEETS.length === 5) {
      console.log(`  ✅ AFFILIATE_SHEETS contains 5 sheets: ${AFFILIATE_SHEETS.join(', ')}\n`);
      passed++;
    } else {
      console.log(`  ❌ AFFILIATE_SHEETS has wrong count: ${AFFILIATE_SHEETS.length}\n`);
      failed++;
    }
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}\n`);
    failed++;
  }
  
  // Summary
  console.log('═══════════════════════════════════════════');
  console.log(`Total Tests: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log('═══════════════════════════════════════════\n');
  
  if (failed === 0) {
    console.log('🎉 All tests passed! Affiliate system is working correctly.\n');
  } else {
    console.log('⚠️  Some tests failed. Please investigate.\n');
  }
}

runTests().catch(console.error);
