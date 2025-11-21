/**
 * Analyze scanned sheets and compare with requirements
 */

import { readFile } from 'fs/promises';

async function analyze() {
  const report = JSON.parse(
    await readFile('server/scripts/scanned-sheets-report.json', 'utf-8')
  );

  console.log('📊 PRODUCTION GOOGLE SHEETS ANALYSIS\n');
  console.log(`Total Sheets: ${report.length}\n`);

  // Key sheets analysis
  const keySheets = [
    'FinalPriceList',
    'Settings',
    'Enums',
    'Quotes',
    'Packaging_Boxes',
    'ShippingWeightBands',
    'ShippingCostsFixed',
    'Orders',
    'PartnerRegistry',
    'CRM_Leads'
  ];

  console.log('🔑 KEY SHEETS:');
  console.log('─'.repeat(80));
  
  keySheets.forEach(name => {
    const sheet = report.find((s: any) => s.name === name);
    if (sheet) {
      console.log(`✅ ${name.padEnd(30)} ${String(sheet.headers.length).padStart(3)} columns`);
      if (name === 'FinalPriceList') {
        console.log('   Headers:', sheet.headers.slice(0, 10).join(', '), '...');
      }
    } else {
      console.log(`❌ ${name.padEnd(30)} MISSING`);
    }
  });

  console.log('\n📋 ALL SHEETS BY CATEGORY:\n');

  const categories = {
    'System': ['README', 'Settings', 'Enums', 'OS_Logs', 'OS_Health', 'Audit_Trail'],
    'Pricing': ['FinalPriceList', 'Pricing_Params', 'CompetitorPrices', 'MAP_Guardrails', 'Pricing_Suggestions'],
    'Partners': ['PartnerRegistry', 'PartnerTiers'],
    'Stands': ['StandSites', 'Stand_Inventory', 'Stand_Refill_Plans', 'Stand_Visits', 'Stand_KPIs'],
    'Sales': ['Quotes', 'QuoteLines', 'Orders', 'OrderLines'],
    'Shipping': ['Packaging_Boxes', 'ShippingWeightBands', 'ShippingCostsFixed', 'Shipping_Methods', 'Shipping_Rules', 'Shipments'],
    'CRM': ['CRM_Leads', 'Lead_Touches', 'Territories', 'Assignment_Rules', 'Enrichment_Queue'],
    'Marketing': ['Outreach_Campaigns', 'SEO_Keywords', 'Ads_Keywords', 'Social_Calendar'],
    'AI': ['AI_Crew', 'AI_Inbox', 'AI_Outbox', 'AI_Jobs', 'Agent_Profiles']
  };

  for (const [category, sheets] of Object.entries(categories)) {
    console.log(`\n${category}:`);
    sheets.forEach(name => {
      const sheet = report.find((s: any) => s.name === name);
      if (sheet) {
        console.log(`  ✅ ${name.padEnd(35)} ${String(sheet.headers.length).padStart(3)} cols`);
      } else {
        console.log(`  ❌ ${name.padEnd(35)} MISSING`);
      }
    });
  }

  // Check for sheets not in categories
  const categorizedSheets = new Set(Object.values(categories).flat());
  const uncategorized = report.filter((s: any) => !categorizedSheets.has(s.name));
  
  if (uncategorized.length > 0) {
    console.log('\n⚠️  UNCATEGORIZED SHEETS:');
    uncategorized.forEach((s: any) => {
      console.log(`  - ${s.name} (${s.headers.length} columns)`);
    });
  }

  // Generate final schema for validation script
  console.log('\n\n📝 GENERATING FINAL SCHEMA FOR VALIDATION SCRIPT...\n');
  
  const finalSchema = report
    .filter((s: any) => s.name !== 'README') // Skip README
    .map((s: any) => ({
      name: s.name,
      headers: s.headers,
      protected: ['Settings', 'FinalPriceList', 'OS_Logs', 'OS_Health'].includes(s.name)
    }));

  await writeFile(
    'server/scripts/final-production-schema.json',
    JSON.stringify(finalSchema, null, 2)
  );

  console.log(`✅ Generated final-production-schema.json with ${finalSchema.length} sheets`);
}

import { writeFile } from 'fs/promises';
analyze().catch(console.error);
