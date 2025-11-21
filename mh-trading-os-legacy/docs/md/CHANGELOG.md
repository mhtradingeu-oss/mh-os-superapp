# Changelog

All notable changes to MH Trading OS project.

## [1.1.0] - 2025-11-09

### ✨ Added - Advanced Pricing Engine (Phase 1)
- **Detailed Cost Breakdown System** (pricing-1, pricing-3)
  - New FinalPriceList fields: Factory_Cost_EUR, Packaging_Cost_EUR, Freight_kg_EUR, Import_Duty_Pct, Overhead_Pct
  - Schema fields: Brand, Dims_cm, Notes added to match Bootstrap headers
  - FinalPriceList sheet expanded from 23 to 28 columns with organized categories
  - Columns: Product ID (3) → Cost Breakdown (6) → Specs (3) → Pricing (4) → Channels (3) → Tiers (4) → Competitors (2) → Metadata (3)

- **Enhanced Pricing Algorithm** (pricing-4)
  - `calculateDetailedLandedCost()`: New function implementing precise cost calculation
  - Formula: Landed COGS = Factory + Packaging + Freight(weight-based) + Import Duty% + Overhead%
  - Supports default parameters from Pricing_Params (DEFAULT_FREIGHT_KG_EUR, IMPORT_DUTY_PCT_DEFAULT, OVERHEAD_PCT_DEFAULT)
  - Weight-based freight calculation: Cost/kg × product weight in kg

- **Intelligent Cost Branch Detection** (pricing-4)
  - `repriceSKU()` updated with explicit undefined checks (not truthy checks)
  - Correctly handles zero-value cost components
  - Preserves base COGS (Factory + Packaging only) for reporting/analytics
  - Landed Cost includes all costs (Freight + Duty + Overhead)
  - Full backwards compatibility with legacy COGS_EUR calculation

- **Enhanced Price Explanations** (pricing-5)
  - `explainPriceCalculation()` supports both detailed and legacy calculation flows
  - Shows step-by-step breakdown: Factory → Packaging → Base → Freight → Duty → Overhead → Landed Cost
  - Clear visual separation between cost components
  - Includes intermediate values and formulas for transparency

### 🔧 Fixed - Pricing Logic Improvements
- Zero-value cost components no longer trigger fallback to legacy calculation
- Base COGS preserved separately from landed cost (prevents analytics breakage)
- Schema fully aligned with Bootstrap headers (Brand, Dims_cm, QRUrl, Notes)
- Explicit undefined checks prevent falsiness issues

### 📋 Pending - Advanced Pricing Features (Phase 2)
- **Pricing_Params Expansion** (pricing-2): Target_Margin_Web/Salon, Floor_Margin, MAP_Enable, Competitor_Weighting, Rounding policies
- **Multi-Channel UVP** (pricing-6): Web/Salon separate margins, .49 ending rules
- **Competitor Intelligence** (pricing-7): Weighting, safe adjustment suggestions
- **UI Enhancements** (pricing-8): Search, filters (competitor diff, low margin, MAP violations), cost breakdown display
- **Export Features** (pricing-9): PDF/CSV price list with all tiers
- **Smart Assistant Commands** (pricing-10): Complete SKU data, price scenarios, competitor monitoring
- **Test Scenarios** (pricing-11): E2E validation of pricing flows

### 🏗️ Technical Implementation
- Server/lib/pricing.ts: Added `calculateDetailedLandedCost()`, updated `repriceSKU()`, enhanced `explainPriceCalculation()`
- Shared/schema.ts: Extended FinalPriceList with 6 cost fields + 3 metadata fields
- Server/lib/bootstrap.ts: Updated FinalPriceList headers (28 columns, organized)
- All changes architect-reviewed and approved
- Zero breaking changes (fully backwards compatible)

---

## [1.0.0] - 2025-11-09

### ✅ Added - Core Features
- **Bootstrap System** (Task 1-2)
  - Auto-creates 29 required Google Sheets with correct headers
  - Sets 7 critical settings (HM_CURRENCY, VAT_Default_Pct, AI_Default_Model, ENV, etc.)
  - Idempotent operation (safe to run multiple times)
  - Comprehensive logging to OS_Logs and OS_Health
  - POST `/api/admin/bootstrap/run` endpoint
  - "Run Full Bootstrap" button in Admin page

- **Pricing Studio** (Task 3)
  - Product catalog view with tier-based net prices
  - Manual MAP editing with null value handling
  - Bulk auto-reprice (respects AutoPriceFlag)
  - AI-powered price explanation
  - PDF export endpoint
  - Price calculation breakdown
  - Endpoints: GET `/api/pricing/products`, POST `/api/pricing/bulk-reprice`, POST `/api/pricing/calculate`, PUT `/api/pricing/products/:sku`

