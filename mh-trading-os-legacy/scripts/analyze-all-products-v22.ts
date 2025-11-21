/**
 * V2.2 Product Analysis - Comprehensive Test
 * Analyzes guardrail coverage, autotune recommendations, and bundling proposals
 */

import { getPricingEngine } from '../lib/pricing-engine-v2';
import { recommendBundlesForSKU } from '../lib/bundling';

const engine = getPricingEngine();

// Sample test products covering different price ranges and lines
const testProducts = [
  // Low-price products (should benefit most from V2.2)
  { sku: 'TEST-LOW-1', line: 'Basic', factoryUnitManual: 0.80, netContentMl: 30, boxSize: 'Small' },
  { sku: 'TEST-LOW-2', line: 'Basic', factoryUnitManual: 1.00, netContentMl: 50, boxSize: 'Small' },
  { sku: 'TEST-LOW-3', line: 'Tools', factoryUnitManual: 1.50, netContentMl: 75, boxSize: 'Small' },
  
  // Mid-price products
  { sku: 'TEST-MID-1', line: 'Professional', factoryUnitManual: 1.68, netContentMl: 50, boxSize: 'Small' },
  { sku: 'TEST-MID-2', line: 'Professional', factoryUnitManual: 2.00, netContentMl: 75, boxSize: 'Medium' },
  { sku: 'TEST-MID-3', line: 'Basic', factoryUnitManual: 1.24, netContentMl: 50, boxSize: 'Small' },
  
  // High-price products
  { sku: 'TEST-HIGH-1', line: 'Premium', factoryUnitManual: 3.50, netContentMl: 100, boxSize: 'Medium' },
  { sku: 'TEST-HIGH-2', line: 'Skin', factoryUnitManual: 4.00, netContentMl: 150, boxSize: 'Medium' },
  { sku: 'TEST-HIGH-3', line: 'Professional', factoryUnitManual: 3.00, netContentMl: 100, boxSize: 'Medium' },
];

