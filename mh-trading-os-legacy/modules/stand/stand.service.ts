/**
 * Stand Service - Core Stand Management Service
 * Handles all stand-related business logic and coordinates with other services
 */

import { createLogger } from '../../lib/logger';
import { sheetsService } from '../../lib/sheets';
import { nanoid } from 'nanoid';
import {
  type StandSite,
  type StandInsert,
  type StandInventory,
  type StandInventoryInsert,
  type StandRefillPlan,
  type StandRefillPlanInsert,
  type StandVisit,
  type StandVisitInsert,
  type StandKPI,
  type StandContract,
  type StandContractInsert,
  type StandInvoice,
  type StandInvoiceInsert,
  type StandReturn,
  type StandReturnInsert,
  type StandBundle,
  type StandBundleInsert,
  type StandShipment,
  type StandShipmentInsert,
  type StandLoyalty,
  type StandLoyaltyInsert,
  type StandPerformance,
  type StandActivity,
  type StandActivityInsert,
  type StandPartnerAccess,
  type StandPartnerAccessInsert,
} from '@shared/schema';

const logger = createLogger('StandService');

export class StandService {
  /**
   * Get all stands
   */
  async getAllStands(): Promise<StandSite[]> {
    try {
      const stands = await sheetsService.readSheet<StandSite>('StandSites');
      logger.info({ count: stands.length }, 'Retrieved all stands');
      return stands;
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get stands');
      throw new Error(`Failed to get stands: ${error.message}`);
    }
  }

  /**
   * Get stand by ID
   */
  async getStandById(standId: string): Promise<StandSite | null> {
    try {
      const stands = await this.getAllStands();
      const stand = stands.find(s => s.StandID === standId);
      return stand || null;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get stand');
      return null;
    }
  }

  /**
   * Create new stand
   */
  async createStand(data: StandInsert): Promise<StandSite> {
    try {
      const standId = `STAND-${nanoid(8).toUpperCase()}`;
      const now = new Date().toISOString();

      const stand: StandSite = {
        StandID: standId,
        ...data,
        Status: data.Status || 'Active',
        OpenDate: data.OpenDate || now.split('T')[0],
      };

      await sheetsService.writeRows('StandSites', [stand]);
      
      // Log activity
      await this.logActivity({
        StandID: standId,
        ActivityType: 'StandCreated',
        Actor: 'System',
        Description: `Stand ${data.Salon} created`,
      });

      logger.info({ standId, salon: data.Salon }, 'Stand created successfully');
      return stand;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to create stand');
      throw new Error(`Failed to create stand: ${error.message}`);
    }
  }

  /**
   * Update stand
   */
  async updateStand(standId: string, updates: Partial<StandSite>): Promise<boolean> {
    try {
      const success = await sheetsService.updateRowByKey(
        'StandSites',
        'StandID',
        standId,
        updates
      );

      if (success) {
        await this.logActivity({
          StandID: standId,
          ActivityType: 'StandUpdated',
          Actor: 'System',
          Description: 'Stand information updated',
          MetadataJSON: JSON.stringify(updates),
        });
        logger.info({ standId, updates }, 'Stand updated successfully');
      }

      return success;
    } catch (error: any) {
      logger.error({ err: error, standId, updates }, 'Failed to update stand');
      return false;
    }
  }

  /**
   * Get stand inventory
   */
  async getStandInventory(standId: string): Promise<StandInventory[]> {
    try {
      const allInventory = await sheetsService.readSheet<StandInventory>('Stand_Inventory');
      const standInventory = allInventory.filter(i => i.StandID === standId);
      logger.info({ standId, count: standInventory.length }, 'Retrieved stand inventory');
      return standInventory;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get stand inventory');
      throw new Error(`Failed to get stand inventory: ${error.message}`);
    }
  }

  /**
   * Add inventory to stand
   */
  async addInventory(data: StandInventoryInsert): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const inventory: StandInventory = {
        ...data,
        LastCountTS: now,
      };

      await sheetsService.writeRows('Stand_Inventory', [inventory]);

      await this.logActivity({
        StandID: data.StandID,
        ActivityType: 'InventoryAdded',
        Actor: 'System',
        Description: `Added ${data.OnHand} units of ${data.SKU}`,
        MetadataJSON: JSON.stringify({ SKU: data.SKU, Qty: data.OnHand }),
      });

