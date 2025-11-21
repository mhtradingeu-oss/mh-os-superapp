import { google } from 'googleapis';
import pLimit from 'p-limit';
import { retryWithBackoff } from './retry';
import { sheetsReadCache, createCacheKey } from './cache';
import type { 
  Setting, PricingParam, FinalPriceList, CompetitorPrice, PartnerTier,
  PartnerRegistry, StandSite, StandInventory, StandRefillPlan, StandVisit,
  StandKPI, Quote, QuoteLine, Order, OrderLine, CommissionLedger,
  LoyaltyLedger, DHLRate, DHLTariff, ShipmentDHL, MAPGuardrail,
  PricingSuggestion, OSLog, OSHealth, AIInbox, AIOutbox, Enum,
  Bundle, GiftBank, SalonSubscription,
  AffiliateProgram, CommissionRule, EmailOutbox, AuditTrail,
  ShippingMethod, ShippingRule, PackagingBox, ShipmentLabel, Shipment,
  ShippingWeightBands, ShippingCostsFixed,
  CRMLead, LeadTouch, Territory, AssignmentRule, EnrichmentQueue
} from '@shared/schema';

const sheetsLimit = pLimit(5);

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await retryWithBackoff(() =>
    fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0])
  );

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

export async function getUncachableGoogleSheetClient() {
  const accessToken = await getAccessToken();
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.sheets({ version: 'v4', auth: oauth2Client });
}

// Single source of truth: SHEETS_SPREADSHEET_ID only.
// Sanitize the spreadsheet ID by removing any URL suffix like /edit?gid=0#gid=0
const rawSpreadsheetId = process.env.SHEETS_SPREADSHEET_ID || '';
export const SPREADSHEET_ID = rawSpreadsheetId.replace(/\/edit.*$/,'').trim();

/**
 * Validates that we're connected to a Google Sheet
 * @throws Error if SHEETS_SPREADSHEET_ID is not set
 */
export function validateSheetConnection(): void {
  if (!SPREADSHEET_ID) {
    throw new Error('SHEETS_SPREADSHEET_ID environment variable is not set');
  }
}

// Sensitive keys that must NEVER be written to Settings sheet
const SECRET_KEYS = [
  'API_PLACES_KEY',
  'API_WOO_KEY',
  'API_WOO_SECRET',
  'API_WOO_BASE',
  'API_ODOO_BASE',
  'API_ODOO_DB',
  'API_ODOO_USER',
  'API_ODOO_PASS',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'AI_INTEGRATIONS_OPENAI_API_KEY',
  'AI_INTEGRATIONS_OPENAI_BASE_URL',
  'SESSION_SECRET',
] as const;

// The ONLY allowed value for secret keys in Settings sheet
const SECRET_PLACEHOLDER = '[CONFIGURED VIA REPLIT SECRETS]';

/**
 * Validates that no secret keys are being written to Settings sheet
 * @throws Error if attempting to write protected secrets
 */
function validateNoSecretsInWrite(sheetName: string, data: Record<string, any>[]): void {
  if (sheetName !== 'Settings') return;
  
  for (const row of data) {
    if (row.Key && SECRET_KEYS.includes(row.Key as any)) {
      const value = (row.Value || '').toString().trim();
      // Only allow exact match with placeholder (prevents appending/prepending secrets)
      if (value !== SECRET_PLACEHOLDER && value !== '') {
        throw new Error(
          `SECURITY VIOLATION: Cannot write secret key "${row.Key}" to Settings sheet. ` +
          `This credential must be configured via Replit Secrets environment variables only. ` +
          `Only the placeholder "${SECRET_PLACEHOLDER}" is allowed.`
        );
      }
    }
  }
}

/**
 * Validates that no secret keys are being updated in Settings sheet
 * @throws Error if attempting to update protected secrets
 */
