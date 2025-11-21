# Migration Plan: Final Pricing Law Implementation ("القانون الشامل للمحرّك")

**Migration ID**: PRICING-LAW-FINAL  
**Date**: 2025-01-11  
**Owner**: MH Trading OS Team  
**Status**: PLANNING  

## Executive Summary

This migration implements the final comprehensive pricing law for MH Trading OS, introducing an 8-component FullCost model, Grundpreis (PAngV) compliance, channel-specific cost calculations with ≥45% margin guardrails, MAP enforcement, and tiered B2B pricing with quantity discounts.

## Migration Phases

### Phase 0: Safety & Snapshot ✓
**Objective**: Establish safe rollback points and validate current state  
**Duration**: 1 hour  
**Risk**: LOW  

- [x] Document current spreadsheet ID usage (SAFETY_SNAPSHOT.md)
- [x] Audit and clean secrets from Google Sheets
- [x] Create migration planning documents (MIGRATION_PLAN.md, READINESS_CHECKLIST.md)
- [x] Verify sheetsService secret blocking is active

**Success Criteria**: All secrets in Replit Secrets, single SHEETS_SPREADSHEET_ID confirmed, baseline documented

---

### Phase 1: Google Sheets Unification
**Objective**: Ensure all required sheets exist with correct structure  
**Duration**: 2-3 hours  
**Risk**: LOW  
**Feature Flag**: `MIGRATION_PRICING_LAW_ENABLED=false` (default)

#### 1.1 Schema Extension (shared/schema.ts)
Add new sheet schemas:
- `Channels` - OwnStore, Amazon_FBM, Amazon_FBA with fee structures
- `AmazonSizeTiers` - FBA fee tiers by size (+ €0.26/unit Germany 2025)
- `ShippingMatrix_DHL` - Weight bands, zones, base rates
- `DHL_Surcharges` - LKW_CO2 (€0.19), Peak (€0.19), Peak_in_Peak (€0.50), Energy_Surcharge_Var (monthly from Settings)
- `Boxes` - Packaging options with costs
- `QuantityDiscounts` - B2B quantity tiers
- `DiscountCaps` - Maximum discount limits per tier
- `OrderDiscounts` - Order-level discount thresholds
- `Pricing_Line_Targets` - Premium/Pro/Basic/Tools target margins & floor multipliers

Extend `FinalPriceList` schema:
```typescript
// New FullCost breakdown columns
Shipping_Inbound_per_unit: z.number().optional(),
EPR_LUCID_per_unit: z.number().optional(),
GS1_per_unit: z.number().optional(),
Retail_Packaging_per_unit: z.number().optional(),
QC_PIF_per_unit: z.number().optional(),
Operations_per_unit: z.number().optional(),
Marketing_per_unit: z.number().optional(),
FullCost_EUR: z.number().optional(), // Computed: SUM of all above
Grundpreis: z.string().optional(), // e.g., "€45.50/L" or "€12.30/kg"
Grundpreis_Unit: z.enum(['L', 'kg']).optional(),
Amazon_TierKey: z.string().optional(), // FK to AmazonSizeTiers
Line: z.enum(['Premium', 'Pro', 'Basic', 'Tools']).optional(),
```

#### 1.2 Update ensure-sheets.ts
- Add all new sheet definitions to `REQUIRED_SHEETS`
- Include proper headers and numericColumns
- Add seed data for Channels, AmazonSizeTiers, DHL_Surcharges, Boxes, etc.
- Add named ranges:
  - `LINE_LIST` = ['Premium', 'Pro', 'Basic', 'Tools']
  - `CHANNEL_LIST` = ['OwnStore', 'Amazon_FBM', 'Amazon_FBA']
  - `QUOTE_STATUS` = ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired']
  - `ORDER_STATUS` = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled']

#### 1.3 Generate SHEETS_STRUCTURE_REPORT.md
Run `ensureSheets()` and document:
- Sheets created vs. repaired
- Columns added per sheet
- Seed rows backfilled
- Named ranges created
- Any warnings or errors

**Success Criteria**: All new sheets exist, headers match spec, seed data present, SHEETS_STRUCTURE_REPORT.md generated

---

### Phase 2: Backend Pricing Engine (Versioned Implementation)
**Objective**: Implement v2 pricing engine with full cost model and guardrails  
**Duration**: 6-8 hours  
**Risk**: MEDIUM (calculation complexity)  
**Feature Flag**: `PRICING_LAW_V2_ENABLED=false` (controlled rollout)

