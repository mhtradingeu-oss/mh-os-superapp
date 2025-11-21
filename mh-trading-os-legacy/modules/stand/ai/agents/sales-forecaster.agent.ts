/**
 * Sales Forecaster Agent - متنبئ المبيعات
 * Forecasts future sales using AI and historical data
 */

import { createLogger } from '../../../../lib/logger';
import { generateAIResponse } from '../../../../lib/openai';

const logger = createLogger('SalesForecaster');

export interface SalesForecast {
  period: string;
  predictedRevenue: number;
  predictedUnits: number;
  confidence: 'High' | 'Medium' | 'Low';
  trend: 'Up' | 'Stable' | 'Down';
}

export interface ProductSalesForecast {
  ProductID: string;
  ProductName: string;
  forecast7Days: SalesForecast;
  forecast30Days: SalesForecast;
  forecast90Days: SalesForecast;
  seasonality?: string;
  growthRate?: number;
}

export interface StandSalesForecast {
  standId: string;
  generatedAt: string;
  overall: {
    forecast7Days: SalesForecast;
    forecast30Days: SalesForecast;
    forecast90Days: SalesForecast;
  };
  byProduct: ProductSalesForecast[];
  aiInsights: string[];
  recommendations: string[];
}

export class SalesForecasterAgent {
  /**
   * Generate comprehensive sales forecast
   */
  async generateForecast(
    standId: string,
    salesHistory: any[],
    inventory: any[],
    kpis?: any[]
  ): Promise<StandSalesForecast> {
    try {
      logger.info({ standId, salesCount: salesHistory.length }, 'Generating sales forecast');

      // Calculate historical metrics
      const historicalMetrics = this.calculateHistoricalMetrics(salesHistory);

      // Limit sales history to prevent token overflow (last 100 transactions)
      const limitedSalesHistory = salesHistory.slice(-100);
      
      // Generate product-level forecasts
      const productForecasts = await this.forecastByProduct(limitedSalesHistory, inventory);

      // Generate overall forecast
      const overallForecast = this.calculateOverallForecast(productForecasts);

      // Get AI insights (using LIMITED history)
      const aiInsights = await this.getAIForecastInsights(
        standId,
        limitedSalesHistory, // ✅ FIXED: Use limited history
        overallForecast,
        historicalMetrics
      );

      // Generate recommendations
      const recommendations = await this.generateRecommendations(
        standId,
        overallForecast,
        productForecasts,
        historicalMetrics
      );

      const forecast: StandSalesForecast = {
        standId,
        generatedAt: new Date().toISOString(),
        overall: overallForecast,
        byProduct: productForecasts.slice(0, 50), // Top 50 products
        aiInsights,
        recommendations,
      };

      logger.info({ standId, revenue30d: overallForecast.forecast30Days.predictedRevenue }, 'Sales forecast generated');
      return forecast;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to generate sales forecast');
      
      // Return fallback forecast instead of throwing
      return {
        standId,
        generatedAt: new Date().toISOString(),
        overall: {
          forecast7Days: { predictedRevenue: 0, predictedUnits: 0, confidence: 'Low', trend: 'Stable' },
          forecast30Days: { predictedRevenue: 0, predictedUnits: 0, confidence: 'Low', trend: 'Stable' },
          forecast90Days: { predictedRevenue: 0, predictedUnits: 0, confidence: 'Low', trend: 'Stable' },
        },
        byProduct: [],
        aiInsights: ['Unable to generate forecast - insufficient data'],
        recommendations: ['Review sales history and try again'],
      };
    }
  }

  /**
   * Calculate historical sales metrics
   */
  private calculateHistoricalMetrics(salesHistory: any[]): {
    avgDailyRevenue: number;
    avgDailyUnits: number;
    growthRate: number;
    volatility: number;
  } {
    if (salesHistory.length === 0) {
      return { avgDailyRevenue: 0, avgDailyUnits: 0, growthRate: 0, volatility: 0 };
    }

    const totalRevenue = salesHistory.reduce((sum, s) => sum + (s.Revenue || 0), 0);
    const totalUnits = salesHistory.reduce((sum, s) => sum + (s.Quantity || 0), 0);
    const daysOfHistory = 30; // Assume 30 days

    const avgDailyRevenue = totalRevenue / daysOfHistory;
    const avgDailyUnits = totalUnits / daysOfHistory;

    // Calculate growth rate (compare first half vs second half)
    const midPoint = Math.floor(salesHistory.length / 2);
    const firstHalfRevenue = salesHistory.slice(0, midPoint).reduce((sum, s) => sum + (s.Revenue || 0), 0);
    const secondHalfRevenue = salesHistory.slice(midPoint).reduce((sum, s) => sum + (s.Revenue || 0), 0);
    const growthRate = firstHalfRevenue > 0 
      ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 
      : 0;

    // Calculate volatility (standard deviation / mean)
    const revenues = salesHistory.map(s => s.Revenue || 0);
    const mean = revenues.reduce((sum, r) => sum + r, 0) / revenues.length;
    const variance = revenues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / revenues.length;
    const stdDev = Math.sqrt(variance);
    const volatility = mean > 0 ? (stdDev / mean) * 100 : 0;

    return {
      avgDailyRevenue,
      avgDailyUnits,
      growthRate,
      volatility,
    };
  }

