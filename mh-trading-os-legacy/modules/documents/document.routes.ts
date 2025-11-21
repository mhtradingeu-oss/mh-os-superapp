/**
 * Document Routes
 * API endpoints for document template management
 */

import { Router } from 'express';
import { documentController } from './document.controller';

const router = Router();

// ==================== TEMPLATES ====================

/**
 * GET /api/docs/templates
 * Get all document templates
 */
router.get('/templates', (req, res) => documentController.getAllTemplates(req, res));

/**
 * GET /api/docs/templates/:id
 * Get a specific template by ID
 */
router.get('/templates/:id', (req, res) => documentController.getTemplateById(req, res));

/**
 * GET /api/docs/templates/type/:type
 * Get templates by type
 */
router.get('/templates/type/:type', (req, res) => documentController.getTemplatesByType(req, res));

/**
 * GET /api/docs/templates/category/:category
 * Get templates by category
 */
router.get('/templates/category/:category', (req, res) => documentController.getTemplatesByCategory(req, res));

/**
 * POST /api/docs/templates
 * Create a new template
 */
router.post('/templates', (req, res) => documentController.createTemplate(req, res));

/**
 * PATCH /api/docs/templates/:id
 * Update a template
 */
router.patch('/templates/:id', (req, res) => documentController.updateTemplate(req, res));

/**
 * DELETE /api/docs/templates/:id
 * Delete (deactivate) a template
 */
router.delete('/templates/:id', (req, res) => documentController.deleteTemplate(req, res));

// ==================== TRANSLATIONS ====================

/**
 * GET /api/docs/translations
 * Get all translations
 */
router.get('/translations', (req, res) => documentController.getAllTranslations(req, res));

/**
 * GET /api/docs/translations/:language
 * Get translations by language
 */
router.get('/translations/:language', (req, res) => documentController.getTranslationsByLanguage(req, res));

// ==================== RENDERING ====================

/**
 * POST /api/docs/render/html
 * Render a template to HTML (returns HTML text - for legacy/external use)
 */
router.post('/render/html', (req, res) => documentController.renderHTML(req, res));

/**
 * POST /api/docs/render/preview
 * Render a template to HTML (returns JSON - for authenticated frontend preview)
 */
router.post('/render/preview', (req, res) => documentController.renderHTMLJson(req, res));

/**
 * POST /api/docs/render/pdf
 * Generate PDF from a template
 */
router.post('/render/pdf', (req, res) => documentController.generatePDF(req, res));

// ==================== ANALYTICS ====================

/**
 * GET /api/docs/analytics
 * Get template analytics
 */
router.get('/analytics', (req, res) => documentController.getAnalytics(req, res));

/**
 * GET /api/docs/analytics/categories
 * Get category insights
 */
router.get('/analytics/categories', (req, res) => documentController.getCategoryInsights(req, res));

// ==================== AI OPERATIONS ====================

/**
 * POST /api/docs/ai/generate
 * AI: Generate document from description
 */
router.post('/ai/generate', (req, res) => documentController.aiGenerate(req, res));

/**
 * POST /api/docs/ai/translate
 * AI: Translate document
 */
router.post('/ai/translate', (req, res) => documentController.aiTranslate(req, res));

/**
 * POST /api/docs/ai/extract-variables
 * AI: Extract variables from HTML
 */
router.post('/ai/extract-variables', (req, res) => documentController.aiExtractVariables(req, res));

/**
 * POST /api/docs/ai/suggestions
 * AI: Get document suggestions
 */
router.post('/ai/suggestions', (req, res) => documentController.aiGetSuggestions(req, res));

/**
 * POST /api/docs/ai/compliance
 * AI: Check document compliance
 */
router.post('/ai/compliance', (req, res) => documentController.aiCheckCompliance(req, res));

export default router;
