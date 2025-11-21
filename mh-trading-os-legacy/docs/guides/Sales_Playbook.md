# 📘 دليل المبيعات - Sales Playbook
## MH Trading OS - Production Sales Operations Manual

**النسخة**: 1.0  
**التاريخ**: 13 نوفمبر 2025  
**اللغة**: ثنائي اللغة (عربي/English)

---

## 🎯 الهدف - Objective

دليل شامل لفريق المبيعات يغطي كل مراحل دورة المبيعات من Lead إلى Invoice مع SLAs محددة ونصوص اتصال جاهزة.

**هدف الإيرادات الشهري**: €50,000  
**هدف الصفقات الشهرية**: 20 صفقة  
**متوسط حجم الصفقة**: €2,500

---

## 📊 مراحل دورة المبيعات - Sales Pipeline Stages

```
Lead → Qualification → Quote → Negotiation → Order → Fulfillment → Invoice → Payment
  1          2           3          4          5          6           7         8
```

### المراحل التفصيلية:

| المرحلة | الوصف | SLA | المسؤول | Status في النظام |
|---------|-------|-----|----------|------------------|
| **1. Lead** | عميل محتمل جديد | < 2 hours | Sales Rep | `New` |
| **2. Qualification** | تأهيل Lead و تحديد الاحتياج | < 24 hours | Sales Rep | `Qualified`, `Unqualified` |
| **3. Quote** | إصدار عرض سعر | < 48 hours | Sales Rep | `Draft`, `Sent` |
| **4. Negotiation** | مفاوضات السعر و الشروط | < 5 days | Sales Rep + Manager | `Negotiating` |
| **5. Order** | تحويل Quote إلى Order | Immediate | Sales Rep | `Confirmed` |
| **6. Fulfillment** | تحضير و شحن الطلب | < 3 days | Operations | `Processing`, `Shipped` |
| **7. Invoice** | إصدار فاتورة | Same day | Finance | `Invoiced` |
| **8. Payment** | استلام الدفع | Net 30 | Finance | `Paid`, `Overdue` |

---

## 🎯 SLA - Service Level Agreements

### Response Time SLAs

| نوع الطلب | SLA | العواقب عند التأخير |
|-----------|-----|---------------------|
| **استفسار Lead جديد** | < 2 hours | -5 نقاط من Lead Score |
| **طلب عرض سعر** | < 24 hours | تحذير من المدير |
| **متابعة Quote** | < 48 hours | إعادة توزيع Lead |
| **تحديث Order** | < 4 hours | تصعيد للمدير |
| **شكوى عميل** | < 1 hour | تصعيد فوري |

### Conversion SLAs

| KPI | الهدف | التتبع |
|-----|--------|--------|
| **Lead → Qualification** | 80% | يومي |
| **Qualified → Quote** | 60% | أسبوعي |
| **Quote → Order** | 40% | أسبوعي |
| **Order → Payment** | 95% | شهري |

---

## 📞 نصوص الاتصال - Call Scripts

### 1. المكالمة الأولى - First Contact Call

#### 🇬🇧 English Version

**Opening:**
```
Good [morning/afternoon], this is [Your Name] from MH Trading. 
Am I speaking with [Lead Name]?

[Wait for confirmation]

Great! I'm reaching out because you recently [showed interest in our products / 
were referred by / visited our website]. Do you have 2 minutes to chat?
```

**Discovery Questions:**
```
1. Tell me about your business - what type of salon/shop do you operate?
2. How many locations do you have?
3. What products are you currently using?
4. What challenges are you facing with your current supplier?
5. What's most important to you: pricing, delivery speed, or product quality?
```

**Next Steps:**
```
Based on what you've shared, I think we can definitely help you. 
Here's what I'd like to do:

1. I'll prepare a customized quote for you within 24 hours
2. I'll include special introductory pricing for first-time customers
3. Can we schedule a follow-up call on [Day/Time] to review it together?

Does that work for you?
```

**Closing:**
```
Perfect! I'll send you the quote by email to [confirm email address].
You'll also receive a WhatsApp message with my direct contact.
If you have any questions before our call, feel free to reach out anytime.

Thank you for your time, [Name]. Looking forward to working with you!
```

