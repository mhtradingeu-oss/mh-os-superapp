# خارطة الطريق الذكية لنظام MH Trading OS المتكامل
## نظام ERP/CRM متقدم مع ذكاء اصطناعي متخصص

**التاريخ:** 16 نوفمبر 2025  
**الحالة:** 🏗️ تحت التطوير المتقدم  
**الهدف:** نظام B2B متكامل بالكامل مع AI متخصص لكل وظيفة

---

## 📊 الوضع الحالي / Current Status

### ✅ ما هو موجود بالفعل:

#### 1. الصفحات (26 صفحة):
```
✅ Dashboard                    - لوحة المعلومات الرئيسية
✅ Sales Desk                   - شاشة المبيعات
✅ Orders                       - إدارة الطلبات
✅ Partners                     - إدارة الشركاء
✅ Bundles & Gifts              - الحزم والهدايا
✅ Commissions & Loyalty        - العمولات والولاء
✅ Shipping Center              - مركز الشحن
✅ Stand Center                 - إدارة الأكشاك
✅ Pricing Studio               - استوديو التسعير
✅ Catalog                      - كتالوج المنتجات
✅ Reports                      - التقارير
✅ Marketing                    - التسويق
✅ Outreach                     - التواصل
✅ AI Hub                       - مركز الذكاء الاصطناعي
✅ AI Crew                      - فريق الذكاء الاصطناعي
✅ AI Marketing                 - التسويق بالذكاء الاصطناعي
✅ AI Guardrails                - حماية الذكاء الاصطناعي
✅ Admin                        - الإدارة
✅ Control Panel                - لوحة التحكم
✅ + 7 صفحات إضافية
```

#### 2. أنظمة الشركاء الحالية:
```typescript
✅ Stand          - عمولة 7%
✅ Basic          - عمولة 5% (Dealer Basic)
✅ Plus           - عمولة 4% (Dealer Plus)
✅ Distributor    - عمولة 3%
```

#### 3. وكلاء الذكاء الاصطناعي الحالية (5 وكلاء):
```typescript
✅ A-PRC-100 Pricing Agent        - تحليل التسعير
✅ A-OUT-101 Outreach Agent       - التواصل البريدي
✅ A-SOC-102 Social Media Agent   - وسائل التواصل
✅ A-SEO-103 SEO Agent            - تحسين محركات البحث
✅ A-CRM-104 CRM Agent            - إدارة العملاء
```

---

## 🎯 المطلوب إضافته / What Needs to Be Added

### Phase 1: أنظمة الشركاء المتقدمة (أسبوع 1)

#### 1.1 أنواع شركاء جديدة:
```typescript
interface PartnerPrograms {
  // ✅ موجود
  DealerBasic: {
    commission: 0.05,
    minOrder: 500,
    discountTier: 'Basic'
  },
  DealerPlus: {
    commission: 0.04,
    minOrder: 2000,
    discountTier: 'Plus'
  },
  Distributor: {
    commission: 0.03,
    minOrder: 10000,
    discountTier: 'Distributor'
  },
  
  // ⭐ جديد - يحتاج للإضافة
  Affiliate: {
    commission: 0.10,        // عمولة 10%
    cookieDays: 30,          // صلاحية الإحالة
    trackingCode: string,    // كود التتبع
    paymentThreshold: 100,   // حد الدفع
    paymentMethod: 'Bank' | 'PayPal'
  },
  
  SalesRepresentative: {
    commission: 0.08,        // عمولة 8%
    territory: string[],     // المناطق المخصصة
    monthlyTarget: number,   // الهدف الشهري
    bonusStructure: {        // نظام المكافآت
      target: number,
      bonusPercent: number
    }[]
  },
  
  StandPartner: {
    commission: 0.07,        // عمولة 7%
    standLocations: {        // مواقع الأكشاك
      id: string,
      gps: [number, number],
      type: 'Mall' | 'Street' | 'Event'
    }[],
    inventoryLimit: number,  // حد المخزون
    refillSchedule: 'Weekly' | 'BiWeekly' | 'Monthly'
  }
}
```

