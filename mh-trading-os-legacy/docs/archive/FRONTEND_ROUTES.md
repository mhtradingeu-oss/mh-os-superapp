# MH Trading OS - Frontend Routes & Pages Report

**Generated**: 2025-11-10T12:45:00Z

---

## 📱 Frontend Pages Inventory

**Total Pages**: 23  
**Fully Implemented**: 15 (65%)  
**Partially Implemented**: 6 (26%)  
**Placeholder/Minimal**: 2 (9%)

---

## 🗺️ Route Map

### Core Application Routes

| Route | Component | Status | Features | Missing |
|-------|-----------|--------|----------|---------|
| `/` | Dashboard | ✅ COMPLETE | Real-time KPIs, system overview, quick actions | - |
| `/pricing` | PricingStudio | ✅ COMPLETE | Products table, bulk reprice, MAP warnings, export | - |
| `/stands` | StandCenter | ✅ COMPLETE | Stands list, inventory, refill plans, QR codes | Visit mode photos |
| `/sales` | SalesDesk | ✅ COMPLETE | Quote builder, tiered pricing, PDF invoice | - |
| `/partners` | PartnersPage | ✅ COMPLETE | Partners list, assortment, tiers | - |
| `/operations` | Operations | ✅ COMPLETE | DHL shipping, cost estimation, tracking | - |
| `/shipping` | ShippingCenter | ✅ COMPLETE | Shipping methods, rules, boxes, manifest | - |
| `/growth` | GrowthPage | ✅ COMPLETE | CRM leads, Places harvesting, scoring, assignment | - |
| `/outreach` | OutreachPage | ✅ COMPLETE | Campaigns, templates, sequences, monitoring | - |
| `/marketing` | MarketingPage | ✅ COMPLETE | SEO, Ads, Social Studio tabs | - |
| `/bundles-gifts` | BundlesGiftsPage | ✅ COMPLETE | Bundles, gifts, subscriptions | - |
| `/commissions` | CommissionsLoyaltyPage | ✅ COMPLETE | Commission rules, loyalty ledger | - |
| `/integrations` | Integrations | ✅ COMPLETE | Integration list, sync queue, health checks | - |
| `/health` | HealthLogs | ✅ COMPLETE | OS_Logs, health checks, readiness reports | - |
| `/admin` | Admin | ✅ COMPLETE | System settings, cron jobs, bootstrapping | - |

### AI & Specialized Routes

| Route | Component | Status | Features | Missing |
|-------|-----------|--------|----------|---------|
| `/ai` | AIHub | ⚠️ PARTIAL | Basic UI, agent calls | **4 specialized tabs** |
| `/ai-crew` | AICrew | ⚠️ PARTIAL | Basic UI | **4 major sections** |
| `/ai-marketing` | AIMarketing | ⚠️ PARTIAL | AI marketing tools | Better integration |

### Utility Routes

| Route | Component | Status | Features | Missing |
|-------|-----------|--------|----------|---------|
| `/setup` | SetupWizard | ✅ COMPLETE | Initial setup, test connections | - |
| `/control-panel` | ControlPanel | ⚠️ SCAFFOLD | System controls | Full implementation |
| `/admin-tools` | AdminToolsPage | ⚠️ SCAFFOLD | Admin utilities | Full implementation |
| `/shipping-old` | ShippingOperationsPage | ⚠️ DEPRECATED | Legacy shipping | Replace with /shipping |
| `*` | NotFound | ✅ COMPLETE | 404 page | - |

---

## 🎯 Detailed Page Analysis

### 1. **Dashboard** (`/`)
**Status**: ✅ COMPLETE (100%)

**Features**:
- Real-time system overview
- Key metrics (products, partners, stands, orders)
- Recent activity feed
- Quick action buttons
- Health status indicators
- EN/AR translations, dark mode

**Data Sources**:
- `GET /api/bootstrap` - Initial data
- `GET /api/admin/health` - System health
- `GET /api/logs` - Recent activity

**UI Components**:
- Stats cards with icons
- Recent activity table
- Quick action buttons
- Status badges

---

### 2. **Pricing Studio** (`/pricing`)
**Status**: ✅ COMPLETE (100%)

**Features**:
- Products data table (sortable, filterable)
- Bulk reprice with MAP warnings
- Price explanation (AI-powered)
- Export to PDF
- Tiered pricing display
- Guardrail violation warnings

