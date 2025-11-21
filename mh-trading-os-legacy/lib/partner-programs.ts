/**
 * Partner Programs Manager
 * Handles all 7 partner program types with commission calculation and validation
 */

import { createLogger } from './logger';
import { sheetsService } from './sheets';
import { nanoid } from 'nanoid';

const logger = createLogger('PartnerPrograms');

// ==================== TYPES ====================

export type ProgramType = 'Dealer' | 'Affiliate' | 'SalesRep' | 'Stand';
export type PaymentTerms = 'Net15' | 'Net30' | 'Net60' | 'COD';
export type RefillSchedule = 'Weekly' | 'BiWeekly' | 'Monthly';

export interface PartnerProgram {
  programID: string;
  programName: string;
  programType: ProgramType;
  commissionRate: number;
  minOrderValue: number;
  minOrderQty: number;
  discountTier: string;
  paymentTerms: PaymentTerms;
  active: boolean;
  
  // Affiliate specific
  cookieDays?: number;
  trackingPrefix?: string;
  paymentThreshold?: number;
  paymentMethod?: 'Bank' | 'PayPal';
  
  // Sales Rep specific
  territory?: string[];
  monthlyTarget?: number;
  bonusStructure?: { target: number; bonus: number }[];
  
  // Stand Partner specific
  inventoryLimit?: number;
  refillSchedule?: RefillSchedule;
  autoRefill?: boolean;
  
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  notes?: string;
}

export interface CommissionCalculation {
  commission: number;
  bonus?: number;
  total: number;
  breakdown: {
    baseCommission: number;
    bonusCommission?: number;
    tier?: string;
    targetAchieved?: boolean;
  };
}

export interface OrderValidation {
  valid: boolean;
  reason?: string;
  warnings?: string[];
}

// ==================== PARTNER PROGRAM MANAGER ====================

export class PartnerProgramManager {
  /**
   * Get all partner programs
   */
  async getAllPrograms(): Promise<PartnerProgram[]> {
    try {
      const rows = await sheetsService.getRows('PartnerPrograms');
      return rows.map(row => this.parseProgram(row));
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get partner programs');
      throw new Error(`Failed to get partner programs: ${error.message}`);
    }
  }
  
  /**
   * Get program by ID
   */
  async getProgram(programID: string): Promise<PartnerProgram | null> {
    try {
      const programs = await this.getAllPrograms();
      return programs.find(p => p.programID === programID) || null;
    } catch (error: any) {
      logger.error({ err: error, programID }, 'Failed to get program');
      return null;
    }
  }
  
  /**
   * Get programs by type
   */
  async getProgramsByType(type: ProgramType): Promise<PartnerProgram[]> {
    try {
      const programs = await this.getAllPrograms();
      return programs.filter(p => p.programType === type && p.active);
    } catch (error: any) {
      logger.error({ err: error, type }, 'Failed to get programs by type');
      return [];
    }
  }
  
  /**
   * Create new partner program
   */
  async createProgram(data: Omit<PartnerProgram, 'programID'>): Promise<PartnerProgram> {
    try {
      const programID = `PROG-${nanoid(6).toUpperCase()}`;
      const now = new Date().toISOString();
      
      const program: PartnerProgram = {
        ...data,
        programID,
        createdAt: now,
        updatedAt: now
      };
      
      const row = this.programToRow(program);
      await sheetsService.appendRows('PartnerPrograms', [row]);
      
      logger.info({ programID, programName: program.programName }, 'Partner program created');
      
      return program;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to create program');
      throw new Error(`Failed to create program: ${error.message}`);
    }
  }
  
  /**
   * Update existing program
   */
  async updateProgram(programID: string, updates: Partial<PartnerProgram>): Promise<boolean> {
    try {
      const program = await this.getProgram(programID);
      if (!program) {
        throw new Error(`Program ${programID} not found`);
      }
      
      const updated: PartnerProgram = {
        ...program,
        ...updates,
        programID, // Ensure ID doesn't change
        updatedAt: new Date().toISOString()
      };
      
      const row = this.programToRow(updated);
      const success = await sheetsService.updateRowByKey(
        'PartnerPrograms',
        'ProgramID',
        programID,
        row
      );
      
      if (success) {
        logger.info({ programID, updates }, 'Partner program updated');
      }
      
      return success;
    } catch (error: any) {
      logger.error({ err: error, programID, updates }, 'Failed to update program');
      return false;
    }
  }
  