function validateNoSecretsInUpdate(sheetName: string, matchColumn: string, matchValue: string, updates: Record<string, any>): void {
  if (sheetName !== 'Settings') return;
  
  // Case 1: Attempting to change an existing row's Key to a protected secret
  if (updates.Key && SECRET_KEYS.includes(updates.Key as any)) {
    // CRITICAL: When renaming a row's Key to a secret, we MUST require the caller
    // to explicitly provide the exact placeholder Value to prevent two-step attacks:
    // Step 1: Set Value to secret on non-secret row
    // Step 2: Rename Key to secret without providing Value (bypassing validation)
    if (updates.Value === undefined) {
      throw new Error(
        `SECURITY VIOLATION: When setting Key to protected secret "${updates.Key}", ` +
        `you must explicitly provide Value="${SECRET_PLACEHOLDER}". ` +
        `This prevents two-step secret injection attacks.`
      );
    }
    
    const value = updates.Value.toString().trim();
    // Only allow exact match with placeholder (prevents appending/prepending secrets)
    if (value !== SECRET_PLACEHOLDER) {
      throw new Error(
        `SECURITY VIOLATION: Cannot set protected secret key "${updates.Key}" in Settings sheet. ` +
        `This credential must be configured via Replit Secrets environment variables only. ` +
        `The Value must be exactly "${SECRET_PLACEHOLDER}".`
      );
    }
  }
  
  // Case 2: Attempting to update the Value of an existing secret row
  if (matchColumn === 'Key' && SECRET_KEYS.includes(matchValue as any)) {
    if (updates.Value !== undefined) {
      const value = (updates.Value || '').toString().trim();
      // Only allow exact match with placeholder (prevents appending/prepending secrets)
      if (value !== SECRET_PLACEHOLDER && value !== '') {
        throw new Error(
          `SECURITY VIOLATION: Cannot update secret key "${matchValue}" in Settings sheet. ` +
          `This credential must be configured via Replit Secrets environment variables only. ` +
          `Only the placeholder "${SECRET_PLACEHOLDER}" is allowed.`
        );
      }
    }
  }
}

// Type alias for sheet cell values
export type SheetCell = string | number | boolean | null;

export class GoogleSheetsService {
  private sheetIdCache: Map<string, number> = new Map();

  private async getClient() {
    return getUncachableGoogleSheetClient();
  }

  getSpreadsheetId(): string {
    return SPREADSHEET_ID;
  }

  /**
   * Get the sheetId (gid) for a given sheet name
   * Uses cached value if available, otherwise fetches from Google Sheets API
   */
  async getSheetId(sheetName: string): Promise<number> {
    // Check cache first
    if (this.sheetIdCache.has(sheetName)) {
      return this.sheetIdCache.get(sheetName)!;
    }

    try {
      const sheets = await this.getClient();
      const metadata = await retryWithBackoff(() =>
        sheets.spreadsheets.get({
          spreadsheetId: SPREADSHEET_ID,
        })
      );

      const sheet = metadata.data.sheets?.find(
        s => s.properties?.title === sheetName
      );

      if (!sheet || sheet.properties?.sheetId === undefined || sheet.properties?.sheetId === null) {
        throw new Error(`Sheet "${sheetName}" not found in spreadsheet. Available sheets: ${metadata.data.sheets?.map(s => s.properties?.title).join(', ')}`);
      }

      const sheetId = sheet.properties.sheetId as number;
      
      // Cache the result
      this.sheetIdCache.set(sheetName, sheetId);
      
      return sheetId;
    } catch (error: any) {
      console.error(`Failed to get sheetId for ${sheetName}:`, error.message);
      throw new Error(`Unable to resolve sheetId for "${sheetName}": ${error.message}`);
    }
  }

  /**
   * Clear the sheetId cache
   * Should be called when sheets are added/removed or cache needs invalidation
   */
  clearSheetIdCache(): void {
    this.sheetIdCache.clear();
  }

