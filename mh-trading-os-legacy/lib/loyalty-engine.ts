/**
 * Loyalty Engine
 * Complete loyalty system with points, tiers, and rewards
 */

import { createLogger } from './logger';
import { sheetsService } from './sheets';
import { nanoid } from 'nanoid';
import { DEFAULT_LOYALTY_TIERS, LoyaltyTier } from './advanced-partner-schemas';

const logger = createLogger('LoyaltyEngine');

// ==================== TYPES ====================

export type LoyaltyTransactionType = 'Earn' | 'Redeem' | 'Expire' | 'Bonus' | 'Adjustment';
export type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface LoyaltyProgram {
  programID: string;
  programName: string;
  active: boolean;
  
  earningRules: {
    pointsPerEuro: number;
    minPurchase: number;
    bonusCategories: { category: string; multiplier: number }[];
    birthdayBonus: number;
    referralBonus: number;
  };
  
  redemptionRules: {
    pointsToEuro: number;
    minRedemption: number;
    maxPerOrderPct: number;
    expiryDays: number;
  };
  
  tiers: LoyaltyTier[];
  
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
}

export interface CustomerLoyalty {
  customerID: string;
  programID: string;
  currentPoints: number;
  lifetimePoints: number;
  pointsRedeemed: number;
  currentTier: TierName;
  nextTierPoints: number;
  memberSince: string;
  lastActivity: string;
  pointsExpiryDate: string;
  referralCode: string;
  referralCount: number;
  birthday?: string;
  birthdayBonusUsed: boolean;
  notes?: string;
}

export interface LoyaltyTransaction {
  transactionID: string;
  customerID: string;
  transactionType: LoyaltyTransactionType;
  points: number;
  relatedOrderID?: string;
  description: string;
  createdAt: string;
  expiryDate?: string;
  processedBy: string;
  notes?: string;
}

export interface PointsEarned {
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  breakdown: {
    orderValue: number;
    baseRate: number;
    categoryMultipliers: { category: string; bonus: number }[];
    tierMultiplier?: number;
    birthdayBonus?: number;
  };
}

export interface RedemptionResult {
  success: boolean;
  discountAmount: number;
  pointsUsed: number;
  remainingPoints: number;
  reason?: string;
}

export interface TierUpgrade {
  upgraded: boolean;
  oldTier?: TierName;
  newTier?: TierName;
  benefits?: any;
}

// ==================== LOYALTY ENGINE ====================

/**
 * Helper: Update CustomerLoyalty row with composite key (CustomerID + ProgramID)
 * CRITICAL: Ensures correct row is updated even if customer has multiple programs
 * CONCURRENCY: Uses optimistic locking via LastActivity to prevent lost updates
 */
