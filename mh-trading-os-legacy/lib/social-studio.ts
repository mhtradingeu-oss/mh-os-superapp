import { sheetsService } from './sheets';
import { nanoid } from 'nanoid';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export interface PlanCalendarInput {
  line: string;
  cadencePerWeek: number;
  locale: 'en' | 'de';
  channel?: string;
}

export interface PlanCalendarResult {
  postsCreated: number;
  posts: any[];
  errors: string[];
}

export interface AISuggestPostInput {
  line: string;
  locale: 'en' | 'de';
  tone: 'professional' | 'friendly' | 'playful';
  angle?: string;
}

export interface AISuggestPostResult {
  hook: string;
  caption: string;
  hashtags: string[];
}

export interface AttachAssetsInput {
  postId: string;
  assetIds: string[];
}

export interface ExportCalendarInput {
  channel?: string;
  week?: number;
  format: 'csv' | 'ics';
}

export async function planCalendar(input: PlanCalendarInput): Promise<PlanCalendarResult> {
  const result: PlanCalendarResult = {
    postsCreated: 0,
    posts: [],
    errors: [],
  };

  try {
    const now = new Date();
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    const rawTotalPosts = input.cadencePerWeek * 2;
    const totalPosts = Math.max(6, Math.min(10, rawTotalPosts));
    const daysBetweenPosts = 14 / totalPosts;

    for (let i = 0; i < totalPosts; i++) {
      try {
        const scheduledDate = new Date(now.getTime() + i * daysBetweenPosts * 24 * 60 * 60 * 1000);
        const postId = `POST-${Date.now()}-${nanoid(6)}`;
        
        const suggestion = await aiSuggestPost({
          line: input.line,
          locale: input.locale,
          tone: 'friendly',
        });

        const post = {
          PostID: postId,
          ScheduledTS: scheduledDate.toISOString(),
          Channel: input.channel || 'Instagram',
          ProductLine: input.line,
          Hook: suggestion.hook,
          Caption: suggestion.caption,
          HashtagsCSV: suggestion.hashtags.join(', '),
          Status: 'DRAFT',
          AssetIDsCSV: '',
          Locale: input.locale,
          CreatedTS: new Date().toISOString(),
          PublishedTS: '',
          Notes: `Auto-generated via planCalendar`,
        };

        result.posts.push(post);
        result.postsCreated++;
      } catch (error: any) {
        result.errors.push(`Failed to generate post ${i + 1}: ${error.message}`);
      }
    }

    if (result.posts.length > 0) {
      await sheetsService.writeRows('Social_Calendar', result.posts);
      await sheetsService.logToSheet(
        'INFO',
        'Social',
        `Created ${result.postsCreated} posts for ${input.line} (${input.locale})`
      );
    }
  } catch (error: any) {
    result.errors.push(`Plan calendar failed: ${error.message}`);
    await sheetsService.logToSheet('ERROR', 'Social', `Plan calendar failed: ${error.message}`);
  }

  return result;
}

export async function aiSuggestPost(input: AISuggestPostInput): Promise<AISuggestPostResult> {
  const systemPrompt = input.locale === 'de'
    ? `Du bist ein kreativer Social Media Manager. Erstelle ansprechende Posts für ${input.line}.`
    : `You are a creative social media manager. Create engaging posts for ${input.line}.`;

  const userPrompt = input.locale === 'de'
    ? `Erstelle einen Social Media Post für ${input.line}.
Ton: ${input.tone}
${input.angle ? `Winkel: ${input.angle}` : ''}

Gib zurück im JSON-Format:
{
  "hook": "Ein aufmerksamkeitsstarker Hook (max 50 Zeichen)",
  "caption": "Eine ansprechende Caption (max 200 Zeichen)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}

Wichtig:
- Verwende KEINE Emojis
- Hook sollte Neugier wecken
- Caption sollte Mehrwert bieten
- Hashtags sollten relevant und spezifisch sein
- Respektiere GDPR/Datenschutz
- Keine irreführenden Behauptungen`
    : `Create a social media post for ${input.line}.
Tone: ${input.tone}
${input.angle ? `Angle: ${input.angle}` : ''}

Return in JSON format:
{
  "hook": "An attention-grabbing hook (max 50 characters)",
  "caption": "An engaging caption (max 200 characters)",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3", "hashtag4", "hashtag5"]
}

Important:
- DO NOT use emojis
- Hook should spark curiosity
- Caption should provide value
- Hashtags should be relevant and specific
- Respect GDPR/privacy
- No misleading claims`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    const parsed = JSON.parse(content);
    return {
      hook: parsed.hook || '',
      caption: parsed.caption || '',
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
    };
  } catch (error: any) {
    await sheetsService.logToSheet('ERROR', 'Social', `AI suggest post failed: ${error.message}`);
    throw error;
  }
}

