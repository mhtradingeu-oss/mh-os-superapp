/**
 * SheetSchemaSnapshot - Dynamic Schema Preservation System
 * 
 * Captures Google Sheets headers as canonical source of truth, enabling:
 * - Column renames (e.g., "Factory_Cost_EUR" → "مصنع_تكلفة")
 * - Column reordering (user moves columns around)
 * - New columns added by user
 * - Category name changes in Enums sheet
 * 
 * Architecture:
 * 1. Read live headers from Google Sheets (source of truth)
 * 2. Reconcile with ensure-sheets defaults (detect changes)
 * 3. Build column remapping (exact → normalized → alias)
 * 4. Validate critical columns exist (primary keys, formulas)
 * 5. Write data aligned to live schema order
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path for persisting schema snapshots between runs
const SNAPSHOT_CACHE_PATH = join(__dirname, '../config/schema-snapshots.json');

/**
 * Represents a column in the sheet schema
 */
export interface SchemaColumn {
  /** Current header name (from Google Sheets) */
  name: string;
  /** Position in the sheet (0-indexed) */
  position: number;
  /** Original config name (from ensure-sheets) - for tracking renames */
  originalName?: string;
  /** Aliases for this column (for backward compatibility) */
  aliases?: string[];
  /** Whether this is a user-added column (not in original config) */
  isUserAdded?: boolean;
  /** Whether this is a critical column (primary key, formula, etc.) */
  isCritical?: boolean;
}

/**
 * Snapshot of a sheet's schema at a point in time
 */
export interface SheetSchemaSnapshot {
  /** Sheet name */
  sheetName: string;
  /** All columns in order (from Google Sheets) */
  columns: SchemaColumn[];
  /** Timestamp of snapshot */
  timestamp: string;
  /** Config headers (from ensure-sheets) for comparison */
  configHeaders?: string[];
  /** Primary key column name */
  primaryKey?: string;
}

/**
 * Collection of all sheet snapshots
 */
export interface SchemaSnapshotCache {
  version: string;
  snapshots: Record<string, SheetSchemaSnapshot>;
  lastUpdated: string;
}

/**
 * Normalizes a column name for fuzzy matching
 * Strips case, spaces, underscores, special chars
 */
export function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_-]/g, '')
    .replace(/[^\w]/g, '');
}

/**
 * Finds a column by name using multi-tier matching strategy:
 * 1. Exact match
 * 2. Normalized match (case/space/underscore insensitive)
 * 3. Alias match
 */
export function findColumnByName(
  columns: SchemaColumn[],
  searchName: string
): SchemaColumn | undefined {
  // 1. Exact match
  let found = columns.find(col => col.name === searchName);
  if (found) return found;

  // 2. Normalized match
  const normalizedSearch = normalizeColumnName(searchName);
  found = columns.find(col => normalizeColumnName(col.name) === normalizedSearch);
  if (found) return found;

  // 3. Alias match
  found = columns.find(col => 
    col.aliases?.some(alias => 
      alias === searchName || normalizeColumnName(alias) === normalizedSearch
    )
  );
  
  return found;
}

/**
 * Creates a schema snapshot from live Google Sheets headers
 * Uses previous snapshot to maintain alias mappings across renames
 */
