/**
 * Unified Logger Infrastructure using Pino
 * نظام السجلات الموحد باستخدام Pino
 * 
 * Features:
 * - Structured logging with levels (info, warn, error, debug)
 * - Process ID and timestamp tracking
 * - Pretty printing in development
 * - JSON output in production
 * - Context-aware logging with operation metadata
 */

import pino from 'pino';
import type { Logger as PinoLogger } from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';

// Create base logger with production/development configurations
const baseLogger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  
  // Pretty print in development, JSON in production
  transport: isDevelopment && !isTest ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
      singleLine: false,
      messageFormat: '{scope} - {msg}',
    }
  } : undefined,
  
  // Base configuration
  formatters: {
    level: (label) => ({ level: label }),
  },
  
  // Add timestamp and process info
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV || 'development',
  },
  
  // Redact sensitive fields
  redact: {
    paths: [
      'password',
      'token',
      'apiKey',
      'api_key',
      'secret',
      'credentials',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.api_key',
      '*.secret',
    ],
    censor: '[REDACTED]'
  },
  
  // Silent in test mode
  ...(isTest && { level: 'silent' })
});

/**
 * Create a child logger with specific scope/context
 * إنشاء مسجل فرعي مع نطاق/سياق محدد
 */
export function createLogger(scope: string, context?: Record<string, any>): PinoLogger {
  return baseLogger.child({
    scope,
    ...context,
  });
}

/**
 * Main application logger
 * المسجل الرئيسي للتطبيق
 */
export const logger = createLogger('app');

/**
 * Create operation-specific logger with tracking
 * إنشاء مسجل خاص بالعملية مع التتبع
 */
export function createOperationLogger(
  operation: string,
  operationId: string,
  metadata?: Record<string, any>
) {
  return createLogger(operation, {
    operationId,
    startTime: new Date().toISOString(),
    ...metadata,
  });
}

/**
 * Log Google Sheets API operation
 * تسجيل عملية Google Sheets API
 */
export function logSheetsOperation(
  operation: string,
  sheetName: string,
  result: 'success' | 'error' | 'retry',
  metadata?: Record<string, any>
) {
  const sheetsLogger = createLogger('GoogleSheets');
  
  const logData = {
    operation,
    sheetName,
    result,
    timestamp: new Date().toISOString(),
    ...metadata,
  };
  
  if (result === 'error') {
    sheetsLogger.error(logData, `Failed ${operation} on ${sheetName}`);
  } else if (result === 'retry') {
    sheetsLogger.warn(logData, `Retrying ${operation} on ${sheetName}`);
  } else {
    sheetsLogger.info(logData, `Completed ${operation} on ${sheetName}`);
  }
}

/**
 * Log script execution with timing
 * تسجيل تنفيذ السكربت مع التوقيت
 */
export function createScriptLogger(scriptName: string) {
  const startTime = Date.now();
  const scriptLogger = createLogger('Script', {
    scriptName,
    startTime: new Date().toISOString(),
  });
  
  return {
    logger: scriptLogger,
    
    /**
     * Log successful completion with duration
     * تسجيل الإنجاز الناجح مع المدة
     */
    complete: (message?: string, metadata?: Record<string, any>) => {
      const duration = Date.now() - startTime;
      scriptLogger.info({
        status: 'completed',
        duration,
        durationHuman: formatDuration(duration),
        ...metadata,
      }, message || `Script ${scriptName} completed successfully`);
    },
    
    /**
     * Log failure with duration and error details
     * تسجيل الفشل مع المدة وتفاصيل الخطأ
     */
    fail: (error: Error | string, metadata?: Record<string, any>) => {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : error;
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      scriptLogger.error({
        status: 'failed',
        duration,
        durationHuman: formatDuration(duration),
        error: errorMessage,
        stack: errorStack,
        ...metadata,
      }, `Script ${scriptName} failed: ${errorMessage}`);
      
      // Print quick fix instructions
      printQuickFix(scriptName, errorMessage);
    },
    
    /**
     * Log progress step
     * تسجيل خطوة التقدم
     */
    step: (step: string, metadata?: Record<string, any>) => {
      const elapsed = Date.now() - startTime;
      scriptLogger.info({
        step,
        elapsed,
        ...metadata,
      }, step);
    },
  };
}