#### 2.1 Create server/lib/pricing-law.ts
New pricing engine module with:

```typescript
export interface FullCostComponents {
  Factory_Cost_EUR: number;
  Packaging_Cost_EUR: number;
  Freight_kg_EUR: number;
  Import_Duty_Pct: number;
  Overhead_Pct: number;
  // NEW components:
  Shipping_Inbound_per_unit: number;
  EPR_LUCID_per_unit: number;
  GS1_per_unit: number;
  Retail_Packaging_per_unit: number;
  QC_PIF_per_unit: number;
  Operations_per_unit: number;
  Marketing_per_unit: number;
}

export function calculateFullCost(components: FullCostComponents): number {
  // Sum all components, fail hard if mandatory fields missing
  // Return total FullCost_EUR
}

export function calculateGrundpreis(
  FullCost: number,
  UVP: number,
  packSize: number, // e.g., 1000 for 1L = 1000ml
  unit: 'L' | 'kg'
): string {
  // Compute price per base unit (€/L or €/kg)
  // Format as "€XX.XX/L" or "€XX.XX/kg"
  // Validate: must be consistent with pack size/weight
}

export function calculateChannelCosts(
  product: FinalPriceList,
  channel: 'OwnStore' | 'Amazon_FBM' | 'Amazon_FBA',
  UVP_Gross: number,
  context: PricingContext
): ChannelCostBreakdown {
  // Returns:
  // - Payment fees (Stripe/PayPal for OwnStore)
  // - Amazon referral (8% if ≤€10 else 15%, min €0.30)
  // - FBA fees (from AmazonSizeTiers + €0.26/unit)
  // - DHL domestic (FBM only): ShippingMatrix_DHL + surcharges
  // - Returns% (default 2-3% B2C)
  // - Loyalty accounting% (e.g., 0.7%)
  // - Box cost allocation
  // - PostChannel_Margin_Pct
  // - Guardrail_OK: boolean (≥45%)
}

export function enforceConstraints(
  FullCost: number,
  line: 'Premium' | 'Pro' | 'Basic' | 'Tools',
  MAP: number,
  context: PricingContext
): { UVP: number; warnings: string[] } {
  // Priority chain:
  // 1. Legal (MAP/PAngV): UVP ≥ MAP, Grundpreis valid
  // 2. Floor: UVP ≥ FullCost * Floor_Multiplier (from Pricing_Line_Targets)
  // 3. Guardrail: PostChannel_Margin ≥ 45% for OwnStore
  // 4. Rounding: Apply rounding rules (web/salon steps from Pricing_Params)
  // If conflicts: raise UVP or suggest bundle/reduce Ad%
  // Output warnings to Pricing_Suggestions
}

export function calculateB2BNet(
  UVP: number,
  role: 'Dealer Basic' | 'Dealer Plus' | 'Stand' | 'Distributor',
  qty: number,
  orderTotal: number,
  context: PricingContext
): B2BPriceResult {
  // Order of operations:
  // 1. Start with UVP
  // 2. Apply role discount (from PartnerTiers)
  // 3. Apply quantity discount (from QuantityDiscounts)
  // 4. Apply caps (from DiscountCaps)
  // 5. Compute line net
  // 6. After all lines: apply order-level discount (from OrderDiscounts)
  // 7. Add VAT
  // 8. Add shipping
}
```

#### 2.2 Unit Tests (server/lib/__tests__/pricing-law.test.ts)
Test cases:
- FullCost calculation with all 8 components
- Grundpreis formatting (€/L, €/kg)
- UVP rounding (web steps .49, .99; salon steps .95)
- Amazon referral tiering (8% vs 15%, min €0.30)
- FBA fees lookup + €0.26 surcharge
- Stripe fees (1.5% + €0.25), PayPal (2.49% + €0.39)
- DHL surcharges (LKW_CO2 €0.19, Peak €0.19, Peak_in_Peak €0.50, Energy monthly)
- Returns accounting (2-3%)
- Loyalty accounting (0.7%)
- Box cost allocation
- Guardrail enforcement (<45% → warning)
- MAP violation blocking
- Constraint priority chain (MAP → Floor → Guardrail → Rounding)
- B2B role discounts (Dealer Basic/Plus, Stand, Distributor)
- Quantity tier discounts
- Discount caps enforcement
- Order-level discounts

**Success Criteria**: All unit tests pass, pricing-law.ts feature-complete, backward compatibility maintained via feature flag

