import { Router } from 'express';
import { sheetsService } from './lib/sheets';
import { cachedSheetsService } from './lib/sheets-cache';
import { seedAIAgents, seedAIPlaybooks } from './lib/seed-ai-agents';
import { nanoid } from 'nanoid';

const router = Router();

router.post("/seed/ai-agents", async (req, res) => {
  try {
    await seedAIAgents(sheetsService);
    res.json({ success: true, message: 'AI_Agents seeded successfully' });
  } catch (error: any) {
    console.error('[Admin] Seed AI_Agents failed:', error);
    res.status(500).json({ error: 'Failed to seed AI_Agents', details: error.message });
  }
});

router.post("/seed/ai-playbooks", async (req, res) => {
  try {
    await seedAIPlaybooks(sheetsService);
    res.json({ success: true, message: 'AI_Playbooks seeded successfully' });
  } catch (error: any) {
    console.error('[Admin] Seed AI_Playbooks failed:', error);
    res.status(500).json({ error: 'Failed to seed AI_Playbooks', details: error.message });
  }
});

router.get("/health/validate-spreadsheet", async (req, res) => {
  try {
    const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID || '';
    
    // Validate single ID (no duplicates in env)
    const isDuplicate = spreadsheetId.includes(',') || spreadsheetId.includes(' ');
    
    if (isDuplicate) {
      await sheetsService.logToSheet('ERROR', 'Admin', 'Multiple spreadsheet IDs detected - FAIL');
      return res.json({ valid: false, error: 'Duplicate spreadsheet IDs detected' });
    }
    
    // Log success
    await sheetsService.logToSheet('INFO', 'Admin', `Spreadsheet validation: PASS (ID: ${spreadsheetId.substring(0, 10)}...)`);
    
    res.json({ 
      valid: true, 
      spreadsheetId: spreadsheetId.substring(0, 10) + '...',
      message: 'Single spreadsheet ID validated'
    });
  } catch (error: any) {
    console.error('[Admin] Spreadsheet validation failed:', error);
    res.status(500).json({ error: 'Validation failed', details: error.message });
  }
});

router.get("/cache/stats", async (req, res) => {
  try {
    const stats = cachedSheetsService.getCacheStats();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...stats
    });
  } catch (error: any) {
    console.error('[Admin] Cache stats failed:', error);
    res.status(500).json({ error: 'Failed to get cache stats', details: error.message });
  }
});

router.post("/cache/clear", async (req, res) => {
  try {
    const { tableName } = req.body;
    cachedSheetsService.invalidateCache(tableName);
    res.json({ 
      success: true, 
      message: tableName ? `Cache cleared for ${tableName}` : 'All cache cleared'
    });
  } catch (error: any) {
    console.error('[Admin] Cache clear failed:', error);
    res.status(500).json({ error: 'Failed to clear cache', details: error.message });
  }
});

// ==================== DRAFT MANAGEMENT ENDPOINTS (Task 4) ====================
// SECURITY NOTE: These endpoints rely on global requireAuth middleware for authentication.
// Future improvement: Add explicit role-based authorization (e.g., isAdmin check) to restrict
// draft promotion/rejection to admin users only. Current protection: ActorType='AI' validation
// prevents non-AI drafts from being processed, but any authenticated user can currently
// promote/reject AI drafts.

router.get("/drafts", async (req, res) => {
  try {
    const { table, status } = req.query;
    
    const draftTables = ['Pricing_Suggestions_Draft', 'Sales_Suggestions_Draft', 'Outreach_Drafts'];
    const tablesToFetch = table ? [table as string] : draftTables;
    
    const allDrafts: any[] = [];
    
    for (const tableName of tablesToFetch) {
      const rows = await sheetsService.readSheet<any>(tableName, false);
      
      let filtered = rows.map((row: any) => ({
        ...row,
        TableName: tableName
      }));
      
      if (status) {
        filtered = filtered.filter((r: any) => r.Status === status);
      }
      
      allDrafts.push(...filtered);
    }
    
    allDrafts.sort((a, b) => new Date(b.CreatedAt || 0).getTime() - new Date(a.CreatedAt || 0).getTime());
    
    res.json({ success: true, drafts: allDrafts, count: allDrafts.length });
  } catch (error: any) {
    console.error('[Admin] Get drafts failed:', error);
    res.status(500).json({ error: 'Failed to get drafts', details: error.message });
  }
});

