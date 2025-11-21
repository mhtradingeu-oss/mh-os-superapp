# Script 08: Complete Fixtures Seeder - Documentation

## Overview

Script 08 is a comprehensive seeder that populates ALL Google Sheets with production-ready data for the HAIROTICMEN Trading OS. It replaces the previous incomplete seeder with a fully integrated, schema-compliant version.

## ✅ Major Improvements Made

### 1. **Schema Compliance**
- **BEFORE**: Used custom "Products" sheet with incompatible headers
- **AFTER**: Uses production `FinalPriceList` schema from `ensure-sheets.ts` (81 columns)
- Matches all header names exactly to production schema

### 2. **Bug Fixes**
- **FIXED**: Typo `"paking.csv"` → `"packaging.csv"` (line 124 in original)
- **FIXED**: Import path issues - now uses proper Replit Google Sheets connector
- **FIXED**: Missing headers and column mismatches
- **FIXED**: Incorrect data types in some columns

### 3. **Feature Enhancements**
- ✅ SEO-friendly QR URLs with slug mapping support
- ✅ Proper integration with `hairoticmen-pricing.json`
- ✅ OrderLines and QuoteLines generation (was missing)
- ✅ Pricing_Params, PartnerTiers, Channels, AmazonSizeTiers seeding
- ✅ Enhanced partner generation with all required fields
- ✅ Better error handling and validation
- ✅ Comprehensive logging and progress reporting

### 4. **Code Quality**
- Full TypeScript type safety
- Follows existing codebase patterns from Scripts 01-07
- Proper async/await patterns
- Quota-safe batched writes with cooldown
- DRY_RUN mode for testing
- Deterministic seeding with RNG seed

### 5. **Production Ready**
- Matches 103-sheet production schema
- Integrates with existing build-sheet-from-scratch scripts
- Uses Replit's Google Sheets connector
- Respects rate limits and quotas
- Full validation and error reporting

## Usage

### Basic Usage
```bash
tsx server/scripts/build-sheet-from-scratch/08-seed-all-fixtures.ts
```

### With Environment Variables
```bash
SHEETS_SPREADSHEET_ID=1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0 \
DRY_RUN=false \
FULL_RESET=true \
NUM_PRODUCTS=60 \
NUM_ORDERS=20 \
NUM_QUOTES=10 \
NUM_PARTNERS=8 \
WRITE_BATCH_SIZE=12 \
WRITE_COOLDOWN_MS=3000 \
SEED=1337 \
tsx server/scripts/build-sheet-from-scratch/08-seed-all-fixtures.ts
```

### Testing Mode (Dry Run)
```bash
DRY_RUN=true tsx server/scripts/build-sheet-from-scratch/08-seed-all-fixtures.ts
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SHEETS_SPREADSHEET_ID` | Required | Your Google Sheets spreadsheet ID |
| `DRY_RUN` | `false` | If `true`, simulates without writing |
| `FULL_RESET` | `false` | If `true`, clears existing data before seeding |
| `WRITE_BATCH_SIZE` | `12` | Number of rows per batch write |
| `WRITE_COOLDOWN_MS` | `3000` | Milliseconds between batches (quota protection) |
| `SEED` | `1337` | Random seed for deterministic generation |
| `NUM_PRODUCTS` | `60` | Number of products to generate (if no JSON) |
| `NUM_ORDERS` | `20` | Number of sample orders to create |
| `NUM_QUOTES` | `10` | Number of sample quotes to create |
| `NUM_PARTNERS` | `8` | Number of B2B partners to create |
| `PRICING_CONFIG_PATH` | Auto-detected | Path to hairoticmen-pricing.json |

## What Gets Seeded

