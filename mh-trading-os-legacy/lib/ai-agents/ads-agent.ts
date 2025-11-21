/**
 * Ads Agent - A-ADS-105
 * Google Ads campaign management and optimization
 */

import { nanoid } from 'nanoid';
import type { GoogleSheetsService } from '../sheets';
import { runGuardrails } from '../ai-guardrails';
import { createDraftJob } from '../ai-approval-workflow';

export interface AdsCSVInput {
  budget?: number; // Daily budget in EUR
  locale: 'en' | 'de';
  campaignType?: 'search' | 'shopping' | 'display';
}

/**
 * Task: generate-ads-csv
 * Generates Google Ads CSV for import
 */
export async function generateAdsCSV(
  sheetsService: GoogleSheetsService,
  input: AdsCSVInput
): Promise<{ jobId: string; ads: number; guardrailsPassed: boolean }> {
  const now = new Date().toISOString();
  
  // 1. Get SEO keywords for ad targeting
  const keywords = await sheetsService.readSheet<any>('SEO_Keywords');
  const topKeywords = keywords
    .filter((k: any) => k.Locale === input.locale)
    .slice(0, 20);
  
  // 2. Generate ad campaigns (simplified - in real version would optimize with OpenAI)
  const ads = [];
  const campaignBudget = input.budget || 50; // EUR per day
  
  for (const keyword of topKeywords.slice(0, 10)) {
    ads.push({
      AdID: `AD-${nanoid(8)}`,
      JobID: '', // Will be set below
      CampaignName: `Beard Care - ${input.locale.toUpperCase()}`,
      AdGroupName: keyword.Keyword?.substring(0, 30) || 'Beard Products',
      Keyword: keyword.Keyword,
      MatchType: 'Phrase',
      MaxCPC: (Math.random() * 1.5 + 0.5).toFixed(2), // €0.50 - €2.00
      Headline1: `Premium ${keyword.Keyword?.split(' ')[0] || 'Beard Care'}`,
      Headline2: input.locale === 'de' ? 'Jetzt kaufen' : 'Shop Now',
      Description: input.locale === 'de' 
        ? 'Natürliche Bartpflege. Kostenloser Versand ab €30.'
        : 'Natural beard care. Free shipping over €30.',
      FinalURL: `https://example.com/products/${keyword.RelatedSKU || 'all'}`,
      DailyBudget: campaignBudget,
      Status: 'pending',
      CreatedTS: now,
    });
  }
  
  // 3. Run guardrails (budget cap & brand voice)
  const totalBudget = ads.reduce((sum, ad) => sum + parseFloat(ad.DailyBudget.toString()), 0);
  
  const guardrailResult = await runGuardrails(
    'A-ADS-105',
    'generate-ads-csv',
    {
      content: ads.map(a => `${a.Headline1} ${a.Headline2} ${a.Description}`).join('\n'),
      budgetTotal: totalBudget,
      budgetMax: 500, // Max €500/day across all campaigns
    },
    sheetsService
  );
  
  // 4. Create draft job
  const jobId = await createDraftJob(
    sheetsService,
    'A-ADS-105',
    'generate-ads-csv',
    JSON.stringify(input),
    JSON.stringify({ ads, totalBudget, guardrailResult }),
    guardrailResult.passed,
    true
  );
  
  // 5. Write to draft table
  const draftsWithJobId = ads.map(a => ({ ...a, JobID: jobId }));
  await sheetsService.writeRows('Ads_Campaigns_Draft', draftsWithJobId);
  
  await sheetsService.logToSheet(
    'INFO',
    'AI-Ads',
    `Created ${ads.length} ad campaigns (Job: ${jobId}, Budget: €${totalBudget}, Guardrails: ${guardrailResult.passed ? 'PASSED' : 'FAILED'})`
  );
  
  return {
    jobId,
    ads: ads.length,
    guardrailsPassed: guardrailResult.passed
  };
}