  /**
   * Calculate commission for an order
   */
  async calculateCommission(
    programID: string,
    orderValue: number,
    orderQty: number,
    monthlyRevenue?: number
  ): Promise<CommissionCalculation> {
    try {
      const program = await this.getProgram(programID);
      
      if (!program) {
        throw new Error(`Program ${programID} not found`);
      }
      
      // Base commission
      const baseCommission = orderValue * program.commissionRate;
      let bonusCommission = 0;
      let targetAchieved = false;
      
      // Check for bonus (Sales Rep)
      if (program.programType === 'SalesRep' && program.bonusStructure && monthlyRevenue) {
        // Find applicable bonus tier
        const applicableTiers = program.bonusStructure
          .filter(tier => monthlyRevenue >= tier.target)
          .sort((a, b) => b.target - a.target);
        
        if (applicableTiers.length > 0) {
          const topTier = applicableTiers[0];
          bonusCommission = orderValue * topTier.bonus;
          targetAchieved = true;
        }
      }
      
      const total = baseCommission + bonusCommission;
      
      const result: CommissionCalculation = {
        commission: baseCommission,
        bonus: bonusCommission > 0 ? bonusCommission : undefined,
        total,
        breakdown: {
          baseCommission,
          bonusCommission: bonusCommission > 0 ? bonusCommission : undefined,
          tier: program.discountTier,
          targetAchieved
        }
      };
      
      logger.info({
        programID,
        orderValue,
        ...result
      }, 'Commission calculated');
      
      return result;
    } catch (error: any) {
      logger.error({ err: error, programID, orderValue }, 'Failed to calculate commission');
      throw new Error(`Failed to calculate commission: ${error.message}`);
    }
  }
  