router.post("/drafts/:id/promote", async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerName } = req.body;
    
    const draftTables = ['Pricing_Suggestions_Draft', 'Sales_Suggestions_Draft', 'Outreach_Drafts'];
    let draft: any = null;
    let tableName: string = '';
    
    for (const table of draftTables) {
      const rows = await sheetsService.readSheet<any>(table, false);
      const found = rows.find((r: any) => r.DraftID === id);
      if (found) {
        draft = found;
        tableName = table;
        break;
      }
    }
    
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found in any draft table' });
    }
    
    if (draft.Status === 'Promoted') {
      return res.status(400).json({ error: 'Draft already promoted' });
    }
    
    if (draft.ActorType !== 'AI') {
      return res.status(403).json({ 
        error: 'Only AI-generated drafts can be promoted',
        details: `Draft ActorType is ${draft.ActorType}, expected AI` 
      });
    }
    
    let promotionRef = '';
    let productionTable = '';
    
    try {
      if (tableName === 'Pricing_Suggestions_Draft') {
        productionTable = 'FinalPriceList';
        const productRows = await sheetsService.readSheet<any>(productionTable, false);
        const existingProduct = productRows.find((p: any) => p.SKU === draft.SKU);
        
        const productionData: any = { SKU: draft.SKU };
        const draftKeys = Object.keys(draft);
        const metadataKeys = ['DraftID', 'SourceAgent', 'ActorType', 'RequestID', 'Status', 'CreatedAt', 'ReviewedBy', 'ReviewedAt', 'PromotionRef', 'Notes', 'SuggestionID', 'TableName'];
        
        for (const key of draftKeys) {
          if (!metadataKeys.includes(key) && draft[key] !== undefined && draft[key] !== null && draft[key] !== '') {
            if (key === 'ProductStatus') {
              productionData['Status'] = draft[key];
            } else if (key === 'ProductNotes') {
              productionData['Notes'] = draft[key];
            } else {
              productionData[key] = draft[key];
            }
          }
        }
        
        if (existingProduct) {
          await sheetsService.updateRow(productionTable, 'SKU', draft.SKU, productionData, { disableLog: false });
          promotionRef = `Updated-${draft.SKU}`;
        } else {
          await sheetsService.writeRows(productionTable, [productionData]);
          promotionRef = `Created-${draft.SKU}`;
        }
        
      } else if (tableName === 'Sales_Suggestions_Draft') {
        productionTable = 'Quotes';
        
        let parsedLines: any[] = [];
        if (draft.LinesJSON) {
          try {
            parsedLines = JSON.parse(draft.LinesJSON);
            if (!Array.isArray(parsedLines) || parsedLines.length === 0) {
              throw new Error('LinesJSON must be a non-empty array');
            }
          } catch (e: any) {
            throw new Error(`Invalid LinesJSON: ${e.message}`);
          }
        }
        
        const quoteData: any = {
          QuoteID: draft.QuoteID || `QT-${nanoid(8)}`,
          PartnerID: draft.PartnerID,
          QuoteDate: new Date().toISOString().split('T')[0],
          ExpiryDate: draft.ValidUntil || '',
          Subtotal: draft.TotalBeforeTax || 0,
          Total: draft.TotalAfterTax || 0,
          Status: 'Draft',
          Notes: `AI Suggestion: ${draft.SuggestionReason || ''}`
        };
        
        let quoteCreated = false;
        try {
          await sheetsService.writeRows(productionTable, [quoteData]);
          quoteCreated = true;
          promotionRef = quoteData.QuoteID;
          
          if (parsedLines.length > 0) {
            const lineRows = parsedLines.map((line: any, i: number) => ({
              QuoteID: quoteData.QuoteID,
              LineNum: i + 1,
              SKU: line.SKU || '',
              Qty: line.Qty || 0,
              UnitPrice: line.UnitPrice || line.NetPrice || 0,
              LineTotal: (line.Qty || 0) * (line.UnitPrice || line.NetPrice || 0)
            }));
            
            await sheetsService.writeRows('QuoteLines', lineRows);
          }
        } catch (salesError: any) {
          if (quoteCreated) {
            console.error('[Admin] Rollback: Deleting orphan quote', quoteData.QuoteID);
            try {
              const allQuotes = await sheetsService.readSheet<any>('Quotes', false);
              const quoteIndex = allQuotes.findIndex((q: any) => q.QuoteID === quoteData.QuoteID);
              if (quoteIndex >= 0) {
                allQuotes.splice(quoteIndex, 1);
                await sheetsService.writeRows('Quotes', allQuotes);
              }
            } catch (rollbackError: any) {
              console.error('[Admin] Rollback failed:', rollbackError);
            }
          }
          throw new Error(`Sales promotion failed: ${salesError.message}. ${quoteCreated ? 'Orphan quote removed.' : ''}`);
        }
        
      } else if (tableName === 'Outreach_Drafts') {
        productionTable = 'Outreach_Sends';
        const sendData: any = {
          SendID: `SND-${nanoid(10)}`,
          CampaignID: draft.CampaignID || '',
          Subject: draft.Subject,
          BodyRef: draft.BodyText,
          Status: 'Draft',
          Channel: 'Email',
          TS_Queued: new Date().toISOString()
        };
        
        await sheetsService.writeRows(productionTable, [sendData]);
        promotionRef = sendData.SendID;
        
      } else {
        return res.status(400).json({ error: 'Unknown table name' });
      }
      
      await sheetsService.updateRow(tableName, 'DraftID', id, {
        Status: 'Promoted',
        ReviewedBy: reviewerName || 'Admin',
        ReviewedAt: new Date().toISOString(),
        PromotionRef: promotionRef
      }, { disableLog: true });
      
      await sheetsService.logToSheet('INFO', 'AI-Guardrails', `Promoted ${tableName} draft ${id} to ${productionTable}: ${promotionRef}`);
      
      res.json({ 
        success: true, 
        message: 'Draft promoted to production', 
        promotionRef,
        productionTable
      });
      
    } catch (promotionError: any) {
      console.error('[Admin] Production write failed:', promotionError);
      
      await sheetsService.logToSheet('ERROR', 'AI-Guardrails', `Failed to promote draft ${id}: ${promotionError.message}`);
      
      throw promotionError;
    }
  } catch (error: any) {
    console.error('[Admin] Promote draft failed:', error);
    res.status(500).json({ error: 'Failed to promote draft', details: error.message });
  }
});

