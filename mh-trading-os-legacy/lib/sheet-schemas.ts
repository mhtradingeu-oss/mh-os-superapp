/**
 * Complete Google Sheets Schema Registry for HAIROTICMEN Trading OS
 * Defines all tabs with columns, types, validation rules, and seed data
 */

export type ColumnType = 'text' | 'number' | 'boolean' | 'date' | 'currency' | 'email' | 'url' | 'enum';

export interface ColumnDef {
  name: string;
  type: ColumnType;
  required?: boolean;
  enum?: string[];
  description?: string;
}

export interface SheetSchema {
  name: string;
  description: string;
  columns: ColumnDef[];
  primaryKey?: string;
  seedData?: Record<string, any>[];
}

//=============================================================================
// PRICING DOMAIN SCHEMAS
//=============================================================================

export const PRICING_PARAMS_SCHEMA: SheetSchema = {
  name: 'Pricing_Params',
  description: 'Global pricing configuration parameters',
  columns: [
    { name: 'ParamKey', type: 'text', required: true },
    { name: 'Value', type: 'text', required: true },
  ],
  primaryKey: 'ParamKey',
  seedData: [
    { ParamKey: 'VAT_Default_Pct', Value: '19' },
    { ParamKey: 'Target_Margin_Pct', Value: '45' },
    { ParamKey: 'Floor_Margin_Pct', Value: '25' },
    { ParamKey: 'B2C_Discount_Pct', Value: '10' },
    { ParamKey: 'Amazon_Discount_Pct', Value: '15' },
    { ParamKey: 'MAP_Floor_Multiplier', Value: '0.9' },
    { ParamKey: 'Stripe_Fee_Pct', Value: '1.4' },
    { ParamKey: 'Stripe_Fee_Fixed_EUR', Value: '0.25' },
    { ParamKey: 'PayPal_Fee_Pct', Value: '2.49' },
    { ParamKey: 'PayPal_Fee_Fixed_EUR', Value: '0.35' },
  ],
};

export const PARTNER_TIERS_SCHEMA: SheetSchema = {
  name: 'PartnerTiers',
  description: 'B2B partner tier definitions and discount structures',
  columns: [
    { name: 'TierKey', type: 'text', required: true },
    { name: 'TierName', type: 'text', required: true },
    { name: 'DiscountFromUVP_Pct', type: 'number', required: true },
    { name: 'MinOrderQty', type: 'number' },
    { name: 'MinOrderValue_EUR', type: 'number' },
    { name: 'PaymentTermsDays', type: 'number' },
    { name: 'CommissionRate_Pct', type: 'number' },
  ],
  primaryKey: 'TierKey',
  seedData: [
    { TierKey: 'Stand', TierName: 'Stand Partner', DiscountFromUVP_Pct: 40, MinOrderQty: 12, MinOrderValue_EUR: 300, PaymentTermsDays: 14, CommissionRate_Pct: 7 },
    { TierKey: 'Basic', TierName: 'Basic Dealer', DiscountFromUVP_Pct: 35, MinOrderQty: 6, MinOrderValue_EUR: 150, PaymentTermsDays: 14, CommissionRate_Pct: 5 },
    { TierKey: 'Plus', TierName: 'Plus Dealer', DiscountFromUVP_Pct: 38, MinOrderQty: 12, MinOrderValue_EUR: 250, PaymentTermsDays: 21, CommissionRate_Pct: 4 },
    { TierKey: 'Distributor', TierName: 'Distributor', DiscountFromUVP_Pct: 45, MinOrderQty: 24, MinOrderValue_EUR: 500, PaymentTermsDays: 30, CommissionRate_Pct: 3 },
  ],
};

export const AMAZON_SIZE_TIERS_SCHEMA: SheetSchema = {
  name: 'AmazonSizeTiers',
  description: 'Amazon FBA size tier configurations and fee structures',
  columns: [
    { name: 'TierKey', type: 'text', required: true },
    { name: 'Description', type: 'text' },
    { name: 'MaxWeight_g', type: 'number' },
    { name: 'MaxLength_cm', type: 'number' },
    { name: 'MaxWidth_cm', type: 'number' },
    { name: 'MaxHeight_cm', type: 'number' },
    { name: 'FBA_Fee_EUR', type: 'currency', required: true },
    { name: 'Storage_Fee_Monthly_EUR', type: 'currency' },
  ],
  primaryKey: 'TierKey',
  seedData: [
    { TierKey: 'SmallStandard', Description: 'Small Standard Size', MaxWeight_g: 500, MaxLength_cm: 35, MaxWidth_cm: 25, MaxHeight_cm: 12, FBA_Fee_EUR: 2.85, Storage_Fee_Monthly_EUR: 0.15 },
    { TierKey: 'LargeStandard_500_1000g', Description: 'Large Standard 500-1000g', MaxWeight_g: 1000, MaxLength_cm: 45, MaxWidth_cm: 34, MaxHeight_cm: 26, FBA_Fee_EUR: 3.75, Storage_Fee_Monthly_EUR: 0.25 },
    { TierKey: 'LargeStandard_1000_1500g', Description: 'Large Standard 1000-1500g', MaxWeight_g: 1500, MaxLength_cm: 45, MaxWidth_cm: 34, MaxHeight_cm: 26, FBA_Fee_EUR: 4.25, Storage_Fee_Monthly_EUR: 0.35 },
    { TierKey: 'LargeStandard_1500_2000g', Description: 'Large Standard 1500-2000g', MaxWeight_g: 2000, MaxLength_cm: 45, MaxWidth_cm: 34, MaxHeight_cm: 26, FBA_Fee_EUR: 4.75, Storage_Fee_Monthly_EUR: 0.45 },
    { TierKey: 'LargeStandard_2000_4000g', Description: 'Large Standard 2000-4000g', MaxWeight_g: 4000, MaxLength_cm: 45, MaxWidth_cm: 34, MaxHeight_cm: 26, FBA_Fee_EUR: 5.50, Storage_Fee_Monthly_EUR: 0.65 },
  ],
};

