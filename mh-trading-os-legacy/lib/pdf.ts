import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Order, OrderLine, FinalPriceList, PartnerRegistry, Quote, QuoteLine } from '@shared/schema';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { sheetsService } from './sheets';

const PDF_DIR = path.join(process.cwd(), 'client', 'public', 'docs');
const LOGO_PATH = path.join(process.cwd(), 'attached_assets', 'MH Trading Logo_1762861944638.png');

export async function ensurePDFDirectory() {
  if (!existsSync(PDF_DIR)) {
    await mkdir(PDF_DIR, { recursive: true });
  }
}

interface CompanyInfo {
  name: string;
  street: string;
  postal: string;
  city: string;
  country: string;
  ustIdNr: string;
  hrb: string;
  iban: string;
  bic: string;
  bank: string;
  phone: string;
  email: string;
  web: string;
  paymentTermsDays: number;
}

async function getCompanyInfo(): Promise<CompanyInfo> {
  try {
    const settings = await sheetsService.getSettings();
    const getVal = (key: string, def: string = '') => 
      settings.find(s => s.Key === key)?.Value || def;
    
    return {
      name: getVal('CompanyName', 'MH Trading UG'),
      street: getVal('CompanyStreet', 'Polierweg'),
      postal: getVal('CompanyPostal', '12351'),
      city: getVal('CompanyCity', 'Berlin-Bezirk Neukolln'),
      country: getVal('CompanyCountry', 'Germany'),
      ustIdNr: getVal('UStIdNr', '29/442/31572'),
      hrb: getVal('HRB', 'HRB 12345 B'),
      iban: getVal('IBAN', 'DE89 3704 0044 0532 0130 00'),
      bic: getVal('BIC', 'COBADEFFXXX'),
      bank: getVal('BankName', 'Commerzbank AG'),
      phone: getVal('CompanyPhone', '(+49) 3-302-206-7319'),
      email: getVal('CompanyEmail', 'mhtradingeu@gmail.com'),
      web: getVal('CompanyWeb', 'http://mhtrading-eu.com'),
      paymentTermsDays: parseInt(getVal('PaymentTermsDays', '30'))
    };
  } catch (error) {
    console.error('Failed to load company info from Settings:', error);
    return {
      name: 'MH Trading UG',
      street: 'Polierweg',
      postal: '12351',
      city: 'Berlin-Bezirk Neukolln',
      country: 'Germany',
      ustIdNr: '29/442/31572',
      hrb: 'HRB 12345 B',
      iban: 'DE89 3704 0044 0532 0130 00',
      bic: 'COBADEFFXXX',
      bank: 'Commerzbank AG',
      phone: '(+49) 3-302-206-7319',
      email: 'mhtradingeu@gmail.com',
      web: 'http://mhtrading-eu.com',
      paymentTermsDays: 30
    };
  }
}

async function getNextInvoiceNumber(): Promise<string> {
  try {
    const { next } = await sheetsService.incrementCounter('InvoiceCounter', { start: 1000, max: 999999 });
    const year = new Date().getFullYear();
    return `RE-${year}-${next.toString().padStart(5, '0')}`;
  } catch (error) {
    console.error('Failed to get invoice number:', error);
    const fallback = `RE-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}`;
    return fallback;
  }
}

function calculateGrundpreis(product: FinalPriceList | undefined, unitPriceGross: number): string {
  if (!product) return '';
  
  const weight_g = product.Weight_g || 0;
  const content_ml = product.Content_ml || 0;
  
  if (weight_g > 0) {
    const pricePerKg = (unitPriceGross / weight_g) * 1000;
    return `(€${pricePerKg.toFixed(2)}/kg)`;
  }
  
  if (content_ml > 0) {
    const pricePerL = (unitPriceGross / content_ml) * 1000;
    return `(€${pricePerL.toFixed(2)}/L)`;
  }
  
  return '';
}

/**
 * Sanitize text for PDF WinAnsi encoding by replacing Unicode characters with ASCII equivalents
 */
