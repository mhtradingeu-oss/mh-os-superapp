/**
 * 🏗️ HAIROTICMEN Trading OS - Complete Spreadsheet Builder V4
 * ============================================================
 * Creates pristine Google Sheets structure with ZERO duplicates
 * 
 * FIXED: Handles Drive API authentication gracefully (optional folders)
 */

import { google } from "googleapis";
import type { sheets_v4, drive_v3 } from "googleapis";
import { getUncachableGoogleSheetClient } from "../../lib/sheets";
import { REQUIRED_SHEETS, type SheetDefinition } from "../../lib/ensure-sheets";
import { retryWithBackoff } from "../../lib/retry";

// ==================== CONFIGURATION ====================

const DRY_RUN = String(process.env.DRY_RUN || "").toLowerCase() === "true";
// Remove trailing slashes and whitespace from spreadsheet ID
const EXISTING_SPREADSHEET_ID = (process.env.SHEETS_SPREADSHEET_ID || "1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0")
  .trim()
  .replace(/\/+$/, ""); // Remove trailing slashes

// ==================== ADMIN POWER MENU ====================

const ADMIN_POWER_MENU: SheetDefinition = {
  name: "Admin_PowerMenu",
  category: "system",
  protected: false,
  freezeRows: 1,
  description: "🎛️ Centralized control panel for all system operations",
  headers: [
    "Category", "Tool", "Description", "Script", "Status", "LastRun", "RunCount"
  ],
  seedData: [
    ["💰 Pricing", "Calculate All Pricing", "Run Pricing Engine V2.2 on all 89 products", "pricing-master.ts", "Ready", "", "0"],
    ["💰 Pricing", "Analyze Pricing Coverage", "Check pricing gaps and bundling recommendations", "analyze-all-products-v22.ts", "Ready", "", "0"],
    ["💰 Pricing", "Fix Data Gaps", "Auto-fill missing COGS, QRUrls, Factory prices", "fix-pricing-gaps.ts", "Ready", "", "0"],
    ["💰 Pricing", "Generate Pricing Report", "Create comprehensive pricing analysis", "generate-pricing-report-sheet.ts", "Ready", "", "0"],
    ["💰 Pricing", "Pricing Summary", "Quick KPI overview", "pricing-summary-report.ts", "Ready", "", "0"],
    ["🚚 Shipping", "Calculate Shipping Costs", "Run Unified Shipping V3 (all channels)", "calculate-shipping-costs.ts", "Ready", "", "0"],
    ["🔗 QR Codes", "Generate All QR Codes", "Create QR codes for all 89 products", "generate-all-qr-codes.ts", "Ready", "", "0"],
    ["🔗 QR Codes", "Update QR URLs", "Refresh QRUrl column in FinalPriceList", "update-qr-urls.ts", "Ready", "", "0"],
    ["🔗 QR Codes", "Fix Malformed URLs", "Repair broken QR links", "fix-qr-urls.ts", "Ready", "", "0"],
    ["⚙️ Operations", "Bootstrap Sheets", "Initialize all 92 sheets with headers", "bootstrap-sheets.ts", "Ready", "", "0"],
    ["⚙️ Operations", "Test German Invoice", "Generate test invoice with PAngV compliance", "test-german-invoice.ts", "Ready", "", "0"],
    ["🔧 Admin", "Validate Schema", "Check all sheets have correct headers", "BUILT-IN", "Ready", "", "0"],
    ["🔧 Admin", "Check Duplicates", "Scan for duplicate sheets/columns", "BUILT-IN", "Ready", "", "0"],
    ["🔧 Admin", "Health Check", "Verify system integrity", "BUILT-IN", "Ready", "", "0"],
    ["🔧 Admin", "Export All Data", "Backup spreadsheet to JSON", "BUILT-IN", "Ready", "", "0"]
  ]
};

const ALL_SHEETS = [
  ADMIN_POWER_MENU,
  ...REQUIRED_SHEETS.filter(s => s.name !== "Admin_PowerMenu")
];

// ==================== UTILITIES ====================

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function extractAuthFromSheetsClient(client: any): any | null {
  try {
    return (client as any)?.options?.auth ?? (client as any)?._options?.auth ?? null;
  } catch {
    return null;
  }
}

// ==================== SHEET OPERATIONS ====================

interface ExistingSheet {
  title: string;
  sheetId: number;
}