**Data Sources**:
- `GET /api/pricing/products`
- `GET /api/pricing/params`
- `POST /api/pricing/bulk-reprice`
- `POST /api/ai/explain-price`

**UI Components**:
- DataTable with pagination
- Bulk action toolbar
- Price breakdown dialog
- MAP warning badges

---

### 3. **Stand Center** (`/stands`)
**Status**: ✅ COMPLETE (95%)

**Features**:
- Stands list with GPS tracking
- Inventory management (min/max levels)
- Refill planning
- QR code generation (per stand + per product)
- Stand KPIs

**Missing**:
- Visit mode (check-in/out, photo upload)

**Data Sources**:
- `GET /api/stands`
- `GET /api/stands/:id`
- `POST /api/stands`
- `GET /api/qrcode/stand/:id`
- `POST /api/ai/stand-refill-suggest`

**UI Components**:
- Stands grid/table
- Inventory table with status badges
- QR code generator
- Refill planning wizard

---

### 4. **Sales Desk** (`/sales`)
**Status**: ✅ COMPLETE (100%)

**Features**:
- Quick quote builder
- Tiered pricing (Dealer Basic/Plus, Stand, Distributor)
- Loyalty program management
- MAP violation warnings
- PDF invoice generation
- Commission/loyalty ledger tracking
- Quote → Order conversion

**Data Sources**:
- `GET /api/sales/quotes`
- `POST /api/sales/quotes`
- `POST /api/sales/quotes/:id/convert`
- `POST /api/sales/orders/:id/invoice`
- `GET /api/partners`

**UI Components**:
- Quote builder form
- Line items table
- Pricing tier selector
- Invoice preview
- PDF download button

---

### 5. **Marketing Page** (`/marketing`)
**Status**: ✅ COMPLETE (100%)

**Architecture**: 3-tab system (SEO, Ads, Social Studio)

#### **SEO Tab**:
- ✅ Keyword harvesting (AI)
- ✅ Keyword clustering (semantic analysis)
- ✅ Priority scoring
- ✅ SEO brief editor with AI generation
- ✅ On-page audit suggestions

#### **Ads Tab**:
- ✅ Campaign builder
- ✅ Ad group management
- ✅ Creative editor
- ✅ Keyword/negative keyword editors
- ✅ Google Ads CSV export

#### **Social Tab**:
- ✅ Calendar view (month/week/day)
- ✅ Post composer with AI suggestions
- ✅ Asset picker
- ✅ Scheduling (ICS/CSV export)
- ✅ Platform targeting

**Data Sources** (49 endpoints):
- SEO: `/api/marketing/seo/*`
- Ads: `/api/marketing/ads/*`
- Social: `/api/marketing/social/*`
- UTM: `/api/marketing/utm/*`
- KPIs: `/api/marketing/kpis/*`

**UI Components**:
- Tabs navigation
- Data tables with filters
- AI suggestion dialogs
- Calendar components
- CSV/PDF export buttons
- UTM builder
- KPI dashboard

---

### 6. **Growth Page** (`/growth`)
**Status**: ✅ COMPLETE (100%)

**Features**:
- CRM leads table (21 columns)
- Google Places harvesting
- 4-key deduplication
- E.164 phone normalization
- Lead scoring (0-30 points)
- Territory assignment
- AI enrichment queue
- CSV export

**Data Sources**:
- `GET /api/growth/leads`
- `POST /api/growth/places/search`
- `POST /api/growth/score`
- `GET /api/growth/assign`
- `POST /api/growth/enrich/run`
- `GET /api/growth/export`

**UI Components**:
- Leads data table
- Places search form
- Score calculator
- Assignment rules editor
- Enrichment queue monitor

---

### 7. **Outreach Page** (`/outreach`)
**Status**: ✅ COMPLETE (100%)

**Features**:
- Campaign builder (Zod-validated)
- Template studio with AI suggestions
- Recipient monitoring
- Sequence management (start, pause, tick, complete)
- Email event tracking (opens, clicks, bounces)
- GDPR compliance (unsubscribe, consent flags)

**Data Sources**:
- `POST /api/outreach/sequence/*`
- `POST /api/outreach/ai/*`
- `POST /api/outreach/audience/build`

**UI Components**:
- Campaign form
- Template editor with variables
- Recipients table
- Sends monitor
- Event timeline
- AI suggestion dialog

