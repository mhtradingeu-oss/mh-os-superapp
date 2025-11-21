# ✅ قائمة تدقيق ما قبل الإطلاق — V2.2

**المدة**: 30-60 دقيقة  
**الهدف**: التأكد من أن كل شيء جاهز قبل GO  
**متى**: قبل Day 0 بـ24 ساعة

---

## 🔧 تقني (15 دقيقة)

### Config & Settings
- [ ] **تثبيت** `hairoticmen-pricing.json` v2.2
  ```bash
  cat server/config/hairoticmen-pricing.json | jq '.version'
  # يجب أن يعرض: "2.2.0"
  ```

- [ ] **تفعيل** `ad_pct_override` لكل قناة
  ```json
  "ad_pct_override": {
    "OwnStore": null,
    "Amazon_FBM": -2,
    "Amazon_FBA": -3
  }
  ```

- [ ] **التحقق** من Amazon Size Tiers
  ```bash
  # تأكد أن كل SKU/Bundle له TierKey صحيح
  tsx server/scripts/analyze-all-products-v22.ts | grep "TierKey"
  ```

### Analysis & Coverage
- [ ] **تشغيل** تحليل كامل للكاتالوج
  ```bash
  tsx server/scripts/analyze-all-products-v22.ts > coverage-report.txt
  ```

- [ ] **تحقق** من النتائج:
  - ✅ OwnStore Coverage ≥ 95%
  - ✅ Amazon FBM Coverage ≥ 90%
  - ✅ Amazon FBA Coverage ≥ 90%

### Code Protection
- [ ] **قفل** أعمدة الصيغ في Google Sheets
  - حماية: `UVP_Inc_99`, `COGS`, `FullCost`
  - Allow: فقط Service Account

- [ ] **Git Tag** للإصدار
  ```bash
  git tag v2.2.0-production
  git push --tags
  ```

---

## 📊 بيانات/امتثال (15 دقيقة)

### Bundle Data
- [ ] **توليد** EAN/GTIN للبندلات (Pack GTIN من GS1)
  - [ ] عدم إعادة استخدام EAN المفرد
  - [ ] تسجيل Pack GTINs في `Products` sheet

- [ ] **تحديث** Box_Size و Amazon_TierKey للبندلات
  ```
  مثال:
  - 2× 50ml → Medium Box, Std_Parcel_M
  - 3× 50ml → Medium Box, Std_Parcel_M
  - 6× 50ml → Large Box, Std_Parcel_L
  ```

- [ ] **حساب** Grundpreis للبندلات
  ```
  Grundpreis = UVP_Inc_99 / إجمالي الحجم (L أو kg)
  مثال: €26.99 / 0.15L = €179.93/L
  ```

### Compliance
- [ ] **LUCID/EPR**: تحديث وزن التغليف للبندلات
  - وزن البندل = (وزن المفرد × N) + وزن العلبة الخارجية

- [ ] **VAT Configuration**:
  - [ ] B2C: 19% (دائمًا)
  - [ ] B2B DE: 19%
  - [ ] B2B EU + VAT-ID: 0% RC (Reverse Charge)
  - [ ] اختبار VIES validation للـVAT-ID

---

## 💼 تجاري/قنوات (15 دقيقة)

### MAP Policy
- [ ] **توثيق** MAP Policy
  ```
  MAP = ≥95% من UVP_Inc_99
  
  مثال:
  UVP = €11.99
  MAP = €11.39 minimum
  ```

- [ ] **إرسال** MAP Policy للشركاء (Email + PDF)
  - [ ] Partner Agreement updated
  - [ ] Signed confirmation received

### Price Lists
- [ ] **تصدير** FinalPriceList لكل الأدوار
  ```
  Roles:
  - Partner: -25% (Cap 40%)
  - Sales Rep: -25% + 5% off-invoice (Cap 40%)
  - Stand: -30% + 5% performance off-invoice (Cap 50%)
  - Dealer Basic: -40% (Cap 50%)
  - Dealer Plus: -50% (Cap 60%)
  - Distributor: -60% (Cap 70%)
  ```

- [ ] **توزيع** على الفريق والشركاء

### Shipping Policy
- [ ] **تأكيد** سياسة الشحن B2C
  ```
  OwnStore:
  - <€49: €4.90
  - ≥€49: Free shipping
  
  Amazon:
  - FBM: حسب المسافة
  - FBA: Prime Free Shipping
  ```

### Channel Strategy
- [ ] **Amazon Publishing Order**:
  1. FBM أولاً (أسبوع واحد للاختبار)
  2. FBA ثانيًا (بعد تأكيد FBM)
  
- [ ] **SKU Strategy**:
  - [ ] Bundle على FBA (إذا المفرد لا يحقق guardrail)
  - [ ] مفرد على OwnStore/FBM

---

## ⚡ فحص سريع نهائي (5 دقيقة)

### System Health
```bash
# 1. Test API
curl http://localhost:5000/api/pricing/health

# 2. Test Google Sheets connection
curl http://localhost:5000/api/products | jq 'length'
# يجب أن يعرض: 89

# 3. Test analysis
tsx server/scripts/analyze-all-products-v22.ts | grep "Coverage"
# يجب أن يعرض 100%
```

### Critical Files
- [ ] `server/config/hairoticmen-pricing.json` ✅
- [ ] `server/lib/pricing-engine-v2.ts` ✅
- [ ] `server/lib/bundling.ts` ✅
- [ ] `docs/launch-plan-v22.md` ✅
- [ ] `docs/operations-guide-v22.md` ✅

---

## 📋 Checklist Summary

| Category | Items | Status |
|----------|-------|--------|
| **تقني** | 6 items | ⬜ |
| **بيانات/امتثال** | 8 items | ⬜ |
| **تجاري/قنوات** | 10 items | ⬜ |
| **فحص نهائي** | 5 items | ⬜ |

**الإجمالي**: 29 item

---

## ✅ معايير GO/NO-GO

### ✅ GO إذا:
- [x] جميع الـ29 items محققة
- [x] Coverage ≥ 95%/90%
- [x] UAT passed
- [x] Documentation complete
- [x] Team trained

### ❌ NO-GO إذا:
- [ ] Coverage < 90% على أي قناة
- [ ] UAT failed (>2 critical bugs)
- [ ] Missing Pack GTINs
- [ ] MAP Policy not signed
- [ ] Team not ready

---

## 📞 Sign-off (للموافقة)

```
أؤكد أن جميع البنود محققة:

التقني: __________________ التاريخ: __________

البيانات: __________________ التاريخ: __________

التجاري: __________________ التاريخ: __________

الموافقة النهائية (CEO/CTO): __________________ التاريخ: __________
```

---

**آخر تحديث**: نوفمبر 15، 2025  
**الإصدار**: V2.2.0  
**الحالة**: Ready for final check