router.post("/drafts/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerName, reason } = req.body;
    
    const draftTables = ['Pricing_Suggestions_Draft', 'Sales_Suggestions_Draft', 'Outreach_Drafts'];
    let draft: any = null;
    let tableName: string = '';
    
    for (const table of draftTables) {
      const rows = await sheetsService.readSheet<any>(table, false);
      const found = rows.find((r: any) => r.DraftID === id);
      if (found) {
        draft = found;
        tableName = table;
        break;
      }
    }
    
    if (!draft) {
      return res.status(404).json({ error: 'Draft not found in any draft table' });
    }
    
    if (draft.Status === 'Rejected') {
      return res.status(400).json({ error: 'Draft already rejected' });
    }
    
    if (draft.ActorType !== 'AI') {
      return res.status(403).json({ 
        error: 'Only AI-generated drafts can be rejected via this endpoint',
        details: `Draft ActorType is ${draft.ActorType}, expected AI` 
      });
    }
    
    try {
      await sheetsService.updateRow(tableName, 'DraftID', id, {
        Status: 'Rejected',
        ReviewedBy: reviewerName || 'Admin',
        ReviewedAt: new Date().toISOString(),
        Notes: reason || 'Rejected by admin'
      }, { disableLog: true });
      
      await sheetsService.logToSheet('INFO', 'AI-Guardrails', `Rejected draft ${id} from ${tableName}: ${reason || 'No reason provided'}`);
      
      res.json({ success: true, message: 'Draft rejected' });
    } catch (updateError: any) {
      console.error('[Admin] Failed to update rejection status:', updateError);
      await sheetsService.logToSheet('ERROR', 'AI-Guardrails', `Failed to reject draft ${id}: ${updateError.message}`);
      throw updateError;
    }
  } catch (error: any) {
    console.error('[Admin] Reject draft failed:', error);
    res.status(500).json({ error: 'Failed to reject draft', details: error.message });
  }
});

export default router;
