# 📘 دليل التشغيل اليومي V2.2 — لكل الأدوار

**الغرض**: دليل سريع ومختصر لكل دور في الفريق  
**الإصدار**: V2.2.0  
**التاريخ**: نوفمبر 2025

---

## 👨‍💻 للفريق التقني

### المهام اليومية (Daily)

#### 1. مراقبة النظام (صباحًا)
```bash
# تشغيل تحليل التغطية
tsx server/scripts/analyze-all-products-v22.ts

# التحقق من الصحة العامة
curl http://localhost:5000/api/pricing/health
```

**المؤشرات المطلوبة**:
- ✅ Guardrail Coverage: OwnStore ≥95%, Amazon ≥90%
- ✅ System Health: All green
- ✅ API Response Time: <500ms

#### 2. معالجة التنبيهات
```
إذا ظهر BUNDLE_RECOMMENDED لـSKU جديد:
  1. افتح analyze-all-products-v22.ts
  2. تحقق من bundle recommendation
  3. أنشئ البندل (EAN + Box + TierKey)
  4. ارفعه للقنوات المناسبة
```

#### 3. مراقبة الأخطاء (مساءً)
- تحقق من logs للأخطاء
- راجع failed API calls
- تأكد من Google Sheets sync

### المهام الأسبوعية (Weekly)

#### الأحد: تحديث الإعدادات
```bash
# مراجعة config
cat server/config/hairoticmen-pricing.json

# إذا لزم تحديث:
# 1. عدّل الملف
# 2. اختبر بـ test-v2-uat.ts
# 3. Tag في git: v2.2.X
# 4. Deploy
```

#### الأربعاء: تحليل الأداء
- راجع KPIs Dashboard
- حلل Bundle Performance
- تحقق من Coverage Trends

### الصيانة الشهرية (Monthly)

```bash
# 1. تحديث Shipping Surcharges
# في hairoticmen-pricing.json:
"boxCosts": {
  "Small_B2C": [تحديث حسب DHL],
  "Medium_B2C": [تحديث حسب DHL],
  ...
}

# 2. تحديث FBA Fees (إذا تغيرت)
"fbaFeeTiers": {
  "Std_Parcel_S": [Amazon's new fee],
  ...
}

# 3. Tag الإصدار الجديد
git tag v2.2.X-monthly-update
git push --tags
```

### نقاط الاتصال التقنية

| المشكلة | الحل السريع | التصعيد |
|---------|-------------|---------|
| Coverage < 90% | أعد تشغيل التحليل، تحقق من config | CTO بعد 2 ساعة |
| API Timeout | تحقق من Google Sheets quota | فوري إذا > 5 دقائق |
| Bundle Error | راجع bundling.ts logs | Dev Lead |

---

## 💰 للفريق المحاسبي

### المهام اليومية (Daily)

#### 1. مراجعة الفواتير الصادرة
```
لكل فاتورة، تحقق من:
  ✅ Role Discount صحيح (حسب الجدول)
  ✅ Quantity Discount مطبق (12/24/48/100+)
  ✅ Order Discount صحيح (€1000/3000/6000)
  ✅ VAT: 19% (B2C) أو 0% RC (B2B intra-EU مع VAT-ID)
  ✅ Shipping محسوب بشكل صحيح
```

#### 2. تتبع العمولات خارج الفاتورة
```
Sales Rep: 5% من صافي المبيعات (بعد الخصم -25%)
Stand Program: 5% Performance على الطلبات المؤهلة

📊 سجّل في جدول منفصل:
- التاريخ
- الشريك
- المبلغ الأساسي
- العمولة المستحقة
- حالة الدفع
```

#### 3. MAP Compliance Check
```
يوميًا، راجع 5-10 منتجات عشوائيًا:
  ✅ السعر المعروض ≥ 95% من UVP_Inc_.99
  ✅ لا توجد عروض غير مصرح بها
  ✅ الشركاء يلتزمون بالسياسة
```

### المهام الأسبوعية (Weekly)

#### تسوية الحسابات
```
1. مطابقة الإيرادات:
   - OwnStore Revenue
   - Amazon FBM Revenue
   - Amazon FBA Revenue (بعد خصم Fees)
   
2. حساب التكاليف الفعلية:
   - Payment Fees (Stripe/PayPal)
   - Shipping Costs
   - Returns/Refunds
   - FBA Fees
   
3. Gross Margin Analysis:
   - لكل خط إنتاج
   - لكل قناة
   - Compare مع Target (38%)
```

