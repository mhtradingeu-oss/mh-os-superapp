import { generateAIResponse } from "./openai";
import { affiliateService, type AffiliateCandidate, type AffiliateProfile } from "./affiliate-service";
import { nanoid } from "nanoid";
import { z } from "zod";

export interface DiscoveryCandidate {
  name: string;
  website?: string;
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  twitter?: string;
  email?: string;
  privateEmail?: string;
  phone?: string;
  followers: number;
  engagementRate: number;
  niche: string;
  location: string;
  contentType: string;
  personType?: string;
  platform?: string;
  url?: string;
  relevanceScore: number;
}

export interface AdvancedDiscoveryParams {
  niches?: string[];
  personTypes?: string[];
  platforms?: string[];
  countries?: string[];
  minFollowers?: number;
  minEngagement?: number;
  limit?: number;
}

const discoveryCandidateSchema = z.object({
  name: z.string().nullable().optional().transform(val => val || "Unknown Affiliate"),
  website: z.string().nullable().optional().transform(val => val || undefined),
  instagram: z.string().nullable().optional().transform(val => val || undefined),
  youtube: z.string().nullable().optional().transform(val => val || undefined),
  tiktok: z.string().nullable().optional().transform(val => val || undefined),
  twitter: z.string().nullable().optional().transform(val => val || undefined),
  email: z.string().nullable().optional().transform(val => val || undefined),
  privateEmail: z.string().nullable().optional().transform(val => val || undefined),
  phone: z.string().nullable().optional().transform(val => val || undefined),
  followers: z.coerce.number().nullable().optional().transform(val => (val != null && Number.isFinite(val)) ? val : 1000),
  engagementRate: z.coerce.number().nullable().optional().transform(val => (val != null && Number.isFinite(val)) ? val : 2.0),
  niche: z.string().nullable().optional().transform(val => val || "general"),
  location: z.string().nullable().optional().transform(val => val || "Unknown"),
  contentType: z.string().nullable().optional().transform(val => val || "mixed"),
  personType: z.string().nullable().optional().transform(val => val || undefined),
  platform: z.string().nullable().optional().transform(val => val || undefined),
  url: z.string().nullable().optional().transform(val => val || undefined),
  relevanceScore: z.coerce.number().nullable().optional().transform(val => (val != null && Number.isFinite(val)) ? val : 50),
});

const rankingResultSchema = z.object({
  score: z.coerce.number().nullable().optional().transform(val => (val != null && Number.isFinite(val)) ? val : 50),
  breakdown: z.object({
    traffic: z.coerce.number().nullable().optional().transform(val => (val != null && Number.isFinite(val)) ? val : 50),
    engagement: z.coerce.number().nullable().optional().transform(val => (val != null && Number.isFinite(val)) ? val : 50),
    relevance: z.coerce.number().nullable().optional().transform(val => (val != null && Number.isFinite(val)) ? val : 50),
    authority: z.coerce.number().nullable().optional().transform(val => (val != null && Number.isFinite(val)) ? val : 50),
    spamRisk: z.coerce.number().nullable().optional().transform(val => (val != null && Number.isFinite(val)) ? val : 0.2),
  }).nullable().optional().transform(val => val || {
    traffic: 50,
    engagement: 50,
    relevance: 50,
    authority: 50,
    spamRisk: 0.2,
  }),
  recommendation: z.string().nullable().optional().transform(val => val || "Manual review recommended"),
});

const outreachEmailSchema = z.object({
  subject: z.string().nullable().optional().transform(val => val || "Partnership Opportunity"),
  body: z.string().nullable().optional().transform(val => val || "We'd love to collaborate with you!"),
  personalizationNotes: z.string().nullable().optional().transform(val => val || "Personalize before sending"),
  followUpSuggestions: z.array(z.string()).nullable().optional().transform(val => val || ["Follow up in 3 days"]),
});

const dealOptimizationSchema = z.object({
  recommendedCommission: z.coerce.number().nullable().optional().transform(val => (val != null && Number.isFinite(val)) ? val : 12),
  welcomeBonus: z.coerce.number().nullable().optional().transform(val => (val != null && Number.isFinite(val)) ? val : 0),
  suggestedCode: z.string().nullable().optional().transform(val => val || "PARTNER10"),
  dealStructure: z.string().nullable().optional().transform(val => val || "Standard commission structure"),
  reasoning: z.string().nullable().optional().transform(val => val || "Automated optimization"),
});

