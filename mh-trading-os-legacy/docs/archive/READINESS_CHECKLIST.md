# Readiness Checklist: Pricing Law Migration

**Migration ID**: PRICING-LAW-FINAL  
**Date**: 2025-01-11  
**Status**: IN PROGRESS  

## Pre-Migration Checklist

### Safety & Snapshot
- [ ] MIGRATION_PLAN.md created and reviewed
- [ ] READINESS_CHECKLIST.md created
- [ ] SAFETY_SNAPSHOT.md generated
- [ ] Single spreadsheet ID confirmed (no duplicates)
- [ ] All secrets moved to Replit Secrets (none in Sheets)
- [ ] sheetsService secret blocking verified
- [ ] Baseline data export saved

---

## Phase 0: Safety & Snapshot

### 0.1 Documentation
- [ ] MIGRATION_PLAN.md complete
- [ ] READINESS_CHECKLIST.md complete
- [ ] SAFETY_SNAPSHOT.md complete with:
  - [ ] Current SHEETS_SPREADSHEET_ID documented
  - [ ] All secret keys inventory
  - [ ] Sheets count and structure baseline
  - [ ] Code references to spreadsheet IDs audited

### 0.2 Spreadsheet ID Validation
- [ ] `grep -r "SHEETS_SPREADSHEET_ID" .` shows single ID
- [ ] No hardcoded spreadsheet IDs in code
- [ ] No URLs with `/edit?gid=` in codebase
- [ ] `server/lib/sheets.ts` sanitization confirmed

### 0.3 Secrets Audit
- [ ] `server/scripts/clean-secrets-from-sheet.ts` executed
- [ ] No API keys in Settings sheet
- [ ] No email credentials in Settings sheet
- [ ] SECRET_KEYS list up-to-date in sheets.ts
- [ ] sheetsService.updateRow() blocks secret writes

**Phase 0 Status**: ⬜ NOT STARTED | ⏳ IN PROGRESS | ✅ COMPLETE

---

## Phase 1: Google Sheets Unification

### 1.1 Schema Extensions (shared/schema.ts)
- [ ] `Channels` schema defined
- [ ] `AmazonSizeTiers` schema defined
- [ ] `ShippingMatrix_DHL` schema defined
- [ ] `DHL_Surcharges` schema defined
- [ ] `Boxes` schema defined
- [ ] `QuantityDiscounts` schema defined
- [ ] `DiscountCaps` schema defined
- [ ] `OrderDiscounts` schema defined
- [ ] `Pricing_Line_Targets` schema defined
- [ ] `FinalPriceList` schema extended with:
  - [ ] `Shipping_Inbound_per_unit`
  - [ ] `EPR_LUCID_per_unit`
  - [ ] `GS1_per_unit`
  - [ ] `Retail_Packaging_per_unit`
  - [ ] `QC_PIF_per_unit`
  - [ ] `Operations_per_unit`
  - [ ] `Marketing_per_unit`
  - [ ] `FullCost_EUR`
  - [ ] `Grundpreis`
  - [ ] `Grundpreis_Unit`
  - [ ] `Amazon_TierKey`
  - [ ] `Line` (Premium/Pro/Basic/Tools)

### 1.2 ensure-sheets.ts Updates
- [ ] All new sheets added to `REQUIRED_SHEETS`
- [ ] Headers match specification
- [ ] Numeric columns specified
- [ ] Seed data prepared for:
  - [ ] Channels (OwnStore, Amazon_FBM, Amazon_FBA)
  - [ ] AmazonSizeTiers (10+ standard tiers)
  - [ ] DHL_Surcharges (LKW_CO2, Peak, Peak_in_Peak, Energy)
  - [ ] Boxes (S, M, L, XL)
  - [ ] QuantityDiscounts (5 tiers)
  - [ ] DiscountCaps (per role)
  - [ ] OrderDiscounts (3 thresholds)
  - [ ] Pricing_Line_Targets (4 lines)
- [ ] Named ranges defined:
  - [ ] `LINE_LIST`
  - [ ] `CHANNEL_LIST`
  - [ ] `QUOTE_STATUS`
  - [ ] `ORDER_STATUS`

### 1.3 Sheets Execution & Reporting
- [ ] `ensureSheets()` executed successfully
- [ ] All new sheets created in Google Sheets
- [ ] Seed data backfilled
- [ ] Named ranges visible in Sheets
- [ ] SHEETS_STRUCTURE_REPORT.md generated
- [ ] No errors in OS_Logs

