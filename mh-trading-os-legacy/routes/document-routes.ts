/**
 * Document Templates API Routes
 * Handles CRUD operations for document templates and PDF generation
 */

import { Router } from 'express';
import { documentService } from '../lib/document-service';
import { documentTemplateInsertSchema, documentTranslationInsertSchema } from '../../shared/schema';
import { nanoid } from 'nanoid';

const router = Router();

/**
 * GET /api/documents/templates
 * Get all document templates
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = await documentService.getAllTemplates();
    res.json(templates);
  } catch (error: any) {
    console.error('[DocumentRoutes] Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates', message: error.message });
  }
});

/**
 * GET /api/documents/templates/:id
 * Get a specific template by ID
 */
router.get('/templates/:id', async (req, res) => {
  try {
    const template = await documentService.getTemplateById(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json(template);
  } catch (error: any) {
    console.error('[DocumentRoutes] Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template', message: error.message });
  }
});

/**
 * GET /api/documents/templates/type/:type
 * Get templates by type (and optionally language)
 */
router.get('/templates/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const language = req.query.language as 'EN' | 'AR' | undefined;
    
    const templates = await documentService.getTemplatesByType(
      type as any,
      language
    );
    
    res.json(templates);
  } catch (error: any) {
    console.error('[DocumentRoutes] Error fetching templates by type:', error);
    res.status(500).json({ error: 'Failed to fetch templates', message: error.message });
  }
});

/**
 * GET /api/documents/analytics
 * Get template analytics
 */
router.get('/analytics', async (req, res) => {
  try {
    const analytics = await documentService.getTemplateAnalytics();
    res.json(analytics);
  } catch (error: any) {
    console.error('[DocumentRoutes] Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics', message: error.message });
  }
});

/**
 * POST /api/documents/templates
 * Create a new template
 */
router.post('/templates', async (req, res) => {
  try {
    const validatedData = documentTemplateInsertSchema.parse(req.body);
    
    const template = await documentService.createTemplate({
      TemplateID: `TPL_${validatedData.TemplateType}_${validatedData.Language}_${nanoid(6)}`,
      ...validatedData,
    });
    
    res.status(201).json(template);
  } catch (error: any) {
    console.error('[DocumentRoutes] Error creating template:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    res.status(500).json({ error: 'Failed to create template', message: error.message });
  }
});

/**
 * PATCH /api/documents/templates/:id
 * Update a template
 */
router.patch('/templates/:id', async (req, res) => {
  try {
    const success = await documentService.updateTemplate(req.params.id, req.body);
    
    if (!success) {
      return res.status(404).json({ error: 'Template not found or update failed' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[DocumentRoutes] Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template', message: error.message });
  }
});

/**
 * DELETE /api/documents/templates/:id
 * Delete (deactivate) a template
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const success = await documentService.deleteTemplate(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Template not found or deletion failed' });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[DocumentRoutes] Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template', message: error.message });
  }
});

/**
 * GET /api/documents/translations
 * Get all translations
 */
router.get('/translations', async (req, res) => {
  try {
    const translations = await documentService.getAllTranslations();
    res.json(translations);
  } catch (error: any) {
    console.error('[DocumentRoutes] Error fetching translations:', error);
    res.status(500).json({ error: 'Failed to fetch translations', message: error.message });
  }
});

/**
 * GET /api/documents/translations/:language
 * Get translations by language
 */
router.get('/translations/:language', async (req, res) => {
  try {
    const language = req.params.language.toUpperCase() as 'EN' | 'AR';
    
    if (language !== 'EN' && language !== 'AR') {
      return res.status(400).json({ error: 'Invalid language. Use EN or AR.' });
    }
    
    const translations = await documentService.getTranslationsByLanguage(language);
    res.json(translations);
  } catch (error: any) {
    console.error('[DocumentRoutes] Error fetching translations by language:', error);
    res.status(500).json({ error: 'Failed to fetch translations', message: error.message });
  }
});

/**
 * POST /api/documents/render
 * Render a template with variables (returns HTML)
 */
router.post('/render', async (req, res) => {
  try {
    const { templateId, variables, language, includeLogo = true } = req.body;
    
    if (!templateId || !variables) {
      return res.status(400).json({ error: 'templateId and variables are required' });
    }
    
    const html = await documentService.renderTemplate({
      templateId,
      variables,
      language,
      includeLogo,
    });
    
    res.type('html').send(html);
  } catch (error: any) {
    console.error('[DocumentRoutes] Error rendering template:', error);
    res.status(500).json({ error: 'Failed to render template', message: error.message });
  }
});

/**
 * POST /api/documents/generate-pdf
 * Generate PDF from a template
 */
router.post('/generate-pdf', async (req, res) => {
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
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="document-${templateId}-${Date.now()}.pdf"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('[DocumentRoutes] Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF', message: error.message });
  }
});

export default router;