#### 1.2 نظام السياسات (Policies):
```typescript
interface StandPolicy {
  policyID: string;
  partnerID: string;
  
  // سياسات المخزون
  inventory: {
    maxValue: number;           // القيمة القصوى
    autoRefill: boolean;        // تعبئة تلقائية
    refillThreshold: number;    // حد التعبئة
    allowedCategories: string[]; // الفئات المسموحة
  };
  
  // سياسات المبيعات
  sales: {
    canDiscount: boolean;       // يمكن تطبيق خصومات
    maxDiscount: number;        // أقصى خصم
    requiresApproval: boolean;  // يتطلب موافقة
    approvalThreshold: number;  // حد الموافقة
  };
  
  // سياسات المرتجعات
  returns: {
    allowReturns: boolean;
    returnWindow: number;       // أيام
    restockingFee: number;      // رسوم الإرجاع
  };
  
  // سياسات الدفع
  payment: {
    terms: 'COD' | 'Net15' | 'Net30' | 'Net60';
    creditLimit: number;
    requireDeposit: boolean;
    depositPercent: number;
  };
}
```

---

### Phase 2: نظام الولاء والهدايا المتكامل (أسبوع 2)

#### 2.1 برنامج نقاط الولاء:
```typescript
interface LoyaltyProgram {
  programID: string;
  name: string;
  active: boolean;
  
  // قواعد كسب النقاط
  earningRules: {
    pointsPerEuro: number;           // نقاط لكل يورو
    minimumPurchase: number;         // الحد الأدنى
    bonusCategories: {               // فئات بونص
      category: string;
      multiplier: number;            // مضاعف النقاط
    }[];
    birthdayBonus: number;           // بونص عيد الميلاد
    referralBonus: number;           // بونص الإحالة
  };
  
  // قواعد صرف النقاط
  redemptionRules: {
    pointsToEuro: number;            // نقاط لكل يورو
    minimumRedemption: number;       // الحد الأدنى للصرف
    maximumPerOrder: number;         // الحد الأقصى بالطلب
    expiryDays: number;              // صلاحية النقاط
  };
  
  // المستويات (Tiers)
  tiers: {
    name: string;                    // 'Bronze', 'Silver', 'Gold', 'Platinum'
    minPoints: number;               // الحد الأدنى
    benefits: {
      pointsMultiplier: number;      // مضاعف النقاط
      freeShipping: boolean;         // شحن مجاني
      exclusiveOffers: boolean;      // عروض حصرية
      prioritySupport: boolean;      // دعم مميز
    };
  }[];
}
```

#### 2.2 نظام الهدايا الذكي:
```typescript
interface GiftSystem {
  // هدايا مجانية بالطلب
  freeGifts: {
    minOrderValue: number;           // الحد الأدنى
    giftSKU: string;                 // SKU الهدية
    quantity: number;                // الكمية
    active: boolean;
  }[];
  
  // هدايا بالنقاط
  pointsGifts: {
    giftSKU: string;
    pointsCost: number;              // تكلفة بالنقاط
    stockAvailable: number;          // المخزون المتاح
    imageURL: string;
    description: string;
  }[];
  
  // هدايا موسمية
  seasonalGifts: {
    season: 'Ramadan' | 'Eid' | 'Christmas' | 'NewYear';
    startDate: Date;
    endDate: Date;
    gifts: {
      minOrderValue: number;
      giftSKU: string;
    }[];
  }[];
}
```

