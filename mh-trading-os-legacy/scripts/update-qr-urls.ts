import { getUncachableGoogleSheetClient, SPREADSHEET_ID } from '../lib/sheets';
import { retryWithBackoff } from '../lib/retry';

// Known product mappings from website scraping
const PRODUCT_URL_MAPPINGS: Record<string, string> = {
  // Beard Products
  'beard kit 6': 'beard-kit',
  'beard kit 3': 'beard-kit-3-in-1',
  'beard oil 50ml': 'beard-growth-oil',
  
  // After Shave Products
  'after shave adrenaline 500': 'copy-of-after-shave-exotic-500-ml-3',
  'after shave exotic 500': 'after-shave-cologne-500ml',
  'after shave infinite 500': 'copy-of-after-shave-exotic-500-ml-1',
  'after shave deep blue 500': 'copy-of-after-shave-exotic-500-ml',
  'after shave monarch orchid 500': 'copy-of-after-shave-exotic-500ml',
  
  // After Shave Balm
  'after shave balm deep sky 500': 'after-shave-balm',
  'after shave balm infinite 500': 'copy-of-after-shave-balm-deep-sky-500-ml',
  'after shave balm adrenaline 500': 'copy-of-after-shave-balm-deep-sky-500-ml-1',
  'after shave balm exotic 500': 'copy-of-after-shave-balm-deep-sky-500-ml-2',
  
  // Shaving Gel
  'shaving gel adrenaline 500': 'shaving-gel-500-ml-1',
  'shaving gel exotic 500': 'copy-of-shaving-gel-adrenaline-500-ml-3',
  'shaving gel infinite 500': 'copy-of-shaving-gel-adrenaline-500-ml-1',
  'shaving gel deep sky 500': 'copy-of-shaving-gel-adrenaline-500-ml-2',
  'shaving gel monarch orchid 500': 'copy-of-shaving-gel-adrenaline-500-ml',
  
  // Premium Shaving Gel
  'premium shaving gel golden sands 500': 'premium-shaving-gel-500ml',
  'premium shaving gel code red 500': 'copy-of-premium-shaving-gel-golden-sands-500-ml',
  'premium shaving gel jack of spades 500': 'copy-of-premium-shaving-gel-golden-sands-500-ml-2',
  'premium shaving gel diamond 500': 'copy-of-premium-shaving-gel-golden-sands-500-ml-1',
  
  // Premium After Shave
  'premium after shave golden sands 500': 'copy-of-premium-after-shave-jack-of-spades-500-ml',
  'premium after shave code red 500': 'copy-of-premium-after-shave-jack-of-spades-500-ml-1',
  'premium after shave jack of spades 500': 'premium-after-shave-500ml',
  'premium after diamond 500': 'copy-of-premium-after-shave-jack-of-spades-500-ml-2',
  
  // Hair Products
  'aqua wax strong hold 150': 'aqua-wax-150g',
  'aqua wax mega hold 150': 'copy-of-aqua-wax-mega-hold-150-ml',
  'aqua wax maximum hold 150': 'copy-of-aqua-wax-mega-hold-150-ml-1',
  'aqua wax ultra strong hold 150': 'copy-of-aqua-wax-mega-hold-150-ml-2',
  
  'black wax 150': 'black-wax-150g',
  'gentle wax 150': 'gentle-wax-150g',
  
  'black hair gel 500': 'copy-of-hair-gel-strong-hold-7',
  'black hair gel 1000': 'copy-of-black-hair-gel-1000-ml',
  'clear hair gel 500': 'copy-of-hair-gel-strong-hold-8',
  'clear hair gel 1000': 'clear-hair-gel-1000-ml',
  
  'hair gel mega hold 8 500': 'copy-of-hair-gel-strong-hold-9',
  'hair gel mega hold 8 1000': 'hair-gel-mega-hold-8-1000-ml',
  'hair gel maximum hold 9 1000': 'copy-of-maximum-hold-9-1000-ml',
  
  // Skin Care
  'tan oil 250': 'tan-oil-250ml',
  'brightening cream 3 in 1': 'brightening-cream-3-in-1',
  'black peel-off mask': 'black-peel-off-mask',
  'stain remover 300': 'stain-remover-300ml',
  'face & body scrub': 'face-body-scrub',
  'alcohol spray': 'alcohol-spray',
  
  // Other
  'hair & beard shaving cream 1500': 'hair-beard-shaving-cream-1500ml',
};

