/**
 * Refill Optimizer Agent - محسن إعادة التعبئة
 * Analyzes inventory and recommends optimal refill plans
 */

import { createLogger } from '../../../../lib/logger';
import { generateAIResponse } from '../../../../lib/openai';

const logger = createLogger('RefillOptimizer');

export interface RefillRecommendation {
  ProductID: string;
  ProductName: string;
  CurrentStock: number;
  MinStock: number;
  MaxStock: number;
  RecommendedQuantity: number;
  Priority: 'Critical' | 'High' | 'Medium' | 'Low';
  Reasoning: string;
  EstimatedCost?: number;
  DaysOfStock?: number;
}

export interface RefillPlan {
  standId: string;
  totalItems: number;
  totalCost: number;
  priority: 'Urgent' | 'Soon' | 'Normal' | 'Optional';
  recommendations: RefillRecommendation[];
  aiInsights: string[];
}

export class RefillOptimizerAgent {
  /**
   * Generate optimal refill plan for a stand
   */
  async generateRefillPlan(
    standId: string,
    inventory: any[],
    salesHistory?: any[],
    budget?: number
  ): Promise<RefillPlan> {
    try {
      logger.info({ standId, inventoryCount: inventory.length }, 'Generating refill plan');

      // Limit data to prevent token overflow
      const limitedInventory = inventory.slice(0, 50); // Max 50 products
      const limitedSalesHistory = salesHistory ? salesHistory.slice(-100) : []; // Last 100 transactions
      
      // Calculate basic refill needs
      const basicRecommendations = this.calculateBasicRefills(limitedInventory, limitedSalesHistory);
      
      // Get AI-enhanced recommendations
      const aiRecommendations = await this.getAIRefillRecommendations(
        standId,
        limitedInventory,
        limitedSalesHistory,
        budget
      );

      // Merge and prioritize
      const recommendations = this.mergeRecommendations(basicRecommendations, aiRecommendations);
      
      // Calculate totals
      const totalCost = recommendations.reduce((sum, rec) => sum + (rec.EstimatedCost || 0), 0);
      const totalItems = recommendations.reduce((sum, rec) => sum + rec.RecommendedQuantity, 0);

      // Determine priority
      const criticalItems = recommendations.filter(r => r.Priority === 'Critical').length;
      const highItems = recommendations.filter(r => r.Priority === 'High').length;
      
      let priority: 'Urgent' | 'Soon' | 'Normal' | 'Optional' = 'Normal';
      if (criticalItems > 0) priority = 'Urgent';
      else if (highItems > 3) priority = 'Soon';
      else if (recommendations.length === 0) priority = 'Optional';

      // Get AI insights
      const aiInsights = await this.getAIInsights(standId, recommendations, totalCost, budget);

      const plan: RefillPlan = {
        standId,
        totalItems,
        totalCost,
        priority,
        recommendations: recommendations.slice(0, 50), // Max 50 items
        aiInsights,
      };

      logger.info({ standId, totalCost, totalItems, priority }, 'Refill plan generated');
      return plan;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to generate refill plan');
      
      // Return fallback plan matching RefillPlan interface
      return {
        standId,
        totalItems: 0,
        totalCost: 0,
        priority: 'Normal',
        recommendations: [],
        aiInsights: ['Unable to generate refill plan - insufficient data'],
      };
    }
  }