#### 2.3 تكامل مع الطلبات:
```typescript
// في كل طلب، يجب تسجيل:
interface OrderWithLoyalty {
  orderID: string;
  customerID: string;
  
  // معلومات الولاء
  loyalty: {
    pointsEarned: number;            // النقاط المكتسبة
    pointsRedeemed: number;          // النقاط المستخدمة
    currentTier: string;             // المستوى الحالي
    tierUpgrade: boolean;            // هل ترقّى
    
    // الهدايا المضافة
    giftsAdded: {
      giftSKU: string;
      giftType: 'Free' | 'Points' | 'Seasonal';
      cost: number;                  // تكلفة الهدية
    }[];
    
    // الخصومات المطبقة
    loyaltyDiscounts: {
      type: 'TierDiscount' | 'PointsRedemption';
      amount: number;
    }[];
  };
  
  // سجل شامل
  auditLog: {
    timestamp: Date;
    action: string;
    userID: string;
    details: any;
  }[];
}
```

---

### Phase 3: نظام AI متخصص لكل وظيفة (أسابيع 3-4)

#### 3.1 وكلاء AI جدد (11 وكيل):

```typescript
const NEW_AI_AGENTS = [
  // Marketing & Growth
  {
    AgentID: 'A-ADS-105',
    Name: 'Advertising Agent',
    Department: 'Marketing',
    Tasks: [
      'analyze-ad-performance',
      'suggest-budget-allocation',
      'optimize-keywords',
      'generate-ad-copy'
    ],
    Guardrails: ['budget-limits', 'brand-compliance', 'roi-threshold'],
    RequiresApproval: true
  },
  
  {
    AgentID: 'A-ECM-106',
    Name: 'E-Commerce Agent',
    Department: 'Sales',
    Tasks: [
      'optimize-product-listings',
      'suggest-cross-sells',
      'analyze-cart-abandonment',
      'generate-product-descriptions'
    ],
    Guardrails: ['accuracy-check', 'pricing-compliance', 'inventory-sync'],
    RequiresApproval: false
  },
  
  // Operations
  {
    AgentID: 'A-LOG-107',
    Name: 'Logistics Agent',
    Department: 'Operations',
    Tasks: [
      'optimize-routes',
      'predict-delivery-delays',
      'suggest-carriers',
      'calculate-carbon-footprint'
    ],
    Guardrails: ['cost-limits', 'delivery-sla', 'carrier-reliability'],
    RequiresApproval: false
  },
  
  {
    AgentID: 'A-INV-108',
    Name: 'Inventory Agent',
    Department: 'Operations',
    Tasks: [
      'predict-stockouts',
      'suggest-reorder-quantities',
      'optimize-warehouse-layout',
      'detect-slow-movers'
    ],
    Guardrails: ['min-stock-levels', 'max-storage-cost', 'shelf-life'],
    RequiresApproval: true
  },
  
  // Finance
  {
    AgentID: 'A-FIN-109',
    Name: 'Finance Agent',
    Department: 'Finance',
    Tasks: [
      'forecast-revenue',
      'analyze-profit-margins',
      'detect-anomalies',
      'suggest-cost-savings'
    ],
    Guardrails: ['financial-regulations', 'audit-trail', 'accuracy-threshold'],
    RequiresApproval: true
  },
  
  {
    AgentID: 'A-COL-110',
    Name: 'Collections Agent',
    Department: 'Finance',
    Tasks: [
      'identify-overdue-accounts',
      'generate-payment-reminders',
      'suggest-payment-plans',
      'predict-default-risk'
    ],
    Guardrails: ['tone-compliance', 'legal-language', 'privacy-protection'],
    RequiresApproval: true
  },
  
  // Legal & Compliance
  {
    AgentID: 'A-LEG-111',
    Name: 'Legal Agent',
    Department: 'Legal',
    Tasks: [
      'review-contract-terms',
      'check-compliance',
      'flag-legal-risks',
      'suggest-policy-updates'
    ],
    Guardrails: ['legal-accuracy', 'jurisdiction-rules', 'approval-required'],
    RequiresApproval: true
  },
  
  // Executive
  {
    AgentID: 'A-EXE-112',
    Name: 'Executive Assistant',
    Department: 'Executive',
    Tasks: [
      'generate-board-reports',
      'summarize-weekly-metrics',
      'prepare-meeting-agendas',
      'track-strategic-goals'
    ],
    Guardrails: ['data-privacy', 'executive-approval', 'confidentiality'],
    RequiresApproval: true
  },
  
  // IT & DevOps
  {
    AgentID: 'A-DEV-113',
    Name: 'DevOps Agent',
    Department: 'IT',
    Tasks: [
      'monitor-system-health',
      'detect-errors',
      'suggest-optimizations',
      'automate-deployments'
    ],
    Guardrails: ['production-safety', 'rollback-ready', 'downtime-limits'],
    RequiresApproval: true
  },
  
  // Quality Assurance
  {
    AgentID: 'A-QA-114',
    Name: 'QA Agent',
    Department: 'Quality',
    Tasks: [
      'validate-data-quality',
      'check-sheet-integrity',
      'detect-duplicates',
      'suggest-data-cleanup'
    ],
    Guardrails: ['no-destructive-actions', 'backup-first', 'audit-log'],
    RequiresApproval: true
  },
  
  // Orchestration
  {
    AgentID: 'A-MOD-115',
    Name: 'Moderator Agent',
    Department: 'AI',
    Tasks: [
      'orchestrate-workflows',
      'resolve-conflicts',
      'prioritize-tasks',
      'coordinate-agents'
    ],
    Guardrails: ['no-circular-dependencies', 'max-chain-length', 'timeout-limits'],
    RequiresApproval: false
  }
];
```

