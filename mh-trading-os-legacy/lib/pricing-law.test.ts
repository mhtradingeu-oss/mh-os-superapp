/**
 * Unit tests for Pricing Law v2 Engine
 * @module pricing-law.test
 * 
 * ⚠️ NOTE: This test file tests pricing-law.ts (legacy pricing library)
 * 
 * PRODUCTION LIBRARY: pricing-engine-hairoticmen.ts
 * - Used by: pricing-master.ts, reprice-orchestrator.ts
 * - API: calculateHAIROTICMENPricing(product, context) → full breakdown
 * - Status: ✅ Active, correct Grundpreis (with VAT)
 * 
 * THIS LIBRARY: pricing-law.ts (legacy)
 * - Used by: migrate-pricing-law.ts (migration script only)
 * - API: Individual helper functions (calculateFullCost, calculateUVP, etc.)
 * - Status: ⚠️ Legacy - kept for migration compatibility
 * 
 * TODO: Consolidate libraries and port these comprehensive tests to test
 *       pricing-engine-hairoticmen.ts instead of pricing-law.ts
 */

import { describe, it, expect } from '@jest/globals';
import {
  calculateFullCost,
  validateFullCostFields,
  calculateFullCostWithDefaults,
  calculateUVP,
  calculateGrundpreis,
  calculateChannelCosts,
  checkGuardrail,
  enforceMAP,
  applyLineTargets,
  calculateB2BDiscount,
  type FullCostBreakdown,
  type PricingLawContext
} from './pricing-law';
import type { FinalPriceList } from '@shared/schema';

