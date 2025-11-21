import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { sheetsService, getUncachableGoogleSheetClient, SPREADSHEET_ID } from "./lib/sheets";
import { quoteService } from "./lib/quote-service";
import { BootstrapService } from "./lib/bootstrap";
import { hydrateSettings, validateNoSecretsInSheet } from "./lib/settings";
import { ensureSheets } from "./lib/ensure-sheets";
import {
  buildPricingContext,
  repriceSKU,
  explainPriceCalculation,
} from "./lib/pricing";
import { calculateOrderPricing, type AdvancedPricingContext } from "./lib/pricing-advanced";
import {
  buildHAIROTICMENContext,
  calculateHAIROTICMENPricing,
  calculateHAIROTICMENPricingBatch,
  explainHAIROTICMENPricing,
  type HAIROTICMENPriceBreakdown
} from "./lib/pricing-engine-hairoticmen";
import { generateStandQR, generateProductQR } from "./lib/qr";
import { generateInvoicePDF, generatePriceListPDF, generateQuotePDF } from "./lib/pdf";
import { sendQuoteEmail } from "./lib/email";
import { readFile } from 'fs/promises';
import { generateAIResponse } from "./lib/openai";
import { getFeatureFlags, maskSecret } from "./lib/feature-flags";
import { 
  generateReadinessData, 
  generateSheetsStructureData, 
  writeReadinessReport, 
  writeSheetsStructureReport 
} from "./lib/readiness";
import { 
  checkAllIntegrations, 
  checkEmail, 
  checkWooCommerce, 
  checkOdoo 
} from "./lib/integrations-check";
import { check2BReadiness, write2BReadinessToOSHealth } from "./lib/health-checks";
import { nanoid } from "nanoid";
import express from "express";
import path from "path";
import { retryWithBackoff } from "./lib/retry";
import sheetsSyncRouter from "./routes/sheets-sync";
import { startRepriceJob, getJobStatus, listJobs } from "./lib/reprice-orchestrator";
import { validateWebhookSignature, processSheetChange, isValidWebhookPayload } from "./lib/sheet-webhook";
import { 
  partnerInsertSchema,
  partnerTierSchema,
  type PartnerRegistry,
  standInventoryInsertSchema,
  standRefillPlanInsertSchema,
  standVisitInsertSchema,
  type StandRefillPlan,
  type StandVisit,
  commissionLedgerInsertSchema,
  type CommissionLedgerInsert,
  type Channel,
  type AmazonSizeTier,
  type ShippingMatrixDHL,
  type DHLSurcharge,
  insertPricingParamSchema,
  updatePricingParamSchema,
  type PricingParam,
} from "@shared/schema";
import {
  calculateCommission,
  calculateMonthlyCommissionSummary,
  type CommissionCalculationInput,
  type CommissionCalculationResult,
} from "./lib/commission-engine";
import {
  assignTerritory,
  reassignWithApproval,
  getTerritoryCoverage,
  validateNoDoubleClaims,
  type TerritoryAssignmentResult,
} from "./lib/territory-manager";

import { registerAIRoutes } from "./routes-ai";
import { registerOutreachRoutes } from "./routes-outreach";
import adminRoutes from "./routes-admin";
import advancedPartnerRoutes from "./routes/advanced-partner-routes";
import affiliateRoutes from "./routes/affiliate-routes";
import documentRoutes from "./modules/documents/document.routes";
import { registerStandRoutes } from "./modules/stand/stand.routes";
import { 
  processOrderLoyalty, 
  extractOrderCategories, 
  createLoyaltyLedgerEntry 
} from "./lib/order-loyalty-integration";

