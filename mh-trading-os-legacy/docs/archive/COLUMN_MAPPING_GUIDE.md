# 📋 FinalPriceList Column Mapping Guide

**Updated:** November 14, 2025  
**Total Columns:** 68 (All unique, no duplicates)

---

## ✅ Column Verification Status

**Your Google Sheet:** 19 columns (❌ 49 columns missing)  
**Required Definition:** 68 columns  
**CSV Source File:** 68 columns

---

## 📊 Complete Column List (68 Columns)

### 1️⃣ Product Identity (6 columns)
| # | Column | Type | Status in Sheet | Required |
|---|--------|------|-----------------|----------|
| 1 | SKU | Text | ✅ Present | Yes |
| 2 | Name | Text | ✅ Present | Yes |
| 3 | Category | Text | ✅ Present | Yes |
| 4 | Brand | Text | ✅ Present | Yes |
| 5 | Barcode | Text | ⚠️ Present (empty) | Yes |
| 6 | Status | Text | ✅ Present | Yes |

### 2️⃣ Legacy v1 Cost Breakdown (6 columns)
| # | Column | Type | Status | Required |
|---|--------|------|--------|----------|
| 7 | Factory_Cost_EUR | Number | ⚠️ Present (legacy) | No |
| 8 | Packaging_Cost_EUR | Number | ⚠️ Present (legacy) | No |
| 9 | Freight_kg_EUR | Number | ⚠️ Present (legacy) | No |
| 10 | Import_Duty_Pct | Number | ⚠️ Present (legacy) | No |
| 11 | Overhead_Pct | Number | ⚠️ Present (legacy) | No |
| 12 | COGS_EUR | Number | ⚠️ Present (legacy) | No |

### 3️⃣ HAIROTICMEN v3 FullCost Breakdown (9 columns) ⭐
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 13 | Shipping_Inbound_per_unit | Number | ✅ Present | Yes | Inbound shipping cost per unit |
| 14 | EPR_LUCID_per_unit | Number | ✅ Present | Yes | Extended Producer Responsibility |
| 15 | GS1_per_unit | Number | ✅ Present | Yes | Barcode/GS1 cost |
| 16 | Retail_Packaging_per_unit | Number | ✅ Present | Yes | Retail packaging cost |
| 17 | QC_PIF_per_unit | Number | ✅ Present | Yes | Quality control cost |
| 18 | Operations_per_unit | Number | ✅ Present | Yes | Operations overhead |
| 19 | Marketing_per_unit | Number | ✅ Present | Yes | Marketing allocation |
| 20 | **FullCost_EUR** | Number | ❌ **MISSING** | **Yes** | **Sum of all 9 cost components** |

### 4️⃣ Factory Pricing Inputs (4 columns)
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 21 | FactoryPriceUnit_Manual | Number | ❌ Missing | No | Manual override for factory price |
| 22 | TotalFactoryPriceCarton | Number | ❌ Missing | No | Total carton price |
| 23 | UnitsPerCarton | Number | ❌ Missing | No | Units per carton |
| 24 | FX_BufferPct | Number | ❌ Missing | No | FX buffer percentage (default 3%) |

### 5️⃣ Product Specifications (5 columns)
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 25 | Weight_g | Number | ⚠️ Present (partial) | Yes | Product weight in grams |
| 26 | Content_ml | Number | ❌ Missing | **Yes** | **Required for Grundpreis** |
| 27 | Net_Content_ml | Number | ❌ Missing | Yes | Net content for Grundpreis |
| 28 | Dims_cm | Text | ⚠️ Present (empty) | Yes | Dimensions (LxWxH) |
| 29 | VAT% | Number | ✅ Present | Yes | VAT percentage (usually 19%) |

### 6️⃣ PAngV Grundpreis (German Price Indication Law) (3 columns) ⭐
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 30 | **Grundpreis** | Text | ❌ **MISSING** | **Yes** | **Formatted price per 100ml/100g** |
| 31 | Grundpreis_Net | Number | ❌ Missing | Yes | Net Grundpreis value |
| 32 | **Grundpreis_Unit** | Text | ❌ **MISSING** | **Yes** | **Unit (per 100ml or per 100g)** |

### 7️⃣ Channel/Line Configuration (2 columns)
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 33 | Amazon_TierKey | Text | ✅ Present | Yes | Amazon FBA size tier |
| 34 | Line | Text | ✅ Present | Yes | Product line (Premium, Professional, Basic, Tools) |

### 8️⃣ Manual Pricing Overrides (1 column)
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 35 | Manual_UVP_Inc | Number | ❌ Missing | No | Manual UVP override (with VAT) |

### 9️⃣ Calculated UVP (2 columns) ⭐
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 36 | **UVP_Net** | Number | ❌ **MISSING** | **Yes** | **UVP without VAT** |
| 37 | **UVP_Inc** | Number | ❌ **MISSING** | **Yes** | **UVP with 19% VAT** |

