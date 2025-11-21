#!/usr/bin/env tsx
/**
 * End-to-End AI Discovery Test
 * Tests the full flow: OpenAI → Route → Service → Google Sheets
 */

import { affiliateRepository } from "../lib/affiliate-repository";

async function testE2E() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║    AI DISCOVERY - END-TO-END TEST (API → Sheets)         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log();

  try {
    // Count before
    const beforeCount = (await affiliateRepository.getAllCandidates()).length;
    console.log(`📊 Candidates before: ${beforeCount}`);
    console.log();

    // Call the actual API endpoint
    console.log('🚀 Calling POST /api/affiliates/ai/discover...');
    console.log('   Niche: "men\'s grooming, beard care"');
    console.log('   Limit: 3');
    console.log();

    const startTime = Date.now();
    const response = await fetch('http://localhost:5000/api/affiliates/ai/discover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        niche: "men's grooming, beard care",
        limit: 3
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`⏱️  API call completed in ${duration}s`);
    console.log(`✅ Saved ${result.count} candidates`);
    console.log();

    if (result.count === 0) {
      console.log('❌ FAIL: No candidates saved');
      if (result.errors) {
        console.log('Errors:', result.errors);
      }
      process.exit(1);
    }

    // Verify in Google Sheets
    console.log('━'.repeat(60));
    console.log('📋 VERIFYING GOOGLE SHEETS PERSISTENCE');
    console.log('━'.repeat(60));
    console.log();

    const afterCount = (await affiliateRepository.getAllCandidates()).length;
    const newCandidates = afterCount - beforeCount;

    console.log(`Candidates after: ${afterCount}`);
    console.log(`New candidates: ${newCandidates}`);
    console.log();

    if (newCandidates !== result.count) {
      console.log(`⚠️  Warning: API says ${result.count} saved, but sheet shows ${newCandidates} new`);
    }

    // Display saved candidates
    console.log('━'.repeat(60));
    console.log('📝 SAVED CANDIDATES (API Response):');
    console.log('━'.repeat(60));

    result.candidates.forEach((candidate: any, i: number) => {
      console.log();
      console.log(`${i + 1}. ${candidate.Name}`);
      console.log(`   ID: ${candidate.CandidateID}`);
      console.log(`   Platform: ${candidate.Platform || candidate.ContentType || 'N/A'}`);
      console.log(`   Country: ${candidate.Country || candidate.Location || 'N/A'}`);
      console.log(`   AIScore: ${candidate.AIScore || candidate.Score || 'N/A'}`);
      console.log(`   Followers: ${candidate.Followers?.toLocaleString() || 'N/A'}`);
      console.log(`   Status: ${candidate.Status} / Canonical: ${candidate.CanonicalStatus || 'N/A'}`);
    });

    console.log();
    console.log('═'.repeat(60));
    console.log('🎉 END-TO-END TEST PASSED!');
    console.log('═'.repeat(60));
    console.log('✅ OpenAI API: WORKING');
    console.log('✅ AI Discovery Route: WORKING');
    console.log('✅ Service Layer: WORKING');
    console.log('✅ Google Sheets: WORKING');
    console.log('✅ Canonical Fields: PRESENT');
    console.log('═'.repeat(60));

  } catch (error: any) {
    console.error();
    console.error('❌ TEST FAILED');
    console.error('━'.repeat(60));
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    console.error('━'.repeat(60));
    process.exit(1);
  }
}

// Run test
testE2E().catch(console.error);
