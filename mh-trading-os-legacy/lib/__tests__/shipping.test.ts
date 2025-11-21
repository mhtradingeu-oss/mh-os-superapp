import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ShippingService } from '../shipping';
import type { GoogleSheetsService } from '../sheets';
import type { 
  ShippingMethod, ShippingRule, PackagingBox, PartnerRegistry
} from '@shared/schema';

const mockShippingMethods: ShippingMethod[] = [
  {
    MethodID: 'DHL',
    MethodNameEN: 'DHL Express',
    MethodNameAR: 'دي اتش ال اكسبرس',
    DefaultCostEUR: 5.90,
    MinDays: 1,
    MaxDays: 3,
    Active: true,
    Notes: ''
  },
  {
    MethodID: 'PICKUP',
    MethodNameEN: 'In-Store Pickup',
    MethodNameAR: 'استلام من المتجر',
    DefaultCostEUR: 0,
    MinDays: 0,
    MaxDays: 1,
    Active: true,
    Notes: ''
  },
  {
    MethodID: 'COMPANY_CAR',
    MethodNameEN: 'Company Delivery',
    MethodNameAR: 'توصيل الشركة',
    DefaultCostEUR: 3.00,
    MinDays: 1,
    MaxDays: 2,
    Active: true,
    Notes: ''
  }
];

const mockPackagingBoxes: PackagingBox[] = [
  {
    BoxID: 'BOX-S',
    Name: 'Small Box',
    Length_cm: 20,
    Width_cm: 15,
    Height_cm: 10,
    MaxWeight_g: 2000,
    CostEUR: 0.50,
    Stock: 100,
    Active: true
  },
  {
    BoxID: 'BOX-M',
    Name: 'Medium Box',
    Length_cm: 30,
    Width_cm: 20,
    Height_cm: 15,
    MaxWeight_g: 5000,
    CostEUR: 0.80,
    Stock: 100,
    Active: true
  },
  {
    BoxID: 'BOX-L',
    Name: 'Large Box',
    Length_cm: 40,
    Width_cm: 30,
    Height_cm: 20,
    MaxWeight_g: 10000,
    CostEUR: 1.20,
    Stock: 50,
    Active: true
  }
];

const mockShippingRules: ShippingRule[] = [
  {
    RuleID: 'RULE-FREE-100',
    RuleName: 'Free shipping over 100 EUR',
    MethodID: 'DHL',
    PartnerTier: '',
    PartnerType: '',
    Zone: '',
    MinOrderEUR: 100,
    MaxOrderEUR: undefined,
    ShippingCostEUR: 0,
    FreeShipping: true,
    Priority: 1,
    Active: true
  },
  {
    RuleID: 'RULE-DHL-DE',
    RuleName: 'DHL Germany Standard',
    MethodID: 'DHL',
    PartnerTier: '',
    PartnerType: 'B2C',
    Zone: 'DE',
    MinOrderEUR: undefined,
    MaxOrderEUR: 99.99,
    ShippingCostEUR: 4.90,
    FreeShipping: false,
    Priority: 10,
    Active: true
  },
  {
    RuleID: 'RULE-DHL-EU',
    RuleName: 'DHL EU Standard',
    MethodID: 'DHL',
    PartnerTier: '',
    PartnerType: 'B2C',
    Zone: 'EU',
    MinOrderEUR: undefined,
    MaxOrderEUR: 99.99,
    ShippingCostEUR: 7.90,
    FreeShipping: false,
    Priority: 10,
    Active: true
  },
  {
    RuleID: 'RULE-B2B-PICKUP',
    RuleName: 'B2B Pickup Always Free',
    MethodID: 'PICKUP',
    PartnerTier: '',
    PartnerType: 'B2B',
    Zone: '',
    MinOrderEUR: undefined,
    MaxOrderEUR: undefined,
    ShippingCostEUR: 0,
    FreeShipping: true,
    Priority: 5,
    Active: true
  }
];

const mockPartners: PartnerRegistry[] = [
  {
    PartnerID: 'P001',
    PartnerName: 'Test Customer DE',
    Tier: 'Basic',
    PartnerType: 'B2C',
    CountryCode: 'DE',
    Email: 'test@example.de',
    Status: 'Active'
  },
  {
    PartnerID: 'P002',
    PartnerName: 'Test Customer FR',
    Tier: 'Plus',
    PartnerType: 'B2C',
    CountryCode: 'FR',
    Email: 'test@example.fr',
    Status: 'Active'
  },
  {
    PartnerID: 'P003',
    PartnerName: 'Test B2B Partner',
    Tier: 'Stand',
    PartnerType: 'B2B',
    CountryCode: 'DE',
    Email: 'b2b@example.de',
    Status: 'Active'
  }
];