#### 3.2 لوحة تحكم AI لكل موظف:

```typescript
interface EmployeeAIDashboard {
  employeeID: string;
  role: string;                      // 'Sales Manager', 'Operations Lead', etc.
  department: string;
  
  // الوكلاء المخصصون
  assignedAgents: {
    agentID: string;
    permissions: {
      canView: boolean;
      canExecute: boolean;
      canSchedule: boolean;
      canApprove: boolean;
    };
    customSettings: {
      temperature: number;
      maxTokens: number;
      customPrompts: string[];
    };
  }[];
  
  // مُحفزات التعلم (Learning Triggers)
  learningTriggers: {
    triggerID: string;
    name: string;
    condition: string;               // مثال: "When order value > 10000"
    aiAction: string;                // مثال: "Suggest upsell products"
    enabled: boolean;
  }[];
  
  // المساعدين المخصصون
  customAssistants: {
    assistantID: string;
    name: string;
    purpose: string;
    model: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
    systemPrompt: string;
    tools: string[];                 // الأدوات المتاحة
  }[];
  
  // سجل النشاط
  activityLog: {
    timestamp: Date;
    agentID: string;
    action: string;
    result: 'Success' | 'Failed' | 'Pending Review';
    details: any;
  }[];
}
```

---

### Phase 4: تحسينات الواجهة (أسبوع 5)

#### 4.1 مكونات UI متقدمة:

```typescript
// مكون معلومات مع أيقونة
<InfoTooltip 
  title="نظام نقاط الولاء"
  description="يمكنك تعديل قواعد كسب النقاط هنا. كل يورو = X نقطة."
  icon={<InfoIcon />}
/>

// بطاقة إحصائيات متقدمة
<StatCard
  title="إجمالي النقاط المكتسبة"
  value="45,230"
  change="+12.5%"
  trend="up"
  icon={<TrendingUpIcon />}
  onClick={() => navigate('/loyalty/details')}
/>

// جدول بيانات ذكي
<SmartTable
  data={partners}
  columns={columns}
  filters={['role', 'tier', 'status']}
  sortable={true}
  exportable={true}
  selectable={true}
  onBulkAction={(action, selected) => {}}
/>

// محرر نماذج متقدم
<AdvancedFormEditor
  schema={loyaltyProgramSchema}
  onSave={handleSave}
  validation={zodSchema}
  helpText={true}
  tooltips={true}
  preview={true}
/>
```

#### 4.2 لوحات تحكم تفاعلية:

