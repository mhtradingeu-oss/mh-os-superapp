/**
 * AI Write Protection System
 * 
 * Purpose: Table-level access control to prevent AI from directly modifying production data.
 * All AI writes are routed through draft tables for human review and approval.
 * 
 * Architecture:
 * - AI → Production Tables ❌ → Redirected to Draft Tables ✅
 * - Manual/System → All Tables ✅ (Direct access allowed)
 * 
 * This module works alongside ai-guardrails.ts:
 * - ai-guardrails.ts: Content validation (MAP compliance, margins, GDPR, brand voice)
 * - ai-write-protection.ts: Table-level access control (who can write where)
 */

export type ActorType = 'AI' | 'Manual' | 'System' | 'Migration';

/**
 * Write context that must accompany every sheet write operation
 */
export interface WriteContext {
  actorType: ActorType;
  sourceId: string; // AI agent ID, user ID, or system component name
  requestId: string; // UUID to trace write provenance and prevent spoofing
}

/**
 * Configuration for table-level write protection
 */
export interface TableProtectionConfig {
  table: string;
  draftTable: string | null; // null = no draft table (AI writes blocked completely)
  allowedActors: ActorType[];
  requiresApproval: boolean;
}

/**
 * Production tables protected from direct AI writes
 */
export const PROTECTED_TABLES: TableProtectionConfig[] = [
  {
    table: 'FinalPriceList',
    draftTable: 'Pricing_Suggestions_Draft',
    allowedActors: ['Manual', 'System', 'Migration'],
    requiresApproval: true,
  },
  {
    table: 'Quotes',
    draftTable: 'Sales_Suggestions_Draft',
    allowedActors: ['Manual', 'System', 'Migration'],
    requiresApproval: true,
  },
  {
    table: 'Outreach_Sends',
    draftTable: 'Outreach_Drafts',
    allowedActors: ['Manual', 'System', 'Migration'],
    requiresApproval: true,
  },
  {
    table: 'Orders',
    draftTable: null, // Orders cannot be created by AI - manual only
    allowedActors: ['Manual', 'System'],
    requiresApproval: false,
  },
];

/**
 * Draft table names for quick lookup
 */
export const DRAFT_TABLES = [
  'Pricing_Suggestions_Draft',
  'Sales_Suggestions_Draft',
  'Outreach_Drafts',
] as const;

export type DraftTableName = typeof DRAFT_TABLES[number];

/**
 * Result of write protection validation
 */
export interface WriteProtectionResult {
  allowed: boolean;
  targetTable: string;
  originalTable: string;
  reason: string;
  requiresApproval: boolean;
  redirected: boolean;
}

/**
 * Validate if a write operation is allowed based on actor and target table
 * 
 * @param targetTable - Table the write is attempting to access
 * @param context - Write context (who is writing, from where, with what request ID)
 * @returns Validation result with routing information
 * 
 * @example
 * // AI attempting to write to FinalPriceList
 * const result = validateWrite('FinalPriceList', {
 *   actorType: 'AI',
 *   sourceId: 'AI-PRC-001',
 *   requestId: '123e4567-e89b-12d3-a456-426614174000'
 * });
 * // → { allowed: true, targetTable: 'Pricing_Suggestions_Draft', redirected: true, ... }
 * 
 * // Manual write to FinalPriceList
 * const result = validateWrite('FinalPriceList', {
 *   actorType: 'Manual',
 *   sourceId: 'user-admin@example.com',
 *   requestId: '...'
 * });
 * // → { allowed: true, targetTable: 'FinalPriceList', redirected: false, ... }
 */
export function validateWrite(
  targetTable: string,
  context: WriteContext
): WriteProtectionResult {
  // Find protection config for this table
  const config = PROTECTED_TABLES.find(c => c.table === targetTable);

  // Table is not protected - allow all writes
  if (!config) {
    return {
      allowed: true,
      targetTable,
      originalTable: targetTable,
      reason: `Table ${targetTable} is not protected - all actors allowed`,
      requiresApproval: false,
      redirected: false,
    };
  }

  // Check if actor is allowed direct access
  const isAllowed = config.allowedActors.includes(context.actorType);

  if (isAllowed) {
    return {
      allowed: true,
      targetTable,
      originalTable: targetTable,
      reason: `${context.actorType} actor allowed direct write to ${targetTable}`,
      requiresApproval: false,
      redirected: false,
    };
  }

  // Actor not allowed direct access - check if draft table exists
  if (!config.draftTable) {
    return {
      allowed: false,
      targetTable: '',
      originalTable: targetTable,
      reason: `${context.actorType} cannot write to ${targetTable} (no draft table available)`,
      requiresApproval: false,
      redirected: false,
    };
  }

  // Redirect to draft table
  return {
    allowed: true, // Write is allowed, but redirected
    targetTable: config.draftTable,
    originalTable: targetTable,
    reason: `${context.actorType} write redirected from ${targetTable} to ${config.draftTable} for approval`,
    requiresApproval: true,
    redirected: true,
  };
}

/**
 * Check if a table is a draft table
 */
export function isDraftTable(tableName: string): boolean {
  return DRAFT_TABLES.includes(tableName as DraftTableName);
}

/**
 * Get production table for a draft table
 */
export function getProductionTable(draftTable: string): string | null {
  const config = PROTECTED_TABLES.find(c => c.draftTable === draftTable);
  return config ? config.table : null;
}

/**
 * Get draft table for a production table
 */
export function getDraftTable(productionTable: string): string | null {
  const config = PROTECTED_TABLES.find(c => c.table === productionTable);
  return config ? config.draftTable : null;
}

/**
 * Generate a unique request ID for tracing
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Create a write context for AI operations
 * 
 * Note: This is the ONLY way AI should create write contexts.
 * AI cannot self-declare actorType='Manual' to bypass protection.
 */
export function createAIContext(agentId: string): WriteContext {
  return {
    actorType: 'AI',
    sourceId: agentId,
    requestId: generateRequestId(),
  };
}

/**
 * Create a write context for manual (human) operations
 */
export function createManualContext(userId: string): WriteContext {
  return {
    actorType: 'Manual',
    sourceId: userId,
    requestId: generateRequestId(),
  };
}

/**
 * Create a write context for system operations (migrations, cron jobs)
 */
export function createSystemContext(componentName: string): WriteContext {
  return {
    actorType: 'System',
    sourceId: componentName,
    requestId: generateRequestId(),
  };
}

/**
 * Logging helper for write protection events
 */
export function logWriteProtection(
  result: WriteProtectionResult,
  context: WriteContext,
  details?: string
): void {
  const timestamp = new Date().toISOString();
  const action = result.redirected ? 'REDIRECTED' : result.allowed ? 'ALLOWED' : 'BLOCKED';
  const message = `Write Protection ${action}: ${context.actorType} (${context.sourceId}) → ${result.originalTable}${result.redirected ? ` → ${result.targetTable}` : ''}${details ? ` | ${details}` : ''}`;
  
  console.log(`[${timestamp}] [${context.requestId}] ${message}`);
}
