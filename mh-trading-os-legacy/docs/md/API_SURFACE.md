# MH Trading OS - API Surface Report

**Generated**: 2025-11-10T12:45:00Z

---

## 📋 Complete API Inventory

**Total Endpoints**: 203  
**Implemented**: 203 ✅  
**Missing (from AI Crew requirements)**: 3 ❌

---

## 🎯 Endpoints by Domain

### 1. **Admin & System** (23 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| POST | `/api/admin/bootstrap/run` | Run full system bootstrap | ✅ |
| POST | `/api/admin/ensure-sheets` | Create/verify all sheets | ✅ |
| GET | `/api/admin/2b-readiness` | Phase 2B readiness check | ✅ |
| POST | `/api/admin/2b-readiness/write` | Write readiness to OS_Health | ✅ |
| POST | `/api/admin/normalize-numbers` | Clean currency symbols | ✅ |
| POST | `/api/admin/rehydrate-settings` | Reload settings from sheets | ✅ |
| POST | `/api/admin/generate-reports` | Generate readiness reports | ✅ |
| POST | `/api/admin/cron/daily` | Manual daily cron | ✅ |
| POST | `/api/admin/cron/weekly` | Manual weekly cron | ✅ |
| POST | `/api/admin/cron/monthly` | Manual monthly cron | ✅ |
| GET | `/api/admin/feature-flags` | Get feature flags | ✅ |
| GET | `/api/admin/secrets-status` | Secret environment status | ✅ |
| GET | `/api/admin/health` | Comprehensive health check | ✅ |
| POST | `/api/admin/health/run` | Manual health check | ✅ |
| GET | `/api/admin/ready` | Readiness checks | ✅ |
| GET | `/api/admin/enums` | Fetch enum values | ✅ |
| POST | `/api/admin/enums` | Create enum value | ✅ |
| PATCH | `/api/admin/enums/:list/:key` | Update enum value | ✅ |
| GET | `/api/admin/setup/config` | Setup configuration | ✅ |
| GET | `/api/admin/setup/status` | Setup status check | ✅ |
| POST | `/api/admin/setup/test-sheets` | Test Google Sheets | ✅ |
| POST | `/api/admin/setup/test-drive` | Test Google Drive | ✅ |
| POST | `/api/admin/setup/test-email` | Test email config | ✅ |
| POST | `/api/admin/setup/save` | Save setup config | ✅ |

---

### 2. **Pricing Studio** (11 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/products` | Search products | ✅ |
| GET | `/api/products/:sku/explain` | Explain price calculation | ✅ |
| POST | `/api/products/reprice` | Reprice specific SKUs | ✅ |
| GET | `/api/pricing/products` | Get products for Pricing Studio | ✅ |
| PATCH | `/api/pricing/products/:sku` | Update product | ✅ |
| GET | `/api/pricing/params` | Get pricing parameters | ✅ |
| POST | `/api/pricing/params` | Create pricing parameter | ✅ |
| PATCH | `/api/pricing/params/:param` | Update pricing parameter | ✅ |
| GET | `/api/pricing/suggestions` | Get pricing suggestions | ✅ |
| POST | `/api/pricing/bulk-reprice` | Bulk reprice operation | ✅ |
| POST | `/api/pricing/calculate` | Calculate prices for SKU | ✅ |
| POST | `/api/pricing/export-pdf` | Export pricing PDF | ✅ |
| POST | `/api/price/calc` | Calculate order pricing | ✅ |

---

### 3. **Stand Center** (6 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/stands` | Get all stands | ✅ |
| GET | `/api/stands/:id` | Get stand + inventory | ✅ |
| POST | `/api/stands` | Create stand | ✅ |
| GET | `/api/qrcode/stand/:id` | Generate stand QR code | ✅ |
| GET | `/api/qrcode/product/:sku` | Generate product QR code | ✅ |
| POST | `/api/ai/stand-refill-suggest` | AI refill plan | ✅ |

---

