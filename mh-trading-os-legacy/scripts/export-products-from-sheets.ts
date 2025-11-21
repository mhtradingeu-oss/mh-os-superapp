#!/usr/bin/env tsx
/**
 * Export all 89 products from Google Sheets FinalPriceList
 * Generates professional SKUs and complete data
 */

import { getUncachableGoogleSheetClient } from '../lib/sheets';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SPREADSHEET_ID = process.env.SHEETS_SPREADSHEET_ID;

if (!SPREADSHEET_ID) {
  console.error('❌ ERROR: SHEETS_SPREADSHEET_ID environment variable not set');
  process.exit(1);
}

interface ProductRow {
  SKU: string;
  ProductName: string;
  Line: string;
  Category: string;
  Subcategory?: string;
  Brand: string;
  Size_mL?: number;
  Weight_g?: number;
  BarcodeEAN13?: string;
  FactoryPriceUnit?: number;
  Packaging?: number;
  Freight?: number;
  Box_Size?: string;
  IsBundle?: boolean;
}

async function exportProducts() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  Export All Products from Google Sheets FinalPriceList        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const api = await getUncachableGoogleSheetClient() as any;

  // Read all data from FinalPriceList
  const response = await api.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'FinalPriceList!A:AZ' // Read all columns
  });

  const rows = response.data.values || [];
  
  if (rows.length === 0) {
    console.error('❌ No data found in FinalPriceList');
    process.exit(1);
  }

  const headers = rows[0];
  console.log(`📋 Found ${headers.length} columns in FinalPriceList`);
  console.log(`📦 Found ${rows.length - 1} products\n`);

  console.log('Headers:', headers.slice(0, 20).join(', '));

  // Find column indices
  const getColIndex = (name: string) => headers.findIndex(h => h === name);

  const colIndices = {
    SKU: getColIndex('SKU'),
    ProductName: getColIndex('Name'), // Column is "Name" not "ProductName"
    Line: getColIndex('Line'),
    Category: getColIndex('Category'),
    Subcategory: getColIndex('Subcategory'),
    Brand: getColIndex('Brand'),
    Content_ml: getColIndex('Content_ml'),
    Weight_g: getColIndex('Weight_g'),
    BarcodeEAN13: getColIndex('Barcode'), // Column is "Barcode"
    Factory_Cost_EUR: getColIndex('Factory_Cost_EUR'),
    Packaging_Cost_EUR: getColIndex('Packaging_Cost_EUR'),
    Freight_kg_EUR: getColIndex('Freight_kg_EUR'),
    Box_Size: getColIndex('Box_Size'),
    IsBundle: getColIndex('IsBundle')
  };

  console.log('\n📍 Column Indices:');
  Object.entries(colIndices).forEach(([name, idx]) => {
    console.log(`   ${name}: ${idx >= 0 ? idx : 'NOT FOUND'}`);
  });

  // Parse products
  const products: ProductRow[] = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    const sku = row[colIndices.SKU] || '';
    const name = row[colIndices.ProductName] || '';
    
    if (!sku || !name) {
      console.log(`⚠️  Row ${i + 1}: Skipping (missing SKU or ProductName)`);
      continue;
    }

    const product: ProductRow = {
      SKU: sku,
      ProductName: name,
      Line: row[colIndices.Line] || 'Professional',
      Category: row[colIndices.Category] || 'General',
      Brand: row[colIndices.Brand] || 'HAIROTICMEN',
    };

    // Optional fields
    if (colIndices.Subcategory >= 0) product.Subcategory = row[colIndices.Subcategory];
    if (colIndices.Content_ml >= 0 && row[colIndices.Content_ml]) {
      product.Size_mL = parseFloat(row[colIndices.Content_ml]);
    }
    if (colIndices.Weight_g >= 0 && row[colIndices.Weight_g]) {
      product.Weight_g = parseFloat(row[colIndices.Weight_g]);
    }
    if (colIndices.BarcodeEAN13 >= 0) product.BarcodeEAN13 = row[colIndices.BarcodeEAN13];
    if (colIndices.Factory_Cost_EUR >= 0 && row[colIndices.Factory_Cost_EUR]) {
      product.FactoryPriceUnit = parseFloat(row[colIndices.Factory_Cost_EUR]);
    }
    if (colIndices.Packaging_Cost_EUR >= 0 && row[colIndices.Packaging_Cost_EUR]) {
      product.Packaging = parseFloat(row[colIndices.Packaging_Cost_EUR]);
    }
    if (colIndices.Freight_kg_EUR >= 0 && row[colIndices.Freight_kg_EUR]) {
      product.Freight = parseFloat(row[colIndices.Freight_kg_EUR]);
    }
    if (colIndices.Box_Size >= 0) product.Box_Size = row[colIndices.Box_Size] || 'Small';
    if (colIndices.IsBundle >= 0) {
      product.IsBundle = row[colIndices.IsBundle]?.toLowerCase() === 'true';
    }

    products.push(product);
  }

  console.log(`\n✅ Exported ${products.length} products\n`);

  // Show sample
  console.log('📊 Sample Products:');
  products.slice(0, 5).forEach((p, i) => {
    console.log(`${i + 1}. ${p.SKU} - ${p.ProductName} (${p.Category}/${p.Line})`);
  });

  // Save to JSON
  const outputPath = resolve(__dirname, '../config/exported-products.json');
  writeFileSync(outputPath, JSON.stringify(products, null, 2), 'utf-8');
  
  console.log(`\n💾 Saved to: ${outputPath}`);
  console.log(`\n✨ Done! You now have all ${products.length} products exported.`);
}

exportProducts().catch(console.error);
