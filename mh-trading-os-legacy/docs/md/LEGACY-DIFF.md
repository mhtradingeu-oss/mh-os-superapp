# G3 Legacy Diff Report

**Timestamp:** 2025-11-17T14:44:17.887Z

**Legacy Sheet ID:** 1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0

**Legacy Sheets:** 121
**New Schema Sheets:** 21

## Summary

- ✅ Sheets existing in both: 7
- ❌ New sheets not in legacy: 14
- 🗑️ Orphaned legacy sheets: 114

## Detailed Comparison

### FinalPriceList

**Status:** ✅ Exists in legacy as "FinalPriceList"

**Columns:** 31 (new) vs 94 (legacy)

**Matching columns (31):** SKU, Name, Category, Brand, Barcode, Status, Factory_Cost_EUR, Packaging_Cost_EUR, Freight_kg_EUR, Import_Duty_Pct, Overhead_Pct, COGS_EUR, Weight_g, Dims_cm, VAT%, UVP_Recommended, UVP, MAP, AutoPriceFlag, Price_Web, Price_Amazon, Price_Salon, Net_Dealer_Basic, Net_Dealer_Plus, Net_Stand, Net_Distributor, Competitor_Min, Competitor_Median, Pricing_Version, QRUrl, Notes

**➕ Extra in legacy (63):**
- Shipping_Inbound_per_unit
- EPR_LUCID_per_unit
- GS1_per_unit
- Retail_Packaging_per_unit
- QC_PIF_per_unit
- Operations_per_unit
- Marketing_per_unit
- FullCost_EUR
- FactoryPriceUnit_Manual
- TotalFactoryPriceCarton
- UnitsPerCarton
- FX_BufferPct
- Content_ml
- Net_Content_ml
- Grundpreis
- Grundpreis_Net
- Grundpreis_Unit
- Amazon_TierKey
- Line
- Manual_UVP_Inc
- UVP_Net
- UVP_Inc
- UVP_Inc_99
- UVP_vs_Floor_Flag
- Guardrail_OwnStore_Inc
- Guardrail_Amazon_FBM_Inc
- Guardrail_Amazon_FBA_Inc
- Box_Size
- Box_Cost_Per_Unit
- Gift_Cost_Expected_Unit
- Grundpreis_Inc_Per_L
- Pricing_Engine_Version
- Shipping_Actual_Kg
- Shipping_Volumetric_Kg
- Shipping_Chargeable_Kg
- Shipping_CarrierID
- ShipCost_per_Unit_OwnStore
- ShipCost_per_Unit_FBM
- ShipCost_per_Unit_FBA
- ShipCost_per_Unit_B2B
- Ad_Pct
- Returns_Pct
- Loyalty_Pct
- Payment_Pct
- Amazon_Referral_Pct
- DHL_WeightBand
- DHL_Zone
- Gift_SKU
- Gift_SKU_Cost
- Gift_Attach_Rate
- Gift_Funding_Pct
- Gift_Shipping_Increment
- PostChannel_Margin_Pct
- Floor_B2C_Net
- Guardrail_OK
- Carton_L_cm
- Carton_W_cm
- Carton_H_cm
- Carton_Weight_g
- Carton_Cost_EUR
- Unit_From_Carton_Cost
- Carton_UVP_Inc_99
- Carton_Discount_Pct

### Products

**Status:** ❌ Does not exist in legacy (new sheet)

### Enums

**Status:** ✅ Exists in legacy as "Enums"

**Columns:** 5 (new) vs 13 (legacy)

**Matching columns (5):** List, Key, Label, Sort, Active

**➕ Extra in legacy (8):**
- Categories
- Subcategories
- Enum
- Value
- Description
- SortOrder
- Color
- Icon

### Packaging_Catalog

**Status:** ❌ Does not exist in legacy (new sheet)

### Shipping_Carriers

**Status:** ❌ Does not exist in legacy (new sheet)

### Shipping_WeightBands

**Status:** ✅ Exists in legacy as "ShippingWeightBands"

**Columns:** 7 (new) vs 16 (legacy)

**Matching columns (3):** CarrierID, Zone, Active

**❌ Missing in legacy (4):**
- BandID
- MinWeight_g
- MaxWeight_g
- CostEUR

**➕ Extra in legacy (10):**
- serviceLevel
- minKg
- maxKg
- baseEur
- fuelPct
- ServiceLevel
- Weight_Min_g
- Weight_Max_g
- Base_Rate_EUR
- Fuel_Surcharge_Pct

**🔄 Transformations needed (3):**
- Rename: "carrierId" → "CarrierID"
- Rename: "zone" → "Zone"
- Rename: "active" → "Active"

### Shipping_Costs_Fixed

**Status:** ✅ Exists in legacy as "ShippingCostsFixed"

**Columns:** 11 (new) vs 8 (legacy)

**Matching columns (1):** Notes

**❌ Missing in legacy (10):**
- RuleID
- CarrierID
- Zone
- PartnerTier
- MinOrderEUR
- MaxOrderEUR
- ShippingCostEUR
- FreeShipping
- Priority
- Active

**➕ Extra in legacy (6):**
- costType
- channel
- costEur
- CostType
- Channel
- Cost_EUR

**🔄 Transformations needed (1):**
- Rename: "notes" → "Notes"