### 4. **Partners** (8 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/partners` | Get all partners | ✅ |
| GET | `/api/partners/:id` | Get specific partner | ✅ |
| POST | `/api/partners` | Create partner | ✅ |
| PATCH | `/api/partners/:id` | Update partner | ✅ |
| GET | `/api/partners/:id/assortment` | Get authorized assortment | ✅ |
| POST | `/api/partners/:id/assortment` | Update assortment | ✅ |
| GET | `/api/partners/:id/starter-bundle` | Get starter bundle | ✅ |
| POST | `/api/partners/:id/starter-bundle` | Create starter bundle | ✅ |
| GET | `/api/partners/:id/refill-plan` | Get refill plans | ✅ |
| POST | `/api/partners/:id/refill-plan` | Create refill plan | ✅ |

---

### 5. **Sales Desk** (7 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/sales/quotes` | Get all quotes | ✅ |
| GET | `/api/sales/quotes/:id` | Get quote + lines | ✅ |
| POST | `/api/sales/quotes` | Create quote | ✅ |
| POST | `/api/sales/quotes/:id/convert` | Convert quote to order | ✅ |
| GET | `/api/sales/orders` | Get all orders | ✅ |
| GET | `/api/sales/orders/:id` | Get order + lines | ✅ |
| POST | `/api/sales/orders/:id/invoice` | Generate invoice PDF | ✅ |
| POST | `/api/quote` | Create quote (legacy) | ✅ |
| POST | `/api/order/convert` | Convert quote to order (legacy) | ✅ |

---

### 6. **Shipping & DHL** (14 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/shipments` | Get all DHL shipments | ✅ |
| POST | `/api/shipments` | Create shipment | ✅ |
| PATCH | `/api/shipments/:id` | Update shipment | ✅ |
| POST | `/api/shipments/manifest` | Create manifest | ✅ |
| POST | `/api/dhl/estimate` | Estimate shipping cost | ✅ |
| GET | `/api/shipping/methods` | Get shipping methods | ✅ |
| POST | `/api/shipping/methods` | Create shipping method | ✅ |
| PATCH | `/api/shipping/methods/:methodId` | Update shipping method | ✅ |
| GET | `/api/shipping/rules` | Get shipping rules | ✅ |
| POST | `/api/shipping/rules` | Create shipping rule | ✅ |
| PATCH | `/api/shipping/rules/:ruleId` | Update shipping rule | ✅ |
| GET | `/api/shipping/boxes` | Get packaging boxes | ✅ |
| POST | `/api/shipping/boxes` | Create packaging box | ✅ |
| PATCH | `/api/shipping/boxes/:boxId` | Update packaging box | ✅ |
| GET | `/api/shipping/shipments` | Get shipments | ✅ |
| POST | `/api/shipping/shipments` | Create shipment record | ✅ |
| PATCH | `/api/shipping/shipments/:shipmentId` | Update shipment | ✅ |
| POST | `/api/shipping/calculate` | Calculate shipping cost | ✅ |
| POST | `/api/shipping/available-methods` | Get available methods | ✅ |

---

### 7. **Growth / CRM** (8 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/growth/leads` | Get all CRM leads | ✅ |
| POST | `/api/growth/places/search` | Harvest leads from Google Places | ✅ |
| GET | `/api/growth/places/normalize` | Normalize lead fields | ✅ |
| POST | `/api/growth/score` | Calculate lead scores | ✅ |
| GET | `/api/growth/assign` | Assign leads to territories | ✅ |
| GET | `/api/growth/export` | Export leads as CSV | ✅ |
| POST | `/api/growth/enrich/queue` | Build enrichment queue | ✅ |
| POST | `/api/growth/enrich/run` | Run AI enrichment | ✅ |

---