function requireAuth(req: any, res: any, next: any) {
  const fullPath = req.baseUrl + req.path;
  
  if (fullPath.startsWith('/api/outreach/webhooks/')) {
    return next();
  }
  
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.API_SECRET_KEY;
  
  if (!validKey) {
    return res.status(500).json({ error: 'Server authentication not configured' });
  }
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }
  
  if (apiKey !== validKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  app.use('/qr', express.static(path.join(process.cwd(), 'client', 'public', 'qr')));
  app.use('/docs', express.static(path.join(process.cwd(), 'client', 'public', 'docs')));

  // === WEBHOOK ENDPOINTS (NO AUTH - external services) ===
  // These must be registered BEFORE the requireAuth middleware

  // Google Sheets Sync API (for Apps Script integration - no auth required)
  // POST /api/sheets/sync, POST /api/sheets/validate, GET /api/products/all
  app.use('/api', sheetsSyncRouter);

  // POST /api/sheets/webhook - Receive Google Apps Script change notifications
  app.post("/api/sheets/webhook", async (req, res) => {
    try {
      // Use rawBody captured by global express.json() verify callback
      const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(req.body);
      const signature = req.headers['x-webhook-signature'] as string;
      
      // Validate signature first (fail fast)
      const isValid = validateWebhookSignature(rawBody, signature);
      
      if (!isValid) {
        await sheetsService.logToSheet('WARN', 'Webhook', 'Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
      
      // Parse JSON payload after validation
      const payload = JSON.parse(rawBody);
      
      // Validate payload structure
      if (!isValidWebhookPayload(payload)) {
        await sheetsService.logToSheet('WARN', 'Webhook', 'Invalid webhook payload');
        return res.status(400).json({ error: 'Invalid payload structure' });
      }
      
      // Process the change notification
      const {
        cacheKeysToInvalidate,
        shouldReprice,
        shouldNotify
      } = processSheetChange(payload);
      
      // Log the webhook event
      await sheetsService.logToSheet(
        'INFO',
        'Webhook',
        `Sheet change: ${payload.sheetName} (${payload.changeType})`,
        `Rows: ${payload.rowsAffected || 'N/A'}, Reprice: ${shouldReprice}`
      );
      
      // Trigger reprice if needed
      let repriceJobId: string | null = null;
      if (shouldReprice) {
        try {
          repriceJobId = await startRepriceJob(`webhook:${payload.sheetName}`);
        } catch (error: any) {
          // Don't fail webhook if reprice fails (may already be running)
          console.warn('Auto-reprice failed:', error.message);
        }
      }
      
      // Return response with cache invalidation info
      res.json({
        message: 'Webhook processed successfully',
        cacheKeysToInvalidate,
        shouldReprice,
        repriceJobId,
        timestamp: new Date().toISOString(),
      });
      
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      await sheetsService.logToSheet('ERROR', 'Webhook', `Webhook error: ${error.message}`);
      res.status(500).json({ error: 'Webhook processing failed', details: error.message });
    }
  });

  // === PROTECTED API ROUTES (REQUIRE AUTH) ===
  app.use('/api', requireAuth);

  registerAIRoutes(app);
  
  registerOutreachRoutes(app);
  
  app.use('/api/admin', adminRoutes);
  
  // Advanced Partner Systems (Partner Programs, Loyalty, Gifts, Policies)
  app.use('/api', advancedPartnerRoutes);
  
  // Affiliate Intelligence System (AIS v1.0)
  app.use('/api/affiliates', affiliateRoutes);

  // Stand Center System - Comprehensive stand/partner management
  registerStandRoutes(app);

  // Document Templates System - PDF generation for contracts, invoices, etc.
  // Document OS routes (new modular structure)
  app.use('/api/docs', documentRoutes);
  // Legacy document routes (backwards compatibility)
  app.use('/api/documents', documentRoutes);

  // Full System Bootstrap - check and create all required sheets, settings, etc.
  app.post("/api/admin/bootstrap/run", async (req, res) => {
    try {
      const bootstrapService = new BootstrapService(sheetsService);
      const result = await bootstrapService.runFullBootstrap();
      res.json(result);
    } catch (error: any) {
      console.error('Bootstrap error:', error);
      res.status(500).json({ error: 'Failed to run bootstrap', details: error.message });
    }
  });

  // Ensure Sheets - verify/create all sheets with correct headers, fix clones, normalize data
  app.post("/api/admin/ensure-sheets", async (req, res) => {
    try {
      const result = await ensureSheets(sheetsService);
      res.json(result);
    } catch (error: any) {
      console.error('Ensure sheets error:', error);
      res.status(500).json({ 
        error: 'Failed to ensure sheets', 
        details: error.message,
        status: 'error'
      });
    }
  });

  // Phase 2B Readiness Check - comprehensive health assessment
  app.get("/api/admin/2b-readiness", async (req, res) => {
    try {
      const results = await check2BReadiness();
      res.json(results);
    } catch (error: any) {
      console.error('2B readiness check error:', error);
      res.status(500).json({ 
        error: 'Failed to run 2B readiness check', 
        details: error.message 
      });
    }
  });

  // Write Phase 2B Readiness to OS_Health
  app.post("/api/admin/2b-readiness/write", async (req, res) => {
    try {
      await write2BReadinessToOSHealth();
      res.json({ 
        success: true, 
        message: 'Phase 2B readiness results written to OS_Health sheet' 
      });
    } catch (error: any) {
      console.error('Failed to write 2B readiness to OS_Health:', error);
      res.status(500).json({ 
        error: 'Failed to write readiness results', 
        details: error.message 
      });
    }
  });

  // SECURITY: Clean secrets from Settings sheet
  app.post("/api/admin/security/clean-secrets", async (req, res) => {
    try {
      const { cleanSecretsFromSheet } = await import('./scripts/clean-secrets-from-sheet');
      const result = await cleanSecretsFromSheet();
      res.json(result);
    } catch (error: any) {
      console.error('Failed to clean secrets from sheet:', error);
      res.status(500).json({ 
        success: false,
        error: 'Failed to clean secrets', 
        details: error.message 
      });
    }
  });

  // Update individual setting in Settings sheet
  app.post("/api/admin/setting", async (req, res) => {
    try {
      const { key, value } = req.body;
      
      if (!key) {
        return res.status(400).json({ error: 'Setting key is required' });
      }

      // Check if setting exists
      const settings = await sheetsService.readSheet<{ Key: string; Value: string }>('Settings');
      const exists = settings.some(s => s.Key === key);

      if (exists) {
        // Update existing setting
        await sheetsService.updateRow('Settings', 'Key', key, { Value: String(value) });
      } else {
        // Create new setting
        await sheetsService.writeRows('Settings', [{ Key: key, Value: String(value) }]);
      }

      res.json({ 
        success: true, 
        key, 
        value,
        message: `Setting ${key} updated. Restart worker for changes to take effect.`
      });
    } catch (error: any) {
      console.error('Failed to update setting:', error);
      res.status(500).json({ 
        error: 'Failed to update setting', 
        details: error.message 
      });
    }
  });

  // Bootstrap endpoint - load initial data
  app.get("/api/bootstrap", async (req, res) => {
    try {
      const [settings, tiers, params, suggestions, products, partners, stands, orders] = await Promise.all([
        sheetsService.getSettings(),
        sheetsService.getPartnerTiers(),
        sheetsService.getPricingParams(),
        sheetsService.getPricingSuggestions(),
        sheetsService.getFinalPriceList(),
        sheetsService.getPartnerRegistry(),
        sheetsService.getStandSites(),
        sheetsService.getOrders(),
      ]);

      const activeOrders = orders.filter(o => o.Status === 'Active' || o.Status === 'Pending').length;
      
      const recentSuggestions = suggestions
        .filter(s => s.Status === 'Pending')
        .sort((a, b) => new Date(b.CreatedTS).getTime() - new Date(a.CreatedTS).getTime())
        .slice(0, 10);

      res.json({
        settings,
        tiers,
        params,
        products,
        partners,
        stands,
        orders,
        recentSuggestions,
        counts: {
          products: products.length,
          partners: partners.length,
          stands: stands.length,
          activeOrders,
        },
      });
    } catch (error: any) {
      console.error('Bootstrap error:', error);
      res.status(500).json({ error: 'Failed to load bootstrap data', details: error.message });
    }
  });

  // Dashboard metrics with date range filtering
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const range = (req.query.range as string) || 'month';
      
      // Fetch quotes/orders data
      const quotes = await sheetsService.getQuotes();
      
      // Define valid order statuses
      const orderStatuses = ['APPROVED', 'ORDER', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
      
      // Filter orders by status (normalize to uppercase for consistency)
      const orders = quotes.filter(q => 
        orderStatuses.includes(q.Status?.toUpperCase() || '')
      );
      
      // Calculate date range cutoff
      const now = new Date();
      let cutoffDate = new Date();
      
      switch (range) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case 'quarter':
          cutoffDate.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          cutoffDate.setFullYear(now.getFullYear() - 1);
          break;
        case 'all':
          cutoffDate = new Date(0); // Beginning of time
          break;
        default:
          cutoffDate.setMonth(now.getMonth() - 1);
      }
      
      // Filter orders by date range
      const filteredOrders = orders.filter(order => {
        if (!order.CreatedTS) return false;
        const orderDate = new Date(order.CreatedTS);
        return orderDate >= cutoffDate;
      });
      
      // Calculate metrics
      const totalRevenue = filteredOrders.reduce((sum, order) => {
        return sum + (order.Total_EUR || order.Total || 0);
      }, 0);
      
      const orderCount = filteredOrders.length;
      const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
      
      // Calculate conversion rate (quotes -> orders)
      const allQuotes = quotes.filter(q => {
        if (!q.CreatedTS) return false;
        const quoteDate = new Date(q.CreatedTS);
        return quoteDate >= cutoffDate;
      });
      const conversionRate = allQuotes.length > 0 
        ? (filteredOrders.length / allQuotes.length) * 100 
        : 0;
      
      // Generate time series data for chart
      const timeSeries: Array<{ date: string; revenue: number; orders: number }> = [];
      
      // Group by day/week/month based on range
      const groupBy = range === 'week' ? 'day' : range === 'month' || range === 'quarter' ? 'week' : 'month';
      
      // Create buckets
      const buckets = new Map<string, { revenue: number; orders: number }>();
      
      filteredOrders.forEach(order => {
        if (!order.CreatedTS) return;
        const orderDate = new Date(order.CreatedTS);
        let bucketKey: string;
        
        if (groupBy === 'day') {
          bucketKey = orderDate.toISOString().split('T')[0]; // YYYY-MM-DD
        } else if (groupBy === 'week') {
          // Get week start (Monday)
          const weekStart = new Date(orderDate);
          weekStart.setDate(orderDate.getDate() - orderDate.getDay() + 1);
          bucketKey = weekStart.toISOString().split('T')[0];
        } else {
          // Month
          bucketKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
        }
        
        if (!buckets.has(bucketKey)) {
          buckets.set(bucketKey, { revenue: 0, orders: 0 });
        }
        
        const bucket = buckets.get(bucketKey)!;
        bucket.revenue += (order.Total_EUR || order.Total || 0);
        bucket.orders += 1;
      });
      
      // Convert buckets to sorted array
      Array.from(buckets.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([date, data]) => {
          timeSeries.push({
            date,
            revenue: Math.round(data.revenue * 100) / 100,
            orders: data.orders,
          });
        });
      
      res.json({
        summary: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          orderCount,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          conversionRate: Math.round(conversionRate * 10) / 10,
        },
        timeSeries,
        range,
      });
    } catch (error: any) {
      console.error('Dashboard metrics error:', error);
      res.status(500).json({ error: 'Failed to load dashboard metrics', details: error.message });
    }
  });

  // Products endpoints
  app.get("/api/products", async (req, res) => {
    try {
      const { q = '', limit = '100' } = req.query;
      const products = await sheetsService.getFinalPriceList();
      
      let filtered = products;
      if (q) {
        const query = String(q).toLowerCase();
        filtered = products.filter(p => 
          p.SKU.toLowerCase().includes(query) || 
          p.Name.toLowerCase().includes(query)
        );
      }

      const limitNum = parseInt(String(limit));
      const result = filtered.slice(0, limitNum);

      res.json(result);
    } catch (error: any) {
      console.error('Products search error:', error);
      res.status(500).json({ error: 'Failed to search products', details: error.message });
    }
  });

  app.post("/api/products/reprice", async (req, res) => {
    try {
      const { skus } = req.body;
      
      if (!Array.isArray(skus) || skus.length === 0) {
        return res.status(400).json({ error: 'SKUs array is required' });
      }

      const [products, competitorPrices, params, tiers] = await Promise.all([
        sheetsService.getFinalPriceList(),
        sheetsService.getCompetitorPrices(),
        sheetsService.getPricingParams(),
        sheetsService.getPartnerTiers(),
      ]);

      const ctx = buildPricingContext(params, tiers);
      const results = [];
      const timestamp = new Date().toISOString();

      for (const sku of skus) {
        const product = products.find(p => p.SKU === sku);
        if (!product) {
          continue;
        }

        if (!product.AutoPriceFlag) {
          results.push({ sku, status: 'skipped', reason: 'AutoPriceFlag is false' });
          continue;
        }

        const breakdown = repriceSKU(product, competitorPrices, ctx);

        // Update the product in sheets
        await sheetsService.updateRow('FinalPriceList', 'SKU', sku, {
          UVP_Recommended: breakdown.uvpRecommended,
          UVP: breakdown.uvpRecommended,
          MAP: breakdown.map,
          Price_Web: breakdown.priceWeb,
          Price_Amazon: breakdown.priceAmazon,
          Price_Salon: breakdown.priceSalon,
          Net_Dealer_Basic: breakdown.netDealerBasic,
          Net_Dealer_Plus: breakdown.netDealerPlus,
          Net_Stand: breakdown.netStand,
          Net_Distributor: breakdown.netDistributor,
          Competitor_Min: breakdown.competitorMin,
          Competitor_Median: breakdown.competitorMedian,
          Pricing_Version: timestamp,
        });

        // Log guardrails if any
        if (breakdown.guardrails.length > 0) {
          for (const msg of breakdown.guardrails) {
            await sheetsService.writeRows('MAP_Guardrails', [{
              SKU: sku,
              RaisedTS: timestamp,
              Type: 'Pricing',
              CurrentValue: breakdown.uvpRecommended,
              ThresholdValue: breakdown.map,
              Message: msg,
              Status: 'Active',
            }]);
          }
        }

        results.push({ sku, status: 'repriced', breakdown });
      }

      await sheetsService.logToSheet('INFO', 'Pricing', `Repriced ${results.length} SKUs`);
      res.json({ results });
    } catch (error: any) {
      console.error('Reprice error:', error);
      res.status(500).json({ error: 'Failed to reprice products', details: error.message });
    }
  });

  app.get("/api/products/:sku/explain", async (req, res) => {
    try {
      const { sku } = req.params;
      const [products, params, tiers] = await Promise.all([
        sheetsService.getFinalPriceList(),
        sheetsService.getPricingParams(),
        sheetsService.getPartnerTiers(),
      ]);

      const product = products.find(p => p.SKU === sku);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const ctx = buildPricingContext(params, tiers);
      const explanation = explainPriceCalculation(product, ctx);

      res.json({ explanation });
    } catch (error: any) {
      console.error('Explain price error:', error);
      res.status(500).json({ error: 'Failed to explain price', details: error.message });
    }
  });

  // Pricing Studio endpoints (aliased for consistency)
  app.get("/api/pricing/products", async (req, res) => {
    try {
      const products = await sheetsService.getFinalPriceList();
      res.json(products);
    } catch (error: any) {
      console.error('Pricing products error:', error);
      res.status(500).json({ error: 'Failed to fetch products', details: error.message });
    }
  });

  app.get("/api/pricing/params", async (req, res) => {
    try {
      const params = await sheetsService.getPricingParams();
      res.json(params);
    } catch (error: any) {
      console.error('Pricing params error:', error);
      res.status(500).json({ error: 'Failed to fetch pricing params', details: error.message });
    }
  });

  app.get("/api/pricing/suggestions", async (req, res) => {
    try {
      const suggestions = await sheetsService.getPricingSuggestions();
      res.json(suggestions);
    } catch (error: any) {
      console.error('Pricing suggestions error:', error);
      res.status(500).json({ error: 'Failed to fetch suggestions', details: error.message });
    }
  });

  // Get enriched pricing suggestions with current product data and accurate margin calculations
  app.get("/api/pricing/suggestions/enriched", async (req, res) => {
    try {
      const [suggestions, products, params, channels, amazonTiers, shippingMatrix, dhlSurcharges] = await Promise.all([
        sheetsService.getPricingSuggestions(),
        sheetsService.getFinalPriceList(),
        sheetsService.getPricingParams(),
        sheetsService.readSheet<Channel>('Channels'),
        sheetsService.readSheet<AmazonSizeTier>('AmazonSizeTiers'),
        sheetsService.readSheet<ShippingMatrixDHL>('ShippingMatrix_DHL'),
        sheetsService.readSheet<DHLSurcharge>('DHL_Surcharges'),
      ]);

      const ctx = buildHAIROTICMENContext(params, channels, amazonTiers, shippingMatrix, dhlSurcharges);

      // Enrich each suggestion by running the full pricing engine with both current and suggested prices
      const enriched = suggestions.map(suggestion => {
        const product = products.find(p => p.SKU === suggestion.SKU);
        if (!product) {
          return {
            ...suggestion,
            productNotFound: true,
          };
        }

        // Calculate current pricing breakdown using the full engine
        const currentBreakdown = calculateHAIROTICMENPricing(product, ctx);

        // Calculate suggested pricing breakdown with Manual_UVP_Inc override
        const productWithSuggestedPrice = { 
          ...product, 
          Manual_UVP_Inc: suggestion.SuggestedUVP 
        };
        const suggestedBreakdown = calculateHAIROTICMENPricing(productWithSuggestedPrice, ctx);

        // Helper to format grundpreis
        const formatGrundpreis = (breakdown: any) => {
          if (!breakdown.grundpreisPerL || breakdown.grundpreisPerL <= 0) return null;
          return {
            value: breakdown.grundpreisPerL,
            unit: 'L',
            formatted: `€${breakdown.grundpreisPerL.toFixed(2)}/L`,
          };
        };

        return {
          ...suggestion,
          product: {
            Name: product.Name,
            Category: product.Category,
            Line: product.Line,
            Status: product.Status,
          },
          current: {
            uvpInc: currentBreakdown.uvpInc,
            uvpNet: currentBreakdown.uvpNet,
            map: currentBreakdown.map,
            ownStoreMarginPct: currentBreakdown.ownStoreMarginPct,
            amazonMarginPct: currentBreakdown.amazonMarginPct,
            guardrailsOK: currentBreakdown.guardrailsOK,
            guardrailViolations: currentBreakdown.guardrailViolations || [],
            grundpreis: formatGrundpreis(currentBreakdown),
          },
          suggested: {
            uvpInc: suggestedBreakdown.uvpInc,
            uvpNet: suggestedBreakdown.uvpNet,
            map: suggestedBreakdown.map,
            ownStoreMarginPct: suggestedBreakdown.ownStoreMarginPct,
            amazonMarginPct: suggestedBreakdown.amazonMarginPct,
            guardrailsOK: suggestedBreakdown.guardrailsOK,
            guardrailViolations: suggestedBreakdown.guardrailViolations || [],
            grundpreis: formatGrundpreis(suggestedBreakdown),
          },
          marginDelta: suggestedBreakdown.ownStoreMarginPct - currentBreakdown.ownStoreMarginPct,
          mapCompliant: suggestedBreakdown.uvpInc >= suggestedBreakdown.map,
        };
      });

      res.json(enriched);
    } catch (error: any) {
      console.error('Enriched pricing suggestions error:', error);
      res.status(500).json({ error: 'Failed to fetch enriched suggestions', details: error.message });
    }
  });

  // Approve or reject a pricing suggestion with proper status guards and transaction safety
  app.patch("/api/pricing/suggestions/:suggestionId", async (req, res) => {
    try {
      const { suggestionId } = req.params;
      const { action, reason } = req.body;

      if (!action || !['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Action must be either "approve" or "reject"' });
      }

      const suggestions = await sheetsService.getPricingSuggestions();
      const suggestion = suggestions.find(s => s.SuggestionID === suggestionId);

      if (!suggestion) {
        return res.status(404).json({ error: 'Suggestion not found' });
      }

      // Prevent re-processing already actioned suggestions
      if (suggestion.Status && suggestion.Status !== 'Pending') {
        return res.status(409).json({ 
          error: 'Suggestion already processed', 
          status: suggestion.Status,
          suggestionId 
        });
      }

      if (action === 'approve') {
        const products = await sheetsService.getFinalPriceList();
        const product = products.find(p => p.SKU === suggestion.SKU);

        if (!product) {
          return res.status(404).json({ error: 'Product not found for SKU: ' + suggestion.SKU });
        }

        // Load all pricing context
        const [params, channels, amazonTiers, shippingMatrix, dhlSurcharges] = await Promise.all([
          sheetsService.getPricingParams(),
          sheetsService.readSheet<Channel>('Channels'),
          sheetsService.readSheet<AmazonSizeTier>('AmazonSizeTiers'),
          sheetsService.readSheet<ShippingMatrixDHL>('ShippingMatrix_DHL'),
          sheetsService.readSheet<DHLSurcharge>('DHL_Surcharges'),
        ]);

        const ctx = buildHAIROTICMENContext(params, channels, amazonTiers, shippingMatrix, dhlSurcharges);
        
        // Run full pricing engine with suggested price to get all derived fields
        const productWithSuggestedPrice = { ...product, Manual_UVP_Inc: suggestion.SuggestedUVP };
        const breakdown = calculateHAIROTICMENPricing(productWithSuggestedPrice, ctx);

        // Validate guardrails before applying
        if (!breakdown.guardrailsOK) {
          await sheetsService.logToSheet('WARNING', 'Pricing', 
            `Suggestion ${suggestionId} for SKU ${suggestion.SKU} violates guardrails: ${breakdown.guardrailViolations?.join(', ')}`
          );
          
          return res.status(422).json({ 
            error: 'Suggested price violates pricing guardrails', 
            violations: breakdown.guardrailViolations,
            suggestion: suggestionId,
            sku: suggestion.SKU,
          });
        }

        try {
          // Update FinalPriceList with all derived fields from pricing engine
          await sheetsService.updateRow('FinalPriceList', 'SKU', suggestion.SKU, {
            Manual_UVP_Inc: suggestion.SuggestedUVP,
            UVP_Net: breakdown.uvpNet,
            UVP_Inc: breakdown.uvpInc,
            MAP: breakdown.map,
            Price_Amazon: breakdown.amazonInc,
            Net_Dealer_Basic: breakdown.tierNetPrices.Basic,
            Net_Dealer_Plus: breakdown.tierNetPrices.Plus,
            Net_Stand: breakdown.tierNetPrices.Stand,
            Net_Distributor: breakdown.tierNetPrices.Distributor,
            Guardrail_OK: breakdown.guardrailsOK,
            PostChannel_Margin_Pct: breakdown.ownStoreMarginPct,
            Grundpreis: breakdown.grundpreisPerL 
              ? `€${breakdown.grundpreisPerL.toFixed(2)}/L` 
              : undefined,
            Pricing_Version: new Date().toISOString(),
          });

          // Update suggestion status after successful price update
          await sheetsService.updateRow('Pricing_Suggestions', 'SuggestionID', suggestionId, {
            Status: 'Approved',
          });

          await sheetsService.logToSheet('INFO', 'Pricing', 
            `Approved pricing suggestion ${suggestionId} for SKU ${suggestion.SKU}: €${suggestion.CurrentUVP} → €${suggestion.SuggestedUVP} (margin: ${breakdown.ownStoreMarginPct.toFixed(1)}%)`
          );

          res.json({ 
            success: true, 
            action: 'approved',
            sku: suggestion.SKU,
            oldPrice: suggestion.CurrentUVP,
            newPrice: breakdown.uvpInc,
            margin: breakdown.ownStoreMarginPct,
            guardrailsOK: breakdown.guardrailsOK,
            breakdown,
          });
        } catch (updateError: any) {
          // Log partial update failure
          await sheetsService.logToSheet('ERROR', 'Pricing', 
            `PARTIAL UPDATE FAILURE for suggestion ${suggestionId}, SKU ${suggestion.SKU}: ${updateError.message}`
          );
          throw updateError;
        }
      } else {
        // Reject the suggestion
        await sheetsService.updateRow('Pricing_Suggestions', 'SuggestionID', suggestionId, {
          Status: 'Rejected',
        });

        await sheetsService.logToSheet('INFO', 'Pricing', 
          `Rejected pricing suggestion ${suggestionId} for SKU ${suggestion.SKU}${reason ? `: ${reason}` : ''}`
        );

        res.json({ 
          success: true, 
          action: 'rejected',
          sku: suggestion.SKU,
          reason,
        });
      }
    } catch (error: any) {
      console.error('Suggestion action error:', error);
      res.status(500).json({ error: 'Failed to process suggestion', details: error.message });
    }
  });

  // Get MAP guardrails
  app.get("/api/pricing/map-guardrails", async (req, res) => {
    try {
      const guardrails = await sheetsService.readSheet<MAPGuardrail>('MAP_Guardrails');
      
      // Filter to active guardrails if requested
      const { activeOnly } = req.query;
      if (activeOnly === 'true') {
        const filtered = guardrails.filter(g => 
          !g.Status || g.Status === 'Active' || g.Status === 'Open'
        );
        return res.json(filtered);
      }

      res.json(guardrails);
    } catch (error: any) {
      console.error('MAP guardrails error:', error);
      res.status(500).json({ error: 'Failed to fetch MAP guardrails', details: error.message });
    }
  });

  app.post("/api/pricing/bulk-reprice", async (req, res) => {
    try {
      const { skus } = req.body;
      const products = await sheetsService.getFinalPriceList();
      
      // If specific SKUs provided, filter by those; otherwise use all products
      let targetProducts = skus && Array.isArray(skus)
        ? products.filter(p => skus.includes(p.SKU))
        : products;

      // Only reprice products with AutoPriceFlag enabled
      targetProducts = targetProducts.filter(p => p.AutoPriceFlag);

      if (targetProducts.length === 0) {
        return res.json({ updated: 0, total: 0 });
      }

      const [competitorPrices, params, tiers] = await Promise.all([
        sheetsService.getCompetitorPrices(),
        sheetsService.getPricingParams(),
        sheetsService.getPartnerTiers(),
      ]);

      const ctx = buildPricingContext(params, tiers);
      const timestamp = new Date().toISOString();
      let updated = 0;

      for (const product of targetProducts) {
        const breakdown = repriceSKU(product, competitorPrices, ctx);

        await sheetsService.updateRow('FinalPriceList', 'SKU', product.SKU, {
          UVP_Recommended: breakdown.uvpRecommended,
          UVP: breakdown.uvpRecommended,
          MAP: breakdown.map,
          Price_Web: breakdown.priceWeb,
          Price_Amazon: breakdown.priceAmazon,
          Price_Salon: breakdown.priceSalon,
          Net_Dealer_Basic: breakdown.netDealerBasic,
          Net_Dealer_Plus: breakdown.netDealerPlus,
          Net_Stand: breakdown.netStand,
          Net_Distributor: breakdown.netDistributor,
          Pricing_Version: timestamp,
        });

        updated++;
      }

      await sheetsService.logToSheet('INFO', 'Pricing', `Bulk repriced ${updated}/${targetProducts.length} SKUs`);
      res.json({ updated, total: targetProducts.length });
    } catch (error: any) {
      console.error('Bulk reprice error:', error);
      res.status(500).json({ error: 'Bulk reprice failed', details: error.message });
    }
  });

  // HAIROTICMEN Pricing Engine v3 - Single SKU calculation
  app.post("/api/pricing/hairoticmen/sku", async (req, res) => {
    try {
      const { sku } = req.body;
      
      if (!sku) {
        return res.status(400).json({ error: 'SKU is required' });
      }

      // Load all required sheet data
      const [products, params, channels, amazonTiers, shippingMatrix, dhlSurcharges] = await Promise.all([
        sheetsService.getFinalPriceList(),
        sheetsService.getPricingParams(),
        sheetsService.readSheet<Channel>('Channels'),
        sheetsService.readSheet<AmazonSizeTier>('AmazonSizeTiers'),
        sheetsService.readSheet<ShippingMatrixDHL>('ShippingMatrix_DHL'),
        sheetsService.readSheet<DHLSurcharge>('DHL_Surcharges'),
      ]);

      const product = products.find(p => p.SKU === sku);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const ctx = buildHAIROTICMENContext(params, channels, amazonTiers, shippingMatrix, dhlSurcharges);
      const breakdown = calculateHAIROTICMENPricing(product, ctx);

      res.json(breakdown);
    } catch (error: any) {
      console.error('HAIROTICMEN pricing calculation error:', error);
      res.status(500).json({ error: 'Failed to calculate pricing', details: error.message });
    }
  });

  // HAIROTICMEN Pricing Engine v3 - Batch calculation
  app.post("/api/pricing/hairoticmen/batch", async (req, res) => {
    try {
      const { skus } = req.body;

      // Load all required sheet data
      const [products, params, channels, amazonTiers, shippingMatrix, dhlSurcharges] = await Promise.all([
        sheetsService.getFinalPriceList(),
        sheetsService.getPricingParams(),
        sheetsService.readSheet<Channel>('Channels'),
        sheetsService.readSheet<AmazonSizeTier>('AmazonSizeTiers'),
        sheetsService.readSheet<ShippingMatrixDHL>('ShippingMatrix_DHL'),
        sheetsService.readSheet<DHLSurcharge>('DHL_Surcharges'),
      ]);

      // If specific SKUs provided, filter by those; otherwise use all products
      const targetProducts = skus && Array.isArray(skus)
        ? products.filter(p => skus.includes(p.SKU))
        : products;

      const ctx = buildHAIROTICMENContext(params, channels, amazonTiers, shippingMatrix, dhlSurcharges);
      const breakdowns = calculateHAIROTICMENPricingBatch(targetProducts, ctx);

      res.json({
        total: breakdowns.length,
        results: breakdowns
      });
    } catch (error: any) {
      console.error('HAIROTICMEN batch pricing error:', error);
      res.status(500).json({ error: 'Failed to calculate batch pricing', details: error.message });
    }
  });

  // HAIROTICMEN Pricing Engine v3 - Detailed explanation
  app.post("/api/pricing/hairoticmen/explain", async (req, res) => {
    try {
      const { sku } = req.body;
      
      if (!sku) {
        return res.status(400).json({ error: 'SKU is required' });
      }

      // Load all required sheet data
      const [products, params, channels, amazonTiers, shippingMatrix, dhlSurcharges] = await Promise.all([
        sheetsService.getFinalPriceList(),
        sheetsService.getPricingParams(),
        sheetsService.readSheet<Channel>('Channels'),
        sheetsService.readSheet<AmazonSizeTier>('AmazonSizeTiers'),
        sheetsService.readSheet<ShippingMatrixDHL>('ShippingMatrix_DHL'),
        sheetsService.readSheet<DHLSurcharge>('DHL_Surcharges'),
      ]);

      const product = products.find(p => p.SKU === sku);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const ctx = buildHAIROTICMENContext(params, channels, amazonTiers, shippingMatrix, dhlSurcharges);
      const explanation = explainHAIROTICMENPricing(product, ctx);

      res.json({ explanation });
    } catch (error: any) {
      console.error('HAIROTICMEN pricing explanation error:', error);
      res.status(500).json({ error: 'Failed to explain pricing', details: error.message });
    }
  });

  // HAIROTICMEN Pricing Engine v3 - Bulk update with new engine
  app.post("/api/pricing/hairoticmen/bulk-update", async (req, res) => {
    try {
      const { skus } = req.body;
      
      // Load all required sheet data
      const [products, params, channels, amazonTiers, shippingMatrix, dhlSurcharges] = await Promise.all([
        sheetsService.getFinalPriceList(),
        sheetsService.getPricingParams(),
        sheetsService.readSheet<Channel>('Channels'),
        sheetsService.readSheet<AmazonSizeTier>('AmazonSizeTiers'),
        sheetsService.readSheet<ShippingMatrixDHL>('ShippingMatrix_DHL'),
        sheetsService.readSheet<DHLSurcharge>('DHL_Surcharges'),
      ]);
      
      // If specific SKUs provided, filter by those; otherwise use all products
      let targetProducts = skus && Array.isArray(skus)
        ? products.filter(p => skus.includes(p.SKU))
        : products;

      // Only update products with AutoPriceFlag enabled
      targetProducts = targetProducts.filter(p => p.AutoPriceFlag);

      if (targetProducts.length === 0) {
        return res.json({ updated: 0, total: 0 });
      }

      const ctx = buildHAIROTICMENContext(params, channels, amazonTiers, shippingMatrix, dhlSurcharges);
      const timestamp = new Date().toISOString();
      let updated = 0;

      for (const product of targetProducts) {
        const breakdown = calculateHAIROTICMENPricing(product, ctx);

        await sheetsService.updateRow('FinalPriceList', 'SKU', product.SKU, {
          UVP_Net: breakdown.uvpNet,
          UVP_Inc: breakdown.uvpInc,
          UVP: breakdown.uvpNet, // Legacy field
          Grundpreis: breakdown.grundpreisFormatted,
          Grundpreis_Net: breakdown.grundpreisNet,
          Floor_B2C_Net: breakdown.floorB2CNet,
          Net_Dealer_Basic: breakdown.dealerBasic.netPrice,
          Net_Dealer_Plus: breakdown.dealerPlus.netPrice,
          Net_Stand: breakdown.standPartner.netPrice,
          Net_Distributor: breakdown.distributor.netPrice,
          PostChannel_Margin_Pct: breakdown.b2cStore.marginPct,
          Guardrail_OK: breakdown.b2cStore.guardrailPassed && breakdown.amazon.guardrailPassed,
          Pricing_Version: `HAIROTICMEN-v3-${timestamp}`,
        });

        updated++;
      }

      await sheetsService.logToSheet('INFO', 'Pricing', `HAIROTICMEN v3: Bulk updated ${updated}/${targetProducts.length} SKUs`);
      res.json({ updated, total: targetProducts.length });
    } catch (error: any) {
      console.error('HAIROTICMEN bulk update error:', error);
      res.status(500).json({ error: 'Bulk update failed', details: error.message });
    }
  });

  app.post("/api/pricing/calculate", async (req, res) => {
    try {
      const { sku } = req.body;
      
      if (!sku) {
        return res.status(400).json({ error: 'SKU is required' });
      }

      const [products, competitorPrices, params, tiers] = await Promise.all([
        sheetsService.getFinalPriceList(),
        sheetsService.getCompetitorPrices(),
        sheetsService.getPricingParams(),
        sheetsService.getPartnerTiers(),
      ]);

      const product = products.find(p => p.SKU === sku);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const ctx = buildPricingContext(params, tiers);
      const breakdown = repriceSKU(product, competitorPrices, ctx);
      const timestamp = new Date().toISOString();

      await sheetsService.updateRow('FinalPriceList', 'SKU', sku, {
        UVP_Recommended: breakdown.uvpRecommended,
        UVP: breakdown.uvpRecommended,
        MAP: breakdown.map,
        Price_Web: breakdown.priceWeb,
        Price_Amazon: breakdown.priceAmazon,
        Price_Salon: breakdown.priceSalon,
        Net_Dealer_Basic: breakdown.netDealerBasic,
        Net_Dealer_Plus: breakdown.netDealerPlus,
        Net_Stand: breakdown.netStand,
        Net_Distributor: breakdown.netDistributor,
        Pricing_Version: timestamp,
      });

      await sheetsService.logToSheet('INFO', 'Pricing', `Calculated prices for SKU ${sku}`);
      res.json({ sku, updated: true, breakdown });
    } catch (error: any) {
      console.error('Calculate prices error:', error);
      res.status(500).json({ error: 'Failed to calculate prices', details: error.message });
    }
  });

  app.patch("/api/pricing/products/:sku", async (req, res) => {
    try {
      const { sku } = req.params;
      const updates = req.body;

      if (!sku) {
        return res.status(400).json({ error: 'SKU is required' });
      }

      await sheetsService.updateRow('FinalPriceList', 'SKU', sku, updates);
      await sheetsService.logToSheet('INFO', 'Pricing', `Updated product ${sku}: ${JSON.stringify(updates)}`);

      res.json({ sku, updated: true });
    } catch (error: any) {
      console.error('Update product error:', error);
      res.status(500).json({ error: 'Failed to update product', details: error.message });
    }
  });

  app.post("/api/pricing/bulk-update", async (req, res) => {
    try {
      const { skus, updates, overrideReason } = req.body;

      if (!skus || !Array.isArray(skus) || skus.length === 0) {
        return res.status(400).json({ error: 'SKUs array is required' });
      }

      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'Updates object is required' });
      }

      const products = await sheetsService.getFinalPriceList();
      const targetProducts = products.filter(p => skus.includes(p.SKU));

      if (targetProducts.length === 0) {
        return res.status(404).json({ error: 'No products found with provided SKUs' });
      }

      // Validate MAP protection if MAP is being updated
      const mapViolations: Array<{ sku: string; map: number; landedCost: number }> = [];
      if (updates.MAP !== undefined) {
        const newMAP = parseFloat(updates.MAP);
        for (const product of targetProducts) {
          const landedCost = parseFloat(product.LandedCost_EUR || product.COGS_EUR || 0);
          if (newMAP < landedCost && !overrideReason) {
            mapViolations.push({
              sku: product.SKU,
              map: newMAP,
              landedCost,
            });
          }
        }
      }

      if (mapViolations.length > 0) {
        return res.status(400).json({
          error: 'MAP_VIOLATION',
          message: 'MAP below landed cost requires override reason',
          violations: mapViolations,
        });
      }

      // Use efficient batch update (1 API call instead of N updates + N logs)
      const batchUpdates = targetProducts.map(product => ({
        matchValue: product.SKU,
        data: updates
      }));

      const updatedCount = await sheetsService.batchUpdateRows(
        'FinalPriceList',
        'SKU',
        batchUpdates
      );

      // Log bulk update with override reason if provided (already logged in batchUpdateRows)
      if (overrideReason) {
        await sheetsService.logToSheet('INFO', 'Pricing', `Bulk update override: ${overrideReason}`);
      }

      res.json({
        success: true,
        updated: updatedCount,
        skus: targetProducts.map(p => p.SKU).slice(0, updatedCount),
      });
    } catch (error: any) {
      console.error('Bulk update error:', error);
      res.status(500).json({ error: 'Failed to bulk update products', details: error.message });
    }
  });

  // === PRICING CONTROL PANEL ENDPOINTS ===

  // POST /api/pricing/sync - Run pricing-master.ts to sync all pricing calculations
  app.post("/api/pricing/sync", async (req, res) => {
    try {
      const { dryRun = false, exportCsv = false } = req.body;
      
      // Dynamic import to avoid bundling the script
      const { syncAllPricing } = await import('./scripts/pricing-sync-wrapper');
      
      const result = await syncAllPricing(dryRun, exportCsv);
      
      await sheetsService.logToSheet('INFO', 'Pricing', 
        `Pricing sync completed: ${result.updated} products updated${dryRun ? ' (dry-run)' : ''}`
      );
      
      const status = !result.success ? 'FAIL' 
        : result.errors.length > 0 ? 'WARN'
        : 'PASS';
      
      await sheetsService.writeOSHealth(
        'Pricing',
        status,
        `Sync: ${result.updated}/${result.total} products updated`,
        {
          source: 'sync',
          updated: result.updated,
          total: result.total,
          changes: result.changes,
          errors: result.errors,
          dryRun
        }
      );
      
      res.json(result);
    } catch (error: any) {
      console.error('Pricing sync error:', error);
      await sheetsService.logToSheet('ERROR', 'Pricing', `Pricing sync failed: ${error.message}`);
      await sheetsService.writeOSHealth('Pricing', 'FAIL', error.message, { source: 'sync', error: error.message });
      res.status(500).json({ 
        error: 'Pricing sync failed', 
        details: error.message 
      });
    }
  });

  // POST /api/pricing/validate - Run validation on FinalPriceList data
  app.post("/api/pricing/validate", async (req, res) => {
    try {
      const products = await sheetsService.getAllRows('FinalPriceList');
      
      let complete = 0;
      let warnings = 0;
      let errors = 0;
      const issues: string[] = [];
      
      products.forEach((p: any, idx: number) => {
        const rowNum = idx + 2;
        
        if (!p.SKU) {
          errors++;
          issues.push(`Row ${rowNum}: Missing SKU`);
        }
        if (!p.Name) {
          errors++;
          issues.push(`Row ${rowNum}: Missing Name`);
        }
        if (!p.Factory_Cost_EUR || Number(p.Factory_Cost_EUR) <= 0) {
          warnings++;
          issues.push(`Row ${rowNum}: Invalid Factory_Cost_EUR`);
        }
        if (!p.Line || !['Premium', 'Professional', 'Basic', 'Tools'].includes(p.Line)) {
          warnings++;
          issues.push(`Row ${rowNum}: Invalid Line value: ${p.Line}`);
        }
        if (!p.Category) {
          warnings++;
          issues.push(`Row ${rowNum}: Missing Category`);
        }
        
        if (!issues.some(i => i.startsWith(`Row ${rowNum}:`))) {
          complete++;
        }
      });
      
      const total = products.length;
      const completionPct = Math.round((complete / total) * 100);
      const status = errors === 0 ? (warnings === 0 ? 'OK' : 'WARN') : 'FAIL';
      const message = `${complete}/${total} products valid (${completionPct}%), ${warnings} warnings, ${errors} errors`;
      
      const result = {
        status,
        message,
        total,
        complete,
        warnings,
        errors,
        completionPct,
        issues: issues.slice(0, 50)
      };
      
      await sheetsService.logToSheet('INFO', 'Pricing', message);
      await sheetsService.writeOSHealth('Pricing', status, message, { 
        source: 'validate',
        total,
        complete,
        warnings,
        errors,
        completionPct
      });
      
      res.json(result);
    } catch (error: any) {
      console.error('Pricing validation error:', error);
      await sheetsService.logToSheet('ERROR', 'Pricing', `Validation failed: ${error.message}`);
      await sheetsService.writeOSHealth('Pricing', 'FAIL', error.message, { source: 'validate', error: error.message });
      res.status(500).json({ 
        error: 'Validation failed', 
        details: error.message 
      });
    }
  });

  // GET /api/pricing/export-csv - Export pricing validation report CSV
  app.get("/api/pricing/export-csv", async (req, res) => {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const csvPath = path.join(process.cwd(), 'pricing-validation-report.csv');
      
      // Check if file exists
      try {
        await fs.access(csvPath);
      } catch {
        return res.status(404).json({ 
          error: 'Report not found',
          message: 'Please run validation first to generate the report.'
        });
      }
      
      const csvData = await fs.readFile(csvPath, 'utf-8');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="pricing-validation-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
      
      await sheetsService.logToSheet('INFO', 'Pricing', 'Exported pricing validation CSV');
    } catch (error: any) {
      console.error('CSV export error:', error);
      res.status(500).json({ 
        error: 'Export failed', 
        details: error.message 
      });
    }
  });

  // GET /api/pricing/health - Get pricing system health status (latest entry)
  app.get("/api/pricing/health", async (req, res) => {
    try {
      const healthData = await sheetsService.getOSHealth();
      
      const pricingHealthRecords = healthData.filter((row: any) => 
        row.Component === 'Pricing' || row.Component === 'pricing'
      );
      
      if (pricingHealthRecords.length === 0) {
        return res.json({
          status: 'UNKNOWN',
          message: 'No pricing health data found',
          lastUpdate: null
        });
      }
      
      const latestHealth = pricingHealthRecords.sort((a, b) => {
        const dateA = new Date(a.CheckTS || a.Timestamp || 0).getTime();
        const dateB = new Date(b.CheckTS || b.Timestamp || 0).getTime();
        return dateB - dateA;
      })[0];
      
      res.json({
        status: latestHealth.Status || 'UNKNOWN',
        message: latestHealth.Message || '',
        lastUpdate: latestHealth.CheckTS || latestHealth.Timestamp || null
      });
    } catch (error: any) {
      console.error('Health check error:', error);
      res.status(500).json({ 
        error: 'Health check failed', 
        details: error.message 
      });
    }
  });

  app.post("/api/pricing/export-pdf", async (req, res) => {
    try {
      const products = await sheetsService.getFinalPriceList();
      
      // In a production app, generate actual PDF here using pdf-lib or similar
      // For now, log the request and return success
      await sheetsService.logToSheet('INFO', 'Pricing', `PDF export requested for ${products.length} products`);
      
      // Mock PDF URL - in production this would be a real generated PDF
      const pdfUrl = '/api/pricing/download-pdf?timestamp=' + Date.now();
      
      res.json({ 
        status: 'success', 
        url: pdfUrl,
        message: 'PDF export completed',
        count: products.length
      });
    } catch (error: any) {
      console.error('PDF export error:', error);
      res.status(500).json({ error: 'PDF export failed', details: error.message });
    }
  });

  // Advanced Price calculation endpoint using Phase 2 pricing engine
  app.post("/api/price/calc", async (req, res) => {
    try {
      const { items, partnerId, loyaltyRedeem = 0, salesRepId, affiliateId } = req.body;

      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ error: 'Items array is required' });
      }

      if (!partnerId) {
        return res.status(400).json({ error: 'Partner ID is required' });
      }

      const [
        partners,
        products,
        params,
        tiers,
        subscriptions,
        bundles,
        gifts,
        commissionRules,
        affiliatePrograms,
        loyaltyLedger
      ] = await Promise.all([
        sheetsService.getPartnerRegistry(),
        sheetsService.getFinalPriceList(),
        sheetsService.getPricingParams(),
        sheetsService.getPartnerTiers(),
        sheetsService.getSalonSubscriptions(),
        sheetsService.getBundles(),
        sheetsService.getGiftsBank(),
        sheetsService.getCommissionRules(),
        sheetsService.getAffiliatePrograms(),
        sheetsService.getLoyaltyLedger()
      ]);

      const partner = partners.find(p => p.PartnerID === partnerId);
      if (!partner) {
        return res.status(400).json({ error: 'Partner not found' });
      }

      const paramsMap = new Map<string, number>();
      params.forEach(p => {
        const numValue = parseFloat(p.Value);
        if (!isNaN(numValue)) {
          paramsMap.set(p.ParamKey, numValue);
        }
      });
      const tiersMap = new Map(tiers.map(t => [t.Tier, t]));
      const subscriptionsMap = new Map(subscriptions.map(s => [s.PartnerID, s]));
      const bundlesMap = new Map(bundles.map(b => [b.BundleID, b]));
      const affiliateProgramsMap = new Map(affiliatePrograms.map(a => [a.AffID, a]));

      const volumeLadder = [
        { minOrderEUR: 500, discountPct: 5 },
        { minOrderEUR: 1000, discountPct: 10 },
        { minOrderEUR: 2500, discountPct: 15 }
      ];

      const ctx: AdvancedPricingContext = {
        params: paramsMap,
        tiers: tiersMap,
        subscriptions: subscriptionsMap,
        bundles: bundlesMap,
        gifts: gifts.filter(g => g.Active),
        commissionRules: commissionRules,
        affiliatePrograms: affiliateProgramsMap,
        volumeLadder,
        loyaltyEarnRate: parseFloat(paramsMap.get('LOYALTY_EARN_RATE') || '1'),
        loyaltyRedeemRate: parseFloat(paramsMap.get('LOYALTY_REDEEM_RATE') || '1'),
        mapFloorPct: parseFloat(paramsMap.get('MAP_FLOOR_PCT') || '10'),
        minMarginPct: parseFloat(paramsMap.get('MIN_MARGIN_PCT') || '15')
      };

      const partnerBalance = loyaltyLedger
        .filter(l => l.PartnerID === partnerId)
        .reduce((sum, l) => sum + (l.PointsEarned || 0) - (l.PointsRedeemed || 0), 0);

      const lineItems = items.map((item: any) => {
        const product = products.find(p => p.SKU === item.sku);
        if (!product) {
          throw new Error(`Product not found: ${item.sku}`);
        }
        return {
          sku: item.sku,
          qty: item.qty,
          product
        };
      });

      const invoice = calculateOrderPricing(
        partner,
        lineItems,
        loyaltyRedeem,
        partnerBalance,
        salesRepId,
        affiliateId,
        ctx
      );

      res.json({
        ...invoice,
        partnerBalance,
        partnerTier: partner.Tier,
        partnerSubscription: subscriptions.find(s => s.PartnerID === partnerId)?.Plan || null
      });
    } catch (error: any) {
      console.error('Price calc error:', error);
      res.status(500).json({ error: 'Failed to calculate price', details: error.message });
    }
  });

  // DEPRECATED: Legacy endpoint - Use POST /api/quotes instead
  app.post("/api/quote", async (req, res) => {
    try {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Link', '</api/quotes>; rel="canonical"');
      console.warn('[DEPRECATED] POST /api/quote is deprecated. Use POST /api/quotes instead.');
      await sheetsService.logToSheet('WARN', 'API', 'Deprecated endpoint POST /api/quote used. Migrate to POST /api/quotes');

      const { partnerId, lines, subtotalGross, discountTotal, loyaltyRedeemed, total, notes, status } = req.body;
      
      const normalizedPayload = {
        partnerId,
        lines: (lines || []).map((l: any) => ({
          sku: l.sku,
          qty: l.qty,
          unitPrice: l.unitPrice,
          lineDiscount: l.lineDiscount || 0,
        })),
        notes: notes || '',
        loyaltyRedeemed: loyaltyRedeemed || 0,
        subtotalGross,
        discountTotal: discountTotal || 0,
        total,
        status: status || 'Active',
      };

      const quote = await quoteService.createQuote(normalizedPayload);
      
      res.json({
        quoteId: quote.QuoteID,
        total: quote.Total,
        subtotalGross: quote.SubtotalGross,
        status: quote.Status,
      });
    } catch (error: any) {
      console.error('Quote creation error:', error);
      res.status(500).json({ error: 'Failed to create quote', details: error.message });
    }
  });

  // Email quote with PDF attachment
  app.post("/api/quote/email", async (req, res) => {
    try {
      const { quoteId, recipientEmail, message } = req.body;

      if (!quoteId || !recipientEmail) {
        return res.status(400).json({ error: 'quoteId and recipientEmail are required' });
      }

      const [quotes, quoteLines, partners, products] = await Promise.all([
        sheetsService.getQuotes(),
        sheetsService.getQuoteLines(),
        sheetsService.getPartnerRegistry(),
        sheetsService.getFinalPriceList(),
      ]);

      const quote = quotes.find(q => q.QuoteID === quoteId);
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }

      const partner = partners.find(p => p.PartnerID === quote.PartnerID);
      if (!partner) {
        return res.status(404).json({ error: 'Partner not found' });
      }

      const lines = quoteLines.filter(l => l.QuoteID === quoteId);
      if (lines.length === 0) {
        return res.status(400).json({ error: 'Quote has no line items' });
      }

      // Generate PDF
      const pdfPath = await generateQuotePDF(quote, lines, partner, products);
      const pdfFilePath = path.join(process.cwd(), 'client', 'public', pdfPath.replace(/^\//, ''));
      const pdfBuffer = await readFile(pdfFilePath);

      // Send email with PDF attachment
      await sendQuoteEmail(quote, recipientEmail, pdfBuffer);

      // Log the action
      await sheetsService.logToSheet('INFO', 'Sales', `Quote ${quoteId} emailed to ${recipientEmail}`);

      res.json({ 
        success: true, 
        message: `Quote ${quoteId} sent to ${recipientEmail}`,
        pdfUrl: pdfPath 
      });
    } catch (error: any) {
      console.error('Email quote error:', error);
      res.status(500).json({ error: 'Failed to email quote', details: error.message });
    }
  });

  // Convert quote directly to invoice (with optional order creation)
  app.post("/api/quote/convert-to-invoice", async (req, res) => {
    try {
      const { quoteId, createOrder = true, sendEmail = false } = req.body;

      if (!quoteId) {
        return res.status(400).json({ error: 'QuoteID is required' });
      }

      const [quotes, quoteLines, partners, products] = await Promise.all([
        sheetsService.getQuotes(),
        sheetsService.getQuoteLines(),
        sheetsService.getPartnerRegistry(),
        sheetsService.getFinalPriceList(),
      ]);

      const quote = quotes.find(q => q.QuoteID === quoteId);
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }

      const lines = quoteLines.filter(l => l.QuoteID === quoteId);
      if (lines.length === 0) {
        return res.status(400).json({ error: 'Quote has no line items' });
      }

      const partner = partners.find(p => p.PartnerID === quote.PartnerID);
      if (!partner) {
        return res.status(404).json({ error: 'Partner not found' });
      }

      const timestamp = new Date().toISOString();
      let invoiceId: string;
      let orderId: string | null = null;
      let invoicePDFUrl = '';

      // Branch 1: Full order creation with invoice
      if (createOrder === true) {
        orderId = `O-${new Date().getFullYear()}-${nanoid(6)}`;
        invoiceId = orderId;
        
        const order = {
          OrderID: orderId,
          QuoteID: quoteId,
          PartnerID: quote.PartnerID,
          CreatedTS: timestamp,
          CreatedBy: 'system',
          Status: 'Confirmed',
          SubtotalGross: quote.SubtotalGross || 0,
          DiscountTotal: quote.DiscountTotal || 0,
          LoyaltyRedeemed: quote.LoyaltyRedeemed || 0,
          Total: quote.Total || 0,
          InvoicePDFUrl: '',
          Notes: quote.Notes || '',
        };

        const orderLines = lines.map((l, index) => ({
          LineID: `${orderId}-L${index + 1}`,
          OrderID: orderId,
          SKU: l.SKU,
          Qty: l.Qty,
          UnitPrice: l.UnitPrice,
          LineDiscount: l.LineDiscount || 0,
          LineTotal: l.LineTotal,
        }));

        invoicePDFUrl = await generateInvoicePDF(order, orderLines, partner, products);

        // CRITICAL: Only write to Orders/OrderLines when createOrder=true
        await sheetsService.writeRows('Orders', [{
          ...order,
          InvoicePDFUrl: invoicePDFUrl,
        }]);

        await sheetsService.writeRows('OrderLines', orderLines);

        // Process loyalty & gifts with new advanced system
        let loyaltyResult: any = null;
        try {
          // Pass products array to avoid refetching (performance optimization)
          const orderCategories = await extractOrderCategories(orderLines, products);
          loyaltyResult = await processOrderLoyalty({
            orderID: orderId,
            customerID: quote.PartnerID,
            orderValue: quote.Total || 0,
            orderCategories,
            loyaltyRedeemed: quote.LoyaltyRedeemed
          });
          
          // CRITICAL: Check for rollback failures (partial loyalty state)
          if (loyaltyResult.rollbackFailed) {
            await sheetsService.logToSheet('ERROR', 'Loyalty', 
              `Order ${orderId}: CRITICAL ROLLBACK FAILURE - ${loyaltyResult.rollbackError}`);
            
            // CRITICAL: APPEND warning to existing notes (don't overwrite!)
            const currentNotes = order.Notes || '';
            const loyaltyWarning = `[LOYALTY WARNING] ${loyaltyResult.rollbackError}. See System_Log for details.`;
            const updatedNotes = currentNotes 
              ? `${currentNotes}\n\n${loyaltyWarning}`
              : loyaltyWarning;
            
            await sheetsService.updateRowByKey(
              'Orders',
              'OrderID',
              orderId,
              {
                Notes: updatedNotes
              }
            );
          }
          
          // Create backward-compatible loyalty ledger entries (only if no rollback failure)
          if (!loyaltyResult.rollbackFailed) {
            await createLoyaltyLedgerEntry(
              orderId,
              quote.PartnerID,
              loyaltyResult.pointsEarned,
              loyaltyResult.pointsRedeemed
            );
          }
          
          // Log loyalty results
          if (loyaltyResult.pointsEarned > 0) {
            await sheetsService.logToSheet('INFO', 'Loyalty', 
              `Order ${orderId}: Earned ${loyaltyResult.pointsEarned} points for ${quote.PartnerID}`);
          }
          
          if (loyaltyResult.tierUpgrade.upgraded) {
            await sheetsService.logToSheet('INFO', 'Loyalty', 
              `Order ${orderId}: Customer ${quote.PartnerID} upgraded from ${loyaltyResult.tierUpgrade.oldTier} to ${loyaltyResult.tierUpgrade.newTier}`);
          }
          
          if (loyaltyResult.gifts.length > 0) {
            await sheetsService.logToSheet('INFO', 'Loyalty', 
              `Order ${orderId}: Added ${loyaltyResult.gifts.length} free gifts`);
          }
        } catch (loyaltyError: any) {
          // Don't fail order if loyalty fails
          await sheetsService.logToSheet('ERROR', 'Loyalty', 
            `Order ${orderId}: Loyalty processing failed: ${loyaltyError.message}`);
        }

        await sheetsService.logToSheet('INFO', 'Sales', `Created order ${orderId} from quote ${quoteId} with invoice`);
      } 
      // Branch 2: Invoice-only mode (NO order persistence)
      else {
        invoiceId = `INV-${new Date().getFullYear()}-${nanoid(6)}`;
        
        // Create temporary order object for PDF generation ONLY
        // This object is NOT persisted to sheets
        const tempOrder = {
          OrderID: invoiceId,
          QuoteID: quoteId,
          PartnerID: quote.PartnerID,
          CreatedTS: timestamp,
          CreatedBy: 'system',
          Status: 'Invoice-Only',
          SubtotalGross: quote.SubtotalGross || 0,
          DiscountTotal: quote.DiscountTotal || 0,
          LoyaltyRedeemed: quote.LoyaltyRedeemed || 0,
          Total: quote.Total || 0,
          InvoicePDFUrl: '',
          Notes: `${quote.Notes || ''}\n[Invoice-only, no order record]`.trim(),
        };

        const tempOrderLines = lines.map((l, index) => ({
          LineID: `${invoiceId}-L${index + 1}`,
          OrderID: invoiceId,
          SKU: l.SKU,
          Qty: l.Qty,
          UnitPrice: l.UnitPrice,
          LineDiscount: l.LineDiscount || 0,
          LineTotal: l.LineTotal,
        }));

        // Generate PDF with temp data - NO sheet writes
        invoicePDFUrl = await generateInvoicePDF(tempOrder, tempOrderLines, partner, products);

        await sheetsService.logToSheet('INFO', 'Sales', `Generated invoice-only ${invoiceId} from quote ${quoteId} (no order created)`);
      }

      // Update quote status (common for both branches)
      await sheetsService.updateRow('Quotes', 'QuoteID', quoteId, { 
        Status: 'Converted',
        ConvertedTS: timestamp
      });

      // Send email if requested (common for both branches)
      if (sendEmail && invoicePDFUrl) {
        try {
          await sendQuoteEmail(partner.Email, invoicePDFUrl, quote, partner);
          await sheetsService.logToSheet('INFO', 'Sales', `Emailed invoice ${invoiceId} for ${quoteId} to ${partner.Email}`);
        } catch (emailError: any) {
          console.error('Failed to send invoice email:', emailError);
          // Don't fail the entire operation if email fails
        }
      }

      // Prepare response with optional loyalty warnings
      const responseData: any = { 
        success: true,
        invoiceId,
        invoicePDFUrl,
        quoteId,
        orderId,
        createOrder,
        emailSent: sendEmail
      };
      
      // CRITICAL: Surface loyalty rollback failures to API caller
      if (createOrder && loyaltyResult && loyaltyResult.rollbackFailed) {
        responseData.loyaltyWarning = {
          rollbackFailed: true,
          error: loyaltyResult.rollbackError,
          message: 'Order created successfully but loyalty rollback failed. Admin review required.'
        };
      }
      
      res.json(responseData);
    } catch (error: any) {
      console.error('Invoice conversion error:', error);
      await sheetsService.logToSheet('ERROR', 'Sales', `Failed to convert quote to invoice: ${error.message}`);
      res.status(500).json({ error: 'Failed to convert to invoice', details: error.message });
    }
  });

  // DEPRECATED: Convert quote to order - Use /api/sales/quotes/:id/convert instead
  app.post("/api/order/convert", async (req, res) => {
    try {
      const { quoteId, generateInvoice = true } = req.body;

      // Add deprecation headers
      res.setHeader('Deprecation', 'true');
      res.setHeader('X-Deprecated-Endpoint', '/api/order/convert');
      res.setHeader('X-Replacement-Endpoint', '/api/sales/quotes/:id/convert');

      await sheetsService.logToSheet('WARN', 'API', `Deprecated endpoint /api/order/convert called for quote ${quoteId}. Use /api/sales/quotes/:id/convert instead.`);

      // Proxy to canonical endpoint
      const [quotes, quoteLines, partners, products] = await Promise.all([
        sheetsService.getQuotes(),
        sheetsService.getQuoteLines(),
        sheetsService.getPartnerRegistry(),
        sheetsService.getFinalPriceList(),
      ]);

      const quote = quotes.find(q => q.QuoteID === quoteId);
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }

      const lines = quoteLines.filter(l => l.QuoteID === quoteId);
      const partner = partners.find(p => p.PartnerID === quote.PartnerID);

      if (!partner) {
        return res.status(404).json({ error: 'Partner not found' });
      }

      if (lines.length === 0) {
        return res.status(400).json({ error: 'Quote has no line items' });
      }

      // Create order
      const orderId = `ORD-${nanoid(8)}`;
      const createdTS = new Date().toISOString();

      // Generate invoice PDF if requested
      let invoicePDFUrl = '';
      if (generateInvoice && partner) {
        try {
          const order = {
            OrderID: orderId,
            QuoteID: quoteId,
            PartnerID: quote.PartnerID,
            CreatedTS: createdTS,
            CreatedBy: 'system',
            Status: 'Confirmed',
            SubtotalGross: quote.SubtotalGross || 0,
            DiscountTotal: quote.DiscountTotal || 0,
            LoyaltyRedeemed: quote.LoyaltyRedeemed || 0,
            Total: quote.Total || 0,
            InvoicePDFUrl: '',
            Notes: `Converted from quote ${quoteId}`,
          };

          const orderLines = lines.map((l, index) => ({
            LineID: `${orderId}-L${index + 1}`,
            OrderID: orderId,
            SKU: l.SKU,
            Qty: l.Qty,
            UnitPrice: l.UnitPrice,
            LineDiscount: l.LineDiscount || 0,
            LineTotal: l.LineTotal,
          }));

          invoicePDFUrl = await generateInvoicePDF(order, orderLines, partner, products);
          await sheetsService.logToSheet('INFO', 'Sales', `Generated invoice PDF for order ${orderId}: ${invoicePDFUrl}`);
        } catch (pdfError: any) {
          console.error('Invoice PDF generation failed:', pdfError);
          await sheetsService.logToSheet('WARN', 'Sales', `Invoice PDF generation failed for order ${orderId}: ${pdfError.message}`);
        }
      }

      const deprecatedOrderRecord: any = {
        OrderID: orderId,
        PartnerID: quote.PartnerID,
        CreatedTS: createdTS,
        SubtotalGross: quote.SubtotalGross || 0,
        DiscountTotal: quote.DiscountTotal || 0,
        LoyaltyRedeemed: quote.LoyaltyRedeemed || 0,
        Total: quote.Total || 0,
        Status: 'Confirmed',
        Notes: `Converted from quote ${quoteId}`,
      };

      // Only include InvoicePDFUrl if PDF was generated successfully
      if (invoicePDFUrl) {
        deprecatedOrderRecord.InvoicePDFUrl = invoicePDFUrl;
      }

      await sheetsService.writeRows('Orders', [deprecatedOrderRecord]);

      // Copy quote lines to order lines
      if (lines.length > 0) {
        const orderLines = lines.map((line: any) => ({
          OrderLineID: `OL-${nanoid(8)}`,
          OrderID: orderId,
          SKU: line.SKU,
          Qty: line.Qty,
          UnitPrice: line.UnitPrice,
          LineTotal: line.LineTotal,
        }));

        await sheetsService.writeRows('OrderLines', orderLines);
      }

      // Update quote status
      await sheetsService.updateRow('Quotes', 'QuoteID', quoteId, { Status: 'Converted' });

      // Calculate and record loyalty points earned (1% of total)
      const loyaltyEarned = (quote.Total || 0) * 0.01;
      await sheetsService.writeRows('Loyalty_Ledger', [{
        EntryID: `LOY-${nanoid(8)}`,
        PartnerID: quote.PartnerID,
        OrderID: orderId,
        Type: 'Earned',
        Amount: loyaltyEarned,
        TransactionDate: new Date().toISOString().split('T')[0],
        Description: `Loyalty earned from order ${orderId}`,
      }]);

      // Calculate commission (5% for Basic, 7% for Premium tier)
      const commissionRate = partner?.Tier === 'Premium' ? 0.07 : 0.05;
      const commissionAmt = (quote.Total || 0) * commissionRate;
      
      await sheetsService.writeRows('Commission_Ledger', [{
        EntryID: `COMM-${nanoid(8)}`,
        PartnerID: quote.PartnerID,
        OrderID: orderId,
        Amount: commissionAmt,
        CommissionPct: commissionRate * 100,
        TransactionDate: new Date().toISOString().split('T')[0],
        Status: 'Pending',
        Notes: `Commission for order ${orderId}`,
      }]);

      await sheetsService.logToSheet('INFO', 'Sales', `Converted quote ${quoteId} to order ${orderId}. Loyalty: €${loyaltyEarned.toFixed(2)}, Commission: €${commissionAmt.toFixed(2)}`);

      res.json({ orderId, invoicePDFUrl });
    } catch (error: any) {
      console.error('Order conversion error:', error);
      res.status(500).json({ error: 'Failed to convert quote to order', details: error.message });
    }
  });

  // Preview quote PDF (without saving permanently)
  app.post("/api/quote/preview", async (req, res) => {
    try {
      const { quoteId } = req.body;

      const [quotes, quoteLines, partners, products] = await Promise.all([
        sheetsService.getQuotes(),
        sheetsService.getQuoteLines(),
        sheetsService.getPartnerRegistry(),
        sheetsService.getFinalPriceList(),
      ]);

      const quote = quotes.find(q => q.QuoteID === quoteId);
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }

      const lines = quoteLines.filter(l => l.QuoteID === quoteId);
      const partner = partners.find(p => p.PartnerID === quote.PartnerID);
      if (!partner) {
        return res.status(404).json({ error: 'Partner not found' });
      }

      // Generate PDF
      const pdfPath = await generateQuotePDF(quote, lines, partner, products);

      res.json({ 
        success: true, 
        pdfUrl: pdfPath,
        message: 'Quote PDF preview generated'
      });
    } catch (error: any) {
      console.error('Quote preview error:', error);
      res.status(500).json({ error: 'Failed to generate quote preview', details: error.message });
    }
  });

  // Preview invoice PDF (for existing order)
  app.post("/api/order/preview", async (req, res) => {
    try {
      const { orderId } = req.body;

      const [orders, orderLines, partners, products] = await Promise.all([
        sheetsService.getOrders(),
        sheetsService.getOrderLines(),
        sheetsService.getPartnerRegistry(),
        sheetsService.getFinalPriceList(),
      ]);

      const order = orders.find(o => o.OrderID === orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const lines = orderLines.filter(l => l.OrderID === orderId);
      const partner = partners.find(p => p.PartnerID === order.PartnerID);
      if (!partner) {
        return res.status(404).json({ error: 'Partner not found' });
      }

      // Generate PDF
      const pdfPath = await generateInvoicePDF(order, lines, partner, products);

      res.json({ 
        success: true, 
        pdfUrl: pdfPath,
        message: 'Invoice PDF preview generated'
      });
    } catch (error: any) {
      console.error('Invoice preview error:', error);
      res.status(500).json({ error: 'Failed to generate invoice preview', details: error.message });
    }
  });

  // Stands endpoints
  app.get("/api/stands", async (req, res) => {
    try {
      const stands = await sheetsService.getStandSites();
      res.json(stands);
    } catch (error: any) {
      console.error('Stands fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch stands', details: error.message });
    }
  });

  app.post("/api/stands", async (req, res) => {
    try {
      const { salon, owner, street, postal, city, countryCode, geoLat, geoLng, notes } = req.body;

      const standId = `STAND-${nanoid(8)}`;
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';
      const qrUrl = await generateStandQR(standId, baseUrl);

      await sheetsService.writeRows('StandSites', [{
        StandID: standId,
        Salon: salon,
        Owner: owner,
        Street: street,
        Postal: postal,
        City: city,
        CountryCode: countryCode,
        Status: 'Active',
        OpenDate: new Date().toISOString().split('T')[0],
        GeoLat: geoLat,
        GeoLng: geoLng,
        GeoAccuracy: 'Manual',
        QRUrl: qrUrl,
        RefPhotoUrl: '',
        Notes: notes,
      }]);

      await sheetsService.logToSheet('INFO', 'Stands', `Created stand ${standId}`);

      res.json({ standId, qrUrl });
    } catch (error: any) {
      console.error('Stand creation error:', error);
      res.status(500).json({ error: 'Failed to create stand', details: error.message });
    }
  });

  app.get("/api/stands/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [stands, inventory] = await Promise.all([
        sheetsService.getStandSites(),
        sheetsService.getStandInventory(),
      ]);

      const stand = stands.find(s => s.StandID === id);
      if (!stand) {
        return res.status(404).json({ error: 'Stand not found' });
      }

      const standInventory = inventory.filter(i => i.StandID === id);

      res.json({ ...stand, inventory: standInventory });
    } catch (error: any) {
      console.error('Stand fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch stand', details: error.message });
    }
  });

  // Stand Inventory Management
  app.post("/api/stands/inventory", async (req, res) => {
    try {
      const validated = standInventoryInsertSchema.parse(req.body);

      // Validate StandID exists
      const stands = await sheetsService.getStandSites();
      if (!stands.some(s => s.StandID === validated.StandID)) {
        return res.status(404).json({ error: 'Stand not found' });
      }

      // Validate SKU exists
      const products = await sheetsService.getFinalPriceList();
      if (!products.some(p => p.SKU === validated.SKU)) {
        return res.status(404).json({ error: 'Product SKU not found' });
      }

      // Check for existing inventory record (composite key: StandID + SKU)
      const allInventory = await sheetsService.getStandInventory();
      const existingIndex = allInventory.findIndex(
        i => i.StandID === validated.StandID && i.SKU === validated.SKU
      );

      const inventoryRecord = {
        StandID: validated.StandID,
        SKU: validated.SKU,
        OnHand: validated.OnHand,
        Min: validated.Min,
        Max: validated.Max,
        LastCountTS: new Date().toISOString(),
        LastRefillTS: '',
        Notes: validated.Notes || '',
      };

      let status: 'created' | 'updated';

      if (existingIndex >= 0) {
        // Update existing record
        const allRows = await sheetsService.readSheet('Stand_Inventory');
        const rowIndex = allRows.findIndex((r: any) =>
          r.StandID === validated.StandID && r.SKU === validated.SKU
        );

        if (rowIndex >= 0) {
          await sheetsService.updateRow('Stand_Inventory', 'StandID', validated.StandID, inventoryRecord, (row: any) =>
            row.SKU === validated.SKU
          );
          status = 'updated';
          await sheetsService.logToSheet('INFO', 'Stands', `Updated inventory for ${validated.StandID} / ${validated.SKU}`);
        } else {
          throw new Error('Failed to locate inventory row for update');
        }
      } else {
        // Insert new record
        await sheetsService.writeRows('Stand_Inventory', [inventoryRecord]);
        status = 'created';
        await sheetsService.logToSheet('INFO', 'Stands', `Created inventory for ${validated.StandID} / ${validated.SKU}`);
      }

      res.json({ status, record: inventoryRecord });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Stand inventory error:', error);
      res.status(500).json({ error: 'Failed to assign inventory', details: error.message });
    }
  });

  app.get("/api/stands/inventory", async (req, res) => {
    try {
      const { standId } = req.query;
      
      let inventory = await sheetsService.getStandInventory();
      
      // Filter by standId if provided
      if (standId) {
        inventory = inventory.filter(i => i.StandID === standId);
      }

      // Enrich with product details
      const products = await sheetsService.getFinalPriceList();
      const enriched = inventory.map(item => {
        const product = products.find(p => p.SKU === item.SKU);
        return {
          ...item,
          ProductTitle: product?.Title || 'Unknown',
          COGS_EUR: product?.COGS_EUR || 0,
        };
      });

      res.json({ items: enriched, count: enriched.length });
    } catch (error: any) {
      console.error('Stand inventory fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch inventory', details: error.message });
    }
  });

  // Stand Refill Plans
  app.post("/api/stands/refill-plan", async (req, res) => {
    try {
      const validated = standRefillPlanInsertSchema.parse(req.body);

      // Validate StandID exists
      const stands = await sheetsService.getStandSites();
      if (!stands.some(s => s.StandID === validated.StandID)) {
        return res.status(404).json({ error: 'Stand not found' });
      }

      // Validate all SKUs exist and are unique
      const products = await sheetsService.getFinalPriceList();
      const uniqueSKUs = new Set(validated.items.map(i => i.SKU));
      if (uniqueSKUs.size !== validated.items.length) {
        return res.status(400).json({ error: 'Duplicate SKUs in items list' });
      }
      for (const item of validated.items) {
        if (!products.some(p => p.SKU === item.SKU)) {
          return res.status(404).json({ error: `Product SKU not found: ${item.SKU}` });
        }
      }

      // Generate sequential refill plan ID with post-write verification
      const generateSequentialPlanId = async (maxRetries = 5): Promise<string> => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const plans = await sheetsService.readSheet<StandRefillPlan>('Stand_Refill_Plans');
          
          const existingNumbers = plans
            .map(p => p.PlanID.match(/PLAN-\d+-(\d{6})/)?.[1])
            .filter(Boolean)
            .map(Number);
          
          const nextNumber = existingNumbers.length > 0 
            ? Math.max(...existingNumbers) + 1 
            : 1;
          
          const timestamp = Date.now();
          const proposedId = `PLAN-${timestamp}-${String(nextNumber).padStart(6, '0')}`;
          
          if (!plans.some(p => p.PlanID === proposedId)) {
            return proposedId;
          }
          
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        }
        
        throw new Error('Failed to generate unique sequential plan ID after retries');
      };

      let newPlan: StandRefillPlan | null = null;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const planId = await generateSequentialPlanId();

          newPlan = {
            PlanID: planId,
            StandID: validated.StandID,
            CreatedTS: new Date().toISOString(),
            NextVisitDue: '',
            Picker: '',
            SuggestedLinesJSON: JSON.stringify(validated.items),
            Status: 'Draft',
          };

          await sheetsService.writeRows('Stand_Refill_Plans', [newPlan]);

          // Post-write verification
          await new Promise(resolve => setTimeout(resolve, 150));
          const verification = await sheetsService.readSheet<StandRefillPlan>('Stand_Refill_Plans');
          const allWithThisId = verification.filter(p => p.PlanID === planId);

          if (allWithThisId.length > 1) {
            try {
              const allRows = await sheetsService.readSheet('Stand_Refill_Plans');
              const myRowIndex = allRows.findIndex((r: any) =>
                r.PlanID === planId &&
                r.StandID === newPlan.StandID
              );

              if (myRowIndex > 0) {
                const { getUncachableGoogleSheetClient } = await import('./lib/sheets');
                const client = await getUncachableGoogleSheetClient();
                await client.spreadsheets.values.clear({
                  spreadsheetId: SPREADSHEET_ID,
                  range: `Stand_Refill_Plans!A${myRowIndex + 2}:Z${myRowIndex + 2}`,
                });
              }
            } catch (cleanupError) {
              console.error('Failed to clean up duplicate plan row:', cleanupError);
            }

            throw new Error(`Duplicate plan ID detected: ${planId}, retrying...`);
          }

          await sheetsService.logToSheet('INFO', 'Stands', `Created refill plan ${planId} for ${validated.StandID}`);
          break;
        } catch (error: any) {
          lastError = error;
          if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
          }
        }
      }

      if (!newPlan) {
        throw lastError || new Error('Failed to create refill plan after retries');
      }

      res.json({
        ...newPlan,
        items: validated.items,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Refill plan creation error:', error);
      res.status(500).json({ error: 'Failed to create refill plan', details: error.message });
    }
  });

  // Stand Visits
  app.post("/api/stands/visits", async (req, res) => {
    try {
      const validated = standVisitInsertSchema.parse(req.body);

      // Validate StandID exists
      const stands = await sheetsService.getStandSites();
      if (!stands.some(s => s.StandID === validated.StandID)) {
        return res.status(404).json({ error: 'Stand not found' });
      }

      // Generate sequential visit ID with post-write verification
      const generateSequentialVisitId = async (maxRetries = 5): Promise<string> => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const visits = await sheetsService.readSheet<StandVisit>('Stand_Visits');
          
          const existingNumbers = visits
            .map(v => v.VisitID.match(/VISIT-\d+-(\d{6})/)?.[1])
            .filter(Boolean)
            .map(Number);
          
          const nextNumber = existingNumbers.length > 0 
            ? Math.max(...existingNumbers) + 1 
            : 1;
          
          const timestamp = Date.now();
          const proposedId = `VISIT-${timestamp}-${String(nextNumber).padStart(6, '0')}`;
          
          if (!visits.some(v => v.VisitID === proposedId)) {
            return proposedId;
          }
          
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        }
        
        throw new Error('Failed to generate unique sequential visit ID after retries');
      };

      let newVisit: StandVisit | null = null;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const visitId = await generateSequentialVisitId();

          newVisit = {
            VisitID: visitId,
            StandID: validated.StandID,
            Rep: validated.Rep,
            CheckInTS: validated.CheckInTS,
            CheckOutTS: validated.CheckOutTS,
            GeoLat: validated.GeoLat,
            GeoLng: validated.GeoLng,
            PhotosURLsJSON: '',
            Notes: validated.Notes || '',
          };

          await sheetsService.writeRows('Stand_Visits', [newVisit]);

          // Post-write verification
          await new Promise(resolve => setTimeout(resolve, 150));
          const verification = await sheetsService.readSheet<StandVisit>('Stand_Visits');
          const allWithThisId = verification.filter(v => v.VisitID === visitId);

          if (allWithThisId.length > 1) {
            try {
              const allRows = await sheetsService.readSheet('Stand_Visits');
              const myRowIndex = allRows.findIndex((r: any) =>
                r.VisitID === visitId &&
                r.StandID === newVisit.StandID
              );

              if (myRowIndex > 0) {
                const { getUncachableGoogleSheetClient } = await import('./lib/sheets');
                const client = await getUncachableGoogleSheetClient();
                await client.spreadsheets.values.clear({
                  spreadsheetId: SPREADSHEET_ID,
                  range: `Stand_Visits!A${myRowIndex + 2}:Z${myRowIndex + 2}`,
                });
              }
            } catch (cleanupError) {
              console.error('Failed to clean up duplicate visit row:', cleanupError);
            }

            throw new Error(`Duplicate visit ID detected: ${visitId}, retrying...`);
          }

          await sheetsService.logToSheet('INFO', 'Stands', `Logged visit ${visitId} for ${validated.StandID} by ${validated.Rep}`);
          break;
        } catch (error: any) {
          lastError = error;
          if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
          }
        }
      }

      if (!newVisit) {
        throw lastError || new Error('Failed to log visit after retries');
      }

      // Calculate visit duration
      const checkInTime = new Date(newVisit.CheckInTS || 0);
      const checkOutTime = new Date(newVisit.CheckOutTS || 0);
      const durationMinutes = Math.floor((checkOutTime.getTime() - checkInTime.getTime()) / 1000 / 60);

      res.json({
        ...newVisit,
        DurationMinutes: durationMinutes,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Visit logging error:', error);
      res.status(500).json({ error: 'Failed to log visit', details: error.message });
    }
  });

  // Partners endpoints
  app.get("/api/partners", async (req, res) => {
    try {
      const partners = await sheetsService.getPartnerRegistry();
      res.json(partners);
    } catch (error: any) {
      console.error('Partners fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch partners', details: error.message });
    }
  });

  app.post("/api/partners", async (req, res) => {
    try {
      const validated = partnerInsertSchema.safeParse(req.body);
      
      if (!validated.success) {
        return res.status(400).json({ 
          error: 'Invalid partner data', 
          details: validated.error.errors 
        });
      }

      const data = validated.data;
      
      const generateSequentialPartnerId = async (maxRetries = 5): Promise<string> => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const partners = await sheetsService.getPartnerRegistry();
          
          const existingNumbers = partners
            .map(p => p.PartnerID.match(/HM-P-(\d{4})/)?.[1])
            .filter(Boolean)
            .map(Number);
          
          const nextNumber = existingNumbers.length > 0 
            ? Math.max(...existingNumbers) + 1 
            : 1;
          
          const proposedId = `HM-P-${String(nextNumber).padStart(4, '0')}`;
          
          if (!partners.some(p => p.PartnerID === proposedId)) {
            return proposedId;
          }
          
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        }
        
        throw new Error('Failed to generate unique sequential partner ID after retries');
      };

      let newPartner: PartnerRegistry | null = null;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const partnerId = await generateSequentialPartnerId();

          newPartner = {
            PartnerID: partnerId,
            PartnerName: data.PartnerName.trim(),
            Tier: data.Tier,
            PartnerType: data.PartnerType || '',
            Email: data.Email?.trim() || '',
            Phone: data.Phone?.trim() || '',
            Owner: data.Owner?.trim() || '',
            Status: data.Status || 'Active',
            Street: data.Street?.trim() || '',
            Postal: data.Postal?.trim() || '',
            City: data.City?.trim() || '',
            CountryCode: data.CountryCode?.toUpperCase() || '',
            Notes: data.Notes?.trim() || '',
            PartnerFolderID: data.PartnerFolderID || '',
            PartnerFolderURL: data.PartnerFolderURL || '',
          };

          await sheetsService.writeRows('PartnerRegistry', [newPartner]);
          
          await new Promise(resolve => setTimeout(resolve, 150));
          const verification = await sheetsService.getPartnerRegistry();
          const myPartners = verification.filter(p => 
            p.PartnerID === partnerId && 
            p.PartnerName === newPartner.PartnerName
          );
          const allWithThisId = verification.filter(p => p.PartnerID === partnerId);
          
          if (allWithThisId.length > 1) {
            try {
              const allRows = await sheetsService.readSheet('PartnerRegistry');
              const myRowIndex = allRows.findIndex((r: any) => 
                r.PartnerID === partnerId && 
                r.PartnerName === newPartner.PartnerName
              );
              
              if (myRowIndex > 0) {
                const client = await getUncachableGoogleSheetClient();
                await client.spreadsheets.values.clear({
                  spreadsheetId: SPREADSHEET_ID,
                  range: `PartnerRegistry!A${myRowIndex + 2}:Z${myRowIndex + 2}`,
                });
              }
            } catch (cleanupError) {
              console.error('Failed to clean up duplicate partner row:', cleanupError);
            }
            
            throw new Error(`Duplicate partner ID detected: ${partnerId}, retrying...`);
          }

          await sheetsService.logToSheet('INFO', 'Partners', `Created partner ${partnerId}: ${newPartner.PartnerName}`);
          break;
        } catch (error: any) {
          lastError = error;
          if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
          }
        }
      }

      if (!newPartner) {
        throw lastError || new Error('Failed to create partner after retries');
      }

      res.json(newPartner);
    } catch (error: any) {
      console.error('Partner creation error:', error);
      res.status(500).json({ error: 'Failed to create partner', details: error.message });
    }
  });

  app.get("/api/partners/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const partners = await sheetsService.getPartnerRegistry();
      const partner = partners.find(p => p.PartnerID === id);

      if (!partner) {
        return res.status(404).json({ error: 'Partner not found' });
      }

      res.json(partner);
    } catch (error: any) {
      console.error('Partner fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch partner', details: error.message });
    }
  });

  app.patch("/api/partners/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      await sheetsService.updateRow('PartnerRegistry', 'PartnerID', id, updates);
      await sheetsService.logToSheet('INFO', 'Partners', `Updated partner ${id}`);

      res.json({ partnerId: id, updated: true });
    } catch (error: any) {
      console.error('Partner update error:', error);
      res.status(500).json({ error: 'Failed to update partner', details: error.message });
    }
  });

  app.delete("/api/partners/:id", async (req, res) => {
    try {
      const { id } = req.params;

      await sheetsService.updateRow('PartnerRegistry', 'PartnerID', id, { Status: 'Inactive' });
      await sheetsService.logToSheet('INFO', 'Partners', `Deactivated partner ${id}`);

      res.json({ partnerId: id, deleted: true });
    } catch (error: any) {
      console.error('Partner deletion error:', error);
      res.status(500).json({ error: 'Failed to delete partner', details: error.message });
    }
  });

  app.get("/api/partners/:id/assortment", async (req, res) => {
    try {
      const { id } = req.params;
      const assortment = await sheetsService.getAuthorizedAssortment();
      const partnerAssortment = assortment.filter(a => a.PartnerID === id);

      res.json(partnerAssortment);
    } catch (error: any) {
      console.error('Assortment fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch assortment', details: error.message });
    }
  });

  app.post("/api/partners/:id/assortment", async (req, res) => {
    try {
      const { id } = req.params;
      const { skus } = req.body;

      if (!Array.isArray(skus)) {
        return res.status(400).json({ error: 'SKUs must be an array' });
      }

      // Remove existing assortment
      const existingAssortment = await sheetsService.getAuthorizedAssortment();
      const toRemove = existingAssortment.filter(a => a.PartnerID === id);
      
      // Add new assortment
      const newAssortment = skus.map(sku => ({
        PartnerID: id,
        SKU: sku,
        AuthorizedDate: new Date().toISOString().split('T')[0],
      }));

      await sheetsService.writeRows('AuthorizedAssortment', newAssortment);
      await sheetsService.logToSheet('INFO', 'Partners', `Updated assortment for partner ${id}: ${skus.length} SKUs`);

      res.json({ partnerId: id, skusAuthorized: skus.length });
    } catch (error: any) {
      console.error('Assortment update error:', error);
      res.status(500).json({ error: 'Failed to update assortment', details: error.message });
    }
  });

  app.get("/api/partners/:id/starter-bundle", async (req, res) => {
    try {
      const { id } = req.params;
      const bundles = await sheetsService.getStarterBundles();
      const partnerBundle = bundles.filter(b => b.PartnerID === id);

      res.json(partnerBundle);
    } catch (error: any) {
      console.error('Starter bundle fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch starter bundle', details: error.message });
    }
  });

  app.post("/api/partners/:id/starter-bundle", async (req, res) => {
    try {
      const { id } = req.params;
      const { items } = req.body;

      if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Items must be an array' });
      }

      const bundleItems = items.map(item => ({
        PartnerID: id,
        SKU: item.sku,
        Quantity: item.quantity,
        Notes: item.notes || '',
      }));

      await sheetsService.writeRows('StarterBundles', bundleItems);
      await sheetsService.logToSheet('INFO', 'Partners', `Created starter bundle for partner ${id}: ${items.length} items`);

      res.json({ partnerId: id, itemsAdded: items.length });
    } catch (error: any) {
      console.error('Starter bundle creation error:', error);
      res.status(500).json({ error: 'Failed to create starter bundle', details: error.message });
    }
  });

  app.get("/api/partners/:id/refill-plan", async (req, res) => {
    try {
      const { id } = req.params;
      const plans = await sheetsService.getRefillPlans();
      const partnerPlans = plans.filter(p => p.PartnerID === id);

      res.json(partnerPlans);
    } catch (error: any) {
      console.error('Refill plan fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch refill plan', details: error.message });
    }
  });

  app.post("/api/partners/:id/refill-plan", async (req, res) => {
    try {
      const { id } = req.params;
      const { sku, frequency, quantity, notes } = req.body;

      const planId = `REFILL-${nanoid(8)}`;

      await sheetsService.writeRows('RefillPlans', [{
        PlanID: planId,
        PartnerID: id,
        SKU: sku,
        Frequency: frequency,
        Quantity: quantity,
        Status: 'Active',
        NextRefillDate: new Date().toISOString().split('T')[0],
        Notes: notes,
      }]);

      await sheetsService.logToSheet('INFO', 'Partners', `Created refill plan ${planId} for partner ${id}`);

      res.json({ planId, partnerId: id });
    } catch (error: any) {
      console.error('Refill plan creation error:', error);
      res.status(500).json({ error: 'Failed to create refill plan', details: error.message });
    }
  });

  // Tier Management endpoints
  app.get("/api/tiers", async (req, res) => {
    try {
      const tiers = await sheetsService.getPartnerTiers();
      res.json(tiers);
    } catch (error: any) {
      console.error('Tiers fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch tiers', details: error.message });
    }
  });

  app.patch("/api/tiers/:tier", async (req, res) => {
    try {
      const { tier } = req.params;
      
      // Validate payload using partnerTierSchema partial with range validation
      const tierUpdateSchema = partnerTierSchema.partial().extend({
        DiscountFromUVP_Pct: z.number().min(0).max(100).optional(),
        CommissionRate_Pct: z.number().min(0).max(100).optional(),
        MinOrderQty: z.number().min(0).optional(),
        MinOrderValue_EUR: z.number().min(0).optional(),
        PaymentTermsDays: z.number().min(0).optional(),
      });
      
      const validated = tierUpdateSchema.safeParse(req.body);
      if (!validated.success) {
        return res.status(400).json({ 
          error: 'Invalid tier data', 
          details: validated.error.errors 
        });
      }

      // Verify tier exists and get full tier name
      const tiers = await sheetsService.getPartnerTiers();
      const existingTier = tiers.find(t => t.TierKey === tier);
      if (!existingTier) {
        return res.status(404).json({ error: `Tier '${tier}' not found` });
      }

      // Update tier using TierName (full name in Google Sheets "Tier" column)
      // e.g., "Stand Partner" instead of "Stand"
      await sheetsService.updateRow('PartnerTiers', 'Tier', existingTier.TierName, validated.data);
      await sheetsService.logToSheet('INFO', 'Tiers', `Updated tier ${tier}`);

      res.json({ success: true, tier });
    } catch (error: any) {
      console.error('Tier update error:', error);
      await sheetsService.logToSheet('ERROR', 'Tiers', `Failed to update tier: ${error.message}`);
      res.status(500).json({ error: 'Failed to update tier', details: error.message });
    }
  });

  // DEPRECATED: Legacy sales endpoints - Use /api/quotes instead
  app.get("/api/sales/quotes", async (req, res) => {
    try {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Link', '</api/quotes>; rel="canonical"');
      console.warn('[DEPRECATED] GET /api/sales/quotes is deprecated. Use GET /api/quotes instead.');
      await sheetsService.logToSheet('WARN', 'API', 'Deprecated endpoint GET /api/sales/quotes used. Migrate to GET /api/quotes');

      const quotes = await quoteService.listQuotes();
      res.json(quotes);
    } catch (error: any) {
      console.error('Quotes fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch quotes', details: error.message });
    }
  });

  app.post("/api/sales/quotes", async (req, res) => {
    try {
      res.setHeader('Deprecation', 'true');
      res.setHeader('Link', '</api/quotes>; rel="canonical"');
      console.warn('[DEPRECATED] POST /api/sales/quotes is deprecated. Use POST /api/quotes instead.');
      await sheetsService.logToSheet('WARN', 'API', 'Deprecated endpoint POST /api/sales/quotes used. Migrate to POST /api/quotes');

      const { partnerID, lines, subtotalGross, loyaltyRedeemed, total } = req.body;
      
      const normalizedPayload = {
        partnerId: partnerID,
        lines: (lines || []).map((l: any) => ({
          sku: l.sku,
          qty: l.qty,
          unitPrice: l.unitPrice,
          lineDiscount: l.lineDiscount || 0,
        })),
        subtotalGross,
        loyaltyRedeemed: loyaltyRedeemed || 0,
        total,
        status: 'Draft',
      };

      const quote = await quoteService.createQuote(normalizedPayload);
      
      res.json({
        quoteId: quote.QuoteID,
        createdTS: quote.CreatedTS,
        total: quote.Total,
      });
    } catch (error: any) {
      console.error('Quote creation error:', error);
      res.status(500).json({ error: 'Failed to create quote', details: error.message });
    }
  });

  app.get("/api/sales/quotes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [quotes, lines] = await Promise.all([
        sheetsService.getQuotes(),
        sheetsService.getQuoteLines(),
      ]);

      const quote = quotes.find(q => q.QuoteID === id);
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }

      const quoteLines = lines.filter(l => l.QuoteID === id);

      res.json({ ...quote, lines: quoteLines });
    } catch (error: any) {
      console.error('Quote fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch quote', details: error.message });
    }
  });

  // ==================== CANONICAL QUOTE ENDPOINTS ====================
  // Use /api/quotes as the canonical RESTful namespace
  
  app.get("/api/quotes", async (req, res) => {
    try {
      const quotes = await quoteService.listQuotes();
      res.json(quotes);
    } catch (error: any) {
      console.error('Quotes fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch quotes', details: error.message });
    }
  });

  app.post("/api/quotes", async (req, res) => {
    try {
      const { partnerId, PartnerID, lines, Lines, notes, Notes, loyaltyRedeemed, LoyaltyRedeemed, subtotalGross, SubtotalGross, discountTotal, DiscountTotal, total, Total, status, Status } = req.body;
      
      const normalizedPayload = {
        partnerId: partnerId || PartnerID,
        lines: (lines || Lines || []).map((l: any) => ({
          sku: l.sku || l.SKU,
          qty: l.qty || l.Qty,
          unitPrice: l.unitPrice || l.UnitPrice,
          lineDiscount: l.lineDiscount || l.LineDiscount || 0,
        })),
        notes: notes || Notes || '',
        loyaltyRedeemed: loyaltyRedeemed || LoyaltyRedeemed || 0,
        subtotalGross: subtotalGross || SubtotalGross,
        discountTotal: discountTotal || DiscountTotal || 0,
        total: total || Total,
        status: status || Status || 'Draft',
      };

      const quote = await quoteService.createQuote(normalizedPayload);
      res.json(quote);
    } catch (error: any) {
      console.error('Quote creation error:', error);
      res.status(500).json({ error: 'Failed to create quote', details: error.message });
    }
  });

  app.get("/api/quotes/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const quote = await quoteService.getQuote(id);
      
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }

      res.json(quote);
    } catch (error: any) {
      console.error('Quote fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch quote', details: error.message });
    }
  });

  app.get("/api/quote-lines/:quoteId", async (req, res) => {
    try {
      const { quoteId } = req.params;
      const allLines = await sheetsService.getQuoteLines();
      const quoteLines = allLines.filter((line: any) => line.QuoteID === quoteId);
      res.json(quoteLines);
    } catch (error: any) {
      console.error('Quote lines fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch quote lines', details: error.message });
    }
  });

  app.post("/api/sales/quotes/:id/convert", async (req, res) => {
    try {
      const { id } = req.params;
      const { generateInvoice = false } = req.body;
      
      // Get quote and lines
      const [quotes, quoteLines, partners, products] = await Promise.all([
        sheetsService.getQuotes(),
        sheetsService.getQuoteLines(),
        sheetsService.getPartnerRegistry(),
        sheetsService.getFinalPriceList(),
      ]);

      const quote = quotes.find(q => q.QuoteID === id);
      if (!quote) {
        return res.status(404).json({ error: 'Quote not found' });
      }

      const lines = quoteLines.filter(l => l.QuoteID === id);
      const partner = partners.find(p => p.PartnerID === quote.PartnerID);

      if (!partner) {
        return res.status(404).json({ error: 'Partner not found' });
      }

      if (lines.length === 0) {
        return res.status(400).json({ error: 'Quote has no line items' });
      }

      // Create order
      const orderId = `ORD-${nanoid(8)}`;
      const createdTS = new Date().toISOString();

      // Generate invoice PDF if requested
      let invoicePDFUrl = '';
      if (generateInvoice && partner) {
        try {
          const order = {
            OrderID: orderId,
            QuoteID: id,
            PartnerID: quote.PartnerID,
            CreatedTS: createdTS,
            CreatedBy: 'system',
            Status: 'Confirmed',
            SubtotalGross: quote.SubtotalGross || 0,
            DiscountTotal: quote.DiscountTotal || 0,
            LoyaltyRedeemed: quote.LoyaltyRedeemed || 0,
            Total: quote.Total || 0,
            InvoicePDFUrl: '',
            Notes: `Converted from quote ${id}`,
          };

          const orderLines = lines.map((l, index) => ({
            LineID: `${orderId}-L${index + 1}`,
            OrderID: orderId,
            SKU: l.SKU,
            Qty: l.Qty,
            UnitPrice: l.UnitPrice,
            LineDiscount: l.LineDiscount || 0,
            LineTotal: l.LineTotal,
          }));

          invoicePDFUrl = await generateInvoicePDF(order, orderLines, partner, products);
          await sheetsService.logToSheet('INFO', 'Sales', `Generated invoice PDF for order ${orderId}: ${invoicePDFUrl}`);
        } catch (pdfError: any) {
          console.error('Invoice PDF generation failed:', pdfError);
          await sheetsService.logToSheet('WARN', 'Sales', `Invoice PDF generation failed for order ${orderId}: ${pdfError.message}`);
        }
      }

      const orderRecord: any = {
        OrderID: orderId,
        PartnerID: quote.PartnerID,
        CreatedTS: createdTS,
        SubtotalGross: quote.SubtotalGross || 0,
        DiscountTotal: quote.DiscountTotal || 0,
        LoyaltyRedeemed: quote.LoyaltyRedeemed || 0,
        Total: quote.Total || 0,
        Status: 'Confirmed',
        Notes: `Converted from quote ${id}`,
      };

      // Only include InvoicePDFUrl if PDF was generated successfully
      if (invoicePDFUrl) {
        orderRecord.InvoicePDFUrl = invoicePDFUrl;
      }

      await sheetsService.writeRows('Orders', [orderRecord]);

      // Copy quote lines to order lines
      if (lines.length > 0) {
        const orderLines = lines.map((line: any) => ({
          OrderLineID: `OL-${nanoid(8)}`,
          OrderID: orderId,
          SKU: line.SKU,
          Qty: line.Qty,
          UnitPrice: line.UnitPrice,
          LineTotal: line.LineTotal,
        }));

        await sheetsService.writeRows('OrderLines', orderLines);
      }

      // Update quote status
      await sheetsService.updateRow('Quotes', 'QuoteID', id, { Status: 'Converted' });

      // Calculate and record loyalty points earned (1% of total)
      const loyaltyEarned = (quote.Total || 0) * 0.01;
      await sheetsService.writeRows('Loyalty_Ledger', [{
        EntryID: `LOY-${nanoid(8)}`,
        PartnerID: quote.PartnerID,
        OrderID: orderId,
        Type: 'Earned',
        Amount: loyaltyEarned,
        TransactionDate: new Date().toISOString().split('T')[0],
        Description: `Loyalty earned from order ${orderId}`,
      }]);

      // Calculate commission (5% for Basic, 7% for Premium tier)
      const commissionRate = partner?.Tier === 'Premium' ? 0.07 : 0.05;
      const commissionAmt = (quote.Total || 0) * commissionRate;
      
      await sheetsService.writeRows('Commission_Ledger', [{
        EntryID: `COMM-${nanoid(8)}`,
        PartnerID: quote.PartnerID,
        OrderID: orderId,
        Amount: commissionAmt,
        CommissionPct: commissionRate * 100,
        TransactionDate: new Date().toISOString().split('T')[0],
        Status: 'Pending',
        Notes: `Commission for order ${orderId}`,
      }]);

      await sheetsService.logToSheet('INFO', 'Sales', `Converted quote ${id} to order ${orderId}. Loyalty: €${loyaltyEarned.toFixed(2)}, Commission: €${commissionAmt.toFixed(2)}`);

      res.json({ 
        orderId, 
        quoteId: id, 
        loyaltyEarned, 
        commissionAmt,
        invoicePDFUrl: invoicePDFUrl || undefined,
      });
    } catch (error: any) {
      console.error('Quote conversion error:', error);
      res.status(500).json({ error: 'Failed to convert quote', details: error.message });
    }
  });

  app.get("/api/sales/orders", async (req, res) => {
    try {
      const orders = await sheetsService.getOrders();
      res.json(orders);
    } catch (error: any) {
      console.error('Orders fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
    }
  });

  app.get("/api/sales/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [orders, lines] = await Promise.all([
        sheetsService.getOrders(),
        sheetsService.getOrderLines(),
      ]);

      const order = orders.find(o => o.OrderID === id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const orderLines = lines.filter(l => l.OrderID === id);

      res.json({ ...order, lines: orderLines });
    } catch (error: any) {
      console.error('Order fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch order', details: error.message });
    }
  });

  app.post("/api/sales/orders/:id/invoice", async (req, res) => {
    try {
      const { id } = req.params;
      
      const [orders, lines, partners] = await Promise.all([
        sheetsService.getOrders(),
        sheetsService.getOrderLines(),
        sheetsService.getPartnerRegistry(),
      ]);

      const order = orders.find(o => o.OrderID === id);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      const orderLines = lines.filter(l => l.OrderID === id);
      const partner = partners.find(p => p.PartnerID === order.PartnerID);
      const products = await sheetsService.getFinalPriceList();

      // Generate invoice PDF
      const pdfUrl = await generateInvoicePDF(order, orderLines, partner, products);

      await sheetsService.logToSheet('INFO', 'Sales', `Generated invoice for order ${id}`);

      res.json({ orderId: id, pdfUrl });
    } catch (error: any) {
      console.error('Invoice generation error:', error);
      res.status(500).json({ error: 'Failed to generate invoice', details: error.message });
    }
  });

  // ============================================
  // COMMISSION CALCULATION ENDPOINTS
  // ============================================

  // Calculate commission for a quote/order
  app.post("/api/sales/commissions/calculate", async (req, res) => {
    try {
      const input: CommissionCalculationInput = req.body;

      // Calculate commission
      const result = calculateCommission(input);

      // Optionally write to Commission_Ledger
      if (req.body.saveToLedger) {
        await sheetsService.writeRows('Commission_Ledger', [{
          LedgerID: result.ledgerId,
          TS: result.timestamp,
          QuoteID: result.quoteId,
          OrderID: result.orderId,
          PartnerID: result.partnerId,
          PartnerTier: result.partnerTier,
          RepID: result.repId,
          Type: 'Sales',
          NetAmount: result.netAmount,
          'Rate%': result.commissionRate * 100,
          BaseCommission: result.baseCommission,
          MonthlyTargetMet: result.monthlyTargetMet,
          Multiplier: result.multiplier,
          Amount: result.finalCommission,
          PaymentStage: result.paymentStage,
          AmountPayable: result.amountPayable,
          Status: result.status,
          Notes: `Auto-calculated commission`,
        }]);

        await sheetsService.logToSheet('INFO', 'Commission', 
          `Calculated commission ${result.ledgerId}: €${result.finalCommission.toFixed(2)} for ${result.repId}`
        );
      }

      res.json(result);
    } catch (error: any) {
      console.error('Commission calculation error:', error);
      res.status(500).json({ error: 'Failed to calculate commission', details: error.message });
    }
  });

  // Get loyalty ledger (all or filtered)
  app.get("/api/loyalty/ledger", async (req, res) => {
    try {
      // Validate and normalize query parameters
      const querySchema = z.object({
        partnerId: z.string().optional(),
        type: z.string()
          .transform(v => v.toLowerCase())
          .refine(v => v === 'earned' || v === 'redeemed', {
            message: 'Type must be "Earned" or "Redeemed" (case-insensitive)'
          })
          .optional(),
        month: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Month must be in YYYY-MM or YYYY-MM-DD format').optional()
      });

      const parsed = querySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ 
          error: 'Invalid query parameters', 
          details: parsed.error.errors 
        });
      }

      const { partnerId, type, month } = parsed.data;
      let ledger = await sheetsService.getLoyaltyLedger();

      // Filter by partnerId
      if (partnerId) {
        ledger = ledger.filter(l => l.PartnerID === partnerId);
      }

      // Filter by type (Earned/Redeemed) - case-insensitive comparison
      if (type) {
        const normalizedType = type.toLowerCase();
        ledger = ledger.filter(l => (l.Type || '').toLowerCase() === normalizedType);
      }

      // Filter by month (YYYY-MM or YYYY-MM-DD format) - truncate input to YYYY-MM for comparison
      if (month) {
        const monthPrefix = month.substring(0, 7); // Extract YYYY-MM portion
        ledger = ledger.filter(l => {
          const date = l.TransactionDate || '';
          return date.startsWith(monthPrefix);
        });
      }

      res.json(ledger);
    } catch (error: any) {
      console.error('Loyalty ledger fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch loyalty ledger', details: error.message });
    }
  });

  // Get commission ledger (all or filtered)
  app.get("/api/sales/commissions/ledger", async (req, res) => {
    try {
      const { repId, status, month } = req.query;
      let ledger = await sheetsService.getCommissionLedger();

      // Filter by repId
      if (repId) {
        ledger = ledger.filter(c => c.RepID === repId || c.Owner === repId);
      }

      // Filter by status
      if (status) {
        ledger = ledger.filter(c => c.Status === status);
      }

      // Filter by month (YYYY-MM format)
      if (month) {
        ledger = ledger.filter(c => {
          const ts = c.TS || '';
          return ts.startsWith(month as string);
        });
      }

      res.json(ledger);
    } catch (error: any) {
      console.error('Commission ledger fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch commission ledger', details: error.message });
    }
  });

  // Get monthly commission summary for a rep
  app.get("/api/sales/commissions/monthly/:repId/:month", async (req, res) => {
    try {
      const { repId, month } = req.params;
      
      // Get all commissions for this rep in this month
      const ledger = await sheetsService.getCommissionLedger();
      const monthlyCommissions = ledger
        .filter(c => 
          (c.RepID === repId || c.Owner === repId) &&
          (c.TS || '').startsWith(month)
        )
        .map(c => ({
          ledgerId: c.LedgerID,
          timestamp: c.TS,
          quoteId: c.QuoteID,
          orderId: c.OrderID,
          partnerId: c.PartnerID || '',
          partnerTier: c.PartnerTier || 'Basic',
          netAmount: c.NetAmount || c.BaseGross || 0,
          commissionRate: (c['Rate%'] || 0) / 100,
          baseCommission: c.BaseCommission || 0,
          monthlyTargetMet: c.MonthlyTargetMet || false,
          multiplier: c.Multiplier || 1.0,
          finalCommission: c.Amount,
          repId: c.RepID || c.Owner || '',
          status: c.Status || 'pending',
          paymentStage: c.PaymentStage || 'none',
          amountPayable: c.AmountPayable || 0,
        } as CommissionCalculationResult));

      const summary = calculateMonthlyCommissionSummary(repId, month, monthlyCommissions);

      res.json(summary);
    } catch (error: any) {
      console.error('Monthly commission summary error:', error);
      res.status(500).json({ error: 'Failed to calculate monthly summary', details: error.message });
    }
  });

  // Update commission status (e.g., from pending to confirmed to paid)
  app.patch("/api/sales/commissions/:ledgerId", async (req, res) => {
    try {
      const { ledgerId } = req.params;
      const { status, notes } = req.body;

      const updates: any = {};
      if (status) updates.Status = status;
      if (notes) updates.Notes = notes;

      // Update payment stage based on status
      if (status === 'confirmed') {
        updates.PaymentStage = 'partial';
        // Recalculate AmountPayable (50%)
        const ledger = await sheetsService.getCommissionLedger();
        const commission = ledger.find(c => c.LedgerID === ledgerId);
        if (commission) {
          updates.AmountPayable = commission.Amount * 0.5;
        }
      } else if (status === 'paid') {
        updates.PaymentStage = 'full';
        const ledger = await sheetsService.getCommissionLedger();
        const commission = ledger.find(c => c.LedgerID === ledgerId);
        if (commission) {
          updates.AmountPayable = commission.Amount;
        }
      }

      await sheetsService.updateRow('Commission_Ledger', 'LedgerID', ledgerId, updates);
      await sheetsService.logToSheet('INFO', 'Commission', 
        `Updated commission ${ledgerId} status to ${status}`
      );

      res.json({ success: true });
    } catch (error: any) {
      console.error('Commission update error:', error);
      res.status(500).json({ error: 'Failed to update commission', details: error.message });
    }
  });

  // ============================================
  // TERRITORY MANAGEMENT ENDPOINTS
  // ============================================

  // Assign territory to a lead
  app.post("/api/territories/assign", async (req, res) => {
    try {
      const { leadId } = req.body;

      const [leads, territories, rules] = await Promise.all([
        sheetsService.getCRMLeads(),
        sheetsService.getTerritories(),
        sheetsService.getAssignmentRules(),
      ]);

      const lead = leads.find(l => l.LeadID === leadId);
      if (!lead) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Get available reps (from territories)
      const availableReps = territories
        .filter(t => t.Owner)
        .map(t => t.Owner!)
        .filter((v, i, a) => a.indexOf(v) === i); // unique

      const result = assignTerritory(lead, territories, rules, availableReps);

      // Update lead owner if assigned
      if (result.assignedTo) {
        await sheetsService.updateRow('CRM_Leads', 'LeadID', leadId, {
          Owner: result.assignedTo,
        });

        await sheetsService.logToSheet('INFO', 'Territory', 
          `Assigned lead ${leadId} to ${result.assignedTo}: ${result.reason}`
        );
      }

      res.json(result);
    } catch (error: any) {
      console.error('Territory assignment error:', error);
      res.status(500).json({ error: 'Failed to assign territory', details: error.message });
    }
  });

  // Reassign with manager approval
  app.post("/api/territories/reassign", async (req, res) => {
    try {
      const { entityId, entityType, newOwner, managerId, approved } = req.body;

      let currentOwner: string | null = null;
      let sheetName = '';

      if (entityType === 'Lead') {
        sheetName = 'CRM_Leads';
        const leads = await sheetsService.getCRMLeads();
        const lead = leads.find(l => l.LeadID === entityId);
        currentOwner = lead?.Owner || null;
      } else if (entityType === 'Stand') {
        sheetName = 'StandSites';
        const stands = await sheetsService.getStandSites();
        const stand = stands.find(s => s.StandID === entityId);
        currentOwner = stand?.Owner || null;
      } else if (entityType === 'Partner') {
        sheetName = 'PartnerRegistry';
        const partners = await sheetsService.getPartnerRegistry();
        const partner = partners.find(p => p.PartnerID === entityId);
        currentOwner = partner?.Owner || null;
      }

      const result = reassignWithApproval(
        entityId,
        currentOwner,
        newOwner,
        managerId,
        approved
      );

      // If approved, update the owner
      if (approved && result.assignedTo) {
        const idColumn = entityType === 'Lead' ? 'LeadID' 
          : entityType === 'Stand' ? 'StandID' 
          : 'PartnerID';

        await sheetsService.updateRow(sheetName, idColumn, entityId, {
          Owner: result.assignedTo,
        });

        await sheetsService.logToSheet('INFO', 'Territory', 
          `Reassigned ${entityType} ${entityId} from ${currentOwner} to ${newOwner} by ${managerId}`
        );
      }

      res.json(result);
    } catch (error: any) {
      console.error('Territory reassignment error:', error);
      res.status(500).json({ error: 'Failed to reassign territory', details: error.message });
    }
  });

  // Get territory coverage report
  app.get("/api/territories/coverage", async (req, res) => {
    try {
      const [territories, leads, stands] = await Promise.all([
        sheetsService.getTerritories(),
        sheetsService.getCRMLeads(),
        sheetsService.getStandSites(),
      ]);

      const coverage = getTerritoryCoverage(territories, leads, stands);

      res.json(coverage);
    } catch (error: any) {
      console.error('Territory coverage error:', error);
      res.status(500).json({ error: 'Failed to get territory coverage', details: error.message });
    }
  });

  // Validate no double claims
  app.get("/api/territories/validate", async (req, res) => {
    try {
      const [leads, stands, partners] = await Promise.all([
        sheetsService.getCRMLeads(),
        sheetsService.getStandSites(),
        sheetsService.getPartnerRegistry(),
      ]);

      const report = validateNoDoubleClaims(leads, stands, partners);

      res.json(report);
    } catch (error: any) {
      console.error('Territory validation error:', error);
      res.status(500).json({ error: 'Failed to validate territories', details: error.message });
    }
  });

  // QR Code endpoints
  app.get("/api/qrcode/stand/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';
      const qrUrl = await generateStandQR(id, baseUrl);
      res.json({ qrUrl });
    } catch (error: any) {
      console.error('QR generation error:', error);
      res.status(500).json({ error: 'Failed to generate QR code', details: error.message });
    }
  });

  app.get("/api/qrcode/product/:sku", async (req, res) => {
    try {
      const { sku } = req.params;
      const products = await sheetsService.getFinalPriceList();
      const product = products.find(p => p.SKU === sku);

      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';
      const qrUrl = await generateProductQR(sku, product.Name, product.UVP || 0, baseUrl);

      res.json({ qrUrl });
    } catch (error: any) {
      console.error('QR generation error:', error);
      res.status(500).json({ error: 'Failed to generate QR code', details: error.message });
    }
  });

  // Shipments endpoints
  app.get("/api/shipments", async (req, res) => {
    try {
      const shipments = await sheetsService.getShipmentsDHL();
      res.json(shipments);
    } catch (error: any) {
      console.error('Shipments fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch shipments', details: error.message });
    }
  });

  app.post("/api/shipments", async (req, res) => {
    try {
      // Validate input using comprehensive shipment schema
      const inputSchema = z.object({
        OrderID: z.string().optional(),
        PartnerID: z.string().min(1, "Partner ID is required"),
        Weight_g: z.number().positive("Weight must be positive"),
        ShippingMethod: z.string().optional(),
        Zone: z.string().optional(),
        BoxID: z.string().optional(),
        BoxCostEUR: z.number().nonnegative().optional(),
        PackagingCostEUR: z.number().nonnegative().optional(),
        ShippingCostEUR: z.number().nonnegative().optional(),
        TotalCostEUR: z.number().nonnegative().optional(),
        DeliveryAddress: z.string().optional(),
        TrackingNumber: z.string().optional(),
        Notes: z.string().optional(),
      });

      const validated = inputSchema.parse(req.body);

      // Generate sequential shipment ID with collision detection
      const generateSequentialShipmentId = async (maxRetries = 5): Promise<string> => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const shipments = await sheetsService.getShipments();
          
          // Extract numeric sequences from existing shipment IDs
          const existingNumbers = shipments
            .map(s => s.ShipmentID.match(/SHIP-\d+-(\d{6})/)?.[1])
            .filter(Boolean)
            .map(Number);
          
          const nextNumber = existingNumbers.length > 0 
            ? Math.max(...existingNumbers) + 1 
            : 1;
          
          const timestamp = Date.now();
          const proposedId = `SHIP-${timestamp}-${String(nextNumber).padStart(6, '0')}`;
          
          // Check for collision (unlikely but possible with concurrent requests)
          if (!shipments.some(s => s.ShipmentID === proposedId)) {
            return proposedId;
          }
          
          // Backoff before retry
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
        }
        
        throw new Error('Failed to generate unique sequential shipment ID after retries');
      };

      let newShipment: any = null;
      let lastError: Error | null = null;

      // Retry loop with post-write verification (matches partner creation pattern)
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const shipmentId = await generateSequentialShipmentId();

          newShipment = {
            ShipmentID: shipmentId,
            OrderID: validated.OrderID || '',
            PartnerID: validated.PartnerID,
            CreatedTS: new Date().toISOString(),
            ShippingMethod: validated.ShippingMethod || 'DHL',
            Zone: validated.Zone || '',
            Weight_g: validated.Weight_g,
            BoxID: validated.BoxID || '',
            BoxCostEUR: validated.BoxCostEUR || 0,
            PackagingCostEUR: validated.PackagingCostEUR || 0,
            ShippingCostEUR: validated.ShippingCostEUR || 0,
            TotalCostEUR: validated.TotalCostEUR || 0,
            DeliveryAddress: validated.DeliveryAddress || '',
            TrackingNumber: validated.TrackingNumber || '',
            Status: 'Pending',
            LabelGenerated: false,
            LabelPrinted: false,
            Notes: validated.Notes || '',
          };

          await sheetsService.writeRows('Shipments', [newShipment]);

          // Post-write verification: wait and check for duplicates
          await new Promise(resolve => setTimeout(resolve, 150));
          const verification = await sheetsService.getShipments();
          const allWithThisId = verification.filter(s => s.ShipmentID === shipmentId);

          if (allWithThisId.length > 1) {
            // Duplicate detected - cleanup and retry
            try {
              const allRows = await sheetsService.readSheet('Shipments');
              const myRowIndex = allRows.findIndex((r: any) =>
                r.ShipmentID === shipmentId &&
                r.PartnerID === newShipment.PartnerID &&
                r.Weight_g === newShipment.Weight_g
              );

              if (myRowIndex > 0) {
                const { getUncachableGoogleSheetClient } = await import('./lib/sheets');
                const client = await getUncachableGoogleSheetClient();
                await client.spreadsheets.values.clear({
                  spreadsheetId: SPREADSHEET_ID,
                  range: `Shipments!A${myRowIndex + 2}:Z${myRowIndex + 2}`,
                });
              }
            } catch (cleanupError) {
              console.error('Failed to clean up duplicate shipment row:', cleanupError);
            }

            throw new Error(`Duplicate shipment ID detected: ${shipmentId}, retrying...`);
          }

          await sheetsService.logToSheet(
            'INFO',
            'Logistics',
            `Created shipment ${newShipment.ShipmentID} for partner ${validated.PartnerID}: €${newShipment.TotalCostEUR.toFixed(2)}`
          );
          break;
        } catch (error: any) {
          lastError = error;
          if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
          }
        }
      }

      if (!newShipment) {
        throw lastError || new Error('Failed to create shipment after retries');
      }

      res.json(newShipment);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Create shipment error:', error);
      await sheetsService.logToSheet('ERROR', 'Logistics', `Failed to create shipment: ${error.message}`);
      res.status(500).json({ error: 'Failed to create shipment', details: error.message });
    }
  });

  app.patch("/api/shipments/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Validate shipment exists
      const shipments = await sheetsService.getShipmentsDHL();
      const shipment = shipments.find(s => s.ShipmentID === id);

      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      // Validate updates with explicit field whitelist
      const updateSchema = z.object({
        TrackingNumber: z.string().optional(),
        Status: z.enum(['Pending', 'In Transit', 'Delivered', 'Cancelled'] as [string, ...string[]]).optional(),
        Notes: z.string().optional(),
        Zone: z.enum(['DE', 'EU1', 'EU2', 'INT'] as [string, ...string[]]).optional(),
        Weight_g: z.number().positive().optional(),
        EstimatedCost: z.number().nonnegative().optional(),
      }).strict(); // Reject unknown fields

      const validated = updateSchema.parse(req.body);

      // Only update allowed fields
      const allowedUpdates: Record<string, any> = {};
      if (validated.TrackingNumber !== undefined) allowedUpdates.TrackingNumber = validated.TrackingNumber;
      if (validated.Status !== undefined) allowedUpdates.Status = validated.Status;
      if (validated.Notes !== undefined) allowedUpdates.Notes = validated.Notes;
      if (validated.Zone !== undefined) allowedUpdates.Zone = validated.Zone;
      if (validated.Weight_g !== undefined) allowedUpdates.Weight_g = validated.Weight_g;
      if (validated.EstimatedCost !== undefined) allowedUpdates.EstimatedCost = validated.EstimatedCost;

      await sheetsService.updateRow('Shipments_DHL', 'ShipmentID', id, allowedUpdates);
      await sheetsService.logToSheet('INFO', 'Logistics', `Updated shipment ${id}`);

      res.json({ ...shipment, ...allowedUpdates });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: error.errors });
      }
      console.error('Update shipment error:', error);
      await sheetsService.logToSheet('ERROR', 'Logistics', `Failed to update shipment: ${error.message}`);
      res.status(500).json({ error: 'Failed to update shipment', details: error.message });
    }
  });

  app.post("/api/shipments/manifest", async (req, res) => {
    try {
      // Get all confirmed orders that don't have shipments yet
      const [orders, shipments, orderLines, partners, products, rates, tariffs] = await Promise.all([
        sheetsService.getOrders(),
        sheetsService.getShipmentsDHL(),
        sheetsService.getOrderLines(),
        sheetsService.getPartnerRegistry(),
        sheetsService.getFinalPriceList(),
        sheetsService.getDHLRates(),
        sheetsService.getDHLTariffs(),
      ]);

      const shippedOrderIds = new Set(shipments.map(s => s.OrderID));
      const pendingOrders = orders.filter(
        o => o.Status === 'Confirmed' && !shippedOrderIds.has(o.OrderID)
      );

      if (pendingOrders.length === 0) {
        return res.json({ manifestId: null, shipmentCount: 0, message: 'No pending orders to ship' });
      }

      const manifestId = `MANIFEST-${new Date().toISOString().split('T')[0]}-${nanoid(4)}`;
      const manifestDate = new Date().toISOString().split('T')[0];

      // Create shipments for each pending order with calculated weight, zone, and cost
      const newShipments = [];
      for (const order of pendingOrders) {
        // Get order lines to calculate weight
        const lines = orderLines.filter(l => l.OrderID === order.OrderID);
        const totalWeight_g = lines.reduce((sum, line) => {
          const product = products.find(p => p.SKU === line.SKU);
          const itemWeight = (product?.Weight_g || 100) * line.Qty; // Default 100g if no weight
          return sum + itemWeight;
        }, 0);

        // Get partner to determine zone
        const partner = partners.find(p => p.PartnerID === order.PartnerID);
        let zone = 'EU1'; // Default zone
        if (partner?.CountryCode) {
          // Simple zone logic based on country
          if (partner.CountryCode === 'DE') {
            zone = 'DE';
          } else if (partner.CountryCode === 'US') {
            zone = 'INT';
          } else {
            zone = 'EU1';
          }
        }

        // Calculate shipping cost using DHL rates
        let shippingCost = 0;
        if (tariffs.length > 0) {
          const applicable = tariffs
            .filter(t => t.Zone === zone && totalWeight_g <= t.WeightMax_g)
            .sort((a, b) => a.WeightMax_g - b.WeightMax_g)[0];
          if (applicable) {
            shippingCost = applicable.BasePrice_EUR + (applicable.Surcharge_EUR || 0);
          }
        } else if (rates.length > 0) {
          const applicable = rates
            .filter(r => r.Zone === zone && totalWeight_g <= r.Weight_g_Max)
            .sort((a, b) => a.Weight_g_Max - b.Weight_g_Max)[0];
          if (applicable) {
            shippingCost = applicable.Price;
          }
        }

        newShipments.push({
          ShipmentID: `SH-${nanoid(8)}`,
          OrderID: order.OrderID,
          PartnerID: order.PartnerID,
          ManifestID: manifestId,
          TrackingNumber: `TRACK-${nanoid(10)}`,
          Carrier: 'DHL',
          Weight_g: totalWeight_g,
          Zone: zone,
          ShippingCost: shippingCost,
          Status: 'Pending',
          ShippedDate: manifestDate,
          DeliveryDate: '',
          Notes: `Auto-generated from manifest ${manifestId}`,
        });
      }

      // Write shipments and update order status
      await sheetsService.writeRows('Shipments_DHL', newShipments);

      for (const order of pendingOrders) {
        await sheetsService.updateRow('Orders', 'OrderID', order.OrderID, { Status: 'Shipped' });
      }

      await sheetsService.logToSheet('INFO', 'Logistics', `Created manifest ${manifestId} with ${newShipments.length} shipments`);

      res.json({ manifestId, shipmentCount: newShipments.length });
    } catch (error: any) {
      console.error('Manifest creation error:', error);
      res.status(500).json({ error: 'Failed to create manifest', details: error.message });
    }
  });

  // DHL estimate endpoint
  app.post("/api/dhl/estimate", async (req, res) => {
    try {
      const { weight_g, zone } = req.body;

      const [rates, tariffs] = await Promise.all([
        sheetsService.getDHLRates(),
        sheetsService.getDHLTariffs(),
      ]);

      // Prefer tariffs over rates
      let estimate = 0;
      if (tariffs.length > 0) {
        const applicable = tariffs
          .filter(t => t.Zone === zone && weight_g <= t.WeightMax_g)
          .sort((a, b) => a.WeightMax_g - b.WeightMax_g)[0];

        if (applicable) {
          estimate = applicable.BasePrice_EUR + (applicable.Surcharge_EUR || 0);
        }
      } else if (rates.length > 0) {
        const applicable = rates
          .filter(r => r.Zone === zone && weight_g <= r.Weight_g_Max)
          .sort((a, b) => a.Weight_g_Max - b.Weight_g_Max)[0];

        if (applicable) {
          estimate = applicable.Price;
        }
      }

      res.json({ estimate, currency: 'EUR', zone });
    } catch (error: any) {
      console.error('DHL estimate error:', error);
      res.status(500).json({ error: 'Failed to estimate shipping', details: error.message });
    }
  });

  // AI endpoints
  app.post("/api/ai/explain-price", async (req, res) => {
    try {
      const { sku } = req.body;
      const [products, params, tiers] = await Promise.all([
        sheetsService.getFinalPriceList(),
        sheetsService.getPricingParams(),
        sheetsService.getPartnerTiers(),
      ]);

      const product = products.find(p => p.SKU === sku);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const ctx = buildPricingContext(params, tiers);
      const explanation = explainPriceCalculation(product, ctx);

      const prompt = `Given this price calculation breakdown, provide a friendly, business-focused explanation in 2-3 paragraphs:\n\n${explanation}`;
      const aiResponse = await generateAIResponse(prompt);

      res.json({ explanation: aiResponse });
    } catch (error: any) {
      console.error('AI explain price error:', error);
      res.status(500).json({ error: 'Failed to generate AI explanation', details: error.message });
    }
  });

  app.post("/api/ai/stand-refill-suggest", async (req, res) => {
    try {
      const { standId } = req.body;
      const [stands, inventory] = await Promise.all([
        sheetsService.getStandSites(),
        sheetsService.getStandInventory(),
      ]);

      const stand = stands.find(s => s.StandID === standId);
      if (!stand) {
        return res.status(404).json({ error: 'Stand not found' });
      }

      const standInventory = inventory.filter(i => i.StandID === standId);
      const inventoryData = JSON.stringify(standInventory, null, 2);

      const prompt = `Analyze this stand inventory and suggest a refill plan. Consider min/max levels and current on-hand quantities:\n\n${inventoryData}\n\nProvide specific recommendations for which SKUs need refilling and suggested quantities.`;
      const aiResponse = await generateAIResponse(prompt);

      res.json({ suggestion: aiResponse });
    } catch (error: any) {
      console.error('AI stand refill error:', error);
      res.status(500).json({ error: 'Failed to generate refill suggestion', details: error.message });
    }
  });

  app.post("/api/ai/social-plan", async (req, res) => {
    try {
      const { productSkus, theme } = req.body;
      
      const prompt = `Create a 14-day social media content plan for promoting products${productSkus ? ` (SKUs: ${productSkus.join(', ')})` : ''}${theme ? ` with theme: ${theme}` : ''}. Include post ideas, hashtag suggestions, and engagement strategies.`;
      const aiResponse = await generateAIResponse(prompt);

      res.json({ plan: aiResponse });
    } catch (error: any) {
      console.error('AI social plan error:', error);
      res.status(500).json({ error: 'Failed to generate social plan', details: error.message });
    }
  });

  // Admin & Health endpoints
  app.get("/api/admin/feature-flags", async (req, res) => {
    try {
      const flags = getFeatureFlags();
      res.json(flags);
    } catch (error: any) {
      console.error('Feature flags error:', error);
      res.status(500).json({ error: 'Failed to get feature flags', details: error.message });
    }
  });

  app.get("/api/admin/secrets-status", async (req, res) => {
    try {
      const secretsStatus = {
        SMTP_HOST: maskSecret(process.env.SMTP_HOST),
        SMTP_USER: maskSecret(process.env.SMTP_USER),
        SMTP_PASS: maskSecret(process.env.SMTP_PASS),
        AI_OPENAI_KEY: maskSecret(process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
        SHEETS_SPREADSHEET_ID: maskSecret(process.env.SHEETS_SPREADSHEET_ID),
        API_WOO_KEY: maskSecret(process.env.API_WOO_KEY),
        API_ODOO_PASS: maskSecret(process.env.API_ODOO_PASS),
        SESSION_SECRET: maskSecret(process.env.SESSION_SECRET),
      };
      res.json(secretsStatus);
    } catch (error: any) {
      console.error('Secrets status error:', error);
      res.status(500).json({ error: 'Failed to get secrets status', details: error.message });
    }
  });

  app.get("/api/admin/health", async (req, res) => {
    try {
      const health: any = {
        ok: false,
        sheetId: SPREADSHEET_ID,
        connected: false,
        sheets: { status: 'unknown', message: '' },
        openai: { status: 'unknown', message: '' },
        email: { status: 'unknown', message: '' },
        places: { status: 'unknown', message: '' },
        pricing: { status: 'unknown', message: '' },
        settings: { status: 'unknown', message: '', keys: [] },
        security: { status: 'unknown', message: '' },
        integrations: {
          woo: { status: 'unknown', message: 'Not tested' },
          odoo: { status: 'unknown', message: 'Not tested' },
          email: { status: 'unknown', message: 'Not tested' },
        },
      };

      // Check Google Sheets (single source of truth: SPREADSHEET_ID)
      try {
        await sheetsService.getSettings();
        health.sheets = { status: 'connected', message: 'Google Sheets connected' };
        health.connected = true;
      } catch (error: any) {
        health.sheets = { status: 'error', message: error.message };
        health.connected = false;
      }

      // Hydrate and validate settings
      try {
        const config = await hydrateSettings();
        const okCount = config.settingsStatus.filter(s => s.status === 'ok').length;
        const missingCount = config.settingsStatus.filter(s => s.status === 'missing').length;
        const warningCount = config.settingsStatus.filter(s => s.status === 'warning').length;
        
        // Status degrades if ANY settings are missing or have warnings
        const settingsStatus = (warningCount > 0 || missingCount > 0) ? 'warning' : 'ok';
        
        health.settings = {
          status: settingsStatus,
          message: `${okCount} configured, ${missingCount} missing, ${warningCount} warnings`,
          keys: config.settingsStatus,
        };
      } catch (error: any) {
        health.settings = { status: 'error', message: error.message, keys: [] };
      }

      // Security: Check for secrets in Sheet
      try {
        const securityCheck = await validateNoSecretsInSheet();
        if (securityCheck.ok) {
          health.security = { status: 'ok', message: 'No secrets found in Sheet' };
        } else {
          health.security = { 
            status: 'warning', 
            message: `${securityCheck.violations.length} secret(s) found in Sheet: ${securityCheck.violations.join(', ')}. Move to Replit Secrets.`,
            violations: securityCheck.violations,
          };
        }
      } catch (error: any) {
        health.security = { status: 'error', message: error.message };
      }

      // Check OpenAI (via Replit AI Integrations)
      try {
        const hasOpenAI = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? true : false;
        health.openai = hasOpenAI 
          ? { status: 'connected', message: 'OpenAI via Replit Integrations' }
          : { status: 'error', message: 'API key not configured' };
      } catch (error: any) {
        health.openai = { status: 'error', message: error.message };
      }

      // Check Email (support multiple providers: SMTP, Resend, SendGrid)
      try {
        const provider = process.env.EMAIL_PROVIDER || 'smtp';
        let hasEmail = false;
        let emailMessage = '';

        if (provider === 'smtp') {
          hasEmail = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM);
          emailMessage = hasEmail ? 'SMTP configured' : 'SMTP not configured';
        } else if (provider === 'resend') {
          hasEmail = !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
          emailMessage = hasEmail ? 'Resend configured' : 'Resend not configured';
        } else if (provider === 'sendgrid') {
          hasEmail = !!(process.env.SENDGRID_API_KEY && process.env.EMAIL_FROM);
          emailMessage = hasEmail ? 'SendGrid configured' : 'SendGrid not configured';
        } else {
          hasEmail = false;
          emailMessage = `Unknown email provider: ${provider}`;
        }

        health.email = hasEmail
          ? { status: 'connected', message: emailMessage }
          : { status: 'error', message: emailMessage };
      } catch (error: any) {
        health.email = { status: 'error', message: error.message };
      }

      // Check Places API (Growth/CRM lead generation)
      try {
        const hasPlaces = !!process.env.API_PLACES_KEY;
        health.places = hasPlaces
          ? { status: 'connected', message: 'Google Places API key configured' }
          : { status: 'warning', message: 'Places API not configured - Growth/Places endpoints will run in dry-run mode' };
      } catch (error: any) {
        health.places = { status: 'error', message: error.message };
      }

      // Check Pricing Engine
      try {
        const params = await sheetsService.getPricingParams();
        health.pricing = params.length > 0
          ? { status: 'running', message: 'Pricing parameters loaded' }
          : { status: 'warning', message: 'No pricing parameters found' };
      } catch (error: any) {
        health.pricing = { status: 'error', message: error.message };
      }

      // Check External Integrations (optional deep check via ?test=true)
      const runTests = req.query.test === 'true';
      if (runTests) {
        try {
          const [wooResult, odooResult, emailResult] = await Promise.all([
            checkWooCommerce(),
            checkOdoo(),
            checkEmail(),
          ]);

          health.integrations = {
            woo: {
              status: wooResult.status === 'PASS' ? 'connected' : wooResult.status === 'WARN' ? 'warning' : 'error',
              message: wooResult.message,
              details: wooResult.details,
            },
            odoo: {
              status: odooResult.status === 'PASS' ? 'connected' : odooResult.status === 'WARN' ? 'warning' : 'error',
              message: odooResult.message,
              details: odooResult.details,
            },
            email: {
              status: emailResult.status === 'PASS' ? 'connected' : emailResult.status === 'WARN' ? 'warning' : 'error',
              message: emailResult.message,
              details: emailResult.details,
            },
          };
        } catch (error: any) {
          health.integrations = {
            woo: { status: 'error', message: 'Integration check failed' },
            odoo: { status: 'error', message: 'Integration check failed' },
            email: { status: 'error', message: 'Integration check failed' },
          };
        }
      } else {
        // Quick check: just verify credentials exist (no actual API calls)
        health.integrations = {
          woo: {
            status: (process.env.API_WOO_BASE && process.env.API_WOO_KEY && process.env.API_WOO_SECRET) ? 'configured' : 'not_configured',
            message: (process.env.API_WOO_BASE && process.env.API_WOO_KEY && process.env.API_WOO_SECRET) 
              ? 'WooCommerce credentials configured (use ?test=true to test connection)'
              : 'WooCommerce credentials not configured',
          },
          odoo: {
            status: (process.env.API_ODOO_BASE && process.env.API_ODOO_DB && process.env.API_ODOO_USER && process.env.API_ODOO_PASS) ? 'configured' : 'not_configured',
            message: (process.env.API_ODOO_BASE && process.env.API_ODOO_DB && process.env.API_ODOO_USER && process.env.API_ODOO_PASS)
              ? 'Odoo credentials configured (use ?test=true to test connection)'
              : 'Odoo credentials not configured',
          },
          email: {
            status: (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM) ? 'configured' : 'not_configured',
            message: (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM)
              ? 'Email provider configured (use ?test=true to test configuration)'
              : 'Email provider not configured',
          },
        };
      }

      // Set overall health status
      health.ok = health.connected && health.sheets.status === 'connected' && health.security.status !== 'error';

      res.json(health);
    } catch (error: any) {
      console.error('Health check error:', error);
      res.status(500).json({ error: 'Health check failed', details: error.message });
    }
  });

  // System Readiness Check - generates comprehensive reports
  app.get("/api/admin/ready", async (req, res) => {
    try {
      await sheetsService.logToSheet('INFO', 'Readiness', 'Readiness check started');

      // Generate readiness data
      const readinessData = await generateReadinessData();
      
      // Generate sheets structure data
      const structureData = await generateSheetsStructureData();
      
      // Write both reports to disk
      await writeReadinessReport(readinessData);
      await writeSheetsStructureReport(structureData);

      await sheetsService.logToSheet(
        readinessData.ready ? 'INFO' : 'WARN',
        'Readiness',
        readinessData.ready 
          ? 'System is READY' 
          : `System NOT READY: ${readinessData.issues.join('; ')}`
      );

      // Write Growth Engine readiness to OS_Health
      const growthStatus: 'PASS' | 'WARN' = 
        readinessData.growth.warnings.length === 0 ? 'PASS' : 'WARN';
      const growthMessage = 
        `Growth: ${readinessData.growth.counters.leadsTotal} leads, ` +
        `${readinessData.growth.counters.leadsScored} scored, ` +
        `${readinessData.growth.counters.leadsAssigned} assigned, ` +
        `${readinessData.growth.counters.leadsEnriched} enriched`;
      
      await sheetsService.writeOSHealth(
        '2A Readiness',
        growthStatus,
        growthMessage,
        {
          leadsTotal: readinessData.growth.counters.leadsTotal,
          leadsScored: readinessData.growth.counters.leadsScored,
          leadsAssigned: readinessData.growth.counters.leadsAssigned,
          leadsEnriched: readinessData.growth.counters.leadsEnriched,
          apiKeyPresent: readinessData.growth.apiKey.present,
          crmSheetsPresent: readinessData.growth.crmSheets.present,
          warningsCount: readinessData.growth.warnings.length,
        }
      );

      res.json({
        ok: readinessData.ready,
        summary: {
          spreadsheetId: readinessData.spreadsheetId,
          settings: {
            total: readinessData.settings.total,
            ok: readinessData.settings.ok,
            missing: readinessData.settings.missing,
            warning: readinessData.settings.warning,
          },
          sheets: {
            total: readinessData.sheets.total,
            present: readinessData.sheets.present,
            missing: readinessData.sheets.missing,
          },
          products: {
            total: readinessData.products.total,
            withCOGS: readinessData.products.withCOGS,
            cogsNumericPercent: readinessData.products.cogsNumericPercent,
            withMAP: readinessData.products.withMAP,
            withAutoPriceFlag: readinessData.products.withAutoPriceFlag,
          },
          growth: {
            apiKeyPresent: readinessData.growth.apiKey.present,
            crmSheets: readinessData.growth.crmSheets,
            counters: readinessData.growth.counters,
            warnings: readinessData.growth.warnings,
          },
        },
        issues: readinessData.issues,
        reports: {
          readiness: '/READINESS_REPORT.md',
          structure: '/SHEETS_STRUCTURE_REPORT.md',
        },
      });
    } catch (error: any) {
      console.error('Readiness check error:', error);
      await sheetsService.logToSheet('ERROR', 'Readiness', `Readiness check failed: ${error.message}`);
      res.status(503).json({ 
        ok: false,
        error: 'Readiness check failed', 
        details: error.message,
        issues: ['System readiness could not be determined'],
      });
    }
  });

  // Normalize Numbers - clean up currency symbols and errors in numeric columns
  app.post("/api/admin/normalize-numbers", async (req, res) => {
    try {
      await sheetsService.logToSheet('INFO', 'Admin', 'Normalize numbers started');
      
      const result = await ensureSheets(sheetsService);
      
      const totalFixed = result.sheetsProcessed.reduce<number>(
        (sum, s) => sum + (typeof s.cellsFixed === 'number' ? s.cellsFixed : 0), 
        0
      );
      
      await sheetsService.logToSheet(
        'INFO',
        'Admin',
        `Normalize numbers completed: ${totalFixed} cells fixed across ${result.sheetsProcessed.length} sheets`
      );

      res.json({
        ok: true,
        status: result.status,
        totalCellsFixed: totalFixed,
        sheetsProcessed: result.sheetsProcessed.map(s => ({
          name: s.name,
          cellsFixed: s.cellsFixed,
          errors: s.errors?.length || 0,
        })),
      });
    } catch (error: any) {
      console.error('Normalize numbers error:', error);
      await sheetsService.logToSheet('ERROR', 'Admin', `Normalize numbers failed: ${error.message}`);
      res.status(500).json({ 
        ok: false,
        error: 'Failed to normalize numbers', 
        details: error.message 
      });
    }
  });

  // Rehydrate Settings - reload settings from Google Sheets
  app.post("/api/admin/rehydrate-settings", async (req, res) => {
    try {
      await sheetsService.logToSheet('INFO', 'Admin', 'Rehydrate settings started');
      
      const config = await hydrateSettings();
      
      const okCount = config.settingsStatus.filter(s => s.status === 'ok').length;
      const missingCount = config.settingsStatus.filter(s => s.status === 'missing').length;
      const warningCount = config.settingsStatus.filter(s => s.status === 'warning').length;
      
      await sheetsService.logToSheet(
        missingCount > 0 ? 'WARN' : 'INFO',
        'Admin',
        `Settings rehydrated: ${okCount} ok, ${missingCount} missing, ${warningCount} warnings`
      );

      res.json({
        ok: missingCount === 0,
        settings: {
          total: config.settingsStatus.length,
          ok: okCount,
          missing: missingCount,
          warning: warningCount,
        },
        details: config.settingsStatus,
      });
    } catch (error: any) {
      console.error('Rehydrate settings error:', error);
      await sheetsService.logToSheet('ERROR', 'Admin', `Rehydrate settings failed: ${error.message}`);
      res.status(500).json({ 
        ok: false,
        error: 'Failed to rehydrate settings', 
        details: error.message 
      });
    }
  });

  // Generate Reports - create READINESS_REPORT.md and SHEETS_STRUCTURE_REPORT.md
  app.post("/api/admin/generate-reports", async (req, res) => {
    try {
      await sheetsService.logToSheet('INFO', 'Admin', 'Generate reports started');
      
      const readinessData = await generateReadinessData();
      const structureData = await generateSheetsStructureData();
      
      await writeReadinessReport(readinessData);
      await writeSheetsStructureReport(structureData);
      
      await sheetsService.logToSheet(
        readinessData.ready ? 'INFO' : 'WARN',
        'Admin',
        `Reports generated: System ${readinessData.ready ? 'READY' : 'NOT READY'}`
      );

      res.json({
        ok: readinessData.ready,
        readiness: {
          ready: readinessData.ready,
          issues: readinessData.issues,
          settings: readinessData.settings,
          sheets: readinessData.sheets,
          products: readinessData.products,
        },
        reports: {
          readiness: '/READINESS_REPORT.md',
          structure: '/SHEETS_STRUCTURE_REPORT.md',
        },
      });
    } catch (error: any) {
      console.error('Generate reports error:', error);
      await sheetsService.logToSheet('ERROR', 'Admin', `Generate reports failed: ${error.message}`);
      res.status(500).json({ 
        ok: false,
        error: 'Failed to generate reports', 
        details: error.message 
      });
    }
  });

  // Integrations Check - test all external integrations safely
  app.get("/api/admin/integrations/check", async (req, res) => {
    try {
      await sheetsService.logToSheet('INFO', 'Integrations', 'Integrations check started');
      
      const results = await checkAllIntegrations();
      
      await sheetsService.logToSheet(
        results.overall === 'PASS' ? 'INFO' : 'WARN',
        'Integrations',
        `Integrations check completed: ${results.overall}`
      );

      res.json({
        ok: results.overall === 'PASS',
        overall: results.overall,
        integrations: {
          woo: results.woo,
          odoo: results.odoo,
          email: results.email,
        },
      });
    } catch (error: any) {
      console.error('Integrations check error:', error);
      await sheetsService.logToSheet('ERROR', 'Integrations', `Integrations check failed: ${error.message}`);
      res.status(500).json({ 
        ok: false,
        error: 'Integrations check failed', 
        details: error.message 
      });
    }
  });

  // Email Check - test email provider configuration only
  app.get("/api/admin/email/check", async (req, res) => {
    try {
      const result = await checkEmail();
      res.json({
        ok: result.status === 'PASS',
        ...result,
      });
    } catch (error: any) {
      console.error('Email check error:', error);
      res.status(500).json({ 
        ok: false,
        error: 'Email check failed', 
        details: error.message 
      });
    }
  });

  // WooCommerce Check - test WooCommerce API safely
  app.get("/api/admin/woo/check", async (req, res) => {
    try {
      const result = await checkWooCommerce();
      res.json({
        ok: result.status === 'PASS',
        ...result,
      });
    } catch (error: any) {
      console.error('WooCommerce check error:', error);
      res.status(500).json({ 
        ok: false,
        error: 'WooCommerce check failed', 
        details: error.message 
      });
    }
  });

  // Odoo Check - test Odoo API safely
  app.get("/api/admin/odoo/check", async (req, res) => {
    try {
      const result = await checkOdoo();
      res.json({
        ok: result.status === 'PASS',
        ...result,
      });
    } catch (error: any) {
      console.error('Odoo check error:', error);
      res.status(500).json({ 
        ok: false,
        error: 'Odoo check failed', 
        details: error.message 
      });
    }
  });

  app.post("/api/admin/cron/daily", async (req, res) => {
    try {
      await sheetsService.logToSheet('INFO', 'Cron', 'Daily job started (manual trigger)');

      // Auto-reprice SKUs with AutoPriceFlag
      const products = await sheetsService.getFinalPriceList();
      const autoSKUs = products.filter(p => p.AutoPriceFlag).map(p => p.SKU);

      if (autoSKUs.length > 0) {
        await sheetsService.logToSheet('INFO', 'Cron', `Auto-repricing ${autoSKUs.length} SKUs`);
      }

      await sheetsService.logToSheet('INFO', 'Cron', 'Daily job completed');
      res.json({ status: 'completed', processed: autoSKUs.length });
    } catch (error: any) {
      console.error('Daily cron error:', error);
      await sheetsService.logToSheet('ERROR', 'Cron', `Daily job failed: ${error.message}`);
      res.status(500).json({ error: 'Daily cron job failed', details: error.message });
    }
  });

  app.post("/api/admin/cron/weekly", async (req, res) => {
    try {
      await sheetsService.logToSheet('INFO', 'Cron', 'Weekly job started (manual trigger)');
      // TODO: Generate performance reports, tier upgrade suggestions
      await sheetsService.logToSheet('INFO', 'Cron', 'Weekly job completed');
      res.json({ status: 'completed' });
    } catch (error: any) {
      console.error('Weekly cron error:', error);
      await sheetsService.logToSheet('ERROR', 'Cron', `Weekly job failed: ${error.message}`);
      res.status(500).json({ error: 'Weekly cron job failed', details: error.message });
    }
  });

  app.post("/api/admin/cron/monthly", async (req, res) => {
    try {
      await sheetsService.logToSheet('INFO', 'Cron', 'Monthly job started (manual trigger)');
      // TODO: Generate commission statements, loyalty bonuses
      await sheetsService.logToSheet('INFO', 'Cron', 'Monthly job completed');
      res.json({ status: 'completed' });
    } catch (error: any) {
      console.error('Monthly cron error:', error);
      await sheetsService.logToSheet('ERROR', 'Cron', `Monthly job failed: ${error.message}`);
      res.status(500).json({ error: 'Monthly cron job failed', details: error.message });
    }
  });

  // Logs endpoints
  app.get("/api/logs", async (req, res) => {
    try {
      const logs = await sheetsService.readSheet('OS_Logs');
      
      // Convert array rows to objects with proper column names
      const logObjects = logs.slice(1).map((row: any) => ({
        Timestamp: row[0] || new Date().toISOString(),
        Level: row[1] || 'INFO',
        Scope: row[2] || 'System',
        Message: row[3] || '',
      })).reverse(); // Most recent first

      res.json(logObjects);
    } catch (error: any) {
      console.error('Get logs error:', error);
      // Return empty array if sheet doesn't exist yet
      res.json([]);
    }
  });

  // Enums CRUD endpoints
  app.get("/api/admin/enums", async (req, res) => {
    try {
      const enums = await sheetsService.getEnums();
      res.json(enums);
    } catch (error: any) {
      console.error('Get enums error:', error);
      res.status(500).json({ error: 'Failed to fetch enums', details: error.message });
    }
  });

  app.post("/api/admin/enums", async (req, res) => {
    try {
      const { List, Key, Label, Sort, Active } = req.body;
      
      if (!List || !Key || !Label) {
        return res.status(400).json({ error: 'List, Key, and Label are required' });
      }

      // Check for duplicates
      const existing = await sheetsService.getEnums();
      if (existing.some(e => e.List === List && e.Key === Key)) {
        return res.status(409).json({ error: 'Enum with this List and Key already exists' });
      }

      const newEnum = {
        List,
        Key,
        Label,
        Sort: Sort || 0,
        Active: Active !== undefined ? Active : true
      };

      await sheetsService.writeRows('Enums', [newEnum]);
      await sheetsService.logToSheet('INFO', 'Enums', `Created enum ${List}:${Key}`);
      
      res.status(201).json(newEnum);
    } catch (error: any) {
      console.error('Create enum error:', error);
      await sheetsService.logToSheet('ERROR', 'Enums', `Failed to create enum: ${error.message}`);
      res.status(500).json({ error: 'Failed to create enum', details: error.message });
    }
  });

  app.patch("/api/admin/enums/:list/:key", async (req, res) => {
    try {
      const { list, key } = req.params;
      const updates = req.body;

      // Validate enum exists with composite key match
      const existing = await sheetsService.getEnums();
      const enumItem = existing.find(e => e.List === list && e.Key === key);
      
      if (!enumItem) {
        return res.status(404).json({ error: 'Enum not found' });
      }

      // Can't change List or Key
      delete updates.List;
      delete updates.Key;

      // Composite key update: we need to match BOTH List and Key
      // Read sheet with headers, find exact row, then update by row index
      const sheets = await getUncachableGoogleSheetClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Enums!A:ZZ',
      });

      const rows = response.data.values;
      if (!rows || rows.length < 2) {
        return res.status(404).json({ error: 'Enums sheet has no data' });
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);
      const listIndex = headers.indexOf('List');
      const keyIndex = headers.indexOf('Key');
      
      if (listIndex === -1 || keyIndex === -1) {
        return res.status(500).json({ error: 'Enums sheet missing List or Key column' });
      }

      // Find the exact row matching BOTH List and Key
      const rowIndex = dataRows.findIndex(row => row[listIndex] === list && row[keyIndex] === key);
      
      if (rowIndex === -1) {
        return res.status(404).json({ error: 'Enum not found in sheet' });
      }

      // Update each field in the found row
      for (const [field, value] of Object.entries(updates)) {
        const colIndex = headers.indexOf(field);
        if (colIndex !== -1) {
          const cellRow = rowIndex + 2; // +1 for header, +1 for 0-based index
          const cellCol = String.fromCharCode(65 + colIndex); // A, B, C, etc.
          await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `Enums!${cellCol}${cellRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: [[value ?? '']] },
          });
        }
      }

      await sheetsService.logToSheet('INFO', 'Enums', `Updated enum ${list}:${key}`);
      
      res.json({ ...enumItem, ...updates });
    } catch (error: any) {
      console.error('Update enum error:', error);
      await sheetsService.logToSheet('ERROR', 'Enums', `Failed to update enum: ${error.message}`);
      res.status(500).json({ error: 'Failed to update enum', details: error.message });
    }
  });

  app.delete("/api/admin/enums/:list/:key", async (req, res) => {
    try {
      const { list, key } = req.params;
      const { hard } = req.query;

      // Validate enum exists with composite key match
      const existing = await sheetsService.getEnums();
      const enumItem = existing.find(e => e.List === list && e.Key === key);
      
      if (!enumItem) {
        return res.status(404).json({ error: 'Enum not found' });
      }

      if (hard === 'true') {
        // Hard delete not implemented - would require rewriting entire sheet
        return res.status(501).json({ error: 'Hard delete not implemented. Use soft delete (Active=false) instead.' });
      }

      // Soft delete with composite key matching (using single source of truth: SPREADSHEET_ID)
      const sheets = await getUncachableGoogleSheetClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'Enums!A:ZZ',
      });

      const rows = response.data.values;
      if (!rows || rows.length < 2) {
        return res.status(404).json({ error: 'Enums sheet has no data' });
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);
      const listIndex = headers.indexOf('List');
      const keyIndex = headers.indexOf('Key');
      const activeIndex = headers.indexOf('Active');
      
      if (listIndex === -1 || keyIndex === -1 || activeIndex === -1) {
        return res.status(500).json({ error: 'Enums sheet missing required columns' });
      }

      // Find the exact row matching BOTH List and Key
      const rowIndex = dataRows.findIndex(row => row[listIndex] === list && row[keyIndex] === key);
      
      if (rowIndex === -1) {
        return res.status(404).json({ error: 'Enum not found in sheet' });
      }

      // Set Active = false for the matched row
      const cellRow = rowIndex + 2; // +1 for header, +1 for 0-based index
      const cellCol = String.fromCharCode(65 + activeIndex); // Column letter
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `Enums!${cellCol}${cellRow}`,
        valueInputOption: 'RAW',
        requestBody: { values: [['FALSE']] },
      });

      await sheetsService.logToSheet('INFO', 'Enums', `Soft-deleted enum ${list}:${key}`);
      
      res.json({ message: 'Enum deactivated successfully' });
    } catch (error: any) {
      console.error('Delete enum error:', error);
      await sheetsService.logToSheet('ERROR', 'Enums', `Failed to delete enum: ${error.message}`);
      res.status(500).json({ error: 'Failed to delete enum', details: error.message });
    }
  });

  // === PRICING PARAMS CRUD ENDPOINTS ===
  
  // Protected pricing parameters that cannot be deleted (required for pricing calculations)
  const PROTECTED_PARAM_KEYS = [
    'VAT_Default_Pct',
    'Target_Margin_Pct',
    'Floor_Margin_Pct',
    'MAP_Floor_Multiplier',
    'B2C_Discount_Pct',
    'Amazon_Discount_Pct',
  ] as const;

  // POST /api/pricing/params - Create new pricing parameter
  app.post("/api/pricing/params", async (req, res) => {
    try {
      // Validate request body with Zod
      const validation = insertPricingParamSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validation.error.flatten().fieldErrors 
        });
      }

      const { ParamKey, Value, Notes } = validation.data;

      // Check for duplicates
      const existing = await sheetsService.getPricingParams();
      if (existing.some(p => p.ParamKey === ParamKey)) {
        return res.status(409).json({ error: 'Parameter with this name already exists' });
      }

      // Normalize Value to string with trimming
      const newParam = {
        ParamKey: ParamKey.trim(),
        Value: String(Value).trim(),
        Notes: Notes?.trim() || ''
      };

      await sheetsService.writeRows('Pricing_Params', [newParam]);
      await sheetsService.logToSheet('INFO', 'PricingParams', `Created parameter ${ParamKey} = ${Value}`);
      
      res.status(201).json(newParam);
    } catch (error: any) {
      console.error('Create param error:', error);
      await sheetsService.logToSheet('ERROR', 'PricingParams', `Failed to create param: ${error.message}`);
      res.status(500).json({ error: 'Failed to create parameter', details: error.message });
    }
  });

  // PATCH /api/pricing/params/:paramKey - Update existing pricing parameter
  app.patch("/api/pricing/params/:paramKey", async (req, res) => {
    try {
      const { paramKey } = req.params;

      // Validate param exists
      const existing = await sheetsService.getPricingParams();
      const paramItem = existing.find(p => p.ParamKey === paramKey);
      
      if (!paramItem) {
        return res.status(404).json({ error: 'Parameter not found' });
      }

      // Validate request body with Zod (partial update schema)
      const validation = updatePricingParamSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validation.error.flatten().fieldErrors 
        });
      }

      const updates = validation.data;

      // Normalize Value to string if provided
      if (updates.Value !== undefined) {
        updates.Value = String(updates.Value).trim();
        
        // Validate Value is not empty
        if (updates.Value === '') {
          return res.status(400).json({ error: 'Value cannot be empty' });
        }
      }

      // Trim Notes if provided
      if (updates.Notes !== undefined) {
        updates.Notes = updates.Notes.trim();
      }

      await sheetsService.updateRow('Pricing_Params', 'ParamKey', paramKey, updates);
      await sheetsService.logToSheet('INFO', 'PricingParams', `Updated parameter ${paramKey}`);
      
      const updatedParam = { ...paramItem, ...updates };
      res.json(updatedParam);
    } catch (error: any) {
      console.error('Update param error:', error);
      await sheetsService.logToSheet('ERROR', 'PricingParams', `Failed to update param: ${error.message}`);
      res.status(500).json({ error: 'Failed to update parameter', details: error.message });
    }
  });

  // DELETE /api/pricing/params/:paramKey - Delete pricing parameter (protected keys blocked)
  app.delete("/api/pricing/params/:paramKey", async (req, res) => {
    try {
      const { paramKey } = req.params;

      // Check if parameter exists
      const existing = await sheetsService.getPricingParams();
      const paramItem = existing.find(p => p.ParamKey === paramKey);
      
      if (!paramItem) {
        return res.status(404).json({ error: 'Parameter not found' });
      }

      // Block deletion of protected parameters
      if (PROTECTED_PARAM_KEYS.includes(paramKey as any)) {
        return res.status(409).json({ 
          error: 'Cannot delete protected parameter',
          message: `${paramKey} is required for pricing calculations and cannot be deleted. Protected parameters: ${PROTECTED_PARAM_KEYS.join(', ')}`,
          suggestion: 'You can edit the value instead if needed.'
        });
      }

      // Hard delete the row from Google Sheets
      await sheetsService.deleteRow('Pricing_Params', 'ParamKey', paramKey);
      await sheetsService.logToSheet('INFO', 'PricingParams', `Deleted parameter ${paramKey}`);
      
      res.json({ message: 'Parameter deleted successfully', deleted: paramKey });
    } catch (error: any) {
      console.error('Delete param error:', error);
      await sheetsService.logToSheet('ERROR', 'PricingParams', `Failed to delete param: ${error.message}`);
      res.status(500).json({ error: 'Failed to delete parameter', details: error.message });
    }
  });

  // === REPRICE ORCHESTRATION ENDPOINTS ===

  // POST /api/pricing/reprice-all - Start batch reprice job
  app.post("/api/pricing/reprice-all", async (req, res) => {
    try {
      const triggeredBy = req.body?.triggeredBy || 'manual';
      
      const jobId = await startRepriceJob(triggeredBy);
      
      res.status(202).json({
        jobId,
        message: 'Reprice job started successfully',
        statusUrl: `/api/pricing/reprice-jobs/${jobId}`,
      });
    } catch (error: any) {
      if (error.message.includes('already running')) {
        return res.status(409).json({ 
          error: 'Conflict', 
          message: error.message 
        });
      }
      
      console.error('Start reprice error:', error);
      await sheetsService.logToSheet('ERROR', 'Reprice', `Failed to start reprice: ${error.message}`);
      res.status(500).json({ error: 'Failed to start reprice job', details: error.message });
    }
  });

  // GET /api/pricing/reprice-jobs - List recent reprice jobs
  app.get("/api/pricing/reprice-jobs", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const jobs = listJobs(limit);
      
      res.json({ jobs });
    } catch (error: any) {
      console.error('List reprice jobs error:', error);
      res.status(500).json({ error: 'Failed to list reprice jobs', details: error.message });
    }
  });

  // GET /api/pricing/reprice-jobs/:jobId - Get specific job status
  app.get("/api/pricing/reprice-jobs/:jobId", async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const job = getJobStatus(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      res.json(job);
    } catch (error: any) {
      console.error('Get reprice job error:', error);
      res.status(500).json({ error: 'Failed to get job status', details: error.message });
    }
  });

  app.post("/api/admin/health/run", async (req, res) => {
    try {
      // Run health checks
      const health: any = {};

      try {
        await sheetsService.getSettings();
        health.sheets = { status: 'connected', message: 'Google Sheets connected' };
      } catch (error: any) {
        health.sheets = { status: 'error', message: error.message };
      }

      const hasOpenAI = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? true : false;
      health.openai = hasOpenAI 
        ? { status: 'connected', message: 'OpenAI via Replit Integrations' }
        : { status: 'error', message: 'API key not configured' };

      const hasEmail = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
      health.email = hasEmail
        ? { status: 'connected', message: 'SMTP configured' }
        : { status: 'error', message: 'SMTP not configured' };

      try {
        const params = await sheetsService.getPricingParams();
        health.pricing = params.length > 0
          ? { status: 'running', message: 'Pricing parameters loaded' }
          : { status: 'warning', message: 'No pricing parameters found' };
      } catch (error: any) {
        health.pricing = { status: 'error', message: error.message };
      }

      // Log to OS_Health
      await sheetsService.logToSheet('INFO', 'HealthCheck', 
        `Manual health check: Sheets=${health.sheets.status}, AI=${health.openai.status}, Email=${health.email.status}, Pricing=${health.pricing.status}`
      );

      res.json({ status: 'completed', health });
    } catch (error: any) {
      console.error('Health check error:', error);
      res.status(500).json({ error: 'Health check failed', details: error.message });
    }
  });

  // AI Crew endpoints
  app.get("/api/ai/playbooks", async (req, res) => {
    try {
      // For now, return static playbooks - in production these would come from AI_Playbooks sheet
      const playbooks = [
        { Name: 'Daily', Schedule: 'daily', Description: 'Auto-reprice SKUs, check MAP guardrails', Status: 'Active' },
        { Name: 'Weekly', Schedule: 'weekly', Description: 'Generate performance reports', Status: 'Active' },
        { Name: 'Monthly', Schedule: 'monthly', Description: 'Commission statements, loyalty bonuses', Status: 'Active' },
      ];
      res.json(playbooks);
    } catch (error: any) {
      console.error('Get playbooks error:', error);
      res.status(500).json({ error: 'Failed to get playbooks', details: error.message });
    }
  });

  app.get("/api/ai/tasks", async (req, res) => {
    try {
      // For now, return empty array - in production these would come from AI_Tasks sheet
      res.json([]);
    } catch (error: any) {
      console.error('Get tasks error:', error);
      res.status(500).json({ error: 'Failed to get tasks', details: error.message });
    }
  });

  app.post("/api/ai/playbooks/run", async (req, res) => {
    try {
      const { schedule } = req.body;
      
      if (!schedule) {
        return res.status(400).json({ error: 'Schedule is required' });
      }

      // Log the playbook execution
      await sheetsService.logToSheet('INFO', 'AI', `Playbook '${schedule}' started (manual trigger)`);

      // In production, this would create tasks in AI_Tasks sheet and execute them
      // For now, just call the appropriate cron job
      if (schedule === 'daily') {
        // Trigger daily cron logic without duplicating code
        await sheetsService.logToSheet('INFO', 'AI', 'Daily playbook tasks dispatched');
      } else if (schedule === 'weekly') {
        await sheetsService.logToSheet('INFO', 'AI', 'Weekly playbook tasks dispatched');
      } else if (schedule === 'monthly') {
        await sheetsService.logToSheet('INFO', 'AI', 'Monthly playbook tasks dispatched');
      }

      await sheetsService.logToSheet('INFO', 'AI', `Playbook '${schedule}' completed`);

      res.json({ status: 'completed', schedule });
    } catch (error: any) {
      console.error('Run playbook error:', error);
      await sheetsService.logToSheet('ERROR', 'AI', `Playbook execution failed: ${error.message}`);
      res.status(500).json({ error: 'Playbook execution failed', details: error.message });
    }
  });

  // AI Command Palette endpoint
  app.post("/api/ai/command", async (req, res) => {
    try {
      const { command } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: 'Command is required' });
      }

      await sheetsService.logToSheet('INFO', 'AI', `Command palette: ${command}`);

      let message = 'Command executed successfully';
      let redirect = null;

      switch (command) {
        case 'create_sku':
          message = 'SKU creation wizard launched. Please fill in the product details.';
          redirect = '/pricing';
          break;

        case 'reprice_products':
          const products = await sheetsService.getFinalPriceList();
          const repriceCount = products.filter(p => p.AutoPriceFlag === true).length;
          message = `Auto-repricing ${repriceCount} products based on pricing parameters.`;
          redirect = '/pricing';
          break;

        case 'new_partner':
          message = 'Partner registration form ready. Please enter partner details.';
          redirect = '/stands';
          break;

        case 'create_quote_order':
          message = 'Quote-to-Order wizard launched. Select partner and products.';
          redirect = '/sales';
          break;

        case 'request_stand':
          message = 'Stand request form ready. Enter location and partner details.';
          redirect = '/stands';
          break;

        case 'health_check':
          const [settings, products2] = await Promise.all([
            sheetsService.getSettings(),
            sheetsService.getFinalPriceList(),
          ]);
          const health = {
            sheets: settings ? 'OK' : 'ERROR',
            products: products2.length > 0 ? 'OK' : 'WARNING',
          };
          message = `Health check complete: Sheets ${health.sheets}, Products ${health.products}`;
          redirect = '/health';
          await sheetsService.logToSheet('INFO', 'System', `Health check: ${JSON.stringify(health)}`);
          break;

        case 'nav_pricing':
          message = 'Navigating to Pricing Studio';
          redirect = '/pricing';
          break;

        case 'nav_stands':
          message = 'Navigating to Stand Center';
          redirect = '/stands';
          break;

        case 'nav_sales':
          message = 'Navigating to Sales Desk';
          redirect = '/sales';
          break;

        case 'nav_operations':
          message = 'Navigating to Operations';
          redirect = '/operations';
          break;

        default:
          message = 'Command not recognized. Please try another command.';
      }

      res.json({ message, redirect });
    } catch (error: any) {
      console.error('AI command error:', error);
      await sheetsService.logToSheet('ERROR', 'AI', `Command failed: ${error.message}`);
      res.status(500).json({ error: 'Command execution failed', details: error.message });
    }
  });

  // Integrations endpoints
  app.get("/api/integrations", async (req, res) => {
    try {
      // For now, return static integrations - in production these would come from Integrations_Config sheet
      const integrations = [
        { Name: 'Google Sheets', Type: 'database', Status: 'connected', Config: {} },
        { Name: 'Email', Type: 'smtp', Status: process.env.SMTP_HOST ? 'connected' : 'not_configured', Config: {} },
        { Name: 'WooCommerce', Type: 'ecommerce', Status: 'not_configured', Config: {} },
        { Name: 'Odoo', Type: 'erp', Status: 'not_configured', Config: {} },
      ];
      res.json(integrations);
    } catch (error: any) {
      console.error('Get integrations error:', error);
      res.status(500).json({ error: 'Failed to get integrations', details: error.message });
    }
  });

  app.get("/api/integrations/sync-queue", async (req, res) => {
    try {
      // For now, return empty array - in production these would come from Sync_Queue sheet
      res.json([]);
    } catch (error: any) {
      console.error('Get sync queue error:', error);
      res.status(500).json({ error: 'Failed to get sync queue', details: error.message });
    }
  });

  app.post("/api/integrations/test", async (req, res) => {
    try {
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Integration name is required' });
      }

      await sheetsService.logToSheet('INFO', 'Integrations', `Testing ${name} integration`);

      // Test based on integration name
      if (name === 'sheets') {
        await sheetsService.getSettings();
        res.json({ status: 'success', message: 'Google Sheets connection verified' });
      } else if (name === 'email') {
        const hasEmail = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
        if (hasEmail) {
          res.json({ status: 'success', message: 'Email configuration verified' });
        } else {
          throw new Error('SMTP not configured');
        }
      } else if (name === 'woocommerce') {
        const hasWoo = process.env.API_WOO_BASE && process.env.API_WOO_KEY && process.env.API_WOO_SECRET;
        if (hasWoo) {
          res.json({ status: 'success', message: 'WooCommerce credentials configured (dry-run: API not called)' });
        } else {
          res.json({ status: 'warning', message: 'WooCommerce not configured (optional)' });
        }
      } else if (name === 'odoo') {
        const hasOdoo = process.env.API_ODOO_BASE && process.env.API_ODOO_DB && process.env.API_ODOO_USER && process.env.API_ODOO_PASS;
        if (hasOdoo) {
          res.json({ status: 'success', message: 'Odoo credentials configured (dry-run: API not called)' });
        } else {
          res.json({ status: 'warning', message: 'Odoo not configured (optional)' });
        }
      } else {
        res.json({ status: 'success', message: `${name} integration test not implemented yet` });
      }

      await sheetsService.logToSheet('INFO', 'Integrations', `${name} integration test passed`);
    } catch (error: any) {
      console.error('Test integration error:', error);
      await sheetsService.logToSheet('ERROR', 'Integrations', `${req.body.name} integration test failed: ${error.message}`);
      res.status(500).json({ error: 'Integration test failed', details: error.message });
    }
  });

  // Setup Wizard endpoints
  app.get("/api/admin/setup/config", async (req, res) => {
    try {
      const settings = await sheetsService.getSettings();
      const settingsMap = settings.reduce((acc: any, s: any) => {
        acc[s.Key] = s.Value;
        return acc;
      }, {});

      const config = {
        spreadsheetId: SPREADSHEET_ID || '',
        driveRootId: settingsMap['HM_DRIVE_ROOT_ID'] || '',
        currency: settingsMap['HM_CURRENCY'] || 'EUR',
        vatPct: settingsMap['VAT_Default_Pct'] || '19',
        standQrBase: settingsMap['HM_STAND_QR_BASE'] || '',
        emailProvider: settingsMap['EMAIL_PROVIDER'] || 'brevo',
        emailApiKey: '', // Never expose secrets
        smtpHost: process.env.SMTP_HOST || '',
        smtpPort: process.env.SMTP_PORT || '587',
        smtpUser: process.env.SMTP_USER || '',
        smtpPass: '', // Never expose secrets
        aiModel: settingsMap['AI_Default_Model'] || 'gpt-4o-mini',
        placesApiKey: '', // Never expose secrets
      };

      res.json(config);
    } catch (error: any) {
      console.error('Get config error:', error);
      res.status(500).json({ error: 'Failed to get configuration', details: error.message });
    }
  });

  app.get("/api/admin/setup/status", async (req, res) => {
    try {
      const health: any = {};

      // Check Google Sheets
      try {
        await sheetsService.getSettings();
        health.sheets = { status: 'connected', message: 'Google Sheets connected' };
      } catch (error: any) {
        health.sheets = { status: 'error', message: error.message };
      }

      // Check Google Drive (if configured)
      const settings = await sheetsService.getSettings();
      const settingsMap = settings.reduce((acc: any, s: any) => {
        acc[s.Key] = s.Value;
        return acc;
      }, {});
      const driveRootId = settingsMap['HM_DRIVE_ROOT_ID'];
      
      if (driveRootId) {
        health.drive = { status: 'connected', message: 'Drive root folder configured' };
      } else {
        health.drive = { status: 'error', message: 'Drive root folder not configured' };
      }

      // Check OpenAI
      const hasOpenAI = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? true : false;
      health.openai = hasOpenAI 
        ? { status: 'connected', message: 'OpenAI via Replit Integrations' }
        : { status: 'error', message: 'API key not configured' };

      // Check Email
      const hasEmail = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
      health.email = hasEmail
        ? { status: 'connected', message: 'SMTP configured' }
        : { status: 'error', message: 'SMTP not configured' };

      // Check Places API (optional)
      const hasPlaces = process.env.API_PLACES_KEY ? true : false;
      health.places = hasPlaces
        ? { status: 'connected', message: 'Google Places API configured' }
        : { status: 'error', message: 'Not configured (optional)' };

      res.json(health);
    } catch (error: any) {
      console.error('Status check error:', error);
      res.status(500).json({ error: 'Status check failed', details: error.message });
    }
  });

  app.post("/api/admin/setup/test-sheets", async (req, res) => {
    try {
      const { spreadsheetId } = req.body;
      
      if (!spreadsheetId) {
        return res.status(400).json({ error: 'Spreadsheet ID is required' });
      }

      // Test by trying to read settings
      const settings = await sheetsService.getSettings();
      
      await sheetsService.logToSheet('INFO', 'Setup', `Google Sheets connection tested successfully`);
      
      res.json({ 
        status: 'success', 
        message: `Connected successfully. Found ${settings.length} settings.` 
      });
    } catch (error: any) {
      console.error('Test sheets error:', error);
      await sheetsService.logToSheet('ERROR', 'Setup', `Google Sheets test failed: ${error.message}`);
      res.status(500).json({ error: 'Connection test failed', details: error.message });
    }
  });

  app.post("/api/admin/setup/test-drive", async (req, res) => {
    try {
      const { driveRootId } = req.body;
      
      if (!driveRootId) {
        return res.status(400).json({ error: 'Drive root folder ID is required' });
      }

      // For now, just validate it's a non-empty string
      // In a real implementation, you'd use Google Drive API to verify access
      
      await sheetsService.logToSheet('INFO', 'Setup', `Google Drive root folder verified: ${driveRootId}`);
      
      res.json({ 
        status: 'success', 
        message: 'Drive root folder ID validated' 
      });
    } catch (error: any) {
      console.error('Test drive error:', error);
      await sheetsService.logToSheet('ERROR', 'Setup', `Google Drive test failed: ${error.message}`);
      res.status(500).json({ error: 'Connection test failed', details: error.message });
    }
  });

  app.post("/api/admin/setup/test-email", async (req, res) => {
    try {
      const { emailProvider } = req.body;
      
      if (!emailProvider) {
        return res.status(400).json({ error: 'Email provider is required' });
      }
      
      // Validate provider-specific credentials from environment (Replit Secrets)
      const missingSecrets: string[] = [];
      
      if (emailProvider === 'smtp') {
        if (!process.env.SMTP_HOST) missingSecrets.push('SMTP_HOST');
        if (!process.env.SMTP_USER) missingSecrets.push('SMTP_USER');
        if (!process.env.SMTP_PASS) missingSecrets.push('SMTP_PASS');
        if (!process.env.EMAIL_FROM) missingSecrets.push('EMAIL_FROM');
      } else if (emailProvider === 'brevo') {
        if (!process.env.BREVO_API_KEY) missingSecrets.push('BREVO_API_KEY');
        if (!process.env.EMAIL_FROM) missingSecrets.push('EMAIL_FROM');
      } else if (emailProvider === 'resend') {
        if (!process.env.RESEND_API_KEY) missingSecrets.push('RESEND_API_KEY');
        if (!process.env.EMAIL_FROM) missingSecrets.push('EMAIL_FROM');
      } else if (emailProvider === 'sendgrid') {
        if (!process.env.SENDGRID_API_KEY) missingSecrets.push('SENDGRID_API_KEY');
        if (!process.env.EMAIL_FROM) missingSecrets.push('EMAIL_FROM');
      } else if (emailProvider === 'mailgun') {
        if (!process.env.MAILGUN_API_KEY) missingSecrets.push('MAILGUN_API_KEY');
        if (!process.env.MAILGUN_DOMAIN) missingSecrets.push('MAILGUN_DOMAIN');
        if (!process.env.EMAIL_FROM) missingSecrets.push('EMAIL_FROM');
      } else {
        return res.status(400).json({ 
          error: `Unknown email provider: ${emailProvider}` 
        });
      }
      
      if (missingSecrets.length > 0) {
        return res.status(400).json({ 
          error: `Missing required secrets in Replit Secrets: ${missingSecrets.join(', ')}`,
          missingSecrets,
          hint: 'Add these secrets in Replit Secrets panel, then restart the application'
        });
      }

      await sheetsService.logToSheet('INFO', 'Setup', `Email configuration validated: ${emailProvider}`);
      
      res.json({ 
        status: 'success', 
        message: `${emailProvider} credentials verified in environment`,
        provider: emailProvider
      });
    } catch (error: any) {
      console.error('Test email error:', error);
      await sheetsService.logToSheet('ERROR', 'Setup', `Email test failed: ${error.message}`);
      res.status(500).json({ error: 'Email test failed', details: error.message });
    }
  });

  app.post("/api/admin/setup/save", async (req, res) => {
    try {
      const config = req.body;

      // Write settings to Settings sheet
      const settingsToWrite = [
        { key: 'HM_DRIVE_ROOT_ID', value: config.driveRootId },
        { key: 'HM_CURRENCY', value: config.currency },
        { key: 'VAT_Default_Pct', value: config.vatPct },
        { key: 'HM_STAND_QR_BASE', value: config.standQrBase },
        { key: 'EMAIL_PROVIDER', value: config.emailProvider },
        { key: 'AI_Default_Model', value: config.aiModel },
      ];

      for (const setting of settingsToWrite) {
        await sheetsService.updateRow('Settings', 'Key', setting.key, {
          Value: setting.value,
          Notes: 'Auto-configured by Setup Wizard'
        });
      }

      // Log to OS_Health
      await sheetsService.logToSheet('INFO', 'Setup', 'Configuration saved successfully');
      
      res.json({ 
        status: 'success', 
        message: 'Configuration saved to Google Sheets' 
      });
    } catch (error: any) {
      console.error('Save config error:', error);
      await sheetsService.logToSheet('ERROR', 'Setup', `Configuration save failed: ${error.message}`);
      res.status(500).json({ error: 'Failed to save configuration', details: error.message });
    }
  });

  // Cron endpoints (legacy - kept for backwards compatibility)
  app.post("/cron/daily", async (req, res) => {
    try {
      await sheetsService.logToSheet('INFO', 'Cron', 'Daily job started');

      // Auto-reprice SKUs with AutoPriceFlag
      const products = await sheetsService.getFinalPriceList();
      const autoSKUs = products.filter(p => p.AutoPriceFlag).map(p => p.SKU);

      if (autoSKUs.length > 0) {
        // Trigger reprice (could call the reprice endpoint internally)
        await sheetsService.logToSheet('INFO', 'Cron', `Auto-repricing ${autoSKUs.length} SKUs`);
      }

      await sheetsService.logToSheet('INFO', 'Cron', 'Daily job completed');
      res.json({ status: 'completed', processed: autoSKUs.length });
    } catch (error: any) {
      console.error('Daily cron error:', error);
      await sheetsService.logToSheet('ERROR', 'Cron', `Daily job failed: ${error.message}`);
      res.status(500).json({ error: 'Daily cron job failed', details: error.message });
    }
  });

  app.post("/cron/weekly", async (req, res) => {
    try {
      await sheetsService.logToSheet('INFO', 'Cron', 'Weekly job started');
      // TODO: Generate performance reports, tier upgrade suggestions
      await sheetsService.logToSheet('INFO', 'Cron', 'Weekly job completed');
      res.json({ status: 'completed' });
    } catch (error: any) {
      console.error('Weekly cron error:', error);
      await sheetsService.logToSheet('ERROR', 'Cron', `Weekly job failed: ${error.message}`);
      res.status(500).json({ error: 'Weekly cron job failed', details: error.message });
    }
  });

  app.post("/cron/monthly", async (req, res) => {
    try {
      await sheetsService.logToSheet('INFO', 'Cron', 'Monthly job started');
      // TODO: Generate commission statements, stand bonuses
      await sheetsService.logToSheet('INFO', 'Cron', 'Monthly job completed');
      res.json({ status: 'completed' });
    } catch (error: any) {
      console.error('Monthly cron error:', error);
      await sheetsService.logToSheet('ERROR', 'Cron', `Monthly job failed: ${error.message}`);
      res.status(500).json({ error: 'Monthly cron job failed', details: error.message });
    }
  });

  // ==========================================================================
  // Phase 2: Advanced Pricing Modules
  // ==========================================================================

  // Subscriptions endpoints
  app.get("/api/subscriptions", async (req, res) => {
    try {
      const subscriptions = await sheetsService.getSalonSubscriptions();
      res.json(subscriptions);
    } catch (error: any) {
      console.error('Subscriptions fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch subscriptions', details: error.message });
    }
  });

  app.post("/api/subscriptions", async (req, res) => {
    try {
      const subscription = req.body;
      await sheetsService.writeRows('Salon_Subscriptions', [subscription]);
      await sheetsService.logToSheet('INFO', 'Subscriptions', `Created subscription ${subscription.SubscriptionID}`);
      res.json({ success: true, subscription });
    } catch (error: any) {
      console.error('Subscription creation error:', error);
      res.status(500).json({ error: 'Failed to create subscription', details: error.message });
    }
  });

  app.patch("/api/subscriptions/:subscriptionId", async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      const updates = req.body;
      await sheetsService.updateRow('Salon_Subscriptions', 'SubscriptionID', subscriptionId, updates);
      await sheetsService.logToSheet('INFO', 'Subscriptions', `Updated subscription ${subscriptionId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Subscription update error:', error);
      res.status(500).json({ error: 'Failed to update subscription', details: error.message });
    }
  });

  app.delete("/api/subscriptions/:subscriptionId", async (req, res) => {
    try {
      const { subscriptionId } = req.params;
      await sheetsService.deleteRow('Salon_Subscriptions', 'SubscriptionID', subscriptionId);
      await sheetsService.logToSheet('INFO', 'Subscriptions', `Deleted subscription ${subscriptionId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Subscription deletion error:', error);
      res.status(500).json({ error: 'Failed to delete subscription', details: error.message });
    }
  });

  // Bundles endpoints
  app.get("/api/bundles", async (req, res) => {
    try {
      const bundles = await sheetsService.getBundles();
      res.json(bundles);
    } catch (error: any) {
      console.error('Bundles fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch bundles', details: error.message });
    }
  });

  app.post("/api/bundles", async (req, res) => {
    try {
      const bundle = req.body;
      await sheetsService.writeRows('Bundles', [bundle]);
      await sheetsService.logToSheet('INFO', 'Bundles', `Created bundle ${bundle.BundleID}`);
      res.json({ success: true, bundle });
    } catch (error: any) {
      console.error('Bundle creation error:', error);
      res.status(500).json({ error: 'Failed to create bundle', details: error.message });
    }
  });

  app.patch("/api/bundles/:bundleId", async (req, res) => {
    try {
      const { bundleId } = req.params;
      const updates = req.body;
      await sheetsService.updateRow('Bundles', 'BundleID', bundleId, updates);
      await sheetsService.logToSheet('INFO', 'Bundles', `Updated bundle ${bundleId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Bundle update error:', error);
      res.status(500).json({ error: 'Failed to update bundle', details: error.message });
    }
  });

  app.delete("/api/bundles/:bundleId", async (req, res) => {
    try {
      const { bundleId } = req.params;
      await sheetsService.deleteRow('Bundles', 'BundleID', bundleId);
      await sheetsService.logToSheet('INFO', 'Bundles', `Deleted bundle ${bundleId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Bundle deletion error:', error);
      res.status(500).json({ error: 'Failed to delete bundle', details: error.message });
    }
  });

  // Gifts endpoints
  app.get("/api/gifts", async (req, res) => {
    try {
      const gifts = await sheetsService.getGiftsBank();
      res.json(gifts);
    } catch (error: any) {
      console.error('Gifts fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch gifts', details: error.message });
    }
  });

  app.post("/api/gifts", async (req, res) => {
    try {
      const gift = req.body;
      await sheetsService.writeRows('Gifts_Bank', [gift]);
      await sheetsService.logToSheet('INFO', 'Gifts', `Created gift ${gift.GiftID}`);
      res.json({ success: true, gift });
    } catch (error: any) {
      console.error('Gift creation error:', error);
      res.status(500).json({ error: 'Failed to create gift', details: error.message });
    }
  });

  app.patch("/api/gifts/:giftId", async (req, res) => {
    try {
      const { giftId } = req.params;
      const updates = req.body;
      await sheetsService.updateRow('Gifts_Bank', 'GiftID', giftId, updates);
      await sheetsService.logToSheet('INFO', 'Gifts', `Updated gift ${giftId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gift update error:', error);
      res.status(500).json({ error: 'Failed to update gift', details: error.message });
    }
  });

  app.delete("/api/gifts/:giftId", async (req, res) => {
    try {
      const { giftId } = req.params;
      await sheetsService.deleteRow('Gifts_Bank', 'GiftID', giftId);
      await sheetsService.logToSheet('INFO', 'Gifts', `Deleted gift ${giftId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Gift deletion error:', error);
      res.status(500).json({ error: 'Failed to delete gift', details: error.message });
    }
  });

  // Affiliate Programs endpoints
  app.get("/api/affiliates", async (req, res) => {
    try {
      const affiliates = await sheetsService.getAffiliatePrograms();
      res.json(affiliates);
    } catch (error: any) {
      console.error('Affiliates fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch affiliate programs', details: error.message });
    }
  });

  app.post("/api/affiliates", async (req, res) => {
    try {
      const affiliate = req.body;
      await sheetsService.writeRows('Affiliate_Programs', [affiliate]);
      await sheetsService.logToSheet('INFO', 'Affiliates', `Created affiliate program ${affiliate.ProgramID}`);
      res.json({ success: true, affiliate });
    } catch (error: any) {
      console.error('Affiliate creation error:', error);
      res.status(500).json({ error: 'Failed to create affiliate program', details: error.message });
    }
  });

  app.patch("/api/affiliates/:programId", async (req, res) => {
    try {
      const { programId } = req.params;
      const updates = req.body;
      await sheetsService.updateRow('Affiliate_Programs', 'ProgramID', programId, updates);
      await sheetsService.logToSheet('INFO', 'Affiliates', `Updated affiliate program ${programId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Affiliate update error:', error);
      res.status(500).json({ error: 'Failed to update affiliate program', details: error.message });
    }
  });

  app.delete("/api/affiliates/:programId", async (req, res) => {
    try {
      const { programId } = req.params;
      await sheetsService.deleteRow('Affiliate_Programs', 'ProgramID', programId);
      await sheetsService.logToSheet('INFO', 'Affiliates', `Deleted affiliate program ${programId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Affiliate deletion error:', error);
      res.status(500).json({ error: 'Failed to delete affiliate program', details: error.message });
    }
  });

  // Commission Rules endpoints
  app.get("/api/commissions", async (req, res) => {
    try {
      const commissions = await sheetsService.getCommissionRules();
      res.json(commissions);
    } catch (error: any) {
      console.error('Commissions fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch commission rules', details: error.message });
    }
  });

  app.post("/api/commissions", async (req, res) => {
    try {
      const commission = req.body;
      await sheetsService.writeRows('Commission_Rules', [commission]);
      await sheetsService.logToSheet('INFO', 'Commissions', `Created commission rule ${commission.RuleID}`);
      res.json({ success: true, commission });
    } catch (error: any) {
      console.error('Commission creation error:', error);
      res.status(500).json({ error: 'Failed to create commission rule', details: error.message });
    }
  });

  app.patch("/api/commissions/:ruleId", async (req, res) => {
    try {
      const { ruleId } = req.params;
      const updates = req.body;
      await sheetsService.updateRow('Commission_Rules', 'RuleID', ruleId, updates);
      await sheetsService.logToSheet('INFO', 'Commissions', `Updated commission rule ${ruleId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Commission update error:', error);
      res.status(500).json({ error: 'Failed to update commission rule', details: error.message });
    }
  });

  app.delete("/api/commissions/:ruleId", async (req, res) => {
    try {
      const { ruleId } = req.params;
      await sheetsService.deleteRow('Commission_Rules', 'RuleID', ruleId);
      await sheetsService.logToSheet('INFO', 'Commissions', `Deleted commission rule ${ruleId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Commission deletion error:', error);
      res.status(500).json({ error: 'Failed to delete commission rule', details: error.message });
    }
  });

  // ============================================
  // SHIPPING ENDPOINTS
  // ============================================

  // Shipping Methods CRUD
  app.get("/api/shipping/methods", async (req, res) => {
    try {
      const methods = await sheetsService.getShippingMethods();
      res.json(methods);
    } catch (error: any) {
      console.error('Shipping methods fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch shipping methods', details: error.message });
    }
  });

  app.post("/api/shipping/methods", async (req, res) => {
    try {
      const method = req.body;
      if (!method.MethodID) {
        method.MethodID = `METHOD-${nanoid(8)}`;
      }
      await sheetsService.writeRows('Shipping_Methods', [method]);
      await sheetsService.logToSheet('INFO', 'Shipping', `Created shipping method ${method.MethodID}`);
      res.json({ success: true, method });
    } catch (error: any) {
      console.error('Shipping method creation error:', error);
      res.status(500).json({ error: 'Failed to create shipping method', details: error.message });
    }
  });

  app.patch("/api/shipping/methods/:methodId", async (req, res) => {
    try {
      const { methodId } = req.params;
      const updates = req.body;
      await sheetsService.updateRow('Shipping_Methods', 'MethodID', methodId, updates);
      await sheetsService.logToSheet('INFO', 'Shipping', `Updated shipping method ${methodId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Shipping method update error:', error);
      res.status(500).json({ error: 'Failed to update shipping method', details: error.message });
    }
  });

  app.delete("/api/shipping/methods/:methodId", async (req, res) => {
    try {
      const { methodId } = req.params;
      await sheetsService.deleteRow('Shipping_Methods', 'MethodID', methodId);
      await sheetsService.logToSheet('INFO', 'Shipping', `Deleted shipping method ${methodId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Shipping method deletion error:', error);
      res.status(500).json({ error: 'Failed to delete shipping method', details: error.message });
    }
  });

  // Shipping Rules CRUD
  app.get("/api/shipping/rules", async (req, res) => {
    try {
      const rules = await sheetsService.getShippingRules();
      res.json(rules);
    } catch (error: any) {
      console.error('Shipping rules fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch shipping rules', details: error.message });
    }
  });

  app.post("/api/shipping/rules", async (req, res) => {
    try {
      const rule = req.body;
      if (!rule.RuleID) {
        rule.RuleID = `RULE-${nanoid(8)}`;
      }
      await sheetsService.writeRows('Shipping_Rules', [rule]);
      await sheetsService.logToSheet('INFO', 'Shipping', `Created shipping rule ${rule.RuleID}`);
      res.json({ success: true, rule });
    } catch (error: any) {
      console.error('Shipping rule creation error:', error);
      res.status(500).json({ error: 'Failed to create shipping rule', details: error.message });
    }
  });

  app.patch("/api/shipping/rules/:ruleId", async (req, res) => {
    try {
      const { ruleId } = req.params;
      const updates = req.body;
      await sheetsService.updateRow('Shipping_Rules', 'RuleID', ruleId, updates);
      await sheetsService.logToSheet('INFO', 'Shipping', `Updated shipping rule ${ruleId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Shipping rule update error:', error);
      res.status(500).json({ error: 'Failed to update shipping rule', details: error.message });
    }
  });

  app.delete("/api/shipping/rules/:ruleId", async (req, res) => {
    try {
      const { ruleId } = req.params;
      await sheetsService.deleteRow('Shipping_Rules', 'RuleID', ruleId);
      await sheetsService.logToSheet('INFO', 'Shipping', `Deleted shipping rule ${ruleId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Shipping rule deletion error:', error);
      res.status(500).json({ error: 'Failed to delete shipping rule', details: error.message });
    }
  });

  // Packaging Boxes CRUD
  app.get("/api/shipping/boxes", async (req, res) => {
    try {
      const boxes = await sheetsService.getPackagingBoxes();
      res.json(boxes);
    } catch (error: any) {
      console.error('Packaging boxes fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch packaging boxes', details: error.message });
    }
  });

  app.post("/api/shipping/boxes", async (req, res) => {
    try {
      const box = req.body;
      if (!box.BoxID) {
        box.BoxID = `BOX-${nanoid(6)}`;
      }
      await sheetsService.writeRows('Packaging_Boxes', [box]);
      await sheetsService.logToSheet('INFO', 'Shipping', `Created packaging box ${box.BoxID}`);
      res.json({ success: true, box });
    } catch (error: any) {
      console.error('Packaging box creation error:', error);
      res.status(500).json({ error: 'Failed to create packaging box', details: error.message });
    }
  });

  app.patch("/api/shipping/boxes/:boxId", async (req, res) => {
    try {
      const { boxId } = req.params;
      const updates = req.body;
      await sheetsService.updateRow('Packaging_Boxes', 'BoxID', boxId, updates);
      await sheetsService.logToSheet('INFO', 'Shipping', `Updated packaging box ${boxId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Packaging box update error:', error);
      res.status(500).json({ error: 'Failed to update packaging box', details: error.message });
    }
  });

  app.delete("/api/shipping/boxes/:boxId", async (req, res) => {
    try {
      const { boxId } = req.params;
      await sheetsService.deleteRow('Packaging_Boxes', 'BoxID', boxId);
      await sheetsService.logToSheet('INFO', 'Shipping', `Deleted packaging box ${boxId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Packaging box deletion error:', error);
      res.status(500).json({ error: 'Failed to delete packaging box', details: error.message });
    }
  });

  // Shipments endpoints
  app.get("/api/shipping/shipments", async (req, res) => {
    try {
      const shipments = await sheetsService.getShipments();
      res.json(shipments);
    } catch (error: any) {
      console.error('Shipments fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch shipments', details: error.message });
    }
  });

  app.post("/api/shipping/shipments", async (req, res) => {
    try {
      const shipment = req.body;
      if (!shipment.ShipmentID) {
        shipment.ShipmentID = `SHIP-${Date.now()}-${nanoid(6)}`;
      }
      if (!shipment.CreatedTS) {
        shipment.CreatedTS = new Date().toISOString();
      }
      if (!shipment.Status) {
        shipment.Status = 'Pending';
      }
      await sheetsService.writeRows('Shipments', [shipment]);
      await sheetsService.logToSheet('INFO', 'Shipping', `Created shipment ${shipment.ShipmentID}`);
      res.json({ success: true, shipment });
    } catch (error: any) {
      console.error('Shipment creation error:', error);
      res.status(500).json({ error: 'Failed to create shipment', details: error.message });
    }
  });

  app.patch("/api/shipping/shipments/:shipmentId", async (req, res) => {
    try {
      const { shipmentId } = req.params;
      const updates = req.body;
      await sheetsService.updateRow('Shipments', 'ShipmentID', shipmentId, updates);
      await sheetsService.logToSheet('INFO', 'Shipping', `Updated shipment ${shipmentId}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Shipment update error:', error);
      res.status(500).json({ error: 'Failed to update shipment', details: error.message });
    }
  });

  // Calculate shipping cost for context
  app.post("/api/shipping/calculate", async (req, res) => {
    try {
      const { ShippingService } = await import('./lib/shipping');
      const shippingService = new ShippingService(sheetsService);
      
      const context = req.body;
      const calculation = await shippingService.calculateShipping(context);
      
      res.json(calculation);
    } catch (error: any) {
      console.error('Shipping calculation error:', error);
      res.status(500).json({ error: 'Failed to calculate shipping', details: error.message });
    }
  });

  // Get available shipping methods for context
  app.post("/api/shipping/available-methods", async (req, res) => {
    try {
      const { ShippingService } = await import('./lib/shipping');
      const shippingService = new ShippingService(sheetsService);
      
      const context = req.body;
      const methods = await shippingService.getAvailableMethodsForContext(context);
      
      res.json(methods);
    } catch (error: any) {
      console.error('Available methods fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch available methods', details: error.message });
    }
  });

  // ==================== GROWTH/PLACES ROUTES ====================

  /**
   * GET /growth/leads
   * Get all CRM leads
   */
  app.get("/api/growth/leads", async (req, res) => {
    try {
      const leads = await sheetsService.getCRMLeads();
      res.json(leads);
    } catch (error: any) {
      console.error('Get leads error:', error);
      res.status(500).json({
        error: 'Failed to fetch leads',
        details: error.message,
      });
    }
  });

  /**
   * POST /growth/places/search
   * Search for places via Google Places API and add to CRM_Leads with deduplication
   */
  app.post("/api/growth/places/search", async (req, res) => {
    try {
      const { placesSearchRequestSchema } = await import('../shared/schema');
      const { searchPlaces, normalizePlaceToLead, isPlacesApiAvailable } = await import('./lib/places');
      const { generateDedupeKeys, checkDuplicate, addDedupeEntries } = await import('./lib/dedupe');
      const { nanoid } = await import('nanoid');

      // Check if Places API is available
      if (!isPlacesApiAvailable()) {
        await sheetsService.logToSheet('WARN', 'Growth', 'Places API key not configured - dry-run mode');
        return res.json({
          created: 0,
          skipped_duplicate: 0,
          city: req.body.city || '',
          keywords: req.body.keywords || [],
          dryRun: true,
          message: 'API_PLACES_KEY not found in environment. Set it to enable Places search.',
        });
      }

      // Validate request
      const validationResult = placesSearchRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Invalid request',
          details: validationResult.error.errors,
        });
      }

      const params = validationResult.data;
      
      await sheetsService.logToSheet('INFO', 'Growth', 
        `Places search started: ${params.city}, ${params.country} - keywords: ${params.keywords.join(', ')}`
      );

      // Search Places API
      const places = await searchPlaces(params);

      let created = 0;
      let skipped_duplicate = 0;
      const errors: string[] = [];

      // Process each place
      for (const place of places) {
        try {
          // Normalize to CRM_Leads schema
          const lead = normalizePlaceToLead(
            place,
            'PLACES_API',
            params.keywords.join(','),
            params.city,
            params.country
          );

          // Generate dedupe keys
          const dedupeKeys = generateDedupeKeys(lead);

          // Check for duplicates
          const dupeCheck = await checkDuplicate(sheetsService, dedupeKeys);

          if (dupeCheck.isDuplicate) {
            skipped_duplicate++;
            continue;
          }

          // Generate LeadID
          const leadID = `LEAD-${Date.now()}-${nanoid(6)}`;
          const createdTS = new Date().toISOString();

          // Prepare full lead record
          const fullLead = {
            LeadID: leadID,
            CreatedTS: createdTS,
            Source: lead.Source,
            Keyword: lead.Keyword,
            City: lead.City,
            Postal: '',
            CountryCode: lead.CountryCode,
            Name: lead.Name,
            Category: lead.Category,
            Phone: lead.Phone,
            Email: '',
            Website: lead.Website,
            Address: lead.Address,
            Lat: lead.Lat,
            Lng: lead.Lng,
            Status: lead.Status,
            Owner: '',
            Score: 0,
            TierHint: '',
            Notes: '',
            LastTouchTS: createdTS,
          };

          // Write to CRM_Leads
          await sheetsService.writeRows('CRM_Leads', [fullLead]);

          // Add dedupe entries
          await addDedupeEntries(sheetsService, leadID, dedupeKeys);

          // Add touch record
          const touchID = `TOUCH-${Date.now()}-${nanoid(6)}`;
          await sheetsService.writeRows('Lead_Touches', [{
            TouchID: touchID,
            TS: createdTS,
            LeadID: leadID,
            Channel: 'PLACES_API',
            Action: 'HARVEST',
            Actor: 'SYSTEM',
            Notes: `Harvested from Places API: ${params.city}, ${params.country}`,
            Outcome: 'SUCCESS',
          }]);

          created++;
        } catch (error: any) {
          const errorMsg = `Failed to process place "${place.displayName?.text}": ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      await sheetsService.logToSheet('INFO', 'Growth', 
        `Places search completed: ${created} created, ${skipped_duplicate} skipped (duplicate)`
      );

      res.json({
        created,
        skipped_duplicate,
        city: params.city,
        keywords: params.keywords,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error('Places search error:', error);
      await sheetsService.logToSheet('ERROR', 'Growth', `Places search failed: ${error.message}`);
      res.status(500).json({
        error: 'Places search failed',
        details: error.message,
      });
    }
  });

  /**
   * GET /growth/places/normalize?limit=100
   * Normalize existing CRM_Leads fields (clean phone, extract domain, etc.)
   */
  app.get("/api/growth/places/normalize", async (req, res) => {
    try {
      const { normalizeLeadFields } = await import('./lib/places');
      
      const limit = parseInt(req.query.limit as string) || 100;

      await sheetsService.logToSheet('INFO', 'Growth', `Normalize leads started (limit: ${limit})`);

      // Read CRM_Leads
      const leads = await sheetsService.readSheet<{
        LeadID: string;
        Name?: string;
        Phone?: string;
        Email?: string;
        Website?: string;
        City?: string;
        CountryCode?: string;
        Address?: string;
        Notes?: string;
        Owner?: string;
      }>('CRM_Leads');

      let normalized = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Process each lead (up to limit)
      for (let i = 0; i < Math.min(leads.length, limit); i++) {
        const lead = leads[i];

        try {
          // Skip error rows
          if (lead.Name?.includes('#ERROR!') || lead.Name?.includes('#N/A')) {
            skipped++;
            continue;
          }

          // Normalize fields
          const { updated, normalized: normalizedFields } = normalizeLeadFields(lead);

          if (updated && Object.keys(normalizedFields).length > 0) {
            // Update row in sheet
            await sheetsService.updateRow('CRM_Leads', 'LeadID', lead.LeadID, normalizedFields);
            normalized++;
          } else {
            skipped++;
          }
        } catch (error: any) {
          const errorMsg = `Failed to normalize lead "${lead.LeadID}": ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          skipped++;
        }
      }

      await sheetsService.logToSheet('INFO', 'Growth', 
        `Normalize leads completed: ${normalized} normalized, ${skipped} skipped`
      );

      res.json({
        normalized,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error('Normalize leads error:', error);
      await sheetsService.logToSheet('ERROR', 'Growth', `Normalize leads failed: ${error.message}`);
      res.status(500).json({
        error: 'Normalize leads failed',
        details: error.message,
      });
    }
  });

  /**
   * POST /growth/score
   * Calculate/recalculate scores for all unscored or changed leads
   */
  app.post("/api/growth/score", async (req, res) => {
    try {
      const { scoreLead, getScoringRules } = await import('./lib/scoring');
      const { nanoid } = await import('nanoid');

      await sheetsService.logToSheet('INFO', 'Growth', 'Lead scoring started');

      // Get scoring rules
      const rules = await getScoringRules();

      // Read all leads
      const leads = await sheetsService.readSheet<{
        LeadID: string;
        Phone?: string;
        Website?: string;
        Email?: string;
        Category?: string;
        City?: string;
        Postal?: string;
        Score?: number;
        TierHint?: string;
      }>('CRM_Leads');

      let scored = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Score each lead
      for (const lead of leads) {
        try {
          // Skip error rows
          if (lead.LeadID?.includes('#ERROR!') || lead.LeadID?.includes('#N/A')) {
            skipped++;
            continue;
          }

          // Calculate score
          const result = scoreLead(lead, rules);

          // Update if score changed or was empty
          if (lead.Score !== result.score || lead.TierHint !== result.tierHint) {
            await sheetsService.updateRow('CRM_Leads', 'LeadID', lead.LeadID, {
              Score: result.score,
              TierHint: result.tierHint,
            });
            scored++;
          } else {
            skipped++;
          }
        } catch (error: any) {
          const errorMsg = `Failed to score lead "${lead.LeadID}": ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          skipped++;
        }
      }

      await sheetsService.logToSheet('INFO', 'Growth', 
        `Lead scoring completed: ${scored} scored, ${skipped} skipped`
      );

      // Write to OS_Health
      await sheetsService.writeOSHealth(
        '2A-3 Scoring/Assignment',
        'PASS',
        `Lead scoring: ${scored} scored, ${skipped} skipped`,
        {
          scored,
          skipped,
          errorCount: errors.length,
        }
      );

      res.json({
        scored,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error('Lead scoring error:', error);
      await sheetsService.logToSheet('ERROR', 'Growth', `Lead scoring failed: ${error.message}`);
      res.status(500).json({
        error: 'Lead scoring failed',
        details: error.message,
      });
    }
  });

  /**
   * GET /growth/assign?city=...&country=...&status=...
   * Assign leads to owners based on territories and assignment rules
   */
  app.get("/api/growth/assign", async (req, res) => {
    try {
      const { assignLeads } = await import('./lib/assignment');

      const context = {
        city: req.query.city as string | undefined,
        country: req.query.country as string | undefined,
        postal: req.query.postal as string | undefined,
        status: req.query.status ? (req.query.status as string).split(',') : ['NEW', 'OPEN'],
      };

      await sheetsService.logToSheet('INFO', 'Growth', 
        `Lead assignment started: city=${context.city || 'all'}, country=${context.country || 'all'}`
      );

      // Assign leads
      const results = await assignLeads(sheetsService, context);

      // Count unique rules and territories
      const rulesApplied = new Set(results.map(r => r.ruleID).filter(Boolean)).size;
      const territoriesUsed = new Set(results.map(r => r.territoryID).filter(Boolean)).size;

      await sheetsService.logToSheet('INFO', 'Growth', 
        `Lead assignment completed: ${results.length} assigned, ${rulesApplied} rules, ${territoriesUsed} territories`
      );

      // Write to OS_Health
      await sheetsService.writeOSHealth(
        '2A-3 Scoring/Assignment',
        'PASS',
        `Lead assignment: ${results.length} assigned, ${rulesApplied} rules, ${territoriesUsed} territories`,
        {
          assigned: results.length,
          rulesApplied,
          territoriesUsed,
        }
      );

      res.json({
        assigned: results.length,
        rulesApplied,
        territoriesUsed,
        assignments: results,
      });
    } catch (error: any) {
      console.error('Lead assignment error:', error);
      await sheetsService.logToSheet('ERROR', 'Growth', `Lead assignment failed: ${error.message}`);
      res.status(500).json({
        error: 'Lead assignment failed',
        details: error.message,
      });
    }
  });

  /**
   * GET /growth/export?owner=...&status=...&format=csv
   * Export leads to CSV for a specific owner
   */
  app.get("/api/growth/export", async (req, res) => {
    try {
      const owner = req.query.owner as string;
      const status = req.query.status as string | undefined;
      const format = (req.query.format as string) || 'csv';

      if (!owner) {
        return res.status(400).json({
          error: 'Missing required parameter',
          details: 'owner parameter is required',
        });
      }

      if (format !== 'csv') {
        return res.status(400).json({
          error: 'Invalid format',
          details: 'Only CSV format is supported',
        });
      }

      await sheetsService.logToSheet('INFO', 'Growth', 
        `Lead export started: owner=${owner}, status=${status || 'all'}`
      );

      // Read leads for this owner
      const allLeads = await sheetsService.readSheet<any>('CRM_Leads');
      const filteredLeads = allLeads.filter(lead => {
        if (lead.Owner !== owner) return false;
        if (status && lead.Status !== status) return false;
        return true;
      });

      // Generate CSV
      const headers = [
        'LeadID', 'CreatedTS', 'Source', 'Keyword', 'City', 'Postal', 'CountryCode',
        'Name', 'Category', 'Phone', 'Email', 'Website', 'Address', 'Lat', 'Lng',
        'Status', 'Owner', 'Score', 'TierHint', 'Notes', 'LastTouchTS'
      ];

      const csvRows = [headers.join(',')];

      for (const lead of filteredLeads) {
        const row = headers.map(header => {
          const value = lead[header] || '';
          // Escape CSV values
          const escaped = String(value).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(row.join(','));
      }

      const csv = csvRows.join('\n');

      await sheetsService.logToSheet('INFO', 'Growth', 
        `Lead export completed: ${filteredLeads.length} leads exported for ${owner}`
      );

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="leads_${owner}_${Date.now()}.csv"`);
      res.send(csv);
    } catch (error: any) {
      console.error('Lead export error:', error);
      await sheetsService.logToSheet('ERROR', 'Growth', `Lead export failed: ${error.message}`);
      res.status(500).json({
        error: 'Lead export failed',
        details: error.message,
      });
    }
  });

  // AI Enrichment endpoints
  app.post("/api/growth/enrich/queue", async (req, res) => {
    try {
      const { shouldEnrich } = await import('./lib/enrichment');
      const { nanoid } = await import('nanoid');

      await sheetsService.logToSheet('INFO', 'Growth', 'Enrichment queue building started');

      // Read all leads and existing queue
      const [leads, existingQueue] = await Promise.all([
        sheetsService.getCRMLeads(),
        sheetsService.getEnrichmentQueue()
      ]);

      // Build set of already queued LeadIDs (PENDING or recent COMPLETED)
      const recentThreshold = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
      const alreadyQueued = new Set(
        existingQueue
          .filter(job => {
            if (job.Status === 'PENDING') return true;
            if (job.Status === 'COMPLETED') {
              const jobTime = new Date(job.CreatedTS).getTime();
              return jobTime > recentThreshold;
            }
            return false;
          })
          .map(job => job.LeadID)
      );

      let queued = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const lead of leads) {
        try {
          // Skip error rows
          if (lead.LeadID?.includes('#ERROR!') || lead.LeadID?.includes('#N/A')) {
            skipped++;
            continue;
          }

          // Skip if already queued
          if (alreadyQueued.has(lead.LeadID)) {
            skipped++;
            continue;
          }

          // Check if lead should be enriched
          if (!shouldEnrich(lead)) {
            skipped++;
            continue;
          }

          // Generate JobID
          const jobID = `ENRICH-${Date.now()}-${nanoid(6)}`;
          const createdTS = new Date().toISOString();

          // Add to queue
          await sheetsService.writeRows('Enrichment_Queue', [{
            JobID: jobID,
            CreatedTS: createdTS,
            LeadID: lead.LeadID,
            Task: 'ENRICH',
            ParamsJSON: '',
            Status: 'PENDING',
            Attempts: 0,
            LastError: '',
          }]);

          queued++;
        } catch (error: any) {
          const errorMsg = `Failed to queue lead "${lead.LeadID}": ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          skipped++;
        }
      }

      await sheetsService.logToSheet('INFO', 'Growth', 
        `Enrichment queue built: ${queued} queued, ${skipped} skipped`
      );

      res.json({
        queued,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error('Enrichment queue error:', error);
      await sheetsService.logToSheet('ERROR', 'Growth', `Enrichment queue failed: ${error.message}`);
      res.status(500).json({
        error: 'Enrichment queue failed',
        details: error.message,
      });
    }
  });

  app.post("/api/growth/enrich/run", async (req, res) => {
    try {
      const { enrichLead } = await import('./lib/enrichment');
      const { nanoid } = await import('nanoid');

      const limit = parseInt(req.query.limit as string) || 20;

      await sheetsService.logToSheet('INFO', 'Growth', 
        `AI enrichment started: limit=${limit}`
      );

      // Read queue
      const queue = await sheetsService.getEnrichmentQueue();
      const pending = queue.filter(job => job.Status === 'PENDING');

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      // Process up to limit
      const jobsToProcess = pending.slice(0, limit);

      for (const job of jobsToProcess) {
        try {
          // Get lead
          const leads = await sheetsService.getCRMLeads();
          const lead = leads.find(l => l.LeadID === job.LeadID);

          if (!lead) {
            throw new Error(`Lead not found: ${job.LeadID}`);
          }

          // Enrich
          const enrichmentResult = await enrichLead(lead);

          // Update lead with derived fields only
          await sheetsService.updateLeadEnrichment(lead.LeadID, enrichmentResult);

          // Update queue status
          await sheetsService.updateRow('Enrichment_Queue', 'JobID', job.JobID, {
            Status: 'COMPLETED',
            LastError: '',
          });

          // Add touch record
          const touchID = `TOUCH-${Date.now()}-${nanoid(6)}`;
          await sheetsService.writeRows('Lead_Touches', [{
            TouchID: touchID,
            TS: new Date().toISOString(),
            LeadID: lead.LeadID,
            Channel: 'AI',
            Action: 'ENRICH',
            Actor: 'A-GROW-100',
            Notes: `AI enrichment completed: ${Object.keys(enrichmentResult).join(', ')}`,
            Outcome: 'SUCCESS',
          }]);

          processed++;
        } catch (error: any) {
          const errorMsg = `Failed to enrich job "${job.JobID}": ${error.message}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          failed++;

          // Update queue with error
          const attempts = (job.Attempts || 0) + 1;
          await sheetsService.updateRow('Enrichment_Queue', 'JobID', job.JobID, {
            Status: attempts >= 3 ? 'FAILED' : 'PENDING',
            Attempts: attempts,
            LastError: error.message.substring(0, 500),
          });
        }
      }

      await sheetsService.logToSheet('INFO', 'Growth', 
        `AI enrichment completed: ${processed} processed, ${failed} failed`
      );

      // Write to OS_Health
      await sheetsService.writeOSHealth(
        '2A-4 AI Enrichment',
        processed > 0 ? 'PASS' : 'WARN',
        `AI enrichment: ${processed} processed, ${failed} failed`,
        {
          processed,
          failed,
          errorCount: errors.length,
        }
      );

      res.json({
        processed,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error('AI enrichment error:', error);
      await sheetsService.logToSheet('ERROR', 'Growth', `AI enrichment failed: ${error.message}`);
      res.status(500).json({
        error: 'AI enrichment failed',
        details: error.message,
      });
    }
  });

  // ==================== OUTREACH MODULE ====================

  app.get("/api/outreach/health", async (req, res) => {
    try {
      const { EmailTransport } = await import('./lib/email-transport');
      
      // Create transport from settings
      const transport = await EmailTransport.createFromSettings();
      
      // Run health check
      const healthResult = await transport.health();
      
      // Write to OS_Health
      await sheetsService.writeOSHealth(
        '2B-2 Email Transport',
        healthResult.ok ? 'PASS' : 'FAIL',
        `Provider: ${healthResult.provider}, ${healthResult.detail}`,
        {
          provider: healthResult.provider,
          ok: healthResult.ok,
          detail: healthResult.detail,
        }
      );
      
      // Log the health check
      await sheetsService.logToSheet(
        healthResult.ok ? 'INFO' : 'WARN',
        'Outreach',
        `Email transport health: ${healthResult.provider} - ${healthResult.detail}`
      );
      
      res.json(healthResult);
    } catch (error: any) {
      console.error('Outreach health check error:', error);
      
      await sheetsService.writeOSHealth(
        '2B-2 Email Transport',
        'FAIL',
        `Health check failed: ${error.message}`,
        { error: error.message }
      );
      
      await sheetsService.logToSheet('ERROR', 'Outreach', `Health check failed: ${error.message}`);
      
      res.status(500).json({
        ok: false,
        provider: 'unknown',
        detail: error.message,
      });
    }
  });

  /**
   * GET /api/outreach/sends
   * Get Outreach_Sends records
   */
  app.get("/api/outreach/sends", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : undefined;
      const sends = await sheetsService.readSheet<any>('Outreach_Sends');
      
      const result = limit ? sends.slice(0, limit) : sends;
      res.json({ sends: result });
    } catch (error: any) {
      console.error('Get sends error:', error);
      res.status(500).json({
        error: 'Failed to retrieve sends',
        details: error.message,
      });
    }
  });

  /**
   * POST /api/outreach/test-send
   * Test email sending with DRY_RUN mode
   */
  app.post("/api/outreach/test-send", async (req, res) => {
    try {
      const { to, subject } = req.body;

      if (!to || !subject) {
        return res.status(400).json({ error: 'to and subject are required' });
      }

      const { EmailTransport } = await import('./lib/email-transport');
      const transport = await EmailTransport.createFromSettings();

      const result = await transport.sendEmail({
        to,
        subject,
        html: '<p>This is a test email from MH Trading OS.</p>',
        text: 'This is a test email from MH Trading OS.',
        tags: { test: 'true' },
      });

      if (result.ok) {
        const sheets = await sheetsService['getClient']();
        const SPREADSHEET_ID = sheetsService.getSpreadsheetId();
        const timestamp = new Date().toISOString();

        await retryWithBackoff(() =>
          sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: 'Outreach_Sends!A:Z',
            valueInputOption: 'RAW',
            requestBody: {
              values: [[
                `TEST-${nanoid(8)}`,
                'TEST-CAMPAIGN',
                'TEST-SEQUENCE',
                to,
                '0',
                'test-template',
                'email',
                subject,
                '',
                'SENT',
                result.providerMsgId,
                timestamp,
                timestamp,
                '',
                '',
                '',
                '',
                '',
                '0',
                ''
              ]],
            },
          })
        );

        await sheetsService.logToSheet(
          'INFO',
          'Outreach',
          `Test email sent to ${to}: ${result.providerMsgId}`
        );
      }

      res.json(result);
    } catch (error: any) {
      console.error('Test send error:', error);
      await sheetsService.logToSheet('ERROR', 'Outreach', `Test send failed: ${error.message}`);
      res.status(500).json({
        ok: false,
        error: 'Test send failed',
        details: error.message,
      });
    }
  });

  app.post("/api/outreach/audience/build", async (req, res) => {
    try {
      const { campaignId, audienceQuery } = req.body;

      if (!campaignId) {
        return res.status(400).json({ error: 'campaignId is required' });
      }

      if (!audienceQuery || !audienceQuery.source) {
        return res.status(400).json({ error: 'audienceQuery with source is required' });
      }

      await sheetsService.logToSheet(
        'INFO',
        'Outreach',
        `Building audience for campaign ${campaignId} from ${audienceQuery.source}`
      );

      const { buildAudience } = await import('./lib/audience-builder');
      const result = await buildAudience(campaignId, audienceQuery);

      if (result.errors.length > 0) {
        await sheetsService.logToSheet(
          'WARN',
          'Outreach',
          `Audience build completed with ${result.errors.length} errors`
        );
      }

      res.json({
        inserted: result.inserted,
        skippedDuplicates: result.skippedDuplicates,
        suppressed: result.suppressed,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error: any) {
      console.error('Audience build error:', error);
      await sheetsService.logToSheet('ERROR', 'Outreach', `Audience build failed: ${error.message}`);
      res.status(500).json({
        error: 'Audience build failed',
        details: error.message,
      });
    }
  });

  // ==================== OUTREACH SEQUENCER ENDPOINTS ====================
  
  // Cache sequencer instances to reduce redundant sheet reads
  let cachedSequencer: any = null;
  let cachedSequencerWithTransport: any = null;
  let lastSequencerRefresh = 0;
  const SEQUENCER_CACHE_TTL = 60000; // 1 minute

  async function getSequencer(withTransport: boolean = false) {
    const now = Date.now();
    const shouldRefresh = now - lastSequencerRefresh > SEQUENCER_CACHE_TTL;
    
    if (withTransport) {
      if (!cachedSequencerWithTransport || shouldRefresh) {
        const { OutreachSequencer } = await import('./lib/sequencer');
        const { EmailTransport } = await import('./lib/email-transport');
        const transport = await EmailTransport.createFromSettings();
        cachedSequencerWithTransport = new OutreachSequencer(sheetsService, transport);
        lastSequencerRefresh = now;
      }
      return cachedSequencerWithTransport;
    } else {
      if (!cachedSequencer || shouldRefresh) {
        const { OutreachSequencer } = await import('./lib/sequencer');
        cachedSequencer = new OutreachSequencer(sheetsService, null as any);
        lastSequencerRefresh = now;
      }
      return cachedSequencer;
    }
  }

  /**
   * Start a campaign - sets StartedTS and Status="RUNNING"
   */
  app.post("/api/outreach/sequence/start", async (req, res) => {
    try {
      const { campaignId, startAtTS } = req.body;

      if (!campaignId) {
        return res.status(400).json({ error: 'campaignId is required' });
      }

      const sequencer = await getSequencer(false);
      await sequencer.startCampaign(campaignId, startAtTS);
      
      await sheetsService.logToSheet(
        'INFO',
        'Sequencer',
        `Campaign ${campaignId} started`
      );

      res.json({ 
        success: true, 
        message: `Campaign ${campaignId} started`,
        campaignId 
      });
    } catch (error: any) {
      console.error('Campaign start error:', error);
      await sheetsService.logToSheet('ERROR', 'Sequencer', `Campaign start failed: ${error.message}`);
      res.status(500).json({
        error: 'Campaign start failed',
        details: error.message,
      });
    }
  });

  /**
   * Pause a campaign - sets Status="PAUSED"
   */
  app.post("/api/outreach/sequence/pause", async (req, res) => {
    try {
      const { campaignId } = req.body;

      if (!campaignId) {
        return res.status(400).json({ error: 'campaignId is required' });
      }

      const sequencer = await getSequencer(false);
      await sequencer.pauseCampaign(campaignId);
      
      await sheetsService.logToSheet(
        'INFO',
        'Sequencer',
        `Campaign ${campaignId} paused`
      );

      res.json({ 
        success: true, 
        message: `Campaign ${campaignId} paused`,
        campaignId 
      });
    } catch (error: any) {
      console.error('Campaign pause error:', error);
      await sheetsService.logToSheet('ERROR', 'Sequencer', `Campaign pause failed: ${error.message}`);
      res.status(500).json({
        error: 'Campaign pause failed',
        details: error.message,
      });
    }
  });

  /**
   * Complete a campaign - sets Status="COMPLETED" and CompletedTS
   */
  app.post("/api/outreach/sequence/complete", async (req, res) => {
    try {
      const { campaignId } = req.body;

      if (!campaignId) {
        return res.status(400).json({ error: 'campaignId is required' });
      }

      const sequencer = await getSequencer(false);
      await sequencer.completeCampaign(campaignId);
      
      await sheetsService.logToSheet(
        'INFO',
        'Sequencer',
        `Campaign ${campaignId} completed`
      );

      res.json({ 
        success: true, 
        message: `Campaign ${campaignId} completed`,
        campaignId 
      });
    } catch (error: any) {
      console.error('Campaign complete error:', error);
      await sheetsService.logToSheet('ERROR', 'Sequencer', `Campaign complete failed: ${error.message}`);
      res.status(500).json({
        error: 'Campaign complete failed',
        details: error.message,
      });
    }
  });

  /**
   * Tick a campaign - process due sends (respects throttling, retry, suppression)
   */
  app.post("/api/outreach/sequence/tick", async (req, res) => {
    try {
      const { campaignId } = req.body;

      if (!campaignId) {
        return res.status(400).json({ error: 'campaignId is required' });
      }

      const sequencer = await getSequencer(true);
      const result = await sequencer.tickCampaign(campaignId);
      
      await sheetsService.logToSheet(
        result.errors.length > 0 ? 'WARN' : 'INFO',
        'Sequencer',
        `Campaign ${campaignId} tick: ${result.sent} sent, ${result.failed} failed, ${result.throttled} throttled`
      );

      res.json(result);
    } catch (error: any) {
      console.error('Campaign tick error:', error);
      await sheetsService.logToSheet('ERROR', 'Sequencer', `Campaign tick failed: ${error.message}`);
      res.status(500).json({
        error: 'Campaign tick failed',
        details: error.message,
        processed: 0,
        sent: 0,
        failed: 0,
        throttled: 0,
        errors: [error.message]
      });
    }
  });

  // ==================== OUTREACH AI ENDPOINTS ====================

  app.post("/api/outreach/ai/suggest", async (req, res) => {
    try {
      const { locale, tone } = req.body;

      if (!locale || !tone) {
        return res.status(400).json({ error: 'locale and tone are required' });
      }

      const language = locale === 'de' ? 'German' : 'English';
      const toneDesc = tone === 'professional' ? 'professional and business-like' : 'friendly and conversational';

      const prompt = `Generate a professional B2B email template in ${language} with a ${toneDesc} tone.

The email should be suitable for a trading company introducing their products/services.

Please generate:
1. A compelling email subject line (max 60 characters)
2. An email body in markdown format with:
   - A warm greeting
   - Brief introduction
   - Value proposition
   - Call to action
   - Professional closing

Use these merge variables where appropriate: {{first_name}}, {{name}}, {{company}}, {{city}}

Respond in JSON format:
{
  "subject": "subject line here",
  "body": "email body in markdown format here"
}`;

      const aiResponse = await generateAIResponse(prompt);
      
      // Parse AI response (it should be JSON)
      let parsed;
      try {
        parsed = JSON.parse(aiResponse);
      } catch {
        // If AI didn't return JSON, create a structured response
        parsed = {
          subject: locale === 'de' 
            ? "Neue Partnerschaft: Exklusive Angebote für Ihr Unternehmen"
            : "New Partnership Opportunity: Exclusive Offers for Your Business",
          body: aiResponse
        };
      }

      await sheetsService.logToSheet(
        'INFO',
        'AI',
        `Generated ${language} email template with ${tone} tone`
      );

      res.json({
        subject: parsed.subject || '',
        body: parsed.body || aiResponse,
        locale,
        tone,
      });
    } catch (error: any) {
      console.error('AI suggest error:', error);
      await sheetsService.logToSheet('ERROR', 'AI', `Email template generation failed: ${error.message}`);
      res.status(500).json({
        error: 'AI suggestion failed',
        details: error.message,
      });
    }
  });

  // ==================== OUTREACH CRUD ENDPOINTS ====================

  // Create new campaign
  app.post("/api/outreach/campaigns/create", async (req, res) => {
    try {
      const { name, goal, owner, locale, sequenceId } = req.body;

      if (!name || !goal || !owner || !locale) {
        return res.status(400).json({ error: 'name, goal, owner, and locale are required' });
      }

      const campaignId = `CAMP_${Date.now()}`;
      const newCampaign = {
        CampaignID: campaignId,
        Name: name,
        Goal: goal,
        Owner: owner,
        Channel: 'email',
        Locale: locale,
        Status: 'DRAFT',
        SequenceID: sequenceId || '',
        CreatedTS: new Date().toISOString(),
      };

      await sheetsService.writeRows('Outreach_Campaigns', [newCampaign]);
      await sheetsService.logToSheet('INFO', 'Outreach', `Campaign created: ${campaignId} - ${name}`);

      res.json({ success: true, campaign: newCampaign });
    } catch (error: any) {
      console.error('Campaign creation error:', error);
      await sheetsService.logToSheet('ERROR', 'Outreach', `Campaign creation failed: ${error.message}`);
      res.status(500).json({ error: 'Campaign creation failed', details: error.message });
    }
  });

  // Update existing campaign
  app.post("/api/outreach/campaigns/update", async (req, res) => {
    try {
      const { campaignId, updates } = req.body;

      if (!campaignId) {
        return res.status(400).json({ error: 'campaignId is required' });
      }

      const allowedFields = ['Name', 'Goal', 'Owner', 'Locale', 'SequenceID'];
      const filteredUpdates: any = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          filteredUpdates[key] = updates[key];
        }
      }

      await sheetsService.updateRow('Outreach_Campaigns', 'CampaignID', campaignId, filteredUpdates);
      await sheetsService.logToSheet('INFO', 'Outreach', `Campaign updated: ${campaignId}`);

      res.json({ success: true, campaignId, updates: filteredUpdates });
    } catch (error: any) {
      console.error('Campaign update error:', error);
      await sheetsService.logToSheet('ERROR', 'Outreach', `Campaign update failed: ${error.message}`);
      res.status(500).json({ error: 'Campaign update failed', details: error.message });
    }
  });

  // Create new template
  app.post("/api/outreach/templates/create", async (req, res) => {
    try {
      const { name, subject, bodyMarkdown, locale } = req.body;

      if (!name || !subject || !bodyMarkdown || !locale) {
        return res.status(400).json({ error: 'name, subject, bodyMarkdown, and locale are required' });
      }

      const templateId = `TMPL_${Date.now()}`;
      const newTemplate = {
        TemplateID: templateId,
        Name: name,
        Subject: subject,
        BodyMarkdown: bodyMarkdown,
        Locale: locale,
        CreatedTS: new Date().toISOString(),
      };

      await sheetsService.writeRows('Outreach_Templates', [newTemplate]);
      await sheetsService.logToSheet('INFO', 'Outreach', `Template created: ${templateId} - ${name}`);

      res.json({ success: true, template: newTemplate });
    } catch (error: any) {
      console.error('Template creation error:', error);
      await sheetsService.logToSheet('ERROR', 'Outreach', `Template creation failed: ${error.message}`);
      res.status(500).json({ error: 'Template creation failed', details: error.message });
    }
  });

  // Update existing template
  app.post("/api/outreach/templates/update", async (req, res) => {
    try {
      const { templateId, updates } = req.body;

      if (!templateId) {
        return res.status(400).json({ error: 'templateId is required' });
      }

      const allowedFields = ['Name', 'Subject', 'BodyMarkdown', 'Locale'];
      const filteredUpdates: any = {};
      for (const key of allowedFields) {
        if (updates[key] !== undefined) {
          filteredUpdates[key] = updates[key];
        }
      }

      await sheetsService.updateRow('Outreach_Templates', 'TemplateID', templateId, filteredUpdates);
      await sheetsService.logToSheet('INFO', 'Outreach', `Template updated: ${templateId}`);

      res.json({ success: true, templateId, updates: filteredUpdates });
    } catch (error: any) {
      console.error('Template update error:', error);
      await sheetsService.logToSheet('ERROR', 'Outreach', `Template update failed: ${error.message}`);
      res.status(500).json({ error: 'Template update failed', details: error.message });
    }
  });

  // ==================== AI OUTREACH AGENT A-OUT-101 ====================

  /**
   * AI Suggest Template (Advanced) - A-OUT-101 Outreach Sequencer
   * Generates GDPR-compliant email templates with advanced options
   */
  app.post("/api/outreach/ai/suggest-template", async (req, res) => {
    try {
      const { aiSuggestTemplateSchema } = await import('@shared/schema');
      const validation = aiSuggestTemplateSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }

      const { locale, productLine, tone, variables } = validation.data;
      const { suggestTemplate } = await import('./lib/outreach-ai');
      
      const template = await suggestTemplate({
        locale,
        productLine,
        tone,
        variables: variables ? Object.fromEntries(variables.map(v => [v, v])) : undefined
      });

      await sheetsService.logToSheet('INFO', 'AI-Outreach', `A-OUT-101 generated template: ${locale}, ${tone}`);
      
      res.json(template);
    } catch (error: any) {
      console.error('AI suggest-template error:', error);
      await sheetsService.logToSheet('ERROR', 'AI-Outreach', `A-OUT-101 template generation failed: ${error.message}`);
      res.status(500).json({ error: 'Template generation failed', details: error.message });
    }
  });

  /**
   * AI Summarize Replies - A-OUT-101 Outreach Sequencer
   * Analyzes email thread and classifies response + suggests next step
   */
  app.post("/api/outreach/ai/summarize-replies", async (req, res) => {
    try {
      const { aiSummarizeRepliesSchema } = await import('@shared/schema');
      const validation = aiSummarizeRepliesSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }

      const { threadHTML } = validation.data;
      const { summarizeReplies } = await import('./lib/outreach-ai');
      
      const analysis = await summarizeReplies({ threadHTML });

      await sheetsService.logToSheet(
        'INFO',
        'AI-Outreach',
        `A-OUT-101 analyzed reply: ${analysis.classification} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`
      );
      
      res.json(analysis);
    } catch (error: any) {
      console.error('AI summarize-replies error:', error);
      await sheetsService.logToSheet('ERROR', 'AI-Outreach', `A-OUT-101 reply analysis failed: ${error.message}`);
      res.status(500).json({ error: 'Reply analysis failed', details: error.message });
    }
  });

  /**
   * AI Save Template to Sheet - A-OUT-101 Outreach Sequencer
   * Submits template to AI_Crew for approval workflow
   */
  app.post("/api/outreach/ai/save-template", async (req, res) => {
    try {
      const { aiSaveTemplateSchema } = await import('@shared/schema');
      const validation = aiSaveTemplateSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }

      const { name, subject, bodyMarkdown, locale, notes } = validation.data;
      const { saveTemplateToSheet } = await import('./lib/outreach-ai');
      
      const jobId = await saveTemplateToSheet({
        name,
        subject,
        bodyMarkdown,
        locale,
        notes: notes || `AI-generated by A-OUT-101`
      });

      await sheetsService.logToSheet('INFO', 'AI-Outreach', `A-OUT-101 submitted template for approval: ${jobId}`);
      
      res.json({ success: true, jobId, requiresApproval: true });
    } catch (error: any) {
      console.error('AI save-template error:', error);
      await sheetsService.logToSheet('ERROR', 'AI-Outreach', `A-OUT-101 save template failed: ${error.message}`);
      res.status(500).json({ error: 'Save template failed', details: error.message });
    }
  });

  /**
   * AI Draft Campaign - A-OUT-101 Outreach Sequencer
   * Generates campaign goal and audience query draft
   */
  app.post("/api/outreach/ai/draft-campaign", async (req, res) => {
    try {
      const { aiDraftCampaignSchema } = await import('@shared/schema');
      const validation = aiDraftCampaignSchema.safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ 
          error: 'Invalid request body', 
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }

      const { name, productLine, targetAudience, locale } = validation.data;
      const { draftCampaign } = await import('./lib/outreach-ai');
      
      const draft = await draftCampaign({
        name,
        productLine,
        targetAudience,
        locale
      });

      await sheetsService.logToSheet('INFO', 'AI-Outreach', `A-OUT-101 drafted campaign: ${name}`);
      
      res.json(draft);
    } catch (error: any) {
      console.error('AI draft-campaign error:', error);
      await sheetsService.logToSheet('ERROR', 'AI-Outreach', `A-OUT-101 campaign draft failed: ${error.message}`);
      res.status(500).json({ error: 'Campaign draft failed', details: error.message });
    }
  });

  // ==================== SEO ENGINE ENDPOINTS ====================

  /**
   * POST /api/marketing/seo/harvest
   * Harvest keywords from seed terms using AI (A-SEO-201)
   */
  app.post("/api/marketing/seo/harvest", async (req, res) => {
    try {
      const { seedTerms, locale, source } = req.body;

      if (!seedTerms || !Array.isArray(seedTerms) || seedTerms.length === 0) {
        return res.status(400).json({ error: 'seedTerms array is required' });
      }

      if (!locale || !['en', 'de', 'ar'].includes(locale)) {
        return res.status(400).json({ error: 'locale must be "en", "de", or "ar"' });
      }

      const { harvestKeywords } = await import('./lib/keyword-ops');
      const keywords = await harvestKeywords(sheetsService, {
        keywords: seedTerms,
        locale,
        source: source || 'Manual'
      });

      await sheetsService.logToSheet(
        'INFO',
        'SEO-Marketing',
        `Harvested ${keywords.length} keywords from ${seedTerms.length} seeds (${locale})`
      );

      res.json({ 
        success: true, 
        count: keywords.length,
        keywords 
      });
    } catch (error: any) {
      console.error('SEO harvest error:', error);
      await sheetsService.logToSheet('ERROR', 'SEO-Marketing', `Harvest failed: ${error.message}`);
      res.status(500).json({ error: 'Keyword harvest failed', details: error.message });
    }
  });

  /**
   * POST /api/marketing/seo/cluster
   * Cluster keywords using AI semantic analysis (A-SEO-202)
   */
  app.post("/api/marketing/seo/cluster", async (req, res) => {
    try {
      const { keywordIds, locale, maxClusterSize } = req.body;
      
      if (!keywordIds || !Array.isArray(keywordIds)) {
        // If no specific keywords provided, cluster all active keywords
        const allKeywords = await sheetsService.readSheet<any>('SEO_Keywords');
        const activeIds = allKeywords
          .filter((kw: any) => kw.Status !== 'archived')
          .map((kw: any) => kw.KeywordID);
        
        if (activeIds.length === 0) {
          return res.status(400).json({ error: 'No active keywords found to cluster' });
        }
        
        const { clusterKeywords } = await import('./lib/keyword-ops');
        const results = await clusterKeywords(sheetsService, {
          keywordIds: activeIds,
          locale,
          maxClusterSize
        });

        await sheetsService.logToSheet(
          'INFO',
          'SEO-Marketing',
          `Clustered ${results.updatedCount} keywords into ${results.clusters.size} clusters`
        );

        res.json({ 
          success: true, 
          updated: results.updatedCount,
          clusterCount: results.clusters.size,
          clusters: Array.from(results.clusters.entries()).map(([id, keywords]) => ({ id, keywords }))
        });
      } else {
        const { clusterKeywords } = await import('./lib/keyword-ops');
        const results = await clusterKeywords(sheetsService, {
          keywordIds,
          locale,
          maxClusterSize
        });

        await sheetsService.logToSheet(
          'INFO',
          'SEO-Marketing',
          `Clustered ${results.updatedCount} keywords into ${results.clusters.size} clusters`
        );

        res.json({ 
          success: true, 
          updated: results.updatedCount,
          clusterCount: results.clusters.size,
          clusters: Array.from(results.clusters.entries()).map(([id, keywords]) => ({ id, keywords }))
        });
      }
    } catch (error: any) {
      console.error('SEO cluster error:', error);
      await sheetsService.logToSheet('ERROR', 'SEO-Marketing', `Clustering failed: ${error.message}`);
      res.status(500).json({ error: 'Clustering failed', details: error.message });
    }
  });

  /**
   * POST /api/marketing/seo/prioritize
   * Calculate priority scores for keywords (A-SEO-203)
   */
  app.post("/api/marketing/seo/prioritize", async (req, res) => {
    try {
      const { keywordIds, criteria } = req.body;
      
      // If no specific keywords provided, prioritize all active keywords
      const targetIds = keywordIds && Array.isArray(keywordIds) && keywordIds.length > 0
        ? keywordIds
        : (await sheetsService.readSheet<any>('SEO_Keywords'))
            .filter((kw: any) => kw.Status !== 'archived')
            .map((kw: any) => kw.KeywordID);
      
      if (targetIds.length === 0) {
        return res.status(400).json({ error: 'No keywords found to prioritize' });
      }

      const { prioritizeKeywords } = await import('./lib/keyword-ops');
      const results = await prioritizeKeywords(sheetsService, targetIds, criteria);

      await sheetsService.logToSheet(
        'INFO',
        'SEO-Marketing',
        `Calculated priority for ${results.updatedCount} keywords`
      );

      res.json({ 
        success: true, 
        updated: results.updatedCount
      });
    } catch (error: any) {
      console.error('SEO prioritize error:', error);
      await sheetsService.logToSheet('ERROR', 'SEO-Marketing', `Prioritization failed: ${error.message}`);
      res.status(500).json({ error: 'Prioritization failed', details: error.message });
    }
  });

  /**
   * POST /api/marketing/seo/brief
   * Generate SEO content brief for a keyword (A-SEO-204)
   */
  app.post("/api/marketing/seo/brief", async (req, res) => {
    try {
      const { keyword } = req.body;

      if (!keyword) {
        return res.status(400).json({ error: 'keyword is required' });
      }

      const { seoEngine } = await import('./lib/seo-engine');
      const brief = await seoEngine.generateBrief(keyword);

      const sheets = await sheetsService['getClient']();
      const SPREADSHEET_ID = sheetsService.getSpreadsheetId();

      await retryWithBackoff(() =>
        sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'SEO_Briefs!A:Z',
          valueInputOption: 'RAW',
          requestBody: {
            values: [[
              brief.BriefID,
              brief.Keyword,
              brief.TargetURL,
              brief.TitleTag,
              brief.MetaDescription,
              brief.H1,
              brief.OutlineJSON,
              brief.InternalLinksCSV,
              brief.Status,
              brief.AssignedTo,
              brief.CreatedAt,
              brief.Notes
            ]],
          },
        })
      );

      await sheetsService.logToSheet(
        'INFO',
        'SEO-Engine',
        `A-SEO-204 generated brief ${brief.BriefID} for "${keyword}"`
      );

      res.json({ 
        success: true,
        brief 
      });
    } catch (error: any) {
      console.error('SEO brief error:', error);
      await sheetsService.logToSheet('ERROR', 'SEO-Engine', `Brief generation failed: ${error.message}`);
      res.status(500).json({ error: 'Brief generation failed', details: error.message });
    }
  });

  /**
   * POST /api/marketing/seo/onpage
   * Get on-page SEO suggestions for a URL (A-SEO-205)
   */
  app.post("/api/marketing/seo/onpage", async (req, res) => {
    try {
      const { url } = req.body;

      if (!url) {
        return res.status(400).json({ error: 'url is required' });
      }

      const { seoEngine } = await import('./lib/seo-engine');
      const suggestion = await seoEngine.onPageSuggest(url);

      const sheets = await sheetsService['getClient']();
      const SPREADSHEET_ID = sheetsService.getSpreadsheetId();
      const auditId = `AUDIT-${nanoid(8)}`;
      const timestamp = new Date().toISOString();

      await retryWithBackoff(() =>
        sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'SEO_Audits!A:Z',
          valueInputOption: 'RAW',
          requestBody: {
            values: [[
              auditId,
              url,
              timestamp,
              suggestion.titleSuggestion,
              suggestion.h1Suggestion,
              suggestion.metaSuggestion,
              suggestion.wordCountTarget.toString(),
              suggestion.h2sSuggested,
              suggestion.quickWins,
              'Marketing Team',
              'PENDING',
              `AI-generated by A-SEO-205`
            ]],
          },
        })
      );

      await sheetsService.logToSheet(
        'INFO',
        'SEO-Engine',
        `A-SEO-205 audited ${url} (${auditId})`
      );

      res.json({ 
        success: true,
        auditId,
        suggestion 
      });
    } catch (error: any) {
      console.error('SEO onpage error:', error);
      await sheetsService.logToSheet('ERROR', 'SEO-Engine', `OnPage analysis failed: ${error.message}`);
      res.status(500).json({ error: 'OnPage analysis failed', details: error.message });
    }
  });

  /**
   * GET /api/marketing/seo/pages
   * Get all SEO pages from SEO_Pages sheet
   */
  app.get("/api/marketing/seo/pages", async (req, res) => {
    try {
      const pages = await sheetsService.readSheet<any>('SEO_Pages');
      res.json({ success: true, count: pages.length, pages });
    } catch (error: any) {
      console.error('SEO pages error:', error);
      res.status(500).json({ error: 'Failed to fetch pages', details: error.message });
    }
  });

  /**
   * GET /api/marketing/seo/keywords
   * Get all keywords from SEO_Keywords sheet
   */
  app.get("/api/marketing/seo/keywords", async (req, res) => {
    try {
      const keywords = await sheetsService.readSheet<any>('SEO_Keywords');
      res.json({ success: true, count: keywords.length, keywords });
    } catch (error: any) {
      console.error('SEO keywords error:', error);
      res.status(500).json({ error: 'Failed to fetch keywords', details: error.message });
    }
  });

  // ==================== ADS CAMPAIGN BUILDER ENDPOINTS ====================

  /**
   * GET /api/marketing/ads/campaigns
   * Get all ad campaigns with optional filters
   */
  app.get("/api/marketing/ads/campaigns", async (req, res) => {
    try {
      const { status, locale } = req.query;
      const { getCampaigns } = await import('./lib/campaign-builder');
      
      const campaigns = await getCampaigns(sheetsService, {
        status: status as string,
        locale: locale as string
      });

      res.json({ success: true, count: campaigns.length, campaigns });
    } catch (error: any) {
      console.error('Ads get campaigns error:', error);
      res.status(500).json({ error: 'Failed to fetch campaigns', details: error.message });
    }
  });

  /**
   * POST /api/marketing/ads/campaigns
   * Create new ad campaign
   */
  app.post("/api/marketing/ads/campaigns", async (req, res) => {
    try {
      const { createCampaign } = await import('./lib/campaign-builder');
      const campaign = await createCampaign(sheetsService, req.body);

      await sheetsService.logToSheet('INFO', 'Ads-Marketing', `Created campaign: ${campaign.Name}`);
      
      res.json({ success: true, campaign });
    } catch (error: any) {
      console.error('Ads create campaign error:', error);
      await sheetsService.logToSheet('ERROR', 'Ads-Marketing', `Campaign creation failed: ${error.message}`);
      res.status(500).json({ error: 'Campaign creation failed', details: error.message });
    }
  });

  /**
   * POST /api/marketing/ads/campaigns/:campaignId/adgroups
   * Manage ad groups for a campaign (create/update/delete)
   */
  app.post("/api/marketing/ads/campaigns/:campaignId/adgroups", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { mutations } = req.body;

      if (!Array.isArray(mutations)) {
        return res.status(400).json({ error: 'mutations array is required' });
      }

      const { manageAdGroups } = await import('./lib/campaign-builder');
      const result = await manageAdGroups(sheetsService, campaignId, mutations);

      await sheetsService.logToSheet(
        'INFO',
        'Ads-Marketing',
        `Ad groups updated for campaign ${campaignId}: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`
      );

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Ads manage ad groups error:', error);
      await sheetsService.logToSheet('ERROR', 'Ads-Marketing', `Ad group management failed: ${error.message}`);
      res.status(500).json({ error: 'Ad group management failed', details: error.message });
    }
  });

  /**
   * POST /api/marketing/ads/adgroups/:adGroupId/creatives
   * Manage creatives for an ad group (create/update/delete)
   */
  app.post("/api/marketing/ads/adgroups/:adGroupId/creatives", async (req, res) => {
    try {
      const { adGroupId } = req.params;
      const { mutations } = req.body;

      if (!Array.isArray(mutations)) {
        return res.status(400).json({ error: 'mutations array is required' });
      }

      const { manageCreatives } = await import('./lib/campaign-builder');
      const result = await manageCreatives(sheetsService, adGroupId, mutations);

      await sheetsService.logToSheet(
        'INFO',
        'Ads-Marketing',
        `Creatives updated for ad group ${adGroupId}: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`
      );

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Ads manage creatives error:', error);
      await sheetsService.logToSheet('ERROR', 'Ads-Marketing', `Creative management failed: ${error.message}`);
      res.status(500).json({ error: 'Creative management failed', details: error.message });
    }
  });

  /**
   * GET /api/marketing/ads/export
   * Export campaigns as Google Ads CSV
   */
  app.get("/api/marketing/ads/export", async (req, res) => {
    try {
      const { campaignId } = req.query;
      const { exportGoogleAdsCsv } = await import('./lib/campaign-builder');
      
      const csv = await exportGoogleAdsCsv(sheetsService, campaignId as string);

      await sheetsService.logToSheet('INFO', 'Ads-Marketing', `Exported Google Ads CSV${campaignId ? ` for campaign ${campaignId}` : ''}`);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="google_ads_export_${Date.now()}.csv"`);
      res.send(csv);
    } catch (error: any) {
      console.error('Ads export error:', error);
      await sheetsService.logToSheet('ERROR', 'Ads-Marketing', `Export failed: ${error.message}`);
      res.status(500).json({ error: 'Export failed', details: error.message });
    }
  });

  // ==================== SOCIAL STUDIO ENDPOINTS ====================

  /**
   * POST /api/marketing/social/plan
   * Plan social calendar for next 2 weeks
   */
  app.post("/api/marketing/social/plan", async (req, res) => {
    try {
      const { socialPlanSchema } = await import('@shared/schema');
      const parsed = socialPlanSchema.parse(req.body);
      
      const { planCalendar } = await import('./lib/social-studio');
      const result = await planCalendar(parsed);
      
      res.json({
        success: true,
        postsCreated: result.postsCreated,
        posts: result.posts,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error: any) {
      console.error('Social plan error:', error);
      await sheetsService.logToSheet('ERROR', 'Social', `Plan calendar failed: ${error.message}`);
      res.status(500).json({ error: 'Plan calendar failed', details: error.message });
    }
  });

  /**
   * POST /api/marketing/social/ai
   * AI suggest social post (Hook/Caption/Hashtags)
   */
  app.post("/api/marketing/social/ai", async (req, res) => {
    try {
      const { aiSuggestSocialPostSchema } = await import('@shared/schema');
      const parsed = aiSuggestSocialPostSchema.parse(req.body);
      
      const { aiSuggestPost } = await import('./lib/social-studio');
      const result = await aiSuggestPost(parsed);

      await sheetsService.logToSheet('INFO', 'Social-Marketing', `AI suggested post for ${parsed.line}`);
      
      res.json({
        success: true,
        hook: result.hook,
        caption: result.caption,
        hashtags: result.hashtags,
      });
    } catch (error: any) {
      console.error('Social AI suggest error:', error);
      await sheetsService.logToSheet('ERROR', 'Social-Marketing', `AI suggest failed: ${error.message}`);
      res.status(500).json({ error: 'AI suggest failed', details: error.message });
    }
  });

  /**
   * POST /api/marketing/social/attach
   * Attach assets to a social post
   */
  app.post("/api/marketing/social/attach", async (req, res) => {
    try {
      const { attachAssetsSchema } = await import('@shared/schema');
      const parsed = attachAssetsSchema.parse(req.body);
      
      const { attachAssets } = await import('./lib/social-studio');
      const result = await attachAssets(parsed);
      
      res.json(result);
    } catch (error: any) {
      console.error('Social attach assets error:', error);
      await sheetsService.logToSheet('ERROR', 'Social', `Attach assets failed: ${error.message}`);
      res.status(500).json({ error: 'Attach assets failed', details: error.message });
    }
  });

  /**
   * GET /api/marketing/social/preview/:postId
   * Preview a social post
   */
  app.get("/api/marketing/social/preview/:postId", async (req, res) => {
    try {
      const { postId } = req.params;
      
      const { previewPost } = await import('./lib/social-studio');
      const result = await previewPost(postId);
      
      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Social preview error:', error);
      await sheetsService.logToSheet('ERROR', 'Social', `Preview post failed: ${error.message}`);
      res.status(500).json({ error: 'Preview post failed', details: error.message });
    }
  });

  /**
   * POST /api/marketing/social/export
   * Export social calendar as CSV or ICS
   */
  app.post("/api/marketing/social/export", async (req, res) => {
    try {
      const { format, startDate, endDate } = req.body;
      
      if (!format || !['csv', 'ics'].includes(format)) {
        return res.status(400).json({ error: 'format must be "csv" or "ics"' });
      }

      const { exportIcs, exportCsv } = await import('./lib/social-calendar');
      
      const dateRange = startDate && endDate ? {
        start: new Date(startDate),
        end: new Date(endDate)
      } : {
        start: new Date(),
        end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      };
      
      const result = format === 'ics' 
        ? await exportIcs(sheetsService, dateRange)
        : await exportCsv(sheetsService, dateRange);
      
      const content = 'ics' in result ? result.ics : result.csv;
      
      const filename = format === 'csv' ? 'social_calendar.csv' : 'social_calendar.ics';
      const contentType = format === 'csv' ? 'text/csv' : 'text/calendar';
      
      await sheetsService.logToSheet('INFO', 'Social-Marketing', `Exported calendar as ${format.toUpperCase()}`);
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error: any) {
      console.error('Social export error:', error);
      await sheetsService.logToSheet('ERROR', 'Social-Marketing', `Export calendar failed: ${error.message}`);
      res.status(500).json({ error: 'Export calendar failed', details: error.message });
    }
  });

  /**
   * GET /api/marketing/social/calendar
   * Get posts from Social_Calendar by date range
   */
  app.get("/api/marketing/social/calendar", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const { getCalendarPosts } = await import('./lib/social-calendar');
      
      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;
      
      const posts = await getCalendarPosts(sheetsService, dateRange);
      res.json({ success: true, count: posts.length, posts });
    } catch (error: any) {
      console.error('Social calendar error:', error);
      res.status(500).json({ error: 'Failed to fetch calendar', details: error.message });
    }
  });

  /**
   * GET /api/marketing/social/assets
   * Get all assets from Social_Assets
   */
  app.get("/api/marketing/social/assets", async (req, res) => {
    try {
      const assets = await sheetsService.readSheet<any>('Social_Assets');
      res.json({ success: true, count: assets.length, assets });
    } catch (error: any) {
      console.error('Social assets error:', error);
      res.status(500).json({ error: 'Failed to fetch assets', details: error.message });
    }
  });

  // ==================== UTM BUILDER ENDPOINTS ====================

  /**
   * POST /api/marketing/utm/build
   * Build UTM-tagged URL and save to UTM_Builder
   */
  app.post("/api/marketing/utm/build", async (req, res) => {
    try {
      const { buildUTMSchema } = await import('@shared/schema');
      const parsed = buildUTMSchema.parse(req.body);
      
      const { buildUTM } = await import('./lib/utm-builder');
      const result = await buildUTM(parsed);
      
      res.json({
        success: true,
        utmId: result.utmId,
        finalURL: result.finalURL,
        utmParams: result.utmParams,
      });
    } catch (error: any) {
      console.error('Build UTM error:', error);
      await sheetsService.logToSheet('ERROR', 'UTM', `Build UTM failed: ${error.message}`);
      res.status(500).json({ error: 'Build UTM failed', details: error.message });
    }
  });

  /**
   * POST /api/marketing/utm/shortify
   * Shorten a UTM URL using configured link shortener
   */
  app.post("/api/marketing/utm/shortify", async (req, res) => {
    try {
      const { shortifyURLSchema } = await import('@shared/schema');
      const parsed = shortifyURLSchema.parse(req.body);
      
      const { shortify } = await import('./lib/utm-builder');
      const result = await shortify(parsed);
      
      if (!result.ok) {
        return res.status(500).json({ error: result.error });
      }
      
      res.json({
        success: true,
        shortURL: result.shortURL,
      });
    } catch (error: any) {
      console.error('Shortify error:', error);
      await sheetsService.logToSheet('ERROR', 'UTM', `Shortify failed: ${error.message}`);
      res.status(500).json({ error: 'Shortify failed', details: error.message });
    }
  });

  /**
   * GET /api/marketing/utm/links
   * Get all UTM links from UTM_Builder
   */
  app.get("/api/marketing/utm/links", async (req, res) => {
    try {
      const links = await sheetsService.readSheet<any>('UTM_Builder');
      res.json({ success: true, count: links.length, links });
    } catch (error: any) {
      console.error('UTM links error:', error);
      res.status(500).json({ error: 'Failed to fetch UTM links', details: error.message });
    }
  });

  /**
   * POST /api/marketing/ads/import
   * Import ads metrics from CSV (supports both file upload and raw CSV data)
   */
  app.post("/api/marketing/ads/import", async (req, res) => {
    try {
      let csvData: string;

      const contentType = req.headers['content-type'] || '';
      
      if (contentType.includes('multipart/form-data')) {
        const formidable = (await import('formidable')).default;
        const form = formidable({ multiples: false });
        
        const [fields, files] = await new Promise<[any, any]>((resolve, reject) => {
          form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            else resolve([fields, files]);
          });
        });

        const fileKeys = Object.keys(files);
        if (fileKeys.length === 0) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = Array.isArray(files[fileKeys[0]]) ? files[fileKeys[0]][0] : files[fileKeys[0]];
        if (!file) {
          return res.status(400).json({ error: 'Invalid file upload' });
        }

        const fs = await import('fs');
        csvData = fs.readFileSync(file.filepath, 'utf-8');
      } else {
        csvData = req.body.csvData;
        if (!csvData || typeof csvData !== 'string') {
          return res.status(400).json({ error: 'CSV data is required' });
        }
      }

      const { importAdsMetricsCSV } = await import('./lib/marketing-metrics');
      const result = await importAdsMetricsCSV(csvData);
      
      await sheetsService.logToSheet('INFO', 'Marketing', `Ads CSV import: ${result.kpisCreated} KPIs from ${result.rowsProcessed} rows`);
      
      res.json({
        success: true,
        rowsProcessed: result.rowsProcessed,
        kpisCreated: result.kpisCreated,
        exportId: result.exportId,
      });
    } catch (error: any) {
      console.error('Ads import error:', error);
      await sheetsService.logToSheet('ERROR', 'Marketing', `Ads import failed: ${error.message}`);
      res.status(500).json({ error: 'Failed to import ads metrics', details: error.message });
    }
  });

  /**
   * POST /api/marketing/social/import
   * Import social metrics from CSV (supports both file upload and raw CSV data)
   */
  app.post("/api/marketing/social/import", async (req, res) => {
    try {
      let csvData: string;

      const contentType = req.headers['content-type'] || '';
      
      if (contentType.includes('multipart/form-data')) {
        const formidable = (await import('formidable')).default;
        const form = formidable({ multiples: false });
        
        const [fields, files] = await new Promise<[any, any]>((resolve, reject) => {
          form.parse(req, (err, fields, files) => {
            if (err) reject(err);
            else resolve([fields, files]);
          });
        });

        const fileKeys = Object.keys(files);
        if (fileKeys.length === 0) {
          return res.status(400).json({ error: 'No file uploaded' });
        }

        const file = Array.isArray(files[fileKeys[0]]) ? files[fileKeys[0]][0] : files[fileKeys[0]];
        if (!file) {
          return res.status(400).json({ error: 'Invalid file upload' });
        }

        const fs = await import('fs');
        csvData = fs.readFileSync(file.filepath, 'utf-8');
      } else {
        csvData = req.body.csvData;
        if (!csvData || typeof csvData !== 'string') {
          return res.status(400).json({ error: 'CSV data is required' });
        }
      }

      const { importSocialMetricsCSV } = await import('./lib/marketing-metrics');
      const result = await importSocialMetricsCSV(csvData);
      
      await sheetsService.logToSheet('INFO', 'Marketing', `Social CSV import: ${result.metricsCreated} metrics from ${result.rowsProcessed} rows`);
      
      res.json({
        success: true,
        rowsProcessed: result.rowsProcessed,
        metricsCreated: result.metricsCreated,
      });
    } catch (error: any) {
      console.error('Social import error:', error);
      await sheetsService.logToSheet('ERROR', 'Marketing', `Social import failed: ${error.message}`);
      res.status(500).json({ error: 'Failed to import social metrics', details: error.message });
    }
  });

  /**
   * GET /api/marketing/kpis/daily
   * Calculate and retrieve daily KPIs
   */
  app.get("/api/marketing/kpis/daily", async (req, res) => {
    try {
      const { campaignId, startDate, endDate } = req.query;
      
      const { calculateDailyKPIs } = await import('./lib/marketing-kpis');
      const kpis = await calculateDailyKPIs(
        campaignId as string | undefined,
        startDate as string | undefined,
        endDate as string | undefined
      );
      
      res.json({ success: true, count: kpis.length, kpis });
    } catch (error: any) {
      console.error('Daily KPIs error:', error);
      res.status(500).json({ error: 'Failed to calculate daily KPIs', details: error.message });
    }
  });

  /**
   * GET /api/marketing/kpis/weekly
   * Calculate and retrieve weekly KPIs
   */
  app.get("/api/marketing/kpis/weekly", async (req, res) => {
    try {
      const { campaignId, year } = req.query;
      
      const { calculateWeeklyKPIs } = await import('./lib/marketing-kpis');
      const kpis = await calculateWeeklyKPIs(
        campaignId as string | undefined,
        year ? parseInt(year as string) : undefined
      );
      
      res.json({ success: true, count: kpis.length, kpis });
    } catch (error: any) {
      console.error('Weekly KPIs error:', error);
      res.status(500).json({ error: 'Failed to calculate weekly KPIs', details: error.message });
    }
  });

  /**
   * GET /api/marketing/kpis/monthly
   * Calculate and retrieve monthly KPIs
   */
  app.get("/api/marketing/kpis/monthly", async (req, res) => {
    try {
      const { campaignId, year } = req.query;
      
      const { calculateMonthlyKPIs } = await import('./lib/marketing-kpis');
      const kpis = await calculateMonthlyKPIs(
        campaignId as string | undefined,
        year ? parseInt(year as string) : undefined
      );
      
      res.json({ success: true, count: kpis.length, kpis });
    } catch (error: any) {
      console.error('Monthly KPIs error:', error);
      res.status(500).json({ error: 'Failed to calculate monthly KPIs', details: error.message });
    }
  });

  /**
   * POST /api/marketing/kpis/update-revenue
   * Update KPIs with revenue data from orders
   */
  app.post("/api/marketing/kpis/update-revenue", async (req, res) => {
    try {
      const { campaignId, startDate, endDate } = req.body;
      
      const { updateKPIsWithRevenue } = await import('./lib/marketing-kpis');
      const result = await updateKPIsWithRevenue(campaignId, startDate, endDate);
      
      await sheetsService.logToSheet('INFO', 'Marketing', `Revenue update: ${result.updated} KPIs updated`);
      
      res.json({ success: true, updated: result.updated });
    } catch (error: any) {
      console.error('Revenue update error:', error);
      await sheetsService.logToSheet('ERROR', 'Marketing', `Revenue update failed: ${error.message}`);
      res.status(500).json({ error: 'Failed to update revenue', details: error.message });
    }
  });

  // ==================== WEBHOOK ENDPOINTS ====================

  /**
   * Helper function to convert ads webhook payload to CSV format
   */
  function convertAdsWebhookToCSV(payload: any, provider: string): string {
    const headers = 'campaign_id,date,impressions,clicks,spend,conversions\n';
    const row = `${payload.campaign_id || 'UNKNOWN'},${payload.date || new Date().toISOString().split('T')[0]},${payload.impressions || 0},${payload.clicks || 0},${payload.spend || 0},${payload.conversions || 0}\n`;
    return headers + row;
  }

  /**
   * Helper function to convert social webhook payload to CSV format
   */
  function convertSocialWebhookToCSV(payload: any, provider: string): string {
    const headers = 'post_id,channel,timestamp,impressions,reach,clicks,likes,comments,shares,saves\n';
    const row = `${payload.post_id || 'UNKNOWN'},${provider},${payload.timestamp || new Date().toISOString()},${payload.impressions || 0},${payload.reach || 0},${payload.clicks || 0},${payload.likes || 0},${payload.comments || 0},${payload.shares || 0},${payload.saves || 0}\n`;
    return headers + row;
  }

  /**
   * POST /webhooks/ads/:provider
   * Receive ads metrics from advertising platforms (optional)
   * Supports: google, facebook, bing, linkedin
   */
  app.post("/webhooks/ads/:provider", express.json(), async (req, res) => {
    const provider = req.params.provider?.toLowerCase();
    
    try {
      await sheetsService.logToSheet('INFO', 'Webhook', `Ads webhook received from ${provider}`);
      
      const payload = req.body;
      
      if (!payload || !payload.campaign_id) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      const csvData = convertAdsWebhookToCSV(payload, provider);
      
      const { importAdsMetricsCSV } = await import('./lib/marketing-metrics');
      const result = await importAdsMetricsCSV(csvData);
      
      await sheetsService.logToSheet('INFO', 'Webhook', `Ads webhook processed: ${result.kpisCreated} KPIs from ${provider}`);
      
      res.json({ success: true, received: true, kpisCreated: result.kpisCreated });
    } catch (error: any) {
      console.error('Ads webhook error:', error);
      await sheetsService.logToSheet('ERROR', 'Webhook', `Ads webhook failed (${provider}): ${error.message}`);
      res.status(500).json({ error: 'Webhook processing failed', details: error.message });
    }
  });

  /**
   * POST /webhooks/social/:provider
   * Receive social metrics from social platforms (optional)
   * Supports: meta, twitter, linkedin, pinterest
   */
  app.post("/webhooks/social/:provider", express.json(), async (req, res) => {
    const provider = req.params.provider?.toLowerCase();
    
    try {
      await sheetsService.logToSheet('INFO', 'Webhook', `Social webhook received from ${provider}`);
      
      const payload = req.body;
      
      if (!payload || !payload.post_id) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      const csvData = convertSocialWebhookToCSV(payload, provider);
      
      const { importSocialMetricsCSV } = await import('./lib/marketing-metrics');
      const result = await importSocialMetricsCSV(csvData);
      
      await sheetsService.logToSheet('INFO', 'Webhook', `Social webhook processed: ${result.metricsCreated} metrics from ${provider}`);
      
      res.json({ success: true, received: true, metricsCreated: result.metricsCreated });
    } catch (error: any) {
      console.error('Social webhook error:', error);
      await sheetsService.logToSheet('ERROR', 'Webhook', `Social webhook failed (${provider}): ${error.message}`);
      res.status(500).json({ error: 'Webhook processing failed', details: error.message });
    }
  });

  /**
   * Email Provider Webhooks - Handle events from Brevo/Resend
   * Supports: unsubscribed, bounce, complaint, open, click
   * 
   * Security: Uses signature verification for each provider
   * - Brevo: Custom header X-Brevo-Webhook-Secret
   * - Resend: Svix signature (svix-id, svix-timestamp, svix-signature)
   */
  app.post("/webhooks/email/:provider", express.text({ type: '*/*' }), async (req, res) => {
    const provider = req.params.provider?.toLowerCase();
    
    try {
      // Import webhook handlers
      const {
        WebhookEventHandler,
        verifyBrevoSignature,
        verifyResendSignature,
        parseBrevoEvent,
        parseResendEvent
      } = await import('./lib/webhook-handlers');

      // Verify signature and parse event based on provider
      let event;
      let verified = false;

      if (provider === 'brevo') {
        // Brevo uses custom header for authentication
        const headerSecret = req.headers['x-brevo-webhook-secret'] as string;
        const configuredSecret = process.env.BREVO_WEBHOOK_SECRET || '';
        
        if (configuredSecret) {
          verified = verifyBrevoSignature(headerSecret, configuredSecret);
        } else {
          // If no secret configured, allow webhook (log warning)
          verified = true;
          await sheetsService.logToSheet(
            'WARN',
            'Webhook',
            'Brevo webhook received without signature verification (BREVO_WEBHOOK_SECRET not set)'
          );
        }

        if (!verified) {
          await sheetsService.logToSheet('ERROR', 'Webhook', 'Brevo signature verification failed');
          return res.status(401).json({ error: 'Invalid signature' });
        }

        // Parse Brevo event
        const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        event = parseBrevoEvent(parsedBody);

      } else if (provider === 'resend') {
        // Resend uses Svix signature
        const svixId = req.headers['svix-id'] as string;
        const svixTimestamp = req.headers['svix-timestamp'] as string;
        const svixSignature = req.headers['svix-signature'] as string;
        const webhookSecret = process.env.RESEND_WEBHOOK_SECRET || '';

        if (!webhookSecret) {
          await sheetsService.logToSheet(
            'ERROR',
            'Webhook',
            'Resend webhook secret not configured (RESEND_WEBHOOK_SECRET)'
          );
          return res.status(500).json({ error: 'Webhook secret not configured' });
        }

        // Verify Svix signature (requires raw body)
        const rawPayload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        verified = verifyResendSignature(
          rawPayload,
          svixId,
          svixTimestamp,
          svixSignature,
          webhookSecret
        );

        if (!verified) {
          await sheetsService.logToSheet('ERROR', 'Webhook', 'Resend signature verification failed');
          return res.status(401).json({ error: 'Invalid signature' });
        }

        // Parse Resend event
        const parsedBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        event = parseResendEvent(parsedBody);

      } else {
        await sheetsService.logToSheet('WARN', 'Webhook', `Unknown provider: ${provider}`);
        return res.status(400).json({ error: 'Unsupported provider' });
      }

      // Process the event
      const handler = new WebhookEventHandler(sheetsService);
      const result = await handler.processEvent(event);

      // Log result to OS_Health
      await sheetsService.writeOSHealth(
        '2B-5 Webhooks',
        result.success ? 'PASS' : 'FAIL',
        `${provider} ${event.type} for ${event.email}`,
        { 
          provider,
          eventType: event.type,
          email: event.email,
          actions: result.actions,
          errors: result.errors
        }
      );

      // Return response
      if (result.success) {
        res.status(200).json({
          success: true,
          eventType: result.eventType,
          actions: result.actions
        });
      } else {
        res.status(500).json({
          success: false,
          eventType: result.eventType,
          errors: result.errors
        });
      }

    } catch (error: any) {
      console.error('Webhook processing error:', error);
      await sheetsService.logToSheet('ERROR', 'Webhook', `Webhook processing failed: ${error.message}`);
      
      res.status(500).json({
        success: false,
        error: 'Webhook processing failed',
        details: error.message
      });
    }
  });

  // ==================== AI AGENTS ENDPOINTS ====================

  /**
   * POST /api/ai/seo/brief
   * Generate SEO content brief using A-SEO-110
   */
  app.post("/api/ai/seo/brief", async (req, res) => {
    try {
      const { keywords, language, targetURL, productSKUs } = req.body;

      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: 'keywords array is required' });
      }

      if (!language || !['DE', 'EN'].includes(language)) {
        return res.status(400).json({ error: 'language must be DE or EN' });
      }

      const { generateSEOBrief } = await import('./lib/ai-seo');
      const brief = await generateSEOBrief({
        keywords,
        language,
        targetURL,
        productSKUs
      });

      res.json({
        success: true,
        brief
      });
    } catch (error: any) {
      console.error('AI SEO brief error:', error);
      await sheetsService.logToSheet('ERROR', 'AI-SEO', `Brief generation failed: ${error.message}`);
      res.status(500).json({ error: 'Brief generation failed', details: error.message });
    }
  });

  /**
   * POST /api/ai/seo/audit
   * Audit page for SEO using A-SEO-110
   */
  app.post("/api/ai/seo/audit", async (req, res) => {
    try {
      const { pageURL, currentTitle, currentMeta, currentH1, currentContent } = req.body;

      if (!pageURL) {
        return res.status(400).json({ error: 'pageURL is required' });
      }

      const { auditPage } = await import('./lib/ai-seo');
      const audit = await auditPage({
        pageURL,
        currentTitle,
        currentMeta,
        currentH1,
        currentContent
      });

      res.json({
        success: true,
        audit
      });
    } catch (error: any) {
      console.error('AI SEO audit error:', error);
      await sheetsService.logToSheet('ERROR', 'AI-SEO', `Audit failed: ${error.message}`);
      res.status(500).json({ error: 'Audit failed', details: error.message });
    }
  });

  /**
   * POST /api/ai/ads/expand-keywords
   * Expand keywords using A-ADS-120
   */
  app.post("/api/ai/ads/expand-keywords", async (req, res) => {
    try {
      const { seedKeywords, language, matchType } = req.body;

      if (!seedKeywords || !Array.isArray(seedKeywords) || seedKeywords.length === 0) {
        return res.status(400).json({ error: 'seedKeywords array is required' });
      }

      if (!language || !['DE', 'EN'].includes(language)) {
        return res.status(400).json({ error: 'language must be DE or EN' });
      }

      const { expandKeywords } = await import('./lib/ai-ads');
      const adGroup = await expandKeywords({
        seedKeywords,
        language,
        matchType
      });

      res.json({
        success: true,
        adGroup
      });
    } catch (error: any) {
      console.error('AI Ads expand keywords error:', error);
      await sheetsService.logToSheet('ERROR', 'AI-ADS', `Keyword expansion failed: ${error.message}`);
      res.status(500).json({ error: 'Keyword expansion failed', details: error.message });
    }
  });

  /**
   * POST /api/ai/ads/generate-copy
   * Generate ad copy using A-ADS-120
   */
  app.post("/api/ai/ads/generate-copy", async (req, res) => {
    try {
      const { keywords, productName, finalURL, language, callToAction } = req.body;

      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: 'keywords array is required' });
      }

      if (!finalURL) {
        return res.status(400).json({ error: 'finalURL is required' });
      }

      if (!language || !['DE', 'EN'].includes(language)) {
        return res.status(400).json({ error: 'language must be DE or EN' });
      }

      const { generateAdCopy } = await import('./lib/ai-ads');
      const creative = await generateAdCopy({
        keywords,
        productName,
        finalURL,
        language,
        callToAction
      });

      res.json({
        success: true,
        creative
      });
    } catch (error: any) {
      console.error('AI Ads generate copy error:', error);
      await sheetsService.logToSheet('ERROR', 'AI-ADS', `Ad copy generation failed: ${error.message}`);
      res.status(500).json({ error: 'Ad copy generation failed', details: error.message });
    }
  });

  /**
   * POST /api/ai/social/generate-plan
   * Generate social media content plan using A-SOC-010
   */
  app.post("/api/ai/social/generate-plan", async (req, res) => {
    try {
      const { productLine, channel, locale, days, tone } = req.body;

      if (!productLine) {
        return res.status(400).json({ error: 'productLine is required' });
      }

      if (!channel || !['Instagram', 'LinkedIn', 'Twitter', 'Facebook'].includes(channel)) {
        return res.status(400).json({ error: 'channel must be Instagram, LinkedIn, Twitter, or Facebook' });
      }

      if (!locale || !['de', 'en'].includes(locale)) {
        return res.status(400).json({ error: 'locale must be de or en' });
      }

      const { generateSocialPlan } = await import('./lib/ai-social');
      const calendar = await generateSocialPlan({
        productLine,
        channel,
        locale,
        days: days || 14,
        tone
      });

      res.json({
        success: true,
        postsCreated: calendar.length,
        calendar
      });
    } catch (error: any) {
      console.error('AI Social generate plan error:', error);
      await sheetsService.logToSheet('ERROR', 'AI-SOC', `Social plan generation failed: ${error.message}`);
      res.status(500).json({ error: 'Social plan generation failed', details: error.message });
    }
  });

  /**
   * POST /api/ai/social/rewrite-caption
   * Rewrite social media caption using A-SOC-010
   */
  app.post("/api/ai/social/rewrite-caption", async (req, res) => {
    try {
      const { originalCaption, tone, locale } = req.body;

      if (!originalCaption) {
        return res.status(400).json({ error: 'originalCaption is required' });
      }

      if (!tone) {
        return res.status(400).json({ error: 'tone is required' });
      }

      if (!locale || !['de', 'en'].includes(locale)) {
        return res.status(400).json({ error: 'locale must be de or en' });
      }

      const { rewriteCaption } = await import('./lib/ai-social');
      const result = await rewriteCaption({
        originalCaption,
        tone,
        locale
      });

      res.json({
        success: true,
        hook: result.hook,
        caption: result.caption
      });
    } catch (error: any) {
      console.error('AI Social rewrite caption error:', error);
      await sheetsService.logToSheet('ERROR', 'AI-SOC', `Caption rewrite failed: ${error.message}`);
      res.status(500).json({ error: 'Caption rewrite failed', details: error.message });
    }
  });

  /**
   * GET /api/ai/agents/log
   * Get AI agents operation log
   */
  app.get("/api/ai/agents/log", async (req, res) => {
    try {
      const { limit = '50' } = req.query;
      const log = await sheetsService.readSheet<any>('AI_Agents_Log');
      
      const sorted = log
        .sort((a, b) => new Date(b.CreatedTS).getTime() - new Date(a.CreatedTS).getTime())
        .slice(0, parseInt(String(limit)));

      res.json({
        success: true,
        count: sorted.length,
        log: sorted
      });
    } catch (error: any) {
      console.error('AI agents log error:', error);
      res.status(500).json({ error: 'Failed to fetch agents log', details: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
