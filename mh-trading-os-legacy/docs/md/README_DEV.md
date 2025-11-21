# MH Trading OS - Developer Documentation
**دليل المطورين لنظام MH للتجارة**

**Version:** 2.0 (Post-Refactoring)  
**Last Updated:** November 16, 2025  
**Status:** ✅ Production Ready

---

## 📋 Table of Contents / جدول المحتويات

1. [Quick Start](#quick-start)
2. [Project Overview](#project-overview)
3. [Architecture](#architecture)
4. [Directory Structure](#directory-structure)
5. [Environment Setup](#environment-setup)
6. [Development Workflow](#development-workflow)
7. [Google Sheets Integration](#google-sheets-integration)
8. [Testing Strategy](#testing-strategy)
9. [Deployment](#deployment)
10. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites / المتطلبات الأساسية
```bash
# Required / مطلوب
- Node.js 20+
- npm or pnpm
- Google Cloud Project with Sheets API enabled
- Replit account (recommended)
```

### Installation / التثبيت
```bash
# 1. Clone repository / استنساخ المستودع
git clone <repository-url>
cd mh-trading-os

# 2. Install dependencies / تثبيت الاعتمادات
npm install

# 3. Copy environment template / نسخ قالب البيئة
cp .env.example .env

# 4. Configure environment variables (see .env.example)
#    تكوين متغيرات البيئة (انظر .env.example)
nano .env

# 5. Start development server / تشغيل خادم التطوير
npm run dev
```

**Access:** http://localhost:5000

---

## 📖 Project Overview

### What is MH Trading OS?
**نظام MH Trading OS** هو نظام إدارة تجارة B2B متكامل مصمم لمنتجات العناية بالرجال (HAIROTICMEN)

**MH Trading OS** is a comprehensive B2B trading management system designed for men's grooming products (HAIROTICMEN). It manages:

- ✅ **89 Products** across 10 categories
- ✅ **Pricing Engine** with German PAngV compliance
- ✅ **Quote-to-Invoice** workflow
- ✅ **Stand Management** with GPS tracking & QR codes
- ✅ **AI-powered** lead enrichment and marketing
- ✅ **Shipping Calculator** (DHL integration)
- ✅ **Commission System** for partners

### Technology Stack / المكدس التقني

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18 + Vite + Tailwind CSS + shadcn/ui |
| **Backend** | Express.js + TypeScript |
| **Data Store** | Google Sheets (Single Source of Truth) |
| **AI** | OpenAI GPT-4 (gpt-4o-mini) |
| **Email** | Brevo / Resend / SMTP |
| **Testing** | Jest + Playwright |
| **Logger** | Pino |

---

## 🏗️ Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React SPA)                         │
│  ┌────────────┬────────────┬────────────┬────────────┐          │
│  │ Dashboard  │  Pricing   │   Sales    │   Stands   │          │
│  └─────┬──────┴──────┬─────┴──────┬─────┴──────┬─────┘          │
│        │              │            │            │                 │
│  ┌─────┴──────┬──────┴─────┬──────┴─────┬──────┴─────┐          │
│  │  Catalog   │ Operations │  AI Hub    │  Reports   │          │
│  └─────┬──────┴──────┬─────┴──────┬─────┴──────┬─────┘          │
└────────┼─────────────┼────────────┼────────────┼─────────────────┘
         │             │            │            │
         └─────┬───────┴────────┬───┴────────┬───┘
               │                │            │
         ┌─────┴────────────────┴────────────┴─────────────┐
         │          EXPRESS API SERVER (200+ endpoints)     │
         │                                                   │
         │  ┌────────────────────────────────────────────┐  │
         │  │  Business Logic Layer                      │  │
         │  │  - Pricing Engine V2.2                     │  │
         │  │  - Quote Service                           │  │
         │  │  - Stand Operations                        │  │
         │  │  - Commission Engine                       │  │
         │  │  - Territory Manager                       │  │
         │  └────────────┬───────────────────────────────┘  │
         │               │                                   │
         │  ┌────────────┴───────────────────────────────┐  │
         │  │  Infrastructure Services                   │  │
         │  │  - GoogleSheetsService (lib/sheets.ts)     │  │
         │  │  - AI Orchestrator (lib/ai-orchestrator.ts)│  │
         │  │  - Email Service (lib/email.ts)            │  │
         │  │  - Cache Layer (lib/cache.ts)              │  │
         │  │  - Retry Logic (lib/retry.ts)              │  │
         │  │  - Logger (lib/logger.ts) NEW!             │  │
         │  └────────────┬───────────────────────────────┘  │
         └───────────────┼─────────────────────────────────┘
                         │
         ┌───────────────┼─────────────────────────────────┐
         │  EXTERNAL INTEGRATIONS                          │
         │                                                   │
         │  - Google Sheets API (Primary Data Store)       │
         │  - OpenAI API (GPT-4 for AI features)          │
         │  - Google Places API (Lead harvesting)          │
         │  - Email Providers (Brevo/Resend/SMTP)          │
         │  - DHL API (Shipping calculations)              │
         └─────────────────────────────────────────────────┘
```

### Design Principles / مبادئ التصميم

1. **Single Source of Truth:** Google Sheets is the authoritative data source
   **مصدر واحد للحقيقة:** Google Sheets هو مصدر البيانات الموثوق

2. **No Database Duplication:** All data lives in Google Sheets
   **لا تكرار لقاعدة البيانات:** جميع البيانات موجودة في Google Sheets

3. **Pricing-First Architecture:** Automated pricing engine with MAP guardrails
   **بنية تعتمد على التسعير:** محرك تسعير آلي مع ضمانات MAP

4. **Offline-Capable:** Service worker enables offline stand visits
   **قدرات دون اتصال:** خدمة العامل تمكّن زيارات الكشك دون اتصال

---

## 📁 Directory Structure / هيكل المجلدات

### Consolidated Structure (Post-Refactoring)

```
mh-trading-os/
├── client/                          # React Frontend / واجهة React
│   ├── src/
│   │   ├── components/              # UI Components
│   │   │   ├── ui/                  # shadcn/ui primitives
│   │   │   ├── app-sidebar.tsx      # Main navigation
│   │   │   ├── pricing-*.tsx        # Pricing components
│   │   │   └── ...
│   │   ├── pages/                   # Route pages
│   │   │   ├── dashboard.tsx
│   │   │   ├── pricing-studio.tsx
│   │   │   ├── sales-desk.tsx
│   │   │   ├── catalog.tsx
│   │   │   └── ...
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/                     # Client utilities
│   │   ├── App.tsx                  # Main app component
│   │   └── main.tsx                 # Entry point
│   └── public/                      # Static assets
│
├── server/                          # Express Backend / خادم Express
│   ├── lib/                        # Core libraries
│   │   ├── sheets.ts               # ✅ Google Sheets service (ACTIVE)
│   │   ├── logger.ts               # ✅ Pino logger (NEW!)
│   │   ├── retry.ts                # ✅ Enhanced retry logic (UPDATED!)
│   │   ├── pricing-engine-hairoticmen.ts  # Pricing V2.2
│   │   ├── quote-service.ts        # Quote management
│   │   ├── email.ts                # Email service
│   │   ├── cache.ts                # TTL cache
│   │   ├── ai-orchestrator.ts      # AI agents manager
│   │   └── ...
│   │
│   ├── scripts/                    # Management scripts
│   │   ├── build-sheet-from-scratch/  # Bootstrap scripts
│   │   │   ├── 01-create-spreadsheet-structure.ts
│   │   │   ├── 02-seed-configuration-data.ts
│   │   │   ├── 03-seed-product-data.ts
│   │   │   ├── 04-setup-formulas.ts
│   │   │   ├── 05-connect-to-app.ts
│   │   │   ├── 06-seed-shipping-config.ts
│   │   │   ├── 07-validate-and-repair-workbook.ts
│   │   │   └── 08-seed-all-fixtures.ts  # ✅ (ACTIVE - keep this)
│   │   │
│   │   ├── pricing-master.ts       # Run pricing engine
│   │   ├── calculate-shipping-costs.ts
│   │   ├── generate-all-qr-codes.ts
│   │   └── ...
│   │
│   ├── config/                     # Configuration JSON files
│   │   ├── hairoticmen-pricing.json          # ✅ Master pricing (89 products)
│   │   ├── product-slug-mapping-complete.json # ✅ SEO URLs
│   │   └── hairoticmen-shipping-unified.json  # ✅ Shipping config
│   │
│   ├── routes.ts                   # Main API routes (200+ endpoints)
│   ├── routes-admin.ts             # Admin endpoints
│   ├── routes-ai.ts                # AI endpoints
│   ├── routes-outreach.ts          # Outreach endpoints
│   ├── index.ts                    # Server entry point
│   └── ...
│
├── shared/                         # Shared types
│   └── schema.ts                   # Zod schemas & TypeScript types
│
├── docs/                           # Documentation / التوثيق
│   ├── SYSTEM_MAP.md               # System architecture
│   ├── archive/                    # Old documentation
│   └── ...
│
├── attached_assets/                # Generated assets / الأصول المُولّدة
│   ├── qr_codes/                   # Product QR codes (89 files)
│   └── screenshots/                # UI screenshots
│
├── .env.example                    # ✅ Environment template (UPDATED!)
├── eslint.config.js                # ✅ ESLint config (NEW!)
├── .prettierrc                     # ✅ Prettier config (NEW!)
├── REPO_AUDIT.md                   # ✅ Repository audit report (NEW!)
├── LOGGER_MIGRATION_GUIDE.md       # ✅ Logger guide (NEW!)
├── NPM_SCRIPTS.md                  # ✅ Scripts documentation (NEW!)
├── README_DEV.md                   # ✅ This file! (NEW!)
├── replit.md                       # Project overview
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
└── vite.config.ts                  # Vite config
```

### Key Files / الملفات الرئيسية

| File | Purpose | Status |
|------|---------|--------|
| `server/lib/sheets.ts` | Google Sheets integration | ✅ Active |
| `server/lib/logger.ts` | Unified Pino logger | ✅ New! |
| `server/lib/retry.ts` | Enhanced retry with quota protection | ✅ Updated! |
| `server/config/hairoticmen-pricing.json` | Master product data (89 products) | ✅ Source of Truth |
| `server/scripts/build-sheet-from-scratch/08-seed-all-fixtures.ts` | Main seeding script | ✅ Active |

### Deprecated Files (Safe to Remove)

See `REPO_AUDIT.md` for complete list of files marked for removal.

---

## ⚙️ Environment Setup

### Required Variables / المتغيرات المطلوبة

Create `.env` from `.env.example` and configure:

```bash
# 🔐 CRITICAL - Must be set / يجب تعيينها
GOOGLE_CREDENTIALS_JSON='{"type":"service_account",...}'
SHEETS_SPREADSHEET_ID=1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0
OPENAI_API_KEY=sk-proj-...

# 📊 Google Sheets Quota Control / التحكم في حصة Google Sheets
WRITE_BATCH_SIZE=12
WRITE_COOLDOWN_MS=3000

# 📁 File Paths / مسارات الملفات
PRICING_CONFIG_PATH=server/config/hairoticmen-pricing.json
SHIPPING_CONFIG_PATH=server/config/hairoticmen-shipping-unified.json

# 🌐 Application / التطبيق
APP_BASE_URL=https://your-repl.replit.app
NODE_ENV=development
SESSION_SECRET=<generate-with-openssl-rand-base64-32>

# 📧 Email Provider / مزود البريد
EMAIL_PROVIDER=brevo
BREVO_API_KEY=xkeysib-...
```

**📖 Full documentation:** See `.env.example` for all 50+ environment variables with bilingual descriptions.

---

## 🔧 Development Workflow

### Daily Development / التطوير اليومي

```bash
# Start development server / تشغيل خادم التطوير
npm run dev

# Run type checking / فحص الأنواع
npm run typecheck

# Run linter / تشغيل الفاحص
npm run lint

# Auto-fix linting issues / إصلاح تلقائي لمشاكل الفاحص
npm run lint:fix

# Format code / تنسيق الكود
npm run format

# Run all quality checks / تشغيل جميع فحوصات الجودة
npm run quality
```

### Running Scripts / تشغيل السكربتات

```bash
# Bootstrap Google Sheets (first time setup)
# تهيئة Google Sheets (الإعداد الأول)
SHEETS_SPREADSHEET_ID=<your-id> tsx server/scripts/build-sheet-from-scratch/01-create-spreadsheet-structure.ts
tsx server/scripts/build-sheet-from-scratch/02-seed-configuration-data.ts
tsx server/scripts/build-sheet-from-scratch/03-seed-product-data.ts
# ... etc

# Run pricing engine / تشغيل محرك التسعير
tsx server/scripts/pricing-master.ts

# Generate QR codes / توليد أكواد QR
tsx server/scripts/generate-all-qr-codes.ts

# Calculate shipping costs / حساب تكاليف الشحن
tsx server/scripts/calculate-shipping-costs.ts
```

### Code Style / أسلوب الكود

This project uses:
- **ESLint** for linting (config: `eslint.config.js`)
- **Prettier** for formatting (config: `.prettierrc`)
- **TypeScript** for type safety (config: `tsconfig.json`)

**Before committing:**
```bash
npm run quality
```

---

## 📊 Google Sheets Integration

### Sheet Structure (103 Sheets)

The system manages 103 Google Sheets worksheets:

| Category | Sheets | Purpose |
|----------|--------|---------|
| **Pricing** | FinalPriceList, Pricing_Params, Bundles, GiftBank | Product pricing & bundling |
| **Partners** | Partner_Registry, Partner_Tiers, Commission_Ledger | B2B partner management |
| **Operations** | Orders, Quotes, Invoices, Stands, Stand_Inventory | Sales operations |
| **Shipping** | Packaging_Boxes, ShippingMethods, ShippingRules | Logistics |
| **CRM** | CRM_Leads, Lead_Touches, Territories, Assignment_Rules | Lead management |
| **AI** | AI_Jobs, AI_Crew, Pricing_Suggestions_Draft | AI automation |
| **System** | Settings, OS_Logs, OS_Health, Enums | System configuration |

### Quota Protection / حماية الحصة

**Google Sheets API Limits:**
- Read: 60 requests/minute/user
- Write: 60 requests/minute/user

**Our Protection Strategy:**
1. **Batch writes:** `WRITE_BATCH_SIZE=12` (configurable)
2. **Cooldown periods:** `WRITE_COOLDOWN_MS=3000` (3 seconds)
3. **Intelligent retry:** Enhanced `retry.ts` with quota detection
4. **Caching:** TTL cache for frequently read data

**If you hit quota limits:**
```bash
# Increase cooldown time / زد وقت التهدئة
WRITE_COOLDOWN_MS=5000

# Reduce batch size / قلل حجم الدفعة
WRITE_BATCH_SIZE=5
```

### Writing to Sheets / الكتابة إلى الأوراق

```typescript
import { sheetsService } from './lib/sheets';
import { retryGoogleSheetsWrite } from './lib/retry';

// Always use retry wrapper / استخدم دائماً غلاف إعادة المحاولة
await retryGoogleSheetsWrite(async () => {
  await sheetsService.writeRows('Products', [
    { SKU: 'ABC-001', Name: 'Product 1', Price: 12.99 }
  ]);
});
```

---

## 🧪 Testing Strategy

### Unit Tests
```bash
npm run test                 # Run once
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage
```

**Location:** `server/__tests__/` and `client/__tests__/`

### End-to-End Tests

Use Playwright for UI testing (to be implemented - see Task 8).

### Smoke Tests

Critical scripts to test:
1. ✅ 01-create-spreadsheet-structure
2. ✅ 02-seed-configuration-data
3. ✅ 03-seed-product-data
4. ✅ 04-setup-formulas
5. ✅ 06-seed-shipping-config
6. ✅ 08-seed-all-fixtures

**See:** Smoke tests implementation in Task 8.

---

## 🚀 Deployment

### Replit Deployment (Recommended)

1. **Set Secrets in Replit:**
   - GOOGLE_CREDENTIALS_JSON
   - SHEETS_SPREADSHEET_ID
   - OPENAI_API_KEY
   - All other required env vars

2. **Deploy:**
   ```bash
   npm run build
   npm run start
   ```

3. **Auto-deploy:** Enable auto-deploy from main branch

### Manual Deployment

```bash
# Build frontend & backend / بناء الواجهة والخادم
npm run build

# Start production server / تشغيل خادم الإنتاج
NODE_ENV=production node dist/index.js
```

---

## 🔍 Troubleshooting

### Common Issues / المشاكل الشائعة

#### 1. "Quota exceeded" Error

**Solution:**
```bash
# Wait 60 seconds, then increase cooldown
WRITE_COOLDOWN_MS=5000
WRITE_BATCH_SIZE=5
```

#### 2. "SHEETS_SPREADSHEET_ID not set"

**Solution:**
```bash
# Add to .env / أضف إلى .env
SHEETS_SPREADSHEET_ID=1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0
```

#### 3. "Invalid credentials" (Google Sheets)

**Solution:**
```bash
# Verify GOOGLE_CREDENTIALS_JSON is:
# 1. Valid JSON
# 2. Has escaped \n in private_key
# 3. From correct service account

# Regenerate from: https://console.cloud.google.com
```

#### 4. TypeScript Errors

**Solution:**
```bash
npm run typecheck        # Check errors
npm run lint:fix         # Auto-fix lint issues
```

#### 5. Port Already in Use

**Solution:**
```bash
# Change port in .env / غيّر المنفذ في .env
PORT=5001
```

---

## 📚 Additional Resources

### Documentation Files

- 📄 `replit.md` - Project overview & recent changes
- 📄 `REPO_AUDIT.md` - Repository structure audit
- 📄 `SYSTEM_MAP.md` - Detailed architecture
- 📄 `.env.example` - Environment variables guide
- 📄 `LOGGER_MIGRATION_GUIDE.md` - Logger usage guide
- 📄 `NPM_SCRIPTS.md` - npm scripts documentation

### External Documentation

- [Google Sheets API](https://developers.google.com/sheets/api)
- [OpenAI API](https://platform.openai.com/docs)
- [Pino Logger](https://getpino.io)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)

---

## 🎯 Quick Reference Commands

```bash
# Development / التطوير
npm run dev                    # Start dev server
npm run typecheck              # Type checking
npm run lint                   # Lint code
npm run format                 # Format code
npm run quality                # All checks

# Testing / الاختبار
npm run test                   # Run tests
npm run test:watch             # Watch mode
npm run test:coverage          # With coverage

# Build & Deploy / البناء والنشر
npm run build                  # Build for production
npm run start                  # Start production server

# Scripts / السكربتات
tsx server/scripts/pricing-master.ts
tsx server/scripts/generate-all-qr-codes.ts
tsx server/scripts/calculate-shipping-costs.ts
```

---

## ✅ Post-Refactoring Checklist

- [x] Repository audit completed
- [x] .env.example updated with all variables
- [x] npm scripts added (lint, typecheck, test, format)
- [x] Pino logger configured
- [x] retry.ts enhanced with quota protection
- [x] README_DEV.md created
- [ ] Duplicate files consolidated (Task 7)
- [ ] Smoke tests implemented (Task 8)
- [ ] Architect review completed (Task 9)

---

## 📞 Support & Contribution

### Getting Help

1. Check this README first
2. Review `.env.example` for configuration
3. Check `REPO_AUDIT.md` for file locations
4. Review logs in Replit console

### Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Run quality checks: `npm run quality`
4. Commit: `git commit -m "feat: add feature"`
5. Push and create PR

---

**Last Updated:** November 16, 2025  
**Maintained by:** MH Trading OS Team  
**Status:** ✅ Production Ready (Post-Refactoring)
