# MH Trading OS — Outreach Email Delivery System Documentation

**Version:** 2.0 (Phase 2A - Production Email Delivery Worker)  
**Date:** November 10, 2025  
**Status:** Production Ready ✅

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Email Provider Abstraction](#email-provider-abstraction)
4. [Worker Implementation](#worker-implementation)
5. [Environment Variables](#environment-variables)
6. [Webhook Integration](#webhook-integration)
7. [Monitoring & Health](#monitoring--health)
8. [Admin Operations Guide](#admin-operations-guide)
9. [Deliverability Best Practices](#deliverability-best-practices)
10. [Troubleshooting](#troubleshooting)
11. [Security & GDPR](#security--gdpr)

---

## Executive Summary

The MH Trading OS Outreach Email Delivery System is a **production-grade, multi-provider email delivery worker** designed for B2B outreach campaigns. It features:

- ✅ **Multi-Provider Support:** Brevo, Resend, SMTP/Nodemailer with hot-swappable configuration
- ✅ **Rate Limiting:** 60 emails/minute global, 20 emails/hour per-recipient
- ✅ **Idempotency:** SHA-256 message key prevents duplicate sends across restarts
- ✅ **Concurrency Control:** p-limit for parallel sending (default: 3 concurrent)
- ✅ **Exponential Backoff:** Automatic retries with 250ms → 4s backoff (max 5 attempts)
- ✅ **Campaign Approval Gating:** Only sends messages from `ACTIVE`/`APPROVED` campaigns
- ✅ **GDPR Compliance:** Automatic unsubscribe checking before send
- ✅ **Personalization:** Token replacement (`{{first_name}}`, `{{company}}`, etc.)
- ✅ **Health Monitoring:** OS_Health integration with real-time worker metrics
- ✅ **Graceful Shutdown:** SIGTERM handler for zero-downtime deployments

**Key Metrics:**
- **Codebase:** 700+ lines worker + 200+ lines provider adapters
- **Performance:** 60 emails/minute sustained throughput
- **Reliability:** Auto-retry with exponential backoff, fail-closed on errors
- **Observability:** Real-time metrics API, OS_Health/OS_Logs integration

---

## Architecture Overview

### System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                    MH Trading OS Backend                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Outreach Email Delivery Worker              │ │
│  │                                                           │ │
│  │  ┌─────────────────────────────────────────────────┐    │ │
│  │  │         Continuous Polling Loop (5s sleep)      │    │ │
│  │  │  1. Fetch queued messages (Email_Outbox)        │    │ │
│  │  │  2. Filter by campaign approval status          │    │ │
│  │  │  3. Check rate limits (global + per-recipient)  │    │ │
│  │  │  4. Check GDPR/unsubscribes                     │    │ │
│  │  │  5. Personalize content (merge tokens)          │    │ │
│  │  │  6. Send via provider (concurrency: 3)          │    │ │
│  │  │  7. Update Email_Outbox (status, ProviderID)    │    │ │
│  │  │  8. Aggregate stats to Email_Stats              │    │ │
│  │  │  9. Update OS_Health heartbeat                  │    │ │
│  │  └─────────────────────────────────────────────────┘    │ │
│  │                                                           │ │
│  │  ┌─────────────────────────────────────────────────┐    │ │
│  │  │         Email Provider Abstraction (IEmailProvider)  │ │
│  │  │  - BrevoAdapter (Brevo/SendInBlue API)          │    │ │
│  │  │  - ResendAdapter (Resend API)                   │    │ │
│  │  │  - SmtpAdapter (Nodemailer SMTP)                │    │ │
│  │  │  - MockAdapter (Testing, logs only)             │    │ │
│  │  │  - TestAdapter (Testing, in-memory)             │    │ │
│  │  └─────────────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │              Webhook Handlers (Express Routes)           │ │
│  │  POST /api/outreach/webhooks/:provider                   │ │
│  │  - Parse provider-specific webhook events                │ │
│  │  - Update Email_Outbox (SentTS, OpenTS, ClickTS, etc.)   │ │
│  │  - Handle unsubscribes via outreachService               │ │
│  │  GET /api/outreach/worker/metrics                        │ │
│  │  - Real-time worker metrics for UI                       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │   Google Sheets DB  │
                    │  - Email_Outbox     │
                    │  - Email_Stats      │
                    │  - Outreach_Campaigns│
                    │  - Outreach_Contacts│
                    │  - Unsubscribes     │
                    │  - OS_Health        │
                    │  - OS_Logs          │
                    └─────────────────────┘
                              ↓
                    ┌─────────────────────┐
                    │  Email Providers    │
                    │  - Brevo            │
                    │  - Resend           │
                    │  - Custom SMTP      │
                    └─────────────────────┘
```

### Worker Lifecycle

1. **Startup** (server/index.ts):
   ```typescript
   const { startWorker } = await import("./workers/outreach-worker");
   startWorker(); // Non-blocking, runs in background
   ```

2. **Polling Loop** (adaptive sleep):
   - **Busy:** 1 second sleep when queue > 0
   - **Idle:** 5 second sleep when queue = 0

3. **Shutdown** (SIGTERM):
   ```typescript
   process.on('SIGTERM', async () => {
     const { stopWorker } = await import("./workers/outreach-worker");
     await stopWorker(); // Graceful shutdown
     process.exit(0);
   });
   ```

### Message Processing Pipeline

```
Email_Outbox Row (Status='queued')
    ↓
[1] Check Idempotency (MessageKey hash)
    ↓ (if duplicate, skip)
[2] Check Rate Limits (global RPM + per-recipient hourly)
    ↓ (if throttled, retry later)
[3] Check Campaign Approval (Outreach_Campaigns.Status)
    ↓ (if DRAFT/PAUSED, set NextRetryTS +5min)
[4] Check GDPR Suppression (Unsubscribes sheet)
    ↓ (if unsubscribed, mark failed)
[5] Personalize Content ({{token}} replacement)
    ↓
[6] Send via Provider Adapter (Brevo/Resend/SMTP)
    ↓ (if network error, retry with backoff)
[7] Update Email_Outbox (Status='sent', ProviderID, SentTS)
    ↓
[8] Aggregate Stats (Email_Stats: Sent count)
    ↓
[9] Update OS_Health (worker heartbeat)
```

---

## Email Provider Abstraction

### IEmailProvider Interface

```typescript
interface IEmailProvider {
  name: string;
  
  send(message: EmailMessage): Promise<EmailSendResult>;
  parseWebhook(body: any, headers: Record<string, string>): WebhookEvent[];
  validateConfig(): Promise<boolean>;
}

interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryable?: boolean; // True for transient errors (network, rate limit)
}
```

### Supported Providers

#### 1. Brevo (SendInBlue)

**Environment Variables:**
```bash
EMAIL_PROVIDER=brevo
BREVO_API_KEY=xkeysib-xxx
```

**Features:**
- ✅ Transactional email API
- ✅ Webhook support (delivered, opened, clicked, bounced, complained)
- ✅ Rate limiting: 300/day free, unlimited on paid plans
- ✅ SMTP relay fallback available

**Webhook Setup:**
1. Go to Brevo Dashboard → Transactional → Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/api/outreach/webhooks/brevo`
3. Enable events: `delivered`, `opened`, `clicked`, `bounced`, `spam`, `unsubscribed`

---

#### 2. Resend

**Environment Variables:**
```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_xxx
```

**Features:**
- ✅ Modern email API (React Email support)
- ✅ Webhook support (delivered, opened, clicked, bounced, complained)
- ✅ Rate limiting: 100 emails/day free, 50k/month on paid
- ✅ Batch sending API

**Webhook Setup:**
1. Go to Resend Dashboard → Webhooks
2. Add webhook URL: `https://your-domain.com/api/outreach/webhooks/resend`
3. Select events: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`

---

#### 3. SMTP (Nodemailer)

**Environment Variables:**
```bash
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SECURE=false  # true for port 465, false for 587
```

**Features:**
- ✅ Universal SMTP support (Gmail, Outlook, Mailgun, etc.)
- ❌ No native webhook support (use email tracking service)
- ✅ Full control over sending infrastructure

**Recommended SMTP Providers:**
- **Gmail:** 500 emails/day limit (use App Password)
- **Mailgun:** SMTP relay with webhooks
- **SendGrid:** SMTP relay with webhooks
- **Amazon SES:** Low cost, high volume

---

### Provider Factory

```typescript
// server/lib/email-providers/index.ts
export function createEmailProvider(): IEmailProvider {
  const provider = process.env.EMAIL_PROVIDER || 'brevo';
  
  switch (provider.toLowerCase()) {
    case 'brevo':
      return new BrevoAdapter();
    case 'resend':
      return new ResendAdapter();
    case 'smtp':
      return new SmtpAdapter();
    case 'mock':
      return new MockAdapter(); // Testing
    case 'test':
      return new TestAdapter(); // Testing
    default:
      throw new Error(`Unknown email provider: ${provider}`);
  }
}
```

---

## Worker Implementation

### File Structure

```
server/
├── workers/
│   └── outreach-worker.ts       # 700+ lines worker implementation
├── lib/
│   ├── email-providers/
│   │   ├── index.ts             # Factory pattern
│   │   ├── types.ts             # IEmailProvider interface
│   │   ├── brevo.ts             # Brevo adapter
│   │   ├── resend.ts            # Resend adapter
│   │   └── smtp.ts              # SMTP adapter
│   ├── outreach-service.ts      # Outreach business logic
│   └── sheets.ts                # Google Sheets API wrapper
├── routes-outreach.ts           # Outreach API endpoints
└── index.ts                     # Worker startup
```

### Key Features

#### 1. Rate Limiting

**Global RPM (Requests Per Minute):**
```typescript
const RPM_LIMIT = parseInt(process.env.OUTREACH_RPM || '60', 10);

private rateLimits = {
  global: number[],         // Timestamps of all sends in last hour
  perRecipient: Map<string, number[]>, // Per-email timestamps
};

// Before send:
const oneMinuteAgo = Date.now() - 60000;
const recentSends = this.rateLimits.global.filter(ts => ts > oneMinuteAgo);
if (recentSends.length >= RPM_LIMIT) {
  // Set NextRetryTS, return
}
```

**Per-Recipient Hourly Limit:**
```typescript
const RECIPIENT_HOURLY_LIMIT = 20;

const oneHourAgo = Date.now() - 3600000;
const recipientSends = this.rateLimits.perRecipient.get(email) || [];
const recentRecipientSends = recipientSends.filter(ts => ts > oneHourAgo);
if (recentRecipientSends.length >= RECIPIENT_HOURLY_LIMIT) {
  // Skip, retry later
}
```

---

#### 2. Idempotency

**Message Key Generation:**
```typescript
private computeMessageKey(msg: EmailOutbox): string {
  const parts = [
    msg.CampID,
    String(msg.SeqStep),
    msg.To,
    msg.Subject,
    msg.Body,
  ];
  return crypto.createHash('sha256').update(parts.join('|')).digest('hex');
}

// Check before send:
if (msg.MessageKey && msg.ProviderID) {
  console.log(`Skipping duplicate: ${msg.MsgID}`);
  return { success: false };
}
```

**Benefits:**
- ✅ Prevents duplicate sends on worker restart
- ✅ Idempotent across campaigns (same content to same recipient)
- ✅ No external state required (deterministic hash)

---

#### 3. Concurrency Control

```typescript
const CONCURRENCY = parseInt(process.env.OUTREACH_WORKER_CONCURRENCY || '3', 10);
const limit = pLimit(CONCURRENCY);

// Process batch with concurrency limit:
const results = await Promise.all(
  messages.map(msg => limit(() => this.sendMessage(msg, contacts)))
);
```

**Why 3 concurrent?**
- ✅ Balances throughput vs. provider rate limits
- ✅ Reduces risk of concurrent duplicate sends
- ✅ Keeps memory usage predictable

---

#### 4. Exponential Backoff Retries

```typescript
const MAX_RETRIES = 5;
const BACKOFF_MS = [250, 500, 1000, 2000, 4000];

const attempts = (msg.Attempts || 0) + 1;
const shouldRetry = result.retryable && attempts < MAX_RETRIES;

if (shouldRetry) {
  const backoffMs = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
  await this.updateMessageStatus(msg.MsgID, {
    Status: 'queued',
    Attempts: attempts,
    NextRetryTS: new Date(Date.now() + backoffMs).toISOString(),
    LastError: result.error,
  });
}
```

**Retry Schedule:**
- Attempt 1: Immediate (no backoff)
- Attempt 2: +250ms
- Attempt 3: +500ms
- Attempt 4: +1000ms
- Attempt 5: +2000ms
- Attempt 6+: +4000ms (max backoff)

---

#### 5. Campaign Approval Gating

**Implementation:**
```typescript
private async isCampaignApproved(campID: string): Promise<boolean> {
  const campaigns = await sheetsService.readSheet<any>('Outreach_Campaigns', false);
  const campaign = campaigns.find((c: any) => c.CampaignID === campID);
  
  if (!campaign) return false; // Fail closed
  
  const status = campaign.Status?.toUpperCase();
  return status === 'ACTIVE' || status === 'APPROVED';
}

// If campaign not approved:
if (!await this.isCampaignApproved(msg.CampID)) {
  await this.updateMessageStatus(msg.MsgID, {
    Status: 'queued',           // ✅ Keep queued (not failed)
    NextRetryTS: new Date(Date.now() + 300000).toISOString(), // +5min
    LastError: 'Campaign not approved yet - retrying',
  });
  return { success: false };
}
```

**Behavior:**
- ✅ Messages from `DRAFT`/`PAUSED` campaigns stay queued
- ✅ Auto-send when campaign transitions to `ACTIVE`
- ✅ Fail closed: if campaign not found, don't send

---

#### 6. GDPR Compliance

```typescript
// Check Unsubscribes sheet before every send:
const unsubs = await sheetsService.readSheet<any>('Unsubscribes', false);
const isUnsubscribed = unsubs.some((u: any) => u.Email === msg.To);

if (isUnsubscribed) {
  await this.updateMessageStatus(msg.MsgID, {
    Status: 'failed',
    LastError: 'Recipient unsubscribed',
  });
  return { success: false };
}
```

**Unsubscribe Flow:**
1. User clicks unsubscribe link in email
2. POST `/api/outreach/unsubscribe` → writes to `Unsubscribes` sheet
3. Worker checks `Unsubscribes` before every send
4. Webhook events (`unsubscribed`) also trigger unsubscribe

---

#### 7. Personalization

**Supported Tokens:**
```typescript
const replacements = {
  '{{first_name}}': contact.Name?.split(' ')[0] || '',
  '{{name}}': contact.Name || '',
  '{{email}}': contact.Email || '',
  '{{city}}': contact.City || '',
  '{{phone}}': contact.Phone || '',
  '{{company}}': contact.Company || '',
};

// Example template:
Subject: Hi {{first_name}}, special offer for {{city}} businesses
Body: Hello {{name}}, we noticed you're in {{city}}...
```

**Fallback Behavior:**
- If token value missing → replace with empty string
- If contact not found → no personalization (send generic)

---

## Environment Variables

### Required Variables

```bash
# Email Provider Configuration
EMAIL_PROVIDER=brevo           # brevo | resend | smtp | mock | test

# Provider-Specific API Keys (choose one)
BREVO_API_KEY=xkeysib-xxx      # For Brevo
RESEND_API_KEY=re_xxx          # For Resend

# SMTP Configuration (if EMAIL_PROVIDER=smtp)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_SECURE=false              # true for port 465, false for 587

# Sender Configuration
OUTREACH_FROM_EMAIL=noreply@yourcompany.com
OUTREACH_REPLY_TO_EMAIL=support@yourcompany.com
```

### Optional Worker Configuration

```bash
# Worker Performance Tuning
OUTREACH_WORKER_CONCURRENCY=3  # Parallel sends (default: 3)
OUTREACH_RPM=60                # Global rate limit (default: 60/min)
OUTREACH_DRY_RUN=false         # Dry-run mode (default: false)

# Advanced Configuration
OUTREACH_BATCH_SIZE=50         # Messages per poll (default: 50)
OUTREACH_POLL_INTERVAL_MS=5000 # Idle poll interval (default: 5000ms)
```

### Dry-Run Mode

**Enable for testing:**
```bash
OUTREACH_DRY_RUN=true
```

**Behavior:**
- ✅ Fetches messages normally
- ✅ Checks all validations (rate limits, GDPR, approval)
- ✅ Logs "Would send to {email}: {subject}"
- ❌ **Does NOT** call provider API
- ✅ Updates Email_Outbox with `Status='sent'` (for testing pipeline)
- ✅ Records to OS_Logs

**Use Cases:**
- Testing campaign approval flow
- Validating personalization logic
- Verifying rate limiting
- Staging environment testing

---

## Webhook Integration

### Webhook Endpoint

```
POST /api/outreach/webhooks/:provider
```

**Supported Providers:**
- `/api/outreach/webhooks/brevo`
- `/api/outreach/webhooks/resend`

**Event Normalization:**

| Provider Event | Email_Outbox Column | Status Update |
|----------------|---------------------|---------------|
| `delivered`    | `SentTS`            | `Status='sent'` |
| `opened`       | `OpenTS`            | - |
| `clicked`      | `ClickTS`           | - |
| `bounced`      | `BounceTS`          | `Status='bounced'`, `LastError='Bounced'` |
| `complained`   | `ComplaintTS`       | `Status='complained'` |
| `unsubscribed` | -                   | Calls `outreachService.unsubscribe()` |

**Webhook Signature Verification:**
- Brevo: `X-Mailin-Signature` header (HMAC-SHA256)
- Resend: `svix-*` headers (Svix webhook signing)

**Error Handling:**
- ✅ Retries on provider mismatch (returns 400)
- ✅ Logs errors but returns 200 (to prevent provider retries)
- ✅ Processes events individually (one failure doesn't block others)

---

## Monitoring & Health

### Worker Metrics Endpoint

```
GET /api/outreach/worker/metrics
```

**Response:**
```json
{
  "lastRunTS": "2025-11-10T20:53:15.123Z",
  "messagesSent": 150,
  "messagesFailed": 5,
  "messagesSkipped": 12,
  "currentRPM": 45,
  "queueSize": 23,
  "errors": [
    {
      "ts": "2025-11-10T20:52:30.456Z",
      "error": "Network timeout",
      "msgID": "MSG-abc123"
    }
  ]
}
```

**UI Integration:**
- **Sending Tab** polls this endpoint every 5 seconds
- **Real-time updates:** Queue size, sent/failed counts, RPM gauge
- **Error stream:** Last 50 errors with timestamps

---

### OS_Health Integration

**Worker Health Record:**
```typescript
{
  Component: 'Outreach Worker',
  Status: 'PASS' | 'WARN',
  Message: 'Processed 150 messages, 5 failed, 12 skipped',
  LastCheck: '2025-11-10T20:53:15Z',
  Details: JSON.stringify({
    queueSize: 23,
    currentRPM: 45,
    rpmLimit: 60,
    dryRun: false,
  }),
}
```

**Status Logic:**
- ✅ `PASS`: Provider configured, worker running
- ⚠️ `WARN`: No provider configured (missing API key)

**Update Frequency:** Every poll cycle (5 seconds idle, 1 second busy)

---

### OS_Logs Integration

**Worker Logging:**
```typescript
// INFO logs:
await sheetsService.logToSheet('INFO', 'OutreachWorker', 'Worker started');
await sheetsService.logToSheet('INFO', 'OutreachWorker', 'Sent to user@example.com', 'MSG-123');

// ERROR logs:
await sheetsService.logToSheet('ERROR', 'OutreachWorker', 'Send failed: Network timeout', 'user@example.com');
```

**Log Retention:**
- OS_Logs sheet: Unlimited (managed by admin)
- Worker memory: Last 50 errors only

---

## Admin Operations Guide

### Initial Setup

1. **Configure Email Provider:**
   ```bash
   # Choose provider and set API key
   EMAIL_PROVIDER=brevo
   BREVO_API_KEY=xkeysib-xxx
   
   # OR
   EMAIL_PROVIDER=resend
   RESEND_API_KEY=re_xxx
   
   # OR
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

2. **Set Sender Configuration:**
   ```bash
   OUTREACH_FROM_EMAIL=noreply@yourcompany.com
   OUTREACH_REPLY_TO_EMAIL=support@yourcompany.com
   ```

3. **Configure Webhooks (Brevo/Resend only):**
   - Add webhook URL in provider dashboard
   - Enable events: delivered, opened, clicked, bounced, complained, unsubscribed

4. **Restart Application:**
   - Worker starts automatically on boot
   - Check logs for "Starting Outreach Email Delivery Worker..."

---

### Verifying Worker Health

**1. Check Workflow Logs:**
```bash
# Look for worker startup message
[OutreachWorker] Starting email delivery worker
[OutreachWorker] Config: concurrency=3, rpm=60, dryRun=false
```

**2. Check OS_Health Sheet:**
- Component: `Outreach Worker`
- Status: `PASS` (or `WARN` if no provider configured)
- LastCheck: Should update every 5 seconds

**3. Check Worker Metrics API:**
```bash
curl https://your-domain.com/api/outreach/worker/metrics
```

**4. Check Sending Tab UI:**
- Worker status badge: Active (green) or Stopped (red)
- Last run timestamp updates every 5 seconds

---

### Testing Email Delivery

**1. Enable Dry-Run Mode:**
```bash
OUTREACH_DRY_RUN=true
```

**2. Queue Test Message:**
- Go to Outreach → Sending tab
- Select campaign
- Enter test email
- Click "Send Email"

**3. Monitor Worker Logs:**
```bash
# Should see:
[DRY-RUN] Would send to test@example.com: Test Subject
```

**4. Disable Dry-Run:**
```bash
OUTREACH_DRY_RUN=false
```

**5. Send Real Email:**
- Repeat step 2
- Check Email_Outbox for `Status='sent'`
- Check recipient inbox

---

### Monitoring Production

**Key Metrics to Watch:**

1. **Queue Size** (`metrics.queueSize`):
   - **Normal:** 0-50 messages
   - **Warning:** 100-500 messages (backlog building)
   - **Critical:** >500 messages (throttling or provider issues)

2. **Current RPM** (`metrics.currentRPM`):
   - **Normal:** 0-60 RPM
   - **Warning:** Sustained 60 RPM (hitting limit)
   - **Action:** Increase `OUTREACH_RPM` or upgrade provider plan

3. **Success Rate** (`messagesSent / (messagesSent + messagesFailed)`):
   - **Normal:** >95%
   - **Warning:** 90-95% (investigate errors)
   - **Critical:** <90% (provider or configuration issue)

4. **Error Stream** (`metrics.errors`):
   - **Normal:** 0-5 errors
   - **Warning:** 10-20 errors (check error messages)
   - **Critical:** >20 errors (worker or provider issue)

**Alerting Rules:**
- Queue size >100 for >10 minutes
- Success rate <90% for >5 minutes
- Worker health `WARN` for >2 minutes
- Worker health `LastCheck` not updated for >1 minute (worker stopped)

---

### Troubleshooting Common Issues

#### Issue: Worker Not Running

**Symptoms:**
- Worker status badge: "Stopped" (red)
- `metrics.lastRunTS` is null
- OS_Health not updating

**Diagnosis:**
```bash
# Check workflow logs for worker startup
grep "Outreach" /tmp/logs/*.log

# Check for errors:
grep "ERROR" /tmp/logs/*.log | grep Outreach
```

**Common Causes:**
1. **Provider not configured:** Missing API key
   - Fix: Set `BREVO_API_KEY` or `RESEND_API_KEY`
2. **Worker crash on startup:** Check logs for error
3. **Google Sheets API error:** Check sheet connection

---

#### Issue: Messages Not Sending

**Symptoms:**
- Queue size increasing
- `messagesSent` not increasing
- No errors in error stream

**Diagnosis:**
1. **Check campaign approval:**
   ```sql
   SELECT CampaignID, Name, Status FROM Outreach_Campaigns
   ```
   - Status must be `ACTIVE` or `APPROVED`

2. **Check message status:**
   ```sql
   SELECT MsgID, Status, NextRetryTS, LastError FROM Email_Outbox WHERE Status='queued'
   ```
   - If `NextRetryTS` is in future, message waiting to retry

3. **Check rate limits:**
   - If `currentRPM` = 60, worker is throttled
   - Increase `OUTREACH_RPM` env var

---

#### Issue: High Failure Rate

**Symptoms:**
- Success rate <90%
- Many errors in error stream
- Email_Outbox shows `Status='failed'`

**Diagnosis:**
1. **Check provider API errors:**
   ```sql
   SELECT LastError, COUNT(*) as count FROM Email_Outbox WHERE Status='failed' GROUP BY LastError
   ```

2. **Common provider errors:**
   - **"Invalid API key"**: Check `BREVO_API_KEY` or `RESEND_API_KEY`
   - **"Rate limit exceeded"**: Reduce `OUTREACH_RPM`
   - **"Invalid sender domain"**: Verify DNS SPF/DKIM records
   - **"Recipient bounced"**: Clean email list (hard bounces)

3. **Check network issues:**
   - Test provider API manually: `curl https://api.brevo.com/v3/smtp/email`

---

#### Issue: Webhooks Not Working

**Symptoms:**
- Emails sent (`SentTS` populated)
- No open/click tracking (`OpenTS`, `ClickTS` null)
- Email_Stats not updating

**Diagnosis:**
1. **Check webhook configuration:**
   - Verify webhook URL in provider dashboard
   - Test webhook: `curl -X POST https://your-domain.com/api/outreach/webhooks/brevo`

2. **Check provider logs:**
   - Brevo: Dashboard → Transactional → Webhooks → Logs
   - Resend: Dashboard → Webhooks → Logs

3. **Common issues:**
   - **404 Not Found**: Incorrect webhook URL path
   - **Provider mismatch**: `EMAIL_PROVIDER=brevo` but webhook sent to `/webhooks/resend`
   - **Signature verification failed**: Check provider docs

---

## Deliverability Best Practices

### DNS Configuration

**Required DNS Records:**

1. **SPF (Sender Policy Framework):**
   ```dns
   yourcompany.com.  TXT  "v=spf1 include:spf.brevo.com ~all"
   # OR
   yourcompany.com.  TXT  "v=spf1 include:_spf.resend.com ~all"
   # OR (SMTP)
   yourcompany.com.  TXT  "v=spf1 include:_spf.google.com ~all"
   ```

2. **DKIM (DomainKeys Identified Mail):**
   - Brevo: Dashboard → Senders & IP → Domain Authentication
   - Resend: Dashboard → Domains → Verify
   - Add CNAME record provided by provider

3. **DMARC (Domain-based Message Authentication):**
   ```dns
   _dmarc.yourcompany.com.  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@yourcompany.com"
   ```

4. **Custom Tracking Domain (Optional):**
   - Improves deliverability vs. generic provider domain
   - Brevo: `t.yourcompany.com` → CNAME to `track.brevo.com`
   - Resend: `r.yourcompany.com` → CNAME to `track.resend.com`

**Verification:**
```bash
# Check SPF
dig yourcompany.com TXT | grep spf1

# Check DKIM
dig default._domainkey.yourcompany.com TXT

# Check DMARC
dig _dmarc.yourcompany.com TXT
```

---

### Email Warming Up

**Why Warm Up?**
- New sending domains/IPs flagged as spam by default
- Gradual volume increase builds sender reputation

**Warm-Up Schedule (30 days):**

| Day | Max Emails/Day | Max RPM |
|-----|----------------|---------|
| 1-3 | 50             | 5       |
| 4-7 | 100            | 10      |
| 8-14| 250            | 20      |
| 15-21| 500           | 30      |
| 22-30| 1000          | 60      |
| 30+ | Unlimited      | 60+     |

**Implementation:**
```bash
# Days 1-3:
OUTREACH_RPM=5

# Days 4-7:
OUTREACH_RPM=10

# Days 8-14:
OUTREACH_RPM=20

# Days 15-21:
OUTREACH_RPM=30

# Days 22-30:
OUTREACH_RPM=60

# Days 30+:
OUTREACH_RPM=120  # Or higher if provider supports
```

**Best Practices:**
- Start with highly engaged recipients (existing customers)
- Avoid sending to purchased/scraped lists during warm-up
- Monitor bounce rate (<2% bounces)
- Monitor complaint rate (<0.1% spam complaints)

---

### Content Best Practices

**Subject Lines:**
- ❌ ALL CAPS, excessive punctuation (!!!)
- ❌ Spam trigger words: "FREE", "URGENT", "ACT NOW"
- ✅ Personalized: "{{first_name}}, quick question about {{company}}"
- ✅ Clear value: "{{company}} + MH Trading: Partnership Opportunity"

**Email Body:**
- ❌ Image-only emails
- ❌ Large attachments (>1MB)
- ✅ Text-to-image ratio >60% text
- ✅ Plain text alternative (automatically generated)
- ✅ Clear unsubscribe link (automatically added by provider)

**HTML:**
- ✅ Responsive design (mobile-friendly)
- ✅ Inline CSS (no external stylesheets)
- ❌ JavaScript (stripped by email clients)
- ❌ Forms (use CTA links instead)

**Links:**
- ✅ HTTPS only
- ✅ Descriptive anchor text ("View Partnership Details" vs. "Click Here")
- ❌ URL shorteners (bit.ly, tinyurl) - flagged as spam
- ✅ Custom tracking domain (vs. generic provider domain)

---

### List Hygiene

**Bounce Management:**
- **Hard Bounces:** Remove immediately (invalid/non-existent addresses)
- **Soft Bounces:** Retry 3 times, then remove (mailbox full, server down)
- **Target:** <2% bounce rate

**Unsubscribe Handling:**
- ✅ Honor unsubscribes within 1 hour (automated)
- ✅ One-click unsubscribe (no login required)
- ✅ Suppression list checked before every send

**Complaint Handling:**
- ✅ Auto-unsubscribe on spam complaints
- ✅ Investigate if complaint rate >0.1%

**Email Validation:**
- ✅ Syntax validation (regex)
- ✅ Domain MX record check
- ✅ Disposable email detection (optional)

---

### Engagement Monitoring

**Key Metrics:**

| Metric | Good | Fair | Poor |
|--------|------|------|------|
| Open Rate | >25% | 15-25% | <15% |
| Click Rate | >5% | 2-5% | <2% |
| Bounce Rate | <2% | 2-5% | >5% |
| Complaint Rate | <0.1% | 0.1-0.5% | >0.5% |

**Actions:**
- **Low Open Rate:** Improve subject lines, send time, sender name
- **Low Click Rate:** Improve email content, CTA placement
- **High Bounce Rate:** Clean list, validate emails
- **High Complaint Rate:** Verify permission, improve content quality

---

## Security & GDPR

### Data Protection

**Personal Data Collected:**
- Email address (required)
- Name, company, city, phone (optional, for personalization)
- Email engagement (opens, clicks) via webhooks

**Storage:**
- Google Sheets (encrypted at rest by Google)
- No local database or file storage
- Secrets managed via Replit Secrets (encrypted)

**Access Control:**
- Sheets API: Service account with read/write access
- Webhook endpoints: Public (signature verification)
- Worker metrics API: Public (no sensitive data exposed)

---

### GDPR Compliance

**Right to Access:**
- User can view their data in Outreach_Contacts sheet
- Admin can export sheet as CSV

**Right to Rectification:**
- Update Outreach_Contacts sheet directly
- Worker uses latest data on next send

**Right to Erasure (Right to be Forgotten):**
- Delete row from Outreach_Contacts
- Add to Unsubscribes sheet
- Worker auto-checks before every send

**Right to Object (Unsubscribe):**
- One-click unsubscribe link in every email
- POST `/api/outreach/unsubscribe` → Unsubscribes sheet
- Worker checks before every send

**Data Minimization:**
- Only collect data needed for personalization
- No tracking pixels (unless provider adds)
- Webhooks track opens/clicks (optional, can be disabled)

---

### Unsubscribe Flow

**User Unsubscribes:**
1. Clicks unsubscribe link in email
2. Provider webhook OR manual link → POST `/api/outreach/unsubscribe`
3. Row added to `Unsubscribes` sheet:
   ```typescript
   {
     Email: 'user@example.com',
     Source: 'brevo webhook',
     UnsubTS: '2025-11-10T20:53:15Z',
     CampaignID: 'CAMP-123',
   }
   ```
4. Worker checks `Unsubscribes` before every send
5. Messages to unsubscribed users marked `Status='failed'`

**Re-subscription:**
- Admin manually removes from `Unsubscribes` sheet
- User must explicitly opt-in again (double opt-in recommended)

---

## Appendix

### Email_Outbox Schema

```typescript
{
  MsgID: string;          // Primary key (e.g., "MSG-abc123")
  CampID: string;         // Campaign ID
  To: string;             // Recipient email
  From: string;           // Sender email
  Subject: string;        // Email subject
  Body: string;           // HTML body
  Status: string;         // 'queued', 'sending', 'sent', 'failed', 'bounced', 'complained'
  SeqStep: number;        // Sequence step number
  ProviderID: string;     // Provider message ID (for tracking)
  
  // Idempotency & Retry
  MessageKey: string;     // SHA-256 hash for deduplication
  Attempts: number;       // Retry attempt count
  NextRetryTS: string;    // ISO timestamp for next retry
  LastError: string;      // Last error message
  
  // Timestamps
  CreatedTS: string;      // ISO timestamp
  SentTS: string;         // ISO timestamp (delivered)
  OpenTS: string;         // ISO timestamp (first open)
  ClickTS: string;        // ISO timestamp (first click)
  BounceTS: string;       // ISO timestamp (bounced)
  ComplaintTS: string;    // ISO timestamp (spam complaint)
  UnsubTS: string;        // ISO timestamp (unsubscribed)
}
```

---

### Worker Metrics Schema

```typescript
{
  lastRunTS: string;            // ISO timestamp of last poll
  messagesSent: number;         // Total sent since worker start
  messagesFailed: number;       // Total failed since worker start
  messagesSkipped: number;      // Total skipped (throttle, approval, GDPR)
  currentRPM: number;           // Current sending rate (last 60s)
  queueSize: number;            // Messages with Status='queued'
  errors: Array<{
    ts: string;                 // ISO timestamp
    error: string;              // Error message
    msgID: string;              // Message ID
  }>;
}
```

---

### Glossary

**Brevo:** Email service provider (formerly SendInBlue)

**Concurrency:** Number of parallel email sends (default: 3)

**DKIM:** DomainKeys Identified Mail - email authentication protocol

**DMARC:** Domain-based Message Authentication, Reporting & Conformance

**Dry-Run:** Testing mode that simulates sends without calling provider API

**Idempotency:** Guarantee that duplicate sends are prevented via SHA-256 hash

**MessageKey:** SHA-256 hash of campaign+step+recipient+subject+body

**Nodemailer:** Node.js library for sending emails via SMTP

**p-limit:** Concurrency control library for parallel async operations

**Rate Limiting:** Throttling send rate to avoid provider limits (60 RPM default)

**Resend:** Modern email API provider

**RPM:** Requests Per Minute - email sending rate

**SPF:** Sender Policy Framework - email authentication protocol

**Webhook:** HTTP callback for email events (delivered, opened, clicked, etc.)

---

## Changelog

### Version 2.0 (Phase 2A) - November 10, 2025

**Major Changes:**
- ✅ Production email delivery worker (700+ lines)
- ✅ Multi-provider abstraction (Brevo, Resend, SMTP)
- ✅ Rate limiting (60 RPM global, 20/hour per-recipient)
- ✅ Idempotency via SHA-256 message key
- ✅ Campaign approval gating (ACTIVE/APPROVED only)
- ✅ GDPR compliance (auto-unsubscribe checking)
- ✅ Webhook integration (SentTS, OpenTS, ClickTS)
- ✅ Real-time monitoring UI (Sending tab)
- ✅ OS_Health/OS_Logs integration
- ✅ Graceful shutdown (SIGTERM)

**Bug Fixes:**
- Fixed webhook column names (OpenTS vs OpenedTS)
- Fixed campaign approval pipeline (keep queued vs fail)
- Fixed sheetsService API calls (readSheet vs read)

---

## Support

**Documentation:** This file (OUTREACH_DELIVERY_REPORT.md)

**Logs:**
- Worker logs: `/tmp/logs/Start_application_*.log`
- Browser logs: `/tmp/logs/browser_console_*.log`
- OS_Logs sheet: System-wide error tracking

**Monitoring:**
- Worker metrics: GET `/api/outreach/worker/metrics`
- OS_Health sheet: Worker heartbeat
- Sending tab UI: Real-time dashboard

**Troubleshooting:**
- See [Troubleshooting](#troubleshooting) section above
- Check workflow logs for worker startup
- Verify provider API key configuration
- Test with dry-run mode first

---

**End of Document**
