import { GoogleSheetsService, SPREADSHEET_ID, getUncachableGoogleSheetClient } from './sheets';
import { retryWithBackoff } from './retry';

// ==================== SHEET DEFINITIONS (Central Source of Truth) ====================
// All worksheet names and headers are defined here for ensureSheets()
//
// ARCHITECTURE: This is the SINGLE SOURCE of truth for Google Sheets structure.
// - All 92 sheets are defined here with complete column definitions
// - This file replaces the deprecated init-google-sheets system
// - Schema is organized by category but stored in one file for maintainability

export interface ColumnDefinition {
  name: string;
  type?: 'string' | 'number' | 'date' | 'boolean' | 'formula';
  required?: boolean;
  unique?: boolean;
  foreignKey?: string; // Format: "SheetName.ColumnName"
  validation?: string;
  description?: string;
  default?: any;
}

export interface SheetDefinition {
  name: string;
  headers: string[]; // Simple string array for backwards compatibility
  columns?: ColumnDefinition[]; // Enhanced column definitions with types and validation
  numericColumns?: string[]; // Columns that should be numeric only (no € symbols)
  protected?: boolean; // Prevent direct user edits
  freezeRows?: number; // Number of header rows to freeze
  freezeColumns?: number; // Number of columns to freeze
  seedData?: any[]; // Initial data to populate
  description?: string; // Sheet purpose
  category?: 'pricing' | 'partners' | 'operations' | 'crm' | 'marketing' | 'system' | 'ai';
}

