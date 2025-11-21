import { GoogleSheetsService } from './sheets';
import { aiAgentsLogSchema, type AIAgentsLog } from '@shared/schema';
import { nanoid } from 'nanoid';

interface AIOperationResult {
  success: boolean;
  rowsCreated: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEUR: number;
  error?: string;
}

export async function logAIOperation(
  sheetsService: GoogleSheetsService,
  agentID: 'A-SEO-110' | 'A-ADS-120' | 'A-SOC-010',
  requestType: 'brief' | 'audit' | 'keywords' | 'copy' | 'plan' | 'rewrite',
  inputSheets: string,
  outputSheets: string,
  result: AIOperationResult
): Promise<void> {
  const now = new Date().toISOString();
  const logEntry: Partial<AIAgentsLog> = {
    LogID: nanoid(),
    AgentID: agentID,
    RequestType: requestType,
    InputSheets: inputSheets,
    OutputSheets: outputSheets,
    Status: result.success ? 'completed' : 'failed',
    CreatedTS: now,
    CompletedTS: now,
    RowsCreated: result.rowsCreated,
    PromptTokens: result.promptTokens,
    CompletionTokens: result.completionTokens,
    TotalTokens: result.totalTokens,
    CostEUR: result.costEUR,
    Notes: result.error || '',
  };

  const validated = aiAgentsLogSchema.parse(logEntry);
  await sheetsService.writeRows('AI_Agents_Log', [validated]);
}

export interface CSVExportOptions {
  delimiter?: string;
  includeHeaders?: boolean;
  dateFormat?: 'iso' | 'short';
}

export function buildCSV(
  headers: string[],
  rows: any[][],
  options: CSVExportOptions = {}
): string {
  const delimiter = options.delimiter || ',';
  const includeHeaders = options.includeHeaders !== false;

  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [];
  
  if (includeHeaders) {
    lines.push(headers.map(escapeCSV).join(delimiter));
  }

  for (const row of rows) {
    lines.push(row.map(escapeCSV).join(delimiter));
  }

  return lines.join('\n');
}

export interface ICSEvent {
  uid: string;
  summary: string;
  description?: string;
  start: Date;
  end?: Date;
  location?: string;
  url?: string;
}

export function buildICS(events: ICSEvent[]): string {
  const formatDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MH Trading OS//Marketing Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const event of events) {
    const endDate = event.end || new Date(event.start.getTime() + 3600000); // +1 hour default
    
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}@mh-trading-os`);
    lines.push(`DTSTAMP:${formatDate(new Date())}`);
    lines.push(`DTSTART:${formatDate(event.start)}`);
    lines.push(`DTEND:${formatDate(endDate)}`);
    lines.push(`SUMMARY:${event.summary.replace(/\n/g, '\\n')}`);
    
    if (event.description) {
      lines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
    }
    
    if (event.location) {
      lines.push(`LOCATION:${event.location}`);
    }
    
    if (event.url) {
      lines.push(`URL:${event.url}`);
    }
    
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export interface BatchSheetUpdate {
  sheetName: string;
  rowIndex: number;
  updates: Record<string, any>;
}

export async function batchUpdateSheets(
  sheetsService: GoogleSheetsService,
  updates: BatchSheetUpdate[]
): Promise<void> {
  // Group updates by sheet for efficiency
  const groupedBySheet = updates.reduce((acc, update) => {
    if (!acc[update.sheetName]) acc[update.sheetName] = [];
    acc[update.sheetName].push(update);
    return acc;
  }, {} as Record<string, BatchSheetUpdate[]>);

  // Apply updates per sheet
  // Note: updateRow requires (sheetName, matchColumn, matchValue, updates)
  // We'll need to read sheet first to find the right row
  for (const [sheetName, sheetUpdates] of Object.entries(groupedBySheet)) {
    const sheetData = await sheetsService.readSheet(sheetName);
    for (const update of sheetUpdates) {
      const row = sheetData[update.rowIndex];
      if (row && (row as any).ID) {
        await sheetsService.updateRow(sheetName, 'ID', (row as any).ID, update.updates);
      }
    }
  }
}

export function calculateGoogleAdsCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCostPerM = 1.08;
  const outputCostPerM = 8.65;
  const inputCostEUR = (inputTokens / 1_000_000) * inputCostPerM;
  const outputCostEUR = (outputTokens / 1_000_000) * outputCostPerM;
  return inputCostEUR + outputCostEUR;
}