export interface RankingResult {
  candidateID: string;
  score: number;
  breakdown: {
    traffic: number;
    engagement: number;
    relevance: number;
    authority: number;
    spamRisk: number;
  };
  recommendation: string;
}

export interface OutreachEmailResult {
  subject: string;
  body: string;
  personalizationNotes: string;
  followUpSuggestions: string[];
}

export interface DealOptimization {
  recommendedCommission: number;
  welcomeBonus: number;
  suggestedCode: string;
  dealStructure: string;
  reasoning: string;
}

class AffiliateAIAgents {
  async agentDiscovery(params?: AdvancedDiscoveryParams): Promise<DiscoveryCandidate[]> {
    // Handle both legacy (string niche, number limit) and new (AdvancedDiscoveryParams) interfaces
    const niches = params?.niches || ["men's grooming", "beard care", "barber products"];
    const personTypes = params?.personTypes || [];
    const platforms = params?.platforms || [];
    const countries = params?.countries || [];
    const minFollowers = params?.minFollowers;
    const minEngagement = params?.minEngagement;
    const limit = params?.limit || 50;

    const nichesList = niches.join(", ");
    const personTypesFilter = personTypes.length > 0 ? `\n- Person types: ${personTypes.join(", ")}` : "";
    const platformsFilter = platforms.length > 0 ? `\n- Platforms: ${platforms.join(", ")}` : "";
    const countriesFilter = countries.length > 0 ? `\n- Countries: ${countries.join(", ")}` : "\n- Countries: Germany, USA, UK, DACH region (priority)";
    const followersFilter = minFollowers ? `\n- Minimum ${minFollowers.toLocaleString()} followers` : "";
    const engagementFilter = minEngagement ? `\n- Minimum ${minEngagement}% engagement rate` : "";

    const prompt = `You are A-AFF-201, an Advanced Affiliate Discovery AI Agent. Your task is to identify potential affiliate partners with precision filtering.

MISSION: Find top influencers, bloggers, and content creators matching these criteria:

TARGET NICHES: ${nichesList}${personTypesFilter}${platformsFilter}${countriesFilter}${followersFilter}${engagementFilter}

SEARCH CRITERIA:
- Must have authentic engagement (not fake followers)
- High content quality and consistent posting frequency
- Audience demographics match target market (men's grooming/barber products)
- Active on specified platforms or major social media${platforms.length > 0 ? ` (focus on: ${platforms.join(", ")})` : ""}
- Real, verifiable public profiles with contact information

PROVIDE: ${limit} highest-quality candidates matching ALL specified filters

For each candidate, provide:
1. Name (real name or handle) - REQUIRED
2. Person type (Influencer, Reviewer, Expert, etc.) - based on their role
3. Primary platform (Instagram, YouTube, TikTok, Blog, etc.)
4. Contact URL (website, social profile, or best contact method)
5. Email address (public contact email if available)
6. Private email (personal/business email if publicly listed)
7. Phone number (if publicly available on their website/bio)
8. Follower count (realistic estimate)
9. Engagement rate % (calculate based on likes/comments vs followers)
10. Content type (reviews, tutorials, lifestyle, product demos, etc.)
11. Location/Country
12. Relevance score (0-100) for HAIROTICMEN brand

CONTACT INFO GUIDELINES:
- email: Generic/public contact emails (info@, contact@, hello@, etc.)
- privateEmail: Personal emails if publicly listed (john@, firstname.lastname@, etc.)
- phone: Only if publicly displayed on website/bio/contact page

IMPORTANT:
- Only include candidates that meet the minimum thresholds specified above
- Prioritize quality over quantity - better to return fewer high-quality matches
- Include diverse candidate types (micro-influencers to celebrities)
- Ensure all follower counts and engagement rates are realistic
- Only include phone/privateEmail if ACTUALLY publicly available

FORMAT: Return ONLY a valid JSON array of candidates:
[
  {
    "name": "John The Barber",
    "personType": "Professional Barber",
    "platform": "Instagram",
    "website": "https://johnthebarber.com",
    "instagram": "@johnthebarber",
    "youtube": "JohnBarberTV",
    "email": "contact@johnthebarber.com",
    "privateEmail": "john@johnthebarber.com",
    "phone": "+49 123 456789",
    "url": "https://instagram.com/johnthebarber",
    "followers": 50000,
    "engagementRate": 4.5,
    "niche": "beard care",
    "location": "Germany",
    "contentType": "tutorials, product reviews",
    "relevanceScore": 92
  }
]`;

    try {
      // generateAIResponse returns string content directly, not cache (2nd param should be boolean)
      const responseContent = await generateAIResponse(prompt, false);

      // Strip markdown code blocks if present (AI sometimes wraps JSON in ```json ... ```)
      let jsonContent = responseContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      let parsedData;
      try {
        parsedData = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.error('AI Response:', responseContent);
        return [];
      }

      if (!Array.isArray(parsedData)) {
        console.error('AI response is not an array');
        return [];
      }

      const validatedCandidates: DiscoveryCandidate[] = [];
      for (const candidate of parsedData) {
        const result = discoveryCandidateSchema.safeParse(candidate);
        if (result.success) {
          validatedCandidates.push(result.data);
        } else {
          console.warn('Invalid candidate data:', result.error.errors);
        }
      }

      return validatedCandidates;
    } catch (error) {
      console.error('AI Discovery Agent failed:', error);
      return [];
    }
  }

