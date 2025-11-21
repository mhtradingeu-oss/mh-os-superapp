/**
 * Stand Returns Service
 * Manages product returns for stands
 */

import { createLogger } from '../../lib/logger';
import { sheetsService } from '../../lib/sheets';
import { nanoid } from 'nanoid';
import { type StandReturn, type StandReturnInsert } from '@shared/schema';
import { standService } from './stand.service';

const logger = createLogger('StandReturns');

export class StandReturnsService {
  async getStandReturns(standId: string): Promise<StandReturn[]> {
    try {
      const allReturns = await sheetsService.readSheet<StandReturn>('Stand_Returns');
      return allReturns.filter(r => r.StandID === standId);
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get returns');
      throw new Error(`Failed to get returns: ${error.message}`);
    }
  }

  async createReturn(data: StandReturnInsert): Promise<StandReturn> {
    try {
      const returnId = `RET-${nanoid(8).toUpperCase()}`;

      const returnRecord: StandReturn = {
        ReturnID: returnId,
        ...data,
        Status: data.Status || 'Pending',
      };

      await sheetsService.writeRows('Stand_Returns', [returnRecord]);

      await standService.logActivity({
        StandID: data.StandID,
        ActivityType: 'ReturnRequested',
        Actor: 'System',
        EntityID: returnId,
        Description: `Return requested for €${data.RefundAmount.toFixed(2)}`,
      });

      logger.info({ returnId, standId: data.StandID }, 'Return created');
      return returnRecord;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to create return');
      throw new Error(`Failed to create return: ${error.message}`);
    }
  }

  async approveReturn(returnId: string, processedBy: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const success = await sheetsService.updateRowByKey(
        'Stand_Returns',
        'ReturnID',
        returnId,
        {
          Status: 'Approved',
          ProcessedBy: processedBy,
          ProcessedTS: now,
        }
      );

      if (success) {
        const returns = await sheetsService.readSheet<StandReturn>('Stand_Returns');
        const returnRecord = returns.find(r => r.ReturnID === returnId);

        if (returnRecord) {
          await standService.logActivity({
            StandID: returnRecord.StandID,
            ActivityType: 'ReturnApproved',
            Actor: processedBy,
            EntityID: returnId,
            Description: 'Return approved',
          });
        }
      }

      return success;
    } catch (error: any) {
      logger.error({ err: error, returnId }, 'Failed to approve return');
      return false;
    }
  }

  /**
   * Get all returns (admin view)
   */
  async getAllReturns(): Promise<StandReturn[]> {
    try {
      const returns = await sheetsService.readSheet<StandReturn>('Stand_Returns');
      return returns.sort((a, b) => 
        new Date(b.ProcessedTS || 0).getTime() - new Date(a.ProcessedTS || 0).getTime()
      );
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get all returns');
      throw new Error(`Failed to get all returns: ${error.message}`);
    }
  }

  /**
   * Get return by ID
   */
  async getReturnById(returnId: string): Promise<StandReturn | null> {
    try {
      const returns = await sheetsService.readSheet<StandReturn>('Stand_Returns');
      return returns.find(r => r.ReturnID === returnId) || null;
    } catch (error: any) {
      logger.error({ err: error, returnId }, 'Failed to get return by ID');
      return null;
    }
  }

  /**
   * Process refund for approved return
   */
  async processRefund(returnId: string, processedBy: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const success = await sheetsService.updateRowByKey(
        'Stand_Returns',
        'ReturnID',
        returnId,
        {
          Status: 'Refunded',
          ProcessedBy: processedBy,
          ProcessedTS: now,
        }
      );

      if (success) {
        const returnRecord = await this.getReturnById(returnId);
        if (returnRecord) {
          await standService.logActivity({
            StandID: returnRecord.StandID,
            ActivityType: 'RefundProcessed',
            Actor: processedBy,
            EntityID: returnId,
            Description: `Refund of €${returnRecord.RefundAmount.toFixed(2)} processed`,
          });
        }
      }

      return success;
    } catch (error: any) {
      logger.error({ err: error, returnId }, 'Failed to process refund');
      return false;
    }
  }

  /**
   * Get return analytics
   */
  async getReturnAnalytics() {
    try {
      const returns = await sheetsService.readSheet<StandReturn>('Stand_Returns');

      const totalReturns = returns.length;
      const pendingReturns = returns.filter(r => r.Status === 'Pending');
      const approvedReturns = returns.filter(r => r.Status === 'Approved');
      const refundedReturns = returns.filter(r => r.Status === 'Refunded');
      const rejectedReturns = returns.filter(r => r.Status === 'Rejected');

      const totalRefundAmount = refundedReturns.reduce((sum, r) => sum + r.RefundAmount, 0);
      const pendingRefundAmount = approvedReturns.reduce((sum, r) => sum + r.RefundAmount, 0);
      const avgRefundAmount = refundedReturns.length > 0 
        ? totalRefundAmount / refundedReturns.length 
        : 0;

      return {
        totalReturns,
        pendingCount: pendingReturns.length,
        approvedCount: approvedReturns.length,
        refundedCount: refundedReturns.length,
        rejectedCount: rejectedReturns.length,
        totalRefundAmount,
        pendingRefundAmount,
        avgRefundAmount,
      };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get return analytics');
      return {
        totalReturns: 0,
        pendingCount: 0,
        approvedCount: 0,
        refundedCount: 0,
        rejectedCount: 0,
        totalRefundAmount: 0,
        pendingRefundAmount: 0,
        avgRefundAmount: 0,
      };
    }
  }

  /**
   * Reject return
   */
  async rejectReturn(returnId: string, processedBy: string, reason?: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const success = await sheetsService.updateRowByKey(
        'Stand_Returns',
        'ReturnID',
        returnId,
        {
          Status: 'Rejected',
          ProcessedBy: processedBy,
          ProcessedTS: now,
        }
      );

      if (success) {
        const returnRecord = await this.getReturnById(returnId);
        if (returnRecord) {
          await standService.logActivity({
            StandID: returnRecord.StandID,
            ActivityType: 'ReturnRejected',
            Actor: processedBy,
            EntityID: returnId,
            Description: `Return rejected${reason ? `: ${reason}` : ''}`,
          });
        }
      }

      return success;
    } catch (error: any) {
      logger.error({ err: error, returnId }, 'Failed to reject return');
      return false;
    }
  }
}

export const standReturnsService = new StandReturnsService();