async function updateCustomerLoyaltyRow(
  customerID: string,
  programID: string,
  updates: Partial<Record<string, any>>,
  expectedLastActivity?: string  // Optimistic lock: verify row hasn't changed
): Promise<void> {
  // CRITICAL: Get raw sheet data to work with actual Google Sheets headers (PascalCase)
  const sheets = await sheetsService.getClient();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEETS_SPREADSHEET_ID!,
    range: `CustomerLoyalty!A:ZZ`,
  });
  
  const rows = result.data.values;
  if (!rows || rows.length < 2) {
    throw new Error('CustomerLoyalty sheet has no data');
  }
  
  const headers = rows[0];
  const customerIDIndex = headers.indexOf('CustomerID');
  const programIDIndex = headers.indexOf('ProgramID');
  const lastActivityIndex = headers.indexOf('LastActivity');
  
  if (customerIDIndex === -1 || programIDIndex === -1) {
    throw new Error('CustomerLoyalty sheet missing CustomerID or ProgramID columns');
  }
  
  // Find exact row with composite key in data rows (skip header)
  const dataRows = rows.slice(1); // Skip header row
  const dataRowIndex = dataRows.findIndex(row => 
    row[customerIDIndex] === customerID && row[programIDIndex] === programID
  );
  
  if (dataRowIndex === -1) {
    throw new Error(`CustomerLoyalty record not found for ${customerID} in program ${programID}`);
  }
  
  // OPTIMISTIC LOCK: Verify row hasn't been modified by another process
  if (expectedLastActivity && lastActivityIndex !== -1) {
    const currentLastActivity = dataRows[dataRowIndex][lastActivityIndex];
    if (currentLastActivity !== expectedLastActivity) {
      throw new Error(`CONCURRENCY_CONFLICT: CustomerLoyalty row modified (expected: ${expectedLastActivity}, current: ${currentLastActivity})`);
    }
  }
  
  // Convert to Google Sheets row number
  // dataRowIndex 0 = rows[1] = Sheet Row 2 (first data row)
  // dataRowIndex N = rows[N+1] = Sheet Row N+2
  const sheetRow = dataRowIndex + 2;
  
  // CRITICAL: Map camelCase field names to PascalCase Google Sheets headers
  const fieldMapping: Record<string, string> = {
    'customerID': 'CustomerID',
    'programID': 'ProgramID',
    'currentPoints': 'CurrentPoints',
    'lifetimePoints': 'LifetimePoints',
    'pointsRedeemed': 'PointsRedeemed',
    'currentTier': 'CurrentTier',
    'nextTierPoints': 'NextTierPoints',
    'memberSince': 'MemberSince',
    'lastActivity': 'LastActivity',
    'pointsExpiryDate': 'PointsExpiryDate',
    'referralCode': 'ReferralCode',
    'referralCount': 'ReferralCount',
    'birthdayBonusUsed': 'BirthdayBonusUsed',
    // Allow PascalCase pass-through
    'CustomerID': 'CustomerID',
    'ProgramID': 'ProgramID',
    'CurrentPoints': 'CurrentPoints',
    'LifetimePoints': 'LifetimePoints',
    'PointsRedeemed': 'PointsRedeemed',
    'CurrentTier': 'CurrentTier',
    'NextTierPoints': 'NextTierPoints',
    'MemberSince': 'MemberSince',
    'LastActivity': 'LastActivity',
    'PointsExpiryDate': 'PointsExpiryDate',
    'ReferralCode': 'ReferralCode',
    'ReferralCount': 'ReferralCount',
    'BirthdayBonusUsed': 'BirthdayBonusUsed'
  };
  
  // CRITICAL: Use single batch update for ALL cells to ensure atomicity
  // Build column ranges for batch update
  const batchData: Array<{ range: string; values: any[][] }> = [];
  const unknownFields: string[] = [];
  
  for (const [key, value] of Object.entries(updates)) {
    const headerKey = fieldMapping[key] || key;
    const colIndex = headers.indexOf(headerKey);
    if (colIndex !== -1) {
      const cellAddress = `CustomerLoyalty!${columnToLetter(colIndex)}${sheetRow}`;
      batchData.push({
        range: cellAddress,
        values: [[value]]
      });
    } else {
      unknownFields.push(key);
    }
  }
  
  if (unknownFields.length > 0) {
    logger.warn({ unknownFields, customerID, programID }, 'Fields not found in CustomerLoyalty headers');
  }
  
  if (batchData.length === 0) {
    logger.warn({ customerID, programID, updates }, 'No valid fields to update');
    return;
  }
  
  // Single atomic batch update - ALL cells updated together or none
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: process.env.SHEETS_SPREADSHEET_ID!,
    requestBody: {
      valueInputOption: 'RAW',
      data: batchData
    }
  });
  
  logger.info({ customerID, programID, updatedFields: Object.keys(updates).length }, 'CustomerLoyalty row updated with composite key (batch)');
}

/**
 * Convert column index to letter (A, B, C, ..., Z, AA, AB, ...)
 */
function columnToLetter(index: number): string {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

/**
 * Retry helper for optimistic locking conflicts
 * Retries operation up to maxAttempts times when CONCURRENCY_CONFLICT occurs
 */
async function retryWithOptimisticLock<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      if (error.message?.includes('CONCURRENCY_CONFLICT') && attempt < maxAttempts) {
        logger.warn({ attempt, maxAttempts, error: error.message }, 'Concurrency conflict detected, retrying...');
        // Small delay before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }
      
      // Not a concurrency error or max attempts reached
      throw error;
    }
  }
  
  throw lastError;
}