---

### Phase 3: Data Migration & Backfill
**Objective**: Migrate existing SKUs to new schema with validation  
**Duration**: 3-4 hours  
**Risk**: MEDIUM (data quality)  
**Prerequisite**: Phase 2 complete with tests passing

#### 3.1 Create Migration Script (server/scripts/migrate-pricing-law.ts)
```typescript
// Dry-run mode: report affected SKUs without writing
// Live mode: backfill missing FullCost fields with conservative defaults
// - Shipping_Inbound_per_unit: €0.50 (default)
// - EPR_LUCID_per_unit: €0.05
// - GS1_per_unit: €0.02
// - Retail_Packaging_per_unit: €0.30
// - QC_PIF_per_unit: €0.10
// - Operations_per_unit: €0.15
// - Marketing_per_unit: €0.20
// - FullCost_EUR: computed sum
// - Grundpreis: computed from pack size
// - Amazon_TierKey: infer from Dims_cm
// - Line: infer from Category (default 'Pro')

// Output: migration-dry-run.json with affected SKUs
```

#### 3.2 Generate Price Validation Report
For each SKU and channel, validate:
- `UVP_Inc`: UVP with VAT
- `MinInc_99`: Minimum retail price (€X.99 format)
- `PostChannel_Pct`: Margin after channel costs
- `Guardrail_OK`: PostChannel_Pct ≥ 45%
- `MAP_OK`: UVP ≥ MAP
- `PAngV_OK`: Grundpreis present and valid

Output files:
- `docs/PRICE_VALIDATION_REPORT.md` (summary)
- `exports/price-validation-{timestamp}.csv` (full detail)

**Success Criteria**: Migration script runs idempotently, validation report shows issues (if any), Pricing_Suggestions populated for SKUs below guardrails

---

### Phase 4: Frontend UI Updates
**Objective**: Surface new pricing data and controls in UI  
**Duration**: 4-5 hours  
**Risk**: LOW (UI only)  
**Prerequisite**: Phase 3 complete with data validated

#### 4.1 Pricing Studio Page Updates
- Add FullCost breakdown editor (8 cost components)
- Display live UVP with Grundpreis below
- Show per-channel margin bars (green ≥45%, red <45%)
- Add "Explain Pricing" drawer showing:
  - FullCost breakdown
  - Channel cost drivers (referral, FBA, DHL, payments, returns, loyalty, box)
  - Guardrail status
  - MAP compliance
  - Constraint resolution log

#### 4.2 Quote Builder Enhancements
- Keep existing partner dropdown
- Add "+ New Partner" inline modal
- Display role discount badges (Dealer Basic/Plus, Stand, Distributor)
- Show quantity tier discounts as applied
- Display caps enforcement warnings
- Show order-level discount when threshold reached
- Display guardrail warnings (yellow/red alerts)
- PDF export with QR code
- Log all quote actions to OS_Logs

#### 4.3 Shipping/Operations UI
- Weight-band selector with live DHL cost preview
- Surcharges breakdown display:
  - LKW CO₂: €0.19
  - Peak: €0.19
  - Peak-in-Peak: €0.50
  - Energy (monthly from Settings)
- Box selector with cost allocation

#### 4.4 AI Hub Integration
Add buttons:
- "Reprice SKU(s)" → AI analyzes costs, suggests UVP → writes to Pricing_Suggestions_Draft
- "Audit PAngV" → AI validates all Grundpreis → writes to AI_Outbox
- "Suggest Bundle (if guardrail fails)" → AI recommends bundles for SKUs <45% → writes to Bundles_Draft

All AI outputs → Draft tables → Human approval → Apply to main sheets

**Success Criteria**: UI reflects new pricing data, UX smooth, guardrail warnings visible, AI integration functional

---

### Phase 5: Testing & Validation
**Objective**: Comprehensive test coverage  
**Duration**: 3-4 hours  
**Risk**: LOW  
**Prerequisite**: Phase 4 complete

#### 5.1 Unit Tests
- All pricing-law.ts calculators (see Phase 2.2)
- FullCost, Grundpreis, channel costs, constraints, B2B roles

#### 5.2 Integration Tests (3 sample SKUs)
Test SKUs:
1. **Light** (50g, Basic line, OwnStore): FullCost €5, UVP €15, MAP €12
2. **Medium** (500g, Pro line, Amazon_FBA): FullCost €20, UVP €65, MAP €55
3. **Heavy** (1500g, Premium line, Amazon_FBM): FullCost €40, UVP €130, MAP €110

