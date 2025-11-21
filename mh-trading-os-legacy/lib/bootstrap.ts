import { GoogleSheetsService, SPREADSHEET_ID } from './sheets';
import { nanoid } from 'nanoid';

export interface BootstrapResult {
  sheets: { name: string; status: 'exists' | 'created' | 'error'; headers?: string[] }[];
  pricingParams?: { created: number; skipped: number; status: 'seeded' | 'skipped' | 'error' };
  shippingSeeds?: {
    methods: { created: number; skipped: number; status: 'seeded' | 'skipped' | 'error' };
    boxes: { created: number; skipped: number; status: 'seeded' | 'skipped' | 'error' };
    rules: { created: number; skipped: number; status: 'seeded' | 'skipped' | 'error' };
  };
  namedRanges: { name: string; status: 'exists' | 'created' | 'error' }[];
  settings: { key: string; value: string | null; status: 'ok' | 'missing' | 'set' }[];
  drive: { path: string; status: 'exists' | 'created' | 'error' }[];
  overall: 'healthy' | 'warnings' | 'errors';
}

const REQUIRED_SHEETS = [
  {
    name: 'Settings',
    headers: ['Key', 'Value', 'Description', 'Category', 'LastModified']
  },
  {
    name: 'Pricing_Params',
    headers: ['ParamKey', 'Value', 'Unit', 'Category', 'Type', 'AppliesTo', 'Notes']
  },
  {
    name: 'FinalPriceList',
    headers: [
      // Product Identification
      'SKU', 'Name', 'Category', 'Brand', 'Barcode', 'Status',
      // Detailed Cost Breakdown
      'Factory_Cost_EUR', 'Packaging_Cost_EUR', 'Freight_kg_EUR', 
      'Import_Duty_Pct', 'Overhead_Pct', 'COGS_EUR',
      // Product Specs
      'Weight_g', 'Dims_cm', 'VAT%',
      // Pricing (Calculated)
      'UVP_Recommended', 'UVP', 'MAP', 'AutoPriceFlag',
      // Channel Prices
      'Price_Web', 'Price_Amazon', 'Price_Salon',
      // Tier Net Prices
      'Net_Dealer_Basic', 'Net_Dealer_Plus', 'Net_Stand', 'Net_Distributor',
      // Competitor Intelligence
      'Competitor_Min', 'Competitor_Median',
      // Metadata
      'Pricing_Version', 'QRUrl', 'Notes'
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
      'Street', 'Postal', 'City', 'CountryCode', 'Notes', 'PartnerFolderID', 'PartnerFolderURL'
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
  {
    name: 'OS_Logs',
    headers: ['Timestamp', 'Level', 'Scope', 'Message', 'Ref']
  },
  {
    name: 'OS_Health',
    headers: ['CheckTS', 'Component', 'Status', 'Message', 'Details']
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
  {
    name: 'Subscription_Invoices',
    headers: ['InvoiceID', 'SubID', 'PeriodStart', 'PeriodEnd', 'Amount', 'Status', 'PaidTS', 'Notes']
  },
  {
    name: 'Affiliate_Programs',
    headers: ['AffID', 'Name', 'RatePct', 'CookieDays', 'Channel', 'Active']
  },
  {
    name: 'Affiliate_Leads',
    headers: ['LeadID', 'AffID', 'PartnerID_Email', 'Source', 'TS', 'Status']
  },
  {
    name: 'Commission_Rules',
    headers: ['RuleID', 'Role', 'Tier', 'Channel', 'BaseRatePct', 'BonusPct', 'CapPct', 'Notes']
  },
  {
    name: 'Email_Queue',
    headers: ['MsgID', 'TS', 'To', 'Subject', 'Template', 'PayloadJSON', 'Status', 'Error']
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
    headers: [
      'BoxID', 'BoxName_EN', 'BoxName_AR', 'Length_cm', 'Width_cm', 'Height_cm',
      'Volume_cm3', 'MaxWeight_g', 'CostEUR', 'Active', 'InStock', 'Notes'
    ]
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
  }
];

const NAMED_RANGES = [
  { name: 'TIER_LIST', sheet: 'PartnerTiers', range: 'A2:A' },
  { name: 'ORDER_STATUS', sheet: 'Orders', range: 'M1:M1' }, // Will be dropdown values
  { name: 'QUOTE_STATUS', sheet: 'Quotes', range: 'K1:K1' }, // Will be dropdown values
  { name: 'AI_MODELS', sheet: 'Settings', range: 'B1:B1' }, // Will be dropdown values
  // Pricing Law v2 named ranges
  { name: 'LINE_LIST', sheet: 'Pricing_Line_Targets', range: 'A2:A' }, // Product lines: Premium, Pro, Basic, Tools
  { name: 'CHANNEL_LIST', sheet: 'Channels', range: 'A2:A' } // Sales channels: OwnStore, Amazon_FBM, Amazon_FBA
];

const REQUIRED_SETTINGS = [
  { key: 'HM_CURRENCY', defaultValue: 'EUR', description: 'System currency', category: 'Core' },
  { key: 'VAT_Default_Pct', defaultValue: '19', description: 'Default VAT percentage', category: 'Pricing' },
  { key: 'HM_DRIVE_ROOT_ID', defaultValue: '', description: 'Google Drive root folder ID', category: 'Integration' },
  { key: 'HM_STAND_QR_BASE', defaultValue: 'https://stand.example.com/s/', description: 'Base URL for stand QR codes', category: 'Stands' },
  { key: 'EMAIL_PROVIDER', defaultValue: 'smtp', description: 'Email service provider', category: 'Integration' },
  { key: 'DRY_RUN', defaultValue: 'true', description: 'Enable dry-run mode (no actual emails sent)', category: 'Integration' },
  { key: 'AI_Default_Model', defaultValue: 'gpt-4o-mini', description: 'Default AI model for assistants', category: 'AI' },
  { key: 'ENV', defaultValue: 'staging', description: 'Environment: staging or production', category: 'Core' }
];

const DRIVE_FOLDERS = [
  'Inbox',
  'Exports',
  '06_Docs',
  '06_Docs/Partners',
  '06_Docs/Quotes',
  '06_Docs/Orders',
  '06_Docs/Invoices'
];

const DEFAULT_PRICING_PARAMS = [
  // Cost Category - Detailed cost calculation defaults
  { ParamKey: 'DEFAULT_FREIGHT_KG_EUR', Value: '2.50', Unit: 'EUR/kg', Category: 'Cost', Type: 'currency', AppliesTo: 'all', Notes: 'Default freight cost per kilogram when not specified per product' },
  { ParamKey: 'IMPORT_DUTY_PCT_DEFAULT', Value: '6.5', Unit: '%', Category: 'Cost', Type: 'percentage', AppliesTo: 'all', Notes: 'Default import duty percentage when not specified per product' },
  { ParamKey: 'OVERHEAD_PCT_DEFAULT', Value: '8', Unit: '%', Category: 'Cost', Type: 'percentage', AppliesTo: 'all', Notes: 'Default overhead percentage (warehousing, admin) when not specified per product' },
  
  // Margin Category - Channel-specific target margins
  { ParamKey: 'TARGET_MARGIN_WEB_PCT', Value: '50', Unit: '%', Category: 'Margin', Type: 'percentage', AppliesTo: 'web', Notes: 'Target profit margin for web channel (UVP calculation)' },
  { ParamKey: 'TARGET_MARGIN_SALON_PCT', Value: '40', Unit: '%', Category: 'Margin', Type: 'percentage', AppliesTo: 'salon', Notes: 'Target profit margin for salon/B2B channel (typically lower than web)' },
  { ParamKey: 'FLOOR_MARGIN_PCT', Value: '15', Unit: '%', Category: 'Margin', Type: 'percentage', AppliesTo: 'all', Notes: 'Minimum acceptable profit margin (guardrail to prevent loss-making prices)' },
  
  // MAP Category - Minimum Advertised Price controls
  { ParamKey: 'MAP_ENABLE', Value: 'true', Unit: 'boolean', Category: 'MAP', Type: 'boolean', AppliesTo: 'all', Notes: 'Enable MAP (Minimum Advertised Price) enforcement' },
  { ParamKey: 'MAP_DELTA_EUR', Value: '5', Unit: 'EUR', Category: 'MAP', Type: 'currency', AppliesTo: 'all', Notes: 'Fixed amount below UVP for MAP (use this OR MAP_PCT, not both)' },
  { ParamKey: 'MAP_PCT', Value: '', Unit: '%', Category: 'MAP', Type: 'percentage', AppliesTo: 'all', Notes: 'Percentage below UVP for MAP (use this OR MAP_DELTA_EUR, not both)' },
  
  // Competitor Category - Competitive pricing intelligence
  { ParamKey: 'COMPETITOR_WEIGHT_PCT', Value: '30', Unit: '%', Category: 'Competitor', Type: 'percentage', AppliesTo: 'all', Notes: 'Weight given to competitor prices in pricing decisions (0-100)' },
  { ParamKey: 'COMPETITOR_BAND_MIN_PCT', Value: '-15', Unit: '%', Category: 'Competitor', Type: 'percentage', AppliesTo: 'all', Notes: 'Maximum safe discount vs competitor median (e.g., -15% means we can go 15% below competitor median)' },
  { ParamKey: 'COMPETITOR_BAND_MAX_PCT', Value: '10', Unit: '%', Category: 'Competitor', Type: 'percentage', AppliesTo: 'all', Notes: 'Maximum safe premium vs competitor median (e.g., +10% means we can go 10% above competitor median)' },
  
  // Rounding Category - Price ending rules for psychological pricing
  { ParamKey: 'RND_UVP_WEB', Value: '0.49', Unit: '', Category: 'Rounding', Type: 'number', AppliesTo: 'web', Notes: 'Decimal ending for web UVP (e.g., 0.49 = €19.49, 0.99 = €19.99)' },
  { ParamKey: 'RND_UVP_SALON', Value: '0.99', Unit: '', Category: 'Rounding', Type: 'number', AppliesTo: 'salon', Notes: 'Decimal ending for salon UVP (typically .99 for B2B)' },
  { ParamKey: 'RND_MAP', Value: '0.01', Unit: '', Category: 'Rounding', Type: 'number', AppliesTo: 'all', Notes: 'Rounding for MAP (0.01 = round to nearest cent)' },
  
  // Legacy/Fulfillment Category - Backwards compatibility with existing pricing logic
  { ParamKey: 'MARGIN_UVP_PCT', Value: '50', Unit: '%', Category: 'Legacy', Type: 'percentage', AppliesTo: 'all', Notes: 'Legacy margin parameter (fallback if channel margins not set)' },
  { ParamKey: 'FULFILL_BASE_EUR', Value: '2', Unit: 'EUR', Category: 'Fulfillment', Type: 'currency', AppliesTo: 'all', Notes: 'Base fulfillment cost per order (legacy calculation)' },
  { ParamKey: 'FULFILL_PER_100G_EUR', Value: '0.5', Unit: 'EUR/100g', Category: 'Fulfillment', Type: 'currency', AppliesTo: 'all', Notes: 'Fulfillment cost per 100g (legacy calculation)' },
  { ParamKey: 'RETURNS_PCT', Value: '3', Unit: '%', Category: 'Fulfillment', Type: 'percentage', AppliesTo: 'all', Notes: 'Returns adjustment percentage (legacy calculation)' },
  { ParamKey: 'ENERGY_PCT', Value: '2', Unit: '%', Category: 'Fulfillment', Type: 'percentage', AppliesTo: 'all', Notes: 'Energy cost adjustment percentage (legacy calculation)' },
  { ParamKey: 'MIN_UVP_EUR', Value: '5', Unit: 'EUR', Category: 'Legacy', Type: 'currency', AppliesTo: 'all', Notes: 'Minimum allowed UVP (absolute floor)' },
  { ParamKey: 'MIN_MARGIN_PCT', Value: '10', Unit: '%', Category: 'Legacy', Type: 'percentage', AppliesTo: 'all', Notes: 'Minimum margin percentage (legacy, use FLOOR_MARGIN_PCT instead)' },
];

const DEFAULT_SHIPPING_METHODS = [
  { 
    MethodID: 'DHL', 
    MethodName_EN: 'DHL Express', 
    MethodName_AR: 'دي إتش إل اكسبريس', 
    Active: true, 
    DefaultCostEUR: 5.90, 
    MinDays: 1, 
    MaxDays: 3, 
    Icon: 'truck', 
    Description_EN: 'Fast and reliable courier delivery', 
    Description_AR: 'توصيل سريع وموثوق', 
    Notes: 'Standard DHL courier service' 
  },
  { 
    MethodID: 'PICKUP', 
    MethodName_EN: 'Store Pickup', 
    MethodName_AR: 'استلام من المتجر', 
    Active: true, 
    DefaultCostEUR: 0, 
    MinDays: 0, 
    MaxDays: 1, 
    Icon: 'store', 
    Description_EN: 'Pick up your order from our store', 
    Description_AR: 'استلم طلبك من متجرنا', 
    Notes: 'Free pickup from physical location' 
  },
  { 
    MethodID: 'COMPANY_CAR', 
    MethodName_EN: 'Company Delivery', 
    MethodName_AR: 'توصيل الشركة', 
    Active: true, 
    DefaultCostEUR: 3.00, 
    MinDays: 1, 
    MaxDays: 2, 
    Icon: 'car', 
    Description_EN: 'Direct delivery by company vehicle', 
    Description_AR: 'توصيل مباشر بسيارة الشركة', 
    Notes: 'Own fleet delivery for local areas' 
  },
  { 
    MethodID: 'FREE', 
    MethodName_EN: 'Free Shipping', 
    MethodName_AR: 'شحن مجاني', 
    Active: true, 
    DefaultCostEUR: 0, 
    MinDays: 2, 
    MaxDays: 5, 
    Icon: 'gift', 
    Description_EN: 'Free shipping for qualifying orders', 
    Description_AR: 'شحن مجاني للطلبات المؤهلة', 
    Notes: 'Promotional free shipping via DHL' 
  },
];

const DEFAULT_PACKAGING_BOXES = [
  { 
    BoxID: 'BOX-S', 
    BoxName_EN: 'Small Box', 
    BoxName_AR: 'صندوق صغير', 
    Length_cm: 20, 
    Width_cm: 15, 
    Height_cm: 10, 
    Volume_cm3: 3000, 
    MaxWeight_g: 2000, 
    CostEUR: 0.50, 
    Active: true, 
    InStock: 100, 
    Notes: 'For 1-3 small items' 
  },
  { 
    BoxID: 'BOX-M', 
    BoxName_EN: 'Medium Box', 
    BoxName_AR: 'صندوق متوسط', 
    Length_cm: 30, 
    Width_cm: 20, 
    Height_cm: 15, 
    Volume_cm3: 9000, 
    MaxWeight_g: 5000, 
    CostEUR: 0.80, 
    Active: true, 
    InStock: 150, 
    Notes: 'For 4-8 items or larger products' 
  },
  { 
    BoxID: 'BOX-L', 
    BoxName_EN: 'Large Box', 
    BoxName_AR: 'صندوق كبير', 
    Length_cm: 40, 
    Width_cm: 30, 
    Height_cm: 20, 
    Volume_cm3: 24000, 
    MaxWeight_g: 10000, 
    CostEUR: 1.20, 
    Active: true, 
    InStock: 80, 
    Notes: 'For bulk orders 9-15 items' 
  },
  { 
    BoxID: 'BOX-XL', 
    BoxName_EN: 'Extra Large Box', 
    BoxName_AR: 'صندوق كبير جداً', 
    Length_cm: 50, 
    Width_cm: 40, 
    Height_cm: 30, 
    Volume_cm3: 60000, 
    MaxWeight_g: 20000, 
    CostEUR: 1.80, 
    Active: true, 
    InStock: 50, 
    Notes: 'For large wholesale orders 16+ items' 
  },
];

const DEFAULT_SHIPPING_RULES = [
  { 
    RuleID: 'RULE-FREE-100', 
    MethodID: 'FREE', 
    PartnerTier: '', 
    PartnerType: 'All', 
    MinOrderEUR: 100, 
    MaxOrderEUR: null, 
    Zone: '', 
    ShippingCostEUR: 0, 
    FreeShipping: true, 
    Priority: 1, 
    Active: true, 
    Notes: 'Free shipping for orders above 100 EUR' 
  },
  { 
    RuleID: 'RULE-DHL-DE', 
    MethodID: 'DHL', 
    PartnerTier: '', 
    PartnerType: 'B2C', 
    MinOrderEUR: null, 
    MaxOrderEUR: 99.99, 
    Zone: 'DE', 
    ShippingCostEUR: 4.90, 
    FreeShipping: false, 
    Priority: 10, 
    Active: true, 
    Notes: 'Standard DHL for B2C orders in Germany under 100 EUR' 
  },
  { 
    RuleID: 'RULE-DHL-EU', 
    MethodID: 'DHL', 
    PartnerTier: '', 
    PartnerType: 'B2C', 
    MinOrderEUR: null, 
    MaxOrderEUR: 99.99, 
    Zone: 'EU', 
    ShippingCostEUR: 7.90, 
    FreeShipping: false, 
    Priority: 10, 
    Active: true, 
    Notes: 'Standard DHL for B2C orders in EU under 100 EUR' 
  },
  { 
    RuleID: 'RULE-B2B-PICKUP', 
    MethodID: 'PICKUP', 
    PartnerTier: '', 
    PartnerType: 'B2B', 
    MinOrderEUR: null, 
    MaxOrderEUR: null, 
    Zone: '', 
    ShippingCostEUR: 0, 
    FreeShipping: true, 
    Priority: 5, 
    Active: true, 
    Notes: 'B2B partners can always pick up from store' 
  },
];

export class BootstrapService {
  constructor(private sheetsService: GoogleSheetsService) {}

  async runFullBootstrap(): Promise<BootstrapResult> {
    const result: BootstrapResult = {
      sheets: [],
      namedRanges: [],
      settings: [],
      drive: [],
      overall: 'healthy'
    };

    await this.sheetsService.logToSheet('INFO', 'Bootstrap', 'Starting full system bootstrap');

    // 1. Check and create sheets
    for (const sheetDef of REQUIRED_SHEETS) {
      const sheetResult = await this.ensureSheet(sheetDef.name, sheetDef.headers);
      result.sheets.push(sheetResult);
      if (sheetResult.status === 'error') result.overall = 'errors';
      else if (sheetResult.status === 'created' && result.overall === 'healthy') result.overall = 'warnings';
    }

    // 1b. Seed default pricing params (after sheets exist, before settings)
    const pricingParamsResult = await this.seedDefaultPricingParams();
    result.pricingParams = pricingParamsResult;
    if (pricingParamsResult.status === 'error' && result.overall === 'healthy') {
      result.overall = 'warnings';
    }

    // 1c. Seed default shipping data
    const shippingMethodsResult = await this.seedDefaultShippingMethods();
    await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Shipping methods: ${shippingMethodsResult.status} (created: ${shippingMethodsResult.created}, skipped: ${shippingMethodsResult.skipped})`);
    
    const packagingBoxesResult = await this.seedDefaultPackagingBoxes();
    await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Packaging boxes: ${packagingBoxesResult.status} (created: ${packagingBoxesResult.created}, skipped: ${packagingBoxesResult.skipped})`);
    
    const shippingRulesResult = await this.seedDefaultShippingRules();
    await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Shipping rules: ${shippingRulesResult.status} (created: ${shippingRulesResult.created}, skipped: ${shippingRulesResult.skipped})`);
    
    // Store shipping seeds results
    result.shippingSeeds = {
      methods: shippingMethodsResult,
      boxes: packagingBoxesResult,
      rules: shippingRulesResult
    };
    
    // Update overall status only for actual errors (not skipped seeds)
    if (shippingMethodsResult.status === 'error' || 
        packagingBoxesResult.status === 'error' || 
        shippingRulesResult.status === 'error') {
      if (result.overall === 'healthy') result.overall = 'warnings';
    }

    // 2. Check and create settings
    for (const setting of REQUIRED_SETTINGS) {
      const settingResult = await this.ensureSetting(setting);
      result.settings.push(settingResult);
      if (settingResult.status === 'missing') result.overall = 'warnings';
    }

    // 3. Check named ranges (informational only - will be created manually if needed)
    for (const range of NAMED_RANGES) {
      result.namedRanges.push({ name: range.name, status: 'exists' }); // Placeholder
    }

    // 4. Check Drive folders (if HM_DRIVE_ROOT_ID is set)
    const driveRootId = result.settings.find(s => s.key === 'HM_DRIVE_ROOT_ID')?.value;
    if (driveRootId) {
      for (const folder of DRIVE_FOLDERS) {
        result.drive.push({ path: folder, status: 'exists' }); // Placeholder - actual check would use Google Drive API
      }
    }

    // Log to OS_Health
    await this.logHealthCheck(result);

    await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Bootstrap completed: ${result.overall}`);

    return result;
  }

  private async ensureSheet(name: string, headers: string[]): Promise<{ name: string; status: 'exists' | 'created' | 'error'; headers?: string[] }> {
    try {
      // Try to read the sheet
      const data = await this.sheetsService.readSheet(name);
      
      // Check if headers exist (using single source of truth: SPREADSHEET_ID)
      const sheets = await this.sheetsService['getClient']();
      
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${name}!1:1`,
      });

      const existingHeaders = response.data.values?.[0] || [];
      
      if (existingHeaders.length === 0) {
        // Sheet exists but no headers - add them
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${name}!1:1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers],
          },
        });
        
        await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Added headers to existing sheet: ${name}`);
        return { name, status: 'created', headers };
      }

      return { name, status: 'exists', headers: existingHeaders };
    } catch (error: any) {
      // If sheet doesn't exist, try to create it
      if (error?.message?.includes('Unable to parse range')) {
        try {
          const sheets = await this.sheetsService['getClient']();
          
          await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            requestBody: {
              requests: [{
                addSheet: {
                  properties: {
                    title: name
                  }
                }
              }]
            }
          });

          // Add headers
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${name}!1:1`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [headers],
            },
          });

          await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Created new sheet: ${name}`);
          return { name, status: 'created', headers };
        } catch (createError: any) {
          await this.sheetsService.logToSheet('ERROR', 'Bootstrap', `Failed to create sheet ${name}: ${createError.message}`);
          return { name, status: 'error' };
        }
      }

      await this.sheetsService.logToSheet('ERROR', 'Bootstrap', `Error checking sheet ${name}: ${error.message}`);
      return { name, status: 'error' };
    }
  }

  private async seedDefaultPricingParams(): Promise<{ created: number; skipped: number; status: 'seeded' | 'skipped' | 'error' }> {
    try {
      // Fetch existing params
      const existingParams = await this.sheetsService.getPricingParams();
      const existingKeys = new Set(existingParams.map(p => p.ParamKey));
      
      // Filter out params that already exist
      const toCreate = DEFAULT_PRICING_PARAMS.filter(p => !existingKeys.has(p.ParamKey));
      
      if (toCreate.length === 0) {
        await this.sheetsService.logToSheet('INFO', 'Bootstrap', 'All pricing params already exist - skipping seed');
        return { created: 0, skipped: DEFAULT_PRICING_PARAMS.length, status: 'skipped' };
      }
      
      // Append only missing params
      await this.sheetsService.writeRows('Pricing_Params', toCreate);
      
      await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Seeded ${toCreate.length} pricing params (${existingKeys.size} already existed)`);
      return { 
        created: toCreate.length, 
        skipped: DEFAULT_PRICING_PARAMS.length - toCreate.length, 
        status: 'seeded' 
      };
    } catch (error: any) {
      await this.sheetsService.logToSheet('WARN', 'Bootstrap', `Pricing params seeding failed: ${error.message}`);
      return { created: 0, skipped: 0, status: 'error' };
    }
  }

  private async seedDefaultShippingMethods(): Promise<{ created: number; skipped: number; status: 'seeded' | 'skipped' | 'error' }> {
    try {
      const existing = await this.sheetsService.getShippingMethods();
      const existingIDs = new Set(existing.map(m => m.MethodID));
      const toCreate = DEFAULT_SHIPPING_METHODS.filter(m => !existingIDs.has(m.MethodID));
      
      if (toCreate.length === 0) {
        await this.sheetsService.logToSheet('INFO', 'Bootstrap', 'All shipping methods already exist - skipping seed');
        return { created: 0, skipped: DEFAULT_SHIPPING_METHODS.length, status: 'skipped' };
      }
      
      await this.sheetsService.writeRows('Shipping_Methods', toCreate);
      await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Seeded ${toCreate.length} shipping methods (${existingIDs.size} already existed)`);
      return { 
        created: toCreate.length, 
        skipped: DEFAULT_SHIPPING_METHODS.length - toCreate.length, 
        status: 'seeded' 
      };
    } catch (error: any) {
      await this.sheetsService.logToSheet('WARN', 'Bootstrap', `Shipping methods seeding failed: ${error.message}`);
      return { created: 0, skipped: 0, status: 'error' };
    }
  }

  private async seedDefaultPackagingBoxes(): Promise<{ created: number; skipped: number; status: 'seeded' | 'skipped' | 'error' }> {
    try {
      const existing = await this.sheetsService.getPackagingBoxes();
      const existingIDs = new Set(existing.map(b => b.BoxID));
      const toCreate = DEFAULT_PACKAGING_BOXES.filter(b => !existingIDs.has(b.BoxID));
      
      if (toCreate.length === 0) {
        await this.sheetsService.logToSheet('INFO', 'Bootstrap', 'All packaging boxes already exist - skipping seed');
        return { created: 0, skipped: DEFAULT_PACKAGING_BOXES.length, status: 'skipped' };
      }
      
      await this.sheetsService.writeRows('Packaging_Boxes', toCreate);
      await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Seeded ${toCreate.length} packaging boxes (${existingIDs.size} already existed)`);
      return { 
        created: toCreate.length, 
        skipped: DEFAULT_PACKAGING_BOXES.length - toCreate.length, 
        status: 'seeded' 
      };
    } catch (error: any) {
      await this.sheetsService.logToSheet('WARN', 'Bootstrap', `Packaging boxes seeding failed: ${error.message}`);
      return { created: 0, skipped: 0, status: 'error' };
    }
  }

  private async seedDefaultShippingRules(): Promise<{ created: number; skipped: number; status: 'seeded' | 'skipped' | 'error' }> {
    try {
      const existing = await this.sheetsService.getShippingRules();
      const existingIDs = new Set(existing.map(r => r.RuleID));
      const toCreate = DEFAULT_SHIPPING_RULES.filter(r => !existingIDs.has(r.RuleID));
      
      if (toCreate.length === 0) {
        await this.sheetsService.logToSheet('INFO', 'Bootstrap', 'All shipping rules already exist - skipping seed');
        return { created: 0, skipped: DEFAULT_SHIPPING_RULES.length, status: 'skipped' };
      }
      
      await this.sheetsService.writeRows('Shipping_Rules', toCreate);
      await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Seeded ${toCreate.length} shipping rules (${existingIDs.size} already existed)`);
      return { 
        created: toCreate.length, 
        skipped: DEFAULT_SHIPPING_RULES.length - toCreate.length, 
        status: 'seeded' 
      };
    } catch (error: any) {
      await this.sheetsService.logToSheet('WARN', 'Bootstrap', `Shipping rules seeding failed: ${error.message}`);
      return { created: 0, skipped: 0, status: 'error' };
    }
  }

  private async ensureSetting(setting: { key: string; defaultValue: string; description: string; category: string }): Promise<{ key: string; value: string | null; status: 'ok' | 'missing' | 'set' }> {
    try {
      const settings = await this.sheetsService.getSettings();
      const existing = settings.find(s => s.Key === setting.key);

      if (existing && existing.Value) {
        return { key: setting.key, value: existing.Value, status: 'ok' };
      }

      // Setting doesn't exist or has no value - create/update it
      if (!existing) {
        await this.sheetsService.writeRows('Settings', [{
          Key: setting.key,
          Value: setting.defaultValue,
          Description: setting.description,
          Category: setting.category,
          LastModified: new Date().toISOString()
        }]);

        await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Created setting: ${setting.key} = ${setting.defaultValue}`);
        return { key: setting.key, value: setting.defaultValue, status: 'set' };
      } else {
        await this.sheetsService.updateRow('Settings', 'Key', setting.key, {
          Value: setting.defaultValue,
          LastModified: new Date().toISOString()
        });

        await this.sheetsService.logToSheet('INFO', 'Bootstrap', `Updated setting: ${setting.key} = ${setting.defaultValue}`);
        return { key: setting.key, value: setting.defaultValue, status: 'set' };
      }
    } catch (error: any) {
      await this.sheetsService.logToSheet('ERROR', 'Bootstrap', `Failed to ensure setting ${setting.key}: ${error.message}`);
      return { key: setting.key, value: null, status: 'missing' };
    }
  }

  private async logHealthCheck(result: BootstrapResult) {
    try {
      const timestamp = new Date().toISOString();
      
      // Build pricing params message
      const pricingMsg = result.pricingParams 
        ? `, Pricing Params: ${result.pricingParams.created} created, ${result.pricingParams.skipped} skipped`
        : '';
      
      // Log overall health
      await this.sheetsService.writeRows('OS_Health', [{
        CheckTS: timestamp,
        Component: 'System Bootstrap',
        Status: result.overall,
        Message: `Sheets: ${result.sheets.filter(s => s.status === 'exists').length}/${result.sheets.length}, Settings: ${result.settings.filter(s => s.status === 'ok').length}/${result.settings.length}${pricingMsg}`,
        Details: JSON.stringify({
          sheets: result.sheets.map(s => ({ name: s.name, status: s.status })),
          pricingParams: result.pricingParams,
          settings: result.settings.map(s => ({ key: s.key, status: s.status }))
        })
      }]);

      // Log individual components
      for (const sheet of result.sheets) {
        if (sheet.status !== 'exists') {
          await this.sheetsService.writeRows('OS_Health', [{
            CheckTS: timestamp,
            Component: `Sheet: ${sheet.name}`,
            Status: sheet.status === 'created' ? 'warning' : 'error',
            Message: sheet.status === 'created' ? 'Sheet was created' : 'Failed to create sheet',
            Details: JSON.stringify(sheet)
          }]);
        }
      }

      for (const setting of result.settings) {
        if (setting.status !== 'ok') {
          await this.sheetsService.writeRows('OS_Health', [{
            CheckTS: timestamp,
            Component: `Setting: ${setting.key}`,
            Status: setting.status === 'set' ? 'warning' : 'error',
            Message: setting.status === 'set' ? 'Setting was created with default value' : 'Setting is missing',
            Details: JSON.stringify(setting)
          }]);
        }
      }

      // Log pricing params seeding result
      if (result.pricingParams && result.pricingParams.status === 'seeded') {
        await this.sheetsService.writeRows('OS_Health', [{
          CheckTS: timestamp,
          Component: 'Pricing Params',
          Status: 'info',
          Message: `Seeded ${result.pricingParams.created} default pricing parameters`,
          Details: JSON.stringify(result.pricingParams)
        }]);
      } else if (result.pricingParams && result.pricingParams.status === 'error') {
        await this.sheetsService.writeRows('OS_Health', [{
          CheckTS: timestamp,
          Component: 'Pricing Params',
          Status: 'warning',
          Message: 'Failed to seed default pricing parameters',
          Details: JSON.stringify(result.pricingParams)
        }]);
      }
    } catch (error: any) {
      console.error('Failed to log health check:', error);
    }
  }
}
