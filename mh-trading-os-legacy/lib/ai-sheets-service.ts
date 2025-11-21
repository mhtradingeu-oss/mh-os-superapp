import { sheetsService } from "./sheets";
import { validateWriteTarget } from "./ai-orchestrator";

class AISheetsService {
  async writeRows<T = any>(sheetName: string, rows: Partial<T>[]): Promise<void> {
    const validation = validateWriteTarget(sheetName);
    
    if (!validation.allowed) {
      const error = new Error(validation.message);
      console.error('[AI Sheets Service] Write blocked:', {
        sheet: sheetName,
        reason: validation.message,
        rowCount: rows.length
      });
      throw error;
    }

    console.log('[AI Sheets Service] Write allowed:', {
      sheet: sheetName,
      rowCount: rows.length,
      reason: validation.message
    });

    return sheetsService.writeRows(sheetName, rows);
  }

  async updateRow<T = any>(
    sheetName: string,
    idColumn: string,
    idValue: string | number,
    updates: Partial<T>
  ): Promise<void> {
    const validation = validateWriteTarget(sheetName);
    
    if (!validation.allowed) {
      const error = new Error(validation.message);
      console.error('[AI Sheets Service] Update blocked:', {
        sheet: sheetName,
        reason: validation.message,
        idColumn,
        idValue
      });
      throw error;
    }

    console.log('[AI Sheets Service] Update allowed:', {
      sheet: sheetName,
      idColumn,
      idValue,
      reason: validation.message
    });

    return sheetsService.updateRow(sheetName, idColumn, String(idValue), updates);
  }

  async readSheet<T = any>(sheetName: string): Promise<T[]> {
    return sheetsService.readSheet<T>(sheetName);
  }

  async getSettings() {
    return sheetsService.getSettings();
  }

  async getPartnerTiers() {
    return sheetsService.getPartnerTiers();
  }

  async getPricingParams() {
    return sheetsService.getPricingParams();
  }

  async getPricingSuggestions() {
    return sheetsService.getPricingSuggestions();
  }

  async getFinalPriceList() {
    return sheetsService.getFinalPriceList();
  }

  async getPartnerRegistry() {
    return sheetsService.getPartnerRegistry();
  }

  async getStandSites() {
    return sheetsService.getStandSites();
  }

  async getOrders() {
    return sheetsService.getOrders();
  }

  async writeOSHealth(
    component: string,
    status: 'PASS' | 'FAIL',
    message: string,
    metadata?: any
  ): Promise<void> {
    return sheetsService.writeOSHealth(component, status, message, metadata);
  }
}

export const aiSheetsService = new AISheetsService();
