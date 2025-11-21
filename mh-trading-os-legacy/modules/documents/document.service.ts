/**
 * Document Service - Main Orchestrator
 * Manages all document operations and coordinates sub-services
 */

import { sheetsService } from '../../lib/sheets';
import type { DocumentTemplate, DocumentTranslation, RenderOptions, PDFOptions } from './document.model';
import { documentRenderService } from './document.render';
import { documentPDFService } from './document.pdf';
import { documentAnalyticsService } from './document.analytics';

class DocumentService {
  private readonly SHEET_TEMPLATES = 'Stand_DocTemplates';
  private readonly SHEET_TRANSLATIONS = 'Stand_DocTranslations';

  // ==================== TEMPLATES ====================

  /**
   * Get all document templates
   */
  async getAllTemplates(): Promise<DocumentTemplate[]> {
    try {
      const rows = await sheetsService.readSheet(this.SHEET_TEMPLATES);
      return rows as DocumentTemplate[];
    } catch (error) {
      console.error('[DocumentService] Error fetching templates:', error);
      return [];
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<DocumentTemplate | null> {
    try {
      const templates = await this.getAllTemplates();
      return templates.find(t => t.TemplateID === templateId) || null;
    } catch (error) {
      console.error(`[DocumentService] Error fetching template ${templateId}:`, error);
      return null;
    }
  }

  /**
   * Get templates by type
   */
  async getTemplatesByType(
    type: DocumentTemplate['TemplateType'],
    language?: 'EN' | 'AR' | 'DE'
  ): Promise<DocumentTemplate[]> {
    try {
      const templates = await this.getAllTemplates();
      return templates.filter(t => 
        t.Active && 
        t.TemplateType === type &&
        (language ? t.Language === language : true)
      );
    } catch (error) {
      console.error('[DocumentService] Error fetching templates by type:', error);
      return [];
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(
    category: DocumentTemplate['Category'],
    language?: 'EN' | 'AR' | 'DE'
  ): Promise<DocumentTemplate[]> {
    try {
      const templates = await this.getAllTemplates();
      return templates.filter(t => 
        t.Active && 
        t.Category === category &&
        (language ? t.Language === language : true)
      );
    } catch (error) {
      console.error('[DocumentService] Error fetching templates by category:', error);
      return [];
    }
  }

  /**
   * Create a new template with validation
   */
  async createTemplate(template: Omit<DocumentTemplate, 'CreatedTS'>): Promise<DocumentTemplate> {
    // Validate Variables is JSON string if provided
    if (template.Variables) {
      try {
        const parsed = JSON.parse(template.Variables);
        if (!Array.isArray(parsed)) {
          throw new Error('Variables must be a JSON array');
        }
      } catch (error: any) {
        throw new Error(`Invalid Variables format: ${error.message}`);
      }
    }
    
    const newTemplate: DocumentTemplate = {
      ...template,
      CreatedTS: new Date().toISOString(),
      Version: template.Version || '1.0',
    };

    await sheetsService.appendRow(this.SHEET_TEMPLATES, newTemplate);
    return newTemplate;
  }

  /**
   * Update a template
   */
  async updateTemplate(templateId: string, updates: Partial<DocumentTemplate>): Promise<boolean> {
    try {
      // Validate Variables if being updated
      if (updates.Variables !== undefined) {
        if (typeof updates.Variables !== 'string') {
          throw new Error('Variables must be a string');
        }
        try {
          const parsed = JSON.parse(updates.Variables);
          if (!Array.isArray(parsed)) {
            throw new Error('Variables must be a JSON array');
          }
        } catch (parseError: any) {
          throw new Error(`Invalid Variables format: ${parseError.message}`);
        }
      }
      
      const templates = await this.getAllTemplates();
      const index = templates.findIndex(t => t.TemplateID === templateId);
      
      if (index === -1) {
        console.error(`[DocumentService] Template ${templateId} not found for update`);
        return false;
      }

      const updated = {
        ...templates[index],
        ...updates,
        UpdatedTS: new Date().toISOString(),
      };

      await sheetsService.updateRow(this.SHEET_TEMPLATES, index + 1, updated);
      console.log(`[DocumentService] Successfully updated template ${templateId}`);
      return true;
    } catch (error) {
      console.error(`[DocumentService] Error updating template ${templateId}:`, error);
      throw error; // Propagate error to controller for proper error response
    }
  }

  /**
   * Delete a template (soft delete)
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    return this.updateTemplate(templateId, { Active: false });
  }

  // ==================== TRANSLATIONS ====================

  /**
   * Get all translations
   */
  async getAllTranslations(): Promise<DocumentTranslation[]> {
    try {
      const rows = await sheetsService.readSheet(this.SHEET_TRANSLATIONS);
      return rows as DocumentTranslation[];
    } catch (error) {
      console.error('[DocumentService] Error fetching translations:', error);
      return [];
    }
  }

  /**
   * Get translations by language
   */
  async getTranslationsByLanguage(language: 'EN' | 'AR' | 'DE'): Promise<Record<string, string>> {
    try {
      const translations = await this.getAllTranslations();
      const filtered = translations.filter(t => t.Language === language);
      
      const result: Record<string, string> = {};
      filtered.forEach(t => {
        result[t.TranslationKey] = t.TranslationValue;
      });
      
      return result;
    } catch (error) {
      console.error('[DocumentService] Error fetching translations by language:', error);
      return {};
    }
  }

  // ==================== RENDERING ====================

  /**
   * Render template to HTML
   */
  async renderToHTML(options: RenderOptions): Promise<string> {
    const { templateId, variables, language, includeLogo = true } = options;

    // Get template
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (!template.Active) {
      throw new Error(`Template is inactive: ${templateId}`);
    }

    // Get translations
    const lang = language || template.Language;
    const translations = await this.getTranslationsByLanguage(lang);

    // Render
    return documentRenderService.renderToHTML(
      template,
      variables,
      translations,
      { includeLogo, language: lang }
    );
  }

  /**
   * Generate PDF from template
   */
  async generatePDF(options: PDFOptions): Promise<Buffer> {
    const { templateId, variables, language, includeLogo = true, format = 'A4' } = options;

    // Get template
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (!template.Active) {
      throw new Error(`Template is inactive: ${templateId}`);
    }

    // Get translations
    const lang = language || template.Language;
    const translations = await this.getTranslationsByLanguage(lang);

    // Generate PDF
    return documentPDFService.generatePDF(
      template,
      variables,
      translations,
      { ...options, language: lang, format, includeLogo }
    );
  }

  // ==================== ANALYTICS ====================

  /**
   * Get template analytics
   */
  async getTemplateAnalytics() {
    const templates = await this.getAllTemplates();
    return documentAnalyticsService.calculateAnalytics(templates);
  }

  /**
   * Get category insights
   */
  async getCategoryInsights() {
    const templates = await this.getAllTemplates();
    return documentAnalyticsService.getCategoryInsights(templates);
  }
}

export const documentService = new DocumentService();
