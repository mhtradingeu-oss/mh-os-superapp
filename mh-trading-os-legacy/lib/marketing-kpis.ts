import { sheetsService } from './sheets';
import type { AdsKPI, Order, UTMBuilder } from '@shared/schema';

interface RevenueByUTM {
  utmCampaign: string;
  totalRevenue: number;
  orderCount: number;
}

interface DailyKPI {
  campaignId: string;
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  cpm: number;
  roas: number;
}

interface WeeklyKPI {
  campaignId: string;
  weekStart: string;
  weekEnd: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  cpm: number;
  roas: number;
}

interface MonthlyKPI {
  campaignId: string;
  month: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  cpm: number;
  roas: number;
}

const CACHE_DURATION_MS = 5 * 60 * 1000;
let revenueCache: { data: Map<string, RevenueByUTM> | null; timestamp: number } = {
  data: null,
  timestamp: 0,
};

export async function updateKPIsWithRevenue(
  campaignId?: string,
  startDate?: string,
  endDate?: string
): Promise<{ updated: number }> {
  try {
    const [adsKPIs, orders, utmLinks, campaigns] = await Promise.all([
      sheetsService.readSheet('Ads_KPIs'),
      sheetsService.readSheet('Orders'),
      sheetsService.readSheet('UTM_Builder'),
      sheetsService.readSheet('Ads_Campaigns'),
    ]);

    const revenueMap = await getRevenueByUTMCampaign(orders, utmLinks);
    const campaignToUTM = buildCampaignToUTMMap(campaigns);
    
    const campaignDaysMap = new Map<string, number>();
    for (const kpiRow of adsKPIs) {
      const kpi = kpiRow as any;
      campaignDaysMap.set(kpi.CampaignID, (campaignDaysMap.get(kpi.CampaignID) || 0) + 1);
    }

    const campaignsToUpdate = new Set<string>();
    for (const kpiRow of adsKPIs) {
      const kpi = kpiRow as any;
      
      if (campaignId && kpi.CampaignID !== campaignId) continue;
      if (startDate && kpi.Date < startDate) continue;
      if (endDate && kpi.Date > endDate) continue;
      
      const utmCampaign = campaignToUTM.get(kpi.CampaignID);
      if (!utmCampaign) continue;

      const revenueData = revenueMap.get(utmCampaign);
      if (!revenueData) continue;

      campaignsToUpdate.add(kpi.CampaignID);
    }

    let updated = 0;
    const rowsToUpdate: { campaignId: string; date: string; updates: any }[] = [];
    
    for (const kpiRow of adsKPIs) {
      const kpi = kpiRow as any;
      
      if (!campaignsToUpdate.has(kpi.CampaignID)) continue;
      
      const utmCampaign = campaignToUTM.get(kpi.CampaignID);
      if (!utmCampaign) continue;

      const revenueData = revenueMap.get(utmCampaign);
      if (!revenueData) continue;

      const totalCampaignDays = campaignDaysMap.get(kpi.CampaignID) || 1;
      const dailyRevenue = revenueData.totalRevenue / totalCampaignDays;
      
      const impressions = parseFloat(kpi.Impressions || '0');
      const clicks = parseFloat(kpi.Clicks || '0');
      const spend = parseFloat(kpi.SpendEUR || '0');
      const conversions = parseFloat(kpi.Conversions || '0');

      const updates = {
        RevenueEUR: dailyRevenue,
        CTR: impressions > 0 ? (clicks / impressions) * 100 : 0,
        CPC: clicks > 0 ? spend / clicks : 0,
        CPA: conversions > 0 ? spend / conversions : 0,
        CPM: impressions > 0 ? (spend / impressions) * 1000 : 0,
        ROAS: spend > 0 ? dailyRevenue / spend : 0,
      };

      rowsToUpdate.push({
        campaignId: kpi.CampaignID,
        date: kpi.Date,
        updates,
      });
    }

    const allKPIsForUpdate = await sheetsService.readSheet('Ads_KPIs');
    
    for (const { campaignId: cid, date, updates } of rowsToUpdate) {
      const matchingRowIndex = allKPIsForUpdate.findIndex((row: any) => 
        row.CampaignID === cid && row.Date === date
      );
      
      if (matchingRowIndex >= 0) {
        Object.assign(allKPIsForUpdate[matchingRowIndex], updates);
        updated++;
      }
    }

    if (updated > 0) {
      const sheets = await (await import('./sheets')).sheetsService.getClient();
      const { SPREADSHEET_ID } = await import('../config');
      
      const headers = Object.keys(allKPIsForUpdate[0] || {});
      const values = [
        headers,
        ...allKPIsForUpdate.map((row: any) => headers.map(h => row[h] ?? ''))
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Ads_KPIs!A1`,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
    }

    await sheetsService.logToSheet(
      'INFO',
      'Marketing',
      `Updated ${updated} KPI records with revenue data`
    );

    return { updated };
  } catch (error: any) {
    await sheetsService.logToSheet(
      'ERROR',
      'Marketing',
      `KPI revenue update failed: ${error.message}`
    );
    throw error;
  }
}

export async function calculateDailyKPIs(
  campaignId?: string,
  startDate?: string,
  endDate?: string
): Promise<DailyKPI[]> {
  const adsKPIs = await sheetsService.readSheet('Ads_KPIs');
  
  let filtered = adsKPIs.filter((kpi: any) => {
    if (campaignId && kpi.CampaignID !== campaignId) return false;
    if (startDate && kpi.Date < startDate) return false;
    if (endDate && kpi.Date > endDate) return false;
    return true;
  });

  return filtered.map((kpi: any) => ({
    campaignId: kpi.CampaignID,
    date: kpi.Date,
    impressions: parseFloat(kpi.Impressions || '0'),
    clicks: parseFloat(kpi.Clicks || '0'),
    spend: parseFloat(kpi.SpendEUR || '0'),
    conversions: parseFloat(kpi.Conversions || '0'),
    revenue: parseFloat(kpi.RevenueEUR || '0'),
    ctr: parseFloat(kpi.CTR || '0'),
    cpc: parseFloat(kpi.CPC || '0'),
    cpa: parseFloat(kpi.CPA || '0'),
    cpm: parseFloat(kpi.CPM || '0'),
    roas: parseFloat(kpi.ROAS || '0'),
  }));
}

export async function calculateWeeklyKPIs(
  campaignId?: string,
  year?: number
): Promise<WeeklyKPI[]> {
  const dailyKPIs = await calculateDailyKPIs(campaignId);
  
  const weeklyMap = new Map<string, DailyKPI[]>();
  
  for (const kpi of dailyKPIs) {
    const date = new Date(kpi.date);
    
    if (year && date.getFullYear() !== year) continue;
    
    const weekStart = getWeekStart(date);
    const key = `${kpi.campaignId}|${weekStart.toISOString().split('T')[0]}`;
    
    if (!weeklyMap.has(key)) {
      weeklyMap.set(key, []);
    }
    weeklyMap.get(key)!.push(kpi);
  }

  const weeklyKPIs: WeeklyKPI[] = [];
  const entries = Array.from(weeklyMap.entries());
  for (const [key, kpis] of entries) {
    const [campaignId, weekStartStr] = key.split('|');
    const weekStart = new Date(weekStartStr);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const aggregated = aggregateKPIs(kpis);
    
    weeklyKPIs.push({
      campaignId,
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: weekEnd.toISOString().split('T')[0],
      ...aggregated,
    });
  }

  return weeklyKPIs;
}

export async function calculateMonthlyKPIs(
  campaignId?: string,
  year?: number
): Promise<MonthlyKPI[]> {
  const dailyKPIs = await calculateDailyKPIs(campaignId);
  
  const monthlyMap = new Map<string, DailyKPI[]>();
  
  for (const kpi of dailyKPIs) {
    const date = new Date(kpi.date);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const key = `${kpi.campaignId}|${month}`;
    
    if (year && date.getFullYear() !== year) continue;
    
    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, []);
    }
    monthlyMap.get(key)!.push(kpi);
  }

  const monthlyKPIs: MonthlyKPI[] = [];
  const entries = Array.from(monthlyMap.entries());
  for (const [key, kpis] of entries) {
    const [campaignId, month] = key.split('|');
    const aggregated = aggregateKPIs(kpis);
    
    monthlyKPIs.push({
      campaignId,
      month,
      ...aggregated,
    });
  }

  return monthlyKPIs;
}

async function getRevenueByUTMCampaign(
  orders: any[],
  utmLinks: any[]
): Promise<Map<string, RevenueByUTM>> {
  const now = Date.now();
  if (revenueCache.data && (now - revenueCache.timestamp) < CACHE_DURATION_MS) {
    return revenueCache.data;
  }

  const revenueMap = new Map<string, RevenueByUTM>();

  for (const order of orders) {
    if (!order.Total || order.Total === 0) continue;

    const utmCampaign = extractUTMCampaignFromOrder(order, utmLinks);
    if (!utmCampaign) continue;

    const existing = revenueMap.get(utmCampaign) || {
      utmCampaign,
      totalRevenue: 0,
      orderCount: 0,
    };

    existing.totalRevenue += parseFloat(order.Total || '0');
    existing.orderCount += 1;

    revenueMap.set(utmCampaign, existing);
  }

  revenueCache = {
    data: revenueMap,
    timestamp: now,
  };

  return revenueMap;
}

function extractUTMCampaignFromOrder(order: any, utmLinks: any[]): string | null {
  if (order.UTM_Campaign) {
    return order.UTM_Campaign;
  }

  if (order.OrderID) {
    const matchingUTM = utmLinks.find((utm: any) => 
      utm.Notes?.includes(order.OrderID) || 
      utm.FinalURL?.includes(order.OrderID)
    );
    
    if (matchingUTM && matchingUTM.Campaign) {
      return matchingUTM.Campaign;
    }
  }

  return null;
}

function buildCampaignToUTMMap(campaigns: any[]): Map<string, string> {
  const map = new Map<string, string>();
  
  for (const campaign of campaigns) {
    if (campaign.CampaignID && campaign.UTM_Campaign) {
      map.set(campaign.CampaignID, campaign.UTM_Campaign);
    }
  }

  return map;
}

function aggregateKPIs(kpis: DailyKPI[]): {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  cpm: number;
  roas: number;
} {
  const totals = kpis.reduce(
    (acc, kpi) => ({
      impressions: acc.impressions + kpi.impressions,
      clicks: acc.clicks + kpi.clicks,
      spend: acc.spend + kpi.spend,
      conversions: acc.conversions + kpi.conversions,
      revenue: acc.revenue + kpi.revenue,
    }),
    { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 }
  );

  return {
    ...totals,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
  };
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function clearRevenueCache(): void {
  revenueCache = { data: null, timestamp: 0 };
}