#### تقرير الأداء المالي
```yaml
أسبوعيًا، جهّز:
  - Total Revenue (breakdown by channel)
  - Total COGS
  - Gross Margin %
  - Payment Fees %
  - Returns %
  - Net Margin (Post-Channel)
  
أرسله إلى: [CFO, Operations Manager]
```

### Reverse Charge (B2B intra-EU)

```
عند استلام طلب B2B من EU:

1. تحقق من VAT-ID (VIES validation)
   ✅ صالح: طبّق 0% VAT
   ❌ غير صالح: طبّق 19% VAT

2. في الفاتورة:
   "Reverse Charge: Tax liability transfers to recipient"
   "Steuerschuldnerschaft des Leistungsempfängers (Art. 196 MwStSystRL)"

3. Intrastat Declaration (إذا > €800K/year):
   سجّل الشحنات الصادرة شهريًا
```

### Bundle Accounting

```
البندلات تُعامَل كـSKU منفصل:

COGS البندل = (COGS المفرد × العدد) + Box Cost
UVP البندل = [من نظام التسعير]
Grundpreis = UVP / إجمالي الحجم

⚠️ LUCID/EPR:
  وزن التغليف البندل ≠ (وزن المفرد × العدد)
  أضف وزن العلبة الخارجية
```

---

## 📦 للفريق التشغيلي

### المهام اليومية (Daily)

#### 1. معالجة الطلبات (Order Fulfillment)

**OwnStore Orders**:
```
1. استلام الطلب → تحقق من المخزون
2. تجهيز الطرد:
   - مفرد: Box حسب الحجم (Small/Medium/Large)
   - بندل: Box أكبر + علبة بندل داخلية
3. طباعة الفاتورة + ملصق الشحن
4. تحديث حالة الطلب
5. Handover إلى DHL
```

**Amazon FBM Orders**:
```
1. استلام Order notification من Amazon
2. نفس عملية OwnStore
3. رفع Tracking Number إلى Amazon خلال 24 ساعة
4. مراقبة Delivery Confirmation
```

**Amazon FBA Orders**:
```
✅ تلقائي - Amazon يتولى كل شيء
مهمتك:
  - مراقبة Inventory Levels
  - إرسال Replenishment عند Low Stock Alert
  - تتبع FBA Fees
```

#### 2. إدارة المخزون

```bash
# صباحًا (9:00 AM)
تحقق من Stock Levels:
  ✅ OwnStore: Min 7 days supply
  ✅ FBA: Min 30 days supply (90 days optimal)
  ✅ Low Stock Alert: طلب تصنيع/شراء

# مساءً (5:00 PM)
تحديث Google Sheets:
  - Inventory_Count
  - FBA_Inventory
  - Orders_Fulfilled_Today
```

#### 3. معالجة المرتجعات (Returns)

```
1. استلام Return Request:
   - تحقق من شروط الإرجاع (14-30 يوم)
   - وافق أو ارفض (مع سبب واضح)

2. عند استلام المرتجع:
   - فحص الحالة (Resellable / Damaged)
   - Resellable: أعده للمخزون
   - Damaged: سجّل كـWrite-off

3. Refund Processing:
   - كامل (إذا خلال 14 يوم)
   - جزئي (إذا damaged by customer)
   - سجّل في Returns_Log
```

### المهام الأسبوعية (Weekly)

#### الأحد: Inventory Planning
```
راجع Sales Forecast للأسبوع القادم:
  1. تحقق من Stock Levels لـTop 20 SKU
  2. خطط FBA Shipments (lead time 7-10 days)
  3. ضع Production Orders (lead time 30-45 days)
  4. نسق مع Supplier للبندلات الجديدة
```

#### الأربعاء: Performance Review
```
KPIs للمراقبة:
  ✅ Order Fulfillment Time (Target: <24h)
  ✅ Shipping Accuracy (Target: 99%+)
  ✅ Returns % (Target: <2%)
  ✅ Customer Satisfaction (Target: 4.5+ stars)
  ✅ FBA IPI Score (Target: >500)
```

### Bundling Operations

