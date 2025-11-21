# Production Scripts Guide - HAIROTICMEN Trading OS

**Last Updated:** November 16, 2025 | **Version:** 4.0 (Cleaned & Unified)

---

## 🎯 Overview

**From 73 scripts → 20 production scripts** (73% reduction)  
Removed 53 deprecated scripts (migration, verification, debug tools).

---

## 🏗️ Infrastructure & Setup

### Sheet Management
- **`bootstrap-sheets.ts`** - Initialize all 92 Google Sheets with headers and structure

### Build from Scratch (`build-sheet-from-scratch/`)
Complete spreadsheet creation workflow for new deployments:

| Script | Purpose |
|--------|---------|
| `00-add-shipping-sheets.ts` | Safely add ShippingWeightBands & ShippingCostsFixed to existing spreadsheet |
| `01-create-spreadsheet-structure.ts` | Create all 92 sheets with headers |
| `02-seed-configuration-data.ts` | Populate Settings, Pricing_Params, PartnerTiers |
| `03-seed-product-data.ts` | Import 89 products to FinalPriceList |
| `04-setup-formulas.ts` | Add computed formulas |
| `05-connect-to-app.ts` | Verify API connectivity |
| `06-seed-shipping-config.ts` | Populate DHL bands & shipping costs |
| `orchestrate-all.ts` | Run all steps in sequence |

---

## 💰 Pricing & Cost Management

### Main Pricing Engine
- **`pricing-master.ts`** - **THE ONLY PRICING SCRIPT YOU NEED**
  - Loads 6 Google Sheets tabs (FinalPriceList, Pricing_Params, PartnerTiers, AmazonSizeTiers, ShippingMatrixDHL, DHLSurcharge)
  - Calculates V2.2 pricing (FullCost → UVP → Grundpreis → Channel Prices → B2B Tiers)
  - PAngV-compliant Grundpreis (gross prices with 19% VAT) 🇩🇪
  - Batch writes back to Google Sheets
  - Dry-run mode + CSV/JSON export

**Usage:**
```bash
# Dry run (safe testing)
tsx server/scripts/pricing-master.ts --dry-run --export-csv

# Live sync (writes to sheets)
tsx server/scripts/pricing-master.ts --export-csv
```

### Analysis & Reports
- **`analyze-all-products-v22.ts`** - Analyze pricing coverage & bundling recommendations for all 89 products
- **`generate-pricing-report-sheet.ts`** - Generate comprehensive pricing reports
- **`pricing-summary-report.ts`** - Quick pricing summary with KPIs

### Data Quality
- **`fix-pricing-gaps.ts`** - Fill missing COGS, FullCost, QRUrls with smart defaults
  - `--force` flag to recalculate existing values
  - Corrected COGS formula: `Factory × (1 + Import_Duty%) × (1 + Overhead%) + Packaging + Freight`

### Product Import
- **`import-products-to-sheets.ts`** - Import products from CSV/Excel to FinalPriceList

---

## 🚚 Shipping & Logistics (NEW - V3)

### Unified Shipping System
- **`calculate-shipping-costs.ts`** - **UNIFIED PER-CHANNEL SHIPPING CALCULATOR**
  - Calculates volumetric weight using Settings divisor (default 5000)
  - DHL weight bands (€3.45-€16.90 for 0.5-31.5kg)
  - Per-channel costs: OwnStore, FBM, FBA, B2B
  - Smart category defaults: Cologne 200g, Beard 100g, Wax 180g, Kits 500g
  - **Batch API** (1 call for 89 products - avoids rate limits!)
  - Writes 8 columns: `Shipping_Actual_Kg`, `Shipping_Volumetric_Kg`, `Shipping_Chargeable_Kg`, `Shipping_CarrierID`, `ShipCost_per_Unit_OwnStore/FBM/FBA/B2B`

**Usage:**
```bash
# Calculate and write shipping costs
SHEETS_SPREADSHEET_ID=<your_id> tsx server/scripts/calculate-shipping-costs.ts

# Dry run
DRY_RUN=true tsx server/scripts/calculate-shipping-costs.ts
```

---

## 🔗 QR Codes & Product URLs