export const REQUIRED_SHEETS: SheetDefinition[] = [
  // ==================== SYSTEM SHEETS ====================
  {
    name: 'Settings',
    headers: ['Key', 'Value', 'Description', 'Category', 'LastModified'],
    protected: true, // Prevent manual edits
    freezeRows: 1,
    category: 'system',
    description: 'System-wide configuration and atomic counters'
  },
  // ==================== PRICING SHEETS ====================
  {
    name: 'Pricing_Params',
    headers: ['ParamKey', 'Value', 'Unit', 'Category', 'Type', 'AppliesTo', 'Notes'],
    freezeRows: 1,
    category: 'pricing',
    description: 'Global pricing parameters and margin targets'
  },
  {
    name: 'FinalPriceList',
    freezeRows: 1,
    freezeColumns: 1,
    category: 'pricing',
    description: 'Complete product catalog with pricing, costs, and channel prices (89 products)',
    headers: [
      'SKU', 'Name', 'Category', 'Brand', 'Barcode', 'Status',
      // Legacy v1 cost breakdown
      'Factory_Cost_EUR', 'Packaging_Cost_EUR', 'Freight_kg_EUR', 
      'Import_Duty_Pct', 'Overhead_Pct', 'COGS_EUR',
      // HAIROTICMEN v3: FullCost breakdown (9 components)
      'Shipping_Inbound_per_unit', 'EPR_LUCID_per_unit', 'GS1_per_unit',
      'Retail_Packaging_per_unit', 'QC_PIF_per_unit', 'Operations_per_unit',
      'Marketing_per_unit', 'FullCost_EUR',
      // Factory pricing inputs
      'FactoryPriceUnit_Manual', 'TotalFactoryPriceCarton', 'UnitsPerCarton', 'FX_BufferPct',
      // Product specs
      'Weight_g', 'Content_ml', 'Net_Content_ml', 'Dims_cm', 'VAT%',
      // PAngV Grundpreis (German price indication law)
      'Grundpreis', 'Grundpreis_Net', 'Grundpreis_Unit',
      // Channel/Line configuration
      'Amazon_TierKey', 'Line',
      // Manual pricing overrides
      'Manual_UVP_Inc',
      // Calculated UVP
      'UVP_Net', 'UVP_Inc',
      // V2: UVP with consumer rounding and guardrails
      'UVP_Inc_99', 'UVP_vs_Floor_Flag',
      'Guardrail_OwnStore_Inc', 'Guardrail_Amazon_FBM_Inc', 'Guardrail_Amazon_FBA_Inc',
      'Box_Size', 'Box_Cost_Per_Unit', 'Gift_Cost_Expected_Unit',
      'Grundpreis_Inc_Per_L', 'Pricing_Engine_Version',
      // V3 Unified Shipping System (8 new columns)
      'Shipping_Actual_Kg', 'Shipping_Volumetric_Kg', 'Shipping_Chargeable_Kg', 'Shipping_CarrierID',
      'ShipCost_per_Unit_OwnStore', 'ShipCost_per_Unit_FBM', 'ShipCost_per_Unit_FBA', 'ShipCost_per_Unit_B2B',
      // Channel costs
      'Ad_Pct', 'Returns_Pct', 'Loyalty_Pct', 'Payment_Pct', 'Amazon_Referral_Pct',
      // Shipping configuration
      'DHL_WeightBand', 'DHL_Zone',
      // Gift program
      'Gift_SKU', 'Gift_SKU_Cost', 'Gift_Attach_Rate', 'Gift_Funding_Pct', 'Gift_Shipping_Increment',
      // Margin & guardrails (computed)
      'PostChannel_Margin_Pct', 'Floor_B2C_Net', 'Guardrail_OK',
      // Recommended pricing
      'UVP_Recommended', 'UVP', 'MAP', 'AutoPriceFlag',
      // Channel prices
      'Price_Web', 'Price_Amazon', 'Price_Salon',
      // B2B Partner tier net prices
      'Net_Dealer_Basic', 'Net_Dealer_Plus', 'Net_Stand', 'Net_Distributor',
      // Competitor intelligence
      'Competitor_Min', 'Competitor_Median',
      // Metadata
      'Pricing_Version', 'QRUrl', 'Notes'
    ],
    numericColumns: [
      // Legacy v1 costs (numeric only)
      'COGS_EUR', 'Factory_Cost_EUR', 'Packaging_Cost_EUR', 'Freight_kg_EUR',
      'Import_Duty_Pct', 'Overhead_Pct',
      // HAIROTICMEN v3 FullCost components (all numeric)
      'Shipping_Inbound_per_unit', 'EPR_LUCID_per_unit', 'GS1_per_unit',
      'Retail_Packaging_per_unit', 'QC_PIF_per_unit', 'Operations_per_unit',
      'Marketing_per_unit', 'FullCost_EUR',
      // Factory pricing (all numeric)
      'FactoryPriceUnit_Manual', 'TotalFactoryPriceCarton', 'UnitsPerCarton', 'FX_BufferPct',
      // Product specs (numeric only - NOT Dims_cm which is text)
      'Weight_g', 'Content_ml', 'Net_Content_ml', 'VAT%',
      // PAngV Grundpreis (numeric only - NOT Grundpreis or Grundpreis_Unit which are formatted text)
      'Grundpreis_Net',
      // Manual overrides (numeric)
      'Manual_UVP_Inc',
      // Calculated UVP (numeric)
      'UVP_Net', 'UVP_Inc',
      // V2: Guardrails and costs (numeric only)
      'UVP_Inc_99', 'Guardrail_OwnStore_Inc', 'Guardrail_Amazon_FBM_Inc', 'Guardrail_Amazon_FBA_Inc',
      'Box_Cost_Per_Unit', 'Gift_Cost_Expected_Unit', 'Grundpreis_Inc_Per_L',
      // V3 Shipping System (numeric only)
      'Shipping_Actual_Kg', 'Shipping_Volumetric_Kg', 'Shipping_Chargeable_Kg',
      'ShipCost_per_Unit_OwnStore', 'ShipCost_per_Unit_FBM', 'ShipCost_per_Unit_FBA', 'ShipCost_per_Unit_B2B',
      // Channel costs (all numeric percentages)
      'Ad_Pct', 'Returns_Pct', 'Loyalty_Pct', 'Payment_Pct', 'Amazon_Referral_Pct',
      // Gift program (numeric only - NOT Gift_SKU which is text)
      'Gift_SKU_Cost', 'Gift_Attach_Rate', 'Gift_Funding_Pct', 'Gift_Shipping_Increment',
      // Margin & floor (numeric)
      'PostChannel_Margin_Pct', 'Floor_B2C_Net',
      // Recommended pricing (numeric)
      'UVP_Recommended', 'UVP', 'MAP',
      // Channel prices (numeric)
      'Price_Web', 'Price_Amazon', 'Price_Salon',
      // B2B Partner tier prices (numeric)
      'Net_Dealer_Basic', 'Net_Dealer_Plus', 'Net_Stand', 'Net_Distributor',
      // Competitor intelligence (numeric)
      'Competitor_Min', 'Competitor_Median'
    ]
  },
  {
    name: 'CompetitorPrices',
    headers: ['SKU', 'CompetitorName', 'Price', 'URL', 'LastChecked', 'Status']
  },
  {
    name: 'PartnerTiers',
    headers: ['Tier', 'MinOrderVolume', 'DiscountPct', 'CommissionPct', 'Benefits', 'Payment Terms (Days)', 'CommissionRate_Pct']
  },
  {
    name: 'PartnerRegistry',
    headers: [
      'PartnerID', 'PartnerName', 'Tier', 'PartnerType', 'Email', 'Phone', 'Owner', 'Status',
      'Street', 'Postal', 'City', 'CountryCode',
      'ShippingStreet', 'ShippingPostal', 'ShippingCity', 'ShippingCountryCode',
      'Notes', 'PartnerFolderID', 'PartnerFolderURL'
    ]
  },
  {
    name: 'StandSites',
    headers: [
      'StandID', 'PartnerID', 'Location', 'Address', 'City', 'GooglePlaceID',
      'Lat', 'Lng', 'OpenedDate', 'Status', 'QR_URL', 'Notes'
    ]
  },
  {
    name: 'Stand_Inventory',
    headers: ['StandID', 'SKU', 'Qty', 'LastRefill', 'NextRefill', 'Status']
  },
  {
    name: 'Stand_Refill_Plans',
    headers: ['PlanID', 'StandID', 'SKU', 'MinQty', 'RefillQty', 'Frequency', 'Status']
  },
  {
    name: 'Stand_Visits',
    headers: ['VisitID', 'StandID', 'VisitDate', 'RepName', 'Notes', 'PhotoURLs']
  },
  {
    name: 'Stand_KPIs',
    headers: ['StandID', 'Month', 'Sales', 'Footfall', 'ConversionRate', 'Status']
  },
  {
    name: 'AuthorizedAssortment',
    headers: ['PartnerID', 'SKU', 'Authorized', 'Notes']
  },
  {
    name: 'StarterBundles',
    headers: ['BundleID', 'Tier', 'SKU', 'Qty', 'Status']
  },
  {
    name: 'RefillPlans',
    headers: ['PlanID', 'PartnerID', 'SKU', 'MinQty', 'RefillQty', 'Frequency', 'Status']
  },
  {
    name: 'Quotes',
    headers: [
      'QuoteID', 'PartnerID', 'QuoteDate', 'ExpiryDate', 'Subtotal', 'DiscountPct',
      'DiscountAmt', 'VATRate', 'VATAmt', 'Total', 'Status', 'Notes'
    ]
  },
  {
    name: 'QuoteLines',
    headers: ['QuoteID', 'LineNum', 'SKU', 'Qty', 'UnitPrice', 'Discount', 'LineTotal']
  },
  {
    name: 'Orders',
    headers: [
      'OrderID', 'QuoteID', 'PartnerID', 'OrderDate', 'Subtotal', 'DiscountAmt',
      'VATAmt', 'ShippingCost', 'Total', 'PaymentMethod', 'PaymentStatus',
      'FulfillmentStatus', 'Status', 'Notes'
    ]
  },
  {
    name: 'OrderLines',
    headers: ['OrderID', 'LineNum', 'SKU', 'Qty', 'UnitPrice', 'Discount', 'LineTotal']
  },
  {
    name: 'Commission_Ledger',
    headers: ['TxID', 'PartnerID', 'OrderID', 'TxDate', 'Amount', 'Rate', 'Status', 'PaidDate']
  },
  {
    name: 'Loyalty_Ledger',
    headers: ['TxID', 'PartnerID', 'OrderID', 'TxDate', 'Points', 'Type', 'Status', 'Notes']
  },
  {
    name: 'DHL_Rates',
    headers: ['Zone', 'Weight_g_Max', 'Price', 'Currency', 'EffectiveFrom']
  },
  {
    name: 'DHL_Tariffs',
    headers: ['Zone', 'WeightMax_g', 'BasePrice_EUR', 'Surcharge_EUR', 'EffectiveFrom']
  },
  {
    name: 'Shipments_DHL',
    headers: [
      'ShipmentID', 'OrderID', 'PartnerID', 'ManifestID', 'TrackingNumber',
      'Carrier', 'Weight_g', 'Zone', 'ShippingCost', 'Status', 'ShippedDate',
      'DeliveryDate', 'Notes'
    ]
  },
  {
    name: 'MAP_Guardrails',
    headers: ['SKU', 'RaisedTS', 'Type', 'CurrentValue', 'ThresholdValue', 'Message', 'Status']
  },
  {
    name: 'Pricing_Suggestions',
    headers: ['SKU', 'CreatedTS', 'SuggestedUVP', 'SuggestedMAP', 'Reason', 'Status']
  },
  // ==================== AI DRAFT TABLES (Task 3) ====================
  {
    name: 'Pricing_Suggestions_Draft',
    headers: [
      // Draft Metadata (shared across all draft tables)
      'DraftID', 'SourceAgent', 'ActorType', 'RequestID', 'Status',
      'CreatedAt', 'ReviewedBy', 'ReviewedAt', 'PromotionRef', 'Notes',
      // Business Fields
      'SKU', 'SuggestionID',
      // All FinalPriceList fields (AI can suggest any subset)
      'Name', 'Category', 'Brand', 'Barcode', 'ProductStatus', 'ProductNotes',
      'Factory_Cost_EUR', 'Packaging_Cost_EUR', 'Freight_kg_EUR',
      'Import_Duty_Pct', 'Overhead_Pct', 'COGS_EUR',
      'Shipping_Inbound_per_unit', 'EPR_LUCID_per_unit', 'GS1_per_unit',
      'Retail_Packaging_per_unit', 'QC_PIF_per_unit', 'Operations_per_unit',
      'Marketing_per_unit', 'FullCost_EUR',
      'Weight_g', 'Content_ml', 'Dims_cm', 'VAT%',
      'Grundpreis', 'Grundpreis_Unit', 'Amazon_TierKey', 'Line',
      'PostChannel_Margin_Pct', 'Guardrail_OK',
      'UVP_Recommended', 'UVP', 'MAP', 'AutoPriceFlag',
      'Price_Web', 'Price_Amazon', 'Price_Salon',
      'Net_Dealer_Basic', 'Net_Dealer_Plus', 'Net_Stand', 'Net_Distributor',
      'Competitor_Min', 'Competitor_Median',
      'Pricing_Version', 'QRUrl'
    ],
    numericColumns: [
      // Mirror FinalPriceList numeric columns
      'Factory_Cost_EUR', 'Packaging_Cost_EUR', 'Freight_kg_EUR',
      'COGS_EUR',
      'Shipping_Inbound_per_unit', 'EPR_LUCID_per_unit', 'GS1_per_unit',
      'Retail_Packaging_per_unit', 'QC_PIF_per_unit', 'Operations_per_unit',
      'Marketing_per_unit', 'FullCost_EUR',
      'PostChannel_Margin_Pct',
      'Weight_g', 'Content_ml', 'UVP_Recommended', 'UVP', 'MAP',
      'Price_Web', 'Price_Amazon', 'Price_Salon',
      'Net_Dealer_Basic', 'Net_Dealer_Plus', 'Net_Stand', 'Net_Distributor',
      'Competitor_Min', 'Competitor_Median'
    ]
  },
  {
    name: 'Sales_Suggestions_Draft',
    headers: [
      // Draft Metadata
      'DraftID', 'SourceAgent', 'ActorType', 'RequestID', 'Status',
      'CreatedAt', 'ReviewedBy', 'ReviewedAt', 'PromotionRef', 'Notes',
      // Business Fields
      'QuoteID', 'PartnerID', 'PartnerName', 'LinesJSON',
      'TotalBeforeTax', 'TotalAfterTax', 'Currency', 'Lang',
      'ValidUntil', 'PaymentTerms', 'SuggestionReason'
    ],
    numericColumns: ['TotalBeforeTax', 'TotalAfterTax']
  },
  {
    name: 'Outreach_Drafts',
    headers: [
      // Draft Metadata
      'DraftID', 'SourceAgent', 'ActorType', 'RequestID', 'Status',
      'CreatedAt', 'ReviewedBy', 'ReviewedAt', 'PromotionRef', 'Notes',
      // Business Fields
      'CampaignID', 'Subject', 'BodyText', 'BodyHTML',
      'RecipientEmail', 'RecipientName', 'Lang',
      'ScheduledFor', 'HasUnsubscribe', 'Tags'
    ]
  },
  {
    name: 'OS_Logs',
    headers: ['Timestamp', 'Level', 'Scope', 'Message', 'Ref'],
    protected: true, // System-managed only
    category: 'system',
    description: 'Audit trail and system logs'
  },
  {
    name: 'OS_Health',
    headers: ['CheckTS', 'Component', 'Status', 'Message', 'Details'],
    protected: true, // System-managed only
    category: 'system',
    description: 'Health check results and validation reports'
  },
  {
    name: 'AI_Playbooks',
    headers: ['PlaybookID', 'Name', 'Schedule', 'Description', 'LastRun', 'Status']
  },
  {
    name: 'AI_Tasks',
    headers: ['TaskID', 'PlaybookID', 'CreatedTS', 'Prompt', 'Response', 'Status']
  },
  {
    name: 'Sync_Queue',
    headers: ['QueueID', 'Integration', 'Operation', 'Payload', 'Status', 'CreatedTS', 'ProcessedTS']
  },
  {
    name: 'AI_Inbox',
    headers: ['MessageID', 'TS', 'From', 'Channel', 'Text', 'AttachedRef', 'Status']
  },
  {
    name: 'AI_Outbox',
    headers: ['MessageID', 'TS', 'To', 'Channel', 'Text', 'AttachedRef', 'Status']
  },
  {
    name: 'AI_Crew',
    headers: [
      'JobID', 'CreatedTS', 'AgentID', 'Task', 'InputJSON', 'OutputJSON', 'Status',
      'GuardrailsPassed', 'RequiresApproval', 'ApprovedBy', 'ApprovedTS', 'AppliedTS',
      'ErrorMsg', 'Notes'
    ]
  },
  {
    name: 'Enums',
    headers: ['List', 'Key', 'Label', 'Sort', 'Active']
  },
  {
    name: 'Bundles',
    headers: ['BundleID', 'Name', 'ItemsJSON', 'Channel', 'Active', 'Notes']
  },
  {
    name: 'Gifts_Bank',
    headers: ['GiftID', 'SKU', 'Threshold_EUR', 'Channel', 'Active', 'Notes']
  },
  {
    name: 'Salon_Subscriptions',
    headers: ['SubID', 'PartnerID', 'Plan', 'BillingCycle', 'Price', 'DiscountPct', 'BenefitsJSON', 'StartTS', 'Status']
  },
  // REMOVED: Subscription_Invoices - Not affiliate-related
  // REMOVED: Affiliate_Leads - Legacy, replaced by AffiliateCandidates
  
  {
    name: 'Affiliate_Programs',
    headers: ['AffID', 'Name', 'RatePct', 'CookieDays', 'Channel', 'Active'],
    description: 'Affiliate program configurations (Standard, Premium, Partner programs)',
    category: 'affiliate'
  },
  {
    name: 'Commission_Rules',
    headers: ['RuleID', 'Role', 'Tier', 'Channel', 'BaseRatePct', 'BonusPct', 'CapPct', 'Notes']
  },
  {
    name: 'Email_Queue',
    headers: [
      'MsgID', 'TS', 'To', 'Subject', 'Template', 'PayloadJSON', 'Status', 'Error',
      'CampID', 'SeqStep', 'Body', 'ProviderID', 'SentTS', 'OpenTS', 'ClickTS',
      'BounceTS', 'ComplaintTS', 'MessageKey', 'Attempts', 'NextRetryTS', 'LastError'
    ]
  },
  {
    name: 'Audit_Trail',
    headers: ['TS', 'Actor', 'Action', 'RefType', 'RefID', 'DetailJSON']
  },
  {
    name: 'Shipping_Methods',
    headers: [
      'MethodID', 'MethodName_EN', 'MethodName_AR', 'Active', 'DefaultCostEUR',
      'MinDays', 'MaxDays', 'Icon', 'Description_EN', 'Description_AR', 'Notes'
    ]
  },
  {
    name: 'Shipping_Rules',
    headers: [
      'RuleID', 'RuleName', 'MethodID', 'PartnerTier', 'PartnerType', 'MinOrderEUR', 'MaxOrderEUR',
      'Zone', 'ShippingCostEUR', 'FreeShipping', 'Priority', 'Active', 'Notes'
    ]
  },
  {
    name: 'Packaging_Boxes',
    category: 'operations',
    description: 'Comprehensive packaging catalog with B2B cartonization support (V3: 17 columns)',
    headers: [
      'code', 'name', 'boxType',
      'inner_L_cm', 'inner_W_cm', 'inner_H_cm',
      'outer_L_cm', 'outer_W_cm', 'outer_H_cm',
      'tare_weight_g', 'unit_cost_eur',
      'is_carton', 'units_per_carton', 'carton_cost_eur',
      'max_units', 'max_weight_kg', 'active'
    ],
    numericColumns: [
      'inner_L_cm', 'inner_W_cm', 'inner_H_cm',
      'outer_L_cm', 'outer_W_cm', 'outer_H_cm',
      'tare_weight_g', 'unit_cost_eur',
      'units_per_carton', 'carton_cost_eur',
      'max_units', 'max_weight_kg'
    ]
  },
  {
    name: 'ShippingWeightBands',
    category: 'operations',
    description: 'Carrier pricing tiers by weight (V3 unified shipping)',
    headers: [
      'carrierId', 'serviceLevel', 'zone', 'minKg', 'maxKg', 'baseEur', 'fuelPct', 'active'
    ],
    numericColumns: ['minKg', 'maxKg', 'baseEur', 'fuelPct']
  },
  {
    name: 'ShippingCostsFixed',
    category: 'operations',
    description: 'Fixed shipping costs per channel (V3 unified shipping)',
    headers: [
      'costType', 'channel', 'costEur', 'notes'
    ],
    numericColumns: ['costEur']
  },
  {
    name: 'Shipment_Labels',
    headers: [
      'LabelID', 'ShipmentID', 'OrderID', 'GeneratedTS', 'QRCode', 'Barcode',
      'LabelPDF_URL', 'PrintedTS', 'PrintedBy', 'Status', 'Notes'
    ]
  },
  {
    name: 'Shipments',
    headers: [
      'ShipmentID', 'OrderID', 'PartnerID', 'CreatedTS', 'ShippingMethod', 'Zone', 'Weight_g',
      'BoxID', 'BoxCostEUR', 'PackagingCostEUR', 'ShippingCostEUR', 'TotalCostEUR',
      'TrackingNumber', 'Status', 'PickupAddress', 'DeliveryAddress', 'DriverID',
      'EstimatedDeliveryDate', 'ActualDeliveryDate', 'LabelGenerated', 'LabelPrinted', 'Notes'
    ]
  },
  // ==================== CRM SHEETS (Phase 2A) ====================
  {
    name: 'CRM_Leads',
    headers: [
      'LeadID', 'CreatedTS', 'Source', 'Keyword', 'City', 'Postal', 'CountryCode',
      'Name', 'Category', 'Phone', 'Email', 'Website', 'Address', 'Lat', 'Lng',
      'Status', 'Owner', 'Score', 'TierHint', 'Notes', 'LastTouchTS'
    ]
  },
  {
    name: 'Lead_Touches',
    headers: ['TouchID', 'TS', 'LeadID', 'Channel', 'Action', 'Actor', 'Notes', 'Outcome']
  },
  {
    name: 'Territories',
    headers: ['TerritoryID', 'Name', 'Owner', 'CountryCode', 'CitiesCSV', 'PostalRangesJSON', 'Notes']
  },
  {
    name: 'Assignment_Rules',
    headers: ['RuleID', 'TerritoryID', 'When', 'ConditionJSON', 'AssignTo', 'Priority', 'ActiveFlag', 'Notes']
  },
  {
    name: 'Enrichment_Queue',
    headers: ['JobID', 'CreatedTS', 'LeadID', 'Task', 'ParamsJSON', 'Status', 'Attempts', 'LastError']
  },
  {
    name: 'Dedupe_Index',
    headers: ['IndexKey', 'LeadID', 'Type', 'Notes']
  },
  // ==================== OUTREACH SHEETS (Phase 2B) ====================
  {
    name: 'Outreach_Campaigns',
    headers: [
      'CampID', 'CampaignID', 'Name', 'SeqID', 'SequenceID', 'AudienceQueryJSON', 'Goal',
      'Owner', 'Channel', 'Locale', 'ScheduleUTC', 'Status', 'CreatedTS', 'ApprovedTS',
      'AppliedTS', 'StartedTS', 'Notes'
    ]
  },
  {
    name: 'Outreach_Sequences',
    headers: [
      'SeqID', 'Name', 'Purpose', 'StepsJSON', 'Lang', 'Tier', 'WarmupFlag', 'Status',
      'Owner', 'CreatedTS', 'UpdatedTS', 'Notes'
    ]
  },
  {
    name: 'Outreach_Templates',
    headers: [
      'TemplateID', 'Name', 'Channel', 'Lang', 'Locale', 'Tier', 'Subject', 'Body',
      'BodyMarkdown', 'TokensCSV', 'Version', 'Status', 'Owner', 'CreatedTS',
      'UpdatedTS', 'Notes'
    ]
  },
  {
    name: 'Outreach_Contacts',
    headers: [
      'ContactID', 'Email', 'Name', 'Company', 'City', 'Country', 'TierGuess',
      'Source', 'OptInFlag', 'UnsubscribedFlag', 'LastContactTS', 'CreatedTS', 'Notes'
    ]
  },
  {
    name: 'Outreach_Recipients',
    headers: [
      'RecipientID', 'CampaignID', 'SourceType', 'SourceID', 'Email', 'Phone', 'Name',
      'City', 'CountryCode', 'Status', 'OptInFlag', 'OptInTS', 'UnsubFlag', 'UnsubTS',
      'SuppressedFlag', 'SuppressReason', 'LastSendTS', 'LastResult', 'Notes'
    ]
  },
  {
    name: 'Outreach_Sends',
    headers: [
      'SendID', 'CampaignID', 'SequenceID', 'RecipientID', 'SequenceStep', 'TemplateID', 'Channel',
      'Subject', 'BodyRef', 'Status', 'ProviderMsgID', 'TS_Queued', 'TS_Sent',
      'TS_Open', 'TS_Click', 'TS_Bounce', 'TS_Complaint', 'Error', 'RetryCount', 'LastErrorTS'
    ]
  },
  {
    name: 'Suppression_List',
    headers: ['Key', 'Type', 'Reason', 'Source', 'TS']
  },
  {
    name: 'Email_Stats',
    headers: ['StatsID', 'Day', 'CampID', 'Sent', 'Open', 'Click', 'Bounce', 'Complaint', 'Unsub']
  },
  {
    name: 'Unsubscribes',
    headers: ['Email', 'CampID', 'CampaignID', 'UnsubTS', 'Source', 'IPAddress', 'UserAgent']
  },
  {
    name: 'Bounce_Events',
    headers: ['Email', 'CampaignID', 'ProviderMsgID', 'BounceType', 'Diagnostic', 'TS']
  },
  {
    name: 'Complaint_Events',
    headers: ['Email', 'CampaignID', 'ProviderMsgID', 'ComplaintType', 'TS']
  },
  // ==================== MARKETING SHEETS (Phase 2C) ====================
  // SEO
  {
    name: 'SEO_Pages',
    headers: [
      'URL', 'KeywordPrimary', 'Locale', 'TitleTag', 'MetaDescription', 'H1', 'H2sCSV',
      'WordCount', 'Canonical', 'IndexFlag', 'LastAuditTS', 'Score_Tech', 'Score_Content',
      'Score_InternalLinks', 'Status', 'Notes'
    ]
  },
  // ADS
  {
    name: 'Ads_Keywords',
    headers: [
      'Keyword', 'MatchType', 'Locale', 'Intent', 'Cluster', 'CPC_EUR', 'Est_CTR',
      'Est_ConvRate', 'TargetCPA', 'NegativeFlag', 'Notes'
    ],
    numericColumns: ['CPC_EUR', 'Est_CTR', 'Est_ConvRate', 'TargetCPA']
  },
  {
    name: 'Ads_Campaigns',
    headers: [
      'CampaignID', 'Name', 'Objective', 'Locale', 'Network', 'DailyBudget_EUR',
      'BidStrategy', 'Status', 'StartDate', 'EndDate', 'UTM_Source', 'UTM_Medium',
      'UTM_Campaign', 'Notes'
    ],
    numericColumns: ['DailyBudget_EUR']
  },
  {
    name: 'Ads_AdGroups',
    headers: [
      'AdGroupID', 'CampaignID', 'AdGroupName', 'Keywords', 'NegativeKeywords', 'MatchType',
      'BidEUR', 'CreatedTS', 'Status', 'Notes'
    ],
    numericColumns: ['BidEUR']
  },
  {
    name: 'Ads_Creatives',
    headers: [
      'CreativeID', 'AdGroupID', 'Format', 'Headlines', 'Descriptions', 'CallToAction',
      'FinalURL', 'Language', 'CreatedTS', 'Status', 'LastAIUpdateTS', 'Notes'
    ]
  },
  {
    name: 'Ads_Exports',
    headers: [
      'ExportID', 'CampaignID', 'Format', 'FileURL', 'Rows', 'CreatedTS', 'Status', 'Notes'
    ]
  },
  {
    name: 'Ads_KPIs',
    headers: [
      'CampaignID', 'Date', 'Impressions', 'Clicks', 'SpendEUR', 'Conversions', 'RevenueEUR',
      'CTR', 'CPC', 'CPA', 'CPM', 'ROAS', 'Notes'
    ],
    numericColumns: ['Impressions', 'Clicks', 'SpendEUR', 'Conversions', 'RevenueEUR',
      'CTR', 'CPC', 'CPA', 'CPM', 'ROAS']
  },
  // SOCIAL
  {
    name: 'Social_Calendar',
    headers: [
      'PostID', 'Date', 'Time', 'Channel', 'Locale', 'Line', 'Hook', 'Caption',
      'HashtagsCSV', 'AssetRefsCSV', 'CTA', 'UTM_URL', 'Owner', 'Status', 'Notes'
    ]
  },
  {
    name: 'Social_Assets',
    headers: [
      'AssetID', 'Type', 'Storage', 'URL', 'AltText', 'Line', 'Locale',
      'License', 'Owner', 'Status', 'Notes'
    ]
  },
  {
    name: 'Social_Metrics',
    headers: [
      'PostID', 'Channel', 'TS', 'Impressions', 'Reach', 'Clicks', 'Likes', 'Comments',
      'Shares', 'Saves', 'CTR', 'CPC', 'CPM', 'Cost_EUR', 'Revenue_EUR', 'Notes'
    ],
    numericColumns: ['Impressions', 'Reach', 'Clicks', 'Likes', 'Comments', 'Shares', 
      'Saves', 'CTR', 'CPC', 'CPM', 'Cost_EUR', 'Revenue_EUR']
  },
  // COMMON
  {
    name: 'UTM_Builder',
    headers: [
      'RefID', 'BaseURL', 'Source', 'Medium', 'Campaign', 'Term', 'Content',
      'FinalURL', 'ShortURL', 'CreatedTS'
    ]
  },
  {
    name: 'Link_Shortener',
    headers: ['Key', 'Provider', 'APIKeyRef', 'Domain', 'Status', 'Notes']
  },
  // AI AGENTS
  {
    name: 'AI_Agents_Log',
    headers: [
      'LogID', 'AgentID', 'RequestType', 'InputSheets', 'OutputSheets', 'Status',
      'CreatedTS', 'CompletedTS', 'RowsCreated', 'PromptTokens', 'CompletionTokens',
      'TotalTokens', 'CostEUR', 'Notes'
    ],
    numericColumns: ['RowsCreated', 'PromptTokens', 'CompletionTokens', 'TotalTokens', 'CostEUR']
  },
  {
    name: 'SEO_Briefs',
    headers: [
      'BriefID', 'TargetURL', 'Language', 'Keywords', 'Title', 'MetaDescription', 'H1',
      'ContentOutline', 'WordCount', 'ProductSKUs', 'CreatedTS', 'Status', 'LastAIUpdateTS', 'Notes'
    ],
    numericColumns: ['WordCount']
  },
  {
    name: 'SEO_Audits',
    headers: [
      'AuditID', 'PageURL', 'IssueType', 'Severity', 'CurrentValue', 'RecommendedFix',
      'CreatedTS', 'Status', 'Notes'
    ]
  },
  {
    name: 'SEO_Keywords',
    headers: [
      'KeywordID', 'Keyword', 'Locale',
      'HarvestSource', 'HarvestParamsJSON', 'HarvestTS',
      'Cluster', 'ClusterID', 'ClusterScore', 'LastClusteredTS',
      'Intent', 'IntentConfidencePct',
      'SearchVolume', 'Difficulty', 'CPC_EUR', 'Rank', 'TrafficEstimate',
      'OpportunityScore', 'SERPFeaturesCSV', 'TopCompetitorsCSV',
      'Priority', 'PriorityReason',
      'AssignedURL', 'BriefID',
      'CreatedTS', 'LastChecked', 'Status', 'Notes'
    ],
    numericColumns: ['ClusterScore', 'IntentConfidencePct', 'SearchVolume', 'Difficulty', 
      'CPC_EUR', 'Rank', 'TrafficEstimate', 'OpportunityScore', 'Priority']
  },
  // ==================== PRICING LAW V2 SHEETS ====================
  {
    name: 'Channels',
    headers: [
      'ChannelID', 'ChannelName', 'Active',
      'Payment_Provider', 'Payment_Fee_Pct', 'Payment_Fee_Fixed_EUR',
      'Amazon_Referral_Pct_Low', 'Amazon_Referral_Pct_High', 'Amazon_Referral_Min_EUR',
      'FBA_Fee_Base_EUR', 'Returns_Pct', 'Loyalty_Accounting_Pct',
      'Uses_DHL', 'Uses_FBA', 'Notes'
    ],
    numericColumns: ['Payment_Fee_Pct', 'Payment_Fee_Fixed_EUR', 
      'Amazon_Referral_Pct_Low', 'Amazon_Referral_Pct_High', 'Amazon_Referral_Min_EUR',
      'FBA_Fee_Base_EUR', 'Returns_Pct', 'Loyalty_Accounting_Pct']
  },
  {
    name: 'AmazonSizeTiers',
    headers: [
      'TierKey', 'TierName', 
      'Weight_Min_g', 'Weight_Max_g', 'Dims_Max_cm',
      'FBA_Fee_EUR', 'FBA_Surcharge_2025_EUR', 
      'Active', 'Notes'
    ],
    numericColumns: ['Weight_Min_g', 'Weight_Max_g', 'FBA_Fee_EUR', 'FBA_Surcharge_2025_EUR']
  },
  {
    name: 'ShippingMatrix_DHL',
    headers: [
      'Zone', 'Weight_Min_g', 'Weight_Max_g', 'Base_Rate_EUR',
      'EffectiveFrom', 'EffectiveTo', 'Notes'
    ],
    numericColumns: ['Weight_Min_g', 'Weight_Max_g', 'Base_Rate_EUR']
  },
  {
    name: 'DHL_Surcharges',
    headers: [
      'SurchargeKey', 'SurchargeName', 'Type',
      'Amount_EUR', 'Pct_Of_Base',
      'EffectiveFrom', 'EffectiveTo', 'Active', 'Notes'
    ],
    numericColumns: ['Amount_EUR', 'Pct_Of_Base']
  },
  {
    name: 'QuantityDiscounts',
    headers: [
      'DiscountID', 'TierName', 'MinQty', 'MaxQty', 'Discount_Pct',
      'AppliesTo', 'Active', 'Notes'
    ],
    numericColumns: ['MinQty', 'MaxQty', 'Discount_Pct']
  },
  {
    name: 'DiscountCaps',
    headers: [
      'CapID', 'PartnerTier',
      'Max_Role_Discount_Pct', 'Max_Quantity_Discount_Pct', 'Max_Combined_Discount_Pct',
      'Active', 'Notes'
    ],
    numericColumns: ['Max_Role_Discount_Pct', 'Max_Quantity_Discount_Pct', 'Max_Combined_Discount_Pct']
  },
  {
    name: 'OrderDiscounts',
    headers: [
      'DiscountID', 'Threshold_EUR', 'Discount_Pct', 'Discount_Fixed_EUR',
      'AppliesTo', 'Active', 'Notes'
    ],
    numericColumns: ['Threshold_EUR', 'Discount_Pct', 'Discount_Fixed_EUR']
  },
  {
    name: 'Pricing_Line_Targets',
    headers: [
      'Line', 'Target_Margin_Pct', 'Floor_Multiplier', 'Guardrail_Margin_Pct',
      'Rounding_Strategy', 'Active', 'Notes'
    ],
    numericColumns: ['Target_Margin_Pct', 'Floor_Multiplier', 'Guardrail_Margin_Pct']
  },
  
  // ==================== ADVANCED PARTNER PROGRAMS (Day 1-2) ====================
  {
    name: 'PartnerPrograms',
    category: 'partners',
    description: 'Comprehensive partner programs supporting 7 program types',
    freezeRows: 1,
    headers: [
      'ProgramID', 'ProgramName', 'ProgramType', 'CommissionRate', 'MinOrderValue', 'MinOrderQty',
      'DiscountTier', 'PaymentTerms', 'Active',
      // Affiliate Program Fields
      'CookieDays', 'TrackingPrefix', 'PaymentThreshold', 'PaymentMethod',
      // Sales Representative Fields
      'TerritoryJSON', 'MonthlyTarget', 'BonusStructureJSON',
      // Stand Partner Fields
      'InventoryLimit', 'RefillSchedule', 'AutoRefill',
      // Metadata
      'CreatedAt', 'UpdatedAt', 'CreatedBy', 'Notes'
    ],
    numericColumns: ['CommissionRate', 'MinOrderValue', 'MinOrderQty', 'CookieDays', 'PaymentThreshold', 'MonthlyTarget', 'InventoryLimit']
  },
  {
    name: 'StandPolicies',
    category: 'partners',
    description: 'Detailed policies for Stand Partners covering inventory, sales, returns, and payments',
    freezeRows: 1,
    headers: [
      'PolicyID', 'PartnerID', 'StandID',
      // Inventory Policies
      'MaxInventoryValue', 'AutoRefill', 'RefillThreshold', 'AllowedCategoriesJSON',
      // Sales Policies
      'CanDiscount', 'MaxDiscountPct', 'RequiresApproval', 'ApprovalThreshold',
      // Returns Policies
      'AllowReturns', 'ReturnWindowDays', 'RestockingFeePct',
      // Payment Policies
      'PaymentTerms', 'CreditLimit', 'RequireDeposit', 'DepositPct',
      'Active', 'CreatedAt', 'UpdatedAt', 'Notes'
    ],
    numericColumns: ['MaxInventoryValue', 'RefillThreshold', 'MaxDiscountPct', 'ApprovalThreshold', 'ReturnWindowDays', 'RestockingFeePct', 'CreditLimit', 'DepositPct']
  },
  {
    name: 'AffiliateTracking',
    category: 'partners',
    description: 'Track affiliate referrals and conversions',
    freezeRows: 1,
    headers: [
      'TrackingID', 'AffiliateID', 'TrackingCode', 'ReferralSource', 'ClickedAt', 'ConvertedAt',
      'OrderID', 'CommissionEarned', 'CommissionStatus', 'CustomerID', 'Notes'
    ],
    numericColumns: ['CommissionEarned']
  },
  
  // ==================== LOYALTY SYSTEM (Day 2) ====================
  {
    name: 'LoyaltyPrograms',
    category: 'crm',
    description: 'Loyalty program configurations with earning/redemption rules and tiers',
    freezeRows: 1,
    headers: [
      'ProgramID', 'ProgramName', 'Active',
      // Earning Rules
      'PointsPerEuro', 'MinPurchase', 'BonusCategoriesJSON', 'BirthdayBonus', 'ReferralBonus',
      // Redemption Rules
      'PointsToEuro', 'MinRedemption', 'MaxPerOrderPct', 'ExpiryDays',
      // Tiers Configuration
      'TiersJSON',
      'CreatedAt', 'UpdatedAt', 'Notes'
    ],
    numericColumns: ['PointsPerEuro', 'MinPurchase', 'BirthdayBonus', 'ReferralBonus', 'PointsToEuro', 'MinRedemption', 'MaxPerOrderPct', 'ExpiryDays']
  },
  {
    name: 'CustomerLoyalty',
    category: 'crm',
    description: 'Customer loyalty points and tier status',
    freezeRows: 1,
    headers: [
      'CustomerID', 'ProgramID', 'CurrentPoints', 'LifetimePoints', 'PointsRedeemed', 'CurrentTier',
      'NextTierPoints', 'MemberSince', 'LastActivity', 'PointsExpiryDate', 'ReferralCode',
      'ReferralCount', 'Birthday', 'BirthdayBonusUsed', 'Notes'
    ],
    numericColumns: ['CurrentPoints', 'LifetimePoints', 'PointsRedeemed', 'NextTierPoints', 'ReferralCount']
  },
  {
    name: 'LoyaltyTransactions',
    category: 'crm',
    description: 'Detailed log of all loyalty point transactions',
    freezeRows: 1,
    headers: [
      'TransactionID', 'CustomerID', 'TransactionType', 'Points', 'RelatedOrderID', 'Description',
      'CreatedAt', 'ExpiryDate', 'ProcessedBy', 'Notes'
    ],
    numericColumns: ['Points']
  },
  // ==================== AFFILIATE INTELLIGENCE SYSTEM (AIS v1.0) ====================
  {
    name: 'AffiliateProfiles',
    category: 'marketing',
    description: 'Affiliate partner profiles and performance metrics',
    freezeRows: 1,
    headers: [
      'AffiliateID', 'Name', 'Email', 'Website', 'SocialMedia', 'Niche', 'Status', 'JoinDate',
      'TotalClicks', 'TotalConversions', 'TotalRevenue', 'TotalCommission', 'ConversionRate',
      'EarningsPerClick', 'Tier', 'Score', 'LastActivity', 'ReferralCode', 'CommissionPct'
    ],
    numericColumns: ['TotalClicks', 'TotalConversions', 'TotalRevenue', 'TotalCommission', 'ConversionRate', 'EarningsPerClick', 'Score', 'CommissionPct']
  },
  {
    name: 'AffiliateClicks',
    category: 'marketing',
    description: 'Click tracking for affiliate links',
    freezeRows: 1,
    headers: [
      'ClickID', 'AffiliateID', 'Timestamp', 'IP', 'UserAgent', 'Device', 'Browser', 'OS',
      'Country', 'City', 'ReferralSource', 'LandingPage', 'QueryParams'
    ],
    numericColumns: []
  },
  {
    name: 'AffiliateConversions',
    category: 'marketing',
    description: 'Conversion tracking and commission calculations',
    freezeRows: 1,
    headers: [
      'ConversionID', 'AffiliateID', 'ClickID', 'OrderID', 'Timestamp', 'Revenue', 'Commission',
      'CommissionPct', 'ProductsSold', 'CustomerID'
    ],
    numericColumns: ['Revenue', 'Commission', 'CommissionPct']
  },
  {
    name: 'AffiliateCandidates',
    category: 'marketing',
    description: 'AI-discovered potential affiliate partners',
    freezeRows: 1,
    headers: [
      'CandidateID', 'Name', 'Email', 'PrivateEmail', 'Phone', 'Website', 'Instagram', 'YouTube', 'TikTok', 'Twitter',
      'Niche', 'Followers', 'EngagementRate', 'ContentType', 'Location', 'Language', 'Score',
      'Source', 'Status', 'Notes', 'DiscoveredDate', 'LastContactDate'
    ],
    numericColumns: ['Followers', 'EngagementRate', 'Score']
  },
  {
    name: 'OutreachMessages',
    category: 'marketing',
    description: 'Outreach email tracking and responses',
    freezeRows: 1,
    headers: [
      'MessageID', 'CandidateID', 'AffiliateID', 'Subject', 'Body', 'EmailTo', 'SentDate',
      'Status', 'TrackingID', 'ReplyReceived', 'ReplyDate', 'ReplyText'
    ],
    numericColumns: []
  },
  {
    name: 'AffiliateTasks',
    category: 'marketing',
    description: 'Task management for affiliate operations',
    freezeRows: 1,
    headers: [
      'TaskID', 'AffiliateID', 'CandidateID', 'Title', 'Description', 'Type', 'Priority',
      'Status', 'DueDate', 'AssignedTo', 'CreatedDate', 'CompletedDate'
    ],
    numericColumns: []
  },
  {
    name: 'AffiliateDiscoveryLog',
    category: 'marketing',
    description: 'Log of all AI discovery runs with parameters and results',
    freezeRows: 1,
    headers: [
      'DiscoveryID', 'Timestamp', 'Niches', 'PersonTypes', 'Platforms',
      'Countries', 'MinFollowers', 'MinEngagement', 'Limit',
      'ResultsCount', 'Duration', 'Status', 'ErrorMessage'
    ],
    numericColumns: ['MinFollowers', 'MinEngagement', 'Limit', 'ResultsCount', 'Duration']
  },
  
  // ==================== GIFTS SYSTEM (Day 2) ====================
  {
    name: 'GiftsCatalog',
    category: 'crm',
    description: 'Free gifts, points redemption gifts, and seasonal promotions',
    freezeRows: 1,
    headers: [
      'GiftID', 'GiftSKU', 'GiftName', 'GiftType',
      // For FreeWithOrder
      'MinOrderValue',
      // For PointsRedemption
      'PointsCost',
      // For Seasonal
      'Season', 'StartDate', 'EndDate',
      'StockAvailable', 'ImageURL', 'Description', 'Active', 'CreatedAt', 'UpdatedAt', 'Notes'
    ],
    numericColumns: ['MinOrderValue', 'PointsCost', 'StockAvailable']
  },
  {
    name: 'OrderGifts',
    category: 'crm',
    description: 'Gifts added to orders (for tracking and reporting)',
    freezeRows: 1,
    headers: [
      'OrderGiftID', 'OrderID', 'GiftID', 'GiftSKU', 'GiftType', 'Quantity', 'GiftCost',
      'PointsRedeemed', 'AddedAt', 'Notes'
    ],
    numericColumns: ['Quantity', 'GiftCost', 'PointsRedeemed']
  },
  
  // ==================== SALES TERRITORY & PERFORMANCE (Day 1-2) ====================
  {
    name: 'SalesTerritories',
    category: 'partners',
    description: 'Territory assignments for Sales Representatives',
    freezeRows: 1,
    headers: [
      'TerritoryID', 'TerritoryName', 'AssignedRepID', 'CitiesJSON', 'PostalCodesJSON',
      'MonthlyTarget', 'Active', 'AssignedAt', 'Notes'
    ],
    numericColumns: ['MonthlyTarget']
  },
  {
    name: 'SalesRepPerformance',
    category: 'partners',
    description: 'Monthly performance tracking for Sales Representatives',
    freezeRows: 1,
    headers: [
      'PerformanceID', 'RepID', 'Month', 'Revenue', 'DealsCount', 'Target', 'TargetAchieved',
      'BaseCommission', 'BonusCommission', 'TotalCommission', 'CommissionPaid', 'CommissionPending', 'Notes'
    ],
    numericColumns: ['Revenue', 'DealsCount', 'Target', 'BaseCommission', 'BonusCommission', 'TotalCommission', 'CommissionPaid', 'CommissionPending']
  }
];

