/**
 * Stand Loyalty Service
 * Manages loyalty points for stands
 */

import { createLogger } from '../../lib/logger';
import { sheetsService } from '../../lib/sheets';
import { nanoid } from 'nanoid';
import { type StandLoyalty, type StandLoyaltyInsert } from '@shared/schema';
import { standService } from './stand.service';

const logger = createLogger('StandLoyalty');

export class StandLoyaltyService {
  async getStandLoyaltyHistory(standId: string, limit: number = 50): Promise<StandLoyalty[]> {
    try {
      const allEntries = await sheetsService.readSheet<StandLoyalty>('Stand_Loyalty');
      return allEntries
        .filter(e => e.StandID === standId)
        .sort((a, b) => new Date(b.TS).getTime() - new Date(a.TS).getTime())
        .slice(0, limit);
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get loyalty history');
      throw new Error(`Failed to get loyalty history: ${error.message}`);
    }
  }

  async getStandLoyaltyBalance(standId: string): Promise<number> {
    try {
      const history = await this.getStandLoyaltyHistory(standId, 1000);
      const balance = history.reduce((total, entry) => {
        if (entry.TransactionType === 'Earned' || entry.TransactionType === 'Adjusted') {
          return total + entry.Points;
        } else if (entry.TransactionType === 'Redeemed') {
          return total - entry.Points;
        }
        return total;
      }, 0);
      
      return Math.max(0, balance);
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get loyalty balance');
      return 0;
    }
  }

  async addLoyaltyPoints(data: StandLoyaltyInsert): Promise<StandLoyalty> {
    try {
      const entryId = `LOY-${nanoid(8).toUpperCase()}`;
      const now = new Date().toISOString();
      const currentBalance = await this.getStandLoyaltyBalance(data.StandID);

      const entry: StandLoyalty = {
        EntryID: entryId,
        TS: now,
        BalanceAfter: currentBalance + data.Points,
        ...data,
      };

      await sheetsService.writeRows('Stand_Loyalty', [entry]);

      await standService.logActivity({
        StandID: data.StandID,
        ActivityType: 'LoyaltyEarned',
        Actor: data.ProcessedBy || 'System',
        EntityID: entryId,
        Description: `${data.Points} points ${data.TransactionType}`,
      });

      logger.info({ entryId, standId: data.StandID, points: data.Points }, 'Loyalty points added');
      return entry;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to add loyalty points');
      throw new Error(`Failed to add loyalty points: ${error.message}`);
    }
  }

  async redeemLoyaltyPoints(standId: string, points: number, reason: string): Promise<StandLoyalty | null> {
    try {
      const currentBalance = await this.getStandLoyaltyBalance(standId);
      
      if (currentBalance < points) {
        throw new Error('Insufficient loyalty points');
      }

      return await this.addLoyaltyPoints({
        StandID: standId,
        TransactionType: 'Redeemed',
        Points: points,
        Reason: reason,
      });
    } catch (error: any) {
      logger.error({ err: error, standId, points }, 'Failed to redeem loyalty points');
      return null;
    }
  }
}

export const standLoyaltyService = new StandLoyaltyService();
