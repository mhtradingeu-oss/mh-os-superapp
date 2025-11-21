/**
 * Risk Detector Agent - كاشف المخاطر
 * Identifies and assesses operational, financial, and partnership risks
 */

import { createLogger } from '../../../../lib/logger';
import { generateAIResponse } from '../../../../lib/openai';

const logger = createLogger('RiskDetector');

export interface Risk {
  id: string;
  category: 'Operational' | 'Financial' | 'Contract' | 'Inventory' | 'Performance' | 'Compliance';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  title: string;
  description: string;
  impact: string;
  probability: 'Very Likely' | 'Likely' | 'Possible' | 'Unlikely';
  detectedAt: string;
  mitigationActions: string[];
  estimatedCost?: number;
}

export interface RiskAssessment {
  standId: string;
  assessmentDate: string;
  riskScore: number; // 0-100, higher = more risky
  riskLevel: 'Critical' | 'High' | 'Moderate' | 'Low';
  risks: Risk[];
  aiInsights: string[];
  urgentActions: string[];
  trends: {
    improvingAreas: string[];
    worseningAreas: string[];
  };
}

export class RiskDetectorAgent {
  /**
   * Perform comprehensive risk assessment
   */
  async assessRisks(
    standId: string,
    stand: any,
    inventory: any[],
    invoices: any[],
    contract: any,
    kpis: any[],
    activities: any[]
  ): Promise<RiskAssessment> {
    try {
      logger.info({ standId }, 'Performing risk assessment');

      // Detect risks across categories
      const operationalRisks = this.detectOperationalRisks(stand, inventory, activities);
      const financialRisks = this.detectFinancialRisks(invoices, kpis);
      const contractRisks = this.detectContractRisks(contract);
      const inventoryRisks = this.detectInventoryRisks(inventory, kpis);
      const performanceRisks = this.detectPerformanceRisks(kpis);

      const allRisks = [
        ...operationalRisks,
        ...financialRisks,
        ...contractRisks,
        ...inventoryRisks,
        ...performanceRisks,
      ];

      // Calculate overall risk score
      const riskScore = this.calculateRiskScore(allRisks);
      const riskLevel = this.getRiskLevel(riskScore);

      // Get AI insights
      const aiInsights = await this.getAIRiskInsights(standId, allRisks, riskScore);

      // Generate urgent actions
      const urgentActions = this.generateUrgentActions(allRisks);

      // Analyze trends
      const trends = this.analyzeTrends(kpis, activities);

      const assessment: RiskAssessment = {
        standId,
        assessmentDate: new Date().toISOString(),
        riskScore,
        riskLevel,
        risks: allRisks.slice(0, 20), // Top 20 risks
        aiInsights,
        urgentActions,
        trends,
      };

      logger.info({ standId, riskScore, riskLevel, risksCount: allRisks.length }, 'Risk assessment completed');
      return assessment;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to assess risks');
      
      // Return fallback assessment matching RiskAssessment interface
      return {
        standId,
        assessmentDate: new Date().toISOString(),
        riskScore: 50,
        riskLevel: 'Moderate',
        risks: [],
        aiInsights: ['Risk assessment unavailable - insufficient data'],
        urgentActions: ['Review stand manually'],
        trends: {
          improvingAreas: [],
          worseningAreas: [],
        },
      };
    }
  }

  /**
   * Detect operational risks
   */
  private detectOperationalRisks(stand: any, inventory: any[], activities: any[]): Risk[] {
    const risks: Risk[] = [];

    // Stand status risk
    if (stand.Status !== 'Active') {
      risks.push({
        id: `OP-${Date.now()}-01`,
        category: 'Operational',
        severity: 'Critical',
        title: 'Stand not active',
        description: `Stand status is "${stand.Status}" instead of "Active"`,
        impact: 'Revenue loss, operational disruption',
        probability: 'Very Likely',
        detectedAt: new Date().toISOString(),
        mitigationActions: [
          'Investigate reason for inactive status',
          'Develop reactivation plan',
          'Address underlying issues',
        ],
      });
    }

    // Location risk (if in high-risk area or poor performance location)
    if (stand.City && !['Berlin', 'Munich', 'Hamburg', 'Frankfurt'].includes(stand.City)) {
      risks.push({
        id: `OP-${Date.now()}-02`,
        category: 'Operational',
        severity: 'Low',
        title: 'Non-major city location',
        description: `Stand located in ${stand.City}, which may have lower foot traffic`,
        impact: 'Potentially lower sales volume',
        probability: 'Possible',
        detectedAt: new Date().toISOString(),
        mitigationActions: [
          'Analyze location performance metrics',
          'Consider targeted marketing for area',
          'Evaluate relocation opportunities',
        ],
      });
    }

    // Activity monitoring risk
    if (activities.length === 0) {
      risks.push({
        id: `OP-${Date.now()}-03`,
        category: 'Operational',
        severity: 'Medium',
        title: 'No recent activity',
        description: 'No logged activities for this stand',
        impact: 'Lack of oversight, potential operational issues',
        probability: 'Likely',
        detectedAt: new Date().toISOString(),
        mitigationActions: [
          'Schedule stand visit',
          'Implement regular activity logging',
          'Contact stand partner',
        ],
      });
    }

    return risks;
  }

