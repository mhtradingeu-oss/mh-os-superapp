# MH Trading OS - UI Audit & Upgrade Plan

**Date:** November 10, 2025  
**Scope:** Complete UI/UX audit across all 23 pages  
**Goal:** Achieve Lighthouse scores ≥90, full i18n (EN/AR + RTL), accessibility compliance

---

## Executive Summary

### Current State ✅ **Strengths**
- **i18n Foundation**: LanguageProvider with EN/AR translations exists
- **RTL Support**: `dir="rtl"` attribute toggle implemented
- **Dark Mode**: ThemeProvider with system preference detection
- **Component Library**: Shadcn/ui + Tailwind CSS properly configured
- **Command Palette**: Cmd+K navigation implemented
- **Loading States**: Dashboard has skeleton components

### Critical Gaps 🚨 **Found Issues**

#### 1. **Inconsistent UI Patterns** (HIGH Priority)
- ❌ No standardized page header component
- ❌ Missing breadcrumbs for deep navigation
- ❌ Inconsistent toolbar patterns (search/filter/export)
- ❌ Data tables lack sticky headers, pagination varies
- ❌ Form validation patterns differ across pages
- ❌ Empty states missing on most pages
- ❌ Error boundaries not implemented

#### 2. **i18n Incomplete** (HIGH Priority)
- ❌ Translations only cover ~15% of UI strings
- ❌ Date/number formatting not localized (no EU format)
- ❌ RTL layouts not tested/debugged
- ❌ Many hard-coded English strings in components
- ❌ No pluralization support
- ❌ Missing context-specific translations

#### 3. **AI Pages Underdeveloped** (CRITICAL Priority)
- ❌ /ai (AI Hub): Missing per-agent tabs for 7 agents
- ❌ /ai-crew: No draft diff viewer
- ❌ No job queue visualization
- ❌ Run history not implemented
- ❌ Settings tab missing for each agent
- ❌ Quick Actions not contextualized per agent

#### 4. **Accessibility Issues** (MEDIUM Priority)
- ❌ Missing ARIA labels on interactive elements
- ❌ No skip links for keyboard navigation
- ❌ Focus indicators inconsistent
- ❌ Color contrast issues in some badge/button variants
- ❌ Missing alt text on images/icons
- ❌ Form error announcements not screen-reader friendly

#### 5. **Performance Concerns** (MEDIUM Priority)
- ❌ No debouncing on table filters
- ❌ Heavy lists not memoized
- ❌ No lazy loading for routes
- ❌ Large translation objects loaded eagerly
- ❌ No virtual scrolling for long tables

---

## Page-by-Page Audit

### 📊 **Pages Inventory** (23 Total)

| Page | Route | Status | Priority | Issues Found |
|------|-------|--------|----------|-------------|
| Dashboard | `/` | 🟡 Partial | P0 | Missing i18n, no empty states for KPIs |
| Pricing Studio | `/pricing` | 🟡 Partial | P1 | Complex UI, needs standardization |
| Stand Center | `/stands` | 🟡 Partial | P1 | Map integration needs loading states |
| Sales Desk | `/sales` | 🟡 Partial | P1 | Order forms need validation UI |
| Growth | `/growth` | 🔴 Needs Work | P2 | CRM tables inconsistent |
| Outreach | `/outreach` | 🟡 Partial | P1 | Campaign UI needs refresh |
| Marketing | `/marketing` | 🟢 Good | P2 | Recently updated, mostly complete |
| Partners | `/partners` | 🟡 Partial | P2 | Table needs pagination |
| Bundles & Gifts | `/bundles-gifts` | 🟡 Partial | P2 | Form states missing |
| Commissions | `/commissions` | 🟡 Partial | P2 | Ledger tables need optimization |
| Shipping (Old) | `/shipping-old` | 🔴 Deprecated | P3 | Can be removed |
| Shipping Center | `/shipping` | 🟡 Partial | P1 | DHL integration UI needs work |
| Operations | `/operations` | 🟡 Partial | P2 | Logs viewer needs virtual scroll |
| **AI Hub** | `/ai` | 🔴 **Critical** | **P0** | **Missing per-agent tabs, settings, queue** |
| AI Marketing | `/ai-marketing` | 🟡 Partial | P2 | Duplicate of marketing features? |
| Admin | `/admin` | 🟡 Partial | P1 | Health checks need visualization |
| Control Panel | `/control-panel` | 🟡 Partial | P2 | Settings forms need i18n |
| Admin Tools | `/admin-tools` | 🟡 Partial | P2 | Seed/import UI needs feedback |
| Setup Wizard | `/setup` | 🟡 Partial | P2 | Multi-step needs progress indicator |
| Health & Logs | `/health` | 🟡 Partial | P1 | Log viewer needs filtering |
| **AI Crew** | `/ai-crew` | 🔴 **Critical** | **P0** | **Missing diff viewer, job details** |
| Integrations | `/integrations` | 🟡 Partial | P2 | Connection status unclear |
| Not Found | `/404` | 🟢 Good | P3 | OK as-is |

