# 🔥 فحوص دخانية V2.2 — Smoke Tests

**المدة**: 15 دقيقة  
**متى**: بعد كل Deploy، قبل الإطلاق، وبعد أي تغيير في Config  
**الغرض**: التأكد من أن الميزات الأساسية تعمل

---

## A. حراسة القنوات (Guardrails) — 5 دقائق

### اختر 5 SKUs عينة
```
1. Premium Line: HAI-OILPRO100-001
2. Professional Line: BAR-BEARDOIL50-004
3. Basic Line: HAI-SHAMPOO250-010
4. Tools: TOO-COMB-020
5. Bundle (2×): BAR-BEARDOIL50-004-BUNDLE-2
```

### الاختبار
```bash
tsx server/scripts/analyze-all-products-v22.ts
```

### معايير النجاح ✅
لكل SKU:
```
✅ UVP_Inc_99 ≥ MinInc_Own_.99 (OwnStore)
✅ UVP_Inc_99 ≥ MinInc_FBM_.99 (Amazon FBM)
✅ Bundle UVP ≥ MinInc_FBA_.99 (Amazon FBA)
✅ لا توجد رسائل FAIL
```

### إذا فشل
```
1. تحقق من TierKey (قد يكون أكبر من اللازم)
2. جرّب price ladder أعلى
3. راجع Ad% (قد تكون مرتفعة جدًا)
4. تحقق من Box Cost
```

---

## B. خصومات الأدوار (Role Discounts) — 4 دقيقة

### SKU للاختبار
```
SKU: BAR-BEARDOIL50-004
Factory: €1.68
UVP_Inc: €8.39
```

### الكميات المختبرة
```
Quantities: {1, 6, 12, 24, 48}
```

### الأدوار المختبرة (كلهم)
```
1. Partner (-25%, Cap 40%)
2. Sales Rep (-25% + 5% off-invoice, Cap 40%)
3. Stand (-30% + 5% performance, Cap 50%)
4. Dealer Basic (-40%, Cap 50%)
5. Dealer Plus (-50%, Cap 60%)
6. Distributor (-60%, Cap 70%, no qty discount)
```

### معايير النجاح ✅

#### 1. Partner @ 1 unit
```
UVP Net: €7.05
Role -25%: €5.29
Qty -0%: €5.29
✅ Final: €5.29 (Cap 25% OK)
```

#### 2. Dealer Basic @ 24 units
```
UVP Net: €7.05
Role -40%: €4.23
Qty -6%: €3.98
✅ Final: €3.98 (Cap 46% OK, <50%)
```

#### 3. Dealer Plus @ 48 units
```
UVP Net: €7.05
Role -50%: €3.53
Qty -8%: €3.25
Cap 60%: €2.82
✅ Final: €2.82 (capped at 60%)
```

#### 4. Distributor @ 100 units
```
UVP Net: €7.05
Role -60%: €2.82
Qty -0%: €2.82 (no qty discount)
✅ Final: €2.82 (Cap 60% OK)
```

### تحقق من الترتيب
```
✅ Role Discount أولاً
✅ Qty Discount ثانيًا
✅ Cap يُطبّق بعدهم
✅ Order Discount أخيرًا (على Subtotal)
```

---

## C. الضرائب/الفواتير (VAT) — 3 دقيقة

### Test Case 1: B2C (Germany)
```yaml
Customer: B2C, Germany
SKU: BAR-BEARDOIL50-004 × 2
UVP_Inc: €8.39
Subtotal: €16.78
VAT (19%): €2.68
Shipping: €4.90
Total: €24.36

✅ VAT = 19%
✅ VAT Amount = €2.68
✅ Total correct
```

### Test Case 2: B2B Intra-EU (Reverse Charge)
```yaml
Customer: B2B, France
VAT-ID: FR12345678901 (validated via VIES)
SKU: BAR-BEARDOIL50-004 × 24
UVP_Net: €7.05
Qty Discount -6%: €6.63
Subtotal: €159.12
VAT (RC): €0.00
Shipping: €15.00
Total: €174.12

✅ VAT = 0% (Reverse Charge)
✅ Invoice note: "Reverse Charge applies"
✅ Total = Net + Shipping only
```

