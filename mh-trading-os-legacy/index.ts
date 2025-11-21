import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { nanoid } from "nanoid";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { sheetsService, SPREADSHEET_ID, validateSheetConnection } from "./lib/sheets";
import { hydrateSettings } from "./lib/settings";

if (!process.env.DRY_RUN) {
  process.env.DRY_RUN = 'true';
}

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown;
    id?: string;
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    id?: string;
  }
}

const allowedOrigin = process.env.APP_BASE_URL || 'https://9f5e130a-af90-4065-b523-da9b197ec1f2-00-p3j0rlkbid0o.riker.replit.dev';

// Trust first proxy (Replit) for rate limiting - more secure than `true`
app.set('trust proxy', 1);

app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024,
  level: 6,
}));

app.use(cors({
  origin: allowedOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.path.startsWith('/api'),
});

app.use(apiLimiter);

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  req.id = nanoid(10);
  res.setHeader('X-Request-ID', req.id);
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    
    const structuredLog = {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
    
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
      
      if (res.statusCode >= 500) {
        sheetsService.logToSheet(
          'ERROR',
          'HTTP',
          `${req.method} ${req.path} → ${res.statusCode}`,
          req.id
        ).catch((error) => {
          console.error('Failed to log 5xx error to OS_Logs:', error);
        });
      }
    }
    
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(structuredLog));
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // CRITICAL: Validate sheet connection on boot
  try {
    validateSheetConnection();
    log(`✓ Sheet connection validated: ${SPREADSHEET_ID}`);
  } catch (error: any) {
    log(`✗ FATAL: ${error.message}`);
    process.exit(1);
  }

  // Log unified sheet source on boot (single source of truth: SHEETS_SPREADSHEET_ID)
  try {
    await sheetsService.logToSheet('INFO', 'Bootstrap', 'Unified sheet source', SPREADSHEET_ID);
    log(`Sheet ID unified: ${SPREADSHEET_ID}`);
  } catch (error) {
    log(`Warning: Could not log to OS_Logs on boot (sheet may not be connected yet)`);
  }

  // Hydrate settings from Sheet + Secrets on boot
  try {
    const config = await hydrateSettings();
    const okCount = config.settingsStatus.filter(s => s.status === 'ok').length;
    const missingCount = config.settingsStatus.filter(s => s.status === 'missing').length;
    const warningCount = config.settingsStatus.filter(s => s.status === 'warning').length;
    log(`Settings hydrated: ${okCount} ok, ${missingCount} missing, ${warningCount} warnings`);
  } catch (error: any) {
    log(`Warning: Settings hydration failed: ${error.message}`);
  }

  // Start Outreach Email Delivery Worker
  try {
    const { startWorker } = await import("./workers/outreach-worker");
    log(`Starting Outreach Email Delivery Worker...`);
    startWorker().catch((error: any) => {
      log(`Outreach worker error: ${error.message}`);
    });
  } catch (error: any) {
    log(`Warning: Failed to start Outreach worker: ${error.message}`);
  }

  // Graceful shutdown handler
  process.on('SIGTERM', async () => {
    log('SIGTERM received, shutting down gracefully...');
    try {
      const { stopWorker } = await import("./workers/outreach-worker");
      await stopWorker();
      log('Outreach worker stopped');
    } catch (error: any) {
      log(`Warning: Failed to stop Outreach worker: ${error.message}`);
    }
    process.exit(0);
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
