import { sheetsService } from './sheets';
import { nanoid } from 'nanoid';

export interface AudienceQuery {
  source: 'CRM_Leads' | 'PartnerRegistry';
  filters?: {
    City?: string[];
    ScoreMin?: number;
    Status?: string[];
    Tier?: string[];
    PartnerType?: string[];
    [key: string]: any;
  };
  limit?: number;
}

export interface AudienceBuildResult {
  inserted: number;
  skippedDuplicates: number;
  suppressed: number;
  errors: string[];
}

export async function buildAudience(
  campaignId: string,
  audienceQuery: AudienceQuery
): Promise<AudienceBuildResult> {
  const result: AudienceBuildResult = {
    inserted: 0,
    skippedDuplicates: 0,
    suppressed: 0,
    errors: [],
  };

  try {
    // Step 0: Validate campaign exists
    const campaigns = await sheetsService.readSheet('Outreach_Campaigns');
    const campaignExists = campaigns.some((c: any) => c.CampaignID === campaignId);
    
    if (!campaignExists) {
      throw new Error(`Campaign ${campaignId} does not exist in Outreach_Campaigns`);
    }

    // Step 1: Fetch source data
    let sourceRecords: any[] = [];
    
    if (audienceQuery.source === 'CRM_Leads') {
      sourceRecords = await sheetsService.getCRMLeads();
    } else if (audienceQuery.source === 'PartnerRegistry') {
      sourceRecords = await sheetsService.getPartnerRegistry();
    } else {
      throw new Error(`Unknown source: ${audienceQuery.source}`);
    }

    // Step 2: Apply filters
    let filteredRecords = applyFilters(sourceRecords, audienceQuery.filters || {});

    // Step 3: Apply limit
    if (audienceQuery.limit && audienceQuery.limit > 0) {
      filteredRecords = filteredRecords.slice(0, audienceQuery.limit);
    }

    // Step 4: Get existing recipients for this campaign (for deduplication)
    const existingRecipients = await sheetsService.readSheet('Outreach_Recipients');
    const existingEmailsInCampaign = new Set(
      existingRecipients
        .filter((r: any) => r.CampaignID === campaignId && r.Email)
        .map((r: any) => String(r.Email).trim().toLowerCase())
    );

    // Step 5: Get suppression lists
    const [suppressionList, unsubscribes] = await Promise.all([
      sheetsService.readSheet('Suppression_List'),
      sheetsService.readSheet('Unsubscribes'),
    ]);

    const suppressedEmails = new Set(
      suppressionList
        .filter((s: any) => s.Type === 'email' && s.Key)
        .map((s: any) => String(s.Key).trim().toLowerCase())
    );

    const unsubscribedEmails = new Set(
      unsubscribes
        .filter((u: any) => u.Email)
        .map((u: any) => String(u.Email).trim().toLowerCase())
    );

    // Step 6: Process each record
    const recipientsToInsert: any[] = [];
    const leadTouchesToInsert: any[] = [];

    for (const record of filteredRecords) {
      try {
        // Extract email based on source
        const email = audienceQuery.source === 'CRM_Leads' 
          ? record.Email 
          : record.Email;
        
        if (!email || typeof email !== 'string' || !email.includes('@')) {
          result.errors.push(`Invalid email for record: ${JSON.stringify(record).substring(0, 100)}`);
          continue;
        }

        const emailNormalized = email.trim().toLowerCase();

        // Check duplicates in campaign
        if (existingEmailsInCampaign.has(emailNormalized)) {
          result.skippedDuplicates++;
          continue;
        }

        // Check suppression
        if (suppressedEmails.has(emailNormalized) || unsubscribedEmails.has(emailNormalized)) {
          result.suppressed++;
          continue;
        }

        // Generate RecipientID
        const recipientId = `RCP-${Date.now()}-${nanoid(6)}`;
        const now = new Date().toISOString();

        // Build recipient row
        const recipient: any = {
          RecipientID: recipientId,
          CampaignID: campaignId,
          SourceType: audienceQuery.source,
          SourceID: audienceQuery.source === 'CRM_Leads' ? record.LeadID : record.PartnerID,
          Email: emailNormalized,
          Phone: record.Phone || '',
          Name: audienceQuery.source === 'CRM_Leads' 
            ? (record.CompanyName || record.Name || '') 
            : (record.PartnerName || ''),
          City: record.City || '',
          CountryCode: record.CountryCode || '',
          Status: 'PENDING',
          OptInFlag: 'false',
          OptInTS: '',
          UnsubFlag: 'false',
          UnsubTS: '',
          SuppressedFlag: 'false',
          SuppressReason: '',
          LastSendTS: '',
          LastResult: '',
          Notes: '',
        };

        recipientsToInsert.push(recipient);
        existingEmailsInCampaign.add(emailNormalized);

        // For CRM_Leads, add Lead_Touch
        if (audienceQuery.source === 'CRM_Leads') {
          leadTouchesToInsert.push({
            TS: now,
            LeadID: record.LeadID,
            Channel: 'OUTREACH',
            Action: 'ENLIST',
            Actor: campaignId,
            Notes: `Enlisted in campaign ${campaignId}`,
            Outcome: 'SUCCESS',
          });
        }

        result.inserted++;
      } catch (error: any) {
        result.errors.push(`Failed to process record: ${error.message}`);
      }
    }

    // Step 7: Write recipients to sheet
    if (recipientsToInsert.length > 0) {
      await sheetsService.writeRows('Outreach_Recipients', recipientsToInsert);
      await sheetsService.logToSheet(
        'INFO',
        'Outreach',
        `Built audience for ${campaignId}: ${result.inserted} recipients added`
      );
    }

    // Step 8: Write lead touches for CRM leads
    if (leadTouchesToInsert.length > 0) {
      await sheetsService.writeRows('Lead_Touches', leadTouchesToInsert);
    }

  } catch (error: any) {
    result.errors.push(`Audience build failed: ${error.message}`);
    await sheetsService.logToSheet('ERROR', 'Outreach', `Audience build failed: ${error.message}`);
  }

  return result;
}

function applyFilters(records: any[], filters: Record<string, any>): any[] {
  return records.filter((record) => {
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'ScoreMin') {
        const score = parseFloat(record.Score) || 0;
        if (score < (value as number)) {
          return false;
        }
      } else if (Array.isArray(value)) {
        // Array filter - record value must be in array (case-insensitive, trimmed)
        const recordValue = record[key];
        if (!recordValue) {
          return false;
        }
        const normalizedRecordValue = String(recordValue).trim().toLowerCase();
        const normalizedFilterValues = value.map((v) => String(v).trim().toLowerCase());
        if (!normalizedFilterValues.includes(normalizedRecordValue)) {
          return false;
        }
      } else if (typeof value === 'string') {
        // String filter - case-insensitive, trimmed match
        const recordValue = record[key];
        if (!recordValue) {
          return false;
        }
        const normalizedRecordValue = String(recordValue).trim().toLowerCase();
        const normalizedFilterValue = value.trim().toLowerCase();
        if (normalizedRecordValue !== normalizedFilterValue) {
          return false;
        }
      }
    }
    return true;
  });
}
