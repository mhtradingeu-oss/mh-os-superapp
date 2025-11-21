# MH Trading OS — HAIROTICMEN Edition

<div dir="rtl">

# نظام التداول MH — إصدار HAIROTICMEN

</div>

## 🌍 Multi-Language / متعدد اللغات

**English** | [العربية](#النسخة-العربية)

---

## Overview

**MH Trading OS** is a production-grade B2B trading operations platform for grooming and barber product distribution. Built with modern web technologies, it provides comprehensive management for:

- 💰 **Pricing Engine** - Automated pricing with German PAngV compliance
- 📦 **Inventory & Stand Management** - GPS-tracked locations with QR codes
- 📊 **Sales Workflow** - Quote → Order → Invoice with PDF generation
- 🚚 **Logistics & Shipping** - DHL integration with cost estimation
- 🤖 **AI Hub** - GPT-4 powered assistants for operations
- 📈 **Growth & CRM** - Lead harvesting and territory management
- 📧 **Outreach Automation** - Email campaigns with tracking
- 🎯 **Marketing Studio** - SEO, Ads, and Social Media tools

### Key Features

- ✅ **89 Products** (84 active, 5 inactive)
- ✅ **Single Source of Truth** - Google Sheets integration
- ✅ **Real-time Updates** - TanStack Query with caching
- ✅ **Bilingual** - English/Arabic with RTL support
- ✅ **Dark Mode** - Full theme support
- ✅ **Offline Ready** - PWA with service worker
- ✅ **AI-Powered** - 4 specialized GPT-4 assistants
- ✅ **Production Ready** - Comprehensive testing and monitoring

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ installed
- Google Sheets API access
- OpenAI API key (for AI features)
- Replit account (recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd mh-trading-os
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Create a `.env` file or use Replit Secrets
   - Required secrets:
     ```
     GOOGLE_CLIENT_ID=your_google_client_id
     GOOGLE_CLIENT_SECRET=your_google_client_secret
     GOOGLE_REDIRECT_URI=your_redirect_uri
     OPENAI_API_KEY=your_openai_api_key
     ```

4. **Run the application**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Open `http://localhost:5000` in your browser
   - Navigate to `/admin` to run the bootstrap wizard

### First-Time Setup

1. **Run Bootstrap Wizard** (`/admin`)
   - Creates 53 Google Sheets tabs
   - Sets up default configurations
   - Initializes system settings

2. **Import Product Data**
   ```bash
   npx tsx server/scripts/import-products-to-sheets.ts
   ```

3. **Calculate Pricing**
   ```bash
   npx tsx server/scripts/pricing-master.ts
   ```

For detailed setup instructions, see [SETUP_GUIDE.md](./docs/guides/SETUP_GUIDE.md)

---

## 📁 Project Structure

```
mh-trading-os/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components (17 pages)
│   │   ├── lib/            # Utilities and providers
│   │   └── hooks/          # Custom React hooks
│   └── public/             # Static assets
├── server/                 # Express backend
│   ├── lib/                # Business logic and services
│   │   ├── ai-agents/      # AI assistant implementations
│   │   └── email-providers/# Email transport adapters
│   ├── scripts/            # Utility scripts
│   └── routes.ts           # API endpoints (200+)
├── docs/                   # Documentation
│   ├── guides/             # User and setup guides
│   ├── reports/            # System reports and audits
│   └── archive/            # Historical documents
└── attached_assets/        # User-uploaded assets
```

---

## 🎯 Core Modules

### 1. Pricing Studio
- **Automated Pricing**: COGS → Factory Cost → UVP → MAP → Channel Prices
- **German PAngV Compliance**: Grundpreis calculation with VAT
- **Multi-Tier Pricing**: B2B tiers (Dealer Basic, Plus, Premium)
- **Channel-Specific**: Amazon, Web Store, Salon direct
- **Pricing Master Script**: `server/scripts/pricing-master.ts`

### 2. Stand Center
- **GPS Tracking**: Location-based stand management
- **QR Code Generation**: Stand and SKU-level codes
- **Inventory Management**: Real-time stock levels
- **Refill Planning**: Automated replenishment suggestions
- **Visit Mode**: Mobile-optimized field rep interface

### 3. Sales Desk
- **Quote Builder**: AI-powered with margin guardrails
- **Order Management**: Status tracking and timeline
- **Invoice Generation**: PDF with commission breakdown
- **Loyalty System**: Point earning and redemption
- **Partner Management**: Tier-based pricing

### 4. Logistics & Operations
- **DHL Integration**: Shipping cost estimation
- **Shipment Tracking**: Real-time status updates
- **Packaging Selection**: Weight and dimension-based
- **Manifest Generation**: Export for shipping

### 5. AI Hub
Four specialized GPT-4 assistants:
- **Pricing Analyst** (A-PRC-050): Pricing strategy and analysis
- **Stand Ops Bot** (A-STD-060): Inventory and logistics
- **Growth Writer** (A-GRO-070): Lead generation content
- **Ops Assistant** (A-OPS-080): General operations support

### 6. Growth & CRM
- **Lead Harvesting**: Google Places API integration
- **Territory Management**: Rule-based assignment
- **Lead Scoring**: AI-powered qualification
- **Contact Enrichment**: Automated data enhancement

### 7. Outreach
- **Email Campaigns**: Multi-provider support (SMTP, Brevo, Resend)
- **Sequence Management**: Automated follow-ups
- **Webhook Integration**: Open, click, bounce tracking
- **GDPR Compliance**: Consent and unsubscribe handling

### 8. Marketing Studio
- **SEO Tools**: Keyword research and content briefs
- **Ads Manager**: Campaign builder with CSV export
- **Social Calendar**: 14-day content planning

---

## 📚 Documentation

### Essential Guides
- [Setup Guide](./docs/guides/SETUP_GUIDE.md) - Installation and configuration
- [Design Guidelines](./design_guidelines.md) - UI/UX patterns
- [API Reference](./API_SURFACE.md) - Complete API documentation
- [Project Status](./PROJECT_STATUS.md) - Development roadmap

### Technical Reports
- [System Readiness Report](./docs/reports/SYSTEM_READINESS_REPORT.md) - Current system status
- [Technical Audit](./docs/reports/HAIROTICMEN_TECHNICAL_AUDIT_REPORT.md) - Complete technical audit
- [Google Sheets Structure](./docs/reports/SHEETS_STRUCTURE_REPORT.md) - Data schema details
- [System Architecture](./SYSTEM_MAP.md) - Architecture diagram

### User Guides
- [Sales Playbook](./docs/guides/Sales_Playbook.md) - Sales team workflows
- [AI Hub Guide](./docs/guides/AI_HUB_USER_GUIDE.md) - Using AI assistants
- [Commission Setup](./docs/guides/COMMISSION_AND_TERRITORY_SETUP.md) - Commission configuration

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Routing**: Wouter
- **State Management**: TanStack Query v5
- **UI Components**: Shadcn/ui + Radix UI
- **Styling**: Tailwind CSS with dark mode
- **Icons**: Lucide React

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express
- **Language**: TypeScript
- **Data Source**: Google Sheets API
- **AI**: OpenAI GPT-4
- **Email**: Nodemailer (SMTP, Brevo, Resend)
- **PDF**: pdf-lib
- **QR Codes**: qrcode library

### Infrastructure
- **Hosting**: Replit (recommended)
- **Caching**: In-memory with TTL
- **Offline**: Service Worker + PWA
- **Compression**: gzip/deflate
- **Monitoring**: Health checks + logging

---

## 🔐 Security & Best Practices

### ⚠️ Important Security Notes

1. **Never store secrets in Google Sheets**
   - Use Replit Secrets or environment variables
   - API keys, passwords, and tokens must be externalized

2. **Authentication** (Coming in Phase 3)
   - Currently no auth layer
   - All API endpoints are public
   - Suitable for internal use only

3. **Rate Limiting** (Planned)
   - Add rate limiting for production deployment
   - Protect against API abuse

4. **CORS Configuration** (Planned)
   - Configure allowed origins
   - Prevent cross-origin attacks

---

## 📊 System Status

### Phase 1: Core Platform ✅ Complete (Nov 2025)
- ✅ 74+ API endpoints
- ✅ 53 Google Sheets worksheets
- ✅ 17 frontend pages
- ✅ Pricing automation
- ✅ Stand distribution
- ✅ Sales workflow
- ✅ Shipping center
- ✅ 4 AI assistants
- ✅ Dark mode + EN/AR bilingual
- ✅ Bootstrap wizard

### Phase 2: AI Crew Expansion 🔵 In Progress
- 🔄 Growth Engine (Priority: High)
- 🔄 Outreach Automation (Priority: High)
- 🔄 Marketing Studio (Priority: Medium)
- 🔄 Helpdesk & Support (Priority: Medium)
- 🔄 Finance & Legal Tools (Priority: Low)

### Phase 3: Production Hardening 🔜 Planned
- ⏳ Authentication & Authorization
- ⏳ Rate limiting
- ⏳ CORS configuration
- ⏳ Bundle optimization
- ⏳ Performance monitoring

---

## 🤝 Contributing

This is a private project for MH Trading. For questions or support, contact the development team.

---

## 📄 License

Proprietary - All rights reserved © 2025 MH Trading

---

## 🆘 Support & Resources

- **Setup Issues**: See [SETUP_GUIDE.md](./docs/guides/SETUP_GUIDE.md)
- **API Documentation**: See [API_SURFACE.md](./API_SURFACE.md)
- **System Architecture**: See [SYSTEM_MAP.md](./SYSTEM_MAP.md)
- **Project Cleanup**: See [PROJECT_CLEANUP_REPORT.md](./PROJECT_CLEANUP_REPORT.md)

---

<div dir="rtl">

## النسخة العربية

# نظام التداول MH — إصدار HAIROTICMEN

## نظرة عامة

**نظام التداول MH** هو منصة عمليات تجارية احترافية من الدرجة الإنتاجية لتوزيع منتجات العناية بالشعر والحلاقة للشركات (B2B). مبني بتقنيات ويب حديثة، ويوفر إدارة شاملة لـ:

- 💰 **محرك التسعير** - تسعير تلقائي مع الامتثال لقانون PAngV الألماني
- 📦 **إدارة المخزون والأكشاك** - مواقع مُتتبعة بـ GPS مع رموز QR
- 📊 **سير عمل المبيعات** - عرض أسعار ← طلب ← فاتورة مع إنشاء PDF
- 🚚 **الخدمات اللوجستية والشحن** - تكامل DHL مع تقدير التكاليف
- 🤖 **مركز الذكاء الاصطناعي** - مساعدون مدعومون بـ GPT-4
- 📈 **النمو وإدارة علاقات العملاء** - جمع العملاء المحتملين وإدارة المناطق
- 📧 **أتمتة التواصل** - حملات بريد إلكتروني مع تتبع
- 🎯 **استوديو التسويق** - أدوات تحسين محركات البحث والإعلانات ووسائل التواصل الاجتماعي

## المميزات الرئيسية

- ✅ **89 منتج** (84 نشط، 5 غير نشط)
- ✅ **مصدر واحد للحقيقة** - تكامل مع جداول Google
- ✅ **تحديثات فورية** - TanStack Query مع التخزين المؤقت
- ✅ **ثنائي اللغة** - العربية/الإنجليزية مع دعم RTL
- ✅ **الوضع الداكن** - دعم كامل للسمات
- ✅ **جاهز للعمل دون اتصال** - PWA مع Service Worker
- ✅ **مدعوم بالذكاء الاصطناعي** - 4 مساعدين متخصصين GPT-4
- ✅ **جاهز للإنتاج** - اختبار ومراقبة شاملة

## البدء السريع

### المتطلبات الأساسية

- تثبيت Node.js 20+
- وصول إلى Google Sheets API
- مفتاح OpenAI API (لميزات الذكاء الاصطناعي)
- حساب Replit (موصى به)

### التثبيت

1. **استنساخ المستودع**
   ```bash
   git clone <your-repo-url>
   cd mh-trading-os
   ```

2. **تثبيت التبعيات**
   ```bash
   npm install
   ```

3. **تكوين متغيرات البيئة**
   - أنشئ ملف `.env` أو استخدم Replit Secrets
   - الأسرار المطلوبة:
     ```
     GOOGLE_CLIENT_ID=معرف_عميل_جوجل_الخاص_بك
     GOOGLE_CLIENT_SECRET=سر_عميل_جوجل_الخاص_بك
     GOOGLE_REDIRECT_URI=رابط_إعادة_التوجيه_الخاص_بك
     OPENAI_API_KEY=مفتاح_openai_الخاص_بك
     ```

4. **تشغيل التطبيق**
   ```bash
   npm run dev
   ```

5. **الوصول إلى التطبيق**
   - افتح `http://localhost:5000` في متصفحك
   - انتقل إلى `/admin` لتشغيل معالج التمهيد

## الدعم والموارد

- **مشاكل الإعداد**: انظر [SETUP_GUIDE.md](./docs/guides/SETUP_GUIDE.md)
- **وثائق API**: انظر [API_SURFACE.md](./API_SURFACE.md)
- **بنية النظام**: انظر [SYSTEM_MAP.md](./SYSTEM_MAP.md)
- **تقرير التنظيف**: انظر [PROJECT_CLEANUP_REPORT.md](./PROJECT_CLEANUP_REPORT.md)

---

## الترخيص

خاص - جميع الحقوق محفوظة © 2025 MH Trading

</div>

---

**Last Updated**: November 14, 2025  
**Version**: 1.0.0  
**Status**: Production Ready (Phase 1 Complete)
