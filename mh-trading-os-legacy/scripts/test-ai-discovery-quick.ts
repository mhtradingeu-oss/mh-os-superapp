#!/usr/bin/env tsx
/**
 * Quick AI Discovery Test - Real OpenAI API Call
 * Tests with small limit (3 candidates) for faster testing
 */

import { affiliateAIAgents } from "../lib/affiliate-ai-agents";
import { affiliateRepository } from "../lib/affiliate-repository";

async function testAIDiscoveryQuick() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         QUICK AI DISCOVERY TEST (3 Candidates)            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log();

  try {
    // Get count before
    const candidatesBefore = await affiliateRepository.getAllCandidates();
    console.log(`📊 Candidates before: ${candidatesBefore.length}`);
    console.log();

    // Test AI Discovery with small limit
    console.log('🤖 Calling OpenAI GPT-4 for affiliate discovery...');
    console.log('   Niche: "men\'s grooming, beard care"');
    console.log('   Limit: 3 candidates');
    console.log();

    const startTime = Date.now();
    const aiCandidates = await affiliateAIAgents.agentDiscovery("men's grooming, beard care", 3);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`⏱️  AI Discovery completed in ${duration}s`);
    console.log(`✅ AI returned ${aiCandidates.length} candidates`);
    console.log();

    if (aiCandidates.length === 0) {
      console.log('❌ FAIL: No candidates returned from AI');
      console.log('   Check logs for OpenAI API errors');
      process.exit(1);
    }

    // Display candidates
    console.log('━'.repeat(60));
    console.log('📋 AI-DISCOVERED CANDIDATES:');
    console.log('━'.repeat(60));
    
    aiCandidates.forEach((candidate, index) => {
      console.log(`\n${index + 1}. ${candidate.name}`);
      console.log(`   Platform: ${candidate.contentType || 'N/A'}`);
      console.log(`   Followers: ${candidate.followers?.toLocaleString() || 'N/A'}`);
      console.log(`   Engagement: ${candidate.engagementRate || 'N/A'}%`);
      console.log(`   Location: ${candidate.location || 'N/A'}`);
      console.log(`   Score: ${candidate.relevanceScore || 'N/A'}/100`);
      console.log(`   Website: ${candidate.website || 'N/A'}`);
      console.log(`   Instagram: ${candidate.instagram || 'N/A'}`);
      console.log(`   YouTube: ${candidate.youtube || 'N/A'}`);
    });

    console.log();
    console.log('═'.repeat(60));
    console.log('🎉 TEST PASSED!');
    console.log('═'.repeat(60));
    console.log(`✅ OpenAI API: WORKING`);
    console.log(`✅ AI Discovery: FUNCTIONAL`);
    console.log(`✅ Candidates generated: ${aiCandidates.length}/3`);
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
    
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      console.error('\n⚠️  OpenAI API Quota Issue');
      console.error('   Please check your billing at:');
      console.error('   https://platform.openai.com/account/billing');
    }
    
    process.exit(1);
  }
}

// Run test
testAIDiscoveryQuick().catch(console.error);