---

#### 🇸🇦 النسخة العربية

**الافتتاح:**
```
صباح الخير / مساء الخير، معك [اسمك] من شركة MH Trading.
هل أنا أتحدث مع الأستاذ/ة [اسم العميل]؟

[انتظر التأكيد]

ممتاز! أتصل بك لأنك مؤخراً [أبديت اهتماماً بمنتجاتنا / تم التوصية بك / 
زرت موقعنا الإلكتروني]. هل لديك دقيقتين للحديث؟
```

**أسئلة الاستكشاف:**
```
1. حدثني عن نشاطك التجاري - ما نوع الصالون/المحل الذي تديره؟
2. كم عدد الفروع لديك؟
3. ما هي المنتجات التي تستخدمها حالياً؟
4. ما هي التحديات التي تواجهها مع مورّدك الحالي؟
5. ما الأهم بالنسبة لك: السعر، سرعة التوصيل، أم جودة المنتج؟
```

**الخطوات التالية:**
```
بناءً على ما شاركته معي، أعتقد أننا نستطيع مساعدتك بالتأكيد.
إليك ما أود فعله:

1. سأُحضّر لك عرض سعر مخصص خلال 24 ساعة
2. سأُضمّن أسعار تعريفية خاصة للعملاء الجدد
3. هل يمكننا تحديد موعد لمكالمة متابعة يوم [اليوم/الوقت] لمراجعته معاً؟

هل هذا مناسب لك؟
```

**الإغلاق:**
```
ممتاز! سأرسل لك العرض بالبريد الإلكتروني على [تأكيد البريد].
ستستلم أيضاً رسالة واتساب برقمي المباشر.
إذا كان لديك أي أسئلة قبل مكالمتنا، لا تتردد في التواصل معي في أي وقت.

شكراً لوقتك يا أستاذ/ة [الاسم]. أتطلع للعمل معك!
```

---

### 2. متابعة Quote - Quote Follow-up Call

#### 🇬🇧 English

**Opening:**
```
Hi [Name], it's [Your Name] from MH Trading.
I'm calling to follow up on the quote I sent you [yesterday/on Monday].

Did you have a chance to review it?
```

**If YES - They reviewed it:**
```
Great! What are your thoughts?

[Listen carefully]

[If positive]:
Excellent! Would you like to move forward with this order today?

[If they have questions]:
Those are great questions. Let me address each one...

[If they need time]:
I understand. When would be a good time to reconnect? 
Also, is there anything I can clarify in the meantime?
```

**If NO - They haven't reviewed it:**
```
No problem! I know you're busy. Let me quickly highlight the key points:

1. We're offering [X% discount] for your first order
2. Total value: €[Amount]
3. Delivery within [X days]
4. Payment terms: [Net 30/etc]

Can I walk you through it now? It'll just take 3 minutes.
```

**Handling Objections:**

| الاعتراض | الرد |
|----------|------|
| "السعر مرتفع" | I understand pricing is important. Let me show you the value breakdown... |
| "محتاج أفكر" | Of course! What specific areas would you like to think about? |
| "عندي مورّد حالي" | I respect that. Many of our best clients came from other suppliers. What would make you consider switching? |
| "ما عندي ميزانية الحين" | I understand budget constraints. Can we explore a smaller initial order to get started? |

---

#### 🇸🇦 العربية

**الافتتاح:**
```
مرحباً [الاسم]، معك [اسمك] من MH Trading.
أتصل لمتابعة عرض السعر الذي أرسلته لك [البارحة/يوم الاثنين].

هل أتيحت لك الفرصة لمراجعته؟
```

**إذا نعم - راجعوه:**
```
ممتاز! ما رأيك فيه؟

[استمع بعناية]

[إذا إيجابي]:
رائع! هل تود المضي قدماً بهذا الطلب اليوم؟

[إذا لديهم أسئلة]:
هذه أسئلة ممتازة. دعني أجيب على كل منها...

[إذا يحتاجون وقت]:
أتفهم ذلك. متى سيكون وقت مناسب للتواصل مرة أخرى؟
وهل هناك أي شيء يمكنني توضيحه في الوقت الحالي؟
```

