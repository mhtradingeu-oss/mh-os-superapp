import { affiliateRepository } from "./affiliate-repository";
import type { 
  AffiliateProfile as CanonicalProfile,
  AffiliateClick as CanonicalClick,
  AffiliateConversion as CanonicalConversion
} from "@shared/schema";

export interface AffiliateAnalytics {
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  totalCommission: number;
  conversionRate: number;
  averageOrderValue: number;
  earningsPerClick: number;
  topPerformer?: {
    affiliateID: string;
    name: string;
    revenue: number;
  };
  clicksByDay: Array<{ date: string; clicks: number; conversions: number }>;
  clicksByCountry: Array<{ country: string; clicks: number }>;
  clicksByDevice: Array<{ device: string; clicks: number; percentage: number }>;
  trafficSources: Array<{ source: string; clicks: number; percentage: number }>;
  affiliatesByTier: {
    Gold: number;
    Partner: number;
    Standard: number;
    Basic: number;
    Inactive: number;
  };
}

export interface AffiliatePerformanceMetrics {
  affiliateID: string;
  name: string;
  clicks: number;
  conversions: number;
  revenue: number;
  commission: number;
  conversionRate: number;
  epc: number;
  tier: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
}

class AffiliateAnalyticsService {
  async getOverallAnalytics(dateRange?: { start: string; end: string }): Promise<AffiliateAnalytics> {
    const [profiles, clicks, conversions] = await Promise.all([
      affiliateRepository.getAllProfiles(),
      affiliateRepository.getAllClicks(dateRange),
      affiliateRepository.getAllConversions(dateRange),
    ]);

    const totalClicks = clicks.length;
    const totalConversions = conversions.length;
    const totalRevenue = conversions.reduce((sum, c) => sum + (c.Revenue || 0), 0);
    const totalCommission = conversions.reduce((sum, c) => sum + (c.Commission || 0), 0);
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const averageOrderValue = totalConversions > 0 ? totalRevenue / totalConversions : 0;
    const earningsPerClick = totalClicks > 0 ? totalCommission / totalClicks : 0;

    const topPerformer = profiles.length > 0
      ? profiles.reduce((best, curr) => 
          (curr.TotalRevenue || 0) > (best.TotalRevenue || 0) ? curr : best
        )
      : null;

    const clicksByDay = this.groupClicksByDay(clicks);
    const conversionsMap = this.groupConversionsByDay(conversions);
    
    const clicksByDayWithConversions = clicksByDay.map(day => ({
      date: day.date,
      clicks: day.clicks,
      conversions: conversionsMap.get(day.date) || 0,
    }));

    const clicksByCountry = this.groupClicksByCountry(clicks);
    const clicksByDevice = this.groupClicksByDevice(clicks);
    const trafficSources = this.groupClicksBySource(clicks);

    const affiliatesByTier = {
      Gold: profiles.filter(p => p.Tier === 'Gold').length,
      Partner: profiles.filter(p => p.Tier === 'Partner').length,
      Standard: profiles.filter(p => p.Tier === 'Standard').length,
      Basic: profiles.filter(p => p.Tier === 'Basic').length,
      Inactive: profiles.filter(p => p.Tier === 'Inactive').length,
    };

    return {
      totalClicks,
      totalConversions,
      totalRevenue,
      totalCommission,
      conversionRate,
      averageOrderValue,
      earningsPerClick,
      topPerformer: topPerformer ? {
        affiliateID: topPerformer.AffiliateID,
        name: topPerformer.Name,
        revenue: topPerformer.TotalRevenue,
      } : undefined,
      clicksByDay: clicksByDayWithConversions,
      clicksByCountry,
      clicksByDevice,
      trafficSources,
      affiliatesByTier,
    };
  }

  async getAffiliatePerformance(): Promise<AffiliatePerformanceMetrics[]> {
    const profiles = await affiliateRepository.getAllProfiles();

    return profiles.map(profile => ({
      affiliateID: profile.AffiliateID,
      name: profile.Name,
      clicks: profile.TotalClicks || 0,
      conversions: profile.TotalConversions || 0,
      revenue: profile.TotalRevenue || 0,
      commission: profile.TotalCommission || 0,
      conversionRate: profile.ConversionRate || 0,
      epc: profile.EarningsPerClick || 0,
      tier: profile.Tier,
      score: profile.Score || 0,
      trend: 'stable',
    })).sort((a, b) => b.score - a.score);
  }

