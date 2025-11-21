/**
 * Stand Routes - Unified API Routes for Stand Center System
 * All routes under /api/stands/*
 */

import type { Express } from "express";
import { standService } from './stand.service';
import { standContractsService } from './stand.contracts';
import { standInvoicesService } from './stand.invoices';
import { standBundlesService } from './stand.bundles';
import { standReturnsService } from './stand.returns';
import { standShipmentsService } from './stand.shipments';
import { standLoyaltyService } from './stand.loyalty';
import { standAIManager } from './ai/stand.ai.manager';
import { createLogger } from '../../lib/logger';
import {
  standInsertSchema,
  standInventoryInsertSchema,
  standRefillPlanInsertSchema,
  standVisitInsertSchema,
  standContractInsertSchema,
  standInvoiceInsertSchema,
  standBundleInsertSchema,
  standReturnInsertSchema,
  standShipmentInsertSchema,
  standLoyaltyInsertSchema,
} from '@shared/schema';

const logger = createLogger('StandRoutes');

export function registerStandRoutes(app: Express) {
  logger.info('Registering Stand Center routes');

  // ============= STAND MANAGEMENT =============
  
  // GET /api/stands - Get all stands
  app.get('/api/stands', async (req, res) => {
    try {
      const stands = await standService.getAllStands();
      res.json(stands);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get stands');
      res.status(500).json({ error: 'Failed to get stands', details: error.message });
    }
  });

  // GET /api/stands/:id - Get stand by ID
  app.get('/api/stands/:id', async (req, res) => {
    try {
      const stand = await standService.getStandById(req.params.id);
      if (!stand) {
        return res.status(404).json({ error: 'Stand not found' });
      }
      res.json(stand);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get stand');
      res.status(500).json({ error: 'Failed to get stand', details: error.message });
    }
  });

  // POST /api/stands - Create new stand
  app.post('/api/stands', async (req, res) => {
    try {
      const validated = standInsertSchema.parse(req.body);
      const stand = await standService.createStand(validated);
      res.status(201).json(stand);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to create stand');
      res.status(400).json({ error: 'Failed to create stand', details: error.message });
    }
  });

  // PATCH /api/stands/:id - Update stand
  app.patch('/api/stands/:id', async (req, res) => {
    try {
      const success = await standService.updateStand(req.params.id, req.body);
      if (!success) {
        return res.status(404).json({ error: 'Stand not found or update failed' });
      }
      res.json({ success: true });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to update stand');
      res.status(500).json({ error: 'Failed to update stand', details: error.message });
    }
  });

  // ============= INVENTORY MANAGEMENT =============

  // GET /api/stands/:id/inventory - Get stand inventory
  app.get('/api/stands/:id/inventory', async (req, res) => {
    try {
      const inventory = await standService.getStandInventory(req.params.id);
      res.json(inventory);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get inventory');
      res.status(500).json({ error: 'Failed to get inventory', details: error.message });
    }
  });

  // POST /api/stands/inventory - Add inventory (kept for backward compatibility)
  app.post('/api/stands/inventory', async (req, res) => {
    try {
      const validated = standInventoryInsertSchema.parse(req.body);
      const success = await standService.addInventory(validated);
      res.status(201).json({ success });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to add inventory');
      res.status(400).json({ error: 'Failed to add inventory', details: error.message });
    }
  });

  // ============= REFILL MANAGEMENT =============

  // GET /api/stands/:id/refill-plans - Get refill plans
  app.get('/api/stands/:id/refill-plans', async (req, res) => {
    try {
      const plans = await standService.getRefillPlans(req.params.id);
      res.json(plans);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get refill plans');
      res.status(500).json({ error: 'Failed to get refill plans', details: error.message });
    }
  });

  // POST /api/stands/refill-plan - Create refill plan (kept for backward compatibility)
  app.post('/api/stands/refill-plan', async (req, res) => {
    try {
      const validated = standRefillPlanInsertSchema.parse(req.body);
      const plan = await standService.createRefillPlan(validated);
      res.status(201).json(plan);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to create refill plan');
      res.status(400).json({ error: 'Failed to create refill plan', details: error.message });
    }
  });

  // ============= VISITS MANAGEMENT =============

  // GET /api/stands/:id/visits - Get stand visits
  app.get('/api/stands/:id/visits', async (req, res) => {
    try {
      const visits = await standService.getVisits(req.params.id);
      res.json(visits);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get visits');
      res.status(500).json({ error: 'Failed to get visits', details: error.message });
    }
  });

  // POST /api/stands/visits - Create visit record (kept for backward compatibility)
  app.post('/api/stands/visits', async (req, res) => {
    try {
      const validated = standVisitInsertSchema.parse(req.body);
      const visit = await standService.createVisit(validated);
      res.status(201).json(visit);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to create visit');
      res.status(400).json({ error: 'Failed to create visit', details: error.message });
    }
  });

  // ============= KPIs & ANALYTICS =============

  // GET /api/stands/kpis - Get all KPIs (with optional filters)
  app.get('/api/stands/kpis', async (req, res) => {
    try {
      const { standId, month } = req.query;
      const kpis = await standService.getStandKPIs(
        standId as string,
        month as string
      );
      res.json(kpis);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get KPIs');
      res.status(500).json({ error: 'Failed to get KPIs', details: error.message });
    }
  });

  // GET /api/stands/:id/kpis - Get KPIs for specific stand
  app.get('/api/stands/:id/kpis', async (req, res) => {
    try {
      const kpis = await standService.getStandKPIs(req.params.id);
      res.json(kpis);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get stand KPIs');
      res.status(500).json({ error: 'Failed to get stand KPIs', details: error.message });
    }
  });

  // ============= CONTRACTS MANAGEMENT =============

  // GET /api/stands/:id/contracts - Get stand contracts
  app.get('/api/stands/:id/contracts', async (req, res) => {
    try {
      const contracts = await standContractsService.getStandContracts(req.params.id);
      res.json(contracts);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get contracts');
      res.status(500).json({ error: 'Failed to get contracts', details: error.message });
    }
  });

  // GET /api/stands/:id/contracts/active - Get active contract
  app.get('/api/stands/:id/contracts/active', async (req, res) => {
    try {
      const contract = await standContractsService.getActiveContract(req.params.id);
      res.json(contract);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get active contract');
      res.status(500).json({ error: 'Failed to get active contract', details: error.message });
    }
  });

  // POST /api/stands/contracts - Create contract
  app.post('/api/stands/contracts', async (req, res) => {
    try {
      const validated = standContractInsertSchema.parse(req.body);
      const contract = await standContractsService.createContract(validated);
      res.status(201).json(contract);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to create contract');
      res.status(400).json({ error: 'Failed to create contract', details: error.message });
    }
  });

  // GET /api/contracts - Get all contracts
  app.get('/api/contracts', async (req, res) => {
    try {
      const contracts = await standContractsService.getAllContracts();
      res.json(contracts);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get all contracts');
      res.status(500).json({ error: 'Failed to get all contracts', details: error.message });
    }
  });

  // GET /api/contracts/analytics - Get contract analytics
  app.get('/api/contracts/analytics', async (req, res) => {
    try {
      const analytics = await standContractsService.getContractAnalytics();
      res.json(analytics);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get contract analytics');
      res.status(500).json({ error: 'Failed to get contract analytics', details: error.message });
    }
  });

  // GET /api/contracts/:id - Get contract by ID
  app.get('/api/contracts/:id', async (req, res) => {
    try {
      const contract = await standContractsService.getContractById(req.params.id);
      if (!contract) {
        return res.status(404).json({ error: 'Contract not found' });
      }
      res.json(contract);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get contract');
      res.status(500).json({ error: 'Failed to get contract', details: error.message });
    }
  });

  // POST /api/contracts/:id/renew - Renew contract
  app.post('/api/contracts/:id/renew', async (req, res) => {
    try {
      const { duration } = req.body;
      const newContract = await standContractsService.renewContract(req.params.id, duration);
      res.status(201).json(newContract);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to renew contract');
      res.status(400).json({ error: 'Failed to renew contract', details: error.message });
    }
  });

  // POST /api/contracts/:id/terminate - Terminate contract
  app.post('/api/contracts/:id/terminate', async (req, res) => {
    try {
      const { reason } = req.body;
      const success = await standContractsService.terminateContract(req.params.id, reason);
      if (!success) {
        return res.status(400).json({ error: 'Failed to terminate contract' });
      }
      res.json({ success: true, message: 'Contract terminated successfully' });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to terminate contract');
      res.status(400).json({ error: 'Failed to terminate contract', details: error.message });
    }
  });

  // ============= INVOICES MANAGEMENT =============

  // GET /api/stands/:id/invoices - Get stand invoices
  app.get('/api/stands/:id/invoices', async (req, res) => {
    try {
      const invoices = await standInvoicesService.getStandInvoices(req.params.id);
      res.json(invoices);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get invoices');
      res.status(500).json({ error: 'Failed to get invoices', details: error.message });
    }
  });

  // GET /api/stands/invoices/overdue - Get all overdue invoices
  app.get('/api/stands/invoices/overdue', async (req, res) => {
    try {
      const { standId } = req.query;
      const invoices = await standInvoicesService.getOverdueInvoices(standId as string);
      res.json(invoices);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get overdue invoices');
      res.status(500).json({ error: 'Failed to get overdue invoices', details: error.message });
    }
  });

  // POST /api/stands/invoices - Create invoice
  app.post('/api/stands/invoices', async (req, res) => {
    try {
      const validated = standInvoiceInsertSchema.parse(req.body);
      const invoice = await standInvoicesService.createInvoice(validated);
      res.status(201).json(invoice);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to create invoice');
      res.status(400).json({ error: 'Failed to create invoice', details: error.message });
    }
  });

  // POST /api/stands/invoices/:id/pay - Mark invoice as paid
  app.post('/api/stands/invoices/:id/pay', async (req, res) => {
    try {
      const { paymentMethod } = req.body;
      const success = await standInvoicesService.markAsPaid(req.params.id, paymentMethod);
      res.json({ success });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to mark invoice as paid');
      res.status(500).json({ error: 'Failed to mark invoice as paid', details: error.message });
    }
  });

  // GET /api/invoices - Get all invoices
  app.get('/api/invoices', async (req, res) => {
    try {
      const invoices = await standInvoicesService.getAllInvoices();
      res.json(invoices);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get all invoices');
      res.status(500).json({ error: 'Failed to get all invoices', details: error.message });
    }
  });

  // GET /api/invoices/analytics - Get invoice analytics
  app.get('/api/invoices/analytics', async (req, res) => {
    try {
      const analytics = await standInvoicesService.getInvoiceAnalytics();
      res.json(analytics);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get invoice analytics');
      res.status(500).json({ error: 'Failed to get invoice analytics', details: error.message });
    }
  });

  // GET /api/invoices/:id - Get invoice by ID
  app.get('/api/invoices/:id', async (req, res) => {
    try {
      const invoice = await standInvoicesService.getInvoiceById(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.json(invoice);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get invoice');
      res.status(500).json({ error: 'Failed to get invoice', details: error.message });
    }
  });

  // POST /api/invoices/:id/cancel - Cancel invoice
  app.post('/api/invoices/:id/cancel', async (req, res) => {
    try {
      const { reason } = req.body;
      const success = await standInvoicesService.cancelInvoice(req.params.id, reason);
      if (!success) {
        return res.status(400).json({ error: 'Failed to cancel invoice' });
      }
      res.json({ success: true, message: 'Invoice cancelled successfully' });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to cancel invoice');
      res.status(400).json({ error: 'Failed to cancel invoice', details: error.message });
    }
  });

  // ============= BUNDLES MANAGEMENT =============

  // GET /api/stands/:id/bundles - Get stand bundles
  app.get('/api/stands/:id/bundles', async (req, res) => {
    try {
      const activeOnly = req.query.active === 'true';
      const bundles = await standBundlesService.getStandBundles(req.params.id, activeOnly);
      res.json(bundles);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get bundles');
      res.status(500).json({ error: 'Failed to get bundles', details: error.message });
    }
  });

  // POST /api/stands/bundles - Create bundle
  app.post('/api/stands/bundles', async (req, res) => {
    try {
      const validated = standBundleInsertSchema.parse(req.body);
      const bundle = await standBundlesService.createBundle(validated);
      res.status(201).json(bundle);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to create bundle');
      res.status(400).json({ error: 'Failed to create bundle', details: error.message });
    }
  });

  // ============= GLOBAL BUNDLES ROUTES (admin) =============

  // GET /api/bundles - Get all bundles
  app.get('/api/bundles', async (req, res) => {
    try {
      const bundles = await standBundlesService.getAllBundles();
      res.json(bundles);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get all bundles');
      res.status(500).json({ error: 'Failed to get all bundles', details: error.message });
    }
  });

  // GET /api/bundles/analytics - Get bundle analytics
  app.get('/api/bundles/analytics', async (req, res) => {
    try {
      const analytics = await standBundlesService.getBundleAnalytics();
      res.json(analytics);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get bundle analytics');
      res.status(500).json({ error: 'Failed to get bundle analytics', details: error.message });
    }
  });

  // GET /api/bundles/:id - Get bundle by ID
  app.get('/api/bundles/:id', async (req, res) => {
    try {
      const bundle = await standBundlesService.getBundleById(req.params.id);
      if (!bundle) {
        return res.status(404).json({ error: 'Bundle not found' });
      }
      res.json(bundle);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get bundle');
      res.status(500).json({ error: 'Failed to get bundle', details: error.message });
    }
  });

  // PATCH /api/bundles/:id - Update bundle
  app.patch('/api/bundles/:id', async (req, res) => {
    try {
      const success = await standBundlesService.updateBundle(req.params.id, req.body);
      if (!success) {
        return res.status(400).json({ error: 'Failed to update bundle' });
      }
      res.json({ success: true, message: 'Bundle updated successfully' });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to update bundle');
      res.status(400).json({ error: 'Failed to update bundle', details: error.message });
    }
  });

  // DELETE /api/bundles/:id - Delete bundle
  app.delete('/api/bundles/:id', async (req, res) => {
    try {
      const success = await standBundlesService.deleteBundle(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Bundle not found or failed to delete' });
      }
      res.json({ success: true, message: 'Bundle deleted successfully' });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to delete bundle');
      res.status(500).json({ error: 'Failed to delete bundle', details: error.message });
    }
  });

  // ============= RETURNS MANAGEMENT =============

  // GET /api/stands/:id/returns - Get stand returns
  app.get('/api/stands/:id/returns', async (req, res) => {
    try {
      const returns = await standReturnsService.getStandReturns(req.params.id);
      res.json(returns);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get returns');
      res.status(500).json({ error: 'Failed to get returns', details: error.message });
    }
  });

  // POST /api/stands/returns - Create return
  app.post('/api/stands/returns', async (req, res) => {
    try {
      const validated = standReturnInsertSchema.parse(req.body);
      const returnRecord = await standReturnsService.createReturn(validated);
      res.status(201).json(returnRecord);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to create return');
      res.status(400).json({ error: 'Failed to create return', details: error.message });
    }
  });

  // POST /api/stands/returns/:id/approve - Approve return
  app.post('/api/stands/returns/:id/approve', async (req, res) => {
    try {
      const { processedBy } = req.body;
      const success = await standReturnsService.approveReturn(req.params.id, processedBy);
      res.json({ success });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to approve return');
      res.status(500).json({ error: 'Failed to approve return', details: error.message });
    }
  });

  // ============= GLOBAL RETURNS ROUTES (admin) =============

  // GET /api/returns - Get all returns
  app.get('/api/returns', async (req, res) => {
    try {
      const returns = await standReturnsService.getAllReturns();
      res.json(returns);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get all returns');
      res.status(500).json({ error: 'Failed to get all returns', details: error.message });
    }
  });

  // GET /api/returns/analytics - Get return analytics
  app.get('/api/returns/analytics', async (req, res) => {
    try {
      const analytics = await standReturnsService.getReturnAnalytics();
      res.json(analytics);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get return analytics');
      res.status(500).json({ error: 'Failed to get return analytics', details: error.message });
    }
  });

  // GET /api/returns/:id - Get return by ID
  app.get('/api/returns/:id', async (req, res) => {
    try {
      const returnRecord = await standReturnsService.getReturnById(req.params.id);
      if (!returnRecord) {
        return res.status(404).json({ error: 'Return not found' });
      }
      res.json(returnRecord);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get return');
      res.status(500).json({ error: 'Failed to get return', details: error.message });
    }
  });

  // POST /api/returns/:id/refund - Process refund
  app.post('/api/returns/:id/refund', async (req, res) => {
    try {
      const { processedBy } = req.body;
      const success = await standReturnsService.processRefund(req.params.id, processedBy);
      if (!success) {
        return res.status(400).json({ error: 'Failed to process refund' });
      }
      res.json({ success: true, message: 'Refund processed successfully' });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to process refund');
      res.status(400).json({ error: 'Failed to process refund', details: error.message });
    }
  });

  // POST /api/returns/:id/reject - Reject return
  app.post('/api/returns/:id/reject', async (req, res) => {
    try {
      const { processedBy, reason } = req.body;
      const success = await standReturnsService.rejectReturn(req.params.id, processedBy, reason);
      if (!success) {
        return res.status(400).json({ error: 'Failed to reject return' });
      }
      res.json({ success: true, message: 'Return rejected successfully' });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to reject return');
      res.status(400).json({ error: 'Failed to reject return', details: error.message });
    }
  });

  // ============= SHIPMENTS MANAGEMENT =============

  // GET /api/stands/:id/shipments - Get stand shipments
  app.get('/api/stands/:id/shipments', async (req, res) => {
    try {
      const shipments = await standShipmentsService.getStandShipments(req.params.id);
      res.json(shipments);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get shipments');
      res.status(500).json({ error: 'Failed to get shipments', details: error.message });
    }
  });

  // POST /api/stands/shipments - Create shipment
  app.post('/api/stands/shipments', async (req, res) => {
    try {
      const validated = standShipmentInsertSchema.parse(req.body);
      const shipment = await standShipmentsService.createShipment(validated);
      res.status(201).json(shipment);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to create shipment');
      res.status(400).json({ error: 'Failed to create shipment', details: error.message });
    }
  });

  // PATCH /api/stands/shipments/:id/status - Update shipment status
  app.patch('/api/stands/shipments/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      const success = await standShipmentsService.updateShipmentStatus(req.params.id, status);
      res.json({ success });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to update shipment status');
      res.status(500).json({ error: 'Failed to update shipment status', details: error.message });
    }
  });

  // ============= GLOBAL SHIPMENTS ROUTES (admin) =============

  // GET /api/shipments - Get all shipments
  app.get('/api/shipments', async (req, res) => {
    try {
      const shipments = await standShipmentsService.getAllShipments();
      res.json(shipments);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get all shipments');
      res.status(500).json({ error: 'Failed to get all shipments', details: error.message });
    }
  });

  // GET /api/shipments/analytics - Get shipment analytics
  app.get('/api/shipments/analytics', async (req, res) => {
    try {
      const analytics = await standShipmentsService.getShipmentAnalytics();
      res.json(analytics);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get shipment analytics');
      res.status(500).json({ error: 'Failed to get shipment analytics', details: error.message });
    }
  });

  // GET /api/shipments/:id - Get shipment by ID
  app.get('/api/shipments/:id', async (req, res) => {
    try {
      const shipment = await standShipmentsService.getShipmentById(req.params.id);
      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      res.json(shipment);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get shipment');
      res.status(500).json({ error: 'Failed to get shipment', details: error.message });
    }
  });

  // PATCH /api/shipments/:id/tracking - Update tracking information
  app.patch('/api/shipments/:id/tracking', async (req, res) => {
    try {
      const { trackingNumber, carrier } = req.body;
      if (!trackingNumber) {
        return res.status(400).json({ error: 'Tracking number is required' });
      }
      const success = await standShipmentsService.updateTracking(req.params.id, trackingNumber, carrier);
      if (!success) {
        return res.status(400).json({ error: 'Failed to update tracking' });
      }
      res.json({ success: true, message: 'Tracking updated successfully' });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to update tracking');
      res.status(400).json({ error: 'Failed to update tracking', details: error.message });
    }
  });

  // ============= LOYALTY MANAGEMENT =============

  // GET /api/stands/:id/loyalty - Get loyalty history
  app.get('/api/stands/:id/loyalty', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = await standLoyaltyService.getStandLoyaltyHistory(req.params.id, limit);
      res.json(history);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get loyalty history');
      res.status(500).json({ error: 'Failed to get loyalty history', details: error.message });
    }
  });

  // GET /api/stands/:id/loyalty/balance - Get loyalty balance
  app.get('/api/stands/:id/loyalty/balance', async (req, res) => {
    try {
      const balance = await standLoyaltyService.getStandLoyaltyBalance(req.params.id);
      res.json({ balance });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get loyalty balance');
      res.status(500).json({ error: 'Failed to get loyalty balance', details: error.message });
    }
  });

  // POST /api/stands/loyalty - Add loyalty points
  app.post('/api/stands/loyalty', async (req, res) => {
    try {
      const validated = standLoyaltyInsertSchema.parse(req.body);
      const entry = await standLoyaltyService.addLoyaltyPoints(validated);
      res.status(201).json(entry);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to add loyalty points');
      res.status(400).json({ error: 'Failed to add loyalty points', details: error.message });
    }
  });

  // POST /api/stands/:id/loyalty/redeem - Redeem loyalty points
  app.post('/api/stands/:id/loyalty/redeem', async (req, res) => {
    try {
      const { points, reason } = req.body;
      const entry = await standLoyaltyService.redeemLoyaltyPoints(req.params.id, points, reason);
      if (!entry) {
        return res.status(400).json({ error: 'Failed to redeem points - insufficient balance' });
      }
      res.json(entry);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to redeem loyalty points');
      res.status(500).json({ error: 'Failed to redeem loyalty points', details: error.message });
    }
  });

  // ============= ACTIVITY LOG =============

  // GET /api/stands/:id/activities - Get stand activities
  app.get('/api/stands/:id/activities', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const activities = await standService.getActivities(req.params.id, limit);
      res.json(activities);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get activities');
      res.status(500).json({ error: 'Failed to get activities', details: error.message });
    }
  });

  // ============= AI ASSISTANT =============

  // GET /api/stands/:id/health - Get AI health report
  app.get('/api/stands/:id/health', async (req, res) => {
    try {
      const report = await standAIManager.generateHealthReport(req.params.id);
      res.json(report);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to generate health report');
      res.status(500).json({ error: 'Failed to generate health report', details: error.message });
    }
  });

  // POST /api/stands/:id/alert - Send critical alert
  app.post('/api/stands/:id/alert', async (req, res) => {
    try {
      await standAIManager.sendCriticalAlert(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to send alert');
      res.status(500).json({ error: 'Failed to send alert', details: error.message });
    }
  });

  // ============= AI & ANALYTICS =============

  // GET /api/stands/:id/ai/health - Get AI health report
  app.get('/api/stands/:id/ai/health', async (req, res) => {
    try {
      const report = await standAIManager.generateHealthReport(req.params.id);
      res.json(report);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to generate health report');
      res.status(500).json({ error: 'Failed to generate health report', details: error.message });
    }
  });

  // GET /api/stands/:id/ai/comprehensive - Get comprehensive AI report (all 7 agents)
  app.get('/api/stands/:id/ai/comprehensive', async (req, res) => {
    try {
      const report = await standAIManager.generateComprehensiveReport(req.params.id);
      res.json(report);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to generate comprehensive AI report');
      res.status(500).json({ error: 'Failed to generate comprehensive AI report', details: error.message });
    }
  });

  // GET /api/stands/:id/ai/refill-plan - Get AI-powered refill plan
  app.get('/api/stands/:id/ai/refill-plan', async (req, res) => {
    try {
      const budget = req.query.budget ? Number(req.query.budget) : undefined;
      const plan = await standAIManager.getRefillPlan(req.params.id, budget);
      res.json(plan);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to generate refill plan');
      res.status(500).json({ error: 'Failed to generate refill plan', details: error.message });
    }
  });

  // GET /api/stands/:id/ai/inventory-forecast - Get inventory forecast
  app.get('/api/stands/:id/ai/inventory-forecast', async (req, res) => {
    try {
      const forecast = await standAIManager.getInventoryForecast(req.params.id);
      res.json(forecast);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to generate inventory forecast');
      res.status(500).json({ error: 'Failed to generate inventory forecast', details: error.message });
    }
  });

  // GET /api/stands/:id/ai/sales-forecast - Get sales forecast
  app.get('/api/stands/:id/ai/sales-forecast', async (req, res) => {
    try {
      const forecast = await standAIManager.getSalesForecast(req.params.id);
      res.json(forecast);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to generate sales forecast');
      res.status(500).json({ error: 'Failed to generate sales forecast', details: error.message });
    }
  });

  // GET /api/stands/:id/ai/contract-advisory - Get contract advisory
  app.get('/api/stands/:id/ai/contract-advisory', async (req, res) => {
    try {
      const advisory = await standAIManager.getContractAdvisory(req.params.id);
      res.json(advisory);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to generate contract advisory');
      res.status(500).json({ error: 'Failed to generate contract advisory', details: error.message });
    }
  });

  // GET /api/stands/:id/ai/risk-assessment - Get risk assessment
  app.get('/api/stands/:id/ai/risk-assessment', async (req, res) => {
    try {
      const assessment = await standAIManager.getRiskAssessment(req.params.id);
      res.json(assessment);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to generate risk assessment');
      res.status(500).json({ error: 'Failed to generate risk assessment', details: error.message });
    }
  });

  // POST /api/stands/:id/ai/outreach - Generate outreach recommendations
  app.post('/api/stands/:id/ai/outreach', async (req, res) => {
    try {
      const { purpose, context } = req.body;
      if (!purpose) {
        return res.status(400).json({ error: 'Purpose is required' });
      }
      const recommendation = await standAIManager.getOutreachRecommendation(
        req.params.id,
        purpose,
        context
      );
      res.json(recommendation);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to generate outreach recommendation');
      res.status(500).json({ error: 'Failed to generate outreach recommendation', details: error.message });
    }
  });

  logger.info('Stand Center routes registered successfully');
}