  async agentRanking(candidate: AffiliateCandidate): Promise<RankingResult> {
    const prompt = `You are A-RANK-203, an Affiliate Ranking AI Agent. Analyze this affiliate candidate and provide a comprehensive score.

CANDIDATE DATA:
- Name: ${candidate.Name}
- Followers: ${candidate.Followers}
- Engagement Rate: ${candidate.EngagementRate}%
- Niche: ${candidate.Niche}
- Content Type: ${candidate.ContentType}
- Location: ${candidate.Location}
- Platform: ${candidate.Instagram || candidate.YouTube || candidate.Website || 'Unknown'}

SCORING FORMULA:
score = (traffic * 0.30 + engagement * 0.25 + relevance * 0.30 + authority * 0.15) / spamRisk

EVALUATE:
1. Traffic potential (0-100): Based on follower count and reach
2. Engagement quality (0-100): Real interactions vs fake engagement
3. Niche relevance (0-100): How well they fit men's grooming/beard care
4. Authority level (0-100): Credibility and influence in the space
5. Spam risk (0-1): Likelihood of fraudulent activity (0.1 = low risk, 1.0 = high risk)

PROVIDE: 
- Overall score (0-100)
- Score breakdown for each component
- Recommendation (Accept, Review, or Reject)

FORMAT: Return ONLY valid JSON:
{
  "score": 85,
  "breakdown": {
    "traffic": 90,
    "engagement": 75,
    "relevance": 95,
    "authority": 80,
    "spamRisk": 0.1
  },
  "recommendation": "Accept - High-quality candidate with authentic engagement"
}`;

    try {
      const responseContent = await generateAIResponse(prompt, false);

      let parsedData;
      try {
        parsedData = JSON.parse(responseContent);
      } catch (parseError) {
        console.error('Failed to parse AI ranking response:', parseError);
        console.error('AI Response:', responseContent);
        throw new Error('Invalid AI response format');
      }

      const validationResult = rankingResultSchema.safeParse(parsedData);
      
      if (!validationResult.success) {
        console.error('AI ranking validation failed:', validationResult.error.errors);
        throw new Error('AI response validation failed');
      }
      
      return {
        candidateID: candidate.CandidateID,
        ...validationResult.data,
      };
    } catch (error) {
      console.error('AI Ranking Agent failed:', error);
      return {
        candidateID: candidate.CandidateID,
        score: 50,
        breakdown: {
          traffic: 50,
          engagement: 50,
          relevance: 50,
          authority: 50,
          spamRisk: 0.5,
        },
        recommendation: 'Manual review required - AI analysis failed',
      };
    }
  }