### 8. **Outreach** (14 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| POST | `/api/outreach/health` | Check email transport health | ✅ |
| POST | `/api/outreach/sends` | Get send records | ✅ |
| POST | `/api/outreach/test-send` | Test email sending (DRY_RUN) | ✅ |
| POST | `/api/outreach/audience/build` | Build campaign audience | ✅ |
| POST | `/api/outreach/sequence/start` | Start email sequence | ✅ |
| POST | `/api/outreach/sequence/pause` | Pause email sequence | ✅ |
| POST | `/api/outreach/sequence/complete` | Complete email sequence | ✅ |
| POST | `/api/outreach/sequence/tick` | Process due sends | ✅ |
| POST | `/api/outreach/ai/suggest` | AI template generation | ✅ |
| POST | `/api/outreach/ai/save-template` | Save AI template to sheet | ✅ |
| POST | `/api/outreach/ai/summarize-replies` | AI reply analysis | ✅ |
| POST | `/api/outreach/ai/draft-campaign` | AI campaign drafting | ✅ |
| POST | `/webhooks/email/:provider` | Email event webhooks | ✅ |

---

### 9. **Marketing** (49 endpoints)

#### SEO (9 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/marketing/seo/pages` | Get SEO pages | ✅ |
| GET | `/api/marketing/seo/keywords` | Get SEO keywords | ✅ |
| POST | `/api/marketing/seo/harvest` | AI keyword harvesting | ✅ |
| POST | `/api/marketing/seo/cluster` | AI keyword clustering | ✅ |
| POST | `/api/marketing/seo/prioritize` | Calculate priority scores | ✅ |
| POST | `/api/marketing/seo/brief` | Generate SEO content brief | ✅ |
| POST | `/api/marketing/seo/onpage` | On-page SEO suggestions | ✅ |
| POST | `/api/ai/seo/brief` | AI SEO brief generation | ✅ |
| POST | `/api/ai/seo/audit` | AI on-page audit | ✅ |

#### Ads (8 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/marketing/ads/campaigns` | Get ad campaigns | ✅ |
| POST | `/api/marketing/ads/campaigns` | Create ad campaign | ✅ |
| POST | `/api/marketing/ads/campaigns/:campaignId/adgroups` | Manage ad groups | ✅ |
| POST | `/api/marketing/ads/adgroups/:adGroupId/creatives` | Manage creatives | ✅ |
| GET | `/api/marketing/ads/export` | Export Google Ads CSV | ✅ |
| POST | `/api/marketing/ads/import` | Import ad metrics CSV | ✅ |
| POST | `/api/ai/ads/expand-keywords` | AI keyword expansion | ✅ |
| POST | `/api/ai/ads/generate-copy` | AI ad copy generation | ✅ |
| POST | `/webhooks/ads/:provider` | Ad metrics webhooks | ✅ |

#### Social (10 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/marketing/social/preview/:postId` | Preview social post | ✅ |
| GET | `/api/marketing/social/calendar` | Get posts by date range | ✅ |
| GET | `/api/marketing/social/assets` | Get social media assets | ✅ |
| POST | `/api/marketing/social/plan` | Plan content calendar | ✅ |
| POST | `/api/marketing/social/ai` | AI post suggestions | ✅ |
| POST | `/api/marketing/social/attach` | Attach assets to post | ✅ |
| POST | `/api/marketing/social/import` | Import social metrics CSV | ✅ |
| POST | `/api/ai/social/generate-plan` | AI social calendar | ✅ |
| POST | `/api/ai/social/rewrite-caption` | AI caption rewrite | ✅ |
| POST | `/api/ai/social-plan` | AI social plan (legacy) | ✅ |
| POST | `/webhooks/social/:provider` | Social metrics webhooks | ✅ |

#### UTM (2 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/marketing/utm/links` | Get UTM links | ✅ |
| POST | `/api/marketing/utm/build` | Build UTM-tagged URL | ✅ |
| POST | `/api/marketing/utm/shortify` | Shorten URL | ✅ |

#### KPIs (4 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/marketing/kpis/daily` | Get daily KPIs | ✅ |
| GET | `/api/marketing/kpis/weekly` | Get weekly KPIs | ✅ |
| GET | `/api/marketing/kpis/monthly` | Get monthly KPIs | ✅ |
| POST | `/api/marketing/kpis/update-revenue` | Update revenue data | ✅ |