- **Partners & Stand Center** (Task 4)
  - Full CRUD for partners with tier management
  - QR code generation for stands and products
  - Starter Bundle & Refill Plan management
  - Authorized Assortment per partner
  - Endpoints: GET/POST `/api/partners`, GET/PUT/DELETE `/api/partners/:id`, GET/POST `/api/stands`, GET `/api/qrcode/stand/:id`, GET `/api/qrcode/product/:sku`

- **Sales Desk** (Task 5)
  - Quote creation with lines, discounts, VAT
  - Quote→Order conversion with tier-based commission
  - Loyalty system (earn 1%, redeem up to 10%)
  - Invoice PDF generation
  - Commission rates: Basic=5%, Plus=6%, Premium=7%, Distributor=10%
  - Endpoints: GET/POST `/api/sales/quotes`, POST `/api/sales/quotes/:id/convert`, GET/POST `/api/sales/orders`, POST `/api/sales/orders/:id/invoice`

- **Logistics & Operations** (Task 6)
  - DHL shipping rate estimation
  - Daily manifest creation from confirmed orders
  - Zone detection (DE, EU1, INT)
  - Weight & cost calculation from order lines
  - Endpoints: GET `/api/shipments`, POST `/api/shipments/manifest`, POST `/api/dhl/estimate`

- **Smart Assistant** (Task 7)
  - Command palette (Ctrl+K / Cmd+K)
  - 6 quick actions: Create SKU, Price Products, New Partner, Create Quote→Order, Request Stand, Health Check
  - 4 navigation commands
  - All operations log to OS_Logs
  - Toast notifications and routing

- **Integrations** (Task 8)
  - OpenAI integration (Replit AI Integrations)
  - Email SMTP test (Brevo)
  - WooCommerce dry-run test
  - Odoo dry-run test
  - ENV=staging dry-run mode
  - Endpoints: GET `/api/admin/health`, POST `/api/integrations/test/*`

### 🔐 Added - Security & Guardrails (Task 10 - Partial)
- **Retry Logic**
  - `retryWithBackoff()` utility with exponential backoff
  - All Google Sheets API calls protected (readSheet, writeRows, updateRow, logToSheet, validateSheetStructure)
  - Connector fetch retry in getAccessToken
  - Default: 3 attempts, 1s → 2s → 4s delays
  - Retryable errors: ECONNRESET, ETIMEDOUT, 429, RESOURCE_EXHAUSTED

- **Feature Flags**
  - `getFeatureFlags()` system with environment-based toggles
  - Flags: enableWooCommerce, enableOdoo, enableEmailNotifications, enableAIFeatures, enableDHLShipping, enableDriveIntegration, dryRunMode
  - GET `/api/admin/feature-flags` endpoint

- **Secret Masking**
  - `maskSecret()` utility (shows first 4 + last 4 chars)
  - GET `/api/admin/secrets-status` endpoint
  - Protects: SMTP, OpenAI, Sheets, Woo, Odoo credentials

- **Delete Confirmation Dialog**
  - Reusable `<DeleteConfirmationDialog>` component
  - Red destructive styling with data-testid attributes
  - Not yet integrated into destructive flows

### 📚 Added - Documentation (Task 11)
- PROJECT_STATUS.md - comprehensive status report
- CHANGELOG.md - this file
- Inline code documentation
- Data model schemas in shared/schema.ts

### 🐛 Fixed
- MAP editing now handles null values correctly
- Bulk reprice respects AutoPriceFlag
- PDF export returns proper message (not 404)
- Tier field used consistently across partner/quote/order
- Manifest uses real order data (weight, zone, cost)
- Command palette routes correctly after actions
- Toast warnings reflect actual status
- Error code matching for retry (string/number)

### ⚠️ Pending
- **E2E Test Suite** (Task 9): Blocked by Google Sheets API quota
- **Complete Guardrails** (Task 10):
  - Idempotent append operations
  - BatchUpdate in updateRow
  - DELETE dialog integration
  - Admin UI cards for feature flags & secrets

### 🏗️ Technical Details
- **Stack**: React 18 + Vite + Tailwind + shadcn/ui + Express + TypeScript
- **Data Source**: Google Sheets (29 sheets, authoritative)
- **Integrations**: OpenAI, SMTP, WooCommerce, Odoo, Google Drive
- **29 Google Sheets**: Settings, Pricing_Params, FinalPriceList, PartnerRegistry, Quotes, Orders, Commission_Ledger, Loyalty_Ledger, DHL_Rates, Shipments_DHL, OS_Logs, OS_Health, AI_Playbooks, and more

---

## [0.1.0] - 2025-11-08

### Initial Development
- Project scaffolding
- Base architecture setup
- Google Sheets connector integration
- TypeScript schemas and types
- Express server foundation

---

## Notes
- Version 1.0.0 marks production-ready status for core features
- All 8 core tasks completed with architect approval
- 2 tasks pending (Testing & Full Guardrails)
- Ready for staged production deployment
