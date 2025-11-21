import { affiliateRepository } from "./affiliate-repository";
import { sheetsService } from "./sheets"; // ⚠️ Used only for OutreachMessages - pending migration
import { nanoid } from "nanoid";
import type { 
  AffiliateProfile as CanonicalProfile,
  AffiliateClick as CanonicalClick,
  AffiliateConversion as CanonicalConversion,
  AffiliateCandidate as CanonicalCandidate,
  AffiliateTask as CanonicalTask
} from "@shared/schema";

// Legacy interfaces kept for backward compatibility
export interface AffiliateClick extends CanonicalClick {
  IP?: string;
  UserAgent?: string;
  ReferralSource?: string;
  QueryParams?: string;
}

export interface AffiliateConversion extends CanonicalConversion {
  CommissionPct?: number;
}

export interface AffiliateProfile extends Omit<CanonicalProfile, 'JoinedDate' | 'LastActive' | 'Status' | 'Tier'> {
  JoinDate: string;
  LastActivity: string;
  Status: 'Active' | 'Pending' | 'Inactive' | 'Suspended';
  Tier: 'Top' | 'Mid' | 'Low' | 'Inactive';
  Niche: string;
}

export interface AffiliateCandidate {
  CandidateID: string;
  Name: string;
  Email?: string;
  Website?: string;
  Instagram?: string;
  YouTube?: string;
  TikTok?: string;
  Twitter?: string;
  Niche?: string;
  Followers: number;
  EngagementRate: number;
  ContentType?: string;
  Location?: string;
  Language?: string;
  Score: number;
  Source?: 'AI_Discovery' | 'Manual' | 'Inbound';
  Status: 'New' | 'Contacted' | 'Negotiating' | 'Accepted' | 'Rejected';
  Notes?: string;
  DiscoveredDate: string;
  LastContactDate?: string;
}

export interface OutreachMessage {
  MessageID: string;
  CandidateID?: string;
  AffiliateID?: string;
  Subject: string;
  Body: string;
  EmailTo: string;
  SentDate?: string;
  Status: 'Draft' | 'Sent' | 'Opened' | 'Replied' | 'Bounced' | 'Failed';
  TrackingID?: string;
  ReplyReceived?: boolean;
  ReplyDate?: string;
  ReplyText?: string;
}

export interface AffiliateTask extends Omit<CanonicalTask, 'TaskType' | 'Priority' | 'Status'> {
  Title?: string;
  Type?: 'Follow-up' | 'Review' | 'Payment' | 'Fraud-Check' | 'Outreach' | 'Other';
  Priority?: 'High' | 'Medium' | 'Low';
  Status?: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  CreatedDate?: string;
  CompletedDate?: string;
}

class AffiliateService {
  async trackClick(data: Partial<AffiliateClick>): Promise<AffiliateClick> {
    const result = await affiliateRepository.trackClick({
      AffiliateID: data.AffiliateID || '',
      Timestamp: new Date().toISOString(),
      Source: data.ReferralSource || 'Direct',
      Device: data.Device,
      IPAddress: data.IP,
      LandingPage: data.LandingPage,
      Referrer: data.ReferralSource,
      Country: data.Country,
      City: data.City,
      Browser: data.Browser,
      OS: data.OS,
    });
    
    return result as AffiliateClick;
  }

  async recordConversion(data: Partial<AffiliateConversion>): Promise<AffiliateConversion> {
    const result = await affiliateRepository.trackConversion({
      AffiliateID: data.AffiliateID || '',
      OrderID: data.OrderID || '',
      Revenue: data.Revenue || 0,
      Commission: data.Commission || 0,
      Currency: 'EUR',
      Country: data.Country,
      Timestamp: new Date().toISOString(),
      ClickID: data.ClickID,
      ProductsSold: data.ProductsSold,
      CustomerID: data.CustomerID,
    });
    
    return { ...result, CommissionPct: data.CommissionPct || 0 };
  }

  async getAllAffiliates(): Promise<AffiliateProfile[]> {
    const profiles = await affiliateRepository.getAllProfiles();
    return profiles.map(p => this.mapToLegacyProfile(p));
  }

  async getAffiliateById(affiliateID: string): Promise<AffiliateProfile | null> {
    const profile = await affiliateRepository.getProfileById(affiliateID);
    return profile ? this.mapToLegacyProfile(profile) : null;
  }