**إذا لا - ما راجعوه:**
```
لا مشكلة! أعلم أنك مشغول. دعني ألخص النقاط الرئيسية بسرعة:

1. نحن نقدم خصم [X%] على طلبك الأول
2. القيمة الإجمالية: €[المبلغ]
3. التوصيل خلال [X أيام]
4. شروط الدفع: [Net 30/إلخ]

هل يمكنني شرحه لك الآن؟ سيستغرق 3 دقائق فقط.
```

**معالجة الاعتراضات:**

| الاعتراض | الرد |
|----------|------|
| "The price is high" | أتفهم أهمية السعر. دعني أريك تفصيل القيمة... |
| "I need to think" | بالطبع! ما هي النقاط المحددة التي تود التفكير فيها؟ |
| "I have a current supplier" | أحترم ذلك. كثير من أفضل عملائنا جاؤوا من موردين آخرين. ما الذي سيجعلك تفكر في التبديل؟ |
| "No budget now" | أتفهم قيود الميزانية. هل يمكننا استكشاف طلب أولي أصغر للبدء؟ |

---

### 3. مكالمة إغلاق الصفقة - Closing Call

#### 🇬🇧 English

**Opening:**
```
Hi [Name], great news! I've finalized your quote and I'm ready to process your order.

Everything is set:
✓ [X items] at [Y% discount]
✓ Total: €[Amount]
✓ Delivery: [Date]
✓ Payment: [Terms]

Shall we confirm this today?
```

**Trial Close:**
```
Just to confirm - you're happy with:
- The product selection?
- The pricing?
- The delivery timeline?

Is there anything else you need before we proceed?
```

**Final Close:**
```
Perfect! I'll generate your order confirmation now.
You'll receive:

1. Order confirmation email within 30 minutes
2. Invoice within 24 hours
3. Tracking number once shipped

Your order number is: [ORDER-XXX]

Welcome to MH Trading! We're excited to work with you.
```

---

#### 🇸🇦 العربية

**الافتتاح:**
```
مرحباً [الاسم]، أخبار رائعة! انتهيت من عرض السعر وأنا مستعد لمعالجة طلبك.

كل شيء جاهز:
✓ [X منتجات] بخصم [Y%]
✓ الإجمالي: €[المبلغ]
✓ التوصيل: [التاريخ]
✓ الدفع: [الشروط]

هل نؤكد هذا اليوم؟
```

**إغلاق تجريبي:**
```
فقط للتأكيد - أنت راض عن:
- اختيار المنتجات؟
- الأسعار؟
- الجدول الزمني للتوصيل؟

هل هناك أي شيء آخر تحتاجه قبل أن نتابع؟
```

**الإغلاق النهائي:**
```
ممتاز! سأُنشئ تأكيد طلبك الآن.
ستستلم:

1. بريد تأكيد الطلب خلال 30 دقيقة
2. الفاتورة خلال 24 ساعة
3. رقم التتبع عند الشحن

رقم طلبك هو: [ORDER-XXX]

أهلاً بك في MH Trading! نحن متحمسون للعمل معك.
```

---

## 💰 هيكل العمولات - Commission Structure

### نسب العمولات حسب الـ Tier

| Tier Partner | نسبة العمولة | حساب العمولة | مثال (€1000 Net) |
|--------------|--------------|--------------|-------------------|
| **Stand** | 7% | Net × 0.07 | €70 |
| **Dealer Basic** | 5% | Net × 0.05 | €50 |
| **Dealer Plus** | 4% | Net × 0.04 | €40 |
| **Distributor** | 3% | Net × 0.03 | €30 |

### مضاعف الهدف الشهري - Monthly Target Multiplier

عند تحقيق الهدف الشهري (€50,000 أو 20 صفقة):
```
العمولة النهائية = العمولة الأساسية × 1.2
```