// ==================== CRM SEED DATA ====================
// Seed data for CRM sheets - only added if sheet is empty

export const CRM_SEED_DATA: Record<string, any[][]> = {
  'CRM_Leads': [
    [
      'LEAD-001', 
      new Date().toISOString(), 
      'Google Ads', 
      'salon products Berlin', 
      'Berlin', 
      '10115', 
      'DE',
      'Hair & Beauty Salon Berlin Mitte',
      'Salon',
      '+49 30 12345678',
      'contact@berlin-salon.de',
      'https://berlin-salon.de',
      'Friedrichstraße 123, 10115 Berlin',
      '52.5200',
      '13.4050',
      'NEW',
      '',
      '0',
      'Dealer Plus',
      'Interested in premium hair products',
      ''
    ],
    [
      'LEAD-002',
      new Date().toISOString(),
      'LinkedIn',
      'hairdresser products Hamburg',
      'Hamburg',
      '20095',
      'DE',
      'Elegante Hair Studio Hamburg',
      'Salon',
      '+49 40 98765432',
      'info@elegante-hh.de',
      'https://elegante-hamburg.de',
      'Mönckebergstraße 45, 20095 Hamburg',
      '53.5511',
      '9.9937',
      'NEW',
      '',
      '0',
      'Dealer Basic',
      'Looking for wholesale pricing',
      ''
    ]
  ]
};

