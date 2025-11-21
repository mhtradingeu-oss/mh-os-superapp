/**
 * Gifts Manager
 * Handles free gifts, points redemption gifts, and seasonal promotions
 */

import { createLogger } from './logger';
import { sheetsService } from './sheets';
import { nanoid } from 'nanoid';

const logger = createLogger('GiftsManager');

// ==================== TYPES ====================

export type GiftType = 'FreeWithOrder' | 'PointsRedemption' | 'Seasonal';
export type Season = 'Ramadan' | 'Eid' | 'Christmas' | 'NewYear' | 'BlackFriday' | 'Summer';

export interface Gift {
  giftID: string;
  giftSKU: string;
  giftName: string;
  giftType: GiftType;
  
  // For FreeWithOrder
  minOrderValue?: number;
  
  // For PointsRedemption
  pointsCost?: number;
  
  // For Seasonal
  season?: Season;
  startDate?: string;
  endDate?: string;
  
  stockAvailable: number;
  imageURL?: string;
  description?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  notes?: string;
}

export interface OrderGift {
  orderGiftID: string;
  orderID: string;
  giftID: string;
  giftSKU: string;
  giftType: GiftType;
  quantity: number;
  giftCost: number;
  pointsRedeemed?: number;
  addedAt: string;
  notes?: string;
}

export interface EligibleGiftsResult {
  freeGifts: Gift[];
  pointsGifts: Gift[];
  seasonalGifts: Gift[];
  totalAvailable: number;
}

// ==================== GIFTS MANAGER ====================

export class GiftsManager {
  /**
   * Get all gifts
   */
  async getAllGifts(): Promise<Gift[]> {
    try {
      const rows = await sheetsService.getRows('GiftsCatalog');
      return rows.map(row => this.parseGift(row));
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get gifts');
      return [];
    }
  }
  
  /**
   * Get active gifts only
   */
  async getActiveGifts(): Promise<Gift[]> {
    try {
      const gifts = await this.getAllGifts();
      return gifts.filter(g => g.active && g.stockAvailable > 0);
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get active gifts');
      return [];
    }
  }
  
  /**
   * Get gift by ID
   */
  async getGift(giftID: string): Promise<Gift | null> {
    try {
      const gifts = await this.getAllGifts();
      return gifts.find(g => g.giftID === giftID) || null;
    } catch (error: any) {
      logger.error({ err: error, giftID }, 'Failed to get gift');
      return null;
    }
  }
  
  /**
   * Get eligible gifts for an order
   */
  async getEligibleGifts(
    orderValue: number,
    customerPoints?: number,
    currentSeason?: Season
  ): Promise<EligibleGiftsResult> {
    try {
      const allGifts = await this.getActiveGifts();
      const now = new Date();
      
      // Free gifts (based on order value)
      const freeGifts = allGifts.filter(gift => {
        if (gift.giftType !== 'FreeWithOrder') return false;
        if (!gift.minOrderValue) return false;
        return orderValue >= gift.minOrderValue;
      });
      
      // Points redemption gifts (if customer has points)
      const pointsGifts = customerPoints 
        ? allGifts.filter(gift => {
            if (gift.giftType !== 'PointsRedemption') return false;
            if (!gift.pointsCost) return false;
            return customerPoints >= gift.pointsCost;
          })
        : [];
      
      // Seasonal gifts (check if current date is within season)
      const seasonalGifts = allGifts.filter(gift => {
        if (gift.giftType !== 'Seasonal') return false;
        if (!gift.season || !gift.startDate || !gift.endDate) return false;
        
        // If season specified, must match
        if (currentSeason && gift.season !== currentSeason) return false;
        
        const start = new Date(gift.startDate);
        const end = new Date(gift.endDate);
        
        return now >= start && now <= end;
      });
      
      const result: EligibleGiftsResult = {
        freeGifts,
        pointsGifts,
        seasonalGifts,
        totalAvailable: freeGifts.length + pointsGifts.length + seasonalGifts.length
      };
      
      logger.info({
        orderValue,
        customerPoints,
        currentSeason,
        result: {
          free: freeGifts.length,
          points: pointsGifts.length,
          seasonal: seasonalGifts.length
        }
      }, 'Eligible gifts calculated');
      
      return result;
    } catch (error: any) {
      logger.error({ err: error, orderValue }, 'Failed to get eligible gifts');
      return {
        freeGifts: [],
        pointsGifts: [],
        seasonalGifts: [],
        totalAvailable: 0
      };
    }
  }
  