### CRM_Leads

**Status:** ✅ Exists in legacy as "CRM_Leads"

**Columns:** 16 (new) vs 21 (legacy)

**Matching columns (10):** LeadID, Source, Name, Email, Phone, Address, City, Status, Score, Notes

**❌ Missing in legacy (6):**
- Company
- PostalCode
- Country
- AssignedTo
- CreatedDate
- LastContactDate

**➕ Extra in legacy (11):**
- CreatedTS
- Keyword
- Postal
- CountryCode
- Category
- Website
- Lat
- Lng
- Owner
- TierHint
- LastTouchTS

### CRM_Accounts

**Status:** ❌ Does not exist in legacy (new sheet)

### CRM_Activities

**Status:** ❌ Does not exist in legacy (new sheet)

### AI_Crew_Queue

**Status:** ❌ Does not exist in legacy (new sheet)

### AI_Crew_Drafts

**Status:** ❌ Does not exist in legacy (new sheet)

### AI_Crew_Logs

**Status:** ❌ Does not exist in legacy (new sheet)

### Dev_Tasks

**Status:** ❌ Does not exist in legacy (new sheet)

### Site_Inventory

**Status:** ❌ Does not exist in legacy (new sheet)

### Plugin_Registry

**Status:** ❌ Does not exist in legacy (new sheet)

### SEO_Tech_Backlog

**Status:** ❌ Does not exist in legacy (new sheet)

### Integrations

**Status:** ❌ Does not exist in legacy (new sheet)

### _README

**Status:** ✅ Exists in legacy as "README"

**Columns:** 4 (new) vs 0 (legacy)

**❌ Missing in legacy (4):**
- Section
- Title
- Content
- UpdatedDate

### _SETTINGS

**Status:** ✅ Exists in legacy as "Settings"

**Columns:** 5 (new) vs 5 (legacy)

**Matching columns (5):** Key, Value, Description, Category, LastModified

### _LOGS

**Status:** ❌ Does not exist in legacy (new sheet)

## 🗑️ Orphaned Legacy Sheets

These sheets exist in legacy but not in the new schema:

- AffiliateProfiles
- AffiliateClicks
- AffiliateConversions
- AffiliateCandidates
- AffiliateTasks
- Backup_Snapshot
- Pricing_Params
- CompetitorPrices
- PartnerTiers
- PartnerRegistry
- StandSites
- Stand_Inventory
- Stand_Refill_Plans
- Stand_Visits
- Stand_KPIs
- AuthorizedAssortment
- StarterBundles
- RefillPlans
- Quotes
- QuoteLines
- Orders
- OrderLines
- Commission_Ledger
- Loyalty_Ledger
- DHL_Rates
- DHL_Tariffs
- Shipments_DHL
- MAP_Guardrails
- Pricing_Suggestions
- Pricing_Suggestions_Draft
- Sales_Suggestions_Draft
- Outreach_Drafts
- OS_Logs
- OS_Health
- AI_Playbooks
- AI_Tasks
- Sync_Queue
- AI_Inbox
- AI_Outbox
- AI_Crew
- Bundles
- Gifts_Bank
- Salon_Subscriptions
- Subscription_Invoices
- Commission_Rules
- Email_Queue
- Audit_Trail
- Shipping_Methods
- Shipping_Rules
- Packaging_Boxes
- Shipment_Labels
- Shipments
- Lead_Touches
- Territories
- Assignment_Rules
- Enrichment_Queue
- Dedupe_Index
- Outreach_Campaigns
- Outreach_Sequences
- Outreach_Templates
- Outreach_Contacts
- Outreach_Recipients
- Outreach_Sends
- Suppression_List
- Email_Stats
- Unsubscribes
- Bounce_Events
- Complaint_Events
- SEO_Pages
- Ads_Keywords
- Ads_Campaigns
- Ads_AdGroups
- Ads_Creatives
- Ads_Exports
- Ads_KPIs
- Social_Calendar
- Social_Assets
- Social_Metrics
- UTM_Builder
- Link_Shortener
- AI_Agents_Log
- SEO_Briefs
- SEO_Audits
- SEO_Keywords
- Channels
- AmazonSizeTiers
- ShippingMatrix_DHL
- DHL_Surcharges
- QuantityDiscounts
- DiscountCaps
- OrderDiscounts
- Pricing_Line_Targets
- ShippingMatrixDHL
- DHLSurcharge
- Partners
- Invoices
- Stands
- Leads
- Agent_Profiles
- AI_Jobs
- Admin_PowerMenu
- Validation_Log
- AffiliateDiscoveryLog
- Stand_Contracts
- Stand_Invoices
- Stand_Returns
- Stand_Bundles
- Stand_Shipments
- Stand_Loyalty
- Stand_Performance
- Stand_Activity
- Stand_Partner_Access
- Stand_DocTemplates
- Stand_DocTranslations

## Migration Recommendations

1. **New sheets:** These are intentional additions to the new schema
2. **Missing columns:** May need to be added to legacy data or marked as optional
3. **Extra columns:** Review if data should be migrated to new columns or archived
4. **Transformations:** Column renames - data can be mapped directly
5. **Orphaned sheets:** Review if any data should be migrated to new schema

⚠️ **Important:** This is a READ-ONLY scan. No changes have been made to the legacy sheet.