  /**
   * Calculate basic refill recommendations using simple logic
   */
  private calculateBasicRefills(
    inventory: any[],
    salesHistory?: any[]
  ): RefillRecommendation[] {
    const recommendations: RefillRecommendation[] = [];

    for (const item of inventory) {
      const onHand = item.OnHand || 0;
      const min = item.Min || 0;
      const max = item.Max || min * 3;

      // Skip if stock is adequate
      if (onHand >= min) continue;

      // Calculate recommended quantity
      let recommendedQty = max - onHand;

      // Adjust based on sales velocity if available
      if (salesHistory && salesHistory.length > 0) {
        const itemSales = salesHistory.filter(s => s.ProductID === item.ProductID);
        if (itemSales.length > 0) {
          const avgDailySales = itemSales.reduce((sum, s) => sum + (s.Quantity || 0), 0) / 30;
          const daysOfStock = onHand / (avgDailySales || 1);
          
          // Order for 30 days if running low
          if (daysOfStock < 7) {
            recommendedQty = Math.ceil(avgDailySales * 30);
          }
        }
      }

      // Determine priority
      let priority: 'Critical' | 'High' | 'Medium' | 'Low' = 'Medium';
      if (onHand === 0) priority = 'Critical';
      else if (onHand < min * 0.5) priority = 'High';
      else if (onHand < min) priority = 'Medium';
      else priority = 'Low';

      recommendations.push({
        ProductID: item.ProductID,
        ProductName: item.ProductName || item.ProductID,
        CurrentStock: onHand,
        MinStock: min,
        MaxStock: max,
        RecommendedQuantity: recommendedQty,
        Priority: priority,
        Reasoning: this.generateReasoning(onHand, min, max, priority),
        EstimatedCost: (item.CostPrice || 0) * recommendedQty,
        DaysOfStock: onHand / Math.max(1, (item.AvgDailySales || 1)),
      });
    }

    // Sort by priority
    const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    recommendations.sort((a, b) => priorityOrder[a.Priority] - priorityOrder[b.Priority]);

    return recommendations;
  }

  /**
   * Generate reasoning text
   */
  private generateReasoning(onHand: number, min: number, max: number, priority: string): string {
    if (onHand === 0) return 'Out of stock - critical refill needed';
    if (onHand < min * 0.5) return `Stock critically low (${Math.round((onHand/min)*100)}% of minimum)`;
    if (onHand < min) return `Below minimum stock level (${onHand}/${min})`;
    return 'Stock adequate but below optimal level';
  }

  /**
   * Get AI-enhanced recommendations
   */
  private async getAIRefillRecommendations(
    standId: string,
    inventory: any[],
    salesHistory?: any[],
    budget?: number
  ): Promise<RefillRecommendation[]> {
    try {
      const lowStockItems = inventory.filter(i => (i.OnHand || 0) < (i.Min || 0));
      
      if (lowStockItems.length === 0) return [];

      // Limit items to prevent token overflow
      const itemsToAnalyze = lowStockItems.slice(0, 10);
      
      const prompt = `Inventory AI: Analyze ${itemsToAnalyze.length} low-stock items for Stand ${standId}. Budget: ${budget ? `€${budget}` : 'Unlimited'}

Items:
${itemsToAnalyze.map(item => `${item.ProductName || item.ProductID}: Stock ${item.OnHand}/${item.Min}, Cost €${item.CostPrice || 0}`).join('\n')}

Return JSON array:
[{"ProductID": "string", "RecommendedQuantity": number, "Priority": "Critical|High|Medium|Low", "Reasoning": "brief"}]`;

      const response = await generateAIResponse(prompt);
      const aiRecs = JSON.parse(response);

      if (!Array.isArray(aiRecs)) return [];

      return aiRecs.map((rec: any) => ({
        ProductID: rec.ProductID,
        ProductName: rec.ProductName || rec.ProductID,
        CurrentStock: 0,
        MinStock: 0,
        MaxStock: 0,
        RecommendedQuantity: rec.RecommendedQuantity || 0,
        Priority: rec.Priority || 'Medium',
        Reasoning: rec.Reasoning || '',
      }));
    } catch (error: any) {
      logger.warn({ err: error }, 'Failed to get AI recommendations, using basic logic');
      return [];
    }
  }

  /**
   * Merge basic and AI recommendations
   */
  private mergeRecommendations(
    basic: RefillRecommendation[],
    ai: RefillRecommendation[]
  ): RefillRecommendation[] {
    const merged = [...basic];

    // Enhance basic recommendations with AI insights
    for (const aiRec of ai) {
      const existing = merged.find(r => r.ProductID === aiRec.ProductID);
      if (existing) {
        // Update with AI recommendation if different
        if (aiRec.RecommendedQuantity > 0) {
          existing.RecommendedQuantity = Math.max(
            existing.RecommendedQuantity,
            aiRec.RecommendedQuantity
          );
          existing.Reasoning = `${existing.Reasoning}. AI Insight: ${aiRec.Reasoning}`;
        }
      } else {
        // Add new AI recommendation
        merged.push(aiRec);
      }
    }

    return merged;
  }

