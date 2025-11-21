# MH Trading OS — Testing Plan

**Version**: 1.0  
**Last Updated**: November 9, 2025  
**Status**: Phase 1 Testing Framework

---

## 1. Testing Strategy

### 1.1 Test Pyramid

```
           /\
          /E2E\        ← 10% (Critical user flows)
         /------\
        /  API  \      ← 30% (Endpoint validation)
       /----------\
      /   Unit    \    ← 60% (Business logic)
     /--------------\
```

**Current Coverage**:
- ✅ Unit Tests: 0% (not yet implemented)
- ✅ API Tests: Manual testing via Replit console
- ✅ E2E Tests: 0% (Playwright framework ready to add)
- ✅ Integration Tests: Google Sheets connectivity verified

**Target Coverage** (Phase 2+):
- Unit: 70%+ for critical business logic
- API: 90%+ for all endpoints
- E2E: 100% for critical user journeys

---

## 2. Critical User Flows (E2E Testing Priority)

### 2.1 Pricing Flow
**Test**: COGS → UVP → MAP → NET calculation
```
Given: Product with COGS €10
When: User sets Factory_Cost_EUR = 10, AutoPriceFlag = true
Then: System calculates UVP, MAP, Net prices per tier
And: Respects MAP guardrails (no price below MAP)
And: Writes to FinalPriceList worksheet
```

**Playwright Test Steps**:
1. Navigate to `/pricing`
2. Click "Add Product" button
3. Fill SKU, Name, Category, COGS
4. Enable AutoPriceFlag
5. Save product
6. Verify UVP/MAP/NET displayed correctly
7. Check Google Sheet updated

---

### 2.2 Quote → Order → Invoice Flow
**Test**: End-to-end sales workflow
```
Given: Partner "HMP-0012" with Tier "Plus"
When: User creates quote with 3 line items
Then: System calculates tier pricing, loyalty points
When: User converts quote to order
Then: System generates invoice PDF with QR code
And: Records commission + loyalty transactions
```

**Playwright Test Steps**:
1. Navigate to `/sales`
2. Select partner from dropdown
3. Add 3 products to quote
4. Apply loyalty redemption (if balance > 0)
5. Save quote
6. Click "Convert to Order"
7. Download invoice PDF
8. Verify PDF contains QR code, correct calculations
9. Check Commission_Ledger + Loyalty_Ledger updated

---

### 2.3 Stand Creation → Refill Flow
**Test**: Stand distribution workflow
```
Given: Partner exists
When: User creates new stand with GPS coordinates
Then: System generates QR code
When: User sets min/max inventory levels
Then: System creates refill plan
When: Inventory falls below min
Then: System suggests refill quantities
```

**Playwright Test Steps**:
1. Navigate to `/stands`
2. Click "Create Stand"
3. Fill location details, GPS coords
4. Save stand
5. Verify QR code generated
6. Navigate to inventory tab
7. Set min/max for 5 products
8. Simulate low stock (manually reduce Qty in Sheet)
9. Refresh page
10. Verify refill suggestion appears

---

### 2.4 Shipping Method → Rule → Estimate Flow
**Test**: Shipping calculation
```
Given: Shipping method "DHL Express" configured
And: Rule "Free shipping > €100 for Plus tier"
When: User requests shipping estimate for €120 order, Tier Plus
Then: System returns €0 shipping cost
When: User requests estimate for €80 order, Tier Plus
Then: System returns standard DHL rate
```

**Playwright Test Steps**:
1. Navigate to `/shipping`
2. Create shipping method "DHL Express"
3. Create rule "Free > €100 for Plus"
4. Navigate to `/operations`
5. Enter order details: €120, Partner Tier Plus, 2kg
6. Click "Estimate Shipping"
7. Verify €0 returned
8. Change order to €80
9. Verify DHL rate returned

---

### 2.5 AI Assistant Interaction
**Test**: Pricing Analyst AI
```
Given: OpenAI API key configured
When: User asks "Why is SKU-001 priced at €29.99?"
Then: AI explains COGS breakdown, margin, MAP
And: Response returned in < 10 seconds
```

