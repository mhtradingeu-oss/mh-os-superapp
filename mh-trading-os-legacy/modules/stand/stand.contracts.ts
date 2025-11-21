/**
 * Stand Contracts Service
 * Manages contracts for stand partners
 */

import { createLogger } from '../../lib/logger';
import { sheetsService } from '../../lib/sheets';
import { nanoid } from 'nanoid';
import { type StandContract, type StandContractInsert } from '@shared/schema';
import { standService } from './stand.service';

const logger = createLogger('StandContracts');

export class StandContractsService {
  /**
   * Get all contracts for a stand
   */
  async getStandContracts(standId: string): Promise<StandContract[]> {
    try {
      const allContracts = await sheetsService.readSheet<StandContract>('Stand_Contracts');
      return allContracts.filter(c => c.StandID === standId);
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get contracts');
      throw new Error(`Failed to get contracts: ${error.message}`);
    }
  }

  /**
   * Get active contract for stand
   */
  async getActiveContract(standId: string): Promise<StandContract | null> {
    try {
      const contracts = await this.getStandContracts(standId);
      const activeContracts = contracts.filter(c => c.Status === 'Active');
      return activeContracts[0] || null;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to get active contract');
      return null;
    }
  }

  /**
   * Create new contract
   */
  async createContract(data: StandContractInsert): Promise<StandContract> {
    try {
      const contractId = `CONTRACT-${nanoid(8).toUpperCase()}`;
      const now = new Date().toISOString();

      const contract: StandContract = {
        ContractID: contractId,
        ...data,
        Status: data.Status || 'Draft',
      };

      await sheetsService.writeRows('Stand_Contracts', [contract]);

      await standService.logActivity({
        StandID: data.StandID,
        ActivityType: 'ContractSigned',
        Actor: data.SignedBy || 'System',
        EntityID: contractId,
        Description: `New ${data.ContractType} contract created`,
      });

      logger.info({ contractId, standId: data.StandID }, 'Contract created');
      return contract;
    } catch (error: any) {
      logger.error({ err: error, data }, 'Failed to create contract');
      throw new Error(`Failed to create contract: ${error.message}`);
    }
  }

  /**
   * Update contract
   */
  async updateContract(contractId: string, updates: Partial<StandContract>): Promise<boolean> {
    try {
      const success = await sheetsService.updateRowByKey(
        'Stand_Contracts',
        'ContractID',
        contractId,
        updates
      );

      if (success && updates.Status === 'Active') {
        const contracts = await sheetsService.readSheet<StandContract>('Stand_Contracts');
        const contract = contracts.find(c => c.ContractID === contractId);
        
        if (contract) {
          await standService.logActivity({
            StandID: contract.StandID,
            ActivityType: 'ContractSigned',
            EntityID: contractId,
            Description: 'Contract activated',
          });
        }
      }

      return success;
    } catch (error: any) {
      logger.error({ err: error, contractId, updates }, 'Failed to update contract');
      return false;
    }
  }

