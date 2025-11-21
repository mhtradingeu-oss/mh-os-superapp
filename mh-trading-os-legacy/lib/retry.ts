/**
 * Enhanced Retry Utility with Google Sheets Quota Protection
 * أداة إعادة المحاولة المحسّنة مع حماية حصة Google Sheets
 * 
 * Features:
 * - Exponential backoff with configurable delays
 * - Google Sheets quota-specific error handling
 * - Rate limit detection and adaptive delays
 * - Detailed logging for debugging
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  retryableErrors?: string[];
  /** Enable quota-specific handling for Google Sheets API */
  quotaProtection?: boolean;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 5, // Increased from 3 to 5 for quota errors
  initialDelayMs: 1000,
  maxDelayMs: 60000, // Increased from 10s to 60s for quota errors
  backoffFactor: 2,
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', '429', 'RESOURCE_EXHAUSTED'],
  quotaProtection: true,
};

/**
 * Google Sheets quota-specific error patterns
 * أنماط أخطاء حصة Google Sheets المحددة
 */
const QUOTA_ERROR_PATTERNS = [
  'quota',
  'Quota exceeded',
  'RESOURCE_EXHAUSTED',
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'quotaExceeded',
  'Rate Limit Exceeded',
  '429',
];

/**
 * Check if error is a Google Sheets quota/rate limit error
 * التحقق مما إذا كان الخطأ خطأ حصة/حد معدل Google Sheets
 * 
 * Inspects multiple levels of Google API error structure:
 * - Top-level: error.message, error.code
 * - Nested: error.errors[*].reason, error.errors[*].domain
 * - Response: error.response.data.error.errors[*].reason
 * 
 * يفحص مستويات متعددة من بنية خطأ Google API
 */
function isQuotaError(error: any): boolean {
  const errorMessage = String(error?.message || '').toLowerCase();
  const errorCode = String(error?.code || '').toLowerCase();
  
  // Check top-level error properties
  const topLevelMatch = QUOTA_ERROR_PATTERNS.some(pattern => 
    errorMessage.includes(pattern.toLowerCase()) || 
    errorCode.includes(pattern.toLowerCase())
  );
  
  if (topLevelMatch) return true;
  
  // Check nested Google API error structure (error.errors[*])
  // Google API errors have structure: { errors: [{ reason: 'rateLimitExceeded', ... }] }
  if (error?.errors && Array.isArray(error.errors)) {
    for (const nestedError of error.errors) {
      const reason = String(nestedError?.reason || '').toLowerCase();
      const domain = String(nestedError?.domain || '').toLowerCase();
      
      const nestedMatch = QUOTA_ERROR_PATTERNS.some(pattern => 
        reason.includes(pattern.toLowerCase()) || 
        domain.includes(pattern.toLowerCase())
      );
      
      if (nestedMatch) return true;
    }
  }
  
  // Check axios-style response errors (error.response.data.error.errors[*])
  // Common in Google API client libraries
  const responseErrors = error?.response?.data?.error?.errors;
  if (responseErrors && Array.isArray(responseErrors)) {
    for (const responseError of responseErrors) {
      const reason = String(responseError?.reason || '').toLowerCase();
      const domain = String(responseError?.domain || '').toLowerCase();
      const message = String(responseError?.message || '').toLowerCase();
      
      const responseMatch = QUOTA_ERROR_PATTERNS.some(pattern => 
        reason.includes(pattern.toLowerCase()) || 
        domain.includes(pattern.toLowerCase()) ||
        message.includes(pattern.toLowerCase())
      );
      
      if (responseMatch) return true;
    }
  }
  
  // Check for response-level error message
  const responseMessage = String(error?.response?.data?.error?.message || '').toLowerCase();
  if (responseMessage && QUOTA_ERROR_PATTERNS.some(p => responseMessage.includes(p.toLowerCase()))) {
    return true;
  }
  
  return false;
}

/**
 * Calculate adaptive delay with jitter based on error type
 * حساب التأخير التكيفي مع الاهتزاز بناءً على نوع الخطأ
 */