  private mapToLegacyProfile(canonical: CanonicalProfile): AffiliateProfile {
    return {
      ...canonical,
      JoinDate: canonical.JoinedDate,
      LastActivity: canonical.LastActive || canonical.JoinedDate,
      Status: this.mapStatus(canonical.Status),
      Tier: this.mapTier(canonical.Tier),
      Niche: canonical.Niche || 'General',
    };
  }

  private mapStatus(status: string): 'Active' | 'Pending' | 'Inactive' | 'Suspended' {
    const map: Record<string, 'Active' | 'Pending' | 'Inactive' | 'Suspended'> = {
      'active': 'Active',
      'paused': 'Inactive',
      'new': 'Pending',
      'suspended': 'Suspended',
    };
    return map[status] || 'Pending';
  }

  private mapTier(tier: string): 'Top' | 'Mid' | 'Low' | 'Inactive' {
    const map: Record<string, 'Top' | 'Mid' | 'Low' | 'Inactive'> = {
      'Gold': 'Top',
      'Partner': 'Top',
      'Standard': 'Mid',
      'Basic': 'Low',
      'Inactive': 'Inactive',
    };
    return map[tier] || 'Inactive';
  }

  async createAffiliate(data: Partial<AffiliateProfile>): Promise<AffiliateProfile> {
    const profile = await affiliateRepository.createProfile({
      Name: data.Name || '',
      Email: data.Email || '',
      ReferralCode: data.ReferralCode || nanoid(8).toUpperCase(),
      Country: data.Country,
      Tier: this.reverseMapTier(data.Tier),
      Status: this.reverseMapStatus(data.Status),
      JoinedDate: new Date().toISOString(),
      Website: data.Website,
      SocialMedia: data.SocialMedia,
      Niche: data.Niche || 'General',
      CommissionPct: data.CommissionPct || 10,
    });
    
    return this.mapToLegacyProfile(profile);
  }

  async updateAffiliate(affiliateID: string, updates: Partial<AffiliateProfile>): Promise<AffiliateProfile | null> {
    const canonicalUpdates: Partial<CanonicalProfile> = {};
    
    if (updates.Status) canonicalUpdates.Status = this.reverseMapStatus(updates.Status);
    if (updates.Tier) canonicalUpdates.Tier = this.reverseMapTier(updates.Tier);
    if (updates.Name) canonicalUpdates.Name = updates.Name;
    if (updates.Email) canonicalUpdates.Email = updates.Email;
    if (updates.Website) canonicalUpdates.Website = updates.Website;
    if (updates.SocialMedia) canonicalUpdates.SocialMedia = updates.SocialMedia;
    if (updates.Niche) canonicalUpdates.Niche = updates.Niche;
    if (updates.CommissionPct !== undefined) canonicalUpdates.CommissionPct = updates.CommissionPct;
    
    await affiliateRepository.updateProfile(affiliateID, canonicalUpdates);
    return this.getAffiliateById(affiliateID);
  }

  async getAllCandidates(): Promise<AffiliateCandidate[]> {
    const candidates = await affiliateRepository.getAllCandidates();
    return candidates.map(c => this.mapToLegacyCandidate(c));
  }

  async createCandidate(data: Partial<AffiliateCandidate>): Promise<AffiliateCandidate> {
    const candidate = await affiliateRepository.createCandidate({
      Name: data.Name || '',
      Platform: data.ContentType,
      Followers: data.Followers || 0,
      EngagementRate: data.EngagementRate || 0,
      Niche: data.Niche,
      Country: data.Location,
      AIScore: data.Score || 0,
      Status: this.mapCandidateStatus(data.Status),
      Email: data.Email,
      Website: data.Website,
      Notes: data.Notes,
    });
    
    return this.mapToLegacyCandidate(candidate);
  }

  async updateCandidate(candidateID: string, updates: Partial<AffiliateCandidate>): Promise<AffiliateCandidate | null> {
    const canonicalUpdates: Partial<CanonicalCandidate> = {};
    
    if (updates.Name) canonicalUpdates.Name = updates.Name;
    if (updates.Email) canonicalUpdates.Email = updates.Email;
    if (updates.Website) canonicalUpdates.Website = updates.Website;
    if (updates.Followers !== undefined) canonicalUpdates.Followers = updates.Followers;
    if (updates.EngagementRate !== undefined) canonicalUpdates.EngagementRate = updates.EngagementRate;
    if (updates.Score !== undefined) canonicalUpdates.AIScore = updates.Score;
    if (updates.Status) canonicalUpdates.Status = this.mapCandidateStatus(updates.Status);
    if (updates.Notes) canonicalUpdates.Notes = updates.Notes;
    
    await affiliateRepository.updateCandidate(candidateID, canonicalUpdates);
    const candidate = await affiliateRepository.getCandidateById(candidateID);
    return candidate ? this.mapToLegacyCandidate(candidate) : null;
  }

