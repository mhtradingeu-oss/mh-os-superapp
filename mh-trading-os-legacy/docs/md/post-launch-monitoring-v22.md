# 📊 مراقبة بعد الإطلاق — V2.2

**المدة**: Day 0 → Day 30 (ثم شهريًا)  
**الغرض**: التأكد من نجاح الإطلاق وسرعة التدخل عند الحاجة

---

## 🎯 مؤشرات أساسية (KPIs)

### يوميًا (Day 0-7)

#### 1. Guardrail Coverage
```yaml
Target:
  - OwnStore: ≥95%
  - Amazon FBM: ≥90%
  - Amazon FBA: ≥90%

How to Check:
  tsx server/scripts/analyze-all-products-v22.ts | grep "Coverage"

Alert if:
  - Any channel < target for 2 consecutive days
```

#### 2. Gross Margin @ UVP
```yaml
Target: ≥38% (Post-Channel Margin)

Breakdown by Line:
  - Premium: ≥40%
  - Skin Care: ≥40%
  - Professional: ≥38%
  - Basic: ≥35%
  - Tools: ≥32%

How to Check:
  - Query Google Sheets: Pricing_Health
  - Column: GM_at_UVP_Pct

Alert if:
  - Overall < 35% for 3 days
  - Any line < target -5pp
```

#### 3. Returns %
```yaml
Target: ≤2%

How to Calculate:
  Returns% = (Returns / Orders) × 100%

Alert if:
  - >3% for 2 consecutive days
  - >5% any single day
  - Specific SKU >10%

Action:
  - Analyze Return Reasons
  - Check Packaging
  - Contact Supplier (if quality issue)
```

#### 4. Payment Blend (Actual)
```yaml
Target: 2.3% - 2.7%

Providers:
  - Stripe: ~2.9% + €0.30
  - PayPal: ~3.4% + €0.35

How to Calculate:
  Weighted_Fee = (Stripe_Vol × 2.9% + PayPal_Vol × 3.4%) / Total_Vol

Alert if:
  - >3% for 1 week
  
Action:
  - Update Payment_Pct in config
  - Encourage lower-fee payment methods
```

---

### أسبوعيًا (Week 1-4)

#### 5. ROAS / CPA (Ad Performance)
```yaml
ROAS (Return on Ad Spend):
  Target: ≥2.5
  Formula: Revenue from Ads / Ad Spend

CPA (Cost per Acquisition):
  Target: ≤€15
  Formula: Ad Spend / New Customers

By Channel:
  - OwnStore: ROAS ≥3.0
  - Amazon FBM: ROAS ≥2.5
  - Amazon FBA: ROAS ≥2.0

Action:
  - Adjust ad_pct_override in config
  - Example: If FBA ROAS > 3.0, reduce ad%
```

#### 6. Bundle Adoption
```yaml
Target: >15% (Week 1), >25% (Month 1)

Formula:
  Bundle_Revenue / Total_Revenue × 100%

By Product Line:
  - Professional: >30% (highest bundle fit)
  - Basic: >20%
  - Premium: >10%

Alert if:
  - Overall < 10% after Week 2

Action:
  - Promote bundles (email, homepage)
  - Add "Best Value" badge
  - Train sales team
```

#### 7. MAP Compliance
```yaml
Target: 100%

How to Monitor:
  - Manual spot checks (5-10 SKUs/week)
  - OR: Simple crawler script

Alert if:
  - Partner pricing <95% UVP
  - Repeated violations (2+ times)

Action:
  1. Screenshot evidence
  2. Email warning
  3. Escalate to Sales Manager
  4. Suspend account (if 3rd violation)
```

---

### شهريًا (Month 1-6)

#### 8. Amazon Performance Metrics

##### IPI Score (Inventory Performance Index)
```yaml
Target: >500 (Good), >600 (Excellent)

Components:
  - Excess Inventory
  - Sell-through Rate
  - Stranded Inventory
  - In-stock Rate

Alert if:
  - <450 for 2 months
  - <400 any month (critical)

Action:
  - Reduce slow-moving SKUs
  - Liquidate excess inventory
  - Fix stranded listings
```

