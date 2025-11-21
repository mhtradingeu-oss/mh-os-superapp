/**
 * Policy Engine
 * Manages and enforces stand partner policies for inventory, sales, returns, and payments
 */

import { createLogger } from './logger';
import { sheetsService } from './sheets';
import { nanoid } from 'nanoid';

const logger = createLogger('PolicyEngine');

// ==================== TYPES ====================

export type PaymentTerms = 'COD' | 'Net15' | 'Net30' | 'Net60';

export interface StandPolicy {
  policyID: string;
  partnerID: string;
  standID?: string;
  
  // Inventory Policies
  inventory: {
    maxInventoryValue: number;
    autoRefill: boolean;
    refillThreshold: number; // 0.30 = 30%
    allowedCategories: string[];
  };
  
  // Sales Policies
  sales: {
    canDiscount: boolean;
    maxDiscountPct: number;
    requiresApproval: boolean;
    approvalThreshold: number;
  };
  
  // Returns Policies
  returns: {
    allowReturns: boolean;
    returnWindowDays: number;
    restockingFeePct: number;
  };
  
  // Payment Policies
  payment: {
    paymentTerms: PaymentTerms;
    creditLimit: number;
    requireDeposit: boolean;
    depositPct: number;
  };
  
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
}

export interface PolicyValidation {
  valid: boolean;
  violations: string[];
  warnings: string[];
}

export interface DiscountApproval {
  approved: boolean;
  reason?: string;
  requiresManagerApproval?: boolean;
}

// ==================== POLICY ENGINE ====================

export class PolicyEngine {
  /**
   * Get all policies
   */
  async getAllPolicies(): Promise<StandPolicy[]> {
    try {
      const rows = await sheetsService.getRows('StandPolicies');
      return rows.map(row => this.parsePolicy(row));
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get policies');
      return [];
    }
  }
  
  /**
   * Get policy for partner
   */
  async getPartnerPolicy(partnerID: string, standID?: string): Promise<StandPolicy | null> {
    try {
      const policies = await this.getAllPolicies();
      
      // First try to find stand-specific policy
      if (standID) {
        const standPolicy = policies.find(
          p => p.partnerID === partnerID && p.standID === standID && p.active
        );
        if (standPolicy) return standPolicy;
      }
      
      // Fall back to partner-level policy
      const partnerPolicy = policies.find(
        p => p.partnerID === partnerID && !p.standID && p.active
      );
      
      return partnerPolicy || null;
    } catch (error: any) {
      logger.error({ err: error, partnerID, standID }, 'Failed to get partner policy');
      return null;
    }
  }
  
  /**
   * Create new policy
   */
  async createPolicy(data: Omit<StandPolicy, 'policyID'>): Promise<StandPolicy> {
    try {
      const policyID = `POL-${nanoid(6).toUpperCase()}`;
      const now = new Date().toISOString();
      
      const policy: StandPolicy = {
        ...data,
        policyID,
        createdAt: now,
        updatedAt: now
      };
      
      const row = this.policyToRow(policy);
      await sheetsService.appendRows('StandPolicies', [row]);
      
      logger.info({ policyID, partnerID: policy.partnerID }, 'Policy created');
      
      return policy;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to create policy');
      throw new Error(`Failed to create policy: ${error.message}`);
    }
  }
  
  /**
   * Update policy
   */
  async updatePolicy(policyID: string, updates: Partial<StandPolicy>): Promise<boolean> {
    try {
      const policies = await this.getAllPolicies();
      const policy = policies.find(p => p.policyID === policyID);
      
      if (!policy) {
        throw new Error('Policy not found');
      }
      
      const updated: StandPolicy = {
        ...policy,
        ...updates,
        policyID, // Ensure ID doesn't change
        updatedAt: new Date().toISOString()
      };
      
      const row = this.policyToRow(updated);
      const success = await sheetsService.updateRowByKey(
        'StandPolicies',
        'PolicyID',
        policyID,
        row
      );
      
      if (success) {
        logger.info({ policyID, updates }, 'Policy updated');
      }
      
      return success;
    } catch (error: any) {
      logger.error({ err: error, policyID, updates }, 'Failed to update policy');
      return false;
    }
  }
  
