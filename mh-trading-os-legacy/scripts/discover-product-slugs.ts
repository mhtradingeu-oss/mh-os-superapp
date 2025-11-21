import { getUncachableGoogleSheetClient } from '../lib/sheets';
import fs from 'node:fs/promises';
import path from 'node:path';

// Product URLs discovered from hairoticmen.de sitemap
const LIVE_PRODUCT_URLS = [
  'https://hairoticmen.de/product/hairoticmen-beard-kit-6-in-1-premium-bartpflege-set/',
  'https://hairoticmen.de/product/argan-beard-oil-magnetbox/',
  'https://hairoticmen.de/product/argan-beard-oil/',
  'https://hairoticmen.de/product/beard-shampoo/',
  'https://hairoticmen.de/product/beard-tonic/',
  'https://hairoticmen.de/product/hair-silicone-velvet/',
  'https://hairoticmen.de/product/beard-balm/',
  'https://hairoticmen.de/product/tanning-oil/',
  'https://hairoticmen.de/product/shaving-gel/',
  'https://hairoticmen.de/product/brightening-cream-3-in-1/',
  'https://hairoticmen.de/product/face-scrub-black-und-mint/',
  'https://hairoticmen.de/product/black-shampoo-mit-mint/',
  'https://hairoticmen.de/product/schwarzer-conditioner-mit-minz/',
  'https://hairoticmen.de/product/stain-remover/',
  'https://hairoticmen.de/product/leave-in-conditioner/',
  'https://hairoticmen.de/product/sulfate-free-shampoo/',
  'https://hairoticmen.de/product/sulfate-free-conditioner/',
  'https://hairoticmen.de/product/aqua-wax-perfekter-glanz-halt/',
  'https://hairoticmen.de/product/hair-styling-cream/',
  'https://hairoticmen.de/product/matte-clay-wax-matten-look/',
  'https://hairoticmen.de/product/spider-wax/',
  'https://hairoticmen.de/product/haarwachs-gentle-150ml-naturlicher-halt-pflege/',
  'https://hairoticmen.de/product/volumen-haarpuder-20g-fur-flexibles-styling/',
  'https://hairoticmen.de/product/after-shave-balm-pflege-und-regeneration/',
  'https://hairoticmen.de/product/clipper-care-spray/',
  'https://hairoticmen.de/product/silver-scent-shampoo/',
  'https://hairoticmen.de/product/hair-spray-mega-hold/',
  'https://hairoticmen.de/product/alkohol-sabri-ethanol-70/',
  'https://hairoticmen.de/product/protein-treatment-kit/',
  'https://hairoticmen.de/product/peel-off-mask/',
  'https://hairoticmen.de/product/hair-gel-maximale-kontrolle/',
  'https://hairoticmen.de/product/aftershave-cologne/',
  'https://hairoticmen.de/product/bartpflege-6-teiliges-komplettpaket-fur-manner/',
  'https://hairoticmen.de/product/beard-kit-3-in-1/',
  'https://hairoticmen.de/product/black-wax-ultra-styling/',
  'https://hairoticmen.de/product/matte-wax-naturliches-styling/',
  'https://hairoticmen.de/product/hair-gel-black/',
  'https://hairoticmen.de/product/hair-gel-clear/',
  'https://hairoticmen.de/product/shaving-und-treatment-cream/',
  'https://hairoticmen.de/product/beard-brush/',
];