**مثال:**
- مبيعات الشهر: €55,000 ✅ (فوق الهدف)
- عمولة Stand: €70 → €84 (بعد المضاعف)
- عمولة Basic: €50 → €60 (بعد المضاعف)

### شروط استحقاق العمولة

| الحالة | العمولة |
|--------|----------|
| Quote sent | 0% - لا عمولة |
| Order confirmed | 50% - عند التأكيد |
| Payment received | 50% - عند الدفع |
| Cancelled/Refunded | -100% - استرداد كامل |

---

## 🗺️ إدارة المناطق - Territory Management

### قواعد توزيع الأقاليم

#### 1. Auto-Assignment Rules

```javascript
// Priority Order:
1. Existing Partner Owner (StandSites.Owner)
2. Territory Rules (Assignment_Rules)
3. Round-Robin (if no rule matches)
4. Manual Assignment (Admin override)
```

#### 2. No Double-Claim Policy

**القاعدة**: كل Lead/Stand/Partner له Owner واحد فقط

**التنفيذ:**
- ✅ نظام يمنع Re-assignment بدون approval
- ✅ Conflict detection عند محاولة claim lead
- ✅ Manager approval مطلوب للـ re-assignment

**مثال:**
```
Lead: LEAD-12345
Current Owner: Ahmed
Attempt by: Sara → ❌ BLOCKED
Reason: Already owned by Ahmed
Action Required: Manager approval
```

### Territory Assignment Logic

#### Based on StandSites:
```sql
IF Lead.City IN Territory.CitiesCSV
  AND Lead.Postal MATCHES Territory.PostalRangesJSON
THEN
  Assign to Territory.Owner
```

#### Based on CRM_Leads:
```sql
IF Lead.Score >= Assignment_Rule.MinScore
  AND Lead.Category IN Assignment_Rule.Categories
THEN
  Assign to Assignment_Rule.AssignTo
```

### Conflict Resolution

| السيناريو | الحل |
|-----------|------|
| Lead في 2 Territories | أعلى Priority Rule |
| Stand قديم بدون Owner | Round-Robin |
| Partner Switch Request | Manager Approval |
| Territory Overlap | تحديد Territory أولاً |

---

## 📋 Checklists

### ✅ New Lead Checklist

- [ ] تسجيل Lead في CRM خلال 30 دقيقة
- [ ] اتصال أولي خلال 2 ساعات
- [ ] تحديد Qualification Status
- [ ] إضافة Notes في النظام
- [ ] جدولة Follow-up
- [ ] إرسال Welcome Email

### ✅ Quote Creation Checklist

- [ ] التحقق من Partner Tier
- [ ] حساب Net Price حسب Tier
- [ ] إضافة Special Discount (إن وُجد)
- [ ] التحقق من MAP Guardrails
- [ ] مراجعة Commission Preview
- [ ] إرسال Quote بالبريد + WhatsApp
- [ ] جدولة Follow-up بعد 48 ساعة

### ✅ Order Confirmation Checklist

- [ ] التحقق من Stock Availability
- [ ] تأكيد Shipping Address
- [ ] تأكيد Payment Terms
- [ ] إنشاء Order في النظام
- [ ] إصدار Invoice PDF
- [ ] إرسال Order Confirmation
- [ ] تسليم لـ Operations للشحن
- [ ] تحديث Commission Status

### ✅ Payment Follow-up Checklist

- [ ] إرسال Invoice
- [ ] متابعة بعد 15 يوم (إذا Net 30)
- [ ] Courtesy reminder قبل 3 أيام من Due Date
- [ ] تصعيد إذا Overdue > 7 days
- [ ] تحديث Payment Status
- [ ] تحرير العمولة الكاملة

---

## 📊 KPIs و Metrics

### Individual Rep KPIs

| KPI | هدف يومي | هدف أسبوعي | هدف شهري |
|-----|----------|-------------|----------|
| **Calls Made** | 20 | 100 | 400 |
| **Emails Sent** | 30 | 150 | 600 |
| **Quotes Created** | 3 | 15 | 60 |
| **Orders Closed** | 1 | 5 | 20 |
| **Revenue** | €833 | €4,165 | €16,660 |