- **`generate-all-qr-codes.ts`** - Generate QR codes for all 89 products
- **`update-qr-urls.ts`** - Update QRUrl column in FinalPriceList
- **`fix-qr-urls.ts`** - Fix malformed QR URLs (format: `https://hairoticmen.de/products/{SKU}?barcode={barcode}`)

---

## 🧪 Testing

- **`test-german-invoice.ts`** - Test German invoice generation with PAngV compliance

---

## 🚀 Quick Start Workflows

### Complete Setup (New Spreadsheet)
```bash
# 1. Create all sheets
tsx server/scripts/build-sheet-from-scratch/01-create-spreadsheet-structure.ts

# 2. Seed configuration
tsx server/scripts/build-sheet-from-scratch/02-seed-configuration-data.ts

# 3. Import products
tsx server/scripts/build-sheet-from-scratch/03-seed-product-data.ts

# 4. Add shipping tables
tsx server/scripts/build-sheet-from-scratch/00-add-shipping-sheets.ts
tsx server/scripts/build-sheet-from-scratch/06-seed-shipping-config.ts

# 5. Calculate pricing
tsx server/scripts/pricing-master.ts

# 6. Calculate shipping
tsx server/scripts/calculate-shipping-costs.ts

# 7. Generate QR codes
tsx server/scripts/generate-all-qr-codes.ts
```

### Regular Operations
```bash
# Recalculate all pricing (dry run first!)
tsx server/scripts/pricing-master.ts --dry-run --export-csv
tsx server/scripts/pricing-master.ts --export-csv

# Update shipping costs
tsx server/scripts/calculate-shipping-costs.ts

# Generate pricing report
tsx server/scripts/generate-pricing-report-sheet.ts

# Fix data gaps
tsx server/scripts/fix-pricing-gaps.ts --force
```

### Analysis & Reporting
```bash
# Analyze pricing coverage
tsx server/scripts/analyze-all-products-v22.ts

# Generate summary report
tsx server/scripts/pricing-summary-report.ts
```

---

## 📊 Environment Variables

All scripts require:
```bash
SHEETS_SPREADSHEET_ID=<your_spreadsheet_id>
```

Optional:
```bash
DRY_RUN=true              # Preview changes without writing
EXPORT_CSV=true           # Export results to CSV
```

---

## ⚠️ Important Notes

### Rate Limits
- All bulk update scripts use Google Sheets **batchUpdate API** (60 requests/minute limit)
- `calculate-shipping-costs.ts` uses **1 batch call** for 89 products (vs 89 individual calls)
- Never use loops with individual `sheets.spreadsheets.values.update()` calls

### Single Source of Truth
- Google Sheets is authoritative - never duplicate data
- All scripts read from sheets, calculate, and write back
- Settings sheet stores system-wide config (volumetric divisor, counters, etc.)

### Smart Defaults
- Missing Weight_g uses category defaults (Cologne 200g, Beard 100g, etc.)
- Missing Dims_cm uses category defaults (Kits 20×15×10, Cologne 15×10×8, etc.)
- Missing COGS calculated from Factory price with corrected formula

### Atomic Operations
- Scripts use retry logic (`retryWithBackoff`) for transient failures
- Atomic counters for invoice numbering (`sheetsService.incrementCounter()`)
- Post-write verification for critical operations

---

## 🗑️ Deprecated Scripts Removed (Nov 16, 2025)

**Cleaned up 53 old scripts** (from 73 → 20):

### Migration Scripts (14 removed)
- ❌ migrate-pricing-law.ts
- ❌ migrate-to-v2-engine.ts
- ❌ migrate-factory-prices.ts
- ❌ fix-categories-and-prices.ts
- ❌ add-v2-columns.ts
- ❌ populate-sku-column.ts
- ❌ update-all-weight-data.ts
- ❌ update-category-dropdown.ts
- ❌ update-category-enums.ts
- ❌ restore-finalpricelist-schema.ts
- ❌ enforce-pricing-data-structure.ts
- ❌ cleanup-finalpricelist.ts
- ❌ cleanup-sheets-comprehensive.ts
- ❌ clean-quotes-sheet.ts

