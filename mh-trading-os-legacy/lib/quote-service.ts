import { nanoid } from 'nanoid';
import { sheetsService } from './sheets';
import type { Quote, QuoteLine } from '@shared/schema';

export interface CreateQuotePayload {
  partnerId: string;
  lines: Array<{
    sku: string;
    qty: number;
    unitPrice: number;
    lineDiscount?: number;
  }>;
  subtotalGross?: number;
  discountTotal?: number;
  loyaltyRedeemed?: number;
  total?: number;
  notes?: string;
  status?: 'Draft' | 'Active' | 'Sent' | 'Converted' | 'Expired' | 'Cancelled';
}

export interface QuoteDetail extends Quote {
  lines: QuoteLine[];
}

export class QuoteService {
  async listQuotes(): Promise<Quote[]> {
    return sheetsService.getQuotes();
  }

  async getQuote(quoteId: string): Promise<QuoteDetail | null> {
    const [quotes, lines] = await Promise.all([
      sheetsService.getQuotes(),
      sheetsService.getQuoteLines(),
    ]);

    const quote = quotes.find(q => q.QuoteID === quoteId);
    if (!quote) return null;

    const quoteLines = lines.filter(l => l.QuoteID === quoteId);
    return { ...quote, lines: quoteLines };
  }

  async createQuote(payload: CreateQuotePayload): Promise<QuoteDetail> {
    const {
      partnerId,
      lines,
      subtotalGross: providedSubtotal,
      discountTotal = 0,
      loyaltyRedeemed = 0,
      total: providedTotal,
      notes = '',
      status = 'Draft'
    } = payload;

    if (!partnerId || !lines || lines.length === 0) {
      throw new Error('partnerId and lines are required');
    }

    const quoteId = `Q-${new Date().getFullYear()}-${nanoid(6)}`;
    const timestamp = new Date().toISOString();

    const calculatedSubtotal = lines.reduce(
      (sum, line) => sum + (line.qty * line.unitPrice - (line.lineDiscount || 0)),
      0
    );
    const subtotalGross = providedSubtotal ?? calculatedSubtotal;
    const total = providedTotal ?? (subtotalGross - discountTotal - loyaltyRedeemed);

    const quoteHeader: Partial<Quote> = {
      QuoteID: quoteId,
      PartnerID: partnerId,
      CreatedTS: timestamp,
      CreatedBy: 'system',
      Status: status,
      SubtotalGross: subtotalGross,
      DiscountTotal: discountTotal,
      LoyaltyRedeemed: loyaltyRedeemed,
      Total: total,
      Notes: notes,
    };

    await sheetsService.writeRows('Quotes', [quoteHeader]);

    const quoteLines = lines.map((line, index) => ({
      LineID: `${quoteId}-L${index + 1}`,
      QuoteID: quoteId,
      SKU: line.sku,
      Qty: line.qty,
      UnitPrice: line.unitPrice,
      LineDiscount: line.lineDiscount || 0,
      LineTotal: line.qty * line.unitPrice - (line.lineDiscount || 0),
    }));

    await sheetsService.writeRows('QuoteLines', quoteLines);
    await sheetsService.logToSheet('INFO', 'Sales', `Created quote ${quoteId} for partner ${partnerId}: €${total.toFixed(2)}`);

    return {
      ...quoteHeader as Quote,
      lines: quoteLines as QuoteLine[],
    };
  }

  async getQuoteLines(quoteId: string): Promise<QuoteLine[]> {
    const allLines = await sheetsService.getQuoteLines();
    return allLines.filter(line => line.QuoteID === quoteId);
  }

  async updateQuoteStatus(quoteId: string, status: Quote['Status'], notes?: string): Promise<void> {
    const updates: Partial<Quote> = { Status: status };
    if (notes !== undefined) {
      updates.Notes = notes;
    }

    await sheetsService.updateRow('Quotes', 'QuoteID', quoteId, updates);
    await sheetsService.logToSheet('INFO', 'Sales', `Updated quote ${quoteId} status to ${status}`);
  }
}

export const quoteService = new QuoteService();