// List of CRM sheet names for tracking
export const CRM_SHEET_NAMES = [
  'CRM_Leads',
  'Lead_Touches',
  'Territories',
  'Assignment_Rules',
  'Enrichment_Queue',
  'Dedupe_Index'
];

// ==================== OUTREACH SEED DATA ====================
// Seed data for Outreach sheets - only added if sheet is empty

export const OUTREACH_SEED_DATA: Record<string, any[][]> = {
  'Outreach_Templates': [
    [
      'TPL-NEW-1',
      'New Lead Welcome (DE)',
      'Email', // Channel
      'DE', // Lang
      'de', // Locale (legacy)
      '', // Tier
      'Willkommen bei MH Trading - Exklusive Salon-Produkte',
      '', // Body (HTML)
      '**Hallo {{first_name}}**,\n\nVielen Dank für Ihr Interesse an MH Trading!\n\nWir bieten Premium-Salon-Produkte für {{city}} und Umgebung. Als führender Distributor in {{company}} unterstützen wir Salons wie Ihres mit:\n\n- Professionelle Haarpflege & Styling-Produkte\n- Wettbewerbsfähige Großhandelspreise\n- Schnelle Lieferung & exzellenter Support\n\n**Exklusives Angebot:** {{offer_link}}\n\nLassen Sie uns gemeinsam wachsen!\n\nMit freundlichen Grüßen,\nIhr MH Trading Team',
      'first_name,company,city,offer_link', // TokensCSV
      '1', // Version
      'active', // Status
      'Growth Team', // Owner
      new Date().toISOString(), // CreatedTS
      new Date().toISOString(), // UpdatedTS
      'Initial outreach template for German leads' // Notes
    ],
    [
      'TPL-NEW-2',
      'New Lead Welcome (EN)',
      'Email', // Channel
      'EN', // Lang
      'en', // Locale (legacy)
      '', // Tier
      'Welcome to MH Trading - Premium Salon Products',
      '', // Body (HTML)
      '**Hello {{first_name}}**,\n\nThank you for your interest in MH Trading!\n\nWe supply premium salon products to {{city}} and surrounding areas. As a leading distributor, we support salons like {{company}} with:\n\n- Professional haircare & styling products\n- Competitive wholesale pricing\n- Fast delivery & excellent support\n\n**Exclusive Offer:** {{offer_link}}\n\nLet\'s grow together!\n\nBest regards,\nMH Trading Team',
      'first_name,company,city,offer_link', // TokensCSV
      '1', // Version
      'active', // Status
      'Growth Team', // Owner
      new Date().toISOString(), // CreatedTS
      new Date().toISOString(), // UpdatedTS
      'Initial outreach template for English leads' // Notes
    ],
    [
      'TPL-FOLLOW-1',
      'Follow-up (DE)',
      'Email', // Channel
      'DE', // Lang
      'de', // Locale (legacy)
      '', // Tier
      'Haben Sie noch Interesse? - MH Trading',
      '', // Body (HTML)
      '**Hallo {{first_name}}**,\n\nIch wollte mich kurz melden - haben Sie unser Angebot bereits gesehen?\n\nAls Salon in {{city}} könnten Sie von unseren speziellen Konditionen profitieren.\n\nIch stehe Ihnen gerne für Fragen zur Verfügung.\n\nViele Grüße,\nMH Trading Team',
      'first_name,city', // TokensCSV
      '1', // Version
      'active', // Status
      'Growth Team', // Owner
      new Date().toISOString(), // CreatedTS
      new Date().toISOString(), // UpdatedTS
      'Follow-up template for German leads (Day 3)' // Notes
    ],
    [
      'TPL-FOLLOW-2',
      'Follow-up (EN)',
      'Email', // Channel
      'EN', // Lang
      'en', // Locale (legacy)
      '', // Tier
      'Still Interested? - MH Trading',
      '', // Body (HTML)
      '**Hello {{first_name}}**,\n\nJust following up - did you get a chance to review our offer?\n\nAs a salon in {{city}}, you could benefit from our special pricing.\n\nHappy to answer any questions!\n\nBest regards,\nMH Trading Team',
      'first_name,city', // TokensCSV
      '1', // Version
      'active', // Status
      'Growth Team', // Owner
      new Date().toISOString(), // CreatedTS
      new Date().toISOString(), // UpdatedTS
      'Follow-up template for English leads (Day 3)' // Notes
    ]
  ],
  'Outreach_Campaigns': [
    [
      'CMP-DEMO-01', // CampID
      'CMP-DEMO-01', // CampaignID (legacy)
      'Demo Campaign - Berlin Salons', // Name
      'SEQ-DEMO-01', // SeqID
      'SEQ-DEMO-01', // SequenceID (legacy)
      '{"city":"Berlin","countryCode":"DE","status":"NEW","minScore":12}', // AudienceQueryJSON
      'Acquire 10 new salon partners in Berlin', // Goal
      'Growth Team', // Owner
      'email', // Channel
      'de', // Locale
      '', // ScheduleUTC
      'draft', // Status
      new Date().toISOString(), // CreatedTS
      '', // ApprovedTS
      '', // AppliedTS
      '', // StartedTS
      'Test campaign for demonstration purposes' // Notes
    ]
  ],
  'Outreach_Sequences': [
    [
      'SEQ-DEMO-01', // SeqID
      'Welcome & Follow-up Sequence', // Name
      'Demo 2-step outreach sequence', // Purpose
      '[{"step":1,"delayDays":0,"templateID":"TPL-NEW-1"},{"step":2,"delayDays":3,"templateID":"TPL-FOLLOW-1"}]', // StepsJSON
      'DE', // Lang
      '', // Tier
      'FALSE', // WarmupFlag
      'active', // Status
      'Growth Team', // Owner
      new Date().toISOString(), // CreatedTS
      new Date().toISOString(), // UpdatedTS
      'Demo sequence: Day 0 welcome + Day 3 follow-up' // Notes
    ]
  ],
  'Outreach_Contacts': [
    [
      'CONTACT-001', // ContactID
      'demo@salon-berlin.de', // Email
      'Demo Salon Berlin', // Name
      'Salon Berlin GmbH', // Company
      'Berlin', // City
      'DE', // Country
      'Dealer Plus', // TierGuess
      'Manual', // Source
      'TRUE', // OptInFlag
      'FALSE', // UnsubscribedFlag
      '', // LastContactTS
      new Date().toISOString(), // CreatedTS
      'Demo contact for testing' // Notes
    ]
  ]
};

