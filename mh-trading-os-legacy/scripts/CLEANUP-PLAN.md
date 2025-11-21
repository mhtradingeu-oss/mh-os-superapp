# Script Cleanup Plan

## ✅ KEEP - Core Production Scripts

### Category Management
- `fix-categories-and-prices.ts` - Main category & price fixer ✅
- `update-category-enums.ts` - Updates Enums sheet ✅
- `final-category-verification.ts` - Verification ✅

### Weight & Logistics
- `update-all-weight-data.ts` - Main weight updater ✅

### Pricing
- `pricing-master.ts` - Main pricing engine ✅
- `fix-pricing-gaps.ts` - Fix pricing gaps ✅

### Build Scripts
- `build-sheet-from-scratch/01-create-sheets.ts` ✅
- `build-sheet-from-scratch/02-seed-master-data.ts` ✅
- `build-sheet-from-scratch/03-seed-product-data.ts` ✅
- `build-sheet-from-scratch/04-setup-formulas.ts` ✅

## ❌ DELETE - Duplicate/Temporary Scripts

### Category Duplicates
- `analyze-categories-and-prices.ts` (duplicate of final-category-verification)
- `show-all-categories.ts` (duplicate listing)
- `verify-categories-prices-final.ts` (duplicate verification)
- `verify-current-categories.ts` (duplicate verification)
- `check-all-columns.ts` (temporary check)
- `check-factory-prices-raw.ts` (temporary check)

### Weight Duplicates
- `verify-weight-data.ts` (duplicate of update-all-weight-data)
- `verify-all-weights-final.ts` (duplicate verification)
- `final-weight-verification.ts` (duplicate verification)
- `fix-kit-weights.ts` (already handled in update-all-weight-data)
- `update-weight-data-fixed.ts` (old version)

### QR Code Duplicates
- `fix-qr-by-row-position.ts` (old approach)
- `fix-all-qr-urls-final.ts` (duplicate)
KEEP: `fix-qr-urls.ts` (main QR fixer)

### Column Fix Duplicates
- `batch-fix-columns.ts` (temporary)
- `simple-column-fix.ts` (temporary)
- `fix-finalpricelist-complete.ts` (temporary)
- `fix-missing-net-content.ts` (temporary)

### Verification Duplicates
- `verify-step4-complete.ts` (temporary)
- `verify-pricing.ts` (duplicate)
- `verify-and-finalize-pricing-v3.ts` (duplicate)
- `verify-migration.ts` (old migration)

### Other Temporary
- `fix-quotes-headers.ts` (one-time fix)

Total to delete: ~20 scripts