---

## Proposed UI Standards

### 1. **Page Header Component**

```tsx
<PageHeader
  title={t("dashboard")}
  subtitle={t("dashboard_subtitle")}
  breadcrumbs={[
    { label: t("home"), href: "/" },
    { label: t("dashboard") }
  ]}
  actions={
    <>
      <Button variant="outline" size="sm">
        <Download className="h-4 w-4 mr-2" />
        {t("export")}
      </Button>
      <Button size="sm">
        <Plus className="h-4 w-4 mr-2" />
        {t("create")}
      </Button>
    </>
  }
/>
```

### 2. **Data Table Pattern**

```tsx
<DataTable
  data={products}
  columns={productColumns}
  searchable
  searchPlaceholder={t("search_products")}
  filterable
  filters={[
    { key: "category", label: t("category"), options: categories },
    { key: "status", label: t("status"), options: statuses }
  ]}
  exportable
  exportFilename="products-export"
  stickyHeader
  pagination={{ pageSize: 50, pageSizeOptions: [25, 50, 100] }}
  emptyState={{
    icon: Package,
    title: t("no_products"),
    description: t("no_products_desc"),
    action: {
      label: t("create_product"),
      onClick: () => navigate("/products/new")
    }
  }}
/>
```

### 3. **Form Pattern with Validation**

```tsx
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <FormField
      control={form.control}
      name="productName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t("product_name")}</FormLabel>
          <FormControl>
            <Input
              {...field}
              placeholder={t("enter_product_name")}
              data-testid="input-product-name"
            />
          </FormControl>
          <FormDescription>
            {t("product_name_help")}
          </FormDescription>
          <FormMessage /> {/* Auto i18n errors */}
        </FormItem>
      )}
    />
    
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        {t("cancel")}
      </Button>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("saving")}
          </>
        ) : (
          t("save")
        )}
      </Button>
    </div>
  </form>
</Form>
```

### 4. **Loading States (3 Patterns)**

#### Pattern A: Skeleton (Preferred for lists/cards)
```tsx
{isLoading ? (
  <div className="space-y-4">
    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
  </div>
) : (
  <ProductList products={data} />
)}
```

#### Pattern B: Spinner (For buttons/inline actions)
```tsx
<Button disabled={isPending}>
  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {t("submit")}
</Button>
```

#### Pattern C: Overlay (For full-page actions)
```tsx
{isProcessing && (
  <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
    <div className="text-center space-y-2">
      <Loader2 className="h-8 w-8 animate-spin mx-auto" />
      <p className="text-sm text-muted-foreground">{t("processing")}</p>
    </div>
  </div>
)}
```

### 5. **Empty State Pattern**

```tsx
<EmptyState
  icon={Inbox}
  title={t("no_items")}
  description={t("no_items_description")}
  action={{
    label: t("create_first_item"),
    onClick: handleCreate,
    icon: Plus
  }}
/>
```

### 6. **Error State Pattern**

```tsx
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>{t("error")}</AlertTitle>
    <AlertDescription>
      {error.message || t("generic_error")}
    </AlertDescription>
  </Alert>
)}
```

---

## AI Pages Detailed Spec

### `/ai` - AI Hub Redesign

**Current Issues:**
- Only shows 2 agents (Pricing, Outreach)
- No tabs for other 5 agents (Social, SEO, CRM, Ads, E-commerce)
- Missing Settings/Queue/History tabs
- No agent-specific Quick Actions

**Proposed Structure:**

