# دليل تكامل Sentry مع OS_Health
## Sentry Integration & OS_Health Connection Guide

**آخر تحديث**: 12 نوفمبر 2025  
**الحالة**: 📋 خطة للمستقبل

---

## 🎯 نظرة عامة

دليل شامل لإضافة Sentry error tracking وربطه مع نظام OS_Health الموجود في MH Trading OS.

### لماذا Sentry؟

✅ **Real-time Error Tracking**: اكتشاف الأخطاء لحظيًا  
✅ **Source Maps**: Stack traces واضحة  
✅ **Performance Monitoring**: APM للـ backend و frontend  
✅ **Release Tracking**: ربط errors بالـ deployments  
✅ **User Context**: معرفة من تأثر بالخطأ  

### التكامل مع OS_Health

```
┌─────────────────────────────────────────┐
│         Frontend + Backend              │
│                                         │
│  ┌──────────┐         ┌──────────┐    │
│  │  Error   │────────>│  Sentry  │    │
│  └──────────┘         └─────┬────┘    │
│                              │         │
│                              ▼         │
│                       ┌──────────┐    │
│                       │ OS_Health│    │
│                       │  Logs    │    │
│                       └──────────┘    │
└─────────────────────────────────────────┘
```

---

## 📦 1. Installation

### Install Sentry SDKs

```bash
npm install --save \
  @sentry/node \
  @sentry/vite-plugin \
  @sentry/react
```

### Environment Variables

أضف في Replit Secrets:

```bash
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org
SENTRY_PROJECT=mh-trading-os
SENTRY_AUTH_TOKEN=your-auth-token
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
```

---

## 🔧 2. Backend Integration

### server/lib/sentry.ts

```typescript
import * as Sentry from '@sentry/node';
import { sheetsService } from './sheets';

export function initSentry() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Sentry] Skipped in development');
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1, // 10% APM sampling
    
    // Release tracking
    release: `mh-trading-os@${process.env.COMMIT_SHA || 'unknown'}`,
    
    // Performance monitoring
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: true }),
    ],
    
    // Error filtering
    beforeSend(event, hint) {
      // تصفية errors غير مهمة
      const error = hint.originalException;
      
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const statusCode = (error as any).statusCode;
        if (statusCode === 404 || statusCode === 401) {
          return null; // لا ترسل 404/401 لـ Sentry
        }
      }
      
      return event;
    },
    
    // Integration مع OS_Health
    beforeSendTransaction(event) {
      // Log slow transactions إلى OS_Health
      const duration = event.timestamp ? 
        (event.timestamp - event.start_timestamp!) * 1000 : 0;
      
      if (duration > 1000) { // > 1 second
        sheetsService.logToSheet(
          'WARN',
          'Performance',
          `Slow transaction: ${event.transaction} (${duration}ms)`,
          event.event_id
        ).catch(console.error);
      }
      
      return event;
    },
  });

  console.log('[Sentry] Initialized for backend');
}

// Custom error handler مع OS_Health
export async function captureErrorWithHealth(
  error: Error,
  context?: Record<string, any>
) {
  // Send to Sentry
  const sentryId = Sentry.captureException(error, {
    extra: context,
  });

  // Log to OS_Health
  try {
    await sheetsService.logToSheet(
      'ERROR',
      context?.source || 'Backend',
      `${error.message} (Sentry: ${sentryId})`,
      context?.requestId
    );
  } catch (logError) {
    console.error('[Sentry] Failed to log to OS_Health:', logError);
  }

  return sentryId;
}
```

### server/index.ts

```typescript
import { initSentry, captureErrorWithHealth } from './lib/sentry';
import * as Sentry from '@sentry/node';

// Initialize Sentry في بداية التطبيق
initSentry();

const app = express();

// Sentry request handler (يجب أن يكون أول middleware)
app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());

// ... existing middleware ...

// Error handler مع Sentry و OS_Health
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  
  // Capture في Sentry و OS_Health
  if (status >= 500) {
    captureErrorWithHealth(err, {
      source: 'HTTP',
      requestId: req.id,
      path: req.path,
      method: req.method,
    });
  }

  res.status(status).json({
    error: err.message || "Internal Server Error",
    requestId: req.id,
  });
});

// Sentry error handler (يجب أن يكون آخر middleware)
app.use(Sentry.Handlers.errorHandler());
```

