/**
 * Stand Invoices Service
 * Manages invoicing for stand partners
 */

import { createLogger } from '../../lib/logger';
import { sheetsService } from '../../lib/sheets';
import { nanoid } from 'nanoid';
import { type StandInvoice, type StandInvoiceInsert } from '@shared/schema';
import { standService } from './stand.service';

const logger = createLogger('StandInvoices');

export class StandInvoicesService {
  /**
   * Get all invoices for a stand
   */
  async getStandInvoices(standId: string): Promise<StandInvoice[]> {
    try {
      const allInvoices = await sheetsService.readSheet<StandInvoice>('Stand_Invoices');
      return allInvoices.filter(i => i.StandID === standId);
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get invoices');
      throw new Error(`Failed to get invoices: ${error.message}`);
    }
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices(standId?: string): Promise<StandInvoice[]> {
    try {
      const allInvoices = await sheetsService.readSheet<StandInvoice>('Stand_Invoices');
      const now = Date.now();

      let invoices = allInvoices.filter(i => {
        if (i.Status === 'Paid' || i.Status === 'Cancelled') return false;
        if (!i.DueDate) return false;
        return new Date(i.DueDate).getTime() < now;
      });

      if (standId) {
        invoices = invoices.filter(i => i.StandID === standId);
      }

      return invoices;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get overdue invoices');
      return [];
    }
  }

  /**
   * Create invoice
   */
  async createInvoice(data: StandInvoiceInsert): Promise<StandInvoice> {
    try {
      const invoiceId = `INV-${nanoid(8).toUpperCase()}`;
      const now = new Date().toISOString();

      // Get next invoice number
      const allInvoices = await sheetsService.readSheet<StandInvoice>('Stand_Invoices');
      const invoiceCount = allInvoices.length + 1;
      const invoiceNumber = `STAND-${new Date().getFullYear()}-${String(invoiceCount).padStart(5, '0')}`;

      const invoice: StandInvoice = {
        InvoiceID: invoiceId,
        InvoiceNumber: invoiceNumber,
        ...data,
        Status: data.Status || 'Draft',
      };

      await sheetsService.writeRows('Stand_Invoices', [invoice]);

      await standService.logActivity({
        StandID: data.StandID,
        ActivityType: 'InvoiceCreated',
        Actor: 'System',
        EntityID: invoiceId,
        Description: `Invoice ${invoiceNumber} created for €${data.Total.toFixed(2)}`,
      });

      logger.info({ invoiceId, standId: data.StandID, total: data.Total }, 'Invoice created');
      return invoice;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to create invoice');
      throw new Error(`Failed to create invoice: ${error.message}`);
    }
  }

  /**
   * Mark invoice as paid
   */
  async markAsPaid(invoiceId: string, paymentMethod: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      const success = await sheetsService.updateRowByKey(
        'Stand_Invoices',
        'InvoiceID',
        invoiceId,
        {
          Status: 'Paid',
          PaidDate: now,
          PaymentMethod: paymentMethod,
        }
      );

      if (success) {
        const invoices = await sheetsService.readSheet<StandInvoice>('Stand_Invoices');
        const invoice = invoices.find(i => i.InvoiceID === invoiceId);

        if (invoice) {
          await standService.logActivity({
            StandID: invoice.StandID,
            ActivityType: 'InvoicePaid',
            Actor: 'System',
            EntityID: invoiceId,
            Description: `Invoice ${invoice.InvoiceNumber} paid via ${paymentMethod}`,
          });
        }
      }

      return success;
    } catch (error: any) {
      logger.error({ err: error, invoiceId }, 'Failed to mark invoice as paid');
      return false;
    }
  }

  /**
   * Calculate total revenue for stand
   */
  async calculateTotalRevenue(standId: string, fromDate?: string, toDate?: string): Promise<number> {
    try {
      const invoices = await this.getStandInvoices(standId);
      const paidInvoices = invoices.filter(i => i.Status === 'Paid');

      let filtered = paidInvoices;

      if (fromDate) {
        filtered = filtered.filter(i => i.InvoiceDate >= fromDate);
      }

      if (toDate) {
        filtered = filtered.filter(i => i.InvoiceDate <= toDate);
      }

      const total = filtered.reduce((sum, inv) => sum + inv.Total, 0);
      return total;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to calculate revenue');
      return 0;
    }
  }

  /**
   * Get all invoices (global)
   */
  async getAllInvoices(): Promise<StandInvoice[]> {
    try {
      const invoices = await sheetsService.readSheet<StandInvoice>('Stand_Invoices');
      return invoices.sort((a, b) => 
        new Date(b.InvoiceDate).getTime() - new Date(a.InvoiceDate).getTime()
      );
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get all invoices');
      throw new Error(`Failed to get all invoices: ${error.message}`);
    }
  }

  /**
   * Get invoice by ID
   */
  async getInvoiceById(invoiceId: string): Promise<StandInvoice | null> {
    try {
      const invoices = await sheetsService.readSheet<StandInvoice>('Stand_Invoices');
      return invoices.find(i => i.InvoiceID === invoiceId) || null;
    } catch (error: any) {
      logger.error({ err: error, invoiceId }, 'Failed to get invoice by ID');
      return null;
    }
  }

  /**
   * Get invoice analytics
   */
  async getInvoiceAnalytics() {
    try {
      const invoices = await sheetsService.readSheet<StandInvoice>('Stand_Invoices');
      const now = Date.now();

      const totalInvoices = invoices.length;
      const paidInvoices = invoices.filter(i => i.Status === 'Paid');
      const overdueInvoices = invoices.filter(i => {
        if (i.Status === 'Paid' || i.Status === 'Cancelled') return false;
        if (!i.DueDate) return false;
        return new Date(i.DueDate).getTime() < now;
      });
      const pendingInvoices = invoices.filter(i => 
        i.Status === 'Draft' || i.Status === 'Sent'
      );

      const totalRevenue = paidInvoices.reduce((sum, inv) => sum + inv.Total, 0);
      const totalOutstanding = pendingInvoices.reduce((sum, inv) => sum + inv.Total, 0);
      const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + inv.Total, 0);
      const avgInvoiceValue = paidInvoices.length > 0 ? totalRevenue / paidInvoices.length : 0;

      return {
        totalInvoices,
        paidCount: paidInvoices.length,
        overdueCount: overdueInvoices.length,
        pendingCount: pendingInvoices.length,
        totalRevenue,
        totalOutstanding,
        totalOverdue,
        avgInvoiceValue,
      };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get invoice analytics');
      return {
        totalInvoices: 0,
        paidCount: 0,
        overdueCount: 0,
        pendingCount: 0,
        totalRevenue: 0,
        totalOutstanding: 0,
        totalOverdue: 0,
        avgInvoiceValue: 0,
      };
    }
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string, reason?: string): Promise<boolean> {
    try {
      const success = await sheetsService.updateRowByKey(
        'Stand_Invoices',
        'InvoiceID',
        invoiceId,
        { Status: 'Cancelled' }
      );

      if (success) {
        const invoice = await this.getInvoiceById(invoiceId);
        if (invoice) {
          await standService.logActivity({
            StandID: invoice.StandID,
            ActivityType: 'InvoiceCancelled',
            Actor: 'System',
            EntityID: invoiceId,
            Description: `Invoice ${invoice.InvoiceNumber} cancelled${reason ? `: ${reason}` : ''}`,
          });
        }
      }

      return success;
    } catch (error: any) {
      logger.error({ err: error, invoiceId }, 'Failed to cancel invoice');
      return false;
    }
  }
}

export const standInvoicesService = new StandInvoicesService();
