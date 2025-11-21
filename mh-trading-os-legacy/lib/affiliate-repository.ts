import { sheetsService } from "./sheets";
import { AFFILIATE_SHEET_NAMES } from "./affiliate-constants";
import { nanoid } from "nanoid";
import {
  affiliateProfileSchema,
  affiliateClickSchema,
  affiliateConversionSchema,
  affiliateCandidateSchema,
  affiliateTaskSchema,
  type AffiliateProfile,
  type AffiliateClick,
  type AffiliateConversion,
  type AffiliateCandidate,
  type AffiliateTask,
  type InsertAffiliateProfile,
  type InsertAffiliateClick,
  type InsertAffiliateConversion,
  type InsertAffiliateCandidate,
  type InsertAffiliateTask,
} from "@shared/schema";

// Sheet name constants from centralized source (single source of truth)
// Using object map instead of array destructuring for position-independence
const {
  PROFILES: SHEET_PROFILES,
  CLICKS: SHEET_CLICKS,
  CONVERSIONS: SHEET_CONVERSIONS,
  CANDIDATES: SHEET_CANDIDATES,
  TASKS: SHEET_TASKS,
  DISCOVERY_LOG: SHEET_DISCOVERY_LOG,
} = AFFILIATE_SHEET_NAMES;

/**
 * Unified Affiliate Repository
 * Single source of truth for all affiliate-related Google Sheets operations
 * Uses canonical schemas from shared/schema.ts for type safety and validation
 */
class AffiliateRepository {
  // ==================== PROFILES ====================
  
  async getAllProfiles(): Promise<AffiliateProfile[]> {
    const sheet = await sheetsService.readSheet(SHEET_PROFILES);
    return this.parseProfiles(sheet);
  }

  async getProfileById(affiliateId: string): Promise<AffiliateProfile | null> {
    const profiles = await this.getAllProfiles();
    return profiles.find(p => p.AffiliateID === affiliateId) || null;
  }

  async createProfile(data: InsertAffiliateProfile | AffiliateProfile): Promise<AffiliateProfile> {
    const profile: AffiliateProfile = {
      AffiliateID: 'AffiliateID' in data && data.AffiliateID ? data.AffiliateID : nanoid(12),
      ...data,
      TotalClicks: 'TotalClicks' in data ? data.TotalClicks : 0,
      TotalConversions: 'TotalConversions' in data ? data.TotalConversions : 0,
      TotalRevenue: 'TotalRevenue' in data ? data.TotalRevenue : 0,
      TotalCommission: 'TotalCommission' in data ? data.TotalCommission : 0,
      ConversionRate: 'ConversionRate' in data ? data.ConversionRate : 0,
      EarningsPerClick: 'EarningsPerClick' in data ? data.EarningsPerClick : 0,
      Score: 'Score' in data ? data.Score : 0,
    };

    const validated = affiliateProfileSchema.parse(profile);
    await sheetsService.writeRows(SHEET_PROFILES, [validated]);
    return validated;
  }

  async updateProfile(affiliateId: string, updates: Partial<AffiliateProfile>): Promise<void> {
    const sheet = await sheetsService.readSheet(SHEET_PROFILES);
    const profiles = this.parseProfiles(sheet);
    const profile = profiles.find(p => p.AffiliateID === affiliateId);
    
    if (!profile) {
      throw new Error(`Profile not found: ${affiliateId}`);
    }

    const updated = { ...profile, ...updates };
    const validated = affiliateProfileSchema.parse(updated);
    await sheetsService.updateRow(SHEET_PROFILES, 'AffiliateID', affiliateId, validated);
  }

  // ==================== CLICKS ====================
  
  async getAllClicks(dateRange?: { start: string; end: string }): Promise<AffiliateClick[]> {
    const sheet = await sheetsService.readSheet(SHEET_CLICKS);
    let clicks = this.parseClicks(sheet);
    
    if (dateRange) {
      clicks = clicks.filter(c => 
        c.Timestamp >= dateRange.start && c.Timestamp <= dateRange.end
      );
    }
    
    return clicks;
  }

  async getClicksByAffiliate(affiliateId: string, dateRange?: { start: string; end: string }): Promise<AffiliateClick[]> {
    const clicks = await this.getAllClicks(dateRange);
    return clicks.filter(c => c.AffiliateID === affiliateId);
  }

  async trackClick(data: InsertAffiliateClick): Promise<AffiliateClick> {
    const clickID = nanoid(12);
    const click: AffiliateClick = {
      ClickID: clickID,
      ...data,
      Timestamp: data.Timestamp || new Date().toISOString(),
    };

    const validated = affiliateClickSchema.parse(click);
    await sheetsService.writeRows(SHEET_CLICKS, [validated]);
    return validated;
  }

  // ==================== CONVERSIONS ====================
  
  async getAllConversions(dateRange?: { start: string; end: string }): Promise<AffiliateConversion[]> {
    const sheet = await sheetsService.readSheet(SHEET_CONVERSIONS);
    let conversions = this.parseConversions(sheet);
    
    if (dateRange) {
      conversions = conversions.filter(c => 
        c.Timestamp >= dateRange.start && c.Timestamp <= dateRange.end
      );
    }
    
    return conversions;
  }