---

### 8. **AI Hub** (`/ai`)
**Status**: ⚠️ PARTIAL (40%)

**Current Features**:
- Basic UI layout
- Command palette
- AI agent calls (explain-price, stand-refill, social-plan)

**Missing Features** (from AI Crew requirements):
- ❌ **Pricing Analyst Tab**: Chat panel, context selector, "Explain math"
- ❌ **Stand Ops Tab**: Refill planner, inventory optimizer
- ❌ **Growth Writer Tab**: Lead enrichment, email drafting
- ❌ **Ops Assistant Tab**: General operations support

**Required Implementation**:
```typescript
// Expected structure
<Tabs>
  <TabsList>
    <TabsTrigger value="pricing">Pricing Analyst</TabsTrigger>
    <TabsTrigger value="stand">Stand Ops</TabsTrigger>
    <TabsTrigger value="growth">Growth Writer</TabsTrigger>
    <TabsTrigger value="ops">Ops Assistant</TabsTrigger>
  </TabsList>
  
  <TabsContent value="pricing">
    <ChatPanel agentId="A-PRC-100" />
    <ContextSelector sheets={["FinalPriceList", "Pricing_Params"]} />
    <ExplainMathButton />
  </TabsContent>
  
  {/* Similar for other tabs */}
</Tabs>
```

**Data Sources** (needs integration):
- `POST /api/ai/chat/:agentId` (❌ MISSING)
- `GET /api/ai/agents` (❌ MISSING)

---

### 9. **AI Crew** (`/ai-crew`)
**Status**: ⚠️ PARTIAL (30%)

**Current Features**:
- Basic page layout
- Placeholder UI

**Missing Features** (from AI Crew requirements):

#### ❌ **Section 1: Agents Grid**
- Cards showing each agent (18 total)
- Agent status (active/idle/running)
- Enable/disable toggles
- Prompt editor
- Scope configuration (Read/Write permissions)
- Last run stats (success rate, total runs)

#### ❌ **Section 2: Playbooks**
- Playbook list (Daily/Weekly/Monthly + manual)
- "Run Now" buttons
- Schedule editor
- Playbook dependencies
- Execution history

#### ❌ **Section 3: Task Status**
- Live task table (id, agent, playbook, started, status, outputs)
- Real-time updates
- Task logs viewer
- Cancel/retry actions

#### ❌ **Section 4: Outbox Review**
- Tables for each draft sheet:
  - Pricing_Suggestions
  - Outreach_Queue
  - SEO_Content
  - Ads_Creatives
  - Social_Calendar
  - Legal_Contracts
- Approve/Reject/Apply buttons
- Diff previews (before/after)
- Bulk actions

**Required Implementation**:
```typescript
// Expected structure
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Section 1: Agents Grid */}
  <Card>
    <CardHeader>
      <CardTitle>AI Agents (18)</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map(agent => (
          <AgentCard
            key={agent.agentId}
            agent={agent}
            onToggle={handleToggle}
            onEdit={handleEditPrompt}
          />
        ))}
      </div>
    </CardContent>
  </Card>
  
  {/* Section 2: Playbooks */}
  <Card>
    <CardHeader>
      <CardTitle>Playbooks</CardTitle>
    </CardHeader>
    <CardContent>
      <PlaybookList
        playbooks={playbooks}
        onRun={handleRunPlaybook}
      />
    </CardContent>
  </Card>
  
  {/* Section 3: Task Status */}
  <Card>
    <CardHeader>
      <CardTitle>Active Tasks</CardTitle>
    </CardHeader>
    <CardContent>
      <TaskTable tasks={tasks} onCancel={handleCancel} />
    </CardContent>
  </Card>
  
  {/* Section 4: Outbox Review */}
  <Card>
    <CardHeader>
      <CardTitle>Drafts Awaiting Approval</CardTitle>
    </CardHeader>
    <CardContent>
      <OutboxReview
        drafts={drafts}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </CardContent>
  </Card>
</div>
```

**Data Sources** (needs implementation):
- `GET /api/ai/agents` (❌ MISSING)
- `GET /api/ai/playbooks` (⚠️ MAYBE EXISTS)
- `GET /api/ai/tasks` (⚠️ SCAFFOLD)
- `POST /api/ai/run-playbook/:id` (❌ MISSING)
- `POST /api/ai/agents/:id/approve-draft` (❌ MISSING)