export class LoyaltyEngine {
  /**
   * Get loyalty program
   */
  async getProgram(programID: string = 'LOY-001'): Promise<LoyaltyProgram | null> {
    try {
      const rows = await sheetsService.getRows('LoyaltyPrograms');
      const row = rows.find(r => r.ProgramID === programID);
      
      if (!row) return null;
      
      return this.parseProgram(row);
    } catch (error: any) {
      logger.error({ err: error, programID }, 'Failed to get loyalty program');
      return null;
    }
  }
  
  /**
   * Get customer loyalty info
   */
  async getCustomerLoyalty(customerID: string, programID: string = 'LOY-001'): Promise<CustomerLoyalty | null> {
    try {
      const rows = await sheetsService.getRows('CustomerLoyalty');
      const row = rows.find(r => r.CustomerID === customerID && r.ProgramID === programID);
      
      if (!row) {
        // Create new loyalty record for first-time customer
        return await this.createCustomerLoyalty(customerID, programID);
      }
      
      return this.parseCustomerLoyalty(row);
    } catch (error: any) {
      logger.error({ err: error, customerID }, 'Failed to get customer loyalty');
      return null;
    }
  }
  
  /**
   * Create new customer loyalty record
   */
  async createCustomerLoyalty(customerID: string, programID: string = 'LOY-001'): Promise<CustomerLoyalty> {
    try {
      const now = new Date().toISOString();
      const oneYearLater = new Date();
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      
      const referralCode = `${customerID.substring(0, 6)}-REF-${nanoid(6).toUpperCase()}`;
      
      const customerLoyalty: CustomerLoyalty = {
        customerID,
        programID,
        currentPoints: 0,
        lifetimePoints: 0,
        pointsRedeemed: 0,
        currentTier: 'Bronze',
        nextTierPoints: 5000, // Points needed for Silver
        memberSince: now,
        lastActivity: now,
        pointsExpiryDate: oneYearLater.toISOString(),
        referralCode,
        referralCount: 0,
        birthdayBonusUsed: false
      };
      
      const row = this.customerLoyaltyToRow(customerLoyalty);
      await sheetsService.appendRows('CustomerLoyalty', [row]);
      
      logger.info({ customerID, programID }, 'Customer loyalty created');
      
      return customerLoyalty;
    } catch (error: any) {
      logger.error({ err: error, customerID }, 'Failed to create customer loyalty');
      throw new Error(`Failed to create customer loyalty: ${error.message}`);
    }
  }
  
  /**
   * Calculate points earned from an order
   */
  async calculatePointsEarned(
    customerID: string,
    orderValue: number,
    orderCategories: string[] = [],
    programID: string = 'LOY-001'
  ): Promise<PointsEarned> {
    try {
      const program = await this.getProgram(programID);
      if (!program) {
        throw new Error('Loyalty program not found');
      }
      
      const customer = await this.getCustomerLoyalty(customerID, programID);
      if (!customer) {
        throw new Error('Customer loyalty not found');
      }
      
      // Check minimum purchase
      if (orderValue < program.earningRules.minPurchase) {
        return {
          basePoints: 0,
          bonusPoints: 0,
          totalPoints: 0,
          breakdown: {
            orderValue,
            baseRate: program.earningRules.pointsPerEuro,
            categoryMultipliers: []
          }
        };
      }
      
      // Base points
      let basePoints = Math.floor(orderValue * program.earningRules.pointsPerEuro);
      let bonusPoints = 0;
      const categoryMultipliers: { category: string; bonus: number }[] = [];
      
      // Bonus for categories
      for (const cat of orderCategories) {
        const bonus = program.earningRules.bonusCategories.find(
          b => b.category === cat
        );
        if (bonus) {
          const categoryBonus = Math.floor(basePoints * (bonus.multiplier - 1));
          bonusPoints += categoryBonus;
          categoryMultipliers.push({
            category: cat,
            bonus: categoryBonus
          });
        }
      }
      
      // Tier multiplier
      const tier = program.tiers.find(t => t.name === customer.currentTier);
      let tierMultiplier: number | undefined;
      if (tier && tier.benefits.pointsMultiplier > 1) {
        tierMultiplier = Math.floor(basePoints * (tier.benefits.pointsMultiplier - 1));
        bonusPoints += tierMultiplier;
      }
      
      // Birthday bonus (if applicable)
      let birthdayBonus: number | undefined;
      if (customer.birthday && !customer.birthdayBonusUsed) {
        const today = new Date();
        const birthday = new Date(customer.birthday);
        if (today.getMonth() === birthday.getMonth()) {
          birthdayBonus = program.earningRules.birthdayBonus;
          bonusPoints += birthdayBonus;
          
          // Mark birthday bonus as used
          await this.markBirthdayBonusUsed(customerID, programID);
        }
      }
      
      const totalPoints = basePoints + bonusPoints;
      
      const result: PointsEarned = {
        basePoints,
        bonusPoints,
        totalPoints,
        breakdown: {
          orderValue,
          baseRate: program.earningRules.pointsPerEuro,
          categoryMultipliers,
          tierMultiplier,
          birthdayBonus
        }
      };
      
      logger.info({
        customerID,
        orderValue,
        ...result
      }, 'Points calculated');
      
      return result;
    } catch (error: any) {
      logger.error({ err: error, customerID, orderValue }, 'Failed to calculate points');
      throw new Error(`Failed to calculate points: ${error.message}`);
    }
  }
  
