# ↩️ خطة التراجع V2.2 — Rollback Plan

**متى تستخدم**: إذا حدث فشل كبير بعد الإطلاق  
**المدة**: 2-4 ساعات  
**الهدف**: العودة لحالة مستقرة بأقل impact على العملاء

---

## 🚨 متى نحتاج Rollback؟

### Rollback فوري (خلال ساعة)
```yaml
Triggers:
  - System crash/downtime >30 min
  - Critical data corruption
  - Coverage drops to <70% on all channels
  - Mass customer complaints (>10 in 1 hour)
  - Security breach
  
Decision Maker: CTO + CEO
```

### Rollback مخطط (خلال 24 ساعة)
```yaml
Triggers:
  - Coverage <80% for 24 hours
  - Returns >10% for 48 hours
  - Gross Margin <25% for 3 days
  - Amazon account suspension
  - Legal/compliance issue
  
Decision Maker: CEO + CFO + CTO
```

### No Rollback (Fix Forward)
```yaml
Minor Issues:
  - Single SKU pricing error
  - <5 customer complaints
  - Coverage 85-95% (close to target)
  - Returns 3-5% (above target but manageable)
  
Action: Fix in-place, no rollback needed
```

---

## 📋 Pre-Rollback Checklist

### قبل أي Rollback (5 دقائق)

- [ ] **توثيق** الحالة الحالية
  ```bash
  # Snapshot current state
  tsx server/scripts/analyze-all-products-v22.ts > pre-rollback-state.txt
  git log -1 > current-commit.txt
  ```

- [ ] **نسخ احتياطي** من Google Sheets
  ```
  File > Download > Excel (.xlsx)
  Save as: Products_Backup_[DATE].xlsx
  ```

- [ ] **إخطار** الفريق
  ```
  Slack: @channel "🚨 ROLLBACK INITIATED"
  Email: All Managers
  Status Page: "Maintenance Mode"
  ```

- [ ] **موافقة** من صناع القرار
  ```
  CEO: ✅
  CFO: ✅
  CTO: ✅
  ```

---

## ↩️ خيارات الـRollback

### Option 1: Config Rollback (أسرع — 15 دقيقة)

**متى**: مشكلة في الإعدادات فقط (pricing config)

```bash
# 1. Restore previous config
git checkout v2.1.0-production -- server/config/hairoticmen-pricing.json

# 2. Restart workflow
# (automatic via Replit)

# 3. Verify
tsx server/scripts/test-v2-uat.ts

# 4. Commit
git add server/config/hairoticmen-pricing.json
git commit -m "Rollback: Restore v2.1 pricing config"
git tag v2.2.0-rollback
```

