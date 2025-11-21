import { parse } from 'csv-parse/sync';
import { nanoid } from 'nanoid';
import { sheetsService } from './sheets';
import type { AdsKPI, SocialMetric, AdsExport } from '@shared/schema';

interface ParsedAdsMetric {
  campaignId: string;
  date: string;
  impressions?: number;
  clicks?: number;
  spendEUR?: number;
  conversions?: number;
}

interface ParsedSocialMetric {
  postId: string;
  channel?: string;
  timestamp: string;
  impressions?: number;
  reach?: number;
  clicks?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  costEUR?: number;
}

interface CSVRow {
  [key: string]: string | number;
}

export async function importAdsMetricsCSV(csvContent: string): Promise<{
  rowsProcessed: number;
  kpisCreated: number;
  exportId: string;
}> {
  const exportId = `EXPORT-${nanoid(10)}`;
  const now = new Date().toISOString();

  try {
    const rows = parseCSV(csvContent);
    
    if (rows.length === 0) {
      throw new Error('CSV file is empty or has no data rows');
    }

    const detectedFormat = detectAdsCSVFormat(rows[0]);
    const adsMetrics: ParsedAdsMetric[] = rows.map(row => normalizeAdsRow(row, detectedFormat));
    const kpiRecords: AdsKPI[] = [];
    const campaignMap = new Map<string, Set<string>>();

    const aggregateMap = new Map<string, {
      impressions: number;
      clicks: number;
      spend: number;
      conversions: number;
    }>();

    for (const metric of adsMetrics) {
      if (!metric.campaignId || !metric.date) {
        continue;
      }

      const dateKey = `${metric.campaignId}|${metric.date}`;
      
      if (!aggregateMap.has(dateKey)) {
        aggregateMap.set(dateKey, {
          impressions: 0,
          clicks: 0,
          spend: 0,
          conversions: 0,
        });
      }

      const agg = aggregateMap.get(dateKey)!;
      agg.impressions += metric.impressions || 0;
      agg.clicks += metric.clicks || 0;
      agg.spend += metric.spendEUR || 0;
      agg.conversions += metric.conversions || 0;
    }

    for (const [dateKey, agg] of Array.from(aggregateMap.entries())) {
      const [campaignId, date] = dateKey.split('|');

      const kpi: AdsKPI = {
        CampaignID: campaignId,
        Date: date,
        Impressions: agg.impressions,
        Clicks: agg.clicks,
        SpendEUR: agg.spend,
        Conversions: agg.conversions,
        RevenueEUR: 0,
        CTR: calculateCTR(agg.clicks, agg.impressions),
        CPC: calculateCPC(agg.spend, agg.clicks),
        CPA: calculateCPA(agg.spend, agg.conversions),
        CPM: calculateCPM(agg.spend, agg.impressions),
        ROAS: 0,
        Notes: `Imported from ${exportId}`,
      };

      kpiRecords.push(kpi);
    }

    if (kpiRecords.length > 0) {
      await sheetsService.writeRows('Ads_KPIs', kpiRecords);
    }

    const exportRecord: AdsExport = {
      ExportID: exportId,
      CampaignID: '',
      Format: 'CSV',
      FileURL: '',
      Rows: rows.length,
      CreatedTS: now,
      Status: 'PROCESSED',
      Notes: `Imported ${kpiRecords.length} KPI records`,
    };
    await sheetsService.writeRows('Ads_Exports', [exportRecord]);

    await sheetsService.logToSheet(
      'INFO',
      'Marketing',
      `Imported ads metrics: ${kpiRecords.length} KPIs from ${rows.length} rows`
    );

    return {
      rowsProcessed: rows.length,
      kpisCreated: kpiRecords.length,
      exportId,
    };
  } catch (error: any) {
    await sheetsService.logToSheet(
      'ERROR',
      'Marketing',
      `Ads metrics import failed: ${error.message}`
    );
    throw error;
  }
}

