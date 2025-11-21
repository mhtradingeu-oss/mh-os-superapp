/**
 * Advanced Partner Systems API Routes
 * Partner Programs, Loyalty, Gifts, and Policies
 */

import { Router } from 'express';
import { partnerProgramManager } from '../lib/partner-programs';
import { loyaltyEngine } from '../lib/loyalty-engine';
import { giftsManager } from '../lib/gifts-manager';
import { policyEngine } from '../lib/policy-engine';
import { createLogger } from '../lib/logger';

const router = Router();
const logger = createLogger('AdvancedPartnerRoutes');

// ==================== PARTNER PROGRAMS ====================

router.get('/partner-programs', async (req, res) => {
  try {
    const { type } = req.query;
    
    if (type) {
      const programs = await partnerProgramManager.getProgramsByType(type as any);
      res.json(programs);
    } else {
      const programs = await partnerProgramManager.getAllPrograms();
      res.json(programs);
    }
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to get partner programs');
    res.status(500).json({ error: error.message });
  }
});

router.get('/partner-programs/:programId', async (req, res) => {
  try {
    const { programId } = req.params;
    const program = await partnerProgramManager.getProgram(programId);
    
    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }
    
    res.json(program);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to get program');
    res.status(500).json({ error: error.message });
  }
});

router.post('/partner-programs', async (req, res) => {
  try {
    const program = await partnerProgramManager.createProgram(req.body);
    res.status(201).json(program);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to create program');
    res.status(400).json({ error: error.message });
  }
});

router.put('/partner-programs/:programId', async (req, res) => {
  try {
    const { programId } = req.params;
    const success = await partnerProgramManager.updateProgram(programId, req.body);
    
    if (!success) {
      return res.status(404).json({ error: 'Program not found or update failed' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to update program');
    res.status(400).json({ error: error.message });
  }
});

router.post('/partner-programs/:programId/calculate-commission', async (req, res) => {
  try {
    const { programId } = req.params;
    const { orderValue, orderQty, monthlyRevenue } = req.body;
    
    const commission = await partnerProgramManager.calculateCommission(
      programId,
      orderValue,
      orderQty,
      monthlyRevenue
    );
    
    res.json(commission);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to calculate commission');
    res.status(400).json({ error: error.message });
  }
});

router.post('/partner-programs/:programId/validate-order', async (req, res) => {
  try {
    const { programId } = req.params;
    const { orderValue, orderQty, partnerID } = req.body;
    
    const validation = await partnerProgramManager.validateOrder(
      programId,
      orderValue,
      orderQty,
      partnerID
    );
    
    res.json(validation);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to validate order');
    res.status(400).json({ error: error.message });
  }
});

// ==================== LOYALTY SYSTEM ====================

router.get('/loyalty/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { programId } = req.query;
    
    const loyalty = await loyaltyEngine.getCustomerLoyalty(
      customerId,
      programId as string
    );
    
    if (!loyalty) {
      return res.status(404).json({ error: 'Customer loyalty not found' });
    }
    
    res.json(loyalty);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to get customer loyalty');
    res.status(500).json({ error: error.message });
  }
});

router.post('/loyalty/calculate-points', async (req, res) => {
  try {
    const { customerId, orderValue, orderCategories, programId } = req.body;
    
    const points = await loyaltyEngine.calculatePointsEarned(
      customerId,
      orderValue,
      orderCategories,
      programId
    );
    
    res.json(points);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to calculate points');
    res.status(400).json({ error: error.message });
  }
});

router.post('/loyalty/earn-points', async (req, res) => {
  try {
    const { customerId, points, orderID, description, programId } = req.body;
    
    const success = await loyaltyEngine.addPoints(
      customerId,
      points,
      orderID,
      description,
      programId
    );
    
    res.json({ success });
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to earn points');
    res.status(400).json({ error: error.message });
  }
});

router.post('/loyalty/redeem-points', async (req, res) => {
  try {
    const { customerId, pointsToRedeem, orderValue, programId } = req.body;
    
    const result = await loyaltyEngine.redeemPoints(
      customerId,
      pointsToRedeem,
      orderValue,
      programId
    );
    
    res.json(result);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to redeem points');
    res.status(400).json({ error: error.message });
  }
});

router.get('/loyalty/program/:programId', async (req, res) => {
  try {
    const { programId } = req.params;
    const program = await loyaltyEngine.getProgram(programId);
    
    if (!program) {
      return res.status(404).json({ error: 'Loyalty program not found' });
    }
    
    res.json(program);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to get loyalty program');
    res.status(500).json({ error: error.message });
  }
});

// ==================== GIFTS SYSTEM ====================

router.get('/gifts', async (req, res) => {
  try {
    const { active } = req.query;
    
    if (active === 'true') {
      const gifts = await giftsManager.getActiveGifts();
      res.json(gifts);
    } else {
      const gifts = await giftsManager.getAllGifts();
      res.json(gifts);
    }
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to get gifts');
    res.status(500).json({ error: error.message });
  }
});

router.get('/gifts/:giftId', async (req, res) => {
  try {
    const { giftId } = req.params;
    const gift = await giftsManager.getGift(giftId);
    
    if (!gift) {
      return res.status(404).json({ error: 'Gift not found' });
    }
    
    res.json(gift);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to get gift');
    res.status(500).json({ error: error.message });
  }
});

router.post('/gifts/eligible', async (req, res) => {
  try {
    const { orderValue, customerPoints, currentSeason } = req.body;
    
    const eligible = await giftsManager.getEligibleGifts(
      orderValue,
      customerPoints,
      currentSeason
    );
    
    res.json(eligible);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to get eligible gifts');
    res.status(400).json({ error: error.message });
  }
});

router.post('/gifts/add-to-order', async (req, res) => {
  try {
    const { orderID, giftID, quantity, pointsRedeemed } = req.body;
    
    const orderGift = await giftsManager.addGiftToOrder(
      orderID,
      giftID,
      quantity,
      pointsRedeemed
    );
    
    if (!orderGift) {
      return res.status(400).json({ error: 'Failed to add gift to order' });
    }
    
    res.status(201).json(orderGift);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to add gift to order');
    res.status(400).json({ error: error.message });
  }
});

router.post('/gifts/auto-add', async (req, res) => {
  try {
    const { orderID, orderValue, currentSeason } = req.body;
    
    const gifts = await giftsManager.autoAddGiftsToOrder(
      orderID,
      orderValue,
      currentSeason
    );
    
    res.json({ gifts, count: gifts.length });
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to auto-add gifts');
    res.status(400).json({ error: error.message });
  }
});

router.get('/gifts/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const gifts = await giftsManager.getOrderGifts(orderId);
    res.json(gifts);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to get order gifts');
    res.status(500).json({ error: error.message });
  }
});

