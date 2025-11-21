/**
 * Advanced Partner Systems - Shared Types & Constants
 * 
 * NOTE: All Google Sheets schemas are now in ensure-sheets.ts
 * This file only contains shared types and constants used by services
 */

/**
 * Validation: Check if a program type is valid
 */
export const VALID_PROGRAM_TYPES = ['Dealer', 'Affiliate', 'SalesRep', 'Stand'] as const;
export type ProgramType = typeof VALID_PROGRAM_TYPES[number];

/**
 * Validation: Check if a loyalty transaction type is valid
 */
export const VALID_LOYALTY_TX_TYPES = ['Earn', 'Redeem', 'Expire', 'Bonus', 'Adjustment'] as const;
export type LoyaltyTransactionType = typeof VALID_LOYALTY_TX_TYPES[number];

/**
 * Validation: Check if a gift type is valid
 */
export const VALID_GIFT_TYPES = ['FreeWithOrder', 'PointsRedemption', 'Seasonal'] as const;
export type GiftType = typeof VALID_GIFT_TYPES[number];

/**
 * Loyalty Tiers Configuration
 */
export interface LoyaltyTier {
  name: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  minPoints: number;
  benefits: {
    pointsMultiplier: number;      // 1.0x, 1.25x, 1.5x, 2.0x
    freeShipping: boolean;
    exclusiveOffers: boolean;
    prioritySupport: boolean;
    birthdayMultiplier?: number;   // Extra multiplier on birthday month
  };
}

/**
 * Default Loyalty Tiers
 */
export const DEFAULT_LOYALTY_TIERS: LoyaltyTier[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    benefits: {
      pointsMultiplier: 1.0,
      freeShipping: false,
      exclusiveOffers: false,
      prioritySupport: false
    }
  },
  {
    name: 'Silver',
    minPoints: 5000,
    benefits: {
      pointsMultiplier: 1.25,
      freeShipping: false,
      exclusiveOffers: true,
      prioritySupport: false,
      birthdayMultiplier: 1.5
    }
  },
  {
    name: 'Gold',
    minPoints: 15000,
    benefits: {
      pointsMultiplier: 1.5,
      freeShipping: true,
      exclusiveOffers: true,
      prioritySupport: true,
      birthdayMultiplier: 2.0
    }
  },
  {
    name: 'Platinum',
    minPoints: 50000,
    benefits: {
      pointsMultiplier: 2.0,
      freeShipping: true,
      exclusiveOffers: true,
      prioritySupport: true,
      birthdayMultiplier: 3.0
    }
  }
];
