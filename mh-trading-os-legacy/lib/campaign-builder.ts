import { GoogleSheetsService } from './sheets';
import { buildCSV } from './marketing-utils';
import {
  adsCampaignSchema,
  adsCampaignInsertSchema,
  adsAdGroupSchema,
  adsAdGroupInsertSchema,
  adsCreativeSchema,
  adsCreativeInsertSchema,
  type AdsCampaign,
  type AdsCampaignInsert,
  type AdsAdGroup,
  type AdsAdGroupInsert,
  type AdsCreative,
  type AdsCreativeInsert,
} from '@shared/schema';
import { nanoid } from 'nanoid';

export interface CreateCampaignRequest {
  name: string;
  objective?: string;
  locale?: string;
  network?: string;
  dailyBudget_EUR?: number;
  bidStrategy?: string;
  startDate?: string;
  endDate?: string;
  utmParams?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
}

export interface AdGroupMutation {
  action: 'create' | 'update' | 'delete';
  adGroupId?: string;
  data?: Partial<AdsAdGroup>;
}

export interface CreativeMutation {
  action: 'create' | 'update' | 'delete';
  creativeId?: string;
  data?: Partial<AdsCreative>;
}

export async function createCampaign(
  sheetsService: GoogleSheetsService,
  request: CreateCampaignRequest
): Promise<AdsCampaign> {
  const payload = adsCampaignInsertSchema.parse({
    CampaignID: nanoid(),
    Name: request.name,
    Objective: request.objective,
    Locale: request.locale,
    Network: request.network,
    DailyBudget_EUR: request.dailyBudget_EUR,
    BidStrategy: request.bidStrategy,
    StartDate: request.startDate,
    EndDate: request.endDate,
    UTM_Source: request.utmParams?.source,
    UTM_Medium: request.utmParams?.medium,
    UTM_Campaign: request.utmParams?.campaign,
  });

  await sheetsService.writeRows('Ads_Campaigns', [payload]);
  return adsCampaignSchema.parse(payload);
}

export async function getCampaigns(
  sheetsService: GoogleSheetsService,
  filters?: { status?: string; locale?: string }
): Promise<AdsCampaign[]> {
  const campaigns = await sheetsService.readSheet<AdsCampaign>('Ads_Campaigns');

  if (!filters) return campaigns;

  return campaigns.filter(campaign => {
    if (filters.status && campaign.Status !== filters.status) return false;
    if (filters.locale && campaign.Locale !== filters.locale) return false;
    return true;
  });
}

export async function updateCampaign(
  sheetsService: GoogleSheetsService,
  campaignId: string,
  updates: Partial<AdsCampaign>
): Promise<void> {
  await sheetsService.updateRow('Ads_Campaigns', 'CampaignID', campaignId, updates);
}

export async function manageAdGroups(
  sheetsService: GoogleSheetsService,
  campaignId: string,
  mutations: AdGroupMutation[]
): Promise<{ created: number; updated: number; deleted: number }> {
  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const mutation of mutations) {
    switch (mutation.action) {
      case 'create': {
        if (!mutation.data) throw new Error('Data required for create action');
        
        const payload = adsAdGroupInsertSchema.parse({
          AdGroupID: nanoid(),
          CampaignID: campaignId,
          AdGroupName: mutation.data.AdGroupName,
          Keywords: mutation.data.Keywords,
          NegativeKeywords: mutation.data.NegativeKeywords,
          MatchType: mutation.data.MatchType,
          BidEUR: mutation.data.BidEUR,
          CreatedTS: new Date().toISOString(),
          Notes: mutation.data.Notes,
        });

        await sheetsService.writeRows('Ads_AdGroups', [payload]);
        created++;
        break;
      }

      case 'update': {
        if (!mutation.adGroupId) throw new Error('AdGroupID required for update');
        if (!mutation.data) throw new Error('Data required for update');

        await sheetsService.updateRow('Ads_AdGroups', 'AdGroupID', mutation.adGroupId, mutation.data);
        updated++;
        break;
      }

      case 'delete': {
        if (!mutation.adGroupId) throw new Error('AdGroupID required for delete');

        await sheetsService.updateRow('Ads_AdGroups', 'AdGroupID', mutation.adGroupId, {
          Status: 'removed',
        });
        deleted++;
        break;
      }
    }
  }

  return { created, updated, deleted };
}