```
AI Hub
├── Agent Tabs (7 total)
│   ├── 💰 Pricing (A-PRC-100)
│   │   ├── Settings (margin targets, MAP rules)
│   │   ├── Quick Actions (Reprice All, Audit SKU, Check Competitors)
│   │   ├── Job Queue (pending/running jobs)
│   │   ├── Drafts (with diff viewer: before/after prices)
│   │   └── Run History (last 30 runs)
│   ├── ✉️ Outreach (A-OUT-101)
│   │   ├── Settings (templates, sequences, consent rules)
│   │   ├── Quick Actions (Generate Template, Create Sequence)
│   │   ├── Job Queue
│   │   ├── Drafts (email templates with preview)
│   │   └── Run History
│   ├── 📱 Social (A-SOC-102)
│   │   ├── Settings (platforms, posting schedule)
│   │   ├── Quick Actions (14-day Calendar, Single Post)
│   │   ├── Job Queue
│   │   ├── Drafts (calendar view + post preview)
│   │   └── Run History
│   ├── 🔍 SEO (A-SEO-103)
│   │   ├── Settings (target locale, intent focus)
│   │   ├── Quick Actions (Harvest Keywords, SERP Analysis)
│   │   ├── Job Queue
│   │   ├── Drafts (keyword table with metrics)
│   │   └── Run History
│   ├── 👥 CRM (A-CRM-104)
│   │   ├── Settings (cities, max leads, quality threshold)
│   │   ├── Quick Actions (Harvest Berlin, Harvest Hamburg)
│   │   ├── Job Queue
│   │   ├── Drafts (leads table with enrichment preview)
│   │   └── Run History
│   ├── 📢 Ads (A-ADS-105)
│   │   ├── Settings (budget cap, CPC range)
│   │   ├── Quick Actions (Generate Ads CSV, Suggest Negatives)
│   │   ├── Job Queue
│   │   ├── Drafts (ads preview + CSV download)
│   │   └── Run History
│   └── 🛒 E-commerce (A-ECM-106)
│       ├── Settings (audit rules, platforms)
│       ├── Quick Actions (Full Catalog Audit, Image Check)
│       ├── Job Queue
│       ├── Drafts (issues table with priority)
│       └── Run History
```

### `/ai-crew` - Approval Workflow Redesign

**Current Issues:**
- Basic approval table, no diff viewer
- InputJSON/OutputJSON shown as raw text
- No visual comparison of before/after
- Missing bulk approve/reject

**Proposed Enhancements:**