// List of Outreach sheet names for tracking
export const OUTREACH_SHEET_NAMES = [
  'Email_Queue', // Enhanced for outreach tracking
  'Outreach_Campaigns',
  'Outreach_Sequences',
  'Outreach_Templates',
  'Outreach_Contacts', // NEW
  'Email_Stats', // NEW
  'Outreach_Recipients',
  'Outreach_Sends',
  'Suppression_List',
  'Unsubscribes',
  'Bounce_Events',
  'Complaint_Events'
];

// ==================== MARKETING SEED DATA ====================
// Seed data for Marketing sheets - only added if sheet is empty

export const MARKETING_SEED_DATA: Record<string, any[][]> = {
  'SEO_Keywords': [
    ['Haarpflege Produkte', 'de', 'Commercial', 'Hair Care', '2400', '45', '1.20', '65', '75', 'https://mhtrading.com/hair-care', 'ACTIVE', 'Top performing keyword'],
    ['Bartpflege Set', 'de', 'Commercial', 'Beard Care', '1800', '38', '0.95', '55', '80', 'https://mhtrading.com/beard-care', 'ACTIVE', 'High conversion'],
    ['Bartöl Premium', 'de', 'Transactional', 'Beard Care', '1200', '42', '1.10', '60', '85', 'https://mhtrading.com/beard-oil', 'ACTIVE', 'Direct purchase intent'],
    ['Gesichtspflege Männer', 'de', 'Informational', 'Skincare', '3200', '52', '0.85', '70', '70', 'https://mhtrading.com/skincare', 'ACTIVE', 'Educational content'],
    ['Bartbürste Wildschwein', 'de', 'Transactional', 'Beard Care', '890', '35', '0.75', '50', '75', 'https://mhtrading.com/beard-brush', 'ACTIVE', ''],
    ['Shampoo Salon Qualität', 'de', 'Commercial', 'Hair Care', '2100', '48', '1.30', '68', '72', 'https://mhtrading.com/shampoo', 'ACTIVE', ''],
    ['Conditioner professionell', 'de', 'Commercial', 'Hair Care', '1600', '46', '1.15', '63', '68', 'https://mhtrading.com/conditioner', 'ACTIVE', ''],
    ['Hautpflege Bio', 'de', 'Informational', 'Skincare', '2800', '55', '0.90', '72', '65', 'https://mhtrading.com/organic-skincare', 'ACTIVE', 'Trending keyword'],
    ['Styling Produkte Herren', 'de', 'Commercial', 'Hair Care', '1400', '40', '1.05', '58', '78', 'https://mhtrading.com/styling', 'ACTIVE', ''],
    ['Rasieröl Premium', 'de', 'Transactional', 'Beard Care', '950', '33', '0.80', '48', '82', 'https://mhtrading.com/shaving-oil', 'ACTIVE', 'Growing demand']
  ],
  'Ads_Campaigns': [
    ['CMP-DE-DEMO-01', 'Demo Search Campaign - Hair & Beard Care', 'Lead Generation', 'de', 'Search', '20', 'Target CPA', 'ACTIVE', new Date().toISOString().split('T')[0], '', 'google', 'cpc', 'demo-hair-beard-de', 'Demo campaign for testing']
  ],
  'Ads_AdGroups': [
    ['AG-DEMO-01', 'CMP-DE-DEMO-01', 'Beard Care Products', '1.20', 'https://mhtrading.com/beard-care', 'ACTIVE', 'Main ad group for beard care keywords']
  ],
  'Ads_Keywords': [
    ['Bartpflege Set', 'Exact', 'de', 'Commercial', 'Beard Care', '0.95', '3.5', '2.8', '15.00', 'FALSE', 'High performer'],
    ['Bartöl Premium', 'Exact', 'de', 'Transactional', 'Beard Care', '1.10', '4.2', '3.5', '12.00', 'FALSE', 'Best ROI'],
    ['Bartpflege Produkte', 'Phrase', 'de', 'Commercial', 'Beard Care', '0.85', '2.8', '2.2', '18.00', 'FALSE', ''],
    ['Premium Bartöl kaufen', 'Broad', 'de', 'Transactional', 'Beard Care', '1.05', '3.1', '2.5', '16.00', 'FALSE', ''],
    ['Bartbürste', 'Exact', 'de', 'Transactional', 'Beard Care', '0.75', '3.8', '3.2', '14.00', 'FALSE', '']
  ],
  'Social_Calendar': [
    ['POST-IG-001', new Date(Date.now() + 86400000).toISOString().split('T')[0], '10:00', 'Instagram', 'de', 'Beard Care', '3 Tipps für perfekte Bartpflege', 'Entdecke die Geheimnisse professioneller Bartpflege! Unser Premium Bartöl kombiniert natürliche Inhaltsstoffe für optimale Pflege. Link in Bio!', '#bartpflege #beardcare #mensgrooming #bartöl #männerpflege', 'ASSET-001,ASSET-002', 'Shop Now', 'https://mhtrading.com/beard-care?utm_source=instagram&utm_medium=social&utm_campaign=beard-tips', 'Marketing Team', 'SCHEDULED', 'Weekly beard care tips'],
    ['POST-IG-002', new Date(Date.now() + 259200000).toISOString().split('T')[0], '14:00', 'Instagram', 'de', 'Beard Care', 'Bart vs. Rasur - Was ist besser?', 'Der moderne Mann hat die Wahl! Ob gepflegter Vollbart oder glatte Rasur - wir haben die richtigen Produkte. Was bevorzugst du?', '#bart #rasur #männerstyle #grooming #beardstyle', 'ASSET-003', 'Learn More', 'https://mhtrading.com/blog/beard-vs-shave?utm_source=instagram&utm_medium=social&utm_campaign=engagement', 'Marketing Team', 'SCHEDULED', 'Engagement post'],
    ['POST-IG-003', new Date(Date.now() + 518400000).toISOString().split('T')[0], '16:00', 'Instagram', 'de', 'Beard Care', 'Neu: Winter Bartpflege Set', 'Schütze deinen Bart vor Kälte und Trockenheit! Unser neues Winter-Set enthält alles, was du brauchst. Jetzt 15% Rabatt!', '#winterpflege #bartset #menscare #beardoil #grooming', 'ASSET-001', 'Shop Now', 'https://mhtrading.com/winter-beard-set?utm_source=instagram&utm_medium=social&utm_campaign=winter-promo', 'Marketing Team', 'SCHEDULED', 'Product launch promotion']
  ],
  'Social_Assets': [
    ['ASSET-001', 'Image', 'Cloud', 'https://images.unsplash.com/photo-1621607512214-68297480165e', 'Premium beard oil bottle on wooden background', 'Beard Care', 'de', 'Unsplash Free', 'Marketing Team', 'ACTIVE', 'Stock photo - beard oil product'],
    ['ASSET-002', 'Image', 'Cloud', 'https://images.unsplash.com/photo-1564694202883-46e9f2f3d19e', 'Man with well-groomed beard applying beard oil', 'Beard Care', 'de', 'Unsplash Free', 'Marketing Team', 'ACTIVE', 'Stock photo - beard care routine'],
    ['ASSET-003', 'Image', 'Cloud', 'https://images.unsplash.com/photo-1503443207922-dff7d543fd0e', 'Professional barber styling customer beard', 'Beard Care', 'de', 'Unsplash Free', 'Marketing Team', 'ACTIVE', 'Stock photo - barbershop scene']
  ]
};