  /**
   * Check if contract needs renewal
   */
  async checkRenewalNeeded(standId: string): Promise<boolean> {
    try {
      const activeContract = await this.getActiveContract(standId);
      if (!activeContract || !activeContract.EndDate) return false;

      const endDate = new Date(activeContract.EndDate);
      const daysUntilExpiry = Math.floor((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return daysUntilExpiry <= 30;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to check renewal');
      return false;
    }
  }

  /**
   * Get all contracts (across all stands)
   */
  async getAllContracts(): Promise<StandContract[]> {
    try {
      const contracts = await sheetsService.readSheet<StandContract>('Stand_Contracts');
      return contracts;
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get all contracts');
      throw new Error(`Failed to get all contracts: ${error.message}`);
    }
  }

  /**
   * Get contract by ID
   */
  async getContractById(contractId: string): Promise<StandContract | null> {
    try {
      const contracts = await sheetsService.readSheet<StandContract>('Stand_Contracts');
      return contracts.find(c => c.ContractID === contractId) || null;
    } catch (error: any) {
      logger.error({ err: error, contractId }, 'Failed to get contract');
      return null;
    }
  }

  /**
   * Renew contract (create new contract based on existing one)
   */
  async renewContract(contractId: string, duration?: number): Promise<StandContract> {
    try {
      const existingContract = await this.getContractById(contractId);
      if (!existingContract) {
        throw new Error('Contract not found');
      }

      // Calculate new dates
      const today = new Date();
      const contractDuration = duration || existingContract.Duration || 12;
      const endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + contractDuration);

      // Create renewed contract
      const newContract: StandContract = {
        ContractID: `CONTRACT-${nanoid(8).toUpperCase()}`,
        StandID: existingContract.StandID,
        PartnerID: existingContract.PartnerID,
        ContractType: existingContract.ContractType,
        StartDate: today.toISOString().split('T')[0],
        EndDate: endDate.toISOString().split('T')[0],
        Duration: contractDuration,
        MonthlyFee: existingContract.MonthlyFee,
        CommissionRate: existingContract.CommissionRate,
        Status: 'Active',
        Notes: `Renewed from ${contractId}`,
      };

      await sheetsService.writeRows('Stand_Contracts', [newContract]);

      // Update old contract status
      await this.updateContract(contractId, { Status: 'Expired' });

      // Log activity
      await standService.logActivity({
        StandID: existingContract.StandID,
        ActivityType: 'ContractSigned',
        EntityID: newContract.ContractID,
        Description: `Contract renewed from ${contractId}`,
      });

      logger.info({ contractId, newContractId: newContract.ContractID }, 'Contract renewed');
      return newContract;
    } catch (error: any) {
      logger.error({ err: error, contractId }, 'Failed to renew contract');
      throw new Error(`Failed to renew contract: ${error.message}`);
    }
  }

  /**
   * Terminate contract
   */
  async terminateContract(contractId: string, reason?: string): Promise<boolean> {
    try {
      const contract = await this.getContractById(contractId);
      if (!contract) {
        throw new Error('Contract not found');
      }

      const success = await this.updateContract(contractId, {
        Status: 'Terminated',
        Notes: reason ? `Terminated: ${reason}` : 'Terminated',
      });

      if (success) {
        await standService.logActivity({
          StandID: contract.StandID,
          ActivityType: 'ContractSigned',
          EntityID: contractId,
          Description: `Contract terminated${reason ? `: ${reason}` : ''}`,
        });
      }

      logger.info({ contractId }, 'Contract terminated');
      return success;
    } catch (error: any) {
      logger.error({ err: error, contractId }, 'Failed to terminate contract');
      return false;
    }
  }

  /**
   * Get contract analytics
   */
  async getContractAnalytics() {
    try {
      const contracts = await sheetsService.readSheet<StandContract>('Stand_Contracts');
      
      const total = contracts.length;
      const active = contracts.filter(c => c.Status === 'Active').length;
      const expired = contracts.filter(c => c.Status === 'Expired').length;
      const terminated = contracts.filter(c => c.Status === 'Terminated').length;
      const draft = contracts.filter(c => c.Status === 'Draft').length;

      // Calculate expiring soon (within 30 days)
      const now = Date.now();
      const expiringSoon = contracts.filter(c => {
        if (c.Status !== 'Active' || !c.EndDate) return false;
        const endDate = new Date(c.EndDate).getTime();
        const daysUntil = Math.floor((endDate - now) / (1000 * 60 * 60 * 24));
        return daysUntil > 0 && daysUntil <= 30;
      }).length;

      // Contract types breakdown
      const byType = {
        sale: contracts.filter(c => c.ContractType === 'Sale').length,
        commission: contracts.filter(c => c.ContractType === 'Commission').length,
        rental: contracts.filter(c => c.ContractType === 'Rental').length,
      };

      // Calculate average monthly fee and commission rate
      const activeContracts = contracts.filter(c => c.Status === 'Active');
      const avgMonthlyFee = activeContracts.length > 0
        ? activeContracts.reduce((sum, c) => sum + (c.MonthlyFee || 0), 0) / activeContracts.length
        : 0;
      const avgCommissionRate = activeContracts.length > 0
        ? activeContracts.reduce((sum, c) => sum + (c.CommissionRate || 0), 0) / activeContracts.length
        : 0;

      return {
        total,
        active,
        expired,
        terminated,
        draft,
        expiringSoon,
        byType,
        avgMonthlyFee,
        avgCommissionRate,
        recentContracts: contracts.slice(0, 10), // Last 10 contracts
      };
    } catch (error: any) {
      logger.error({ err: error }, 'Failed to get contract analytics');
      throw new Error(`Failed to get contract analytics: ${error.message}`);
    }
  }
}

export const standContractsService = new StandContractsService();
