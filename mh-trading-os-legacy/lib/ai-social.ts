import OpenAI from "openai";
import { sheetsService } from './sheets';
import { nanoid } from 'nanoid';
import type { SocialCalendar, AIAgentsLog } from '@shared/schema';

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

const AGENT_ID = 'A-SOC-010';
const MODEL = 'gpt-5'; // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user

interface SocialPlanRequest {
  productLine: string;
  channel: 'Instagram' | 'LinkedIn' | 'Twitter' | 'Facebook';
  locale: 'de' | 'en';
  days: number; // Number of days to plan (typically 14)
  tone?: string; // Brand voice: professional, casual, playful, etc.
}

interface RewriteRequest {
  originalCaption: string;
  tone: string; // Target tone: professional, casual, playful, urgent, etc.
  locale: 'de' | 'en';
}

async function logAgentOperation(
  requestType: 'plan' | 'rewrite',
  inputSheets: string,
  outputSheets: string,
  status: 'pending' | 'completed' | 'failed',
  rowsCreated: number,
  promptTokens: number,
  completionTokens: number,
  error?: string
): Promise<void> {
  const totalTokens = promptTokens + completionTokens;
  // GPT-5 pricing (Nov 2025): €1.08/1M input, €8.65/1M output
  const costEUR = (promptTokens / 1000000) * 1.08 + (completionTokens / 1000000) * 8.65;

  const logEntry: Partial<AIAgentsLog> = {
    LogID: nanoid(12),
    AgentID: AGENT_ID,
    RequestType: requestType,
    InputSheets: inputSheets,
    OutputSheets: outputSheets,
    Status: status,
    CreatedTS: new Date().toISOString(),
    CompletedTS: status !== 'pending' ? new Date().toISOString() : undefined,
    RowsCreated: rowsCreated,
    PromptTokens: promptTokens,
    CompletionTokens: completionTokens,
    TotalTokens: totalTokens,
    CostEUR: costEUR,
    Notes: error || undefined,
  };

  await sheetsService.writeRows('AI_Agents_Log', [logEntry]);
}

export async function generateSocialPlan(request: SocialPlanRequest): Promise<SocialCalendar[]> {
  const startTime = Date.now();
  let usage = { promptTokens: 0, completionTokens: 0 };

  try {
    const lang = request.locale.toUpperCase();
    
    const prompt = `You are a social media content strategist. Generate a ${request.days}-day content calendar for ${request.channel}.

Product Line: ${request.productLine}
Channel: ${request.channel}
Language: ${lang === 'DE' ? 'German' : 'English'}
Tone: ${request.tone || 'professional but engaging'}
Days: ${request.days}

Generate a JSON array with ${request.days} posts. Each post should have:
{
  "scheduledDate": "YYYY-MM-DD",
  "hook": "Attention-grabbing opening line (1 sentence)",
  "caption": "Full post caption (2-4 paragraphs, ${request.channel === 'Twitter' ? '≤280 chars' : '100-200 words'})",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3"  // 5-10 relevant hashtags
}

Requirements:
- Vary post types: product features, tips, user benefits, behind-the-scenes, testimonials, educational
- Hook should be engaging and scroll-stopping
- Caption should provide value and include call-to-action
- Hashtags should be mix of popular and niche (5-10 tags)
- Use ${lang === 'DE' ? 'German' : 'English'} language
- Adapt tone to ${request.channel} best practices
- ${request.channel === 'LinkedIn' ? 'Professional, B2B focused' : request.channel === 'Instagram' ? 'Visual-first, lifestyle focused' : 'Conversational, quick tips'}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    usage.promptTokens = response.usage?.prompt_tokens || 0;
    usage.completionTokens = response.usage?.completion_tokens || 0;

    const resultText = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(resultText);
    const posts = Array.isArray(parsed.posts) ? parsed.posts : 
                 Array.isArray(parsed) ? parsed : 
                 [parsed];

    const baseDate = new Date();
    const calendarEntries: SocialCalendar[] = posts.map((post: any, index: number) => {
      let scheduledTS: string;
      try {
        if (post.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(post.scheduledDate)) {
          scheduledTS = new Date(post.scheduledDate).toISOString();
        } else {
          const futureDate = new Date(baseDate);
          futureDate.setDate(baseDate.getDate() + index);
          scheduledTS = futureDate.toISOString();
        }
      } catch (e) {
        const futureDate = new Date(baseDate);
        futureDate.setDate(baseDate.getDate() + index);
        scheduledTS = futureDate.toISOString();
      }

      return {
        PostID: nanoid(12),
        ScheduledTS: scheduledTS,
        Channel: request.channel,
        ProductLine: request.productLine,
        Hook: post.hook,
        Caption: post.caption,
        HashtagsCSV: post.hashtags,
        Status: 'draft',
        AssetIDsCSV: undefined,
        Locale: request.locale,
        ToneTags: request.tone,
        Notes: `Generated by ${AGENT_ID}`,
      };
    });

    if (calendarEntries.length > 0) {
      await sheetsService.writeRows('Social_Calendar', calendarEntries);
    }

    await logAgentOperation(
      'plan',
      'Social_Calendar, Social_Assets',
      'Social_Calendar',
      'completed',
      calendarEntries.length,
      usage.promptTokens,
      usage.completionTokens
    );

    return calendarEntries;
  } catch (error: any) {
    await logAgentOperation(
      'plan',
      'Social_Calendar, Social_Assets',
      'Social_Calendar',
      'failed',
      0,
      usage.promptTokens,
      usage.completionTokens,
      error.message
    );
    throw error;
  }
}

export async function rewriteCaption(request: RewriteRequest): Promise<{ caption: string; hook: string }> {
  const startTime = Date.now();
  let usage = { promptTokens: 0, completionTokens: 0 };

  try {
    const lang = request.locale.toUpperCase();
    
    const prompt = `You are a social media copywriter. Rewrite this caption in a ${request.tone} tone.

Original Caption:
${request.originalCaption}

Target Tone: ${request.tone}
Language: ${lang === 'DE' ? 'German' : 'English'}

Generate a JSON object with:
{
  "hook": "New attention-grabbing opening line",
  "caption": "Rewritten caption maintaining key points but with new tone"
}

Requirements:
- Maintain core message and call-to-action
- Adapt language to ${request.tone} tone
- DO NOT use emojis - text only
- Preserve hashtags if present
- ${lang === 'DE' ? 'Write in German' : 'Write in English'}`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    usage.promptTokens = response.usage?.prompt_tokens || 0;
    usage.completionTokens = response.usage?.completion_tokens || 0;

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');

    await logAgentOperation(
      'rewrite',
      'Social_Calendar',
      'Social_Calendar',
      'completed',
      0,
      usage.promptTokens,
      usage.completionTokens
    );

    return {
      hook: result.hook || '',
      caption: result.caption || '',
    };
  } catch (error: any) {
    await logAgentOperation(
      'rewrite',
      'Social_Calendar',
      'Social_Calendar',
      'failed',
      0,
      usage.promptTokens,
      usage.completionTokens,
      error.message
    );
    throw error;
  }
}
