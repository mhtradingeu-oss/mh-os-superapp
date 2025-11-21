/**
 * Document Service - HTML-to-PDF Template Engine
 * Handles document generation for contracts, invoices, agreements, etc.
 * Supports variable substitution, bilingual templates, and logo integration
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sheetsService } from './sheets';
import { promises as fs } from 'fs';
import path from 'path';

export interface DocumentTemplate {
  TemplateID: string;
  TemplateType: 'Contract' | 'Agreement' | 'Invoice' | 'Receipt' | 'Letter';
  TemplateName: string;
  Language: 'EN' | 'AR';
  ContentHTML: string;
  Variables: string; // JSON array of variable names
  Active: boolean;
  CreatedTS: string;
  UpdatedTS?: string;
  UpdatedBy?: string;
  Notes?: string;
}

export interface DocumentTranslation {
  TranslationKey: string;
  Language: 'EN' | 'AR';
  TranslationValue: string;
  Category: 'Contract' | 'Invoice' | 'General' | 'Legal';
  Notes?: string;
}

export interface RenderOptions {
  templateId: string;
  variables: Record<string, string>;
  language?: 'EN' | 'AR';
  includeLogo?: boolean;
}

export interface PDFOptions extends RenderOptions {
  format?: 'A4' | 'Letter';
  margins?: { top: number; right: number; bottom: number; left: number };
}

class DocumentService {
  private readonly SHEET_TEMPLATES = 'Stand_DocTemplates';
  private readonly SHEET_TRANSLATIONS = 'Stand_DocTranslations';
  private readonly LOGO_PATH = path.join(process.cwd(), 'attached_assets', 'MH Trading Logo_1762861944638.png');
  
  private logoBase64Cache: string | null = null;

  /**
   * Get logo as base64 data URI
   */
  private async getLogoBase64(): Promise<string> {
    if (this.logoBase64Cache) {
      return this.logoBase64Cache;
    }

    try {
      const logoBuffer = await fs.readFile(this.LOGO_PATH);
      this.logoBase64Cache = `data:image/png;base64,${logoBuffer.toString('base64')}`;
      return this.logoBase64Cache;
    } catch (error) {
      console.error('[DocumentService] Error reading logo:', error);
      return '';
    }
  }

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
   * Get active templates by type and language
   */
  async getTemplatesByType(
    type: DocumentTemplate['TemplateType'],
    language?: 'EN' | 'AR'
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
  async getTranslationsByLanguage(language: 'EN' | 'AR'): Promise<Record<string, string>> {
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

  /**
   * Render HTML template with variable substitution
   */
  async renderTemplate(options: RenderOptions): Promise<string> {
    const { templateId, variables, language, includeLogo = true } = options;

    // Get template
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    if (!template.Active) {
      throw new Error(`Template is inactive: ${templateId}`);
    }

    // Get translations for the template's language
    const lang = language || template.Language;
    const translations = await this.getTranslationsByLanguage(lang);

    // Start with template HTML
    let html = template.ContentHTML;

    // Add logo if requested
    if (includeLogo) {
      const logoDataUri = await this.getLogoBase64();
      if (logoDataUri) {
        const logoHtml = `
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${logoDataUri}" alt="MH Trading Logo" style="max-width: 200px; height: auto;" />
          </div>
        `;
        html = logoHtml + html;
      }
    }

    // Replace variables {{variableName}}
    Object.keys(variables).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = variables[key] || '';
      html = html.replace(new RegExp(placeholder, 'g'), value);
    });

    // Replace translation keys {{t.keyName}}
    Object.keys(translations).forEach(key => {
      const placeholder = `{{t.${key}}}`;
      html = html.replace(new RegExp(placeholder.replace(/\./g, '\\.'), 'g'), translations[key]);
    });

    // Add RTL support for Arabic
    if (lang === 'AR') {
      html = `
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="UTF-8">
            <style>
              body { direction: rtl; text-align: right; font-family: Arial, sans-serif; }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `;
    } else {
      html = `
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `;
    }

    return html;
  }

  /**
   * Generate PDF from HTML (simplified text-based approach)
   * For production, consider using Puppeteer or similar for HTML rendering
   */
  async generatePDF(options: PDFOptions): Promise<Buffer> {
    const { format = 'A4', margins = { top: 100, right: 50, bottom: 50, left: 50 }, includeLogo = true } = options;

    // Render HTML
    const html = await this.renderTemplate(options);

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Set page size (A4: 595 x 842 points)
    const pageWidth = format === 'A4' ? 595 : 612;
    const pageHeight = format === 'A4' ? 842 : 792;
    
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Embed logo once for reuse across all pages
    let logoImage: any = null;
    let logoWidth = 150;
    let logoHeight = 0;
    
    if (includeLogo) {
      try {
        const logoBuffer = await fs.readFile(this.LOGO_PATH);
        logoImage = await pdfDoc.embedPng(logoBuffer);
        logoHeight = (logoImage.height / logoImage.width) * logoWidth;
      } catch (error) {
        console.error('[DocumentService] Error loading logo:', error);
      }
    }

    // Helper function to add logo to a page (uses pre-loaded logo)
    const addLogoToPage = (targetPage: any): number => {
      if (logoImage) {
        targetPage.drawImage(logoImage, {
          x: (pageWidth - logoWidth) / 2,
          y: pageHeight - 80,
          width: logoWidth,
          height: logoHeight,
        });
        return pageHeight - 100 - logoHeight;
      }
      return pageHeight - margins.top;
    };

    // Add logo to first page
    let yPosition = addLogoToPage(page);

    // Strip HTML tags for text-based PDF (simplified)
    const text = this.htmlToPlainText(html);
    
    const fontSize = 12;
    const lineHeight = fontSize * 1.5;

    // Write text to PDF
    const lines = text.split('\n');
    let currentPage = page;
    
    for (const line of lines) {
      if (yPosition < margins.bottom) {
        // Add new page with logo
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = addLogoToPage(currentPage);
      }
      
      currentPage.drawText(line, {
        x: margins.left,
        y: yPosition,
        size: fontSize,
        font: font,
        color: rgb(0, 0, 0),
      });
      
      yPosition -= lineHeight;
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Convert HTML to plain text (simplified)
   * For production, use a proper HTML parser
   */
  private htmlToPlainText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  /**
   * Create a new template
   */
  async createTemplate(template: Omit<DocumentTemplate, 'CreatedTS'>): Promise<DocumentTemplate> {
    const newTemplate: DocumentTemplate = {
      ...template,
      CreatedTS: new Date().toISOString(),
    };

    await sheetsService.appendRow(this.SHEET_TEMPLATES, newTemplate);
    return newTemplate;
  }

  /**
   * Update a template
   */
  async updateTemplate(templateId: string, updates: Partial<DocumentTemplate>): Promise<boolean> {
    try {
      const templates = await this.getAllTemplates();
      const index = templates.findIndex(t => t.TemplateID === templateId);
      
      if (index === -1) {
        return false;
      }

      const updated = {
        ...templates[index],
        ...updates,
        UpdatedTS: new Date().toISOString(),
      };

      await sheetsService.updateRow(this.SHEET_TEMPLATES, index + 1, updated);
      return true;
    } catch (error) {
      console.error('[DocumentService] Error updating template:', error);
      return false;
    }
  }

  /**
   * Delete a template (soft delete by setting Active = false)
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    return this.updateTemplate(templateId, { Active: false });
  }

  /**
   * Get template analytics
   */
  async getTemplateAnalytics() {
    const templates = await this.getAllTemplates();
    
    const totalTemplates = templates.length;
    const activeTemplates = templates.filter(t => t.Active).length;
    const byType: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};

    templates.forEach(t => {
      byType[t.TemplateType] = (byType[t.TemplateType] || 0) + 1;
      byLanguage[t.Language] = (byLanguage[t.Language] || 0) + 1;
    });

    return {
      totalTemplates,
      activeTemplates,
      inactiveTemplates: totalTemplates - activeTemplates,
      byType,
      byLanguage,
    };
  }
}

export const documentService = new DocumentService();