  /**
   * Read sheet data in raw format (headers + rows as arrays)
   * Used for bulk operations that need to preserve column order
   */
  async readSheetRaw(sheetName: string): Promise<{ headers: string[]; rows: string[][] }> {
    try {
      const client = await this.getClient();
      const response = await retryWithBackoff(() =>
        client.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:ZZ`,
        })
      );

      const values = response.data.values || [];
      if (values.length === 0) {
        return { headers: [], rows: [] };
      }

      const headers = values[0] as string[];
      const rows = values.slice(1).map(row => 
        Array(headers.length).fill('').map((_, i) => (row[i] || '').toString())
      );

      return { headers, rows };
    } catch (error: any) {
      console.error(`readSheetRaw error for ${sheetName}:`, error);
      throw new Error(`Failed to read raw sheet data from ${sheetName}: ${error.message}`);
    }
  }

  /**
   * Overwrite multiple rows starting at a specific row number
   * Used for bulk updates that preserve column order
   * @param sheetName - Name of the sheet to update
   * @param startRow - 1-indexed row number to start writing (usually 2 for data rows after header)
   * @param rows - Array of rows, each row is an array of cell values
   */
  async overwriteRows(sheetName: string, startRow: number, rows: SheetCell[][]): Promise<void> {
    // Security guard: prevent overwriting Settings sheet
    if (sheetName === 'Settings') {
      throw new Error('Cannot use overwriteRows on Settings sheet for security reasons');
    }

    try {
      const client = await this.getClient();
      
      // Calculate the range to update
      const endRow = startRow + rows.length - 1;
      const range = `${sheetName}!A${startRow}:ZZ${endRow}`;

      await retryWithBackoff(() =>
        client.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range,
          valueInputOption: 'RAW',
          requestBody: { values: rows },
        })
      );

      // Invalidate cache for this sheet
      sheetsReadCache.invalidateByPattern(sheetName);

      // Log the operation
      await this.logToSheet(
        'INFO',
        'BulkUpdate',
        `Overwrote ${rows.length} rows in ${sheetName}`,
        `Range: ${range}`
      );
    } catch (error: any) {
      console.error(`overwriteRows error for ${sheetName}:`, error);
      throw new Error(`Failed to overwrite rows in ${sheetName}: ${error.message}`);
    }
  }

  async logToSheet(level: string, scope: string, message: string, ref?: string) {
    try {
      const sheets = await this.getClient();
      const timestamp = new Date().toISOString();
      await retryWithBackoff(() =>
        sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'OS_Logs!A:E',
          valueInputOption: 'RAW',
          requestBody: {
            values: [[timestamp, level, scope, message, ref || '']],
          },
        })
      );
    } catch (error) {
      console.error('Failed to log to sheet:', error);
    }
  }

  async readSheet<T>(sheetName: string, useCache: boolean = true): Promise<T[]> {
    // DISABLE CACHE for Affiliate sheets (they change frequently and cache causes stale reads)
    const { AFFILIATE_SHEETS } = await import('./affiliate-constants.js');
    
    // Force no-cache for affiliate sheets
    if (AFFILIATE_SHEETS.includes(sheetName as any)) {
      useCache = false;
    }
    
    const cacheKey = createCacheKey('sheets', 'read', SPREADSHEET_ID, sheetName);
    
    if (!useCache) {
      return sheetsLimit(async () => {
        try {
          const sheets = await this.getClient();
          const response = await retryWithBackoff(() =>
            sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${sheetName}!A:ZZ`,
            })
          );

          const rows = response.data.values;
          if (!rows || rows.length < 2) {
            return [];
          }

          const headers = rows[0];
          const data = rows.slice(1).map(row => {
            const obj: any = {};
            headers.forEach((header, index) => {
              const value = row[index];
              if (value === undefined || value === '') return;
              if (typeof value === 'string' && value.startsWith('#')) return;
              
              if (value === 'TRUE' || value === 'FALSE') {
                obj[header] = value === 'TRUE';
                return;
              }
              
              const cleanedValue = String(value).replace(/[€$£¥,\s]/g, '').trim();
              const parsedNumber = Number(cleanedValue);
              
              if (!isNaN(parsedNumber) && cleanedValue !== '') {
                obj[header] = parsedNumber;
              } else {
                obj[header] = value;
              }
            });
            return obj as T;
          });