##### FBA Fees (Actual vs Estimated)
```yaml
Variance Target: ±5%

How to Check:
  - Amazon Seller Central > Reports > Fees
  - Compare with pricing engine estimates

Alert if:
  - Variance >10% for any tier
  - Consistent overcharge

Action:
  - Update fbaFeeTiers in config
  - Contest incorrect charges
  - Adjust TierKey for SKUs
```

#### 9. Customer Satisfaction
```yaml
Target: ≥4.5★ (Amazon), ≥4.3★ (OwnStore)

By Channel:
  - Amazon: Review Rating
  - OwnStore: Post-purchase survey

Alert if:
  - <4.0★ any channel
  - <3.5★ specific SKU

Action:
  - Analyze negative reviews
  - Improve product/packaging/shipping
  - Contact dissatisfied customers
```

---

## 🔔 تنبيهات تلقائية (Alerts)

### إنذار فوري (Immediate Action)

#### 1. GuardrailFail
```yaml
Trigger: SKU drops below guardrail on any channel

Alert Method: Slack + Email

Recipient: CTO, Ops Manager

Message:
  "🚨 GUARDRAIL FAIL
  SKU: [SKU]
  Channel: [OwnStore/FBM/FBA]
  Current: [€X.XX]
  Required: [€Y.YY]
  Action: Increase UVP or create Bundle"

Auto-Action:
  - Pause SKU on failed channel (optional)
  - Log to OS_Health sheet
```

#### 2. Surge Fees (Shipping)
```yaml
Trigger: DHL announces Energy/LKW/Peak surcharge change

Alert Method: Email

Recipient: CFO, Ops Manager

Message:
  "💰 SHIPPING SURCHARGE UPDATE
  Type: [Energy/LKW/Peak]
  Old: [€X.XX]
  New: [€Y.YY]
  Impact: [+X%] on shipping costs
  Action: Update config > boxCosts"

Manual Action Required: Yes
```

#### 3. MAP Violation
```yaml
Trigger: Partner selling <95% UVP

Alert Method: Email to Partner + CC Sales Manager

Recipient: Partner, Sales Manager

Message:
  "⚠️ MAP POLICY VIOLATION
  Partner: [Name]
  SKU: [SKU]
  Your Price: [€X.XX]
  MAP: [€Y.YY] (95% of €Z.ZZ)
  
  This is Warning #[1/2/3]
  Please adjust within 48 hours."

Escalation:
  - Warning 1: Email
  - Warning 2: Account suspension (7 days)
  - Warning 3: Partnership termination
```

#### 4. System Errors
```yaml
Triggers:
  - API timeout >5 min
  - Google Sheets quota exceeded
  - Database connection failure
  - Critical script error

Alert Method: Slack + SMS

Recipient: CTO, Lead Dev

Auto-Action:
  - Restart workflow (if timeout)
  - Fallback to cache (if Sheets down)
  - Enable maintenance mode (if critical)
```

---

### إنذار أسبوعي (Weekly Review)

#### 5. Low Margin Alert
```yaml
Trigger: Gross Margin <35% for 1 week

Alert Method: Email report

Recipient: CFO, CEO

Content:
  - Affected SKUs
  - Margin breakdown
  - Recommendations

Action:
  - Review pricing
  - Negotiate better COGS
  - Consider discontinuing low-margin SKUs
```

#### 6. Ad Performance Alert
```yaml
Trigger: ROAS <2.0 for 1 week

Alert Method: Email

Recipient: Marketing Manager

Content:
  - Channel breakdown
  - CPA trends
  - Budget recommendations

Action:
  - Pause underperforming campaigns
  - Adjust targeting
  - Reduce ad% in config
```

---

## 📈 Dashboard & Reports

### Daily Dashboard (Morning Briefing)
```yaml
Components:
  1. Yesterday's Sales (by channel)
  2. Guardrail Coverage (3 channels)
  3. Returns % (overall + top 5 SKUs)
  4. Orders Fulfilled (vs target)
  5. Active Alerts (count)

Delivered to: Ops Manager, CEO
Format: Email at 9:00 AM
```