**Playwright Test Steps**:
1. Navigate to `/ai`
2. Select "Pricing Analyst" tab
3. Type question in textarea
4. Click Send
5. Wait for response (max 10 sec)
6. Verify response contains pricing breakdown
7. Check AI_Tasks worksheet logged request

---

### 2.6 Bootstrap Idempotency
**Test**: Safe re-run of bootstrap
```
Given: Google Sheet with existing data
When: User clicks "Run Full Bootstrap" in Admin
Then: System creates missing worksheets only
And: Does not overwrite existing data
And: Returns status "healthy" or "warnings"
```

**Playwright Test Steps**:
1. Navigate to `/admin`
2. Click "Run Full Bootstrap"
3. Wait for success toast (10-15 sec)
4. Verify 4 shipping worksheets created
5. Check existing data (Settings, Products) intact
6. Re-run bootstrap
7. Verify no errors, no duplicates

---

### 2.7 Growth/CRM Lead Workflow (E2E)
**Test**: Harvest → Normalize → Score → Assign → Enrich → Export
```
Given: API_PLACES_KEY configured (or dry-run mode)
When: User harvests leads from Berlin for "barber" keyword
Then: System creates new leads in CRM_Leads
When: User normalizes phone/email data
Then: System formats phones to E.164, extracts domains
When: User scores all leads
Then: System assigns Score (0-30) and TierHint (High/Med/Low)
When: User assigns territories
Then: System matches leads to territories and rules
When: User queues eligible leads for enrichment
Then: System creates Enrichment_Queue jobs
When: User runs enrichment (dry-run if no OpenAI key)
Then: System enriches CategoryNorm, SizeHint, WorkingHours
When: User exports leads by owner
Then: System generates CSV with filtered leads
```

**Playwright Test Steps**:
1. Navigate to `/growth`
2. **Harvest Panel**:
   - Enter "Berlin" in City input
   - Enter "barber products" in Keywords input
   - Click "+" to add keyword
   - Click "Search" button
   - Wait for toast notification (success or dry-run)
   - Verify toast shows "Harvested: N, Deduped: M" or dry-run message
3. **Normalize Panel**:
   - Click "Run Now" button
   - Wait for toast notification
   - Verify toast shows "Normalized: N"
4. **Score & Assign Panel**:
   - Click "Re-score All" button
   - Wait for toast notification
   - Verify toast shows "Scored: N"
   - Click "Assign Territories" button
   - Wait for toast notification
   - Verify toast shows "Assigned: N"
5. **AI Enrichment Panel**:
   - Click "Queue Eligible" button
   - Wait for toast notification
   - Verify toast shows "Queued: N"
   - Click "Run 20 Jobs" button
   - Wait for toast notification
   - Verify toast shows "Processed: N, Failed: M" or dry-run message
6. **Export Panel**:
   - Select owner from dropdown (e.g., "Dealer Plus")
   - Click "Download CSV" button
   - Verify CSV file opens in new tab
7. **Verify Table**:
   - Check leads table shows updated data
   - Verify Score column populated
   - Verify Owner column populated (for assigned leads)
   - Apply City filter: enter "Berlin"
   - Verify table filters correctly
8. **Check Google Sheets**:
   - Open CRM_Leads sheet
   - Verify new leads created with Berlin city
   - Verify Score values (0-30)
   - Verify Owner assignments
   - Check Lead_Touches sheet for logged actions
   - Check Enrichment_Queue sheet for queued jobs
   - Check OS_Health sheet for "2A Readiness" component status