function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '') // Remove content in parentheses
    .replace(/ml|g/gi, '') // Remove units
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
}

function findProductSlug(productName: string): string | null {
  const normalized = normalizeProductName(productName);
  
  // Try exact match first
  if (PRODUCT_URL_MAPPINGS[normalized]) {
    return PRODUCT_URL_MAPPINGS[normalized];
  }
  
  // Try partial matches
  for (const [key, slug] of Object.entries(PRODUCT_URL_MAPPINGS)) {
    if (normalized.includes(key) || key.includes(normalized.substring(0, 20))) {
      return slug;
    }
  }
  
  return null;
}

async function updateQRUrls() {
  const sheets = await getUncachableGoogleSheetClient();
  
  console.log('🔗 UPDATING QR URLS WITH WOOCOMMERCE PRODUCT LINKS');
  console.log('═'.repeat(80));
  
  // Get all products
  const response = await retryWithBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'FinalPriceList!A2:AL91',
    })
  );
  
  const rows = response.data.values || [];
  let updated = 0;
  let notFound = 0;
  const notFoundProducts: string[] = [];
  
  console.log(`📦 Processing ${rows.length} products...\n`);
  
  const updatedRows = rows.map((row, index) => {
    const sku = row[0];
    const productName = row[1];
    const currentQRUrl = row[37] || '';
    
    const slug = findProductSlug(productName);
    
    if (slug) {
      const newQRUrl = `https://hairoticmen.de/products/${slug}`;
      row[37] = newQRUrl;
      
      if (currentQRUrl !== newQRUrl) {
        console.log(`✅ ${sku}: ${productName.substring(0, 40)}`);
        console.log(`   OLD: ${currentQRUrl}`);
        console.log(`   NEW: ${newQRUrl}\n`);
        updated++;
      }
    } else {
      // Keep SKU-based URL as fallback
      const fallbackUrl = `https://hairoticmen.de/products/${sku}`;
      row[37] = fallbackUrl;
      notFound++;
      notFoundProducts.push(`${sku}: ${productName.substring(0, 50)}`);
    }
    
    return row;
  });
  
  // Get headers
  const headerResponse = await retryWithBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'FinalPriceList!A1:AL1',
    })
  );
  
  const headers = headerResponse.data.values[0];
  
  // Update the sheet
  console.log('\n📤 Updating FinalPriceList sheet...');
  
  await retryWithBackoff(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'FinalPriceList!A2:AL91',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: updatedRows,
      },
    })
  );
  
  console.log('✅ Sheet updated successfully');
  
  console.log('\n📊 UPDATE SUMMARY');
  console.log('═'.repeat(80));
  console.log(`✅ Updated: ${updated} products`);
  console.log(`⚠️  Not found: ${notFound} products (using SKU-based fallback URLs)`);
  
  if (notFoundProducts.length > 0) {
    console.log('\n⚠️  PRODUCTS NOT FOUND ON WEBSITE:');
    notFoundProducts.forEach(p => console.log(`   ${p}`));
    console.log('\n   These products will use fallback URL pattern:');
    console.log(`   https://hairoticmen.de/products/{SKU}`);
    console.log(`   Please verify these URLs manually or provide the correct slugs.`);
  }
  
  console.log('\n✅ QR URL UPDATE COMPLETE');
}

updateQRUrls()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error updating QR URLs:', error);
    process.exit(1);
  });
