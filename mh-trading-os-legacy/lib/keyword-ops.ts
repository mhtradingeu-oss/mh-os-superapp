import OpenAI from 'openai';
import { GoogleSheetsService } from './sheets';
import { logAIOperation, calculateGoogleAdsCost } from './marketing-utils';
import { seoKeywordSchema, type SEOKeyword } from '@shared/schema';
import { nanoid } from 'nanoid';
import { retryWithBackoff } from './retry';

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export type HarvestSource = 'Manual' | 'Import' | 'GoogleAds' | 'GooglePlaces' | 'Competitor';

export interface KeywordFilters {
  locale?: string;
  cluster?: string;
  clusterID?: string;
  intent?: 'Informational' | 'Commercial' | 'Transactional' | 'Navigational';
  status?: 'active' | 'paused' | 'archived';
  minSearchVolume?: number;
  maxDifficulty?: number;
  minOpportunityScore?: number;
}

export interface HarvestKeywordsRequest {
  source: HarvestSource;
  keywords: string[];
  locale?: string;
  harvestParams?: Record<string, any>;
}

export interface ClusterKeywordsRequest {
  keywordIds: string[];
  locale?: string;
  maxClusterSize?: number;
}

export interface PriorityCriteria {
  weightVolume?: number;
  weightDifficulty?: number;
  weightCPC?: number;
  weightRank?: number;
}

export async function harvestKeywords(
  sheetsService: GoogleSheetsService,
  request: HarvestKeywordsRequest
): Promise<SEOKeyword[]> {
  const now = new Date().toISOString();
  const harvested: SEOKeyword[] = [];

  for (const keyword of request.keywords) {
    const keywordEntry: Partial<SEOKeyword> = {
      KeywordID: nanoid(),
      Keyword: keyword.trim(),
      Locale: request.locale || 'en-US',
      HarvestSource: request.source,
      HarvestParamsJSON: request.harvestParams ? JSON.stringify(request.harvestParams) : undefined,
      HarvestTS: now,
      Status: 'active',
      CreatedTS: now,
    };

    const validated = seoKeywordSchema.parse(keywordEntry);
    harvested.push(validated);
  }

  await sheetsService.writeRows('SEO_Keywords', harvested);
  return harvested;
}

export async function clusterKeywords(
  sheetsService: GoogleSheetsService,
  request: ClusterKeywordsRequest
): Promise<{ clusters: Map<string, string[]>; updatedCount: number }> {
  const keywords = await sheetsService.readSheet<SEOKeyword>('SEO_Keywords');
  const targetKeywords = keywords.filter(kw =>
    request.keywordIds.includes(kw.KeywordID)
  );

  if (targetKeywords.length === 0) {
    throw new Error('No keywords found for clustering');
  }

  const keywordList = targetKeywords.map(kw => kw.Keyword).join('\n');

  const prompt = `You are an SEO keyword clustering expert. Analyze these keywords and group them into semantic clusters.

Keywords:
${keywordList}

Requirements:
- Create meaningful topical clusters
- Each cluster should have 3-15 keywords max
- Assign a short, descriptive cluster name (2-4 words)
- Assign a stable cluster ID (kebab-case slug)
- Rate each keyword's relevance to its cluster (0-100)

Return JSON format:
{
  "clusters": [
    {
      "clusterName": "Product Reviews",
      "clusterID": "product-reviews",
      "keywords": [
        {"keyword": "best shampoo reviews", "score": 95},
        {"keyword": "shampoo ratings", "score": 88}
      ]
    }
  ]
}`;

  const startTime = Date.now();
  const response = await retryWithBackoff(async () => {
    return await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are an SEO clustering expert. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });
  });

  const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  const costEUR = calculateGoogleAdsCost(usage.prompt_tokens, usage.completion_tokens);

  let clusters: any;
  try {
    const content = response.choices[0]?.message?.content || '{}';
    clusters = JSON.parse(content);
  } catch {
    throw new Error('Failed to parse AI response');
  }

  const clusterMap = new Map<string, string[]>();
  const updates: any[] = [];
  const now = new Date().toISOString();

  for (const cluster of clusters.clusters || []) {
    const clusterKeywords: string[] = [];
    
    for (const kwData of cluster.keywords || []) {
      const targetKw = targetKeywords.find(k => 
        k.Keyword.toLowerCase() === kwData.keyword.toLowerCase()
      );
      
      if (targetKw) {
        clusterKeywords.push(targetKw.Keyword);
        updates.push({
          KeywordID: targetKw.KeywordID,
          Cluster: cluster.clusterName,
          ClusterID: cluster.clusterID,
          ClusterScore: kwData.score || 80,
          LastClusteredTS: now,
        });
      }
    }
    
    clusterMap.set(cluster.clusterName, clusterKeywords);
  }

  for (const update of updates) {
    await sheetsService.updateRow('SEO_Keywords', 'KeywordID', update.KeywordID, {
      Cluster: update.Cluster,
      ClusterID: update.ClusterID,
      ClusterScore: update.ClusterScore,
      LastClusteredTS: update.LastClusteredTS,
    });
  }

  await logAIOperation(sheetsService, 'A-SEO-110', 'keywords', 'SEO_Keywords', 'SEO_Keywords', {
    success: true,
    rowsCreated: updates.length,
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    costEUR,
  });

  return { clusters: clusterMap, updatedCount: updates.length };
}

