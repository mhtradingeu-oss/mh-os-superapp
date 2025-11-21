/**
 * PRODUCT IMPORT TO GOOGLE SHEETS
 * 
 * Populates FinalPriceList Google Sheet with all 89 products
 * from master product list, including:
 * - Basic product info (SKU, Name, EAN, Stock, QR URL)
 * - Factory costs and package info
 * - Full pricing calculations (via pricing-master.ts logic)
 * 
 * Usage: npx tsx server/scripts/import-products-to-sheets.ts [--dry-run]
 */

import { getUncachableGoogleSheetClient, SPREADSHEET_ID } from '../lib/sheets';
import { retryWithBackoff } from '../lib/retry';

interface ProductData {
  sku: string;
  productName: string;
  qrUrl: string;
  ean: string;
  stock: number;
  unitGift: string | null;
  paket: string;
  costPrice: number;
  unitsPerCarton: number;
  productLine: string;
  contentAmount: number;
  contentUnit: string;
  isActive: boolean;
}

const PRODUCTS: ProductData[] = [
  // PREMIUM LINE (Beard Kits)
  {
    sku: 'BAR-BEARDKIT6I-001',
    productName: 'Beard Kit 6-in-1',
    qrUrl: 'https://hairoticmen.de/product/bartpflege-6-teiliges-komplettpaket-fur-manner/',
    ean: '6291108193648',
    stock: 30,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 11.25,
    unitsPerCarton: 10,
    productLine: 'PREMIUM',
    contentAmount: 1,
    contentUnit: 'Set',
    isActive: true
  },
  {
    sku: 'BAR-BEARDKIT3I-002',
    productName: 'Beard Kit 3-in-1',
    qrUrl: 'https://hairoticmen.de/product/beard-kit-3-in-1/',
    ean: '6291109760504',
    stock: 60,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 6.00,
    unitsPerCarton: 10,
    productLine: 'PREMIUM',
    contentAmount: 1,
    contentUnit: 'Set',
    isActive: true
  },
  
  // PROFESSIONAL LINE (Beard Care)
  {
    sku: 'BAR-BEARDOIL50-003',
    productName: 'BEARD OIL 50ML magnet box',
    qrUrl: 'https://hairoticmen.de/product/argan-beard-oil-magnetbox/',
    ean: '6291108190364',
    stock: 48,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 3.00,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 50,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'BAR-BEARDOIL50-004',
    productName: 'BEARD OIL 50ML normal box',
    qrUrl: 'https://hairoticmen.de/product/argan-beard-oil/',
    ean: '',
    stock: 360,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.63,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 50,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'BAR-BEARDSHAMP-005',
    productName: 'BEARD SHAMPOO 150ML',
    qrUrl: 'https://hairoticmen.de/product/beard-shampoo/',
    ean: '6291108190388',
    stock: 48,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.88,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'BAR-BEARDTONIC-006',
    productName: 'BEARD TONIC 150ML',
    qrUrl: 'https://hairoticmen.de/product/beard-tonic/',
    ean: '6291108190395',
    stock: 48,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.00,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'HAI-SILICONVEL-007',
    productName: 'SILICON VELVET 150ML',
    qrUrl: 'https://hairoticmen.de/product/hair-silicone-velvet/',
    ean: '6291108190371',
    stock: 48,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 3.75,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'BAR-BEARDBALM-008',
    productName: 'BEARD BALM 50ML',
    qrUrl: 'https://hairoticmen.de/product/beard-balm/',
    ean: '6291108190401',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.25,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 50,
    contentUnit: 'ml',
    isActive: true
  },
  
  // TOOLS LINE
  {
    sku: 'BAR-BEARDBRUSH-009',
    productName: 'BEARD BRUSH',
    qrUrl: 'https://hairoticmen.de/product/beard-brush/',
    ean: '',
    stock: 0,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.41,
    unitsPerCarton: 24,
    productLine: 'TOOLS',
    contentAmount: 1,
    contentUnit: 'pcs',
    isActive: true
  },
  
  // SHAVING GELS - ADRENALINE
  {
    sku: 'SHA-ADRENALIN-010',
    productName: 'SHAVING GEL ADRENALINE 500 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108190920',
    stock: 264,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.56,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'SHA-ADRENALIN-011',
    productName: 'SHAVING GEL ADRENALINE 1100 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108190265',
    stock: 120,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.83,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1100,
    contentUnit: 'ml',
    isActive: true
  },
  
  // SHAVING GELS - CODE RED
  {
    sku: 'SHA-CODERED50-012',
    productName: 'SHAVING GEL CODE RED 500 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291109356530',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.56,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'SHA-CODERED11-013',
    productName: 'SHAVING GEL CODE RED 1100 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291109353256',
    stock: 228,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.83,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1100,
    contentUnit: 'ml',
    isActive: true
  },
  
  // SHAVING GELS - DEEP SKY
  {
    sku: 'SHA-DEEPSKY50-014',
    productName: 'SHAVING GEL DEEP SKY 500 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108190906',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.56,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'SHA-DEEPSKY11-015',
    productName: 'SHAVING GEL DEEP SKY 1100 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108190241',
    stock: 180,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.83,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1100,
    contentUnit: 'ml',
    isActive: true
  },
  
  // SHAVING GELS - DIAMOND
  {
    sku: 'SHA-DIAMOND50-016',
    productName: 'SHAVING GEL DIAMOND 500 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291109356547',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.56,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'SHA-DIAMOND11-017',
    productName: 'SHAVING GEL DIAMOND 1100 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291109353287',
    stock: 144,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.83,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1100,
    contentUnit: 'ml',
    isActive: true
  },
  
  // SHAVING GELS - EXOTIC
  {
    sku: 'SHA-EXOTIC500-018',
    productName: 'SHAVING GEL EXOTIC 500 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108190296',
    stock: 216,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.56,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'SHA-EXOTIC110-019',
    productName: 'SHAVING GEL EXOTIC 1100 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108190258',
    stock: 120,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.83,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1100,
    contentUnit: 'ml',
    isActive: true
  },
  
  // SHAVING GELS - GOLDEN SANDS
  {
    sku: 'SHA-GOLDSAND-020',
    productName: 'SHAVING GEL GOLDEN SANDS 500 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108197431',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.56,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'SHA-GOLDSAND-021',
    productName: 'SHAVING GEL GOLDEN SANDS 1100 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108197448',
    stock: 120,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.83,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1100,
    contentUnit: 'ml',
    isActive: true
  },
  
  // SHAVING GELS - INFINITE
  {
    sku: 'SHA-INFINITE5-022',
    productName: 'SHAVING GEL INFINITE 500 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108190937',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.56,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'SHA-INFINITE1-023',
    productName: 'SHAVING GEL INFINITE 1100 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108190272',
    stock: 144,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.83,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1100,
    contentUnit: 'ml',
    isActive: true
  },
  
  // SHAVING GELS - JACK OF SPADES
  {
    sku: 'SHA-JACKSPADE-024',
    productName: 'SHAVING GEL JACK OF SPADES 500 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291109356554',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.56,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'SHA-JACKSPADE-025',
    productName: 'SHAVING GEL JACK OF SPADES 1100 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108199022',
    stock: 120,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.83,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1100,
    contentUnit: 'ml',
    isActive: true
  },
  
  // SHAVING GELS - MONARCH ORCHID
  {
    sku: 'SHA-MONARCHOR-026',
    productName: 'SHAVING GEL MONARCH ORCHID 500 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108194805',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.56,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'SHA-MONARCHOR-027',
    productName: 'SHAVING GEL MONARCH ORCHID 1100 ML',
    qrUrl: 'https://hairoticmen.de/product/shaving-gel/',
    ean: '6291108193204',
    stock: 132,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.83,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1100,
    contentUnit: 'ml',
    isActive: true
  },
  
  // AFTER SHAVE BALMS
  {
    sku: 'AFT-DEEPSKY50-028',
    productName: 'AFTER SHAVE BALM DEEP SKY 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291108190814',
    stock: 168,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.88,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'AFT-EXOTIC500-029',
    productName: 'AFTER SHAVE BALM EXOTIC 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291108190821',
    stock: 144,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.88,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'AFT-INFINITE5-030',
    productName: 'AFTER SHAVE BALM INFINITE 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291108190845',
    stock: 168,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.88,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'AFT-ADRENALI-031',
    productName: 'AFTER SHAVE BALM ADRENALINE 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291108190838',
    stock: 168,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.88,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  
  // AFTER SHAVE COLOGNE 500ML
  {
    sku: 'COL-ADRENALI-032',
    productName: 'AFTER SHAVE COLOGNE ADRENALINE 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291108190302',
    stock: 120,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.13,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-ADRENALI-033',
    productName: 'AFTER SHAVE COLOGNE ADRENALINE 175 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291509648266',
    stock: 816,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.63,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 175,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-CODERED50-034',
    productName: 'AFTER SHAVE COLOGNE CODE RED 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291109353263',
    stock: 360,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.13,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-CODERED17-035',
    productName: 'AFTER SHAVE COLOGNE CODE RED 175 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291509648273',
    stock: 480,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.63,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 175,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-DIAMOND50-036',
    productName: 'AFTER SHAVE COLOGNE DIAMOND 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291109353294',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.13,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-DIAMOND17-037',
    productName: 'AFTER SHAVE COLOGNE DIAMOND 175 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291509648297',
    stock: 480,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.63,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 175,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-DEEPSKY50-038',
    productName: 'AFTER SHAVE COLOGNE DEEP SKY 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291108190289',
    stock: 120,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.13,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-DEEPSKY17-039',
    productName: 'AFTER SHAVE COLOGNE DEEP SKY 175 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291509647191',
    stock: 480,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.63,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 175,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-EXOTIC500-040',
    productName: 'AFTER SHAVE COLOGNE EXOTIC 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291108190296',
    stock: 360,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.13,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-EXOTIC175-041',
    productName: 'AFTER SHAVE COLOGNE EXOTIC 175 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291509648259',
    stock: 384,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.63,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 175,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-GOLDSAND-042',
    productName: 'AFTER SHAVE COLOGNE GOLDEN SANDS 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291108197424',
    stock: 384,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.13,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-GOLDSAND-043',
    productName: 'AFTER SHAVE COLOGNE GOLDEN SANDS 175 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291509647207',
    stock: 384,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.63,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 175,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-INFINITE5-044',
    productName: 'AFTER SHAVE COLOGNE INFINITE 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291108190319',
    stock: 120,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.13,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-INFINITE1-045',
    productName: 'AFTER SHAVE COLOGNE INFINITE 175 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291509647177',
    stock: 240,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.63,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 175,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-JACKSPADE-046',
    productName: 'AFTER SHAVE COLOGNE JACK OF SPADES 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291108199046',
    stock: 120,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.13,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-JACKSPADE-047',
    productName: 'AFTER SHAVE COLOGNE JACK OF SPADES 175 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291108193211',
    stock: 480,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.63,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 175,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-MONARCHOR-048',
    productName: 'AFTER SHAVE COLOGNE MONARCH ORCHID 500 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291509647184',
    stock: 192,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.13,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'COL-MONARCHOR-049',
    productName: 'AFTER SHAVE COLOGNE MONARCH ORCHID 175 ML',
    qrUrl: 'https://hairoticmen.de/product/aftershave-cologne/',
    ean: '6291509648280',
    stock: 480,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.63,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 175,
    contentUnit: 'ml',
    isActive: true
  },
  
  // AQUA WAX
  {
    sku: 'WAX-AQUAULTRA-050',
    productName: 'AQUA WAX ULTRA STRONG HOLD 150 ML',
    qrUrl: 'https://hairoticmen.de/product/aqua-wax-perfekter-glanz-halt/',
    ean: '6291108190876',
    stock: 240,
    unitGift: '96',
    paket: 'Klein Paket',
    costPrice: 0.79,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'WAX-AQUAMEGA-051',
    productName: 'AQUA WAX MEGA HOLD 150 ML',
    qrUrl: 'https://hairoticmen.de/product/aqua-wax-perfekter-glanz-halt/',
    ean: '6291108190852',
    stock: 480,
    unitGift: '96',
    paket: 'Klein Paket',
    costPrice: 0.79,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'WAX-AQUASTRONG-052',
    productName: 'AQUA WAX STRONG HOLD 150 ML',
    qrUrl: 'https://hairoticmen.de/product/aqua-wax-perfekter-glanz-halt/',
    ean: '6291108190883',
    stock: 240,
    unitGift: '96',
    paket: 'Klein Paket',
    costPrice: 0.79,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'WAX-AQUAMAXIMUM-053',
    productName: 'AQUA WAX MAXIMUM HOLD 150 ML',
    qrUrl: 'https://hairoticmen.de/product/aqua-wax-perfekter-glanz-halt/',
    ean: '6291108190869',
    stock: 240,
    unitGift: '96',
    paket: 'Klein Paket',
    costPrice: 0.79,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  
  // OTHER WAXES
  {
    sku: 'WAX-CLAY150ML-054',
    productName: 'CLAY WAX 150 ML',
    qrUrl: 'https://hairoticmen.de/product/matte-clay-wax-matten-look/',
    ean: '6291109352860',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.18,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'WAX-MATTE150ML-055',
    productName: 'MATTE WAX 150 ML',
    qrUrl: 'https://hairoticmen.de/product/matte-wax-naturliches-styling/',
    ean: '6291108191781',
    stock: 480,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.81,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'WAX-GENTLE150ML-056',
    productName: 'GENTLE WAX 150 ML',
    qrUrl: 'https://hairoticmen.de/product/haarwachs-gentle-150ml-naturlicher-halt-pflege/',
    ean: '6291108193594',
    stock: 480,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.88,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'WAX-BLACK150ML-057',
    productName: 'BLACK WAX 150 ML',
    qrUrl: 'https://hairoticmen.de/product/black-wax-ultra-styling/',
    ean: '6291108191774',
    stock: 240,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.81,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'WAX-SPIDER150ML-058',
    productName: 'SPIDER WAX 150 ML',
    qrUrl: 'https://hairoticmen.de/product/spider-wax/',
    ean: '6291108191330',
    stock: 480,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.93,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'WAX-POWDER20GR-059',
    productName: 'POWDER WAX 20 GR',
    qrUrl: 'https://hairoticmen.de/product/volumen-haarpuder-20g-fur-flexibles-styling/',
    ean: '6291108182857',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 2.25,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 20,
    contentUnit: 'g',
    isActive: true
  },
  
  // STYLING
  {
    sku: 'HAI-STYLING150-060',
    productName: 'STYLING CREAM 150 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-styling-cream/',
    ean: '6291108193631',
    stock: 96,
    unitGift: '48',
    paket: 'Klein Paket',
    costPrice: 0.80,
    unitsPerCarton: 48,
    productLine: 'PROFESSIONAL',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  
  // HAIR GELS - CLEAR
  {
    sku: 'GEL-CLEAR500ML-061',
    productName: 'HAIR GEL CLEAR 500 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-clear/',
    ean: '6291108198230',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.98,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'GEL-CLEAR1000ML-062',
    productName: 'HAIR GEL CLEAR 1000 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-clear/',
    ean: '6291108198247',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 1.50,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1000,
    contentUnit: 'ml',
    isActive: true
  },
  
  // HAIR GELS - BLACK
  {
    sku: 'GEL-BLACK500ML-063',
    productName: 'HAIR GEL BLACK 5000 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-black/',
    ean: '6291108192917',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.98,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'GEL-BLACK1000ML-064',
    productName: 'HAIR GEL BLACK 1000 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-black/',
    ean: '6291108194386',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 1.50,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1000,
    contentUnit: 'ml',
    isActive: true
  },
  
  // HAIR GELS - STRONG HOLD
  {
    sku: 'GEL-STRONG1000-065',
    productName: 'HAIR GEL STRONG HOLD (6) 1000 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-maximale-kontrolle/',
    ean: '6291108190357',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 1.50,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1000,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'GEL-STRONG500ML-066',
    productName: 'HAIR GEL STRONG HOLD (6) 500 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-maximale-kontrolle/',
    ean: '6291108194379',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.98,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  
  // HAIR GELS - ULTRA STRONG
  {
    sku: 'GEL-ULTRA1000ML-067',
    productName: 'HAIR GEL ULTRA STRONG HOLD (7) 1000 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-maximale-kontrolle/',
    ean: '6291108190333',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 1.50,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1000,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'GEL-ULTRA500ML-068',
    productName: 'HAIR GEL ULTRA STRONG HOLD (7) 500 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-maximale-kontrolle/',
    ean: '6291108194355',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.98,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  
  // HAIR GELS - MEGA HOLD
  {
    sku: 'GEL-MEGA1000ML-069',
    productName: 'HAIR GEL MEGA HOLD (8) 1000 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-maximale-kontrolle/',
    ean: '6291108190326',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 1.50,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1000,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'GEL-MEGA500ML-070',
    productName: 'HAIR GEL MEGA HOLD (8) 500 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-maximale-kontrolle/',
    ean: '6291108194348',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.98,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  
  // HAIR GELS - MAXIMUM HOLD
  {
    sku: 'GEL-MAXIMUM1000-071',
    productName: 'HAIR GEL MAXIMUM HOLD (9) 1000 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-maximale-kontrolle/',
    ean: '6291108190340',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 1.50,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 1000,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'GEL-MAXIMUM500ML-072',
    productName: 'HAIR GEL MAXIMUM HOLD (9) 500 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-gel-maximale-kontrolle/',
    ean: '6291108194362',
    stock: 48,
    unitGift: null,
    paket: 'Paket',
    costPrice: 0.98,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  
  // TANNING & CARE
  {
    sku: 'TAN-TANNINGOIL-073',
    productName: 'TANNING OIL 250 ML',
    qrUrl: 'https://hairoticmen.de/product/tanning-oil/',
    ean: '6291108199671',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.04,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 250,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'HAI-SULFATESH-074',
    productName: 'SULFATE FREE SHAMPOO 500 ML',
    qrUrl: 'https://hairoticmen.de/product/sulfate-free-shampoo/',
    ean: '6291109351061',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.64,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'HAI-SULFATECO-075',
    productName: 'SULFATE FREE CONDITIONER 500 ML',
    qrUrl: 'https://hairoticmen.de/product/sulfate-free-conditioner/',
    ean: '6291109351078',
    stock: 240,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.48,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  
  // FACE CARE
  {
    sku: 'FAC-BRIGHTENING-076',
    productName: 'BRIGHTENING CREAM 3 IN 1 500 ML',
    qrUrl: 'https://hairoticmen.de/product/brightening-cream-3-in-1/',
    ean: '6291108194669',
    stock: 48,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.13,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'FAC-FACESCRUB-077',
    productName: 'FACE SCRUB BLACK & MINT 500 ML',
    qrUrl: 'https://hairoticmen.de/product/face-scrub-black-und-mint/',
    ean: '6291108191385',
    stock: 120,
    unitGift: null,
    paket: 'Paket',
    costPrice: 1.00,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'FAC-PEELOFFM-078',
    productName: 'PEEL OFF MASK 500ML',
    qrUrl: 'https://hairoticmen.de/product/peel-off-mask/',
    ean: '6291108190890',
    stock: 48,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.88,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  
  // HAIR TREATMENT
  {
    sku: 'HAI-LEAVEINC-079',
    productName: 'LEAVE IN CONDITIONER 500ML',
    qrUrl: 'https://hairoticmen.de/product/leave-in-conditioner/',
    ean: '6291108192368',
    stock: 144,
    unitGift: null,
    paket: 'Paket',
    costPrice: 1.25,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'HAI-BLACKMINTS-080',
    productName: 'SHAMPOO BLACK & MINT 500ML',
    qrUrl: 'https://hairoticmen.de/product/black-shampoo-mit-mint/',
    ean: '6291509629210',
    stock: 72,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.29,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'HAI-BLACKMINTC-081',
    productName: 'CONDITIONER BLACK & MINT 500ML',
    qrUrl: 'https://hairoticmen.de/product/schwarzer-conditioner-mit-minz/',
    ean: '6291108191378',
    stock: 72,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 1.11,
    unitsPerCarton: 24,
    productLine: 'PROFESSIONAL',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'HAI-SPRAYMEGA-082',
    productName: 'HAIR SPRAY MEGA HOLD 600 ML',
    qrUrl: 'https://hairoticmen.de/product/hair-spray-mega-hold/',
    ean: '6291108190463',
    stock: 120,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 2.65,
    unitsPerCarton: 12,
    productLine: 'PROFESSIONAL',
    contentAmount: 600,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'HAI-SILVERSCEN-083',
    productName: 'SILVER SCENT SHAMPOO 4.5 LTR',
    qrUrl: 'https://hairoticmen.de/product/silver-scent-shampoo/',
    ean: '6291108190647',
    stock: 12,
    unitGift: null,
    paket: 'Paket',
    costPrice: 5.00,
    unitsPerCarton: 4,
    productLine: 'PREMIUM',
    contentAmount: 4500,
    contentUnit: 'ml',
    isActive: true
  },
  
  // ACCESSORIES & KITS
  {
    sku: 'ACC-ALCOHOLSPR-084',
    productName: 'ALCOHOL SPRAY (ETHANOL %70) 150 ML',
    qrUrl: 'https://hairoticmen.de/product/alkohol-sabri-ethanol-70/',
    ean: '6291109359814',
    stock: 48,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.92,
    unitsPerCarton: 48,
    productLine: 'TOOLS',
    contentAmount: 150,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'ACC-STAINREMO-085',
    productName: 'STAIN REMOVER 300ML',
    qrUrl: 'https://hairoticmen.de/product/stain-remover/',
    ean: '',
    stock: 48,
    unitGift: null,
    paket: 'Klein Paket',
    costPrice: 0.90,
    unitsPerCarton: 24,
    productLine: 'TOOLS',
    contentAmount: 300,
    contentUnit: 'ml',
    isActive: true
  },
  {
    sku: 'KIT-PROTEIN1100-086',
    productName: 'Protein Treatment Kit 1100ml (Includes Shampoo Treatment Conditioner)',
    qrUrl: 'https://hairoticmen.de/product/protein-treatment-kit/',
    ean: '6291108190364',
    stock: 0,
    unitGift: null,
    paket: 'Paket',
    costPrice: 1.25,
    unitsPerCarton: 5,
    productLine: 'PREMIUM',
    contentAmount: 1100,
    contentUnit: 'ml',
    isActive: false
  },
  {
    sku: 'KIT-PROTEIN500ML-087',
    productName: 'Protein Treatment Kit 500ml (Includes Shampoo Treatment Conditioner)',
    qrUrl: 'https://hairoticmen.de/product/protein-treatment-kit/',
    ean: '',
    stock: 0,
    unitGift: null,
    paket: 'Paket',
    costPrice: 52.15,
    unitsPerCarton: 5,
    productLine: 'PREMIUM',
    contentAmount: 500,
    contentUnit: 'ml',
    isActive: false
  },
  {
    sku: 'KIT-SHAVEHAIRB-088',
    productName: 'Shaving Cream & Hair & Beard Treatment 2-in-1 - 1500ml',
    qrUrl: 'https://hairoticmen.de/product/shaving-und-treatment-cream/',
    ean: '6291108193648',
    stock: 0,
    unitGift: null,
    paket: 'Paket',
    costPrice: 26.15,
    unitsPerCarton: 12,
    productLine: 'PREMIUM',
    contentAmount: 1500,
    contentUnit: 'ml',
    isActive: false
  },
  {
    sku: 'ACC-CLIPPERCAR-089',
    productName: 'Clipper Care 250ml',
    qrUrl: 'https://hairoticmen.de/product/clipper-care-spray/',
    ean: '6291109760504',
    stock: 0,
    unitGift: null,
    paket: 'Paket',
    costPrice: 1.30,
    unitsPerCarton: 24,
    productLine: 'TOOLS',
    contentAmount: 250,
    contentUnit: 'ml',
    isActive: false
  }
];

async function importProductsToSheets() {
  const isDryRun = process.argv.includes('--dry-run');
  
  console.log('📦 PRODUCT IMPORT TO GOOGLE SHEETS');
  console.log('═'.repeat(100));
  console.log(`Mode: ${isDryRun ? '🧪 DRY RUN (no writes)' : '✍️  LIVE IMPORT'}\n`);
  
  const sheets = await getUncachableGoogleSheetClient();
  
  // Read existing headers from FinalPriceList
  const headerResponse = await retryWithBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'FinalPriceList!A1:CQ1',
    })
  );
  
  const headers = headerResponse.data.values?.[0] || [];
  console.log(`✅ Found ${headers.length} columns in FinalPriceList`);
  
  // Map columns
  const columnMap = new Map(headers.map((h, i) => [h, i]));
  
  // Required columns for basic product data (matching schema)
  const requiredColumns = [
    'SKU', 'Name', 'Factory_Cost_EUR'
  ];
  
  const missingColumns = requiredColumns.filter(c => !columnMap.has(c));
  if (missingColumns.length > 0) {
    console.error(`❌ Missing required columns: ${missingColumns.join(', ')}`);
    process.exit(1);
  }
  
  console.log(`\n📋 Preparing ${PRODUCTS.length} products for import...`);
  
  // Build rows for each product
  const dataRows: any[][] = [];
  
  for (const product of PRODUCTS) {
    const row = new Array(headers.length).fill('');
    
    // Basic product info (using actual column names from schema)
    // IMPORTANT: Write numbers as numbers, not formatted strings!
    row[columnMap.get('SKU')!] = product.sku;
    row[columnMap.get('Name')!] = product.productName;
    if (columnMap.has('Barcode')) row[columnMap.get('Barcode')!] = product.ean;
    if (columnMap.has('QR_URL')) row[columnMap.get('QR_URL')!] = product.qrUrl;
    if (columnMap.has('Stock')) row[columnMap.get('Stock')!] = product.stock; // Number
    if (columnMap.has('Line')) row[columnMap.get('Line')!] = product.productLine;
    if (columnMap.has('Content_ml')) row[columnMap.get('Content_ml')!] = product.contentAmount; // Number
    if (columnMap.has('Net_Content_ml')) row[columnMap.get('Net_Content_ml')!] = product.contentAmount; // Number
    row[columnMap.get('Factory_Cost_EUR')!] = product.costPrice; // Number (NOT "€11.25")
    if (columnMap.has('UnitsPerCarton')) row[columnMap.get('UnitsPerCarton')!] = product.unitsPerCarton; // Number
    if (columnMap.has('Status')) row[columnMap.get('Status')!] = product.isActive ? 'Active' : 'Inactive';
    
    // Default cost components (will be filled by pricing-master.ts)
    if (columnMap.has('Packaging_Cost_EUR')) row[columnMap.get('Packaging_Cost_EUR')!] = 0;
    if (columnMap.has('Shipping_Inbound_per_unit')) row[columnMap.get('Shipping_Inbound_per_unit')!] = 0;
    if (columnMap.has('EPR_LUCID_per_unit')) row[columnMap.get('EPR_LUCID_per_unit')!] = 0;
    if (columnMap.has('GS1_per_unit')) row[columnMap.get('GS1_per_unit')!] = 0;
    if (columnMap.has('Retail_Packaging_per_unit')) row[columnMap.get('Retail_Packaging_per_unit')!] = 0;
    if (columnMap.has('QC_PIF_per_unit')) row[columnMap.get('QC_PIF_per_unit')!] = 0;
    if (columnMap.has('Operations_per_unit')) row[columnMap.get('Operations_per_unit')!] = 0;
    if (columnMap.has('Marketing_per_unit')) row[columnMap.get('Marketing_per_unit')!] = 0;
    
    dataRows.push(row);
  }
  
  console.log(`\n✅ Prepared ${dataRows.length} rows`);
  console.log(`   - ${PRODUCTS.filter(p => p.isActive).length} active products`);
  console.log(`   - ${PRODUCTS.filter(p => !p.isActive).length} inactive products`);
  
  if (isDryRun) {
    console.log('\n🧪 DRY RUN - Would write:');
    console.log(`   Range: FinalPriceList!A2:CQ${dataRows.length + 1}`);
    console.log(`   Rows: ${dataRows.length}`);
    console.log(`   Columns: ${headers.length}`);
    console.log('\n✅ Dry run complete. Run without --dry-run to execute.');
    return;
  }
  
  // Write to Google Sheets
  console.log('\n✍️  Writing to Google Sheets...');
  
  await retryWithBackoff(() =>
    sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `FinalPriceList!A2:CQ${dataRows.length + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: dataRows,
      },
    })
  );
  
  console.log(`\n✅ Successfully imported ${dataRows.length} products to FinalPriceList!`);
  console.log('\n🎯 Next step: Run pricing-master.ts to calculate all pricing columns:');
  console.log('   npx tsx server/scripts/pricing-master.ts --dry-run');
}

importProductsToSheets()
  .then(() => {
    console.log('\n✅ Import complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Import failed:', err);
    process.exit(1);
  });