  /**
   * Restore points WITHOUT affecting lifetimePoints (for rollback only)
   * CRITICAL: Use this ONLY for failure rollback - reverses redemption completely
   * - Restores currentPoints
   * - Decrements pointsRedeemed
   * - Does NOT touch lifetimePoints
   * - Does NOT trigger tier checks
   */
  async restorePoints(
    customerID: string,
    points: number,
    orderID?: string,
    description: string = 'Points restored (rollback)',
    programID: string = 'LOY-001'
  ): Promise<boolean> {
    try {
      const program = await this.getProgram(programID);
      if (!program) {
        throw new Error('Loyalty program not found');
      }
      
      // CRITICAL: Retry with optimistic locking to prevent rollback conflicts
      return await retryWithOptimisticLock(async () => {
        // Fetch fresh customer data on each attempt
        const customer = await this.getCustomerLoyalty(customerID, programID);
        if (!customer) {
          throw new Error('Customer loyalty not found');
        }
        
        // Calculate new values based on fresh data
        const newCurrentPoints = customer.currentPoints + points;
        const newPointsRedeemed = Math.max(0, customer.pointsRedeemed - points);
        
        // Recalculate expiry date for restored points
        const newExpiryDate = new Date();
        newExpiryDate.setDate(newExpiryDate.getDate() + program.redemptionRules.expiryDays);
        
        // Step 1: Update CustomerLoyalty sheet with optimistic lock
        await updateCustomerLoyaltyRow(
          customerID, 
          programID, 
          {
            CustomerID: customerID,
            ProgramID: programID,
            CurrentPoints: newCurrentPoints,
            PointsRedeemed: newPointsRedeemed,
            PointsExpiryDate: newExpiryDate.toISOString(),
            LastActivity: new Date().toISOString()
          },
          customer.lastActivity  // Optimistic lock: verify not modified since read
        );
        
        // Step 2: Log transaction ONLY if sheet update succeeded
        try {
          await this.logTransaction({
            customerID,
            transactionType: 'Adjustment',
            points,
            relatedOrderID: orderID,
            description
          });
        } catch (logError: any) {
          // Sheet update succeeded but logging failed - log warning but continue
          logger.warn({ 
            err: logError, 
            customerID, 
            points 
          }, 'Points restored but transaction logging failed');
        }
        
        logger.info({ 
          customerID, 
          points, 
          newCurrentPoints, 
          newPointsRedeemed,
          rollback: true 
        }, 'Points restored successfully (redemption fully reversed)');
        
        return true;
      }); // Close retryWithOptimisticLock
    } catch (error: any) {
      logger.error({ err: error, customerID, points }, 'Failed to restore points (rollback failed)');
      return false;
    }
  }
  