  async getConversionsByAffiliate(affiliateId: string, dateRange?: { start: string; end: string }): Promise<AffiliateConversion[]> {
    const conversions = await this.getAllConversions(dateRange);
    return conversions.filter(c => c.AffiliateID === affiliateId);
  }

  async trackConversion(data: InsertAffiliateConversion, skipMetricsUpdate = false): Promise<AffiliateConversion> {
    const conversionID = nanoid(12);
    const conversion: AffiliateConversion = {
      ConversionID: 'ConversionID' in data && data.ConversionID ? data.ConversionID : conversionID,
      ...data,
      Timestamp: data.Timestamp || new Date().toISOString(),
    };

    const validated = affiliateConversionSchema.parse(conversion);
    await sheetsService.writeRows(SHEET_CONVERSIONS, [validated]);
    
    if (!skipMetricsUpdate) {
      await this.updateProfileMetrics(data.AffiliateID);
    }
    
    return validated;
  }

  // ==================== CANDIDATES ====================
  
  async getAllCandidates(status?: string): Promise<AffiliateCandidate[]> {
    const sheet = await sheetsService.readSheet(SHEET_CANDIDATES);
    let candidates = this.parseCandidates(sheet);
    
    if (status) {
      candidates = candidates.filter(c => c.Status.toLowerCase() === status.toLowerCase());
    }
    
    return candidates;
  }

  async getCandidateById(candidateId: string): Promise<AffiliateCandidate | null> {
    const candidates = await this.getAllCandidates();
    return candidates.find(c => c.CandidateID === candidateId) || null;
  }

  async createCandidate(data: InsertAffiliateCandidate): Promise<AffiliateCandidate> {
    const candidateID = nanoid(12);
    const candidate: AffiliateCandidate = {
      CandidateID: candidateID,
      ...data,
      DiscoveredDate: data.DiscoveredDate || new Date().toISOString(),
    };

    const validated = affiliateCandidateSchema.parse(candidate);
    await sheetsService.writeRows(SHEET_CANDIDATES, [validated]);
    return validated;
  }

  async updateCandidate(candidateId: string, updates: Partial<AffiliateCandidate>): Promise<void> {
    const sheet = await sheetsService.readSheet(SHEET_CANDIDATES);
    const candidates = this.parseCandidates(sheet);
    const candidate = candidates.find(c => c.CandidateID === candidateId);
    
    if (!candidate) {
      throw new Error(`Candidate not found: ${candidateId}`);
    }

    const updated = { ...candidate, ...updates };
    const validated = affiliateCandidateSchema.parse(updated);
    await sheetsService.updateRow(SHEET_CANDIDATES, 'CandidateID', candidateId, validated);
  }

  // ==================== TASKS ====================
  
  async getAllTasks(status?: string): Promise<AffiliateTask[]> {
    const sheet = await sheetsService.readSheet(SHEET_TASKS);
    let tasks = this.parseTasks(sheet);
    
    if (status) {
      tasks = tasks.filter(t => t.Status.toLowerCase() === status.toLowerCase());
    }
    
    return tasks;
  }

  async getTasksByAffiliate(affiliateId: string): Promise<AffiliateTask[]> {
    const tasks = await this.getAllTasks();
    return tasks.filter(t => t.AffiliateID === affiliateId);
  }

  async createTask(data: InsertAffiliateTask): Promise<AffiliateTask> {
    const taskID = nanoid(12);
    const task: AffiliateTask = {
      TaskID: taskID,
      ...data,
    };

    const validated = affiliateTaskSchema.parse(task);
    await sheetsService.writeRows(SHEET_TASKS, [validated]);
    return validated;
  }

  async updateTask(taskId: string, updates: Partial<AffiliateTask>): Promise<void> {
    const sheet = await sheetsService.readSheet(SHEET_TASKS);
    const tasks = this.parseTasks(sheet);
    const task = tasks.find(t => t.TaskID === taskId);
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const updated = { ...task, ...updates };
    const validated = affiliateTaskSchema.parse(updated);
    await sheetsService.updateRow(SHEET_TASKS, 'TaskID', taskId, validated);
  }

  // ==================== HELPERS ====================

  /**
   * Update aggregate metrics for an affiliate after a click or conversion
   */
  private async updateProfileMetrics(affiliateId: string): Promise<void> {
    const [profile, clicks, conversions] = await Promise.all([
      this.getProfileById(affiliateId),
      this.getClicksByAffiliate(affiliateId),
      this.getConversionsByAffiliate(affiliateId),
    ]);

    if (!profile) return;

    const totalClicks = clicks.length;
    const totalConversions = conversions.length;
    const totalRevenue = conversions.reduce((sum, c) => sum + (c.Revenue || 0), 0);
    const totalCommission = conversions.reduce((sum, c) => sum + (c.Commission || 0), 0);
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const earningsPerClick = totalClicks > 0 ? totalCommission / totalClicks : 0;

    await this.updateProfile(affiliateId, {
      TotalClicks: totalClicks,
      TotalConversions: totalConversions,
      TotalRevenue: totalRevenue,
      TotalCommission: totalCommission,
      ConversionRate: conversionRate,
      EarningsPerClick: earningsPerClick,
      LastActive: new Date().toISOString(),
    });
  }

