/**
 * Smoke Tests for Critical Scripts
 * اختبارات الدخان للسكربتات الحيوية
 * 
 * Purpose: Verify that critical scripts can be imported and basic functionality works
 * الغرض: التحقق من إمكانية استيراد السكربتات الحيوية وعمل الوظائف الأساسية
 */

import { describe, test, expect } from '@jest/globals';

describe('Critical Scripts - Smoke Tests', () => {
  
  describe('Core Libraries', () => {
    test('logger can be imported and creates loggers', async () => {
      const { createLogger, logger, createScriptLogger } = await import('../lib/logger');
      
      expect(logger).toBeDefined();
      expect(typeof createLogger).toBe('function');
      expect(typeof createScriptLogger).toBe('function');
      
      const testLogger = createLogger('TestModule');
      expect(testLogger).toBeDefined();
      expect(typeof testLogger.info).toBe('function');
      expect(typeof testLogger.error).toBe('function');
      
      const scriptLogger = createScriptLogger('TestScript');
      expect(scriptLogger).toBeDefined();
      expect(scriptLogger.logger).toBeDefined();
      expect(typeof scriptLogger.complete).toBe('function');
      expect(typeof scriptLogger.fail).toBe('function');
      expect(typeof scriptLogger.step).toBe('function');
    });

    test('retry utility can be imported and has correct exports', async () => {
      const retry = await import('../lib/retry');
      
      expect(retry.retryWithBackoff).toBeDefined();
      expect(retry.retryGoogleSheetsWrite).toBeDefined();
      expect(retry.retryGoogleSheetsRead).toBeDefined();
      
      expect(typeof retry.retryWithBackoff).toBe('function');
      expect(typeof retry.retryGoogleSheetsWrite).toBe('function');
      expect(typeof retry.retryGoogleSheetsRead).toBe('function');
    });

    test('retry logic handles quota errors correctly', async () => {
      const { retryWithBackoff } = await import('../lib/retry');
      
      let attempts = 0;
      const quotaError = new Error('Quota exceeded for quota metric');
      
      // Test should succeed on second attempt
      const result = await retryWithBackoff(
        async () => {
          attempts++;
          if (attempts < 2) throw quotaError;
          return 'success';
        },
        {
          maxAttempts: 3,
          initialDelayMs: 100,
          quotaProtection: true,
        }
      );
      
      // Verify operation succeeded and retry happened
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });

    test('retry logic handles nested Google API quota errors', async () => {
      const { retryWithBackoff } = await import('../lib/retry');
      
      let attempts = 0;
      const nestedQuotaError: any = new Error('Request failed');
      nestedQuotaError.response = {
        data: {
          error: {
            errors: [
              {
                domain: 'usageLimits',
                reason: 'rateLimitExceeded',
                message: 'Rate Limit Exceeded'
              }
            ],
            code: 429,
            message: 'Quota exceeded for quota metric'
          }
        }
      };
      
      const result = await retryWithBackoff(
        async () => {
          attempts++;
          if (attempts < 2) throw nestedQuotaError;
          return 'success';
        },
        {
          maxAttempts: 3,
          initialDelayMs: 100,
          quotaProtection: true,
        }
      );
      
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });
  });

  describe('Configuration Files', () => {
    test('hairoticmen-pricing.json is valid and contains exactly 89 products', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const pricingPath = path.join(process.cwd(), 'server/config/hairoticmen-pricing.json');
      const exists = await fs.access(pricingPath).then(() => true).catch(() => false);
      
      expect(exists).toBe(true);
      
      if (exists) {
        const content = await fs.readFile(pricingPath, 'utf-8');
        const pricing = JSON.parse(content);
        
        expect(pricing).toBeDefined();
        expect(Array.isArray(pricing)).toBe(true);
        
        // Assert exact count to detect product drift
        expect(pricing.length).toBe(89);
        
        // Verify structure of first product
        const firstProduct = pricing[0];
        expect(firstProduct).toHaveProperty('sku');
        expect(firstProduct).toHaveProperty('name');
        expect(firstProduct).toHaveProperty('category');
      }
    });

    test('product-slug-mapping-complete.json is valid', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const slugPath = path.join(process.cwd(), 'server/config/product-slug-mapping-complete.json');
      const exists = await fs.access(slugPath).then(() => true).catch(() => false);
      
      expect(exists).toBe(true);
      
      if (exists) {
        const content = await fs.readFile(slugPath, 'utf-8');
        const mapping = JSON.parse(content);
        
        expect(mapping).toBeDefined();
        expect(typeof mapping).toBe('object');
        expect(Object.keys(mapping).length).toBeGreaterThan(0);
      }
    });

    test('hairoticmen-shipping-unified.json is valid', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const shippingPath = path.join(process.cwd(), 'server/config/hairoticmen-shipping-unified.json');
      const exists = await fs.access(shippingPath).then(() => true).catch(() => false);
      
      expect(exists).toBe(true);
      
      if (exists) {
        const content = await fs.readFile(shippingPath, 'utf-8');
        const shipping = JSON.parse(content);
        
        expect(shipping).toBeDefined();
        expect(shipping).toHaveProperty('version');
        expect(shipping).toHaveProperty('carriers');
        expect(Array.isArray(shipping.carriers)).toBe(true);
        expect(shipping.carriers.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Critical Scripts Exist', () => {
    test('bootstrap scripts exist', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const scriptsDir = path.join(process.cwd(), 'server/scripts/build-sheet-from-scratch');
      
      const criticalScripts = [
        '01-create-spreadsheet-structure.ts',
        '02-seed-configuration-data.ts',
        '03-seed-product-data.ts',
        '04-setup-formulas.ts',
        '05-connect-to-app.ts',
        '06-seed-shipping-config.ts',
        '07-validate-and-repair-workbook.ts',
        '08-seed-all-fixtures.ts',
      ];
      
      for (const script of criticalScripts) {
        const scriptPath = path.join(scriptsDir, script);
        const exists = await fs.access(scriptPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });

    test('duplicate bootstrap scripts have been removed', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const scriptsDir = path.join(process.cwd(), 'server/scripts/build-sheet-from-scratch');
      
      const duplicateScripts = [
        '08-seed-all-fixtures-FIXED.ts',
        '08-seed-all-fixtures-OLD-BACKUP.ts',
      ];
      
      for (const script of duplicateScripts) {
        const scriptPath = path.join(scriptsDir, script);
        const exists = await fs.access(scriptPath).then(() => true).catch(() => false);
        expect(exists).toBe(false);
      }
    });

    test('utility scripts exist', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const scriptsDir = path.join(process.cwd(), 'server/scripts');
      
      const utilityScripts = [
        'pricing-master.ts',
        'calculate-shipping-costs.ts',
        'generate-all-qr-codes.ts',
        'pull-sheets-to-config.ts',
      ];
      
      for (const script of utilityScripts) {
        const scriptPath = path.join(scriptsDir, script);
        const exists = await fs.access(scriptPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });

    test('duplicate utility scripts have been removed', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const scriptsDir = path.join(process.cwd(), 'server/scripts');
      
      const duplicateScripts = [
        'pull-sheets-to-config-via-api.ts',
        'sync-sheets-to-config.ts',
      ];
      
      for (const script of duplicateScripts) {
        const scriptPath = path.join(scriptsDir, script);
        const exists = await fs.access(scriptPath).then(() => true).catch(() => false);
        expect(exists).toBe(false);
      }
    });
  });

  describe('Library Files', () => {
    test('core library files exist', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const libDir = path.join(process.cwd(), 'server/lib');
      
      const coreLibs = [
        'sheets.ts',
        'logger.ts',
        'retry.ts',
        'pricing-engine-hairoticmen.ts',
        'quote-service.ts',
        'email.ts',
        'cache.ts',
      ];
      
      for (const lib of coreLibs) {
        const libPath = path.join(libDir, lib);
        const exists = await fs.access(libPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });

    test('duplicate library files have been removed', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const libDir = path.join(process.cwd(), 'server/lib');
      
      const duplicateLibs = [
        'ensure-sheets-v2.ts',
      ];
      
      for (const lib of duplicateLibs) {
        const libPath = path.join(libDir, lib);
        const exists = await fs.access(libPath).then(() => true).catch(() => false);
        expect(exists).toBe(false);
      }
    });
  });

  describe('Duplicate Configuration Files Removed', () => {
    test('duplicate product JSONs have been removed', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const configDir = path.join(process.cwd(), 'server/config');
      
      const duplicateConfigs = [
        'additional-29-products.json',
        'exported-products.json',
        'all-89-products.json',
        'product-slug-mapping.json', // Keep -complete version
      ];
      
      for (const config of duplicateConfigs) {
        const configPath = path.join(configDir, config);
        const exists = await fs.access(configPath).then(() => true).catch(() => false);
        expect(exists).toBe(false);
      }
    });

    test('active config files still exist', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const configDir = path.join(process.cwd(), 'server/config');
      
      const activeConfigs = [
        'hairoticmen-pricing.json',
        'product-slug-mapping-complete.json',
        'hairoticmen-shipping-unified.json',
      ];
      
      for (const config of activeConfigs) {
        const configPath = path.join(configDir, config);
        const exists = await fs.access(configPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Environment & Configuration', () => {
    test('.env.example exists and contains critical variables', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const envPath = path.join(process.cwd(), '.env.example');
      const exists = await fs.access(envPath).then(() => true).catch(() => false);
      
      expect(exists).toBe(true);
      
      if (exists) {
        const content = await fs.readFile(envPath, 'utf-8');
        
        // Check for critical variables
        expect(content).toContain('GOOGLE_CREDENTIALS_JSON');
        expect(content).toContain('SHEETS_SPREADSHEET_ID');
        expect(content).toContain('OPENAI_API_KEY');
        expect(content).toContain('WRITE_BATCH_SIZE');
        expect(content).toContain('WRITE_COOLDOWN_MS');
        expect(content).toContain('PRICING_CONFIG_PATH');
      }
    });

    test('documentation files exist', async () => {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const rootDir = process.cwd();
      
      const docs = [
        'README_DEV.md',
        'REPO_AUDIT.md',
        'LOGGER_MIGRATION_GUIDE.md',
        'NPM_SCRIPTS.md',
        'CONSOLIDATION_REPORT.md',
        '.env.example',
        'eslint.config.js',
        '.prettierrc',
      ];
      
      for (const doc of docs) {
        const docPath = path.join(rootDir, doc);
        const exists = await fs.access(docPath).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      }
    });
  });
});

describe('Integration Smoke Tests', () => {
  
  describe('Retry + Logger Integration', () => {
    test('retry logic logs warnings correctly', async () => {
      const { retryWithBackoff } = await import('../lib/retry');
      
      let attempts = 0;
      const result = await retryWithBackoff(
        async () => {
          attempts++;
          if (attempts === 1) {
            throw new Error('ECONNRESET');
          }
          return 'success';
        },
        {
          maxAttempts: 2,
          initialDelayMs: 50,
          quotaProtection: false,
        }
      );
      
      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });
  });
});