---

### 10. **AI Hub** (14 endpoints - PARTIAL)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| POST | `/api/ai/explain-price` | Price explanation | ✅ |
| POST | `/api/ai/stand-refill-suggest` | Refill plan suggestion | ✅ |
| POST | `/api/ai/social-plan` | Social content planning | ✅ |
| POST | `/api/ai/playbooks/run` | Run playbook (manual) | ✅ |
| POST | `/api/ai/command` | Command palette | ✅ |
| GET | `/api/ai/playbooks` | Get playbooks | ⚠️ NOT FOUND |
| GET | `/api/ai/tasks` | Get AI tasks | ⚠️ SCAFFOLD |
| GET | `/api/ai/agents/log` | Get agents log | ✅ |
| POST | `/api/ai/seo/brief` | SEO brief generation | ✅ |
| POST | `/api/ai/seo/audit` | SEO audit | ✅ |
| POST | `/api/ai/ads/expand-keywords` | Keyword expansion | ✅ |
| POST | `/api/ai/ads/generate-copy` | Ad copy generation | ✅ |
| POST | `/api/ai/social/generate-plan` | Social calendar | ✅ |
| POST | `/api/ai/social/rewrite-caption` | Caption rewrite | ✅ |

---

### 11. **AI Crew** (3 endpoints - ❌ MISSING)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/ai/agents` | List agents + stats | ❌ MISSING |
| POST | `/api/ai/chat/:agentId` | Chat with agent | ❌ MISSING |
| POST | `/api/ai/run-playbook/:playbookId` | Execute playbook | ❌ MISSING |

**Gap Analysis**:
- These 3 endpoints are required for AI Crew upgrade
- Need orchestrator service implementation
- Need AI_Crew sheet with agent configurations

---

### 12. **Bundles & Subscriptions** (12 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/subscriptions` | Get salon subscriptions | ✅ |
| POST | `/api/subscriptions` | Create subscription | ✅ |
| PATCH | `/api/subscriptions/:subscriptionId` | Update subscription | ✅ |
| GET | `/api/bundles` | Get bundles | ✅ |
| POST | `/api/bundles` | Create bundle | ✅ |
| PATCH | `/api/bundles/:bundleId` | Update bundle | ✅ |
| GET | `/api/gifts` | Get gifts | ✅ |
| POST | `/api/gifts` | Create gift | ✅ |
| PATCH | `/api/gifts/:giftId` | Update gift | ✅ |
| GET | `/api/affiliates` | Get affiliate programs | ✅ |
| POST | `/api/affiliates` | Create affiliate program | ✅ |
| PATCH | `/api/affiliates/:programId` | Update affiliate program | ✅ |
| GET | `/api/commissions` | Get commission rules | ✅ |
| POST | `/api/commissions` | Create commission rule | ✅ |
| PATCH | `/api/commissions/:ruleId` | Update commission rule | ✅ |

---

### 13. **Integrations** (3 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/integrations` | Get integrations list | ✅ |
| GET | `/api/integrations/sync-queue` | Get sync queue | ✅ |
| POST | `/api/integrations/test` | Test integration | ✅ |

---

### 14. **Logs & Operations** (3 endpoints)

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| GET | `/api/logs` | Get operation logs | ✅ |
| GET | `/api/bootstrap` | Bootstrap data load | ✅ |
| GET | `/cron/daily` | Daily cron (legacy) | ✅ |
| GET | `/cron/weekly` | Weekly cron (legacy) | ✅ |
| GET | `/cron/monthly` | Monthly cron (legacy) | ✅ |

---

## 🎯 Gap Analysis: AI Crew Requirements

### Required Endpoints (from AI Crew specification):