function sanitizeTextForPDF(text: string): string {
  if (!text) return '';
  
  return text
    // Replace various dash/hyphen Unicode characters with regular hyphen
    .replace(/[\u2010-\u2015]/g, '-')  // Various dashes and hyphens
    .replace(/[\u2018\u2019]/g, "'")   // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"')   // Smart double quotes
    .replace(/\u2026/g, '...')         // Ellipsis
    .replace(/[\u2013\u2014]/g, '-')   // En dash and em dash
    .replace(/\u00A0/g, ' ')           // Non-breaking space
    .replace(/\u00AD/g, '')            // Soft hyphen
    // Remove any remaining characters outside WinAnsi range (0x20-0x7E and 0xA0-0xFF)
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

/**
 * Safely format date string, returning fallback for invalid dates
 */
function formatDateForPDF(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
  } catch {
    return '-';
  }
}

/**
 * Load and embed company logo in PDF
 */
async function embedCompanyLogo(pdfDoc: PDFDocument) {
  try {
    const logoBytes = await readFile(LOGO_PATH);
    const logoImage = await pdfDoc.embedPng(logoBytes);
    return logoImage;
  } catch (error) {
    console.error('Failed to load company logo:', error);
    return null;
  }
}

export async function generateInvoicePDF(
  order: Order,
  orderLines: OrderLine[],
  partner: PartnerRegistry,
  products: FinalPriceList[]
): Promise<string> {
  await ensurePDFDirectory();
  
  const companyInfo = await getCompanyInfo();
  const invoiceNumber = await getNextInvoiceNumber();
  const vatRate = 19;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSmall = font;

  // Embed and draw company logo
  const logo = await embedCompanyLogo(pdfDoc);
  let logoBottomY = height - 40;
  if (logo) {
    const logoWidth = 100;
    const logoHeight = (logo.height / logo.width) * logoWidth;
    page.drawImage(logo, {
      x: width - logoWidth - 50,
      y: height - logoHeight - 40,
      width: logoWidth,
      height: logoHeight,
    });
    logoBottomY = height - logoHeight - 40;
  }

  let y = height - 40;

  // Company Info - Left Top
  page.drawText(sanitizeTextForPDF(companyInfo.name), {
    x: 50,
    y,
    size: 11,
    font: fontBold,
    color: rgb(0.08, 0.72, 0.65),
  });

  // Tagline - Below logo (aligned to right, no overlap)
  page.drawText('Trade Smart Grow Fast', {
    x: width - 200,
    y: logoBottomY - 10,
    size: 9,
    font: fontBold,
    color: rgb(0.08, 0.72, 0.65),
  });

  y -= 14;
  page.drawText(sanitizeTextForPDF(`${companyInfo.street}`), {
    x: 50,
    y,
    size: 9,
    font,
  });

  y -= 12;
  page.drawText(sanitizeTextForPDF(`${companyInfo.postal} ${companyInfo.city}`), {
    x: 50,
    y,
    size: 9,
    font,
  });

  y -= 12;
  page.drawText(sanitizeTextForPDF(`Tel: ${companyInfo.phone}`), {
    x: 50,
    y,
    size: 8,
    font,
  });

  y -= 11;
  page.drawText(sanitizeTextForPDF(`E-Mail: ${companyInfo.email}`), {
    x: 50,
    y,
    size: 8,
    font,
  });

  // Invoice Header
  y = height - 140;
  page.drawText('RECHNUNG', {
    x: 50,
    y,
    size: 22,
    font: fontBold,
    color: rgb(0.13, 0.29, 0.53),
  });

  y -= 35;
  page.drawText(sanitizeTextForPDF(`Rechnungsnummer: ${invoiceNumber}`), {
    x: 50,
    y,
    size: 11,
    font: fontBold,
  });

  y -= 16;
  const invoiceDate = new Date(order.CreatedTS);
  page.drawText(sanitizeTextForPDF(`Rechnungsdatum: ${invoiceDate.toLocaleDateString('de-DE')}`), {
    x: 50,
    y,
    size: 10,
    font,
  });

  y -= 14;
  const deliveryDate = new Date(invoiceDate);
  deliveryDate.setDate(deliveryDate.getDate() + 2);
  page.drawText(sanitizeTextForPDF(`Lieferdatum: ${deliveryDate.toLocaleDateString('de-DE')}`), {
    x: 50,
    y,
    size: 10,
    font,
  });

  y -= 14;
  const dueDate = new Date(invoiceDate);
  dueDate.setDate(dueDate.getDate() + companyInfo.paymentTermsDays);
  page.drawText(sanitizeTextForPDF(`Zahlungsziel: ${dueDate.toLocaleDateString('de-DE')} (${companyInfo.paymentTermsDays} Tage netto)`), {
    x: 50,
    y,
    size: 10,
    font,
  });

  // Partner Details - Bill To
  y -= 40;
  page.drawText('Bill To:', {
    x: 50,
    y,
    size: 12,
    font: fontBold,
  });

  y -= 20;
  page.drawText(sanitizeTextForPDF(partner.PartnerName), {
    x: 50,
    y,
    size: 10,
    font,
  });

  if (partner.Street) {
    y -= 15;
    page.drawText(sanitizeTextForPDF(partner.Street), {
      x: 50,
      y,
      size: 10,
      font,
    });
  }

  if (partner.City) {
    y -= 15;
    page.drawText(sanitizeTextForPDF(`${partner.Postal || ''} ${partner.City}`), {
      x: 50,
      y,
      size: 10,
      font,
    });
  }

  // Ship To Address (use shipping address if available, otherwise use billing)
  const shipStreet = partner.ShippingStreet || partner.Street;
  const shipCity = partner.ShippingCity || partner.City;
  const shipPostal = partner.ShippingPostal || partner.Postal;
  const shipCountry = partner.ShippingCountryCode || partner.CountryCode;

  // Only show Ship To if different from Bill To
  const isDifferentAddress = partner.ShippingStreet && (
    partner.ShippingStreet !== partner.Street ||
    partner.ShippingCity !== partner.City
  );

  if (isDifferentAddress) {
    y -= 30;
    page.drawText('Ship To:', {
      x: 320,
      y: y + 30 * 3, // Align with Bill To header
      size: 12,
      font: fontBold,
    });

    let shipY = y + 30 * 2 + 10;
    page.drawText(sanitizeTextForPDF(partner.PartnerName), {
      x: 320,
      y: shipY,
      size: 10,
      font,
    });

    if (shipStreet) {
      shipY -= 15;
      page.drawText(sanitizeTextForPDF(shipStreet), {
        x: 320,
        y: shipY,
        size: 10,
        font,
      });
    }

    if (shipCity) {
      shipY -= 15;
      page.drawText(sanitizeTextForPDF(`${shipPostal || ''} ${shipCity}`), {
        x: 320,
        y: shipY,
        size: 10,
        font,
      });
    }
  }

  // Line Items Table
  y -= 40;
  const tableY = y;

  // Table Headers
  page.drawText('SKU', { x: 50, y: tableY, size: 10, font: fontBold });
  page.drawText('Product', { x: 130, y: tableY, size: 10, font: fontBold });
  page.drawText('Weight', { x: 300, y: tableY, size: 10, font: fontBold });
  page.drawText('Qty', { x: 360, y: tableY, size: 10, font: fontBold });
  page.drawText('Unit Price', { x: 410, y: tableY, size: 10, font: fontBold });
  page.drawText('Total', { x: 490, y: tableY, size: 10, font: fontBold });

  y = tableY - 20;

  // Draw line under headers
  page.drawLine({
    start: { x: 50, y: y + 5 },
    end: { x: 545, y: y + 5 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  // Line Items
  orderLines.forEach((line) => {
    const product = products.find(p => p.SKU === line.SKU);
    const productName = product?.Name || line.SKU;
    const weight = product?.Weight_g ? `${product.Weight_g}g` : '-';

    page.drawText(sanitizeTextForPDF(line.SKU.substring(0, 12)), { x: 50, y, size: 9, font });
    page.drawText(sanitizeTextForPDF(productName.substring(0, 25)), { x: 130, y, size: 9, font });
    page.drawText(sanitizeTextForPDF(weight), { x: 300, y, size: 9, font });
    page.drawText(line.Qty.toString(), { x: 360, y, size: 9, font });
    page.drawText(`€${line.UnitPrice.toFixed(2)}`, { x: 410, y, size: 9, font });
    page.drawText(`€${line.LineTotal.toFixed(2)}`, { x: 490, y, size: 9, font });

    y -= 18;
  });

  // Totals
  y -= 30;
  page.drawLine({
    start: { x: 350, y: y + 5 },
    end: { x: 545, y: y + 5 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  y -= 20;
  page.drawText('Subtotal:', { x: 400, y, size: 10, font });
  page.drawText(`€${order.SubtotalGross.toFixed(2)}`, { x: 480, y, size: 10, font });

  if (order.DiscountTotal && order.DiscountTotal > 0) {
    y -= 18;
    page.drawText('Discount:', { x: 400, y, size: 10, font });
    page.drawText(`-€${order.DiscountTotal.toFixed(2)}`, { x: 480, y, size: 10, font });
  }

  if (order.LoyaltyRedeemed && order.LoyaltyRedeemed > 0) {
    y -= 18;
    page.drawText('Loyalty Redeemed:', { x: 400, y, size: 10, font });
    page.drawText(`-€${order.LoyaltyRedeemed.toFixed(2)}`, { x: 480, y, size: 10, font });
  }

  y -= 25;
  page.drawLine({
    start: { x: 350, y: y + 5 },
    end: { x: 545, y: y + 5 },
    thickness: 2,
    color: rgb(0.13, 0.29, 0.53),
  });

  y -= 20;
  page.drawText('TOTAL:', { x: 400, y, size: 12, font: fontBold });
  page.drawText(`€${order.Total.toFixed(2)}`, { x: 480, y, size: 12, font: fontBold, color: rgb(0.13, 0.29, 0.53) });

  // Footer with complete company info and contact details
  const footerY = 50;
  page.drawLine({
    start: { x: 50, y: footerY + 50 },
    end: { x: width - 50, y: footerY + 50 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  
  // Company name and address - left side
  page.drawText(sanitizeTextForPDF(companyInfo.name), {
    x: 50,
    y: footerY + 30,
    size: 9,
    font: fontBold,
    color: rgb(0.08, 0.72, 0.65),
  });
  
  page.drawText(sanitizeTextForPDF(`${companyInfo.street}, ${companyInfo.postal} ${companyInfo.city}`), {
    x: 50,
    y: footerY + 18,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  
  // Thank you message - left side
  page.drawText('Thank you for your business!', {
    x: 50,
    y: footerY,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  
  // Footer contact info - centered
  const footerText = `${companyInfo.phone}  ${companyInfo.email}  ${companyInfo.web}  ${companyInfo.ustIdNr}`;
  const footerTextWidth = font.widthOfTextAtSize(footerText, 8);
  
  page.drawText(sanitizeTextForPDF(footerText), {
    x: (width - footerTextWidth) / 2,
    y: footerY + 30,
    size: 8,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  const pdfBytes = await pdfDoc.save();
  const fileName = `invoice-${order.OrderID}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);

  await writeFile(filePath, pdfBytes);

  return `/docs/${fileName}`;
}

export async function generateQuotePDF(
  quote: Quote,
  quoteLines: QuoteLine[],
  partner: PartnerRegistry,
  products: FinalPriceList[]
): Promise<string> {
  await ensurePDFDirectory();

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Embed and draw company logo
  const logo = await embedCompanyLogo(pdfDoc);
  let logoBottomY = height - 40;
  if (logo) {
    const logoWidth = 120;
    const logoHeight = (logo.height / logo.width) * logoWidth;
    page.drawImage(logo, {
      x: width - logoWidth - 50,
      y: height - logoHeight - 40,
      width: logoWidth,
      height: logoHeight,
    });
    logoBottomY = height - logoHeight - 40;
  }

  let y = height - 50;

  // Header
  page.drawText('QUOTATION', {
    x: 50,
    y,
    size: 24,
    font: fontBold,
    color: rgb(0.08, 0.72, 0.65), // Teal color
  });

  // Tagline - Below logo (aligned to right, no overlap)
  page.drawText('Trade Smart Grow Fast', {
    x: width - 200,
    y: logoBottomY - 10,
    size: 9,
    font: fontBold,
    color: rgb(0.08, 0.72, 0.65),
  });

  y -= 40;
  page.drawText(sanitizeTextForPDF(`Quote #${quote.QuoteID}`), {
    x: 50,
    y,
    size: 12,
    font: fontBold,
  });

  y -= 20;
  page.drawText(sanitizeTextForPDF(`Date: ${formatDateForPDF(quote.CreatedTS)}`), {
    x: 50,
    y,
    size: 10,
    font,
  });

  y -= 15;
  page.drawText(sanitizeTextForPDF(`Status: ${quote.Status || 'Active'}`), {
    x: 50,
    y,
    size: 10,
    font,
  });

  // Partner Details - Bill To
  y -= 40;
  page.drawText('Prepared For:', {
    x: 50,
    y,
    size: 12,
    font: fontBold,
  });

  y -= 20;
  page.drawText(sanitizeTextForPDF(partner.PartnerName), {
    x: 50,
    y,
    size: 10,
    font,
  });

  if (partner.Street) {
    y -= 15;
    page.drawText(sanitizeTextForPDF(partner.Street), {
      x: 50,
      y,
      size: 10,
      font,
    });
  }

  if (partner.City) {
    y -= 15;
    const cityLine = partner.Postal ? `${partner.Postal} ${partner.City}` : partner.City;
    page.drawText(sanitizeTextForPDF(cityLine), {
      x: 50,
      y,
      size: 10,
      font,
    });
  }

  // Ship To Address (use shipping address if available, otherwise use billing)
  const shipStreet = partner.ShippingStreet || partner.Street;
  const shipCity = partner.ShippingCity || partner.City;
  const shipPostal = partner.ShippingPostal || partner.Postal;
  const shipCountry = partner.ShippingCountryCode || partner.CountryCode;

  // Only show Ship To if different from Bill To
  const isDifferentAddress = partner.ShippingStreet && (
    partner.ShippingStreet !== partner.Street ||
    partner.ShippingCity !== partner.City
  );

  if (isDifferentAddress) {
    y -= 30;
    page.drawText('Ship To:', {
      x: 320,
      y: y + 30 * 3, // Align with Prepared For header
      size: 12,
      font: fontBold,
    });

    let shipY = y + 30 * 2 + 10;
    page.drawText(sanitizeTextForPDF(partner.PartnerName), {
      x: 320,
      y: shipY,
      size: 10,
      font,
    });

    if (shipStreet) {
      shipY -= 15;
      page.drawText(sanitizeTextForPDF(shipStreet), {
        x: 320,
        y: shipY,
        size: 10,
        font,
      });
    }

    if (shipCity) {
      shipY -= 15;
      page.drawText(sanitizeTextForPDF(`${shipPostal || ''} ${shipCity}`), {
        x: 320,
        y: shipY,
        size: 10,
        font,
      });
    }
  }

  // Line Items Table
  y -= 40;
  let tableY = y;

  // Helper function to draw table headers
  const drawTableHeaders = (currentPage: any, headerY: number) => {
    currentPage.drawText('SKU', { x: 50, y: headerY, size: 10, font: fontBold });
    currentPage.drawText('Product', { x: 130, y: headerY, size: 10, font: fontBold });
    currentPage.drawText('Weight', { x: 300, y: headerY, size: 10, font: fontBold });
    currentPage.drawText('Qty', { x: 360, y: headerY, size: 10, font: fontBold });
    currentPage.drawText('Unit Price', { x: 410, y: headerY, size: 10, font: fontBold });
    currentPage.drawText('Total', { x: 490, y: headerY, size: 10, font: fontBold });

    currentPage.drawLine({
      start: { x: 50, y: headerY - 15 },
      end: { x: 545, y: headerY - 15 },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
  };

  // Table Headers
  drawTableHeaders(page, tableY);
  y = tableY - 20;

  // Line Items with pagination
  quoteLines.forEach((line) => {
    // Check if we need a new page (leave space for totals + footer)
    if (y < 180) {
      page = pdfDoc.addPage([595, 842]);
      y = height - 50;
      drawTableHeaders(page, y);
      y -= 20;
    }

    const product = products.find(p => p.SKU === line.SKU);
    const productName = product?.Name || line.SKU;
    const weight = product?.Weight_g ? `${product.Weight_g}g` : '-';

    page.drawText(sanitizeTextForPDF(line.SKU.substring(0, 12)), { x: 50, y, size: 9, font });
    page.drawText(sanitizeTextForPDF(productName.substring(0, 25)), { x: 130, y, size: 9, font });
    page.drawText(sanitizeTextForPDF(weight), { x: 300, y, size: 9, font });
    page.drawText(line.Qty.toString(), { x: 360, y, size: 9, font });
    page.drawText(`€${line.UnitPrice.toFixed(2)}`, { x: 410, y, size: 9, font });
    page.drawText(`€${line.LineTotal.toFixed(2)}`, { x: 490, y, size: 9, font });

    y -= 18;
  });

  // Totals
  y -= 30;
  page.drawLine({
    start: { x: 350, y: y + 5 },
    end: { x: 545, y: y + 5 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  y -= 20;
  page.drawText('Subtotal:', { x: 400, y, size: 10, font });
  page.drawText(`€${(quote.SubtotalGross || 0).toFixed(2)}`, { x: 480, y, size: 10, font });

  if (quote.DiscountTotal && quote.DiscountTotal > 0) {
    y -= 18;
    page.drawText('Discount:', { x: 400, y, size: 10, font });
    page.drawText(`-€${quote.DiscountTotal.toFixed(2)}`, { x: 480, y, size: 10, font });
  }

  if (quote.LoyaltyRedeemed && quote.LoyaltyRedeemed > 0) {
    y -= 18;
    page.drawText('Loyalty Redeemed:', { x: 400, y, size: 10, font });
    page.drawText(`-€${quote.LoyaltyRedeemed.toFixed(2)}`, { x: 480, y, size: 10, font });
  }

  y -= 25;
  page.drawLine({
    start: { x: 350, y: y + 5 },
    end: { x: 545, y: y + 5 },
    thickness: 2,
    color: rgb(0.08, 0.72, 0.65),
  });

  y -= 20;
  page.drawText('TOTAL:', { x: 400, y, size: 12, font: fontBold });
  page.drawText(`€${(quote.Total || 0).toFixed(2)}`, { x: 480, y, size: 12, font: fontBold, color: rgb(0.08, 0.72, 0.65) });

  // Footer with complete company info and contact details (matching invoice template)
  const companyInfo = await getCompanyInfo();
  const footerY = 50;
  page.drawLine({
    start: { x: 50, y: footerY + 50 },
    end: { x: width - 50, y: footerY + 50 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  
  // Company name and address - left side
  page.drawText(sanitizeTextForPDF(companyInfo.name), {
    x: 50,
    y: footerY + 30,
    size: 9,
    font: fontBold,
    color: rgb(0.08, 0.72, 0.65),
  });
  
  page.drawText(sanitizeTextForPDF(`${companyInfo.street}, ${companyInfo.postal} ${companyInfo.city}`), {
    x: 50,
    y: footerY + 18,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  
  // Validity message - left side
  page.drawText('This quote is valid for 30 days.', {
    x: 50,
    y: footerY,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  
  // Footer contact info - centered
  const footerText = `${companyInfo.phone}  ${companyInfo.email}  ${companyInfo.web}  ${companyInfo.ustIdNr}`;
  const footerTextWidth = font.widthOfTextAtSize(footerText, 8);
  
  page.drawText(sanitizeTextForPDF(footerText), {
    x: (width - footerTextWidth) / 2,
    y: footerY + 30,
    size: 8,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });

  const pdfBytes = await pdfDoc.save();
  const fileName = `quote-${quote.QuoteID}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);

  await writeFile(filePath, pdfBytes);

  return `/docs/${fileName}`;
}

export async function generatePriceListPDF(
  products: FinalPriceList[],
  title: string = 'Price List'
): Promise<string> {
  await ensurePDFDirectory();

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([595, 842]); // A4
  let y = 792; // Start from top

  // Title
  page.drawText(title, {
    x: 50,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.13, 0.29, 0.53),
  });

  y -= 40;

  // Headers
  page.drawText('SKU', { x: 50, y, size: 10, font: fontBold });
  page.drawText('Product Name', { x: 130, y, size: 10, font: fontBold });
  page.drawText('UVP', { x: 350, y, size: 10, font: fontBold });
  page.drawText('MAP', { x: 420, y, size: 10, font: fontBold });
  page.drawText('Web', { x: 490, y, size: 10, font: fontBold });

  y -= 20;

  products.forEach((product, index) => {
    if (y < 100) {
      page = pdfDoc.addPage([595, 842]);
      y = 792;
    }

    page.drawText(product.SKU.substring(0, 12), { x: 50, y, size: 9, font });
    page.drawText(product.Name.substring(0, 35), { x: 130, y, size: 9, font });
    if (product.UVP) page.drawText(`€${product.UVP.toFixed(2)}`, { x: 350, y, size: 9, font });
    if (product.MAP) page.drawText(`€${product.MAP.toFixed(2)}`, { x: 420, y, size: 9, font });
    if (product.Price_Web) page.drawText(`€${product.Price_Web.toFixed(2)}`, { x: 490, y, size: 9, font });

    y -= 16;
  });

  const pdfBytes = await pdfDoc.save();
  const fileName = `pricelist-${Date.now()}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);

  await writeFile(filePath, pdfBytes);

  return `/docs/${fileName}`;
}