```typescript
// لوحة الشركاء
<PartnerDashboard>
  <Overview />                       {/* نظرة عامة */}
  <PerformanceMetrics />             {/* مقاييس الأداء */}
  <CommissionBreakdown />            {/* توزيع العمولات */}
  <LoyaltyTierProgress />            {/* تقدم مستوى الولاء */}
  <RecentOrders />                   {/* الطلبات الأخيرة */}
  <AIRecommendations />              {/* توصيات AI */}
</PartnerDashboard>

// لوحة AI للموظف
<EmployeeAIDashboard>
  <AssignedAgents />                 {/* الوكلاء المخصصون */}
  <LearningTriggers />               {/* محفزات التعلم */}
  <CustomAssistants />               {/* المساعدين المخصصون */}
  <ActivityFeed />                   {/* موجز النشاط */}
  <PerformanceMetrics />             {/* مقاييس الأداء */}
</EmployeeAIDashboard>
```

---

## 🗺️ خارطة التنفيذ / Implementation Roadmap

### أسبوع 1: أنظمة الشركاء المتقدمة
```
اليوم 1-2:
  ✓ إضافة أنواع شركاء جديدة إلى Google Sheets
  ✓ تحديث schema.ts مع الأنواع الجديدة
  ✓ تحديث صفحة Partners

اليوم 3-4:
  ✓ نظام السياسات (Policies)
  ✓ واجهة تعديل السياسات
  ✓ ربط السياسات مع الطلبات

اليوم 5:
  ✓ اختبار شامل
  ✓ توثيق
```

### أسبوع 2: الولاء والهدايا
```
اليوم 1-2:
  ✓ نظام نقاط الولاء (Backend + Sheets)
  ✓ قواعد كسب وصرف النقاط
  
اليوم 3-4:
  ✓ نظام الهدايا الذكي
  ✓ واجهة إدارة الهدايا
  
اليوم 5:
  ✓ تكامل مع الطلبات
  ✓ اختبار وتوثيق
```

### أسبوع 3: وكلاء AI الجدد (الجزء 1)
```
اليوم 1-2:
  ✓ A-ADS-105: Advertising Agent
  ✓ A-ECM-106: E-Commerce Agent
  ✓ A-LOG-107: Logistics Agent
  
اليوم 3-4:
  ✓ A-INV-108: Inventory Agent
  ✓ A-FIN-109: Finance Agent
  
اليوم 5:
  ✓ اختبار الوكلاء
```

### أسبوع 4: وكلاء AI الجدد (الجزء 2)
```
اليوم 1-2:
  ✓ A-COL-110: Collections Agent
  ✓ A-LEG-111: Legal Agent
  ✓ A-EXE-112: Executive Assistant
  
اليوم 3-4:
  ✓ A-DEV-113: DevOps Agent
  ✓ A-QA-114: QA Agent
  ✓ A-MOD-115: Moderator Agent
  
اليوم 5:
  ✓ لوحة AI Crew محدثة
  ✓ اختبار شامل
```

### أسبوع 5: تحسينات الواجهة
```
اليوم 1-2:
  ✓ مكونات UI متقدمة
  ✓ InfoTooltips في كل مكان
  
اليوم 3-4:
  ✓ لوحات تحكم تفاعلية
  ✓ تحسين UX
  
اليوم 5:
  ✓ تلميع نهائي
  ✓ توثيق المستخدم
```

---

## 🎨 مبادئ التصميم / Design Principles

### 1. واجهة المستخدم:
- ✅ **نظيفة ومنظمة** - لا ازدحام
- ✅ **أيقونات معلومات** - في كل حقل مهم
- ✅ **عناوين واضحة** - ثنائية اللغة (عربي/إنجليزي)
- ✅ **ألوان دالة** - أخضر للنجاح، أحمر للخطر، أزرق للمعلومات
- ✅ **تغذية راجعة فورية** - Toast messages لكل عملية