      logger.info({ standId: data.StandID, sku: data.SKU, qty: data.OnHand }, 'Inventory added');
      return true;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to add inventory');
      throw new Error(`Failed to add inventory: ${error.message}`);
    }
  }

  /**
   * Update inventory
   */
  async updateInventory(standId: string, sku: string, updates: Partial<StandInventory>): Promise<boolean> {
    try {
      const allInventory = await sheetsService.readSheet<StandInventory>('Stand_Inventory');
      const itemIndex = allInventory.findIndex(i => i.StandID === standId && i.SKU === sku);

      if (itemIndex === -1) {
        throw new Error('Inventory item not found');
      }

      const updatedItem = { ...allInventory[itemIndex], ...updates, LastCountTS: new Date().toISOString() };
      allInventory[itemIndex] = updatedItem;

      await sheetsService.writeSheet('Stand_Inventory', allInventory);

      await this.logActivity({
        StandID: standId,
        ActivityType: 'InventoryUpdated',
        Actor: 'System',
        Description: `Updated inventory for ${sku}`,
        MetadataJSON: JSON.stringify(updates),
      });

      logger.info({ standId, sku, updates }, 'Inventory updated');
      return true;
    } catch (error: any) {
      logger.error({ err: error, standId, sku, updates }, 'Failed to update inventory');
      return false;
    }
  }

  /**
   * Get all refill plans for a stand
   */
  async getRefillPlans(standId: string): Promise<StandRefillPlan[]> {
    try {
      const allPlans = await sheetsService.readSheet<StandRefillPlan>('Stand_Refill_Plans');
      const standPlans = allPlans.filter(p => p.StandID === standId);
      logger.info({ standId, count: standPlans.length }, 'Retrieved refill plans');
      return standPlans;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get refill plans');
      throw new Error(`Failed to get refill plans: ${error.message}`);
    }
  }

  /**
   * Create refill plan
   */
  async createRefillPlan(data: StandRefillPlanInsert): Promise<StandRefillPlan> {
    try {
      const planId = `REFILL-${nanoid(8).toUpperCase()}`;
      const now = new Date().toISOString();

      const plan: StandRefillPlan = {
        PlanID: planId,
        StandID: data.StandID,
        CreatedTS: now,
        SuggestedLinesJSON: JSON.stringify(data.items),
        Status: 'Pending',
      };

      await sheetsService.writeRows('Stand_Refill_Plans', [plan]);

      await this.logActivity({
        StandID: data.StandID,
        ActivityType: 'RefillPlanned',
        Actor: 'System',
        EntityID: planId,
        Description: `Refill plan created with ${data.items.length} items`,
      });

      logger.info({ planId, standId: data.StandID, items: data.items.length }, 'Refill plan created');
      return plan;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to create refill plan');
      throw new Error(`Failed to create refill plan: ${error.message}`);
    }
  }

  /**
   * Get stand visits
   */
  async getVisits(standId: string): Promise<StandVisit[]> {
    try {
      const allVisits = await sheetsService.readSheet<StandVisit>('Stand_Visits');
      const standVisits = allVisits.filter(v => v.StandID === standId);
      logger.info({ standId, count: standVisits.length }, 'Retrieved stand visits');
      return standVisits;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get visits');
      throw new Error(`Failed to get visits: ${error.message}`);
    }
  }

  /**
   * Create visit record
   */
  async createVisit(data: StandVisitInsert): Promise<StandVisit> {
    try {
      const visitId = `VISIT-${nanoid(8).toUpperCase()}`;

      const visit: StandVisit = {
        VisitID: visitId,
        ...data,
      };

      await sheetsService.writeRows('Stand_Visits', [visit]);

      await this.logActivity({
        StandID: data.StandID,
        ActivityType: 'VisitCompleted',
        Actor: data.Rep || 'Unknown',
        EntityID: visitId,
        Description: `Visit completed by ${data.Rep}`,
      });

      logger.info({ visitId, standId: data.StandID, rep: data.Rep }, 'Visit created');
      return visit;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to create visit');
      throw new Error(`Failed to create visit: ${error.message}`);
    }
  }

  /**
   * Get stand KPIs
   */
  async getStandKPIs(standId?: string, month?: string): Promise<StandKPI[]> {
    try {
      const allKPIs = await sheetsService.readSheet<StandKPI>('Stand_KPIs');
      let kpis = allKPIs;

      if (standId) {
        kpis = kpis.filter(k => k.StandID === standId);
      }

      if (month) {
        kpis = kpis.filter(k => k.Month === month);
      }

      logger.info({ standId, month, count: kpis.length }, 'Retrieved KPIs');
      return kpis;
    } catch (error: any) {
      logger.error({ err: error, standId, month }, 'Failed to get KPIs');
      throw new Error(`Failed to get KPIs: ${error.message}`);
    }
  }

  /**
   * Log activity
   */
  async logActivity(data: StandActivityInsert): Promise<void> {
    try {
      const activityId = `ACT-${nanoid(8).toUpperCase()}`;
      const now = new Date().toISOString();

      const activity: StandActivity = {
        ActivityID: activityId,
        TS: now,
        ...data,
      };

      await sheetsService.writeRows('Stand_Activity', [activity]);
      logger.debug({ activityId, standId: data.StandID, type: data.ActivityType }, 'Activity logged');
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to log activity');
      // Don't throw - activity logging should not break main operations
    }
  }

  /**
   * Get stand activities
   */
  async getActivities(standId: string, limit: number = 50): Promise<StandActivity[]> {
    try {
      const allActivities = await sheetsService.readSheet<StandActivity>('Stand_Activity');
      const standActivities = allActivities
        .filter(a => a.StandID === standId)
        .sort((a, b) => new Date(b.TS).getTime() - new Date(a.TS).getTime())
        .slice(0, limit);

      logger.info({ standId, count: standActivities.length }, 'Retrieved activities');
      return standActivities;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get activities');
      return [];
    }
  }
}

export const standService = new StandService();
