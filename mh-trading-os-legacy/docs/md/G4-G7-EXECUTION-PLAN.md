# G4-G7 Execution Plan — Final Migration Phases

**Status:** Ready for execution (pending user approval)  
**Date:** November 17, 2025  
**System:** MH Trading OS v3 Greenfield Migration

---

## 🎯 Overview

This document outlines the remaining 4 phases (G4-G7) of the migration from the legacy Google Sheets system to the new MH Trading OS v3 infrastructure.

**Completed Phases:**
- ✅ **G0**: Bootstrap Drive & Auth — Created new Drive folder structure with PROD/STAGING sheets
- ✅ **G1**: Schema Install — Installed 21 canonical sheets on both PROD and STAGING
- ✅ **G2**: Safe Seeding — Seeded STAGING with 48 rows of realistic demo data across 10 sheets
- ✅ **G3**: Legacy Read-Only Scan — Scanned 121 legacy sheets, identified 7 matching sheets

**Remaining Phases:**
- 🔄 **G4**: Selective Copy (Legacy → STAGING)
- 🔄 **G5**: Smoke Test (STAGING validation)
- 🔄 **G6**: Production Switch (cutover)
- 🔄 **G7**: Archival & Cleanup

---

## 📋 Phase G4 — Selective Copy (Legacy → STAGING)

### Goal
Copy production data from legacy sheet to STAGING for the 7 matching sheets only. Leave 114 orphaned legacy sheets untouched.

### Matching Sheets to Migrate
Based on G3 scan results:

1. **FinalPriceList** (31/94 columns match)
2. **Enums** (5/13 columns match)
3. **Shipping_WeightBands** (3/16 columns match)
4. **Shipping_Costs_Fixed** (1/8 columns match)
5. **CRM_Leads** (10/21 columns match)
6. **_README** (0/0 columns - empty in legacy)
7. **_SETTINGS** (5/5 columns - perfect match ✅)

### Strategy

**For each matching sheet:**
1. Read ALL rows from legacy sheet
2. Map legacy columns → new schema columns (handle renames)
3. Transform data as needed (date formats, enum values, etc.)
4. Write to STAGING sheet (append mode)
5. Validate row counts match

**Critical Rules:**
- ❌ **NEVER** write to PROD (only STAGING)
- ❌ **NEVER** modify legacy sheet (read-only)
- ✅ Log every transformation for audit trail
- ✅ Skip empty rows
- ✅ Handle missing columns gracefully (fill with defaults)

### Output
- `reports/G4-COPY-SUMMARY.md` — Migration summary
- `reports/G4-COPY-LOG.json` — Detailed transformation log

### Estimated Time
~10-15 minutes (with API rate limiting)

---

## 📋 Phase G5 — Smoke Test (STAGING Validation)

### Goal
Verify STAGING sheet is production-ready by running comprehensive tests.

### Test Suite

#### 1. Data Integrity Tests
- ✅ All 21 sheets exist
- ✅ No NaN or Infinity values in numeric columns
- ✅ All required columns populated
- ✅ Foreign key references valid (e.g., SKU in FinalPriceList exists in Products)
- ✅ Dates formatted correctly (ISO 8601)
- ✅ Enum values match allowed lists

#### 2. Business Logic Tests
- ✅ Pricing calculations correct (COGS, UVP, MAP)
- ✅ Shipping costs within acceptable ranges
- ✅ No duplicate SKUs in Products/FinalPriceList
- ✅ Lead scores in valid range (0-100)

#### 3. Schema Compliance Tests
- ✅ All sheets match schema.map.json
- ✅ Column order consistent
- ✅ Headers formatted correctly (frozen row, styled)

#### 4. API Integration Tests
- ✅ Google Sheets API can read all sheets
- ✅ Service account has correct permissions
- ✅ Rate limiting working correctly

### Validation Tool
Create script: `server/scripts/greenfield-migration/g5-smoke-test.ts`

### Output
- `reports/G5-SMOKE-TEST-RESULTS.md` — Pass/fail for all tests
- ❌ **If any test fails:** STOP migration, fix issues, re-run
- ✅ **If all tests pass:** Proceed to G6

### Estimated Time
~5 minutes