**Phase 1 Status**: ⬜ NOT STARTED | ⏳ IN PROGRESS | ✅ COMPLETE

---

## Phase 2: Backend Pricing Engine

### 2.1 pricing-law.ts Implementation
- [ ] File created: `server/lib/pricing-law.ts`
- [ ] `calculateFullCost()` implemented
- [ ] `calculateGrundpreis()` implemented
- [ ] `calculateChannelCosts()` implemented for:
  - [ ] OwnStore (Stripe/PayPal)
  - [ ] Amazon_FBM (referral, DHL, box)
  - [ ] Amazon_FBA (referral, FBA fees + €0.26)
- [ ] `enforceConstraints()` implemented with priority chain
- [ ] `calculateB2BNet()` implemented with:
  - [ ] Role discounts
  - [ ] Quantity tiers
  - [ ] Discount caps
  - [ ] Order-level discounts
- [ ] Guardrail enforcement (≥45%) active
- [ ] MAP enforcement active
- [ ] Competitor tracking scheduled job created

### 2.2 Unit Tests
- [ ] Test file created: `server/lib/__tests__/pricing-law.test.ts`
- [ ] Tests pass: FullCost calculation
- [ ] Tests pass: Grundpreis formatting (€/L, €/kg)
- [ ] Tests pass: UVP rounding (web .49/.99, salon .95)
- [ ] Tests pass: Amazon referral (8% vs 15%, min €0.30)
- [ ] Tests pass: FBA fees lookup + €0.26
- [ ] Tests pass: Stripe fees (1.5% + €0.25)
- [ ] Tests pass: PayPal fees (2.49% + €0.39)
- [ ] Tests pass: DHL surcharges (all 4 types)
- [ ] Tests pass: Returns accounting (2-3%)
- [ ] Tests pass: Loyalty accounting (0.7%)
- [ ] Tests pass: Box cost allocation
- [ ] Tests pass: Guardrail <45% → warning
- [ ] Tests pass: MAP violation blocking
- [ ] Tests pass: Constraint priority chain
- [ ] Tests pass: B2B role discounts (all 4 roles)
- [ ] Tests pass: Quantity tier discounts
- [ ] Tests pass: Discount caps
- [ ] Tests pass: Order-level discounts

### 2.3 Feature Flag Integration
- [ ] `PRICING_LAW_V2_ENABLED` env var defined
- [ ] `server/lib/pricing.ts` updated with flag check
- [ ] Legacy pricing (v1) preserved
- [ ] V2 pricing callable when flag ON
- [ ] Backward compatibility tested (flag OFF → v1 works)

**Phase 2 Status**: ⬜ NOT STARTED | ⏳ IN PROGRESS | ✅ COMPLETE

---

## Phase 3: Data Migration & Backfill

### 3.1 Migration Script
- [ ] File created: `server/scripts/migrate-pricing-law.ts`
- [ ] Dry-run mode implemented
- [ ] Live mode implemented
- [ ] Conservative defaults defined:
  - [ ] Shipping_Inbound_per_unit: €0.50
  - [ ] EPR_LUCID_per_unit: €0.05
  - [ ] GS1_per_unit: €0.02
  - [ ] Retail_Packaging_per_unit: €0.30
  - [ ] QC_PIF_per_unit: €0.10
  - [ ] Operations_per_unit: €0.15
  - [ ] Marketing_per_unit: €0.20
- [ ] Amazon_TierKey inference logic
- [ ] Line inference logic (from Category)
- [ ] Idempotent execution (re-runnable)

### 3.2 Dry-Run Execution
- [ ] Dry-run executed: `npm run migrate:pricing-law -- --dry-run`
- [ ] Affected SKUs identified
- [ ] SKUs below 45% guardrail flagged
- [ ] Output saved: `migration-dry-run.json`
- [ ] Sales team notified of flagged SKUs

### 3.3 Live Migration
- [ ] Flag set: `PRICING_LAW_V2_ENABLED=true`
- [ ] Live migration executed
- [ ] All SKUs updated with FullCost components
- [ ] Grundpreis calculated for all SKUs
- [ ] Amazon_TierKey assigned
- [ ] Line assigned
- [ ] No errors in OS_Logs
- [ ] Data spot-checked in Google Sheets

