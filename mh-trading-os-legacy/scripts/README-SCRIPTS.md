# MH Trading OS - Script Directory

## 🎯 Core Production Scripts

### 1. Database Rebuild (Build from Scratch)
```
build-sheet-from-scratch/
  ├── 01-create-sheets.ts         ✅ Creates 92 Google Sheets
  ├── 02-seed-master-data.ts      ✅ Seeds master data (lines, tiers, etc.)
  ├── 03-seed-product-data.ts     ✅ Seeds 89 products
  └── 04-setup-formulas.ts        ✅ Sets up dropdowns & validations
```

### 2. Category Management
```
fix-categories-and-prices.ts      ✅ Main: Fix categories & clean factory prices
update-category-enums.ts          ✅ Updates Enums sheet with categories
final-category-verification.ts    ✅ Verifies all 10 categories are correct
```

### 3. Weight & Logistics
```
update-all-weight-data.ts         ✅ Main: Updates all weight & carton data
fix-qr-urls.ts                    ✅ Updates QR codes to hairoticmen.de
```

### 4. Pricing Engine
```
pricing-master.ts                 ✅ Main: V2.2 pricing engine orchestrator
fix-pricing-gaps.ts               ✅ Fixes missing cost fields & calculations
```

### 5. Product Analysis
```
analyze-all-products-v22.ts       ✅ Analyzes pricing for all products
analyze-pricing-data.ts           ✅ Pricing data analysis
```

### 6. Utilities
```
bootstrap-sheets.ts               ✅ Bootstrap entire sheet infrastructure
audit-google-sheets.ts            ✅ Audit all sheets status
check-current-sheet-state.ts      ✅ Check current state
```

## 🗑️ Cleaned Up (23 scripts deleted)

### Category Duplicates (6 deleted)
- ❌ analyze-categories-and-prices.ts
- ❌ show-all-categories.ts
- ❌ verify-categories-prices-final.ts
- ❌ verify-current-categories.ts
- ❌ check-all-columns.ts
- ❌ check-factory-prices-raw.ts

### Weight Duplicates (5 deleted)
- ❌ verify-weight-data.ts
- ❌ verify-all-weights-final.ts
- ❌ final-weight-verification.ts
- ❌ fix-kit-weights.ts
- ❌ update-weight-data-fixed.ts

### QR Code Duplicates (2 deleted)
- ❌ fix-qr-by-row-position.ts
- ❌ fix-all-qr-urls-final.ts

### Column Fix Duplicates (4 deleted)
- ❌ batch-fix-columns.ts
- ❌ simple-column-fix.ts
- ❌ fix-finalpricelist-complete.ts
- ❌ fix-missing-net-content.ts

### Verification Duplicates (4 deleted)
- ❌ verify-step4-complete.ts
- ❌ verify-pricing.ts
- ❌ verify-and-finalize-pricing-v3.ts
- ❌ verify-migration.ts

### Other Temporary (2 deleted)
- ❌ fix-quotes-headers.ts

## 📋 Quick Reference

### Rebuild Everything from Scratch
```bash
# Step 1: Create all 92 sheets
tsx server/scripts/build-sheet-from-scratch/01-create-sheets.ts

# Step 2: Seed master data
tsx server/scripts/build-sheet-from-scratch/02-seed-master-data.ts

# Step 3: Seed 89 products
tsx server/scripts/build-sheet-from-scratch/03-seed-product-data.ts

# Step 4: Setup formulas & dropdowns
tsx server/scripts/build-sheet-from-scratch/04-setup-formulas.ts
```

### Fix Specific Issues
```bash
# Fix categories & factory prices
tsx server/scripts/fix-categories-and-prices.ts

# Update weight data
tsx server/scripts/update-all-weight-data.ts

# Fix QR codes
tsx server/scripts/fix-qr-urls.ts

# Fix pricing gaps
tsx server/scripts/fix-pricing-gaps.ts
```

### Verify Data
```bash
# Verify categories
tsx server/scripts/final-category-verification.ts

# Verify pricing
tsx server/scripts/analyze-all-products-v22.ts

# Audit all sheets
tsx server/scripts/audit-google-sheets.ts
```

### Run Pricing Engine
```bash
# Calculate all prices with V2.2 engine
tsx server/scripts/pricing-master.ts
```

## ✅ Current Status

**Database Infrastructure:** ✅ Complete
- 92 sheets created
- 89 products seeded
- 10 categories properly assigned
- Factory costs: 100% populated (€0.56-€52.15)
- Weight/logistics: Complete carton data
- Dropdowns: Line, Box_Size, Amazon_TierKey

**Scripts:** ✅ Cleaned
- 23 duplicate/temporary scripts deleted
- ~15 core production scripts retained
- Clear organization by function
- No conflicts or duplications

**Ready for:** 🚀 Production
- Pricing engine integration
- Real-time pricing updates
- B2B operations