export const SHIPPING_MATRIX_DHL_SCHEMA: SheetSchema = {
  name: 'ShippingMatrixDHL',
  description: 'DHL shipping costs by weight band and zone',
  columns: [
    { name: 'WeightBand', type: 'text', required: true },
    { name: 'MinWeight_g', type: 'number', required: true },
    { name: 'MaxWeight_g', type: 'number', required: true },
    { name: 'Zone_Domestic_EUR', type: 'currency', required: true },
    { name: 'Zone_EU_EUR', type: 'currency', required: true },
    { name: 'Zone_International_EUR', type: 'currency', required: true },
  ],
  primaryKey: 'WeightBand',
  seedData: [
    { WeightBand: 'Band_0_500', MinWeight_g: 0, MaxWeight_g: 500, Zone_Domestic_EUR: 4.99, Zone_EU_EUR: 8.99, Zone_International_EUR: 15.99 },
    { WeightBand: 'Band_500_1000', MinWeight_g: 501, MaxWeight_g: 1000, Zone_Domestic_EUR: 5.99, Zone_EU_EUR: 10.99, Zone_International_EUR: 19.99 },
    { WeightBand: 'Band_1000_2000', MinWeight_g: 1001, MaxWeight_g: 2000, Zone_Domestic_EUR: 6.99, Zone_EU_EUR: 12.99, Zone_International_EUR: 24.99 },
    { WeightBand: 'Band_2000_5000', MinWeight_g: 2001, MaxWeight_g: 5000, Zone_Domestic_EUR: 8.99, Zone_EU_EUR: 16.99, Zone_International_EUR: 34.99 },
    { WeightBand: 'Band_5000_Plus', MinWeight_g: 5001, MaxWeight_g: 999999, Zone_Domestic_EUR: 12.99, Zone_EU_EUR: 24.99, Zone_International_EUR: 49.99 },
  ],
};

export const DHL_SURCHARGE_SCHEMA: SheetSchema = {
  name: 'DHLSurcharge',
  description: 'DHL additional surcharges and fees',
  columns: [
    { name: 'SurchargeKey', type: 'text', required: true },
    { name: 'Description', type: 'text' },
    { name: 'Type', type: 'enum', enum: ['Percentage', 'Fixed', 'PerKg'] },
    { name: 'Value', type: 'number', required: true },
  ],
  primaryKey: 'SurchargeKey',
  seedData: [
    { SurchargeKey: 'Fuel', Description: 'Fuel surcharge', Type: 'Percentage', Value: 18.5 },
    { SurchargeKey: 'RemoteArea', Description: 'Remote area delivery', Type: 'Fixed', Value: 15.00 },
    { SurchargeKey: 'Oversize', Description: 'Oversize package fee', Type: 'Fixed', Value: 25.00 },
    { SurchargeKey: 'Insurance', Description: 'Insurance per €100 value', Type: 'Percentage', Value: 1.5 },
  ],
};

export const MAP_GUARDRAILS_SCHEMA: SheetSchema = {
  name: 'MAP_Guardrails',
  description: 'Minimum Advertised Price enforcement rules',
  columns: [
    { name: 'SKU', type: 'text', required: true },
    { name: 'MAP_Floor_EUR', type: 'currency', required: true },
    { name: 'EnforcedSince', type: 'date' },
    { name: 'Reason', type: 'text' },
  ],
  primaryKey: 'SKU',
  seedData: [],
};