### Verification/Audit Scripts (18 removed)
- ❌ comprehensive-pricing-verification.ts
- ❌ final-verification.ts
- ❌ final-category-verification.ts
- ❌ final-comprehensive-check.ts
- ❌ finalize-pricing-verification.ts
- ❌ validate-pricing-rules.ts
- ❌ validate-sheet-structure.ts
- ❌ validate-final-pricelist.ts
- ❌ deep-validate-pricing-sheet.ts
- ❌ analyze-pricing-readiness.ts
- ❌ analyze-pricing-tabs.ts
- ❌ analyze-pricing-data.ts
- ❌ analyze-weights.ts
- ❌ audit-google-sheets.ts
- ❌ deep-sheet-audit.ts
- ❌ scan-finalpricelist.ts
- ❌ discover-sheets-structure.ts
- ❌ check-current-sheet-state.ts

### Debug/Test Scripts (10 removed)
- ❌ debug-factory-prices.ts
- ❌ check-factory-prices.ts
- ❌ check-weight-config.ts
- ❌ check-qr-data.ts
- ❌ test-v2-engine.ts
- ❌ test-v2-uat.ts
- ❌ get-all-qr-issues.ts
- ❌ verify-script-update.ts
- ❌ pricing-sync-wrapper.ts
- ❌ pricing-validation-wrapper.ts

### Obsolete Utilities (11 removed)
- ❌ create-dhl-shipping-tabs.ts (replaced by V3 system)
- ❌ assign-carton-sizes-smart.ts (replaced by V3 cartonization)
- ❌ determine-carton-sizes.ts (replaced by V3 cartonization)
- ❌ recalculate-carton-weights.ts (obsolete)
- ❌ import-products-from-pdf.ts (one-time import)
- ❌ parse-pdf-update.ts (one-time import)
- ❌ fetch-woocommerce-products.ts (one-time import)
- ❌ analyze-excel.ts (one-time analysis)
- ❌ extract-weight-from-csv.ts (one-time import)
- ❌ clean-secrets-from-sheet.ts (security fix done)
- ❌ auto-fill-cost-fields.ts (replaced by fix-pricing-gaps.ts)

### Report Generation (Duplicates - 2 removed)
- ❌ generate-final-pricing-report.ts (duplicate)
- ❌ generate-final-master-report.ts (duplicate)
- ❌ generate-workflow-improvements.ts (obsolete)
- ❌ generate-workflow-improvements-simple.ts (obsolete)

**Result:** Clean, maintainable codebase with only production-ready scripts.

---

## 📚 Documentation

For detailed information:
- `/replit.md` - System architecture & feature specifications
- `server/lib/shipping.ts` - Unified Shipping V3 implementation
- `server/lib/pricing-engine-hairoticmen.ts` - Pricing Engine V2.2
- `server/config/hairoticmen-shipping-unified.json` - DHL pricing data

---

## ❓ Troubleshooting

### Rate Limit Errors
```
Error: Quota exceeded for quota metric 'Write requests'
```
**Solution:** Script is using individual writes instead of batch API. Fix:
```typescript
// BAD: 89 separate API calls
for (const row of rows) {
  await sheets.spreadsheets.values.update({ range: `A${i}` });
}

// GOOD: 1 batch API call
await sheets.spreadsheets.values.batchUpdate({
  data: rows.map((row, i) => ({ range: `A${i}`, values: [row] }))
});
```

### Missing Data
```
Skipped all products: missing data
```
**Solution:** Use scripts with smart defaults:
- `calculate-shipping-costs.ts` - Has category-based weight/dims defaults
- `fix-pricing-gaps.ts --force` - Fills missing COGS, FullCost, QRUrls

### Grundpreis is €0.00
**Solution:** Product missing `Content_ml` or `Net_Content_ml` field.  
Manual fix: Update the field in Google Sheets FinalPriceList.

### Missing Amazon Tier Data
**Solution:** The `AmazonSizeTiers` tab might not have all tier keys.  
Check that `Amazon_TierKey` values in FinalPriceList match tier names in AmazonSizeTiers tab.

---

**🎉 Clean, production-ready script collection. No duplicates. No legacy code.**