  async agentOutreach(candidate: AffiliateCandidate, offerDetails?: string): Promise<OutreachEmailResult> {
    const prompt = `You are A-CRM-202, an Outreach Communications AI Agent. Create a personalized, compelling outreach email.

RECIPIENT:
- Name: ${candidate.Name}
- Platform: ${candidate.Instagram || candidate.YouTube || candidate.Website || 'their platform'}
- Niche: ${candidate.Niche}
- Content: ${candidate.ContentType}
- Followers: ${candidate.Followers.toLocaleString()}

SENDER: HAIROTICMEN (Premium men's grooming & barber products brand)

OFFER DETAILS: ${offerDetails || 'Standard affiliate program: 10-15% commission on all sales, exclusive discount code for their audience, free product samples, dedicated support'}

TONE: Professional yet friendly, enthusiastic but not salesy

EMAIL STRUCTURE:
1. Compelling subject line (5-8 words)
2. Personalized opening (reference their specific content/style)
3. Value proposition (why this partnership benefits THEM)
4. Clear offer details
5. Social proof (brief)
6. Clear call-to-action
7. Warm closing

PERSONALIZATION TIPS:
- Reference specific posts/videos if possible
- Acknowledge their unique style/audience
- Show genuine interest in collaboration
- Make them feel valued

FOLLOW-UP STRATEGY:
- Suggest 2-3 follow-up touchpoints if no response

FORMAT: Return ONLY valid JSON:
{
  "subject": "Let's Grow Together: Partnership Opportunity for [Name]",
  "body": "Full email body here...",
  "personalizationNotes": "Tips for manual customization...",
  "followUpSuggestions": ["Follow-up 1 strategy", "Follow-up 2 strategy"]
}`;

    try {
      const responseContent = await generateAIResponse(prompt, false);

      let parsedData;
      try {
        parsedData = JSON.parse(responseContent);
      } catch (parseError) {
        console.error('Failed to parse AI outreach response:', parseError);
        console.error('AI Response:', responseContent);
        throw new Error('Invalid AI response format');
      }

      const validationResult = outreachEmailSchema.safeParse(parsedData);
      
      if (!validationResult.success) {
        console.error('AI outreach validation failed:', validationResult.error.errors);
        throw new Error('AI response validation failed');
      }
      
      return validationResult.data;
    } catch (error) {
      console.error('AI Outreach Agent failed:', error);
      return {
        subject: `Partnership Opportunity with HAIROTICMEN`,
        body: `Hi ${candidate.Name},\n\nWe love your content and think you'd be a perfect fit for our affiliate program!\n\nBest regards,\nHAIROTICMEN Team`,
        personalizationNotes: 'AI generation failed - please customize manually',
        followUpSuggestions: ['Follow up in 3 days', 'Send product sample offer'],
      };
    }
  }

