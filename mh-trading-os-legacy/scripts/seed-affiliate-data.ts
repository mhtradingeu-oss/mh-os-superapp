/**
 * MH TRADING OS — Affiliate Seeder (Google Sheets)
 * -------------------------------------------------
 * Seeds all 5 affiliate sheets with sample data for testing
 * Uses affiliateRepository for type-safe, validated operations
 */

import { affiliateRepository } from '../lib/affiliate-repository.js';

async function seedAffiliateProfiles() {
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
      TotalClicks: 0,
      TotalConversions: 0,
      TotalRevenue: 0,
      TotalCommission: 0,
      ConversionRate: 0,
      EarningsPerClick: 0,
      Score: 0,
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
      Niche: 'Men\'s grooming',
      TotalClicks: 0,
      TotalConversions: 0,
      TotalRevenue: 0,
      TotalCommission: 0,
      ConversionRate: 0,
      EarningsPerClick: 0,
      Score: 0,
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
      TotalClicks: 0,
      TotalConversions: 0,
      TotalRevenue: 0,
      TotalCommission: 0,
      ConversionRate: 0,
      EarningsPerClick: 0,
      Score: 0,
      CommissionPct: 10
    },
    {
      AffiliateID: 'AFF-004',
      Name: 'FreshCuts Review',
      Email: 'cuts@reviewsite.com',
      ReferralCode: 'CUTS2025',
      Country: 'NL',
      Tier: 'Basic',
      Status: 'paused',
      JoinedDate: new Date().toISOString(),
      LastActive: new Date().toISOString(),
      Website: 'https://freshcuts.nl',
      SocialMedia: '@freshcuts',
      Niche: 'Hair products',
      TotalClicks: 0,
      TotalConversions: 0,
      TotalRevenue: 0,
      TotalCommission: 0,
      ConversionRate: 0,
      EarningsPerClick: 0,
      Score: 0,
      CommissionPct: 8
    },
    {
      AffiliateID: 'AFF-005',
      Name: 'HairForce Media',
      Email: 'hforce@example.com',
      ReferralCode: 'HF2025',
      Country: 'UK',
      Tier: 'Gold',
      Status: 'active',
      JoinedDate: new Date().toISOString(),
      LastActive: new Date().toISOString(),
      Website: 'https://hairforce.co.uk',
      SocialMedia: '@hairforce',
      Niche: 'Hair care & styling',
      TotalClicks: 0,
      TotalConversions: 0,
      TotalRevenue: 0,
      TotalCommission: 0,
      ConversionRate: 0,
      EarningsPerClick: 0,
      Score: 0,
      CommissionPct: 15
    },
  ];

  for (const profile of profiles) {
    await affiliateRepository.createProfile(profile);
  }
  console.log('✅ Seeded: AffiliateProfiles (5 profiles)');
}

async function seedAffiliateClicks() {
  const clicks = [];
  const affiliateIDs = ['AFF-001', 'AFF-002', 'AFF-003', 'AFF-004', 'AFF-005'];
  const sources = ['instagram', 'blog', 'youtube', 'tiktok', 'email'];
  const devices = ['mobile', 'desktop', 'tablet'];
  const pages = [
    'https://hairoticmen.de/product/beard-oil',
    'https://hairoticmen.de/product/hair-wax',
    'https://hairoticmen.de/product/shaving-cream',
    'https://hairoticmen.de/catalog',
  ];

  for (let i = 1; i <= 20; i++) {
    const affiliateID = affiliateIDs[i % 5];
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(i / 2));
    
    clicks.push({
      ClickID: `CLK-${String(i).padStart(4, '0')}`,
      AffiliateID: affiliateID,
      Timestamp: date.toISOString(),
      Source: sources[i % sources.length],
      Device: devices[i % devices.length],
      IPAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      LandingPage: pages[i % pages.length],
      Referrer: 'google'
    });
  }

  for (const click of clicks) {
    await affiliateRepository.trackClick(click);
  }
  console.log('✅ Seeded: AffiliateClicks (20 clicks)');
}

async function seedAffiliateConversions() {
  const conversions = [];
  const affiliateIDs = ['AFF-001', 'AFF-002', 'AFF-003', 'AFF-004', 'AFF-005'];
  const countries = ['DE', 'AT', 'CH', 'NL', 'UK'];

  for (let i = 1; i <= 10; i++) {
    const affiliateID = affiliateIDs[i % 5];
    const revenue = (29.99 * (i % 3 + 1));
    const commission = revenue * 0.15;
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(i * 1.5));

    conversions.push({
      ConversionID: `CONV-${String(i).padStart(4, '0')}`,
      AffiliateID: affiliateID,
      OrderID: `ORD-${String(1000 + i).padStart(5, '0')}`,
      Revenue: parseFloat(revenue.toFixed(2)),
      Commission: parseFloat(commission.toFixed(2)),
      Currency: 'EUR',
      Country: countries[i % countries.length],
      Timestamp: date.toISOString(),
      ClickID: `CLK-${String(i).padStart(4, '0')}`,
      ProductsSold: 'Beard Oil, Hair Wax'
    });
  }

  for (const conversion of conversions) {
    await affiliateRepository.trackConversion(conversion, true);
  }
  console.log('✅ Seeded: AffiliateConversions (10 conversions)');
}

