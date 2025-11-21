import { sheetsService } from '../lib/sheets';

/**
 * Fix pricing data gaps: COGS, FullCost, QRUrl, and missing percentages
 * This script addresses the root causes of "Infinity" in pricing calculations
 */

interface CostComponents {
  factoryCost: number;
  packaging: number;
  freight: number;
  importDuty: number;
  overhead: number;
}

interface ProductRow {
  SKU: string;
  Name: string;
  Barcode: string;
  Factory_Cost_EUR: number;
  Packaging_Cost_EUR: number;
  Freight_kg_EUR: number;
  Import_Duty_Pct: number;
  Overhead_Pct: number;
  COGS_EUR?: number;
  FullCost_EUR?: number;
  Shipping_Inbound_per_unit: number;
  EPR_LUCID_per_unit: number;
  GS1_per_unit: number;
  Retail_Packaging_per_unit: number;
  QC_PIF_per_unit: number;
  Operations_per_unit: number;
  Marketing_per_unit: number;
  QRUrl?: string;
  Ad_Pct?: number;
  Returns_Pct?: number;
  Loyalty_Pct?: number;
  Payment_Pct?: number;
  Amazon_Referral_Pct?: number;
}

// Default percentages from system parameters
const DEFAULTS = {
  Ad_Pct: 3,
  Returns_Pct: 2,
  Loyalty_Pct: 1,
  Payment_Pct: 2,
  Amazon_Referral_Pct: 15,
};

function calculateCOGS(components: CostComponents): number {
  const { factoryCost, packaging, freight, importDuty, overhead } = components;
  
  // COGS = Factory × (1 + Import_Duty_Pct/100) × (1 + Overhead_Pct/100) + Packaging + Freight
  // This ensures compounding effects are properly calculated
  const factoryWithDuty = factoryCost * (1 + importDuty / 100);
  const factoryWithDutyAndOverhead = factoryWithDuty * (1 + overhead / 100);
  
  return factoryWithDutyAndOverhead + packaging + freight;
}

function calculateFullCost(product: ProductRow, cogs: number): number {
  // FullCost = COGS + all per-unit costs
  const components = [
    cogs,
    product.Shipping_Inbound_per_unit || 0,
    product.EPR_LUCID_per_unit || 0,
    product.GS1_per_unit || 0,
    product.Retail_Packaging_per_unit || 0,
    product.QC_PIF_per_unit || 0,
    product.Operations_per_unit || 0,
    product.Marketing_per_unit || 0,
  ];
  
  return components.reduce((sum, val) => sum + val, 0);
}

function generateQRUrl(sku: string, barcode: string): string {
  // Generate product URL for QR code
  // Format: https://hairoticmen.de/products/{SKU}
  // If no barcode, use SKU-based URL
  if (barcode && barcode.trim() !== '') {
    return `https://hairoticmen.de/products/${sku}?barcode=${barcode}`;
  }
  return `https://hairoticmen.de/products/${sku}`;
}