export const FINAL_PRICE_LIST_SCHEMA: SheetSchema = {
  name: 'FinalPriceList',
  description: 'Master product catalog with complete pricing calculations',
  columns: [
    // Core Product Info
    { name: 'SKU', type: 'text', required: true },
    { name: 'Name', type: 'text', required: true },
    { name: 'Line', type: 'enum', enum: ['Premium', 'Professional', 'Basic', 'Tools', 'Bundle'], required: true },
    { name: 'Category', type: 'enum', enum: ['Barber Care', 'Hair Care', 'Styling', 'Shaving', 'Accessories'] },
    { name: 'Status', type: 'enum', enum: ['Active', 'Inactive', 'Discontinued'], required: true },
    
    // Physical Specs
    { name: 'Weight_g', type: 'number', required: true },
    { name: 'Net_Content_ml', type: 'number' },
    { name: 'UnitsPerCarton', type: 'number', required: true },
    
    // Cost Stack
    { name: 'FactoryPriceUnit_Manual', type: 'currency', required: true },
    { name: 'TotalFactoryPriceCarton', type: 'currency' },
    { name: 'EPR_LUCID_per_unit', type: 'currency' },
    { name: 'Shipping_Inbound_per_unit', type: 'currency' },
    { name: 'GS1_per_unit', type: 'currency' },
    { name: 'Retail_Packaging_per_unit', type: 'currency' },
    { name: 'QC_PIF_per_unit', type: 'currency' },
    { name: 'Operations_per_unit', type: 'currency' },
    { name: 'Marketing_per_unit', type: 'currency' },
    
    // Calculated Costs
    { name: 'COGS_EUR', type: 'currency' },
    { name: 'FullCost_EUR', type: 'currency' },
    
    // Core Pricing (PAngV compliant)
    { name: 'UVP_Net', type: 'currency' },
    { name: 'UVP_Inc', type: 'currency' },
    { name: 'MAP', type: 'currency' },
    { name: 'Grundpreis', type: 'text' },
    { name: 'VAT%', type: 'number', required: true },
    { name: 'Tax_Pct', type: 'number' },
    
    // B2C Channels
    { name: 'B2C_Store_Net', type: 'currency' },
    { name: 'B2C_Store_Inc', type: 'currency' },
    { name: 'B2C_Margin_Pct', type: 'number' },
    
    // Amazon Channel
    { name: 'Amazon_TierKey', type: 'text' },
    { name: 'Amazon_Net', type: 'currency' },
    { name: 'Amazon_Inc', type: 'currency' },
    { name: 'Amazon_Margin_Pct', type: 'number' },
    
    // Partner Tier Pricing
    { name: 'Dealer_Basic_Net', type: 'currency' },
    { name: 'Dealer_Plus_Net', type: 'currency' },
    { name: 'Stand_Partner_Net', type: 'currency' },
    { name: 'Distributor_Net', type: 'currency' },
    
    // Additional
    { name: 'UPC', type: 'text' },
    { name: 'QRUrl', type: 'url' },
  ],
  primaryKey: 'SKU',
  seedData: [
    // Premium Line - Keratin Hair Mask
    {
      SKU: 'HM-BC-K-50-001',
      Name: 'Keratin Hair Mask Professional 550ml',
      Line: 'Premium',
      Category: 'Barber Care',
      Status: 'Active',
      Weight_g: 600,
      Net_Content_ml: 550,
      UnitsPerCarton: 6,
      FactoryPriceUnit_Manual: 11.50,
      EPR_LUCID_per_unit: 0.08,
      Shipping_Inbound_per_unit: 0.45,
      GS1_per_unit: 0.12,
      Retail_Packaging_per_unit: 0.65,
      QC_PIF_per_unit: 0.15,
      Operations_per_unit: 0.28,
      Marketing_per_unit: 0.20,
      'VAT%': 19,
      Amazon_TierKey: 'SmallStandard',
      UPC: '4260123456001',
    },
    
    // Professional Line - Styling Gel
    {
      SKU: 'HM-S-SG-500-A-010',
      Name: 'Aqua Hold Styling Gel 500ml',
      Line: 'Professional',
      Category: 'Styling',
      Status: 'Active',
      Weight_g: 550,
      Net_Content_ml: 500,
      UnitsPerCarton: 12,
      FactoryPriceUnit_Manual: 6.80,
      EPR_LUCID_per_unit: 0.06,
      Shipping_Inbound_per_unit: 0.35,
      GS1_per_unit: 0.10,
      Retail_Packaging_per_unit: 0.45,
      QC_PIF_per_unit: 0.12,
      Operations_per_unit: 0.22,
      Marketing_per_unit: 0.15,
      'VAT%': 19,
      Amazon_TierKey: 'LargeStandard_500_1000g',
      UPC: '4260123456010',
    },
    
    // Basic Line - Beard Oil
    {
      SKU: 'HM-BC-BO-50-003',
      Name: 'Beard Oil Classic 50ml',
      Line: 'Basic',
      Category: 'Barber Care',
      Status: 'Active',
      Weight_g: 80,
      Net_Content_ml: 50,
      UnitsPerCarton: 24,
      FactoryPriceUnit_Manual: 3.20,
      EPR_LUCID_per_unit: 0.04,
      Shipping_Inbound_per_unit: 0.15,
      GS1_per_unit: 0.08,
      Retail_Packaging_per_unit: 0.25,
      QC_PIF_per_unit: 0.08,
      Operations_per_unit: 0.12,
      Marketing_per_unit: 0.10,
      'VAT%': 19,
      Amazon_TierKey: 'SmallStandard',
      UPC: '4260123456003',
    },
    
    // Tools - Barber Scissors
    {
      SKU: 'HM-A-BB-0-009',
      Name: 'Professional Barber Scissors Premium',
      Line: 'Tools',
      Category: 'Accessories',
      Status: 'Active',
      Weight_g: 120,
      Net_Content_ml: 0,
      UnitsPerCarton: 12,
      FactoryPriceUnit_Manual: 18.50,
      EPR_LUCID_per_unit: 0.05,
      Shipping_Inbound_per_unit: 0.25,
      GS1_per_unit: 0.12,
      Retail_Packaging_per_unit: 0.85,
      QC_PIF_per_unit: 0.20,
      Operations_per_unit: 0.35,
      Marketing_per_unit: 0.25,
      'VAT%': 19,
      Amazon_TierKey: 'SmallStandard',
      UPC: '4260123456009',
    },
    
    // Premium - Hair Shampoo
    {
      SKU: 'HM-HC-SVS-150-007',
      Name: 'Silver Shampoo Violet 150ml',
      Line: 'Premium',
      Category: 'Hair Care',
      Status: 'Active',
      Weight_g: 180,
      Net_Content_ml: 150,
      UnitsPerCarton: 12,
      FactoryPriceUnit_Manual: 4.80,
      EPR_LUCID_per_unit: 0.05,
      Shipping_Inbound_per_unit: 0.20,
      GS1_per_unit: 0.09,
      Retail_Packaging_per_unit: 0.35,
      QC_PIF_per_unit: 0.10,
      Operations_per_unit: 0.18,
      Marketing_per_unit: 0.12,
      'VAT%': 19,
      Amazon_TierKey: 'SmallStandard',
      UPC: '4260123456007',
    },
  ],
};

//=============================================================================
// SALES & CRM DOMAIN SCHEMAS
//=============================================================================

export const PARTNERS_SCHEMA: SheetSchema = {
  name: 'Partners',
  description: 'B2B partner registry with tier assignments',
  columns: [
    { name: 'PartnerID', type: 'text', required: true },
    { name: 'CompanyName', type: 'text', required: true },
    { name: 'TierKey', type: 'enum', enum: ['Stand', 'Basic', 'Plus', 'Distributor'], required: true },
    { name: 'ContactName', type: 'text' },
    { name: 'Email', type: 'email' },
    { name: 'Phone', type: 'text' },
    { name: 'City', type: 'text' },
    { name: 'Country', type: 'text' },
    { name: 'Status', type: 'enum', enum: ['Active', 'Inactive', 'Suspended'] },
    { name: 'AssignedRepID', type: 'text' },
  ],
  primaryKey: 'PartnerID',
  seedData: [
    { PartnerID: 'P-001', CompanyName: 'Barbershop Elite Berlin', TierKey: 'Stand', ContactName: 'Hans Mueller', Email: 'hans@elite-barber.de', Phone: '+49301234567', City: 'Berlin', Country: 'Germany', Status: 'Active', AssignedRepID: 'REP-001' },
    { PartnerID: 'P-002', CompanyName: 'Salon Moderne Paris', TierKey: 'Plus', ContactName: 'Marie Dubois', Email: 'marie@salon-moderne.fr', Phone: '+33142345678', City: 'Paris', Country: 'France', Status: 'Active', AssignedRepID: 'REP-001' },
  ],
};