---

## ⚛️ 3. Frontend Integration

### client/src/lib/sentry.ts

```typescript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

export function initSentry() {
  if (import.meta.env.MODE !== 'production') {
    console.log('[Sentry] Skipped in development');
    return;
  }

  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [
      new BrowserTracing({
        // Performance monitoring
        tracingOrigins: ['localhost', /^\//],
      }),
      new Sentry.Replay({
        // Session replay (optional)
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    
    // Performance monitoring
    tracesSampleRate: 0.1,
    
    // Session replay sampling
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    
    // Release tracking
    release: `mh-trading-os@${import.meta.env.VITE_COMMIT_SHA || 'unknown'}`,
    
    // Error filtering
    beforeSend(event, hint) {
      // تصفية network errors
      if (event.exception?.values?.[0]?.type === 'NetworkError') {
        return null;
      }
      
      return event;
    },
  });

  console.log('[Sentry] Initialized for frontend');
}

// Custom error boundary component
export const SentryErrorBoundary = Sentry.ErrorBoundary;
```

### client/src/main.tsx

```typescript
import { initSentry, SentryErrorBoundary } from '@/lib/sentry';

// Initialize Sentry
initSentry();

createRoot(document.getElementById("root")!).render(
  <SentryErrorBoundary
    fallback={({ error, resetError }) => (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <button 
            onClick={resetError}
            className="px-4 py-2 bg-primary text-white rounded"
          >
            Try again
          </button>
        </div>
      </div>
    )}
    showDialog
  >
    <App />
  </SentryErrorBoundary>
);
```

---

## 🔗 4. OS_Health Integration

### Enhanced OS_Logs Schema

أضف حقل `sentry_id` إلى OS_Logs في Google Sheets:

| Timestamp | Level | Source | Message | RequestID | **SentryID** |
|-----------|-------|--------|---------|-----------|--------------|
| 2025-11-12 | ERROR | HTTP | Error message | req-123 | **abc-456** |

### server/lib/sheets.ts

```typescript
// تحديث logToSheet لدعم Sentry ID
async logToSheet(
  level: string,
  source: string,
  message: string,
  requestId?: string,
  sentryId?: string // NEW
): Promise<void> {
  const logEntry = {
    Timestamp: new Date().toISOString(),
    Level: level.toUpperCase(),
    Source: source,
    Message: message,
    RequestID: requestId || '',
    SentryID: sentryId || '', // NEW
  };

  await this.writeRows('OS_Logs', [logEntry]);
}
```

### Sentry Dashboard Link في Admin Panel

```typescript
// client/src/pages/admin.tsx

function SentrySection() {
  const { data: logs } = useQuery<any[]>({
    queryKey: ['/api/admin/logs'],
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Errors</CardTitle>
      </CardHeader>
      <CardContent>
        {logs?.filter(log => log.SentryID).map(log => (
          <div key={log.Timestamp} className="flex items-center gap-2">
            <Badge variant="destructive">{log.Level}</Badge>
            <span>{log.Message}</span>
            <a 
              href={`https://sentry.io/organizations/your-org/issues/?query=${log.SentryID}`}
              target="_blank"
              className="text-primary hover:underline"
            >
              View in Sentry →
            </a>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## 📊 5. Performance Monitoring

### Backend APM

```typescript
// server/routes.ts

import * as Sentry from '@sentry/node';

router.get('/api/pricing/calculate', async (req, res) => {
  // إنشاء transaction لـ performance monitoring
  const transaction = Sentry.startTransaction({
    op: 'http.server',
    name: 'Calculate Pricing',
  });

  try {
    // Business logic مع spans
    const span1 = transaction.startChild({
      op: 'db.query',
      description: 'Fetch price list',
    });
    const priceList = await sheetsService.readSheet('FinalPriceList');
    span1.finish();

    const span2 = transaction.startChild({
      op: 'calculation',
      description: 'Apply pricing rules',
    });
    const result = calculatePrice(priceList, req.body);
    span2.finish();

    res.json(result);
  } catch (error) {
    transaction.setStatus('internal_error');
    throw error;
  } finally {
    transaction.finish();
  }
});
```