async function fixPricingGaps(forceRecalculate: boolean = false) {
  console.log('🔧 FIXING PRICING DATA GAPS');
  console.log('═'.repeat(100));
  console.log('This script will:');
  console.log('  1. Calculate missing COGS_EUR');
  console.log('  2. Calculate missing FullCost_EUR');
  console.log('  3. Generate QRUrl for products');
  console.log('  4. Fill default percentages (Ad_Pct, Returns_Pct, etc.)');
  if (forceRecalculate) {
    console.log('  ⚠️  FORCE MODE: Recalculating ALL products (even if values exist)');
  }
  console.log('═'.repeat(100));
  
  // Read all products
  console.log('\n📖 Reading FinalPriceList...');
  const { headers, rows: dataRows } = await sheetsService.readSheetRaw('FinalPriceList');
  console.log(`   Found ${dataRows.length} products\n`);
  
  const products: any[] = dataRows.map((row: any) => {
    const product: any = {};
    headers.forEach((header, idx) => {
      product[header] = row[idx] || '';
    });
    return product;
  });
  
  // Track what we're fixing
  let fixedCOGS = 0;
  let fixedFullCost = 0;
  let fixedQRUrl = 0;
  let fixedPercentages = 0;
  const updates: Array<{ matchValue: string; data: any }> = [];
  
  console.log('🔍 Analyzing products...\n');
  
  for (const product of products) {
    const sku = product.SKU;
    if (!sku) continue;
    
    const updateData: any = {};
    let needsUpdate = false;
    
    // Parse numbers safely
    const factoryCost = parseFloat(String(product.Factory_Cost_EUR || '0').replace('€', '')) || 0;
    const packaging = parseFloat(String(product.Packaging_Cost_EUR || '0')) || 0;
    const freight = parseFloat(String(product.Freight_kg_EUR || '0')) || 0;
    const importDuty = parseFloat(String(product.Import_Duty_Pct || '0')) || 0;
    const overhead = parseFloat(String(product.Overhead_Pct || '0')) || 0;
    
    // 1. Fix COGS_EUR if missing (or force recalculate)
    const currentCOGS = String(product.COGS_EUR || '').trim();
    if ((forceRecalculate || !currentCOGS) && factoryCost > 0) {
      const cogs = calculateCOGS({ factoryCost, packaging, freight, importDuty, overhead });
      updateData.COGS_EUR = cogs.toFixed(2);
      needsUpdate = true;
      fixedCOGS++;
      console.log(`   ✓ ${sku}: COGS_EUR = €${cogs.toFixed(2)}`);
    }
    
    // 2. Fix FullCost_EUR if missing (or force recalculate)
    const currentFullCost = String(product.FullCost_EUR || '').trim();
    if ((forceRecalculate || !currentFullCost) && factoryCost > 0) {
      const cogs = updateData.COGS_EUR ? parseFloat(updateData.COGS_EUR) : 
                   parseFloat(String(product.COGS_EUR || '0').replace('€', '')) || 0;
      
      if (cogs > 0) {
        // Parse all per-unit costs
        const productRow: ProductRow = {
          SKU: product.SKU,
          Name: product.Name,
          Barcode: product.Barcode,
          Factory_Cost_EUR: factoryCost,
          Packaging_Cost_EUR: packaging,
          Freight_kg_EUR: freight,
          Import_Duty_Pct: importDuty,
          Overhead_Pct: overhead,
          Shipping_Inbound_per_unit: parseFloat(String(product.Shipping_Inbound_per_unit || '0').replace('€', '')) || 0,
          EPR_LUCID_per_unit: parseFloat(String(product.EPR_LUCID_per_unit || '0').replace('€', '')) || 0,
          GS1_per_unit: parseFloat(String(product.GS1_per_unit || '0').replace('€', '')) || 0,
          Retail_Packaging_per_unit: parseFloat(String(product.Retail_Packaging_per_unit || '0').replace('€', '')) || 0,
          QC_PIF_per_unit: parseFloat(String(product.QC_PIF_per_unit || '0')) || 0,
          Operations_per_unit: parseFloat(String(product.Operations_per_unit || '0')) || 0,
          Marketing_per_unit: parseFloat(String(product.Marketing_per_unit || '0')) || 0,
        };
        
        const fullCost = calculateFullCost(productRow, cogs);
        if (fullCost && !isNaN(fullCost) && isFinite(fullCost)) {
          updateData.FullCost_EUR = fullCost.toFixed(2);
          needsUpdate = true;
          fixedFullCost++;
          console.log(`   ✓ ${sku}: FullCost_EUR = €${fullCost.toFixed(2)}`);
        }
      }
    }
    
    // 3. Generate QRUrl if missing
    const currentQRUrl = String(product.QRUrl || '').trim();
    if (!currentQRUrl && sku) {
      const barcode = String(product.Barcode || '').trim();
      const qrUrl = generateQRUrl(sku, barcode);
      updateData.QRUrl = qrUrl;
      needsUpdate = true;
      fixedQRUrl++;
      if (fixedQRUrl <= 5) {
        console.log(`   ✓ ${sku}: QRUrl = ${qrUrl}`);
      }
    }
    
    // 4. Fill default percentages if missing
    const percentageFields = ['Ad_Pct', 'Returns_Pct', 'Loyalty_Pct', 'Payment_Pct', 'Amazon_Referral_Pct'];
    for (const field of percentageFields) {
      const currentValue = String(product[field] || '').trim();
      if (!currentValue) {
        updateData[field] = DEFAULTS[field as keyof typeof DEFAULTS];
        needsUpdate = true;
        fixedPercentages++;
      }
    }
    
    if (needsUpdate) {
      updates.push({
        matchValue: sku,
        data: updateData,
      });
    }
  }
  
  console.log('\n📊 SUMMARY:');
  console.log(`   Products needing fixes: ${updates.length}`);
  console.log(`   COGS_EUR calculated: ${fixedCOGS}`);
  console.log(`   FullCost_EUR calculated: ${fixedFullCost}`);
  console.log(`   QRUrl generated: ${fixedQRUrl}`);
  console.log(`   Percentages filled: ${fixedPercentages}`);
  
  if (updates.length === 0) {
    console.log('\n✅ All data complete - no fixes needed!');
    return;
  }
  
  // Apply updates using batchUpdateRows (rate-limit safe)
  console.log(`\n💾 Writing ${updates.length} product updates to Google Sheets...`);
  console.log('   Using batchUpdateRows (rate-limit optimized)');
  
  const updatedCount = await sheetsService.batchUpdateRows(
    'FinalPriceList',
    'SKU',
    updates
  );
  
  console.log(`\n✅ Successfully updated ${updatedCount} products!`);
  console.log('\n📝 Next Steps:');
  console.log('   1. Run pricing sync: npm run pricing:sync');
  console.log('   2. Generate QR codes: tsx server/scripts/generate-all-qr-codes.ts');
  console.log('   3. Verify data: Check Pricing Studio for Infinity values');
}

// Parse command-line arguments
const args = process.argv.slice(2);
const forceRecalculate = args.includes('--force') || args.includes('-f');

// Run the script
fixPricingGaps(forceRecalculate)
  .then(() => {
    console.log('\n✅ PRICING GAPS FIXED SUCCESSFULLY!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  });