// ==================== PRICING LAW V2 SEED DATA ====================
// Seed data for Pricing Law v2 sheets - Germany 2025 rates

export const PRICING_LAW_SEED_DATA: Record<string, any[][]> = {
  'Channels': [
    ['OwnStore', 'MH Trading OwnStore', true, 'Stripe', 1.5, 0.25, null, null, null, null, 2.5, 0.7, true, false, 'Primary direct sales channel with Stripe payments'],
    ['Amazon_FBM', 'Amazon Fulfilled by Merchant', true, 'Amazon', null, null, 8, 15, 0.30, null, 3, 0.7, true, false, 'Amazon FBM - merchant handles fulfillment'],
    ['Amazon_FBA', 'Amazon Fulfilled by Amazon', true, 'Amazon', null, null, 8, 15, 0.30, null, 2, 0.7, false, true, 'Amazon FBA - Amazon handles fulfillment']
  ],
  'AmazonSizeTiers': [
    ['SMALL_STANDARD', 'Small Standard (≤500g)', 0, 500, '25x15x1.5', 2.85, 0.26, true, 'Books, small electronics, cosmetics'],
    ['LARGE_STANDARD_0_500', 'Large Standard 0-500g', 0, 500, '45x34x26', 3.31, 0.26, true, 'Standard packaging up to 500g'],
    ['LARGE_STANDARD_500_1000', 'Large Standard 500-1000g', 500, 1000, '45x34x26', 3.65, 0.26, true, 'Standard packaging 500g-1kg'],
    ['LARGE_STANDARD_1000_1500', 'Large Standard 1-1.5kg', 1000, 1500, '45x34x26', 4.06, 0.26, true, 'Standard packaging 1-1.5kg'],
    ['LARGE_STANDARD_1500_2000', 'Large Standard 1.5-2kg', 1500, 2000, '45x34x26', 4.36, 0.26, true, 'Standard packaging 1.5-2kg'],
    ['LARGE_STANDARD_2000_5000', 'Large Standard 2-5kg', 2000, 5000, '45x34x26', 4.95, 0.26, true, 'Standard packaging 2-5kg'],
    ['LARGE_STANDARD_5000_10000', 'Large Standard 5-10kg', 5000, 10000, '45x34x26', 6.39, 0.26, true, 'Standard packaging 5-10kg'],
    ['LARGE_STANDARD_10000_15000', 'Large Standard 10-15kg', 10000, 15000, '45x34x26', 11.09, 0.26, true, 'Standard packaging 10-15kg'],
    ['LARGE_BULKY_0_500', 'Large Bulky 0-500g', 0, 500, '>45x34x26', 3.66, 0.26, true, 'Oversized packaging up to 500g'],
    ['LARGE_BULKY_500_1000', 'Large Bulky 500-1000g', 500, 1000, '>45x34x26', 4.00, 0.26, true, 'Oversized packaging 500g-1kg']
  ],
  'ShippingMatrix_DHL': [
    ['DE_1', 0, 500, 4.50, '2025-01-01', null, 'Domestic Germany up to 500g'],
    ['DE_1', 500, 1000, 5.00, '2025-01-01', null, 'Domestic Germany 500g-1kg'],
    ['DE_1', 1000, 2000, 5.50, '2025-01-01', null, 'Domestic Germany 1-2kg'],
    ['DE_1', 2000, 5000, 6.50, '2025-01-01', null, 'Domestic Germany 2-5kg'],
    ['DE_1', 5000, 10000, 9.50, '2025-01-01', null, 'Domestic Germany 5-10kg'],
    ['DE_1', 10000, 31500, 16.00, '2025-01-01', null, 'Domestic Germany 10-31.5kg']
  ],
  'DHL_Surcharges': [
    ['LKW_CO2', 'LKW-Maut CO2 Surcharge', 'Fixed_Per_Shipment', 0.19, null, '2025-01-01', null, true, 'Germany 2025 truck toll CO2 surcharge'],
    ['Peak', 'Peak Season Surcharge', 'Fixed_Per_Shipment', 0.19, null, '2025-01-01', null, true, 'Peak season surcharge (Nov-Dec)'],
    ['Peak_in_Peak', 'Peak-in-Peak Surcharge', 'Fixed_Per_Shipment', 0.50, null, '2025-01-01', null, true, 'Extreme peak surcharge (mid-Dec)'],
    ['Energy_Surcharge_Var', 'Energy Surcharge Variable', 'Monthly_Variable', 0.12, null, '2025-01-01', null, true, 'Monthly variable energy surcharge - updated from Settings']
  ],
  'QuantityDiscounts': [
    ['QTY_TIER_1', 'Tier 1 (5-9 units)', 5, 9, 2, 'All', true, 'Small quantity discount'],
    ['QTY_TIER_2', 'Tier 2 (10-24 units)', 10, 24, 5, 'All', true, 'Medium quantity discount'],
    ['QTY_TIER_3', 'Tier 3 (25-49 units)', 25, 49, 8, 'All', true, 'Large quantity discount'],
    ['QTY_TIER_4', 'Tier 4 (50-99 units)', 50, 99, 12, 'All', true, 'Bulk discount'],
    ['QTY_TIER_5', 'Tier 5 (100+ units)', 100, null, 15, 'All', true, 'Volume discount']
  ],
  'DiscountCaps': [
    ['CAP_BASIC', 'Dealer Basic', 15, 10, 25, true, 'Basic tier max 25% total discount'],
    ['CAP_PLUS', 'Dealer Plus', 20, 12, 32, true, 'Plus tier max 32% total discount'],
    ['CAP_STAND', 'Stand', 25, 15, 40, true, 'Stand tier max 40% total discount'],
    ['CAP_DIST', 'Distributor', 30, 15, 45, true, 'Distributor tier max 45% total discount']
  ],
  'OrderDiscounts': [
    ['ORD_500', 500, 2, null, 'All', true, '2% discount on orders ≥€500'],
    ['ORD_1000', 1000, 3, null, 'All', true, '3% discount on orders ≥€1000'],
    ['ORD_2500', 2500, 5, null, 'All', true, '5% discount on orders ≥€2500']
  ],
  'Pricing_Line_Targets': [
    ['Premium', 55, 2.8, 45, 'web', true, 'Premium line: 55% target, 45% floor, web rounding (.49/.99)'],
    ['Pro', 50, 2.5, 45, 'web', true, 'Pro line: 50% target, 45% floor, web rounding'],
    ['Basic', 48, 2.2, 45, 'salon', true, 'Basic line: 48% target, 45% floor, salon rounding (.95)'],
    ['Tools', 52, 2.6, 45, 'web', true, 'Tools line: 52% target, 45% floor, web rounding']
  ]
};

// List of Pricing Law v2 sheet names for tracking
export const PRICING_LAW_SHEET_NAMES = [
  'Channels',
  'AmazonSizeTiers',
  'ShippingMatrix_DHL',
  'DHL_Surcharges',
  'QuantityDiscounts',
  'DiscountCaps',
  'OrderDiscounts',
  'Pricing_Line_Targets'
];

// List of Marketing sheet names for tracking
export const MARKETING_SHEET_NAMES = [
  'SEO_Keywords',
  'SEO_Briefs',
  'SEO_Pages',
  'SEO_Audits',
  'Ads_Keywords',
  'Ads_Campaigns',
  'Ads_AdGroups',
  'Ads_Creatives',
  'Ads_Exports',
  'Ads_KPIs',
  'Social_Calendar',
  'Social_Assets',
  'Social_Metrics',
  'UTM_Builder',
  'Link_Shortener'
];

// ==================== SHEET ERROR NORMALIZERS ====================
// Utilities to clean up Google Sheets errors (#ERROR!, #N/A, etc)

const SHEET_ERROR_PATTERNS = [
  '#ERROR!', '#N/A', '#REF!', '#VALUE!', '#DIV/0!', '#NUM!', '#NAME?', '#NULL!'
];

export function isSheetError(value: any): boolean {
  if (typeof value !== 'string') return false;
  return SHEET_ERROR_PATTERNS.some(pattern => value.includes(pattern));
}

export function normalizeValue(value: any, columnName: string): any {
  // Handle sheet errors
  if (isSheetError(value)) {
    return ''; // Replace errors with empty string
  }
  
  // Handle numeric columns (remove currency symbols)
  if (typeof value === 'string' && value.trim()) {
    // Remove €, $, £, ¥, commas, and spaces
    const cleaned = value.replace(/[€$£¥,\s]/g, '').trim();
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && cleaned !== '') {
      return parsed;
    }
  }
  
  return value;
}

export interface EnsureSheetsResult {
  sheetsProcessed: number;
  sheetsCreated: number;
  columnsAdded: number;
  clonedSheetsFixed: { original: string; clone: string; rowsMerged: number }[];
  errorsFound: { sheet: string; column: string; row: number; error: string }[];
  normalizedCells: number;
  duplicateIdsFound: number;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details: string[];
}

// ==================== MAIN ENSURE SHEETS FUNCTION ====================

