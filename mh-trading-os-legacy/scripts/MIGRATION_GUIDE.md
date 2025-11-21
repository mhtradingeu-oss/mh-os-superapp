# 📦 Pricing Law v2 Migration Guide

## Overview

This guide covers the complete migration process for backfilling Pricing Law v2 fields in FinalPriceList.

## Scripts

### 1. `migrate-pricing-law.ts` - Main Migration Script

Automatically calculates and backfills:
- **FullCost fields** (8 components with conservative defaults)
- **Amazon_TierKey** (inferred from Weight_g + Dims_cm)
- **PostChannel_Margin_Pct** (from Settings or 8% default)
- **Grundpreis** (PAngV compliance)
- **Line** (Premium/Pro/Basic/Tools from Category)
- **Guardrail_OK** (≥45% margin across all channels)

### 2. `verify-migration.ts` - Verification Script

Validates migration completion and reports missing fields.

---

## 🚀 Step-by-Step Migration

### Step 1: Dry-Run (Preview Only)

```bash
npx tsx server/scripts/migrate-pricing-law.ts --dry-run
```

**What it does:**
- ✅ Reads all SKUs from FinalPriceList
- ✅ Calculates Amazon_TierKey from dimensions & weight
- ✅ Fetches PostChannel_Margin_Pct from Settings (or uses 8%)
- ✅ Calculates FullCost, Grundpreis, margins
- ✅ Saves preview to `migration-dry-run.json`
- ❌ **Does NOT write to Google Sheets**

**Expected Output:**
```
🚀 Starting Pricing Law v2 Migration...
Mode: DRY-RUN (no writes)

✓ Using PostChannel margin default from Settings: 8%

📥 Loading pricing context data...
✅ Loaded: 3 channels, 12 tiers, 48 rates, 3 surcharges

📥 Fetching FinalPriceList...
Found 91 SKUs

📊 Migration Summary:
   Total SKUs: 91
   SKUs needing migration: 91
   SKUs already migrated: 0
   SKUs below 45% guardrail: 0

📝 Full report saved to: migration-dry-run.json

💡 To execute migration, run: npx tsx server/scripts/migrate-pricing-law.ts
```

**Review the JSON output:**
```bash
cat migration-dry-run.json | grep -A 5 "sku"
```

Check for:
- ✅ All SKUs have `Amazon_TierKey`
- ✅ All SKUs have `postChannelMargin`
- ✅ No SKUs with `guardrailStatus: "FAIL"`
- ✅ Reasonable `appliedDefaults` values

---

### Step 2: Execute Live Migration

```bash
npx tsx server/scripts/migrate-pricing-law.ts
```

**What it does:**
- ✅ Writes all calculated fields to FinalPriceList
- ✅ Updates Google Sheets in batches (10 SKUs/batch)
- ✅ Logs migration stats to ActionLog sheet
- ✅ Saves final report to `migration-results.json`

**Expected Output:**
```
🚀 Starting Pricing Law v2 Migration...
Mode: LIVE (will update Google Sheets)

✓ Using PostChannel margin default from Settings: 8%

📥 Loading pricing context data...
✅ Loaded: 3 channels, 12 tiers, 48 rates, 3 surcharges

📥 Fetching FinalPriceList...
Found 91 SKUs

✅ Updated 10 SKUs...
✅ Updated 20 SKUs...
...
✅ Updated 90 SKUs...

📊 Migration Summary:
   Total SKUs: 91
   SKUs needing migration: 91
   SKUs already migrated: 0
   SKUs updated: 91
   SKUs below 45% guardrail: 0

📝 Full report saved to: migration-results.json
✅ Logged migration stats to ActionLog

✅ Migration complete!
```

---

### Step 3: Verify Migration

```bash
npx tsx server/scripts/verify-migration.ts
```

**What it does:**
- ✅ Checks all 91 SKUs for required fields
- ✅ Reports completion percentage
- ✅ Shows missing fields breakdown

**Expected Output (Success):**
```
🔍 Starting Migration Verification...

📥 Fetching FinalPriceList...
Found 91 SKUs

📊 Verification Summary:

   Total SKUs: 91
   ✅ Complete: 91 (100%)
   ❌ Incomplete: 0

🎉 ALL SKUS MIGRATED SUCCESSFULLY!

📈 Field Coverage:
   FullCost_EUR: 91/91
   Amazon_TierKey: 91/91
   PostChannel_Margin_Pct: 91/91
   Guardrail_OK: 91/91

✅ Migration verification PASSED
   All SKUs have complete pricing data
```

**Expected Output (Incomplete):**
```
🔍 Starting Migration Verification...

📥 Fetching FinalPriceList...
Found 91 SKUs

📊 Verification Summary:

   Total SKUs: 91
   ✅ Complete: 85 (93.41%)
   ❌ Incomplete: 6

⚠️  Missing Fields Breakdown:
      Amazon_TierKey: 6 SKUs (7%)
      PostChannel_Margin_Pct: 3 SKUs (3%)

   First 5 Incomplete SKUs:
      1. HT-0050: Missing Amazon_TierKey
      2. HT-0051: Missing Amazon_TierKey, PostChannel_Margin_Pct
      3. HT-0052: Missing Amazon_TierKey
      ...

⚠️  Migration verification MOSTLY PASSED
   93.41% complete - review incomplete SKUs above
```