### Test Case 3: B2B Germany
```yaml
Customer: B2B, Germany (no VAT-ID or DE VAT-ID)
SKU: BAR-BEARDOIL50-004 × 12
UVP_Net: €7.05
Qty Discount -2%: €6.91
Subtotal: €82.92
VAT (19%): €15.75
Shipping: €9.90
Total: €108.57

✅ VAT = 19% (same country)
✅ Total correct
```

---

## D. Grundpreis (€/L or €/kg) — 3 دقيقة

### Test Case 1: Single Unit (Liquid)
```yaml
SKU: BAR-BEARDOIL50-004
Net_Content_mL: 50
UVP_Inc: €8.39
Grundpreis: €8.39 / 0.05L = €167.80/L

✅ Calculation correct
✅ Displayed on label/listing
```

### Test Case 2: Bundle 3×50ml
```yaml
SKU: BAR-BEARDOIL50-004-BUNDLE-3
Units: 3
Net_Content (each): 50ml
Total Volume: 150ml = 0.15L
UVP_Inc (bundle): €26.99
Grundpreis: €26.99 / 0.15L = €179.93/L

✅ Calculated on TOTAL volume
✅ NOT (€8.39 / 0.05L) × 3
```

### Test Case 3: Solid Product (by weight)
```yaml
SKU: BAR-SOAP100-015
Net_Content_g: 100
UVP_Inc: €4.99
Grundpreis: €4.99 / 0.1kg = €49.90/kg

✅ Calculation correct
✅ Unit = €/kg (not €/L)
```

---

## ⚡ Quick Smoke Test Script

### Option 1: Manual (15 min)
```bash
# 1. Guardrails
tsx server/scripts/analyze-all-products-v22.ts | grep -E "Coverage|FAIL"

# 2. Sample Quote (Partner, 12 units)
curl -X POST http://localhost:5000/api/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "role": "Partner",
    "items": [{"sku": "BAR-BEARDOIL50-004", "quantity": 12}]
  }'

# 3. VAT Test
# (Manual via UI or Postman)

# 4. Grundpreis
# (Check in Google Sheets or Product page)
```

### Option 2: Automated (1 min)
```bash
# Run all smoke tests
npm run test:smoke

# Or with tsx:
tsx server/scripts/smoke-tests-v22.ts
```

---

## 📊 Smoke Test Report Template

```markdown
# Smoke Test Results — V2.2

**Date**: [Date]
**Tester**: [Name]
**Environment**: [Production/Staging]

## A. Guardrails
- [ ] OwnStore: PASS/FAIL
- [ ] Amazon FBM: PASS/FAIL
- [ ] Amazon FBA: PASS/FAIL

## B. Role Discounts
- [ ] Partner: PASS/FAIL
- [ ] Sales Rep: PASS/FAIL
- [ ] Stand: PASS/FAIL
- [ ] Dealer Basic: PASS/FAIL
- [ ] Dealer Plus: PASS/FAIL
- [ ] Distributor: PASS/FAIL

## C. VAT
- [ ] B2C (19%): PASS/FAIL
- [ ] B2B EU RC (0%): PASS/FAIL
- [ ] B2B DE (19%): PASS/FAIL

## D. Grundpreis
- [ ] Single Unit: PASS/FAIL
- [ ] Bundle: PASS/FAIL

## Overall Result
✅ PASS — Ready for deployment
❌ FAIL — Fix issues and re-test

## Notes
[Any issues or observations]

**Sign-off**: __________________ Date: __________
```

---

## 🚨 إذا فشل Smoke Test

### فشل بسيط (1-2 items)
```
1. Log the issue
2. Fix immediately
3. Re-run smoke tests
4. Continue if PASS
```

### فشل متوسط (3-5 items)
```
1. Delay launch by 24-48h
2. Root cause analysis
3. Fix + comprehensive testing
4. Re-run full smoke tests
5. Get approval before launch
```

### فشل كبير (>5 items)
```
1. NO-GO decision
2. Full system review
3. Extended testing (1 week)
4. Consider rollback plan
5. Re-plan launch date
```

---

## ✅ Checklist

- [ ] A. Guardrails tested (5 SKUs)
- [ ] B. Role Discounts tested (6 roles × 5 quantities)
- [ ] C. VAT tested (3 scenarios)
- [ ] D. Grundpreis tested (3 cases)
- [ ] Report filled
- [ ] Sign-off obtained

**Total Time**: ~15 minutes  
**Frequency**: Before every deployment

---

**آخر تحديث**: نوفمبر 15، 2025  
**الإصدار**: V2.2.0