### 🔟 Channel Cost Configuration (5 columns)
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 38 | Ad_Pct | Number | ❌ Missing | Yes | Advertising cost % (by line) |
| 39 | Returns_Pct | Number | ❌ Missing | Yes | Returns rate % |
| 40 | Loyalty_Pct | Number | ❌ Missing | Yes | Loyalty program % |
| 41 | Payment_Pct | Number | ❌ Missing | Yes | Payment processing % |
| 42 | Amazon_Referral_Pct | Number | ❌ Missing | Yes | Amazon referral fee % |

### 1️⃣1️⃣ Shipping Configuration (2 columns)
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 43 | DHL_WeightBand | Text | ❌ Missing | No | DHL weight band |
| 44 | DHL_Zone | Text | ❌ Missing | No | DHL shipping zone |

### 1️⃣2️⃣ Gift Program (5 columns)
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 45 | Gift_SKU | Text | ❌ Missing | No | Gift product SKU |
| 46 | Gift_SKU_Cost | Number | ❌ Missing | No | Gift product cost |
| 47 | Gift_Attach_Rate | Number | ❌ Missing | No | Gift attachment rate % |
| 48 | Gift_Funding_Pct | Number | ❌ Missing | No | Gift funding % |
| 49 | Gift_Shipping_Increment | Number | ❌ Missing | No | Additional shipping for gift |

### 1️⃣3️⃣ Margins & Guardrails (3 columns) ⭐
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 50 | **PostChannel_Margin_Pct** | Number | ❌ **MISSING** | **Yes** | **Actual margin after channel costs** |
| 51 | Floor_B2C_Net | Number | ❌ Missing | Yes | Floor price (MAP) |
| 52 | **Guardrail_OK** | Text | ❌ **MISSING** | **Yes** | **Margin guardrail status** |

### 1️⃣4️⃣ Recommended Pricing (4 columns)
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 53 | UVP_Recommended | Number | ❌ Missing | Yes | AI-recommended UVP |
| 54 | UVP | Number | ❌ Missing | Yes | Final approved UVP |
| 55 | **MAP** | Number | ❌ **MISSING** | **Yes** | **Minimum Advertised Price** |
| 56 | AutoPriceFlag | Text | ❌ Missing | No | Auto-pricing enabled flag |

### 1️⃣5️⃣ Channel Prices (3 columns) ⭐
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 57 | **Price_Web** | Number | ❌ **MISSING** | **Yes** | **Web store price** |
| 58 | **Price_Amazon** | Number | ❌ **MISSING** | **Yes** | **Amazon price** |
| 59 | Price_Salon | Number | ❌ Missing | Yes | Salon channel price |

### 1️⃣6️⃣ B2B Partner Tier Net Prices (4 columns) ⭐⭐
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 60 | **Net_Dealer_Basic** | Number | ❌ **MISSING** | **Yes** | **Dealer Basic net price (40% off)** |
| 61 | **Net_Dealer_Plus** | Number | ❌ **MISSING** | **Yes** | **Dealer Plus net price (50% off)** |
| 62 | **Net_Stand** | Number | ❌ **MISSING** | **Yes** | **Stand Partner net price (30% + 5%)** |
| 63 | **Net_Distributor** | Number | ❌ **MISSING** | **Yes** | **Distributor net price (55% off)** |

### 1️⃣7️⃣ Competitor Intelligence (2 columns)
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 64 | Competitor_Min | Number | ❌ Missing | No | Lowest competitor price |
| 65 | Competitor_Median | Number | ❌ Missing | No | Median competitor price |

### 1️⃣8️⃣ Metadata (3 columns)
| # | Column | Type | Status | Required | Notes |
|---|--------|------|--------|----------|-------|
| 66 | Pricing_Version | Text | ❌ Missing | No | Pricing calculation version |
| 67 | QRUrl | Text | ⚠️ Present (partial) | No | Product page QR code URL |
| 68 | Notes | Text | ⚠️ Present (partial) | No | Additional notes |

---

## 🔧 How to Fix Your Google Sheet

### Option 1: Automated (Recommended) ✅

Run the ensure-sheets endpoint to automatically add all missing columns:

```bash
# Via API
POST /api/ensure-sheets

# This will:
# 1. Detect FinalPriceList has only 19 columns
# 2. Add 49 missing columns in correct positions
# 3. Preserve existing data
# 4. Log results to OS_Health
```

### Option 2: Manual

1. Open your Google Sheet
2. Add missing columns in the order shown above
3. Format numeric columns as Numbers (no € symbols)
4. Format text columns as Plain Text

---

## 📥 Import Calculated Pricing Data

After adding columns, import the calculated pricing:

**File:** `pricing-calculations-output.csv`

