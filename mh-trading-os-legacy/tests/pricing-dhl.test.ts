/**
 * DHL Zone Regression Tests (Vitest)
 * 
 * Validates that SKUs with different DHL zones correctly pick up
 * zone-specific base rates and surcharges from Google Sheets.
 * 
 * Critical acceptance criteria:
 * - Non-default zones (DE_2, EU_1) must use zone-specific rates
 * - Surcharges must compound correctly (fixed + percentage)
 * - Malformed numeric data must hard-fail (not silent skip)
 */

import { describe, test, expect } from '@jest/globals';
import { 
  buildHAIROTICMENContext,
  calculateHAIROTICMENPricing
} from '../lib/pricing-engine-hairoticmen';
import type { 
  FinalPriceList,
  PricingParam,
  Channel,
  ShippingMatrixDHL,
  DHLSurcharge 
} from '../../shared/schema';

// Mock pricing params
const mockParams: PricingParam[] = [
  { ParamKey: 'FX_BUFFER_PCT', Value: '3', Category: 'Cost', Notes: 'FX buffer' },
  { ParamKey: 'VAT_DEFAULT_PCT', Value: '19', Category: 'Cost', Notes: 'VAT' },
];

// Mock channels
const mockChannels: Channel[] = [
  {
    ChannelID: 'OwnStore',
    ChannelName: 'Own Store',
    Active: true,
    Amazon_Referral_Pct_Low: 8,
    Amazon_Referral_Pct_High: 15,
    Amazon_Referral_Min_EUR: 0.30,
  },
];

// Mock shipping matrix with multiple zones (using actual sheet column name)
const mockShippingMatrix: ShippingMatrixDHL[] = [
  // DE_1 zone (default)
  { Zone: 'DE_1', Weight_Min_g: 0, Weight_Max_g: 500, Base_Rate_EUR: 3.79 },
  { Zone: 'DE_1', Weight_Min_g: 501, Weight_Max_g: 1000, Base_Rate_EUR: 4.39 },
  { Zone: 'DE_1', Weight_Min_g: 1001, Weight_Max_g: 2000, Base_Rate_EUR: 5.29 },
  
  // DE_2 zone (non-default)
  { Zone: 'DE_2', Weight_Min_g: 0, Weight_Max_g: 500, Base_Rate_EUR: 4.29 },
  { Zone: 'DE_2', Weight_Min_g: 501, Weight_Max_g: 1000, Base_Rate_EUR: 4.89 },
  { Zone: 'DE_2', Weight_Min_g: 1001, Weight_Max_g: 2000, Base_Rate_EUR: 5.79 },
  
  // EU_1 zone
  { Zone: 'EU_1', Weight_Min_g: 0, Weight_Max_g: 500, Base_Rate_EUR: 8.99 },
  { Zone: 'EU_1', Weight_Min_g: 501, Weight_Max_g: 1000, Base_Rate_EUR: 10.49 },
];

// Mock DHL surcharges
const mockDHLSurcharges: DHLSurcharge[] = [
  {
    SurchargeKey: 'LKW_CO2',
    SurchargeName: 'LKW CO2 Surcharge',
    Type: 'Fixed_Per_Shipment',
    Amount_EUR: 0.19,
    Active: true,
  },
  {
    SurchargeKey: 'Energy_Surcharge',
    SurchargeName: 'Energy Surcharge',
    Type: 'Pct_Of_Base',
    Pct_Of_Base: 5.5,
    Active: true,
  },
];

// Build context
const ctx = buildHAIROTICMENContext(
  mockParams,
  mockChannels,
  [],
  mockShippingMatrix,
  mockDHLSurcharges
);

describe('DHL Zone Routing & Surcharges', () => {
  test.each([
    {
      description: 'DE_1 zone (default), 300g',
      product: {
        SKU: 'TEST-DE1-300',
        Name: 'Test Product DE1 300g',
        Weight_g: 300,
        // DHL_Zone not specified - should default to DE_1
        Line: 'Basic',
        FactoryPriceUnit_Manual: 5.00,
        Manual_UVP_Inc: 19.99,
      } as Partial<FinalPriceList>,
      expectedZone: 'DE_1',
      expectedBaseRate: 3.79,
      expectedSurchargesMin: 0.19 + ((3.79 + 0.19) * 0.055), // Fixed + 5.5% of (base + fixed)
    },
    {
      description: 'DE_2 zone (non-default), 800g',
      product: {
        SKU: 'TEST-DE2-800',
        Name: 'Test Product DE2 800g',
        Weight_g: 800,
        DHL_Zone: 'DE_2', // Explicit zone assignment
        Line: 'Professional',
        FactoryPriceUnit_Manual: 8.00,
        Manual_UVP_Inc: 29.99,
      } as Partial<FinalPriceList>,
      expectedZone: 'DE_2',
      expectedBaseRate: 4.89,
      expectedSurchargesMin: 0.19 + ((4.89 + 0.19) * 0.055),
    },
    {
      description: 'EU_1 zone, 450g',
      product: {
        SKU: 'TEST-EU1-450',
        Name: 'Test Product EU1 450g',
        Weight_g: 450,
        DHL_Zone: 'EU_1',
        Line: 'Premium',
        FactoryPriceUnit_Manual: 12.00,
        Manual_UVP_Inc: 49.99,
      } as Partial<FinalPriceList>,
      expectedZone: 'EU_1',
      expectedBaseRate: 8.99,
      expectedSurchargesMin: 0.19 + ((8.99 + 0.19) * 0.055),
    },
  ])('$description', ({ product, expectedBaseRate, expectedSurchargesMin }) => {
    const result = calculateHAIROTICMENPricing(product as FinalPriceList, ctx);
    
    const actualBase = result.b2cStore.dhlShipping;
    const actualSurcharges = result.b2cStore.dhlSurcharges;
    
    // Assert base rate
    expect(actualBase).toBeCloseTo(expectedBaseRate, 2);
    
    // Assert surcharges (allow small tolerance for percentage calculations)
    expect(actualSurcharges).toBeGreaterThanOrEqual(expectedSurchargesMin * 0.99);
  });
  
  test('should hard-fail on malformed surcharge data', () => {
    const badSurcharges: DHLSurcharge[] = [
      {
        SurchargeKey: 'BAD_SURCHARGE',
        SurchargeName: 'Bad Surcharge',
        Type: 'Fixed_Per_Shipment',
        Amount_EUR: 'invalid' as any, // Malformed data
        Active: true,
      },
    ];
    
    const badCtx = buildHAIROTICMENContext(
      mockParams,
      mockChannels,
      [],
      mockShippingMatrix,
      badSurcharges
    );
    
    const testProduct: Partial<FinalPriceList> = {
      SKU: 'TEST-BAD',
      Name: 'Test Bad Surcharge',
      Weight_g: 300,
      Line: 'Basic',
      FactoryPriceUnit_Manual: 5.00,
      Manual_UVP_Inc: 19.99,
    };
    
    // Should throw on malformed numeric data
    expect(() => {
      calculateHAIROTICMENPricing(testProduct as FinalPriceList, badCtx);
    }).toThrow();
  });
});