  /**
   * Forecast sales by product
   */
  private async forecastByProduct(
    salesHistory: any[],
    inventory: any[]
  ): Promise<ProductSalesForecast[]> {
    const forecasts: ProductSalesForecast[] = [];

    // Group sales by product
    const productSales = new Map<string, any[]>();
    for (const sale of salesHistory) {
      const productId = sale.ProductID;
      if (!productSales.has(productId)) {
        productSales.set(productId, []);
      }
      productSales.get(productId)!.push(sale);
    }

    // Generate forecast for each product
    for (const [productId, sales] of productSales) {
      const product = inventory.find(i => i.ProductID === productId);
      const productName = product?.ProductName || productId;

      const totalRevenue = sales.reduce((sum, s) => sum + (s.Revenue || 0), 0);
      const totalUnits = sales.reduce((sum, s) => sum + (s.Quantity || 0), 0);
      const avgDailyRevenue = totalRevenue / 30;
      const avgDailyUnits = totalUnits / 30;

      // Determine trend
      const midPoint = Math.floor(sales.length / 2);
      const recentRevenue = sales.slice(midPoint).reduce((sum, s) => sum + (s.Revenue || 0), 0);
      const olderRevenue = sales.slice(0, midPoint).reduce((sum, s) => sum + (s.Revenue || 0), 0);
      
      let trend: 'Up' | 'Stable' | 'Down' = 'Stable';
      let growthRate = 0;
      if (olderRevenue > 0) {
        growthRate = ((recentRevenue - olderRevenue) / olderRevenue) * 100;
        if (growthRate > 10) trend = 'Up';
        else if (growthRate < -10) trend = 'Down';
      }

      // Determine confidence
      let confidence: 'High' | 'Medium' | 'Low' = 'Medium';
      if (sales.length >= 20) confidence = 'High';
      else if (sales.length < 5) confidence = 'Low';

      // Apply trend multiplier
      let trendMultiplier = 1.0;
      if (trend === 'Up') trendMultiplier = 1.2;
      else if (trend === 'Down') trendMultiplier = 0.8;

      forecasts.push({
        ProductID: productId,
        ProductName: productName,
        forecast7Days: {
          period: '7 days',
          predictedRevenue: Math.round(avgDailyRevenue * 7 * trendMultiplier),
          predictedUnits: Math.round(avgDailyUnits * 7 * trendMultiplier),
          confidence,
          trend,
        },
        forecast30Days: {
          period: '30 days',
          predictedRevenue: Math.round(avgDailyRevenue * 30 * trendMultiplier),
          predictedUnits: Math.round(avgDailyUnits * 30 * trendMultiplier),
          confidence,
          trend,
        },
        forecast90Days: {
          period: '90 days',
          predictedRevenue: Math.round(avgDailyRevenue * 90 * trendMultiplier),
          predictedUnits: Math.round(avgDailyUnits * 90 * trendMultiplier),
          confidence,
          trend,
        },
        growthRate,
      });
    }

    // Sort by 30-day revenue (highest first)
    forecasts.sort((a, b) => b.forecast30Days.predictedRevenue - a.forecast30Days.predictedRevenue);

    return forecasts;
  }

