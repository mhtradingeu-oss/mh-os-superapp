/**
 * Contract Advisor Agent - مستشار العقود
 * Provides intelligent advice on contract terms and negotiations
 */

import { createLogger } from '../../../../lib/logger';
import { generateAIResponse } from '../../../../lib/openai';

const logger = createLogger('ContractAdvisor');

export interface ContractAnalysis {
  contractId: string;
  overallScore: number; // 0-100
  rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  opportunities: string[];
}

export interface ContractRecommendation {
  category: 'Pricing' | 'Terms' | 'Duration' | 'Performance' | 'Renewal' | 'Termination';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  recommendation: string;
  impact: string;
  rationale: string;
}

export interface ContractAdvisory {
  standId: string;
  contractId?: string;
  analysis: ContractAnalysis;
  recommendations: ContractRecommendation[];
  aiInsights: string[];
  suggestedActions: string[];
}

export class ContractAdvisorAgent {
  /**
   * Analyze a contract and provide advisory
   */
  async analyzeContract(
    standId: string,
    contract: any,
    performanceData?: any[],
    financialData?: any[]
  ): Promise<ContractAdvisory> {
    try {
      logger.info({ standId, contractId: contract?.ContractID }, 'Analyzing contract');

      if (!contract) {
        return this.generateNoContractAdvisory(standId);
      }

      // Perform contract analysis
      const analysis = this.performContractAnalysis(contract, performanceData, financialData);

      // Generate recommendations
      const recommendations = await this.generateContractRecommendations(
        contract,
        analysis,
        performanceData,
        financialData
      );

      // Get AI insights
      const aiInsights = await this.getAIContractInsights(
        standId,
        contract,
        analysis,
        performanceData
      );

      // Generate suggested actions
      const suggestedActions = this.generateSuggestedActions(contract, analysis, recommendations);

      const advisory: ContractAdvisory = {
        standId,
        contractId: contract.ContractID,
        analysis,
        recommendations,
        aiInsights,
        suggestedActions,
      };

      logger.info({ standId, score: analysis.overallScore }, 'Contract analysis completed');
      return advisory;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to analyze contract');
      
      // Return fallback advisory matching ContractAdvisory interface exactly
      return {
        standId,
        contractId: contract?.ContractID || 'UNKNOWN',
        analysis: {
          contractId: contract?.ContractID || 'UNKNOWN',
          overallScore: 50,
          rating: 'Fair',
          strengths: [],
          weaknesses: [],
          risks: [],
          opportunities: [],
        },
        recommendations: [{
          category: 'Terms',
          priority: 'Medium',
          recommendation: 'Review contract terms and consult legal advisor',
          impact: 'Improved contract understanding',
          rationale: 'Unable to analyze - insufficient data',
        }],
        aiInsights: ['Contract analysis unavailable - insufficient data'],
        suggestedActions: ['Review contract manually'],
      };
    }
  }