---

## 📋 Phase G6 — Production Switch (Cutover)

### Goal
Switch production traffic from legacy sheet to new PROD sheet.

### Pre-Cutover Checklist
- [ ] G5 smoke tests all passed
- [ ] User approval obtained
- [ ] Backup of legacy sheet created
- [ ] All stakeholders notified
- [ ] Rollback plan documented

### Cutover Steps

**Step 1: Copy STAGING → PROD**
- Copy all data from validated STAGING to PROD
- Verify row counts match exactly
- Validate critical data (SKUs, pricing, leads)

**Step 2: Update Environment Variables**
```bash
# Before:
GOOGLE_SHEET_ID=1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0 (legacy)

# After:
GOOGLE_SHEET_ID=1QntalpXMbGaYCkDrr81g5Ros6NXXj43QpBvdriFVRJY (new PROD)
```

**Step 3: Update Code References**
- Update `server/lib/sheets.ts` to use new PROD sheet ID
- Update `replit.md` with new sheet ID
- Update all documentation

**Step 4: Restart Application**
- Restart workflow to apply new sheet ID
- Verify app loads without errors
- Test critical flows (product listing, pricing, CRM)

**Step 5: Monitor**
- Watch logs for errors
- Check Google Sheets API quota usage
- Verify data reads/writes working

### Rollback Plan
If critical errors occur within first hour:
1. Revert environment variable to legacy sheet ID
2. Restart application
3. Investigate issues
4. Re-run G5 smoke tests

### Output
- `reports/G6-CUTOVER-LOG.md` — Cutover timeline and validation
- Updated `replit.md` with new PROD sheet ID

### Estimated Time
~10 minutes

---

## 📋 Phase G7 — Archival & Cleanup

### Goal
Archive legacy sheet and clean up temporary files.

### Archival Steps

**Step 1: Create Final Backup**
- Export legacy sheet as CSV (all 121 sheets)
- Store in `_BACKUPS` folder in Drive
- Filename: `LEGACY-BACKUP-YYYYMMDD-HHMMSS.zip`

**Step 2: Mark Legacy as Archived**
- Rename legacy sheet: `[ARCHIVED] MH Trading OS - Legacy`
- Add prominent warning in README sheet
- Set sheet to "view only" for all users

**Step 3: Cleanup**
- Delete STAGING sheet (no longer needed)
- Remove temporary migration scripts from codebase
- Archive migration reports to `docs/migrations/2025-11-greenfield/`

**Step 4: Documentation Update**
- Update `replit.md` with migration completion date
- Document new sheet structure
- Update team wiki/docs with new sheet URLs

### Output
- `reports/G7-ARCHIVAL-SUMMARY.md` — Final migration summary
- Legacy backup in Drive `_BACKUPS` folder
- Clean codebase (migration scripts removed)

### Estimated Time
~15 minutes

---

## 📊 Total Estimated Timeline

| Phase | Description | Time |
|-------|-------------|------|
| G4 | Selective Copy | 10-15 min |
| G5 | Smoke Test | 5 min |
| G6 | Production Switch | 10 min |
| G7 | Archival | 15 min |
| **Total** | | **40-45 min** |

---

## ⚠️ Critical Warnings

1. **NEVER modify legacy sheet** — All operations are read-only on legacy
2. **Test on STAGING first** — Never experiment on PROD
3. **Validate before cutover** — G5 smoke tests MUST all pass
4. **Have rollback plan** — Keep legacy sheet ID handy for quick revert
5. **Monitor after cutover** — Watch for errors in first hour

---

## 🎯 Success Criteria

Migration is complete when:
- ✅ All production data migrated to new PROD sheet
- ✅ Application running on new PROD sheet without errors
- ✅ All smoke tests passing
- ✅ Legacy sheet archived safely
- ✅ Documentation updated
- ✅ Team notified of new sheet URLs

---

## 🚀 Ready to Execute?

**Current Status:**
- ✅ G0-G3 completed successfully
- 🔄 G4-G7 planned and documented
- ⏸️ **Awaiting user approval to proceed**

**Next Action:**
Once approved, I will execute G4 (Selective Copy) as the first step of the final migration phases.
