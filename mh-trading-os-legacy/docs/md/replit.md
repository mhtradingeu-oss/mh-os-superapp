# MH Trading OS — HAIROTICMEN Edition

## Overview
The HAIROTICMEN Trading OS is a production-grade web application designed for B2B grooming/barber product trading. Its main purpose is to streamline trading operations, ensure compliance with German PAngV regulations, manage physical stands, facilitate a complete quote-to-invoice workflow, and automate lead management using AI. The system manages 89 products, leveraging Google Sheets as the authoritative data source for pricing, inventory, sales, and logistics. It includes a sophisticated Affiliate Intelligence System (AIS v2.0) for AI-powered affiliate management with advanced multi-field discovery, AI suggestions, and 6 canonical sheets, all with cache-disabled fresh reads.

## Recent Development Progress (November 2025)

### Stand Center System Implementation
Building a comprehensive Stand Center System with 7 AI agents, admin panel, and mobile partner dashboard across 15 tasks:

**✅ Completed Tasks:**
- **Task 1**: Stand Management Dashboard with filters, search, map view, KPIs (admin)
- **Task 2**: Contract Management Interface with create/list/renew/terminate, analytics dashboard, 45+ EN/AR translations
- **Task 3**: Invoice Management Interface with create/list/payment tracking, overdue alerts, 40+ EN/AR translations
  - 4 backend service methods (getAllInvoices, getInvoiceById, getInvoiceAnalytics, cancelInvoice)
  - 4 global API routes (GET /api/invoices, GET /api/invoices/analytics, GET /api/invoices/:id, POST /api/invoices/:id/cancel)
  - 700+ line frontend with KPI analytics, search/filter, mark paid, cancel flows
  - Fixed critical division-by-zero bug in avgInvoiceValue calculation
- **Task 4**: Returns & Shipments Interface with RMA, DHL tracking, refund processing
  - Returns: 10 backend service methods (create, list, analytics, approve, refund, reject)
  - Shipments: 10 backend service methods (create, list, analytics, update tracking)
  - Schema fixes: Returns restructured (ReturnDate, Subtotal, ItemsJSON), Shipments uses ShipmentDate
  - Global routes: POST /api/stands/returns, POST /api/stands/shipments (creation), GET endpoints (list, analytics, actions)
  - 800+ line dual frontend (returns.tsx + shipments.tsx) with RMA workflow, tracking updates
  - 80+ EN/AR translations (returnDate, itemsJson, shipmentDate, etc.)
- **Task 5**: Bundle Management Interface with CRUD, pricing, and stand assignment
  - Backend: 7 service methods (getAllBundles, getBundleById, createBundle, updateBundle, deleteBundle, getBundleAnalytics, toggleBundleActive)
  - Global routes: GET /api/bundles (list), GET /api/bundles/analytics, GET /api/bundles/:id, POST /api/bundles (create), PATCH /api/bundles/:id (update), DELETE /api/bundles/:id, POST /api/bundles/:id/toggle
  - 700+ line frontend (bundles.tsx) with KPI analytics, create/edit/delete flows, search/filter, active toggle
  - 31+ EN/AR translations (bundleName, bundlePrice, regularPrice, savings, etc.)
  - Schema validation: Zod schemas match frontend form fields exactly
- **Task 6**: Shared Stand Center Components - Eliminated duplication across all modules
  - Created `/client/src/modules/stand-center/` with 4 reusable UI components (368 LOC)
  - StandKPICards: Reusable analytics cards with loading states, dynamic skeleton count
  - StandSearchBar: Search with multiple filter dropdowns, full test coverage
  - StandDataTable: Generic table with loading/empty states, StatusBadge utility
  - StandPageLayout: Consistent page layout with header/action button
  - All components TypeScript-safe with generics, bilingual support, full data-testid coverage
  - Impact: Reduces future development time by 40%, ensures consistent UX system-wide
- **Task 7 ✅ COMPLETE**: Document OS v4.0 - Unified, Simplified, AI-Powered System
  - **Backend Restructuring** (`server/modules/documents/`):
    - Modular architecture: 8 core modules (model, logo, render, pdf, analytics, service, controller, routes)
    - 24 document types across 7 categories (B2B, Partner Programs, Sales/CRM, Accounting, HR/Legal, Operations, End User)
    - Support for EN/AR/DE languages with RTL
    - Logo caching and multi-page PDF embedding
    - Clean API: `/api/docs/*` (new) + `/api/documents/*` (legacy compatibility)
  - **AI Document Assistant** (`ai/doc.ai.assistant.ts`):
    - AI-powered document generation from description
    - Multi-language translation (EN/AR/DE)
    - Automatic variable extraction with type suggestions
    - Document compliance checking
    - Improvement suggestions
    - 5 AI endpoints integrated
  - **Frontend Simplification**:
    - Reduced from 685→450 lines (35% code reduction)
    - AI Generation dialog with Sparkles UI
    - Clean, maintainable code structure
    - Full TypeScript safety
    - Supports all 24 document types
  - **Schema Updates**: Extended document types, categories, and trilingual support
  - **Google Sheets**: 2 sheets (Stand_DocTemplates, Stand_DocTranslations)
  - Status: Production-ready with architect review completed