  /**
   * Parse and normalize Profiles with proper type coercion
   */
  private parseProfiles(sheet: any): AffiliateProfile[] {
    if (!Array.isArray(sheet)) return [];
    
    return sheet.map((row, index) => {
      const normalized = {
        ...row,
        TotalClicks: this.parseNumber(row.TotalClicks),
        TotalConversions: this.parseNumber(row.TotalConversions),
        TotalRevenue: this.parseNumber(row.TotalRevenue),
        TotalCommission: this.parseNumber(row.TotalCommission),
        ConversionRate: this.parseNumber(row.ConversionRate),
        EarningsPerClick: this.parseNumber(row.EarningsPerClick),
        Score: this.parseNumber(row.Score),
        CommissionPct: this.parseNumber(row.CommissionPct),
      };
      
      return affiliateProfileSchema.parse(normalized);
    });
  }

  /**
   * Parse and normalize Clicks
   */
  private parseClicks(sheet: any): AffiliateClick[] {
    if (!Array.isArray(sheet)) return [];
    
    return sheet.map(row => affiliateClickSchema.parse(row));
  }

  /**
   * Parse and normalize Conversions with proper type coercion
   */
  private parseConversions(sheet: any): AffiliateConversion[] {
    if (!Array.isArray(sheet)) return [];
    
    return sheet.map(row => {
      const normalized = {
        ...row,
        Revenue: this.parseNumber(row.Revenue),
        Commission: this.parseNumber(row.Commission),
      };
      
      return affiliateConversionSchema.parse(normalized);
    });
  }

  /**
   * Parse and normalize Candidates with proper type coercion
   */
  private parseCandidates(sheet: any): AffiliateCandidate[] {
    if (!Array.isArray(sheet)) return [];
    
    return sheet.map(row => {
      const normalized = {
        ...row,
        Followers: this.parseNumber(row.Followers),
        EngagementRate: this.parseNumber(row.EngagementRate),
        AIScore: this.parseNumber(row.AIScore),
      };
      
      return affiliateCandidateSchema.parse(normalized);
    });
  }

  /**
   * Parse and normalize Tasks
   */
  private parseTasks(sheet: any): AffiliateTask[] {
    if (!Array.isArray(sheet)) return [];
    
    return sheet.map(row => affiliateTaskSchema.parse(row));
  }

  // ==================== DISCOVERY LOG ====================
  
  async logDiscovery(params: {
    niches?: string[];
    personTypes?: string[];
    platforms?: string[];
    countries?: string[];
    minFollowers?: number;
    minEngagement?: number;
    limit: number;
    resultsCount: number;
    duration: number;
    status: 'Success' | 'Error';
    errorMessage?: string;
  }): Promise<void> {
    const discoveryId = nanoid(12);
    const timestamp = new Date().toISOString();
    
    const row = {
      DiscoveryID: discoveryId,
      Timestamp: timestamp,
      Niches: params.niches?.join(', ') || '',
      PersonTypes: params.personTypes?.join(', ') || '',
      Platforms: params.platforms?.join(', ') || '',
      Countries: params.countries?.join(', ') || '',
      MinFollowers: params.minFollowers || 0,
      MinEngagement: params.minEngagement || 0,
      Limit: params.limit,
      ResultsCount: params.resultsCount,
      Duration: params.duration,
      Status: params.status,
      ErrorMessage: params.errorMessage || '',
    };
    
    await sheetsService.writeRows(SHEET_DISCOVERY_LOG, [row]);
  }

  async getDiscoveryLogs(limit?: number): Promise<any[]> {
    const sheet = await sheetsService.readSheet(SHEET_DISCOVERY_LOG);
    const logs = sheet.data.map((row: any) => ({
      DiscoveryID: row.DiscoveryID || '',
      Timestamp: row.Timestamp || '',
      Niches: row.Niches || '',
      PersonTypes: row.PersonTypes || '',
      Platforms: row.Platforms || '',
      Countries: row.Countries || '',
      MinFollowers: parseFloat(row.MinFollowers) || 0,
      MinEngagement: parseFloat(row.MinEngagement) || 0,
      Limit: parseInt(row.Limit, 10) || 0,
      ResultsCount: parseInt(row.ResultsCount, 10) || 0,
      Duration: parseFloat(row.Duration) || 0,
      Status: row.Status || '',
      ErrorMessage: row.ErrorMessage || '',
    }));
    
    if (limit) {
      return logs.slice(-limit);
    }
    
    return logs;
  }

  /**
   * Safe number parser - handles strings, nulls, undefined
   */
  private parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }
}

export const affiliateRepository = new AffiliateRepository();