  /**
   * Detect financial risks
   */
  private detectFinancialRisks(invoices: any[], kpis: any[]): Risk[] {
    const risks: Risk[] = [];

    // Overdue invoices risk
    const overdueInvoices = invoices.filter(inv => {
      if (inv.Status === 'Paid' || !inv.DueDate) return false;
      return new Date(inv.DueDate) < new Date();
    });

    if (overdueInvoices.length > 0) {
      const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.Total || 0), 0);
      
      risks.push({
        id: `FIN-${Date.now()}-01`,
        category: 'Financial',
        severity: overdueAmount > 1000 ? 'Critical' : 'High',
        title: 'Overdue invoices',
        description: `${overdueInvoices.length} invoice(s) overdue totaling €${overdueAmount.toFixed(2)}`,
        impact: 'Cash flow disruption, bad debt risk',
        probability: 'Very Likely',
        detectedAt: new Date().toISOString(),
        mitigationActions: [
          'Contact partner for immediate payment',
          'Review payment terms and enforcement',
          'Consider payment plan or collection action',
        ],
        estimatedCost: overdueAmount,
      });
    }

    // Revenue decline risk
    if (kpis.length >= 2) {
      const latest = kpis[kpis.length - 1];
      const previous = kpis[kpis.length - 2];
      const revenueTrend = ((latest.RevenueGross || 0) - (previous.RevenueGross || 0)) / (previous.RevenueGross || 1);

      if (revenueTrend < -0.15) {
        risks.push({
          id: `FIN-${Date.now()}-02`,
          category: 'Financial',
          severity: 'High',
          title: 'Revenue declining',
          description: `Revenue decreased by ${(revenueTrend * 100).toFixed(1)}% from previous period`,
          impact: 'Reduced profitability, partnership sustainability concerns',
          probability: 'Very Likely',
          detectedAt: new Date().toISOString(),
          mitigationActions: [
            'Analyze root causes of revenue decline',
            'Review product mix and pricing',
            'Develop revenue recovery plan',
          ],
        });
      }
    }

    // Low profitability risk
    if (kpis.length > 0) {
      const latest = kpis[kpis.length - 1];
      const grossMargin = latest.RevenueGross > 0 
        ? ((latest.RevenueGross - (latest.COGS || 0)) / latest.RevenueGross) * 100 
        : 0;

      if (grossMargin < 20) {
        risks.push({
          id: `FIN-${Date.now()}-03`,
          category: 'Financial',
          severity: 'Medium',
          title: 'Low profit margin',
          description: `Gross margin at ${grossMargin.toFixed(1)}%, below healthy threshold of 30%`,
          impact: 'Reduced profitability, financial sustainability concerns',
          probability: 'Likely',
          detectedAt: new Date().toISOString(),
          mitigationActions: [
            'Review pricing strategy',
            'Optimize product mix for higher margins',
            'Reduce operational costs',
          ],
        });
      }
    }

    return risks;
  }

  /**
   * Detect contract risks
   */
  private detectContractRisks(contract: any): Risk[] {
    const risks: Risk[] = [];

    // No contract risk
    if (!contract) {
      risks.push({
        id: `CON-${Date.now()}-01`,
        category: 'Contract',
        severity: 'Critical',
        title: 'No active contract',
        description: 'Stand operating without formal partnership agreement',
        impact: 'Legal exposure, undefined terms, relationship uncertainty',
        probability: 'Very Likely',
        detectedAt: new Date().toISOString(),
        mitigationActions: [
          'Execute formal partnership contract immediately',
          'Define clear terms and responsibilities',
          'Establish legal framework',
        ],
      });
      return risks;
    }

    // Contract expiry risk
    if (contract.EndDate) {
      const daysUntilExpiry = Math.floor(
        (new Date(contract.EndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry < 0) {
        risks.push({
          id: `CON-${Date.now()}-02`,
          category: 'Contract',
          severity: 'Critical',
          title: 'Contract expired',
          description: `Contract expired ${Math.abs(daysUntilExpiry)} days ago`,
          impact: 'Legal uncertainty, operating without valid agreement',
          probability: 'Very Likely',
          detectedAt: new Date().toISOString(),
          mitigationActions: [
            'Execute emergency contract renewal',
            'Negotiate new terms',
            'Formalize interim operating agreement',
          ],
        });
      } else if (daysUntilExpiry < 30) {
        risks.push({
          id: `CON-${Date.now()}-03`,
          category: 'Contract',
          severity: 'High',
          title: 'Contract expiring soon',
          description: `Contract expires in ${daysUntilExpiry} days`,
          impact: 'Risk of service disruption, rushed renewal',
          probability: 'Very Likely',
          detectedAt: new Date().toISOString(),
          mitigationActions: [
            'Initiate renewal process immediately',
            'Prepare negotiation strategy',
            'Assess partnership performance',
          ],
        });
      }
    }

    // Unfavorable terms risk
    if (contract['Commission%'] && contract['Commission%'] < 10) {
      risks.push({
        id: `CON-${Date.now()}-04`,
        category: 'Contract',
        severity: 'Medium',
        title: 'Low commission rate',
        description: `Commission rate of ${contract['Commission%']}% below market standard`,
        impact: 'Reduced revenue potential, partner dissatisfaction',
        probability: 'Likely',
        detectedAt: new Date().toISOString(),
        mitigationActions: [
          'Renegotiate commission rate',
          'Present performance data to justify increase',
          'Review market benchmarks',
        ],
      });
    }

    return risks;
  }

  /**
   * Detect inventory risks
   */
  private detectInventoryRisks(inventory: any[], kpis: any[]): Risk[] {
    const risks: Risk[] = [];

    // Stockout risk
    const stockouts = inventory.filter(i => (i.OnHand || 0) === 0);
    if (stockouts.length > 0) {
      risks.push({
        id: `INV-${Date.now()}-01`,
        category: 'Inventory',
        severity: stockouts.length > 5 ? 'Critical' : 'High',
        title: 'Products out of stock',
        description: `${stockouts.length} product(s) completely out of stock`,
        impact: 'Lost sales, customer dissatisfaction, reputation damage',
        probability: 'Very Likely',
        detectedAt: new Date().toISOString(),
        mitigationActions: [
          'Execute emergency refill order',
          'Review reorder points',
          'Improve demand forecasting',
        ],
      });
    }

    // Low stock risk
    const lowStock = inventory.filter(i => 
      (i.OnHand || 0) > 0 && (i.OnHand || 0) < (i.Min || 0)
    );
    if (lowStock.length > 0) {
      risks.push({
        id: `INV-${Date.now()}-02`,
        category: 'Inventory',
        severity: 'Medium',
        title: 'Low stock levels',
        description: `${lowStock.length} product(s) below minimum stock level`,
        impact: 'Potential stockouts, reduced sales',
        probability: 'Likely',
        detectedAt: new Date().toISOString(),
        mitigationActions: [
          'Place refill order',
          'Monitor stock levels closely',
          'Adjust safety stock levels',
        ],
      });
    }

    // Overstock risk
    const overstock = inventory.filter(i => 
      (i.OnHand || 0) > (i.Max || 100) * 1.5
    );
    if (overstock.length > 0) {
      risks.push({
        id: `INV-${Date.now()}-03`,
        category: 'Inventory',
        severity: 'Low',
        title: 'Excess inventory',
        description: `${overstock.length} product(s) significantly overstocked`,
        impact: 'Capital tied up, storage costs, obsolescence risk',
        probability: 'Possible',
        detectedAt: new Date().toISOString(),
        mitigationActions: [
          'Promote overstocked items',
          'Review demand forecasts',
          'Adjust reorder quantities',
        ],
      });
    }

    return risks;
  }

  /**
   * Detect performance risks
   */
  private detectPerformanceRisks(kpis: any[]): Risk[] {
    const risks: Risk[] = [];

    if (kpis.length === 0) return risks;

    const latest = kpis[kpis.length - 1];

    // High stockout rate risk
    if ((latest.Stockouts || 0) > 5) {
      risks.push({
        id: `PERF-${Date.now()}-01`,
        category: 'Performance',
        severity: 'High',
        title: 'High stockout rate',
        description: `${latest.Stockouts} stockout occurrences in reporting period`,
        impact: 'Customer dissatisfaction, lost sales, reputation damage',
        probability: 'Very Likely',
        detectedAt: new Date().toISOString(),
        mitigationActions: [
          'Improve inventory management',
          'Increase safety stock',
          'Enhance demand forecasting',
        ],
      });
    }

    // Low sell-through risk
    if ((latest['SellThrough%'] || 0) < 30) {
      risks.push({
        id: `PERF-${Date.now()}-02`,
        category: 'Performance',
        severity: 'Medium',
        title: 'Low sell-through rate',
        description: `Sell-through rate at ${latest['SellThrough%']}%, indicating slow inventory movement`,
        impact: 'Cash flow issues, inventory obsolescence',
        probability: 'Likely',
        detectedAt: new Date().toISOString(),
        mitigationActions: [
          'Review product assortment',
          'Implement promotional campaigns',
          'Adjust pricing strategy',
        ],
      });
    }

    return risks;
  }

  /**
   * Calculate overall risk score
   */
  private calculateRiskScore(risks: Risk[]): number {
    if (risks.length === 0) return 0;

    const severityWeights = { Critical: 25, High: 15, Medium: 8, Low: 3 };
    const totalWeight = risks.reduce((sum, risk) => sum + severityWeights[risk.severity], 0);

    return Math.min(100, totalWeight);
  }

  /**
   * Get risk level from score
   */
  private getRiskLevel(score: number): 'Critical' | 'High' | 'Moderate' | 'Low' {
    if (score >= 75) return 'Critical';
    if (score >= 50) return 'High';
    if (score >= 25) return 'Moderate';
    return 'Low';
  }

  /**
   * Get AI risk insights
   */
  private async getAIRiskInsights(
    standId: string,
    risks: Risk[],
    riskScore: number
  ): Promise<string[]> {
    try {
      const criticalRisks = risks.filter(r => r.severity === 'Critical');
      const highRisks = risks.filter(r => r.severity === 'High');

      const prompt = `Risk AI for Stand ${standId}: Score ${riskScore}/100, ${risks.length} risks
Critical: ${criticalRisks.length}, High: ${highRisks.length}
Top: ${risks.slice(0, 3).map(r => r.title).join(', ')}

Return 3 insights as JSON: ["insight 1", "insight 2", "insight 3"]`;

      const response = await generateAIResponse(prompt);
      const insights = JSON.parse(response);

      if (Array.isArray(insights)) {
        return insights.slice(0, 5);
      }

      return ['Address critical risks immediately', 'Implement preventive measures'];
    } catch (error: any) {
      logger.warn({ err: error }, 'Failed to get AI risk insights');
      return ['Address critical risks immediately', 'Implement preventive measures'];
    }
  }

  /**
   * Generate urgent actions
   */
  private generateUrgentActions(risks: Risk[]): string[] {
    const criticalRisks = risks.filter(r => r.severity === 'Critical');
    const highRisks = risks.filter(r => r.severity === 'High');

    const actions: string[] = [];

    if (criticalRisks.length > 0) {
      actions.push(`CRITICAL: Address ${criticalRisks.length} critical risk(s) within 24 hours`);
      criticalRisks.slice(0, 3).forEach(risk => {
        actions.push(`• ${risk.title}: ${risk.mitigationActions[0]}`);
      });
    }

    if (highRisks.length > 0) {
      actions.push(`Address ${highRisks.length} high-severity risk(s) within 7 days`);
    }

    return actions.slice(0, 10);
  }

  /**
   * Analyze trends
   */
  private analyzeTrends(kpis: any[], activities: any[]): {
    improvingAreas: string[];
    worseningAreas: string[];
  } {
    const improvingAreas: string[] = [];
    const worseningAreas: string[] = [];

    if (kpis.length >= 2) {
      const latest = kpis[kpis.length - 1];
      const previous = kpis[kpis.length - 2];

      // Revenue trend
      const revenueTrend = ((latest.RevenueGross || 0) - (previous.RevenueGross || 0)) / (previous.RevenueGross || 1);
      if (revenueTrend > 0.05) improvingAreas.push('Revenue growing');
      else if (revenueTrend < -0.05) worseningAreas.push('Revenue declining');

      // Stockouts trend
      const stockoutTrend = (latest.Stockouts || 0) - (previous.Stockouts || 0);
      if (stockoutTrend < 0) improvingAreas.push('Fewer stockouts');
      else if (stockoutTrend > 0) worseningAreas.push('Increasing stockouts');

      // Sell-through trend
      const sellThroughTrend = (latest['SellThrough%'] || 0) - (previous['SellThrough%'] || 0);
      if (sellThroughTrend > 5) improvingAreas.push('Better sell-through rate');
      else if (sellThroughTrend < -5) worseningAreas.push('Declining sell-through');
    }

    return { improvingAreas, worseningAreas };
  }
}

export const riskDetectorAgent = new RiskDetectorAgent();