```tsx
<Tabs defaultValue="pending">
  <TabsList>
    <TabsTrigger value="pending">
      {t("pending_approval")} 
      <Badge className="ml-2">{pendingCount}</Badge>
    </TabsTrigger>
    <TabsTrigger value="approved">{t("approved")}</TabsTrigger>
    <TabsTrigger value="rejected">{t("rejected")}</TabsTrigger>
    <TabsTrigger value="all">{t("all_jobs")}</TabsTrigger>
  </TabsList>

  <TabsContent value="pending">
    <DataTable
      data={pendingJobs}
      columns={jobColumns}
      selectable // Enable bulk actions
      actions={
        <>
          <Button onClick={handleBulkApprove} disabled={!selectedRows.length}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {t("approve_selected")} ({selectedRows.length})
          </Button>
          <Button variant="destructive" onClick={handleBulkReject} disabled={!selectedRows.length}>
            <XCircle className="mr-2 h-4 w-4" />
            {t("reject_selected")} ({selectedRows.length})
          </Button>
        </>
      }
    />
  </TabsContent>
</Tabs>

{/* Job Detail Dialog with Diff Viewer */}
<Dialog open={selectedJob !== null}>
  <DialogContent className="max-w-4xl">
    <DialogHeader>
      <DialogTitle>
        {selectedJob?.AgentID} - {selectedJob?.Task}
      </DialogTitle>
    </DialogHeader>
    
    <Tabs defaultValue="diff">
      <TabsList>
        <TabsTrigger value="diff">{t("diff")}</TabsTrigger>
        <TabsTrigger value="input">{t("input")}</TabsTrigger>
        <TabsTrigger value="output">{t("output")}</TabsTrigger>
        <TabsTrigger value="guardrails">{t("guardrails")}</TabsTrigger>
      </TabsList>
      
      <TabsContent value="diff">
        {/* Agent-specific diff rendering */}
        {selectedJob?.AgentID === 'A-PRC-100' && (
          <PricingDiffViewer job={selectedJob} />
        )}
        {selectedJob?.AgentID === 'A-SOC-102' && (
          <SocialDiffViewer job={selectedJob} />
        )}
        {/* Fallback: side-by-side JSON */}
        <DiffViewer
          before={selectedJob?.inputData}
          after={selectedJob?.outputData}
        />
      </TabsContent>
    </Tabs>
    
    <DialogFooter>
      <Textarea
        placeholder={t("add_notes")}
        value={approvalNotes}
        onChange={(e) => setApprovalNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setSelectedJob(null)}>
          {t("cancel")}
        </Button>
        <Button variant="destructive" onClick={handleReject}>
          <XCircle className="mr-2 h-4 w-4" />
          {t("reject")}
        </Button>
        <Button onClick={handleApprove}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {t("approve")}
        </Button>
      </div>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## i18n Expansion Plan

### Translation Coverage Required

| Category | Keys Needed | Current | Target |
|----------|-------------|---------|--------|
| Common UI | 50 | 15 | 50 |
| Dashboard | 30 | 0 | 30 |
| Pricing | 40 | 0 | 40 |
| Stands | 35 | 0 | 35 |
| Sales | 30 | 0 | 30 |
| Growth/CRM | 40 | 0 | 40 |
| Outreach | 35 | 10 | 35 |
| Marketing | 60 | 60 ✅ | 60 |
| Shipping | 30 | 0 | 30 |
| Operations | 25 | 0 | 25 |
| AI Hub | 80 | 5 | 80 |
| AI Crew | 40 | 5 | 40 |
| Admin | 45 | 0 | 45 |
| **TOTAL** | **510** | **95 (19%)** | **510** |

### Date/Number Formatting

```typescript
// Add to language-provider.tsx
export const formatters = {
  en: {
    date: (date: string) => new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin'
    }).format(new Date(date)),
    number: (num: number) => new Intl.NumberFormat('en-GB').format(num),
    currency: (amount: number, currency = 'EUR') =>
      new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency
      }).format(amount),
  },
  ar: {
    date: (date: string) => new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Europe/Berlin'
    }).format(new Date(date)),
    number: (num: number) => new Intl.NumberFormat('ar-EG').format(num),
    currency: (amount: number, currency = 'EUR') =>
      new Intl.NumberFormat('ar-EG', {
        style: 'currency',
        currency
      }).format(amount),
  }
};
```

---

## Accessibility Checklist

### WCAG 2.1 AA Compliance

- [ ] **Perceivable**
  - [ ] All images have alt text
  - [ ] Color contrast ratio ≥ 4.5:1 for normal text
  - [ ] Color contrast ratio ≥ 3:1 for large text
  - [ ] No information conveyed by color alone
  
- [ ] **Operable**
  - [ ] All functionality via keyboard
  - [ ] Focus visible on all interactive elements
  - [ ] Skip links to main content
  - [ ] No keyboard traps
  - [ ] Clickable areas ≥ 44x44px
  
- [ ] **Understandable**
  - [ ] Form labels clearly associated
  - [ ] Error messages descriptive
  - [ ] Instructions provided for complex inputs
  - [ ] Language attribute set correctly
  
- [ ] **Robust**
  - [ ] Valid HTML semantics
  - [ ] ARIA attributes used correctly
  - [ ] Screen reader tested with NVDA/JAWS

### Implementation

```tsx
// Skip Links
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
>
  {t("skip_to_main_content")}
</a>

// Accessible Form Fields
<FormField
  control={form.control}
  name="email"
  render={({ field, fieldState }) => (
    <FormItem>
      <FormLabel htmlFor="email">
        {t("email")}
        <span className="text-destructive ml-1" aria-label={t("required")}>*</span>
      </FormLabel>
      <FormControl>
        <Input
          {...field}
          id="email"
          type="email"
          aria-required="true"
          aria-invalid={!!fieldState.error}
          aria-describedby={fieldState.error ? "email-error" : "email-help"}
          data-testid="input-email"
        />
      </FormControl>
      <FormDescription id="email-help">
        {t("email_help")}
      </FormDescription>
      {fieldState.error && (
        <FormMessage id="email-error" role="alert">
          {fieldState.error.message}
        </FormMessage>
      )}
    </FormItem>
  )}