  async getAffiliateDetailedAnalytics(affiliateID: string): Promise<{
    profile: AffiliateProfile | null;
    recentClicks: AffiliateClick[];
    recentConversions: AffiliateConversion[];
    clicksByDay: Array<{ date: string; clicks: number }>;
    conversionsByDay: Array<{ date: string; conversions: number }>;
  }> {
    const [profile, clicks, conversions] = await Promise.all([
      affiliateRepository.getProfileById(affiliateID),
      affiliateRepository.getClicksByAffiliate(affiliateID),
      affiliateRepository.getConversionsByAffiliate(affiliateID),
    ]);

    const recentClicks = clicks.slice(-50);
    const recentConversions = conversions.slice(-50);

    const clicksByDay = this.groupClicksByDay(recentClicks);
    const conversionsByDay = recentConversions.reduce((acc, conv) => {
      const date = (conv.Timestamp || new Date().toISOString()).split('T')[0];
      const existing = acc.find(d => d.date === date);
      if (existing) {
        existing.conversions++;
      } else {
        acc.push({ date, conversions: 1 });
      }
      return acc;
    }, [] as Array<{ date: string; conversions: number }>);

    return {
      profile,
      recentClicks,
      recentConversions,
      clicksByDay,
      conversionsByDay,
    };
  }