**API Testing (Postman Collection)**:
```http
# 1. Harvest (dry-run if no API key)
POST http://localhost:5000/api/growth/places/search
Content-Type: application/json
{
  "city": "Berlin",
  "keywords": ["barber products", "hair salon"]
}
Expected: 200 OK, { harvested: N, deduped: M }

# 2. Normalize
GET http://localhost:5000/api/growth/places/normalize?limit=100
Expected: 200 OK, { normalized: N, skipped: M }

# 3. Score
POST http://localhost:5000/api/growth/score
Expected: 200 OK, { scored: N, skipped: M }

# 4. Assign
GET http://localhost:5000/api/growth/assign
Expected: 200 OK, { assigned: N, rulesApplied: M, territoriesUsed: K }

# 5. Enrich Queue
POST http://localhost:5000/api/growth/enrich/queue
Expected: 200 OK, { queued: N, skipped: M }

# 6. Enrich Run (dry-run if no OpenAI key)
POST http://localhost:5000/api/growth/enrich/run?limit=20
Expected: 200 OK, { processed: N, failed: M }

# 7. Export
GET http://localhost:5000/api/growth/export?owner=Dealer%20Plus&format=csv
Expected: 200 OK, CSV file with LeadID,Name,City,Email,Phone,Score,etc.

# 8. Get All Leads
GET http://localhost:5000/api/growth/leads
Expected: 200 OK, array of CRM leads with all fields
```

---

### 2.8 Outreach Sequence E2E (Phase 2B)
**Test**: Complete email campaign workflow with AI, webhooks, and suppression
```
Given: CRM_Leads sheet contains leads with Berlin Score ≥12
When: User builds audience from CRM_Leads
Then: System creates Outreach_Recipients with Status=Pending
When: User starts sequence with dry-run mode
Then: System schedules sends without actually sending emails
When: Webhook event received (unsub/bounce simulation)
Then: System updates Outreach_Suppressions and marks recipient Unsubscribed/Bounced
When: User checks Monitor panel
Then: System displays updated recipient statuses and suppression counters
```

**Playwright Test Steps**:
1. **Setup - Create Test Data**:
   - Ensure CRM_Leads sheet has at least 5 leads with City="Berlin" and Score ≥12
   - Note LeadIDs for verification later

2. **Navigate to Outreach**:
   - Go to `/outreach`
   - Verify 4 tabs visible: Campaign Builder, Template Studio, Monitor, Safety

3. **Campaign Builder - Create Campaign**:
   - Click "Campaign Builder" tab
   - Fill form:
     - Name: "Berlin B2B Test Campaign"
     - Description: "E2E test for Phase 2B"
     - AudienceSource: "CRM_Leads"
     - AudienceQuery: "City=Berlin AND Score>=12"
     - TemplateID: Select first template from dropdown
     - Provider: "brevo" or "resend"
   - Click "Save Campaign" button (data-testid="button-save-campaign")
   - Wait for success toast
   - Verify campaign appears in table with Status="Draft"

4. **Template Studio - Create AI Template**:
   - Click "Template Studio" tab
   - Click "AI Suggest" button (data-testid="button-ai-suggest")
   - Fill AI form:
     - Locale: "en"
     - Tone: "professional"
     - ProductLine: "Beard Care"
   - Click "Generate" button
   - Wait for AI response (may show quota error - expected in test phase)
   - If successful: verify template preview shows {{unsubscribe_link}}
   - Fill manual template:
     - Subject: "Exclusive Offer for Berlin Salons"
     - Body: "Hello {{name}}, Special pricing for Berlin. {{unsubscribe_link}}"
   - Click "Save Template" button (data-testid="button-save-template")
   - Wait for success toast

5. **Audience Builder - Build Recipients**:
   - Click "Campaign Builder" tab
   - Select "Berlin B2B Test Campaign" from table
   - Click "Build Audience" button (data-testid="button-build-audience")
   - Wait for success toast showing "Built: N recipients"
   - Verify N ≥ 5 (based on test data)

6. **Sequence Start - Dry Run**:
   - Click "Monitor" tab
   - Select campaign from dropdown
   - Enable "Dry-Run Mode" toggle (data-testid="toggle-dry-run")
   - Click "Start Sequence" button (data-testid="button-start-sequence")
   - Wait for success toast
   - Verify recipients table shows Status="Scheduled" (not "Sent" due to dry-run)

7. **Simulate Webhook Event - Unsubscribe**:
   - Use browser dev tools or Postman to POST to `/api/outreach/webhooks/brevo`
   - Payload (for Brevo):
     ```json
     {
       "event": "unsubscribe",
       "email": "<first_recipient_email>",
       "date": "2025-11-10T12:00:00Z",
       "message-id": "test-message-001",
       "tag": "campaign-001"
     }
     ```
   - Note: Without BREVO_WEBHOOK_SECRET, signature verification will fail (expected)
   - Verify OS_Health logs webhook event

