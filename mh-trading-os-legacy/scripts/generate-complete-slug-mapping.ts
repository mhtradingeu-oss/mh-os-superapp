/**
 * Generate complete SKU → slug mapping for all 89 products
 * Strategy: Use verified slugs where available, generate slugs for variants,
 * and create fallback slugs for unmapped products
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Helper: Convert product name to URL-friendly slug
function generateSlug(productName: string): string {
  return productName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Base slug mapping (verified from website)
const VERIFIED_SLUGS: Record<string, string> = {
  'BAR-BEARDKIT6I-001': 'hairoticmen-beard-kit-6-in-1-premium-bartpflege-set',
  'BAR-BEARDKIT3I-002': 'beard-kit-3-in-1',
  'BAR-BEARDOIL50-003': 'argan-beard-oil-magnetbox',
  'BAR-BEARDOIL50-004': 'argan-beard-oil',
  'BAR-BEARDSHAMP-005': 'beard-shampoo',
  'BAR-BEARDTONIC-006': 'beard-tonic',
  'HAI-SILICONVEL-007': 'hair-silicone-velvet',
  'BAR-BEARDBRUSH-009': 'beard-brush',
  'SHA-ADRENALIN-010': 'shaving-gel', // 500ML
  'AFT-DEEPSKY50-028': 'after-shave-balm-pflege-und-regeneration',
  'COL-DIAMOND50-036': 'aftershave-cologne',
  'TAN-TANNINGOIL-073': 'tanning-oil',
  'FAC-BRIGHTENING-076': 'brightening-cream-3-in-1',
  'FAC-FACESCRUB-077': 'face-scrub-black-und-mint',
  'ACC-ALCOHOLSPR-084': 'alkohol-sabri-ethanol-70',
  'ACC-STAINREMO-085': 'stain-remover',
  'KIT-PROTEIN1100-086': 'protein-treatment-kit',
  'KIT-SHAVEHAIRB-088': 'shaving-und-treatment-cream',
  'ACC-CLIPPERCAR-089': 'clipper-care-spray',
  'WAX-AQUASTRON-050': 'aqua-wax-perfekter-glanz-halt',
  'WAX-MATTECLAY-054': 'matte-clay-wax-matten-look',
  'WAX-MATTEFINI-055': 'matte-wax-naturliches-styling',
  'WAX-GENTLEWAX-056': 'haarwachs-gentle-150ml-naturlicher-halt-pflege',
  'WAX-BLACKWAX1-057': 'black-wax-ultra-styling',
  'WAX-SPIDERWAX-058': 'spider-wax',
  'HAI-VOLUMEPOW-059': 'volumen-haarpuder-20g-fur-flexibles-styling',
  'HAI-STYLINGCR-060': 'hair-styling-cream',
  'GEL-CLEARSTAN-061': 'hair-gel-clear',
  'GEL-BLACKGEL1-064': 'hair-gel-black',
  'GEL-MAXCONTRO-065': 'hair-gel-maximale-kontrolle',
  'HAI-SULFATEFR-074': 'sulfate-free-shampoo',
  'HAI-SULFATEFR-075': 'sulfate-free-conditioner',
  'FAC-PEELOFFMA-078': 'peel-off-mask',
  'HAI-LEAVEINCON-079': 'leave-in-conditioner',
  'HAI-BLACKSHAMP-080': 'black-shampoo-mit-mint',
  'HAI-BLACKCONDI-081': 'schwarzer-conditioner-mit-minz',
  'HAI-HAIRSPRAYM-082': 'hair-spray-mega-hold',
  'HAI-SILVERSHAM-083': 'silver-scent-shampoo',
};

// Variant mapping: Products that share the same page (size variants)
const VARIANT_MAPPING: Record<string, string> = {
  // Shaving Gels - all variants go to same page
  'SHA-ADRENALIN-011': 'shaving-gel', // 1100ML variant
  'SHA-CODERED50-012': 'shaving-gel',
  'SHA-CODERED11-013': 'shaving-gel',
  'SHA-DEEPSKY50-014': 'shaving-gel',
  'SHA-DEEPSKY11-015': 'shaving-gel',
  'SHA-DIAMOND50-016': 'shaving-gel',
  'SHA-DIAMOND11-017': 'shaving-gel',
  'SHA-EXOTIC500-018': 'shaving-gel',
  'SHA-EXOTIC110-019': 'shaving-gel',
  'SHA-GOLDSAND-020': 'shaving-gel',
  'SHA-GOLDSAND-021': 'shaving-gel',
  'SHA-INFINITE5-022': 'shaving-gel',
  'SHA-INFINITE1-023': 'shaving-gel',
  'SHA-JACKSPADE-024': 'shaving-gel',
  'SHA-JACKSPADE-025': 'shaving-gel',
  'SHA-MONARCHOR-026': 'shaving-gel',
  'SHA-MONARCHOR-027': 'shaving-gel',
  
  // Aftershave/Cologne - all variants share page
  'AFT-EXOTIC500-029': 'aftershave-cologne',
  'AFT-INFINITE5-030': 'aftershave-cologne',
  'AFT-ADRENALI-031': 'aftershave-cologne',
  'COL-ADRENALI-032': 'aftershave-cologne',
  'COL-ADRENALI-033': 'aftershave-cologne',
  'COL-CODERED50-034': 'aftershave-cologne',
  'COL-CODERED17-035': 'aftershave-cologne',
  'COL-DIAMOND17-037': 'aftershave-cologne',
  'COL-DEEPSKY50-038': 'aftershave-cologne',
  'COL-DEEPSKY17-039': 'aftershave-cologne',
  'COL-EXOTIC500-040': 'aftershave-cologne',
  'COL-EXOTIC175-041': 'aftershave-cologne',
  'COL-GOLDSAND-042': 'aftershave-cologne',
  'COL-GOLDSAND-043': 'aftershave-cologne',
  'COL-INFINITE5-044': 'aftershave-cologne',
  'COL-INFINITE1-045': 'aftershave-cologne',
  'COL-JACKSPADE-046': 'aftershave-cologne',
  'COL-JACKSPADE-047': 'aftershave-cologne',
  'COL-MONARCHOR-048': 'aftershave-cologne',
  'COL-MONARCHOR-049': 'aftershave-cologne',
  
  // Wax variants
  'WAX-AQUAULTRA-050': 'aqua-wax-perfekter-glanz-halt',
  'WAX-AQUAMEGA-051': 'aqua-wax-perfekter-glanz-halt',
  'WAX-AQUASTRONG-052': 'aqua-wax-perfekter-glanz-halt',
  'WAX-AQUAMAXIMUM-053': 'aqua-wax-perfekter-glanz-halt',
  'WAX-CLAY150ML-054': 'matte-clay-wax-matten-look',
  'WAX-MATTE150ML-055': 'matte-wax-naturliches-styling',
  'WAX-GENTLE150ML-056': 'haarwachs-gentle-150ml-naturlicher-halt-pflege',
  'WAX-BLACK150ML-057': 'black-wax-ultra-styling',
  'WAX-SPIDER150ML-058': 'spider-wax',
  'WAX-POWDER20GR-059': 'volumen-haarpuder-20g-fur-flexibles-styling',
  
  // Gel variants
  'GEL-CLEAR500ML-061': 'hair-gel-clear',
  'GEL-CLEAR1000ML-062': 'hair-gel-clear',
  'GEL-BLACK500ML-063': 'hair-gel-black',
  'GEL-BLACK1000ML-064': 'hair-gel-black',
  'GEL-STRONG1000-065': 'hair-gel-maximale-kontrolle',
  'GEL-STRONG500ML-066': 'hair-gel-maximale-kontrolle',
  'GEL-ULTRA1000ML-067': 'hair-gel-maximale-kontrolle',
  'GEL-ULTRA500ML-068': 'hair-gel-maximale-kontrolle',
  'GEL-MEGA1000ML-069': 'hair-gel-maximale-kontrolle',
  'GEL-MEGA500ML-070': 'hair-gel-maximale-kontrolle',
  'GEL-MAXIMUM1000-071': 'hair-gel-maximale-kontrolle',
  'GEL-MAXIMUM500ML-072': 'hair-gel-maximale-kontrolle',
  
  // Hair care variants
  'HAI-STYLING150-060': 'hair-styling-cream',
  'HAI-SULFATESH-074': 'sulfate-free-shampoo',
  'HAI-SULFATECO-075': 'sulfate-free-conditioner',
  'HAI-LEAVEINC-079': 'leave-in-conditioner',
  'HAI-BLACKMINTS-080': 'black-shampoo-mit-mint',
  'HAI-BLACKMINTC-081': 'schwarzer-conditioner-mit-minz',
  'HAI-SPRAYMEGA-082': 'hair-spray-mega-hold',
  'HAI-SILVERSCEN-083': 'silver-scent-shampoo',
  
  // Other products
  'BAR-BEARDBALM-008': 'beard-balm',
  'FAC-PEELOFFM-078': 'peel-off-mask',
  'KIT-PROTEIN500ML-087': 'protein-treatment-kit',
};

async function generateCompleteMapping() {
  console.log('\n🔨 Generating Complete SKU → Slug Mapping\n');
  console.log('═'.repeat(80));
  
  // Load products - resolve from script location
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const configPath = path.join(__dirname, '..', 'config', 'hairoticmen-pricing.json');
  const configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  const products = configData.products || [];
  
  const completeMapping: Record<string, { slug: string; url: string; verified: boolean }> = {};
  
  // Process all products
  for (const product of products) {
    const sku = product.SKU;
    let slug: string;
    let verified = false;
    
    if (VERIFIED_SLUGS[sku]) {
      slug = VERIFIED_SLUGS[sku];
      verified = true;
    } else if (VARIANT_MAPPING[sku]) {
      slug = VARIANT_MAPPING[sku];
      verified = false; // Variant pages may not exist separately
    } else {
      // Generate slug from product name
      slug = generateSlug(product.ProductName);
      verified = false;
    }
    
    completeMapping[sku] = {
      slug,
      url: `https://hairoticmen.de/product/${slug}/`,
      verified
    };
  }
  
  // Statistics
  const verifiedCount = Object.values(completeMapping).filter(m => m.verified).length;
  const variantCount = Object.keys(VARIANT_MAPPING).length;
  const generatedCount = products.length - verifiedCount - variantCount;
  
  console.log('📊 Mapping Statistics:\n');
  console.log(`   Total Products: ${products.length}`);
  console.log(`   ✅ Verified URLs: ${verifiedCount}`);
  console.log(`   🔗 Variant Mappings: ${variantCount}`);
  console.log(`   🤖 Generated Slugs: ${generatedCount}`);
  console.log(`   📦 Total Mapped: ${Object.keys(completeMapping).length}`);
  
  // Write to file - resolve from script location
  const outputPath = path.join(__dirname, '..', 'config', 'product-slug-mapping-complete.json');
  await fs.writeFile(outputPath, JSON.stringify({
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalProducts: products.length,
    verifiedUrls: verifiedCount,
    variantMappings: variantCount,
    generatedSlugs: generatedCount,
    mapping: completeMapping
  }, null, 2));
  
  console.log(`\n✅ Complete mapping written to: ${outputPath}\n`);
  console.log('═'.repeat(80));
  
  // Show sample URLs
  console.log('\n📋 Sample Product URLs:\n');
  const samples = Object.entries(completeMapping).slice(0, 10);
  samples.forEach(([sku, data]) => {
    const status = data.verified ? '✅' : '🔗';
    console.log(`   ${status} ${sku}: ${data.url}`);
  });
  console.log('\n');
  
  return completeMapping;
}

generateCompleteMapping().catch(console.error);