router.post('/gifts', async (req, res) => {
  try {
    const gift = await giftsManager.createGift(req.body);
    res.status(201).json(gift);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to create gift');
    res.status(400).json({ error: error.message });
  }
});

router.put('/gifts/:giftId', async (req, res) => {
  try {
    const { giftId } = req.params;
    const success = await giftsManager.updateGift(giftId, req.body);
    
    if (!success) {
      return res.status(404).json({ error: 'Gift not found or update failed' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to update gift');
    res.status(400).json({ error: error.message });
  }
});

// ==================== POLICIES ====================

router.get('/policies/partner/:partnerId', async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { standId } = req.query;
    
    const policy = await policyEngine.getPartnerPolicy(
      partnerId,
      standId as string | undefined
    );
    
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    res.json(policy);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to get policy');
    res.status(500).json({ error: error.message });
  }
});

router.post('/policies', async (req, res) => {
  try {
    const policy = await policyEngine.createPolicy(req.body);
    res.status(201).json(policy);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to create policy');
    res.status(400).json({ error: error.message });
  }
});

router.put('/policies/:policyId', async (req, res) => {
  try {
    const { policyId } = req.params;
    const success = await policyEngine.updatePolicy(policyId, req.body);
    
    if (!success) {
      return res.status(404).json({ error: 'Policy not found or update failed' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to update policy');
    res.status(400).json({ error: error.message });
  }
});

router.post('/policies/validate-inventory', async (req, res) => {
  try {
    const { partnerId, currentInventoryValue, newOrderValue, productCategories, standId } = req.body;
    
    const validation = await policyEngine.validateInventory(
      partnerId,
      currentInventoryValue,
      newOrderValue,
      productCategories,
      standId
    );
    
    res.json(validation);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to validate inventory');
    res.status(400).json({ error: error.message });
  }
});

router.post('/policies/validate-discount', async (req, res) => {
  try {
    const { partnerId, discountPct, orderValue, standId } = req.body;
    
    const approval = await policyEngine.validateDiscount(
      partnerId,
      discountPct,
      orderValue,
      standId
    );
    
    res.json(approval);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to validate discount');
    res.status(400).json({ error: error.message });
  }
});

router.post('/policies/validate-return', async (req, res) => {
  try {
    const { partnerId, orderDate, standId } = req.body;
    
    const validation = await policyEngine.validateReturn(
      partnerId,
      new Date(orderDate),
      standId
    );
    
    res.json(validation);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to validate return');
    res.status(400).json({ error: error.message });
  }
});

router.post('/policies/check-credit', async (req, res) => {
  try {
    const { partnerId, currentOutstanding, newOrderValue, standId } = req.body;
    
    const validation = await policyEngine.checkCreditLimit(
      partnerId,
      currentOutstanding,
      newOrderValue,
      standId
    );
    
    res.json(validation);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to check credit limit');
    res.status(400).json({ error: error.message });
  }
});

export default router;