  /**
   * Add gift to order
   */
  async addGiftToOrder(
    orderID: string,
    giftID: string,
    quantity: number = 1,
    pointsRedeemed?: number
  ): Promise<OrderGift | null> {
    try {
      const gift = await this.getGift(giftID);
      if (!gift) {
        throw new Error('Gift not found');
      }
      
      if (!gift.active) {
        throw new Error('Gift is not active');
      }
      
      if (gift.stockAvailable < quantity) {
        throw new Error('Insufficient gift stock');
      }
      
      // Create order gift record
      const orderGiftID = `OG-${nanoid(8).toUpperCase()}`;
      
      const orderGift: OrderGift = {
        orderGiftID,
        orderID,
        giftID,
        giftSKU: gift.giftSKU,
        giftType: gift.giftType,
        quantity,
        giftCost: 0, // TODO: Calculate actual cost from products
        pointsRedeemed,
        addedAt: new Date().toISOString()
      };
      
      // Add to OrderGifts sheet
      const row = this.orderGiftToRow(orderGift);
      await sheetsService.appendRows('OrderGifts', [row]);
      
      // Decrement stock
      await this.decrementStock(giftID, quantity);
      
      logger.info({
        orderID,
        giftID,
        giftName: gift.giftName,
        quantity
      }, 'Gift added to order');
      
      return orderGift;
    } catch (error: any) {
      logger.error({ err: error, orderID, giftID }, 'Failed to add gift to order');
      return null;
    }
  }
  
  /**
   * Auto-add eligible gifts to order
   */
  async autoAddGiftsToOrder(
    orderID: string,
    orderValue: number,
    currentSeason?: Season
  ): Promise<OrderGift[]> {
    try {
      const eligible = await this.getEligibleGifts(orderValue, undefined, currentSeason);
      const addedGifts: OrderGift[] = [];
      
      // Add all free gifts
      for (const gift of eligible.freeGifts) {
        const orderGift = await this.addGiftToOrder(orderID, gift.giftID, 1);
        if (orderGift) {
          addedGifts.push(orderGift);
        }
      }
      
      // Add highest-priority seasonal gift (if any)
      if (eligible.seasonalGifts.length > 0) {
        const topSeasonalGift = eligible.seasonalGifts[0];
        const orderGift = await this.addGiftToOrder(orderID, topSeasonalGift.giftID, 1);
        if (orderGift) {
          addedGifts.push(orderGift);
        }
      }
      
      logger.info({
        orderID,
        orderValue,
        giftsAdded: addedGifts.length
      }, 'Auto-added gifts to order');
      
      return addedGifts;
    } catch (error: any) {
      logger.error({ err: error, orderID }, 'Failed to auto-add gifts');
      return [];
    }
  }
  
  /**
   * Get gifts for an order
   */
  async getOrderGifts(orderID: string): Promise<OrderGift[]> {
    try {
      const rows = await sheetsService.getRows('OrderGifts');
      return rows
        .filter(row => row.OrderID === orderID)
        .map(row => this.parseOrderGift(row));
    } catch (error: any) {
      logger.error({ err: error, orderID }, 'Failed to get order gifts');
      return [];
    }
  }
  
  /**
   * Create new gift
   */
  async createGift(data: Omit<Gift, 'giftID'>): Promise<Gift> {
    try {
      const giftID = `GFT-${nanoid(6).toUpperCase()}`;
      const now = new Date().toISOString();
      
      const gift: Gift = {
        ...data,
        giftID,
        createdAt: now,
        updatedAt: now
      };
      
      const row = this.giftToRow(gift);
      await sheetsService.appendRows('GiftsCatalog', [row]);
      
      logger.info({ giftID, giftName: gift.giftName }, 'Gift created');
      
      return gift;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to create gift');
      throw new Error(`Failed to create gift: ${error.message}`);
    }
  }
  