8. **Simulate Webhook Event - Bounce**:
   - POST to `/api/outreach/webhooks/brevo`
   - Payload:
     ```json
     {
       "event": "hard_bounce",
       "email": "<second_recipient_email>",
       "date": "2025-11-10T12:05:00Z",
       "message-id": "test-message-002",
       "reason": "Mailbox does not exist"
     }
     ```

9. **Verify Monitor Updates**:
   - Refresh Monitor tab
   - Verify recipients table shows:
     - First recipient: Status="Unsubscribed"
     - Second recipient: Status="Bounced"
   - Verify suppression counter increased by 2

10. **Check Google Sheets**:
    - Open Outreach_Suppressions sheet
    - Verify 2 new rows with suppressed emails
    - Open Outreach_Recipients sheet
    - Verify Status updated to "Unsubscribed" and "Bounced"
    - Open OS_Health sheet
    - Verify webhook events logged

11. **Safety Panel - GDPR Validation**:
    - Click "Safety" tab
    - Verify warnings displayed:
      - Rate limit warnings if batch size > 100/min
      - Missing unsubscribe link warnings (if template lacks {{unsubscribe_link}})
    - Verify dry-run mode explanation

**API Testing (Postman Collection - Phase 2B)**:
```http
### Environment Setup
# Create two environments: "Brevo" and "Resend"
# Variables:
# - API_BASE: http://localhost:5000
# - PROVIDER: brevo | resend
# - CAMPAIGN_ID: (set after campaign creation)
# - TEMPLATE_ID: (set after template creation)
# - SIGNATURE_SECRET: (Brevo: sha256 header secret, Resend: Svix secret)

### 1. Create Campaign
POST {{API_BASE}}/api/outreach/campaigns/create
Content-Type: application/json
{
  "name": "Postman Test Campaign",
  "description": "API test for Phase 2B",
  "audienceSource": "CRM_Leads",
  "audienceQuery": "City=Berlin AND Score>=12",
  "templateID": "TMPL-001",
  "provider": "{{PROVIDER}}",
  "status": "Draft"
}
# Expected: 200 OK, { campaignID: "CMP-001" }
# Post-response script: pm.environment.set("CAMPAIGN_ID", pm.response.json().campaignID);

### 2. Create Template (Manual)
POST {{API_BASE}}/api/outreach/templates/create
Content-Type: application/json
{
  "subject": "Test Subject {{name}}",
  "bodyHTML": "<p>Hello {{name}}, <a href='{{unsubscribe_link}}'>Unsubscribe</a></p>",
  "locale": "en",
  "tone": "professional",
  "productLine": "Beard Care"
}
# Expected: 200 OK, { templateID: "TMPL-002" }
# Post-response script: pm.environment.set("TEMPLATE_ID", pm.response.json().templateID);

### 3. AI Suggest Template (may fail with quota)
POST {{API_BASE}}/api/outreach/ai/suggest-template
Content-Type: application/json
{
  "locale": "en",
  "tone": "professional",
  "productLine": "Beard Care"
}
# Expected: 200 OK or 429 (quota exceeded)
# If 200: { subject, bodyHTML, suggestedSubject, suggestedBodyHTML, placeholders }
# If 429: { error: "OpenAI quota exceeded", retry_after: 3600 }

### 4. Build Audience
POST {{API_BASE}}/api/outreach/audience/build
Content-Type: application/json
{
  "campaignID": "{{CAMPAIGN_ID}}",
  "audienceSource": "CRM_Leads",
  "audienceQuery": "City=Berlin AND Score>=12"
}
# Expected: 200 OK, { built: N, skipped: M }

### 5. Start Sequence (Dry-Run)
POST {{API_BASE}}/api/outreach/sequence/start
Content-Type: application/json
{
  "campaignID": "{{CAMPAIGN_ID}}",
  "dryRun": true
}
# Expected: 200 OK, { scheduled: N, dryRun: true }

### 6. Tick Sequence (Process Next Batch)
POST {{API_BASE}}/api/outreach/sequence/tick
Content-Type: application/json
{
  "campaignID": "{{CAMPAIGN_ID}}",
  "batchSize": 10,
  "dryRun": true
}
# Expected: 200 OK, { sent: N, failed: M, dryRun: true }

### 7. Simulate Webhook - Brevo Unsubscribe
POST {{API_BASE}}/api/outreach/webhooks/brevo
Content-Type: application/json
X-Brevo-Signature: {{$randomUUID}}
{
  "event": "unsubscribe",
  "email": "test@example.com",
  "date": "{{$isoTimestamp}}",
  "message-id": "{{$randomUUID}}",
  "tag": "{{CAMPAIGN_ID}}"
}
# Expected: 200 OK (or 401 if signature verification active)
# Tests:
# - pm.test("Status 200 or 401", () => pm.expect([200, 401]).to.include(pm.response.code));
# - If 200: verify suppression created in Outreach_Suppressions

### 8. Simulate Webhook - Resend Bounce
POST {{API_BASE}}/api/outreach/webhooks/resend
Content-Type: application/json
svix-id: {{$randomUUID}}
svix-timestamp: {{$timestamp}}
svix-signature: v1,invalid-signature-for-test
{
  "type": "email.bounced",
  "data": {
    "email_id": "{{$randomUUID}}",
    "to": ["test2@example.com"],
    "created_at": "{{$isoTimestamp}}"
  }
}
# Expected: 200 OK (or 401 if signature verification active)

### 9. GDPR Compliance - Template Validation
POST {{API_BASE}}/api/outreach/templates/create
Content-Type: application/json
{
  "subject": "Missing Unsubscribe Link",
  "bodyHTML": "<p>No unsubscribe link here</p>",
  "locale": "en",
  "tone": "professional"
}
# Expected: 400 BAD REQUEST
# Error: "Template must include {{unsubscribe_link}} placeholder for GDPR compliance"

### 10. AI Quota Handling - Retry Test
POST {{API_BASE}}/api/outreach/ai/suggest-template
Content-Type: application/json
{
  "locale": "en",
  "tone": "friendly",
  "productLine": "Hair Care"
}
# Expected (if quota exceeded):
# - Status: 429 TOO MANY REQUESTS
# - Body: { error: "OpenAI quota exceeded", retry_after: 3600 }
# - OS_Health entry: Status=WARN, Detail="AI quota exhausted"
# Tests:
# - pm.test("Quota error handled gracefully", () => {
#     if (pm.response.code === 429) {
#       pm.expect(pm.response.json()).to.have.property("retry_after");
#     }
#   });

### 11. Webhook Signature Failure
POST {{API_BASE}}/api/outreach/webhooks/brevo
Content-Type: application/json
X-Brevo-Signature: invalid-signature-123
{
  "event": "spam",
  "email": "test3@example.com"
}
# Expected (if BREVO_WEBHOOK_SECRET configured):
# - Status: 401 UNAUTHORIZED
# - Body: { error: "Invalid webhook signature" }
# - OS_Health entry: Status=FAIL, Detail="Signature verification failed"
# Tests:
# - pm.test("Signature validation works", () => pm.expect(pm.response.code).to.equal(401));

### 12. Rate Limiting Test
# Pre-request script:
# for (let i = 0; i < 150; i++) {
#   pm.sendRequest({
#     url: pm.environment.get("API_BASE") + "/api/outreach/sequence/tick",
#     method: "POST",
#     body: { campaignID: pm.environment.get("CAMPAIGN_ID"), batchSize: 1 }
#   });
# }
# Expected: Some requests return 429 TOO MANY REQUESTS after exceeding rate limit
```