export function createSchemaSnapshot(
  sheetName: string,
  liveHeaders: string[],
  configHeaders: string[],
  primaryKey?: string,
  previousSnapshot?: SheetSchemaSnapshot
): SheetSchemaSnapshot {
  // Build a map of used config headers
  const usedConfigHeaders = new Set<string>();
  const liveSet = new Set(liveHeaders);
  
  const columns: SchemaColumn[] = liveHeaders.map((name, position) => {
    // First check: exact match in config
    const exactConfigIndex = configHeaders.findIndex(ch => ch === name);
    if (exactConfigIndex !== -1) {
      usedConfigHeaders.add(configHeaders[exactConfigIndex]);
      return {
        name,
        position,
        isUserAdded: false,
        isCritical: name === primaryKey
      };
    }
    
    // Second check: normalized match in config
    const normalizedConfigIndex = configHeaders.findIndex(ch => 
      normalizeColumnName(ch) === normalizeColumnName(name)
    );
    if (normalizedConfigIndex !== -1) {
      const originalName = configHeaders[normalizedConfigIndex];
      usedConfigHeaders.add(originalName);
      return {
        name,
        position,
        originalName,
        aliases: [originalName],
        isUserAdded: false,
        isCritical: name === primaryKey || originalName === primaryKey
      };
    }
    
    // Third check: check if this was a known column in previous snapshot
    if (previousSnapshot) {
      const prevColumn = previousSnapshot.columns.find(c => c.name === name);
      if (prevColumn) {
        // Column existed before, preserve its metadata
        if (prevColumn.originalName) {
          usedConfigHeaders.add(prevColumn.originalName);
        }
        return {
          name,
          position,
          originalName: prevColumn.originalName,
          aliases: prevColumn.aliases,
          isUserAdded: prevColumn.isUserAdded,
          isCritical: prevColumn.isCritical || name === primaryKey
        };
      }
    }
    
    // Not found in config or previous snapshot - must be user-added
    return {
      name,
      position,
      isUserAdded: true,
      isCritical: name === primaryKey
    };
  });
  
  // Fourth check: Find config columns that disappeared from live headers
  // These might have been renamed - link them as aliases
  const missingConfigHeaders = configHeaders.filter(ch => 
    !usedConfigHeaders.has(ch) && !liveSet.has(ch)
  );
  
  // If we have a previous snapshot, try to find renamed columns
  if (previousSnapshot && missingConfigHeaders.length > 0) {
    const prevMap = new Map(previousSnapshot.columns.map(c => [c.name, c]));
    const prevByOriginal = new Map(
      previousSnapshot.columns
        .filter(c => c.originalName)
        .map(c => [c.originalName!, c])
    );
    
    // Find columns in live that weren't in previous snapshot and are marked as userAdded
    const candidateNewColumns = columns.filter(c => c.isUserAdded && !prevMap.has(c.name));
    
    // Try to match each missing config header to a candidate new column
    for (const missingHeader of missingConfigHeaders) {
      // Check if this config header was already tracked in previous snapshot
      const prevColumn = prevByOriginal.get(missingHeader) || 
                        previousSnapshot.columns.find(c => c.name === missingHeader);
      
      if (prevColumn && candidateNewColumns.length > 0) {
        // Find the candidate at the same or closest position
        const targetPosition = prevColumn.position;
        let bestCandidate = candidateNewColumns[0];
        let minDistance = Math.abs(bestCandidate.position - targetPosition);
        
        for (const candidate of candidateNewColumns) {
          const distance = Math.abs(candidate.position - targetPosition);
          if (distance < minDistance) {
            minDistance = distance;
            bestCandidate = candidate;
          }
        }
        
        // Link as renamed column
        bestCandidate.isUserAdded = false;
        bestCandidate.originalName = missingHeader;
        bestCandidate.aliases = [missingHeader, ...(prevColumn.aliases || [])];
        bestCandidate.isCritical = bestCandidate.isCritical || missingHeader === primaryKey;
        
        // Remove from candidates to prevent double-matching
        const idx = candidateNewColumns.indexOf(bestCandidate);
        if (idx !== -1) candidateNewColumns.splice(idx, 1);
      }
    }
  }

  return {
    sheetName,
    columns,
    timestamp: new Date().toISOString(),
    configHeaders,
    primaryKey
  };
}

/**
 * Compares two snapshots and reports differences
 */
export interface SchemaComparison {
  hasChanges: boolean;
  renamedColumns: Array<{ from: string; to: string }>;
  reorderedColumns: string[];
  addedColumns: string[];
  removedColumns: string[];
  criticalMissing: string[];
}

export function compareSnapshots(
  oldSnapshot: SheetSchemaSnapshot | undefined,
  newSnapshot: SheetSchemaSnapshot
): SchemaComparison {
  if (!oldSnapshot) {
    return {
      hasChanges: true,
      renamedColumns: [],
      reorderedColumns: [],
      addedColumns: newSnapshot.columns.filter(c => c.isUserAdded).map(c => c.name),
      removedColumns: [],
      criticalMissing: []
    };
  }

  const comparison: SchemaComparison = {
    hasChanges: false,
    renamedColumns: [],
    reorderedColumns: [],
    addedColumns: [],
    removedColumns: [],
    criticalMissing: []
  };

  const oldNames = new Set(oldSnapshot.columns.map(c => c.name));
  const newNames = new Set(newSnapshot.columns.map(c => c.name));

  // Find added columns
  for (const col of newSnapshot.columns) {
    if (col.isUserAdded && !oldNames.has(col.name)) {
      comparison.addedColumns.push(col.name);
      comparison.hasChanges = true;
    }
  }

  // Find removed columns
  for (const col of oldSnapshot.columns) {
    if (!newNames.has(col.name)) {
      // Check if it was renamed (exists by normalized name)
      const possibleRename = findColumnByName(newSnapshot.columns, col.name);
      if (possibleRename && possibleRename.name !== col.name) {
        comparison.renamedColumns.push({ from: col.name, to: possibleRename.name });
        comparison.hasChanges = true;
      } else {
        comparison.removedColumns.push(col.name);
        comparison.hasChanges = true;
        
        // Check if critical
        if (col.isCritical) {
          comparison.criticalMissing.push(col.name);
        }
      }
    }
  }

  // Find reordered columns
  const oldOrder = oldSnapshot.columns.map(c => c.name);
  const newOrder = newSnapshot.columns.map(c => c.name);
  if (JSON.stringify(oldOrder) !== JSON.stringify(newOrder)) {
    comparison.reorderedColumns = newOrder.filter((name, idx) => oldOrder[idx] !== name);
    if (comparison.reorderedColumns.length > 0) {
      comparison.hasChanges = true;
    }
  }

  return comparison;
}