  async agentDealOptimizer(profile: AffiliateProfile | AffiliateCandidate): Promise<DealOptimization> {
    const isProfile = 'TotalRevenue' in profile;
    
    const prompt = `You are A-OFFER-204, a Deal Optimizer AI Agent. Suggest the optimal affiliate deal structure.

${isProfile ? 'EXISTING AFFILIATE (Performance Data):' : 'NEW CANDIDATE:'}
- Name: ${profile.Name}
${isProfile ? `
- Total Revenue Generated: €${(profile as AffiliateProfile).TotalRevenue}
- Total Conversions: ${(profile as AffiliateProfile).TotalConversions}
- Conversion Rate: ${(profile as AffiliateProfile).ConversionRate}%
- Current Commission: ${(profile as AffiliateProfile).CommissionPct}%
- Tier: ${(profile as AffiliateProfile).Tier}` : `
- Followers: ${(profile as AffiliateCandidate).Followers}
- Engagement Rate: ${(profile as AffiliateCandidate).EngagementRate}%
- Niche Relevance: ${(profile as AffiliateCandidate).Niche}
- Score: ${(profile as AffiliateCandidate).Score}`}

MARKET BENCHMARKS:
- Standard commission: 10-15%
- Top performers: 15-20%
- Micro-influencers (<10k): 10-12%
- Mid-tier (10k-100k): 12-15%
- Macro (>100k): 15-20%

OPTIMIZE FOR:
1. Fair compensation based on performance/potential
2. Incentivize high-quality conversions
3. Competitive with market rates
4. Sustainable for business margins (target 30% gross margin on sales)

PROVIDE:
- Recommended commission %
- Welcome bonus amount (€)
- Suggested referral code
- Deal structure (flat rate, tiered, hybrid)
- Reasoning for recommendations

FORMAT: Return ONLY valid JSON:
{
  "recommendedCommission": 15,
  "welcomeBonus": 50,
  "suggestedCode": "BARBER15",
  "dealStructure": "Tiered: 15% base, 18% after 50 sales, 20% after 100 sales",
  "reasoning": "Explanation here..."
}`;

    try {
      const responseContent = await generateAIResponse(prompt, false);

      let parsedData;
      try {
        parsedData = JSON.parse(responseContent);
      } catch (parseError) {
        console.error('Failed to parse AI deal optimizer response:', parseError);
        console.error('AI Response:', responseContent);
        throw new Error('Invalid AI response format');
      }

      const validationResult = dealOptimizationSchema.safeParse(parsedData);
      
      if (!validationResult.success) {
        console.error('AI deal optimizer validation failed:', validationResult.error.errors);
        throw new Error('AI response validation failed');
      }
      
      return validationResult.data;
    } catch (error) {
      console.error('AI Deal Optimizer failed:', error);
      return {
        recommendedCommission: 12,
        welcomeBonus: 0,
        suggestedCode: `BARBER${nanoid(6).toUpperCase()}`,
        dealStructure: 'Flat 12% commission on all sales',
        reasoning: 'AI optimization failed - using safe default values',
      };
    }
  }