### Core Data (17 Sheets)
1. **FinalPriceList** - 89 products with complete pricing data
2. **Enums** - All dropdown values for data validation
3. **PackagingBoxes** - Shipping boxes and cartons
4. **ShippingCarriers** - DHL, UPS, DPD configurations
5. **ShippingWeightBands** - Weight-based shipping rates
6. **ShippingCostsFixed** - Fixed costs per channel
7. **PartnerRegistry** - B2B partners with full contact info
8. **Bundles** - Product bundle definitions
9. **Orders** - Sample order headers
10. **OrderLines** - Order line items
11. **Quotes** - Sample quote headers
12. **QuoteLines** - Quote line items
13. **Settings** - System configuration
14. **Pricing_Params** - Pricing engine parameters
15. **PartnerTiers** - B2B tier definitions
16. **Channels** - Sales channel configurations
17. **AmazonSizeTiers** - FBA fee structures

## Optional Data Sources

### 1. Product Data from JSON
Place `hairoticmen-pricing.json` in:
- `server/config/hairoticmen-pricing.json` (recommended)
- Or set `PRICING_CONFIG_PATH` environment variable

**If found**: Uses real product data (89 products)  
**If not found**: Generates synthetic products based on `NUM_PRODUCTS`

### 2. Packaging Data from CSV
Place `packaging.csv` in project root with columns:
```
PackageID,BoxType,Inner_L_cm,Inner_W_cm,Inner_H_cm,Outer_L_cm,Outer_W_cm,Outer_H_cm,Tare_Weight_g,Unit_Cost_EUR,Units_Per_Carton,Carton_Cost_EUR,Max_Weight_kg,Active
```

**If found**: Uses custom packaging definitions  
**If not found**: Uses default packaging configurations

### 3. SEO Slug Mapping
Place `product-slug-mapping-complete.json` in `server/config/`

**If found**: Uses SEO-friendly URLs like `hairoticmen.de/product/beard-oil/`  
**If not found**: Uses SKU-based URLs

## Integration with Existing Scripts

Script 08 fits into the build-sheet-from-scratch workflow:

```
01-create-spreadsheet-structure.ts    (creates sheets)
02-seed-configuration-data.ts          (seeds config)
03-seed-product-data.ts                (seeds products)
04-setup-formulas.ts                   (adds formulas)
05-connect-to-app.ts                   (verifies connectivity)
06-seed-shipping-config.ts             (seeds DHL rates)
07-validate-and-repair-workbook.ts     (validates all)
08-seed-all-fixtures.ts                (⭐ THIS SCRIPT - seeds everything)
```

**Use Script 08 when**:
- Setting up a complete test/demo environment
- Creating fixtures for development
- Populating a new spreadsheet with realistic data
- Testing the complete system end-to-end

**Use Scripts 01-07 when**:
- Building production system step-by-step
- Need more control over each phase
- Troubleshooting specific components

## Output Example

```
╔════════════════════════════════════════════════════════════════╗
║  HAIROTICMEN Trading OS - Complete Fixtures Seeder (Script 08) ║
╚════════════════════════════════════════════════════════════════╝

📎 Spreadsheet ID: 1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0
🔧 Mode: 🚀 WRITE MODE
🔄 Full Reset: YES (clear existing data)
📊 Batch Size: 12 rows
⏱️  Cooldown: 3000ms between batches
🎲 RNG Seed: 1337

═══════════════════════════════════════════════════════════════

📝 PHASE 1: Sheet Setup
────────────────────────────────────────────────────────────────
  • FinalPriceList: 0 missing headers
  • Cleared data in FinalPriceList
  • Enums: 0 missing headers
  • Cleared data in Enums
  [... more sheets ...]

🏗️  PHASE 2: Building Data
────────────────────────────────────────────────────────────────
✅ Using 89 products from JSON config
  ✓ Products: 89 rows
  ✓ Enums: 25 rows
  ✓ Packaging: 7 rows
  ✓ Carriers: 3 rows
  ✓ Weight Bands: 13 rows
  ✓ Fixed Costs: 4 rows
  ✓ Partners: 8 rows
  ✓ Bundles: 15 rows
  ✓ Orders: 20 rows (67 lines)
  ✓ Quotes: 10 rows (42 lines)
  ✓ Settings: 7 rows
  ✓ Pricing Params: 8 rows
  ✓ Partner Tiers: 6 rows
  ✓ Channels: 4 rows
  ✓ Amazon Tiers: 3 rows

📤 PHASE 3: Writing to Google Sheets
────────────────────────────────────────────────────────────────
  ✅ FinalPriceList: appended 89 row(s)
  ✅ Enums: appended 25 row(s)
  [... more writes ...]

═══════════════════════════════════════════════════════════════
✅ SEEDING COMPLETE!

📊 Summary:
   • 89 products in FinalPriceList
   • 8 B2B partners
   • 20 orders with 67 line items
   • 10 quotes with 42 line items
   • 15 bundle components
   • 25 enum values for dropdowns
   • 7 packaging definitions
   • 13 shipping weight bands

⏭️  NEXT STEPS:
   1. Run pricing-master.ts to calculate full pricing
   2. Run 07-validate-and-repair-workbook.ts for deep validation
   3. Review your Google Sheet to verify data

🔗 Open your sheet:
   https://docs.google.com/spreadsheets/d/<ID>/edit
```