  private reverseMapStatus(status?: string): 'active' | 'paused' | 'new' | 'suspended' {
    const map: Record<string, 'active' | 'paused' | 'new' | 'suspended'> = {
      'Active': 'active',
      'Inactive': 'paused',
      'Pending': 'new',
      'Suspended': 'suspended',
    };
    return map[status || 'Pending'] || 'new';
  }

  private reverseMapTier(tier?: string): 'Gold' | 'Partner' | 'Standard' | 'Basic' | 'Inactive' {
    const map: Record<string, 'Gold' | 'Partner' | 'Standard' | 'Basic' | 'Inactive'> = {
      'Top': 'Gold',
      'Mid': 'Standard',
      'Low': 'Basic',
      'Inactive': 'Inactive',
    };
    return map[tier || 'Inactive'] || 'Basic';
  }

  private mapCandidateStatus(status?: string): 'new' | 'contacted' | 'accepted' | 'rejected' {
    const map: Record<string, 'new' | 'contacted' | 'accepted' | 'rejected'> = {
      'New': 'new',
      'Contacted': 'contacted',
      'Negotiating': 'contacted',
      'Accepted': 'accepted',
      'Rejected': 'rejected',
    };
    return map[status || 'New'] || 'new';
  }

  private mapToLegacyCandidate(canonical: CanonicalCandidate): AffiliateCandidate {
    return {
      CandidateID: canonical.CandidateID,
      Name: canonical.Name,
      Email: canonical.Email,
      Website: canonical.Website,
      Instagram: undefined,
      YouTube: undefined,
      TikTok: undefined,
      Twitter: undefined,
      Niche: canonical.Niche,
      Followers: canonical.Followers,
      EngagementRate: canonical.EngagementRate,
      ContentType: canonical.Platform,
      Location: canonical.Country,
      Language: 'en',
      Score: canonical.AIScore,
      Source: 'Manual',
      Status: this.reverseCandidateStatus(canonical.Status),
      Notes: canonical.Notes,
      DiscoveredDate: canonical.DiscoveredDate || new Date().toISOString(),
      LastContactDate: undefined,
    };
  }

  private reverseCandidateStatus(status: string): 'New' | 'Contacted' | 'Negotiating' | 'Accepted' | 'Rejected' {
    const map: Record<string, 'New' | 'Contacted' | 'Negotiating' | 'Accepted' | 'Rejected'> = {
      'new': 'New',
      'contacted': 'Contacted',
      'accepted': 'Accepted',
      'rejected': 'Rejected',
    };
    return map[status] || 'New';
  }

  // ⚠️ TODO: Migrate OutreachMessage to canonical schema + repository
  // Currently using sheetsService directly - will be refactored in next phase
  async createOutreachMessage(data: Partial<OutreachMessage>): Promise<OutreachMessage> {
    const messageID = `MSG-${nanoid(8)}`;
    const sentDate = data.Status === 'Sent' ? new Date().toISOString() : undefined;

    const message: OutreachMessage = {
      MessageID: messageID,
      CandidateID: data.CandidateID,
      AffiliateID: data.AffiliateID,
      Subject: data.Subject || '',
      Body: data.Body || '',
      EmailTo: data.EmailTo || '',
      SentDate: sentDate,
      Status: data.Status || 'Draft',
      TrackingID: data.TrackingID,
      ReplyReceived: data.ReplyReceived || false,
      ReplyDate: data.ReplyDate,
      ReplyText: data.ReplyText,
    };

    await sheetsService.appendRow('OutreachMessages', Object.values(message));
    return message;
  }

  async getOutreachMessages(): Promise<OutreachMessage[]> {
    const sheet = await sheetsService.readSheet('OutreachMessages');
    return sheet as OutreachMessage[];
  }

  async createTask(data: Partial<AffiliateTask>): Promise<AffiliateTask> {
    const task = await affiliateRepository.createTask({
      AffiliateID: data.AffiliateID || '',
      TaskType: this.mapTaskType(data.Type),
      Description: data.Title || data.Description || '',
      DueDate: data.DueDate,
      Status: this.mapTaskStatus(data.Status),
      Priority: this.mapTaskPriority(data.Priority),
      AssignedTo: data.AssignedTo,
      Notes: data.Description,
    });
    
    return this.mapToLegacyTask(task);
  }