  /**
   * Calculate overall forecast from product forecasts
   */
  private calculateOverallForecast(productForecasts: ProductSalesForecast[]): {
    forecast7Days: SalesForecast;
    forecast30Days: SalesForecast;
    forecast90Days: SalesForecast;
  } {
    const revenue7d = productForecasts.reduce((sum, pf) => sum + pf.forecast7Days.predictedRevenue, 0);
    const revenue30d = productForecasts.reduce((sum, pf) => sum + pf.forecast30Days.predictedRevenue, 0);
    const revenue90d = productForecasts.reduce((sum, pf) => sum + pf.forecast90Days.predictedRevenue, 0);

    const units7d = productForecasts.reduce((sum, pf) => sum + pf.forecast7Days.predictedUnits, 0);
    const units30d = productForecasts.reduce((sum, pf) => sum + pf.forecast30Days.predictedUnits, 0);
    const units90d = productForecasts.reduce((sum, pf) => sum + pf.forecast90Days.predictedUnits, 0);

    // Determine overall trend
    const upTrends = productForecasts.filter(pf => pf.forecast30Days.trend === 'Up').length;
    const downTrends = productForecasts.filter(pf => pf.forecast30Days.trend === 'Down').length;
    let overallTrend: 'Up' | 'Stable' | 'Down' = 'Stable';
    if (upTrends > downTrends && upTrends > productForecasts.length * 0.4) overallTrend = 'Up';
    else if (downTrends > upTrends && downTrends > productForecasts.length * 0.4) overallTrend = 'Down';

    // Determine confidence
    const highConfidence = productForecasts.filter(pf => pf.forecast30Days.confidence === 'High').length;
    let confidence: 'High' | 'Medium' | 'Low' = 'Medium';
    if (highConfidence > productForecasts.length * 0.6) confidence = 'High';
    else if (highConfidence < productForecasts.length * 0.3) confidence = 'Low';

    return {
      forecast7Days: {
        period: '7 days',
        predictedRevenue: Math.round(revenue7d),
        predictedUnits: Math.round(units7d),
        confidence,
        trend: overallTrend,
      },
      forecast30Days: {
        period: '30 days',
        predictedRevenue: Math.round(revenue30d),
        predictedUnits: Math.round(units30d),
        confidence,
        trend: overallTrend,
      },
      forecast90Days: {
        period: '90 days',
        predictedRevenue: Math.round(revenue90d),
        predictedUnits: Math.round(units90d),
        confidence,
        trend: overallTrend,
      },
    };
  }

  /**
   * Get AI forecast insights (with fallback)
   */
  private async getAIForecastInsights(
    standId: string,
    salesHistory: any[],
    forecast: any,
    metrics: any
  ): Promise<string[]> {
    try {
      const prompt = `Sales AI for Stand ${standId}: ${salesHistory.length} transactions
Metrics: Avg €${metrics.avgDailyRevenue.toFixed(0)}/day, Growth ${metrics.growthRate.toFixed(0)}%
30d Forecast: €${forecast.forecast30Days.predictedRevenue}, Trend: ${forecast.forecast30Days.trend}

Provide 3 insights as JSON array: ["insight 1", "insight 2", "insight 3"]`;

      const response = await generateAIResponse(prompt);
      const insights = JSON.parse(response);

      if (Array.isArray(insights)) {
        return insights.slice(0, 5);
      }

      // Fallback
      return this.generateFallbackInsights(metrics, forecast);
    } catch (error: any) {
      logger.warn({ err: error }, 'AI insights failed, using fallback');
      return this.generateFallbackInsights(metrics, forecast);
    }
  }

  /**
   * Generate fallback insights without AI
   */
  private generateFallbackInsights(metrics: any, forecast: any): string[] {
    const insights: string[] = [];
    
    if (metrics.growthRate > 10) {
      insights.push('Strong revenue growth momentum - capitalize on this trend');
    } else if (metrics.growthRate < -10) {
      insights.push('Revenue declining - review pricing and marketing strategies');
    } else {
      insights.push('Stable revenue - focus on optimization opportunities');
    }

    if (forecast.forecast30Days.trend === 'Up') {
      insights.push('Positive sales trend predicted - ensure adequate inventory');
    } else if (forecast.forecast30Days.trend === 'Down') {
      insights.push('Declining trend predicted - implement demand stimulation tactics');
    }

    insights.push('Monitor sales patterns and adjust inventory accordingly');

    return insights.slice(0, 5);
  }

  /**
   * Generate actionable recommendations
   */
  private async generateRecommendations(
    standId: string,
    forecast: any,
    productForecasts: ProductSalesForecast[],
    metrics: any
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Revenue growth recommendations
    if (forecast.forecast30Days.trend === 'Up') {
      recommendations.push('Capitalize on growth momentum: Increase inventory for top performers');
    } else if (forecast.forecast30Days.trend === 'Down') {
      recommendations.push('Address declining sales: Review pricing and marketing strategies');
    }

    // Product mix recommendations
    const topPerformers = productForecasts.slice(0, 5);
    if (topPerformers.length > 0) {
      recommendations.push(`Focus on top ${topPerformers.length} products generating ${
        (topPerformers.reduce((sum, pf) => sum + pf.forecast30Days.predictedRevenue, 0) / 
         forecast.forecast30Days.predictedRevenue * 100).toFixed(0)
      }% of revenue`);
    }

    // Volatility recommendations
    if (metrics.volatility > 50) {
      recommendations.push('High sales volatility detected: Implement demand smoothing strategies');
    }

    // Confidence recommendations
    if (forecast.forecast30Days.confidence === 'Low') {
      recommendations.push('Improve forecast accuracy: Collect more granular sales data');
    }

    return recommendations.slice(0, 5);
  }
}

export const salesForecasterAgent = new SalesForecasterAgent();