export async function manageCreatives(
  sheetsService: GoogleSheetsService,
  adGroupId: string,
  mutations: CreativeMutation[]
): Promise<{ created: number; updated: number; deleted: number }> {
  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const mutation of mutations) {
    switch (mutation.action) {
      case 'create': {
        if (!mutation.data) throw new Error('Data required for create action');

        const payload = adsCreativeInsertSchema.parse({
          CreativeID: nanoid(),
          AdGroupID: adGroupId,
          Format: mutation.data.Format,
          Headlines: mutation.data.Headlines,
          Descriptions: mutation.data.Descriptions,
          CallToAction: mutation.data.CallToAction,
          FinalURL: mutation.data.FinalURL,
          Language: mutation.data.Language,
          CreatedTS: new Date().toISOString(),
          Notes: mutation.data.Notes,
        });

        await sheetsService.writeRows('Ads_Creatives', [payload]);
        created++;
        break;
      }

      case 'update': {
        if (!mutation.creativeId) throw new Error('CreativeID required for update');
        if (!mutation.data) throw new Error('Data required for update');

        await sheetsService.updateRow('Ads_Creatives', 'CreativeID', mutation.creativeId, mutation.data);
        updated++;
        break;
      }

      case 'delete': {
        if (!mutation.creativeId) throw new Error('CreativeID required for delete');

        await sheetsService.updateRow('Ads_Creatives', 'CreativeID', mutation.creativeId, {
          Status: 'paused',
        });
        deleted++;
        break;
      }
    }
  }

  return { created, updated, deleted };
}

export async function exportGoogleAdsCsv(
  sheetsService: GoogleSheetsService,
  campaignId: string
): Promise<{ csv: string; fileName: string }> {
  const campaign = (await sheetsService.readSheet<AdsCampaign>('Ads_Campaigns'))
    .find(c => c.CampaignID === campaignId);

  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  const adGroups = (await sheetsService.readSheet<AdsAdGroup>('Ads_AdGroups'))
    .filter(ag => ag.CampaignID === campaignId && ag.Status === 'active');

  const creatives = await sheetsService.readSheet<AdsCreative>('Ads_Creatives');

  const headers = [
    'Campaign', 'Ad Group', 'Keyword', 'Match Type', 'Bid', 'Status',
    'Headline 1', 'Headline 2', 'Headline 3', 'Description 1', 'Description 2', 'Final URL'
  ];

  const rows: any[][] = [];

  for (const adGroup of adGroups) {
    const keywords = (adGroup.Keywords || '').split('\n').filter(k => k.trim());
    const groupCreatives = creatives.filter(c => c.AdGroupID === adGroup.AdGroupID);

    for (const keyword of keywords) {
      const headlines = groupCreatives[0]?.Headlines?.split('|').slice(0, 3) || ['', '', ''];
      const descriptions = groupCreatives[0]?.Descriptions?.split('|').slice(0, 2) || ['', ''];

      rows.push([
        campaign.Name,
        adGroup.AdGroupName,
        keyword.trim(),
        adGroup.MatchType || 'Broad',
        adGroup.BidEUR || '',
        adGroup.Status || 'draft',
        headlines[0] || '',
        headlines[1] || '',
        headlines[2] || '',
        descriptions[0] || '',
        descriptions[1] || '',
        groupCreatives[0]?.FinalURL || ''
      ]);
    }
  }

  const csv = buildCSV(headers, rows);
  const fileName = `google-ads-${campaign.Name.replace(/\s+/g, '-')}-${Date.now()}.csv`;

  return { csv, fileName };
}

export async function getAdGroups(
  sheetsService: GoogleSheetsService,
  campaignId: string
): Promise<AdsAdGroup[]> {
  const adGroups = await sheetsService.readSheet<AdsAdGroup>('Ads_AdGroups');
  return adGroups.filter(ag => ag.CampaignID === campaignId);
}

export async function getCreatives(
  sheetsService: GoogleSheetsService,
  adGroupId: string
): Promise<AdsCreative[]> {
  const creatives = await sheetsService.readSheet<AdsCreative>('Ads_Creatives');
  return creatives.filter(c => c.AdGroupID === adGroupId);
}