For each SKU, verify:
- FullCost calculation
- Grundpreis (€/L or €/kg)
- All channel costs (OwnStore, Amazon_FBM, Amazon_FBA)
- Guardrail status (≥45%)
- MAP enforcement
- Rounding applied correctly

#### 5.3 E2E Tests (using run_test tool)
**Test Plan 1: Stand Role Quote**
1. [New Context] Create browser context
2. [Browser] Navigate to Sales Desk (/sales-desk)
3. [Browser] Click "Create Quote"
4. [Browser] Select partner tier "Stand"
5. [Browser] Add 3 SKUs with varying quantities
6. [Verify] Quantity tier discounts applied
7. [Verify] Guardrail warnings displayed if any SKU <45%
8. [Verify] Total calculation correct
9. [Browser] Click "Export PDF"
10. [Verify] PDF generated with QR code

**Test Plan 2: Distributor Role with Order Discount**
1. [New Context] Create browser context
2. [Browser] Navigate to Sales Desk
3. [Browser] Create quote for "Distributor" tier
4. [Browser] Add SKUs totaling >€1000
5. [Verify] Order-level discount applied
6. [Verify] Discount caps respected
7. [Verify] Final total matches calculation
8. [Browser] Convert to Order
9. [Verify] Commission ledger entry created
10. [Verify] Loyalty points earned

#### 5.4 OS_Health Validation
Add entries:
- "Spreadsheet Validation PASS" (all sheets, headers, seed data OK)
- "Pricing Law PASS" (all calculations tested, guardrails enforced)

Run: `npm run lint && npm run typecheck`

**Success Criteria**: All tests pass (unit, integration, E2E), no breaking errors, OS_Health green

---

### Phase 6: Documentation & Handoff
**Objective**: Complete delivery documentation  
**Duration**: 2 hours  
**Risk**: LOW

#### 6.1 Generate Delivery Reports

**PHASE_PRICING_LAW_DELIVERY.md**:
- What changed (sheets, backend, UI)
- Where to find new features
- Why (compliance, guardrails, B2B optimization)
- How to operate (pricing workflow, quote flow, AI suggestions)

**SHEETS_DELTA_SUMMARY.md**:
- Columns added per sheet
- Columns removed (none, backward compatible)
- Data migrations performed
- Seed data added

**UI_CHANGELOG.md**:
- New components (FullCost editor, Grundpreis display, margin bars, Explain drawer)
- Enhanced components (Quote Builder, Shipping UI, AI Hub buttons)
- How to use each feature

#### 6.2 Verify Acceptance Criteria
Must all PASS:
- [x] Single Sheet ID in env; no secrets in Sheets
- [x] All mandatory sheets/headers exist with seed rows
- [ ] For each SKU:
  - [ ] Grundpreis visible & correct
  - [ ] Guardrail PostChannel ≥45% for OwnStore (or flagged)
  - [ ] MAP never violated
  - [ ] Amazon referral & FBA (incl. €0.26) applied correctly
  - [ ] DHL surcharges applied
  - [ ] Stripe/PayPal & returns & loyalty accounted
  - [ ] Floor multiplier respected
  - [ ] Rounding rules applied
- [ ] QuoteBuilder: roles/tiers/caps/order-discount flow correct + PDF export OK
- [ ] PRICE_VALIDATION_REPORT.md written with PASS/FAIL flags
- [ ] No breaking console errors
- [ ] Logs in OS_Logs

**Success Criteria**: All acceptance criteria PASS, documentation complete, rollback instructions clear

---

## Feature Flag Strategy

### Environment Variable
```bash
PRICING_LAW_V2_ENABLED=false  # Default during migration
PRICING_LAW_V2_ENABLED=true   # After validation passes
```

### Implementation
```typescript
// server/lib/pricing.ts
export function calculatePrice(product: FinalPriceList, context: PricingContext) {
  const useV2 = process.env.PRICING_LAW_V2_ENABLED === 'true';
  
  if (useV2) {
    return calculatePriceV2(product, context); // pricing-law.ts
  } else {
    return calculatePriceLegacy(product, context); // existing logic
  }
}
```

### Rollout Plan
1. Phase 0-1: Flag OFF, sheets prepared
2. Phase 2: Flag OFF, backend ready but not used
3. Phase 3: Flag ON for migration script only
4. Phase 4-5: Flag ON in dev/staging, testing
5. Phase 6: Flag ON in production after validation