async function scanExistingSheets(
  sheetsClient: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<ExistingSheet[]> {
  const meta = await retryWithBackoff(() =>
    sheetsClient.spreadsheets.get({ spreadsheetId })
  );
  
  return (meta.data.sheets || []).map(s => ({
    title: s.properties?.title || "",
    sheetId: s.properties?.sheetId || 0
  }));
}

async function detectAndRemoveDuplicates(
  sheetsClient: sheets_v4.Sheets,
  spreadsheetId: string,
  existing: ExistingSheet[]
): Promise<{ removed: number; kept: Map<string, number> }> {
  console.log("\n🔍 Scanning for duplicates...");
  
  const grouped = new Map<string, ExistingSheet[]>();
  existing.forEach(sheet => {
    const arr = grouped.get(sheet.title) || [];
    arr.push(sheet);
    grouped.set(sheet.title, arr);
  });
  
  const duplicates = Array.from(grouped.entries()).filter(([_, sheets]) => sheets.length > 1);
  
  if (duplicates.length === 0) {
    console.log("   ✅ No duplicates found");
    const kept = new Map<string, number>();
    existing.forEach(s => kept.set(s.title, s.sheetId));
    return { removed: 0, kept };
  }
  
  console.log(`   ⚠️ Found ${duplicates.length} duplicate sheet names:`);
  duplicates.forEach(([title, sheets]) => {
    console.log(`      - "${title}" × ${sheets.length}`);
  });
  
  if (DRY_RUN) {
    console.log("   [DRY-RUN] Skipping duplicate removal");
    const kept = new Map<string, number>();
    grouped.forEach((sheets, title) => kept.set(title, sheets[0].sheetId));
    return { removed: 0, kept };
  }
  
  const deleteRequests: sheets_v4.Schema$Request[] = [];
  const kept = new Map<string, number>();
  
  grouped.forEach((sheets, title) => {
    if (sheets.length > 1) {
      kept.set(title, sheets[0].sheetId);
      sheets.slice(1).forEach(s => {
        deleteRequests.push({ deleteSheet: { sheetId: s.sheetId } });
      });
    } else {
      kept.set(title, sheets[0].sheetId);
    }
  });
  
  if (deleteRequests.length > 0) {
    await retryWithBackoff(() =>
      sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: deleteRequests }
      })
    );
    console.log(`   ✅ Removed ${deleteRequests.length} duplicate sheets`);
  }
  
  return { removed: deleteRequests.length, kept };
}

async function ensureAllSheetsExist(
  sheetsClient: sheets_v4.Sheets,
  spreadsheetId: string,
  requiredSheets: SheetDefinition[],
  existingSheets: Map<string, number>
): Promise<void> {
  console.log("\n📋 Ensuring all sheets exist...");
  
  const createRequests: sheets_v4.Schema$Request[] = [];
  
  if (existingSheets.has("Sheet1") && !existingSheets.has("README")) {
    const sheet1Id = existingSheets.get("Sheet1")!;
    createRequests.push({
      updateSheetProperties: {
        properties: { sheetId: sheet1Id, title: "README" },
        fields: "title"
      }
    });
    existingSheets.delete("Sheet1");
    existingSheets.set("README", sheet1Id);
    console.log("   ℹ️  Renaming Sheet1 → README");
  }
  
  const missing: string[] = [];
  requiredSheets.forEach(def => {
    if (!existingSheets.has(def.name)) {
      missing.push(def.name);
      createRequests.push({
        addSheet: {
          properties: {
            title: def.name,
            gridProperties: {
              frozenRowCount: def.freezeRows || 1,
              frozenColumnCount: def.freezeColumns || 0,
              rowCount: 1000,
              columnCount: def.headers.length || 26
            }
          }
        }
      });
    }
  });
  
  if (missing.length > 0) {
    console.log(`   ℹ️  Creating ${missing.length} missing sheets`);
    if (!DRY_RUN) {
      await retryWithBackoff(() =>
        sheetsClient.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: createRequests }
        })
      );
      console.log(`   ✅ Created ${missing.length} sheets`);
    } else {
      console.log(`   [DRY-RUN] Would create: ${missing.slice(0, 5).join(", ")}...`);
    }
  } else {
    console.log("   ✅ All sheets exist");
  }
}