export async function ensureSheets(sheetsService: GoogleSheetsService): Promise<EnsureSheetsResult> {
  const result: EnsureSheetsResult = {
    sheetsProcessed: 0,
    sheetsCreated: 0,
    columnsAdded: 0,
    clonedSheetsFixed: [],
    errorsFound: [],
    normalizedCells: 0,
    duplicateIdsFound: 0,
    status: 'ok',
    message: '',
    details: []
  };

  // Track CRM-specific metrics for dedicated OS_Health entry
  const crmMetrics = {
    sheetsCreated: 0,
    columnsAdded: 0,
    seedRowsAdded: 0
  };

  // Track Outreach-specific metrics for dedicated OS_Health entry
  const outreachMetrics = {
    sheetsCreated: 0,
    columnsAdded: 0,
    seedRowsAdded: 0
  };

  // Track Marketing-specific metrics for dedicated OS_Health entry
  const marketingMetrics = {
    sheetsCreated: 0,
    columnsAdded: 0,
    seedRowsAdded: 0
  };

  // Track Pricing Law v2-specific metrics for dedicated OS_Health entry
  const pricingLawMetrics = {
    sheetsCreated: 0,
    columnsAdded: 0,
    seedRowsAdded: 0
  };

  const client = await getUncachableGoogleSheetClient();
  
  try {
    // Step 1: Get all existing sheets in the spreadsheet
    const metadata = await retryWithBackoff(() =>
      client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
    );
    
    const existingSheets = metadata.data.sheets?.map(s => s.properties?.title || '') || [];
    result.details.push(`Found ${existingSheets.length} existing sheets`);
    
    // Step 2: Fix cloned sheets (Name-Table, Name_Table → Name)
    const clonedSheetsFixes = await fixClonedSheets(client, existingSheets, sheetsService);
    result.clonedSheetsFixed = clonedSheetsFixes;
    if (clonedSheetsFixes.length > 0) {
      result.details.push(`Fixed ${clonedSheetsFixes.length} cloned sheets`);
      result.status = 'warning';
    }
    
    // Step 3: Ensure all required sheets exist with correct headers
    for (const sheetDef of REQUIRED_SHEETS) {
      result.sheetsProcessed++;
      
      const sheetExists = existingSheets.includes(sheetDef.name);
      const isCRMSheet = CRM_SHEET_NAMES.includes(sheetDef.name);
      const isOutreachSheet = OUTREACH_SHEET_NAMES.includes(sheetDef.name);
      const isMarketingSheet = MARKETING_SHEET_NAMES.includes(sheetDef.name);
      const isPricingLawSheet = PRICING_LAW_SHEET_NAMES.includes(sheetDef.name);
      
      if (!sheetExists) {
        // Create sheet with headers
        await createSheet(client, sheetDef.name, sheetDef.headers);
        result.sheetsCreated++;
        if (isCRMSheet) crmMetrics.sheetsCreated++;
        if (isOutreachSheet) outreachMetrics.sheetsCreated++;
        if (isMarketingSheet) marketingMetrics.sheetsCreated++;
        if (isPricingLawSheet) pricingLawMetrics.sheetsCreated++;
        result.details.push(`Created sheet: ${sheetDef.name}`);
        await sheetsService.logToSheet('INFO', 'EnsureSheets', `Created sheet: ${sheetDef.name}`);
      } else {
        // Check and add missing columns
        const added = await ensureColumns(client, sheetDef.name, sheetDef.headers);
        result.columnsAdded += added;
        if (isCRMSheet) crmMetrics.columnsAdded += added;
        if (isOutreachSheet) outreachMetrics.columnsAdded += added;
        if (isMarketingSheet) marketingMetrics.columnsAdded += added;
        if (isPricingLawSheet) pricingLawMetrics.columnsAdded += added;
        if (added > 0) {
          result.details.push(`Added ${added} columns to ${sheetDef.name}`);
          await sheetsService.logToSheet('INFO', 'EnsureSheets', `Added ${added} columns to ${sheetDef.name}`);
        }
      }
      
      // Step 3.5: Add seed data if sheet is empty (CRM sheets only)
      if (isCRMSheet) {
        const seedRowsAdded = await addSeedRowsIfEmpty(client, sheetDef.name, sheetsService);
        if (seedRowsAdded > 0) {
          crmMetrics.seedRowsAdded += seedRowsAdded;
          result.details.push(`Added ${seedRowsAdded} seed rows to ${sheetDef.name}`);
        }
      }
      
      // Step 3.6: Add seed data if sheet is empty (Outreach sheets only)
      if (isOutreachSheet) {
        const seedRowsAdded = await addSeedRowsIfEmptyOutreach(client, sheetDef.name, sheetsService);
        if (seedRowsAdded > 0) {
          outreachMetrics.seedRowsAdded += seedRowsAdded;
          result.details.push(`Added ${seedRowsAdded} seed rows to ${sheetDef.name}`);
        }
      }
      
      // Step 3.7: Add seed data if sheet is empty (Marketing sheets only)
      if (isMarketingSheet) {
        const seedRowsAdded = await addSeedRowsIfEmptyMarketing(client, sheetDef.name, sheetsService);
        if (seedRowsAdded > 0) {
          marketingMetrics.seedRowsAdded += seedRowsAdded;
          result.details.push(`Added ${seedRowsAdded} seed rows to ${sheetDef.name}`);
        }
      }
      
      // Step 3.8: Add seed data if sheet is empty (Pricing Law v2 sheets only)
      if (isPricingLawSheet) {
        const seedRowsAdded = await addSeedRowsIfEmptyPricingLaw(client, sheetDef.name, sheetsService);
        if (seedRowsAdded > 0) {
          pricingLawMetrics.seedRowsAdded += seedRowsAdded;
          result.details.push(`Added ${seedRowsAdded} pricing law v2 seed rows to ${sheetDef.name}`);
        }
      }
      
      // Step 4: Normalize numeric data (remove € symbols, fix #ERROR!)
      if (sheetDef.numericColumns && sheetDef.numericColumns.length > 0) {
        const normalized = await normalizeNumericColumns(
          client, 
          sheetDef.name, 
          sheetDef.headers, 
          sheetDef.numericColumns,
          sheetsService
        );
        result.normalizedCells += normalized.cellsFixed;
        result.errorsFound.push(...normalized.errors);
        
        if (normalized.cellsFixed > 0) {
          result.details.push(`Normalized ${normalized.cellsFixed} cells in ${sheetDef.name}`);
        }
      }
    }
    
    // Step 5: Log to OS_Health (overall system status)
    const healthStatus = result.errorsFound.length > 0 ? 'WARN' : 'PASS';
    const healthMessage = `Sheets: ${result.sheetsCreated} created, ${result.columnsAdded} cols added, ${result.clonedSheetsFixed.length} clones fixed, ${result.normalizedCells} cells normalized`;
    const healthDetails = JSON.stringify({
      sheetsProcessed: result.sheetsProcessed,
      sheetsCreated: result.sheetsCreated,
      columnsAdded: result.columnsAdded,
      clonedSheetsFixed: result.clonedSheetsFixed.length,
      errorsFound: result.errorsFound.length,
      normalizedCells: result.normalizedCells
    });
    
    await client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'OS_Health!A:E',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[new Date().toISOString(), 'Ensure Sheets', healthStatus, healthMessage, healthDetails]]
      }
    });
    
    // Step 5.5: Add dedicated CRM health entry (always, even when no changes)
    const crmHealthStatus = 'PASS';
    const crmHealthMessage = `2A-1 CRM sheets ensured: ${crmMetrics.sheetsCreated} created, ${crmMetrics.columnsAdded} cols added, ${crmMetrics.seedRowsAdded} seed rows added`;
    const crmHealthDetails = JSON.stringify({
      sheetsCreated: crmMetrics.sheetsCreated,
      columnsAdded: crmMetrics.columnsAdded,
      seedRowsAdded: crmMetrics.seedRowsAdded,
      crmSheets: CRM_SHEET_NAMES,
      totalCRMSheets: CRM_SHEET_NAMES.length
    });
    
    await client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'OS_Health!A:E',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[new Date().toISOString(), '2A-1 CRM Sheets', crmHealthStatus, crmHealthMessage, crmHealthDetails]]
      }
    });
    
    if (crmMetrics.sheetsCreated > 0 || crmMetrics.columnsAdded > 0 || crmMetrics.seedRowsAdded > 0) {
      await sheetsService.logToSheet('INFO', '2A-1 CRM', crmHealthMessage);
    }
    
    // Step 5.6: Add dedicated Outreach health entry (always, even when no changes)
    const outreachHealthStatus = 'PASS';
    const outreachHealthMessage = `2B-1 Outreach sheets ensured: ${outreachMetrics.sheetsCreated} created, ${outreachMetrics.columnsAdded} cols added, ${outreachMetrics.seedRowsAdded} seed rows added`;
    const outreachHealthDetails = JSON.stringify({
      sheetsCreated: outreachMetrics.sheetsCreated,
      columnsAdded: outreachMetrics.columnsAdded,
      seedRowsAdded: outreachMetrics.seedRowsAdded,
      outreachSheets: OUTREACH_SHEET_NAMES,
      totalOutreachSheets: OUTREACH_SHEET_NAMES.length
    });
    
    await client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'OS_Health!A:E',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[new Date().toISOString(), '2B-1 Outreach Sheets', outreachHealthStatus, outreachHealthMessage, outreachHealthDetails]]
      }
    });
    
    if (outreachMetrics.sheetsCreated > 0 || outreachMetrics.columnsAdded > 0 || outreachMetrics.seedRowsAdded > 0) {
      await sheetsService.logToSheet('INFO', '2B-1 Outreach', outreachHealthMessage);
    }
    
    // Step 5.7: Add dedicated Marketing health entry (always, even when no changes)
    const marketingHealthStatus = 'PASS';
    const marketingHealthMessage = `2C-1 Marketing sheets ensured: ${marketingMetrics.sheetsCreated} created, ${marketingMetrics.columnsAdded} cols added, ${marketingMetrics.seedRowsAdded} seed rows added`;
    const marketingHealthDetails = JSON.stringify({
      sheetsCreated: marketingMetrics.sheetsCreated,
      columnsAdded: marketingMetrics.columnsAdded,
      seedRowsAdded: marketingMetrics.seedRowsAdded,
      marketingSheets: MARKETING_SHEET_NAMES,
      totalMarketingSheets: MARKETING_SHEET_NAMES.length
    });
    
    await client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'OS_Health!A:E',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[new Date().toISOString(), '2C-1 Marketing Sheets', marketingHealthStatus, marketingHealthMessage, marketingHealthDetails]]
      }
    });
    
    if (marketingMetrics.sheetsCreated > 0 || marketingMetrics.columnsAdded > 0 || marketingMetrics.seedRowsAdded > 0) {
      await sheetsService.logToSheet('INFO', '2C-1 Marketing', marketingHealthMessage);
    }
    
    // Set final status
    if (result.errorsFound.length > 0) {
      result.status = 'warning';
      result.message = `Completed with ${result.errorsFound.length} data errors found`;
    } else if (result.sheetsCreated > 0 || result.columnsAdded > 0 || result.clonedSheetsFixed.length > 0) {
      result.status = 'warning';
      result.message = `Completed with changes: ${result.sheetsCreated} sheets created, ${result.columnsAdded} columns added`;
    } else {
      result.status = 'ok';
      result.message = 'All sheets up to date';
    }
    
    // Validate single spreadsheet (acceptance criterion)
    result.duplicateIdsFound = await validateSingleSpreadsheet(sheetsService);
    if (result.duplicateIdsFound > 0 && result.status === 'ok') {
      result.status = 'warning';
    }
    
    await sheetsService.logToSheet('INFO', 'EnsureSheets', result.message);
    
  } catch (error: any) {
    result.status = 'error';
    result.message = `Error: ${error.message}`;
    result.details.push(`Fatal error: ${error.message}`);
    await sheetsService.logToSheet('ERROR', 'EnsureSheets', `Fatal error: ${error.message}`);
  }
  
  return result;
}

// ==================== HELPER FUNCTIONS ====================

async function createSheet(client: any, sheetName: string, headers: string[]): Promise<void> {
  // Create sheet
  await retryWithBackoff(() =>
    client.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: sheetName }
          }
        }]
      }
    })
  );
  
  // Add headers
  await retryWithBackoff(() =>
    client.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!1:1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers]
      }
    })
  );
}

