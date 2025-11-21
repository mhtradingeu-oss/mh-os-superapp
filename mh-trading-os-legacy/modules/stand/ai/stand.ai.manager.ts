/**
 * Stand AI Manager - المدير الذكي للأكشاك
 * Oversees all stands and provides intelligent recommendations
 * Orchestrates 7 specialized AI agents for comprehensive stand management
 */

import { createLogger } from '../../../lib/logger';
import { generateAIResponse } from '../../../lib/openai';
import { standService } from '../stand.service';
import { standInvoicesService } from '../stand.invoices';
import { standContractsService } from '../stand.contracts';
import { type StandSite } from '@shared/schema';

// Import all AI agents
import { refillOptimizerAgent, type RefillPlan } from './agents/refill-optimizer.agent';
import { inventoryPredictorAgent, type InventoryForecast } from './agents/inventory-predictor.agent';
import { salesForecasterAgent, type StandSalesForecast } from './agents/sales-forecaster.agent';
import { contractAdvisorAgent, type ContractAdvisory } from './agents/contract-advisor.agent';
import { riskDetectorAgent, type RiskAssessment } from './agents/risk-detector.agent';
import { outreachAssistantAgent, type OutreachRecommendation } from './agents/outreach-assistant.agent';

const logger = createLogger('StandAIManager');

export interface StandHealthReport {
  standId: string;
  healthScore: number; // 0-100
  status: 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  issues: string[];
  recommendations: string[];
  metrics: {
    inventoryHealth: number;
    financialHealth: number;
    performanceHealth: number;
    contractHealth: number;
  };
}

export interface ComprehensiveAIReport {
  standId: string;
  generatedAt: string;
  healthReport: StandHealthReport;
  refillPlan?: RefillPlan;
  inventoryForecast?: InventoryForecast;
  salesForecast?: StandSalesForecast;
  contractAdvisory?: ContractAdvisory;
  riskAssessment?: RiskAssessment;
  outreachRecommendations?: OutreachRecommendation[];
  executiveSummary: string[];
  priorityActions: string[];
}

export class StandAIManager {
  /**
   * Generate comprehensive health report for a stand
   */
  async generateHealthReport(standId: string): Promise<StandHealthReport> {
    try {
      const stand = await standService.getStandById(standId);
      if (!stand) {
        throw new Error('Stand not found');
      }

      const [inventory, invoices, contract, kpisRaw, activitiesRaw] = await Promise.all([
        standService.getStandInventory(standId),
        standInvoicesService.getStandInvoices(standId),
        standContractsService.getActiveContract(standId),
        standService.getStandKPIs(standId),
        standService.getActivities(standId, 100),
      ]);

      // Default to empty arrays if null/undefined
      const kpis = kpisRaw || [];
      const activities = activitiesRaw || [];

      // Calculate health metrics
      const inventoryHealth = this.calculateInventoryHealth(inventory);
      const financialHealth = this.calculateFinancialHealth(invoices);
      const performanceHealth = this.calculatePerformanceHealth(kpis);
      const contractHealth = this.calculateContractHealth(contract);

      const healthScore = Math.round(
        (inventoryHealth * 0.3 +
          financialHealth * 0.3 +
          performanceHealth * 0.25 +
          contractHealth * 0.15)
      );

      const issues = this.identifyIssues(stand, inventory, invoices, contract, kpis);
      const recommendations = await this.generateAIRecommendations(stand, {
        inventoryHealth,
        financialHealth,
        performanceHealth,
        contractHealth,
        issues,
      });

      const status = this.getHealthStatus(healthScore);

      const report: StandHealthReport = {
        standId,
        healthScore,
        status,
        issues,
        recommendations,
        metrics: {
          inventoryHealth,
          financialHealth,
          performanceHealth,
          contractHealth,
        },
      };

      logger.info({ standId, healthScore, status }, 'Health report generated');
      return report;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to generate health report');
      throw new Error(`Failed to generate health report: ${error.message}`);
    }
  }

  /**
   * Calculate inventory health (0-100)
   */
  private calculateInventoryHealth(inventory: any[]): number {
    if (inventory.length === 0) return 30; // Low score for no inventory

    const stockoutItems = inventory.filter(i => (i.OnHand || 0) === 0).length;
    const lowStockItems = inventory.filter(i => 
      (i.OnHand || 0) > 0 && (i.OnHand || 0) < (i.Min || 0)
    ).length;
    const healthyItems = inventory.filter(i => 
      (i.OnHand || 0) >= (i.Min || 0)
    ).length;

    const stockoutPenalty = (stockoutItems / inventory.length) * 40;
    const lowStockPenalty = (lowStockItems / inventory.length) * 20;

    return Math.max(0, 100 - stockoutPenalty - lowStockPenalty);
  }

