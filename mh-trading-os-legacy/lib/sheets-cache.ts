import { sheetsService } from './sheets';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SheetsCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private pendingRequests: Map<string, Promise<any>> = new Map();

  private static LIVE_TTL = 60 * 1000; // 60 seconds for live/sensitive data
  private static STATIC_TTL = 5 * 60 * 1000; // 5 minutes for constants/settings

  private static LIVE_TABLES = [
    'Quotes',
    'QuoteLines',
    'Invoices',
    'InvoiceLines',
    'Stands',
    'Outreach_Sends',
    'Outreach_Clicks',
    'OS_Health',
    'OS_Logs',
    'Pricing_Suggestions_Draft',
    'Sales_Suggestions_Draft',
    'Outreach_Drafts',
  ];

  private static STATIC_TABLES = [
    'FinalPriceList',
    'Settings',
    'PartnerTiers',
    'Bundles',
    'Partners',
    'Subscriptions',
    'Loyalty_Config',
    'CommissionTiers',
  ];

  private getTTL(tableName: string): number {
    if (SheetsCache.LIVE_TABLES.includes(tableName)) {
      return SheetsCache.LIVE_TTL;
    }
    if (SheetsCache.STATIC_TABLES.includes(tableName)) {
      return SheetsCache.STATIC_TTL;
    }
    return SheetsCache.LIVE_TTL;
  }

  private getCacheKey(tableName: string, includeMeta: boolean): string {
    return `${tableName}:${includeMeta ? 'meta' : 'nometa'}`;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  async readSheet<T = any>(
    tableName: string,
    includeMeta: boolean = true
  ): Promise<T[]> {
    const cacheKey = this.getCacheKey(tableName, includeMeta);
    const cached = this.cache.get(cacheKey);

    if (cached && !this.isExpired(cached)) {
      console.log(`[Cache HIT] ${tableName} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
      return cached.data;
    }

    if (this.pendingRequests.has(cacheKey)) {
      console.log(`[Cache PENDING] ${tableName} - waiting for in-flight request`);
      return this.pendingRequests.get(cacheKey)!;
    }

    console.log(`[Cache MISS] ${tableName} - fetching from Sheets`);
    const fetchPromise = sheetsService.readSheet<T>(tableName, includeMeta)
      .then((data) => {
        const ttl = this.getTTL(tableName);
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
          ttl,
        });
        this.pendingRequests.delete(cacheKey);
        console.log(`[Cache SET] ${tableName} (TTL: ${ttl / 1000}s)`);
        return data;
      })
      .catch((error) => {
        this.pendingRequests.delete(cacheKey);
        throw error;
      });

    this.pendingRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  invalidate(tableName?: string) {
    if (tableName) {
      const keys = Array.from(this.cache.keys()).filter((key) =>
        key.startsWith(`${tableName}:`)
      );
      keys.forEach((key) => this.cache.delete(key));
      console.log(`[Cache INVALIDATE] ${tableName} (${keys.length} entries cleared)`);
    } else {
      const size = this.cache.size;
      this.cache.clear();
      this.pendingRequests.clear();
      console.log(`[Cache CLEAR] All entries cleared (${size} entries)`);
    }
  }

  invalidatePattern(pattern: RegExp) {
    const keys = Array.from(this.cache.keys()).filter((key) =>
      pattern.test(key)
    );
    keys.forEach((key) => this.cache.delete(key));
    console.log(`[Cache INVALIDATE PATTERN] ${pattern} (${keys.length} entries cleared)`);
  }

  getStats() {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: Math.round((now - entry.timestamp) / 1000),
      ttl: entry.ttl / 1000,
      expired: this.isExpired(entry),
      size: JSON.stringify(entry.data).length,
    }));

    return {
      totalEntries: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      entries,
      totalSize: entries.reduce((sum, e) => sum + e.size, 0),
    };
  }
}

export const sheetsCache = new SheetsCache();

export const cachedSheetsService = {
  readSheet: <T = any>(tableName: string, includeMeta: boolean = true) =>
    sheetsCache.readSheet<T>(tableName, includeMeta),
  
  writeRows: (tableName: string, rows: any[]) => {
    sheetsCache.invalidate(tableName);
    return sheetsService.writeRows(tableName, rows);
  },

  updateRow: (
    tableName: string,
    keyField: string,
    keyValue: any,
    updates: Record<string, any>,
    options?: any
  ) => {
    sheetsCache.invalidate(tableName);
    return sheetsService.updateRow(tableName, keyField, keyValue, updates, options);
  },

  logToSheet: (level: string, source: string, message: string, requestId?: string) => {
    sheetsCache.invalidate('OS_Logs');
    return sheetsService.logToSheet(level, source, message, requestId);
  },

  invalidateCache: (tableName?: string) => {
    sheetsCache.invalidate(tableName);
  },

  getCacheStats: () => sheetsCache.getStats(),
};