function analyzeProducts() {
  console.log('\n📊 V2.2 PRODUCT ANALYSIS');
  console.log('='.repeat(80));
  
  const results = {
    total: 0,
    coverageOwnStore: 0,
    coverageFBM: 0,
    coverageFBA: 0,
    autotuneOK: 0,
    autotuneRaise: 0,
    autotuneBundle: 0,
  };
  
  const raiseRecommendations: any[] = [];
  const bundleRecommendations: any[] = [];
  
  console.log('\n📦 Analyzing Products...\n');
  
  for (const testData of testProducts) {
    results.total++;
    
    // Prepare product input
    const product = {
      ...testData,
      shippingInboundPerUnit: testData.factoryUnitManual * 0.15,
      eprLucid: 0.02,
      gs1: 0.01,
      retailPackaging: 0.08,
      qcPif: 0.02,
      operations: 0.05,
      marketing: 0.05,
      amazonTierKey: 'Std_Parcel_S',
    };
    
    // Calculate pricing
    const pricing = engine.calculateProductPricing(product);
    
    // Get bundle recommendations if needed
    let bundles: any[] = [];
    let bestBundle: any = null;
    if (pricing.autotuneAction === 'BUNDLE_RECOMMENDED') {
      bundles = recommendBundlesForSKU(product);
      bestBundle = bundles[0];
    }
    
    // Check guardrail coverage (use bundle coverage if bundling recommended)
    if (bestBundle) {
      // Use bundle's coverage flags
      if (bestBundle.okOwn) results.coverageOwnStore++;
      if (bestBundle.okFBM) results.coverageFBM++;
      if (bestBundle.okFBA) results.coverageFBA++;
    } else {
      // Use single-unit coverage
      if (pricing.guardrails.OwnStore <= pricing.uvpInc99) {
        results.coverageOwnStore++;
      }
      if (pricing.guardrails.Amazon_FBM <= pricing.uvpInc99) {
        results.coverageFBM++;
      }
      if (pricing.guardrails.Amazon_FBA <= pricing.uvpInc99) {
        results.coverageFBA++;
      }
    }
    
    // Check autotune action
    if (pricing.autotuneAction === 'OK') {
      results.autotuneOK++;
      console.log(`✅ ${pricing.sku.padEnd(20)} ${pricing.line.padEnd(15)} UVP €${pricing.uvpInc99.toFixed(2)} - OK`);
    } else if (pricing.autotuneAction === 'RAISE_UVP') {
      results.autotuneRaise++;
      raiseRecommendations.push({
        sku: pricing.sku,
        line: pricing.line,
        originalUvp: pricing.autotuneOriginalUvpInc99?.toFixed(2),
        newUvp: pricing.uvpInc99.toFixed(2),
        increase: pricing.autotunePctIncrease?.toFixed(1) + '%',
      });
      console.log(`📈 ${pricing.sku.padEnd(20)} ${pricing.line.padEnd(15)} UVP €${pricing.autotuneOriginalUvpInc99?.toFixed(2)} → €${pricing.uvpInc99.toFixed(2)} (+${pricing.autotunePctIncrease?.toFixed(1)}%)`);
    } else if (pricing.autotuneAction === 'BUNDLE_RECOMMENDED') {
      results.autotuneBundle++;
      
      const maxGuardrail = Math.max(
        pricing.guardrails.OwnStore,
        pricing.guardrails.Amazon_FBM,
        pricing.guardrails.Amazon_FBA
      );
      
      bundleRecommendations.push({
        sku: pricing.sku,
        line: pricing.line,
        uvp: pricing.uvpInc99.toFixed(2),
        maxGuardrail: maxGuardrail.toFixed(2),
        increaseNeeded: pricing.autotunePctIncrease?.toFixed(1) + '%',
        bundle: bestBundle,
      });
      
      if (bestBundle) {
        const channels = [
          bestBundle.okOwn ? '✓Own' : '✗Own',
          bestBundle.okFBM ? '✓FBM' : '✗FBM',
          bestBundle.okFBA ? '✓FBA' : '✗FBA'
        ].join(' ');
        console.log(`📦 ${pricing.sku.padEnd(20)} ${pricing.line.padEnd(15)} UVP €${pricing.uvpInc99.toFixed(2)} → Bundle ${bestBundle.units}x @ €${bestBundle.proposedUvpInc99.toFixed(2)} [${channels}]`);
      } else {
        console.log(`📦 ${pricing.sku.padEnd(20)} ${pricing.line.padEnd(15)} UVP €${pricing.uvpInc99.toFixed(2)} - BUNDLE (+${pricing.autotunePctIncrease?.toFixed(1)}%)`);
      }
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📈 GUARDRAIL COVERAGE SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Products: ${results.total}`);
  console.log(`\n🛡️ Coverage by Channel:`);
  console.log(`   OwnStore:    ${results.coverageOwnStore}/${results.total} (${(results.coverageOwnStore/results.total*100).toFixed(1)}%)`);
  console.log(`   Amazon FBM:  ${results.coverageFBM}/${results.total} (${(results.coverageFBM/results.total*100).toFixed(1)}%)`);
  console.log(`   Amazon FBA:  ${results.coverageFBA}/${results.total} (${(results.coverageFBA/results.total*100).toFixed(1)}%)`);
  
  // Go/No-Go Decision
  const ownStoreCoverage = (results.coverageOwnStore / results.total) * 100;
  const amazonCoverage = Math.min(
    (results.coverageFBM / results.total) * 100,
    (results.coverageFBA / results.total) * 100
  );
  
  console.log(`\n🎯 GO/NO-GO CRITERIA:`);
  console.log(`   OwnStore ≥95%:  ${ownStoreCoverage >= 95 ? '✅ PASS' : '❌ FAIL'} (${ownStoreCoverage.toFixed(1)}%)`);
  console.log(`   Amazon ≥90%:    ${amazonCoverage >= 90 ? '✅ PASS' : '❌ FAIL'} (${amazonCoverage.toFixed(1)}%)`);
  
  if (ownStoreCoverage >= 95 && amazonCoverage >= 90) {
    console.log(`\n🚀 PRODUCTION READY - V2.2 meets all criteria!`);
  } else {
    console.log(`\n⚠️  NEEDS TUNING - See recommendations below`);
  }
  
  console.log(`\n🤖 AUTOTUNE ACTIONS:`);
  console.log(`   ✅ OK (No Action):       ${results.autotuneOK}`);
  console.log(`   📈 RAISE_UVP (Auto):     ${results.autotuneRaise}`);
  console.log(`   📦 BUNDLE (>25%):        ${results.autotuneBundle}`);
  
  // Print bundling recommendations table
  if (bundleRecommendations.length > 0) {
    console.log(`\n📦 BUNDLING RECOMMENDATIONS (Best Solutions):`);
    console.log('─'.repeat(80));
    console.log('SKU'.padEnd(20) + 'Line'.padEnd(15) + 'Units'.padEnd(8) + 'Price'.padEnd(10) + 'Coverage'.padEnd(25));
    console.log('─'.repeat(80));
    
    bundleRecommendations.slice(0, 10).forEach(rec => {
      if (rec.bundle) {
        const b = rec.bundle;
        const coverage = [
          b.okOwn ? '✓Own' : '✗Own',
          b.okFBM ? '✓FBM' : '✗FBM',
          b.okFBA ? '✓FBA' : '✗FBA'
        ].join(' ');
        console.log(
          rec.sku.padEnd(20) +
          rec.line.padEnd(15) +
          `${b.units}x`.padEnd(8) +
          `€${b.proposedUvpInc99.toFixed(2)}`.padEnd(10) +
          coverage
        );
      }
    });
    
    console.log('\n💡 Bundle Strategy:');
    const withFBA = bundleRecommendations.filter(r => r.bundle?.okFBA).length;
    const withFBM = bundleRecommendations.filter(r => r.bundle?.okFBM).length;
    const withOwn = bundleRecommendations.filter(r => r.bundle?.okOwn).length;
    console.log(`   • ${withFBA}/${bundleRecommendations.length} bundles meet Amazon FBA guardrails`);
    console.log(`   • ${withFBM}/${bundleRecommendations.length} bundles meet Amazon FBM guardrails`);
    console.log(`   • ${withOwn}/${bundleRecommendations.length} bundles meet OwnStore guardrails`);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ANALYSIS COMPLETE');
  console.log('='.repeat(80));
  
  console.log('\n💡 V2.2 IMPROVEMENTS vs V2.1:');
  console.log('   • Target margin: 45% → 38% (-7pp aggressive)');
  console.log('   • Ad% reduced across all lines (-1-3pp)');
  console.log('   • Channel-specific ad% (Amazon -2-3pp)');
  console.log('   • Box cost optimization (1.3 → 1.8 avg units)');
  console.log('   • GWP funding (50% funded)');
  console.log('   • Autotune UVP (up to +25% automatic)');
  console.log('   • Bundling engine (2-6 units, price ladder optimization)');
}

// Run analysis
analyzeProducts();
