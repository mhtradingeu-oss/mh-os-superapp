/**
 * Pricing Agent - A-PRC-100
 * Analyzes market data and suggests optimal pricing adjustments
 */

import { nanoid } from 'nanoid';
import type { GoogleSheetsService } from '../sheets';
import { runGuardrails } from '../ai-guardrails';
import { createDraftJob } from '../ai-approval-workflow';
import type { PricingSuggestion } from '@shared/schema';

export interface PricingAnalysisInput {
  skus?: string[]; // Specific SKUs to analyze, or all if empty
  competitorAnalysis?: boolean;
  marginTarget?: number;
}

export interface PricingSuggestionDraft extends PricingSuggestion {
  JobID: string;
}

/**
 * Task: suggest-price-changes
 * Analyzes current pricing and suggests optimizations
 */
export async function suggestPriceChanges(
  sheetsService: GoogleSheetsService,
  input: PricingAnalysisInput
): Promise<{ jobId: string; suggestions: number; guardrailsPassed: boolean }> {
  const now = new Date().toISOString();
  
  // 1. Get current pricing data
  const priceList = await sheetsService.readSheet<any>('Final_PriceList');
  const competitorPrices = await sheetsService.readSheet<any>('Competitor_Prices');
  
  // Filter to requested SKUs if specified
  const skusToAnalyze = input.skus && input.skus.length > 0
    ? priceList.filter(p => input.skus!.includes(p.SKU))
    : priceList;

  // 2. Analyze and generate suggestions (simplified - in real version would call OpenAI)
  const suggestions: PricingSuggestionDraft[] = [];
  
  for (const product of skusToAnalyze.slice(0, 10)) { // Limit to 10 for demo
    const competitors = competitorPrices.filter((c: any) => c.SKU === product.SKU);
    const avgCompPrice = competitors.length > 0
      ? competitors.reduce((sum: number, c: any) => sum + parseFloat(c.Price || 0), 0) / competitors.length
      : null;

    // Simple rule: if our price is >10% higher than avg competitor, suggest decrease
    if (avgCompPrice && product.Price > avgCompPrice * 1.1) {
      const suggestedPrice = avgCompPrice * 1.05; // 5% above avg competitor
      const margin = product.Cost ? ((suggestedPrice - product.Cost) / suggestedPrice) * 100 : 0;

      suggestions.push({
        SuggestionID: `SUGG-${nanoid(8)}`,
        JobID: '', // Will be set below
        SKU: product.SKU,
        Type: 'competitive-analysis',
        CurrentUVP: product.Price,
        SuggestedUVP: suggestedPrice,
        Reasoning: `Competitor average: €${avgCompPrice.toFixed(2)}. Our price is ${((product.Price/avgCompPrice - 1) * 100).toFixed(1)}% above market.`,
        Margin: margin,
        Status: 'pending',
        CreatedTS: now,
      });
    }
  }

  if (suggestions.length === 0) {
    // No suggestions needed
    return { jobId: '', suggestions: 0, guardrailsPassed: true };
  }

  // 3. Run guardrails
  const guardrailChecks = suggestions.map(s => ({
    sku: s.SKU,
    currentPrice: s.CurrentUVP || 0,
    suggestedPrice: s.SuggestedUVP || 0,
    margin: s.Margin || 0,
  }));

  const guardrailResult = await runGuardrails(
    'A-PRC-100',
    'suggest-price-changes',
    { checks: guardrailChecks, minMarginPct: input.marginTarget || 20 },
    sheetsService
  );

  // 4. Create draft job
  const jobId = await createDraftJob(
    sheetsService,
    'A-PRC-100',
    'suggest-price-changes',
    JSON.stringify(input),
    JSON.stringify({ suggestions, guardrailResult }),
    guardrailResult.passed,
    true
  );

  // 5. Write suggestions to draft table
  const draftsWithJobId = suggestions.map(s => ({ ...s, JobID: jobId }));
  await sheetsService.writeRows('Pricing_Suggestions_Draft', draftsWithJobId);

  await sheetsService.logToSheet(
    'INFO',
    'AI-Pricing',
    `Created ${suggestions.length} price suggestions (Job: ${jobId}, Guardrails: ${guardrailResult.passed ? 'PASSED' : 'FAILED'})`
  );

  return {
    jobId,
    suggestions: suggestions.length,
    guardrailsPassed: guardrailResult.passed
  };
}