  /**
   * Perform detailed contract analysis
   */
  private performContractAnalysis(
    contract: any,
    performanceData?: any[],
    financialData?: any[]
  ): ContractAnalysis {
    let score = 70; // Base score
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const risks: string[] = [];
    const opportunities: string[] = [];

    // Analyze contract status
    if (contract.Status === 'Active') {
      strengths.push('Contract is currently active');
      score += 10;
    } else if (contract.Status === 'Expired') {
      weaknesses.push('Contract has expired');
      risks.push('Operating without valid contract');
      score -= 30;
    }

    // Analyze contract duration
    if (contract.StartDate && contract.EndDate) {
      const start = new Date(contract.StartDate);
      const end = new Date(contract.EndDate);
      const durationMonths = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
      
      if (durationMonths >= 12) {
        strengths.push(`Long-term contract (${durationMonths} months) provides stability`);
        score += 5;
      } else if (durationMonths < 6) {
        weaknesses.push(`Short contract duration (${durationMonths} months)`);
        score -= 5;
      }

      // Check expiry
      const daysUntilExpiry = Math.floor((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 0) {
        risks.push('Contract has expired');
        score -= 20;
      } else if (daysUntilExpiry < 30) {
        risks.push(`Contract expires in ${daysUntilExpiry} days`);
        opportunities.push('Opportunity to renegotiate better terms');
        score -= 10;
      } else if (daysUntilExpiry < 90) {
        opportunities.push('Plan renewal strategy well in advance');
      }
    }

    // Analyze commission structure
    if (contract['Commission%']) {
      const commission = contract['Commission%'];
      if (commission >= 15) {
        strengths.push(`Favorable commission rate (${commission}%)`);
        score += 10;
      } else if (commission < 10) {
        weaknesses.push(`Low commission rate (${commission}%)`);
        opportunities.push('Negotiate higher commission rate');
        score -= 10;
      }
    }

    // Analyze payment terms
    if (contract.PaymentTermsDays) {
      const terms = contract.PaymentTermsDays;
      if (terms <= 30) {
        strengths.push(`Good payment terms (Net ${terms})`);
        score += 5;
      } else if (terms > 60) {
        weaknesses.push(`Long payment terms (Net ${terms})`);
        score -= 5;
      }
    }

    // Analyze auto-renewal
    if (contract.AutoRenew === 'Yes') {
      strengths.push('Auto-renewal clause provides continuity');
      risks.push('Auto-renewal may lock in unfavorable terms');
      score += 3;
    } else {
      opportunities.push('Manually renew to negotiate better terms');
    }

    // Analyze performance vs contract
    if (performanceData && performanceData.length > 0) {
      const latestPerformance = performanceData[performanceData.length - 1];
      const targetRevenue = contract.TargetRevenue || 0;
      const actualRevenue = latestPerformance.RevenueGross || 0;

      if (targetRevenue > 0 && actualRevenue >= targetRevenue) {
        strengths.push('Meeting or exceeding revenue targets');
        opportunities.push('Leverage strong performance in renewal negotiations');
        score += 10;
      } else if (targetRevenue > 0 && actualRevenue < targetRevenue * 0.8) {
        weaknesses.push('Underperforming revenue targets');
        risks.push('Risk of contract termination or penalty');
        score -= 15;
      }
    }

    // Determine rating
    let rating: 'Excellent' | 'Good' | 'Fair' | 'Poor' = 'Fair';
    if (score >= 85) rating = 'Excellent';
    else if (score >= 70) rating = 'Good';
    else if (score >= 50) rating = 'Fair';
    else rating = 'Poor';

    return {
      contractId: contract.ContractID,
      overallScore: Math.min(100, Math.max(0, score)),
      rating,
      strengths,
      weaknesses,
      risks,
      opportunities,
    };
  }

  /**
   * Generate contract recommendations
   */
  private async generateContractRecommendations(
    contract: any,
    analysis: ContractAnalysis,
    performanceData?: any[],
    financialData?: any[]
  ): Promise<ContractRecommendation[]> {
    const recommendations: ContractRecommendation[] = [];

    // Renewal recommendations
    if (contract.EndDate) {
      const daysUntilExpiry = Math.floor(
        (new Date(contract.EndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilExpiry < 90 && daysUntilExpiry > 0) {
        recommendations.push({
          category: 'Renewal',
          priority: 'High',
          recommendation: 'Initiate contract renewal process immediately',
          impact: 'Ensure business continuity',
          rationale: `Contract expires in ${daysUntilExpiry} days. Starting renewal process now allows time for negotiation.`,
        });
      } else if (daysUntilExpiry < 0) {
        recommendations.push({
          category: 'Renewal',
          priority: 'Critical',
          recommendation: 'Execute emergency contract renewal',
          impact: 'Restore legal standing',
          rationale: 'Operating without valid contract exposes to legal and financial risks.',
        });
      }
    }

    // Commission recommendations
    if (contract['Commission%'] && contract['Commission%'] < 12) {
      recommendations.push({
        category: 'Pricing',
        priority: 'Medium',
        recommendation: 'Negotiate commission rate increase to market standard (12-15%)',
        impact: `Potential revenue increase of €${((15 - contract['Commission%']) * 1000).toFixed(0)}/month`,
        rationale: 'Current commission below market average. Strong performance justifies higher rate.',
      });
    }

    // Performance-based recommendations
    if (performanceData && performanceData.length > 0) {
      const latest = performanceData[performanceData.length - 1];
      const targetRevenue = contract.TargetRevenue || 0;
      
      if (targetRevenue > 0 && latest.RevenueGross >= targetRevenue * 1.2) {
        recommendations.push({
          category: 'Performance',
          priority: 'High',
          recommendation: 'Request performance bonus or commission tier upgrade',
          impact: 'Reward exceptional performance',
          rationale: `Exceeding revenue target by ${((latest.RevenueGross / targetRevenue - 1) * 100).toFixed(0)}%`,
        });
      }
    }

    // Terms recommendations
    if (contract.PaymentTermsDays && contract.PaymentTermsDays > 45) {
      recommendations.push({
        category: 'Terms',
        priority: 'Medium',
        recommendation: 'Negotiate shorter payment terms (Net 30)',
        impact: 'Improve cash flow by reducing Days Sales Outstanding',
        rationale: 'Current payment terms impact working capital. Industry standard is Net 30.',
      });
    }

    // Duration recommendations
    if (contract.StartDate && contract.EndDate) {
      const durationMonths = Math.floor(
        (new Date(contract.EndDate).getTime() - new Date(contract.StartDate).getTime()) / 
        (1000 * 60 * 60 * 24 * 30)
      );
      
      if (durationMonths < 12) {
        recommendations.push({
          category: 'Duration',
          priority: 'Low',
          recommendation: 'Request longer contract term (12-24 months)',
          impact: 'Provide stability and reduce renewal overhead',
          rationale: 'Short contracts require frequent renegotiation. Longer terms benefit both parties.',
        });
      }
    }

    // Sort by priority
    const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations.slice(0, 10); // Max 10 recommendations
  }

  /**
   * Get AI contract insights
   */
  private async getAIContractInsights(
    standId: string,
    contract: any,
    analysis: ContractAnalysis,
    performanceData?: any[]
  ): Promise<string[]> {
    try {
      const prompt = `Contract AI for Stand ${standId}: ${contract.Status}, ${contract['Commission%'] || 0}% commission
Score: ${analysis.overallScore}/100 (${analysis.rating})
${analysis.risks.length} risks, ${analysis.strengths.length} strengths

Return 3 insights as JSON: ["insight 1", "insight 2", "insight 3"]`;

      const response = await generateAIResponse(prompt);
      const insights = JSON.parse(response);

      if (Array.isArray(insights)) {
        return insights.slice(0, 5);
      }

      return ['Review contract terms periodically', 'Maintain strong performance metrics'];
    } catch (error: any) {
      logger.warn({ err: error }, 'Failed to get AI contract insights');
      return ['Review contract terms periodically', 'Maintain strong performance metrics'];
    }
  }

  /**
   * Generate suggested actions
   */
  private generateSuggestedActions(
    contract: any,
    analysis: ContractAnalysis,
    recommendations: ContractRecommendation[]
  ): string[] {
    const actions: string[] = [];

    // Urgent actions based on risks
    if (analysis.risks.length > 0) {
      const criticalRisks = analysis.risks.filter(r => 
        r.includes('expired') || r.includes('expires in')
      );
      if (criticalRisks.length > 0) {
        actions.push('URGENT: Schedule contract renewal meeting within 48 hours');
      }
    }

    // Actions from recommendations
    const criticalRecs = recommendations.filter(r => r.priority === 'Critical');
    if (criticalRecs.length > 0) {
      actions.push(`Address ${criticalRecs.length} critical contract issues immediately`);
    }

    const highRecs = recommendations.filter(r => r.priority === 'High');
    if (highRecs.length > 0) {
      actions.push(`Plan to address ${highRecs.length} high-priority items in next 30 days`);
    }

    // Opportunity actions
    if (analysis.opportunities.length > 0) {
      actions.push('Prepare negotiation strategy to capitalize on identified opportunities');
    }

    // Performance actions
    if (analysis.overallScore < 60) {
      actions.push('Conduct comprehensive contract review and restructuring');
    }

    return actions.slice(0, 5);
  }

  /**
   * Generate advisory for stands without contract
   */
  private generateNoContractAdvisory(standId: string): ContractAdvisory {
    return {
      standId,
      analysis: {
        contractId: 'N/A',
        overallScore: 0,
        rating: 'Poor',
        strengths: [],
        weaknesses: ['No active contract'],
        risks: ['Operating without legal framework', 'No defined terms or protections'],
        opportunities: ['Establish formal partnership agreement'],
      },
      recommendations: [
        {
          category: 'Terms',
          priority: 'Critical',
          recommendation: 'Execute formal partnership contract immediately',
          impact: 'Establish legal framework and protect both parties',
          rationale: 'Operating without contract exposes to legal and financial risks.',
        },
      ],
      aiInsights: [
        'Lack of contract creates legal uncertainty',
        'Formalize relationship to enable growth',
        'Contract provides framework for dispute resolution',
      ],
      suggestedActions: [
        'URGENT: Draft and execute partnership contract',
        'Consult legal advisor on contract terms',
        'Establish clear performance metrics and expectations',
      ],
    };
  }
}

export const contractAdvisorAgent = new ContractAdvisorAgent();