**GDPR Compliance Tests**:
1. **Unsubscribe Link Required**:
   - Attempt to create template without `{{unsubscribe_link}}`
   - Expected: 400 error or warning
   - Verify AI-generated templates always include unsubscribe link

2. **Suppression List Enforcement**:
   - Add email to Outreach_Suppressions manually
   - Build audience including that email
   - Start sequence
   - Verify suppressed email is NOT sent (skipped in Sends sheet)

3. **Personal Data Redaction in Logs**:
   - Trigger AI suggestion with test data
   - Check AI_Outbox and OS_Health logs
   - Verify email addresses/names are redacted (e.g., "t***@example.com")

**AI Quota Handling Tests**:
1. **Graceful Degradation**:
   - Simulate OpenAI 429 response
   - Verify system returns WARN status (not FAIL)
   - Verify user sees helpful error message with retry_after

2. **Fallback Template Cache**:
   - If quota exceeded during suggestTemplate
   - System should offer pre-cached templates from Outreach_Templates sheet
   - Verify fallback mechanism works

3. **Exponential Backoff Retry**:
   - Mock OpenAI API to return 429 on first call, 200 on second
   - Verify system retries with exponential backoff
   - Verify success after retry

---

## 3. API Endpoint Tests (Postman/REST Client)

### 3.1 Pricing Endpoints

