# MH Trading OS - System Architecture Map

**Generated**: 2025-11-10T12:45:00Z

---

## 🏗️ High-Level Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     CLIENT (React SPA)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │Dashboard │  │ Pricing  │  │ Stands   │  │  Sales   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │             │              │             │         │
│  ┌────┴─────┐  ┌───┴──────┐  ┌───┴──────┐  ┌───┴──────┐  │
│  │ Growth   │  │Marketing │  │ AI Hub   │  │AI Crew   │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       │             │              │             │         │
└───────┼─────────────┼──────────────┼─────────────┼─────────┘
        │             │              │             │
        └──────┬──────┴──────┬───────┴──────┬──────┘
               │             │              │
┌──────────────┴─────────────┴──────────────┴──────────────┐
│                   EXPRESS API SERVER                      │
│                                                            │
│  ┌───────────────────────────────────────────────────┐   │
│  │              Routes (server/routes.ts)             │   │
│  │  • 200+ REST endpoints                             │   │
│  │  • /api/pricing/*  /api/stands/*  /api/sales/*     │   │
│  │  • /api/growth/*   /api/marketing/*  /api/ai/*     │   │
│  │  • /api/outreach/* /api/shipping/*  /api/admin/*   │   │
│  └─────────────────────┬─────────────────────────────┘   │
│                        │                                  │
│  ┌─────────────────────┴─────────────────────────────┐   │
│  │              Business Logic Layer                  │   │
│  │                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │  Pricing    │  │   Stand     │  │  Sales    │  │   │
│  │  │  Engine     │  │   Ops       │  │  Desk     │  │   │
│  │  │ (pricing.ts)│  │             │  │           │  │   │
│  │  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  │                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │ Growth      │  │  Shipping   │  │Outreach   │  │   │
│  │  │ (places.ts) │  │  (dhl.ts)   │  │(out*.ts)  │  │   │
│  │  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  │                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │ Marketing   │  │   AI Hub    │  │ [TODO]    │  │   │
│  │  │ (seo-ai.ts) │  │ (openai.ts) │  │Orchestr.  │  │   │
│  │  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  └─────────────────────┬─────────────────────────────┘   │
│                        │                                  │
│  ┌─────────────────────┴─────────────────────────────┐   │
│  │         Infrastructure Services Layer              │   │
│  │                                                     │   │
│  │  ┌─────────────────────────────────────────────┐   │   │
│  │  │   Google Sheets Service (sheets.ts)         │   │   │
│  │  │   • Read/Write with cache (60s TTL)         │   │   │
│  │  │   • Retry/backoff (p-limit, p-retry)        │   │   │
│  │  │   • 53 worksheets managed                   │   │   │
│  │  └─────────────────────────────────────────────┘   │   │
│  │                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │   Cache     │  │  OpenAI     │  │  Email    │  │   │
│  │  │ (cache.ts)  │  │(openai.ts)  │  │(email.ts) │  │   │
│  │  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  │                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │
│  │  │   Places    │  │    DHL      │  │  PDF/QR   │  │   │
│  │  │ (places.ts) │  │  (dhl.ts)   │  │(pdf/qr.ts)│  │   │
│  │  └─────────────┘  └─────────────┘  └───────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└────────────────────────┬───────────────────────────────────┘
                         │
┌────────────────────────┴───────────────────────────────────┐
│              EXTERNAL INTEGRATIONS                         │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │ Google Sheets │  │    OpenAI     │  │ Google Places │  │
│  │  (Data Store) │  │  (GPT-4o)     │  │  (Lead Harv.) │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  │
│                                                             │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │ Email (SMTP/  │  │    DHL API    │  │   Woo/Odoo    │  │
│  │ Brevo/Resend) │  │  (Shipping)   │  │  (Read-only)  │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Backend Services Breakdown

### 1. **Google Sheets Layer** (`server/lib/sheets.ts`)
**Purpose**: Single source of truth for all data

**Key Functions**:
- `readSheet<T>(sheetName)` - Read with cache (60s TTL)
- `appendRow(sheetName, data)` - Append new rows
- `updateRow(sheetName, rowIndex, data)` - Update existing rows
- `getSettings()` - Load system configuration
- `validateSheetStructure()` - Verify headers

**Concurrency Control**:
- `p-limit` (3 concurrent requests)
- `p-retry` (3 retries with exponential backoff)
- In-memory cache with invalidation counters

**Managed Worksheets** (53 total):
- Core: Settings, Pricing_Params, FinalPriceList, CompetitorPrices
- Partners: PartnerRegistry, PartnerTiers, AuthorizedAssortment
- Stands: StandSites, Stand_Inventory, Stand_Refill_Plans, Stand_Visits
- Sales: Quotes, QuoteLines, Orders, OrderLines
- Finance: Commission_Ledger, Loyalty_Ledger
- Shipping: DHL_Rates, DHL_Tariffs, Shipments_DHL, Packaging_Boxes
- Growth: CRM_Leads, Lead_Touches, Territories, Enrichment_Queue
- Marketing: SEO_Keywords, SEO_Pages, Ads_Campaigns, Ads_Keywords, Social_Calendar
- AI: AI_Playbooks, AI_Tasks, AI_Inbox, AI_Outbox
- Operations: OS_Logs, OS_Health, MAP_Guardrails, Pricing_Suggestions

---

### 2. **Pricing Engine** (`server/lib/pricing.ts`)
**Purpose**: Automated UVP/MAP/NET calculation with multi-channel pricing

**Core Functions**:
- `calculateUVP()` - Universal Value Price (COGS × markup)
- `calculateMAP()` - Minimum Advertised Price (enforces margins)
- `calculateNetPrices()` - Tiered pricing (B2B/Stand/Distributor)
- `checkGuardrails()` - Margin/MAP violation detection

**Pricing Formula**:
```
LandedCost = (FactoryCost + PackagingCost) × (1 + FreightPct + DutyPct + OverheadPct)
UVP = LandedCost × (1 + TargetMarginPct) × PRICE_STRATEGY
MAP = max(UVP × MAP_FLOOR_PCT, LandedCost × (1 + MIN_MARGIN_PCT))
NetPrice[Tier] = UVP × (1 - DiscountPct[Tier])
```

**Guardrails**:
- ✅ Min margin enforcement (default 10%)
- ✅ MAP price floor
- ⚠️ Competitor price comparison (logged only)
- ❌ AI agent write restrictions (NOT ENFORCED)

---

### 3. **Stand Operations** (`server/lib/stand-ops.ts` - partial)
**Purpose**: Physical stand/kiosk management

**Features**:
- GPS tracking (StandSites with Lat/Lng)
- QR code generation (per stand + per product)
- Inventory min/max levels
- Refill planning (AI-assisted)
- Visit mode (check-in/out, photos)

**Integration Points**:
- `POST /api/stands` - Create stand
- `GET /api/stands/:id` - Get stand + inventory
- `GET /api/qrcode/stand/:id` - Generate QR
- `POST /api/ai/stand-refill-suggest` - AI refill plan

---

### 4. **Sales Desk** (Routes in `server/routes.ts`)
**Purpose**: B2B quote-to-invoice workflow

**Workflow**:
```
Quote → Quote Lines → Convert to Order → Order Lines → Generate Invoice PDF
```

**Features**:
- Tiered pricing (Dealer Basic/Plus, Stand, Distributor)
- Loyalty points tracking (Loyalty_Ledger)
- Commission calculations (Commission_Ledger)
- MAP violation warnings
- PDF invoice generation (`pdf-lib`)

**Key Endpoints**:
- `POST /api/sales/quotes` - Create quote
- `POST /api/sales/quotes/:id/convert` - Quote → Order
- `POST /api/sales/orders/:id/invoice` - Generate invoice PDF

---

### 5. **Shipping & DHL** (`server/lib/dhl.ts`)
**Purpose**: Shipping cost estimation + label generation

**Features**:
- Weight-based zone pricing (DHL_Rates, DHL_Tariffs)
- Shipment tracking (Shipments_DHL)
- Box recommendation (Packaging_Boxes)
- Cost estimation

**Formula**:
```
ShippingCost = DHL_Rates[Zone][WeightBand] + Surcharges
```

**Endpoints**:
- `POST /api/dhl/estimate` - Cost estimation
- `POST /api/shipments` - Create shipment
- `POST /api/shipments/manifest` - Bulk manifest

---

### 6. **Growth / Places Connector** (`server/lib/places.ts`)
**Purpose**: Automated lead harvesting via Google Places API

**Features**:
- Keyword-based search (e.g., "barber shop Berlin")
- 4-key deduplication (phone, domain, email, city)
- E.164 phone normalization
- Lead scoring (0-30 points)
- Territory assignment

**Endpoints**:
- `POST /api/growth/places/search` - Harvest leads
- `GET /api/growth/places/normalize` - Normalize data
- `POST /api/growth/score` - Calculate scores
- `GET /api/growth/assign` - Territory assignment
- `POST /api/growth/enrich/run` - AI enrichment

---

### 7. **Outreach Module** (`server/lib/outreach-ai.ts`, `server/lib/email.ts`)
**Purpose**: Multi-channel email campaigns with AI

**Architecture**:
```
Campaign → Templates → Recipients → Sequences → Sends → Events
```

**Features**:
- AI template generation (A-OUT-101 agent)
- Sequence management (start, tick, pause, complete)
- Email provider abstraction (SMTP/Brevo/Resend)
- Webhook event tracking (opens, clicks, bounces, unsubs)
- GDPR compliance (consent flags, unsubscribe)

**Endpoints**:
- `POST /api/outreach/sequence/start` - Start campaign
- `POST /api/outreach/sequence/tick` - Process next batch
- `POST /api/outreach/ai/suggest` - AI template generation
- `POST /webhooks/email/:provider` - Event tracking

---

### 8. **Marketing Module** (100% Complete - Phase 2C)
**Purpose**: SEO, Ads, Social Studio with AI

**Architecture**:
- **SEO Tab**: Keyword harvest → Cluster → Prioritize → Brief → On-page audit
- **Ads Tab**: Campaign builder → Ad groups → Creatives → Google Ads CSV export
- **Social Tab**: Calendar → AI suggest → Asset attach → ICS/CSV export
- **UTM Builder**: Tagged URLs + shortening
- **KPIs**: Daily/Weekly/Monthly metrics + revenue attribution

**Endpoints** (49 total):
- SEO: `/api/marketing/seo/*` (harvest, cluster, prioritize, brief, onpage)
- Ads: `/api/marketing/ads/*` (campaigns, adgroups, creatives, export)
- Social: `/api/marketing/social/*` (plan, ai, attach, preview, calendar)
- UTM: `/api/marketing/utm/*` (build, shortify)
- KPIs: `/api/marketing/kpis/*` (daily, weekly, monthly, update-revenue)
- Webhooks: `/webhooks/ads/:provider`, `/webhooks/social/:provider`

---

### 9. **AI Hub** (`server/lib/openai.ts`)
**Purpose**: GPT-4 powered specialized assistants

**Current Agents**:
- **Pricing Analyst**: Price explanations, reprice suggestions
- **Stand Ops Bot**: Refill planning, inventory optimization
- **Growth Writer**: Lead enrichment, email templates
- **Ops Assistant**: General operations support

**Integration**:
- OpenAI GPT-4o (via Replit connector)
- Concurrency limit: 2 (p-limit)
- Retry with backoff (p-retry)
- Function calling for structured outputs

**Endpoints**:
- `POST /api/ai/explain-price` - Price breakdown
- `POST /api/ai/stand-refill-suggest` - Refill plan
- `POST /api/ai/social-plan` - Social content planning
- `POST /api/ai/command` - Command palette

---

### 10. **AI Crew** (⚠️ PARTIALLY IMPLEMENTED)
**Purpose**: 18 specialized AI agents with orchestration

**Current State**:
- ✅ AI_Playbooks sheet (6 playbooks defined)
- ✅ AI_Tasks sheet (task logging)
- ❌ AI_Crew sheet (MISSING - agent configs)
- ❌ Orchestrator service (NOT IMPLEMENTED)
- ❌ Intent routing (NOT IMPLEMENTED)
- ❌ Human approval flow (NOT IMPLEMENTED)

**Planned Agents** (from requirements):
- A-MGR-000: Orchestrator (coordinator)
- A-PRC-100: Pricing Analyst
- A-GRW-120: Growth Hunter
- A-OUT-130: Outreach Sequencer
- A-SEO-140: SEO Architect
- A-ADS-150: Ads Strategist
- A-SOC-160: Social Producer
- ... (12 more agents)

**Missing Endpoints**:
- ❌ GET /api/ai/agents - List agents
- ❌ POST /api/ai/chat/:id - Chat with agent
- ❌ POST /api/ai/run-playbook/:id - Execute playbook

---

### 11. **Guardrails & Logging**
**Purpose**: MAP enforcement, GDPR compliance, audit trails

**Current Implementation**:
- ✅ MAP guardrails in pricing engine (`checkGuardrails()`)
- ✅ OS_Logs sheet (all operations logged)
- ✅ MAP_Guardrails sheet (violation tracking)
- ⚠️ GDPR compliance documented but not enforced
- ❌ Draft-only writes NOT enforced
- ❌ Human approval NOT implemented

**Guardrail Rules** (from requirements):
1. **MAP**: No pricing below MAP → Write to Pricing_Suggestions only
2. **GDPR**: No outreach without consent → Check ConsentFlag before email
3. **Human Approval**: All AI writes → Require approval before Apply

**Current Gaps**:
- AI agents CAN write directly to production sheets (DANGEROUS)
- No approval workflow for AI-generated content
- GDPR consent not checked in outreach sequences

---

### 12. **Admin & Health** (`server/lib/bootstrap.ts`, `server/lib/health.ts`)
**Purpose**: System configuration, health monitoring, readiness checks

**Features**:
- Bootstrap service (one-time setup)
- Health checks (sheets, OpenAI, email, Places API)
- Readiness reports (Phase 2B, Phase 2C)
- Manual cron job triggers
- Feature flags
- Partner tier configuration

**Endpoints**:
- `POST /api/admin/bootstrap/run` - Full system init
- `POST /api/admin/ensure-sheets` - Create missing sheets
- `GET /api/admin/health` - Health check
- `POST /api/admin/cron/daily` - Manual cron
- `GET /api/admin/2b-readiness` - Readiness report

---

## 🔗 Data Flow Patterns

### Pattern 1: Read-Heavy Operations (Pricing, Stands, Sales)
```
User Request → API Route → Cache Check → Google Sheets → Cache Store → Response
```

### Pattern 2: AI-Assisted Operations (SEO, Outreach, Pricing)
```
User Request → API Route → Google Sheets (context) → OpenAI API → Response
                                                   ↓
                                            (Optional) Write to Sheet
```

### Pattern 3: Webhook Events (Email, Ads, Social)
```
External Provider → Webhook Endpoint → Signature Verify → Parse Event → Update Sheet
```

### Pattern 4: Background Jobs (Lead Enrichment, Email Sequences)
```
Cron/Manual Trigger → Queue Builder → Batch Processor → Rate-Limited API → Update Sheet
```

---

## 🔒 Security Architecture

### Current Security Measures:
- ✅ Google Sheets OAuth via Replit connector
- ✅ OpenAI API key via Replit secrets
- ✅ Email provider secrets (SMTP_*, BREVO_*, RESEND_*)
- ✅ OS_Logs audit trail

### Security Gaps:
- 🔴 **CRITICAL**: 12 API keys in Settings sheet (public spreadsheet)
- ❌ Webhook signature verification not enabled (missing secrets)
- ❌ No rate limiting on API endpoints
- ❌ No authentication/authorization on routes

### Recommended Security Hardening:
1. Migrate all secrets from Settings sheet to Replit Secrets
2. Add webhook signature verification (BREVO_WEBHOOK_SECRET, RESEND_WEBHOOK_SECRET)
3. Implement API authentication (OAuth, API keys)
4. Add rate limiting (express-rate-limit)
5. Add CORS configuration
6. Implement role-based access control (RBAC)

---

## 📊 Performance Characteristics

### Caching Strategy:
- **Google Sheets**: 60s TTL, invalidate on write
- **OpenAI**: No cache (stateless)
- **Settings**: Hydrated once on boot

### Concurrency Limits:
- **Google Sheets**: 3 concurrent requests (p-limit)
- **OpenAI**: 2 concurrent requests (p-limit)
- **Email**: Configurable batch size (default 10)

### Retry/Backoff:
- **Google Sheets**: 3 retries, exponential backoff (p-retry)
- **OpenAI**: 3 retries, exponential backoff (p-retry)
- **Email**: Provider-specific retry logic

---

## 🎯 Integration Points Summary

| Integration | Status | Auth Method | Features |
|-------------|--------|-------------|----------|
| Google Sheets | ✅ ACTIVE | OAuth (Replit) | Read/Write, Cache, Retry |
| OpenAI | ✅ ACTIVE | API Key | GPT-4o, Function Calling |
| Google Places | ✅ ACTIVE | API Key | Lead Harvesting, Geocoding |
| Email (SMTP) | ✅ ACTIVE | User/Pass | Direct sending |
| Email (Brevo) | ⚠️ READY | API Key | Sending, ❌ Webhooks |
| Email (Resend) | ⚠️ READY | API Key | Sending, ❌ Webhooks |
| DHL | ⚠️ PLANNED | API Key | Cost estimation (offline data) |
| WooCommerce | ⚠️ PLANNED | API Key/Secret | Sync audit only |
| Odoo | ⚠️ PLANNED | DB/User/Pass | Sync audit only |

---

**Next**: See API_SURFACE.md for complete endpoint inventory
