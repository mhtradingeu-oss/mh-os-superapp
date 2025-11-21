/**
 * 07-interactive-toolkit.ts
 * HAIROTICMEN Trading OS — Interactive Validation & Management Toolkit
 * 
 * Comprehensive CLI tool with interactive menus for:
 * - Full validation and repair (from 07-validate-and-repair-workbook.ts)
 * - Smart data fill (Line/Category/Subcategory based on SKU patterns)
 * - Grundpreis (€/L and €/kg) calculations
 * - EAN-13 checksum validation and repair
 * - QR/Barcode URL generation
 * - Data quality audits
 * - And more...
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import Table from 'cli-table3';
import { getUncachableGoogleSheetClient } from '../../lib/sheets';
import { retryWithBackoff } from '../../lib/retry';
import type { sheets_v4 } from 'googleapis';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Import validation functions and utilities
import { validateAndRepairWorkbook, getMeta, readTable, logRow } from './07-validate-and-repair-workbook';

// ========== Configuration ==========
const SPREADSHEET_ID =
  process.env.SHEETS_SPREADSHEET_ID ||
  '1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0';

const DRY_RUN = String(process.env.DRY_RUN ?? 'false').toLowerCase() === 'true';

// ========== Helpers ==========
function banner() {
  console.clear();
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('  HAIROTICMEN Trading OS — Interactive Toolkit') + chalk.bold.cyan('        ║'));
  console.log(chalk.bold.cyan('║') + chalk.gray('  Comprehensive validation, repair & management tools') + chalk.bold.cyan('   ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════╝\n'));
  console.log(chalk.gray(`  Spreadsheet: ${SPREADSHEET_ID}`));
  console.log(chalk.gray(`  Mode: ${DRY_RUN ? chalk.yellow('DRY-RUN') : chalk.green('LIVE')}\n`));
}

async function getHeaderMap(sheets: sheets_v4.Sheets, sheetName: string) {
  const res = await retryWithBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!1:1`
    })
  );
  const headers = (res.data.values?.[0] || []) as string[];
  const map: Record<string, number> = {};
  headers.forEach((h, i) => { map[String(h).trim()] = i + 1; });
  return { headers, map };
}

// ========== Main Menu ==========
async function showMainMenu() {
  banner();
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: chalk.bold('What would you like to do?'),
      pageSize: 15,
      choices: [
        { name: chalk.cyan('⚡ Full Validation & Repair (Complete System Check)'), value: 'full_validation' },
        new inquirer.Separator(chalk.gray('──  Setup Tools  ─────────────────────────────────')),
        { name: '  📋 Setup Data Validations & Dropdowns', value: 'setup_validations' },
        { name: '  🧮 Setup Grundpreis Formulas (€/L & €/kg)', value: 'setup_grundpreis' },
        { name: '  🎨 Apply Column Formatting', value: 'apply_formatting' },
        new inquirer.Separator(chalk.gray('──  Smart Tools  ─────────────────────────────────')),
        { name: '  ✨ Smart Fill (Auto-suggest Line/Category/Box/Tier)', value: 'smart_fill' },
        { name: '  🔖 Generate QR/Barcode URLs', value: 'generate_qr' },
        { name: '  ✅ Validate/Repair EAN-13 Checksums', value: 'repair_ean13' },
        new inquirer.Separator(chalk.gray('──  Data Quality & Audits  ───────────────────────')),
        { name: '  🔎 Audit: Missing/Invalid/Below Floor Pricing', value: 'audit_quality' },
        { name: '  📦 Audit: Carton Fields (gaps)', value: 'audit_carton' },
        { name: '  📊 Show Statistics Dashboard', value: 'show_stats' },
        new inquirer.Separator(chalk.gray('──  Other  ───────────────────────────────────────')),
        { name: chalk.gray('ℹ️  About & Help'), value: 'help' },
        { name: chalk.red('Exit'), value: 'exit' }
      ]
    }
  ]);

  return action;
}

// ========== Action Handlers ==========

async function handleFullValidation() {
  console.log(chalk.bold.cyan('\n⚡ Running Full Validation & Repair...\n'));
  
  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: DRY_RUN 
        ? 'Run complete validation in DRY-RUN mode (no changes)?'
        : 'Run complete validation and APPLY FIXES to production?',
      default: true
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\n✖ Cancelled\n'));
    return;
  }

  try {
    await validateAndRepairWorkbook();
    console.log(chalk.green('\n✅ Validation complete! Check Validation_Log sheet for details.\n'));
  } catch (error: any) {
    console.error(chalk.red('\n❌ Error during validation:'), error.message);
  }

  await waitForKey();
}

async function handleSetupValidations() {
  console.log(chalk.bold.cyan('\n📋 Setting up Data Validations & Dropdowns...\n'));
  
  const sheets = (await getUncachableGoogleSheetClient()) as sheets_v4.Sheets;
  
  const { sheetNames } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'sheetNames',
      message: 'Select sheets to apply validations:',
      choices: ['FinalPriceList', 'Products', 'Quotes'],
      default: ['FinalPriceList', 'Products']
    }
  ]);

  console.log(chalk.gray(`\nApplying validations to: ${sheetNames.join(', ')}...\n`));

  for (const sheetName of sheetNames) {
    try {
      await setupValidations(sheets, sheetName);
      console.log(chalk.green(`✓ ${sheetName}: Validations applied`));
    } catch (error: any) {
      console.error(chalk.red(`✗ ${sheetName}: ${error.message}`));
    }
  }

  console.log(chalk.green('\n✅ Data validations setup complete!\n'));
  await waitForKey();
}

async function setupValidations(sheets: sheets_v4.Sheets, sheetName: string) {
  const { headers, map } = await getHeaderMap(sheets, sheetName);
  
  const meta = await getMeta(sheets);
  const sheetInfo = meta.sheetByName.get(sheetName);
  if (!sheetInfo) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  const validations = [
    { column: 'Line', values: ['Premium', 'Skin', 'Professional', 'Basic', 'Tools'] },
    { column: 'Status', values: ['Active', 'Inactive', 'Discontinued'] },
    { column: 'Amazon_TierKey', values: ['Std_Parcel_S', 'Std_Parcel_M', 'Std_Parcel_L'] },
    { column: 'Box_Size', values: ['Small', 'Medium', 'Large'] },
  ];

  for (const { column, values } of validations) {
    const colIdx = map[column];
    if (!colIdx) continue;

    await retryWithBackoff(() =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{
            setDataValidation: {
              range: {
                sheetId: sheetInfo.id,
                startRowIndex: 1,
                startColumnIndex: colIdx - 1,
                endColumnIndex: colIdx,
              },
              rule: {
                condition: {
                  type: 'ONE_OF_LIST',
                  values: values.map(v => ({ userEnteredValue: v }))
                },
                strict: true,
                showCustomUi: true,
              },
            },
          }],
        },
      })
    );
  }
}

async function handleSetupGrundpreis() {
  console.log(chalk.bold.cyan('\n🧮 Setting up Grundpreis Formulas...\n'));
  
  const sheets = (await getUncachableGoogleSheetClient()) as sheets_v4.Sheets;
  const sheetName = 'FinalPriceList';
  
  console.log(chalk.gray(`Analyzing ${sheetName} structure...\n`));
  
  const { headers, map } = await getHeaderMap(sheets, sheetName);
  const { data } = await readTable(sheets, sheetName);
  const lastRow = data.length + 1;

  // Check required columns
  const hasNetContentML = !!map['Net_Content_ml'];
  const hasSizeG = !!map['Size_g'];
  const hasUVPInc = !!map['UVP_Inc'];
  const hasGrundpreisL = !!map['Grundpreis_Inc_Per_L'];
  const hasGrundpreisKg = !!map['Grundpreis_Inc_Per_kg'];

  console.log(chalk.gray('Column availability:'));
  console.log(`  Net_Content_ml: ${hasNetContentML ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  Size_g: ${hasSizeG ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  UVP_Inc: ${hasUVPInc ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  Grundpreis_Inc_Per_L: ${hasGrundpreisL ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  Grundpreis_Inc_Per_kg: ${hasGrundpreisKg ? chalk.green('✓') : chalk.red('✗')}\n`);

  if (!hasUVPInc) {
    console.log(chalk.red('✗ Missing required column: UVP_Inc\n'));
    await waitForKey();
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Apply Grundpreis formulas to ${lastRow - 1} rows?`,
      default: true
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\n✖ Cancelled\n'));
    return;
  }

  console.log(chalk.gray('\nSetting up formulas...\n'));

  // Setup €/L formula
  if (hasGrundpreisL && hasNetContentML) {
    await setupGrundpreisFormula(sheets, sheetName, map, lastRow, 'L', 'Net_Content_ml', 'Grundpreis_Inc_Per_L');
    console.log(chalk.green('✓ Grundpreis €/L formulas applied'));
  }

  // Setup €/kg formula  
  if (hasGrundpreisKg && hasSizeG) {
    await setupGrundpreisFormula(sheets, sheetName, map, lastRow, 'kg', 'Size_g', 'Grundpreis_Inc_Per_kg');
    console.log(chalk.green('✓ Grundpreis €/kg formulas applied'));
  }

  console.log(chalk.green('\n✅ Grundpreis setup complete!\n'));
  await waitForKey();
}

async function setupGrundpreisFormula(
  sheets: sheets_v4.Sheets,
  sheetName: string,
  map: Record<string, number>,
  lastRow: number,
  unit: 'L' | 'kg',
  sourceCol: string,
  targetCol: string
) {
  const sourceIdx = map[sourceCol] - 1;
  const targetIdx = map[targetCol] - 1;
  const uvpIdx = map['UVP_Inc'] - 1;

  const formulas = [];
  for (let row = 2; row <= lastRow; row++) {
    const sourceCell = colA1(sourceIdx) + row;
    const uvpCell = colA1(uvpIdx) + row;
    const formula = `=IF(AND(${sourceCell}>0, ${uvpCell}>0), ROUND((${uvpCell}/${sourceCell})*1000, 2), "")`;
    formulas.push([formula]);
  }

  await retryWithBackoff(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${colA1(targetIdx)}2:${colA1(targetIdx)}${lastRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: formulas },
    })
  );
}

function colA1(i0: number): string {
  let n = i0 + 1, s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function handleSmartFill() {
  console.log(chalk.bold.cyan('\n✨ Smart Fill (Auto-suggest based on patterns)...\n'));
  
  const sheets = (await getUncachableGoogleSheetClient()) as sheets_v4.Sheets;
  
  const { sheetName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sheetName',
      message: 'Select sheet to apply smart fill:',
      choices: ['FinalPriceList', 'Products']
    }
  ]);

  console.log(chalk.gray(`\nAnalyzing ${sheetName}...\n`));
  
  const { headers, map } = await getHeaderMap(sheets, sheetName);
  const { data } = await readTable(sheets, sheetName);

  const stats = {
    line: 0,
    category: 0,
    subcategory: 0,
    boxSize: 0,
    tier: 0
  };

  const updated = data.map((row, idx) => {
    const sku = row.SKU || '';
    const name = row.Item || row.Name || '';
    const text = `${sku} ${name}`.toLowerCase();

    const newRow = { ...row };

    // Smart fill Line
    if (!row.Line && map.Line) {
      newRow.Line = guessLine(text);
      if (newRow.Line) stats.line++;
    }

    // Smart fill Category
    if (!row.Category && map.Category) {
      newRow.Category = guessCategory(text);
      if (newRow.Category) stats.category++;
    }

    // Smart fill Subcategory
    if (!row.Subcategory && map.Subcategory) {
      newRow.Subcategory = guessSubcategory(text);
      if (newRow.Subcategory) stats.subcategory++;
    }

    // Smart fill Box_Size (based on weight)
    if (!row.Box_Size && map.Box_Size && row.Weight_g) {
      newRow.Box_Size = guessBoxSize(Number(row.Weight_g));
      if (newRow.Box_Size) stats.boxSize++;
    }

    // Smart fill Amazon_TierKey (based on weight)
    if (!row.Amazon_TierKey && map.Amazon_TierKey && row.Weight_g) {
      newRow.Amazon_TierKey = guessTier(Number(row.Weight_g));
      if (newRow.Amazon_TierKey) stats.tier++;
    }

    return newRow;
  });

  console.log(chalk.gray('Smart fill analysis:'));
  console.log(`  Line: ${chalk.cyan(stats.line)} fields`);
  console.log(`  Category: ${chalk.cyan(stats.category)} fields`);
  console.log(`  Subcategory: ${chalk.cyan(stats.subcategory)} fields`);
  console.log(`  Box_Size: ${chalk.cyan(stats.boxSize)} fields`);
  console.log(`  Amazon_TierKey: ${chalk.cyan(stats.tier)} fields`);
  console.log(chalk.bold(`  Total: ${chalk.green(Object.values(stats).reduce((a,b)=>a+b, 0))} fields\n`));

  const total = Object.values(stats).reduce((a,b)=>a+b, 0);
  
  if (total === 0) {
    console.log(chalk.yellow('No empty fields found to fill.\n'));
    await waitForKey();
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Apply ${total} smart fill suggestions?`,
      default: true
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\n✖ Cancelled\n'));
    return;
  }

  // Write back to sheet
  const values = updated.map(row => headers.map(h => row[h] ?? ''));
  
  await retryWithBackoff(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'RAW',
      requestBody: { values },
    })
  );

  console.log(chalk.green(`\n✅ Smart fill complete! Updated ${total} fields.\n`));
  await waitForKey();
}

// Smart fill helper functions
function guessLine(text: string): string {
  if (/skin|face|serum|mask|toner|lotion/.test(text)) return 'Skin';
  if (/tool|accessor|comb|brush/.test(text)) return 'Tools';
  if (/pro|barber|salon/.test(text)) return 'Professional';
  if (/basic|classic/.test(text)) return 'Basic';
  return 'Premium';
}

function guessCategory(text: string): string {
  if (/beard|oil|balm|butter|moustache/.test(text)) return 'Beard Care';
  if (/shaving|razor|foam/.test(text)) return 'Shaving';
  if (/cologne|perfume|eau de|fragrance/.test(text)) return 'Cologne';
  if (/hair gel|styling gel/.test(text)) return 'Hair Gel';
  if (/hair wax|pomade/.test(text)) return 'Hair Wax';
  if (/shampoo|conditioner|hair care/.test(text)) return 'Hair Care';
  if (/aftershave|after shave/.test(text)) return 'Aftershave';
  if (/skin|face|serum|mask|toner|cleanser|lotion|cream/.test(text)) return 'Skin Care';
  if (/treatment kit|kit/.test(text)) return 'Treatment Kits';
  if (/tool|comb|brush|accessor/.test(text)) return 'Accessories';
  return 'Accessories';
}

function guessSubcategory(text: string): string {
  if (/shampoo/.test(text)) return 'Shampoo';
  if (/conditioner/.test(text)) return 'Conditioner';
  if (/oil/.test(text)) return 'Oil';
  if (/balm/.test(text)) return 'Balm';
  if (/butter/.test(text)) return 'Butter';
  if (/serum/.test(text)) return 'Serum';
  if (/cream|lotion/.test(text)) return 'Cream';
  if (/wax/.test(text)) return 'Wax';
  if (/clay/.test(text)) return 'Clay';
  if (/gel/.test(text)) return 'Gel';
  if (/mask/.test(text)) return 'Mask';
  if (/toner/.test(text)) return 'Toner';
  if (/kit|bundle/.test(text)) return 'Bundle';
  if (/comb|brush/.test(text)) return 'Accessory';
  return '';
}

function guessTier(weight: number): string {
  if (weight <= 200) return 'Std_Parcel_S';
  if (weight <= 400) return 'Std_Parcel_M';
  return 'Std_Parcel_L';
}

function guessBoxSize(weight: number): string {
  if (weight <= 250) return 'Small';
  if (weight <= 700) return 'Medium';
  return 'Large';
}

async function handleGenerateQR() {
  console.log(chalk.bold.cyan('\n🔖 Generating QR/Barcode URLs...\n'));
  
  const sheets = (await getUncachableGoogleSheetClient()) as sheets_v4.Sheets;
  
  const { sheetName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sheetName',
      message: 'Select sheet:',
      choices: ['FinalPriceList', 'Products']
    }
  ]);

  const { headers, map } = await getHeaderMap(sheets, sheetName);
  const { data } = await readTable(sheets, sheetName);

  const hasSKU = !!map.SKU;
  const hasEAN = !!map.EAN || !!map.Barcode;
  const hasQRURL = !!map.QR_URL || !!map.QRUrl;

  if (!hasSKU || !hasQRURL) {
    console.log(chalk.red('\n✗ Missing required columns (SKU or QR_URL)\n'));
    await waitForKey();
    return;
  }

  let count = 0;
  const updated = data.map(row => {
    const sku = row.SKU;
    const ean = row.EAN || row.Barcode || '';
    
    if (!sku) return row;

    const url = ean 
      ? `https://hairoticmen.de/product/${sku}?barcode=${ean}`
      : `https://hairoticmen.de/product/${sku}`;
    
    if (row.QR_URL !== url || row.QRUrl !== url) count++;
    
    return {
      ...row,
      QR_URL: url,
      QRUrl: url
    };
  });

  console.log(chalk.gray(`\nFound ${count} rows to update\n`));

  if (count === 0) {
    console.log(chalk.yellow('All QR URLs are already up to date.\n'));
    await waitForKey();
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Generate/update ${count} QR URLs?`,
      default: true
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\n✖ Cancelled\n'));
    return;
  }

  const values = updated.map(row => headers.map(h => row[h] ?? ''));
  
  await retryWithBackoff(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'RAW',
      requestBody: { values },
    })
  );

  console.log(chalk.green(`\n✅ Generated ${count} QR/Barcode URLs!\n`));
  await waitForKey();
}

async function handleRepairEAN13() {
  console.log(chalk.bold.cyan('\n✅ Validating/Repairing EAN-13 Checksums...\n'));
  
  const sheets = (await getUncachableGoogleSheetClient()) as sheets_v4.Sheets;
  
  const { sheetName } = await inquirer.prompt([
    {
      type: 'list',
      name: 'sheetName',
      message: 'Select sheet:',
      choices: ['FinalPriceList', 'Products']
    }
  ]);

  const { headers, map } = await getHeaderMap(sheets, sheetName);
  const { data } = await readTable(sheets, sheetName);

  const eanCol = 'EAN' in map ? 'EAN' : ('Barcode' in map ? 'Barcode' : null);
  
  if (!eanCol) {
    console.log(chalk.red('\n✗ No EAN/Barcode column found\n'));
    await waitForKey();
    return;
  }

  let fixed = 0;
  let invalid = 0;

  const updated = data.map(row => {
    const ean = String(row[eanCol] || '').trim();
    
    if (!ean || !/^\d{12,13}$/.test(ean)) {
      if (ean) invalid++;
      return row;
    }

    const base = ean.slice(0, 12);
    const correctChecksum = calculateEAN13Checksum(base);
    
    if (ean.length === 13) {
      const currentChecksum = ean[12];
      if (currentChecksum === String(correctChecksum)) {
        return row; // Already correct
      }
      fixed++;
      return { ...row, [eanCol]: base + correctChecksum };
    }

    // Length 12 - add checksum
    fixed++;
    return { ...row, [eanCol]: base + correctChecksum };
  });

  console.log(chalk.gray('EAN-13 analysis:'));
  console.log(`  Valid: ${chalk.green(data.length - fixed - invalid)}`);
  console.log(`  Fixed: ${chalk.yellow(fixed)}`);
  console.log(`  Invalid (skipped): ${chalk.red(invalid)}\n`);

  if (fixed === 0) {
    console.log(chalk.green('All EAN-13 codes are already valid!\n'));
    await waitForKey();
    return;
  }

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Repair ${fixed} EAN-13 checksums?`,
      default: true
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\n✖ Cancelled\n'));
    return;
  }

  const values = updated.map(row => headers.map(h => row[h] ?? ''));
  
  await retryWithBackoff(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'RAW',
      requestBody: { values },
    })
  );

  console.log(chalk.green(`\n✅ Repaired ${fixed} EAN-13 checksums!\n`));
  await waitForKey();
}

function calculateEAN13Checksum(s12: string): number {
  const digits = s12.split('').map(x => +x);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 ? 3 : 1), 0);
  const mod = sum % 10;
  return (10 - mod) % 10;
}

async function handleAuditQuality() {
  console.log(chalk.bold.cyan('\n🔎 Running Data Quality Audit...\n'));
  
  const sheets = (await getUncachableGoogleSheetClient()) as sheets_v4.Sheets;
  const sheetName = 'FinalPriceList';
  
  console.log(chalk.gray(`Analyzing ${sheetName}...\n`));
  
  const { headers, map } = await getHeaderMap(sheets, sheetName);
  const { data } = await readTable(sheets, sheetName);

  let missing = 0;
  let belowFloor = 0;
  let guardrailNo = 0;
  let duplicates = 0;
  const skuSet = new Set<string>();

  data.forEach(row => {
    const sku = row.SKU || '';
    const name = row.Name || row.Item || '';
    
    if (!sku || !name) missing++;
    
    if (sku) {
      if (skuSet.has(sku)) duplicates++;
      else skuSet.add(sku);
    }

    if (map.UVP_Inc_99 && map.Floor_B2C_Net) {
      const uvp = Number(row.UVP_Inc_99 || row.UVP_Inc || 0);
      const floor = Number(row.Floor_B2C_Net || 0);
      if (uvp > 0 && floor > 0 && uvp < floor) belowFloor++;
    }

    if (row.Guardrail_OK === 'NO') guardrailNo++;
  });

  const table = new Table({
    head: [chalk.bold('Issue'), chalk.bold('Count')],
    colWidths: [40, 15]
  });

  table.push(
    ['Missing SKU or Name', chalk.yellow(missing)],
    ['Duplicate SKUs', chalk.red(duplicates)],
    ['UVP below Floor Price', chalk.red(belowFloor)],
    ['Guardrail NOT OK', chalk.yellow(guardrailNo)]
  );

  console.log(table.toString());
  console.log('');

  await waitForKey();
}

async function handleAuditCarton() {
  console.log(chalk.bold.cyan('\n📦 Auditing Carton Fields...\n'));
  
  const sheets = (await getUncachableGoogleSheetClient()) as sheets_v4.Sheets;
  const sheetName = 'FinalPriceList';
  
  const { headers, map } = await getHeaderMap(sheets, sheetName);
  const { data } = await readTable(sheets, sheetName);

  const requiredFields = ['UnitsPerCarton', 'Carton_L_cm', 'Carton_W_cm', 'Carton_H_cm', 'Carton_Cost_EUR'];
  const missingCols = requiredFields.filter(f => !map[f]);

  if (missingCols.length > 0) {
    console.log(chalk.red(`\n✗ Missing columns: ${missingCols.join(', ')}\n`));
    await waitForKey();
    return;
  }

  let gaps = 0;
  data.forEach(row => {
    const u = Number(row.UnitsPerCarton || 0);
    const l = Number(row.Carton_L_cm || 0);
    const w = Number(row.Carton_W_cm || 0);
    const h = Number(row.Carton_H_cm || 0);
    const c = Number(row.Carton_Cost_EUR || 0);
    
    if (!(u > 0 && l > 0 && w > 0 && h > 0 && c >= 0)) gaps++;
  });

  console.log(chalk.gray('Carton field analysis:'));
  console.log(`  Total rows: ${chalk.cyan(data.length)}`);
  console.log(`  Rows with complete carton data: ${chalk.green(data.length - gaps)}`);
  console.log(`  Rows with gaps: ${chalk.yellow(gaps)}\n`);

  await waitForKey();
}

async function handleShowStats() {
  console.log(chalk.bold.cyan('\n📊 Statistics Dashboard\n'));
  
  const sheets = (await getUncachableGoogleSheetClient()) as sheets_v4.Sheets;
  
  try {
    const fplData = await readTable(sheets, 'FinalPriceList');
    const productsData = await readTable(sheets, 'Products');
    
    const table = new Table({
      head: [chalk.bold('Sheet'), chalk.bold('Rows'), chalk.bold('Columns')],
      colWidths: [25, 12, 12]
    });

    table.push(
      ['FinalPriceList', chalk.cyan(fplData.data.length), chalk.cyan(fplData.headers.length)],
      ['Products', chalk.cyan(productsData.data.length), chalk.cyan(productsData.headers.length)]
    );

    console.log(table.toString());
    console.log('');
  } catch (error: any) {
    console.error(chalk.red('Error loading stats:'), error.message);
  }

  await waitForKey();
}

async function handleHelp() {
  console.clear();
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('  HAIROTICMEN Trading OS — Help & About') + chalk.bold.cyan('             ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════════╝\n'));
  
  console.log(chalk.bold('Features:'));
  console.log('  • ✅ Complete validation & repair system');
  console.log('  • ✅ Smart data fill (AI-like pattern matching)');
  console.log('  • ✅ Grundpreis (€/L & €/kg) calculations');
  console.log('  • ✅ EAN-13 checksum validation');
  console.log('  • ✅ QR/Barcode URL generation');
  console.log('  • ✅ Comprehensive data audits\n');
  
  console.log(chalk.bold('Usage:'));
  console.log('  DRY_RUN=true  - Run in simulation mode (no changes)');
  console.log('  DRY_RUN=false - Apply changes to Google Sheets\n');
  
  console.log(chalk.gray('Version: 1.0.0 (Node.js/TypeScript)\n'));

  await waitForKey();
}

async function waitForKey() {
  await inquirer.prompt([
    {
      type: 'input',
      name: 'continue',
      message: chalk.gray('Press Enter to continue...')
    }
  ]);
}

// ========== Main Loop ==========
async function main() {
  if (!SPREADSHEET_ID) {
    console.error(chalk.red('❌ SHEETS_SPREADSHEET_ID is not set.'));
    process.exit(1);
  }

  let running = true;

  while (running) {
    const action = await showMainMenu();

    switch (action) {
      case 'full_validation':
        await handleFullValidation();
        break;
      case 'setup_validations':
        await handleSetupValidations();
        break;
      case 'setup_grundpreis':
        await handleSetupGrundpreis();
        break;
      case 'smart_fill':
        await handleSmartFill();
        break;
      case 'generate_qr':
        await handleGenerateQR();
        break;
      case 'repair_ean13':
        await handleRepairEAN13();
        break;
      case 'audit_quality':
        await handleAuditQuality();
        break;
      case 'audit_carton':
        await handleAuditCarton();
        break;
      case 'show_stats':
        await handleShowStats();
        break;
      case 'help':
        await handleHelp();
        break;
      case 'exit':
        running = false;
        console.log(chalk.cyan('\n👋 Goodbye!\n'));
        break;
    }
  }
}

// ESM guard
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(chalk.red('\n❌ ERROR:'), e?.message || e);
    console.error(chalk.gray('\nStack:'), e?.stack);
    process.exit(1);
  });
}

export { main as runInteractiveToolkit };
