/**
 * Stand Shipments Service
 * Manages shipments to stands
 */

import { createLogger } from '../../lib/logger';
import { sheetsService } from '../../lib/sheets';
import { nanoid } from 'nanoid';
import { type StandShipment, type StandShipmentInsert } from '@shared/schema';
import { standService } from './stand.service';

const logger = createLogger('StandShipments');

export class StandShipmentsService {
  async getStandShipments(standId: string): Promise<StandShipment[]> {
    try {
      const allShipments = await sheetsService.readSheet<StandShipment>('Stand_Shipments');
      return allShipments.filter(s => s.StandID === standId);
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get shipments');
      throw new Error(`Failed to get shipments: ${error.message}`);
    }
  }

  async createShipment(data: StandShipmentInsert): Promise<StandShipment> {
    try {
      const shipmentId = `SHIP-${nanoid(8).toUpperCase()}`;

      const shipment: StandShipment = {
        ShipmentID: shipmentId,
        ...data,
        Status: data.Status || 'Preparing',
      };

      await sheetsService.writeRows('Stand_Shipments', [shipment]);

      await standService.logActivity({
        StandID: data.StandID,
        ActivityType: 'ShipmentDispatched',
        Actor: 'System',
        EntityID: shipmentId,
        Description: `Shipment ${shipmentId} created`,
      });

      logger.info({ shipmentId, standId: data.StandID }, 'Shipment created');
      return shipment;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to create shipment');
      throw new Error(`Failed to create shipment: ${error.message}`);
    }
  }

  async updateShipmentStatus(shipmentId: string, status: string): Promise<boolean> {
    try {
      const updates: any = { Status: status };

      if (status === 'Delivered') {
        updates.ActualDelivery = new Date().toISOString();
      }

      const success = await sheetsService.updateRowByKey(
        'Stand_Shipments',
        'ShipmentID',
        shipmentId,
        updates
      );

      if (success && status === 'Delivered') {
        const shipments = await sheetsService.readSheet<StandShipment>('Stand_Shipments');
        const shipment = shipments.find(s => s.ShipmentID === shipmentId);

        if (shipment) {
          await standService.logActivity({
            StandID: shipment.StandID,
            ActivityType: 'ShipmentDelivered',
            EntityID: shipmentId,
            Description: 'Shipment delivered',
          });
        }
      }

      return success;
    } catch (error: any) {
      logger.error({ err: error, shipmentId }, 'Failed to update shipment');
      return false;
    }
  }

  /**
   * Get all shipments (admin view)
   */
  async getAllShipments(): Promise<StandShipment[]> {
    try {
      const shipments = await sheetsService.readSheet<StandShipment>('Stand_Shipments');
      return shipments.sort((a, b) => 
        new Date(b.ShipmentDate || 0).getTime() - new Date(a.ShipmentDate || 0).getTime()
      );
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get all shipments');
      throw new Error(`Failed to get all shipments: ${error.message}`);
    }
  }

  /**
   * Get shipment by ID
   */
  async getShipmentById(shipmentId: string): Promise<StandShipment | null> {
    try {
      const shipments = await sheetsService.readSheet<StandShipment>('Stand_Shipments');
      return shipments.find(s => s.ShipmentID === shipmentId) || null;
    } catch (error: any) {
      logger.error({ err: error, shipmentId }, 'Failed to get shipment by ID');
      return null;
    }
  }

  /**
   * Update tracking information
   */
  async updateTracking(
    shipmentId: string, 
    trackingNumber: string, 
    carrier?: string
  ): Promise<boolean> {
    try {
      const updates: any = { TrackingNumber: trackingNumber };
      if (carrier) {
        updates.Carrier = carrier;
      }

      const success = await sheetsService.updateRowByKey(
        'Stand_Shipments',
        'ShipmentID',
        shipmentId,
        updates
      );

      if (success) {
        const shipment = await this.getShipmentById(shipmentId);
        if (shipment) {
          await standService.logActivity({
            StandID: shipment.StandID,
            ActivityType: 'TrackingUpdated',
            EntityID: shipmentId,
            Description: `Tracking number: ${trackingNumber}`,
          });
        }
      }

      return success;
    } catch (error: any) {
      logger.error({ err: error, shipmentId }, 'Failed to update tracking');
      return false;
    }
  }

  /**
   * Get shipment analytics
   */
  async getShipmentAnalytics() {
    try {
      const shipments = await sheetsService.readSheet<StandShipment>('Stand_Shipments');

      const totalShipments = shipments.length;
      const preparingShipments = shipments.filter(s => s.Status === 'Preparing');
      const dispatchedShipments = shipments.filter(s => s.Status === 'Dispatched');
      const inTransitShipments = shipments.filter(s => s.Status === 'InTransit');
      const deliveredShipments = shipments.filter(s => s.Status === 'Delivered');

      // Calculate late shipments (dispatched > 7 days ago but not delivered)
      const now = Date.now();
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const lateShipments = shipments.filter(s => {
        if (s.Status === 'Delivered') return false;
        if (!s.ShipmentDate) return false;
        return new Date(s.ShipmentDate).getTime() < sevenDaysAgo;
      });

      return {
        totalShipments,
        preparingCount: preparingShipments.length,
        dispatchedCount: dispatchedShipments.length,
        inTransitCount: inTransitShipments.length,
        deliveredCount: deliveredShipments.length,
        lateCount: lateShipments.length,
      };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get shipment analytics');
      return {
        totalShipments: 0,
        preparingCount: 0,
        dispatchedCount: 0,
        inTransitCount: 0,
        deliveredCount: 0,
        lateCount: 0,
      };
    }
  }
}

export const standShipmentsService = new StandShipmentsService();