**Impact**: 
- ✅ Minimal downtime (5-10 min)
- ✅ Prices revert to V2.1
- ❌ Bundles may not work (if V2.1 doesn't support)

---

### Option 2: Code Rollback (متوسط — 30 دقيقة)

**متى**: مشكلة في الكود (pricing engine, bundling)

```bash
# 1. Checkout previous stable version
git checkout v2.1.0-production

# 2. Restore dependencies (if needed)
npm install

# 3. Restart workflow
npm run dev

# 4. Verify all systems
curl http://localhost:5000/api/pricing/health
tsx server/scripts/analyze-all-products-v22.ts

# 5. Tag the rollback
git tag v2.2.0-rollback-code
```

**Impact**:
- ⚠️ Moderate downtime (15-30 min)
- ✅ Full system restore
- ❌ Lose V2.2 features temporarily

---

### Option 3: Partial Rollback (مرن — 1 ساعة)

**متى**: مشكلة في قناة واحدة أو خط إنتاج واحد

#### 3A: Pause Amazon Only
```yaml
Action:
  1. Pause Amazon FBA listings
  2. Pause Amazon FBM listings
  3. Keep OwnStore running with V2.2

How:
  - Amazon Seller Central > Manage Inventory > Pause all
  - OR: Mark all Amazon SKUs as Out of Stock

Impact:
  - OwnStore continues normally
  - Amazon sales paused (30-40% revenue hit)
  - Lower risk, easier to resume
```

#### 3B: Disable Bundles Only
```yaml
Action:
  1. Pause all Bundle SKUs
  2. Keep single units only
  3. Continue with V2.2 pricing for singles

How:
  - Mark all "-BUNDLE-" SKUs as inactive
  - Update Google Sheets: Bundle_Active = FALSE

Impact:
  - Single units continue
  - Lose bundle adoption (20-25% potential)
  - FBA may fail guardrails (back to 0% coverage)
```

#### 3C: Revert Specific Product Line
```yaml
Example: Professional Line issues

Action:
  1. Restore Professional Line to V2.1 pricing
  2. Keep other lines on V2.2

How:
  # In hairoticmen-pricing.json
  "productLines": {
    "Professional": {
      "targetMargin": 0.45,  # V2.1 value
      "ad_pct_base": 0.12    # V2.1 value
    }
  }

Impact:
  - Professional Line higher prices (V2.1)
  - Other lines continue V2.2
  - Partial benefit from V2.2
```

---

### Option 4: Full Rollback (أكثر شمولاً — 2-4 ساعات)

**متى**: فشل كامل، multiple critical issues

```bash
# 1. Pause all sales channels
# - Set "Maintenance Mode" on website
# - Pause Amazon listings
# - Notify customers (email/banner)

# 2. Restore Google Sheets from backup
# - Upload Products_Backup_[DATE].xlsx
# - Verify all formulas intact

# 3. Rollback code to last known good
git checkout v2.1.0-production

# 4. Rollback database (if applicable)
# - Restore from snapshot
# - Verify data integrity

# 5. Full system test
npm run test
tsx server/scripts/test-v2-uat.ts

# 6. Gradual re-enable
# - OwnStore first (30 min)
# - Amazon FBM (24 hours later)
# - Amazon FBA (48 hours later)

# 7. Post-mortem
# - Document root cause
# - Plan V2.2.1 fixes
# - Re-test before re-launch
```

**Impact**:
- ❌ Significant downtime (2-4 hours)
- ❌ All V2.2 benefits lost
- ✅ Return to proven stable state
- ⚠️ Customer trust impact

---

## 🔍 Post-Rollback Actions

### Immediate (within 1 hour)

- [ ] **تحقق** من جميع الأنظمة
  ```bash
  # System health
  curl http://localhost:5000/api/pricing/health
  
  # Coverage check
  tsx server/scripts/analyze-all-products-v22.ts
  
  # Sample orders
  # (Manual test: Place 3 orders via different channels)
  ```

- [ ] **أخطر** العملاء
  ```
  Subject: System Maintenance Complete
  
  Body:
  "We've completed scheduled maintenance.
  All systems are now operational.
  Thank you for your patience."
  ```

- [ ] **تحديث** Status Page
  ```
  "✅ All systems operational"
  ```

---

### Short-term (within 24 hours)

- [ ] **Root Cause Analysis**
  ```markdown
  # Incident Report — V2.2 Rollback
  
  ## What Happened
  [Describe the issue]
  
  ## When
  - Started: [Date/Time]
  - Detected: [Date/Time]
  - Rollback initiated: [Date/Time]
  - Resolved: [Date/Time]
  
  ## Root Cause
  [Technical explanation]
  
  ## Impact
  - Customers affected: [Number]
  - Revenue lost: [€Amount]
  - Downtime: [Hours]
  
  ## Resolution
  [What we did]
  
  ## Prevention
  [How we'll prevent this in future]
  ```

- [ ] **تواصل** مع الشركاء
  ```
  Email to Partners:
  
  "We experienced a temporary issue with our
  pricing system. All prices have been restored
  to normal. Your orders are not affected."
  ```

- [ ] **مراجعة** Financial Impact
  ```yaml
  Calculate:
    - Lost revenue during downtime
    - Refunds issued (if any)
    - Customer compensation (if any)
    - Reputation impact (estimated)
  ```

---

### Medium-term (within 1 week)

- [ ] **V2.2 Post-Mortem** Meeting
  ```
  Attendees: CEO, CFO, CTO, Ops Manager, Dev Team
  
  Agenda:
  1. Timeline review
  2. Root cause deep-dive
  3. What went well
  4. What went wrong
  5. Action items for V2.2.1
  ```

- [ ] **خطة V2.2.1**
  ```markdown
  # V2.2.1 Plan
  
  ## Fixes
  1. [Issue 1]
  2. [Issue 2]
  3. [Issue 3]
  
  ## Testing
  - Extended UAT (2 weeks)
  - Staged rollout (OwnStore → FBM → FBA)
  - Canary deployment (10% traffic first)
  
  ## Launch Criteria
  - All smoke tests pass
  - Coverage >95%
  - No critical bugs
  - CEO/CFO approval
  ```

- [ ] **تحديث** Documentation
  ```
  Files to update:
  - rollback-plan-v22.md (this file)
  - launch-plan-v22.md
  - operations-guide-v22.md
  
  Add:
  - Lessons learned section
  - New safeguards
  - Better monitoring
  ```

---

## 📞 Communication Plan

### During Rollback

**Internal** (Slack #general):
```
"🚨 ROLLBACK IN PROGRESS

We're reverting to V2.1 due to [issue].
ETA: [Time]
Status updates every 30 min.

Current status: [Step X of Y]"
```

**External** (Website banner):
```
"⚠️ Maintenance in progress.
Orders may be delayed by 1-2 hours.
We apologize for any inconvenience."
```

**Customers with pending orders** (Email):
```
"Your order [#123] is safe and will be
processed shortly. We're performing
system maintenance. Thank you for
your patience."
```

---

### After Rollback

**Internal** (Email to all staff):
```
Subject: System Restored — V2.1 Active

Team,

We've successfully rolled back to V2.1
after [brief explanation].

Current status:
✅ All systems operational
✅ Orders processing normally
✅ No data loss

Next steps:
- Root cause analysis (tomorrow 10am)
- V2.2.1 planning (this week)

Questions? Contact CTO.
```

**External** (Blog post/Email):
```
Subject: Service Update

Dear Customers,

Earlier today we experienced a brief
service interruption. All systems are
now fully operational.

Your data and orders are safe. If you
experienced any issues, please contact
support@mh-trading.com.

We apologize for any inconvenience.

MH Trading Team
```

---

## ✅ Rollback Success Criteria

### Must Have (before declaring success)
- [ ] System uptime >99% for 24 hours
- [ ] All smoke tests pass
- [ ] Coverage ≥90% on all channels
- [ ] Zero critical errors in logs
- [ ] Sample orders complete successfully

### Nice to Have
- [ ] Customer satisfaction maintained (>4.0★)
- [ ] No increase in support tickets
- [ ] Partner confidence maintained
- [ ] Revenue impact <5%

---

## 🛡️ Prevention for Future

### Better Testing
```yaml
Before V2.2.1 launch:
  - Extended UAT: 2 weeks (vs 1 week)
  - Full catalog test: All 89 products
  - Load testing: 1000 concurrent users
  - Canary deployment: 10% → 50% → 100%
```

### Better Monitoring
```yaml
Add:
  - Real-time coverage alerts
  - Automated health checks (every 5 min)
  - Customer impact dashboard
  - Rollback button (one-click)
```

### Better Process
```yaml
Launch Checklist:
  - Staged rollout (OwnStore → FBM → FBA)
  - Weekly intervals (not daily)
  - Go/No-Go checkpoints after each stage
  - Rollback drill (practice before launch)
```

---

## 📋 Quick Rollback Checklist

```markdown
## Rollback Execution Checklist

- [ ] Document current state
- [ ] Backup Google Sheets
- [ ] Notify team (Slack + Email)
- [ ] Get approvals (CEO/CFO/CTO)
- [ ] Choose rollback option (1/2/3/4)
- [ ] Execute rollback steps
- [ ] Test all systems
- [ ] Notify customers
- [ ] Update status page
- [ ] Root cause analysis (within 24h)
- [ ] Post-mortem meeting (within 1 week)
- [ ] Plan V2.2.1 improvements

**Time to complete**: 2-4 hours
**Impact**: Minimal if <1 hour, Moderate if >4 hours
```

---

**آخر تحديث**: نوفمبر 15، 2025  
**الإصدار**: V2.2.0  
**Owner**: CTO

**ملاحظة**: نأمل ألا نحتاج لاستخدام هذه الخطة! 🤞