  private groupClicksByDay(clicks: AffiliateClick[]): Array<{ date: string; clicks: number }> {
    const grouped = new Map<string, number>();
    clicks.forEach(click => {
      const date = (click.Timestamp || new Date().toISOString()).split('T')[0];
      grouped.set(date, (grouped.get(date) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([date, clicks]) => ({ date, clicks }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private groupConversionsByDay(conversions: AffiliateConversion[]): Map<string, number> {
    const grouped = new Map<string, number>();
    conversions.forEach(conv => {
      const date = (conv.Timestamp || new Date().toISOString()).split('T')[0];
      grouped.set(date, (grouped.get(date) || 0) + 1);
    });
    return grouped;
  }

  private groupClicksByCountry(clicks: AffiliateClick[]): Array<{ country: string; clicks: number }> {
    const grouped = new Map<string, number>();
    clicks.forEach(click => {
      const country = click.Country || 'Unknown';
      grouped.set(country, (grouped.get(country) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([country, clicks]) => ({ country, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);
  }

  private groupClicksByDevice(clicks: AffiliateClick[]): Array<{ device: string; clicks: number; percentage: number }> {
    const total = clicks.length;
    const grouped = new Map<string, number>();
    clicks.forEach(click => {
      const device = click.Device || 'Unknown';
      grouped.set(device, (grouped.get(device) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([device, clicks]) => ({ 
        device, 
        clicks, 
        percentage: total > 0 ? (clicks / total) * 100 : 0 
      }))
      .sort((a, b) => b.clicks - a.clicks);
  }

  private groupClicksBySource(clicks: AffiliateClick[]): Array<{ source: string; clicks: number; percentage: number }> {
    const total = clicks.length;
    const grouped = new Map<string, number>();
    clicks.forEach(click => {
      const source = click.ReferralSource || 'Direct';
      grouped.set(source, (grouped.get(source) || 0) + 1);
    });

    return Array.from(grouped.entries())
      .map(([source, clicks]) => ({ 
        source, 
        clicks, 
        percentage: total > 0 ? (clicks / total) * 100 : 0 
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);
  }

  async calculateScoreAndTier(affiliateID: string): Promise<{ score: number; tier: 'Gold' | 'Partner' | 'Standard' | 'Basic' | 'Inactive' }> {
    const profile = await affiliateRepository.getProfileById(affiliateID);

    if (!profile) {
      return { score: 0, tier: 'Inactive' };
    }

    const conversionRate = profile.ConversionRate || 0;
    const revenue = profile.TotalRevenue || 0;
    const clicks = profile.TotalClicks || 0;
    const epc = profile.EarningsPerClick || 0;
    
    const trafficQuality = Math.min((clicks / 1000) * 100, 100);
    const engagement = Math.min((conversionRate / 5) * 100, 100);

    const score = Math.round(
      (conversionRate * 0.30) +
      ((revenue / 1000) * 0.25) +
      (trafficQuality * 0.15) +
      ((epc * 10) * 0.15) +
      (engagement * 0.10) +
      (50 * 0.05)
    );

    let tier: 'Gold' | 'Partner' | 'Standard' | 'Basic' | 'Inactive' = 'Inactive';
    if (score >= 75) tier = 'Gold';
    else if (score >= 50) tier = 'Partner';
    else if (score >= 25) tier = 'Standard';
    else if (score > 0) tier = 'Basic';

    return { score, tier };
  }

  async detectFraud(affiliateID: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    riskLevel: 'Low' | 'Medium' | 'High';
  }> {
    const profile = await affiliateRepository.getProfileById(affiliateID);

    if (!profile) {
      return { isSuspicious: false, reasons: [], riskLevel: 'Low' };
    }

    const reasons: string[] = [];
    let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';

    if (profile.ConversionRate > 10) {
      reasons.push(`Unusually high conversion rate: ${profile.ConversionRate}%`);
      riskLevel = 'High';
    }

    const avgOrderValue = profile.TotalConversions > 0 
      ? profile.TotalRevenue / profile.TotalConversions 
      : 0;
    
    if (avgOrderValue > 1000) {
      reasons.push(`Very high average order value: €${avgOrderValue.toFixed(2)}`);
      riskLevel = riskLevel === 'High' ? 'High' : 'Medium';
    }

    if (profile.TotalClicks > 10000 && profile.TotalConversions === 0) {
      reasons.push('High traffic with zero conversions');
      riskLevel = 'Medium';
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
      riskLevel,
    };
  }

  async getDashboardSummary(dateRange?: { start: string; end: string }): Promise<{
    totalAffiliates: number;
    activeAffiliates: number;
    totalClicks: number;
    totalConversions: number;
    conversionRate: number;
    totalRevenue: number;
    totalCommissions: number;
    pendingCommissions: number;
    changeVsPrevious: {
      clicks: number;
      conversions: number;
      revenue: number;
    };
  }> {
    const [profiles, clicks, conversions] = await Promise.all([
      affiliateRepository.getAllProfiles(),
      affiliateRepository.getAllClicks(),
      affiliateRepository.getAllConversions(),
    ]);

    let currentClicks = clicks;
    let currentConversions = conversions;
    let previousClicks: AffiliateClick[] = [];
    let previousConversions: AffiliateConversion[] = [];

    if (dateRange) {
      currentClicks = clicks.filter(c => 
        c.Timestamp >= dateRange.start && c.Timestamp <= dateRange.end
      );
      currentConversions = conversions.filter(c => 
        c.Timestamp >= dateRange.start && c.Timestamp <= dateRange.end
      );

      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      const diff = end.getTime() - start.getTime();
      const prevStart = new Date(start.getTime() - diff);
      const prevEnd = start;

      previousClicks = clicks.filter(c => 
        c.Timestamp >= prevStart.toISOString() && c.Timestamp < prevEnd.toISOString()
      );
      previousConversions = conversions.filter(c => 
        c.Timestamp >= prevStart.toISOString() && c.Timestamp < prevEnd.toISOString()
      );
    }

    const totalAffiliates = profiles.length;
    const activeAffiliates = profiles.filter(p => p.Status === 'Active').length;
    const totalClicks = currentClicks.length;
    const totalConversions = currentConversions.length;
    const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const totalRevenue = currentConversions.reduce((sum, c) => sum + (c.Revenue || 0), 0);
    const totalCommissions = currentConversions.reduce((sum, c) => sum + (c.Commission || 0), 0);
    const pendingCommissions = profiles.reduce((sum, p) => sum + (p.TotalCommission || 0), 0) - totalCommissions;

    const prevClicks = previousClicks.length;
    const prevConversions = previousConversions.length;
    const prevRevenue = previousConversions.reduce((sum, c) => sum + (c.Revenue || 0), 0);

    const clicksChange = prevClicks > 0 ? ((totalClicks - prevClicks) / prevClicks) * 100 : 0;
    const conversionsChange = prevConversions > 0 ? ((totalConversions - prevConversions) / prevConversions) * 100 : 0;
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    return {
      totalAffiliates,
      activeAffiliates,
      totalClicks,
      totalConversions,
      conversionRate,
      totalRevenue,
      totalCommissions,
      pendingCommissions,
      changeVsPrevious: {
        clicks: Math.round(clicksChange * 10) / 10,
        conversions: Math.round(conversionsChange * 10) / 10,
        revenue: Math.round(revenueChange * 10) / 10,
      },
    };
  }

  async getTimeseriesStats(dateRange?: { start: string; end: string }): Promise<Array<{
    date: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }>> {
    const [clicks, conversions] = await Promise.all([
      affiliateRepository.getAllClicks(dateRange),
      affiliateRepository.getAllConversions(dateRange),
    ]);

    const clicksByDay = this.groupClicksByDay(clicks);
    const conversionsMap = new Map<string, { count: number; revenue: number }>();
    
    conversions.forEach(conv => {
      const date = (conv.Timestamp || new Date().toISOString()).split('T')[0];
      const existing = conversionsMap.get(date) || { count: 0, revenue: 0 };
      existing.count++;
      existing.revenue += conv.Revenue || 0;
      conversionsMap.set(date, existing);
    });

    return clicksByDay.map(day => ({
      date: day.date,
      clicks: day.clicks,
      conversions: conversionsMap.get(day.date)?.count || 0,
      revenue: conversionsMap.get(day.date)?.revenue || 0,
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getTrafficSourceStats(dateRange?: { start: string; end: string }): Promise<Array<{
    source: string;
    clicks: number;
    conversions: number;
    revenue: number;
    percentage: number;
  }>> {
    const [clicks, conversions] = await Promise.all([
      affiliateRepository.getAllClicks(dateRange),
      affiliateRepository.getAllConversions(dateRange),
    ]);

    if (dateRange) {
      clicks = clicks.filter(c => 
        c.Timestamp >= dateRange.start && c.Timestamp <= dateRange.end
      );
      conversions = conversions.filter(c => 
        c.Timestamp >= dateRange.start && c.Timestamp <= dateRange.end
      );
    }

    const total = clicks.length;
    const sourceStats = new Map<string, { clicks: number; conversions: number; revenue: number }>();

    clicks.forEach(click => {
      const source = click.ReferralSource || 'Direct';
      const stats = sourceStats.get(source) || { clicks: 0, conversions: 0, revenue: 0 };
      stats.clicks++;
      sourceStats.set(source, stats);
    });

    conversions.forEach(conv => {
      const clickID = conv.ClickID;
      const click = clicks.find(c => c.ClickID === clickID);
      if (click) {
        const source = click.ReferralSource || 'Direct';
        const stats = sourceStats.get(source);
        if (stats) {
          stats.conversions++;
          stats.revenue += conv.Revenue || 0;
        }
      }
    });

    return Array.from(sourceStats.entries())
      .map(([source, stats]) => ({
        source,
        clicks: stats.clicks,
        conversions: stats.conversions,
        revenue: stats.revenue,
        percentage: total > 0 ? (stats.clicks / total) * 100 : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10);
  }

  async getAffiliateAIInsights(affiliateID: string): Promise<{
    fitScore: number;
    recommendations: string[];
    bestPerformingCountries: string[];
    suggestedCommission: number;
    topProductCategories: string[];
    trend: 'improving' | 'stable' | 'declining';
  }> {
    const [profile, affiliateClicks, affiliateConversions] = await Promise.all([
      affiliateRepository.getProfileById(affiliateID),
      affiliateRepository.getClicksByAffiliate(affiliateID),
      affiliateRepository.getConversionsByAffiliate(affiliateID),
    ]);
    
    if (!profile) {
      return {
        fitScore: 0,
        recommendations: ['Affiliate not found'],
        bestPerformingCountries: [],
        suggestedCommission: 10,
        topProductCategories: [],
        trend: 'stable',
      };
    }

    const { score: fitScore } = await this.calculateScoreAndTier(affiliateID);
    const recommendations: string[] = [];
    
    const countryStats = new Map<string, number>();
    affiliateClicks.forEach(click => {
      const country = click.Country || 'Unknown';
      countryStats.set(country, (countryStats.get(country) || 0) + 1);
    });
    
    const bestPerformingCountries = Array.from(countryStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([country]) => country);

    const conversionRate = profile.ConversionRate || 0;
    const currentCommission = profile.CommissionPct || 10;
    
    if (conversionRate > 3) {
      recommendations.push('High conversion rate! Consider featuring this affiliate prominently');
    } else if (conversionRate < 1 && affiliateClicks.length > 100) {
      recommendations.push('Low conversion rate despite high traffic. Review landing page alignment');
    }

    if (bestPerformingCountries.length > 0) {
      recommendations.push(`Best performing in: ${bestPerformingCountries.join(', ')}`);
    }

    if (profile.TotalRevenue > 5000 && currentCommission < 15) {
      recommendations.push(`High performer! Consider increasing commission from ${currentCommission}% to ${currentCommission + 2}% for retention`);
    }

    const suggestedCommission = profile.TotalRevenue > 5000 
      ? Math.min(currentCommission + 2, 20)
      : profile.TotalRevenue > 2000
      ? Math.min(currentCommission + 1, 15)
      : currentCommission;

    const productCategories = new Map<string, number>();
    affiliateConversions.forEach(conv => {
      const products = (conv.ProductsSold || '').split(',');
      products.forEach(product => {
        const category = product.split('-')[0] || 'Other';
        productCategories.set(category, (productCategories.get(category) || 0) + 1);
      });
    });

    const topProductCategories = Array.from(productCategories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([category]) => category);

    if (topProductCategories.length > 0) {
      recommendations.push(`Top categories: ${topProductCategories.join(', ')}`);
    }

    const recentClicks = affiliateClicks.slice(-30);
    const olderClicks = affiliateClicks.slice(-60, -30);
    const trend: 'improving' | 'stable' | 'declining' = 
      recentClicks.length > olderClicks.length * 1.1 ? 'improving' :
      recentClicks.length < olderClicks.length * 0.9 ? 'declining' :
      'stable';

    return {
      fitScore,
      recommendations,
      bestPerformingCountries,
      suggestedCommission,
      topProductCategories,
      trend,
    };
  }
}

export const affiliateAnalyticsService = new AffiliateAnalyticsService();