  /**
   * Update gift
   */
  async updateGift(giftID: string, updates: Partial<Gift>): Promise<boolean> {
    try {
      const gift = await this.getGift(giftID);
      if (!gift) {
        throw new Error('Gift not found');
      }
      
      const updated: Gift = {
        ...gift,
        ...updates,
        giftID, // Ensure ID doesn't change
        updatedAt: new Date().toISOString()
      };
      
      const row = this.giftToRow(updated);
      const success = await sheetsService.updateRowByKey(
        'GiftsCatalog',
        'GiftID',
        giftID,
        row
      );
      
      if (success) {
        logger.info({ giftID, updates }, 'Gift updated');
      }
      
      return success;
    } catch (error: any) {
      logger.error({ err: error, giftID, updates }, 'Failed to update gift');
      return false;
    }
  }
  
  /**
   * Decrement stock
   */
  private async decrementStock(giftID: string, quantity: number): Promise<void> {
    try {
      const gift = await this.getGift(giftID);
      if (!gift) return;
      
      const newStock = Math.max(0, gift.stockAvailable - quantity);
      
      await sheetsService.updateRowByKey(
        'GiftsCatalog',
        'GiftID',
        giftID,
        {
          GiftID: giftID,
          StockAvailable: newStock
        }
      );
      
      logger.info({ giftID, quantity, newStock }, 'Gift stock decremented');
    } catch (error: any) {
      logger.error({ err: error, giftID, quantity }, 'Failed to decrement stock');
    }
  }
  
  /**
   * Parse gift from row
   */
  private parseGift(row: any): Gift {
    return {
      giftID: row.GiftID,
      giftSKU: row.GiftSKU,
      giftName: row.GiftName,
      giftType: row.GiftType as GiftType,
      
      minOrderValue: row.MinOrderValue ? parseFloat(row.MinOrderValue) : undefined,
      pointsCost: row.PointsCost ? parseFloat(row.PointsCost) : undefined,
      season: row.Season as Season | undefined,
      startDate: row.StartDate,
      endDate: row.EndDate,
      
      stockAvailable: parseFloat(row.StockAvailable) || 0,
      imageURL: row.ImageURL,
      description: row.Description,
      active: row.Active === 'TRUE' || row.Active === true,
      createdAt: row.CreatedAt,
      updatedAt: row.UpdatedAt,
      notes: row.Notes
    };
  }
  
  /**
   * Convert gift to row
   */
  private giftToRow(gift: Gift): any {
    return {
      GiftID: gift.giftID,
      GiftSKU: gift.giftSKU,
      GiftName: gift.giftName,
      GiftType: gift.giftType,
      
      MinOrderValue: gift.minOrderValue || '',
      PointsCost: gift.pointsCost || '',
      Season: gift.season || '',
      StartDate: gift.startDate || '',
      EndDate: gift.endDate || '',
      
      StockAvailable: gift.stockAvailable,
      ImageURL: gift.imageURL || '',
      Description: gift.description || '',
      Active: gift.active ? 'TRUE' : 'FALSE',
      CreatedAt: gift.createdAt || new Date().toISOString(),
      UpdatedAt: gift.updatedAt || new Date().toISOString(),
      Notes: gift.notes || ''
    };
  }
  
  /**
   * Parse order gift from row
   */
  private parseOrderGift(row: any): OrderGift {
    return {
      orderGiftID: row.OrderGiftID,
      orderID: row.OrderID,
      giftID: row.GiftID,
      giftSKU: row.GiftSKU,
      giftType: row.GiftType as GiftType,
      quantity: parseFloat(row.Quantity) || 1,
      giftCost: parseFloat(row.GiftCost) || 0,
      pointsRedeemed: row.PointsRedeemed ? parseFloat(row.PointsRedeemed) : undefined,
      addedAt: row.AddedAt,
      notes: row.Notes
    };
  }
  
  /**
   * Convert order gift to row
   */
  private orderGiftToRow(orderGift: OrderGift): any {
    return {
      OrderGiftID: orderGift.orderGiftID,
      OrderID: orderGift.orderID,
      GiftID: orderGift.giftID,
      GiftSKU: orderGift.giftSKU,
      GiftType: orderGift.giftType,
      Quantity: orderGift.quantity,
      GiftCost: orderGift.giftCost,
      PointsRedeemed: orderGift.pointsRedeemed || '',
      AddedAt: orderGift.addedAt,
      Notes: orderGift.notes || ''
    };
  }
}

// Export singleton instance
export const giftsManager = new GiftsManager();