| Endpoint | Status | Priority | Notes |
|----------|--------|----------|-------|
| GET /api/ai/agents | ❌ MISSING | HIGH | List all agents from AI_Crew sheet with stats |
| POST /api/ai/chat/:agentId | ❌ MISSING | HIGH | Chat with specific agent using its prompt |
| POST /api/ai/run-playbook/:playbookId | ❌ MISSING | HIGH | Enqueue playbook as AI_Tasks job |
| GET /api/ai/tasks | ⚠️ SCAFFOLD | MEDIUM | Exists but needs orchestrator integration |
| GET /api/ai/playbooks | ⚠️ NOT FOUND | LOW | May exist as internal function |

### Implementation Requirements:

**GET /api/ai/agents**:
```typescript
// Expected response
{
  success: true,
  agents: [
    {
      agentId: "A-PRC-100",
      name: "Pricing Analyst",
      role: "Pricing",
      model: "gpt-4o-mini",
      permissionsRead: ["Settings", "Pricing_Params", "FinalPriceList"],
      permissionsWrite: ["Pricing_Suggestions"],
      activeFlag: true,
      lastRun: "2025-11-10T10:00:00Z",
      totalRuns: 42,
      successRate: 98.5
    },
    // ... more agents
  ]
}
```

**POST /api/ai/chat/:agentId**:
```typescript
// Expected request
{
  message: "Explain the pricing for SKU HM-BB-50",
  context: {
    sku: "HM-BB-50",
    includeCompetitors: true
  }
}

// Expected response
{
  success: true,
  agentId: "A-PRC-100",
  response: "The price for HM-BB-50 is calculated as follows...",
  citations: ["FinalPriceList:A2", "Pricing_Params:B10"],
  timestamp: "2025-11-10T10:00:00Z"
}
```

**POST /api/ai/run-playbook/:playbookId**:
```typescript
// Expected request
{
  parameters: {
    maxProducts: 50,
    minMargin: 12
  }
}

// Expected response
{
  success: true,
  taskId: "TSK-2025-11-10-001",
  playbookId: "PB-PRC-001",
  status: "queued",
  estimatedDuration: "5-10 minutes"
}
```

---

## 📊 Endpoint Statistics

### By HTTP Method:
- **GET**: 87 endpoints (43%)
- **POST**: 98 endpoints (48%)
- **PATCH**: 15 endpoints (7%)
- **DELETE**: 0 endpoints (0%)

### By Implementation Status:
- **✅ Fully Implemented**: 200 (98.5%)
- **⚠️ Partial/Scaffold**: 3 (1.5%)
- **❌ Missing**: 3 (1.5%)

### By Domain:
- **Marketing**: 49 endpoints (24%)
- **Admin**: 23 endpoints (11%)
- **Outreach**: 14 endpoints (7%)
- **Shipping**: 14 endpoints (7%)
- **AI Hub**: 14 endpoints (7%)
- **Bundles/Subscriptions**: 12 endpoints (6%)
- **Pricing**: 11 endpoints (5%)
- **Partners**: 8 endpoints (4%)
- **Growth**: 8 endpoints (4%)
- **Sales**: 7 endpoints (3%)
- **Stands**: 6 endpoints (3%)
- **AI Crew**: 3 endpoints (1%) - ❌ MISSING
- **Integrations**: 3 endpoints (1%)
- **Logs**: 3 endpoints (1%)

---

## 🚀 Recommended Actions

### Immediate (This Week):
1. **Implement 3 missing AI Crew endpoints**
2. **Add validation/auth middleware to all endpoints**
3. **Add rate limiting to prevent abuse**
4. **Document all endpoints in OpenAPI/Swagger**

### Short-term (Next 2 weeks):
5. **Add DELETE endpoints for cleanup operations**
6. **Implement PATCH for partial updates (currently full updates)**
7. **Add bulk operations for efficiency**
8. **Standardize error response formats**

### Long-term (Later):
9. **Add GraphQL layer for flexible queries**
10. **Implement webhook retry logic**
11. **Add API versioning (/v1/api/*)**
12. **Create SDK/client libraries**

---

**Next**: See FRONTEND_ROUTES.md for UI coverage analysis