describe('Pricing Law v2 - FullCost Calculation', () => {
  describe('calculateFullCost', () => {
    it('should calculate FullCost with all 8 components', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-001',
        Factory_Cost_EUR: 8.50,
        Packaging_Cost_EUR: 0.80,
        Shipping_Inbound_per_unit: 1.20,
        EPR_LUCID_per_unit: 0.15,
        GS1_per_unit: 0.05,
        Retail_Packaging_per_unit: 0.50,
        QC_PIF_per_unit: 0.30,
        Operations_per_unit: 1.50,
        Marketing_per_unit: 0.80
      };

      const result = calculateFullCost(product as FinalPriceList);

      expect(result.factoryCost).toBe(8.50);
      expect(result.packagingCost).toBe(0.80);
      expect(result.shippingInbound).toBe(1.20);
      expect(result.eprLucid).toBe(0.15);
      expect(result.gs1).toBe(0.05);
      expect(result.retailPackaging).toBe(0.50);
      expect(result.qcPif).toBe(0.30);
      expect(result.operations).toBe(1.50);
      expect(result.marketing).toBe(0.80);
      expect(result.fullCostEUR).toBe(13.80);
    });

    it('should handle zero costs', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-ZERO',
        Factory_Cost_EUR: 0,
        Packaging_Cost_EUR: 0,
        Shipping_Inbound_per_unit: 0,
        EPR_LUCID_per_unit: 0,
        GS1_per_unit: 0,
        Retail_Packaging_per_unit: 0,
        QC_PIF_per_unit: 0,
        Operations_per_unit: 0,
        Marketing_per_unit: 0
      };

      const result = calculateFullCost(product as FinalPriceList);

      expect(result.fullCostEUR).toBe(0);
    });

    it('should handle undefined fields as zero', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-PARTIAL',
        Factory_Cost_EUR: 5.00
        // All other fields undefined
      };

      const result = calculateFullCost(product as FinalPriceList);

      expect(result.factoryCost).toBe(5.00);
      expect(result.packagingCost).toBe(0);
      expect(result.fullCostEUR).toBe(5.00);
    });

    it('should preserve explicit zero values (nullish coalescing)', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-EXPLICIT-ZEROS',
        Factory_Cost_EUR: 5.00,
        Packaging_Cost_EUR: 0, // Explicit zero - must be preserved
        Shipping_Inbound_per_unit: 0, // Explicit zero - must be preserved
        EPR_LUCID_per_unit: 0.15,
        GS1_per_unit: 0, // Explicit zero
        Retail_Packaging_per_unit: 0.20,
        QC_PIF_per_unit: 0, // Explicit zero
        Operations_per_unit: 1.00,
        Marketing_per_unit: 0 // Explicit zero
      };

      const result = calculateFullCost(product as FinalPriceList);

      // All explicit zeros must be preserved, not replaced
      expect(result.packagingCost).toBe(0);
      expect(result.shippingInbound).toBe(0);
      expect(result.gs1).toBe(0);
      expect(result.qcPif).toBe(0);
      expect(result.marketing).toBe(0);
      
      // Non-zero values should also be preserved
      expect(result.factoryCost).toBe(5.00);
      expect(result.eprLucid).toBe(0.15);
      expect(result.retailPackaging).toBe(0.20);
      expect(result.operations).toBe(1.00);
      
      // Total: 5.00 + 0.15 + 0.20 + 1.00 = 6.35
      expect(result.fullCostEUR).toBe(6.35);
    });

    it('should round to 2 decimal places', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-ROUNDING',
        Factory_Cost_EUR: 1.111,
        Packaging_Cost_EUR: 0.222,
        Shipping_Inbound_per_unit: 0.333,
        EPR_LUCID_per_unit: 0.444,
        GS1_per_unit: 0.555,
        Retail_Packaging_per_unit: 0.666,
        QC_PIF_per_unit: 0.777,
        Operations_per_unit: 0.888,
        Marketing_per_unit: 0.999
      };

      const result = calculateFullCost(product as FinalPriceList);

      // Sum: 5.995 → rounded to 6.00
      expect(result.fullCostEUR).toBe(6.00);
    });
  });

  describe('validateFullCostFields', () => {
    it('should return empty array when all fields present', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-COMPLETE',
        Factory_Cost_EUR: 8.50,
        Packaging_Cost_EUR: 0.80,
        Shipping_Inbound_per_unit: 1.20,
        EPR_LUCID_per_unit: 0.15,
        GS1_per_unit: 0.05,
        Retail_Packaging_per_unit: 0.50,
        QC_PIF_per_unit: 0.30,
        Operations_per_unit: 1.50,
        Marketing_per_unit: 0.80
      };

      const missing = validateFullCostFields(product as FinalPriceList);

      expect(missing).toEqual([]);
    });

    it('should detect missing fields', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-INCOMPLETE',
        Factory_Cost_EUR: 8.50,
        Packaging_Cost_EUR: 0.80
        // Missing 7 fields
      };

      const missing = validateFullCostFields(product as FinalPriceList);

      expect(missing.length).toBe(7);
      expect(missing).toContain('Shipping_Inbound_per_unit');
      expect(missing).toContain('EPR_LUCID_per_unit');
      expect(missing).toContain('GS1_per_unit');
      expect(missing).toContain('Retail_Packaging_per_unit');
      expect(missing).toContain('QC_PIF_per_unit');
      expect(missing).toContain('Operations_per_unit');
      expect(missing).toContain('Marketing_per_unit');
    });

    it('should detect null fields as missing', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-NULL',
        Factory_Cost_EUR: null as any,
        Packaging_Cost_EUR: 0.80,
        Shipping_Inbound_per_unit: 1.20,
        EPR_LUCID_per_unit: 0.15,
        GS1_per_unit: 0.05,
        Retail_Packaging_per_unit: 0.50,
        QC_PIF_per_unit: 0.30,
        Operations_per_unit: 1.50,
        Marketing_per_unit: 0.80
      };

      const missing = validateFullCostFields(product as FinalPriceList);

      expect(missing).toEqual(['Factory_Cost_EUR']);
    });
  });

  describe('calculateFullCostWithDefaults', () => {
    it('should use v2 fields when all present', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-V2',
        Factory_Cost_EUR: 8.50,
        Packaging_Cost_EUR: 0.80,
        Shipping_Inbound_per_unit: 1.20,
        EPR_LUCID_per_unit: 0.15,
        GS1_per_unit: 0.05,
        Retail_Packaging_per_unit: 0.50,
        QC_PIF_per_unit: 0.30,
        Operations_per_unit: 1.50,
        Marketing_per_unit: 0.80
      };

      const result = calculateFullCostWithDefaults(product as FinalPriceList);

      expect(result.fullCostEUR).toBe(13.80);
    });

    it('should estimate from legacy COGS_EUR when v2 fields missing', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-LEGACY',
        COGS_EUR: 10.00
        // All v2 fields missing
      };

      const result = calculateFullCostWithDefaults(product as FinalPriceList);

      // Should allocate 10.00 COGS across components + ~20% overhead = ~12.00
      expect(result.fullCostEUR).toBeGreaterThan(10.00);
      expect(result.fullCostEUR).toBeLessThan(13.00);
      
      // Verify allocation percentages (70% factory, 8% packaging, etc.)
      expect(result.factoryCost).toBeCloseTo(7.00, 1);
      expect(result.packagingCost).toBeCloseTo(0.80, 1);
    });

    it('should use explicit legacy COGS parameter', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-EXPLICIT-COGS',
        COGS_EUR: 10.00
      };

      const legacyCOGS = 15.00;
      const result = calculateFullCostWithDefaults(product as FinalPriceList, legacyCOGS);

      // Should use 15.00 not 10.00
      expect(result.fullCostEUR).toBeGreaterThan(15.00);
      expect(result.factoryCost).toBeCloseTo(10.50, 1); // 70% of 15.00
    });

    it('should handle zero COGS gracefully', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-ZERO-COGS',
        COGS_EUR: 0
      };

      const result = calculateFullCostWithDefaults(product as FinalPriceList);

      expect(result.fullCostEUR).toBe(0);
    });

    it('should preserve explicitly set v2 fields and estimate missing ones', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-MIXED',
        Factory_Cost_EUR: 8.50,
        Packaging_Cost_EUR: 0.80,
        // Missing 7 fields
        COGS_EUR: 10.00
      };

      const result = calculateFullCostWithDefaults(product as FinalPriceList);

      // Should keep Factory_Cost_EUR and Packaging_Cost_EUR
      expect(result.factoryCost).toBe(8.50);
      expect(result.packagingCost).toBe(0.80);
      
      // Should estimate remaining fields from COGS
      expect(result.shippingInbound).toBeGreaterThan(0);
      expect(result.operations).toBeGreaterThan(0);
    });

    it('should preserve explicit zero values in v2 fields (nullish coalescing fix)', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-ZERO-VALUES',
        Factory_Cost_EUR: 8.00,
        Packaging_Cost_EUR: 0, // Explicit zero - should NOT be replaced
        Shipping_Inbound_per_unit: 0, // Explicit zero
        EPR_LUCID_per_unit: 0.15,
        // Missing: GS1, Retail_Packaging, QC_PIF, Operations, Marketing
        COGS_EUR: 10.00
      };

      const result = calculateFullCostWithDefaults(product as FinalPriceList);

      // Explicit zeros should be preserved, NOT replaced with estimates
      expect(result.packagingCost).toBe(0);
      expect(result.shippingInbound).toBe(0);
      
      // Explicitly set non-zero values should be preserved
      expect(result.factoryCost).toBe(8.00);
      expect(result.eprLucid).toBe(0.15);
      
      // Missing fields should be estimated from COGS
      expect(result.gs1).toBeCloseTo(0.10, 2); // 1% of 10.00
      expect(result.operations).toBeCloseTo(1.20, 2); // 12% of 10.00
    });

    it('should handle legacyCOGS = 0 explicitly', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'TEST-LEGACY-ZERO',
        // All v2 fields missing, COGS_EUR also missing
      };

      const result = calculateFullCostWithDefaults(product as FinalPriceList, 0);

      // With legacyCOGS = 0, all estimates should be 0
      expect(result.fullCostEUR).toBe(0);
      expect(result.factoryCost).toBe(0);
      expect(result.operations).toBe(0);
    });
  });

  describe('Real-world examples', () => {
    it('should calculate FullCost for Premium beard care kit', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'HM-BC-K-50-001',
        Name: 'HAIROTICMEN Bartpflege‑Set Premium',
        Weight_g: 595,
        Factory_Cost_EUR: 8.50,
        Packaging_Cost_EUR: 0.80,
        Shipping_Inbound_per_unit: 1.20,
        EPR_LUCID_per_unit: 0.15,
        GS1_per_unit: 0.05,
        Retail_Packaging_per_unit: 0.50,
        QC_PIF_per_unit: 0.30,
        Operations_per_unit: 1.50,
        Marketing_per_unit: 0.80
      };

      const result = calculateFullCost(product as FinalPriceList);

      expect(result.fullCostEUR).toBe(13.80);
      
      // With 50% margin: UVP should be ~€27.60 (before rounding to €27.49)
      const uvp50 = result.fullCostEUR / (1 - 0.50);
      expect(uvp50).toBeCloseTo(27.60, 1);
    });

    it('should calculate FullCost for light beard oil product', () => {
      const product: Partial<FinalPriceList> = {
        SKU: 'HM-BC-BO-50-003',
        Name: 'HAIROTICMEN Bartöl 50ml',
        Weight_g: 80,
        Factory_Cost_EUR: 3.20,
        Packaging_Cost_EUR: 0.40,
        Shipping_Inbound_per_unit: 0.50,
        EPR_LUCID_per_unit: 0.08,
        GS1_per_unit: 0.05,
        Retail_Packaging_per_unit: 0.30,
        QC_PIF_per_unit: 0.20,
        Operations_per_unit: 0.80,
        Marketing_per_unit: 0.50
      };

      const result = calculateFullCost(product as FinalPriceList);

      expect(result.fullCostEUR).toBe(6.03);
      
      // With 48% margin (Basic line): UVP should be ~€11.60 (before rounding to €11.49)
      const uvp48 = result.fullCostEUR / (1 - 0.48);
      expect(uvp48).toBeCloseTo(11.60, 1);
    });
  });

  describe('calculateUVP', () => {
    it('should calculate UVP with precise rounding (default)', () => {
      const uvp = calculateUVP(13.80, 50);
      expect(uvp).toBe(27.60);
    });

    it('should calculate UVP with x99 rounding', () => {
      const uvp = calculateUVP(13.80, 50, 'x99');
      expect(uvp).toBe(27.99);
    });

    it('should calculate UVP with x95 rounding', () => {
      const uvp = calculateUVP(13.80, 50, 'x95');
      expect(uvp).toBe(27.95);
    });

    it('should handle 45% margin (guardrail minimum)', () => {
      const fullCost = 10.00;
      const uvp = calculateUVP(fullCost, 45);
      // 10 / (1 - 0.45) = 10 / 0.55 = 18.18
      expect(uvp).toBeCloseTo(18.18, 2);
    });

    it('should handle 0% margin (cost = uvp)', () => {
      const uvp = calculateUVP(10.00, 0);
      expect(uvp).toBe(10.00);
    });

    it('should return 0 for invalid inputs', () => {
      expect(calculateUVP(-5, 50)).toBe(0);
      expect(calculateUVP(10, -10)).toBe(0);
      expect(calculateUVP(10, 100)).toBe(0); // 100% margin is impossible
      expect(calculateUVP(10, 150)).toBe(0);
    });

    it('should round to nearest cent precisely', () => {
      const uvp = calculateUVP(10.333, 50);
      // 10.333 / 0.5 = 20.666 → rounds to 20.67
      expect(uvp).toBe(20.67);
    });
  });

  describe('calculateGrundpreis', () => {
    describe('Liquid products (L)', () => {
      it('should calculate Grundpreis for 50ml beard oil', () => {
        const product = {
          Content_ml: 50,
          Grundpreis_Unit: 'L' as const
        };
        
        const result = calculateGrundpreis(32.99, product);
        
        expect(result.isValid).toBe(true);
        expect(result.pangvApplies).toBe(true);
        expect(result.grundpreisUnit).toBe('L');
        // 32.99 / 0.05L = 659.80
        expect(result.grundpreis).toBe(659.80);
      });

      it('should calculate Grundpreis for 100ml shampoo', () => {
        const product = {
          Content_ml: 100,
          Grundpreis_Unit: 'L' as const
        };
        
        const result = calculateGrundpreis(15.99, product);
        
        expect(result.isValid).toBe(true);
        // 15.99 / 0.1L = 159.90
        expect(result.grundpreis).toBe(159.90);
      });

      it('should fail if Content_ml is missing for liquid', () => {
        const product = {
          Grundpreis_Unit: 'L' as const
        };
        
        const result = calculateGrundpreis(32.99, product);
        
        expect(result.isValid).toBe(false);
        expect(result.pangvApplies).toBe(true);
        expect(result.validationError).toContain('Content_ml must be specified');
      });

      it('should fail if Content_ml is zero', () => {
        const product = {
          Content_ml: 0,
          Grundpreis_Unit: 'L' as const
        };
        
        const result = calculateGrundpreis(32.99, product);
        
        expect(result.isValid).toBe(false);
        expect(result.validationError).toContain('Content_ml must be specified');
      });
    });

    describe('Solid products (kg)', () => {
      it('should calculate Grundpreis for 100g cream', () => {
        const product = {
          Weight_g: 100,
          Grundpreis_Unit: 'kg' as const
        };
        
        const result = calculateGrundpreis(12.53, product);
        
        expect(result.isValid).toBe(true);
        expect(result.pangvApplies).toBe(true);
        expect(result.grundpreisUnit).toBe('kg');
        // 12.53 / 0.1kg = 125.30
        expect(result.grundpreis).toBe(125.30);
      });

      it('should calculate Grundpreis for 250g product', () => {
        const product = {
          Weight_g: 250,
          Grundpreis_Unit: 'kg' as const
        };
        
        const result = calculateGrundpreis(22.50, product);
        
        expect(result.isValid).toBe(true);
        // 22.50 / 0.25kg = 90.00
        expect(result.grundpreis).toBe(90.00);
      });

      it('should fail if Weight_g is missing for solid', () => {
        const product = {
          Grundpreis_Unit: 'kg' as const
        };
        
        const result = calculateGrundpreis(12.53, product);
        
        expect(result.isValid).toBe(false);
        expect(result.pangvApplies).toBe(true);
        expect(result.validationError).toContain('Weight_g must be specified');
      });
    });

    describe('Edge cases', () => {
      it('should pass if no Grundpreis_Unit specified (PAngV not applicable)', () => {
        const product = {};
        
        const result = calculateGrundpreis(25.00, product);
        
        expect(result.isValid).toBe(true);
        expect(result.pangvApplies).toBe(false);
        expect(result.grundpreis).toBe(0);
      });

      it('should fail if UVP is zero', () => {
        const product = {
          Content_ml: 50,
          Grundpreis_Unit: 'L' as const
        };
        
        const result = calculateGrundpreis(0, product);
        
        expect(result.isValid).toBe(false);
        expect(result.validationError).toContain('UVP must be greater than 0');
      });

      it('should fail if UVP is negative', () => {
        const product = {
          Content_ml: 50,
          Grundpreis_Unit: 'L' as const
        };
        
        const result = calculateGrundpreis(-10, product);
        
        expect(result.isValid).toBe(false);
      });

      it('should round Grundpreis to 2 decimal places', () => {
        const product = {
          Content_ml: 33, // Odd number
          Grundpreis_Unit: 'L' as const
        };
        
        const result = calculateGrundpreis(10.00, product);
        
        // 10 / 0.033L = 303.030303... → rounds to 303.03
        expect(result.grundpreis).toBe(303.03);
      });

      it('should handle unsupported units gracefully (future expansion)', () => {
        const product = {
          Content_ml: 50,
          Weight_g: 45,
          Grundpreis_Unit: '100ml' as any // Testing future unit expansion
        };
        
        const result = calculateGrundpreis(32.99, product);
        
        // Unsupported units should not apply PAngV, not throw errors
        expect(result.isValid).toBe(true);
        expect(result.pangvApplies).toBe(false);
        expect(result.grundpreis).toBe(0);
      });

      it('should handle products sold per piece (no PAngV)', () => {
        const product = {
          Weight_g: 45,
          // No Grundpreis_Unit specified (sold per piece)
        };
        
        const result = calculateGrundpreis(15.99, product);
        
        expect(result.isValid).toBe(true);
        expect(result.pangvApplies).toBe(false);
        expect(result.grundpreis).toBe(0);
      });
    });

    describe('Real-world examples', () => {
      it('should calculate Grundpreis for HAIROTICMEN Bartöl Premium 50ml', () => {
        const product: Partial<FinalPriceList> = {
          SKU: 'HM-BO-P-50-001',
          Name: 'HAIROTICMEN Bartöl Premium 50ml',
          Content_ml: 50,
          Grundpreis_Unit: 'L',
          UVP: 32.99
        };
        
        const result = calculateGrundpreis(product.UVP!, product);
        
        expect(result.isValid).toBe(true);
        expect(result.grundpreis).toBe(659.80);
        expect(result.grundpreisUnit).toBe('L');
      });

      it('should integrate with calculateUVP for complete pricing', () => {
        // Calculate UVP from FullCost
        const fullCost = 13.80;
        const uvp = calculateUVP(fullCost, 50);
        expect(uvp).toBe(27.60);
        
        // Then calculate Grundpreis
        const product = {
          Content_ml: 50,
          Grundpreis_Unit: 'L' as const
        };
        
        const grundpreisResult = calculateGrundpreis(uvp, product);
        expect(grundpreisResult.isValid).toBe(true);
        // 27.60 / 0.05L = 552.00
        expect(grundpreisResult.grundpreis).toBe(552.00);
      });
    });
  });

  describe('calculateChannelCosts', () => {
    const mockCtx: PricingLawContext = {
      channels: [
        {
          ChannelID: 'OwnStore',
          ChannelName: 'Own Web Store',
          Active: true,
          Payment_Provider: 'Stripe',
          Payment_Fee_Pct: 1.5,
          Payment_Fee_Fixed_EUR: 0.25,
          Returns_Pct: 2
        },
        {
          ChannelID: 'Amazon_FBA',
          ChannelName: 'Amazon FBA',
          Active: true,
          Payment_Provider: 'Amazon',
          Amazon_Referral_Pct_Low: 8,
          Amazon_Referral_Pct_High: 15,
          Amazon_Referral_Min_EUR: 0.30,
          Returns_Pct: 3
        }
      ] as any,
      amazonTiers: [
        {
          TierKey: 'SMALL_STANDARD',
          TierName: 'Small Standard',
          FBA_Fee_EUR: 2.71,
          FBA_Surcharge_2025_EUR: 0.26
        }
      ] as any,
      shippingMatrix: [
        {
          Zone: 'DE_1',
          Weight_Min_g: 0,
          Weight_Max_g: 500,
          Base_Rate_EUR: 4.99
        }
      ] as any,
      dhlSurcharges: [
        {
          SurchargeKey: 'LKW_CO2',
          SurchargeName: 'LKW CO2 Surcharge',
          Amount_EUR: 0.19
        },
        {
          SurchargeKey: 'Peak',
          SurchargeName: 'Peak Surcharge',
          Amount_EUR: 0.15
        }
      ] as any,
      quantityDiscounts: [],
      discountCaps: [],
      orderDiscounts: [],
      lineTargets: []
    };

    describe('OwnStore channel', () => {
      it('should calculate all costs for OwnStore', () => {
        const product: Partial<FinalPriceList> = {
          SKU: 'TEST-001',
          Weight_g: 350
        };

        const result = calculateChannelCosts(
          product as FinalPriceList,
          'OwnStore',
          27.60,
          mockCtx
        );

        // Payment fee: (27.60 × 1.5%) + 0.25 = 0.414 + 0.25 = 0.664 → 0.66
        expect(result.paymentFee).toBeCloseTo(0.66, 2);

        // DHL shipping: 350g falls in 0-500g band → €4.99
        expect(result.dhlShipping).toBe(4.99);

        // DHL surcharges: 0.19 + 0.15 = 0.34
        expect(result.dhlSurcharges).toBe(0.34);

        // Box cost: €0.50 default
        expect(result.boxCost).toBe(0.50);

        // Returns: 27.60 × 2% = 0.552 → 0.55
        expect(result.returnsCost).toBeCloseTo(0.55, 2);

        // Loyalty: 27.60 × 2% = 0.552 → 0.55
        expect(result.loyaltyCost).toBeCloseTo(0.55, 2);

        // Total should sum all costs
        expect(result.totalChannelCost).toBeGreaterThan(7);
      });
    });

    describe('Amazon FBA channel', () => {
      it('should calculate Amazon FBA costs with low referral fee', () => {
        const product: Partial<FinalPriceList> = {
          SKU: 'TEST-002',
          Weight_g: 250,
          Amazon_TierKey: 'SMALL_STANDARD'
        };

        const result = calculateChannelCosts(
          product as FinalPriceList,
          'Amazon_FBA',
          9.99, // ≤€10 → 8% referral
          mockCtx
        );

        // Amazon referral: 9.99 × 8% = 0.7992 → 0.80
        expect(result.referralFee).toBeCloseTo(0.80, 2);

        // FBA fee: 2.71 + 0.26 = 2.97
        expect(result.fbaFee).toBe(2.97);

        // No DHL shipping for FBA
        expect(result.dhlShipping).toBe(0);

        // Returns: 9.99 × 3% = 0.2997 → 0.30
        expect(result.returnsCost).toBeCloseTo(0.30, 2);

        // No loyalty for Amazon
        expect(result.loyaltyCost).toBe(0);
      });

      it('should calculate Amazon FBA costs with high referral fee', () => {
        const product: Partial<FinalPriceList> = {
          SKU: 'TEST-003',
          Weight_g: 250,
          Amazon_TierKey: 'SMALL_STANDARD'
        };

        const result = calculateChannelCosts(
          product as FinalPriceList,
          'Amazon_FBA',
          32.99, // >€10 → 15% referral
          mockCtx
        );

        // Amazon referral: 32.99 × 15% = 4.9485 → 4.95
        expect(result.referralFee).toBeCloseTo(4.95, 2);

        // FBA fee: 2.71 + 0.26 = 2.97
        expect(result.fbaFee).toBe(2.97);
      });

      it('should enforce minimum referral fee', () => {
        const product: Partial<FinalPriceList> = {
          SKU: 'TEST-004',
          Weight_g: 50,
          Amazon_TierKey: 'SMALL_STANDARD'
        };

        const result = calculateChannelCosts(
          product as FinalPriceList,
          'Amazon_FBA',
          2.99, // Very low price
          mockCtx
        );

        // Amazon referral: max(2.99 × 8%, 0.30) = max(0.2392, 0.30) = 0.30
        expect(result.referralFee).toBe(0.30);
      });
    });

    describe('Payment fee variations', () => {
      it('should calculate percentage-only payment fees', () => {
        const mockCtxPercentageOnly: PricingLawContext = {
          ...mockCtx,
          channels: [{
            ChannelID: 'OwnStore',
            ChannelName: 'Own Web Store',
            Active: true,
            Payment_Fee_Pct: 2.49, // Only percentage, no fixed (like PayPal)
            Returns_Pct: 2
          }] as any
        };

        const product: Partial<FinalPriceList> = {
          SKU: 'TEST-PCT-ONLY',
          Weight_g: 350
        };

        const result = calculateChannelCosts(
          product as FinalPriceList,
          'OwnStore',
          100.00,
          mockCtxPercentageOnly
        );

        // Payment fee: 100.00 × 2.49% = 2.49
        expect(result.paymentFee).toBe(2.49);
      });

      it('should calculate fixed-only payment fees', () => {
        const mockCtxFixedOnly: PricingLawContext = {
          ...mockCtx,
          channels: [{
            ChannelID: 'OwnStore',
            ChannelName: 'Own Web Store',
            Active: true,
            Payment_Fee_Fixed_EUR: 0.35, // Only fixed, no percentage
            Returns_Pct: 2
          }] as any
        };

        const product: Partial<FinalPriceList> = {
          SKU: 'TEST-FIXED-ONLY',
          Weight_g: 350
        };

        const result = calculateChannelCosts(
          product as FinalPriceList,
          'OwnStore',
          100.00,
          mockCtxFixedOnly
        );

        // Payment fee: fixed €0.35
        expect(result.paymentFee).toBe(0.35);
      });
    });

    describe('Edge cases', () => {
      it('should return zeros for unknown channel', () => {
        const product: Partial<FinalPriceList> = {
          SKU: 'TEST-005',
          Weight_g: 250
        };

        const result = calculateChannelCosts(
          product as FinalPriceList,
          'UnknownChannel',
          27.60,
          mockCtx
        );

        expect(result.channelName).toBe('Unknown');
        expect(result.totalChannelCost).toBe(0);
      });

      it('should handle missing Weight_g gracefully', () => {
        const product: Partial<FinalPriceList> = {
          SKU: 'TEST-006'
          // No Weight_g
        };

        const result = calculateChannelCosts(
          product as FinalPriceList,
          'OwnStore',
          27.60,
          mockCtx
        );

        // Should still calculate payment, returns, loyalty
        expect(result.paymentFee).toBeGreaterThan(0);
        expect(result.returnsCost).toBeGreaterThan(0);

        // But no DHL shipping/surcharges
        expect(result.dhlShipping).toBe(0);
        expect(result.dhlSurcharges).toBe(0);
      });

      it('should handle missing Amazon_TierKey gracefully', () => {
        const product: Partial<FinalPriceList> = {
          SKU: 'TEST-007',
          Weight_g: 250
          // No Amazon_TierKey
        };

        const result = calculateChannelCosts(
          product as FinalPriceList,
          'Amazon_FBA',
          27.60,
          mockCtx
        );

        // Should calculate referral but no FBA fee
        expect(result.referralFee).toBeGreaterThan(0);
        expect(result.fbaFee).toBe(0);
      });
    });
  });

  describe('checkGuardrail', () => {
    it('should pass guardrail with 50% margin', () => {
      const uvp = 27.60;
      const fullCost = 13.80;
      const channelCost = 0; // No channel costs for simplicity

      const result = checkGuardrail(uvp, fullCost, channelCost, 45);

      // Net revenue: 27.60 - 13.80 = 13.80
      expect(result.netRevenue).toBe(13.80);

      // Margin: (13.80 / 27.60) × 100 = 50%
      expect(result.postChannelMarginPct).toBe(50.00);

      // Should pass (50% >= 45%)
      expect(result.guardrailOK).toBe(true);
    });

    it('should fail guardrail with high channel costs', () => {
      const uvp = 27.60;
      const fullCost = 13.80;
      const channelCost = 7.50;

      const result = checkGuardrail(uvp, fullCost, channelCost, 45);

      // Net revenue: 27.60 - 13.80 - 7.50 = 6.30
      expect(result.netRevenue).toBe(6.30);

      // Margin: (6.30 / 27.60) × 100 = 22.83%
      expect(result.postChannelMarginPct).toBeCloseTo(22.83, 2);

      // Should fail (22.83% < 45%)
      expect(result.guardrailOK).toBe(false);
    });

    it('should pass guardrail at exactly 45%', () => {
      const uvp = 100.00;
      const fullCost = 40.00;
      const channelCost = 15.00;

      const result = checkGuardrail(uvp, fullCost, channelCost, 45);

      // Net revenue: 100 - 40 - 15 = 45
      expect(result.netRevenue).toBe(45.00);

      // Margin: (45 / 100) × 100 = 45%
      expect(result.postChannelMarginPct).toBe(45.00);

      // Should pass (45% >= 45%)
      expect(result.guardrailOK).toBe(true);
    });

    it('should fail guardrail with negative margin', () => {
      const uvp = 10.00;
      const fullCost = 12.00;
      const channelCost = 2.00;

      const result = checkGuardrail(uvp, fullCost, channelCost, 45);

      // Net revenue: 10 - 12 - 2 = -4
      expect(result.netRevenue).toBe(-4.00);

      // Margin: (-4 / 10) × 100 = -40%
      expect(result.postChannelMarginPct).toBe(-40.00);

      // Should fail (negative margin)
      expect(result.guardrailOK).toBe(false);
    });

    it('should return false for zero UVP', () => {
      const result = checkGuardrail(0, 10, 5, 45);

      expect(result.netRevenue).toBe(0);
      expect(result.postChannelMarginPct).toBe(0);
      expect(result.guardrailOK).toBe(false);
    });

    it('should support custom guardrail threshold', () => {
      const uvp = 100.00;
      const fullCost = 40.00;
      const channelCost = 10.00;

      // 50% margin with 48% threshold
      const result48 = checkGuardrail(uvp, fullCost, channelCost, 48);
      expect(result48.postChannelMarginPct).toBe(50.00);
      expect(result48.guardrailOK).toBe(true);

      // 50% margin with 55% threshold
      const result55 = checkGuardrail(uvp, fullCost, channelCost, 55);
      expect(result55.postChannelMarginPct).toBe(50.00);
      expect(result55.guardrailOK).toBe(false);
    });

    describe('Real-world integration', () => {
      it('should validate complete pricing flow: FullCost → UVP → Guardrail', () => {
        // Calculate FullCost
        const product: Partial<FinalPriceList> = {
          SKU: 'HM-BO-P-50-001',
          Factory_Cost_EUR: 8.50,
          Packaging_Cost_EUR: 0.80,
          Shipping_Inbound_per_unit: 1.20,
          EPR_LUCID_per_unit: 0.15,
          GS1_per_unit: 0.05,
          Retail_Packaging_per_unit: 0.50,
          QC_PIF_per_unit: 0.30,
          Operations_per_unit: 1.50,
          Marketing_per_unit: 0.80,
          Weight_g: 80,
          Amazon_TierKey: 'SMALL_STANDARD'
        };

        const fullCostResult = calculateFullCost(product as FinalPriceList);
        expect(fullCostResult.fullCostEUR).toBe(13.80);

        // Calculate UVP with 50% margin
        const uvp = calculateUVP(fullCostResult.fullCostEUR, 50);
        expect(uvp).toBe(27.60);

        // Calculate channel costs for Amazon FBA
        const mockCtx: PricingLawContext = {
          channels: [{
            ChannelID: 'Amazon_FBA',
            ChannelName: 'Amazon FBA',
            Active: true,
            Amazon_Referral_Pct_Low: 8,
            Amazon_Referral_Pct_High: 15,
            Amazon_Referral_Min_EUR: 0.30,
            Returns_Pct: 3
          }] as any,
          amazonTiers: [{
            TierKey: 'SMALL_STANDARD',
            FBA_Fee_EUR: 2.71,
            FBA_Surcharge_2025_EUR: 0.26
          }] as any,
          shippingMatrix: [],
          dhlSurcharges: [],
          quantityDiscounts: [],
          discountCaps: [],
          orderDiscounts: [],
          lineTargets: []
        };

        const channelCosts = calculateChannelCosts(
          product as FinalPriceList,
          'Amazon_FBA',
          uvp,
          mockCtx
        );

        // Check guardrail
        const guardrail = checkGuardrail(
          uvp,
          fullCostResult.fullCostEUR,
          channelCosts.totalChannelCost,
          45
        );

        // With UVP €27.60, FullCost €13.80, and channel costs ~€8
        // Net revenue should be ~€5.80, margin ~21%
        expect(guardrail.postChannelMarginPct).toBeLessThan(45);
        expect(guardrail.guardrailOK).toBe(false);
        
        // This demonstrates that 50% pre-channel margin
        // drops below 45% guardrail after Amazon FBA costs
      });
    });
  });

  describe('enforceMAP', () => {
    describe('Compliance scenarios', () => {
      it('should not adjust UVP when above MAP', () => {
        const result = enforceMAP(34.99, 29.99);

        expect(result.uvpAdjusted).toBe(34.99);
        expect(result.mapViolation).toBe(false);
        expect(result.reason).toBeUndefined();
      });

      it('should not adjust UVP when equal to MAP', () => {
        const result = enforceMAP(29.99, 29.99);

        expect(result.uvpAdjusted).toBe(29.99);
        expect(result.mapViolation).toBe(false);
        expect(result.reason).toBeUndefined();
      });
    });

    describe('Violation scenarios', () => {
      it('should raise UVP to MAP when below', () => {
        const result = enforceMAP(24.99, 29.99);

        expect(result.uvpAdjusted).toBe(29.99);
        expect(result.mapViolation).toBe(true);
        expect(result.reason).toContain('€24.99 below MAP €29.99');
      });

      it('should raise UVP significantly if far below MAP', () => {
        const result = enforceMAP(15.00, 35.99);

        expect(result.uvpAdjusted).toBe(35.99);
        expect(result.mapViolation).toBe(true);
        expect(result.reason).toContain('€15.00 below MAP €35.99');
      });

      it('should handle small price differences precisely', () => {
        const result = enforceMAP(29.98, 29.99);

        expect(result.uvpAdjusted).toBe(29.99);
        expect(result.mapViolation).toBe(true);
        expect(result.reason).toContain('€29.98 below MAP €29.99');
      });
    });

    describe('Edge cases', () => {
      it('should ignore invalid MAP (zero)', () => {
        const result = enforceMAP(24.99, 0);

        expect(result.uvpAdjusted).toBe(24.99);
        expect(result.mapViolation).toBe(false);
      });

      it('should ignore invalid MAP (negative)', () => {
        const result = enforceMAP(24.99, -10.00);

        expect(result.uvpAdjusted).toBe(24.99);
        expect(result.mapViolation).toBe(false);
      });

      it('should ignore invalid MAP (Infinity)', () => {
        const result = enforceMAP(24.99, Infinity);

        expect(result.uvpAdjusted).toBe(24.99);
        expect(result.mapViolation).toBe(false);
      });

      it('should raise invalid UVP (zero) to MAP', () => {
        const result = enforceMAP(0, 29.99);

        expect(result.uvpAdjusted).toBe(29.99);
        expect(result.mapViolation).toBe(true);
        expect(result.reason).toContain('Invalid UVP');
      });

      it('should raise invalid UVP (negative) to MAP', () => {
        const result = enforceMAP(-5.00, 29.99);

        expect(result.uvpAdjusted).toBe(29.99);
        expect(result.mapViolation).toBe(true);
        expect(result.reason).toContain('Invalid UVP');
      });

      it('should raise invalid UVP (NaN) to MAP', () => {
        const result = enforceMAP(NaN, 29.99);

        expect(result.uvpAdjusted).toBe(29.99);
        expect(result.mapViolation).toBe(true);
        expect(result.reason).toContain('Invalid UVP');
      });

      it('should raise invalid UVP (Infinity) to MAP without throwing', () => {
        const result = enforceMAP(Infinity, 29.99);

        expect(result.uvpAdjusted).toBe(29.99);
        expect(result.mapViolation).toBe(true);
        expect(result.reason).toContain('Invalid UVP');
        expect(result.reason).toContain('Infinity');
      });

      it('should raise invalid UVP (-Infinity) to MAP without throwing', () => {
        const result = enforceMAP(-Infinity, 29.99);

        expect(result.uvpAdjusted).toBe(29.99);
        expect(result.mapViolation).toBe(true);
        expect(result.reason).toContain('Invalid UVP');
        expect(result.reason).toContain('Infinity');
      });
    });

    describe('Competitor tracking', () => {
      it('should accept competitorMin but not affect pricing', () => {
        // Even if competitor prices at €19.99, we must respect MAP €29.99
        const result = enforceMAP(24.99, 29.99, 19.99);

        expect(result.uvpAdjusted).toBe(29.99);
        expect(result.mapViolation).toBe(true);
        // competitorMin is tracked for analytics only
      });

      it('should not lower price to match competitor if below MAP', () => {
        // Competitor at €25.00, MAP at €29.99 - we stay at €34.99
        const result = enforceMAP(34.99, 29.99, 25.00);

        expect(result.uvpAdjusted).toBe(34.99);
        expect(result.mapViolation).toBe(false);
      });
    });

    describe('Real-world scenarios', () => {
      it('should enforce MAP for HAIROTICMEN Premium products', () => {
        // Premium Bartöl has MAP €32.99
        // If calculated UVP is €27.60 (50% margin), enforce MAP
        const fullCost = 13.80;
        const uvp = calculateUVP(fullCost, 50); // €27.60
        const map = 32.99;

        const result = enforceMAP(uvp, map);

        expect(result.uvpAdjusted).toBe(32.99);
        expect(result.mapViolation).toBe(true);
        expect(result.reason).toContain('€27.60 below MAP €32.99');
      });

      it('should not enforce MAP if UVP already exceeds it', () => {
        // Pro product with good margin
        const fullCost = 8.50;
        const uvp = calculateUVP(fullCost, 55); // €18.89
        const map = 15.99;

        const result = enforceMAP(uvp, map);

        expect(result.uvpAdjusted).toBeCloseTo(18.89, 2);
        expect(result.mapViolation).toBe(false);
      });

      it('should integrate with complete pricing flow', () => {
        // Calculate FullCost
        const product: Partial<FinalPriceList> = {
          SKU: 'HM-BO-P-50-001',
          Factory_Cost_EUR: 8.50,
          Packaging_Cost_EUR: 0.80,
          Shipping_Inbound_per_unit: 1.20,
          EPR_LUCID_per_unit: 0.15,
          GS1_per_unit: 0.05,
          Retail_Packaging_per_unit: 0.50,
          QC_PIF_per_unit: 0.30,
          Operations_per_unit: 1.50,
          Marketing_per_unit: 0.80
        };

        const fullCostResult = calculateFullCost(product as FinalPriceList);
        expect(fullCostResult.fullCostEUR).toBe(13.80);

        // Calculate UVP with target margin
        const uvp = calculateUVP(fullCostResult.fullCostEUR, 48);
        expect(uvp).toBeCloseTo(26.54, 2);

        // Enforce MAP
        const map = 32.99;
        const mapResult = enforceMAP(uvp, map);

        expect(mapResult.uvpAdjusted).toBe(32.99);
        expect(mapResult.mapViolation).toBe(true);

        // Final advertised price must be €32.99 (MAP)
        // This maintains legal compliance even though
        // it increases margin beyond target
      });
    });

    describe('Constraint priority verification', () => {
      it('should demonstrate MAP has highest priority over margin targets', () => {
        // Even if 45% margin would suggest €25.09,
        // MAP at €29.99 takes priority
        const fullCost = 13.80;
        const uvpForMargin = calculateUVP(fullCost, 45); // ~€25.09
        const map = 29.99;

        const result = enforceMAP(uvpForMargin, map);

        // MAP wins - legal constraint
        expect(result.uvpAdjusted).toBe(29.99);
        expect(result.mapViolation).toBe(true);

        // This will give higher margin than 45%:
        // (29.99 - 13.80) / 29.99 = 53.98%
        // But that's acceptable - MAP is law, margin is target
      });
    });
  });

  describe('applyLineTargets', () => {
    const mockCtx: PricingLawContext = {
      channels: [],
      amazonTiers: [],
      shippingMatrix: [],
      dhlSurcharges: [],
      quantityDiscounts: [],
      discountCaps: [],
      orderDiscounts: [],
      lineTargets: [
        {
          Line: 'Premium',
          Target_Margin_Pct: 55,
          Floor_Multiplier: 2.5,
          Guardrail_Margin_Pct: 45,
          Rounding_Strategy: 'web',
          Active: true
        },
        {
          Line: 'Pro',
          Target_Margin_Pct: 50,
          Floor_Multiplier: 2.2,
          Guardrail_Margin_Pct: 45,
          Rounding_Strategy: 'salon',
          Active: true
        },
        {
          Line: 'Basic',
          Target_Margin_Pct: 48,
          Floor_Multiplier: 2.0,
          Guardrail_Margin_Pct: 45,
          Rounding_Strategy: 'none',
          Active: true
        },
        {
          Line: 'Tools',
          Target_Margin_Pct: 45,
          Floor_Multiplier: 1.8,
          Guardrail_Margin_Pct: 40,
          Rounding_Strategy: 'web',
          Active: true
        }
      ] as any
    };

    describe('Line-specific targets', () => {
      it('should apply Premium line targets (highest floor)', () => {
        const fullCost = 13.80;
        const result = applyLineTargets(fullCost, 'Premium', mockCtx);

        // Premium: 2.5x floor, 55% target margin
        expect(result.floorMultiplier).toBe(2.5);
        expect(result.uvpMin).toBe(34.50); // 13.80 × 2.5
        expect(result.targetMarginPct).toBe(55);
        expect(result.roundingStrategy).toBe('web');
      });

      it('should apply Pro line targets', () => {
        const fullCost = 10.00;
        const result = applyLineTargets(fullCost, 'Pro', mockCtx);

        // Pro: 2.2x floor, 50% target margin
        expect(result.floorMultiplier).toBe(2.2);
        expect(result.uvpMin).toBe(22.00); // 10.00 × 2.2
        expect(result.targetMarginPct).toBe(50);
        expect(result.roundingStrategy).toBe('salon');
      });

      it('should apply Basic line targets (lower floor)', () => {
        const fullCost = 8.50;
        const result = applyLineTargets(fullCost, 'Basic', mockCtx);

        // Basic: 2.0x floor, 48% target margin
        expect(result.floorMultiplier).toBe(2.0);
        expect(result.uvpMin).toBe(17.00); // 8.50 × 2.0
        expect(result.targetMarginPct).toBe(48);
        expect(result.roundingStrategy).toBe('none');
      });

      it('should apply Tools line targets (lowest floor)', () => {
        const fullCost = 12.00;
        const result = applyLineTargets(fullCost, 'Tools', mockCtx);

        // Tools: 1.8x floor, 45% target margin
        expect(result.floorMultiplier).toBe(1.8);
        expect(result.uvpMin).toBe(21.60); // 12.00 × 1.8
        expect(result.targetMarginPct).toBe(45);
        expect(result.roundingStrategy).toBe('web');
      });
    });

    describe('Rounding precision', () => {
      it('should round uvpMin to 2 decimal places', () => {
        const fullCost = 10.33;
        const result = applyLineTargets(fullCost, 'Premium', mockCtx);

        // 10.33 × 2.5 = 25.825 → 25.83
        expect(result.uvpMin).toBe(25.83);
      });

      it('should handle fractional multipliers precisely', () => {
        const fullCost = 7.77;
        const result = applyLineTargets(fullCost, 'Pro', mockCtx);

        // 7.77 × 2.2 = 17.094 → 17.09
        expect(result.uvpMin).toBe(17.09);
      });
    });

    describe('Edge cases', () => {
      it('should return defaults for unknown line', () => {
        const fullCost = 15.00;
        const result = applyLineTargets(fullCost, 'UnknownLine', mockCtx);

        // Default: 2.2x floor, 48% target margin
        expect(result.floorMultiplier).toBe(2.2);
        expect(result.uvpMin).toBe(33.00); // 15.00 × 2.2
        expect(result.targetMarginPct).toBe(48);
        expect(result.roundingStrategy).toBeUndefined();
      });

      it('should skip inactive line targets', () => {
        const mockCtxInactive: PricingLawContext = {
          ...mockCtx,
          lineTargets: [
            {
              Line: 'Premium',
              Target_Margin_Pct: 55,
              Floor_Multiplier: 2.5,
              Guardrail_Margin_Pct: 45,
              Active: false  // Inactive
            }
          ] as any
        };

        const result = applyLineTargets(10.00, 'Premium', mockCtxInactive);

        // Should use defaults since Premium is inactive
        expect(result.floorMultiplier).toBe(2.2); // Default
      });

      it('should handle zero fullCost gracefully', () => {
        const result = applyLineTargets(0, 'Premium', mockCtx);

        expect(result.uvpMin).toBe(0);
        expect(result.targetMarginPct).toBe(55);
        expect(result.floorMultiplier).toBe(2.5);
      });
    });

    describe('Constraint hierarchy demonstration', () => {
      it('should demonstrate floor multiplier enforces minimum UVP', () => {
        const fullCost = 20.00;
        
        // Calculate UVP with 48% margin
        const uvpFromMargin = calculateUVP(fullCost, 48);
        expect(uvpFromMargin).toBeCloseTo(38.46, 2);

        // Apply Premium floor (2.5x)
        const lineTarget = applyLineTargets(fullCost, 'Premium', mockCtx);
        expect(lineTarget.uvpMin).toBe(50.00); // 20.00 × 2.5

        // Floor wins: 50.00 > 38.46
        // Must use €50.00 to respect floor constraint
        // This gives (50 - 20) / 50 = 60% margin (exceeds target)
      });

      it('should show different floors create different minimum prices', () => {
        const fullCost = 10.00;

        const premium = applyLineTargets(fullCost, 'Premium', mockCtx);
        const pro = applyLineTargets(fullCost, 'Pro', mockCtx);
        const basic = applyLineTargets(fullCost, 'Basic', mockCtx);
        const tools = applyLineTargets(fullCost, 'Tools', mockCtx);

        // Premium has highest floor → highest minimum price
        expect(premium.uvpMin).toBe(25.00);
        expect(pro.uvpMin).toBe(22.00);
        expect(basic.uvpMin).toBe(20.00);
        expect(tools.uvpMin).toBe(18.00);

        // Verify descending order
        expect(premium.uvpMin).toBeGreaterThan(pro.uvpMin);
        expect(pro.uvpMin).toBeGreaterThan(basic.uvpMin);
        expect(basic.uvpMin).toBeGreaterThan(tools.uvpMin);
      });
    });

    describe('Real-world integration', () => {
      it('should integrate with complete pricing flow', () => {
        // Calculate FullCost
        const product: Partial<FinalPriceList> = {
          SKU: 'HM-BO-P-50-001',
          Factory_Cost_EUR: 8.50,
          Packaging_Cost_EUR: 0.80,
          Shipping_Inbound_per_unit: 1.20,
          EPR_LUCID_per_unit: 0.15,
          GS1_per_unit: 0.05,
          Retail_Packaging_per_unit: 0.50,
          QC_PIF_per_unit: 0.30,
          Operations_per_unit: 1.50,
          Marketing_per_unit: 0.80
        };

        const fullCostResult = calculateFullCost(product as FinalPriceList);
        expect(fullCostResult.fullCostEUR).toBe(13.80);

        // Apply Premium line targets
        const lineTarget = applyLineTargets(
          fullCostResult.fullCostEUR,
          'Premium',
          mockCtx
        );

        expect(lineTarget.uvpMin).toBe(34.50); // 13.80 × 2.5
        expect(lineTarget.targetMarginPct).toBe(55);

        // Calculate UVP with target margin
        const uvpFromMargin = calculateUVP(fullCostResult.fullCostEUR, 55);
        expect(uvpFromMargin).toBeCloseTo(30.67, 2);

        // Floor constraint forces higher price
        // Must use €34.50 (floor) instead of €30.67 (margin target)
        const finalUVP = Math.max(uvpFromMargin, lineTarget.uvpMin);
        expect(finalUVP).toBe(34.50);

        // This demonstrates constraint priority:
        // Floor (€34.50) > Margin target (€30.67)
      });

      it('should work with MAP enforcement in full pipeline', () => {
        const fullCost = 13.80;
        
        // Step 1: Apply line targets (Premium)
        const lineTarget = applyLineTargets(fullCost, 'Premium', mockCtx);
        expect(lineTarget.uvpMin).toBe(34.50);

        // Step 2: Calculate UVP with target margin
        const uvpFromMargin = calculateUVP(fullCost, lineTarget.targetMarginPct);
        expect(uvpFromMargin).toBeCloseTo(30.67, 2);

        // Step 3: Apply floor constraint
        const uvpAfterFloor = Math.max(uvpFromMargin, lineTarget.uvpMin);
        expect(uvpAfterFloor).toBe(34.50);

        // Step 4: Enforce MAP (if applicable)
        const map = 39.99;
        const mapResult = enforceMAP(uvpAfterFloor, map);

        // MAP wins over floor: 39.99 > 34.50
        expect(mapResult.uvpAdjusted).toBe(39.99);
        expect(mapResult.mapViolation).toBe(true);

        // Final constraint hierarchy demonstrated:
        // MAP (€39.99) > Floor (€34.50) > Margin target (€30.67)
      });
    });
  });

  describe('calculateB2BDiscount', () => {
    const mockCtx: PricingLawContext = {
      channels: [],
      amazonTiers: [],
      shippingMatrix: [],
      dhlSurcharges: [],
      quantityDiscounts: [
        {
          DiscountID: 'QTY_TIER_1',
          TierName: 'Tier 1 (5-9 units)',
          MinQty: 5,
          MaxQty: 9,
          Discount_Pct: 5,
          AppliesTo: 'All',
          Active: true
        },
        {
          DiscountID: 'QTY_TIER_2',
          TierName: 'Tier 2 (10+ units)',
          MinQty: 10,
          MaxQty: null,
          Discount_Pct: 10,
          AppliesTo: 'All',
          Active: true
        },
        {
          DiscountID: 'QTY_DEALER_ONLY',
          TierName: 'Dealer Special (20+ units)',
          MinQty: 20,
          MaxQty: null,
          Discount_Pct: 15,
          AppliesTo: 'Dealer Basic',
          Active: true
        }
      ] as any,
      discountCaps: [
        {
          CapID: 'CAP_DEALER_BASIC',
          PartnerTier: 'Dealer Basic',
          Max_Role_Discount_Pct: 10,
          Max_Quantity_Discount_Pct: 15,
          Max_Combined_Discount_Pct: 20,
          Active: true
        },
        {
          CapID: 'CAP_STAND',
          PartnerTier: 'Stand',
          Max_Role_Discount_Pct: 15,
          Max_Quantity_Discount_Pct: 10,
          Max_Combined_Discount_Pct: 22,
          Active: true
        },
        {
          CapID: 'CAP_DISTRIBUTOR',
          PartnerTier: 'Distributor',
          Max_Role_Discount_Pct: 25,
          Max_Quantity_Discount_Pct: 10,
          Max_Combined_Discount_Pct: 30,
          Active: true
        }
      ] as any,
      orderDiscounts: [],
      lineTargets: []
    };

    describe('Role-based discounts', () => {
      it('should apply Dealer Basic role discount (10%)', () => {
        const result = calculateB2BDiscount(100, 'Dealer Basic', 1, 0, mockCtx);

        expect(result.discountPct).toBe(10);
        expect(result.netPrice).toBe(90.00);
        expect(result.discountCapped).toBe(false);
      });

      it('should apply Dealer Plus role discount (12%)', () => {
        const result = calculateB2BDiscount(100, 'Dealer Plus', 1, 0, mockCtx);

        expect(result.discountPct).toBe(12);
        expect(result.netPrice).toBe(88.00);
      });

      it('should apply Stand role discount (15%)', () => {
        const result = calculateB2BDiscount(100, 'Stand', 1, 0, mockCtx);

        expect(result.discountPct).toBe(15);
        expect(result.netPrice).toBe(85.00);
      });

      it('should apply Distributor role discount (25%)', () => {
        const result = calculateB2BDiscount(100, 'Distributor', 1, 0, mockCtx);

        expect(result.discountPct).toBe(25);
        expect(result.netPrice).toBe(75.00);
      });

      it('should handle unknown role with 0% discount', () => {
        const result = calculateB2BDiscount(100, 'UnknownRole', 1, 0, mockCtx);

        expect(result.discountPct).toBe(0);
        expect(result.netPrice).toBe(100.00);
      });
    });

    describe('Quantity tier discounts', () => {
      it('should apply quantity discount for 5-9 units (5%)', () => {
        const result = calculateB2BDiscount(100, 'Dealer Basic', 8, 0, mockCtx);

        expect(result.discountPct).toBe(15); // 10% role + 5% qty
        expect(result.netPrice).toBe(85.00);
      });

      it('should apply quantity discount for 10+ units (10%)', () => {
        const result = calculateB2BDiscount(100, 'Dealer Basic', 12, 0, mockCtx);

        expect(result.discountPct).toBe(20); // 10% role + 10% qty (at cap)
        expect(result.netPrice).toBe(80.00);
        expect(result.discountCapped).toBe(false); // Exactly at cap, not over
      });

      it('should apply role-specific quantity discount (Dealer 20+ units)', () => {
        const result = calculateB2BDiscount(100, 'Dealer Basic', 25, 0, mockCtx);

        expect(result.discountPct).toBe(20); // 10% role + 15% qty (Dealer-specific) → capped to 20%
        expect(result.netPrice).toBe(80.00);
        expect(result.discountCapped).toBe(true); // Combined 25% → capped to 20%
      });

      it('should not apply quantity discount below minimum', () => {
        const result = calculateB2BDiscount(100, 'Dealer Basic', 3, 0, mockCtx);

        expect(result.discountPct).toBe(10); // Role only (no qty discount)
      });

      it('should prefer partner-specific tier over generic "All" tier', () => {
        // Both "All" (10%) and "Dealer Basic" (15%) tiers match 25 units
        // Partner-specific tier should win (15% not 10%)
        const result = calculateB2BDiscount(100, 'Dealer Basic', 25, 0, mockCtx);

        expect(result.discountPct).toBe(20); // 10% role + 15% qty (partner-specific) → capped
        expect(result.discountCapped).toBe(true);
      });

      it('should use generic "All" tier when no partner-specific tier matches', () => {
        // Stand has no special tier, should use generic "All" tier
        const result = calculateB2BDiscount(100, 'Stand', 25, 0, mockCtx);

        expect(result.discountPct).toBe(22); // 15% role + 10% qty (generic) → capped at 22%
        expect(result.discountCapped).toBe(true);
      });
    });

    describe('Discount caps', () => {
      it('should cap combined discount at max (Dealer Basic 20%)', () => {
        // Dealer Basic: 10% role + 10% qty = 20% (at cap)
        const result = calculateB2BDiscount(100, 'Dealer Basic', 12, 0, mockCtx);

        expect(result.discountPct).toBe(20);
        expect(result.netPrice).toBe(80.00);
        expect(result.discountCapped).toBe(false); // Exactly at cap
      });

      it('should cap Distributor discount from 35% to 30%', () => {
        // Distributor: 25% role + 10% qty = 35% → capped to 30%
        const result = calculateB2BDiscount(100, 'Distributor', 12, 0, mockCtx);

        expect(result.discountPct).toBe(30); // Capped from 35%
        expect(result.netPrice).toBe(70.00);
        expect(result.discountCapped).toBe(true);
      });

      it('should enforce individual discount caps before combined', () => {
        const mockCtxStrictCap: PricingLawContext = {
          ...mockCtx,
          discountCaps: [{
            CapID: 'STRICT_CAP',
            PartnerTier: 'Dealer Basic',
            Max_Role_Discount_Pct: 8, // Lower than default 10%
            Max_Quantity_Discount_Pct: 5, // Lower than tier 2 (10%)
            Max_Combined_Discount_Pct: 12,
            Active: true
          }] as any
        };

        const result = calculateB2BDiscount(100, 'Dealer Basic', 12, 0, mockCtxStrictCap);

        // Role: 10% → 8%, Qty: 10% → 5%, Combined: 13% → 12%
        expect(result.discountPct).toBe(12);
        expect(result.netPrice).toBe(88.00);
        expect(result.discountCapped).toBe(true);
      });
    });

    describe('Edge cases', () => {
      it('should return zero for zero UVP', () => {
        const result = calculateB2BDiscount(0, 'Dealer Basic', 10, 0, mockCtx);

        expect(result.netPrice).toBe(0);
        expect(result.discountPct).toBe(0);
      });

      it('should handle negative UVP gracefully', () => {
        const result = calculateB2BDiscount(-50, 'Dealer Basic', 10, 0, mockCtx);

        expect(result.netPrice).toBe(0);
        expect(result.discountPct).toBe(0);
      });

      it('should work without quantity discounts', () => {
        const mockCtxNoQty: PricingLawContext = {
          ...mockCtx,
          quantityDiscounts: []
        };

        const result = calculateB2BDiscount(100, 'Dealer Basic', 10, 0, mockCtxNoQty);

        expect(result.discountPct).toBe(10); // Role only
      });

      it('should work without discount caps', () => {
        const mockCtxNoCaps: PricingLawContext = {
          ...mockCtx,
          discountCaps: []
        };

        const result = calculateB2BDiscount(100, 'Distributor', 12, 0, mockCtxNoCaps);

        // No caps: 25% + 10% = 35% (uncapped)
        expect(result.discountPct).toBe(35);
        expect(result.netPrice).toBe(65.00);
        expect(result.discountCapped).toBe(false);
      });
    });

    describe('Real-world scenarios', () => {
      it('should calculate correct net for Dealer Basic buying 8 units @ €32.99', () => {
        const uvp = 32.99;
        const result = calculateB2BDiscount(uvp, 'Dealer Basic', 8, 0, mockCtx);

        // 10% role + 5% qty = 15%
        expect(result.discountPct).toBe(15);
        expect(result.netPrice).toBeCloseTo(28.04, 2); // 32.99 × 0.85
      });

      it('should calculate correct net for Stand buying 25 units @ €27.60', () => {
        const uvp = 27.60;
        const result = calculateB2BDiscount(uvp, 'Stand', 25, 0, mockCtx);

        // Stand: 15% role + 10% qty (Tier 2) = 25% → capped to 22%
        expect(result.discountPct).toBe(22); // Capped!
        expect(result.netPrice).toBeCloseTo(21.53, 2); // 27.60 × 0.78
        expect(result.discountCapped).toBe(true);
      });

      it('should calculate correct net for Distributor bulk order', () => {
        const uvp = 15.99;
        const result = calculateB2BDiscount(uvp, 'Distributor', 50, 0, mockCtx);

        // Distributor: 25% role + 10% qty (Tier 2) = 35% → capped to 30%
        expect(result.discountPct).toBe(30);
        expect(result.netPrice).toBeCloseTo(11.19, 2); // 15.99 × 0.70
      });
    });

    describe('Integration with full pricing pipeline', () => {
      it('should integrate B2B discounts into complete flow', () => {
        // 1. Calculate FullCost
        const product: Partial<FinalPriceList> = {
          SKU: 'HM-BO-P-50-001',
          Factory_Cost_EUR: 8.50,
          Packaging_Cost_EUR: 0.80,
          Shipping_Inbound_per_unit: 1.20,
          EPR_LUCID_per_unit: 0.15,
          GS1_per_unit: 0.05,
          Retail_Packaging_per_unit: 0.50,
          QC_PIF_per_unit: 0.30,
          Operations_per_unit: 1.50,
          Marketing_per_unit: 0.80
        };

        const fullCostResult = calculateFullCost(product as FinalPriceList);
        expect(fullCostResult.fullCostEUR).toBe(13.80);

        // 2. Calculate UVP with target margin
        const uvp = calculateUVP(fullCostResult.fullCostEUR, 50);
        expect(uvp).toBe(27.60);

        // 3. Apply MAP if needed
        const map = 32.99;
        const mapResult = enforceMAP(uvp, map);
        expect(mapResult.uvpAdjusted).toBe(32.99);

        // 4. Apply B2B discount (Dealer Basic, 8 units)
        const b2bResult = calculateB2BDiscount(mapResult.uvpAdjusted, 'Dealer Basic', 8, 0, mockCtx);
        
        expect(b2bResult.discountPct).toBe(15); // 10% role + 5% qty
        expect(b2bResult.netPrice).toBeCloseTo(28.04, 2);

        // Complete pipeline:
        // FullCost €13.80 → UVP €27.60 → MAP €32.99 → B2B Net €28.04
        // End customer pays: €32.99
        // Dealer pays: €28.04 (€4.95 discount)
      });
    });
  });
});