## Troubleshooting

### Error: "SHEETS_SPREADSHEET_ID not set"
**Solution**: Set the environment variable or run Script 01 first

### Error: "Cannot load hairoticmen-pricing.json"
**Solution**: Either:
- Place file in `server/config/`
- Set `PRICING_CONFIG_PATH` environment variable
- Let it generate synthetic data (this is OK for testing)

### Error: Rate limit exceeded
**Solution**: Increase `WRITE_COOLDOWN_MS` to 5000 or higher

### Warning: "Missing headers appended"
**Info**: This is normal - script auto-adds any missing columns

### Data looks incorrect
**Solution**: Run with `DRY_RUN=true` first to preview, then run `FULL_RESET=true` to clear old data

## Comparison: Before vs After

### Original Script Issues
```typescript
// ❌ Wrong sheet name
const H = {
  Products: [...],  // Should be FinalPriceList
  
// ❌ Wrong headers
const H = {
  FinalPriceList: ["SKU","Name",...,"Grundpreis_Inc_Per_L","Pricing_Engine_Version",...]
  // Missing 30+ required columns!

// ❌ Typo in file path
const csvPath = path.resolve(process.cwd(),"paking.csv");  // Should be "packaging.csv"

// ❌ Missing features
// - No OrderLines generation
// - No QuoteLines generation
// - No Pricing_Params seeding
// - No PartnerTiers seeding
// - No Channels seeding
// - No AmazonSizeTiers seeding
```

### Updated Script Features
```typescript
// ✅ Correct production schema
const HEADERS = {
  FinalPriceList: [
    'SKU', 'Name', 'Category', 'Brand', 'Barcode', 'Status',
    // ... all 81 columns matching ensure-sheets.ts
  ],

// ✅ Fixed typo
const csvPath = path.resolve(process.cwd(), 'packaging.csv');

// ✅ Complete feature set
- OrderLines ✓
- QuoteLines ✓
- Pricing_Params ✓
- PartnerTiers ✓
- Channels ✓
- AmazonSizeTiers ✓
- SEO slug mapping ✓
- Proper error handling ✓
```

## Best Practices

1. **Always run DRY_RUN first** to preview changes
2. **Use FULL_RESET=true** when rebuilding from scratch
3. **Keep WRITE_COOLDOWN_MS >= 3000** to respect quotas
4. **Use SEED for reproducible** test data
5. **Run validation** (Script 07) after seeding
6. **Run pricing-master.ts** to complete pricing calculations

## Related Files

- `server/lib/ensure-sheets.ts` - Production schema definitions
- `server/config/hairoticmen-pricing.json` - Product master data
- `server/config/product-slug-mapping-complete.json` - SEO URL mappings
- `server/scripts/pricing-master.ts` - Pricing calculation engine
- `server/scripts/build-sheet-from-scratch/07-validate-and-repair-workbook.ts` - Validation

## Support

For issues or questions:
1. Check this guide first
2. Review error messages carefully
3. Try DRY_RUN mode to diagnose
4. Check Google Sheets quotas if writes fail
5. Verify SHEETS_SPREADSHEET_ID is correct

---

**Version**: 2.2.1  
**Last Updated**: November 16, 2025  
**Maintained by**: MH Trading OS Team
