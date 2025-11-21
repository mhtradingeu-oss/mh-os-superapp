# MH Trading OS - Sheets Structure Report

**Generated**: 2025-11-10T00:42:08.940Z

This report shows the current structure of all Google Sheets worksheets, including headers, sample data, and validation warnings.

---

## 📄 Settings

**Total Rows**: 160

### Headers

```
Key | Value | Notes | Description | Category | LastModified
```

### Sample Data (First 3 Rows)

| Key | Value | Notes | Description | Category | LastModified |
|---|---|---|---|---|---|
| AFFILIATE_COOKIE_DAYS | 30 | Attribution window (days) | - | - | - |
| AFFILIATE_DEFAULT_RATE_PCT | 5 | Default affiliate rate % (n... | - | - | - |
| AFFILIATE_ENABLE | TRUE | Enable affiliate tracking | - | - | - |

---

## 📄 Pricing_Params

**Total Rows**: 128

### Headers

```
Param | Value | Notes | ParamKey | Unit | Category | Type | AppliesTo
```

### Sample Data (First 3 Rows)

| Param | Value | Notes | ParamKey | Unit | Category | Type | AppliesTo |
|---|---|---|---|---|---|---|---|
| - | 2.50 | Default freight cost per ki... | DEFAULT_FREIGHT_KG_EUR | EUR/kg | Cost | currency | all |
| - | 6.5 | Default import duty percent... | IMPORT_DUTY_PCT_DEFAULT | % | Cost | percentage | all |
| - | 8 | Default overhead percentage... | OVERHEAD_PCT_DEFAULT | % | Cost | percentage | all |

---

## 📄 FinalPriceList

**Total Rows**: 91

### Headers

```
SKU | Name | UVP | VAT% | Weight_g | Barcode | Category | Status | COGS_EUR | AutoPriceFlag | UVP_Recommended | MAP | Price_Web | Price_Amazon | Price_Salon | Net_Dealer_Basic | Net_Dealer_Plus | Net_Stand | Net_Distributor | Competitor_Min | Competitor_Median | Pricing_Version | QR_URL | Brand | Factory_Cost_EUR | Packaging_Cost_EUR | Freight_kg_EUR | Import_Duty_Pct | Overhead_Pct | Dims_cm | QRUrl | Notes
```

### Sample Data (First 3 Rows)

| SKU | Name | UVP | VAT% | Weight_g | Barcode | Category | Status | COGS_EUR | AutoPriceFlag | UVP_Recommended | MAP | Price_Web | Price_Amazon | Price_Salon | Net_Dealer_Basic | Net_Dealer_Plus | Net_Stand | Net_Distributor | Competitor_Min | Competitor_Median | Pricing_Version | QR_URL | Brand | Factory_Cost_EUR | Packaging_Cost_EUR | Freight_kg_EUR | Import_Duty_Pct | Overhead_Pct | Dims_cm | QRUrl | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HM-BC-K-50-001 | HAIROTICMEN Bartpflege‑Set ... | 39.49 | 0.19 | 595 | 6291108193648 | Beard Care | Active | €13.58 | TRUE | 39.49 | 34.49 | 39.49 | 46.46 | 39.49 | 35.54 | 34.49 | 35.54 | 34.49 | - | - | 2025-11-10T00:19:20.044Z | - | - | - | - | - | - | - | - | - | - |
| HM-BC-K-50-002 | HAIROTICMEN Bartpflege‑Set ... | 26.49 | 0.19 | 385 | 6291109760504 | Beard Care | Active | €8.33 | TRUE | 26.49 | 21.49 | 26.49 | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - | - |
| HM-BC-BO-50-003 | HAIROTICMEN Bartöl Magnet B... | 16.49 | 0.19 | 80 | 6291108190364 | Beard Care | Active | €5.33 | TRUE | 16.49 | 11.48 | 16.49 | 19.4 | 16.49 | 14.84 | 13.19 | 14.84 | 14.01 | - | - | 2025-11-10T00:31:39.018Z | - | - | - | - | - | - | - | - | - | - |

### ⚠️ Validation Warnings

- Column "COGS_EUR": 89 non-numeric values found (e.g., €13.58, €8.33, €5.33)
- Column "Weight_g": 18 non-numeric values found (e.g., 1,200, 1,200, 1,200)

---

## 📄 CompetitorPrices

**Total Rows**: 7

### Headers

```
SKU | Competitor | URL | Price | Currency | Country | CollectedAt | CompetitorName | LastChecked | Status
```

### Sample Data (First 3 Rows)

| SKU | Competitor | URL | Price | Currency | Country | CollectedAt | CompetitorName | LastChecked | Status |
|---|---|---|---|---|---|---|---|---|---|
| HM-BB-50 | Amazon.de | https://www.amazon.de/dp/HM... | 12.99 | EUR | DE | 2025-11-09T09:00:00Z | - | - | - |
| HM-BB-50 | Idealo | https://www.idealo.de/preis... | 13.9 | EUR | DE | 2025-11-09T09:00:00Z | - | - | - |
| HM-BB-50 | Flaconi | https://www.flaconi.de/hair... | 14.49 | EUR | DE | 2025-11-09T09:00:00Z | - | - | - |

---

## 📄 PartnerTiers

**Total Rows**: 9

### Headers

```
Tier | DiscountPct | CommissionPct | StandBonusPct | Notes | MinOrderVolume | Benefits | Status
```

### Sample Data (First 3 Rows)

| Tier | DiscountPct | CommissionPct | StandBonusPct | Notes | MinOrderVolume | Benefits | Status |
|---|---|---|---|---|---|---|---|
| Dealer Basic | 0 | 2 | 0 | Entry tier | - | - | - |
| Dealer Plus | 5 | 3 | 0 | Volume-based benefits | - | - | - |
| Stand | 10 | 0 | 5 | Kiosk/stand program bonus 5% | - | - | - |

---

## 📄 PartnerRegistry

**Total Rows**: 12

### Headers

```
PartnerID | PartnerName | Tier | Email | Phone | Owner | Status | Street | Postal | City | CountryCode | Notes | PartnerFolderID | PartnerFolderURL | PartnerType
```

### Sample Data (First 3 Rows)

| PartnerID | PartnerName | Tier | Email | Phone | Owner | Status | Street | Postal | City | CountryCode | Notes | PartnerFolderID | PartnerFolderURL | PartnerType |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HMP-0001 | DEMO Salon Berlin | Dealer Basic | salon@example.com | #ERROR! | owner@hairoticmen.de | Active | Friedrichstr. 1 | 10117 | Berlin | DE | Seed demo partner | 1XjTznvC4tAfd-gnygfoFSOCMBj... | https://drive.google.com/dr... | - |
| HMP-0002 | DEMO Distributor DE | Distributor | dist@example.com | #ERROR! | owner@hairoticmen.de | Active | Leopoldstr. 20 | 80802 | München | DE | Seed demo distributor | 1HH6y7t3mzmvGKzYiZZZv1frciI... | https://drive.google.com/dr... | - |
| HMP-0003 | Barberhouse Hamburg | Dealer Plus | hamburg@barberhouse.de | #ERROR! | sales@hairoticmen.de | Active | Spitalerstraße 16 | 20095 | Hamburg | DE | Barbershop chain pilot | - | - | - |

---

## 📄 StandSites

**Total Rows**: 8

### Headers

```
StandID | Salon | Owner | Street | Postal | City | CountryCode | Status | OpenDate | Notes | QR_URL | PartnerID | Location | Address | GooglePlaceID | Lat | Lng | OpenedDate
```

### Sample Data (First 3 Rows)

| StandID | Salon | Owner | Street | Postal | City | CountryCode | Status | OpenDate | Notes | QR_URL | PartnerID | Location | Address | GooglePlaceID | Lat | Lng | OpenedDate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ST-0001 | DEMO Salon Berlin | owner@hairoticmen.de | Friedrichstr. 1 | 10117 | Berlin | DE | Active | 11/9/2025 23:28:53 | Seed stand | - | - | - | - | - | - | - | - |
| ST-0002 | Barberhouse Hamburg | sales@hairoticmen.de | Spitalerstraße 16 | 20095 | Hamburg | DE | Active | 2025-02-10 | Tier: Plus → Stand (upgrade... | - | - | - | - | - | - | - | - |
| ST-0003 | StyleHaus Leipzig | owner@hairoticmen.de | Grimmaische Str. 9 | 4109 | Leipzig | DE | Active | 2025-03-05 | Tier: Pro • RefillThreshold... | - | - | - | - | - | - | - | - |

---

## 📄 Stand_Inventory

**Total Rows**: 0

### Headers

```
StandID | SKU | Qty | LastRefill | NextRefill | Status
```

---

## 📄 Stand_Refill_Plans

**Total Rows**: 0

### Headers

```
PlanID | StandID | SKU | MinQty | RefillQty | Frequency | Status
```

---

## 📄 Stand_Visits

**Total Rows**: 0

### Headers

```
VisitID | StandID | VisitDate | RepName | Notes | PhotoURLs
```

---

## 📄 Stand_KPIs

**Total Rows**: 0

### Headers

```
StandID | Month | Sales | Footfall | ConversionRate | Status
```

---

## 📄 AuthorizedAssortment

**Total Rows**: 16

### Headers

```
PartnerID | SKU | AllowedFlag | MinPrice | Notes | Authorized
```

### Sample Data (First 3 Rows)

| PartnerID | SKU | AllowedFlag | MinPrice | Notes | Authorized |
|---|---|---|---|---|---|
| HMP-0001 | HM-BB-50 | TRUE | 13.9 | Salon Berlin allowed. Publi... | - |
| HMP-0001 | HM-BS-150 | TRUE | 15.9 | Salon Berlin allowed. Publi... | - |
| HMP-0001 | HM-BO-50-MBX | TRUE | 0 | Backbar/MBX items allowed; ... | - |

---

## 📄 StarterBundles

**Total Rows**: 0

### Headers

```
BundleID | Tier | SKU | Qty | Status
```

---

## 📄 RefillPlans

**Total Rows**: 0

### Headers

```
PlanID | PartnerID | SKU | MinQty | RefillQty | Frequency | Status
```

---

## 📄 Quotes

**Total Rows**: 0

### Headers

```
QuoteID | Created | Owner | PartnerID | PartnerName | Contact | Email | Phone | ValidUntil | Currency | SubTotal | Discount | Tax | TotalGross | Status | DealID | RefURL | Notes | QuoteDate | ExpiryDate | Subtotal | DiscountPct | DiscountAmt | VATRate | VATAmt | Total
```

---

## 📄 QuoteLines

**Total Rows**: 0

### Headers

```
QuoteID | Line# | SKU | Name | Qty | UnitPrice | NetUnit | VAT% | LineTotal | LineNum | Discount
```

---

## 📄 Orders

**Total Rows**: 0

### Headers

```
OrderID | Date | Channel | Status | PartnerID | PartnerName | Currency | SubTotal | Discount | Tax | TotalGross | PaymentStatus | QuoteID | DealID | Notes | OrderDate | Subtotal | DiscountAmt | VATAmt | ShippingCost | Total | PaymentMethod | FulfillmentStatus
```

---

## 📄 OrderLines

**Total Rows**: 0

### Headers

```
OrderID | Line# | SKU | Name | Qty | NetUnit | VAT% | LineTotal | FulfillmentStatus | LineNum | UnitPrice | Discount
```

---

## 📄 Commission_Ledger

**Total Rows**: 2

### Headers

```
LedgerID | TS | OrderID | QuoteID | PartnerID | PartnerTier | Type | BaseGross | Rate% | Amount | Owner | Status | Notes | TxID | TxDate | Rate | PaidDate
```

### Sample Data (First 3 Rows)

| LedgerID | TS | OrderID | QuoteID | PartnerID | PartnerTier | Type | BaseGross | Rate% | Amount | Owner | Status | Notes | TxID | TxDate | Rate | PaidDate |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CL-DEMO-1 | 2025-11-09 10:00:00 | OR-DEMO-1 | QT-DEMO-1 | HMP-0001 | Dealer Basic | SalesRep | 1000 | 5 | 50 | sales@hairoticmen.de | Accrued | [AUTO] demo | - | - | - | - |
| CL-DEMO-2 | 2025-11-09 10:00:00 | OR-DEMO-1 | QT-DEMO-1 | HMP-0001 | Dealer Basic | PartnerTier | 1000 | 2 | 20 | - | Accrued | [AUTO] demo | - | - | - | - |

---

## 📄 Loyalty_Ledger

**Total Rows**: 0

### Headers

```
TxID | PartnerID | OrderID | TxDate | Points | Type | Status | Notes
```

---

## 📄 DHL_Rates

**Total Rows**: 7

### Headers

```
Zone | Weight_g_Max | Price | Currency | Notes | EffectiveFrom
```

### Sample Data (First 3 Rows)

| Zone | Weight_g_Max | Price | Currency | Notes | EffectiveFrom |
|---|---|---|---|---|---|
| DE | 1000 | 3.19 | EUR | Kleinpaket (≤1kg) | - |
| DE | 2000 | 5.05 | EUR | Paket bis 2kg | - |
| DE | 3000 | 5.55 | EUR | Paket bis 3kg | - |

---

## 📄 DHL_Tariffs

**Total Rows**: 6

### Headers

```
Zone | WeightMax_g | BasePrice_EUR | Surcharge_EUR | Notes | EffectiveFrom
```

### Sample Data (First 3 Rows)

| Zone | WeightMax_g | BasePrice_EUR | Surcharge_EUR | Notes | EffectiveFrom |
|---|---|---|---|---|---|
| DE | 1000 | 3.19 | 0 | Domestic small | - |
| DE | 2000 | 5.05 | 0 | Domestic 2kg | - |
| DE | 5000 | 6.6 | 0.2 | Fuel/peak surcharge example | - |

---

## 📄 Shipments_DHL

**Total Rows**: 0

### Headers

```
ShipmentID | OrderID | QuoteID | PartnerID | RecipientName | Street | Postal | City | CountryCode | Email | Phone | Weight_g | Packages | ProductCode | Services | COD_Amount | Incoterm | Reference | TrackingNo | LabelUrl | Status | LastTrackTS | Cost | Currency | CreatedTS | CreatedBy | Notes | ManifestID | TrackingNumber | Carrier | Zone | ShippingCost | ShippedDate | DeliveryDate
```

---

## 📄 MAP_Guardrails

**Total Rows**: 18

### Headers

```
TS | SKU | Competitor | URL | Price | MAP | Delta | Status | Notes | RaisedTS | Type | CurrentValue | ThresholdValue | Message
```

### Sample Data (First 3 Rows)

| TS | SKU | Competitor | URL | Price | MAP | Delta | Status | Notes | RaisedTS | Type | CurrentValue | ThresholdValue | Message |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2025-11-09T09:00:00Z | HM-BB-50 | Amazon.de | https://www.amazon.de/dp/HM... | 12.99 | 13.9 | -0.91 | BELOW_MAP | Immediate outreach; auto-ev... | - | - | - | - | - |
| 2025-11-09T09:00:00Z | HM-BB-50 | eBay.de | https://www.ebay.de/itm/395... | 13.49 | 13.9 | -0.41 | REVIEW | Marketplace seller; check i... | - | - | - | - | - |
| 2025-11-09T09:00:00Z | HM-BB-50 | Idealo | https://www.idealo.de/preis... | 13.9 | 13.9 | 0 | OK | Matches MAP. | - | - | - | - | - |

---

## 📄 Pricing_Suggestions

**Total Rows**: 0

### Headers

```
TS | SKU | MedianPrev | MedianCurr | DropPct | SuggestedUVP | Notes | CreatedTS | SuggestedMAP | Reason | Status
```

---

## 📄 OS_Logs

**Total Rows**: 3518

### Headers

```
TS | Level | Scope | Message | Ref | Timestamp
```

### Sample Data (First 3 Rows)

| TS | Level | Scope | Message | Ref | Timestamp |
|---|---|---|---|---|---|
| 2025-11-09T21:58:52.090Z | INFO | Settings | Settings hydrated: 9 ok, 1 ... | - | - |
| 2025-11-09T21:58:52.497Z | WARN | Settings | Missing critical setting: H... | - | - |
| 2025-11-09T21:59:24.476Z | INFO | Settings | Settings hydrated: 9 ok, 1 ... | - | - |

---

## 📄 OS_Health

**Total Rows**: 40

### Headers

```
Check | Status | Detail | Timestamp | CheckTS | Component | Message | Details
```

### Sample Data (First 3 Rows)

| Check | Status | Detail | Timestamp | CheckTS | Component | Message | Details |
|---|---|---|---|---|---|---|---|
| 2025-11-09T22:03:50.704Z | Ensure Sheets | PASS | Sheets: 14 created, 10 cols... | {"sheetsProcessed":47,"shee... | - | - | - |
| 2025-11-09T22:04:38.781Z | Ensure Sheets | PASS | Sheets: 0 created, 0 cols a... | {"sheetsProcessed":47,"shee... | - | - | - |
| 2025-11-09T22:20:55.695Z | Ensure Sheets | PASS | Sheets: 0 created, 0 cols a... | {"sheetsProcessed":47,"shee... | - | - | - |

---

## 📄 AI_Playbooks

**Total Rows**: 7

### Headers

```
PlaybookID | Name | TriggerType | SourceSheet | TargetSheet | PromptTemplate | Owner | ActiveFlag | Notes | Schedule | Description | LastRun | Status
```

### Sample Data (First 3 Rows)

| PlaybookID | Name | TriggerType | SourceSheet | TargetSheet | PromptTemplate | Owner | ActiveFlag | Notes | Schedule | Description | LastRun | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PB-001 | Reprice All | MANUAL | FinalPriceList | Pricing_Suggestions | Reprice by params & MAP | A-PRC-003 | TRUE | - | - | - | - | - |
| PB-003 | Catalog Audit | WEEKLY | FinalPriceList | AI_Outbox | Audit completeness & anomalies | A-PRC-003 | TRUE | - | - | - | - | - |
| PB-005 | Social Calendar 14d | MANUAL | FinalPriceList | Social_Calendar | Plan posts for Beard Care (... | A-SOC-023 | TRUE | - | - | - | - | - |

---

## 📄 AI_Tasks

**Total Rows**: 0

### Headers

```
TaskID | CreatedTS | PlaybookID | AgentID | InputRef | InputJSON | Status | AssignedTS | CompletedTS | OutputRef | OutputJSON | Error | Prompt | Response
```

---

## 📄 Sync_Queue

**Total Rows**: 0

### Headers

```
JobID | TS | Source | Action | RefID | PayloadJSON | Status | Attempts | LastError | QueueID | Integration | Operation | Payload | CreatedTS | ProcessedTS
```

---

## 📄 AI_Inbox

**Total Rows**: 0

### Headers

```
MessageID | TS | From | Channel | Text | AttachedRef | Status
```

---

## 📄 AI_Outbox

**Total Rows**: 0

### Headers

```
MessageID | TS | To | Channel | Text | AttachedRef | Status
```

---

## 📄 Enums

**Total Rows**: 25

### Headers

```
Group | Key | Value | Notes | List | Label | Sort | Active
```

### Sample Data (First 3 Rows)

| Group | Key | Value | Notes | List | Label | Sort | Active |
|---|---|---|---|---|---|---|---|
| - | - | - | - | - | - | - | - |
| - | - | - | - | - | - | - | - |
| - | - | - | - | - | - | - | - |

---

## 📄 Bundles

**Total Rows**: 0

### Headers

```
BundleID | Name | ItemsJSON | Channel | Active | Notes
```

---

## 📄 Gifts_Bank

**Total Rows**: 0

### Headers

```
GiftID | SKU | Threshold_EUR | Channel | Active | Notes
```

---

## 📄 Salon_Subscriptions

**Total Rows**: 0

### Headers

```
SubID | PartnerID | Plan | BillingCycle | Price | DiscountPct | BenefitsJSON | StartTS | Status
```

---

## 📄 Subscription_Invoices

**Total Rows**: 0

### Headers

```
InvoiceID | SubID | PeriodStart | PeriodEnd | Amount | Status | PaidTS | Notes
```

---

## 📄 Affiliate_Programs

**Total Rows**: 0

### Headers

```
AffID | Name | RatePct | CookieDays | Channel | Active
```

---

## 📄 Affiliate_Leads

**Total Rows**: 0

### Headers

```
LeadID | AffID | PartnerID_Email | Source | TS | Status
```

---

## 📄 Commission_Rules

**Total Rows**: 0

### Headers

```
RuleID | Role | Tier | Channel | BaseRatePct | BonusPct | CapPct | Notes
```

---

## 📄 Email_Outbox

**Total Rows**: 0

### Headers

```
MsgID | TS | To | Subject | Template | PayloadJSON | Status | Error
```

---

## 📄 Audit_Trail

**Total Rows**: 0

### Headers

```
TS | Actor | Action | RefType | RefID | DetailJSON
```

---

## 📄 Shipping_Methods

**Total Rows**: 4

### Headers

```
MethodID | MethodName_EN | MethodName_AR | Active | DefaultCostEUR | MinDays | MaxDays | Icon | Description_EN | Description_AR | Notes
```

### Sample Data (First 3 Rows)

| MethodID | MethodName_EN | MethodName_AR | Active | DefaultCostEUR | MinDays | MaxDays | Icon | Description_EN | Description_AR | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| DHL | DHL Express | دي إتش إل اكسبريس | TRUE | 5.9 | 1 | 3 | truck | Fast and reliable courier d... | توصيل سريع وموثوق | Standard DHL courier service |
| PICKUP | Store Pickup | استلام من المتجر | TRUE | 0 | 0 | 1 | store | Pick up your order from our... | استلم طلبك من متجرنا | Free pickup from physical l... |
| COMPANY_CAR | Company Delivery | توصيل الشركة | TRUE | 3 | 1 | 2 | car | Direct delivery by company ... | توصيل مباشر بسيارة الشركة | Own fleet delivery for loca... |

---

## 📄 Shipping_Rules

**Total Rows**: 4

### Headers

```
RuleID | RuleName | MethodID | PartnerTier | PartnerType | MinOrderEUR | MaxOrderEUR | Zone | ShippingCostEUR | FreeShipping | Priority | Active | Notes
```

### Sample Data (First 3 Rows)

| RuleID | RuleName | MethodID | PartnerTier | PartnerType | MinOrderEUR | MaxOrderEUR | Zone | ShippingCostEUR | FreeShipping | Priority | Active | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RULE-FREE-100 | - | FREE | - | All | 100 | - | - | 0 | TRUE | 1 | TRUE | Free shipping for orders ab... |
| RULE-DHL-DE | - | DHL | - | B2C | - | 99.99 | DE | 4.9 | FALSE | 10 | TRUE | Standard DHL for B2C orders... |
| RULE-DHL-EU | - | DHL | - | B2C | - | 99.99 | EU | 7.9 | FALSE | 10 | TRUE | Standard DHL for B2C orders... |

---

## 📄 Packaging_Boxes

**Total Rows**: 4

### Headers

```
BoxID | BoxName_EN | BoxName_AR | Length_cm | Width_cm | Height_cm | Volume_cm3 | MaxWeight_g | CostEUR | Active | InStock | Notes
```

### Sample Data (First 3 Rows)

| BoxID | BoxName_EN | BoxName_AR | Length_cm | Width_cm | Height_cm | Volume_cm3 | MaxWeight_g | CostEUR | Active | InStock | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BOX-S | Small Box | صندوق صغير | 20 | 15 | 10 | 3000 | 2000 | 0.5 | TRUE | 100 | For 1-3 small items |
| BOX-M | Medium Box | صندوق متوسط | 30 | 20 | 15 | 9000 | 5000 | 0.8 | TRUE | 150 | For 4-8 items or larger pro... |
| BOX-L | Large Box | صندوق كبير | 40 | 30 | 20 | 24000 | 10000 | 1.2 | TRUE | 80 | For bulk orders 9-15 items |

---

## 📄 Shipment_Labels

**Total Rows**: 0

### Headers

```
LabelID | ShipmentID | OrderID | GeneratedTS | QRCode | Barcode | LabelPDF_URL | PrintedTS | PrintedBy | Status | Notes
```

---

## 📄 Shipments

**Total Rows**: 0

### Headers

```
ShipmentID | OrderID | PartnerID | CreatedTS | ShippingMethod | Zone | Weight_g | BoxID | BoxCostEUR | PackagingCostEUR | ShippingCostEUR | TotalCostEUR | TrackingNumber | Status | PickupAddress | DeliveryAddress | DriverID | EstimatedDeliveryDate | ActualDeliveryDate | LabelGenerated | LabelPrinted | Notes
```

---

## 📄 CRM_Leads

**Total Rows**: 2

### Headers

```
LeadID | Created | Source | Name | ContactEmail | ContactPhone | Street | Postal | City | Country | Category | Owner | Status | Notes | CreatedTS | Keyword | CountryCode | Phone | Email | Website | Address | Lat | Lng | Score | TierHint | LastTouchTS
```

### Sample Data (First 3 Rows)

| LeadID | Created | Source | Name | ContactEmail | ContactPhone | Street | Postal | City | Country | Category | Owner | Status | Notes | CreatedTS | Keyword | CountryCode | Phone | Email | Website | Address | Lat | Lng | Score | TierHint | LastTouchTS |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| LEAD-001 | 2025-11-09T23:18:39.466Z | Google Ads | salon products Berlin | Berlin | 10115 | DE | Hair & Beauty Salon Berlin ... | Salon | +49 30 12345678 | contact@berlin-salon.de | https://berlin-salon.de | Friedrichstraße 123, 10115 ... | 52.5200 | 13.4050 | NEW | - | 0 | Dealer Plus | Interested in premium hair ... | - | - | - | 14 | Med | - |
| LEAD-002 | 2025-11-09T23:18:39.466Z | LinkedIn | hairdresser products Hamburg | Hamburg | 20095 | DE | Elegante Hair Studio Hamburg | Salon | +49 40 98765432 | info@elegante-hh.de | https://elegante-hamburg.de | Mönckebergstraße 45, 20095 ... | 53.5511 | 9.9937 | NEW | - | 0 | Dealer Basic | Looking for wholesale pricing | - | - | - | 14 | Med | - |

---

## 📄 Lead_Touches

**Total Rows**: 0

### Headers

```
TouchID | TS | LeadID | Channel | Action | Actor | Notes | Outcome
```

---

## 📄 Territories

**Total Rows**: 0

### Headers

```
TerritoryID | Name | Owner | CountryCode | CitiesCSV | PostalRangesJSON | Notes
```

---

## 📄 Assignment_Rules

**Total Rows**: 0

### Headers

```
RuleID | TerritoryID | When | ConditionJSON | AssignTo | Priority | ActiveFlag | Notes
```

---

## 📄 Enrichment_Queue

**Total Rows**: 0

### Headers

```
JobID | CreatedTS | LeadID | Task | ParamsJSON | Status | Attempts | LastError
```

---

## 📄 Dedupe_Index

**Total Rows**: 0

### Headers

```
IndexKey | LeadID | Type | Notes
```

---

## 📄 SEO_Keywords

**Purpose**: Keyword research, clustering, and prioritization for SEO campaigns

**Total Rows**: Dynamic (user-managed)

### Headers

```
KeywordID | Keyword | Locale | HarvestSource | HarvestParamsJSON | HarvestTS | Cluster | ClusterID | ClusterScore | LastClusteredTS | Intent | IntentConfidencePct | SearchVolume | Difficulty | CPC_EUR | Rank | TrafficEstimate | OpportunityScore | SERPFeaturesCSV | TopCompetitorsCSV | Priority | PriorityReason | AssignedURL | BriefID | CreatedTS | LastChecked | Status | Notes
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| **KeywordID** | string | Unique identifier (PK) |
| **Keyword** | string | Target keyword phrase |
| **Locale** | string | Language/region (e.g., de-DE, en-US) |
| **HarvestSource** | enum | Source: Manual, Import, GoogleAds, GooglePlaces, Competitor |
| **HarvestParamsJSON** | string | JSON string of harvest parameters |
| **HarvestTS** | timestamp | When keyword was harvested |
| **Cluster** | string | AI-generated cluster label |
| **ClusterID** | string | Stable slug for grouping |
| **ClusterScore** | number | 0-100 relevance to cluster |
| **LastClusteredTS** | timestamp | Last clustering operation |
| **Intent** | enum | Informational, Commercial, Transactional, Navigational |
| **IntentConfidencePct** | number | 0-100 confidence score |
| **SearchVolume** | number | Monthly search volume |
| **Difficulty** | number | 0-100 ranking difficulty |
| **CPC_EUR** | number | Cost-per-click in EUR |
| **Rank** | number | Current ranking position |
| **TrafficEstimate** | number | Estimated monthly traffic |
| **OpportunityScore** | number | 0-100 composite opportunity score |
| **SERPFeaturesCSV** | string | Featured snippet, PAA, etc. |
| **TopCompetitorsCSV** | string | Comma-separated domains |
| **Priority** | number | 0-100 priority score |
| **PriorityReason** | string | Explanation for priority |
| **AssignedURL** | string | Target landing page |
| **BriefID** | string | Link to SEO_Briefs sheet |
| **CreatedTS** | timestamp | Creation timestamp |
| **LastChecked** | timestamp | Last data refresh |
| **Status** | enum | active, paused, archived |
| **Notes** | string | Free-text notes |

### Related Schemas

- **Backend**: `seoKeywordSchema` in `shared/schema.ts`
- **Insert**: `seoKeywordInsertSchema` with validation
- **API Endpoints**: `/api/marketing/seo/keywords/*`

### Features

- ✓ Bulk operations (harvest, cluster, prioritize)
- ✓ AI-powered clustering (GPT-4)
- ✓ Intent classification
- ✓ Opportunity scoring
- ✓ SERP feature tracking
- ✓ Competitor analysis

---

## 📄 Ads_Campaigns

**Purpose**: Campaign management for Google Ads and other advertising platforms

**Total Rows**: Dynamic (user-managed)

### Headers

```
CampaignID | CampaignName | Budget | BudgetType | StartDate | EndDate | TargetCountry | TargetLanguage | CreatedTS | Status | Notes
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| **CampaignID** | string | Unique identifier (PK) |
| **CampaignName** | string | Campaign name |
| **Budget** | number | Daily or total budget in EUR |
| **BudgetType** | enum | daily, total |
| **StartDate** | date | Campaign start date |
| **EndDate** | date | Campaign end date (optional) |
| **TargetCountry** | string | Target country code (e.g., DE, US) |
| **TargetLanguage** | string | Target language code (e.g., de, en) |
| **CreatedTS** | timestamp | Creation timestamp |
| **Status** | enum | draft, active, paused, removed |
| **Notes** | string | Free-text notes |

### Related Schemas

- **Backend**: `adsCampaignSchema` in `shared/schema.ts`
- **Insert**: `adsCampaignInsertSchema` with validation
- **API Endpoints**: `/api/marketing/ads/campaigns/*`

### Features

- ✓ Campaign builder with budget tracking
- ✓ Date range management
- ✓ Geographic and language targeting
- ✓ Google Ads CSV export

---

## 📄 Ads_AdGroups

**Purpose**: Ad group organization with keywords, negatives, and creatives

**Total Rows**: Dynamic (user-managed)

### Headers

```
AdGroupID | CampaignID | AdGroupName | Keywords | NegativeKeywords | MatchType | BidEUR | CreatedTS | Status | Notes
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| **AdGroupID** | string | Unique identifier (PK) |
| **CampaignID** | string | Parent campaign (FK) |
| **AdGroupName** | string | Ad group name |
| **Keywords** | string | Newline-separated keywords |
| **NegativeKeywords** | string | Newline-separated negative keywords |
| **MatchType** | enum | Exact, Phrase, Broad |
| **BidEUR** | number | Bid amount in EUR |
| **CreatedTS** | timestamp | Creation timestamp |
| **Status** | enum | draft, active, paused, removed |
| **Notes** | string | Free-text notes |

### Related Schemas

- **Backend**: `adsAdGroupSchema` in `shared/schema.ts`
- **Insert**: `adsAdGroupInsertSchema` with validation
- **API Endpoints**: `/api/marketing/ads/groups/*` (via campaigns)

### Features

- ✓ Keyword and negative keyword management
- ✓ Match type configuration
- ✓ Bid management
- ✓ Hierarchy linkage to campaigns

---

## 📄 Social_Calendar

**Purpose**: Content calendar for social media posts with AI-powered composition

**Total Rows**: Dynamic (user-managed)

### Headers

```
PostID | ScheduledTS | Channel | ProductLine | Hook | Caption | HashtagsCSV | Status | AssetIDsCSV | Locale | CreatedTS | PublishedTS | Notes
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| **PostID** | string | Unique identifier (PK) |
| **ScheduledTS** | timestamp | Scheduled publish time |
| **Channel** | string | Platform: Instagram, Facebook, Twitter, LinkedIn |
| **ProductLine** | string | Associated product line |
| **Hook** | string | Opening hook/attention-grabber |
| **Caption** | string | Post caption/body |
| **HashtagsCSV** | string | Comma-separated hashtags |
| **Status** | enum | draft, scheduled, published, failed |
| **AssetIDsCSV** | string | Comma-separated asset IDs (images/videos) |
| **Locale** | string | Language code (en, de, ar) |
| **CreatedTS** | timestamp | Creation timestamp |
| **PublishedTS** | timestamp | Actual publish time |
| **Notes** | string | Free-text notes |

### Related Schemas

- **Backend**: `socialCalendarSchema` in `shared/schema.ts`
- **Insert**: `socialCalendarInsertSchema` with validation
- **API Endpoints**: `/api/marketing/social/posts/*`

### Features

- ✓ AI-powered hook generation (3 variants)
- ✓ AI-powered caption generation (tone-aware)
- ✓ AI-powered hashtag suggestions
- ✓ Asset picker with image upload
- ✓ Multi-platform support
- ✓ Scheduling and CSV export
- ✓ Bilingual support (EN/AR)

### AI Integration

**Endpoints**:
- `POST /api/ai/marketing/social-hook` - Generate hooks
- `POST /api/ai/marketing/social-caption` - Generate captions
- `POST /api/ai/marketing/social-hashtags` - Suggest hashtags

**Cache**: 10min TTL, concurrency-safe  
**Rate Limit**: 3 concurrent OpenAI requests

---

## 📄 SEO_Briefs

**Purpose**: AI-generated content briefs for SEO optimization

**Total Rows**: Dynamic (AI-generated)

### Headers

```
BriefID | KeywordID | Keyword | Locale | Title | MetaDescription | H1 | SectionsJSON | PrimaryKeywords | SecondaryKeywords | CreatedTS | Status | Notes
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| **BriefID** | string | Unique identifier (PK) |
| **KeywordID** | string | Link to SEO_Keywords (FK) |
| **Keyword** | string | Target keyword |
| **Locale** | string | Language code |
| **Title** | string | Suggested page title |
| **MetaDescription** | string | Meta description (150-160 chars) |
| **H1** | string | Main heading |
| **SectionsJSON** | string | JSON array of H2/H3 sections |
| **PrimaryKeywords** | string | Comma-separated primary keywords |
| **SecondaryKeywords** | string | Comma-separated secondary keywords |
| **CreatedTS** | timestamp | Generation timestamp |
| **Status** | enum | draft, approved, published |
| **Notes** | string | Free-text notes |

### Related Schemas

- **Backend**: `seoBriefSchema` in `shared/schema.ts`
- **API Endpoints**: `/api/ai/marketing/seo-brief`

### Features

- ✓ AI-generated content structure (GPT-4)
- ✓ Section outline (H2/H3)
- ✓ Meta tag suggestions
- ✓ Keyword recommendations
- ✓ Copy-to-clipboard
- ✓ Brief editor with live preview

---

## 📄 SEO_Audits

**Purpose**: On-page SEO recommendations and optimization suggestions

**Total Rows**: Dynamic (AI-generated)

### Headers

```
AuditID | URL | Keyword | Locale | OnPageScore | Recommendations | CreatedTS | Status | Notes
```

### Column Descriptions

| Column | Type | Description |
|--------|------|-------------|
| **AuditID** | string | Unique identifier (PK) |
| **URL** | string | Audited page URL |
| **Keyword** | string | Target keyword |
| **Locale** | string | Language code |
| **OnPageScore** | number | 0-100 optimization score |
| **Recommendations** | string | JSON array of suggestions |
| **CreatedTS** | timestamp | Audit timestamp |
| **Status** | enum | new, in_progress, completed |
| **Notes** | string | Free-text notes |

### Related Schemas

- **Backend**: `seoAuditSchema` in `shared/schema.ts`
- **API Endpoints**: `/api/marketing/seo/audits/*`

### Features

- ✓ On-page optimization analysis
- ✓ Actionable recommendations
- ✓ Scoring system
- ✓ Integration with SEO_Keywords

---

## 📝 Summary

- **Total Sheets Analyzed**: 59 (53 existing + 6 Marketing)
- **Sheets with Warnings**: 1
- **Marketing Sheets**: 6 (SEO_Keywords, Ads_Campaigns, Ads_AdGroups, Social_Calendar, SEO_Briefs, SEO_Audits)

### Marketing Module Coverage

| Sheet Name | Status | Columns | Backend Schema | API Coverage |
|------------|--------|---------|----------------|--------------|
| **SEO_Keywords** | ✅ Documented | 27 | seoKeywordSchema | ✅ Full CRUD |
| **Ads_Campaigns** | ✅ Documented | 11 | adsCampaignSchema | ✅ Full CRUD + Export |
| **Ads_AdGroups** | ✅ Documented | 10 | adsAdGroupSchema | ✅ Full CRUD |
| **Social_Calendar** | ✅ Documented | 13 | socialCalendarSchema | ✅ Full CRUD + AI |
| **SEO_Briefs** | ✅ Documented | 12 | seoBriefSchema | ✅ AI Generation |
| **SEO_Audits** | ✅ Documented | 9 | seoAuditSchema | ✅ AI Analysis |

**Recommendation**: Address all validation warnings to ensure data integrity.

**Marketing Module Status**: ✅ Production Ready - All sheets documented, schemas validated, APIs operational.