### 2. تجربة المستخدم:
- ✅ **تحميل سريع** - Lazy loading + caching
- ✅ **بحث ذكي** - في كل جدول
- ✅ **فلترة متقدمة** - متعددة المستويات
- ✅ **تصدير سهل** - CSV/Excel/PDF
- ✅ **موبايل أولاً** - Responsive design

### 3. الأمان:
- ✅ **صلاحيات دقيقة** - Role-based access control
- ✅ **تدقيق شامل** - Audit log لكل عملية
- ✅ **تشفير البيانات** - للحقول الحساسة
- ✅ **نسخ احتياطي** - تلقائي يومي

---

## 📚 البنية التقنية / Technical Architecture

### Stack الحالي (ممتاز):
```
✅ Frontend: React 18 + Vite + TypeScript
✅ UI Library: shadcn/ui + Tailwind CSS
✅ State: TanStack Query
✅ Charts: Recharts
✅ Backend: Express + TypeScript
✅ Database: Google Sheets (Single Source of Truth)
✅ AI: OpenAI GPT-4
✅ Logger: Pino
```

### البنية المقترحة للإضافات:

```typescript
// 1. Loyalty System
server/lib/loyalty-engine.ts
server/lib/gifts-manager.ts
server/services/loyalty-service.ts

// 2. Advanced Partners
server/lib/partner-programs.ts
server/lib/policy-engine.ts
server/services/partner-service.ts

// 3. AI Agents
server/lib/ai-agents/
  ├── advertising-agent.ts
  ├── ecommerce-agent.ts
  ├── logistics-agent.ts
  ├── inventory-agent.ts
  ├── finance-agent.ts
  ├── collections-agent.ts
  ├── legal-agent.ts
  ├── executive-agent.ts
  ├── devops-agent.ts
  ├── qa-agent.ts
  └── moderator-agent.ts

// 4. Employee AI Dashboards
server/lib/employee-ai-manager.ts
client/src/components/ai-dashboard/
  ├── EmployeeAIPanel.tsx
  ├── AgentCard.tsx
  ├── LearningTriggers.tsx
  └── CustomAssistants.tsx
```

---

## 🚀 الخطوات التالية / Next Steps

### الآن (فوراً):
1. **مراجعة هذه الخطة** معك
2. **تحديد الأولويات** - ما هو الأهم؟
3. **البدء بـ Phase 1** - أنظمة الشركاء

### هذا الأسبوع:
1. إنشاء الـ Sheets الجديدة
2. تحديث الـ Types والـ Schemas
3. بناء الـ Backend APIs

### الأسبوع القادم:
1. واجهات المستخدم
2. التكامل الكامل
3. الاختبار

---

## 💡 اقتراحات ذكية / Smart Suggestions

### 1. نظام التعلم الذاتي:
كل وكيل AI يتعلم من قرارات المدير:
- عند موافقة المدير على توصية → يتعلم الوكيل
- عند رفض التوصية → يسجل السبب ويتحسن
- تقارير أسبوعية عن تحسن الأداء

### 2. Playground للموظفين:
كل موظف لديه "sandbox" لتجربة:
- إعدادات AI مختلفة
- محفزات تعلم جديدة
- مساعدين مخصصون
بدون التأثير على النظام الحقيقي

### 3. نظام التنبيهات الذكية:
```typescript
{
  type: 'LowStock',
  severity: 'High',
  message: 'منتج XYZ سينفد خلال 3 أيام',
  suggestedAction: 'طلب 100 وحدة من المورد',
  aiAgent: 'A-INV-108',
  autoExecute: false
}
```

### 4. لوحة القيادة التنفيذية:
للمدير العام:
- نظرة شاملة على كل الأنشطة
- أداء كل موظف وكل وكيل AI
- ROI لكل نشاط
- اتخاذ القرارات الاستراتيجية

---

**الحالة:** 🎯 جاهز للبدء  
**المدة المتوقعة:** 5 أسابيع  
**الأولوية:** عالية جداً

**السؤال الآن:** من أين تريد أن نبدأ؟ 🚀