---

## 📊 Amazon_TierKey Inference Logic

The script automatically calculates Amazon FBA tiers based on:

| Tier | Dimensions | Weight | Logic |
|------|-----------|--------|-------|
| **SMALL_STANDARD** | ≤45×34×26cm | ≤1kg | Most small items |
| **LARGE_STANDARD** | ≤61×46×46cm | ≤30kg | Standard boxes |
| **SMALL_OVERSIZE** | L+girth ≤270cm | ≤70kg | Longer items |
| **LARGE_OVERSIZE** | > 270cm or >70kg | - | Bulky items |

**Fallback Logic:**
- If only **Weight_g** available → tier by weight ranges
- If only **Dims_cm** available → tier by longest side
- If **both missing** → returns `null` (manual review needed)

**Format:** `Dims_cm` must be `"LxWxH"` (e.g., `"45x30x20"`)

---

## 📊 PostChannel_Margin_Pct Configuration

The script reads from Settings sheet:

1. **Tries Settings first:**
   ```
   Key: POSTCHANNEL_MARGIN_DEFAULT_PCT
   Value: 8
   ```

2. **Fallback if missing:**
   - Uses **8%** as safe default

3. **Validation:**
   - Must be between 0-100
   - Non-numeric values → fallback to 8%

**To customize:** Add to Settings sheet before migration:
```
Key                              | Value | Category
---------------------------------|-------|----------
POSTCHANNEL_MARGIN_DEFAULT_PCT   | 12    | Pricing
```

---

## 🔧 Troubleshooting

### Issue: "Required support sheets are empty"

**Solution:** Seed pricing data first:
```bash
npx tsx server/scripts/seed-pricing-sheets.ts
```

### Issue: Amazon_TierKey missing after migration

**Causes:**
- Missing `Weight_g` in FinalPriceList
- Missing or malformed `Dims_cm` (format must be `"LxWxH"`)

**Solution:**
1. Check FinalPriceList for blank Weight_g/Dims_cm
2. Fill missing data manually
3. Re-run migration (idempotent - safe)

### Issue: Guardrail_OK = false for many SKUs

**Causes:**
- UVP too low relative to FullCost
- High channel costs (FBA fees, shipping)

**Solution:**
1. Review `migration-results.json` for failing SKUs
2. Check `warnings` field for specific channels
3. Adjust UVP or reduce COGS/FullCost components

### Issue: Rate limit errors during migration

**Solution:** Script already includes:
- Batch processing (10 SKUs at a time)
- 2-second delay between batches
- Disabled per-row logging

If still hitting limits, increase `BATCH_DELAY_MS` in script.

---

## 📁 Output Files

| File | Description | When Created |
|------|-------------|--------------|
| `migration-dry-run.json` | Preview of changes | After --dry-run |
| `migration-results.json` | Final migration report | After live run |

**JSON Structure:**
```json
{
  "totalSKUs": 91,
  "skusUpdated": 91,
  "skusSkipped": 0,
  "skusBelowGuardrail": 0,
  "results": [
    {
      "sku": "HT-0001",
      "name": "Product Name",
      "hasExistingFullCost": false,
      "appliedDefaults": ["Shipping_Inbound_per_unit", ...],
      "oldFullCost": null,
      "newFullCost": 12.45,
      "inferredAmazonTier": "SMALL_STANDARD",
      "postChannelMargin": 52.3,
      "guardrailStatus": "PASS",
      "warnings": []
    }
  ],
  "timestamp": "2025-01-12T22:00:00.000Z"
}
```

---

## ✅ Post-Migration Checklist

After successful migration:

- [ ] Run verify-migration.ts → 100% complete
- [ ] Check ActionLog sheet for migration stats
- [ ] Review migration-results.json for warnings
- [ ] Spot-check 5-10 SKUs manually in FinalPriceList:
  - [ ] FullCost_EUR looks reasonable
  - [ ] Amazon_TierKey matches product size
  - [ ] PostChannel_Margin_Pct > 45%
  - [ ] Guardrail_OK = true for most SKUs
- [ ] Test pricing calculations in Pricing Studio
- [ ] Run a test quote in Sales Desk

---

## 🔄 Re-running Migration

The script is **idempotent** - safe to run multiple times:

- ✅ Skips SKUs that already have all required fields
- ✅ Only updates missing/incomplete fields
- ✅ Recalculates margins based on latest channel data

**Use case:** Add new SKUs to FinalPriceList, then re-run:
```bash
npx tsx server/scripts/migrate-pricing-law.ts
```

Only new SKUs will be migrated.

---

## 📞 Support

If migration fails or verification shows <95% completion:

1. Check logs in ActionLog sheet
2. Review migration-results.json warnings
3. Verify FinalPriceList has Weight_g, Dims_cm for all SKUs
4. Confirm Settings sheet has POSTCHANNEL_MARGIN_DEFAULT_PCT
5. Re-run migration with --dry-run first

**Common Fields to Check:**
- `Weight_g` → Required for tier calculation
- `Dims_cm` → Format: `"LxWxH"` in cm
- `COGS_EUR` → Base for FullCost calculation
- `UVP` → Required for margin calculation
