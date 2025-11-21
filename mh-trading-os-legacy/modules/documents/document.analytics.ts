/**
 * Document Analytics Service
 * Provides insights and metrics about document templates
 */

import type { DocumentTemplate, TemplateAnalytics } from './document.model';

class DocumentAnalyticsService {
  /**
   * Calculate comprehensive template analytics
   */
  calculateAnalytics(templates: DocumentTemplate[]): TemplateAnalytics {
    const totalTemplates = templates.length;
    const activeTemplates = templates.filter(t => t.Active).length;
    const inactiveTemplates = totalTemplates - activeTemplates;

    // Group by category
    const byCategory: Record<string, number> = {};
    templates.forEach(t => {
      byCategory[t.Category] = (byCategory[t.Category] || 0) + 1;
    });

    // Group by type
    const byType: Record<string, number> = {};
    templates.forEach(t => {
      byType[t.TemplateType] = (byType[t.TemplateType] || 0) + 1;
    });

    // Group by language
    const byLanguage: Record<string, number> = {};
    templates.forEach(t => {
      byLanguage[t.Language] = (byLanguage[t.Language] || 0) + 1;
    });

    // Get recently created templates (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentlyCreated = templates
      .filter(t => new Date(t.CreatedTS) > thirtyDaysAgo)
      .sort((a, b) => new Date(b.CreatedTS).getTime() - new Date(a.CreatedTS).getTime())
      .slice(0, 5);

    // Mock "most used" for now - in production, track actual usage
    const mostUsed = templates
      .filter(t => t.Active)
      .slice(0, 5)
      .map(t => ({
        templateId: t.TemplateID,
        name: t.TemplateName,
        usage: 0, // Placeholder for actual usage tracking
      }));

    return {
      totalTemplates,
      activeTemplates,
      inactiveTemplates,
      byCategory,
      byType,
      byLanguage,
      recentlyCreated,
      mostUsed,
    };
  }

  /**
   * Get category insights
   */
  getCategoryInsights(templates: DocumentTemplate[]) {
    const categories = this.groupByCategory(templates);
    
    return Object.keys(categories).map(category => ({
      category,
      total: categories[category].length,
      active: categories[category].filter(t => t.Active).length,
      languages: [...new Set(categories[category].map(t => t.Language))],
      types: [...new Set(categories[category].map(t => t.TemplateType))],
    }));
  }

  /**
   * Group templates by category
   */
  private groupByCategory(templates: DocumentTemplate[]) {
    return templates.reduce((acc, template) => {
      if (!acc[template.Category]) {
        acc[template.Category] = [];
      }
      acc[template.Category].push(template);
      return acc;
    }, {} as Record<string, DocumentTemplate[]>);
  }
}

export const documentAnalyticsService = new DocumentAnalyticsService();