### 3.4 Price Validation Report
- [ ] Validation script created
- [ ] Report generated: `docs/PRICE_VALIDATION_REPORT.md`
- [ ] CSV exported: `exports/price-validation-{timestamp}.csv`
- [ ] Per-SKU validation includes:
  - [ ] UVP_Inc (with VAT)
  - [ ] MinInc_99 (retail minimum)
  - [ ] PostChannel_Pct (margin after channel costs)
  - [ ] Guardrail_OK (≥45% pass/fail)
  - [ ] MAP_OK (UVP ≥ MAP)
  - [ ] PAngV_OK (Grundpreis valid)
- [ ] Pricing_Suggestions populated for failed SKUs

**Phase 3 Status**: ⬜ NOT STARTED | ⏳ IN PROGRESS | ✅ COMPLETE

---

## Phase 4: Frontend UI Updates

### 4.1 Pricing Studio Page
- [ ] FullCost breakdown editor added (8 components)
- [ ] UVP display updated
- [ ] Grundpreis displayed below UVP
- [ ] Per-channel margin bars added:
  - [ ] OwnStore bar
  - [ ] Amazon_FBM bar
  - [ ] Amazon_FBA bar
  - [ ] Color coding (green ≥45%, yellow 40-44%, red <40%)
- [ ] "Explain Pricing" drawer implemented with:
  - [ ] FullCost breakdown
  - [ ] Channel cost drivers
  - [ ] Guardrail status
  - [ ] MAP compliance
  - [ ] Constraint resolution log

### 4.2 Quote Builder Enhancements
- [ ] Partner dropdown functional
- [ ] "+ New Partner" inline modal added
- [ ] Role discount badges displayed
- [ ] Quantity tier discounts shown as applied
- [ ] Caps enforcement warnings visible
- [ ] Order-level discount displayed
- [ ] Guardrail warnings shown (yellow/red)
- [ ] PDF export functional
- [ ] QR code embedded in PDF
- [ ] OS_Logs entries created for quote actions

### 4.3 Shipping/Operations UI
- [ ] Weight-band selector added
- [ ] Live DHL cost preview shown
- [ ] Surcharges breakdown displayed:
  - [ ] LKW CO₂: €0.19
  - [ ] Peak: €0.19
  - [ ] Peak-in-Peak: €0.50
  - [ ] Energy (from Settings)
- [ ] Box selector added
- [ ] Box cost allocation shown

### 4.4 AI Hub Integration
- [ ] "Reprice SKU(s)" button added
- [ ] "Audit PAngV" button added
- [ ] "Suggest Bundle" button added
- [ ] AI outputs routed to Draft tables:
  - [ ] Pricing_Suggestions_Draft
  - [ ] AI_Outbox
  - [ ] Bundles_Draft
- [ ] Human approval workflow functional
- [ ] Apply to main sheets working

**Phase 4 Status**: ⬜ NOT STARTED | ⏳ IN PROGRESS | ✅ COMPLETE

---

## Phase 5: Testing & Validation

### 5.1 Unit Tests
- [ ] All pricing-law.ts tests pass (see Phase 2.2)
- [ ] Test coverage ≥80%
- [ ] No failing tests in `npm test`

### 5.2 Integration Tests
- [ ] Test file created: `server/lib/__tests__/pricing-integration.test.ts`
- [ ] Light SKU tested (50g, Basic, OwnStore)
- [ ] Medium SKU tested (500g, Pro, Amazon_FBA)
- [ ] Heavy SKU tested (1500g, Premium, Amazon_FBM)
- [ ] All channels validated per SKU
- [ ] Guardrails validated per SKU
- [ ] MAP enforcement validated per SKU

### 5.3 E2E Tests
- [ ] E2E test plan created for Stand role quote
- [ ] E2E test plan created for Distributor role quote
- [ ] Tests executed via `run_test` tool
- [ ] Quote creation flow validated
- [ ] Quantity tier discounts verified
- [ ] Guardrail warnings verified
- [ ] Total calculations verified
- [ ] PDF export verified
- [ ] QR code verified
- [ ] Commission ledger verified
- [ ] Loyalty points verified

### 5.4 Health & Lint
- [ ] OS_Health entry added: "Spreadsheet Validation PASS"
- [ ] OS_Health entry added: "Pricing Law PASS"
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] No console errors in browser
- [ ] No critical warnings in logs

**Phase 5 Status**: ⬜ NOT STARTED | ⏳ IN PROGRESS | ✅ COMPLETE

---

## Phase 6: Documentation & Handoff

