import { sheetsService } from "./sheets";
import type {
  OutreachTemplate,
  OutreachSequence,
  OutreachCampaign,
  OutreachContact,
  EmailStats,
  Unsubscribe,
} from "@shared/schema";

// ==================== GDPR VALIDATION ====================

interface GDPRCheckResult {
  allowed: boolean;
  reason: string;
  details?: {
    optedIn?: boolean;
    unsubscribed?: boolean;
    suppressed?: boolean;
    bounced?: boolean;
  };
}

class OutreachService {
  // ==================== GDPR COMPLIANCE ====================

  /**
   * Check if a contact can be contacted for outreach (GDPR compliance)
   */
  async canContact(email: string, campaignID?: string): Promise<GDPRCheckResult> {
    const emailLower = email.toLowerCase().trim();

    // 1. Check if unsubscribed
    const unsubscribes = await sheetsService.readSheet<Unsubscribe>("Unsubscribes");
    const isUnsubscribed = unsubscribes.some(
      (u) => u.Email?.toLowerCase() === emailLower
    );
    if (isUnsubscribed) {
      return {
        allowed: false,
        reason: "Contact has unsubscribed from all communications",
        details: { unsubscribed: true },
      };
    }

    // 2. Check suppression list (hard bounces, complaints)
    const suppressionList = await sheetsService.readSheet<any>("Suppression_List");
    const isSuppressed = suppressionList.some(
      (s) => s.Key?.toLowerCase() === emailLower && s.Type === "email"
    );
    if (isSuppressed) {
      const suppressReason = suppressionList.find(
        (s) => s.Key?.toLowerCase() === emailLower
      )?.Reason;
      return {
        allowed: false,
        reason: `Contact is suppressed: ${suppressReason || "Unknown reason"}`,
        details: { suppressed: true },
      };
    }

    // 3. Check bounce events (hard bounces)
    const bounceEvents = await sheetsService.readSheet<any>("Bounce_Events");
    const recentHardBounce = bounceEvents.find(
      (b) =>
        b.Email?.toLowerCase() === emailLower &&
        b.BounceType === "Hard" &&
        new Date(b.TS).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000 // Last 30 days
    );
    if (recentHardBounce) {
      return {
        allowed: false,
        reason: "Contact has a recent hard bounce (last 30 days)",
        details: { bounced: true },
      };
    }

    // 4. Check if contact exists with opt-in
    const contacts = await sheetsService.readSheet<OutreachContact>("Outreach_Contacts");
    const contact = contacts.find((c) => c.Email?.toLowerCase() === emailLower);

    if (contact) {
      // Type-safe boolean/string comparison (Google Sheets returns strings)
      const isUnsubscribed = 
        contact.UnsubscribedFlag === true ||
        String(contact.UnsubscribedFlag || "").toUpperCase() === "TRUE";
      
      if (isUnsubscribed) {
        return {
          allowed: false,
          reason: "Contact has unsubscribed",
          details: { unsubscribed: true },
        };
      }

      const hasOptedIn =
        contact.OptInFlag === true ||
        String(contact.OptInFlag || "").toUpperCase() === "TRUE";

      if (!hasOptedIn) {
        return {
          allowed: false,
          reason: "Contact has not opted in to receive communications",
          details: { optedIn: false },
        };
      }
    } else {
      // Contact doesn't exist in database - not allowed without explicit opt-in
      return {
        allowed: false,
        reason: "Contact not found in database or has not opted in",
        details: { optedIn: false },
      };
    }

    // All checks passed
    return {
      allowed: true,
      reason: "Contact is eligible for outreach",
      details: { optedIn: true, unsubscribed: false, suppressed: false, bounced: false },
    };
  }

  /**
   * Mark a contact as unsubscribed (GDPR right to opt-out)
   */
  async unsubscribe(email: string, source: string = "Manual", campaignID?: string): Promise<void> {
    const emailLower = email.toLowerCase().trim();
    const now = new Date().toISOString();

    // 1. Add to Unsubscribes sheet
    await sheetsService.writeRows("Unsubscribes", [
      {
        Email: emailLower,
        CampID: campaignID || "",
        CampaignID: campaignID || "", // Legacy
        UnsubTS: now,
        Source: source,
        IPAddress: "",
        UserAgent: "",
      },
    ]);

    // 2. Update contact record if exists
    const contacts = await sheetsService.readSheet<OutreachContact>("Outreach_Contacts");
    const existingContact = contacts.find((c) => c.Email?.toLowerCase() === emailLower);

    if (existingContact && existingContact.ContactID) {
      await sheetsService.updateRow(
        "Outreach_Contacts",
        "ContactID",
        existingContact.ContactID,
        {
          UnsubscribedFlag: "TRUE",
          LastContactTS: now,
          Notes: `${existingContact.Notes || ""}\nUnsubscribed on ${now} via ${source}`.trim(),
        }
      );
    }

    console.log(`[Outreach Service] Unsubscribed: ${emailLower} (source: ${source})`);
  }

