/**
 * Stand Bundles Service
 * Manages custom product bundles for stands
 */

import { createLogger } from '../../lib/logger';
import { sheetsService } from '../../lib/sheets';
import { nanoid } from 'nanoid';
import { type StandBundle, type StandBundleInsert } from '@shared/schema';
import { standService } from './stand.service';

const logger = createLogger('StandBundles');

export class StandBundlesService {
  /**
   * Get all bundles for a stand
   */
  async getStandBundles(standId: string, activeOnly: boolean = false): Promise<StandBundle[]> {
    try {
      const allBundles = await sheetsService.readSheet<StandBundle>('Stand_Bundles');
      let bundles = allBundles.filter(b => b.StandID === standId);

      if (activeOnly) {
        const now = new Date().toISOString();
        bundles = bundles.filter(b => {
          if (!b.Active) return false;
          if (b.StartDate && b.StartDate > now) return false;
          if (b.EndDate && b.EndDate < now) return false;
          return true;
        });
      }

      return bundles;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get bundles');
      throw new Error(`Failed to get bundles: ${error.message}`);
    }
  }

  /**
   * Create bundle
   */
  async createBundle(data: StandBundleInsert): Promise<StandBundle> {
    try {
      const bundleId = `BUNDLE-${nanoid(8).toUpperCase()}`;
      const now = new Date().toISOString();

      const bundle: StandBundle = {
        BundleID: bundleId,
        CreatedTS: now,
        Active: data.Active !== undefined ? data.Active : true,
        ...data,
      };

      await sheetsService.writeRows('Stand_Bundles', [bundle]);

      await standService.logActivity({
        StandID: data.StandID,
        ActivityType: 'BundleCreated',
        Actor: 'System',
        EntityID: bundleId,
        Description: `Bundle "${data.BundleName}" created`,
      });

      logger.info({ bundleId, standId: data.StandID }, 'Bundle created');
      return bundle;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to create bundle');
      throw new Error(`Failed to create bundle: ${error.message}`);
    }
  }

  /**
   * Update bundle
   */
  async updateBundle(bundleId: string, updates: Partial<StandBundle>): Promise<boolean> {
    try {
      const success = await sheetsService.updateRowByKey(
        'Stand_Bundles',
        'BundleID',
        bundleId,
        updates
      );

      if (success && updates.Active) {
        const bundles = await sheetsService.readSheet<StandBundle>('Stand_Bundles');
        const bundle = bundles.find(b => b.BundleID === bundleId);

        if (bundle) {
          await standService.logActivity({
            StandID: bundle.StandID,
            ActivityType: 'BundleActivated',
            EntityID: bundleId,
            Description: `Bundle "${bundle.BundleName}" activated`,
          });
        }
      }

      return success;
    } catch (error: any) {
      logger.error({ err: error, bundleId, updates }, 'Failed to update bundle');
      return false;
    }
  }

  /**
   * Calculate bundle savings
   */
  calculateSavings(bundle: StandBundle): number {
    if (!bundle.RegularPrice) return 0;
    return bundle.RegularPrice - bundle.BundlePrice;
  }

  /**
   * Calculate bundle discount percentage
   */
  calculateDiscountPercentage(bundle: StandBundle): number {
    if (!bundle.RegularPrice || bundle.RegularPrice === 0) return 0;
    const savings = this.calculateSavings(bundle);
    return (savings / bundle.RegularPrice) * 100;
  }

  /**
   * Get all bundles (admin view)
   */
  async getAllBundles(): Promise<StandBundle[]> {
    try {
      const bundles = await sheetsService.readSheet<StandBundle>('Stand_Bundles');
      return bundles;
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get all bundles');
      throw new Error(`Failed to get all bundles: ${error.message}`);
    }
  }

  /**
   * Get bundle by ID
   */
  async getBundleById(bundleId: string): Promise<StandBundle | null> {
    try {
      const bundles = await sheetsService.readSheet<StandBundle>('Stand_Bundles');
      const bundle = bundles.find(b => b.BundleID === bundleId);
      return bundle || null;
    } catch (error: any) {
      logger.error({ err: error, bundleId }, 'Failed to get bundle');
      throw new Error(`Failed to get bundle: ${error.message}`);
    }
  }

  /**
   * Delete bundle
   */
  async deleteBundle(bundleId: string): Promise<boolean> {
    try {
      const bundle = await this.getBundleById(bundleId);
      if (!bundle) {
        return false;
      }

      const success = await sheetsService.deleteRowByKey(
        'Stand_Bundles',
        'BundleID',
        bundleId
      );

      if (success) {
        await standService.logActivity({
          StandID: bundle.StandID,
          ActivityType: 'BundleDeleted',
          Actor: 'System',
          EntityID: bundleId,
          Description: `Bundle "${bundle.BundleName}" deleted`,
        });
        logger.info({ bundleId }, 'Bundle deleted');
      }

      return success;
    } catch (error: any) {
      logger.error({ err: error, bundleId }, 'Failed to delete bundle');
      return false;
    }
  }

  /**
   * Get bundle analytics
   */
  async getBundleAnalytics() {
    try {
      const bundles = await sheetsService.readSheet<StandBundle>('Stand_Bundles');

      const totalBundles = bundles.length;
      const activeBundles = bundles.filter(b => b.Active).length;
      
      // Average bundle price (guard against division by zero)
      const avgBundlePrice = bundles.length > 0
        ? bundles.reduce((sum, b) => sum + (b.BundlePrice || 0), 0) / bundles.length
        : 0;

      // Total savings across all bundles
      const totalSavings = bundles.reduce((sum, b) => {
        return sum + this.calculateSavings(b);
      }, 0);

      // Average discount percentage (guard against division by zero)
      const bundlesWithDiscount = bundles.filter(b => b.RegularPrice && b.RegularPrice > 0);
      const avgDiscount = bundlesWithDiscount.length > 0
        ? bundlesWithDiscount.reduce((sum, b) => sum + this.calculateDiscountPercentage(b), 0) / bundlesWithDiscount.length
        : 0;

      // Bundles by stand
      const bundlesByStand: Record<string, number> = {};
      bundles.forEach(b => {
        bundlesByStand[b.StandID] = (bundlesByStand[b.StandID] || 0) + 1;
      });

      return {
        totalBundles,
        activeBundles,
        inactiveBundles: totalBundles - activeBundles,
        avgBundlePrice: Math.round(avgBundlePrice * 100) / 100,
        totalSavings: Math.round(totalSavings * 100) / 100,
        avgDiscount: Math.round(avgDiscount * 100) / 100,
        bundlesByStand,
      };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get bundle analytics');
      throw new Error(`Failed to get bundle analytics: ${error.message}`);
    }
  }
}

export const standBundlesService = new StandBundlesService();