function calculateQuotaDelay(attempt: number, baseDelay: number): number {
  // For quota errors, use aggressive backoff with randomized jitter
  // لأخطاء الحصة، استخدم التراجع العدواني مع اهتزاز عشوائي
  let delay: number;
  
  if (attempt === 1) {
    delay = 8000; // 8 seconds first retry
  } else if (attempt === 2) {
    delay = 15000; // 15 seconds second retry
  } else if (attempt === 3) {
    delay = 30000; // 30 seconds third retry
  } else {
    // Beyond 3 attempts, use exponential backoff with cap at 60s
    delay = Math.min(30000 * Math.pow(1.5, attempt - 3), 60000);
  }
  
  // Add randomized jitter (±20%) to avoid thundering herd
  // أضف اهتزاز عشوائي (±20٪) لتجنب الهجوم الجماعي
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
}

/**
 * Enhanced retry with Google Sheets quota protection
 * إعادة محاولة محسّنة مع حماية حصة Google Sheets
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error | null = null;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      const errorCode = String(error.code || '');
      const errorMessage = error.message || '';
      
      // Check if error is retryable
      const isRetryable = opts.retryableErrors.some(
        code => errorMessage.includes(code) || errorCode === code || errorCode.includes(code)
      );
      
      // Check for quota errors (always retryable if quota protection enabled)
      const isQuota = opts.quotaProtection && isQuotaError(error);
      
      if (!isRetryable && !isQuota) {
        // Not a retryable error, throw immediately
        throw error;
      }
      
      if (attempt === opts.maxAttempts) {
        // Max attempts reached
        if (isQuota) {
          throw new Error(
            `Google Sheets quota exceeded after ${opts.maxAttempts} attempts. ` +
            `Please wait 60 seconds and try again. ` +
            `Consider increasing WRITE_COOLDOWN_MS or reducing WRITE_BATCH_SIZE. ` +
            `Original error: ${errorMessage}`
          );
        }
        throw error;
      }
      
      // Calculate delay (adaptive for quota errors)
      let retryDelay = delay;
      if (isQuota) {
        retryDelay = calculateQuotaDelay(attempt, delay);
        console.warn(
          `\n⚠️  Google Sheets quota limit detected!\n` +
          `   Attempt ${attempt}/${opts.maxAttempts} - Waiting ${retryDelay}ms before retry...\n` +
          `   Error: ${errorMessage}\n` +
          `   Tip: Increase WRITE_COOLDOWN_MS or reduce WRITE_BATCH_SIZE in .env\n`
        );
      } else {
        console.warn(
          `[Retry] Attempt ${attempt}/${opts.maxAttempts} failed: ${errorMessage}. ` +
          `Retrying in ${retryDelay}ms...`
        );
      }

      await sleep(retryDelay);
      
      // Update delay for next iteration (only for non-quota errors)
      if (!isQuota) {
        delay = Math.min(delay * opts.backoffFactor, opts.maxDelayMs);
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Specialized retry for Google Sheets write operations
 * إعادة محاولة متخصصة لعمليات الكتابة في Google Sheets
 */
export async function retryGoogleSheetsWrite<T>(
  operation: () => Promise<T>,
  operationName: string = 'Google Sheets write'
): Promise<T> {
  return retryWithBackoff(operation, {
    maxAttempts: 5, // Increased for quota handling
    initialDelayMs: 3000,
    maxDelayMs: 60000, // Increased from 30s to 60s
    backoffFactor: 2,
    quotaProtection: true,
    retryableErrors: [
      ...defaultOptions.retryableErrors,
      'Unable to parse range',
      'ECONNRESET',
      'ETIMEDOUT',
    ],
  });
}

/**
 * Specialized retry for Google Sheets read operations
 * إعادة محاولة متخصصة لعمليات القراءة من Google Sheets
 */
export async function retryGoogleSheetsRead<T>(
  operation: () => Promise<T>,
  operationName: string = 'Google Sheets read'
): Promise<T> {
  return retryWithBackoff(operation, {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffFactor: 2,
    quotaProtection: true,
    retryableErrors: [
      ...defaultOptions.retryableErrors,
      'Unable to parse range',
      'ECONNRESET',
      'ETIMEDOUT',
    ],
  });
}

/**
 * Sleep utility
 * أداة النوم
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
