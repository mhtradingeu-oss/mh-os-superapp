import { GoogleSheetsService } from './sheets';
import { buildICS, buildCSV, type ICSEvent } from './marketing-utils';
import { socialCalendarSchema, socialCalendarInsertSchema, type SocialCalendar, type SocialCalendarInsert } from '@shared/schema';
import { nanoid } from 'nanoid';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface SocialFilters {
  channel?: string;
  productLine?: string;
  locale?: string;
  status?: string;
}

export async function getCalendarPosts(
  sheetsService: GoogleSheetsService,
  range?: DateRange,
  filters?: SocialFilters
): Promise<SocialCalendar[]> {
  const posts = await sheetsService.readSheet<SocialCalendar>('Social_Calendar');

  return posts.filter(post => {
    if (range) {
      const postDate = new Date(post.ScheduledTS);
      if (postDate < range.start || postDate > range.end) return false;
    }

    if (filters?.channel && post.Channel !== filters.channel) return false;
    if (filters?.productLine && post.ProductLine !== filters.productLine) return false;
    if (filters?.locale && post.Locale !== filters.locale) return false;
    if (filters?.status && post.Status !== filters.status) return false;

    return true;
  });
}

export async function createPost(
  sheetsService: GoogleSheetsService,
  post: Partial<SocialCalendar>
): Promise<SocialCalendar> {
  const now = new Date().toISOString();

  const payload = socialCalendarInsertSchema.parse({
    PostID: nanoid(),
    ScheduledTS: post.ScheduledTS || now,
    Channel: post.Channel,
    ProductLine: post.ProductLine,
    Hook: post.Hook,
    Caption: post.Caption,
    HashtagsCSV: post.HashtagsCSV,
    AssetIDsCSV: post.AssetIDsCSV,
    Locale: post.Locale,
    CreatedTS: now,
    Notes: post.Notes,
  });

  await sheetsService.writeRows('Social_Calendar', [payload]);
  return socialCalendarSchema.parse(payload);
}

export async function updatePost(
  sheetsService: GoogleSheetsService,
  postId: string,
  updates: Partial<SocialCalendar>
): Promise<void> {
  await sheetsService.updateRow('Social_Calendar', 'PostID', postId, updates);
}

export async function deletePost(
  sheetsService: GoogleSheetsService,
  postId: string
): Promise<void> {
  await sheetsService.updateRow('Social_Calendar', 'PostID', postId, {
    Status: 'deleted',
  });
}

export async function exportIcs(
  sheetsService: GoogleSheetsService,
  range: DateRange
): Promise<{ ics: string; fileName: string }> {
  const posts = await getCalendarPosts(sheetsService, range, { status: 'scheduled' });

  const events: ICSEvent[] = posts.map(post => ({
    uid: post.PostID,
    summary: `${post.Channel}: ${post.Hook || post.ProductLine}`,
    description: post.Caption || '',
    start: new Date(post.ScheduledTS),
    location: post.Channel || '',
    url: post.AssetIDsCSV || '',
  }));

  const ics = buildICS(events);
  const fileName = `social-calendar-${Date.now()}.ics`;

  return { ics, fileName };
}

export async function exportCsv(
  sheetsService: GoogleSheetsService,
  range: DateRange
): Promise<{ csv: string; fileName: string }> {
  const posts = await getCalendarPosts(sheetsService, range);

  const headers = [
    'PostID', 'ScheduledTS', 'Channel', 'ProductLine', 'Hook', 'Caption',
    'Hashtags', 'Status', 'Assets', 'Locale', 'CreatedTS', 'Notes'
  ];

  const rows = posts.map(post => [
    post.PostID,
    post.ScheduledTS,
    post.Channel || '',
    post.ProductLine || '',
    post.Hook || '',
    post.Caption || '',
    post.HashtagsCSV || '',
    post.Status || '',
    post.AssetIDsCSV || '',
    post.Locale || '',
    post.CreatedTS || '',
    post.Notes || '',
  ]);

  const csv = buildCSV(headers, rows);
  const fileName = `social-calendar-${Date.now()}.csv`;

  return { csv, fileName };
}