async function writeAllHeaders(
  sheetsClient: sheets_v4.Sheets,
  spreadsheetId: string,
  requiredSheets: SheetDefinition[]
): Promise<{ total: number; written: number; skipped: number }> {
  console.log("\n📝 Writing headers (batch mode)...");
  
  // Get list of existing sheets first
  const meta = await retryWithBackoff(() =>
    sheetsClient.spreadsheets.get({ spreadsheetId })
  );
  const existingSheetNames = new Set(
    (meta.data.sheets || []).map(s => s.properties!.title!)
  );
  
  // Only request headers for sheets that exist
  const existingRequiredSheets = requiredSheets.filter(s => existingSheetNames.has(s.name));
  const ranges = existingRequiredSheets.map(s => `${s.name}!1:1`);
  const existing = new Map<string, string[]>();
  
  for (let i = 0; i < ranges.length; i += 90) {
    const batch = ranges.slice(i, i + 90);
    const res = await retryWithBackoff(() =>
      sheetsClient.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: batch
      })
    );
    
    (res.data.valueRanges || []).forEach(vr => {
      const sheetName = vr.range!.split("!")[0].replace(/'/g, "");
      const row = (vr.values && vr.values[0]) ? vr.values[0].map(String) : [];
      existing.set(sheetName, row);
    });
    
    await sleep(150);
  }
  
  const toWrite: Array<{ range: string; values: string[][] }> = [];
  let skipped = 0;
  
  requiredSheets.forEach(def => {
    const have = existing.get(def.name) || [];
    const want = def.headers;
    
    const equal =
      have.length === want.length &&
      have.every((v, i) => (v || "").trim() === (want[i] || "").trim());
    
    if (equal) {
      skipped++;
    } else {
      toWrite.push({ range: `${def.name}!1:1`, values: [want] });
    }
  });
  
  if (DRY_RUN) {
    console.log(`   [DRY-RUN] Would write ${toWrite.length}/${requiredSheets.length} headers`);
    return { total: requiredSheets.length, written: 0, skipped };
  }
  
  let written = 0;
  for (let i = 0; i < toWrite.length; i += 20) {
    const batch = toWrite.slice(i, i + 20);
    
    await retryWithBackoff(() =>
      sheetsClient.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: batch
        }
      })
    );
    
    written += batch.length;
    if (i + 20 < toWrite.length) {
      await sleep(2000);
    }
  }
  
  console.log(`   ✅ Headers: ${written} written, ${skipped} unchanged`);
  return { total: requiredSheets.length, written, skipped };
}

async function seedAdminPowerMenu(
  sheetsClient: sheets_v4.Sheets,
  spreadsheetId: string
): Promise<void> {
  console.log("\n🎛️  Seeding Admin Power Menu...");
  
  if (DRY_RUN) {
    console.log("   [DRY-RUN] Skipping seed data");
    return;
  }
  
  if (!ADMIN_POWER_MENU.seedData) {
    console.log("   ℹ️  No seed data defined");
    return;
  }
  
  const existing = await retryWithBackoff(() =>
    sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range: "Admin_PowerMenu!A2:G"
    })
  );
  
  if (existing.data.values && existing.data.values.length > 0) {
    console.log("   ℹ️  Already seeded (skipping)");
    return;
  }
  
  await retryWithBackoff(() =>
    sheetsClient.spreadsheets.values.update({
      spreadsheetId,
      range: "Admin_PowerMenu!A2",
      valueInputOption: "RAW",
      requestBody: {
        values: ADMIN_POWER_MENU.seedData
      }
    })
  );
  
  console.log(`   ✅ Seeded ${ADMIN_POWER_MENU.seedData.length} menu items`);
}

async function applyFormatting(
  sheetsClient: sheets_v4.Sheets,
  spreadsheetId: string,
  requiredSheets: SheetDefinition[]
): Promise<void> {
  console.log("\n🎨 Applying formatting...");
  
  const meta = await retryWithBackoff(() =>
    sheetsClient.spreadsheets.get({ spreadsheetId })
  );
  
  const sheetIdMap = new Map<string, number>();
  (meta.data.sheets || []).forEach(s => {
    sheetIdMap.set(s.properties!.title!, s.properties!.sheetId!);
  });
  
  const requests: sheets_v4.Schema$Request[] = [];
  
  requiredSheets.forEach(def => {
    const sheetId = sheetIdMap.get(def.name);
    if (sheetId == null) return;
    
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: def.headers.length
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.2, green: 0.66, blue: 0.65 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 11
            },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE"
          }
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
      }
    });
    
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: def.freezeRows || 1,
            frozenColumnCount: def.freezeColumns || 0
          }
        },
        fields: "gridProperties(frozenRowCount,frozenColumnCount)"
      }
    });
    
    requests.push({
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: "COLUMNS",
          startIndex: 0,
          endIndex: def.headers.length
        }
      }
    });
    
    if (def.numericColumns) {
      def.numericColumns.forEach(colName => {
        const idx = def.headers.indexOf(colName);
        if (idx >= 0) {
          requests.push({
            repeatCell: {
              range: {
                sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: idx,
                endColumnIndex: idx + 1
              },
              cell: {
                userEnteredFormat: {
                  numberFormat: { type: "NUMBER", pattern: "#,##0.00" }
                }
              },
              fields: "userEnteredFormat.numberFormat"
            }
          });
        }
      });
    }
  });
  
  if (DRY_RUN) {
    console.log(`   [DRY-RUN] Would apply ${requests.length} formatting rules`);
    return;
  }
  
  for (let i = 0; i < requests.length; i += 50) {
    const batch = requests.slice(i, i + 50);
    await retryWithBackoff(() =>
      sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: batch }
      })
    );
    
    if (i + 50 < requests.length) await sleep(500);
  }
  
  console.log(`   ✅ Formatting applied`);
}

