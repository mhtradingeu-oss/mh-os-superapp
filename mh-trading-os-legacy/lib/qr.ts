import QRCode from 'qrcode';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const QR_DIR = path.join(process.cwd(), 'client', 'public', 'qr');

export async function ensureQRDirectory() {
  if (!existsSync(QR_DIR)) {
    await mkdir(QR_DIR, { recursive: true });
  }
  
  const standDir = path.join(QR_DIR, 'stand');
  if (!existsSync(standDir)) {
    await mkdir(standDir, { recursive: true });
  }
  
  const skuDir = path.join(QR_DIR, 'sku');
  if (!existsSync(skuDir)) {
    await mkdir(skuDir, { recursive: true });
  }
}

export async function generateStandQR(standId: string, baseUrl: string): Promise<string> {
  await ensureQRDirectory();
  
  const qrUrl = `${baseUrl}/qr?stand=${standId}`;
  const fileName = `stand-${standId}.png`;
  const filePath = path.join(QR_DIR, 'stand', fileName);
  
  await QRCode.toFile(filePath, qrUrl, {
    width: 512,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
  
  return `/qr/stand/${fileName}`;
}

export async function generateProductQR(
  sku: string,
  productName: string,
  uvp: number,
  baseUrl: string
): Promise<string> {
  await ensureQRDirectory();
  
  const qrUrl = `${baseUrl}/product/${sku}`;
  const fileName = `${sku.replace(/[^a-zA-Z0-9]/g, '_')}.png`;
  const filePath = path.join(QR_DIR, 'sku', fileName);
  
  await QRCode.toFile(filePath, qrUrl, {
    width: 512,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
  
  return `/qr/sku/${fileName}`;
}

export async function generateQRBuffer(data: string): Promise<Buffer> {
  return await QRCode.toBuffer(data, {
    width: 512,
    margin: 2,
  });
}
