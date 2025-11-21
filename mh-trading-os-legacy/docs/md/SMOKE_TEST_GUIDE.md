# Smoke Test Guide
**دليل اختبارات الدخان**

## Overview / نظرة عامة

Smoke tests verify that critical components of the system are functional without executing full integration tests. They ensure:

تتحقق اختبارات الدخان من أن المكونات الحيوية للنظام تعمل بشكل صحيح دون تنفيذ اختبارات التكامل الكاملة. تضمن:

- ✅ All critical files exist
- ✅ Configuration files are valid JSON
- ✅ Libraries can be imported without errors
- ✅ Duplicate files have been removed
- ✅ Core utilities work as expected

---

## Running Smoke Tests / تشغيل اختبارات الدخان

### Quick Run
```bash
npm test smoke-tests
```

### With Coverage
```bash
npm run test:coverage -- smoke-tests
```

### Watch Mode
```bash
npm run test:watch smoke-tests
```

---

## Test Categories / فئات الاختبار

### 1. Core Libraries
**Tests:** logger, retry utility, basic functionality

**What it checks:**
- Logger can be imported and creates loggers
- Retry utility exports all functions
- Retry logic handles quota errors
- Script logger provides complete/fail/step methods

### 2. Configuration Files
**Tests:** hairoticmen-pricing.json, product-slug-mapping-complete.json, shipping config

**What it checks:**
- Files exist and are readable
- JSON is valid
- Expected structure is present
- Product count is correct (89 products)

### 3. Critical Scripts Exist
**Tests:** Bootstrap scripts, utility scripts

**What it checks:**
- All 8 bootstrap scripts exist:
  - 01-create-spreadsheet-structure.ts
  - 02-seed-configuration-data.ts
  - 03-seed-product-data.ts
  - 04-setup-formulas.ts
  - 05-connect-to-app.ts
  - 06-seed-shipping-config.ts
  - 07-validate-and-repair-workbook.ts
  - 08-seed-all-fixtures.ts
  
- Key utility scripts exist:
  - pricing-master.ts
  - calculate-shipping-costs.ts
  - generate-all-qr-codes.ts
  - pull-sheets-to-config.ts

- Duplicate scripts have been removed:
  - 08-seed-all-fixtures-FIXED.ts (removed)
  - 08-seed-all-fixtures-OLD-BACKUP.ts (removed)
  - pull-sheets-to-config-via-api.ts (removed)
  - sync-sheets-to-config.ts (removed)

### 4. Library Files
**Tests:** Core libraries, duplicates removed

**What it checks:**
- Core libraries exist:
  - sheets.ts
  - logger.ts
  - retry.ts
  - pricing-engine-hairoticmen.ts
  - quote-service.ts
  - email.ts
  - cache.ts

- Duplicate libraries removed:
  - ensure-sheets-v2.ts (removed)

### 5. Environment & Configuration
**Tests:** .env.example, documentation files

**What it checks:**
- .env.example exists and contains critical variables
- All new documentation files exist:
  - README_DEV.md
  - REPO_AUDIT.md
  - LOGGER_MIGRATION_GUIDE.md
  - NPM_SCRIPTS.md
  - CONSOLIDATION_REPORT.md
  - eslint.config.js
  - .prettierrc

### 6. Integration Smoke Tests
**Tests:** Cross-module integration

**What it checks:**
- Retry + Logger integration works
- Error handling propagates correctly

---

## Test Results Interpretation / تفسير نتائج الاختبار

### ✅ All Tests Pass
```
PASS  server/__tests__/smoke-tests.test.ts
  Critical Scripts - Smoke Tests
    ✓ logger can be imported and creates loggers
    ✓ retry utility can be imported and has correct exports
    ✓ retry logic handles quota errors correctly
    ...
    
Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
```

**Action:** None required. System is healthy.