  async getTasks(filters?: { affiliateID?: string; candidateID?: string; status?: string }): Promise<AffiliateTask[]> {
    let tasks = await affiliateRepository.getAllTasks(filters?.status);
    
    if (filters?.affiliateID) {
      tasks = tasks.filter(t => t.AffiliateID === filters.affiliateID);
    }
    
    return tasks.map(t => this.mapToLegacyTask(t));
  }

  async updateTask(taskID: string, updates: Partial<AffiliateTask>): Promise<AffiliateTask | null> {
    const canonicalUpdates: Partial<CanonicalTask> = {};
    
    if (updates.Status) {
      canonicalUpdates.Status = this.mapTaskStatus(updates.Status);
      if (updates.Status === 'Completed') {
        canonicalUpdates.CompletedDate = new Date().toISOString();
      }
    }
    if (updates.Priority) canonicalUpdates.Priority = this.mapTaskPriority(updates.Priority);
    if (updates.Description || updates.Title) {
      canonicalUpdates.Description = updates.Title || updates.Description || '';
    }
    if (updates.DueDate) canonicalUpdates.DueDate = updates.DueDate;
    
    await affiliateRepository.updateTask(taskID, canonicalUpdates);
    const task = await affiliateRepository.getAllTasks();
    const updated = task.find(t => t.TaskID === taskID);
    return updated ? this.mapToLegacyTask(updated) : null;
  }

  private mapTaskType(type?: string): 'email' | 'follow-up' | 'negotiation' | 'review' | 'payment' | 'other' {
    const map: Record<string, 'email' | 'follow-up' | 'negotiation' | 'review' | 'payment' | 'other'> = {
      'Follow-up': 'follow-up',
      'Review': 'review',
      'Payment': 'payment',
      'Fraud-Check': 'review',
      'Outreach': 'email',
      'Other': 'other',
    };
    return map[type || 'Other'] || 'other';
  }

  private mapTaskStatus(status?: string): 'pending' | 'in-progress' | 'done' | 'cancelled' {
    const map: Record<string, 'pending' | 'in-progress' | 'done' | 'cancelled'> = {
      'Pending': 'pending',
      'In Progress': 'in-progress',
      'Completed': 'done',
      'Cancelled': 'cancelled',
    };
    return map[status || 'Pending'] || 'pending';
  }

  private mapTaskPriority(priority?: string): 'high' | 'medium' | 'low' {
    const map: Record<string, 'high' | 'medium' | 'low'> = {
      'High': 'high',
      'Medium': 'medium',
      'Low': 'low',
    };
    return map[priority || 'Medium'] || 'medium';
  }

  private mapToLegacyTask(canonical: CanonicalTask): AffiliateTask {
    return {
      TaskID: canonical.TaskID,
      AffiliateID: canonical.AffiliateID,
      CandidateID: undefined,
      Title: canonical.Description,
      Description: canonical.Notes,
      Type: this.reverseTaskType(canonical.TaskType),
      Priority: this.reverseTaskPriority(canonical.Priority),
      Status: this.reverseTaskStatus(canonical.Status),
      DueDate: canonical.DueDate,
      AssignedTo: canonical.AssignedTo,
      CreatedDate: canonical.DueDate,
      CompletedDate: canonical.CompletedDate,
    };
  }

  private reverseTaskType(type: string): 'Follow-up' | 'Review' | 'Payment' | 'Fraud-Check' | 'Outreach' | 'Other' {
    const map: Record<string, 'Follow-up' | 'Review' | 'Payment' | 'Fraud-Check' | 'Outreach' | 'Other'> = {
      'email': 'Outreach',
      'follow-up': 'Follow-up',
      'negotiation': 'Follow-up',
      'review': 'Review',
      'payment': 'Payment',
      'other': 'Other',
    };
    return map[type] || 'Other';
  }

  private reverseTaskStatus(status: string): 'Pending' | 'In Progress' | 'Completed' | 'Cancelled' {
    const map: Record<string, 'Pending' | 'In Progress' | 'Completed' | 'Cancelled'> = {
      'pending': 'Pending',
      'in-progress': 'In Progress',
      'done': 'Completed',
      'cancelled': 'Cancelled',
    };
    return map[status] || 'Pending';
  }

  private reverseTaskPriority(priority: string): 'High' | 'Medium' | 'Low' {
    const map: Record<string, 'High' | 'Medium' | 'Low'> = {
      'high': 'High',
      'medium': 'Medium',
      'low': 'Low',
    };
    return map[priority] || 'Medium';
  }
}

export const affiliateService = new AffiliateService();