async function generateValidationReport(
  sheetsClient: sheets_v4.Sheets,
  spreadsheetId: string,
  requiredSheets: SheetDefinition[]
): Promise<void> {
  console.log("\n📊 Generating validation report...");
  
  const meta = await retryWithBackoff(() =>
    sheetsClient.spreadsheets.get({ spreadsheetId })
  );
  
  const existingTitles = new Set((meta.data.sheets || []).map(s => s.properties!.title!));
  const requiredTitles = new Set(requiredSheets.map(s => s.name));
  
  const missing = Array.from(requiredTitles).filter(t => !existingTitles.has(t));
  const unexpected = Array.from(existingTitles).filter(t => !requiredTitles.has(t) && t !== "README");
  
  console.log("\n" + "=".repeat(72));
  console.log("📋 VALIDATION REPORT");
  console.log("=".repeat(72));
  console.log(`Total sheets required: ${requiredSheets.length}`);
  console.log(`Total sheets found: ${existingTitles.size}`);
  console.log(`Missing sheets: ${missing.length}`);
  console.log(`Unexpected sheets: ${unexpected.length}`);
  
  if (missing.length > 0) {
    console.log("\n⚠️  Missing sheets:");
    missing.forEach(s => console.log(`   - ${s}`));
  }
  
  if (unexpected.length > 0) {
    console.log("\n⚠️  Unexpected sheets:");
    unexpected.forEach(s => console.log(`   - ${s}`));
  }
  
  if (missing.length === 0 && unexpected.length === 0) {
    console.log("\n✅ All sheets validated successfully!");
  }
  
  console.log("=".repeat(72) + "\n");
}

// ==================== MAIN ====================

async function main() {
  console.log("╔" + "=".repeat(70) + "╗");
  console.log("║" + "  🏗️  HAIROTICMEN Trading OS - Spreadsheet Builder V4".padEnd(71) + "║");
  console.log("╚" + "=".repeat(70) + "╝");
  console.log(`\nMode: ${DRY_RUN ? "🔍 DRY-RUN" : "🚀 EXECUTION"}`);
  console.log(`Spreadsheet ID: ${EXISTING_SPREADSHEET_ID}`);
  console.log(`Total sheets to create: ${ALL_SHEETS.length}\n`);
  
  const sheetsClient = await getUncachableGoogleSheetClient();
  
  const existing = await scanExistingSheets(sheetsClient, EXISTING_SPREADSHEET_ID);
  console.log(`\n📊 Found ${existing.length} existing sheets`);
  
  const { removed, kept } = await detectAndRemoveDuplicates(
    sheetsClient,
    EXISTING_SPREADSHEET_ID,
    existing
  );
  
  await ensureAllSheetsExist(sheetsClient, EXISTING_SPREADSHEET_ID, ALL_SHEETS, kept);
  
  await writeAllHeaders(sheetsClient, EXISTING_SPREADSHEET_ID, ALL_SHEETS);
  
  await seedAdminPowerMenu(sheetsClient, EXISTING_SPREADSHEET_ID);
  
  await applyFormatting(sheetsClient, EXISTING_SPREADSHEET_ID, ALL_SHEETS);
  
  await generateValidationReport(sheetsClient, EXISTING_SPREADSHEET_ID, ALL_SHEETS);
  
  console.log("\n✅ Spreadsheet structure complete!");
  console.log(`\n📎 URL: https://docs.google.com/spreadsheets/d/${EXISTING_SPREADSHEET_ID}/edit`);
  console.log("\n📝 Next steps:");
  console.log("   1. Check Admin_PowerMenu sheet for all available tools");
  console.log("   2. Run: 02-seed-configuration-data.ts");
  console.log("   3. Run: 03-seed-product-data.ts\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("\n❌ Fatal error:", error);
    process.exit(1);
  });
}

export { main };
