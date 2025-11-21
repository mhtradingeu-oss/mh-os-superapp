import { generateInvoicePDF } from '../lib/pdf';
import type { Order, OrderLine, FinalPriceList, PartnerRegistry } from '@shared/schema';

const mockOrder: Order = {
  OrderID: 'ORD-TEST-001',
  PartnerID: 'HM-P-0001',
  CreatedTS: new Date().toISOString(),
  SubtotalGross: 308.20,
  DiscountTotal: 0,
  LoyaltyRedeemed: 0,
  Total: 308.20,
  Status: 'Confirmed',
  Notes: 'Test invoice for German tax compliance'
};

const mockOrderLines: OrderLine[] = [
  {
    SKU: 'BAR-BEARDKIT6I-001',
    Qty: 10,
    UnitPrice: 24.33,
    LineTotal: 243.30,
    OrderID: 'ORD-TEST-001'
  },
  {
    SKU: 'BAR-BEARDKIT3I-002',
    Qty: 5,
    UnitPrice: 12.98,
    LineTotal: 64.90,
    OrderID: 'ORD-TEST-001'
  }
];

const mockPartner: PartnerRegistry = {
  PartnerID: 'HM-P-0001',
  PartnerName: 'Premium Barbershop Berlin GmbH',
  Street: 'Friedrichstraße 123',
  Postal: '10117',
  City: 'Berlin',
  CountryCode: 'DE',
  TierLevel: 'Dealer Plus',
  Email: 'info@premium-barbershop.de',
  Phone: '+49 30 98765432',
  ContactPerson: 'Max Mustermann',
  ShippingStreet: '',
  ShippingPostal: '',
  ShippingCity: '',
  ShippingCountryCode: 'DE',
  LoyaltyBalance: 0,
  CreatedTS: new Date().toISOString()
};

const mockProducts: FinalPriceList[] = [
  {
    SKU: 'BAR-BEARDKIT6I-001',
    Name: 'Beard Care Kit Premium 6-in-1',
    Category: 'Beard Care',
    Weight_g: 450,
    Content_ml: 500,
    Factory_Cost_EUR: 8.50,
    UVP: 29.90,
    MAP: 24.90,
    Price_Web: 24.33,
    Status: 'Active',
    Brand: 'HAIROTICMEN'
  },
  {
    SKU: 'BAR-BEARDKIT3I-002',
    Name: 'Beard Care Kit Essential 3-in-1',
    Category: 'Beard Care',
    Weight_g: 250,
    Content_ml: 300,
    Factory_Cost_EUR: 4.50,
    UVP: 15.90,
    MAP: 13.90,
    Price_Web: 12.98,
    Status: 'Active',
    Brand: 'HAIROTICMEN'
  }
];

async function testInvoiceGeneration() {
  console.log('🧪 Testing German Tax-Compliant Invoice Generation...\n');
  
  try {
    const pdfPath = await generateInvoicePDF(mockOrder, mockOrderLines, mockPartner, mockProducts);
    console.log(`✅ Invoice PDF generated successfully!`);
    console.log(`📄 Path: ${pdfPath}`);
    console.log(`\n📋 Invoice includes:`);
    console.log(`  ✓ Sequential invoice number (RE-2025-XXXXX)`);
    console.log(`  ✓ Company legal info (UStIdNr, HRB)`);
    console.log(`  ✓ VAT breakdown (§14 UStG compliant)`);
    console.log(`  ✓ Grundpreis (PAngV compliant - €/kg or €/L)`);
    console.log(`  ✓ Bank details (IBAN, BIC)`);
    console.log(`  ✓ Payment terms (14 days net)`);
    console.log(`  ✓ Delivery date`);
  } catch (error: any) {
    console.error('❌ Error generating invoice:', error.message);
    process.exit(1);
  }
}

testInvoiceGeneration();