describe('ShippingService', () => {
  let shippingService: ShippingService;
  let mockSheetsService: Partial<GoogleSheetsService>;

  beforeEach(() => {
    mockSheetsService = {
      getShippingMethods: jest.fn(async () => mockShippingMethods),
      getShippingRules: jest.fn(async () => mockShippingRules),
      getPackagingBoxes: jest.fn(async () => mockPackagingBoxes),
      getPartnerRegistry: jest.fn(async () => mockPartners)
    };
    shippingService = new ShippingService(mockSheetsService as GoogleSheetsService);
  });

  describe('calculateShipping', () => {
    it('should apply free shipping for orders over 100 EUR', async () => {
      const result = await shippingService.calculateShipping({
        orderValueEUR: 150,
        totalWeightG: 1000,
        partnerID: 'P001'
      });

      expect(result.isFreeShipping).toBe(true);
      expect(result.shippingCostEUR).toBe(0);
      expect(result.selectedMethod.MethodID).toBe('DHL');
      expect(result.matchedRule?.RuleID).toBe('RULE-FREE-100');
    });

    it('should use Germany B2C shipping rate for orders under 100 EUR', async () => {
      const result = await shippingService.calculateShipping({
        orderValueEUR: 50,
        totalWeightG: 1000,
        partnerID: 'P001'
      });

      expect(result.isFreeShipping).toBe(false);
      expect(result.shippingCostEUR).toBe(4.90);
      expect(result.selectedMethod.MethodID).toBe('DHL');
      expect(result.matchedRule?.RuleID).toBe('RULE-DHL-DE');
    });

    it('should use EU shipping rate for French customer', async () => {
      const result = await shippingService.calculateShipping({
        orderValueEUR: 50,
        totalWeightG: 1000,
        partnerID: 'P002'
      });

      expect(result.isFreeShipping).toBe(false);
      expect(result.shippingCostEUR).toBe(7.90);
      expect(result.selectedMethod.MethodID).toBe('DHL');
      expect(result.matchedRule?.RuleID).toBe('RULE-DHL-EU');
    });

    it('should apply free pickup for B2B customers', async () => {
      const result = await shippingService.calculateShipping({
        orderValueEUR: 50,
        totalWeightG: 1000,
        partnerID: 'P003'
      });

      expect(result.isFreeShipping).toBe(true);
      expect(result.shippingCostEUR).toBe(0);
      expect(result.selectedMethod.MethodID).toBe('PICKUP');
      expect(result.matchedRule?.RuleID).toBe('RULE-B2B-PICKUP');
    });

    it('should select appropriate packaging box by weight', async () => {
      const resultSmall = await shippingService.calculateShipping({
        orderValueEUR: 50,
        totalWeightG: 1500,
        partnerID: 'P001'
      });
      expect(resultSmall.selectedBox?.BoxID).toBe('BOX-S');
      expect(resultSmall.boxCostEUR).toBe(0.50);

      const resultMedium = await shippingService.calculateShipping({
        orderValueEUR: 50,
        totalWeightG: 3000,
        partnerID: 'P001'
      });
      expect(resultMedium.selectedBox?.BoxID).toBe('BOX-M');
      expect(resultMedium.boxCostEUR).toBe(0.80);

      const resultLarge = await shippingService.calculateShipping({
        orderValueEUR: 50,
        totalWeightG: 7000,
        partnerID: 'P001'
      });
      expect(resultLarge.selectedBox?.BoxID).toBe('BOX-L');
      expect(resultLarge.boxCostEUR).toBe(1.20);
    });

    it('should calculate total cost including shipping and packaging', async () => {
      const result = await shippingService.calculateShipping({
        orderValueEUR: 50,
        totalWeightG: 1500,
        partnerID: 'P001'
      });

      expect(result.totalCostEUR).toBe(result.shippingCostEUR + result.packagingCostEUR);
      expect(result.totalCostEUR).toBe(4.90 + 0.50);
    });

    it('should enrich context from partner data', async () => {
      const result = await shippingService.calculateShipping({
        orderValueEUR: 50,
        totalWeightG: 1000,
        partnerID: 'P001'
      });

      expect(result.matchedRule?.RuleID).toBe('RULE-DHL-DE');
    });

    it('should throw error when no shipping methods exist', async () => {
      mockSheetsService.getShippingMethods = jest.fn(async () => []);

      await expect(
        shippingService.calculateShipping({
          orderValueEUR: 50,
          totalWeightG: 1000,
          partnerID: 'P001'
        })
      ).rejects.toThrow('No shipping methods configured');
    });

    it('should not mutate original context', async () => {
      const originalContext = {
        orderValueEUR: 50,
        totalWeightG: 1000,
        partnerID: 'P001'
      };
      const contextCopy = { ...originalContext };

      await shippingService.calculateShipping(originalContext);

      expect(originalContext).toEqual(contextCopy);
    });
  });

  describe('getAvailableMethodsForContext', () => {
    it('should return all active methods with correct costs for B2C German customer', async () => {
      const methods = await shippingService.getAvailableMethodsForContext({
        orderValueEUR: 50,
        totalWeightG: 1000,
        partnerID: 'P001'
      });

      expect(methods.length).toBe(3);
      
      const dhl = methods.find(m => m.method.MethodID === 'DHL');
      expect(dhl?.estimatedCostEUR).toBe(4.90);
      expect(dhl?.isFree).toBe(false);

      const pickup = methods.find(m => m.method.MethodID === 'PICKUP');
      expect(pickup?.estimatedCostEUR).toBe(0);

      const companyCar = methods.find(m => m.method.MethodID === 'COMPANY_CAR');
      expect(companyCar?.estimatedCostEUR).toBe(3.00);
    });

    it('should show free shipping for orders over 100 EUR', async () => {
      const methods = await shippingService.getAvailableMethodsForContext({
        orderValueEUR: 150,
        totalWeightG: 1000,
        partnerID: 'P001'
      });

      const dhl = methods.find(m => m.method.MethodID === 'DHL');
      expect(dhl?.estimatedCostEUR).toBe(0);
      expect(dhl?.isFree).toBe(true);
    });

    it('should show free pickup for B2B customers', async () => {
      const methods = await shippingService.getAvailableMethodsForContext({
        orderValueEUR: 50,
        totalWeightG: 1000,
        partnerID: 'P003'
      });

      const pickup = methods.find(m => m.method.MethodID === 'PICKUP');
      expect(pickup?.estimatedCostEUR).toBe(0);
      expect(pickup?.isFree).toBe(true);
    });

    it('should enrich context from partner data', async () => {
      const methods = await shippingService.getAvailableMethodsForContext({
        orderValueEUR: 50,
        totalWeightG: 1000,
        partnerID: 'P002'
      });

      const dhl = methods.find(m => m.method.MethodID === 'DHL');
      expect(dhl?.estimatedCostEUR).toBe(7.90);
    });

    it('should throw error when no active methods exist', async () => {
      mockSheetsService.getShippingMethods = jest.fn(async () => []);

      await expect(
        shippingService.getAvailableMethodsForContext({
          orderValueEUR: 50,
          totalWeightG: 1000,
          partnerID: 'P001'
        })
      ).rejects.toThrow('No active shipping methods available');
    });
  });

  describe('createShipment', () => {
    it('should create shipment record with calculation data', async () => {
      const calculation = await shippingService.calculateShipping({
        orderValueEUR: 50,
        totalWeightG: 1500,
        partnerID: 'P001'
      });

      const shipment = await shippingService.createShipment(
        'ORDER-001',
        'P001',
        calculation,
        '123 Main St, Berlin, Germany'
      );

      expect(shipment.OrderID).toBe('ORDER-001');
      expect(shipment.PartnerID).toBe('P001');
      expect(shipment.ShippingMethod).toBe('DHL');
      expect(shipment.BoxID).toBe('BOX-S');
      expect(shipment.ShippingCostEUR).toBe(4.90);
      expect(shipment.BoxCostEUR).toBe(0.50);
      expect(shipment.TotalCostEUR).toBe(5.40);
      expect(shipment.Status).toBe('Pending');
      expect(shipment.DeliveryAddress).toBe('123 Main St, Berlin, Germany');
      expect(shipment.LabelGenerated).toBe(false);
    });

    it('should mark shipment with free shipping note', async () => {
      const calculation = await shippingService.calculateShipping({
        orderValueEUR: 150,
        totalWeightG: 1500,
        partnerID: 'P001'
      });

      const shipment = await shippingService.createShipment(
        'ORDER-002',
        'P001',
        calculation
      );

      expect(shipment.Notes).toContain('Free shipping applied');
    });
  });

  describe('Zone mapping', () => {
    it('should map DE to DE zone', async () => {
      const result = await shippingService.calculateShipping({
        orderValueEUR: 50,
        totalWeightG: 1000,
        partnerID: 'P001'
      });

      expect(result.matchedRule?.Zone).toBe('DE');
    });

    it('should map FR to EU zone', async () => {
      const result = await shippingService.calculateShipping({
        orderValueEUR: 50,
        totalWeightG: 1000,
        partnerID: 'P002'
      });

      expect(result.matchedRule?.Zone).toBe('EU');
    });
  });

  describe('Rule priority', () => {
    it('should match higher priority rule first', async () => {
      const result = await shippingService.calculateShipping({
        orderValueEUR: 150,
        totalWeightG: 1000,
        partnerID: 'P001'
      });

      expect(result.matchedRule?.Priority).toBe(1);
      expect(result.matchedRule?.RuleID).toBe('RULE-FREE-100');
    });
  });
});