export const QUOTES_SCHEMA: SheetSchema = {
  name: 'Quotes',
  description: 'Sales quotes and proposals',
  columns: [
    { name: 'QuoteID', type: 'text', required: true },
    { name: 'PartnerID', type: 'text', required: true },
    { name: 'QuoteDate', type: 'date', required: true },
    { name: 'ValidUntil', type: 'date', required: true },
    { name: 'Status', type: 'enum', enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'], required: true },
    { name: 'TotalNet_EUR', type: 'currency' },
    { name: 'TotalInc_EUR', type: 'currency' },
    { name: 'RepID', type: 'text' },
    { name: 'Notes', type: 'text' },
  ],
  primaryKey: 'QuoteID',
  seedData: [],
};

export const QUOTE_LINES_SCHEMA: SheetSchema = {
  name: 'QuoteLines',
  description: 'Line items within quotes',
  columns: [
    { name: 'LineID', type: 'text', required: true },
    { name: 'QuoteID', type: 'text', required: true },
    { name: 'SKU', type: 'text', required: true },
    { name: 'Quantity', type: 'number', required: true },
    { name: 'UnitPriceNet_EUR', type: 'currency', required: true },
    { name: 'LineTotal_EUR', type: 'currency' },
    { name: 'DiscountPct', type: 'number' },
  ],
  primaryKey: 'LineID',
  seedData: [],
};

export const ORDERS_SCHEMA: SheetSchema = {
  name: 'Orders',
  description: 'Confirmed customer orders',
  columns: [
    { name: 'OrderID', type: 'text', required: true },
    { name: 'QuoteID', type: 'text' },
    { name: 'PartnerID', type: 'text', required: true },
    { name: 'OrderDate', type: 'date', required: true },
    { name: 'Status', type: 'enum', enum: ['Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'], required: true },
    { name: 'PaymentStatus', type: 'enum', enum: ['Pending', 'Partial', 'Paid', 'Refunded'] },
    { name: 'TotalNet_EUR', type: 'currency' },
    { name: 'TotalInc_EUR', type: 'currency' },
    { name: 'RepID', type: 'text' },
  ],
  primaryKey: 'OrderID',
  seedData: [],
};

export const ORDER_LINES_SCHEMA: SheetSchema = {
  name: 'OrderLines',
  description: 'Line items within orders',
  columns: [
    { name: 'LineID', type: 'text', required: true },
    { name: 'OrderID', type: 'text', required: true },
    { name: 'SKU', type: 'text', required: true },
    { name: 'Quantity', type: 'number', required: true },
    { name: 'UnitPriceNet_EUR', type: 'currency', required: true },
    { name: 'LineTotal_EUR', type: 'currency' },
  ],
  primaryKey: 'LineID',
  seedData: [],
};

export const INVOICES_SCHEMA: SheetSchema = {
  name: 'Invoices',
  description: 'Billing invoices',
  columns: [
    { name: 'InvoiceID', type: 'text', required: true },
    { name: 'OrderID', type: 'text', required: true },
    { name: 'InvoiceDate', type: 'date', required: true },
    { name: 'DueDate', type: 'date' },
    { name: 'Status', type: 'enum', enum: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'] },
    { name: 'TotalNet_EUR', type: 'currency' },
    { name: 'TotalInc_EUR', type: 'currency' },
    { name: 'PDFUrl', type: 'url' },
  ],
  primaryKey: 'InvoiceID',
  seedData: [],
};

//=============================================================================
// COMMISSION & LOYALTY SCHEMAS
//=============================================================================

export const COMMISSION_RULES_SCHEMA: SheetSchema = {
  name: 'Commission_Rules',
  description: 'Commission calculation rules and tier configurations',
  columns: [
    { name: 'RuleID', type: 'text', required: true },
    { name: 'TierKey', type: 'text', required: true },
    { name: 'CommissionPct', type: 'number', required: true },
    { name: 'TargetMultiplier', type: 'number' },
    { name: 'MonthlyTargetRevenue_EUR', type: 'currency' },
    { name: 'MonthlyTargetDeals', type: 'number' },
  ],
  primaryKey: 'RuleID',
  seedData: [
    { RuleID: 'CR-001', TierKey: 'Stand', CommissionPct: 7, TargetMultiplier: 1.2, MonthlyTargetRevenue_EUR: 50000, MonthlyTargetDeals: 20 },
    { RuleID: 'CR-002', TierKey: 'Basic', CommissionPct: 5, TargetMultiplier: 1.2, MonthlyTargetRevenue_EUR: 50000, MonthlyTargetDeals: 20 },
    { RuleID: 'CR-003', TierKey: 'Plus', CommissionPct: 4, TargetMultiplier: 1.2, MonthlyTargetRevenue_EUR: 50000, MonthlyTargetDeals: 20 },
    { RuleID: 'CR-004', TierKey: 'Distributor', CommissionPct: 3, TargetMultiplier: 1.2, MonthlyTargetRevenue_EUR: 50000, MonthlyTargetDeals: 20 },
  ],
};

export const COMMISSION_LEDGER_SCHEMA: SheetSchema = {
  name: 'Commission_Ledger',
  description: 'Commission transaction history',
  columns: [
    { name: 'LedgerID', type: 'text', required: true },
    { name: 'RepID', type: 'text', required: true },
    { name: 'OrderID', type: 'text' },
    { name: 'QuoteID', type: 'text' },
    { name: 'TransactionDate', type: 'date', required: true },
    { name: 'NetAmount_EUR', type: 'currency', required: true },
    { name: 'CommissionPct', type: 'number', required: true },
    { name: 'CommissionEarned_EUR', type: 'currency' },
    { name: 'MonthlyTargetMet', type: 'boolean' },
    { name: 'Multiplier', type: 'number' },
    { name: 'PaymentStage', type: 'enum', enum: ['Stage1_50pct', 'Stage2_100pct'] },
    { name: 'Status', type: 'enum', enum: ['Pending', 'Approved', 'Paid'] },
  ],
  primaryKey: 'LedgerID',
  seedData: [],
};

export const LOYALTY_LEDGER_SCHEMA: SheetSchema = {
  name: 'Loyalty_Ledger',
  description: 'Partner loyalty points transactions',
  columns: [
    { name: 'TransactionID', type: 'text', required: true },
    { name: 'PartnerID', type: 'text', required: true },
    { name: 'OrderID', type: 'text' },
    { name: 'TransactionDate', type: 'date', required: true },
    { name: 'PointsEarned', type: 'number' },
    { name: 'PointsRedeemed', type: 'number' },
    { name: 'BalanceAfter', type: 'number' },
    { name: 'Description', type: 'text' },
  ],
  primaryKey: 'TransactionID',
  seedData: [],
};

//=============================================================================
// STAND MANAGEMENT SCHEMAS
//=============================================================================

export const STANDS_SCHEMA: SheetSchema = {
  name: 'Stands',
  description: 'Physical stand/kiosk locations',
  columns: [
    { name: 'StandID', type: 'text', required: true },
    { name: 'StandName', type: 'text', required: true },
    { name: 'PartnerID', type: 'text' },
    { name: 'Address', type: 'text' },
    { name: 'City', type: 'text' },
    { name: 'PostalCode', type: 'text' },
    { name: 'GPS_Lat', type: 'number' },
    { name: 'GPS_Lng', type: 'number' },
    { name: 'Status', type: 'enum', enum: ['Active', 'Inactive', 'Planned'] },
    { name: 'QRCode', type: 'text' },
  ],
  primaryKey: 'StandID',
  seedData: [
    { StandID: 'ST-001', StandName: 'Berlin Mitte Mall', PartnerID: 'P-001', Address: 'Alexanderplatz 1', City: 'Berlin', PostalCode: '10178', GPS_Lat: 52.5200, GPS_Lng: 13.4050, Status: 'Active' },
  ],
};

export const STAND_INVENTORY_SCHEMA: SheetSchema = {
  name: 'Stand_Inventory',
  description: 'Current inventory at each stand',
  columns: [
    { name: 'InventoryID', type: 'text', required: true },
    { name: 'StandID', type: 'text', required: true },
    { name: 'SKU', type: 'text', required: true },
    { name: 'CurrentQty', type: 'number', required: true },
    { name: 'MinLevel', type: 'number' },
    { name: 'MaxLevel', type: 'number' },
    { name: 'LastUpdated', type: 'date' },
  ],
  primaryKey: 'InventoryID',
  seedData: [],
};

export const STAND_VISITS_SCHEMA: SheetSchema = {
  name: 'Stand_Visits',
  description: 'Field rep visit logs for stands',
  columns: [
    { name: 'VisitID', type: 'text', required: true },
    { name: 'StandID', type: 'text', required: true },
    { name: 'RepID', type: 'text', required: true },
    { name: 'VisitDate', type: 'date', required: true },
    { name: 'CheckInTime', type: 'text' },
    { name: 'CheckOutTime', type: 'text' },
    { name: 'Notes', type: 'text' },
    { name: 'PhotoUrls', type: 'text' },
  ],
  primaryKey: 'VisitID',
  seedData: [],
};

export const STAND_CONTRACTS_SCHEMA: SheetSchema = {
  name: 'Stand_Contracts',
  description: 'Stand partner contracts and agreements',
  columns: [
    { name: 'ContractID', type: 'text', required: true },
    { name: 'StandID', type: 'text', required: true },
    { name: 'ContractType', type: 'enum', enum: ['Consignment', 'Fixed', 'Revenue_Share'], required: true },
    { name: 'StartDate', type: 'date', required: true },
    { name: 'EndDate', type: 'date' },
    { name: 'MonthlyFee_EUR', type: 'currency' },
    { name: 'RevSharePct', type: 'number' },
    { name: 'MinCommitment_EUR', type: 'currency' },
    { name: 'Status', type: 'enum', enum: ['Draft', 'Active', 'Expired', 'Cancelled'], required: true },
    { name: 'SignedBy', type: 'text' },
    { name: 'SignedTS', type: 'date' },
    { name: 'DocumentURL', type: 'url' },
    { name: 'Notes', type: 'text' },
  ],
  primaryKey: 'ContractID',
  seedData: [],
};

export const STAND_INVOICES_SCHEMA: SheetSchema = {
  name: 'Stand_Invoices',
  description: 'Stand partner invoices and billing',
  columns: [
    { name: 'InvoiceID', type: 'text', required: true },
    { name: 'InvoiceNumber', type: 'text', required: true },
    { name: 'StandID', type: 'text', required: true },
    { name: 'InvoiceDate', type: 'date', required: true },
    { name: 'DueDate', type: 'date' },
    { name: 'Total', type: 'currency', required: true },
    { name: 'Status', type: 'enum', enum: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'], required: true },
    { name: 'PaidDate', type: 'date' },
    { name: 'PaymentMethod', type: 'text' },
    { name: 'LinesJSON', type: 'text' },
    { name: 'DocumentURL', type: 'url' },
    { name: 'Notes', type: 'text' },
  ],
  primaryKey: 'InvoiceID',
  seedData: [],
};

export const STAND_RETURNS_SCHEMA: SheetSchema = {
  name: 'Stand_Returns',
  description: 'Product returns from stands',
  columns: [
    { name: 'ReturnID', type: 'text', required: true },
    { name: 'StandID', type: 'text', required: true },
    { name: 'ReturnDate', type: 'date', required: true },
    { name: 'Reason', type: 'text' },
    { name: 'SKU', type: 'text', required: true },
    { name: 'Quantity', type: 'number', required: true },
    { name: 'RefundAmount', type: 'currency', required: true },
    { name: 'Status', type: 'enum', enum: ['Pending', 'Approved', 'Rejected', 'Completed'], required: true },
    { name: 'ProcessedBy', type: 'text' },
    { name: 'ProcessedTS', type: 'date' },
    { name: 'Notes', type: 'text' },
  ],
  primaryKey: 'ReturnID',
  seedData: [],
};

export const STAND_BUNDLES_SCHEMA: SheetSchema = {
  name: 'Stand_Bundles',
  description: 'Custom product bundles for stands',
  columns: [
    { name: 'BundleID', type: 'text', required: true },
    { name: 'StandID', type: 'text', required: true },
    { name: 'BundleName', type: 'text', required: true },
    { name: 'SKUsJSON', type: 'text', required: true },
    { name: 'BundlePrice', type: 'currency', required: true },
    { name: 'RegularPrice', type: 'currency' },
    { name: 'Active', type: 'boolean', required: true },
    { name: 'StartDate', type: 'date' },
    { name: 'EndDate', type: 'date' },
    { name: 'CreatedTS', type: 'date', required: true },
    { name: 'Description', type: 'text' },
  ],
  primaryKey: 'BundleID',
  seedData: [],
};

export const STAND_SHIPMENTS_SCHEMA: SheetSchema = {
  name: 'Stand_Shipments',
  description: 'Shipments to stands',
  columns: [
    { name: 'ShipmentID', type: 'text', required: true },
    { name: 'StandID', type: 'text', required: true },
    { name: 'ShipDate', type: 'date', required: true },
    { name: 'ExpectedDelivery', type: 'date' },
    { name: 'ActualDelivery', type: 'date' },
    { name: 'Carrier', type: 'text' },
    { name: 'TrackingNumber', type: 'text' },
    { name: 'Status', type: 'enum', enum: ['Preparing', 'Dispatched', 'InTransit', 'Delivered', 'Failed'], required: true },
    { name: 'ItemsJSON', type: 'text', required: true },
    { name: 'TotalWeight_g', type: 'number' },
    { name: 'ShippingCost_EUR', type: 'currency' },
    { name: 'Notes', type: 'text' },
  ],
  primaryKey: 'ShipmentID',
  seedData: [],
};

export const STAND_LOYALTY_SCHEMA: SheetSchema = {
  name: 'Stand_Loyalty',
  description: 'Stand partner loyalty points',
  columns: [
    { name: 'EntryID', type: 'text', required: true },
    { name: 'StandID', type: 'text', required: true },
    { name: 'TS', type: 'date', required: true },
    { name: 'TransactionType', type: 'enum', enum: ['Earned', 'Redeemed', 'Adjusted'], required: true },
    { name: 'Points', type: 'number', required: true },
    { name: 'BalanceAfter', type: 'number', required: true },
    { name: 'Reason', type: 'text' },
    { name: 'OrderID', type: 'text' },
    { name: 'ProcessedBy', type: 'text' },
  ],
  primaryKey: 'EntryID',
  seedData: [],
};

export const STAND_PERFORMANCE_SCHEMA: SheetSchema = {
  name: 'Stand_Performance',
  description: 'Stand performance metrics and KPIs',
  columns: [
    { name: 'RecordID', type: 'text', required: true },
    { name: 'StandID', type: 'text', required: true },
    { name: 'Period', type: 'text', required: true },
    { name: 'RevenueGross_EUR', type: 'currency' },
    { name: 'RevenueNet_EUR', type: 'currency' },
    { name: 'UnitsSold', type: 'number' },
    { name: 'Transactions', type: 'number' },
    { name: 'AvgTransactionValue_EUR', type: 'currency' },
    { name: 'InventoryTurnover', type: 'number' },
    { name: 'StockoutRate_Pct', type: 'number' },
    { name: 'ReturnRate_Pct', type: 'number' },
    { name: 'CustomerSatisfaction', type: 'number' },
    { name: 'TopSKU', type: 'text' },
    { name: 'WorstSKU', type: 'text' },
    { name: 'FootTraffic', type: 'number' },
    { name: 'ConversionRate_Pct', type: 'number' },
    { name: 'LoyaltyPointsEarned', type: 'number' },
    { name: 'LoyaltyPointsRedeemed', type: 'number' },
    { name: 'NewCustomers', type: 'number' },
    { name: 'ReturningCustomers', type: 'number' },
    { name: 'HealthScore', type: 'number' },
    { name: 'Notes', type: 'text' },
  ],
  primaryKey: 'RecordID',
  seedData: [],
};

export const STAND_ACTIVITY_SCHEMA: SheetSchema = {
  name: 'Stand_Activity',
  description: 'Activity log for all stand operations',
  columns: [
    { name: 'ActivityID', type: 'text', required: true },
    { name: 'StandID', type: 'text', required: true },
    { name: 'TS', type: 'date', required: true },
    { name: 'ActivityType', type: 'text', required: true },
    { name: 'Actor', type: 'text' },
    { name: 'EntityID', type: 'text' },
    { name: 'Description', type: 'text' },
    { name: 'MetadataJSON', type: 'text' },
    { name: 'IPAddress', type: 'text' },
  ],
  primaryKey: 'ActivityID',
  seedData: [],
};

export const STAND_PARTNER_ACCESS_SCHEMA: SheetSchema = {
  name: 'Stand_Partner_Access',
  description: 'Partner access credentials for stand management',
  columns: [
    { name: 'AccessID', type: 'text', required: true },
    { name: 'StandID', type: 'text', required: true },
    { name: 'PartnerEmail', type: 'email', required: true },
    { name: 'PartnerName', type: 'text', required: true },
    { name: 'AccessLevel', type: 'enum', enum: ['Admin', 'Manager', 'ViewOnly'], required: true },
    { name: 'Status', type: 'enum', enum: ['Active', 'Suspended', 'Revoked'], required: true },
    { name: 'CreatedTS', type: 'date', required: true },
    { name: 'LastLogin', type: 'date' },
    { name: 'Phone', type: 'text' },
  ],
  primaryKey: 'AccessID',
  seedData: [],
};

export const STAND_DOC_TEMPLATES_SCHEMA: SheetSchema = {
  name: 'Stand_DocTemplates',
  description: 'Document templates for contracts, agreements, and invoices',
  columns: [
    { name: 'TemplateID', type: 'text', required: true },
    { name: 'TemplateType', type: 'enum', enum: ['Contract', 'Agreement', 'Invoice', 'Receipt', 'Letter'], required: true },
    { name: 'TemplateName', type: 'text', required: true },
    { name: 'Language', type: 'enum', enum: ['EN', 'AR'], required: true },
    { name: 'ContentHTML', type: 'text', required: true },
    { name: 'Variables', type: 'text', required: true },
    { name: 'Active', type: 'boolean', required: true },
    { name: 'CreatedTS', type: 'date', required: true },
    { name: 'UpdatedTS', type: 'date' },
    { name: 'UpdatedBy', type: 'text' },
    { name: 'Notes', type: 'text' },
  ],
  primaryKey: 'TemplateID',
  seedData: [
    {
      TemplateID: 'TPL_CONTRACT_EN_001',
      TemplateType: 'Contract',
      TemplateName: 'Standard Stand Partnership Contract (EN)',
      Language: 'EN',
      ContentHTML: '<div class="contract"><h1>Stand Partnership Agreement</h1><p>This agreement is made on {{date}} between MH Trading and {{partnerName}}.</p><h2>Terms and Conditions</h2><p>Contract Type: {{contractType}}</p><p>Duration: {{startDate}} to {{endDate}}</p><p>Monthly Fee: {{monthlyFee}} EUR</p><p>Revenue Share: {{revSharePct}}%</p><h2>Signatures</h2><p>Signed by: {{signedBy}}</p><p>Date: {{signedDate}}</p></div>',
      Variables: '["date", "partnerName", "contractType", "startDate", "endDate", "monthlyFee", "revSharePct", "signedBy", "signedDate"]',
      Active: true,
      CreatedTS: new Date('2025-11-17'),
      Notes: 'Standard EN contract template',
    },
    {
      TemplateID: 'TPL_CONTRACT_AR_001',
      TemplateType: 'Contract',
      TemplateName: 'عقد شراكة الموقف القياسي (AR)',
      Language: 'AR',
      ContentHTML: '<div class="contract" dir="rtl"><h1>اتفاقية شراكة الموقف</h1><p>تم إبرام هذا الاتفاق في {{date}} بين MH Trading و {{partnerName}}.</p><h2>الشروط والأحكام</h2><p>نوع العقد: {{contractType}}</p><p>المدة: من {{startDate}} إلى {{endDate}}</p><p>الرسوم الشهرية: {{monthlyFee}} يورو</p><p>حصة الإيرادات: {{revSharePct}}%</p><h2>التوقيعات</h2><p>وقع من قبل: {{signedBy}}</p><p>التاريخ: {{signedDate}}</p></div>',
      Variables: '["date", "partnerName", "contractType", "startDate", "endDate", "monthlyFee", "revSharePct", "signedBy", "signedDate"]',
      Active: true,
      CreatedTS: new Date('2025-11-17'),
      Notes: 'قالب العقد العربي القياسي',
    },
  ],
};

export const STAND_DOC_TRANSLATIONS_SCHEMA: SheetSchema = {
  name: 'Stand_DocTranslations',
  description: 'Translations for document template variables and labels',
  columns: [
    { name: 'TranslationKey', type: 'text', required: true },
    { name: 'Language', type: 'enum', enum: ['EN', 'AR'], required: true },
    { name: 'TranslationValue', type: 'text', required: true },
    { name: 'Category', type: 'enum', enum: ['Contract', 'Invoice', 'General', 'Legal'], required: true },
    { name: 'Notes', type: 'text' },
  ],
  primaryKey: 'TranslationKey',
  seedData: [
    { TranslationKey: 'doc.header.company', Language: 'EN', TranslationValue: 'MH Trading - HAIROTICMEN', Category: 'General' },
    { TranslationKey: 'doc.header.company', Language: 'AR', TranslationValue: 'MH Trading - HAIROTICMEN', Category: 'General' },
    { TranslationKey: 'doc.footer.legal', Language: 'EN', TranslationValue: 'This document is legally binding', Category: 'Legal' },
    { TranslationKey: 'doc.footer.legal', Language: 'AR', TranslationValue: 'هذه الوثيقة ملزمة قانونياً', Category: 'Legal' },
    { TranslationKey: 'contract.title', Language: 'EN', TranslationValue: 'Stand Partnership Agreement', Category: 'Contract' },
    { TranslationKey: 'contract.title', Language: 'AR', TranslationValue: 'اتفاقية شراكة الموقف', Category: 'Contract' },
    { TranslationKey: 'contract.terms', Language: 'EN', TranslationValue: 'Terms and Conditions', Category: 'Contract' },
    { TranslationKey: 'contract.terms', Language: 'AR', TranslationValue: 'الشروط والأحكام', Category: 'Contract' },
    { TranslationKey: 'invoice.title', Language: 'EN', TranslationValue: 'Invoice', Category: 'Invoice' },
    { TranslationKey: 'invoice.title', Language: 'AR', TranslationValue: 'فاتورة', Category: 'Invoice' },
  ],
};

//=============================================================================
// CRM & TERRITORY SCHEMAS
//=============================================================================

export const LEADS_SCHEMA: SheetSchema = {
  name: 'Leads',
  description: 'Sales leads and prospects',
  columns: [
    { name: 'LeadID', type: 'text', required: true },
    { name: 'CompanyName', type: 'text', required: true },
    { name: 'ContactName', type: 'text' },
    { name: 'Email', type: 'email' },
    { name: 'Phone', type: 'text' },
    { name: 'City', type: 'text' },
    { name: 'Country', type: 'text' },
    { name: 'PostalCode', type: 'text' },
    { name: 'Status', type: 'enum', enum: ['New', 'Contacted', 'Qualified', 'Lost', 'Converted'] },
    { name: 'Source', type: 'text' },
    { name: 'AssignedRepID', type: 'text' },
    { name: 'LeadScore', type: 'number' },
  ],
  primaryKey: 'LeadID',
  seedData: [],
};

export const TERRITORIES_SCHEMA: SheetSchema = {
  name: 'Territories',
  description: 'Sales territory definitions',
  columns: [
    { name: 'TerritoryID', type: 'text', required: true },
    { name: 'TerritoryName', type: 'text', required: true },
    { name: 'RepID', type: 'text' },
    { name: 'Country', type: 'text' },
    { name: 'Cities', type: 'text' },
    { name: 'PostalCodes', type: 'text' },
    { name: 'Status', type: 'enum', enum: ['Active', 'Inactive'] },
  ],
  primaryKey: 'TerritoryID',
  seedData: [
    { TerritoryID: 'T-DE-01', TerritoryName: 'Germany North', RepID: 'REP-001', Country: 'Germany', Cities: 'Berlin,Hamburg,Bremen', Status: 'Active' },
    { TerritoryID: 'T-FR-01', TerritoryName: 'France Central', RepID: 'REP-001', Country: 'France', Cities: 'Paris,Lyon,Marseille', Status: 'Active' },
  ],
};

export const ASSIGNMENT_RULES_SCHEMA: SheetSchema = {
  name: 'Assignment_Rules',
  description: 'Territory assignment automation rules',
  columns: [
    { name: 'RuleID', type: 'text', required: true },
    { name: 'Priority', type: 'number', required: true },
    { name: 'Country', type: 'text' },
    { name: 'City', type: 'text' },
    { name: 'PostalCodePrefix', type: 'text' },
    { name: 'AssignToRepID', type: 'text', required: true },
    { name: 'Active', type: 'boolean' },
  ],
  primaryKey: 'RuleID',
  seedData: [
    { RuleID: 'AR-001', Priority: 1, Country: 'Germany', City: 'Berlin', AssignToRepID: 'REP-001', Active: true },
    { RuleID: 'AR-002', Priority: 2, Country: 'France', City: 'Paris', AssignToRepID: 'REP-001', Active: true },
  ],
};

//=============================================================================
// OPERATIONS & MONITORING SCHEMAS
//=============================================================================

export const OS_HEALTH_SCHEMA: SheetSchema = {
  name: 'OS_Health',
  description: 'System health monitoring and status checks',
  columns: [
    { name: 'CheckTS', type: 'date', required: true },
    { name: 'Component', type: 'text', required: true },
    { name: 'Status', type: 'enum', enum: ['PASS', 'WARN', 'FAIL'], required: true },
    { name: 'Message', type: 'text' },
    { name: 'Details', type: 'text' },
  ],
  seedData: [],
};

export const OS_LOGS_SCHEMA: SheetSchema = {
  name: 'OS_Logs',
  description: 'System operation logs',
  columns: [
    { name: 'Timestamp', type: 'date', required: true },
    { name: 'Level', type: 'enum', enum: ['INFO', 'WARN', 'ERROR'], required: true },
    { name: 'Scope', type: 'text', required: true },
    { name: 'Message', type: 'text', required: true },
    { name: 'Ref', type: 'text' },
  ],
  seedData: [],
};

export const AGENT_PROFILES_SCHEMA: SheetSchema = {
  name: 'Agent_Profiles',
  description: 'AI agent configuration profiles',
  columns: [
    { name: 'AgentID', type: 'text', required: true },
    { name: 'AgentName', type: 'text', required: true },
    { name: 'Role', type: 'text', required: true },
    { name: 'SystemPrompt', type: 'text' },
    { name: 'Model', type: 'text' },
    { name: 'Temperature', type: 'number' },
    { name: 'Active', type: 'boolean' },
  ],
  primaryKey: 'AgentID',
  seedData: [
    { AgentID: 'AGENT-PRICING', AgentName: 'Pricing Analyst', Role: 'pricing_optimization', Model: 'gpt-4', Temperature: 0.3, Active: true },
    { AgentID: 'AGENT-STAND', AgentName: 'Stand Ops Bot', Role: 'stand_operations', Model: 'gpt-4', Temperature: 0.5, Active: true },
    { AgentID: 'AGENT-GROWTH', AgentName: 'Growth Writer', Role: 'outreach_copywriting', Model: 'gpt-4', Temperature: 0.7, Active: true },
  ],
};

export const AI_JOBS_SCHEMA: SheetSchema = {
  name: 'AI_Jobs',
  description: 'AI task queue and execution log',
  columns: [
    { name: 'JobID', type: 'text', required: true },
    { name: 'AgentID', type: 'text', required: true },
    { name: 'TaskType', type: 'text', required: true },
    { name: 'Status', type: 'enum', enum: ['Pending', 'Running', 'Completed', 'Failed'], required: true },
    { name: 'CreatedAt', type: 'date', required: true },
    { name: 'CompletedAt', type: 'date' },
    { name: 'InputData', type: 'text' },
    { name: 'OutputData', type: 'text' },
    { name: 'ErrorMessage', type: 'text' },
  ],
  primaryKey: 'JobID',
  seedData: [],
};

export const EMAIL_QUEUE_SCHEMA: SheetSchema = {
  name: 'Email_Queue',
  description: 'Outbound email queue',
  columns: [
    { name: 'EmailID', type: 'text', required: true },
    { name: 'ToEmail', type: 'email', required: true },
    { name: 'Subject', type: 'text', required: true },
    { name: 'Body', type: 'text' },
    { name: 'Status', type: 'enum', enum: ['Pending', 'Sent', 'Failed', 'Bounced'], required: true },
    { name: 'ScheduledFor', type: 'date' },
    { name: 'SentAt', type: 'date' },
    { name: 'Provider', type: 'enum', enum: ['Nodemailer', 'Brevo', 'Resend'] },
    { name: 'ErrorMessage', type: 'text' },
  ],
  primaryKey: 'EmailID',
  seedData: [],
};

export const OUTREACH_CAMPAIGNS_SCHEMA: SheetSchema = {
  name: 'Outreach_Campaigns',
  description: 'Email marketing campaigns',
  columns: [
    { name: 'CampaignID', type: 'text', required: true },
    { name: 'CampaignName', type: 'text', required: true },
    { name: 'Status', type: 'enum', enum: ['Draft', 'Scheduled', 'Running', 'Completed', 'Paused'], required: true },
    { name: 'TargetSegment', type: 'text' },
    { name: 'ScheduledStart', type: 'date' },
    { name: 'TotalSent', type: 'number' },
    { name: 'TotalOpened', type: 'number' },
    { name: 'TotalClicked', type: 'number' },
  ],
  primaryKey: 'CampaignID',
  seedData: [],
};

//=============================================================================
// SCHEMA REGISTRY
//=============================================================================

export const ALL_SCHEMAS: SheetSchema[] = [
  // Pricing Domain
  PRICING_PARAMS_SCHEMA,
  PARTNER_TIERS_SCHEMA,
  AMAZON_SIZE_TIERS_SCHEMA,
  SHIPPING_MATRIX_DHL_SCHEMA,
  DHL_SURCHARGE_SCHEMA,
  MAP_GUARDRAILS_SCHEMA,
  FINAL_PRICE_LIST_SCHEMA,
  
  // Sales & CRM
  PARTNERS_SCHEMA,
  QUOTES_SCHEMA,
  QUOTE_LINES_SCHEMA,
  ORDERS_SCHEMA,
  ORDER_LINES_SCHEMA,
  INVOICES_SCHEMA,
  
  // Commission & Loyalty
  COMMISSION_RULES_SCHEMA,
  COMMISSION_LEDGER_SCHEMA,
  LOYALTY_LEDGER_SCHEMA,
  
  // Stand Management
  STANDS_SCHEMA,
  STAND_INVENTORY_SCHEMA,
  STAND_VISITS_SCHEMA,
  STAND_CONTRACTS_SCHEMA,
  STAND_INVOICES_SCHEMA,
  STAND_RETURNS_SCHEMA,
  STAND_BUNDLES_SCHEMA,
  STAND_SHIPMENTS_SCHEMA,
  STAND_LOYALTY_SCHEMA,
  STAND_PERFORMANCE_SCHEMA,
  STAND_ACTIVITY_SCHEMA,
  STAND_PARTNER_ACCESS_SCHEMA,
  STAND_DOC_TEMPLATES_SCHEMA,
  STAND_DOC_TRANSLATIONS_SCHEMA,
  
  // CRM & Territory
  LEADS_SCHEMA,
  TERRITORIES_SCHEMA,
  ASSIGNMENT_RULES_SCHEMA,
  
  // Operations
  OS_HEALTH_SCHEMA,
  OS_LOGS_SCHEMA,
  AGENT_PROFILES_SCHEMA,
  AI_JOBS_SCHEMA,
  EMAIL_QUEUE_SCHEMA,
  OUTREACH_CAMPAIGNS_SCHEMA,
];