/>

// Accessible Tables
<table role="table" aria-label={t("products_table")}>
  <thead>
    <tr role="row">
      <th role="columnheader" scope="col">{t("name")}</th>
      <th role="columnheader" scope="col">{t("price")}</th>
      <th role="columnheader" scope="col">
        <span className="sr-only">{t("actions")}</span>
      </th>
    </tr>
  </thead>
  <tbody>
    {products.map(product => (
      <tr key={product.id} role="row">
        <td role="cell">{product.name}</td>
        <td role="cell">{formatCurrency(product.price)}</td>
        <td role="cell">
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("edit_product", { name: product.name })}
          >
            <Edit className="h-4 w-4" />
          </Button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

---

## Performance Optimization

### 1. **Debounced Search**

```tsx
import { useDebouncedValue } from "@/hooks/use-debounce";

function ProductSearch() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  
  const { data } = useQuery({
    queryKey: ['/api/products', debouncedSearch],
    enabled: debouncedSearch.length > 0
  });
  
  return (
    <Input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder={t("search")}
    />
  );
}
```

### 2. **Memoized Lists**

```tsx
import { useMemo } from "react";

function ProductList({ products }: { products: Product[] }) {
  const sortedProducts = useMemo(() => {
    return products.sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);
  
  return (
    <div>
      {sortedProducts.map(product => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
```

### 3. **Lazy Route Loading**

```tsx
import { lazy, Suspense } from "react";

const AdminPage = lazy(() => import("@/pages/admin"));
const PricingStudio = lazy(() => import("@/pages/pricing-studio"));

function Router() {
  return (
    <Suspense fallback={<PageLoadingSkeleton />}>
      <Switch>
        <Route path="/admin" component={AdminPage} />
        <Route path="/pricing" component={PricingStudio} />
      </Switch>
    </Suspense>
  );
}
```

### 4. **Virtual Scrolling (For Long Tables)**

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

function VirtualTable({ data }: { data: any[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50, // Row height
    overscan: 10,
  });
  
  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <ProductRow product={data[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Implementation Phases

### **Phase 1: Foundation (Week 1)** ✅ **This Sprint**

1. ✅ Create reusable UI components
   - PageHeader
   - DataTable
   - EmptyState
   - ErrorBoundary
   - LoadingStates

2. ✅ Expand i18n translations to 100% coverage
   - All 510 translation keys
   - Date/number formatters
   - Pluralization support

3. ✅ Upgrade AI Hub (/ai)
   - Per-agent tabs (all 7 agents)
   - Settings/Quick Actions/Queue/Drafts/History
   - Agent-specific diff viewers

4. ✅ Upgrade AI Crew (/ai-crew)
   - Enhanced approval workflow
   - Bulk approve/reject
   - Visual diff viewer
   - Job detail dialog

### **Phase 2: Core Pages (Week 2)**

5. Upgrade Dashboard
   - i18n all strings
   - Empty states for all KPI cards
   - Health status visualization

6. Upgrade Pricing Studio
   - Standardized tables
   - Bulk repricing UI
   - MAP violation warnings

7. Upgrade Stand Center
   - Map loading states
   - QR code generation UI
   - Refill planning interface

8. Upgrade Sales Desk
   - Quote builder with validation
   - Invoice generation UI
   - Commission calculator

### **Phase 3: Secondary Pages (Week 3)**

9. Upgrade Growth/CRM
   - Lead table with filters
   - Enrichment UI
   - Territory assignment

10. Upgrade Outreach
    - Template editor
    - Sequence builder
    - Campaign analytics

11. Upgrade Shipping
    - DHL rate calculator
    - Label generation
    - Shipment tracking

12. Upgrade Partners
    - Partner tiers management
    - Contract templates
    - Performance metrics

### **Phase 4: Admin & Polish (Week 4)**

13. Upgrade Admin pages
    - Health monitoring dashboard
    - Log viewer with filters
    - Settings management

14. Accessibility audit
    - ARIA labels
    - Keyboard navigation
    - Screen reader testing

15. Performance optimization
    - Lazy loading
    - Virtual scrolling
    - Bundle size analysis

16. Lighthouse validation
    - Performance ≥ 90
    - Accessibility ≥ 90
    - Best Practices ≥ 90
    - SEO ≥ 90

---

## Acceptance Criteria

### ✅ **Must Have (Sprint 1 - This Week)**

- [ ] All 510 i18n keys translated (EN/AR)
- [ ] RTL layouts tested and debugged
- [ ] AI Hub (/ai) with 7 agent tabs fully functional
- [ ] AI Crew (/ai-crew) with approval workflow + diff viewer
- [ ] PageHeader, DataTable, EmptyState components created
- [ ] Date/number formatters use EU formats (Europe/Berlin)
- [ ] Loading/error/empty states on AI pages
- [ ] OS_Logs entry: "UI audit & refresh - PASS"
- [ ] OS_Health entry: "UI refresh complete"

### 🎯 **Should Have (Sprint 2-3)**

- [ ] Dashboard, Pricing, Stands, Sales pages upgraded
- [ ] All data tables use standardized component
- [ ] All forms use consistent validation UI
- [ ] Keyboard navigation with skip links
- [ ] Focus indicators visible
- [ ] Error boundaries on all routes

### 💎 **Nice to Have (Sprint 4)**

- [ ] Virtual scrolling on 1000+ row tables
- [ ] Lazy route loading
- [ ] Lighthouse scores ≥ 90 across the board
- [ ] Screen reader tested (NVDA/JAWS)
- [ ] Bundle size < 500KB (gzipped)

---

## Before/After Screenshots

### AI Hub - Before
```
[Current State]
- Only 2 agents visible (Pricing, Outreach)
- Single textarea input
- No visual feedback
- No job queue
```

### AI Hub - After
```
[Proposed State]
- 7 agent tabs with icons
- Tabs: Settings | Quick Actions | Queue | Drafts | History
- Visual diff viewer for drafts
- Live job status updates
- Context-aware Quick Actions per agent
```

### AI Crew - Before
```
[Current State]
- Basic table with raw JSON
- No visual diff
- Single approve/reject per job
```

### AI Crew - After
```
[Proposed State]
- Tabs: Pending | Approved | Rejected | All
- Side-by-side diff viewer
- Bulk approve/reject
- Agent-specific diff rendering (e.g., price changes, social posts)
- Notes/comments on approvals
```

---

## Risk Mitigation

### **Risk 1: RTL Layout Breaks**
- **Mitigation**: Test every page in AR mode before merging
- **Fallback**: CSS logical properties (margin-inline-start vs margin-left)

### **Risk 2: Translation Inconsistencies**
- **Mitigation**: Use TypeScript for translation keys (type-safe t())
- **Fallback**: Show English fallback + log missing keys

### **Risk 3: Performance Regression**
- **Mitigation**: Lighthouse CI in PR checks
- **Fallback**: Revert to skeleton loading if virtual scroll breaks

### **Risk 4: Backend API Changes**
- **Mitigation**: Preserve all existing API contracts
- **Fallback**: Feature flags for new UI patterns

---

## Success Metrics

| Metric | Before | Target | How to Measure |
|--------|--------|--------|----------------|
| i18n Coverage | 19% | 100% | Count translated keys |
| Lighthouse Perf | Unknown | ≥90 | Chrome DevTools |
| Lighthouse A11y | Unknown | ≥90 | Chrome DevTools |
| AI Hub Usability | 2/10 | 9/10 | User testing |
| AI Crew Workflow | 4/10 | 9/10 | User testing |
| RTL Support | Partial | Full | Visual QA in AR mode |
| Loading States | 30% | 100% | Code audit |
| Empty States | 10% | 100% | Code audit |

---

## Next Steps

1. ✅ **Create Reusable Components** (PageHeader, DataTable, etc.)
2. ✅ **Expand i18n to 510 Keys** (EN + AR)
3. ✅ **Implement AI Hub Redesign** (7 agent tabs)
4. ✅ **Implement AI Crew Approval UI** (diff viewer)
5. **Test RTL Layouts** (all pages in AR mode)
6. **Run Lighthouse Audit** (document scores)
7. **Create UI_STATUS.md** (document all changes)

---

**End of UI Audit Report**