---

### 10. **Other Pages** (Status Summary)

| Page | Status | Completion | Notes |
|------|--------|------------|-------|
| **Partners** | ✅ COMPLETE | 100% | Partners list, assortment, tiers |
| **Bundles/Gifts** | ✅ COMPLETE | 100% | Bundles, gifts, subscriptions |
| **Commissions** | ✅ COMPLETE | 100% | Commission rules, loyalty ledger |
| **Shipping Center** | ✅ COMPLETE | 100% | Methods, rules, boxes, manifest |
| **Operations** | ✅ COMPLETE | 100% | DHL shipping, tracking |
| **Integrations** | ✅ COMPLETE | 100% | Integration health, sync queue |
| **Health Logs** | ✅ COMPLETE | 100% | OS_Logs, health checks |
| **Admin** | ✅ COMPLETE | 100% | Settings, cron, bootstrap |
| **Setup Wizard** | ✅ COMPLETE | 100% | Initial setup, test connections |
| **Control Panel** | ⚠️ SCAFFOLD | 30% | Needs full implementation |
| **Admin Tools** | ⚠️ SCAFFOLD | 30% | Needs full implementation |
| **AI Marketing** | ⚠️ PARTIAL | 60% | Exists but not as polished as /marketing |
| **NotFound** | ✅ COMPLETE | 100% | 404 page |

---

## 🎨 UI/UX Consistency

### Design System:
- ✅ **Font**: Inter
- ✅ **Primary Color**: Teal (#14b8a6)
- ✅ **Dark Mode**: Full support
- ✅ **Translations**: EN/AR with RTL support
- ✅ **Icons**: Lucide React
- ✅ **Components**: Shadcn UI

### Common Patterns:
- ✅ Data tables with sorting, filtering, pagination
- ✅ Search bars with debounce
- ✅ Export buttons (CSV/PDF/ICS)
- ✅ Modal dialogs for forms
- ✅ Toast notifications
- ✅ Loading skeletons
- ✅ Error boundaries
- ✅ Responsive layouts

### Missing Patterns:
- ⚠️ Command-K palette (partially implemented)
- ⚠️ Inline "Explain math" tooltips
- ❌ Diff previews (before/after comparison)
- ❌ Drag-and-drop interfaces
- ❌ Real-time collaboration indicators

---

## 📊 Frontend Coverage by Feature

### ✅ **Fully Covered** (100%):
1. **Marketing Module**: SEO, Ads, Social Studio
2. **Pricing Studio**: Products, bulk reprice, MAP
3. **Sales Desk**: Quotes, orders, invoices
4. **Stand Center**: Stands, inventory, refill
5. **Growth/CRM**: Leads, harvesting, scoring
6. **Outreach**: Campaigns, templates, sequences
7. **Shipping**: DHL, methods, rules, boxes
8. **Partners**: Registry, tiers, assortment
9. **Bundles/Subscriptions**: Bundles, gifts, subs
10. **Commissions/Loyalty**: Rules, ledgers
11. **Integrations**: Health, sync queue
12. **Admin/Health**: Logs, settings, cron

### ⚠️ **Partially Covered** (30-60%):
13. **AI Hub**: Basic UI, missing 4 specialized tabs
14. **AI Crew**: Basic UI, missing 4 major sections
15. **AI Marketing**: Exists but needs polish

### ❌ **Not Covered** (0-30%):
16. **Control Panel**: Scaffold only
17. **Admin Tools**: Scaffold only

---

## 🚀 Recommended Frontend Actions

### **Priority 1 (This Week):**
1. Build AI Hub 4 tabs (Pricing Analyst, Stand Ops, Growth Writer, Ops Assistant)
2. Build AI Crew 4 sections (Agents, Playbooks, Tasks, Outbox Review)
3. Add missing data-testid attributes for E2E testing

### **Priority 2 (Next 2 weeks):**
4. Implement diff preview component (before/after comparison)
5. Add real-time task status updates (WebSocket or polling)
6. Enhance Command-K palette with more actions
7. Add inline "Explain math" tooltips for pricing

### **Priority 3 (Later):**
8. Implement drag-and-drop for task prioritization
9. Add real-time collaboration indicators
10. Create mobile-optimized views
11. Add accessibility improvements (ARIA, keyboard nav)

---

**Next**: See SHEETS_AUDIT.md for worksheet verification
