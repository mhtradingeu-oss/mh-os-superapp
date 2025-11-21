/**
 * E-commerce Agent - A-ECM-106
 * Catalog auditing and synchronization fixes
 */

import { nanoid } from 'nanoid';
import type { GoogleSheetsService } from '../sheets';
import { runGuardrails } from '../ai-guardrails';
import { createDraftJob } from '../ai-approval-workflow';

export interface CatalogAuditInput {
  platform?: 'WooCommerce' | 'Odoo'; // Which e-commerce platform
  checkImages?: boolean;
  checkPrices?: boolean;
  checkStock?: boolean;
}

/**
 * Task: audit-catalog
 * Audits product catalog for issues and suggests fixes
 */
export async function auditCatalog(
  sheetsService: GoogleSheetsService,
  input: CatalogAuditInput
): Promise<{ jobId: string; issues: number; guardrailsPassed: boolean }> {
  const now = new Date().toISOString();
  
  // 1. Get product data from FinalPriceList
  const products = await sheetsService.readSheet<any>('FinalPriceList');
  
  // 2. Audit for common issues
  const issues = [];
  
  for (const product of products.slice(0, 20)) {
    const productIssues = [];
    
    // Check for missing images
    if (input.checkImages && !product.ImageURL) {
      productIssues.push('Missing image URL');
    }
    
    // Check for zero/negative prices
    if (input.checkPrices && (!product.Price || product.Price <= 0)) {
      productIssues.push('Invalid price (zero or negative)');
    }
    
    // Check for missing stock info
    if (input.checkStock && product.Stock === undefined) {
      productIssues.push('Missing stock information');
    }
    
    // Check for missing essential fields
    if (!product.Name || !product.SKU) {
      productIssues.push('Missing name or SKU');
    }
    
    if (productIssues.length > 0) {
      issues.push({
        IssueID: `ISS-${nanoid(8)}`,
        JobID: '', // Will be set below
        SKU: product.SKU,
        ProductName: product.Name,
        IssueType: 'catalog_quality',
        IssueDescription: productIssues.join('; '),
        SuggestedFix: `Review and update: ${productIssues.join(', ')}`,
        Priority: productIssues.length > 2 ? 'high' : 'medium',
        Status: 'pending',
        CreatedTS: now,
      });
    }
  }
  
  // 3. Run guardrails (ensure no direct production writes)
  const guardrailResult = await runGuardrails(
    'A-ECM-106',
    'audit-catalog',
    {
      // No special guardrail data needed - just prevent direct writes
    },
    sheetsService
  );
  
  // 4. Create draft job
  const jobId = await createDraftJob(
    sheetsService,
    'A-ECM-106',
    'audit-catalog',
    JSON.stringify(input),
    JSON.stringify({ issues, guardrailResult }),
    guardrailResult.passed,
    true
  );
  
  // 5. Write to draft table
  const draftsWithJobId = issues.map(i => ({ ...i, JobID: jobId }));
  await sheetsService.writeRows('Catalog_Fixes_Draft', draftsWithJobId);
  
  await sheetsService.logToSheet(
    'INFO',
    'AI-Ecommerce',
    `Audited catalog: ${issues.length} issues found (Job: ${jobId}, Guardrails: ${guardrailResult.passed ? 'PASSED' : 'FAILED'})`
  );
  
  return {
    jobId,
    issues: issues.length,
    guardrailsPassed: guardrailResult.passed
  };
}
