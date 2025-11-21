import type { SheetsService } from '../sheets';
import { generateAIResponse } from '../openai';
import { nanoid } from 'nanoid';

interface SuggestLinesInput {
  partnerId: string;
  currentLines: any[];
  pricingData: any;
}

interface RepriceInput {
  partnerId: string;
  lines: any[];
  pricingData: any;
}

interface SummarizeInput {
  partnerId: string;
  lines: any[];
  pricingData: any;
}

export async function suggestQuoteLines(
  sheetsService: SheetsService,
  input: SuggestLinesInput
) {
  const { partnerId, currentLines, pricingData } = input;

  // Fetch context data
  const [partner, products, orderHistory] = await Promise.all([
    sheetsService.getPartnerRegistry().then(partners => 
      partners.find(p => p.PartnerID === partnerId)
    ),
    sheetsService.getFinalPriceList(),
    sheetsService.getOrders().then(orders => 
      orders.filter(o => o.PartnerID === partnerId).slice(0, 10)
    ),
  ]);

  if (!partner) {
    throw new Error('Partner not found');
  }

  // Build AI prompt
  const currentSKUs = currentLines.map(l => l.SKU).filter(Boolean);
  const prompt = `You are a B2B sales assistant for MH Trading OS. Analyze this quote and suggest 3-5 additional products for upselling or cross-selling.

Partner: ${partner.PartnerName} (Tier: ${partner.Tier})
Current Quote Lines: ${currentSKUs.length > 0 ? currentSKUs.join(', ') : 'None yet'}
Quote Total: €${pricingData?.finalTotal || 0}

Recent Order History (SKUs): ${orderHistory.length > 0 ? 'Has previous orders' : 'New customer'}

Available Products (sample): ${products.slice(0, 20).map(p => `${p.SKU} (${p.Name}, €${p.UVP})`).join(', ')}

Rules:
1. Suggest complementary products based on current cart
2. Consider partner tier for discount eligibility
3. Prioritize higher-margin products
4. Include brief reason for each suggestion
5. Suggest realistic quantities

Return JSON array format:
[
  {
    "sku": "PRODUCT-001",
    "reason": "Complements current selection",
    "suggestedQty": 5,
    "suggestedPrice": 19.99
  }
]`;

  const aiResponse = await generateAIResponse(
    [{ role: 'user', content: prompt }],
    'gpt-4'
  );

  let suggestions = [];
  try {
    suggestions = JSON.parse(aiResponse);
  } catch (e) {
    // If AI doesn't return valid JSON, extract suggestions manually
    suggestions = [];
  }

  // Write to Sales_Suggestions_Draft table (pending approval)
  const jobId = `SLS-SGT-${new Date().getFullYear()}-${nanoid(6)}`;
  const timestamp = new Date().toISOString();

  for (const suggestion of suggestions) {
    await sheetsService.writeRows('Sales_Suggestions_Draft', [{
      JobID: jobId,
      PartnerID: partnerId,
      SKU: suggestion.sku,
      SuggestedQty: suggestion.suggestedQty || 1,
      SuggestedPrice: suggestion.suggestedPrice || 0,
      Reason: suggestion.reason || '',
      CreatedTS: timestamp,
      Status: 'PendingApproval',
      CreatedBy: 'AI-SalesCopilot'
    }]);
  }

  await sheetsService.logToSheet(
    'INFO',
    'AI',
    `Sales Copilot suggested ${suggestions.length} products for ${partnerId} (Draft: ${jobId})`
  );

  return {
    jobId,
    suggestions,
    status: 'draft',
    message: 'Suggestions written to Sales_Suggestions_Draft pending AI Crew approval'
  };
}

