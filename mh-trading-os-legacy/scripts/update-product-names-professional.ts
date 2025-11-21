#!/usr/bin/env tsx
/**
 * Update all 60 existing products with professional, marketable names
 */

import { readFileSync, writeFileSync } from 'fs';

// Professional name mappings based on category, size, and context
const PROFESSIONAL_NAMES: Record<string, string> = {
  // Shaving products
  'Shaving 200ml': 'Shaving Gel 200ml - Adrenalin Rush',
  'Shaving Gel 200ml': 'Shaving Gel 200ml - Smooth Glide',
  'Shaving Foam 250ml': 'Shaving Foam 250ml - Ultra Soft',
  
  // Hair Care products
  'Hair Care 100ml': 'Hair Gel 100ml - Strong Hold',
  'Hair Gel 50ml': 'Hair Gel 50ml - Silicon Velvet',
  'Hair Gel 100ml': 'Hair Gel 100ml - Super Strong',
  'Hair Care 75ml': 'Hair Wax 75ml - Matte Clay',
  'Hair Gel 150ml': 'Hair Gel 150ml - Wet Look',
  'Hair Wax 50ml': 'Hair Wax 50ml - Natural Hold',
  'Hair Wax 100ml': 'Hair Wax 100ml - Ultra Strong',
  'Hair Wax 150ml': 'Hair Wax 150ml - Maximum Control',
  
  // Beard Care products
  'Beard Care 50ml': 'Beard Oil 50ml - Magnetic Box',
  'Beard Oil 50ml': 'Beard Oil 50ml - Argan Blend',
  'Beard Kit 3-in-1': 'Beard Grooming Kit 3-in-1',
  'Beard Kit 6-in-1': 'Beard Complete Kit 6-in-1',
  
  // Skin Care products
  'Skin Care 200ml': 'Face Cream 200ml - Brightening',
  'Skin Care 50ml': 'Face Cream 50ml - Anti-Aging',
  'Face Cream 100ml': 'Face Cream 100ml - Moisturizing',
  'Face Mask 75ml': 'Face Mask 75ml - Detox Charcoal',
  
  // Cologne & Aftershave
  'Cologne 50ml': 'Cologne 50ml - Diamond Edition',
  'Cologne 100ml': 'Cologne 100ml - Blue Ocean',
  'Aftershave 50ml': 'Aftershave Balm 50ml - Deep Sky',
  'Aftershave 100ml': 'Aftershave Balm 100ml - Fresh Mint',
  
  // Treatment Kits
  'Treatment Kits 150ml': 'Protein Treatment Kit 1100ml - Complete Care',
  'Treatment Kit 100ml': 'Hair Treatment Kit 100ml - Repair System',
  
  // Accessories
  'Accessories 100ml': 'Alcohol Spray 100ml - Sanitizing',
  'Spray Bottle 150ml': 'Barber Spray Bottle 150ml',
  'Towel': 'Professional Barber Towel - Microfiber',
};

// Professional name generator based on category and size
function generateProfessionalName(currentName: string, category: string, size_ml?: number, sku?: string): string {
  // First try exact match
  if (PROFESSIONAL_NAMES[currentName]) {
    return PROFESSIONAL_NAMES[currentName];
  }
  
  // Generate based on category
  const sizeStr = size_ml ? `${size_ml}ml` : '';
  
  const categoryMappings: Record<string, string[]> = {
    'Shaving': ['Shaving Gel', 'Smooth Glide'],
    'Hair Wax': ['Hair Wax', 'Strong Hold'],
    'Hair Gel': ['Hair Gel', 'Wet Look'],
    'Hair Care': ['Hair Gel', 'Professional'],
    'Beard Care': ['Beard Oil', 'Premium Blend'],
    'Beard': ['Beard Care', 'Complete'],
    'Skin Care': ['Face Cream', 'Revitalizing'],
    'Skin': ['Face Cream', 'Hydrating'],
    'Cologne': ['Eau de Cologne', 'Signature'],
    'Aftershave': ['Aftershave Balm', 'Cooling'],
    'Treatment Kits': ['Treatment System', 'Professional'],
    'Accessories': ['Professional Tool', ''],
    'Tools': ['Barber Tool', 'Premium'],
  };
  
  const [baseType, variant] = categoryMappings[category] || [category, ''];
  
  if (variant) {
    return `${baseType} ${sizeStr} - ${variant}`.trim();
  }
  return `${baseType} ${sizeStr}`.trim();
}

async function updateProductNames() {
  console.log('🎨 Updating Product Names to Professional Standards\n');
  
  // Read existing products
  const all89 = JSON.parse(readFileSync('server/config/all-89-products.json', 'utf-8'));
  
  console.log(`📦 Total products: ${all89.length}\n`);
  
  let updatedCount = 0;
  
  // Update names for first 60 products (existing ones)
  for (let i = 0; i < Math.min(60, all89.length); i++) {
    const product = all89[i];
    const currentName = product.ProductName;
    
    // Generate professional name
    const professionalName = generateProfessionalName(
      currentName,
      product.Category,
      product.Size_mL,
      product.SKU
    );
    
    if (professionalName !== currentName) {
      console.log(`${i + 1}. ${product.SKU}`);
      console.log(`   OLD: ${currentName}`);
      console.log(`   NEW: ${professionalName}`);
      console.log();
      
      product.ProductName = professionalName;
      updatedCount++;
    }
  }
  
  // Save updated products
  writeFileSync('server/config/all-89-products.json', JSON.stringify(all89, null, 2));
  
  console.log(`\n✅ Updated ${updatedCount} product names`);
  console.log(`💾 Saved to: server/config/all-89-products.json`);
}

updateProductNames();