**Test: GET /api/products**
```http
GET http://localhost:5000/api/products?q=beard&limit=10
```
Expected: 200 OK, array of products with SKU/Name matching "beard"

**Test: POST /api/pricing/bulk-reprice**
```http
POST http://localhost:5000/api/pricing/bulk-reprice
Content-Type: application/json

{
  "skus": ["SKU-001", "SKU-002"]
}
```
Expected: 200 OK, `{ processed: 2 }`

**Test: POST /api/pricing/calculate**
```http
POST http://localhost:5000/api/pricing/calculate
Content-Type: application/json

{
  "sku": "SKU-001",
  "cogs": 10,
  "targetMarginWeb": 45,
  "targetMarginSalon": 40
}
```
Expected: 200 OK, returns UVP/MAP/NET prices

---

### 3.2 Sales Endpoints

**Test: POST /api/sales/quotes**
```http
POST http://localhost:5000/api/sales/quotes
Content-Type: application/json

{
  "partnerID": "HMP-0012",
  "lines": [
    { "sku": "SKU-001", "qty": 2, "unitPrice": 15, "lineTotal": 30 }
  ],
  "subtotalGross": 30,
  "loyaltyRedeemed": 0,
  "total": 35.70
}
```
Expected: 200 OK, returns `{ quoteId, createdTS, total }`

**Test: POST /api/sales/quotes/:id/convert**
```http
POST http://localhost:5000/api/sales/quotes/QUO-ABC123/convert
```
Expected: 200 OK, returns `{ orderId, invoicePdfUrl }`

---

### 3.3 Shipping Endpoints

**Test: POST /api/shipping/calculate**
```http
POST http://localhost:5000/api/shipping/calculate
Content-Type: application/json

{
  "partnerTier": "Plus",
  "partnerType": "Salon",
  "orderTotalEUR": 120,
  "weightG": 2000,
  "zone": "DE"
}
```
Expected: 200 OK, returns `{ shippingCostEUR, methodId, freeShipping }`

---

### 3.4 AI Endpoints

**Test: POST /api/ai/explain-price**
```http
POST http://localhost:5000/api/ai/explain-price
Content-Type: application/json

{
  "sku": "SKU-001"
}
```
Expected: 200 OK, returns `{ explanation: "..." }` with AI response

---

### 3.5 Admin Endpoints

**Test: POST /api/admin/bootstrap/run**
```http
POST http://localhost:5000/api/admin/bootstrap/run
```
Expected: 200 OK, returns `{ overall: "healthy", sheets: [...], settings: [...] }`

**Test: GET /api/admin/health**
```http
GET http://localhost:5000/api/admin/health
```
Expected: 200 OK, returns `{ sheets: {status: "connected"}, openai: {...}, email: {...}, pricing: {...} }`

---

## 4. Unit Tests (Business Logic)

### 4.1 Pricing Calculations

**File**: `server/lib/pricing.test.ts`

