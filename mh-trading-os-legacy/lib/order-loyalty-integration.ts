/**
 * Order - Loyalty - Gifts Integration
 * Handles automatic loyalty points earning, redemption, tier upgrades, and gift additions
 */

import { createLogger } from './logger';
import { loyaltyEngine } from './loyalty-engine';
import { giftsManager } from './gifts-manager';
import { sheetsService } from './sheets';

const logger = createLogger('OrderLoyaltyIntegration');

export interface OrderLoyaltyContext {
  orderID: string;
  customerID: string;
  orderValue: number;
  orderCategories: string[];
  loyaltyRedeemed?: number;
  programID?: string;
}

export interface OrderLoyaltyResult {
  pointsEarned: number;
  pointsRedeemed: number;
  tierUpgrade: {
    upgraded: boolean;
    oldTier?: string;
    newTier?: string;
  };
  gifts: Array<{
    giftID: string;
    giftSKU: string;
    giftName: string;
  }>;
  // CRITICAL: Indicates if rollback failed (partial state)
  rollbackFailed?: boolean;
  rollbackError?: string;
}

/**
 * Process complete loyalty flow for an order
 */
export async function processOrderLoyalty(
  context: OrderLoyaltyContext
): Promise<OrderLoyaltyResult> {
  const { orderID, customerID, orderValue, orderCategories, loyaltyRedeemed, programID = 'LOY-001' } = context;
  
  try {
    const result: OrderLoyaltyResult = {
      pointsEarned: 0,
      pointsRedeemed: 0,
      tierUpgrade: { upgraded: false },
      gifts: []
    };
    
    // Step 1: Process redemption FIRST (deduct points before adding new ones)
    if (loyaltyRedeemed && loyaltyRedeemed > 0) {
      const redemption = await loyaltyEngine.redeemPoints(
        customerID,
        loyaltyRedeemed,
        orderValue,
        programID
      );
      
      if (redemption.success) {
        result.pointsRedeemed = redemption.pointsUsed;
        
        logger.info({
          orderID,
          customerID,
          pointsRedeemed: redemption.pointsUsed,
          discountAmount: redemption.discountAmount
        }, 'Loyalty points redeemed');
      } else {
        logger.warn({
          orderID,
          customerID,
          pointsToRedeem: loyaltyRedeemed,
          reason: redemption.reason
        }, 'Loyalty redemption failed');
      }
    }
    
    // Step 2: Calculate points earned
    const pointsCalculation = await loyaltyEngine.calculatePointsEarned(
      customerID,
      orderValue,
      orderCategories,
      programID
    );
    
    logger.info({
      orderID,
      customerID,
      pointsCalculation
    }, 'Loyalty points calculated');
    
    // Step 3: Award points to customer
    let earnSuccess = false;
    if (pointsCalculation.totalPoints > 0) {
      earnSuccess = await loyaltyEngine.addPoints(
        customerID,
        pointsCalculation.totalPoints,
        orderID,
        `Earned from order ${orderID}`,
        programID
      );
      
      if (earnSuccess) {
        result.pointsEarned = pointsCalculation.totalPoints;
        
        logger.info({
          orderID,
          customerID,
          pointsEarned: pointsCalculation.totalPoints
        }, 'Loyalty points awarded');
      } else {
        // CRITICAL: Rollback redemption if earn fails
        // Use restorePoints() to avoid inflating lifetimePoints
        if (result.pointsRedeemed > 0) {
          const rollbackSuccess = await loyaltyEngine.restorePoints(
            customerID,
            result.pointsRedeemed,
            orderID,
            `Rollback failed earn for order ${orderID}`,
            programID
          );
          
          if (rollbackSuccess) {
            // Rollback succeeded - clear redeemed amount
            result.pointsRedeemed = 0;
            
            logger.error({
              orderID,
              customerID,
              pointsEarned: pointsCalculation.totalPoints,
              rollbackSuccess: true
            }, 'Failed to award points - successfully rolled back redemption');
          } else {
            // CRITICAL: Rollback FAILED - customer lost points!
            result.rollbackFailed = true;
            result.rollbackError = 'Failed to restore redeemed points after earn failure';
            
            logger.error({
              orderID,
              customerID,
              pointsEarned: pointsCalculation.totalPoints,
              pointsRedeemed: result.pointsRedeemed,
              rollbackSuccess: false,
              CRITICAL: 'PARTIAL LOYALTY STATE - MANUAL INTERVENTION REQUIRED'
            }, 'Failed to award points AND failed to rollback redemption - customer balance incorrect!');
            
            // Log to System_Log for admin attention
            await sheetsService.logToSheet('ERROR', 'Loyalty', 
              `CRITICAL: Order ${orderID} - Customer ${customerID} lost ${result.pointsRedeemed} points. Earn failed + rollback failed. MANUAL FIX REQUIRED.`);
          }
        }
      }
    }
    
    // Step 4: Check for tier upgrade (ONLY if earn succeeded)
    if (earnSuccess) {
      const tierUpgrade = await loyaltyEngine.checkTierUpgrade(customerID, programID);
      result.tierUpgrade = tierUpgrade;
      
      if (tierUpgrade.upgraded) {
        logger.info({
          orderID,
          customerID,
          oldTier: tierUpgrade.oldTier,
          newTier: tierUpgrade.newTier
        }, 'Customer tier upgraded');
      }
    } else {
      // Earn failed - no tier check
      result.tierUpgrade = { upgraded: false };
    }
    
    // Step 5: Auto-add eligible gifts
    const currentSeason = getCurrentSeason();
    const autoGifts = await giftsManager.autoAddGiftsToOrder(
      orderID,
      orderValue,
      currentSeason
    );
    
    result.gifts = autoGifts.map(g => ({
      giftID: g.giftID,
      giftSKU: g.giftSKU,
      giftName: '' // Will be populated from catalog
    }));
    
    if (autoGifts.length > 0) {
      logger.info({
        orderID,
        giftsAdded: autoGifts.length,
        gifts: result.gifts
      }, 'Gifts auto-added to order');
    }
    
    return result;
  } catch (error: any) {
    logger.error({ err: error, orderID, customerID }, 'Failed to process order loyalty');
    
    // Return partial result (don't fail the order)
    return {
      pointsEarned: 0,
      pointsRedeemed: loyaltyRedeemed || 0,
      tierUpgrade: { upgraded: false },
      gifts: []
    };
  }
}