/**
 * Loads schema snapshots from cache file
 */
export function loadSnapshotCache(): SchemaSnapshotCache {
  if (!existsSync(SNAPSHOT_CACHE_PATH)) {
    return {
      version: '1.0.0',
      snapshots: {},
      lastUpdated: new Date().toISOString()
    };
  }

  try {
    const data = readFileSync(SNAPSHOT_CACHE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn('⚠️  Failed to load schema snapshot cache:', error);
    return {
      version: '1.0.0',
      snapshots: {},
      lastUpdated: new Date().toISOString()
    };
  }
}

/**
 * Saves schema snapshots to cache file
 */
export function saveSnapshotCache(cache: SchemaSnapshotCache): void {
  try {
    cache.lastUpdated = new Date().toISOString();
    writeFileSync(SNAPSHOT_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.warn('⚠️  Failed to save schema snapshot cache:', error);
  }
}

/**
 * Remaps a data row from config schema to live schema
 * Handles column renames, reordering, and new columns
 */
export function remapRowToLiveSchema(
  configRow: any[],
  configHeaders: string[],
  liveSnapshot: SheetSchemaSnapshot,
  existingRow?: any[]
): any[] {
  const liveRow: any[] = new Array(liveSnapshot.columns.length).fill('');

  // Map each config value to its corresponding position in live schema
  for (let i = 0; i < configHeaders.length; i++) {
    const configHeader = configHeaders[i];
    const configValue = configRow[i];

    // Find where this column is in the live schema
    const liveColumn = findColumnByName(liveSnapshot.columns, configHeader);
    
    if (liveColumn) {
      liveRow[liveColumn.position] = configValue;
    }
    // If not found, value is lost (column was removed by user)
  }

  // Preserve user-added columns from existing row
  if (existingRow) {
    for (const col of liveSnapshot.columns) {
      if (col.isUserAdded && existingRow[col.position] !== undefined) {
        liveRow[col.position] = existingRow[col.position];
      }
    }
  }

  return liveRow;
}

/**
 * Validates that critical columns exist in live schema
 * Returns validation errors, or empty array if valid
 */
export interface SchemaValidationError {
  severity: 'error' | 'warning';
  message: string;
  column?: string;
}

export function validateLiveSchema(
  snapshot: SheetSchemaSnapshot,
  criticalColumns: string[]
): SchemaValidationError[] {
  const errors: SchemaValidationError[] = [];

  // Check primary key
  if (snapshot.primaryKey) {
    const pkColumn = findColumnByName(snapshot.columns, snapshot.primaryKey);
    if (!pkColumn) {
      errors.push({
        severity: 'error',
        message: `Primary key column "${snapshot.primaryKey}" is missing or renamed without alias`,
        column: snapshot.primaryKey
      });
    }
  }

  // Check other critical columns
  for (const criticalCol of criticalColumns) {
    const found = findColumnByName(snapshot.columns, criticalCol);
    if (!found) {
      errors.push({
        severity: 'warning',
        message: `Critical column "${criticalCol}" not found (may have been renamed)`,
        column: criticalCol
      });
    }
  }

  return errors;
}

/**
 * Prints schema comparison report to console
 */
export function printSchemaReport(
  sheetName: string,
  comparison: SchemaComparison,
  validationErrors: SchemaValidationError[]
): void {
  if (!comparison.hasChanges && validationErrors.length === 0) {
    console.log(`  ✅ ${sheetName}: Schema unchanged`);
    return;
  }

  console.log(`\n📋 Schema Changes Detected: ${sheetName}`);
  console.log('─'.repeat(60));

  if (comparison.renamedColumns.length > 0) {
    console.log('  📝 Renamed Columns:');
    comparison.renamedColumns.forEach(({ from, to }) => {
      console.log(`     • "${from}" → "${to}"`);
    });
  }

  if (comparison.addedColumns.length > 0) {
    console.log('  ➕ New Columns Added:');
    comparison.addedColumns.forEach(name => {
      console.log(`     • "${name}"`);
    });
  }

  if (comparison.removedColumns.length > 0) {
    console.log('  ➖ Removed Columns:');
    comparison.removedColumns.forEach(name => {
      console.log(`     • "${name}"`);
    });
  }

  if (comparison.reorderedColumns.length > 0) {
    console.log(`  🔄 Reordered: ${comparison.reorderedColumns.length} columns moved`);
  }

  if (validationErrors.length > 0) {
    console.log('  ⚠️  Validation Issues:');
    validationErrors.forEach(err => {
      const icon = err.severity === 'error' ? '❌' : '⚠️ ';
      console.log(`     ${icon} ${err.message}`);
    });
  }

  console.log('─'.repeat(60));
}