```typescript
describe('Pricing Engine', () => {
  test('calculates UVP from COGS correctly', () => {
    const cogs = 10;
    const targetMargin = 45;
    const uvp = calculateUVP(cogs, targetMargin);
    expect(uvp).toBeCloseTo(18.18, 2);
  });

  test('respects MAP guardrails', () => {
    const uvp = 20;
    const map = 15;
    const proposedPrice = 12;
    const valid = isPriceAboveMAP(proposedPrice, map);
    expect(valid).toBe(false);
  });

  test('calculates tier net prices', () => {
    const map = 15;
    const tiers = { Basic: 10, Plus: 15, Stand: 20, Distributor: 25 };
    const nets = calculateTierPrices(map, tiers);
    expect(nets.Basic).toBeCloseTo(13.50, 2);
    expect(nets.Distributor).toBeCloseTo(11.25, 2);
  });
});
```

---

### 4.2 Safe Numeric Parsing

**File**: `server/lib/utils.test.ts`

```typescript
describe('Safe Parsing', () => {
  test('parseFloatSafe returns number for valid input', () => {
    expect(parseFloatSafe('10.5')).toBe(10.5);
    expect(parseFloatSafe(10.5)).toBe(10.5);
  });

  test('parseFloatSafe returns undefined for invalid input', () => {
    expect(parseFloatSafe('abc')).toBeUndefined();
    expect(parseFloatSafe('')).toBeUndefined();
    expect(parseFloatSafe(null)).toBeUndefined();
  });

  test('parseIntSafe returns integer', () => {
    expect(parseIntSafe('10')).toBe(10);
    expect(parseIntSafe('10.9')).toBe(10);
  });
});
```

---

### 4.3 Commission Calculations

**File**: `server/lib/sales.test.ts`

```typescript
describe('Commission Calculations', () => {
  test('calculates commission for Tier Plus at 15%', () => {
    const orderTotal = 100;
    const rate = 15;
    const commission = calculateCommission(orderTotal, rate);
    expect(commission).toBe(15);
  });

  test('calculates loyalty points (1 point per €10)', () => {
    const orderTotal = 85;
    const points = calculateLoyaltyPoints(orderTotal);
    expect(points).toBe(8);
  });
});
```

---

## 5. Integration Tests

### 5.1 Google Sheets Operations

**Test**: Verify read/write to Google Sheets
```typescript
describe('Google Sheets Integration', () => {
  test('reads Settings worksheet', async () => {
    const settings = await sheetsService.getSettings();
    expect(settings).toBeDefined();
    expect(Array.isArray(settings)).toBe(true);
  });

  test('writes to OS_Logs', async () => {
    await sheetsService.logToSheet('INFO', 'Test', 'Integration test log');
    const logs = await sheetsService.readSheet('OS_Logs');
    const lastLog = logs[logs.length - 1];
    expect(lastLog.Message).toBe('Integration test log');
  });

  test('bootstrap is idempotent', async () => {
    const result1 = await bootstrapService.runFullBootstrap();
    const result2 = await bootstrapService.runFullBootstrap();
    expect(result1.overall).not.toBe('errors');
    expect(result2.overall).not.toBe('errors');
  });
});
```

---

### 5.2 OpenAI Integration

**Test**: Verify AI responses
```typescript
describe('OpenAI Integration', () => {
  test('generates AI response', async () => {
    const prompt = 'Explain MAP in one sentence';
    const response = await generateAIResponse(prompt);
    expect(response).toBeDefined();
    expect(response.length).toBeGreaterThan(10);
  });

  test('respects rate limits', async () => {
    const promises = Array(10).fill(0).map(() => 
      generateAIResponse('Test')
    );
    const results = await Promise.all(promises);
    expect(results.every(r => r)).toBe(true);
  });
});
```

---

## 6. Test Data Fixtures

### 6.1 Sample Product
```json
{
  "SKU": "TEST-001",
  "Name": "Test Beard Oil",
  "Category": "Beard Care",
  "Brand": "TestBrand",
  "Barcode": "1234567890",
  "Status": "Active",
  "Factory_Cost_EUR": 5.0,
  "Packaging_Cost_EUR": 0.5,
  "Freight_kg_EUR": 0.3,
  "Import_Duty_Pct": 3.5,
  "Overhead_Pct": 8.0,
  "COGS_EUR": 6.5,
  "Weight_g": 50,
  "Dims_cm": "5x5x12",
  "VAT%": 19,
  "AutoPriceFlag": true
}
```