/**
 * Validate loyalty redemption before creating order
 * CRITICAL: Uses previewRedemption (read-only) - DOES NOT deduct points!
 * Only actual order creation via processOrderLoyalty() deducts points
 */
export async function validateLoyaltyRedemption(
  customerID: string,
  pointsToRedeem: number,
  orderValue: number,
  programID: string = 'LOY-001'
): Promise<{
  valid: boolean;
  discountAmount: number;
  reason?: string;
}> {
  try {
    // CRITICAL: Use previewRedemption (read-only check) NOT redeemPoints!
    const preview = await loyaltyEngine.previewRedemption(
      customerID,
      pointsToRedeem,
      orderValue,
      programID
    );
    
    if (preview.success) {
      return {
        valid: true,
        discountAmount: preview.discountAmount
      };
    } else {
      return {
        valid: false,
        discountAmount: 0,
        reason: preview.reason
      };
    }
  } catch (error: any) {
    logger.error({ err: error, customerID, pointsToRedeem }, 'Failed to validate redemption');
    return {
      valid: false,
      discountAmount: 0,
      reason: error.message
    };
  }
}

/**
 * Get customer's available loyalty points
 */
export async function getCustomerPoints(
  customerID: string,
  programID: string = 'LOY-001'
): Promise<number> {
  try {
    const loyalty = await loyaltyEngine.getCustomerLoyalty(customerID, programID);
    return loyalty ? loyalty.currentPoints : 0;
  } catch (error: any) {
    logger.error({ err: error, customerID }, 'Failed to get customer points');
    return 0;
  }
}

