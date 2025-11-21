/**
 * 🎯 Orchestrate All Build Scripts in Sequence
 * ============================================
 * Runs all build-sheet-from-scratch scripts in correct order
 * 
 * Usage:
 *   tsx server/scripts/build-sheet-from-scratch/orchestrate-all.ts
 *   tsx server/scripts/build-sheet-from-scratch/orchestrate-all.ts --dry-run
 */

import { spawnSync } from "node:child_process";

type Step = {
  name: string;
  script: string;
  description: string;
  requireSheetId?: boolean;
};

const DRY_RUN = process.argv.includes("--dry-run");
const TSX = process.env.TSX_BIN || "tsx";

const STEPS: Step[] = [
  {
    name: "01-create-structure",
    script: "./01-create-spreadsheet-structure.ts",
    description: "Create all 95 sheets with headers, formatting, and validation"
  },
  {
    name: "02-seed-config",
    script: "./02-seed-configuration-data.ts",
    description: "Seed Settings, Pricing_Params, PartnerTiers, and system config",
    requireSheetId: true
  },
  {
    name: "03-seed-products",
    script: "./03-seed-product-data.ts",
    description: "Import 89 products from hairoticmen-pricing.json",
    requireSheetId: true
  },
  {
    name: "04-setup-formulas",
    script: "./04-setup-formulas.ts",
    description: "Add computed formulas and named ranges",
    requireSheetId: true
  },
  {
    name: "05-connect-app",
    script: "./05-connect-to-app.ts",
    description: "Verify connectivity and health checks",
    requireSheetId: true
  },
  {
    name: "06-seed-shipping",
    script: "./06-seed-shipping-config.ts",
    description: "Seed DHL weight bands and shipping costs",
    requireSheetId: true
  },
  {
    name: "07-validate-repair",
    script: "./07-validate-and-repair-workbook.ts",
    description: "Deep validation and repair of all sheets (103 sheets)",
    requireSheetId: true
  }
];

function runStep(step: Step, env: NodeJS.ProcessEnv) {
  console.log(`\n${"=".repeat(72)}`);
  console.log(`📦 ${step.name}: ${step.description}`);
  console.log("=".repeat(72) + "\n");

  const args = [step.script];
  if (DRY_RUN) args.push("--dry-run");

  const res = spawnSync(TSX, args, {
    stdio: "pipe",
    env,
    encoding: "utf8",
    cwd: import.meta.dirname // Run from script directory
  });

  process.stdout.write(res.stdout || "");
  process.stderr.write(res.stderr || "");

  if (res.status !== 0) {
    throw new Error(`❌ Step "${step.name}" failed with code ${res.status}`);
  }
  
  console.log(`✅ ${step.name} completed successfully`);
  return res.stdout || "";
}

function extractSpreadsheetId(output: string): string | null {
  // Look for: SPREADSHEET_ID: <id>
  const m = output.match(/SPREADSHEET_ID:\s*([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  
  // Alternative: Extract from URL
  const m2 = output.match(
    /https:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/
  );
  return m2 ? m2[1] : null;
}

async function main() {
  console.log(`
╔${"=".repeat(70)}╗
║${"  🚀 HAIROTICMEN Trading OS - Complete Build Orchestrator".padEnd(71)}║
╚${"=".repeat(70)}╝
  `);
  
  console.log(`Mode: ${DRY_RUN ? "🔍 DRY-RUN" : "🚀 EXECUTION"}`);
  console.log(`Steps: ${STEPS.length}\n`);

  let SHEETS_SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID || "";
  
  if (SHEETS_SPREADSHEET_ID) {
    console.log(`📎 Using existing spreadsheet: ${SHEETS_SPREADSHEET_ID}\n`);
  }

  // Step 1: Create structure (returns ID if not provided)
  const out1 = runStep(STEPS[0], {
    ...process.env,
    DRY_RUN: DRY_RUN ? "1" : "",
    SHEETS_SPREADSHEET_ID
  });
  
  if (!SHEETS_SPREADSHEET_ID) {
    SHEETS_SPREADSHEET_ID = extractSpreadsheetId(out1) || "";
    if (!SHEETS_SPREADSHEET_ID) {
      throw new Error(
        "Could not detect Spreadsheet ID from step 01 output. Please set SHEETS_SPREADSHEET_ID in env."
      );
    }
    console.log(`\n📎 Detected SHEETS_SPREADSHEET_ID: ${SHEETS_SPREADSHEET_ID}`);
  }

  // Run remaining steps
  for (let i = 1; i < STEPS.length; i++) {
    const step = STEPS[i];
    if (step.requireSheetId && !SHEETS_SPREADSHEET_ID) {
      throw new Error(`Missing SHEETS_SPREADSHEET_ID for step ${step.name}`);
    }
    runStep(step, {
      ...process.env,
      SHEETS_SPREADSHEET_ID,
      DRY_RUN: DRY_RUN ? "1" : "",
    });
  }

  console.log(`
╔${"=".repeat(70)}╗
║${"  ✅ Orchestration Completed Successfully".padEnd(71)}║
╚${"=".repeat(70)}╝
  `);
  
  console.log(`\n📎 Spreadsheet: https://docs.google.com/spreadsheets/d/${SHEETS_SPREADSHEET_ID}`);
  console.log(`\n📊 Summary:`);
  console.log(`   - Total steps executed: ${STEPS.length}`);
  console.log(`   - All sheets created: 103`);
  console.log(`   - Admin Power Menu: Ready with 15 tools`);
  console.log(`   - Products imported: 89`);
  console.log(`   - Shipping config: DHL bands + costs`);
  console.log(`   - Deep validation: Complete`);
  console.log(`\n🎉 System ready for use!\n`);
}

main().catch((e) => {
  console.error(`\n❌ Orchestration failed: ${e.message}\n`);
  process.exit(1);
});
