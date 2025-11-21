# دليل إعداد CI/CD Pipeline
## CI/CD Setup Guide for MH Trading OS

**آخر تحديث**: 12 نوفمبر 2025  
**الحالة**: ✅ جاهز للتنفيذ

---

## 📋 نظرة عامة

تم إعداد CI/CD pipeline متكامل باستخدام GitHub Actions مع:
- ✅ Lint & TypeCheck
- ✅ Tests مع coverage thresholds
- ✅ Security Audit
- ✅ Build مع bundle size analysis
- ✅ Performance budget checks

---

## 🚀 خطوات التفعيل السريعة

### 1. إضافة Scripts إلى package.json

افتح `package.json` وأضف هذه scripts (لا يمكن إضافتها تلقائيًا):

```json
{
  "scripts": {
    "test": "npm run test:backend && npm run test:frontend",
    "test:backend": "jest --config jest.backend.config.js --coverage --coverageDirectory=coverage/backend",
    "test:frontend": "jest --config jest.frontend.config.js --coverage --coverageDirectory=coverage/frontend",
    "test:watch": "jest --watch",
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "typecheck": "tsc --noEmit && tsc --noEmit -p client/tsconfig.json"
  }
}
```

### 2. تثبيت Dependencies المطلوبة

```bash
npm install --save-dev \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  ts-jest \
  identity-obj-proxy \
  eslint
```

### 3. Push إلى GitHub

```bash
git add .
git commit -m "feat: Add CI/CD pipeline with GitHub Actions"
git push origin main
```

### 4. التحقق من GitHub Actions

1. افتح repository على GitHub
2. انتقل إلى تبويب **Actions**
3. ستجد workflow يعمل تلقائيًا

---

## 📊 Coverage Thresholds

| المكون | الحد الأدنى | الحالة الحالية |
|--------|-------------|-----------------|
| **Backend** | 70% | ⚠️ سيتطلب كتابة tests |
| **Frontend** | 60% | ⚠️ سيتطلب كتابة tests |

**ملاحظة**: CI سيفشل إن لم تصل التغطية للحد المطلوب.

---

## 🏗️ بنية الـ Workflow

### Job 1: Lint & TypeCheck
```yaml
✓ ESLint Frontend (client/src/**/*.{ts,tsx})
✓ ESLint Backend (server/**/*.ts)
✓ TypeScript Frontend (client/tsconfig.json)
✓ TypeScript Backend (server/*.ts)
```

### Job 2: Test Backend (Coverage ≥70%)
```yaml
✓ Run Jest tests (server/__tests__/**)
✓ Generate coverage report
✓ Check coverage threshold
✓ Upload to Codecov (optional)
```

### Job 3: Test Frontend (Coverage ≥60%)
```yaml
✓ Run Jest tests (client/__tests__/**)
✓ Generate coverage report
✓ Check coverage threshold
✓ Upload to Codecov (optional)
```

### Job 4: Security Audit
```yaml
✓ npm audit (moderate+ vulnerabilities)
✓ Dependency vulnerability scan
✓ OWASP Dependency Check (main branch only)
```

### Job 5: Build & Bundle Analysis
```yaml
✓ Build production bundle
✓ Analyze bundle sizes (JS/CSS)
✓ Check gzipped sizes
✓ Verify performance budget:
  - Max JS: 1000KB
  - Max CSS: 100KB
```

### Job 6: Performance Budget (PR only)
```yaml
✓ Compare bundle sizes
✓ Report budget status
✓ Show in PR comments
```

---

## 📁 الملفات المُنشأة

```
.github/
└── workflows/
    └── ci.yml                        ← GitHub Actions workflow

jest.backend.config.js                ← Backend test config
jest.frontend.config.js               ← Frontend test config

server/
└── __tests__/
    ├── setup.ts                      ← Test setup
    └── example.test.ts               ← Example test

client/
├── __tests__/
│   ├── setup.tsx                     ← Test setup
│   └── example.test.tsx              ← Example test
└── __mocks__/
    └── fileMock.js                   ← Asset mock

CI_SETUP_GUIDE.md                     ← This file
SENTRY_INTEGRATION.md                 ← Sentry setup guide
```

---

## 🧪 كتابة Tests

### Backend Test Example

```typescript
// server/__tests__/pricing.test.ts
import { describe, it, expect } from '@jest/globals';
import { calculatePrice } from '../lib/pricing';

describe('Pricing Engine', () => {
  it('should calculate base price correctly', () => {
    const result = calculatePrice({ sku: 'TEST-001', qty: 10 });
    expect(result.total).toBe(100);
  });

  it('should apply bulk discount', () => {
    const result = calculatePrice({ sku: 'TEST-001', qty: 100 });
    expect(result.discount).toBeGreaterThan(0);
  });
});
```

