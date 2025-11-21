#!/usr/bin/env tsx

import { affiliateRepository } from "../lib/affiliate-repository";

console.log('\n🔍 Testing actual candidate creation with canonical schema fields...\n');

const testCandidate = {
  Name: 'Schema Test Candidate',
  Platform: 'YouTube',
  Followers: 10000,
  EngagementRate: 5.5,
  Niche: 'tech reviews',
  Country: 'Germany',
  AIScore: 85,
  Status: 'new' as const,
  Email: undefined,
  Website: 'https://test.com',
  Notes: 'Direct repository test - schema validation',
};

console.log('Creating candidate with schema-compliant fields:');
console.log(JSON.stringify(testCandidate, null, 2));

const saved = await affiliateRepository.createCandidate(testCandidate);

console.log('\n✅ Repository returned:');
console.log(`  - CandidateID: ${saved.CandidateID}`);
console.log(`  - Name: ${saved.Name}`);
console.log(`  - Platform: ${saved.Platform}`);
console.log(`  - Country: ${saved.Country}`);
console.log(`  - AIScore: ${saved.AIScore}`);
console.log(`  - Status: ${saved.Status}`);

console.log('\n📊 Reading back from Google Sheets...');
const all = await affiliateRepository.getAllCandidates();
const found = all.find(c => c.CandidateID === saved.CandidateID);

if (!found) {
  console.log('❌ FAIL: Candidate not found in sheet!');
  process.exit(1);
}

console.log('✅ Found in Google Sheets:');
console.log(`  - Platform: ${found.Platform}`);
console.log(`  - Country: ${found.Country}`);
console.log(`  - AIScore: ${found.AIScore}`);
console.log(`  - Status: ${found.Status}`);

if (found.Platform !== 'YouTube' || found.Country !== 'Germany' || found.AIScore !== 85) {
  console.log('\n❌ FAIL: Field values don\'t match!');
  console.log(`  Expected: Platform=YouTube, Country=Germany, AIScore=85`);
  console.log(`  Actual: Platform=${found.Platform}, Country=${found.Country}, AIScore=${found.AIScore}`);
  process.exit(1);
}

console.log('\n🎉 SUCCESS: All canonical schema fields correctly persisted!');
process.exit(0);
