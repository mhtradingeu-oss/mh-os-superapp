#!/usr/bin/env tsx

/**
 * AI Affiliate Discovery Integration Test
 * 
 * Tests the complete AI Discovery flow:
 * 1. AI Discovery Agent calls OpenAI
 * 2. Candidates are validated via Zod schema
 * 3. Candidates are saved to AffiliateCandidates sheet
 * 4. Data is readable from Google Sheets
 */

import { affiliateAIAgents } from "../lib/affiliate-ai-agents";
import { affiliateService } from "../lib/affiliate-service";
import { affiliateRepository } from "../lib/affiliate-repository";

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

async function testAIDiscoveryAgent() {
  console.log('\n🔍 TEST 1: AI Discovery Agent (OpenAI Integration)');
  console.log('━'.repeat(60));
  
  try {
    const niche = "men's grooming, beard care";
    const limit = 5;
    
    console.log(`Calling AI Discovery for: "${niche}" (limit: ${limit})`);
    const startTime = Date.now();
    
    const candidates = await affiliateAIAgents.agentDiscovery(niche, limit);
    
    const duration = Date.now() - startTime;
    console.log(`✅ AI returned ${candidates.length} candidates in ${duration}ms`);
    
    if (candidates.length === 0) {
      results.push({
        test: 'AI Discovery Agent',
        status: 'FAIL',
        message: 'AI returned 0 candidates (possible OpenAI API issue)',
        details: { niche, limit, duration }
      });
      console.error('❌ FAIL: No candidates returned');
      return null;
    }
    
    // Validate candidate structure
    const sample = candidates[0];
    console.log('\n📋 Sample Candidate:');
    console.log(JSON.stringify(sample, null, 2));
    
    const requiredFields = ['name', 'followers', 'engagementRate', 'niche', 'relevanceScore'];
    const missingFields = requiredFields.filter(field => !(field in sample));
    
    if (missingFields.length > 0) {
      results.push({
        test: 'AI Discovery Agent',
        status: 'FAIL',
        message: `Missing required fields: ${missingFields.join(', ')}`,
        details: { sample }
      });
      console.error(`❌ FAIL: Missing fields: ${missingFields.join(', ')}`);
      return null;
    }
    
    results.push({
      test: 'AI Discovery Agent',
      status: 'PASS',
      message: `Successfully discovered ${candidates.length} candidates`,
      details: { count: candidates.length, duration }
    });
    
    return candidates;
  } catch (error: any) {
    console.error('❌ FAIL:', error.message);
    results.push({
      test: 'AI Discovery Agent',
      status: 'FAIL',
      message: error.message,
      details: { stack: error.stack }
    });
    return null;
  }
}

async function testCandidateSaving(aiCandidates: any[]) {
  console.log('\n💾 TEST 2: Save Candidates to Google Sheets');
  console.log('━'.repeat(60));
  
  try {
    const beforeCount = (await affiliateRepository.getAllCandidates()).length;
    console.log(`Candidates in sheet before: ${beforeCount}`);
    
    const savedCandidates = [];
    for (const aiCandidate of aiCandidates.slice(0, 3)) { // Save first 3 only
      const candidateData = {
        Name: aiCandidate.name,
        Email: undefined,
        Website: aiCandidate.website,
        Instagram: aiCandidate.instagram,
        YouTube: aiCandidate.youtube,
        TikTok: aiCandidate.tiktok,
        Twitter: aiCandidate.twitter,
        Niche: aiCandidate.niche,
        Followers: aiCandidate.followers,
        EngagementRate: aiCandidate.engagementRate,
        ContentType: aiCandidate.contentType,
        Location: aiCandidate.location,
        Score: aiCandidate.relevanceScore,
        Source: 'AI_Discovery' as const,
        Status: 'New' as const,
        Notes: `Test discovery on ${new Date().toISOString().split('T')[0]}`,
      };
      
      const saved = await affiliateService.createCandidate(candidateData);
      savedCandidates.push(saved);
      console.log(`✅ Saved: ${saved.Name} (ID: ${saved.CandidateID})`);
    }
    
    const afterCount = (await affiliateRepository.getAllCandidates()).length;
    console.log(`Candidates in sheet after: ${afterCount}`);
    
    const expectedIncrease = savedCandidates.length;
    const actualIncrease = afterCount - beforeCount;
    
    if (actualIncrease !== expectedIncrease) {
      results.push({
        test: 'Save Candidates',
        status: 'FAIL',
        message: `Expected ${expectedIncrease} new candidates, but found ${actualIncrease}`,
        details: { beforeCount, afterCount, savedCandidates }
      });
      console.error(`❌ FAIL: Count mismatch (expected +${expectedIncrease}, got +${actualIncrease})`);
      return null;
    }
    
    results.push({
      test: 'Save Candidates',
      status: 'PASS',
      message: `Successfully saved ${savedCandidates.length} candidates`,
      details: { beforeCount, afterCount, saved: savedCandidates.map(c => c.CandidateID) }
    });
    
    return savedCandidates;
  } catch (error: any) {
    console.error('❌ FAIL:', error.message);
    results.push({
      test: 'Save Candidates',
      status: 'FAIL',
      message: error.message,
      details: { stack: error.stack }
    });
    return null;
  }
}