async function ensureColumns(client: any, sheetName: string, requiredHeaders: string[]): Promise<number> {
  // Get existing headers
  const response = await retryWithBackoff(() =>
    client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!1:1`
    })
  ) as any;
  
  const existingHeaders = response.data.values?.[0] || [];
  
  // Check positionally: compare required headers vs existing headers
  // Insert missing columns at their correct positions
  const finalHeaders: string[] = [];
  let columnsAdded = 0;
  
  for (let i = 0; i < requiredHeaders.length; i++) {
    const requiredHeader = requiredHeaders[i];
    const existingHeader = existingHeaders[i];
    
    if (existingHeader === requiredHeader) {
      // Column exists at correct position
      finalHeaders.push(requiredHeader);
    } else if (!existingHeaders.includes(requiredHeader)) {
      // Column missing entirely - insert at correct position
      finalHeaders.push(requiredHeader);
      columnsAdded++;
    } else {
      // Column exists but at wrong position - this is a mismatch
      // For now, preserve existing header and append missing ones at the end
      finalHeaders.push(existingHeader || '');
    }
  }
  
  // Add any remaining existing headers that weren't in required list
  for (let i = requiredHeaders.length; i < existingHeaders.length; i++) {
    finalHeaders.push(existingHeaders[i]);
  }
  
  // Also append any required headers that weren't handled above (safety check)
  const missingAtEnd = requiredHeaders.filter(h => !finalHeaders.includes(h));
  if (missingAtEnd.length > 0) {
    finalHeaders.push(...missingAtEnd);
    columnsAdded += missingAtEnd.length;
  }
  
  if (columnsAdded === 0) return 0;
  
  // Update headers with new structure
  await retryWithBackoff(() =>
    client.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!1:1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [finalHeaders]
      }
    })
  );
  
  return columnsAdded;
}

async function fixClonedSheets(
  client: any, 
  existingSheets: string[],
  sheetsService: GoogleSheetsService
): Promise<{ original: string; clone: string; rowsMerged: number }[]> {
  const fixes: { original: string; clone: string; rowsMerged: number }[] = [];
  
  // Find cloned sheets (Name-Table or Name_Table)
  const clonePattern = /^(.+?)[-_]Table$/i;
  
  for (const sheetName of existingSheets) {
    const match = sheetName.match(clonePattern);
    if (match) {
      const originalName = match[1];
      
      // Check if original exists
      if (existingSheets.includes(originalName)) {
        // Merge data from clone to original
        const cloneData = await retryWithBackoff(() =>
          client.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A2:ZZ`
          })
        ) as any;
        
        const rowsToMerge = cloneData.data.values || [];
        
        if (rowsToMerge.length > 0) {
          // Append to original
          await retryWithBackoff(() =>
            client.spreadsheets.values.append({
              spreadsheetId: SPREADSHEET_ID,
              range: `${originalName}!A:ZZ`,
              valueInputOption: 'RAW',
              requestBody: {
                values: rowsToMerge
              }
            })
          );
        }
        
        // Delete cloned sheet
        const sheetId = await getSheetId(client, sheetName);
        if (sheetId !== null) {
          await retryWithBackoff(() =>
            client.spreadsheets.batchUpdate({
              spreadsheetId: SPREADSHEET_ID,
              requestBody: {
                requests: [{
                  deleteSheet: { sheetId }
                }]
              }
            })
          );
        }
        
        fixes.push({ original: originalName, clone: sheetName, rowsMerged: rowsToMerge.length });
        await sheetsService.logToSheet('WARN', 'EnsureSheets', `Merged ${rowsToMerge.length} rows from ${sheetName} to ${originalName}, then deleted clone`);
      }
    }
  }
  
  return fixes;
}

async function getSheetId(client: any, sheetName: string): Promise<number | null> {
  const metadata = await retryWithBackoff(() =>
    client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  ) as any;
  
  const sheet = metadata.data.sheets?.find((s: any) => s.properties?.title === sheetName);
  return sheet?.properties?.sheetId ?? null;
}

async function normalizeNumericColumns(
  client: any,
  sheetName: string,
  headers: string[],
  numericColumns: string[],
  sheetsService: GoogleSheetsService
): Promise<{ cellsFixed: number; errors: { sheet: string; column: string; row: number; error: string }[] }> {
  const result = { cellsFixed: 0, errors: [] as any[] };
  
  // Get all data
  const response = await retryWithBackoff(() =>
    client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A:ZZ`
    })
  ) as any;
  
  const rows = response.data.values || [];
  if (rows.length < 2) return result; // No data rows
  
  const headerRow = rows[0];
  const dataRows = rows.slice(1);
  
  // Find column indices for numeric columns
  const numericColumnIndices = numericColumns
    .map(colName => headerRow.indexOf(colName))
    .filter(idx => idx !== -1);
  
  if (numericColumnIndices.length === 0) return result;
  
  // Scan and fix errors
  const fixedRows: any[][] = [];
  let hasChanges = false;
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const fixedRow = [...row];
    
    for (const colIdx of numericColumnIndices) {
      const value = row[colIdx];
      const colName = headerRow[colIdx];
      
      if (value === undefined || value === '') continue;
      
      // Check for sheet errors
      if (isSheetError(value)) {
        fixedRow[colIdx] = '';
        result.cellsFixed++;
        hasChanges = true;
        result.errors.push({
          sheet: sheetName,
          column: colName,
          row: i + 2, // +2 because row 1 is header, and we're 0-indexed
          error: value
        });
        await sheetsService.logToSheet('WARN', 'EnsureSheets', `Removed error "${value}" from ${sheetName}!${colName}${i + 2}`);
      }
      // Remove currency symbols from numeric columns
      else if (typeof value === 'string' && (value.includes('€') || value.includes('$'))) {
        const cleaned = value.replace(/[€$£¥,\s]/g, '').trim();
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed)) {
          fixedRow[colIdx] = parsed;
          result.cellsFixed++;
          hasChanges = true;
        }
      }
    }
    
    fixedRows.push(fixedRow);
  }
  
  // Write back if changes were made
  if (hasChanges) {
    await retryWithBackoff(() =>
      client.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A2:ZZ`,
        valueInputOption: 'RAW',
        requestBody: {
          values: fixedRows
        }
      })
    );
  }
  
  return result;
}

async function addSeedRowsIfEmpty(
  client: any,
  sheetName: string,
  sheetsService: GoogleSheetsService
): Promise<number> {
  // Check if sheet has seed data defined
  if (!CRM_SEED_DATA[sheetName]) {
    return 0;
  }

  // Check if sheet is empty (check A2 - first data row)
  const response = await retryWithBackoff(() =>
    client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:A2`
    })
  ) as any;

  const firstDataCell = response.data.values?.[0]?.[0];
  
  // If A2 has data, sheet is not empty - don't add seed
  if (firstDataCell) {
    return 0;
  }

  // Sheet is empty, add seed data
  const seedRows = CRM_SEED_DATA[sheetName];
  await retryWithBackoff(() =>
    client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:ZZ`,
      valueInputOption: 'RAW',
      requestBody: {
        values: seedRows
      }
    })
  );

  await sheetsService.logToSheet('INFO', 'EnsureSheets', `Added ${seedRows.length} seed rows to ${sheetName}`);
  return seedRows.length;
}

async function addSeedRowsIfEmptyOutreach(
  client: any,
  sheetName: string,
  sheetsService: GoogleSheetsService
): Promise<number> {
  // Check if sheet has seed data defined
  if (!OUTREACH_SEED_DATA[sheetName]) {
    return 0;
  }

  // Check if sheet is empty (check A2 - first data row)
  const response = await retryWithBackoff(() =>
    client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:A2`
    })
  ) as any;

  const firstDataCell = response.data.values?.[0]?.[0];
  
  // If A2 has data, sheet is not empty - don't add seed
  if (firstDataCell) {
    return 0;
  }

  // Sheet is empty, add seed data
  const seedRows = OUTREACH_SEED_DATA[sheetName];
  await retryWithBackoff(() =>
    client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:ZZ`,
      valueInputOption: 'RAW',
      requestBody: {
        values: seedRows
      }
    })
  );

  await sheetsService.logToSheet('INFO', 'EnsureSheets', `Added ${seedRows.length} seed rows to ${sheetName}`);
  return seedRows.length;
}

async function addSeedRowsIfEmptyMarketing(
  client: any,
  sheetName: string,
  sheetsService: GoogleSheetsService
): Promise<number> {
  // Check if sheet has seed data defined
  if (!MARKETING_SEED_DATA[sheetName]) {
    return 0;
  }

  // Check if sheet is empty (check A2 - first data row)
  const response = await retryWithBackoff(() =>
    client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:A2`
    })
  ) as any;

  const firstDataCell = response.data.values?.[0]?.[0];
  
  // If A2 has data, sheet is not empty - don't add seed
  if (firstDataCell) {
    return 0;
  }

  // Sheet is empty, add seed data
  const seedRows = MARKETING_SEED_DATA[sheetName];
  await retryWithBackoff(() =>
    client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:ZZ`,
      valueInputOption: 'RAW',
      requestBody: {
        values: seedRows
      }
    })
  );

  await sheetsService.logToSheet('INFO', 'EnsureSheets', `Added ${seedRows.length} seed rows to ${sheetName}`);
  return seedRows.length;
}

async function addSeedRowsIfEmptyPricingLaw(
  client: any,
  sheetName: string,
  sheetsService: GoogleSheetsService
): Promise<number> {
  // Check if sheet has seed data defined
  if (!PRICING_LAW_SEED_DATA[sheetName]) {
    return 0;
  }

  // Check if sheet is empty (check A2 - first data row)
  const response = await retryWithBackoff(() =>
    client.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:A2`
    })
  ) as any;

  const firstDataCell = response.data.values?.[0]?.[0];
  
  // If A2 has data, sheet is not empty - don't add seed
  if (firstDataCell) {
    return 0;
  }

  // Sheet is empty, add seed data (Germany 2025 rates)
  const seedRows = PRICING_LAW_SEED_DATA[sheetName];
  await retryWithBackoff(() =>
    client.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2:ZZ`,
      valueInputOption: 'RAW',
      requestBody: {
        values: seedRows
      }
    })
  );

  await sheetsService.logToSheet('INFO', 'EnsureSheets', `Added ${seedRows.length} pricing law v2 seed rows to ${sheetName} (Germany 2025)`);
  return seedRows.length;
}


// ==================== SINGLE SPREADSHEET VALIDATION ====================
// Validates that system uses single SPREADSHEET_ID with no duplicates

async function validateSingleSpreadsheet(
  sheetsService: GoogleSheetsService
): Promise<number> {
  // 1. CRITICAL: Validate SPREADSHEET_ID is set from environment (already sanitized in sheets.ts)
  if (!SPREADSHEET_ID || SPREADSHEET_ID.trim() === "") {
    const msg = "CRITICAL: SHEETS_SPREADSHEET_ID environment variable not set";
    await sheetsService.logToSheet("ERROR", "Spreadsheet Validation", msg);
    throw new Error(msg);
  }

  // Sanitize/normalize env ID for comparison (already sanitized in sheets.ts line 67)
  const normalizedEnvId = SPREADSHEET_ID.trim();
  
  // Helper function to normalize spreadsheet IDs (same logic as sheets.ts line 67)
  const normalizeSpreadsheetId = (rawId: string): string => {
    return rawId.replace(/\/edit.*$/, '').trim();
  };

  // 2. Check Settings sheet for duplicate/conflicting SPREADSHEET_ID entries
  // Use uncached read to get fresh data
  const settings = await sheetsService.readSheet("Settings", false);
  
  // Find all rows with spreadsheet ID keys (pattern: /^SHEETS?_SPREADSHEET_ID$/i)
  const spreadsheetIdEntries = settings.filter((row: any) => {
    const key = row.Key?.trim() || "";
    return /^SHEETS?_SPREADSHEET_ID$/i.test(key);
  });

  // Count total entries (duplicates if >1 entry exists)
  const totalEntries = spreadsheetIdEntries.length;
  
  // Find conflicting values (entries with values different from env)
  // Apply same normalization to Settings values (remove /edit suffix, trim)
  const conflictingEntries = spreadsheetIdEntries.filter((row: any) => {
    const rawValue = row.Value || "";
    if (!rawValue.trim()) return false;
    
    const normalizedValue = normalizeSpreadsheetId(rawValue);
    return normalizedValue !== normalizedEnvId;
  });

  // Determine validation result
  if (totalEntries === 0) {
    // No Settings entries - all good, env is single source
    const msg = `Spreadsheet validation PASS: Using env single source ${normalizedEnvId.substring(0, 10)}... (no Settings entries)`;
    await sheetsService.logToSheet("INFO", "Spreadsheet Validation", msg);
    return 0;
  } else if (totalEntries === 1 && conflictingEntries.length === 0) {
    // Exactly 1 entry matching env - all good
    const msg = `Spreadsheet validation PASS: Single source ${normalizedEnvId.substring(0, 10)}... (Settings entry matches env)`;
    await sheetsService.logToSheet("INFO", "Spreadsheet Validation", msg);
    return 0;
  } else {
    // Either duplicates (>1 entry) or conflicts (value differs from env)
    const hasDuplicates = totalEntries > 1;
    const hasConflicts = conflictingEntries.length > 0;
    
    let warnParts = [];
    if (hasDuplicates) {
      warnParts.push(`${totalEntries} duplicate entries`);
    }
    if (hasConflicts) {
      const conflictValues = conflictingEntries.map((r: any) => r.Value).join(", ");
      warnParts.push(`${conflictingEntries.length} conflicting values: ${conflictValues}`);
    }
    
    const msg = `WARNING: Spreadsheet validation found ${warnParts.join(" and ")} in Settings sheet. Using env single source: ${normalizedEnvId.substring(0, 10)}...`;
    
    await sheetsService.logToSheet("WARN", "Spreadsheet Validation", msg);
    
    // Return total count of problematic entries (duplicates + conflicts)
    return totalEntries;
  }
}