/**
 * Format duration in human-readable format
 * تنسيق المدة بشكل قابل للقراءة
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
  return `${(ms / 3600000).toFixed(2)}h`;
}

/**
 * Print quick fix instructions for common errors
 * طباعة تعليمات الحل السريع للأخطاء الشائعة
 */
function printQuickFix(scriptName: string, errorMessage: string) {
  const quickFixes: Record<string, string> = {
    'Quota exceeded': `
╔════════════════════════════════════════════════════════════════╗
║ QUOTA EXCEEDED - QUICK FIX / تجاوز الحد المسموح - حل سريع     ║
╠════════════════════════════════════════════════════════════════╣
║ 1. Wait 60 seconds before retrying                            ║
║    انتظر 60 ثانية قبل المحاولة مرة أخرى                      ║
║                                                                 ║
║ 2. Increase WRITE_COOLDOWN_MS in .env:                        ║
║    زد WRITE_COOLDOWN_MS في ملف .env:                          ║
║    WRITE_COOLDOWN_MS=5000                                      ║
║                                                                 ║
║ 3. Reduce WRITE_BATCH_SIZE in .env:                           ║
║    قلل WRITE_BATCH_SIZE في ملف .env:                          ║
║    WRITE_BATCH_SIZE=5                                          ║
╚════════════════════════════════════════════════════════════════╝`,
    
    'SHEETS_SPREADSHEET_ID': `
╔════════════════════════════════════════════════════════════════╗
║ MISSING SPREADSHEET ID - QUICK FIX / معرف الجدول مفقود        ║
╠════════════════════════════════════════════════════════════════╣
║ Set SHEETS_SPREADSHEET_ID in .env:                            ║
║ عيّن SHEETS_SPREADSHEET_ID في ملف .env:                      ║
║                                                                 ║
║ SHEETS_SPREADSHEET_ID=1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2Kvzjjnbc║
║                                                                 ║
║ Get ID from Google Sheets URL:                                ║
║ احصل على المعرف من رابط Google Sheets:                       ║
║ https://docs.google.com/spreadsheets/d/YOUR_ID_HERE/edit      ║
╚════════════════════════════════════════════════════════════════╝`,
    
    'ECONNREFUSED': `
╔════════════════════════════════════════════════════════════════╗
║ CONNECTION REFUSED - QUICK FIX / رفض الاتصال                  ║
╠════════════════════════════════════════════════════════════════╣
║ 1. Check internet connection / تحقق من الاتصال بالإنترنت     ║
║ 2. Verify API endpoint is accessible / تحقق من نقطة النهاية ║
║ 3. Check firewall settings / تحقق من إعدادات الجدار الناري   ║
╚════════════════════════════════════════════════════════════════╝`,
    
    'Invalid credentials': `
╔════════════════════════════════════════════════════════════════╗
║ INVALID CREDENTIALS - QUICK FIX / بيانات اعتماد غير صالحة    ║
╠════════════════════════════════════════════════════════════════╣
║ 1. Verify GOOGLE_CREDENTIALS_JSON is valid JSON               ║
║    تحقق من أن GOOGLE_CREDENTIALS_JSON هو JSON صالح           ║
║                                                                 ║
║ 2. Check that private_key has \\n escaped properly            ║
║    تحقق من أن private_key يحتوي على \\n محوّلة بشكل صحيح    ║
║                                                                 ║
║ 3. Regenerate service account key from Google Cloud Console   ║
║    أعد توليد مفتاح حساب الخدمة من Google Cloud Console        ║
╚════════════════════════════════════════════════════════════════╝`,
  };
  
  // Find matching quick fix
  for (const [pattern, fix] of Object.entries(quickFixes)) {
    if (errorMessage.includes(pattern)) {
      console.error(fix);
      return;
    }
  }
}

/**
 * Create HTTP request logger middleware
 * إنشاء middleware لتسجيل طلبات HTTP
 */
export function createHttpLogger() {
  const httpLogger = createLogger('HTTP');
  
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();
    
    // Log request
    httpLogger.info({
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }, `${req.method} ${req.path}`);
    
    // Log response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      
      httpLogger[logLevel]({
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        durationHuman: formatDuration(duration),
      }, `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    
    next();
  };
}

// Export type for use in other modules
export type Logger = PinoLogger;

export default logger;
