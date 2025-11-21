/**
 * Social Media Agent - A-SOC-102
 * Generates social media content calendar and posts
 */

import { nanoid } from 'nanoid';
import type { GoogleSheetsService } from '../sheets';
import { runGuardrails } from '../ai-guardrails';
import { createDraftJob } from '../ai-approval-workflow';

export interface SocialCalendarInput {
  days: number; // Number of days to plan
  platforms: string[]; // Instagram, Facebook, Twitter
  locale: 'en' | 'de';
  tone?: 'professional' | 'friendly' | 'playful';
}

/**
 * Task: plan-calendar
 * Creates a 14-day social media calendar
 */
export async function planCalendar(
  sheetsService: GoogleSheetsService,
  input: SocialCalendarInput
): Promise<{ jobId: string; posts: number; guardrailsPassed: boolean }> {
  const now = new Date().toISOString();
  
  // 1. Get product data for content ideas
  const products = await sheetsService.readSheet<any>('FinalPriceList');
  const topProducts = products.slice(0, 10); // Top 10 products
  
  // 2. Generate post ideas (simplified - in real version would call OpenAI GPT-4)
  const posts = [];
  const daysToGenerate = Math.min(input.days || 14, 30);
  
  for (let i = 0; i < daysToGenerate; i++) {
    const postDate = new Date();
    postDate.setDate(postDate.getDate() + i);
    
    const product = topProducts[i % topProducts.length];
    const platforms = input.platforms || ['Instagram', 'Facebook'];
    
    for (const platform of platforms) {
      posts.push({
        PostID: `POST-${nanoid(8)}`,
        JobID: '', // Will be set below
        Date: postDate.toISOString().split('T')[0],
        Platform: platform,
        PostType: i % 3 === 0 ? 'Product' : i % 3 === 1 ? 'Educational' : 'Engagement',
        Caption: `Discover ${product?.Name || 'our products'} - perfect for your daily routine! 🧔✨`,
        Hashtags: '#beardcare #grooming #mensgrooming',
        ImageURL: product?.ImageURL || '',
        Status: 'draft',
        ScheduledTS: postDate.toISOString(),
        Locale: input.locale,
      });
    }
  }
  
  // 3. Run guardrails
  const guardrailResult = await runGuardrails(
    'A-SOC-102',
    'plan-calendar',
    {
      content: posts.map(p => p.Caption).join('\n'),
      tone: input.tone || 'friendly',
    },
    sheetsService
  );
  
  // 4. Create draft job
  const jobId = await createDraftJob(
    sheetsService,
    'A-SOC-102',
    'plan-calendar',
    JSON.stringify(input),
    JSON.stringify({ posts, guardrailResult }),
    guardrailResult.passed,
    true
  );
  
  // 5. Write to draft table
  const draftsWithJobId = posts.map(p => ({ ...p, JobID: jobId }));
  await sheetsService.writeRows('Social_Calendar_Draft', draftsWithJobId);
  
  await sheetsService.logToSheet(
    'INFO',
    'AI-Social',
    `Created ${posts.length} social posts (Job: ${jobId}, Guardrails: ${guardrailResult.passed ? 'PASSED' : 'FAILED'})`
  );
  
  return {
    jobId,
    posts: posts.length,
    guardrailsPassed: guardrailResult.passed
  };
}
