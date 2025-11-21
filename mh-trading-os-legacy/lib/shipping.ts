import { GoogleSheetsService } from './sheets';
import type { 
  ShippingMethod, ShippingRule, PackagingBox, Shipment,
  PartnerRegistry, Order
} from '@shared/schema';

export interface ShippingContext {
  orderValueEUR: number;
  totalWeightG: number;
  partnerID: string;
  partnerTier?: string;
  partnerType?: 'B2C' | 'B2B' | '';
  zone?: string;
  countryCode?: string;
}

export interface ShippingCalculation {
  selectedMethod: ShippingMethod;
  selectedBox?: PackagingBox;
  shippingCostEUR: number;
  packagingCostEUR: number;
  boxCostEUR: number;
  totalCostEUR: number;
  isFreeShipping: boolean;
  matchedRule?: ShippingRule;
  estimatedDays: { min: number; max: number };
}

export class ShippingService {
  constructor(private sheetsService: GoogleSheetsService) {}

  /**
   * Calculate shipping for an order based on rules engine
   */
  async calculateShipping(context: ShippingContext): Promise<ShippingCalculation> {
    // 1. Load all shipping data
    const [methods, rules, boxes, partners] = await Promise.all([
      this.sheetsService.getShippingMethods(),
      this.sheetsService.getShippingRules(),
      this.sheetsService.getPackagingBoxes(),
      this.sheetsService.getPartnerRegistry()
    ]);

    // 2. Clone context to avoid mutations
    const enrichedContext = { ...context };

    // 3. Enrich context with partner data if not provided
    const partner = partners.find(p => p.PartnerID === enrichedContext.partnerID);
    if (partner) {
      if (!enrichedContext.partnerTier) {
        enrichedContext.partnerTier = partner.Tier;
      }
      if (!enrichedContext.partnerType) {
        enrichedContext.partnerType = partner.PartnerType || '';
      }
      if (!enrichedContext.zone && partner.CountryCode) {
        enrichedContext.zone = this.getZoneFromCountryCode(partner.CountryCode);
      }
      if (!enrichedContext.countryCode) {
        enrichedContext.countryCode = partner.CountryCode;
      }
    }

    // 4. Filter active rules and sort by priority (lower number = higher priority)
    const activeRules = rules
      .filter(r => r.Active !== false)
      .sort((a, b) => (a.Priority || 100) - (b.Priority || 100));

    // 5. Find first matching rule
    const matchedRule = this.findMatchingRule(activeRules, enrichedContext);

    // 6. Get selected method (from rule or fallback to DHL)
    const methodID = matchedRule?.MethodID || 'DHL';
    const selectedMethod = methods.find(m => m.MethodID === methodID) || methods[0];

    // Guard: No shipping methods configured
    if (!selectedMethod) {
      throw new Error('No shipping methods configured. Please run bootstrap to seed default shipping methods.');
    }

    // 7. Determine shipping cost
    let shippingCostEUR = 0;
    let isFreeShipping = false;

    if (matchedRule) {
      if (matchedRule.FreeShipping) {
        isFreeShipping = true;
        shippingCostEUR = 0;
      } else {
        shippingCostEUR = matchedRule.ShippingCostEUR || selectedMethod.DefaultCostEUR || 0;
      }
    } else {
      // No rule matched - use method default
      shippingCostEUR = selectedMethod.DefaultCostEUR || 0;
    }

    // 8. Select appropriate packaging box
    const selectedBox = this.selectPackagingBox(boxes, enrichedContext.totalWeightG);
    const boxCostEUR = selectedBox?.unit_cost_eur || 0;
    const packagingCostEUR = boxCostEUR; // Can add additional packaging materials cost here

    // 9. Calculate total
    const totalCostEUR = shippingCostEUR + packagingCostEUR;

    return {
      selectedMethod,
      selectedBox,
      shippingCostEUR,
      packagingCostEUR,
      boxCostEUR,
      totalCostEUR,
      isFreeShipping,
      matchedRule,
      estimatedDays: {
        min: selectedMethod.MinDays || 1,
        max: selectedMethod.MaxDays || 5
      }
    };
  }

  /**
   * Find the first rule that matches the shipping context
   */
  private findMatchingRule(rules: ShippingRule[], context: ShippingContext): ShippingRule | undefined {
    for (const rule of rules) {
      // Check PartnerTier match
      if (rule.PartnerTier && rule.PartnerTier !== '' && rule.PartnerTier !== 'All') {
        if (rule.PartnerTier !== context.partnerTier) continue;
      }

      // Check PartnerType match
      if (rule.PartnerType && rule.PartnerType !== 'All') {
        if (rule.PartnerType !== context.partnerType) continue;
      }

      // Check MinOrderEUR
      if (rule.MinOrderEUR !== undefined && rule.MinOrderEUR !== null) {
        if (context.orderValueEUR < rule.MinOrderEUR) continue;
      }

      // Check MaxOrderEUR
      if (rule.MaxOrderEUR !== undefined && rule.MaxOrderEUR !== null) {
        if (context.orderValueEUR > rule.MaxOrderEUR) continue;
      }

      // Check Zone match
      if (rule.Zone && rule.Zone !== '' && rule.Zone !== 'ALL') {
        if (rule.Zone !== context.zone) continue;
      }

      // All criteria matched - return this rule
      return rule;
    }

    return undefined;
  }

