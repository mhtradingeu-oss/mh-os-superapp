// TypeScript interfaces for Outreach Google Sheets

export interface OutreachCampaign {
  CampaignID: string;
  Name: string;
  Owner?: string;
  Goal?: string;
  AudienceQueryJSON?: string;
  Channel: string;
  Status: string; // DRAFT | SCHEDULED | RUNNING | PAUSED | COMPLETED
  CreatedTS: string;
  ScheduledTS?: string;
  StartedTS?: string;
  CompletedTS?: string;
  StatsJSON?: string;
  Notes?: string;
}

export interface OutreachSequence {
  SequenceID: string;
  CampaignID: string;
  Name: string;
  StepsJSON: string; // JSON array of SequenceStep[]
  Locale?: string;
  ActiveFlag: boolean | string;
  Notes?: string;
}

export interface OutreachTemplate {
  TemplateID: string;
  Name: string;
  Locale?: string;
  Channel: string;
  Subject?: string;
  BodyMarkdown?: string;
  VariablesCSV?: string;
  Owner?: string;
  ActiveFlag?: boolean | string;
  Notes?: string;
}

export interface OutreachRecipient {
  RecipientID: string;
  CampaignID: string;
  SourceType: string; // CRM_Leads | PartnerRegistry
  SourceID: string;
  Email: string;
  Phone?: string;
  Name?: string;
  City?: string;
  CountryCode?: string;
  Status: string; // PENDING | SENT | OPENED | CLICKED | BOUNCED | COMPLAINED | UNSUBSCRIBED
  OptInFlag?: boolean | string;
  OptInTS?: string;
  UnsubFlag?: boolean | string;
  UnsubTS?: string;
  SuppressedFlag?: boolean | string;
  SuppressReason?: string;
  LastSendTS?: string;
  LastResult?: string;
  Notes?: string;
}

export interface OutreachSend {
  SendID: string;
  CampaignID: string;
  SequenceID: string;
  RecipientID: string;
  SequenceStep: number | string;
  TemplateID: string;
  Channel: string;
  Subject?: string;
  BodyRef?: string;
  Status: string; // QUEUED | SENT | TEMP_ERROR | PERM_ERROR | OPENED | CLICKED | BOUNCED | COMPLAINED
  ProviderMsgID?: string;
  TS_Queued?: string;
  TS_Sent?: string;
  TS_Open?: string;
  TS_Click?: string;
  TS_Bounce?: string;
  TS_Complaint?: string;
  Error?: string;
  RetryCount?: number | string;
  LastErrorTS?: string;
}

export interface OSSettings {
  Key: string;
  Value: string;
  Description?: string;
  Category?: string;
  LastModified?: string;
}

export interface CRMLead {
  LeadID: string;
  Created?: string;
  Source?: string;
  Keyword?: string;
  City?: string;
  Postal?: string;
  CountryCode?: string;
  Name?: string;
  Category?: string;
  Phone?: string;
  Email?: string;
  Website?: string;
  Address?: string;
  Lat?: string;
  Lng?: string;
  Status?: string;
  Owner?: string;
  Score?: number | string;
  TierHint?: string;
  Notes?: string;
  LastTouchTS?: string;
}

export interface Partner {
  PartnerID: string;
  PartnerName: string;
  Tier?: string;
  PartnerType?: string;
  Email?: string;
  Phone?: string;
  Owner?: string;
  Status?: string;
  Street?: string;
  Postal?: string;
  City?: string;
  CountryCode?: string;
  Notes?: string;
  PartnerFolderID?: string;
  PartnerFolderURL?: string;
}