  /**
   * Validate order against program requirements
   */
  async validateOrder(
    programID: string,
    orderValue: number,
    orderQty: number,
    partnerID?: string
  ): Promise<OrderValidation> {
    try {
      const program = await this.getProgram(programID);
      
      if (!program) {
        return { 
          valid: false, 
          reason: 'Program not found' 
        };
      }
      
      if (!program.active) {
        return { 
          valid: false, 
          reason: 'Program is not active' 
        };
      }
      
      const warnings: string[] = [];
      
      // Check minimum order value
      if (orderValue < program.minOrderValue) {
        return { 
          valid: false, 
          reason: `Minimum order value is ${program.minOrderValue} EUR` 
        };
      }
      
      // Check minimum order quantity
      if (orderQty < program.minOrderQty) {
        return { 
          valid: false, 
          reason: `Minimum order quantity is ${program.minOrderQty} units` 
        };
      }
      
      // Stand Partner specific validation
      if (program.programType === 'Stand' && program.inventoryLimit && partnerID) {
        const currentInventory = await this.getCurrentStandInventoryValue(partnerID);
        if (currentInventory + orderValue > program.inventoryLimit) {
          warnings.push(
            `Order will exceed inventory limit (${program.inventoryLimit} EUR). Current: ${currentInventory} EUR, After order: ${currentInventory + orderValue} EUR`
          );
        }
      }
      
      return { 
        valid: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error: any) {
      logger.error({ err: error, programID, orderValue }, 'Failed to validate order');
      return {
        valid: false,
        reason: `Validation error: ${error.message}`
      };
    }
  }
  
  /**
   * Generate affiliate tracking code
   */
  async generateAffiliateCode(programID: string, affiliateID: string): Promise<string> {
    try {
      const program = await this.getProgram(programID);
      
      if (!program || program.programType !== 'Affiliate') {
        throw new Error('Invalid affiliate program');
      }
      
      const prefix = program.trackingPrefix || 'AFF';
      const code = `${prefix}-${affiliateID}-${nanoid(8).toUpperCase()}`;
      
      logger.info({ programID, affiliateID, code }, 'Affiliate code generated');
      
      return code;
    } catch (error: any) {
      logger.error({ err: error, programID, affiliateID }, 'Failed to generate affiliate code');
      throw new Error(`Failed to generate affiliate code: ${error.message}`);
    }
  }
  
  /**
   * Get current stand inventory value (helper)
   */
  private async getCurrentStandInventoryValue(partnerID: string): Promise<number> {
    try {
      // This would query Stand_Inventory and sum up values
      // For now, return 0 as placeholder
      // TODO: Implement actual inventory value calculation
      return 0;
    } catch (error: any) {
      logger.error({ err: error, partnerID }, 'Failed to get stand inventory value');
      return 0;
    }
  }
  
  /**
   * Parse row to program
   */
  private parseProgram(row: any): PartnerProgram {
    return {
      programID: row.ProgramID,
      programName: row.ProgramName,
      programType: row.ProgramType as ProgramType,
      commissionRate: parseFloat(row.CommissionRate) || 0,
      minOrderValue: parseFloat(row.MinOrderValue) || 0,
      minOrderQty: parseInt(row.MinOrderQty) || 0,
      discountTier: row.DiscountTier || '',
      paymentTerms: row.PaymentTerms as PaymentTerms,
      active: row.Active === 'TRUE' || row.Active === true,
      
      // Parse optional fields based on type
      ...(row.CookieDays && { cookieDays: parseInt(row.CookieDays) }),
      ...(row.TrackingPrefix && { trackingPrefix: row.TrackingPrefix }),
      ...(row.PaymentThreshold && { paymentThreshold: parseFloat(row.PaymentThreshold) }),
      ...(row.PaymentMethod && { paymentMethod: row.PaymentMethod }),
      
      ...(row.TerritoryJSON && { 
        territory: JSON.parse(row.TerritoryJSON) 
      }),
      ...(row.MonthlyTarget && { monthlyTarget: parseFloat(row.MonthlyTarget) }),
      ...(row.BonusStructureJSON && { 
        bonusStructure: JSON.parse(row.BonusStructureJSON) 
      }),
      
      ...(row.InventoryLimit && { inventoryLimit: parseFloat(row.InventoryLimit) }),
      ...(row.RefillSchedule && { refillSchedule: row.RefillSchedule as RefillSchedule }),
      ...(row.AutoRefill && { autoRefill: row.AutoRefill === 'TRUE' || row.AutoRefill === true }),
      
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
      createdBy: row.CreatedBy,
      notes: row.Notes
    };
  }
  
  /**
   * Convert program to row
   */
  private programToRow(program: PartnerProgram): any {
    return {
      ProgramID: program.programID,
      ProgramName: program.programName,
      ProgramType: program.programType,
      CommissionRate: program.commissionRate,
      MinOrderValue: program.minOrderValue,
      MinOrderQty: program.minOrderQty,
      DiscountTier: program.discountTier,
      PaymentTerms: program.paymentTerms,
      Active: program.active ? 'TRUE' : 'FALSE',
      
      CookieDays: program.cookieDays || '',
      TrackingPrefix: program.trackingPrefix || '',
      PaymentThreshold: program.paymentThreshold || '',
      PaymentMethod: program.paymentMethod || '',
      
      TerritoryJSON: program.territory ? JSON.stringify(program.territory) : '',
      MonthlyTarget: program.monthlyTarget || '',
      BonusStructureJSON: program.bonusStructure ? JSON.stringify(program.bonusStructure) : '',
      
      InventoryLimit: program.inventoryLimit || '',
      RefillSchedule: program.refillSchedule || '',
      AutoRefill: program.autoRefill ? 'TRUE' : 'FALSE',
      
      CreatedAt: program.createdAt || new Date().toISOString(),
      UpdatedAt: program.updatedAt || new Date().toISOString(),
      CreatedBy: program.createdBy || 'System',
      Notes: program.notes || ''
    };
  }
}

// Export singleton instance
export const partnerProgramManager = new PartnerProgramManager();
