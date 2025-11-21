/**
 * Bootstrap Google Sheets - Single Source of Truth
 * =================================================
 * 
 * This script initializes ALL 92 required Google Sheets tabs for MH Trading OS.
 * It uses server/lib/ensure-sheets.ts as the single canonical schema source.
 * 
 * REPLACES: Old init-google-sheets system (archived to docs/archive/)
 * 
 * WHAT IT DOES:
 * ✅ Creates all 92 production sheets from REQUIRED_SHEETS array
 * ✅ Sets up headers with correct column names
 * ✅ Applies numeric formatting (removes € symbols from numbers)
 * ✅ Freezes header rows (where specified)
 * ✅ Protects system sheets (where specified)
 * ✅ Seeds initial data (where specified)
 * ✅ Idempotent - safe to run multiple times
 * 
 * SCHEMA SOURCE:
 * - server/lib/ensure-sheets.ts → REQUIRED_SHEETS (92 definitions)
 * 
 * USAGE:
 *   npm run bootstrap-sheets
 */

import { bootstrapAllSheets } from '../lib/ensure-sheets-v2';

console.log('╔═══════════════════════════════════════════════════════════════════╗');
console.log('║  HAIROTICMEN Trading OS - Complete Sheet Regeneration            ║');
console.log('║  Schema: server/lib/ensure-sheets.ts (92 sheets)                 ║');
console.log('╚═══════════════════════════════════════════════════════════════════╝');
console.log('');

bootstrapAllSheets()
  .then((result) => {
    if (result.success) {
      console.log('\n🎉 SUCCESS: All sheets bootstrapped successfully!');
      console.log('\n📋 Next Steps:');
      console.log('   1. Run pricing calculation to populate FinalPriceList calculated fields');
      console.log('   2. Validate pricing rules and compliance');
      console.log('   3. Test all app workflows (quotes, orders, stand ops)');
      console.log('   4. Update OS_Health dashboard');
      process.exit(0);
    } else {
      console.log('\n⚠️  WARNING: Bootstrap completed with some errors');
      console.log(`   - Check OS_Health sheet for details`);
      console.log(`   - Review error messages above`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n❌ FATAL ERROR:', error);
    process.exit(1);
  });