  /**
   * Select appropriate packaging box based on weight
   */
  private selectPackagingBox(boxes: PackagingBox[], weightG: number): PackagingBox | undefined {
    // Filter active boxes that can handle the weight
    const weightKg = weightG / 1000;
    const suitableBoxes = boxes
      .filter(b => b.active !== false)
      .filter(b => !b.max_weight_kg || weightKg <= b.max_weight_kg)
      .sort((a, b) => (a.max_weight_kg || Infinity) - (b.max_weight_kg || Infinity));

    // Return smallest suitable box
    return suitableBoxes[0];
  }

  /**
   * Map country code to shipping zone
   */
  private getZoneFromCountryCode(countryCode: string): string {
    const code = countryCode.toUpperCase();
    
    // Germany
    if (code === 'DE') return 'DE';
    
    // EU countries
    const euCountries = [
      'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
      'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL',
      'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
    ];
    if (euCountries.includes(code)) return 'EU';
    
    // International
    return 'INT';
  }

  /**
   * Create a shipment record
   */
  async createShipment(
    orderID: string,
    partnerID: string,
    calculation: ShippingCalculation,
    deliveryAddress?: string
  ): Promise<Partial<Shipment>> {
    const shipment: Partial<Shipment> = {
      ShipmentID: `SHIP-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      OrderID: orderID,
      PartnerID: partnerID,
      CreatedTS: new Date().toISOString(),
      ShippingMethod: calculation.selectedMethod.MethodID,
      Weight_g: 0, // Will be set from order
      BoxID: calculation.selectedBox?.code || '',
      BoxCostEUR: calculation.boxCostEUR,
      PackagingCostEUR: calculation.packagingCostEUR,
      ShippingCostEUR: calculation.shippingCostEUR,
      TotalCostEUR: calculation.totalCostEUR,
      Status: 'Pending',
      DeliveryAddress: deliveryAddress,
      LabelGenerated: false,
      LabelPrinted: false,
      Notes: calculation.isFreeShipping ? 'Free shipping applied' : ''
    };

    return shipment;
  }

  /**
   * Get available shipping methods for a given context
   * Returns all methods that could potentially be used
   */
  async getAvailableMethodsForContext(context: ShippingContext): Promise<Array<{
    method: ShippingMethod;
    estimatedCostEUR: number;
    isFree: boolean;
  }>> {
    const [methods, rules, partners] = await Promise.all([
      this.sheetsService.getShippingMethods(),
      this.sheetsService.getShippingRules(),
      this.sheetsService.getPartnerRegistry()
    ]);

    // Clone and enrich context (same as calculateShipping)
    const enrichedContext = { ...context };
    const partner = partners.find(p => p.PartnerID === enrichedContext.partnerID);
    if (partner) {
      if (!enrichedContext.partnerTier) {
        enrichedContext.partnerTier = partner.Tier;
      }
      if (!enrichedContext.partnerType) {
        enrichedContext.partnerType = partner.PartnerType || '';
      }
      if (!enrichedContext.zone && partner.CountryCode) {
        enrichedContext.zone = this.getZoneFromCountryCode(partner.CountryCode);
      }
      if (!enrichedContext.countryCode) {
        enrichedContext.countryCode = partner.CountryCode;
      }
    }

    const activeMethods = methods.filter(m => m.Active !== false);
    
    // Guard: No active shipping methods
    if (activeMethods.length === 0) {
      throw new Error('No active shipping methods available. Please check Shipping_Methods sheet.');
    }

    const results: Array<{ method: ShippingMethod; estimatedCostEUR: number; isFree: boolean }> = [];

    for (const method of activeMethods) {
      // Find rule for this method
      const rule = rules
        .filter(r => r.Active !== false && r.MethodID === method.MethodID)
        .sort((a, b) => (a.Priority || 100) - (b.Priority || 100))
        .find(r => this.ruleMatches(r, enrichedContext));

      const isFree = rule?.FreeShipping || false;
      const cost = isFree ? 0 : (rule?.ShippingCostEUR || method.DefaultCostEUR || 0);

      results.push({
        method,
        estimatedCostEUR: cost,
        isFree
      });
    }

    return results;
  }

  /**
   * Check if a single rule matches the context
   */
  private ruleMatches(rule: ShippingRule, context: ShippingContext): boolean {
    if (rule.PartnerTier && rule.PartnerTier !== '' && rule.PartnerTier !== 'All') {
      if (rule.PartnerTier !== context.partnerTier) return false;
    }
    if (rule.PartnerType && rule.PartnerType !== 'All') {
      if (rule.PartnerType !== context.partnerType) return false;
    }
    if (rule.MinOrderEUR !== undefined && rule.MinOrderEUR !== null) {
      if (context.orderValueEUR < rule.MinOrderEUR) return false;
    }
    if (rule.MaxOrderEUR !== undefined && rule.MaxOrderEUR !== null) {
      if (context.orderValueEUR > rule.MaxOrderEUR) return false;
    }
    if (rule.Zone && rule.Zone !== '' && rule.Zone !== 'ALL') {
      if (rule.Zone !== context.zone) return false;
    }
    return true;
  }

  /**
   * Calculate volumetric weight (DHL formula: L×W×H cm³ / divisor)
   * Divisor is loaded from Settings sheet
   */
  async calculateVolumetricWeight(lengthCm: number, widthCm: number, heightCm: number): Promise<number> {
    const settings = await this.sheetsService.getSettings();
    const divisorSetting = settings.find(s => s.Key === 'shipping_volumetric_divisor');
    const divisor = divisorSetting ? Number(divisorSetting.Value) : 5000;
    return (lengthCm * widthCm * heightCm) / divisor;
  }

  /**
   * Smart cartonization algorithm for B2B orders
   * Returns optimal packaging solution based on fit, cube utilization, and cost
   */
  async cartonize(items: Array<{sku: string; qty: number; weight_g: number; dims_cm?: string}>): Promise<{
    boxes: Array<{boxCode: string; qty: number; items: Array<{sku: string; qty: number}>}>;
    totalCost: number;
    cubeUtilization: number;
  }> {
    const boxes = await this.sheetsService.getPackagingBoxes();
    
    // Simple greedy algorithm: try to fit items into smallest suitable box
    // TODO: Implement 3D bin packing for optimal cartonization
    
    const totalWeight = items.reduce((sum, item) => sum + (item.weight_g * item.qty), 0);
    const selectedBox = this.selectPackagingBox(boxes, totalWeight);
    
    if (!selectedBox) {
      throw new Error('No suitable packaging found for total weight: ' + totalWeight + 'g');
    }
    
    return {
      boxes: [{
        boxCode: selectedBox.code || 'UNKNOWN',
        qty: 1,
        items: items.map(i => ({ sku: i.sku, qty: i.qty }))
      }],
      totalCost: selectedBox.unit_cost_eur || 0,
      cubeUtilization: 0.75 // Placeholder - implement real calculation
    };
  }

  /**
   * Calculate per-unit shipping costs for each channel
   * Returns costs per unit for OwnStore, FBM, FBA, B2B
   */
  async calculatePerChannelShippingCosts(params: {
    actualKg: number;
    volumetricKg: number;
    unitsPerShipment: number;
    zone?: string;
    carrierId?: string;
  }): Promise<{
    chargeableKg: number;
    carrierId: string;
    costOwnStore: number;
    costFBM: number;
    costFBA: number;
    costB2B: number;
  }> {
    const chargeableKg = Math.max(params.actualKg, params.volumetricKg);
    const zone = params.zone || 'DE';
    const carrierId = params.carrierId || 'DHL_DE';
    const unitsPerShipment = params.unitsPerShipment || 1;

    // Lookup shipping cost from ShippingWeightBands (this is TOTAL shipment cost)
    const bands = await this.sheetsService.getShippingWeightBands();
    const band = bands.find(b => 
      b.carrierId === carrierId &&
      b.zone === zone &&
      b.active &&
      chargeableKg >= b.minKg &&
      chargeableKg <= b.maxKg
    );

    const baseCost = band?.baseEur || 0;
    const fuelSurcharge = band?.fuelPct ? baseCost * (band.fuelPct / 100) : 0;
    const totalShipmentCost = baseCost + fuelSurcharge;

    // Get channel-specific fixed costs
    const fixedCosts = await this.sheetsService.getShippingCostsFixed();
    
    const getFixedCost = (channel: string, costType: string): number => {
      // Try channel-specific first
      const channelCost = fixedCosts.find(c => 
        c.costType === costType && c.channel === channel
      )?.costEur;
      
      if (channelCost !== undefined) return channelCost;
      
      // Fallback to 'All' channel
      const allCost = fixedCosts.find(c => 
        c.costType === costType && c.channel === 'All'
      )?.costEur;
      
      return allCost || 0;
    };

    const labelCostOwnStore = getFixedCost('OwnStore', 'Label Fee');
    const labelCostFBM = getFixedCost('FBM', 'Label Fee');
    const labelCostFBA = getFixedCost('FBA', 'Label Fee');
    const labelCostB2B = getFixedCost('B2B', 'Label Fee');

    // Calculate per-unit costs by dividing shipment cost by units
    // OwnStore & FBM: (carrier cost + label fee) / units
    // FBA: Amazon handles (merchant cost = 0)
    // B2B: typically free for bulk

    return {
      chargeableKg,
      carrierId,
      costOwnStore: (totalShipmentCost + labelCostOwnStore) / unitsPerShipment,
      costFBM: (totalShipmentCost + labelCostFBM) / unitsPerShipment,
      costFBA: labelCostFBA / unitsPerShipment, // Only label fee, no carrier cost
      costB2B: labelCostB2B / unitsPerShipment  // Usually 0 for wholesale
    };
  }
}

export const shippingService = new ShippingService(
  // Will be injected when imported
  {} as GoogleSheetsService
);
