import { getUncachableGoogleSheetClient, SPREADSHEET_ID } from '../lib/sheets';
import { retryWithBackoff } from '../lib/retry';
import QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

async function generateAllQRCodes() {
  console.log('🔄 GENERATING QR CODES FOR ALL PRODUCTS');
  console.log('═'.repeat(80));
  
  const sheets = await getUncachableGoogleSheetClient();
  
  // Get current sheet data
  const response = await retryWithBackoff(() =>
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'FinalPriceList!A1:AL91',
    })
  );
  
  const rows = response.data.values || [];
  const headers = rows[0];
  
  // Find column indices
  const idx = {
    sku: headers.indexOf('SKU'),
    name: headers.indexOf('Name'),
    qrUrl: headers.indexOf('QRUrl'),
    qrCode: headers.indexOf('QRCode'),
    status: headers.indexOf('Status'),
  };
  
  console.log(`\n📋 Column Indices:`);
  console.log(`   SKU: ${idx.sku}, Name: ${idx.name}, QR URL: ${idx.qrUrl}, QR Code: ${idx.qrCode}, Status: ${idx.status}`);
  
  // Create QR code directory if it doesn't exist
  const qrDir = path.join(process.cwd(), 'attached_assets', 'qr_codes');
  if (!fs.existsSync(qrDir)) {
    fs.mkdirSync(qrDir, { recursive: true });
    console.log(`\n📁 Created QR code directory: ${qrDir}`);
  }
  
  // Helper function to convert column index to Excel column letter
  function getColumnLetter(index: number): string {
    let letter = '';
    while (index >= 0) {
      letter = String.fromCharCode(65 + (index % 26)) + letter;
      index = Math.floor(index / 26) - 1;
    }
    return letter;
  }
  
  const updates: any[] = [];
  let generated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sku = String(row[idx.sku] || '').trim();
    const name = String(row[idx.name] || '').trim();
    const qrUrl = String(row[idx.qrUrl] || '').trim();
    const status = String(row[idx.status] || '').trim();
    
    if (!qrUrl || qrUrl === '') {
      skipped++;
      console.log(`   ⏭️  ${sku}: ${name} - No URL, skipping`);
      continue;
    }
    
    try {
      // Generate QR code filename
      const filename = `${sku.replace(/[^a-zA-Z0-9-]/g, '_')}.png`;
      const filepath = path.join(qrDir, filename);
      
      // Generate QR code
      await QRCode.toFile(filepath, qrUrl, {
        width: 300,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
      
      // Update the QRCode column with the file path
      const rowNumber = i + 1;
      const qrCodePath = `attached_assets/qr_codes/${filename}`;
      
      updates.push({
        range: `FinalPriceList!${getColumnLetter(idx.qrCode)}${rowNumber}`,
        values: [[qrCodePath]]
      });
      
      generated++;
      console.log(`   ✅ ${sku}: ${name.substring(0, 40)} → ${filename}`);
    } catch (error) {
      errors++;
      console.error(`   ❌ ${sku}: ${name} - Error: ${error}`);
    }
  }
  
  console.log(`\n📊 QR CODE GENERATION SUMMARY:`);
  console.log(`   Total Products: ${rows.length - 1}`);
  console.log(`   Generated: ${generated}`);
  console.log(`   Skipped (no URL): ${skipped}`);
  console.log(`   Errors: ${errors}`);
  
  if (updates.length > 0 && idx.qrCode !== -1) {
    console.log(`\n💾 Writing ${updates.length} QR code paths to Google Sheets...`);
    
    await retryWithBackoff(() =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates,
        },
      })
    );
    
    console.log('✅ QR code paths written successfully!');
  } else if (idx.qrCode === -1) {
    console.log(`\n⚠️  QRCode column not found in sheet - QR code paths not written to sheet`);
    console.log(`   (QR codes were generated successfully in: ${qrDir})`);
  }
  
  console.log('\n✅ QR CODE GENERATION COMPLETE!');
  console.log(`   All QR codes saved to: ${qrDir}`);
}

generateAllQRCodes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