  // ==================== TEMPLATE TOKENIZATION ====================

  /**
   * Replace template tokens (e.g., {{first_name}}) with actual values
   */
  tokenizeTemplate(template: string, data: Record<string, any>): string {
    let result = template;

    // Replace all {{token}} patterns
    Object.keys(data).forEach((key) => {
      const value = data[key] ?? "";
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      result = result.replace(regex, String(value));
    });

    // Clean up any remaining unfilled tokens (replace with empty string)
    result = result.replace(/\{\{[^}]+\}\}/g, "");

    return result;
  }

  /**
   * Extract tokens from a template string (e.g., ["first_name", "company"])
   */
  extractTokens(template: string): string[] {
    const matches = template.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];

    return matches.map((match) => match.replace(/\{\{|\}\}/g, "").trim());
  }

  /**
   * Validate that all required tokens are provided in data
   */
  validateTokens(template: string, data: Record<string, any>): { valid: boolean; missing: string[] } {
    const requiredTokens = this.extractTokens(template);
    const missing = requiredTokens.filter((token) => !(token in data) || data[token] === null || data[token] === "");

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  // ==================== CRUD OPERATIONS ====================

  /**
   * Get all templates
   */
  async getTemplates(filters?: { status?: string; lang?: string; channel?: string }): Promise<OutreachTemplate[]> {
    let templates = await sheetsService.readSheet<OutreachTemplate>("Outreach_Templates");

    if (filters?.status) {
      templates = templates.filter((t) => t.Status?.toLowerCase() === filters.status?.toLowerCase());
    }
    if (filters?.lang) {
      templates = templates.filter((t) => t.Lang?.toUpperCase() === filters.lang?.toUpperCase());
    }
    if (filters?.channel) {
      templates = templates.filter((t) => t.Channel === filters.channel);
    }

    return templates;
  }

  /**
   * Get a template by ID
   */
  async getTemplateById(templateID: string): Promise<OutreachTemplate | null> {
    const templates = await sheetsService.readSheet<OutreachTemplate>("Outreach_Templates");
    return templates.find((t) => t.TemplateID === templateID) || null;
  }

  /**
   * Create a new template
   */
  async createTemplate(template: Partial<OutreachTemplate>): Promise<string> {
    const templateID = template.TemplateID || `TPL-${Date.now()}`;
    const now = new Date().toISOString();

    await sheetsService.writeRows("Outreach_Templates", [
      {
        TemplateID: templateID,
        Name: template.Name,
        Channel: template.Channel || "Email",
        Lang: template.Lang || "EN",
        Locale: template.Locale || "",
        Tier: template.Tier || "",
        Subject: template.Subject,
        Body: template.Body || "",
        BodyMarkdown: template.BodyMarkdown || "",
        TokensCSV: template.TokensCSV || "",
        Version: template.Version || 1,
        Status: template.Status || "draft",
        Owner: template.Owner || "",
        CreatedTS: now,
        UpdatedTS: now,
        Notes: template.Notes || "",
      },
    ]);

    return templateID;
  }

  /**
   * Update a template
   */
  async updateTemplate(templateID: string, updates: Partial<OutreachTemplate>): Promise<void> {
    const now = new Date().toISOString();
    await sheetsService.updateRow("Outreach_Templates", "TemplateID", templateID, {
      ...updates,
      UpdatedTS: now,
    });
  }

  /**
   * Get all sequences
   */
  async getSequences(filters?: { status?: string; lang?: string }): Promise<OutreachSequence[]> {
    let sequences = await sheetsService.readSheet<OutreachSequence>("Outreach_Sequences");

    if (filters?.status) {
      sequences = sequences.filter((s) => s.Status?.toLowerCase() === filters.status?.toLowerCase());
    }
    if (filters?.lang) {
      sequences = sequences.filter((s) => s.Lang?.toUpperCase() === filters.lang?.toUpperCase());
    }

    return sequences;
  }

  /**
   * Get a sequence by ID
   */
  async getSequenceById(seqID: string): Promise<OutreachSequence | null> {
    const sequences = await sheetsService.readSheet<OutreachSequence>("Outreach_Sequences");
    return sequences.find((s) => s.SeqID === seqID) || null;
  }

  /**
   * Create a new sequence
   */
  async createSequence(sequence: Partial<OutreachSequence>): Promise<string> {
    const seqID = sequence.SeqID || `SEQ-${Date.now()}`;
    const now = new Date().toISOString();

    await sheetsService.writeRows("Outreach_Sequences", [
      {
        SeqID: seqID,
        Name: sequence.Name,
        Purpose: sequence.Purpose || "",
        StepsJSON: sequence.StepsJSON || "[]",
        Lang: sequence.Lang || "EN",
        Tier: sequence.Tier || "",
        WarmupFlag: sequence.WarmupFlag || "FALSE",
        Status: sequence.Status || "draft",
        Owner: sequence.Owner || "",
        CreatedTS: now,
        UpdatedTS: now,
        Notes: sequence.Notes || "",
      },
    ]);

    return seqID;
  }

  /**
   * Update a sequence
   */
  async updateSequence(seqID: string, updates: Partial<OutreachSequence>): Promise<void> {
    const now = new Date().toISOString();
    await sheetsService.updateRow("Outreach_Sequences", "SeqID", seqID, {
      ...updates,
      UpdatedTS: now,
    });
  }

  /**
   * Get all campaigns
   */
  async getCampaigns(filters?: { status?: string; owner?: string }): Promise<OutreachCampaign[]> {
    let campaigns = await sheetsService.readSheet<OutreachCampaign>("Outreach_Campaigns");

    if (filters?.status) {
      campaigns = campaigns.filter((c) => c.Status?.toLowerCase() === filters.status?.toLowerCase());
    }
    if (filters?.owner) {
      campaigns = campaigns.filter((c) => c.Owner === filters.owner);
    }

    return campaigns;
  }

  /**
   * Get a campaign by ID
   */
  async getCampaignById(campID: string): Promise<OutreachCampaign | null> {
    const campaigns = await sheetsService.readSheet<OutreachCampaign>("Outreach_Campaigns");
    return campaigns.find((c) => c.CampID === campID || c.CampaignID === campID) || null;
  }

  /**
   * Create a new campaign
   */
  async createCampaign(campaign: Partial<OutreachCampaign>): Promise<string> {
    const campID = campaign.CampID || `CMP-${Date.now()}`;
    const now = new Date().toISOString();

    await sheetsService.writeRows("Outreach_Campaigns", [
      {
        CampID: campID,
        CampaignID: campID, // Legacy
        Name: campaign.Name,
        SeqID: campaign.SeqID || "",
        SequenceID: campaign.SeqID || "", // Legacy
        AudienceQueryJSON: campaign.AudienceQueryJSON || "{}",
        Goal: campaign.Goal || "",
        Owner: campaign.Owner || "",
        Channel: campaign.Channel || "email",
        Locale: campaign.Locale || "en",
        ScheduleUTC: campaign.ScheduleUTC || "",
        Status: campaign.Status || "draft",
        CreatedTS: now,
        ApprovedTS: "",
        AppliedTS: "",
        StartedTS: "",
        Notes: campaign.Notes || "",
      },
    ]);

    return campID;
  }

  /**
   * Update a campaign
   */
  async updateCampaign(campID: string, updates: Partial<OutreachCampaign>): Promise<void> {
    await sheetsService.updateRow("Outreach_Campaigns", "CampID", campID, updates);
  }

  /**
   * Get all contacts
   */
  async getContacts(filters?: { source?: string; tier?: string; unsubscribed?: boolean }): Promise<OutreachContact[]> {
    let contacts = await sheetsService.readSheet<OutreachContact>("Outreach_Contacts");

    if (filters?.source) {
      contacts = contacts.filter((c) => c.Source === filters.source);
    }
    if (filters?.tier) {
      contacts = contacts.filter((c) => c.TierGuess === filters.tier);
    }
    if (filters?.unsubscribed !== undefined) {
      contacts = contacts.filter((c) => {
        const isUnsubscribed =
          c.UnsubscribedFlag === true ||
          String(c.UnsubscribedFlag || "").toUpperCase() === "TRUE";
        return filters.unsubscribed ? isUnsubscribed : !isUnsubscribed;
      });
    }

    return contacts;
  }

  /**
   * Get a contact by ID
   */
  async getContactById(contactID: string): Promise<OutreachContact | null> {
    const contacts = await sheetsService.readSheet<OutreachContact>("Outreach_Contacts");
    return contacts.find((c) => c.ContactID === contactID) || null;
  }

  /**
   * Get a contact by email
   */
  async getContactByEmail(email: string): Promise<OutreachContact | null> {
    const contacts = await sheetsService.readSheet<OutreachContact>("Outreach_Contacts");
    return contacts.find((c) => c.Email?.toLowerCase() === email.toLowerCase()) || null;
  }

  /**
   * Create a new contact
   */
  async createContact(contact: Partial<OutreachContact>): Promise<string> {
    const contactID = contact.ContactID || `CONTACT-${Date.now()}`;
    const now = new Date().toISOString();

    await sheetsService.writeRows("Outreach_Contacts", [
      {
        ContactID: contactID,
        Email: contact.Email,
        Name: contact.Name || "",
        Company: contact.Company || "",
        City: contact.City || "",
        Country: contact.Country || "",
        TierGuess: contact.TierGuess || "",
        Source: contact.Source || "Manual",
        OptInFlag: contact.OptInFlag || "FALSE",
        UnsubscribedFlag: "FALSE",
        LastContactTS: "",
        CreatedTS: now,
        Notes: contact.Notes || "",
      },
    ]);

    return contactID;
  }

  /**
   * Update a contact
   */
  async updateContact(contactID: string, updates: Partial<OutreachContact>): Promise<void> {
    await sheetsService.updateRow("Outreach_Contacts", "ContactID", contactID, updates);
  }

  /**
   * Get email stats (daily aggregated metrics)
   */
  async getEmailStats(filters?: { day?: string; campID?: string }): Promise<EmailStats[]> {
    let stats = await sheetsService.readSheet<EmailStats>("Email_Stats");

    if (filters?.day) {
      stats = stats.filter((s) => s.Day === filters.day);
    }
    if (filters?.campID) {
      stats = stats.filter((s) => s.CampID === filters.campID);
    }

    return stats;
  }

  /**
   * Record email stats (aggregate daily metrics)
   * Uses composite StatsID (Day|CampID) for unique identification
   */
  async recordEmailStats(day: string, campID: string, metrics: Partial<EmailStats>): Promise<void> {
    // Create composite key: "2025-01-15|CMP-001"
    const statsID = `${day}|${campID}`;
    
    const allStats = await sheetsService.readSheet<EmailStats>("Email_Stats");
    const existingRow = allStats.find((s) => s.StatsID === statsID);

    if (existingRow) {
      // Update existing stats using StatsID as unique identifier
      const updatedRow = {
        StatsID: statsID,
        Day: day,
        CampID: campID,
        Sent: metrics.Sent ?? existingRow.Sent ?? 0,
        Open: metrics.Open ?? existingRow.Open ?? 0,
        Click: metrics.Click ?? existingRow.Click ?? 0,
        Bounce: metrics.Bounce ?? existingRow.Bounce ?? 0,
        Complaint: metrics.Complaint ?? existingRow.Complaint ?? 0,
        Unsub: metrics.Unsub ?? existingRow.Unsub ?? 0,
      };

      // Update by StatsID (unique composite key)
      await sheetsService.updateRow("Email_Stats", "StatsID", statsID, updatedRow);
    } else {
      // Create new stats row with StatsID
      await sheetsService.writeRows("Email_Stats", [
        {
          StatsID: statsID,
          Day: day,
          CampID: campID,
          Sent: metrics.Sent || 0,
          Open: metrics.Open || 0,
          Click: metrics.Click || 0,
          Bounce: metrics.Bounce || 0,
          Complaint: metrics.Complaint || 0,
          Unsub: metrics.Unsub || 0,
        },
      ]);
    }
  }

  // ==================== RATE LIMITING & COMPLIANCE ====================

  /**
   * Check if we can send to a contact (rate limiting)
   * Returns true if we haven't sent to this contact in the last X hours
   */
  async checkRateLimit(email: string, hoursThreshold: number = 24): Promise<boolean> {
    const contact = await this.getContactByEmail(email);
    if (!contact || !contact.LastContactTS) return true;

    const lastContact = new Date(contact.LastContactTS).getTime();
    const now = Date.now();
    const hoursSinceLastContact = (now - lastContact) / (1000 * 60 * 60);

    return hoursSinceLastContact >= hoursThreshold;
  }

  /**
   * Record that we sent an email to a contact
   */
  async recordContact(email: string, campaignID?: string): Promise<void> {
    const contact = await this.getContactByEmail(email);
    if (contact && contact.ContactID) {
      await this.updateContact(contact.ContactID, {
        LastContactTS: new Date().toISOString(),
      });
    }
  }

  /**
   * Create an outbox message (queue email for sending)
   */
  async createOutboxMessage(message: Partial<EmailOutbox>): Promise<string> {
    const msgID = message.MsgID || `MSG-${Date.now()}`;
    const now = new Date().toISOString();

    await sheetsService.writeRows("Email_Queue", [
      {
        MsgID: msgID,
        CampID: message.CampID || "",
        SeqStep: message.SeqStep || 0,
        To: message.To || "",
        Subject: message.Subject || "",
        Body: message.Body || "",
        Template: message.Template || "",
        PayloadJSON: message.PayloadJSON || "",
        Status: message.Status || "queued",
        Error: message.Error || "",
        ProviderID: message.ProviderID || "",
        SentTS: message.SentTS || "",
        OpenTS: message.OpenTS || "",
        ClickTS: message.ClickTS || "",
        BounceTS: message.BounceTS || "",
        ComplaintTS: message.ComplaintTS || "",
        TS: message.TS || now,
      },
    ]);

    return msgID;
  }
}

export const outreachService = new OutreachService();