### 6.1 Delivery Reports
- [ ] PHASE_PRICING_LAW_DELIVERY.md created
- [ ] SHEETS_DELTA_SUMMARY.md created
- [ ] UI_CHANGELOG.md created
- [ ] Rollback instructions documented

### 6.2 Acceptance Criteria Verification

#### System-Level
- [ ] Single Sheet ID in env; no secrets in Sheets
- [ ] All mandatory sheets/headers exist with seed rows
- [ ] Named ranges created and functional
- [ ] Feature flag strategy documented
- [ ] Rollback plan tested

#### Per-SKU Validation
For a sample of 10 SKUs across all lines (Premium/Pro/Basic/Tools):
- [ ] Grundpreis visible & correct format (€/L or €/kg)
- [ ] Guardrail PostChannel ≥45% for OwnStore (or flagged in Pricing_Suggestions)
- [ ] MAP never violated (UVP ≥ MAP)
- [ ] Amazon referral calculated correctly (8% or 15%)
- [ ] FBA fees include €0.26 surcharge
- [ ] DHL surcharges applied (LKW_CO2, Peak, Energy)
- [ ] Stripe/PayPal fees accounted (1.5%/2.49% + fixed)
- [ ] Returns% accounted (2-3%)
- [ ] Loyalty% accounted (0.7%)
- [ ] Floor multiplier respected (UVP ≥ FullCost × Multiplier)
- [ ] Rounding rules applied (web .49/.99, salon .95)

#### QuoteBuilder Validation
- [ ] Partner selection works
- [ ] "+ New Partner" modal works
- [ ] Dealer Basic role discount applied
- [ ] Dealer Plus role discount applied
- [ ] Stand role discount applied
- [ ] Distributor role discount applied
- [ ] Quantity tier discounts applied correctly
- [ ] Discount caps enforced
- [ ] Order-level discounts applied at thresholds
- [ ] Guardrail warnings shown for <45% SKUs
- [ ] Total calculation matches manual verification
- [ ] PDF export generates successfully
- [ ] QR code embedded in PDF
- [ ] Commission ledger entry created
- [ ] Loyalty ledger entry created

#### Reports & Logs
- [ ] PRICE_VALIDATION_REPORT.md exists
- [ ] Validation CSV exported
- [ ] All SKUs have PASS/FAIL flags
- [ ] OS_Logs entries present for all critical actions
- [ ] OS_Health shows green for pricing validations

#### UI/UX
- [ ] No breaking console errors
- [ ] No 404s or failed API calls
- [ ] Loading states present
- [ ] Error messages user-friendly
- [ ] Dark mode works
- [ ] Bilingual (EN/AR) functional
- [ ] Responsive design intact

**Phase 6 Status**: ⬜ NOT STARTED | ⏳ IN PROGRESS | ✅ COMPLETE

---

## Final Go/No-Go Checklist

### Critical Success Factors
- [ ] All Phase 0-5 tasks complete
- [ ] All acceptance criteria verified
- [ ] Zero data loss confirmed
- [ ] Rollback plan tested
- [ ] Feature flag ready (can toggle ON/OFF)
- [ ] Sales team briefed
- [ ] Tech team ready for support
- [ ] Monitoring active (OS_Health, OS_Logs)

### Known Issues (if any)
- [ ] No blocking issues
- [ ] Minor issues documented in KNOWN_LIMITATIONS.md
- [ ] Workarounds communicated

### Sign-Off
- [ ] Tech Lead approval
- [ ] Product Owner approval
- [ ] Sales Director approval (for SKUs <45% plan)
- [ ] Operations approval (for DHL surcharges)

---

## Post-Migration Checklist (T+7 days)

### Monitoring
- [ ] OS_Health reviewed daily
- [ ] OS_Logs reviewed for errors
- [ ] User feedback collected
- [ ] Quote volumes normal
- [ ] No rollback triggered

### Metrics
- [ ] Total SKUs migrated: ___
- [ ] SKUs passing guardrails (≥45%): ___
- [ ] SKUs in Pricing_Suggestions: ___
- [ ] Quotes created with v2 pricing: ___
- [ ] PDF exports generated: ___
- [ ] User-reported issues: ___

### Final Report
- [ ] Post-migration review completed
- [ ] Lessons learned documented
- [ ] Technical debt items logged
- [ ] Feature flag removal planned (if stable)
- [ ] READINESS_CHECKLIST.md archived

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-11  
**Migration Owner**: MH Trading OS Team  
**Status**: ⏳ IN PROGRESS
