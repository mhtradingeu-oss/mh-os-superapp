/**
 * Global Request Queue for Google Sheets API
 * Provides intelligent rate limiting with adaptive throttling
 */

interface QueueItem {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  priority: number;
}

interface QueueMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitHits: number;
  averageWaitTime: number;
}

export class RequestQueue {
  private queue: QueueItem[] = [];
  private processing = false;
  private requestsThisMinute = 0;
  private lastMinuteReset = Date.now();
  private metrics: QueueMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    rateLimitHits: 0,
    averageWaitTime: 0,
  };

  constructor(
    private maxRequestsPerMinute = 50, // Conservative limit (Google allows 60)
    private maxConcurrent = 5,
    private minDelayMs = 100 // Minimum delay between requests
  ) {
    // Reset counter every minute
    setInterval(() => {
      this.requestsThisMinute = 0;
      this.lastMinuteReset = Date.now();
    }, 60000);
  }

  /**
   * Add request to queue with optional priority
   */
  async enqueue<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject, priority });
      // Sort by priority (higher priority first)
      this.queue.sort((a, b) => b.priority - a.priority);
      
      if (!this.processing) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      // Check if we've hit the rate limit
      if (this.requestsThisMinute >= this.maxRequestsPerMinute) {
        const timeToWait = 60000 - (Date.now() - this.lastMinuteReset);
        console.log(`[RequestQueue] Rate limit reached. Waiting ${timeToWait}ms...`);
        await this.sleep(timeToWait);
        this.requestsThisMinute = 0;
        this.lastMinuteReset = Date.now();
      }

      const item = this.queue.shift();
      if (!item) break;

      const startTime = Date.now();
      this.metrics.totalRequests++;

      try {
        const result = await item.fn();
        this.requestsThisMinute++;
        this.metrics.successfulRequests++;
        
        // Update average wait time
        const waitTime = Date.now() - startTime;
        this.metrics.averageWaitTime = 
          (this.metrics.averageWaitTime * (this.metrics.totalRequests - 1) + waitTime) / 
          this.metrics.totalRequests;

        item.resolve(result);

        // Adaptive delay based on queue size
        const delay = this.calculateAdaptiveDelay();
        await this.sleep(delay);

      } catch (error: any) {
        this.metrics.failedRequests++;
        
        // If rate limit error, increase delay
        if (error.code === 429 || error.status === 429) {
          this.metrics.rateLimitHits++;
          console.log('[RequestQueue] Rate limit hit, backing off...');
          await this.sleep(5000); // 5 second backoff
        }
        
        item.reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Calculate adaptive delay based on current load
   */
  private calculateAdaptiveDelay(): number {
    const queueLength = this.queue.length;
    const utilizationRate = this.requestsThisMinute / this.maxRequestsPerMinute;

    // If queue is building up or we're near the limit, slow down
    if (queueLength > 10 || utilizationRate > 0.8) {
      return 2000; // 2 seconds
    } else if (queueLength > 5 || utilizationRate > 0.6) {
      return 1000; // 1 second
    } else if (utilizationRate > 0.4) {
      return 500; // 500ms
    } else {
      return this.minDelayMs; // 100ms minimum
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current queue metrics
   */
  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      requestsThisMinute: this.requestsThisMinute,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      utilizationRate: (this.requestsThisMinute / this.maxRequestsPerMinute * 100).toFixed(1) + '%',
      processing: this.processing,
      metrics: this.metrics,
    };
  }

  /**
   * Clear the queue (useful for testing or emergencies)
   */
  clear() {
    this.queue = [];
    this.processing = false;
  }
}

// Global singleton instance
export const sheetsRequestQueue = new RequestQueue(
  50,  // 50 requests per minute (safe margin below 60)
  5,   // 5 concurrent requests max
  100  // 100ms minimum delay
);