  /**
   * Validate inventory against policy
   */
  async validateInventory(
    partnerID: string,
    currentInventoryValue: number,
    newOrderValue: number,
    productCategories: string[],
    standID?: string
  ): Promise<PolicyValidation> {
    try {
      const policy = await this.getPartnerPolicy(partnerID, standID);
      
      if (!policy) {
        return {
          valid: true,
          violations: [],
          warnings: ['No policy found for partner - proceeding without restrictions']
        };
      }
      
      const violations: string[] = [];
      const warnings: string[] = [];
      
      // Check inventory limit
      const totalAfterOrder = currentInventoryValue + newOrderValue;
      if (totalAfterOrder > policy.inventory.maxInventoryValue) {
        violations.push(
          `Inventory limit exceeded. Current: ${currentInventoryValue} EUR, New Order: ${newOrderValue} EUR, Total: ${totalAfterOrder} EUR, Limit: ${policy.inventory.maxInventoryValue} EUR`
        );
      }
      
      // Check allowed categories
      if (policy.inventory.allowedCategories.length > 0) {
        const disallowedCategories = productCategories.filter(
          cat => !policy.inventory.allowedCategories.includes(cat)
        );
        
        if (disallowedCategories.length > 0) {
          violations.push(
            `Categories not allowed: ${disallowedCategories.join(', ')}. Allowed: ${policy.inventory.allowedCategories.join(', ')}`
          );
        }
      }
      
      // Check refill threshold (warning only)
      const percentageUsed = (currentInventoryValue / policy.inventory.maxInventoryValue) * 100;
      const thresholdPct = policy.inventory.refillThreshold * 100;
      
      if (percentageUsed < thresholdPct && policy.inventory.autoRefill) {
        warnings.push(
          `Inventory below refill threshold (${thresholdPct}%). Current: ${percentageUsed.toFixed(1)}%. Auto-refill will be triggered.`
        );
      }
      
      const result: PolicyValidation = {
        valid: violations.length === 0,
        violations,
        warnings
      };
      
      logger.info({
        partnerID,
        standID,
        currentInventoryValue,
        newOrderValue,
        result
      }, 'Inventory validated');
      
      return result;
    } catch (error: any) {
      logger.error({ err: error, partnerID }, 'Failed to validate inventory');
      return {
        valid: false,
        violations: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }
  
  /**
   * Validate discount against policy
   */
  async validateDiscount(
    partnerID: string,
    discountPct: number,
    orderValue: number,
    standID?: string
  ): Promise<DiscountApproval> {
    try {
      const policy = await this.getPartnerPolicy(partnerID, standID);
      
      if (!policy) {
        return {
          approved: true,
          reason: 'No policy found - discount allowed'
        };
      }
      
      // Check if discounts are allowed at all
      if (!policy.sales.canDiscount) {
        return {
          approved: false,
          reason: 'Discounts not allowed per policy'
        };
      }
      
      // Check max discount percentage
      if (discountPct > policy.sales.maxDiscountPct) {
        return {
          approved: false,
          reason: `Discount ${(discountPct * 100).toFixed(1)}% exceeds maximum ${(policy.sales.maxDiscountPct * 100).toFixed(1)}%`
        };
      }
      
      // Check if approval required based on threshold
      if (policy.sales.requiresApproval && orderValue >= policy.sales.approvalThreshold) {
        return {
          approved: false,
          reason: `Order value ${orderValue} EUR exceeds approval threshold ${policy.sales.approvalThreshold} EUR`,
          requiresManagerApproval: true
        };
      }
      
      logger.info({
        partnerID,
        standID,
        discountPct,
        orderValue,
        approved: true
      }, 'Discount validated');
      
      return {
        approved: true
      };
    } catch (error: any) {
      logger.error({ err: error, partnerID, discountPct }, 'Failed to validate discount');
      return {
        approved: false,
        reason: `Validation error: ${error.message}`
      };
    }
  }
  
  /**
   * Validate return against policy
   */
  async validateReturn(
    partnerID: string,
    orderDate: Date,
    standID?: string
  ): Promise<PolicyValidation> {
    try {
      const policy = await this.getPartnerPolicy(partnerID, standID);
      
      if (!policy) {
        return {
          valid: true,
          violations: [],
          warnings: ['No policy found - return allowed']
        };
      }
      
      const violations: string[] = [];
      const warnings: string[] = [];
      
      // Check if returns are allowed
      if (!policy.returns.allowReturns) {
        violations.push('Returns not allowed per policy');
      } else {
        // Check return window
        const now = new Date();
        const daysSinceOrder = Math.floor(
          (now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceOrder > policy.returns.returnWindowDays) {
          violations.push(
            `Return window expired. Days since order: ${daysSinceOrder}, Window: ${policy.returns.returnWindowDays} days`
          );
        }
        
        // Add restocking fee warning
        if (policy.returns.restockingFeePct > 0) {
          warnings.push(
            `Restocking fee of ${(policy.returns.restockingFeePct * 100).toFixed(1)}% will be applied`
          );
        }
      }
      
      const result: PolicyValidation = {
        valid: violations.length === 0,
        violations,
        warnings
      };
      
      logger.info({
        partnerID,
        standID,
        orderDate,
        result
      }, 'Return validated');
      
      return result;
    } catch (error: any) {
      logger.error({ err: error, partnerID }, 'Failed to validate return');
      return {
        valid: false,
        violations: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }
  
  /**
   * Check credit limit
   */
  async checkCreditLimit(
    partnerID: string,
    currentOutstanding: number,
    newOrderValue: number,
    standID?: string
  ): Promise<PolicyValidation> {
    try {
      const policy = await this.getPartnerPolicy(partnerID, standID);
      
      if (!policy) {
        return {
          valid: true,
          violations: [],
          warnings: ['No policy found - proceeding']
        };
      }
      
      const violations: string[] = [];
      const warnings: string[] = [];
      
      // COD doesn't need credit check
      if (policy.payment.paymentTerms === 'COD') {
        return {
          valid: true,
          violations: [],
          warnings: ['Payment terms: COD - no credit limit applies']
        };
      }
      
      // Check credit limit
      const totalAfterOrder = currentOutstanding + newOrderValue;
      if (totalAfterOrder > policy.payment.creditLimit) {
        violations.push(
          `Credit limit exceeded. Current Outstanding: ${currentOutstanding} EUR, New Order: ${newOrderValue} EUR, Total: ${totalAfterOrder} EUR, Limit: ${policy.payment.creditLimit} EUR`
        );
      }
      
      // Check deposit requirement
      if (policy.payment.requireDeposit) {
        const depositRequired = newOrderValue * policy.payment.depositPct;
        warnings.push(
          `Deposit of ${depositRequired.toFixed(2)} EUR (${(policy.payment.depositPct * 100).toFixed(0)}%) required`
        );
      }
      
      const result: PolicyValidation = {
        valid: violations.length === 0,
        violations,
        warnings
      };
      
      logger.info({
        partnerID,
        standID,
        currentOutstanding,
        newOrderValue,
        result
      }, 'Credit limit checked');
      
      return result;
    } catch (error: any) {
      logger.error({ err: error, partnerID }, 'Failed to check credit limit');
      return {
        valid: false,
        violations: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }
  
  /**
   * Parse policy from row
   */
  private parsePolicy(row: any): StandPolicy {
    const allowedCategoriesJSON = row.AllowedCategoriesJSON 
      ? JSON.parse(row.AllowedCategoriesJSON) 
      : [];
    
    return {
      policyID: row.PolicyID,
      partnerID: row.PartnerID,
      standID: row.StandID || undefined,
      
      inventory: {
        maxInventoryValue: parseFloat(row.MaxInventoryValue) || 0,
        autoRefill: row.AutoRefill === 'TRUE' || row.AutoRefill === true,
        refillThreshold: parseFloat(row.RefillThreshold) || 0.30,
        allowedCategories: allowedCategoriesJSON
      },
      
      sales: {
        canDiscount: row.CanDiscount === 'TRUE' || row.CanDiscount === true,
        maxDiscountPct: parseFloat(row.MaxDiscountPct) || 0,
        requiresApproval: row.RequiresApproval === 'TRUE' || row.RequiresApproval === true,
        approvalThreshold: parseFloat(row.ApprovalThreshold) || 0
      },
      
      returns: {
        allowReturns: row.AllowReturns === 'TRUE' || row.AllowReturns === true,
        returnWindowDays: parseInt(row.ReturnWindowDays) || 14,
        restockingFeePct: parseFloat(row.RestockingFeePct) || 0
      },
      
      payment: {
        paymentTerms: row.PaymentTerms as PaymentTerms,
        creditLimit: parseFloat(row.CreditLimit) || 0,
        requireDeposit: row.RequireDeposit === 'TRUE' || row.RequireDeposit === true,
        depositPct: parseFloat(row.DepositPct) || 0
      },
      
      active: row.Active === 'TRUE' || row.Active === true,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
      notes: row.Notes
    };
  }
  
  /**
   * Convert policy to row
   */
  private policyToRow(policy: StandPolicy): any {
    return {
      PolicyID: policy.policyID,
      PartnerID: policy.partnerID,
      StandID: policy.standID || '',
      
      MaxInventoryValue: policy.inventory.maxInventoryValue,
      AutoRefill: policy.inventory.autoRefill ? 'TRUE' : 'FALSE',
      RefillThreshold: policy.inventory.refillThreshold,
      AllowedCategoriesJSON: JSON.stringify(policy.inventory.allowedCategories),
      
      CanDiscount: policy.sales.canDiscount ? 'TRUE' : 'FALSE',
      MaxDiscountPct: policy.sales.maxDiscountPct,
      RequiresApproval: policy.sales.requiresApproval ? 'TRUE' : 'FALSE',
      ApprovalThreshold: policy.sales.approvalThreshold,
      
      AllowReturns: policy.returns.allowReturns ? 'TRUE' : 'FALSE',
      ReturnWindowDays: policy.returns.returnWindowDays,
      RestockingFeePct: policy.returns.restockingFeePct,
      
      PaymentTerms: policy.payment.paymentTerms,
      CreditLimit: policy.payment.creditLimit,
      RequireDeposit: policy.payment.requireDeposit ? 'TRUE' : 'FALSE',
      DepositPct: policy.payment.depositPct,
      
      Active: policy.active ? 'TRUE' : 'FALSE',
      CreatedAt: policy.createdAt || new Date().toISOString(),
      UpdatedAt: policy.updatedAt || new Date().toISOString(),
      Notes: policy.notes || ''
    };
  }
}

// Export singleton instance
export const policyEngine = new PolicyEngine();