async function seedAffiliateCandidates() {
  const candidates = [
    {
      CandidateID: 'CAND-001',
      Name: 'BeardBro TV',
      Platform: 'YouTube',
      Followers: 24000,
      EngagementRate: 13.4,
      Niche: 'beard grooming',
      Country: 'DE',
      AIScore: 87,
      Status: 'new'
    },
    {
      CandidateID: 'CAND-002',
      Name: 'MensStyle360',
      Platform: 'Instagram',
      Followers: 85000,
      EngagementRate: 7.9,
      Niche: 'style & grooming',
      Country: 'UK',
      AIScore: 75,
      Status: 'contacted'
    },
    {
      CandidateID: 'CAND-003',
      Name: 'GroomingGeek Blog',
      Platform: 'Blog',
      Followers: 120000,
      EngagementRate: 5.4,
      Niche: 'hair care',
      Country: 'US',
      AIScore: 91,
      Status: 'new'
    },
    {
      CandidateID: 'CAND-004',
      Name: 'BarberTalk Podcast',
      Platform: 'YouTube',
      Followers: 48000,
      EngagementRate: 3.2,
      Niche: 'barbers',
      Country: 'DE',
      AIScore: 68,
      Status: 'rejected'
    },
    {
      CandidateID: 'CAND-005',
      Name: 'KingBeard IG',
      Platform: 'Instagram',
      Followers: 35000,
      EngagementRate: 10.9,
      Niche: 'beard care',
      Country: 'FR',
      AIScore: 95,
      Status: 'new'
    },
    {
      CandidateID: 'CAND-006',
      Name: 'HairForce Media',
      Platform: 'TikTok',
      Followers: 76000,
      EngagementRate: 12.1,
      Niche: 'men grooming',
      Country: 'NL',
      AIScore: 89,
      Status: 'new'
    },
    {
      CandidateID: 'CAND-007',
      Name: 'The Gentleman Way',
      Platform: 'Blog',
      Followers: 45000,
      EngagementRate: 8.7,
      Niche: 'lifestyle & grooming',
      Country: 'AT',
      AIScore: 82,
      Status: 'contacted'
    },
    {
      CandidateID: 'CAND-008',
      Name: 'StylishGents',
      Platform: 'Instagram',
      Followers: 92000,
      EngagementRate: 6.3,
      Niche: 'fashion & beard',
      Country: 'DE',
      AIScore: 78,
      Status: 'new'
    },
  ];

  for (const candidate of candidates) {
    await affiliateRepository.createCandidate(candidate);
  }
  console.log('✅ Seeded: AffiliateCandidates (8 candidates)');
}

async function seedAffiliateTasks() {
  const tasks = [
    {
      TaskID: 'TASK-001',
      AffiliateID: 'AFF-001',
      TaskType: 'email',
      Description: 'Send welcome kit with products',
      DueDate: '2025-02-01',
      Status: 'pending',
      Priority: 'high'
    },
    {
      TaskID: 'TASK-002',
      AffiliateID: 'AFF-002',
      TaskType: 'follow-up',
      Description: 'Ask for video content creation',
      DueDate: '2025-02-05',
      Status: 'pending',
      Priority: 'medium'
    },
    {
      TaskID: 'TASK-003',
      AffiliateID: 'AFF-003',
      TaskType: 'negotiation',
      Description: 'Finalize commission structure',
      DueDate: '2025-02-07',
      Status: 'done',
      Priority: 'low'
    },
    {
      TaskID: 'TASK-004',
      AffiliateID: 'AFF-005',
      TaskType: 'email',
      Description: 'Send onboarding email with guidelines',
      DueDate: '2025-02-10',
      Status: 'pending',
      Priority: 'high'
    },
    {
      TaskID: 'TASK-005',
      AffiliateID: 'AFF-001',
      TaskType: 'review',
      Description: 'Monthly performance review',
      DueDate: '2025-02-15',
      Status: 'pending',
      Priority: 'medium'
    },
    {
      TaskID: 'TASK-006',
      AffiliateID: 'AFF-002',
      TaskType: 'payment',
      Description: 'Process commission payout',
      DueDate: '2025-02-20',
      Status: 'done',
      Priority: 'high'
    },
  ];

  for (const task of tasks) {
    await affiliateRepository.createTask(task);
  }
  console.log('✅ Seeded: AffiliateTasks (6 tasks)');
}

// Main execution
(async () => {
  console.log('🚀 Starting Affiliate Data Seeder...\n');

  try {
    await seedAffiliateProfiles();
    await seedAffiliateClicks();
    await seedAffiliateConversions();
    await seedAffiliateCandidates();
    await seedAffiliateTasks();

    console.log('\n🎉 ALL AFFILIATE DATA SEEDED SUCCESSFULLY!');
    console.log('➡ Total records created:');
    console.log('   - 5 Affiliate Profiles');
    console.log('   - 20 Clicks');
    console.log('   - 10 Conversions');
    console.log('   - 8 AI Candidates');
    console.log('   - 6 Tasks');
    console.log('\n✅ Affiliate Intelligence Dashboard is now ready for testing!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeder Error:', error);
    process.exit(1);
  }
})();