export async function repriceQuoteLines(
  sheetsService: SheetsService,
  input: RepriceInput
) {
  const { partnerId, lines, pricingData } = input;

  const [partner, products, pricingParams] = await Promise.all([
    sheetsService.getPartnerRegistry().then(partners => 
      partners.find(p => p.PartnerID === partnerId)
    ),
    sheetsService.getFinalPriceList(),
    sheetsService.getPricingParams(),
  ]);

  if (!partner) {
    throw new Error('Partner not found');
  }

  const minMargin = pricingParams.find(p => p.ParamKey === 'MIN_MARGIN_PCT')?.Value || '15';
  const mapFloor = pricingParams.find(p => p.ParamKey === 'MAP_FLOOR_PCT')?.Value || '10';

  const linesWithPricing = lines.map(line => {
    const product = products.find(p => p.SKU === line.SKU);
    return {
      ...line,
      product,
      currentPrice: pricingData?.lines?.find((l: any) => l.sku === line.SKU)?.unitPrice || product?.UVP || 0
    };
  });

  const prompt = `You are a pricing optimization AI for MH Trading OS. Analyze these quote lines and suggest optimal pricing that:
1. Respects MAP floor (minimum ${mapFloor}% below UVP)
2. Maintains minimum margin of ${minMargin}%
3. Optimizes for ${partner.Tier} tier partner
4. Balances competitiveness with profitability

Quote Lines:
${linesWithPricing.map(l => `${l.SKU}: Current €${l.currentPrice}, UVP €${l.product?.UVP || 0}, COGS €${l.product?.COGS_EUR || 0}, MAP €${l.product?.MAP || 0}`).join('\n')}

Return JSON array:
[
  {
    "sku": "PRODUCT-001",
    "currentPrice": 25.00,
    "suggestedPrice": 23.50,
    "reason": "Can reduce 6% while maintaining 20% margin"
  }
]`;

  const aiResponse = await generateAIResponse(
    [{ role: 'user', content: prompt }],
    'gpt-4'
  );

  let repricedLines = [];
  try {
    repricedLines = JSON.parse(aiResponse);
  } catch (e) {
    repricedLines = [];
  }

  // Write to Pricing_Suggestions_Draft (pending approval)
  const jobId = `SLS-RPR-${new Date().getFullYear()}-${nanoid(6)}`;
  const timestamp = new Date().toISOString();

  for (const line of repricedLines) {
    await sheetsService.writeRows('Pricing_Suggestions_Draft', [{
      JobID: jobId,
      PartnerID: partnerId,
      SKU: line.sku,
      CurrentPrice: line.currentPrice,
      SuggestedPrice: line.suggestedPrice,
      Reason: line.reason || '',
      CreatedTS: timestamp,
      Status: 'PendingApproval',
      CreatedBy: 'AI-SalesCopilot'
    }]);
  }

  await sheetsService.logToSheet(
    'INFO',
    'AI',
    `Sales Copilot repriced ${repricedLines.length} lines for ${partnerId} (Draft: ${jobId})`
  );

  return {
    jobId,
    repricedLines,
    status: 'draft',
    message: 'Repricing written to Pricing_Suggestions_Draft pending AI Crew approval'
  };
}

export async function summarizeQuote(
  sheetsService: SheetsService,
  input: SummarizeInput
) {
  const { partnerId, lines, pricingData } = input;

  const [partner, products] = await Promise.all([
    sheetsService.getPartnerRegistry().then(partners => 
      partners.find(p => p.PartnerID === partnerId)
    ),
    sheetsService.getFinalPriceList(),
  ]);

  if (!partner) {
    throw new Error('Partner not found');
  }

  const linesWithDetails = lines.map(line => {
    const product = products.find(p => p.SKU === line.SKU);
    const pricedLine = pricingData?.lines?.find((l: any) => l.sku === line.SKU);
    return {
      sku: line.SKU,
      name: product?.Name || line.SKU,
      qty: line.Qty,
      unitPrice: pricedLine?.unitPrice || 0,
      lineTotal: pricedLine?.lineTotal || 0
    };
  });

  const prompt = `You are an executive sales assistant. Create a professional quote summary for internal review and client presentation.

Partner: ${partner.PartnerName} (${partner.Tier} Tier, ${partner.PartnerType || 'B2B'})
Quote Lines: ${linesWithDetails.length}
Items:
${linesWithDetails.map(l => `- ${l.name} x${l.qty} @ €${l.unitPrice.toFixed(2)} = €${l.lineTotal.toFixed(2)}`).join('\n')}

Pricing Summary:
- Subtotal: €${pricingData?.subtotalGross || 0}
- Tier Discount: €${pricingData?.tierDiscountTotal || 0}
- Volume Discount: €${pricingData?.volumeDiscountAmt || 0}
- Loyalty Redeemed: €${pricingData?.loyaltyRedeemed || 0}
- Net Total: €${pricingData?.finalTotal || 0}
- VAT (${pricingData?.vatRate || 19}%): €${pricingData?.vatAmount || 0}
- Total with VAT: €${pricingData?.finalTotalWithVAT || 0}

Create a concise summary (3-4 paragraphs) highlighting:
1. Key products and value proposition
2. Pricing benefits (tier discounts, promotions)
3. Loyalty program impact
4. Recommended next steps

Also provide 3-5 key highlights as bullet points.

Return JSON:
{
  "summary": "Full summary text...",
  "highlights": ["Point 1", "Point 2", ...]
}`;

  const aiResponse = await generateAIResponse(
    [{ role: 'user', content: prompt }],
    'gpt-4'
  );

  let summaryData;
  try {
    summaryData = JSON.parse(aiResponse);
  } catch (e) {
    summaryData = {
      summary: aiResponse,
      highlights: []
    };
  }

  // Write to Quote_Summaries_Draft (pending approval)
  const jobId = `SLS-SUM-${new Date().getFullYear()}-${nanoid(6)}`;
  const timestamp = new Date().toISOString();

  await sheetsService.writeRows('Quote_Summaries_Draft', [{
    JobID: jobId,
    PartnerID: partnerId,
    Summary: summaryData.summary || '',
    Highlights: JSON.stringify(summaryData.highlights || []),
    QuoteValue: pricingData?.finalTotalWithVAT || 0,
    LineCount: lines.length,
    CreatedTS: timestamp,
    Status: 'PendingApproval',
    CreatedBy: 'AI-SalesCopilot'
  }]);

  await sheetsService.logToSheet(
    'INFO',
    'AI',
    `Sales Copilot summarized quote for ${partnerId} (Draft: ${jobId})`
  );

  return {
    jobId,
    ...summaryData,
    status: 'draft',
    message: 'Summary written to Quote_Summaries_Draft pending AI Crew approval'
  };
}