### Frontend Test Example

```typescript
// client/__tests__/components/Button.test.tsx
import { describe, it, expect } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button Component', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

---

## 🔒 Security Audit

### npm audit

تشغيل تلقائي على كل push:
```bash
npm audit --audit-level=moderate
```

### OWASP Dependency Check

يعمل على main branch فقط للبحث عن:
- Known CVEs
- Vulnerable dependencies
- Security advisories

---

## 📦 Bundle Size Analysis

### تقرير تلقائي في كل build:

```
📦 Bundle Size Report

Frontend Assets:
  index-abc123.js    939KB → 242KB (gzipped)
  index-def456.css    81KB →  13KB (gzipped)

Total Frontend Size: 1.2MB
Backend Bundle: 865KB

Performance Budget:
| Metric     | Current | Budget | Status |
|------------|---------|--------|--------|
| Total JS   | 939KB   | 1000KB | ✅ Pass |
| Total CSS  | 81KB    | 100KB  | ✅ Pass |
```

---

## ⚙️ Environment Variables المطلوبة

### للـ CI في GitHub Secrets:

```bash
# Optional - للـ Codecov integration
CODECOV_TOKEN=<your-codecov-token>

# Optional - للـ Sentry integration (المستقبل)
SENTRY_AUTH_TOKEN=<your-sentry-token>
SENTRY_ORG=<your-org>
SENTRY_PROJECT=<your-project>
```

لإضافة secrets:
1. GitHub Repository → Settings → Secrets and variables → Actions
2. New repository secret
3. أضف الـ secrets المطلوبة

---

## 🎯 Best Practices

### 1. قبل كل Commit

```bash
# تشغيل local tests
npm test

# تشغيل linting
npm run lint

# تشغيل typecheck
npm run typecheck
```

### 2. قبل كل PR

```bash
# تأكد من نجاح كل الاختبارات
npm run test

# تأكد من coverage كافي
npm run test:backend -- --coverage
npm run test:frontend -- --coverage

# تأكد من build ناجح
npm run build
```

### 3. مراجعة CI Results

- ✅ كل الـ checks خضراء قبل merge
- ⚠️ راجع warnings في Security Audit
- 📊 راجع Bundle Size Report للتأكد من عدم زيادة الحجم

---

## 🐛 Troubleshooting

### Test Failures

```bash
# تشغيل tests في watch mode
npm run test:watch

# تشغيل test محدد
npm test -- server/__tests__/pricing.test.ts

# تشغيل مع verbose output
npm test -- --verbose
```

### Coverage Below Threshold

```bash
# عرض coverage report
npm run test:backend -- --coverage
open coverage/backend/lcov-report/index.html

npm run test:frontend -- --coverage
open coverage/frontend/lcov-report/index.html
```

### Build Issues

```bash
# تنظيف cache
rm -rf dist/ node_modules/.vite

# إعادة build
npm run build

# فحص bundle sizes
du -h dist/public/assets/*
```

---

## 📈 Roadmap

### Phase 1: Foundation ✅
- [x] GitHub Actions workflow
- [x] Jest configuration
- [x] Basic tests
- [x] Coverage thresholds

### Phase 2: Enhancement (التالي)
- [ ] كتابة tests شاملة (target 70%+ backend, 60%+ frontend)
- [ ] إضافة E2E tests مع Playwright
- [ ] Integration مع Codecov
- [ ] Pre-commit hooks مع Husky

### Phase 3: Advanced (المستقبل)
- [ ] Sentry integration (راجع SENTRY_INTEGRATION.md)
- [ ] Performance monitoring
- [ ] Visual regression testing
- [ ] Automated dependency updates (Dependabot)

---

## 🔗 موارد إضافية

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Codecov](https://about.codecov.io/)

---

## ✅ Checklist للبدء

- [ ] إضافة scripts إلى package.json
- [ ] تثبيت dev dependencies
- [ ] كتابة أول test للـ backend
- [ ] كتابة أول test للـ frontend
- [ ] Push إلى GitHub
- [ ] التحقق من Actions tab
- [ ] إصلاح أي failures
- [ ] ✅ CI Pipeline جاهز!

---

**مُهندس منصّة**: Replit Agent  
**التاريخ**: 12 نوفمبر 2025  
**الحالة**: ✅ Ready for Production