// Manual SKU → slug mapping based on product matching
const SKU_TO_SLUG: Record<string, string> = {
  // Beard products
  'BAR-BEARDKIT6I-001': 'hairoticmen-beard-kit-6-in-1-premium-bartpflege-set',
  'BAR-BEARDKIT3I-002': 'beard-kit-3-in-1',
  'BAR-BEARDOIL50-003': 'argan-beard-oil-magnetbox',
  'BAR-BEARDOIL50-004': 'argan-beard-oil',
  'BAR-BEARDSHAMP-005': 'beard-shampoo',
  'BAR-BEARDTONIC-006': 'beard-tonic',
  'BAR-BEARDBALM5-008': 'beard-balm',
  'BAR-BEARDBRUSH-009': 'beard-brush',
  
  // Hair products
  'HAI-SILICONVEL-007': 'hair-silicone-velvet',
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
  
  // Shaving products
  'SHA-ADRENALIN-010': 'shaving-gel',
  'KIT-SHAVEHAIRB-088': 'shaving-und-treatment-cream',
  
  // Aftershave & Cologne
  'AFT-DEEPSKY50-028': 'after-shave-balm-pflege-und-regeneration',
  'COL-DIAMOND50-036': 'aftershave-cologne',
  
  // Body & Skin
  'TAN-TANNINGOIL-073': 'tanning-oil',
  'FAC-BRIGHTENING-076': 'brightening-cream-3-in-1',
  'FAC-FACESCRUB-077': 'face-scrub-black-und-mint',
  'FAC-PEELOFFMA-078': 'peel-off-mask',
  
  // Hair care
  'HAI-LEAVEINCON-079': 'leave-in-conditioner',
  'HAI-SULFATEFR-074': 'sulfate-free-shampoo',
  'HAI-SULFATEFR-075': 'sulfate-free-conditioner',
  'HAI-BLACKSHAMP-080': 'black-shampoo-mit-mint',
  'HAI-BLACKCONDI-081': 'schwarzer-conditioner-mit-minz',
  'HAI-HAIRSPRAYM-082': 'hair-spray-mega-hold',
  'HAI-SILVERSHAM-083': 'silver-scent-shampoo',
  
  // Accessories & Tools
  'ACC-STAINREMO-085': 'stain-remover',
  'ACC-ALCOHOLSPR-084': 'alkohol-sabri-ethanol-70',
  'ACC-CLIPPERCAR-089': 'clipper-care-spray',
  
  // Kits
  'KIT-PROTEIN1100-086': 'protein-treatment-kit',
};

async function discoverProductSlugs() {
  console.log('\n🔍 Discovering Product Slugs from hairoticmen.de\n');
  console.log('═'.repeat(80));
  
  // Load products from pricing config
  const configPath = path.join(process.cwd(), '..', 'config/hairoticmen-pricing.json');
  const configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));
  const products = configData.products || [];
  
  console.log(`\n📦 Total products in config: ${products.length}`);
  console.log(`🌐 Live product URLs found: ${LIVE_PRODUCT_URLS.length}`);
  console.log(`✅ Manual SKU mappings: ${Object.keys(SKU_TO_SLUG).length}\n`);
  
  // Generate slug mapping
  const slugMapping: Record<string, { url: string; verified: boolean }> = {};
  const unmappedProducts: string[] = [];
  
  for (const product of products) {
    const sku = product.SKU;
    
    if (SKU_TO_SLUG[sku]) {
      const slug = SKU_TO_SLUG[sku];
      const url = `https://hairoticmen.de/product/${slug}/`;
      const verified = LIVE_PRODUCT_URLS.includes(url);
      
      slugMapping[sku] = { url, verified };
      
      if (!verified) {
        console.log(`⚠️  ${sku}: ${slug} - NOT VERIFIED on website`);
      }
    } else {
      unmappedProducts.push(sku);
    }
  }
  
  // Report results
  console.log('\n📊 Mapping Results:\n');
  console.log(`   ✅ Mapped products: ${Object.keys(slugMapping).length}`);
  console.log(`   🌐 Verified URLs: ${Object.values(slugMapping).filter(m => m.verified).length}`);
  console.log(`   ⚠️  Unverified URLs: ${Object.values(slugMapping).filter(m => !m.verified).length}`);
  console.log(`   ❌ Unmapped products: ${unmappedProducts.length}`);
  
  if (unmappedProducts.length > 0) {
    console.log(`\n⚠️  Unmapped Products (will use SKU-based fallback):\n`);
    unmappedProducts.slice(0, 10).forEach(sku => {
      const prod = products.find((p: any) => p.SKU === sku);
      console.log(`   - ${sku}: ${prod?.ProductName || 'Unknown'}`);
    });
    
    if (unmappedProducts.length > 10) {
      console.log(`   ... and ${unmappedProducts.length - 10} more`);
    }
  }
  
  // Write mapping to file
  const outputPath = path.join(process.cwd(), '..', 'config/product-slug-mapping.json');
  await fs.writeFile(outputPath, JSON.stringify({ 
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalProducts: products.length,
    mappedProducts: Object.keys(slugMapping).length,
    verifiedUrls: Object.values(slugMapping).filter(m => m.verified).length,
    mapping: slugMapping,
    unmappedProducts
  }, null, 2));
  
  console.log(`\n✅ Slug mapping written to: ${outputPath}\n`);
  console.log('═'.repeat(80));
  
  return { slugMapping, unmappedProducts };
}

discoverProductSlugs().catch(console.error);