/**
 * Extract product categories from order lines
 * PERFORMANCE NOTE: Accepts optional products array to avoid repeated fetches
 * CRITICAL: Logs errors for missing SKUs to prevent silent category bonus miscalculation
 */
export async function extractOrderCategories(
  orderLines: Array<{ SKU: string }>,
  products?: Array<{ SKU: string; Category?: string }>
): Promise<string[]> {
  try {
    // Use provided products or fetch if not available
    const productList = products || await sheetsService.getFinalPriceList();
    
    if (!products) {
      logger.warn({ 
        orderLineCount: orderLines.length 
      }, 'extractOrderCategories called without products cache - performance impact');
    }
    
    const categories: string[] = [];
    const missingSKUs: string[] = [];
    
    for (const line of orderLines) {
      const product = productList.find(p => p.SKU === line.SKU);
      if (product) {
        if (product.Category) {
          if (!categories.includes(product.Category)) {
            categories.push(product.Category);
          }
        } else {
          logger.warn({ 
            SKU: line.SKU 
          }, 'Product found but has no Category - loyalty bonus may be incorrect');
        }
      } else {
        // CRITICAL: Track missing SKUs (e.g., stand-only products)
        missingSKUs.push(line.SKU);
      }
    }
    
    // Log all missing SKUs at once
    if (missingSKUs.length > 0) {
      logger.error({ 
        missingSKUs,
        orderLineCount: orderLines.length,
        foundCategories: categories
      }, 'SKUs not found in product list - loyalty category bonuses may be incorrect');
    }
    
    return categories;
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to extract order categories');
    return [];
  }
}

/**
 * Determine current season for seasonal gifts
 */
function getCurrentSeason(): string | undefined {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  
  // Ramadan (varies, using approximate months)
  if (month >= 3 && month <= 4) {
    return 'Ramadan';
  }
  
  // Eid (after Ramadan)
  if (month === 4 || month === 5) {
    return 'Eid';
  }
  
  // Summer
  if (month >= 6 && month <= 8) {
    return 'Summer';
  }
  
  // Black Friday (November)
  if (month === 11) {
    return 'BlackFriday';
  }
  
  // Christmas
  if (month === 12) {
    return 'Christmas';
  }
  
  // New Year
  if (month === 1) {
    return 'NewYear';
  }
  
  return undefined;
}

/**
 * Create backward-compatible loyalty ledger entry
 * (maintains compatibility with existing Loyalty_Ledger sheet)
 * IMPORTANT: Only writes entries for non-zero amounts (prevents phantom redeems)
 */
export async function createLoyaltyLedgerEntry(
  orderID: string,
  customerID: string,
  pointsEarned: number,
  pointsRedeemed: number
): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    
    // CRITICAL: Only write if amount > 0 (prevents phantom entries)
    // Earned entry
    if (pointsEarned > 0) {
      await sheetsService.writeRows('Loyalty_Ledger', [{
        TransactionID: `LY-${orderID}`,
        PartnerID: customerID,
        OrderID: orderID,
        TransactionType: 'Earned',
        PointsEarned: pointsEarned,
        PointsRedeemed: 0,
        TransactionDate: timestamp,
        Notes: `Earned from order ${orderID}`
      }]);
      
      logger.info({
        orderID,
        customerID,
        pointsEarned
      }, 'Loyalty ledger: Earned entry created');
    }
    
    // Redeemed entry (only if redemption actually succeeded)
    if (pointsRedeemed > 0) {
      await sheetsService.writeRows('Loyalty_Ledger', [{
        TransactionID: `LY-${orderID}-RED`,
        PartnerID: customerID,
        OrderID: orderID,
        TransactionType: 'Redeemed',
        PointsEarned: 0,
        PointsRedeemed: pointsRedeemed,
        TransactionDate: timestamp,
        Notes: `Redeemed for order ${orderID}`
      }]);
      
      logger.info({
        orderID,
        customerID,
        pointsRedeemed
      }, 'Loyalty ledger: Redeemed entry created');
    }
  } catch (error: any) {
    logger.error({ err: error, orderID }, 'Failed to create loyalty ledger entry');
  }
}
