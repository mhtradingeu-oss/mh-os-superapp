/**
 * Inventory Predictor Agent - متنبئ المخزون
 * Predicts future inventory needs using AI and historical data
 */

import { createLogger } from '../../../../lib/logger';
import { generateAIResponse } from '../../../../lib/openai';

const logger = createLogger('InventoryPredictor');

export interface InventoryPrediction {
  ProductID: string;
  ProductName: string;
  CurrentStock: number;
  PredictedDemand7Days: number;
  PredictedDemand30Days: number;
  PredictedDemand90Days: number;
  RecommendedReorderPoint: number;
  RecommendedReorderQuantity: number;
  Confidence: 'High' | 'Medium' | 'Low';
  Trend: 'Increasing' | 'Stable' | 'Decreasing';
  Seasonality?: string;
  Risks: string[];
}

export interface InventoryForecast {
  standId: string;
  generatedAt: string;
  predictions: InventoryPrediction[];
  overallTrend: 'Growing' | 'Stable' | 'Declining';
  aiInsights: string[];
  warnings: string[];
}

export class InventoryPredictorAgent {
  /**
   * Generate inventory forecast for a stand
   */
  async generateForecast(
    standId: string,
    inventory: any[],
    salesHistory: any[],
    kpis?: any[]
  ): Promise<InventoryForecast> {
    try {
      logger.info({ standId, inventoryCount: inventory.length }, 'Generating inventory forecast');

      // Limit data to prevent token overflow
      const limitedInventory = inventory.slice(0, 50); // Max 50 products
      const limitedSalesHistory = salesHistory.slice(-100); // Last 100 transactions
      
      // Calculate predictions for each product
      const predictions = await this.predictInventoryNeeds(
        limitedInventory,
        limitedSalesHistory,
        kpis
      );

      // Determine overall trend
      const overallTrend = this.determineOverallTrend(predictions);

      // Get AI insights
      const aiInsights = await this.getAIForecastInsights(
        standId,
        predictions,
        salesHistory,
        overallTrend
      );

      // Identify warnings
      const warnings = this.identifyWarnings(predictions);

      const forecast: InventoryForecast = {
        standId,
        generatedAt: new Date().toISOString(),
        predictions,
        overallTrend,
        aiInsights,
        warnings,
      };

      logger.info({ standId, predictionsCount: predictions.length }, 'Inventory forecast generated');
      return forecast;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to generate inventory forecast');
      
      // Return fallback forecast matching InventoryForecast interface
      return {
        standId,
        generatedAt: new Date().toISOString(),
        predictions: [],
        overallTrend: 'Stable',
        aiInsights: ['Unable to generate forecast - insufficient data'],
        warnings: ['Review inventory and sales data'],
      };
    }
  }

  /**
   * Predict inventory needs for each product
   */
  private async predictInventoryNeeds(
    inventory: any[],
    salesHistory: any[],
    kpis?: any[]
  ): Promise<InventoryPrediction[]> {
    const predictions: InventoryPrediction[] = [];

    for (const item of inventory) {
      // Calculate historical sales velocity
      const itemSales = salesHistory.filter(s => s.ProductID === item.ProductID);
      
      let avgDailySales = 0;
      let trend: 'Increasing' | 'Stable' | 'Decreasing' = 'Stable';
      let confidence: 'High' | 'Medium' | 'Low' = 'Medium';

      if (itemSales.length > 0) {
        // Calculate average daily sales
        const totalSales = itemSales.reduce((sum, s) => sum + (s.Quantity || 0), 0);
        const daysOfHistory = 30; // Assume 30 days of history
        avgDailySales = totalSales / daysOfHistory;

        // Determine trend
        if (itemSales.length >= 10) {
          const recentSales = itemSales.slice(-5).reduce((sum, s) => sum + (s.Quantity || 0), 0);
          const olderSales = itemSales.slice(0, 5).reduce((sum, s) => sum + (s.Quantity || 0), 0);
          
          if (recentSales > olderSales * 1.2) trend = 'Increasing';
          else if (recentSales < olderSales * 0.8) trend = 'Decreasing';
          else trend = 'Stable';
          
          confidence = 'High';
        } else if (itemSales.length >= 5) {
          confidence = 'Medium';
        } else {
          confidence = 'Low';
        }
      } else {
        confidence = 'Low';
        avgDailySales = item.AvgDailySales || 1;
      }

      // Apply trend multiplier
      let trendMultiplier = 1.0;
      if (trend === 'Increasing') trendMultiplier = 1.3;
      else if (trend === 'Decreasing') trendMultiplier = 0.7;

      // Calculate predictions
      const predicted7Days = Math.ceil(avgDailySales * 7 * trendMultiplier);
      const predicted30Days = Math.ceil(avgDailySales * 30 * trendMultiplier);
      const predicted90Days = Math.ceil(avgDailySales * 90 * trendMultiplier);

      // Calculate reorder point and quantity
      const leadTimeDays = 7; // Assume 7 days lead time
      const safetyStock = Math.ceil(avgDailySales * 3); // 3 days safety stock
      const reorderPoint = Math.ceil((avgDailySales * leadTimeDays) + safetyStock);
      const reorderQuantity = Math.ceil(avgDailySales * 30); // 30 days worth

      // Identify risks
      const risks: string[] = [];
      if (confidence === 'Low') {
        risks.push('Limited historical data - predictions may be inaccurate');
      }
      if (trend === 'Increasing' && item.OnHand < predicted30Days) {
        risks.push('Growing demand may cause stockouts');
      }
      if (trend === 'Decreasing') {
        risks.push('Declining demand - risk of overstocking');
      }
      if (item.OnHand < reorderPoint) {
        risks.push('Current stock below reorder point');
      }

      predictions.push({
        ProductID: item.ProductID,
        ProductName: item.ProductName || item.ProductID,
        CurrentStock: item.OnHand || 0,
        PredictedDemand7Days: predicted7Days,
        PredictedDemand30Days: predicted30Days,
        PredictedDemand90Days: predicted90Days,
        RecommendedReorderPoint: reorderPoint,
        RecommendedReorderQuantity: reorderQuantity,
        Confidence: confidence,
        Trend: trend,
        Risks: risks,
      });
    }

    return predictions;
  }