---

## Rollback Instructions

### If migration fails in Phase 1-2 (pre-data-write):
1. Set `PRICING_LAW_V2_ENABLED=false`
2. Restart application
3. Review SAFETY_SNAPSHOT.md for baseline
4. No data loss (sheets unchanged)

### If migration fails in Phase 3 (post-data-write):
1. Set `PRICING_LAW_V2_ENABLED=false`
2. Legacy pricing engine will read old columns (Factory_Cost_EUR, COGS_EUR, etc.)
3. New columns (Shipping_Inbound_per_unit, etc.) ignored
4. Quotes/Orders continue to work with v1 logic
5. Review PRICE_VALIDATION_REPORT.md to identify issues
6. Fix data in Google Sheets manually if needed
7. Re-run migration script with fixes

### If migration fails in Phase 4-5 (UI/Testing):
1. Set `PRICING_LAW_V2_ENABLED=false`
2. UI falls back to legacy display (hides new fields)
3. Backend serves v1 calculations
4. Fix UI bugs in development
5. Re-enable flag after fixes deployed

---

## Risk Mitigation

### Identified Risks

1. **Spreadsheet structure drift**  
   - Mitigation: `ensureSheets()` runs on every startup
   - Audit: SHEETS_STRUCTURE_REPORT.md

2. **Breaking existing quotes**  
   - Mitigation: Feature flag + dual-write during migration
   - Test: E2E tests for Stand & Distributor quotes

3. **Inconsistent rounding causing MAP breaches**  
   - Mitigation: Unit tests for every rounding scenario
   - Validation: PRICE_VALIDATION_REPORT.md flags all MAP violations

4. **Many SKUs below 45% guardrail**  
   - Mitigation: Dry-run report before go-live
   - Communication: Sales team briefed on SKUs needing bundles/repricing
   - Fallback: Pricing_Suggestions allows temporary override

5. **Data migration errors**  
   - Mitigation: Idempotent script, conservative defaults
   - Validation: Per-SKU validation report with PASS/FAIL
   - Rollback: Flag OFF restores v1 behavior

---

## Communication Plan

### Stakeholders
- Sales Team: Notified of guardrail changes, quote workflow enhancements
- Operations: Briefed on new DHL surcharge breakdowns
- Finance: Informed of FullCost model expansion for accurate margin tracking
- Tech Team: Migration plan shared, feature flag usage documented

### Timeline
- **T-7 days**: MIGRATION_PLAN.md shared, feedback collected
- **T-3 days**: Phase 0-2 complete, backend tested
- **T-1 day**: Phase 3-4 complete, UI ready
- **T+0 (Go-Live)**: Phase 5-6 complete, flag ON in production
- **T+7 days**: Post-migration review, final report

---

## Success Metrics

- ✅ Zero data loss
- ✅ All SKUs have valid Grundpreis
- ✅ No MAP violations in production
- ✅ Guardrail warnings visible for SKUs <45%
- ✅ Quote Builder supports all 4 B2B roles
- ✅ PDF exports include QR codes
- ✅ OS_Health shows PASS for all pricing validations
- ✅ Zero breaking console errors
- ✅ All acceptance criteria verified

---

## Appendix

### Useful Commands
```bash
# Run migration dry-run
npm run migrate:pricing-law -- --dry-run

# Run migration live
npm run migrate:pricing-law

# Generate validation report
npm run validate:pricing

# Run pricing unit tests
npm test -- pricing-law.test.ts

# Run integration tests
npm test -- pricing-integration.test.ts

# Enable feature flag
export PRICING_LAW_V2_ENABLED=true
npm run dev

# Disable feature flag (rollback)
export PRICING_LAW_V2_ENABLED=false
npm run dev
```

### Key Files Modified
- `shared/schema.ts` - Schema extensions
- `server/lib/ensure-sheets.ts` - New sheet definitions
- `server/lib/pricing-law.ts` - NEW v2 pricing engine
- `server/lib/pricing.ts` - Feature flag integration
- `server/routes.ts` - API endpoints updated
- `client/src/pages/pricing-studio.tsx` - UI updates
- `client/src/pages/sales-desk.tsx` - Quote Builder enhancements
- `client/src/pages/operations.tsx` - Shipping UI updates
- `client/src/pages/ai-hub.tsx` - AI buttons added

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-11  
**Next Review**: After Phase 3 completion
