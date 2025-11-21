import { describe, it, expect } from '@jest/globals';
import {
  calculateBaseCommission,
  calculateFinalCommission,
  isMonthlyTargetMet,
  calculateCommission,
  COMMISSION_RATES,
  MONTHLY_TARGETS,
  TARGET_MULTIPLIER,
  type CommissionCalculationInput,
} from '../lib/commission-engine';

describe('Commission Engine', () => {
  describe('calculateBaseCommission', () => {
    it('should calculate 7% commission for Stand tier', () => {
      const result = calculateBaseCommission(1000, 'Stand');
      expect(result).toBe(70);
    });

    it('should calculate 5% commission for Basic tier', () => {
      const result = calculateBaseCommission(1000, 'Basic');
      expect(result).toBe(50);
    });

    it('should calculate 4% commission for Plus tier', () => {
      const result = calculateBaseCommission(1000, 'Plus');
      expect(result).toBe(40);
    });

    it('should calculate 3% commission for Distributor tier', () => {
      const result = calculateBaseCommission(1000, 'Distributor');
      expect(result).toBe(30);
    });

    it('should default to Basic tier (5%) for unknown tier', () => {
      const result = calculateBaseCommission(1000, 'UnknownTier');
      expect(result).toBe(50);
    });
  });

  describe('isMonthlyTargetMet', () => {
    it('should return true when revenue target is met', () => {
      const result = isMonthlyTargetMet(50000, 10);
      expect(result).toBe(true);
    });

    it('should return true when deals target is met', () => {
      const result = isMonthlyTargetMet(30000, 20);
      expect(result).toBe(true);
    });

    it('should return true when both targets are met', () => {
      const result = isMonthlyTargetMet(55000, 25);
      expect(result).toBe(true);
    });

    it('should return false when neither target is met', () => {
      const result = isMonthlyTargetMet(40000, 15);
      expect(result).toBe(false);
    });
  });

  describe('calculateFinalCommission', () => {
    it('should apply 1.2x multiplier when target is met', () => {
      const result = calculateFinalCommission(100, true);
      expect(result).toBe(120);
    });

    it('should not apply multiplier when target is not met', () => {
      const result = calculateFinalCommission(100, false);
      expect(result).toBe(100);
    });
  });

  describe('calculateCommission - Full Integration', () => {
    it('Test 1: Basic commission calculation without target multiplier', () => {
      const input: CommissionCalculationInput = {
        quoteId: 'QUO-TEST-001',
        partnerId: 'PARTNER-001',
        partnerTier: 'Stand',
        netAmount: 1000,
        repId: 'REP-001',
        status: 'confirmed',
        monthlyRevenue: 30000, // Below target
        monthlyDeals: 15,      // Below target
      };

      const result = calculateCommission(input);

      expect(result.netAmount).toBe(1000);
      expect(result.partnerTier).toBe('Stand');
      expect(result.commissionRate).toBe(0.07);
      expect(result.baseCommission).toBe(70);
      expect(result.monthlyTargetMet).toBe(false);
      expect(result.multiplier).toBe(1.0);
      expect(result.finalCommission).toBe(70);
      expect(result.paymentStage).toBe('partial');
      expect(result.amountPayable).toBe(35); // 50% on confirmation
      expect(result.status).toBe('confirmed');
    });

    it('Test 2: Commission with 1.2x target multiplier', () => {
      const input: CommissionCalculationInput = {
        orderId: 'ORD-TEST-002',
        partnerId: 'PARTNER-002',
        partnerTier: 'Basic',
        netAmount: 2000,
        repId: 'REP-002',
        status: 'paid',
        monthlyRevenue: 55000, // Above target!
        monthlyDeals: 18,      // Below target (but revenue is enough)
      };

      const result = calculateCommission(input);

      expect(result.netAmount).toBe(2000);
      expect(result.partnerTier).toBe('Basic');
      expect(result.commissionRate).toBe(0.05);
      expect(result.baseCommission).toBe(100);
      expect(result.monthlyTargetMet).toBe(true);
      expect(result.multiplier).toBe(1.2);
      expect(result.finalCommission).toBe(120); // 100 * 1.2
      expect(result.paymentStage).toBe('full');
      expect(result.amountPayable).toBe(120); // 100% on payment
      expect(result.status).toBe('paid');
    });

    it('Test 3: Plus tier with target met by deals count', () => {
      const input: CommissionCalculationInput = {
        quoteId: 'QUO-TEST-003',
        partnerId: 'PARTNER-003',
        partnerTier: 'Plus',
        netAmount: 1500,
        repId: 'REP-003',
        status: 'pending',
        monthlyRevenue: 45000, // Below revenue target
        monthlyDeals: 22,      // Above deals target!
      };

      const result = calculateCommission(input);

      expect(result.netAmount).toBe(1500);
      expect(result.partnerTier).toBe('Plus');
      expect(result.commissionRate).toBe(0.04);
      expect(result.baseCommission).toBe(60);
      expect(result.monthlyTargetMet).toBe(true);
      expect(result.multiplier).toBe(1.2);
      expect(result.finalCommission).toBe(72); // 60 * 1.2
      expect(result.paymentStage).toBe('none');
      expect(result.amountPayable).toBe(0); // Nothing payable on pending
      expect(result.status).toBe('pending');
    });

    it('Test 4: Distributor tier without target', () => {
      const input: CommissionCalculationInput = {
        orderId: 'ORD-TEST-004',
        partnerId: 'PARTNER-004',
        partnerTier: 'Distributor',
        netAmount: 5000,
        repId: 'REP-004',
        status: 'confirmed',
        monthlyRevenue: 48000, // Close but below
        monthlyDeals: 19,      // Close but below
      };

      const result = calculateCommission(input);

      expect(result.netAmount).toBe(5000);
      expect(result.partnerTier).toBe('Distributor');
      expect(result.commissionRate).toBe(0.03);
      expect(result.baseCommission).toBe(150);
      expect(result.monthlyTargetMet).toBe(false);
      expect(result.multiplier).toBe(1.0);
      expect(result.finalCommission).toBe(150);
      expect(result.paymentStage).toBe('partial');
      expect(result.amountPayable).toBe(75); // 50% on confirmation
    });

    it('Test 5: Large order with target multiplier', () => {
      const input: CommissionCalculationInput = {
        orderId: 'ORD-TEST-005',
        partnerId: 'PARTNER-005',
        partnerTier: 'Stand',
        netAmount: 10000,
        repId: 'REP-005',
        status: 'paid',
        monthlyRevenue: 75000, // Way above target!
        monthlyDeals: 30,      // Way above target!
      };

      const result = calculateCommission(input);

      expect(result.netAmount).toBe(10000);
      expect(result.partnerTier).toBe('Stand');
      expect(result.commissionRate).toBe(0.07);
      expect(result.baseCommission).toBe(700);
      expect(result.monthlyTargetMet).toBe(true);
      expect(result.multiplier).toBe(1.2);
      expect(result.finalCommission).toBe(840); // 700 * 1.2
      expect(result.paymentStage).toBe('full');
      expect(result.amountPayable).toBe(840); // 100% on payment
    });
  });

  describe('Commission Rates Constants', () => {
    it('should have correct tier rates', () => {
      expect(COMMISSION_RATES.Stand).toBe(0.07);
      expect(COMMISSION_RATES.Basic).toBe(0.05);
      expect(COMMISSION_RATES.Plus).toBe(0.04);
      expect(COMMISSION_RATES.Distributor).toBe(0.03);
    });

    it('should have correct monthly targets', () => {
      expect(MONTHLY_TARGETS.revenue).toBe(50000);
      expect(MONTHLY_TARGETS.deals).toBe(20);
    });

    it('should have correct multiplier', () => {
      expect(TARGET_MULTIPLIER).toBe(1.2);
    });
  });
});
