/**
 * Google Sheets Sync API Routes
 * Provides endpoints for Google Apps Script integration
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { sheetsService } from '../lib/sheets';

const router = Router();

/**
 * POST /api/sheets/sync
 * Receive product data from Google Sheets
 */
router.post('/sheets/sync', async (req: Request, res: Response) => {
  try {
    const { products } = req.body;
    
    if (!Array.isArray(products)) {
      return res.status(400).json({ 
        error: 'Invalid request: products array required' 
      });
    }
    
    // Validate products have required fields
    const requiredFields = ['SKU', 'ProductName'];
    const invalidProducts = products.filter(p => 
      !requiredFields.every(field => p[field])
    );
    
    if (invalidProducts.length > 0) {
      return res.status(400).json({
        error: 'Invalid products',
        invalidCount: invalidProducts.length,
        sample: invalidProducts.slice(0, 3)
      });
    }
    
    // Update FinalPriceList sheet
    const sheet = await sheetsService.readSheet('FinalPriceList');
    const headers = await sheetsService.getHeaders('FinalPriceList');
    
    // Convert products to rows
    const rows = products.map(product => 
      headers.map(header => product[header] ?? '')
    );
    
    // Clear and write
    await sheetsService.clearData('FinalPriceList', 2);
    await sheetsService.batchAppendRows('FinalPriceList', rows);
    
    res.json({
      success: true,
      synced: products.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Sheets sync error:', error);
    res.status(500).json({
      error: 'Sync failed',
      message: error.message
    });
  }
});

/**
 * GET /api/products/all
 * Export all products for Google Sheets
 */
router.get('/products/all', async (req: Request, res: Response) => {
  try {
    const products = await sheetsService.getAllRows('FinalPriceList');
    
    res.json({
      products,
      count: products.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Products export error:', error);
    res.status(500).json({
      error: 'Export failed',
      message: error.message
    });
  }
});

/**
 * POST /api/sheets/validate
 * Validate product data before sync
 */
router.post('/sheets/validate', async (req: Request, res: Response) => {
  try {
    const { products } = req.body;
    
    if (!Array.isArray(products)) {
      return res.status(400).json({ 
        error: 'Invalid request: products array required' 
      });
    }
    
    const issues = [];
    const validLines = ['Premium', 'Professional', 'Basic', 'Tools'];
    const validCategories = [
      'Beard', 'Hair', 'Shaving', 'Aftershave', 'Fragrance',
      'Skin', 'Body', 'Tools', 'Accessories', 'Kits'
    ];
    
    products.forEach((product, index) => {
      const rowIssues = [];
      
      if (!product.SKU) rowIssues.push('Missing SKU');
      if (!product.ProductName) rowIssues.push('Missing ProductName');
      if (product.Line && !validLines.includes(product.Line)) {
        rowIssues.push(`Invalid Line: ${product.Line}`);
      }
      if (product.Category && !validCategories.includes(product.Category)) {
        rowIssues.push(`Invalid Category: ${product.Category}`);
      }
      
      if (rowIssues.length > 0) {
        issues.push({
          row: index + 1,
          sku: product.SKU || 'N/A',
          issues: rowIssues
        });
      }
    });
    
    res.json({
      valid: issues.length === 0,
      totalProducts: products.length,
      issuesFound: issues.length,
      issues: issues.slice(0, 20), // First 20 issues
      hasMore: issues.length > 20
    });
  } catch (error: any) {
    console.error('Validation error:', error);
    res.status(500).json({
      error: 'Validation failed',
      message: error.message
    });
  }
});

export default router;