export async function attachAssets(input: AttachAssetsInput): Promise<{ ok: boolean; message: string }> {
  try {
    const [posts, allAssets] = await Promise.all([
      sheetsService.readSheet('Social_Calendar'),
      sheetsService.readSheet('Social_Assets'),
    ]);

    const post: any = posts.find((p: any) => p.PostID === input.postId);
    if (!post) {
      throw new Error(`Post ${input.postId} not found`);
    }

    const availableAssetIds = new Set(allAssets.map((a: any) => a.AssetID));
    const invalidAssets = input.assetIds.filter(id => !availableAssetIds.has(id));
    
    if (invalidAssets.length > 0) {
      throw new Error(`Invalid asset IDs: ${invalidAssets.join(', ')}. These assets do not exist in Social_Assets.`);
    }

    const existingAssets = post.AssetIDsCSV ? post.AssetIDsCSV.split(',').map((a: string) => a.trim()) : [];
    const allLinkedAssets = [...existingAssets, ...input.assetIds];
    const uniqueAssets = Array.from(new Set(allLinkedAssets));

    if (uniqueAssets.length < 3) {
      throw new Error(`Minimum 3 assets required. Currently ${uniqueAssets.length} assets would be attached.`);
    }

    await sheetsService.updateRow('Social_Calendar', 'PostID', input.postId, {
      AssetIDsCSV: uniqueAssets.join(', '),
    });

    await sheetsService.logToSheet(
      'INFO',
      'Social',
      `Attached ${input.assetIds.length} assets to post ${input.postId}`
    );

    return {
      ok: true,
      message: `Attached ${input.assetIds.length} assets to post ${input.postId}`,
    };
  } catch (error: any) {
    await sheetsService.logToSheet('ERROR', 'Social', `Attach assets failed: ${error.message}`);
    throw error;
  }
}

export async function previewPost(postId: string): Promise<any> {
  try {
    const posts = await sheetsService.readSheet('Social_Calendar');
    const post: any = posts.find((p: any) => p.PostID === postId);

    if (!post) {
      throw new Error(`Post ${postId} not found`);
    }

    let assets: any[] = [];
    if (post.AssetIDsCSV) {
      const assetIds = String(post.AssetIDsCSV).split(',').map((a: string) => a.trim());
      const allAssets = await sheetsService.readSheet('Social_Assets');
      assets = allAssets.filter((a: any) => assetIds.includes(a.AssetID));
    }

    return {
      post,
      assets,
      preview: {
        hook: String(post.Hook || ''),
        caption: String(post.Caption || ''),
        hashtags: post.HashtagsCSV ? String(post.HashtagsCSV).split(',').map((h: string) => h.trim()) : [],
        scheduledTS: String(post.ScheduledTS || ''),
        channel: String(post.Channel || ''),
        status: String(post.Status || 'DRAFT'),
      },
    };
  } catch (error: any) {
    await sheetsService.logToSheet('ERROR', 'Social', `Preview post failed: ${error.message}`);
    throw error;
  }
}

export async function exportCalendar(input: ExportCalendarInput): Promise<string> {
  try {
    let posts = await sheetsService.readSheet('Social_Calendar');

    if (input.channel) {
      posts = posts.filter((p: any) => p.Channel === input.channel);
    }

    if (input.week !== undefined) {
      const now = new Date();
      const weekStart = new Date(now.getTime() + input.week * 7 * 24 * 60 * 60 * 1000);
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      posts = posts.filter((p: any) => {
        const scheduledDate = new Date(p.ScheduledTS);
        return scheduledDate >= weekStart && scheduledDate < weekEnd;
      });
    }

    if (input.format === 'csv') {
      return generateCSV(posts);
    } else {
      return generateICS(posts);
    }
  } catch (error: any) {
    await sheetsService.logToSheet('ERROR', 'Social', `Export calendar failed: ${error.message}`);
    throw error;
  }
}

function generateCSV(posts: any[]): string {
  const headers = [
    'PostID',
    'ScheduledTS',
    'Channel',
    'ProductLine',
    'Hook',
    'Caption',
    'HashtagsCSV',
    'Status',
    'AssetIDsCSV',
  ];

  const rows = posts.map((post) =>
    headers.map((h) => {
      const value = post[h] || '';
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function generateICS(posts: any[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MH Trading OS//Social Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const post of posts) {
    const uid = `${post.PostID}@mhtradingos.com`;
    const dtstart = post.ScheduledTS.replace(/[-:]/g, '').replace(/\.\d+/, '').split('.')[0] + 'Z';
    const summary = post.Hook || post.Caption || 'Social Media Post';
    const description = `${post.Caption || ''}\\n\\nHashtags: ${post.HashtagsCSV || ''}\\nChannel: ${post.Channel || ''}`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${dtstart}`);
    lines.push(`DTSTART:${dtstart}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`STATUS:${post.Status === 'SCHEDULED' ? 'CONFIRMED' : 'TENTATIVE'}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