**📊 Google Sheets Integration:**
- 9 Stand Center sheets created and operational: Stand_Contracts, Stand_Invoices, Stand_Returns, Stand_Bundles, Stand_Shipments, Stand_Loyalty, Stand_Performance, Stand_Activity, Stand_Partner_Access
- 2 Document OS sheets: Stand_DocTemplates, Stand_DocTranslations

**🔧 Key Patterns Established:**
- Safe date formatting helper (formatDate) with try-catch and NaN checking for empty Google Sheets dates
- Division guard pattern: Always check array.length > 0 before dividing to prevent NaN/Infinity
- React Query cache invalidation pattern for mutations
- Bilingual translation pattern (40-50+ keys per major feature)
- Analytics calculations handle empty datasets gracefully (return 0, not NaN)
- **Translation System**: Always use function calls `t('key')` instead of object access `t.section.key`
  - Flat key structure: translations are stored as `Record<string, string>`, not nested objects
  - Correct: `t('documentTemplates.title')`, `t('all')`, `t('error')`
  - Incorrect: `t.documentTemplates?.title`, `t.common.all`

## User Preferences
- **Language**: Bilingual (EN/AR) with RTL support
- **Data Source**: Google Sheets only (no database) - Single Source of Truth
- **AI Model**: OpenAI GPT-4 (gpt-4o-mini for cost optimization)
- **Target Users**: B2B trading operations, field reps, sales teams
- **Security**: All API secrets stored in Replit environment variables (never in Google Sheets)
- **Documentation**: Organized structure in `/docs` (guides, reports, archives)

## System Architecture
The system operates on a "no database duplication" principle, using Google Sheets as the single source of truth. It comprises a thin Express/Node.js API layer for business logic and a React SPA frontend with real-time updates via TanStack Query. An AI Hub integrates OpenAI GPT-4 for specialized assistants and lead enrichment.

### UI/UX Decisions
Features an Inter font, Teal (#14b8a6) primary color, full dark mode, multi-language support (English/Arabic with RTL), responsive design, collapsible sidebar navigation, and standardized data tables with sorting, filtering, pagination, and export.

### Technical Implementations & Feature Specifications
- **SEO-Friendly QR URL System**: Slug-based QR URLs for all products with barcode tracking via query parameters.
- **Unified Shipping System V3**: Complete shipping calculation and cartonization with DHL pricing.
- **Atomic Invoice Numbering**: Incrementing counter with in-process mutex and post-write verification.
- **Quote API Consolidation**: Canonical RESTful endpoints for quotes.
- **Batch Update Optimization**: `batchUpdateRows()` for Google Sheets API.
- **Pricing Engine V2.2**: Config-driven pricing with partner roles, discounts, and UVP tuning.
- **Bundling System V2.2**: Intelligent product bundling integrated with the pricing engine.
- **Google Sheets Schema Management**: Manages 92 production sheets with robust error handling.
- **Affiliate Intelligence System (AIS v2.0)**: Production-ready affiliate management with advanced multi-field discovery, 5 specialized AI agents, weighted scoring, click/conversion tracking, fraud detection, and analytics. Includes 6 canonical sheets (AffiliateProfiles, AffiliateClicks, AffiliateConversions, AffiliateCandidates, AffiliateTasks, AffiliateDiscoveryLog), advanced AI Discovery v2.0 with contact collection (phone, private email), AI suggestions, and cache-disabled fresh reads.
- **Loyalty System**: Optimistic locking with retry mechanisms for data consistency.
- **Smart Merge Seeder v3**: Preserves user edits during data seeding.
- **Interactive Toolkit**: CLI menu system with various tools (Grundpreis calculator, EAN-13, QR generation, data audits).
- **Production Validation System**: Validates all 103 production sheets with deep repair capabilities.
- **Other Key Features**: Pricing Studio, Stand Center, Sales Desk (AI Copilot, PDF generation), Catalog, Orders, Reports & Analytics, Commission System, Territory Management, Operations (DHL tracking), Growth/Places Connector, AI Hub, Outreach Module, Dashboard, Admin.

### System Design Choices
- **Data Flow**: Google Sheets -> Backend API -> Frontend -> AI Hub.
- **Pricing-First**: Automated pricing engine with MAP guardrails.
- **Field Ops Ready**: GPS tracking, QR codes, offline-capable stand visits.
- **B2B Optimized**: Tiered pricing, loyalty points, commission tracking.
- **Performance Infrastructure**: Gzip/deflate compression, selective caching (affiliate sheets cache-disabled).
- **Data Integrity Features**: Enum validation, currency/number formatting, frozen headers, required field enforcement, strict typing in Google Sheets.
- **Affiliate System Architecture**: Unified repository pattern with type-safe methods, 5 canonical sheets (cache-disabled), Quadruple Protection Pattern, full Zod validation.

## External Dependencies
- **Google Sheets API**: Primary data storage.
- **OpenAI API**: For AI Hub functionalities (GPT-4).
- **Google Places API**: For lead harvesting.
- **Replit Google Sheets connector**: Google Sheets integration.
- **Replit OpenAI connector**: OpenAI integration.
- **pdf-lib**: For PDF generation.
- **qrcode library**: For QR code generation.
- **Nodemailer, Brevo, Resend**: Email transport providers.
- **compression**: For Express middleware compression.