### Frontend Performance

```typescript
// client/src/lib/sentry.ts

import * as Sentry from '@sentry/react';

// Track Core Web Vitals
export function trackWebVitals() {
  if ('web-vital' in window.performance) {
    Sentry.setMeasurement('FCP', performance.getEntriesByType('paint')[0].startTime, 'millisecond');
    Sentry.setMeasurement('LCP', performance.getEntriesByType('largest-contentful-paint')[0].startTime, 'millisecond');
  }
}

// Track custom metrics
export function trackCustomMetric(name: string, value: number) {
  Sentry.setMeasurement(name, value, 'millisecond');
  
  // أيضًا log إلى OS_Health للتحليل
  if (value > 1000) { // Slow operation
    fetch('/api/admin/performance-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: name,
        value,
        timestamp: new Date().toISOString(),
      }),
    });
  }
}
```

---

## 🚨 6. Alerting & Notifications

### Sentry Alerts إلى OS_Health

إنشاء webhook في Sentry يرسل إلى endpoint خاص:

```typescript
// server/routes-admin.ts

router.post('/sentry/webhook', async (req, res) => {
  const { action, data } = req.body;
  
  if (action === 'issue.created' || action === 'issue.resolved') {
    await sheetsService.logToSheet(
      action === 'issue.created' ? 'ERROR' : 'INFO',
      'Sentry',
      `${data.issue.title} - ${data.issue.culprit}`,
      undefined,
      data.issue.id
    );
  }
  
  res.json({ success: true });
});
```

### Configuration في Sentry

1. Project Settings → Integrations → Webhooks
2. Add webhook: `https://your-app.replit.app/api/admin/sentry/webhook`
3. Select events: `issue.created`, `issue.resolved`

---

## 📈 7. Dashboard & Monitoring

### OS_Health Integration Dashboard

```typescript
// client/src/pages/admin.tsx

function HealthMonitoring() {
  const { data: sentryStats } = useQuery({
    queryKey: ['/api/admin/sentry-stats'],
  });

  return (
    <div className="grid grid-cols-3 gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Errors (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {sentryStats?.errors24h || 0}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>P95 Response Time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {sentryStats?.p95ResponseTime || 0}ms
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Affected Users</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">
            {sentryStats?.affectedUsers || 0}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 🔐 8. Security & Privacy

### PII Filtering

```typescript
// Automatic PII scrubbing
Sentry.init({
  beforeSend(event) {
    // Remove sensitive data
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers?.['authorization'];
    }
    
    // Scrub user data
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    
    return event;
  },
});
```

---

## ✅ Implementation Checklist

### Phase 1: Basic Setup
- [ ] تثبيت Sentry packages
- [ ] إضافة environment variables
- [ ] Initialize Sentry (backend + frontend)
- [ ] Test error tracking

### Phase 2: OS_Health Integration
- [ ] إضافة SentryID column إلى OS_Logs
- [ ] تحديث logToSheet function
- [ ] ربط Sentry errors مع OS_Health
- [ ] إنشاء Admin dashboard

### Phase 3: Advanced Features
- [ ] Performance monitoring (APM)
- [ ] Sentry webhooks
- [ ] Custom alerts
- [ ] Session replay

---

## 📚 Resources

- [Sentry Node.js Docs](https://docs.sentry.io/platforms/node/)
- [Sentry React Docs](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Best Practices](https://docs.sentry.io/platforms/javascript/best-practices/)

---

**التكلفة المُتوقعة**:
- Free tier: 5,000 errors/month
- Team plan: $26/month (50,000 errors)
- Business plan: $80/month (unlimited errors + APM)

**التوصية**: ابدأ بـ Free tier للاختبار، ثم upgrade حسب الحاجة.

---

**مُهندس منصّة**: Replit Agent  
**التاريخ**: 12 نوفمبر 2025  
**الحالة**: 📋 Ready for Implementation