  async agentAutomation(candidateData: {
    name: string;
    email: string;
    niche: string;
    followers: number;
    website?: string;
  }): Promise<{
    affiliateID: string;
    referralCode: string;
    referralLink: string;
    emailSent: boolean;
    tasksCreated: string[];
    nextSteps: string[];
  }> {
    console.log('🤖 A-AUTO-205: Full-Automation Agent starting workflow...');

    try {
      const rankingPrompt = `Quick score (0-100) for this candidate: ${candidateData.name}, ${candidateData.followers} followers, ${candidateData.niche} niche. Return only number.`;
      const scoreResponse = await generateAIResponse(rankingPrompt, false);
      const score = parseInt(scoreResponse) || 50;

      console.log(`✅ Step 1: Scored candidate - ${score}/100`);

      const candidate = await affiliateService.createCandidate({
        Name: candidateData.name,
        Email: candidateData.email,
        Website: candidateData.website,
        Niche: candidateData.niche,
        Followers: candidateData.followers,
        Score: score,
        Source: 'AI_Discovery',
        Status: 'New',
      });

      console.log(`✅ Step 2: Created candidate record - ${candidate.CandidateID}`);

      const affiliate = await affiliateService.createAffiliate({
        Name: candidateData.name,
        Email: candidateData.email,
        Website: candidateData.website,
        Niche: candidateData.niche,
        Status: 'Pending',
        CommissionPct: score > 75 ? 15 : score > 50 ? 12 : 10,
      });

      console.log(`✅ Step 3: Created affiliate account - ${affiliate.AffiliateID}`);

      const referralLink = `https://hairoticmen.de/shop?ref=${affiliate.ReferralCode}`;

      const dealOpt = await this.agentDealOptimizer(candidate);
      const outreach = await this.agentOutreach(candidate, 
        `${dealOpt.recommendedCommission}% commission, €${dealOpt.welcomeBonus} welcome bonus`
      );

      console.log(`✅ Step 4: Generated personalized email`);

      await affiliateService.createOutreachMessage({
        CandidateID: candidate.CandidateID,
        AffiliateID: affiliate.AffiliateID,
        Subject: outreach.subject,
        Body: outreach.body,
        EmailTo: candidateData.email,
        Status: 'Draft',
      });

      console.log(`✅ Step 5: Saved outreach message (ready to send)`);

      const tasks: string[] = [];
      
      const followUpTask = await affiliateService.createTask({
        AffiliateID: affiliate.AffiliateID,
        CandidateID: candidate.CandidateID,
        Title: 'Follow-up on outreach email',
        Description: 'Check if candidate responded to initial outreach',
        Type: 'Follow-up',
        Priority: 'Medium',
        DueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
      tasks.push(followUpTask.TaskID);

      const reviewTask = await affiliateService.createTask({
        AffiliateID: affiliate.AffiliateID,
        Title: 'Review and approve new affiliate',
        Description: `Review ${candidateData.name} (Score: ${score}) and approve for activation`,
        Type: 'Review',
        Priority: score > 75 ? 'High' : 'Medium',
        DueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
      });
      tasks.push(reviewTask.TaskID);

      console.log(`✅ Step 6: Created ${tasks.length} automated tasks`);

      return {
        affiliateID: affiliate.AffiliateID,
        referralCode: affiliate.ReferralCode,
        referralLink,
        emailSent: false,
        tasksCreated: tasks,
        nextSteps: [
          'Review and approve affiliate account',
          'Send welcome email with referral link',
          'Setup tracking for first conversions',
          'Follow up in 3 days if no response',
        ],
      };
    } catch (error) {
      console.error('❌ A-AUTO-205: Automation failed:', error);
      throw new Error(`Automation agent failed: ${error}`);
    }
  }

  async suggestNiches(): Promise<string[]> {
    const prompt = `You are an AI niche suggestion assistant for HAIROTICMEN, a premium men's grooming and barber products brand.

Suggest 10 highly relevant target niches for affiliate marketing campaigns. Focus on:
- Men's grooming and personal care
- Beard care and styling
- Professional barbers and stylists
- Male lifestyle and fashion
- Related product categories

Return ONLY a JSON array of niche strings:
["niche 1", "niche 2", ...]`;

    try {
      const responseContent = await generateAIResponse(prompt, false);
      let jsonContent = responseContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const niches = JSON.parse(jsonContent);
      return Array.isArray(niches) ? niches : [];
    } catch (error) {
      console.error('AI Niche Suggestions failed:', error);
      return ["beard care products", "men's skincare", "barbershop supplies", "grooming kits", "professional hair styling"];
    }
  }

  async suggestCountries(niches: string[]): Promise<string[]> {
    const nichesList = niches.join(", ");
    const prompt = `You are an AI geographic targeting assistant for HAIROTICMEN.

Based on these niches: ${nichesList}

Suggest the 8 best countries to target for affiliate marketing campaigns. Consider:
- Market size for men's grooming products
- E-commerce infrastructure
- Audience demographics
- Language compatibility
- Shipping feasibility

Return ONLY a JSON array of country names:
["Country 1", "Country 2", ...]`;

    try {
      const responseContent = await generateAIResponse(prompt, false);
      let jsonContent = responseContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const countries = JSON.parse(jsonContent);
      return Array.isArray(countries) ? countries : [];
    } catch (error) {
      console.error('AI Country Suggestions failed:', error);
      return ["Germany", "USA", "UK", "France", "Netherlands"];
    }
  }

  async suggestPlatforms(niches: string[], personTypes: string[]): Promise<string[]> {
    const nichesList = niches.join(", ");
    const typesList = personTypes.length > 0 ? personTypes.join(", ") : "all types";
    
    const prompt = `You are an AI platform recommendation assistant for HAIROTICMEN.

Based on:
- Niches: ${nichesList}
- Person Types: ${typesList}

Recommend the top 3-5 social media platforms for affiliate discovery. Consider:
- Platform demographics
- Content format (video, photo, blog)
- Engagement rates
- Influencer presence

Return ONLY a JSON array of platform names:
["Platform 1", "Platform 2", ...]`;

    try {
      const responseContent = await generateAIResponse(prompt, false);
      let jsonContent = responseContent.trim();
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const platforms = JSON.parse(jsonContent);
      return Array.isArray(platforms) ? platforms : [];
    } catch (error) {
      console.error('AI Platform Suggestions failed:', error);
      return ["Instagram", "YouTube", "TikTok"];
    }
  }
}

export const affiliateAIAgents = new AffiliateAIAgents();