### Team KPIs

| KPI | Target | Tracking |
|-----|--------|----------|
| **Lead Response Time** | < 2 hours | Real-time |
| **Quote Conversion Rate** | 40% | Weekly |
| **Average Deal Size** | €2,500 | Monthly |
| **Win Rate** | 35% | Monthly |
| **Customer Retention** | 85% | Quarterly |

---

## 🚨 Escalation Matrix

| المشكلة | المستوى | الإجراء | SLA |
|---------|---------|---------|-----|
| Late payment (>7 days) | Level 1 | Rep follow-up | 24h |
| Late payment (>14 days) | Level 2 | Manager call | 48h |
| Late payment (>30 days) | Level 3 | Legal notice | 72h |
| Pricing conflict | Level 2 | Manager approval | 4h |
| Large discount request | Level 2 | Manager approval | 24h |
| Customer complaint | Level 1 | Rep resolution | 4h |
| Unresolved complaint | Level 3 | Director intervention | 24h |

---

## 🎓 Training & Onboarding

### Week 1: System & Product Training
- يوم 1-2: MH Trading OS التدريب
- يوم 3: Product knowledge
- يوم 4: Pricing tiers & commission
- يوم 5: Role-play exercises

### Week 2: Shadowing & Practice
- يوم 1-3: Shadow senior rep
- يوم 4-5: Supervised calls

### Week 3: Independent Work
- مع Daily check-ins
- Target: 5 quotes, 1 closed deal

---

## 📞 القنوات المفضلة - Preferred Channels

### Initial Contact Priority:
1. **Phone** - للعملاء B2B (أعلى conversion)
2. **WhatsApp** - للمتابعة السريعة
3. **Email** - للعروض الرسمية
4. **SMS** - للتذكيرات فقط

### Follow-up Cadence:
```
Day 0: Send Quote (Email + WhatsApp)
Day 2: Follow-up Call
Day 4: Follow-up Email
Day 7: Final Call
Day 10: Move to Nurture Campaign
```

---

## 🏆 Best Practices

### ✨ Golden Rules

1. **Always listen more than you talk** (70/30 rule)
2. **Understand before proposing** (Discovery first)
3. **Never bad-mouth competitors** (Stay professional)
4. **Under-promise, over-deliver** (Build trust)
5. **Follow up religiously** (Fortune is in the follow-up)
6. **Document everything** (If it's not in CRM, it didn't happen)
7. **Ask for referrals** (Best leads are warm leads)
8. **Celebrate wins together** (Team success)

### ⚠️ Common Mistakes to Avoid

- ❌ Forgetting to update CRM
- ❌ Skipping discovery questions
- ❌ Overselling features instead of benefits
- ❌ Ignoring MAP guardrails
- ❌ Missing follow-up commitments
- ❌ Not confirming next steps
- ❌ Talking over the customer

---

## 📚 Resources

### Internal Resources:
- **CRM System**: MH Trading OS
- **Price Lists**: `/pricing/subscriptions`
- **Product Catalog**: Google Drive
- **Commission Calculator**: `/sales/commission-calc`

### External Resources:
- Sales Training: [Link]
- Product Sheets: [Link]
- Competitor Analysis: [Link]

---

## 📞 Support Contacts

| الحاجة | جهة الاتصال | الطريقة |
|--------|-------------|---------|
| Technical Support | IT Team | Slack: #tech-support |
| Pricing Questions | Sales Manager | Direct call |
| Shipping Issues | Operations | ops@mhtrading.com |
| Payment Issues | Finance | finance@mhtrading.com |

---

## 🔄 Continuous Improvement

### Monthly Review:
- أداء فردي
- فرص التحسين
- قصص نجاح
- Lessons learned

### Quarterly Planning:
- أهداف جديدة
- Territory adjustments
- Commission structure review
- Training needs assessment

---

**آخر تحديث**: 13 نوفمبر 2025  
**الإصدار**: 1.0  
**المالك**: Sales Leadership Team  
**التالي Review**: 13 فبراير 2026

---

*"Success in sales comes from helping customers succeed."*

**— MH Trading OS**
