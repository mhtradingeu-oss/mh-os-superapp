/**
 * Safety Guards for Greenfield Migration
 * 
 * Provides validation functions to prevent accidental writes to wrong sheets.
 */

import { google } from 'googleapis';
import * as fs from 'fs/promises';
import * as path from 'path';

const LEGACY_SHEET_ID = '1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0';
const EXPECTED_SHEET_TITLE_PATTERN = /v3|MH-Trading-OS-v3/i;

export interface NewEnv {
  sheets: {
    prod: { id: string; title?: string };
    staging: { id: string; title?: string };
  };
  folder: {
    root: { id: string };
  };
}

/**
 * Validates that NEW-ENV.json exists and contains valid sheet IDs
 */
export async function validateNewEnvFile(): Promise<NewEnv> {
  const envPath = path.join(process.cwd(), 'reports', 'NEW-ENV.json');
  
  // Check file exists
  try {
    await fs.access(envPath);
  } catch (error) {
    throw new Error(
      '❌ SAFETY CHECK FAILED: reports/NEW-ENV.json not found. ' +
      'You must run G0-bootstrap-drive.ts first to create the new environment.'
    );
  }

  // Load and parse
  const envData: NewEnv = JSON.parse(await fs.readFile(envPath, 'utf-8'));

  // Validate structure
  if (!envData.sheets?.prod?.id || !envData.sheets?.staging?.id) {
    throw new Error(
      '❌ SAFETY CHECK FAILED: NEW-ENV.json is missing required sheet IDs. ' +
      'The file may be corrupted or incomplete.'
    );
  }

  // Check not pointing to legacy sheet
  if (envData.sheets.prod.id === LEGACY_SHEET_ID || envData.sheets.staging.id === LEGACY_SHEET_ID) {
    throw new Error(
      `❌ SAFETY CHECK FAILED: NEW-ENV.json contains legacy sheet ID (${LEGACY_SHEET_ID}). ` +
      'This would cause writes to the legacy system. Aborting to prevent data loss.'
    );
  }

  return envData;
}

/**
 * Verifies that a spreadsheet is a v3 sheet (not legacy) by checking its title
 */
export async function verifySheetIsV3(sheets: any, spreadsheetId: string, expectedRole: 'PROD' | 'STAGING'): Promise<void> {
  try {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title'
    });

    const title = metadata.data.properties?.title || '';
    const normalizedTitle = title.toLowerCase().replace(/[\s\-–—_]/g, '');

    // Check title contains v3 marker
    if (!EXPECTED_SHEET_TITLE_PATTERN.test(title)) {
      throw new Error(
        `❌ SAFETY CHECK FAILED: Spreadsheet "${title}" (ID: ${spreadsheetId}) does not appear to be a v3 sheet. ` +
        'Expected title to contain "v3" or "MH-Trading-OS-v3". Refusing to write to this sheet.'
      );
    }

    // Check title contains expected role (case-insensitive with common delimiters)
    const rolePattern = expectedRole === 'PROD' 
      ? /prod|production/i 
      : /stag|staging/i;
    
    if (!rolePattern.test(title)) {
      throw new Error(
        `❌ SAFETY CHECK FAILED: Spreadsheet "${title}" does not match expected role "${expectedRole}". ` +
        'This may indicate stale NEW-ENV.json or wrong sheet ID. Aborting.'
      );
    }

    console.log(`✅ Safety check passed: "${title}" is a valid v3 ${expectedRole} sheet`);
  } catch (error) {
    if ((error as Error).message.includes('SAFETY CHECK FAILED')) {
      throw error;
    }
    throw new Error(
      `❌ SAFETY CHECK FAILED: Could not verify spreadsheet ${spreadsheetId}. ` +
      `Error: ${(error as Error).message}. Aborting to prevent accidental writes.`
    );
  }
}

/**
 * Validates that schema.map.json exists (required for G3+)
 */
export async function validateSchemaMap(): Promise<Record<string, string[]>> {
  const schemaMapPath = path.join(process.cwd(), 'reports', 'schema.map.json');
  
  // Check file exists
  try {
    await fs.access(schemaMapPath);
  } catch (error) {
    throw new Error(
      '❌ SAFETY CHECK FAILED: reports/schema.map.json not found. ' +
      'You must run G1-schema-install.ts first to create the schema map. ' +
      'The schema map is required to compare new vs legacy sheets.'
    );
  }

  // Load and parse
  try {
    const schemaData: Record<string, string[]> = JSON.parse(await fs.readFile(schemaMapPath, 'utf-8'));
    
    if (Object.keys(schemaData).length === 0) {
      throw new Error('Schema map is empty');
    }
    
    return schemaData;
  } catch (error) {
    throw new Error(
      `❌ SAFETY CHECK FAILED: reports/schema.map.json is invalid or corrupted. ` +
      `Error: ${(error as Error).message}. Re-run G1-schema-install.ts to regenerate.`
    );
  }
}

/**
 * Runs all safety checks before allowing writes to a spreadsheet
 */
export async function runSafetyChecks(
  sheets: any,
  envData: NewEnv,
  targetEnvironment: 'prod' | 'staging'
): Promise<void> {
  console.log('\n🛡️ Running safety checks...');

  const spreadsheetId = envData.sheets[targetEnvironment].id;
  const role = targetEnvironment.toUpperCase() as 'PROD' | 'STAGING';

  // Check 1: Verify not legacy sheet
  if (spreadsheetId === LEGACY_SHEET_ID) {
    throw new Error(
      `❌ SAFETY CHECK FAILED: Attempting to write to legacy sheet (${LEGACY_SHEET_ID}). ` +
      'This is strictly forbidden. Check your NEW-ENV.json file.'
    );
  }

  // Check 2: Verify sheet title is v3
  await verifySheetIsV3(sheets, spreadsheetId, role);

  console.log('✅ All safety checks passed\n');
}