  /**
   * Get AI insights about the refill plan (with truncation & fallback)
   */
  private async getAIInsights(
    standId: string,
    recommendations: RefillRecommendation[],
    totalCost: number,
    budget?: number
  ): Promise<string[]> {
    try {
      const criticalCount = recommendations.filter(r => r.Priority === 'Critical').length;
      const highCount = recommendations.filter(r => r.Priority === 'High').length;

      const prompt = `Refill AI for Stand ${standId}: ${recommendations.length} items, €${totalCost.toFixed(0)} total
Critical: ${criticalCount}, High: ${highCount}
${budget ? `Budget: €${budget}${totalCost > budget ? ` (OVER by €${(totalCost - budget).toFixed(0)})` : ''}` : ''}

Return 3 insights as JSON: ["insight 1", "insight 2", "insight 3"]`;

      const response = await generateAIResponse(prompt);
      const insights = JSON.parse(response);

      if (Array.isArray(insights)) {
        return insights.slice(0, 5);
      }

      // Fallback
      return this.generateFallbackInsights(criticalCount, highCount, totalCost, budget);
    } catch (error: any) {
      logger.warn({ err: error }, 'AI insights failed, using fallback');
      return this.generateFallbackInsights(criticalCount, highCount, totalCost, budget);
    }
  }

  /**
   * Generate fallback insights without AI
   */
  private generateFallbackInsights(
    criticalCount: number,
    highCount: number,
    totalCost: number,
    budget?: number
  ): string[] {
    const insights: string[] = [];

    if (criticalCount > 0) {
      insights.push(`${criticalCount} critical items need immediate attention`);
    }

    if (budget && totalCost > budget) {
      insights.push(`Cost exceeds budget - prioritize critical items first`);
    } else if (budget) {
      insights.push(`Refill plan fits within budget`);
    }

    if (highCount > 5) {
      insights.push('Consider bulk ordering to reduce costs');
    }

    insights.push('Review refill frequencies to optimize inventory levels');

    return insights.slice(0, 5);
  }

  /**
   * Optimize refill plan based on budget constraint
   */
  async optimizeForBudget(plan: RefillPlan, maxBudget: number): Promise<RefillPlan> {
    if (plan.totalCost <= maxBudget) return plan;

    logger.info({ currentCost: plan.totalCost, maxBudget }, 'Optimizing refill plan for budget');

    // Prioritize critical and high priority items
    const critical = plan.recommendations.filter(r => r.Priority === 'Critical');
    const high = plan.recommendations.filter(r => r.Priority === 'High');
    const medium = plan.recommendations.filter(r => r.Priority === 'Medium');
    const low = plan.recommendations.filter(r => r.Priority === 'Low');

    let optimized: RefillRecommendation[] = [];
    let runningCost = 0;

    // Add critical items first
    for (const item of critical) {
      if (runningCost + (item.EstimatedCost || 0) <= maxBudget) {
        optimized.push(item);
        runningCost += item.EstimatedCost || 0;
      }
    }

    // Add high priority items
    for (const item of high) {
      if (runningCost + (item.EstimatedCost || 0) <= maxBudget) {
        optimized.push(item);
        runningCost += item.EstimatedCost || 0;
      }
    }

    // Add medium priority items if budget allows
    for (const item of medium) {
      if (runningCost + (item.EstimatedCost || 0) <= maxBudget) {
        optimized.push(item);
        runningCost += item.EstimatedCost || 0;
      }
    }

    // Add low priority items if budget allows
    for (const item of low) {
      if (runningCost + (item.EstimatedCost || 0) <= maxBudget) {
        optimized.push(item);
        runningCost += item.EstimatedCost || 0;
      }
    }

    return {
      ...plan,
      recommendations: optimized,
      totalCost: runningCost,
      totalItems: optimized.reduce((sum, r) => sum + r.RecommendedQuantity, 0),
      aiInsights: [
        ...plan.aiInsights,
        `Budget-optimized: Reduced from €${plan.totalCost.toFixed(2)} to €${runningCost.toFixed(2)}`,
        `Prioritized ${critical.length} critical and ${high.length} high-priority items`
      ],
    };
  }
}

export const refillOptimizerAgent = new RefillOptimizerAgent();