#### إنشاء بندل جديد
```
1. استلام Bundle Recommendation من التقني

2. Procurement:
   - طلب Pack GTIN من GS1
   - طلب علب/كراتين بندل (مقاس مخصص)
   - طبع Labels مع Grundpreis

3. Assembly:
   - جهّز [N] وحدات + علبة
   - امسح Pack GTIN
   - تحديث Inventory

4. FBA Prep (إذا لزم):
   - Box Size: حسب Amazon requirements
   - Weight: سجّل الوزن الفعلي
   - Ship to FBA Warehouse
```

#### مثال عملي: Beard Oil Bundle 3×50ml
```
BOM:
  - 3× Beard Oil 50ml (SKU: BAR-BEARDOIL50-004)
  - 1× Bundle Box (150ml capacity)
  - 1× Bundle Label (Pack GTIN + Grundpreis)

Assembly:
  1. ضع 3 قطع داخل Bundle Box
  2. ألصق Label الخارجي
  3. امسح Pack GTIN
  4. وزن: ~250g
  5. Box: Medium (15×10×8cm)

Amazon Prep:
  - Tier: Std_Parcel_M
  - FBA Prep: Polybag + Suffocation Warning
  - Ship to FBA
```

---

## 🎯 QuoteBuilder — للفريق التجاري

### تسلسل الحساب (Order)
```
1. اختر Role → طبّق Role Discount
2. أدخل Quantity لكل SKU → طبّق Qty Discount
3. احسب Subtotal
4. طبّق Order Discount (€1000/3000/6000)
5. احسب VAT (19% أو 0% RC)
6. أضف Shipping
7. Total
```

### Caps (الحدود القصوى)

| Role | Discount بعد Caps | ملاحظات |
|------|------------------|---------|
| Partner | Max 40% | -25% base |
| Sales Rep | Max 40% | -25% + 5% off-invoice |
| Stand | Max 50% | -30% + 5% performance |
| Dealer Basic | Max 50% | -40% base |
| Dealer Plus | Max 60% | -50% base |
| Distributor | Max 70% | -60%, no qty discount |

### أمثلة عملية

#### مثال 1: Sales Rep (€500)
```
Subtotal: €500
Role Discount (-25%): -€125
After Role: €375
Qty Discount: €0 (below €1000)
Order Discount: €0 (below €1000)
Subtotal: €375
VAT (19%): €71.25
Total: €446.25

Off-Invoice Commission (5%):
€500 × 0.05 = €25 (تُدفع منفصلة)
```

#### مثال 2: Dealer Plus (€5000)
```
SKU A: 50× @ €10 = €500
  Role -50%: €250
  Qty -10% (50+): €225

SKU B: 30× @ €15 = €450
  Role -50%: €225
  Qty -6% (24+): €211.50

Subtotal: €436.50
Order Discount (€3000 tier, -3%): -€13.10
After Discounts: €423.40
VAT (19%): €80.45
Shipping: €25
Total: €528.85
```

---

## 🚨 سيناريوهات الطوارئ

### Coverage يهبط عن الحد
```
السبب المحتمل:
  - تغيير FBA Fees
  - ارتفاع تكاليف الشحن
  - تعديل في Config خاطئ

الحل:
  1. تحقق من hairoticmen-pricing.json
  2. أعد تشغيل analyze-all-products-v22.ts
  3. إذا استمرت المشكلة: ارفع الموضوع للتقني
  4. حل مؤقت: أوقف القناة المتأثرة
```

### Returns تتجاوز 3%
```
السبب المحتمل:
  - جودة المنتج
  - خطأ في الوصف
  - Shipping damage

الحل:
  1. حلل Return Reasons (لآخر 50 مرتجع)
  2. إذا كان SKU محدد: أوقفه مؤقتًا
  3. إذا كان بندل: راجع Packaging
  4. تواصل مع Supplier/QC
```

### MAP Violation من شريك
```
الإجراء:
  1. التقط Screenshot
  2. أرسل تحذير رسمي (Email)
  3. إذا تكرر: أوقف حسابه مؤقتًا
  4. في الاجتماع القادم: راجع السياسة
```

---

## 📞 أرقام الطوارئ

| الدور | الاسم | الهاتف | البريد |
|------|-------|--------|--------|
| تقني | [CTO] | [رقم] | [email] |
| تجاري | [Sales Dir] | [رقم] | [email] |
| محاسبي | [CFO] | [رقم] | [email] |
| تشغيلي | [Ops Mgr] | [رقم] | [email] |

---

**آخر تحديث**: نوفمبر 15، 2025  
**الإصدار**: V2.2.0  
**طباعة**: احتفظ بنسخة مطبوعة في المكتب