export async function importSocialMetricsCSV(csvContent: string): Promise<{
  rowsProcessed: number;
  metricsCreated: number;
}> {
  try {
    const rows = parseCSV(csvContent);
    
    if (rows.length === 0) {
      throw new Error('CSV file is empty or has no data rows');
    }

    const detectedFormat = detectSocialCSVFormat(rows[0]);
    const socialMetrics: ParsedSocialMetric[] = rows.map(row => normalizeSocialRow(row, detectedFormat));
    const metricRecords: SocialMetric[] = [];
    const postMap = new Map<string, boolean>();

    const aggregateMap = new Map<string, {
      impressions: number;
      reach: number;
      clicks: number;
      likes: number;
      comments: number;
      shares: number;
      saves: number;
      cost: number;
      channel: string;
    }>();

    for (const metric of socialMetrics) {
      if (!metric.postId || !metric.timestamp) {
        continue;
      }

      const key = `${metric.postId}|${metric.timestamp}`;
      
      if (!aggregateMap.has(key)) {
        aggregateMap.set(key, {
          impressions: 0,
          reach: 0,
          clicks: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          cost: 0,
          channel: metric.channel || '',
        });
      }

      const agg = aggregateMap.get(key)!;
      agg.impressions += metric.impressions || 0;
      agg.reach += metric.reach || 0;
      agg.clicks += metric.clicks || 0;
      agg.likes += metric.likes || 0;
      agg.comments += metric.comments || 0;
      agg.shares += metric.shares || 0;
      agg.saves += metric.saves || 0;
      agg.cost += metric.costEUR || 0;
    }

    for (const [key, agg] of Array.from(aggregateMap.entries())) {
      const [postId, timestamp] = key.split('|');

      const record: SocialMetric = {
        PostID: postId,
        Channel: agg.channel,
        TS: timestamp,
        Impressions: agg.impressions,
        Reach: agg.reach,
        Clicks: agg.clicks,
        Likes: agg.likes,
        Comments: agg.comments,
        Shares: agg.shares,
        Saves: agg.saves,
        CTR: calculateCTR(agg.clicks, agg.impressions),
        CPC: 0,
        CPM: calculateCPM(agg.cost, agg.impressions),
        Cost_EUR: agg.cost,
        Revenue_EUR: 0,
        Notes: 'Imported from CSV',
      };

      metricRecords.push(record);
    }

    if (metricRecords.length > 0) {
      await sheetsService.writeRows('Social_Metrics', metricRecords);
    }

    await sheetsService.logToSheet(
      'INFO',
      'Marketing',
      `Imported social metrics: ${metricRecords.length} records from ${rows.length} rows`
    );

    return {
      rowsProcessed: rows.length,
      metricsCreated: metricRecords.length,
    };
  } catch (error: any) {
    await sheetsService.logToSheet(
      'ERROR',
      'Marketing',
      `Social metrics import failed: ${error.message}`
    );
    throw error;
  }
}

function parseCSV(csvContent: string): CSVRow[] {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relaxColumnCount: true,
    bom: true,
    delimiter: [',', ';', '\t'],
  }) as CSVRow[];
  
  return records;
}

function detectAdsCSVFormat(row: CSVRow): string {
  const keys = Object.keys(row).map(k => k.toLowerCase());
  
  if (keys.includes('campaign id') || keys.includes('campaign_id') || keys.includes('campaignid')) {
    return 'google_ads';
  } else if (keys.includes('campaign name') && keys.includes('impressions')) {
    return 'facebook_ads';
  } else if (keys.includes('adgroup') || keys.includes('ad group')) {
    return 'bing_ads';
  }
  
  return 'generic';
}

function detectSocialCSVFormat(row: CSVRow): string {
  const keys = Object.keys(row).map(k => k.toLowerCase());
  
  if (keys.includes('post id') || keys.includes('post_id') || keys.includes('postid')) {
    return 'meta';
  } else if (keys.includes('tweet id') || keys.includes('tweet_id')) {
    return 'twitter';
  } else if (keys.includes('pin id') || keys.includes('content id')) {
    return 'pinterest';
  }
  
  return 'generic';
}