  /**
   * Determine overall inventory trend
   */
  private determineOverallTrend(predictions: InventoryPrediction[]): 'Growing' | 'Stable' | 'Declining' {
    const increasing = predictions.filter(p => p.Trend === 'Increasing').length;
    const decreasing = predictions.filter(p => p.Trend === 'Decreasing').length;
    const stable = predictions.filter(p => p.Trend === 'Stable').length;

    if (increasing > decreasing && increasing > stable) return 'Growing';
    if (decreasing > increasing && decreasing > stable) return 'Declining';
    return 'Stable';
  }

  /**
   * Get AI-powered forecast insights
   */
  private async getAIForecastInsights(
    standId: string,
    predictions: InventoryPrediction[],
    salesHistory: any[],
    overallTrend: string
  ): Promise<string[]> {
    try {
      const highConfidence = predictions.filter(p => p.Confidence === 'High').length;
      const lowConfidence = predictions.filter(p => p.Confidence === 'Low').length;
      const increasing = predictions.filter(p => p.Trend === 'Increasing').length;
      const decreasing = predictions.filter(p => p.Trend === 'Decreasing').length;

      const prompt = `Inventory Forecast AI for Stand ${standId}: ${predictions.length} products, Trend: ${overallTrend}
Confidence: ${highConfidence} high, ${lowConfidence} low
Growing: ${increasing}, Declining: ${decreasing}

Return 3 insights as JSON: ["insight 1", "insight 2", "insight 3"]`;

      const response = await generateAIResponse(prompt);
      const insights = JSON.parse(response);

      if (Array.isArray(insights)) {
        return insights.slice(0, 5);
      }

      return ['Monitor demand trends closely', 'Adjust reorder points based on seasonality'];
    } catch (error: any) {
      logger.warn({ err: error }, 'Failed to get AI forecast insights');
      return ['Monitor demand trends closely', 'Adjust reorder points based on seasonality'];
    }
  }

  /**
   * Identify forecast warnings
   */
  private identifyWarnings(predictions: InventoryPrediction[]): string[] {
    const warnings: string[] = [];

    // Low confidence warnings
    const lowConfidence = predictions.filter(p => p.Confidence === 'Low');
    if (lowConfidence.length > predictions.length * 0.3) {
      warnings.push(`${lowConfidence.length} products have low prediction confidence due to limited data`);
    }

    // Stockout risk warnings
    const stockoutRisk = predictions.filter(p => 
      p.CurrentStock < p.PredictedDemand7Days
    );
    if (stockoutRisk.length > 0) {
      warnings.push(`${stockoutRisk.length} products at risk of stockout within 7 days`);
    }

    // Overstock warnings
    const overstockRisk = predictions.filter(p => 
      p.CurrentStock > p.PredictedDemand90Days && p.Trend === 'Decreasing'
    );
    if (overstockRisk.length > 0) {
      warnings.push(`${overstockRisk.length} products at risk of overstocking (declining demand)`);
    }

    // Growth opportunity warnings
    const growthOpportunity = predictions.filter(p => 
      p.Trend === 'Increasing' && p.CurrentStock < p.PredictedDemand30Days
    );
    if (growthOpportunity.length > 0) {
      warnings.push(`${growthOpportunity.length} growing products need higher stock levels`);
    }

    return warnings;
  }

  /**
   * Get prediction for specific product
   */
  async predictProduct(
    productId: string,
    salesHistory: any[],
    days: number = 30
  ): Promise<number> {
    const productSales = salesHistory.filter(s => s.ProductID === productId);
    
    if (productSales.length === 0) return 0;

    const totalQty = productSales.reduce((sum, s) => sum + (s.Quantity || 0), 0);
    const avgDaily = totalQty / 30; // Assume 30 days of history

    return Math.ceil(avgDaily * days);
  }
}

export const inventoryPredictorAgent = new InventoryPredictorAgent();