  /**
   * Calculate financial health (0-100)
   */
  private calculateFinancialHealth(invoices: any[]): number {
    if (invoices.length === 0) return 70; // Neutral score

    const overdueInvoices = invoices.filter(i => {
      if (i.Status === 'Paid' || !i.DueDate) return false;
      return new Date(i.DueDate) < new Date();
    });

    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.Total || 0), 0);
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.Total || 0), 0);

    const overduePenalty = totalAmount > 0 ? (overdueAmount / totalAmount) * 50 : 0;
    const overdueCountPenalty = (overdueInvoices.length / invoices.length) * 30;

    return Math.max(0, 100 - overduePenalty - overdueCountPenalty);
  }

  /**
   * Calculate performance health (0-100) - Protected from NaN
   */
  private calculatePerformanceHealth(kpis: any[]): number {
    if (!kpis || kpis.length === 0) return 50; // Neutral score

    const latestKPI = kpis[kpis.length - 1];
    if (!latestKPI) return 50;

    let score = 70;

    // Check revenue trend (protected from NaN)
    if (kpis.length >= 2) {
      const previousKPI = kpis[kpis.length - 2];
      const currentRevenue = Number(latestKPI.RevenueGross) || 0;
      const previousRevenue = Number(previousKPI.RevenueGross) || 0;
      
      if (previousRevenue > 0) {
        const revenueTrend = (currentRevenue - previousRevenue) / previousRevenue;
        
        if (!isNaN(revenueTrend)) {
          if (revenueTrend > 0.1) score += 15; // Growing >10%
          else if (revenueTrend < -0.1) score -= 20; // Declining >10%
        }
      }
    }

    // Check sell-through (protected from NaN)
    const sellThrough = Number(latestKPI['SellThrough%']) || 0;
    if (!isNaN(sellThrough)) {
      if (sellThrough > 70) score += 10;
      else if (sellThrough < 30) score -= 15;
    }

    // Check stockouts (protected from NaN)
    const stockouts = Number(latestKPI.Stockouts) || 0;
    if (!isNaN(stockouts)) {
      if (stockouts === 0) score += 5;
      else if (stockouts > 5) score -= 10;
    }

    const finalScore = Math.min(100, Math.max(0, score));
    return isNaN(finalScore) ? 50 : finalScore;
  }

  /**
   * Calculate contract health (0-100)
   */
  private calculateContractHealth(contract: any): number {
    if (!contract) return 20; // No contract = low health

    if (contract.Status !== 'Active') return 40;

    // Check expiry
    if (contract.EndDate) {
      const daysUntilExpiry = Math.floor(
        (new Date(contract.EndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry < 0) return 0; // Expired
      if (daysUntilExpiry < 30) return 60; // Expiring soon
      if (daysUntilExpiry < 90) return 80;
    }

    return 100;
  }

  /**
   * Identify issues
   */
  private identifyIssues(
    stand: StandSite,
    inventory: any[],
    invoices: any[],
    contract: any,
    kpis: any[]
  ): string[] {
    const issues: string[] = [];

    // Inventory issues
    const stockouts = inventory.filter(i => (i.OnHand || 0) === 0);
    if (stockouts.length > 0) {
      issues.push(`${stockouts.length} product(s) out of stock`);
    }

    const lowStock = inventory.filter(i => 
      (i.OnHand || 0) > 0 && (i.OnHand || 0) < (i.Min || 0)
    );
    if (lowStock.length > 0) {
      issues.push(`${lowStock.length} product(s) below minimum stock level`);
    }

    // Financial issues
    const overdueInvoices = invoices.filter(i => {
      if (i.Status === 'Paid' || !i.DueDate) return false;
      return new Date(i.DueDate) < new Date();
    });
    if (overdueInvoices.length > 0) {
      const overdueTotal = overdueInvoices.reduce((sum, inv) => sum + inv.Total, 0);
      issues.push(`${overdueInvoices.length} overdue invoice(s) totaling €${overdueTotal.toFixed(2)}`);
    }

    // Contract issues
    if (!contract) {
      issues.push('No active contract');
    } else if (contract.EndDate) {
      const daysUntilExpiry = Math.floor(
        (new Date(contract.EndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry < 30 && daysUntilExpiry >= 0) {
        issues.push(`Contract expires in ${daysUntilExpiry} days`);
      } else if (daysUntilExpiry < 0) {
        issues.push('Contract has expired');
      }
    }

    // Performance issues
    if (kpis.length > 0) {
      const latestKPI = kpis[kpis.length - 1];
      
      if ((latestKPI.Stockouts || 0) > 3) {
        issues.push(`High stockout rate (${latestKPI.Stockouts} occurrences)`);
      }

      if ((latestKPI['SellThrough%'] || 0) < 30) {
        issues.push(`Low sell-through rate (${latestKPI['SellThrough%']}%)`);
      }
    }

    return issues;
  }

  /**
   * Generate AI-powered recommendations (with truncation & fallback)
   */
  private async generateAIRecommendations(
    stand: StandSite,
    healthData: {
      inventoryHealth: number;
      financialHealth: number;
      performanceHealth: number;
      contractHealth: number;
      issues: string[];
    }
  ): Promise<string[]> {
    try {
      // Limit issues to prevent token overflow
      const limitedIssues = healthData.issues.slice(0, 5);
      
      const prompt = `Stand AI for ${stand.StandID} (${stand.City}): Health scores: Inv ${Math.round(healthData.inventoryHealth)}, Fin ${Math.round(healthData.financialHealth)}, Perf ${Math.round(healthData.performanceHealth)}, Contract ${Math.round(healthData.contractHealth)}
Issues: ${limitedIssues.join('; ')}

Return 3 recommendations as JSON: ["rec 1", "rec 2", "rec 3"]`;

      const response = await generateAIResponse(prompt);
      const recommendations = JSON.parse(response);
      
      if (Array.isArray(recommendations)) {
        return recommendations.slice(0, 5); // Max 5 recommendations
      }

      return ['Review inventory levels', 'Update contract terms', 'Improve cash flow management'];
    } catch (error: any) {
      logger.warn({ err: error }, 'Failed to generate AI recommendations, using fallback');
      return ['Review inventory levels', 'Update contract terms', 'Improve cash flow management'];
    }
  }

  /**
   * Get health status label
   */
  private getHealthStatus(score: number): 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical' {
    if (score >= 90) return 'Excellent';
    if (score >= 75) return 'Good';
    if (score >= 50) return 'Fair';
    if (score >= 30) return 'Poor';
    return 'Critical';
  }

  /**
   * Send alert for critical stand
   */
  async sendCriticalAlert(standId: string): Promise<void> {
    try {
      const report = await this.generateHealthReport(standId);
      
      if (report.healthScore < 30) {
        await standService.logActivity({
          StandID: standId,
          ActivityType: 'AIAlert',
          Actor: 'AI',
          Description: `Critical health alert: Score ${report.healthScore}/100`,
          MetadataJSON: JSON.stringify(report.issues),
        });

        logger.warn({ standId, healthScore: report.healthScore }, 'Critical stand health alert sent');
      }
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to send critical alert');
    }
  }

  /**
   * Generate comprehensive AI report using all 7 agents
   */
  async generateComprehensiveReport(standId: string): Promise<ComprehensiveAIReport> {
    try {
      logger.info({ standId }, 'Generating comprehensive AI report');

      const stand = await standService.getStandById(standId);
      if (!stand) {
        throw new Error('Stand not found');
      }

      // Gather all data in parallel (with null guards)
      const [inventory, invoices, contract, kpisRaw, activitiesRaw, salesHistory] = await Promise.all([
        standService.getStandInventory(standId),
        standInvoicesService.getStandInvoices(standId),
        standContractsService.getActiveContract(standId),
        standService.getStandKPIs(standId),
        standService.getActivities(standId, 100),
        this.getSalesHistory(standId), // Helper method
      ]);

      // Default to empty arrays if null/undefined
      const kpis = kpisRaw || [];
      const activities = activitiesRaw || [];

      // Run all AI agents in parallel
      const [
        healthReport,
        refillPlan,
        inventoryForecast,
        salesForecast,
        contractAdvisory,
        riskAssessment,
      ] = await Promise.all([
        this.generateHealthReport(standId),
        refillOptimizerAgent.generateRefillPlan(standId, inventory, salesHistory),
        inventoryPredictorAgent.generateForecast(standId, inventory, salesHistory, kpis),
        salesForecasterAgent.generateForecast(standId, salesHistory, inventory, kpis),
        contractAdvisorAgent.analyzeContract(standId, contract, kpis, invoices),
        riskDetectorAgent.assessRisks(standId, stand, inventory, invoices, contract, kpis, activities),
      ]);

      // Generate outreach recommendations based on findings
      const outreachRecommendations = await this.generateOutreachRecommendations(
        standId,
        stand,
        healthReport,
        riskAssessment
      );

      // Generate executive summary
      const executiveSummary = await this.generateExecutiveSummary(
        standId,
        healthReport,
        refillPlan,
        salesForecast,
        riskAssessment
      );

      // Compile priority actions
      const priorityActions = this.compilePriorityActions(
        healthReport,
        refillPlan,
        contractAdvisory,
        riskAssessment
      );

      const report: ComprehensiveAIReport = {
        standId,
        generatedAt: new Date().toISOString(),
        healthReport,
        refillPlan,
        inventoryForecast,
        salesForecast,
        contractAdvisory,
        riskAssessment,
        outreachRecommendations,
        executiveSummary,
        priorityActions,
      };

      logger.info(
        { 
          standId, 
          healthScore: healthReport.healthScore,
          riskScore: riskAssessment.riskScore,
          actionsCount: priorityActions.length 
        }, 
        'Comprehensive AI report generated'
      );

      return report;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to generate comprehensive report');
      throw new Error(`Failed to generate comprehensive report: ${error.message}`);
    }
  }

  /**
   * Get refill plan for stand
   */
  async getRefillPlan(standId: string, budget?: number): Promise<RefillPlan> {
    const inventory = await standService.getStandInventory(standId);
    const salesHistory = await this.getSalesHistory(standId);
    return refillOptimizerAgent.generateRefillPlan(standId, inventory, salesHistory, budget);
  }

  /**
   * Get inventory forecast
   */
  async getInventoryForecast(standId: string): Promise<InventoryForecast> {
    const inventory = await standService.getStandInventory(standId);
    const salesHistory = await this.getSalesHistory(standId);
    const kpisRaw = await standService.getStandKPIs(standId);
    const kpis = kpisRaw || [];
    return inventoryPredictorAgent.generateForecast(standId, inventory, salesHistory, kpis);
  }

  /**
   * Get sales forecast
   */
  async getSalesForecast(standId: string): Promise<StandSalesForecast> {
    const inventory = await standService.getStandInventory(standId);
    const salesHistory = await this.getSalesHistory(standId);
    const kpisRaw = await standService.getStandKPIs(standId);
    const kpis = kpisRaw || [];
    return salesForecasterAgent.generateForecast(standId, salesHistory, inventory, kpis);
  }

  /**
   * Get contract advisory
   */
  async getContractAdvisory(standId: string): Promise<ContractAdvisory> {
    const contract = await standContractsService.getActiveContract(standId);
    const kpisRaw = await standService.getStandKPIs(standId);
    const kpis = kpisRaw || [];
    const invoices = await standInvoicesService.getStandInvoices(standId);
    return contractAdvisorAgent.analyzeContract(standId, contract, kpis, invoices);
  }

  /**
   * Get risk assessment
   */
  async getRiskAssessment(standId: string): Promise<RiskAssessment> {
    const stand = await standService.getStandById(standId);
    if (!stand) throw new Error('Stand not found');

    const [inventory, invoices, contract, kpisRaw, activitiesRaw] = await Promise.all([
      standService.getStandInventory(standId),
      standInvoicesService.getStandInvoices(standId),
      standContractsService.getActiveContract(standId),
      standService.getStandKPIs(standId),
      standService.getActivities(standId, 100),
    ]);

    const kpis = kpisRaw || [];
    const activities = activitiesRaw || [];

    return riskDetectorAgent.assessRisks(standId, stand, inventory, invoices, contract, kpis, activities);
  }

  /**
   * Get outreach recommendations
   */
  async getOutreachRecommendation(
    standId: string,
    purpose: string,
    context?: any
  ): Promise<OutreachRecommendation> {
    const stand = await standService.getStandById(standId);
    if (!stand) throw new Error('Stand not found');

    return outreachAssistantAgent.generateOutreach(standId, stand, purpose, context);
  }

  /**
   * Helper: Get sales history (stub for now)
   */
  private async getSalesHistory(standId: string): Promise<any[]> {
    // TODO: Implement when sales tracking is added
    return [];
  }

  /**
   * Generate outreach recommendations based on stand status
   */
  private async generateOutreachRecommendations(
    standId: string,
    stand: any,
    healthReport: StandHealthReport,
    riskAssessment: RiskAssessment
  ): Promise<OutreachRecommendation[]> {
    const recommendations: OutreachRecommendation[] = [];

    try {
      // Critical health = urgent outreach
      if (healthReport.healthScore < 50) {
        const outreach = await outreachAssistantAgent.generateOutreach(
          standId,
          stand,
          'Issue Alert',
          {
            issues: healthReport.issues,
            performance: riskAssessment,
          }
        );
        recommendations.push(outreach);
      }

      // Excellent performance = celebration
      if (healthReport.healthScore >= 90) {
        const outreach = await outreachAssistantAgent.generateOutreach(
          standId,
          stand,
          'Celebration',
          {
            achievements: healthReport.recommendations,
          }
        );
        recommendations.push(outreach);
      }

      // Critical risks = urgent communication
      if (riskAssessment.riskLevel === 'Critical' || riskAssessment.riskLevel === 'High') {
        const criticalRisks = riskAssessment.risks.filter(r => r.severity === 'Critical');
        if (criticalRisks.length > 0) {
          const outreach = await outreachAssistantAgent.generateOutreach(
            standId,
            stand,
            'Issue Alert',
            {
              issues: criticalRisks.map(r => r.title),
            }
          );
          recommendations.push(outreach);
        }
      }

      return recommendations;
    } catch (error: any) {
      logger.warn({ err: error, standId }, 'Failed to generate outreach recommendations');
      return [];
    }
  }

  /**
   * Generate executive summary
   */
  private async generateExecutiveSummary(
    standId: string,
    healthReport: StandHealthReport,
    refillPlan: RefillPlan,
    salesForecast: StandSalesForecast,
    riskAssessment: RiskAssessment
  ): Promise<string[]> {
    const summary: string[] = [];

    // Health summary
    summary.push(
      `Stand Health: ${healthReport.status} (${healthReport.healthScore}/100) - ${healthReport.issues.length} issues identified`
    );

    // Refill summary
    if (refillPlan.totalItems > 0) {
      summary.push(
        `Refill Needed: ${refillPlan.totalItems} items (€${refillPlan.totalCost.toFixed(2)}) - Priority: ${refillPlan.priority}`
      );
    }

    // Sales forecast summary
    summary.push(
      `Sales Forecast (30d): €${salesForecast.overall.forecast30Days.predictedRevenue} revenue, ${salesForecast.overall.forecast30Days.predictedUnits} units - Trend: ${salesForecast.overall.forecast30Days.trend}`
    );

    // Risk summary
    summary.push(
      `Risk Level: ${riskAssessment.riskLevel} (${riskAssessment.riskScore}/100) - ${riskAssessment.risks.length} risks detected`
    );

    // Top priority
    if (riskAssessment.risks.length > 0) {
      const topRisk = riskAssessment.risks[0];
      summary.push(
        `Top Priority: ${topRisk.title} (${topRisk.severity})`
      );
    }

    return summary;
  }

  /**
   * Compile priority actions from all agents
   */
  private compilePriorityActions(
    healthReport: StandHealthReport,
    refillPlan: RefillPlan,
    contractAdvisory: ContractAdvisory,
    riskAssessment: RiskAssessment
  ): string[] {
    const actions: string[] = [];

    // Critical risks first
    const criticalRisks = riskAssessment.risks.filter(r => r.severity === 'Critical');
    if (criticalRisks.length > 0) {
      actions.push(`CRITICAL: Address ${criticalRisks.length} critical risk(s) immediately`);
      criticalRisks.slice(0, 3).forEach(risk => {
        actions.push(`• ${risk.title}: ${risk.mitigationActions[0]}`);
      });
    }

    // Urgent refills
    if (refillPlan.priority === 'Urgent') {
      actions.push(`URGENT: Execute refill plan (${refillPlan.totalItems} items, €${refillPlan.totalCost.toFixed(2)})`);
    }

    // Contract actions
    const criticalContractRecs = contractAdvisory.recommendations.filter(r => r.priority === 'Critical');
    if (criticalContractRecs.length > 0) {
      actions.push(...criticalContractRecs.map(rec => `Contract: ${rec.recommendation}`));
    }

    // Health recommendations
    if (healthReport.healthScore < 50) {
      actions.push(...healthReport.recommendations.slice(0, 3));
    }

    return actions.slice(0, 10); // Top 10 actions
  }
}

export const standAIManager = new StandAIManager();