### ❌ Configuration File Missing
```
✗ hairoticmen-pricing.json is valid and contains products
  Expected: true
  Received: false
```

**Action:** 
1. Check if file exists: `ls -la server/config/hairoticmen-pricing.json`
2. If missing, restore from backup or regenerate

### ❌ Script File Missing
```
✗ bootstrap scripts exist
  Expected script not found: 01-create-spreadsheet-structure.ts
```

**Action:**
1. Verify file location: `ls server/scripts/build-sheet-from-scratch/`
2. Check git history: `git log --all -- *01-create*`
3. Restore from git if accidentally deleted

### ❌ Library Import Error
```
✗ logger can be imported and creates loggers
  Cannot find module '../lib/logger'
```

**Action:**
1. Check file exists: `ls server/lib/logger.ts`
2. Verify TypeScript compilation: `npm run typecheck`
3. Check for syntax errors in logger.ts

---

## Adding New Smoke Tests / إضافة اختبارات دخان جديدة

### Template
```typescript
describe('New Feature - Smoke Tests', () => {
  test('new feature files exist', async () => {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const featurePath = path.join(process.cwd(), 'path/to/feature.ts');
    const exists = await fs.access(featurePath).then(() => true).catch(() => false);
    
    expect(exists).toBe(true);
  });

  test('new feature can be imported', async () => {
    const feature = await import('../path/to/feature');
    
    expect(feature.myFunction).toBeDefined();
    expect(typeof feature.myFunction).toBe('function');
  });
});
```

---

## Best Practices / أفضل الممارسات

### 1. Keep Tests Fast
- Smoke tests should run in < 5 seconds
- Don't make network requests
- Don't write to disk (except in temp directories)

### 2. Test File Existence, Not Content Details
- ✅ Check file exists and is valid JSON
- ❌ Don't validate every field in config files

### 3. Test Imports, Not Full Execution
- ✅ Verify function exists and is callable
- ❌ Don't execute full scripts (use integration tests for that)

### 4. Group Related Tests
```typescript
describe('Category', () => {
  describe('Subcategory', () => {
    test('specific test', () => {
      // ...
    });
  });
});
```

---

## CI/CD Integration / تكامل CI/CD

### GitHub Actions Example
```yaml
name: Smoke Tests

on: [push, pull_request]

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm install
      
      - name: Run smoke tests
        run: npm test smoke-tests
```

---

## Troubleshooting / حل المشاكل

### Issue: Tests fail with "Cannot find module"
**Solution:**
```bash
# Rebuild TypeScript
npm run typecheck

# Clear Jest cache
npm test -- --clearCache

# Re-run tests
npm test smoke-tests
```

### Issue: Tests pass locally but fail in CI
**Solution:**
1. Check Node.js version matches
2. Verify all files committed to git
3. Check .gitignore isn't excluding test files

### Issue: Slow test execution
**Solution:**
1. Check for network calls (use `--verbose` flag)
2. Profile tests: `npm test -- --verbose smoke-tests`
3. Split into smaller test files if needed

---

## Maintenance / الصيانة

### When to Update Smoke Tests

- ✅ After adding new critical scripts
- ✅ After creating new configuration files
- ✅ After major refactoring
- ✅ After file consolidation
- ✅ When changing core library structure

### Test Maintenance Checklist

- [ ] Update test when adding new critical files
- [ ] Remove tests for deprecated files
- [ ] Keep test descriptions clear and bilingual
- [ ] Verify tests still pass after changes

---

## Coverage Goals / أهداف التغطية

Smoke tests should achieve:

- **File Existence:** 100% of critical files
- **Import Success:** 100% of core libraries
- **Config Validity:** 100% of configuration JSONs
- **Duplicate Removal:** 100% verification

---

**For more information, see:**
- `server/__tests__/smoke-tests.test.ts` - Test implementation
- `README_DEV.md` - Developer guide
- `NPM_SCRIPTS.md` - Test commands