  /**
   * Add points to customer account (increments lifetime points and checks tier)
   */
  async addPoints(
    customerID: string,
    points: number,
    orderID?: string,
    description: string = 'Points earned',
    programID: string = 'LOY-001'
  ): Promise<boolean> {
    try {
      const program = await this.getProgram(programID);
      if (!program) {
        throw new Error('Loyalty program not found');
      }
      
      // CRITICAL: Retry with optimistic locking to prevent lost updates
      const success = await retryWithOptimisticLock(async () => {
        // Fetch fresh customer data on each attempt
        const customer = await this.getCustomerLoyalty(customerID, programID);
        if (!customer) {
          throw new Error('Customer loyalty not found');
        }
        
        // Calculate new values based on fresh data
        const newCurrentPoints = customer.currentPoints + points;
        const newLifetimePoints = customer.lifetimePoints + points;
        
        // Calculate new expiry date
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + program.redemptionRules.expiryDays);
        
        // Step 1: Update CustomerLoyalty sheet with optimistic lock
        await updateCustomerLoyaltyRow(
          customerID, 
          programID, 
          {
            CustomerID: customerID,
            ProgramID: programID,
            CurrentPoints: newCurrentPoints,
            LifetimePoints: newLifetimePoints,
            LastActivity: new Date().toISOString(),
            PointsExpiryDate: expiryDate.toISOString()
          },
          customer.lastActivity  // Optimistic lock: verify not modified since read
        );
        
        // Step 2: Log transaction ONLY if sheet update succeeded
        try {
          await this.logTransaction({
            customerID,
            transactionType: 'Earn',
            points,
            relatedOrderID: orderID,
            description,
            expiryDate: expiryDate.toISOString()
          });
        } catch (logError: any) {
          // Sheet update succeeded but logging failed - log warning but continue
          logger.warn({ 
            err: logError, 
            customerID, 
            points 
          }, 'Points added but transaction logging failed');
        }
        
        // Step 3: Check for tier upgrade (only if sheet update succeeded)
        try {
          await this.checkTierUpgrade(customerID, programID);
        } catch (tierError: any) {
          // Sheet update succeeded but tier check failed - log warning but continue
          logger.warn({ 
            err: tierError, 
            customerID 
          }, 'Points added but tier upgrade check failed');
        }
        
        logger.info({ customerID, points, newCurrentPoints }, 'Points added successfully');
        
        return true;
      }); // Close retryWithOptimisticLock
      
      return success;
    } catch (error: any) {
      logger.error({ err: error, customerID, points }, 'Failed to add points');
      return false;
    }
  }
  
  /**
   * Preview redemption WITHOUT deducting points (read-only validation)
   * Use this for quote validation, UI previews, etc.
   */
  async previewRedemption(
    customerID: string,
    pointsToRedeem: number,
    orderValue: number,
    programID: string = 'LOY-001'
  ): Promise<RedemptionResult> {
    try {
      const program = await this.getProgram(programID);
      if (!program) {
        return {
          success: false,
          pointsUsed: 0,
          discountAmount: 0,
          reason: 'Loyalty program not found'
        };
      }
      
      const customer = await this.getCustomerLoyalty(customerID, programID);
      if (!customer) {
        return {
          success: false,
          pointsUsed: 0,
          discountAmount: 0,
          reason: 'Customer loyalty not found'
        };
      }
      
      // Validate minimum redemption
      if (pointsToRedeem < program.redemptionRules.minRedemption) {
        return {
          success: false,
          pointsUsed: 0,
          discountAmount: 0,
          reason: `Minimum ${program.redemptionRules.minRedemption} points required`
        };
      }
      
      // Check customer has enough points
      if (pointsToRedeem > customer.currentPoints) {
        return {
          success: false,
          pointsUsed: 0,
          discountAmount: 0,
          reason: `Insufficient points. Available: ${customer.currentPoints}, Requested: ${pointsToRedeem}`
        };
      }
      
      // Calculate discount (points / conversion rate)
      // e.g., 1000 points / 100 = 10 EUR discount
      const discountAmount = pointsToRedeem / program.redemptionRules.pointsToEuro;
      
      // Validate max discount percentage (e.g., maxPerOrderPct = 0.50 = 50%)
      const maxDiscount = orderValue * program.redemptionRules.maxPerOrderPct;
      
      // CRITICAL: Match redeemPoints() behavior - REJECT if exceeds max
      if (discountAmount > maxDiscount) {
        const maxAllowedPoints = Math.floor(maxDiscount * program.redemptionRules.pointsToEuro);
        return {
          success: false,
          pointsUsed: 0,
          discountAmount: 0,
          reason: `Maximum ${(program.redemptionRules.maxPerOrderPct * 100)}% of order (${maxDiscount.toFixed(2)} EUR, ${maxAllowedPoints} points) can be redeemed`
        };
      }
      
      // CRITICAL: This is a PREVIEW only - DO NOT deduct points!
      logger.info({
        customerID,
        pointsToRedeem,
        discountAmount,
        previewOnly: true
      }, 'Redemption preview (no points deducted)');
      
      return {
        success: true,
        pointsUsed: pointsToRedeem,
        discountAmount,
        reason: undefined
      };
    } catch (error: any) {
      logger.error({ err: error, customerID }, 'Failed to preview redemption');
      return {
        success: false,
        pointsUsed: 0,
        discountAmount: 0,
        reason: error.message
      };
    }
  }
  
  /**
   * Redeem points for discount (MUTATING - actually deducts points)
   * Use this ONLY when creating the actual order
   */
  async redeemPoints(
    customerID: string,
    pointsToRedeem: number,
    orderValue: number,
    programID: string = 'LOY-001'
  ): Promise<RedemptionResult> {
    try {
      const program = await this.getProgram(programID);
      if (!program) {
        throw new Error('Loyalty program not found');
      }
      
      // CRITICAL: Retry with optimistic locking to prevent double-spend
      return await retryWithOptimisticLock(async () => {
        // Fetch fresh customer data on each attempt
        const customer = await this.getCustomerLoyalty(customerID, programID);
        if (!customer) {
          throw new Error('Customer loyalty not found');
        }
        
        // Validate minimum redemption
        if (pointsToRedeem < program.redemptionRules.minRedemption) {
          return {
            success: false,
            discountAmount: 0,
            pointsUsed: 0,
            remainingPoints: customer.currentPoints,
            reason: `Minimum ${program.redemptionRules.minRedemption} points required`
          };
        }
        
        // Validate sufficient points (fresh data)
        if (pointsToRedeem > customer.currentPoints) {
          return {
            success: false,
            discountAmount: 0,
            pointsUsed: 0,
            remainingPoints: customer.currentPoints,
            reason: 'Insufficient points'
          };
        }
        
        // Calculate discount
        const discountAmount = pointsToRedeem / program.redemptionRules.pointsToEuro;
        
        // Validate max per order
        const maxDiscount = orderValue * program.redemptionRules.maxPerOrderPct;
        if (discountAmount > maxDiscount) {
          const adjustedDiscount = maxDiscount;
          const adjustedPoints = Math.floor(adjustedDiscount * program.redemptionRules.pointsToEuro);
          
          return {
            success: false,
            discountAmount: 0,
            pointsUsed: 0,
            remainingPoints: customer.currentPoints,
            reason: `Maximum ${(program.redemptionRules.maxPerOrderPct * 100)}% of order (${maxDiscount.toFixed(2)} EUR, ${adjustedPoints} points) can be redeemed`
          };
        }
        
        // Calculate new values based on fresh data
        const newPoints = customer.currentPoints - pointsToRedeem;
        const newRedeemed = customer.pointsRedeemed + pointsToRedeem;
        
        // Step 1: Update CustomerLoyalty sheet with optimistic lock
        await updateCustomerLoyaltyRow(
          customerID, 
          programID, 
          {
            CustomerID: customerID,
            ProgramID: programID,
            CurrentPoints: newPoints,
            PointsRedeemed: newRedeemed,
            LastActivity: new Date().toISOString()
          },
          customer.lastActivity  // Optimistic lock: verify not modified since read
        );
        
        // Step 2: Log transaction ONLY if sheet update succeeded
        try {
          await this.logTransaction({
            customerID,
            transactionType: 'Redeem',
            points: -pointsToRedeem,
            description: `Redeemed for ${discountAmount.toFixed(2)} EUR discount`
          });
        } catch (logError: any) {
          // Sheet update succeeded but logging failed - log warning but continue
          logger.warn({ 
            err: logError, 
            customerID, 
            pointsToRedeem 
          }, 'Redemption succeeded but transaction logging failed');
        }
        
        logger.info({
          customerID,
          pointsToRedeem,
          discountAmount,
          remainingPoints: newPoints
        }, 'Points redeemed successfully');
        
        return {
          success: true,
          discountAmount,
          pointsUsed: pointsToRedeem,
          remainingPoints: newPoints
        };
      }); // Close retryWithOptimisticLock
    } catch (error: any) {
      logger.error({ err: error, customerID, pointsToRedeem }, 'Failed to redeem points');
      return {
        success: false,
        discountAmount: 0,
        pointsUsed: 0,
        remainingPoints: 0,
        reason: error.message
      };
    }
  }
  
  /**
   * Check and upgrade tier
   */
  async checkTierUpgrade(customerID: string, programID: string = 'LOY-001'): Promise<TierUpgrade> {
    try {
      const program = await this.getProgram(programID);
      if (!program) {
        throw new Error('Loyalty program not found');
      }
      
      const customer = await this.getCustomerLoyalty(customerID, programID);
      if (!customer) {
        throw new Error('Customer loyalty not found');
      }
      
      const currentTierIndex = program.tiers.findIndex(t => t.name === customer.currentTier);
      
      // Check if eligible for next tier
      if (currentTierIndex < program.tiers.length - 1) {
        const nextTier = program.tiers[currentTierIndex + 1];
        
        if (customer.lifetimePoints >= nextTier.minPoints) {
          // Upgrade tier
          const oldTier = customer.currentTier;
          const newTier = nextTier.name;
          
          // Calculate next tier points
          const tierAfterNext = program.tiers[currentTierIndex + 2];
          const nextTierPoints = tierAfterNext 
            ? tierAfterNext.minPoints - customer.lifetimePoints
            : 0;
          
          // CRITICAL: Use composite key helper
          await updateCustomerLoyaltyRow(customerID, programID, {
            CustomerID: customerID,
            ProgramID: programID,
            CurrentTier: newTier,
            NextTierPoints: nextTierPoints
          });
          
          // Log bonus points for tier upgrade
          await this.logTransaction({
            customerID,
            transactionType: 'Bonus',
            points: 0, // Could add bonus points for upgrading
            description: `Tier upgraded from ${oldTier} to ${newTier}`
          });
          
          logger.info({
            customerID,
            oldTier,
            newTier
          }, 'Tier upgraded');
          
          return {
            upgraded: true,
            oldTier: oldTier as TierName,
            newTier: newTier as TierName,
            benefits: nextTier.benefits
          };
        }
      }
      
      return { upgraded: false };
    } catch (error: any) {
      logger.error({ err: error, customerID }, 'Failed to check tier upgrade');
      return { upgraded: false };
    }
  }
  
  /**
   * Log loyalty transaction
   */
  private async logTransaction(data: {
    customerID: string;
    transactionType: LoyaltyTransactionType;
    points: number;
    relatedOrderID?: string;
    description: string;
    expiryDate?: string;
  }): Promise<void> {
    try {
      const transactionID = `LTX-${nanoid(8).toUpperCase()}`;
      
      const transaction: LoyaltyTransaction = {
        transactionID,
        customerID: data.customerID,
        transactionType: data.transactionType,
        points: data.points,
        relatedOrderID: data.relatedOrderID,
        description: data.description,
        createdAt: new Date().toISOString(),
        expiryDate: data.expiryDate,
        processedBy: 'System'
      };
      
      const row = {
        TransactionID: transaction.transactionID,
        CustomerID: transaction.customerID,
        TransactionType: transaction.transactionType,
        Points: transaction.points,
        RelatedOrderID: transaction.relatedOrderID || '',
        Description: transaction.description,
        CreatedAt: transaction.createdAt,
        ExpiryDate: transaction.expiryDate || '',
        ProcessedBy: transaction.processedBy,
        Notes: ''
      };
      
      await sheetsService.appendRows('LoyaltyTransactions', [row]);
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to log transaction');
    }
  }
  
  /**
   * Mark birthday bonus as used
   */
  private async markBirthdayBonusUsed(customerID: string, programID: string): Promise<void> {
    try {
      // CRITICAL: Use composite key helper
      await updateCustomerLoyaltyRow(customerID, programID, {
        CustomerID: customerID,
        ProgramID: programID,
        BirthdayBonusUsed: 'TRUE'
      });
    } catch (error: any) {
      logger.error({ err: error, customerID }, 'Failed to mark birthday bonus');
    }
  }
  
  /**
   * Parse program from row
   */
  private parseProgram(row: any): LoyaltyProgram {
    const tiersJSON = row.TiersJSON ? JSON.parse(row.TiersJSON) : DEFAULT_LOYALTY_TIERS;
    const bonusCategoriesJSON = row.BonusCategoriesJSON ? JSON.parse(row.BonusCategoriesJSON) : [];
    
    return {
      programID: row.ProgramID,
      programName: row.ProgramName,
      active: row.Active === 'TRUE' || row.Active === true,
      
      earningRules: {
        pointsPerEuro: parseFloat(row.PointsPerEuro) || 10,
        minPurchase: parseFloat(row.MinPurchase) || 0,
        bonusCategories: bonusCategoriesJSON,
        birthdayBonus: parseFloat(row.BirthdayBonus) || 500,
        referralBonus: parseFloat(row.ReferralBonus) || 1000
      },
      
      redemptionRules: {
        pointsToEuro: parseFloat(row.PointsToEuro) || 100,
        minRedemption: parseFloat(row.MinRedemption) || 1000,
        maxPerOrderPct: parseFloat(row.MaxPerOrderPct) || 0.50,
        expiryDays: parseFloat(row.ExpiryDays) || 365
      },
      
      tiers: tiersJSON,
      
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
      notes: row.Notes
    };
  }
  
  /**
   * Parse customer loyalty from row
   */
  private parseCustomerLoyalty(row: any): CustomerLoyalty {
    return {
      customerID: row.CustomerID,
      programID: row.ProgramID,
      currentPoints: parseFloat(row.CurrentPoints) || 0,
      lifetimePoints: parseFloat(row.LifetimePoints) || 0,
      pointsRedeemed: parseFloat(row.PointsRedeemed) || 0,
      currentTier: row.CurrentTier as TierName,
      nextTierPoints: parseFloat(row.NextTierPoints) || 0,
      memberSince: row.MemberSince,
      lastActivity: row.LastActivity,
      pointsExpiryDate: row.PointsExpiryDate,
      referralCode: row.ReferralCode,
      referralCount: parseFloat(row.ReferralCount) || 0,
      birthday: row.Birthday,
      birthdayBonusUsed: row.BirthdayBonusUsed === 'TRUE' || row.BirthdayBonusUsed === true,
      notes: row.Notes
    };
  }
  
  /**
   * Convert customer loyalty to row
   */
  private customerLoyaltyToRow(customer: CustomerLoyalty): any {
    return {
      CustomerID: customer.customerID,
      ProgramID: customer.programID,
      CurrentPoints: customer.currentPoints,
      LifetimePoints: customer.lifetimePoints,
      PointsRedeemed: customer.pointsRedeemed,
      CurrentTier: customer.currentTier,
      NextTierPoints: customer.nextTierPoints,
      MemberSince: customer.memberSince,
      LastActivity: customer.lastActivity,
      PointsExpiryDate: customer.pointsExpiryDate,
      ReferralCode: customer.referralCode,
      ReferralCount: customer.referralCount,
      Birthday: customer.birthday || '',
      BirthdayBonusUsed: customer.birthdayBonusUsed ? 'TRUE' : 'FALSE',
      Notes: customer.notes || ''
    };
  }
}

// Export singleton instance
export const loyaltyEngine = new LoyaltyEngine();