          return data;
        } catch (error: any) {
          console.error(`Error reading sheet ${sheetName}:`, error);
          if (error?.message?.includes('Unable to parse range')) {
            await this.logToSheet('WARN', 'GoogleSheets', `Sheet "${sheetName}" not found or has no data`);
            return [];
          }
          throw error;
        }
      });
    }

    return sheetsReadCache.getOrSet(cacheKey, () =>
      sheetsLimit(async () => {
        try {
          const sheets = await this.getClient();
          const response = await retryWithBackoff(() =>
            sheets.spreadsheets.values.get({
              spreadsheetId: SPREADSHEET_ID,
              range: `${sheetName}!A:ZZ`,
            })
          );

          const rows = response.data.values;
          if (!rows || rows.length < 2) {
            return [];
          }

          const headers = rows[0];
          const data = rows.slice(1).map(row => {
            const obj: any = {};
            headers.forEach((header, index) => {
              const value = row[index];
              if (value === undefined || value === '') return;
              if (typeof value === 'string' && value.startsWith('#')) return;
              
              if (value === 'TRUE' || value === 'FALSE') {
                obj[header] = value === 'TRUE';
                return;
              }
              
              const cleanedValue = String(value).replace(/[€$£¥,\s]/g, '').trim();
              const parsedNumber = Number(cleanedValue);
              
              if (!isNaN(parsedNumber) && cleanedValue !== '') {
                obj[header] = parsedNumber;
              } else {
                obj[header] = value;
              }
            });
            return obj as T;
          });

          return data;
        } catch (error: any) {
          console.error(`Error reading sheet ${sheetName}:`, error);
          if (error?.message?.includes('Unable to parse range')) {
            await this.logToSheet('WARN', 'GoogleSheets', `Sheet "${sheetName}" not found or has no data`);
            return [];
          }
          throw error;
        }
      })
    );
  }

  async writeRows<T extends Record<string, any>>(sheetName: string, rows: T[]) {
    return sheetsLimit(async () => {
      try {
        if (rows.length === 0) return;

        // Security: Block writes of secret keys to Settings sheet
        validateNoSecretsInWrite(sheetName, rows);

        const sheets = await this.getClient();
        
        const headerResponse = await retryWithBackoff(() =>
          sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!1:1`,
          })
        );

        // Merge existing headers with new data keys to ensure all fields are written
        const sheetHeaders = headerResponse.data.values?.[0] || [];
        const dataKeys = Object.keys(rows[0]);
        const headers = [...new Set([...sheetHeaders, ...dataKeys])]; // Deduplicated union
        
        // Update sheet headers if new columns were added
        if (headers.length > sheetHeaders.length) {
          await retryWithBackoff(() =>
            sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `${sheetName}!1:1`,
              valueInputOption: 'RAW',
              requestBody: { values: [headers] }
            })
          );
        }

        const values = rows.map(row => 
          headers.map(header => {
            const value = row[header];
            if (value === undefined || value === null) return '';
            if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
            return String(value);
          })
        );

        await retryWithBackoff(() =>
          sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:ZZ`,
            valueInputOption: 'RAW',
            requestBody: { values },
          })
        );

        sheetsReadCache.invalidateByPattern(sheetName);

        await this.logToSheet('INFO', sheetName, `Wrote ${rows.length} rows`);
      } catch (error: any) {
        console.error(`Error writing to sheet ${sheetName}:`, error);
        await this.logToSheet('ERROR', sheetName, `Failed to write rows: ${error.message}`);
        throw error;
      }
    });
  }

  async updateRow<T extends Record<string, any>>(
    sheetName: string, 
    matchColumn: string, 
    matchValue: string, 
    updates: Partial<T>,
    options?: { disableLog?: boolean }
  ) {
    try {
      // PartnerTiers: Reverse field mapping (modern schema → legacy Google Sheets columns)
      let actualMatchColumn = matchColumn;
      let actualUpdates = updates;
      
      if (sheetName === 'PartnerTiers') {
        // Map matchColumn: TierKey → Tier
        if (matchColumn === 'TierKey') {
          actualMatchColumn = 'Tier';
        }
        
        // Map update fields: modern → legacy
        const fieldMapping: Record<string, string> = {
          'DiscountFromUVP_Pct': 'DiscountPct',
          'CommissionRate_Pct': 'CommissionRate_Pct', // Update column G (current commission)
          'MinOrderValue_EUR': 'MinOrderVolume',
          'PaymentTermsDays': 'Payment Terms (Days)'
        };
        
        // Filter out read-only fields:
        // - TierKey, TierName: Cannot be changed (would break references)
        // - Status: Auto-calculated
        // - Benefits: Legacy field
        const filteredUpdates = Object.fromEntries(
          Object.entries(updates).filter(([key]) => 
            !['TierKey', 'TierName', 'Status', 'Benefits'].includes(key)
          )
        );
        
        actualUpdates = Object.fromEntries(
          Object.entries(filteredUpdates).map(([key, value]) => [
            fieldMapping[key] || key,
            value
          ])
        ) as Partial<T>;
      }
      
      // Security: Block updates of secret keys in Settings sheet
      validateNoSecretsInUpdate(sheetName, actualMatchColumn, matchValue, actualUpdates);

      const sheets = await this.getClient();
      const allData = await retryWithBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:ZZ`,
        })
      );

      const rows = allData.data.values;
      if (!rows || rows.length < 2) {
        throw new Error(`Sheet ${sheetName} has no data`);
      }

      const headers = rows[0];
      const matchIndex = headers.indexOf(actualMatchColumn);
      
      if (matchIndex === -1) {
        throw new Error(`Column ${actualMatchColumn} not found in ${sheetName}`);
      }

      // Find the row index
      const rowIndex = rows.findIndex((row, idx) => idx > 0 && row[matchIndex] === matchValue);
      
      if (rowIndex === -1) {
        throw new Error(`No row found with ${actualMatchColumn}=${matchValue}`);
      }

      // Update only specified columns with retry
      for (const [key, value] of Object.entries(actualUpdates)) {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          const cellAddress = this.columnToLetter(colIndex) + (rowIndex + 1);
          await retryWithBackoff(() =>
            sheets.spreadsheets.values.update({
              spreadsheetId: SPREADSHEET_ID,
              range: `${sheetName}!${cellAddress}`,
              valueInputOption: 'RAW',
              requestBody: {
                values: [[value === null || value === undefined ? '' : String(value)]],
              },
            })
          );
        }
      }

      // CRITICAL: Invalidate cache after update so queries return fresh data
      sheetsReadCache.invalidateByPattern(sheetName);

      // Log only if not disabled (for quota-sensitive batch operations)
      if (!options?.disableLog) {
        await this.logToSheet('INFO', sheetName, `Updated row where ${matchColumn}=${matchValue}`);
      }
    } catch (error: any) {
      console.error(`Error updating row in ${sheetName}:`, error);
      // Always log errors regardless of disableLog setting
      await this.logToSheet('ERROR', sheetName, `Failed to update row: ${error.message}`);
      throw error;
    }
  }

  /**
   * Batch update multiple rows efficiently using values.batchUpdate API
   * Reduces API calls from N updates + N logs to just 1 update + 1 log
   */
  async batchUpdateRows<T = any>(
    sheetName: string,
    matchColumn: string,
    updates: Array<{ matchValue: string; data: Partial<T> }>
  ): Promise<number> {
    try {
      if (updates.length === 0) {
        return 0;
      }

      const sheets = await this.getClient();
      
      // Read all data once
      const allData = await retryWithBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:ZZ`,
        })
      );

      const rows = allData.data.values;
      if (!rows || rows.length < 2) {
        throw new Error(`Sheet ${sheetName} has no data`);
      }

      const headers = rows[0];
      const matchIndex = headers.indexOf(matchColumn);
      
      if (matchIndex === -1) {
        throw new Error(`Column ${matchColumn} not found in ${sheetName}`);
      }

      // Build batch update data
      const batchData: any[] = [];
      let updatedCount = 0;

      for (const update of updates) {
        const rowIndex = rows.findIndex((row, idx) => idx > 0 && row[matchIndex] === update.matchValue);
        
        if (rowIndex === -1) {
          console.warn(`[batchUpdateRows] Row not found: ${matchColumn}=${update.matchValue}`);
          continue;
        }

        // Update each field in this row
        for (const [key, value] of Object.entries(update.data)) {
          const colIndex = headers.indexOf(key);
          if (colIndex !== -1) {
            const cellAddress = this.columnToLetter(colIndex) + (rowIndex + 1);
            batchData.push({
              range: `${sheetName}!${cellAddress}`,
              values: [[value === null || value === undefined ? '' : String(value)]],
            });
          } else {
            console.warn(`[batchUpdateRows] Column '${key}' not found in sheet ${sheetName}`);
          }
        }
        updatedCount++;
      }

      if (batchData.length === 0) {
        console.warn('[batchUpdateRows] No valid updates to apply');
        return 0;
      }

      // Execute single batch update (1 API call instead of N)
      await retryWithBackoff(() =>
        sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            valueInputOption: 'RAW',
            data: batchData,
          },
        })
      );

      // Invalidate cache once
      sheetsReadCache.invalidateByPattern(sheetName);

      // Log once (1 API call instead of N)
      await this.logToSheet('INFO', sheetName, `Batch updated ${updatedCount} rows`);

      return updatedCount;
    } catch (error: any) {
      console.error(`Error in batch update for ${sheetName}:`, error);
      await this.logToSheet('ERROR', sheetName, `Batch update failed: ${error.message}`);
      throw error;
    }
  }

  async deleteRow(
    sheetName: string,
    matchColumn: string,
    matchValue: string
  ): Promise<void> {
    try {
      const sheets = await this.getClient();
      const allData = await retryWithBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!A:ZZ`,
        })
      );

      const rows = allData.data.values;
      if (!rows || rows.length < 2) {
        throw new Error(`Sheet ${sheetName} has no data`);
      }

      const headers = rows[0];
      const matchIndex = headers.indexOf(matchColumn);
      
      if (matchIndex === -1) {
        throw new Error(`Column ${matchColumn} not found in ${sheetName}`);
      }

      // Find the row index (1-based for sheets, accounting for header)
      const dataRowIndex = rows.findIndex((row, idx) => idx > 0 && row[matchIndex] === matchValue);
      
      if (dataRowIndex === -1) {
        throw new Error(`No row found with ${matchColumn}=${matchValue}`);
      }

      // Get the actual sheetId for this sheet
      const sheetId = await this.getSheetId(sheetName);
      
      console.log(`[deleteRow] Deleting row from ${sheetName} (sheetId: ${sheetId}), index ${dataRowIndex}, ${matchColumn}=${matchValue}`);

      // Delete the row using batchUpdate
      await retryWithBackoff(() =>
        sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          requestBody: {
            requests: [{
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: 'ROWS',
                  startIndex: dataRowIndex,
                  endIndex: dataRowIndex + 1,
                }
              }
            }]
          }
        })
      );

      sheetsReadCache.invalidateByPattern(sheetName);
      await this.logToSheet('INFO', sheetName, `Deleted row where ${matchColumn}=${matchValue}`);
    } catch (error: any) {
      console.error(`Error deleting row in ${sheetName}:`, error);
      await this.logToSheet('ERROR', sheetName, `Failed to delete row: ${error.message}`);
      throw error;
    }
  }

  private columnToLetter(column: number): string {
    let temp: number;
    let letter = '';
    while (column >= 0) {
      temp = column % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      column = Math.floor(column / 26) - 1;
    }
    return letter;
  }

  async validateSheetStructure(sheetName: string, requiredColumns: string[]): Promise<{ valid: boolean; missing: string[] }> {
    try {
      const sheets = await this.getClient();
      const response = await retryWithBackoff(() =>
        sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: `${sheetName}!1:1`,
        })
      );

      const headers = response.data.values?.[0] || [];
      const missing = requiredColumns.filter(col => !headers.includes(col));
      
      if (missing.length > 0) {
        await this.logToSheet('WARN', sheetName, `Missing columns: ${missing.join(', ')}`);
      }

      return { valid: missing.length === 0, missing };
    } catch (error: any) {
      await this.logToSheet('ERROR', sheetName, `Failed to validate structure: ${error.message}`);
      return { valid: false, missing: requiredColumns };
    }
  }

  // Typed readers for each sheet
  async getSettings(): Promise<Setting[]> {
    return this.readSheet<Setting>('Settings');
  }

  async getPricingParams(): Promise<PricingParam[]> {
    return this.readSheet<PricingParam>('Pricing_Params');
  }

  async getFinalPriceList(): Promise<FinalPriceList[]> {
    return this.readSheet<FinalPriceList>('FinalPriceList');
  }

  async getCompetitorPrices(): Promise<CompetitorPrice[]> {
    return this.readSheet<CompetitorPrice>('CompetitorPrices');
  }

  async getPartnerTiers(): Promise<PartnerTier[]> {
    const rawRows = await this.readSheet<any>('PartnerTiers');
    
    // DEBUG: Log first row to see actual column names and values
    if (rawRows.length > 0) {
      console.log('[DEBUG] PartnerTiers raw row 0:', JSON.stringify(rawRows[0], null, 2));
      console.log('[DEBUG] PartnerTiers column names:', Object.keys(rawRows[0]));
      console.log('[DEBUG] PartnerTiers total rows:', rawRows.length);
    }
    
    const parseNumeric = (value: any): number | undefined => {
      if (value === null || value === undefined || value === '') return undefined;
      if (typeof value === 'number') return value;
      
      // Normalize European decimal format: "12,5" → "12.5" (only if comma is followed by digits)
      let cleaned = String(value).replace(/,(\d+)/g, '.$1');
      // Remove currency symbols, percent signs, and whitespace
      cleaned = cleaned.replace(/[%€$\s]/g, '');
      
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? undefined : parsed;
    };
    
    return rawRows.map((row: any) => {
      // Extract TierKey from TierName safely
      // e.g., "Stand Partner" → "Stand", "Basic Dealer" → "Basic"
      const tierName = row.Tier || row.TierName || '';
      const tierKey = tierName.trim().split(/\s+/)[0] || tierName; // First word or full if no space
      
      return {
        TierKey: tierKey,
        TierName: tierName,
        DiscountFromUVP_Pct: parseNumeric(row.DiscountPct ?? row.DiscountFromUVP_Pct) ?? 0,
        // Use CommissionRate_Pct (column G) as primary, fallback to CommissionPct for backward compatibility
        CommissionRate_Pct: parseNumeric(row.CommissionRate_Pct) ?? parseNumeric(row.CommissionPct) ?? 0,
        MinOrderQty: row.MinOrderQty,
        MinOrderValue_EUR: parseNumeric(row.MinOrderVolume ?? row.MinOrderValue_EUR),
        PaymentTermsDays: parseNumeric(row['Payment Terms (Days)'] ?? row.PaymentTermsDays),
        Benefits: parseNumeric(row.Benefits),
        Status: row.Status,
        Notes: row.Notes
      };
    });
  }

  async getPartnerRegistry(): Promise<PartnerRegistry[]> {
    return this.readSheet<PartnerRegistry>('PartnerRegistry');
  }

  async getStandSites(): Promise<StandSite[]> {
    return this.readSheet<StandSite>('StandSites');
  }

  async getStandInventory(): Promise<StandInventory[]> {
    return this.readSheet<StandInventory>('Stand_Inventory');
  }

  async getStandRefillPlans(): Promise<StandRefillPlan[]> {
    return this.readSheet<StandRefillPlan>('Stand_Refill_Plans');
  }

  async getStandVisits(): Promise<StandVisit[]> {
    return this.readSheet<StandVisit>('Stand_Visits');
  }

  async getStandKPIs(): Promise<StandKPI[]> {
    return this.readSheet<StandKPI>('Stand_KPIs');
  }

  async getQuotes(): Promise<Quote[]> {
    return this.readSheet<Quote>('Quotes');
  }

  async getQuoteLines(): Promise<QuoteLine[]> {
    return this.readSheet<QuoteLine>('QuoteLines');
  }

  async getOrders(): Promise<Order[]> {
    return this.readSheet<Order>('Orders');
  }

  private counterLocks = new Map<string, Promise<void>>();

  async incrementCounter(key: string, options: { start?: number; max?: number } = {}): Promise<{ previous: number; next: number }> {
    const { start = 1000, max = 999999 } = options;
    
    const acquireLock = async () => {
      while (this.counterLocks.has(key)) {
        await this.counterLocks.get(key);
      }
      let releaseLock: () => void;
      const lockPromise = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      this.counterLocks.set(key, lockPromise);
      return () => {
        this.counterLocks.delete(key);
        releaseLock!();
      };
    };

    const release = await acquireLock();
    
    try {
      const MAX_RETRIES = 5;
      let attempt = 0;
      
      while (attempt < MAX_RETRIES) {
        try {
          sheetsReadCache.invalidateByPattern('Settings');
          const settings = await this.getSettings();
          const counterSetting = settings.find(s => s.Key === key);
          
          const currentValue = counterSetting 
            ? parseInt(counterSetting.Value || String(start))
            : start - 1;
          
          if (isNaN(currentValue) || currentValue < 0) {
            throw new Error(`Invalid counter value for ${key}: ${counterSetting?.Value}`);
          }
          
          const nextValue = currentValue + 1;
          
          if (nextValue > max) {
            throw new Error(`Counter ${key} exceeded maximum value ${max}`);
          }
          
          if (counterSetting) {
            const expectedValue = String(currentValue);
            const settingsAfterUpdate = await this.getSettings();
            const refreshedSetting = settingsAfterUpdate.find(s => s.Key === key);
            
            if (refreshedSetting && refreshedSetting.Value !== expectedValue) {
              throw new Error(`Counter ${key} was modified externally, retrying...`);
            }
            
            await this.updateRow('Settings', 'Key', key, { Value: String(nextValue), LastModified: new Date().toISOString() }, { disableLog: true });
          } else {
            await this.writeRows('Settings', [{
              Key: key,
              Value: String(nextValue),
              Description: `Auto-incremented counter`,
              Category: 'System',
              LastModified: new Date().toISOString()
            }]);
          }
          
          sheetsReadCache.invalidateByPattern('Settings');
          
          const verify = await this.getSettings();
          const verifiedSetting = verify.find(s => s.Key === key);
          const verifiedValue = parseInt(verifiedSetting?.Value || '0');
          
          if (verifiedValue !== nextValue) {
            throw new Error(`Counter verification failed: expected ${nextValue}, got ${verifiedValue}`);
          }
          
          return { previous: currentValue, next: nextValue };
        } catch (error: any) {
          attempt++;
          if (attempt >= MAX_RETRIES) {
            throw new Error(`Failed to increment counter ${key} after ${MAX_RETRIES} attempts: ${error.message}`);
          }
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        }
      }
      
      throw new Error(`Unreachable: incrementCounter exceeded retry loop`);
    } finally {
      release();
    }
  }

  async getOrderLines(): Promise<OrderLine[]> {
    return this.readSheet<OrderLine>('OrderLines');
  }

  async getCommissionLedger(): Promise<CommissionLedger[]> {
    return this.readSheet<CommissionLedger>('Commission_Ledger');
  }

  async getLoyaltyLedger(): Promise<LoyaltyLedger[]> {
    return this.readSheet<LoyaltyLedger>('Loyalty_Ledger');
  }

  async getDHLRates(): Promise<DHLRate[]> {
    return this.readSheet<DHLRate>('DHL_Rates');
  }

  async getDHLTariffs(): Promise<DHLTariff[]> {
    return this.readSheet<DHLTariff>('DHL_Tariffs');
  }

  async getShipmentsDHL(): Promise<ShipmentDHL[]> {
    return this.readSheet<ShipmentDHL>('Shipments_DHL');
  }

  async getMAPGuardrails(): Promise<MAPGuardrail[]> {
    return this.readSheet<MAPGuardrail>('MAP_Guardrails');
  }

  async getPricingSuggestions(): Promise<PricingSuggestion[]> {
    return this.readSheet<PricingSuggestion>('Pricing_Suggestions');
  }

  async getOSLogs(): Promise<OSLog[]> {
    return this.readSheet<OSLog>('OS_Logs');
  }

  async getOSHealth(): Promise<OSHealth[]> {
    return this.readSheet<OSHealth>('OS_Health');
  }

  /**
   * Write a health check entry to OS_Health sheet
   */
  async writeOSHealth(
    component: string,
    status: 'PASS' | 'WARN' | 'FAIL',
    message: string,
    details?: Record<string, any>
  ): Promise<void> {
    try {
      const checkTS = new Date().toISOString();
      const detailsJSON = details ? JSON.stringify(details) : '';

      const sheets = await this.getClient();
      await retryWithBackoff(async () => {
        return await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: 'OS_Health!A:E',
          valueInputOption: 'RAW',
          requestBody: {
            values: [[checkTS, component, status, message, detailsJSON]]
          }
        });
      });
      
      sheetsReadCache.invalidateByPattern('OS_Health');
    } catch (error) {
      console.error('Failed to write to OS_Health:', error);
    }
  }

  async getAuthorizedAssortment(): Promise<any[]> {
    return this.readSheet<any>('AuthorizedAssortment');
  }

  async getStarterBundles(): Promise<any[]> {
    return this.readSheet<any>('StarterBundles');
  }

  async getRefillPlans(): Promise<any[]> {
    return this.readSheet<any>('RefillPlans');
  }

  async getAIInbox(): Promise<AIInbox[]> {
    return this.readSheet<AIInbox>('AI_Inbox');
  }

  async getAIOutbox(): Promise<AIOutbox[]> {
    return this.readSheet<AIOutbox>('AI_Outbox');
  }

  async getEnums(): Promise<Enum[]> {
    return this.readSheet<Enum>('Enums');
  }

  async getBundles(): Promise<Bundle[]> {
    return this.readSheet<Bundle>('Bundles');
  }

  async getGiftsBank(): Promise<GiftBank[]> {
    return this.readSheet<GiftBank>('Gifts_Bank');
  }

  async getSalonSubscriptions(): Promise<SalonSubscription[]> {
    return this.readSheet<SalonSubscription>('Salon_Subscriptions');
  }

  // REMOVED: getSubscriptionInvoices() - Not affiliate-related
  // REMOVED: getAffiliateLeads() - Legacy, replaced by AffiliateCandidates

  async getAffiliatePrograms(): Promise<AffiliateProgram[]> {
    return this.readSheet<AffiliateProgram>('Affiliate_Programs');
  }

  async getCommissionRules(): Promise<CommissionRule[]> {
    return this.readSheet<CommissionRule>('Commission_Rules');
  }

  async getEmailOutbox(): Promise<EmailOutbox[]> {
    return this.readSheet<EmailOutbox>('Email_Queue');
  }

  async getAuditTrail(): Promise<AuditTrail[]> {
    return this.readSheet<AuditTrail>('Audit_Trail');
  }

  // New shipping-related getters
  async getShippingMethods(): Promise<ShippingMethod[]> {
    return this.readSheet<ShippingMethod>('Shipping_Methods');
  }

  async getShippingRules(): Promise<ShippingRule[]> {
    return this.readSheet<ShippingRule>('Shipping_Rules');
  }

  async getPackagingBoxes(): Promise<PackagingBox[]> {
    return this.readSheet<PackagingBox>('Packaging_Boxes');
  }

  async getShippingWeightBands(): Promise<ShippingWeightBands[]> {
    return this.readSheet<ShippingWeightBands>('ShippingWeightBands');
  }

  async getShippingCostsFixed(): Promise<ShippingCostsFixed[]> {
    return this.readSheet<ShippingCostsFixed>('ShippingCostsFixed');
  }

  async getShipmentLabels(): Promise<ShipmentLabel[]> {
    return this.readSheet<ShipmentLabel>('Shipment_Labels');
  }

  async getShipments(): Promise<Shipment[]> {
    return this.readSheet<Shipment>('Shipments');
  }

  // CRM Module
  async getCRMLeads(): Promise<CRMLead[]> {
    return this.readSheet<CRMLead>('CRM_Leads');
  }

  async getLeadTouches(): Promise<LeadTouch[]> {
    return this.readSheet<LeadTouch>('Lead_Touches');
  }

  async getTerritories(): Promise<Territory[]> {
    return this.readSheet<Territory>('Territories');
  }

  async getAssignmentRules(): Promise<AssignmentRule[]> {
    return this.readSheet<AssignmentRule>('Assignment_Rules');
  }

  async getEnrichmentQueue(): Promise<EnrichmentQueue[]> {
    return this.readSheet<EnrichmentQueue>('Enrichment_Queue');
  }

  /**
   * Update CRM Lead enrichment fields (safe derived fields only)
   */
  async updateLeadEnrichment(
    leadID: string,
    enrichmentData: {
      CategoryNorm?: string;
      SizeHint?: string;
      WorkingHours?: string;
      Notes?: string;
    }
  ): Promise<void> {
    await this.updateRow('CRM_Leads', 'LeadID', leadID, enrichmentData);
  }
}

export const sheetsService = new GoogleSheetsService();
