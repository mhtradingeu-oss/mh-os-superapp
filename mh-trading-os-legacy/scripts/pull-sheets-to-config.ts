/**
 * PULL GOOGLE SHEETS DATA TO BACKEND CONFIG
 * ==========================================
 * 
 * This script pulls ALL data from Google Sheets FinalPriceList and updates
 * the backend configuration files with your manual edits.
 * 
 * What this does:
 * 1. Reads ALL products from Google Sheets FinalPriceList
 * 2. Preserves ALL your manual edits (factory costs, status, brand, etc.)
 * 3. Updates server/config/hairoticmen-pricing.json
 * 4. Updates server/config/all-89-products.json
 * 5. Makes your Google Sheets data the authoritative source
 * 
 * Usage:
 *   tsx server/scripts/pull-sheets-to-config.ts
 * 
 * What gets preserved:
 * - Factory_Cost_EUR (your manual cost edits)
 * - Status (Active, Draft, Discontinued)
 * - Brand (HAIROTICMEN or custom)
 * - ALL pricing fields (UVP, COGS, margins)
 * - Product names, categories, lines
 * - Shipping costs, box sizes
 * - Everything in FinalPriceList!
 */

import { getUncachableGoogleSheetClient, SPREADSHEET_ID } from '../lib/sheets';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ProductRow {
  SKU: string;
  Name: string;
  Category: string;
  Brand: string;
  Barcode: string;
  Status: string;
  Factory_Cost_EUR: number;
  Packaging_Cost_EUR: number;
  Freight_kg_EUR: number;
  Import_Duty_Pct: number;
  Overhead_Pct: number;
  COGS_EUR: number;
  Line: string;
  Weight_g: number;
  Content_ml: number;
  Net_Content_ml: number;
  Dims_cm: string;
  Amazon_TierKey: string;
  Box_Size: string;
  QRUrl: string;
  [key: string]: any;
}