function normalizeAdsRow(row: CSVRow, format: string): ParsedAdsMetric {
  const keysLower: Record<string, string> = {};
  for (const key in row) {
    keysLower[key.toLowerCase().replace(/\s+/g, '_')] = String(row[key]);
  }

  const campaignId = 
    keysLower['campaign_id'] || 
    keysLower['campaignid'] || 
    keysLower['campaign'] ||
    keysLower['campaign_name'] ||
    `CMP-${nanoid(8)}`;

  const date = normalizeDate(
    keysLower['date'] || 
    keysLower['day'] || 
    keysLower['period'] ||
    new Date().toISOString().split('T')[0]
  );

  return {
    campaignId,
    date,
    impressions: parseNumeric(keysLower['impressions'] || keysLower['impr']),
    clicks: parseNumeric(keysLower['clicks']),
    spendEUR: parseNumeric(keysLower['spend'] || keysLower['cost'] || keysLower['spend_eur']),
    conversions: parseNumeric(keysLower['conversions'] || keysLower['conv']),
  };
}

function normalizeSocialRow(row: CSVRow, format: string): ParsedSocialMetric {
  const keysLower: Record<string, string> = {};
  for (const key in row) {
    keysLower[key.toLowerCase().replace(/\s+/g, '_')] = String(row[key]);
  }

  const postId = 
    keysLower['post_id'] || 
    keysLower['postid'] || 
    keysLower['id'] ||
    keysLower['content_id'] ||
    `POST-${nanoid(8)}`;

  const timestamp = normalizeTimestamp(
    keysLower['timestamp'] || 
    keysLower['date'] || 
    keysLower['created_at'] ||
    new Date().toISOString()
  );

  return {
    postId,
    channel: keysLower['channel'] || keysLower['platform'] || '',
    timestamp,
    impressions: parseNumeric(keysLower['impressions'] || keysLower['views']),
    reach: parseNumeric(keysLower['reach'] || keysLower['unique_views']),
    clicks: parseNumeric(keysLower['clicks'] || keysLower['link_clicks']),
    likes: parseNumeric(keysLower['likes'] || keysLower['reactions']),
    comments: parseNumeric(keysLower['comments']),
    shares: parseNumeric(keysLower['shares'] || keysLower['retweets']),
    saves: parseNumeric(keysLower['saves'] || keysLower['bookmarks']),
    costEUR: parseNumeric(keysLower['cost'] || keysLower['spend'] || keysLower['cost_eur']),
  };
}

function parseNumeric(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  let str = String(value).trim();
  str = str.replace(/[€$£,]/g, '');
  str = str.replace(/%/g, '');
  
  const num = parseFloat(str);
  return isNaN(num) ? undefined : num;
}

function normalizeDate(value: string): string {
  if (!value) {
    return new Date().toISOString().split('T')[0];
  }

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function normalizeTimestamp(value: string): string {
  if (!value) {
    return new Date().toISOString();
  }

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function calculateCTR(clicks?: number, impressions?: number): number {
  if (clicks === undefined || impressions === undefined || impressions === 0) {
    return 0;
  }
  return (clicks / impressions) * 100;
}

function calculateCPC(spend?: number, clicks?: number): number {
  if (spend === undefined || clicks === undefined || clicks === 0) {
    return 0;
  }
  return spend / clicks;
}

function calculateCPA(spend?: number, conversions?: number): number {
  if (spend === undefined || conversions === undefined || conversions === 0) {
    return 0;
  }
  return spend / conversions;
}

function calculateCPM(spend?: number, impressions?: number): number {
  if (spend === undefined || impressions === undefined || impressions === 0) {
    return 0;
  }
  return (spend / impressions) * 1000;
}
