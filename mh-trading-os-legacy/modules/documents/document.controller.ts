/**
 * Document Controller
 * Handles HTTP request/response logic for document operations
 */

import type { Request, Response } from 'express';
import { documentService } from './document.service';
import { documentTemplateInsertSchema } from '../../../shared/schema';
import { nanoid } from 'nanoid';
import { aiDocumentAssistant } from './ai/doc.ai.assistant';

export class DocumentController {
  /**
   * Get all templates
   */
  async getAllTemplates(req: Request, res: Response) {
    try {
      const templates = await documentService.getAllTemplates();
      res.json(templates);
    } catch (error: any) {
      console.error('[DocumentController] Error fetching templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates', message: error.message });
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(req: Request, res: Response) {
    try {
      const template = await documentService.getTemplateById(req.params.id);
      
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
      
      res.json(template);
    } catch (error: any) {
      console.error('[DocumentController] Error fetching template:', error);
      res.status(500).json({ error: 'Failed to fetch template', message: error.message });
    }
  }

  /**
   * Get templates by type
   */
  async getTemplatesByType(req: Request, res: Response) {
    try {
      const { type } = req.params;
      const language = req.query.language as 'EN' | 'AR' | 'DE' | undefined;
      
      const templates = await documentService.getTemplatesByType(type as any, language);
      res.json(templates);
    } catch (error: any) {
      console.error('[DocumentController] Error fetching templates by type:', error);
      res.status(500).json({ error: 'Failed to fetch templates', message: error.message });
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(req: Request, res: Response) {
    try {
      const { category } = req.params;
      const language = req.query.language as 'EN' | 'AR' | 'DE' | undefined;
      
      const templates = await documentService.getTemplatesByCategory(category as any, language);
      res.json(templates);
    } catch (error: any) {
      console.error('[DocumentController] Error fetching templates by category:', error);
      res.status(500).json({ error: 'Failed to fetch templates', message: error.message });
    }
  }

  /**
   * Create template
   */
  async createTemplate(req: Request, res: Response) {
    try {
      const validatedData = documentTemplateInsertSchema.parse(req.body);
      
      const template = await documentService.createTemplate({
        TemplateID: `TPL_${nanoid(10)}`,
        ...validatedData,
      });
      
      res.status(201).json(template);
    } catch (error: any) {
      console.error('[DocumentController] Error creating template:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      
      res.status(500).json({ error: 'Failed to create template', message: error.message });
    }
  }

  /**
   * Update template
   */
  async updateTemplate(req: Request, res: Response) {
    try {
      // Validate and filter updates to prevent arbitrary field injection
      const allowedFields = [
        'TemplateName', 'TemplateType', 'Category', 'Language',
        'ContentHTML', 'Variables', 'Active', 'Notes', 'Version', 'Tags'
      ];
      
      const filteredUpdates: any = {};
      for (const key of Object.keys(req.body)) {
        if (allowedFields.includes(key)) {
          filteredUpdates[key] = req.body[key];
        }
      }
      
      // Validate at least one field is being updated
      if (Object.keys(filteredUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update' });
      }
      
      // Validate Variables is JSON if provided
      if (filteredUpdates.Variables !== undefined) {
        if (typeof filteredUpdates.Variables !== 'string') {
          return res.status(400).json({ error: 'Variables must be a JSON string' });
        }
        try {
          const parsed = JSON.parse(filteredUpdates.Variables);
          if (!Array.isArray(parsed)) {
            return res.status(400).json({ error: 'Variables must be a JSON array string' });
          }
        } catch {
          return res.status(400).json({ error: 'Variables must be valid JSON string' });
        }
      }
      
      const success = await documentService.updateTemplate(req.params.id, filteredUpdates);
      
      if (!success) {
        return res.status(404).json({ error: 'Template not found or update failed' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[DocumentController] Error updating template:', error);
      res.status(500).json({ error: 'Failed to update template', message: error.message });
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(req: Request, res: Response) {
    try {
      const success = await documentService.deleteTemplate(req.params.id);
      
      if (!success) {
        return res.status(404).json({ error: 'Template not found or deletion failed' });
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[DocumentController] Error deleting template:', error);
      res.status(500).json({ error: 'Failed to delete template', message: error.message });
    }
  }

  /**
   * Get all translations
   */
  async getAllTranslations(req: Request, res: Response) {
    try {
      const translations = await documentService.getAllTranslations();
      res.json(translations);
    } catch (error: any) {
      console.error('[DocumentController] Error fetching translations:', error);
      res.status(500).json({ error: 'Failed to fetch translations', message: error.message });
    }
  }

  /**
   * Get translations by language
   */
  async getTranslationsByLanguage(req: Request, res: Response) {
    try {
      const language = req.params.language.toUpperCase() as 'EN' | 'AR' | 'DE';
      
      if (language !== 'EN' && language !== 'AR' && language !== 'DE') {
        return res.status(400).json({ error: 'Invalid language. Use EN, AR, or DE.' });
      }
      
      const translations = await documentService.getTranslationsByLanguage(language);
      res.json(translations);
    } catch (error: any) {
      console.error('[DocumentController] Error fetching translations by language:', error);
      res.status(500).json({ error: 'Failed to fetch translations', message: error.message });
    }
  }

  /**
   * Render template to HTML (returns HTML text)
   */
  async renderHTML(req: Request, res: Response) {
    try {
      const { templateId, variables, language, includeLogo = true } = req.body;
      
      if (!templateId || !variables) {
        return res.status(400).json({ error: 'templateId and variables are required' });
      }
      
      const html = await documentService.renderToHTML({
        templateId,
        variables,
        language,
        includeLogo,
      });
      
      res.type('html').send(html);
    } catch (error: any) {
      console.error('[DocumentController] Error rendering template:', error);
      res.status(500).json({ error: 'Failed to render template', message: error.message });
    }
  }

  /**
   * Render template to HTML (returns JSON with html property)
   * Use this for authenticated requests from frontend
   */
  async renderHTMLJson(req: Request, res: Response) {
    try {
      const { templateId, variables, language, includeLogo = true } = req.body;
      
      if (!templateId || !variables) {
        return res.status(400).json({ error: 'templateId and variables are required' });
      }
      
      const html = await documentService.renderToHTML({
        templateId,
        variables,
        language,
        includeLogo,
      });
      
      res.json({ html });
    } catch (error: any) {
      console.error('[DocumentController] Error rendering template:', error);
      res.status(500).json({ error: 'Failed to render template', message: error.message });
    }
  }

  /**
   * Generate PDF from template
   */
  async generatePDF(req: Request, res: Response) {
    try {
      const { templateId, variables, language, includeLogo = true, format = 'A4' } = req.body;
      
      if (!templateId || !variables) {
        return res.status(400).json({ error: 'templateId and variables are required' });
      }
      
      const pdfBuffer = await documentService.generatePDF({
        templateId,
        variables,
        language,
        includeLogo,
        format,
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="document-${templateId}-${Date.now()}.pdf"`);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('[DocumentController] Error generating PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
    }
  }

  /**
   * Get template analytics
   */
  async getAnalytics(req: Request, res: Response) {
    try {
      const analytics = await documentService.getTemplateAnalytics();
      res.json(analytics);
    } catch (error: any) {
      console.error('[DocumentController] Error fetching analytics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics', message: error.message });
    }
  }

  /**
   * Get category insights
   */
  async getCategoryInsights(req: Request, res: Response) {
    try {
      const insights = await documentService.getCategoryInsights();
      res.json(insights);
    } catch (error: any) {
      console.error('[DocumentController] Error fetching category insights:', error);
      res.status(500).json({ error: 'Failed to fetch category insights', message: error.message });
    }
  }

  // ==================== AI OPERATIONS ====================

  /**
   * AI: Generate document from description
   */
  async aiGenerate(req: Request, res: Response) {
    try {
      const { type, description, context, language, tone } = req.body;
      
      if (!type) {
        return res.status(400).json({ error: 'Document type is required' });
      }
      
      const html = await aiDocumentAssistant.generateDocument({
        type,
        description,
        context,
        language,
        tone,
      });
      
      res.json({ html });
    } catch (error: any) {
      console.error('[DocumentController] Error generating document:', error);
      res.status(500).json({ error: 'Failed to generate document', message: error.message });
    }
  }

  /**
   * AI: Translate document
   */
  async aiTranslate(req: Request, res: Response) {
    try {
      const { html, fromLanguage, toLanguage, preserveFormatting } = req.body;
      
      if (!html || !fromLanguage || !toLanguage) {
        return res.status(400).json({ error: 'html, fromLanguage, and toLanguage are required' });
      }
      
      const translated = await aiDocumentAssistant.translateDocument({
        html,
        fromLanguage,
        toLanguage,
        preserveFormatting,
      });
      
      res.json({ html: translated });
    } catch (error: any) {
      console.error('[DocumentController] Error translating document:', error);
      res.status(500).json({ error: 'Failed to translate document', message: error.message });
    }
  }

  /**
   * AI: Extract variables from HTML
   */
  async aiExtractVariables(req: Request, res: Response) {
    try {
      const { html, suggestTypes } = req.body;
      
      if (!html) {
        return res.status(400).json({ error: 'html is required' });
      }
      
      const variables = await aiDocumentAssistant.extractVariables({
        html,
        suggestTypes,
      });
      
      res.json({ variables });
    } catch (error: any) {
      console.error('[DocumentController] Error extracting variables:', error);
      res.status(500).json({ error: 'Failed to extract variables', message: error.message });
    }
  }

  /**
   * AI: Get document suggestions
   */
  async aiGetSuggestions(req: Request, res: Response) {
    try {
      const { html, documentType, language } = req.body;
      
      if (!html || !documentType || !language) {
        return res.status(400).json({ error: 'html, documentType, and language are required' });
      }
      
      const suggestions = await aiDocumentAssistant.getSuggestions({
        html,
        documentType,
        language,
      });
      
      res.json({ suggestions });
    } catch (error: any) {
      console.error('[DocumentController] Error getting suggestions:', error);
      res.status(500).json({ error: 'Failed to get suggestions', message: error.message });
    }
  }

  /**
   * AI: Check document compliance
   */
  async aiCheckCompliance(req: Request, res: Response) {
    try {
      const { html, documentType } = req.body;
      
      if (!html || !documentType) {
        return res.status(400).json({ error: 'html and documentType are required' });
      }
      
      const result = await aiDocumentAssistant.checkCompliance(html, documentType);
      res.json(result);
    } catch (error: any) {
      console.error('[DocumentController] Error checking compliance:', error);
      res.status(500).json({ error: 'Failed to check compliance', message: error.message });
    }
  }
}

export const documentController = new DocumentController();