async function pullSheetsToConfig() {
  console.log('📥 Pulling Google Sheets data to backend config...\n');
  
  try {
    const sheets = getUncachableGoogleSheetClient();
    
    if (!SPREADSHEET_ID) {
      throw new Error('SHEETS_SPREADSHEET_ID not set in environment');
    }
    
    console.log(`📊 Reading from spreadsheet: ${SPREADSHEET_ID}`);
    console.log(`📋 Sheet: FinalPriceList\n`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'FinalPriceList!A:CK',
    });
    
    if (!response || !response.data) {
      throw new Error('Failed to fetch data from Google Sheets - no response');
    }
    
    const rows = response.data.values || [];
    
    if (rows.length === 0) {
      throw new Error('FinalPriceList sheet is empty or has no data');
    }
    
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    console.log(`✅ Found ${dataRows.length} products`);
    console.log(`📋 Columns: ${headers.length}\n`);
    
    const products: ProductRow[] = [];
    const skipped: string[] = [];
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;
      
      const product: any = {};
      headers.forEach((header, idx) => {
        const value = row[idx];
        product[header] = value !== undefined && value !== '' ? value : null;
      });
      
      if (!product.SKU || !product.Name) {
        skipped.push(`Row ${rowNum}: Missing SKU or Name`);
        continue;
      }
      
      const parsed: ProductRow = {
        SKU: product.SKU,
        Name: product.Name,
        Category: product.Category || 'General',
        Brand: product.Brand || 'HAIROTICMEN',
        Barcode: product.Barcode || '',
        Status: product.Status || 'Active',
        
        Factory_Cost_EUR: parseFloat(product.Factory_Cost_EUR) || 0,
        Packaging_Cost_EUR: parseFloat(product.Packaging_Cost_EUR) || 0,
        Freight_kg_EUR: parseFloat(product.Freight_kg_EUR) || 0,
        Import_Duty_Pct: parseFloat(product.Import_Duty_Pct) || 0,
        Overhead_Pct: parseFloat(product.Overhead_Pct) || 0,
        COGS_EUR: parseFloat(product.COGS_EUR) || 0,
        
        Line: product.Line || 'Basic',
        Weight_g: parseFloat(product.Weight_g) || 0,
        Content_ml: parseFloat(product.Content_ml) || 0,
        Net_Content_ml: parseFloat(product.Net_Content_ml) || 0,
        Dims_cm: product.Dims_cm || '',
        Amazon_TierKey: product.Amazon_TierKey || 'Std_Parcel_S',
        Box_Size: product.Box_Size || 'Small',
        QRUrl: product.QRUrl || '',
        
        rawData: product
      };
      
      products.push(parsed);
    }
    
    console.log(`✅ Parsed ${products.length} valid products`);
    if (skipped.length > 0) {
      console.log(`⚠️  Skipped ${skipped.length} rows:`);
      skipped.forEach(s => console.log(`   ${s}`));
    }
    console.log('');
    
    const configDir = path.resolve(__dirname, '../config');
    
    const pricingConfigPath = path.join(configDir, 'hairoticmen-pricing.json');
    const allProductsPath = path.join(configDir, 'all-89-products.json');
    
    const pricingConfig = products.map(p => ({
      sku: p.SKU,
      name: p.Name,
      category: p.Category,
      brand: p.Brand,
      barcode: p.Barcode,
      status: p.Status,
      factory_cost_eur: p.Factory_Cost_EUR,
      packaging_cost_eur: p.Packaging_Cost_EUR,
      freight_kg_eur: p.Freight_kg_EUR,
      import_duty_pct: p.Import_Duty_Pct,
      overhead_pct: p.Overhead_Pct,
      cogs_eur: p.COGS_EUR,
      line: p.Line,
      weight_g: p.Weight_g,
      content_ml: p.Content_ml,
      net_content_ml: p.Net_Content_ml,
      dims_cm: p.Dims_cm,
      amazon_tier_key: p.Amazon_TierKey,
      box_size: p.Box_Size,
      qr_url: p.QRUrl,
    }));
    
    const allProductsConfig = products.map(p => ({
      ...p.rawData
    }));
    
    console.log(`💾 Writing to: ${pricingConfigPath}`);
    await fs.writeFile(
      pricingConfigPath,
      JSON.stringify(pricingConfig, null, 2),
      'utf-8'
    );
    console.log(`✅ Wrote ${pricingConfig.length} products`);
    
    console.log(`💾 Writing to: ${allProductsPath}`);
    await fs.writeFile(
      allProductsPath,
      JSON.stringify(allProductsConfig, null, 2),
      'utf-8'
    );
    console.log(`✅ Wrote ${allProductsConfig.length} products\n`);
    
    console.log('📊 Summary by Category:');
    const byCategory: Record<string, number> = {};
    products.forEach(p => {
      byCategory[p.Category] = (byCategory[p.Category] || 0) + 1;
    });
    Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
      console.log(`   ${cat}: ${count} products`);
    });
    console.log('');
    
    console.log('📊 Summary by Line:');
    const byLine: Record<string, number> = {};
    products.forEach(p => {
      byLine[p.Line] = (byLine[p.Line] || 0) + 1;
    });
    Object.entries(byLine).sort((a, b) => b[1] - a[1]).forEach(([line, count]) => {
      console.log(`   ${line}: ${count} products`);
    });
    console.log('');
    
    console.log('📊 Summary by Status:');
    const byStatus: Record<string, number> = {};
    products.forEach(p => {
      byStatus[p.Status] = (byStatus[p.Status] || 0) + 1;
    });
    Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} products`);
    });
    console.log('');
    
    console.log('✅ SUCCESS! Your Google Sheets data is now the authoritative source.');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. ✅ Config files updated with your edits');
    console.log('   2. 🔄 Restart server to use new config');
    console.log('   3. 💰 All repricing will now use YOUR factory costs');
    console.log('   4. 📊 All status/brand changes preserved');
    console.log('');
    console.log('Files updated:');
    console.log(`   - ${pricingConfigPath}`);
    console.log(`   - ${allProductsPath}`);
    console.log('');
    
  } catch (error: any) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

pullSheetsToConfig();
