interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class SimpleCache {
  private cache: Map<string, CacheEntry<any>>;
  private defaultTTL: number;
  private locks: Map<string, Promise<any>>;
  private invalidationCounter: Map<string, number>;

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.locks = new Map();
    this.invalidationCounter = new Map();
    this.defaultTTL = defaultTTL;
  }

  get<T>(key: string, ttl?: number): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const maxAge = ttl ?? this.defaultTTL;
    const age = Date.now() - entry.timestamp;
    
    if (age > maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.locks.clear();
  }

  invalidateByPattern(pattern: string): void {
    const allKeys = new Set<string>();
    
    Array.from(this.cache.keys()).forEach(key => {
      if (key.includes(pattern)) {
        allKeys.add(key);
      }
    });
    
    Array.from(this.locks.keys()).forEach(key => {
      if (key.includes(pattern)) {
        allKeys.add(key);
      }
    });
    
    Array.from(allKeys).forEach(key => {
      const currentCounter = this.invalidationCounter.get(key) || 0;
      this.invalidationCounter.set(key, currentCounter + 1);
      if (this.cache.has(key)) {
        this.cache.delete(key);
      }
      if (this.locks.has(key)) {
        this.locks.delete(key);
      }
    });
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key, ttl);
    if (cached !== null) {
      return cached;
    }

    const existingLock = this.locks.get(key);
    if (existingLock) {
      return existingLock as Promise<T>;
    }

    const counterAtStart = this.invalidationCounter.get(key) || 0;

    const promise = factory().then(
      (data) => {
        const counterNow = this.invalidationCounter.get(key) || 0;
        if (counterNow === counterAtStart) {
          this.set(key, data);
        }
        this.locks.delete(key);
        return data;
      },
      (error) => {
        this.locks.delete(key);
        throw error;
      }
    );

    this.locks.set(key, promise);
    return promise;
  }
}

export const aiResponseCache = new SimpleCache(10 * 60 * 1000);

export const sheetsReadCache = new SimpleCache(5 * 60 * 1000);

export function createCacheKey(...parts: (string | number | boolean)[]): string {
  return parts.map(p => String(p)).join(':');
}