### Weekly Report (Friday EOD)
```yaml
Components:
  1. Week Summary (Revenue, Orders, AOV)
  2. KPIs Status (all 9 KPIs)
  3. Top 10 Best Sellers
  4. Top 5 Problem SKUs (returns/low margin)
  5. Bundle Performance
  6. Channel Mix (OwnStore vs Amazon)
  7. Next Week Recommendations

Delivered to: All Managers, CEO
Format: PDF + Email
```

### Monthly Report (1st of month)
```yaml
Components:
  1. Month-over-Month comparison
  2. All KPIs (trends)
  3. Financial summary (Revenue, COGS, Margin)
  4. Amazon Performance (IPI, FBA Fees, Ratings)
  5. Partner Performance (sales by partner)
  6. Product Line Analysis
  7. Strategic Recommendations

Delivered to: Board, CEO, CFO, COO
Format: Presentation + PDF
Meeting: Monthly Business Review
```

---

## 🛠️ Monitoring Tools

### Google Sheets Conditional Formatting

#### Guardrail Status
```
Sheet: Pricing_Health
Column: Guardrail_Status

Formula:
  =IF(UVP_Inc_99 < MAX(MinInc_Own, MinInc_FBM, MinInc_FBA), "FAIL", "OK")

Color:
  - FAIL: Red background
  - OK: Green background
```

#### UVP vs Floor
```
Formula:
  =IF(UVP_Net < Floor_B2C_Net, "RAISE_UVP", "OK")

Color:
  - RAISE_UVP: Orange background
  - OK: White background
```

#### Margin Status
```
Formula:
  =IF(GM_at_UVP_Pct < 0.35, "LOW", IF(GM_at_UVP_Pct < 0.38, "WARN", "OK"))

Color:
  - LOW: Red
  - WARN: Yellow
  - OK: Green
```

### Automated Scripts

#### Coverage Monitor (runs hourly)
```bash
#!/bin/bash
# File: scripts/monitor-coverage.sh

tsx server/scripts/analyze-all-products-v22.ts > /tmp/coverage.txt

OWN=$(grep "OwnStore" /tmp/coverage.txt | awk '{print $2}' | tr -d '%')
FBM=$(grep "FBM" /tmp/coverage.txt | awk '{print $2}' | tr -d '%')
FBA=$(grep "FBA" /tmp/coverage.txt | awk '{print $2}' | tr -d '%')

if (( $(echo "$OWN < 95" | bc -l) )); then
  echo "🚨 OwnStore Coverage: $OWN%" | mail -s "Coverage Alert" ops@mh-trading.com
fi

# Similar for FBM/FBA
```

---

## 📊 Success Metrics Timeline

### Week 1
| Metric | Target | Day 1 | Day 3 | Day 7 |
|--------|--------|-------|-------|-------|
| Coverage (Own) | ≥95% | - | - | - |
| Coverage (FBM) | ≥90% | - | - | - |
| Coverage (FBA) | ≥90% | - | - | - |
| Gross Margin | ≥38% | - | - | - |
| Returns % | ≤2% | - | - | - |
| Bundle Adoption | >10% | - | - | - |

### Month 1
| Metric | Target | Week 1 | Week 2 | Week 3 | Week 4 |
|--------|--------|--------|--------|--------|--------|
| Revenue Growth | +15% | - | - | - | - |
| Bundle Revenue % | >25% | - | - | - | - |
| Amazon Sales % | >35% | - | - | - | - |
| Customer Rating | ≥4.5★ | - | - | - | - |
| MAP Violations | 0 | - | - | - | - |

---

## 🚨 Escalation Matrix

| Issue | Severity | Response Time | Escalate To |
|-------|----------|---------------|-------------|
| Coverage <90% | High | 4 hours | CTO |
| Returns >5% | High | 24 hours | Ops Manager |
| System Down | Critical | Immediate | CTO + CEO |
| MAP Violation | Medium | 48 hours | Sales Manager |
| Margin <30% | High | 48 hours | CFO |
| ROAS <1.5 | Medium | 1 week | Marketing |

---

**آخر تحديث**: نوفمبر 15، 2025  
**الإصدار**: V2.2.0  
**المسؤول**: Operations Manager