export async function prioritizeKeywords(
  sheetsService: GoogleSheetsService,
  keywordIds: string[],
  criteria: PriorityCriteria = {}
): Promise<{ updatedCount: number }> {
  const keywords = await sheetsService.readSheet<SEOKeyword>('SEO_Keywords');
  const targetKeywords = keywords.filter(kw => keywordIds.includes(kw.KeywordID));

  const weightVolume = criteria.weightVolume || 0.4;
  const weightDifficulty = criteria.weightDifficulty || 0.3;
  const weightCPC = criteria.weightCPC || 0.2;
  const weightRank = criteria.weightRank || 0.1;

  const calculatePriority = (kw: SEOKeyword): number => {
    const volumeScore = Math.min((kw.SearchVolume || 0) / 10000, 1) * 100;
    const difficultyScore = (100 - (kw.Difficulty || 50));
    const cpcScore = Math.min((kw.CPC_EUR || 0) * 20, 100);
    const rankScore = kw.Rank ? (100 - kw.Rank) : 50;

    return Math.round(
      volumeScore * weightVolume +
      difficultyScore * weightDifficulty +
      cpcScore * weightCPC +
      rankScore * weightRank
    );
  };

  let updatedCount = 0;
  const now = new Date().toISOString();

  for (const kw of targetKeywords) {
    const priority = calculatePriority(kw);
    const reason = `Vol:${kw.SearchVolume || 0} KD:${kw.Difficulty || 0} CPC:${kw.CPC_EUR || 0}`;

    await sheetsService.updateRow('SEO_Keywords', 'KeywordID', kw.KeywordID, {
      Priority: priority,
      PriorityReason: reason,
      OpportunityScore: priority,
      LastChecked: now,
    });
    updatedCount++;
  }

  return { updatedCount };
}

export async function getKeywords(
  sheetsService: GoogleSheetsService,
  filters: KeywordFilters = {}
): Promise<SEOKeyword[]> {
  const keywords = await sheetsService.readSheet<SEOKeyword>('SEO_Keywords');

  return keywords.filter(kw => {
    if (filters.locale && kw.Locale !== filters.locale) return false;
    if (filters.cluster && kw.Cluster !== filters.cluster) return false;
    if (filters.clusterID && kw.ClusterID !== filters.clusterID) return false;
    if (filters.intent && kw.Intent !== filters.intent) return false;
    if (filters.status && kw.Status !== filters.status) return false;
    if (filters.minSearchVolume && (kw.SearchVolume || 0) < filters.minSearchVolume) return false;
    if (filters.maxDifficulty && (kw.Difficulty || 100) > filters.maxDifficulty) return false;
    if (filters.minOpportunityScore && (kw.OpportunityScore || 0) < filters.minOpportunityScore) return false;
    return true;
  });
}

export async function assignKeywordToBrief(
  sheetsService: GoogleSheetsService,
  keywordId: string,
  briefId: string
): Promise<void> {
  await sheetsService.updateRow('SEO_Keywords', 'KeywordID', keywordId, {
    BriefID: briefId,
    LastChecked: new Date().toISOString(),
  });
}