### 6.2 Sample Partner
```json
{
  "PartnerID": "TEST-P001",
  "PartnerName": "Test Salon Berlin",
  "Tier": "Plus",
  "PartnerType": "Salon",
  "Email": "test@example.com",
  "Phone": "+49301234567",
  "Owner": "John Doe",
  "Status": "Active",
  "City": "Berlin",
  "CountryCode": "DE"
}
```

### 6.3 Sample Quote
```json
{
  "QuoteID": "TEST-Q001",
  "PartnerID": "TEST-P001",
  "TierLevel": "Plus",
  "SubtotalGross": 100,
  "DiscountPct": 0,
  "DiscountAmt": 0,
  "LoyaltyRedeemed": 0,
  "VAT_Pct": 19,
  "VATAmt": 19,
  "Total": 119,
  "Status": "Draft"
}
```

---

## 7. Test Execution Plan

### 7.1 Pre-Deployment Checklist

**Before Each Release**:
- [ ] Run all unit tests (target: 100% pass)
- [ ] Run API endpoint tests via Postman (target: 100% pass)
- [ ] Run E2E tests for critical flows (target: 100% pass)
- [ ] Manual QA for UI/UX (all pages render correctly)
- [ ] Check Google Sheets connectivity
- [ ] Verify all secrets configured
- [ ] Test bootstrap idempotency
- [ ] Validate dark mode + RTL layouts
- [ ] Test on mobile/tablet/desktop viewports

### 7.2 Smoke Tests (Post-Deployment)

**After Each Deploy**:
1. Health check: `GET /api/admin/health` → All green
2. Bootstrap: `POST /api/admin/bootstrap/run` → No errors
3. Create test product → Success
4. Create test quote → Success
5. AI assistant responds → Success
6. Shipping estimate → Success

### 7.3 Regression Tests

**Weekly Automated Run**:
- All unit tests
- All API tests
- Critical E2E flows (pricing, sales, shipping)
- Performance benchmarks (API response < 500ms)

---

## 8. Tools & Frameworks

**Current Stack**:
- ✅ **Jest** - Unit testing (`@jest/globals`, `ts-jest`)
- ⚠️ **Playwright** - E2E testing (dependencies installed, tests not written yet)
- ⚠️ **Postman** - API testing (collection needed)

**Recommended Additions**:
- **Supertest** - HTTP assertion library for API tests
- **Faker** - Generate realistic test data
- **Nock** - Mock external HTTP requests (Places API, Woo, Odoo)

---

## 9. Performance Benchmarks

**Target Metrics**:
| Endpoint | Max Response Time | Success Rate |
|----------|------------------|--------------|
| `GET /api/products` | 200ms | 99.9% |
| `POST /api/pricing/calculate` | 500ms | 99.5% |
| `POST /api/sales/quotes` | 1000ms | 99.5% |
| `POST /api/ai/explain-price` | 10s | 95% |
| `POST /api/admin/bootstrap/run` | 15s | 99% |

**Load Testing**:
- Simulate 100 concurrent users
- Target: No errors, response times < 2x normal

---

## 10. Next Steps

**Phase 1** (Current):
- [x] Framework ready (Jest, Playwright installed)
- [ ] Write first E2E test (pricing flow)
- [ ] Write first API test (bootstrap)
- [ ] Create Postman collection

**Phase 2**:
- [ ] Achieve 30% unit test coverage
- [ ] Complete E2E tests for all critical flows
- [ ] Set up CI/CD pipeline for automated testing
- [ ] Add performance monitoring

**Phase 3**:
- [ ] Achieve 70% unit test coverage
- [ ] Add load testing
- [ ] Security testing (OWASP Top 10)
- [ ] Accessibility testing (WCAG 2.1)

---

**Document Owner**: Development Team  
**Review Frequency**: Monthly  
**Last Reviewed**: November 9, 2025