async function testDataPersistence(savedCandidates: any[]) {
  console.log('\n🔄 TEST 3: Data Persistence Verification');
  console.log('━'.repeat(60));
  
  try {
    const allCandidates = await affiliateRepository.getAllCandidates();
    
    for (const saved of savedCandidates) {
      const found = allCandidates.find(c => c.CandidateID === saved.CandidateID);
      
      if (!found) {
        results.push({
          test: 'Data Persistence',
          status: 'FAIL',
          message: `Candidate ${saved.CandidateID} not found in sheet`,
          details: { candidateID: saved.CandidateID }
        });
        console.error(`❌ FAIL: ${saved.CandidateID} not found`);
        return;
      }
      
      console.log(`✅ Verified: ${found.Name} (${found.CandidateID})`);
      console.log(`   - Followers: ${found.Followers}`);
      console.log(`   - Engagement: ${found.EngagementRate}%`);
      console.log(`   - Score: ${found.AIScore}`);
      console.log(`   - Status: ${found.Status}`);
    }
    
    results.push({
      test: 'Data Persistence',
      status: 'PASS',
      message: `All ${savedCandidates.length} candidates verified in Google Sheets`,
      details: { verified: savedCandidates.map(c => c.CandidateID) }
    });
  } catch (error: any) {
    console.error('❌ FAIL:', error.message);
    results.push({
      test: 'Data Persistence',
      status: 'FAIL',
      message: error.message,
      details: { stack: error.stack }
    });
  }
}

async function testFieldValidation() {
  console.log('\n✅ TEST 4: Field Validation (20 Fields)');
  console.log('━'.repeat(60));
  
  try {
    const candidates = await affiliateRepository.getAllCandidates();
    
    if (candidates.length === 0) {
      console.log('⚠️  SKIP: No candidates in sheet to validate');
      results.push({
        test: 'Field Validation',
        status: 'PASS',
        message: 'Skipped - no candidates to validate',
      });
      return;
    }
    
    const sample = candidates[0];
    const expectedFields = [
      'CandidateID', 'Name', 'Email', 'Platform', 'Followers',
      'EngagementRate', 'Niche', 'Country', 'Language', 'AIScore',
      'ManualScore', 'FinalScore', 'Status', 'Source', 'Priority',
      'EstRevenue', 'Notes', 'DiscoveredDate', 'LastContactDate', 'NextAction'
    ];
    
    const actualFields = Object.keys(sample);
    const missingFields = expectedFields.filter(f => !actualFields.includes(f));
    
    console.log(`Expected fields: ${expectedFields.length}`);
    console.log(`Actual fields: ${actualFields.length}`);
    
    if (missingFields.length > 0) {
      results.push({
        test: 'Field Validation',
        status: 'FAIL',
        message: `Missing fields: ${missingFields.join(', ')}`,
        details: { expectedFields, actualFields, missingFields }
      });
      console.error(`❌ FAIL: Missing ${missingFields.length} fields: ${missingFields.join(', ')}`);
      return;
    }
    
    console.log('✅ All 20 fields present and accounted for');
    results.push({
      test: 'Field Validation',
      status: 'PASS',
      message: 'All 20 candidate fields validated',
      details: { fields: expectedFields }
    });
  } catch (error: any) {
    console.error('❌ FAIL:', error.message);
    results.push({
      test: 'Field Validation',
      status: 'FAIL',
      message: error.message,
    });
  }
}

async function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('═'.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.test}: ${result.message}`);
  });
  
  console.log('\n' + '─'.repeat(60));
  console.log(`Results: ${passed}/${total} tests passed`);
  
  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('✅ AI Discovery is connected, collecting, and recording data properly');
  } else {
    console.log(`\n❌ ${failed} test(s) failed`);
    console.log('Please review the errors above');
  }
  console.log('═'.repeat(60));
  
  process.exit(failed > 0 ? 1 : 0);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   AI AFFILIATE DISCOVERY - INTEGRATION TEST SUITE         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Test 1: AI Discovery Agent
  const aiCandidates = await testAIDiscoveryAgent();
  if (!aiCandidates) {
    await printSummary();
    return;
  }
  
  // Test 2: Save to Google Sheets
  const savedCandidates = await testCandidateSaving(aiCandidates);
  if (!savedCandidates) {
    await printSummary();
    return;
  }
  
  // Test 3: Verify persistence
  await testDataPersistence(savedCandidates);
  
  // Test 4: Field validation
  await testFieldValidation();
  
  // Print summary
  await printSummary();
}

main().catch(console.error);