**Columns in CSV → Columns in Sheet:**
| CSV Column | Sheet Column | Position |
|------------|--------------|----------|
| SKU | SKU | 1 |
| Name | Name | 2 |
| FullCost_EUR | FullCost_EUR | 20 |
| UVP_Net | UVP_Net | 36 |
| UVP_Inc | UVP_Inc | 37 |
| MAP | MAP | 55 |
| Price_Web | Price_Web | 57 |
| Price_Amazon | Price_Amazon | 58 |
| Net_Dealer_Basic | Net_Dealer_Basic | 60 |
| Net_Dealer_Plus | Net_Dealer_Plus | 61 |
| Net_Stand | Net_Stand | 62 |
| Net_Distributor | Net_Distributor | 63 |
| Margin_Pct | PostChannel_Margin_Pct | 50 |

**Import Method:**
1. File → Import → Upload CSV
2. Select "Append to current sheet" or "Replace data at selected cell"
3. Match columns by name
4. Import

---

## ✅ Post-Import Validation

Run these checks after import:

```javascript
// Check column count
=COUNTA(1:1)  // Should be 68

// Check for duplicates in header row
=COUNTIF(1:1, A1) // Should be 1 for each cell

// Verify FullCost_EUR populated
=COUNTIF(FullCost_EUR:FullCost_EUR, ">0") // Should be 84

// Verify UVP_Inc populated
=COUNTIF(UVP_Inc:UVP_Inc, ">0") // Should be 84

// Check UVP_Inc = UVP_Net × 1.19
=IF(ABS(UVP_Inc - UVP_Net*1.19) < 0.01, "✅ OK", "❌ ERROR")

// Check MAP ≥ FullCost_EUR
=IF(MAP >= FullCost_EUR, "✅ Floor Protected", "❌ Below Floor")
```

---

## 🚨 Critical Columns You're Missing

Based on your status report, you're missing these **17 critical columns**:

1. ✅ **FullCost_EUR** (Position 20) - Core cost calculation
2. ✅ **Grundpreis** (Position 30) - Legal requirement (PAngV)
3. ✅ **Grundpreis_Unit** (Position 32) - Legal requirement
4. ✅ **PostChannel_Margin_Pct** (Position 50) - Profitability tracking
5. ✅ **Guardrail_OK** (Position 52) - Price validation
6. ✅ **UVP_Net** (Position 36) - Base retail price
7. ✅ **UVP_Inc** (Position 37) - Final retail price (with VAT)
8. ✅ **MAP** (Position 55) - Minimum advertised price
9. ✅ **Price_Web** (Position 57) - Web store price
10. ✅ **Price_Amazon** (Position 58) - Amazon price
11. ✅ **Net_Dealer_Basic** (Position 60) - B2B tier 1
12. ✅ **Net_Dealer_Plus** (Position 61) - B2B tier 2
13. ✅ **Net_Stand** (Position 62) - B2B tier 3
14. ✅ **Net_Distributor** (Position 63) - B2B tier 4
15. **Floor_B2C_Net** (Position 51) - Floor price
16. **Content_ml** (Position 26) - Required for Grundpreis
17. **Grundpreis_Net** (Position 31) - Net Grundpreis

**These 17 columns contain ALL your calculated pricing data!**

---

## 📊 Column Categories Summary

| Category | Columns | Status | Priority |
|----------|---------|--------|----------|
| Product Identity | 6 | ✅ Complete | ✅ Done |
| Legacy v1 Costs | 6 | ⚠️ Present (unused) | Low |
| HAIROTICMEN v3 Costs | 9 | ⚠️ Partial | **Critical** |
| Factory Pricing | 4 | ❌ Missing | Medium |
| Product Specs | 5 | ⚠️ Partial | High |
| PAngV Grundpreis | 3 | ❌ Missing | **Critical** |
| Channel/Line | 2 | ✅ Complete | ✅ Done |
| Manual Overrides | 1 | ❌ Missing | Low |
| Calculated UVP | 2 | ❌ Missing | **Critical** |
| Channel Costs | 5 | ❌ Missing | High |
| Shipping Config | 2 | ❌ Missing | Medium |
| Gift Program | 5 | ❌ Missing | Low |
| Margins & Guardrails | 3 | ❌ Missing | **Critical** |
| Recommended Pricing | 4 | ❌ Missing | **Critical** |
| Channel Prices | 3 | ❌ Missing | **Critical** |
| B2B Partner Tiers | 4 | ❌ Missing | **Critical** |
| Competitor Intel | 2 | ❌ Missing | Low |
| Metadata | 3 | ⚠️ Partial | Low |

---

## 🎯 Action Plan

### Immediate (Do Now)
1. ✅ **Run ensure-sheets** to add all 49 missing columns
2. ✅ **Import pricing-calculations-output.csv** to populate calculated data
3. ✅ **Verify** all 84 products have FullCost_EUR > 0

### Short-term (This Week)
4. **Backfill Content_ml** for all products (required for Grundpreis)
5. **Populate Weight_g** for products missing it
6. **Add Barcode** for all products

### Medium-term (This Month)
7. Complete Gift Program columns (optional)
8. Add Competitor pricing data
9. Populate DHL shipping configuration

---

**Updated:** November 14, 2025  
**Status:** Ready to add missing columns via ensure-sheets
