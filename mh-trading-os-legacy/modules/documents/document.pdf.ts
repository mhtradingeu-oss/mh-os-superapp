/**
 * Document PDF Generator
 * Converts HTML templates to PDF with logo embedding
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFOptions, DocumentTemplate } from './document.model';
import { documentLogoService } from './document.logo';
import { documentRenderService } from './document.render';

class DocumentPDFService {
  /**
   * Generate PDF from HTML template
   */
  async generatePDF(
    template: DocumentTemplate,
    variables: Record<string, any>,
    translations: Record<string, string>,
    options: PDFOptions
  ): Promise<Buffer> {
    const { format = 'A4', margins = { top: 100, right: 50, bottom: 50, left: 50 }, includeLogo = true } = options;

    // Render HTML first
    const html = await documentRenderService.renderToHTML(
      template,
      variables,
      translations,
      { includeLogo: false, language: options.language } // Don't add logo in HTML, we'll add it in PDF
    );

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Set page size (A4: 595 x 842 points)
    const pageWidth = format === 'A4' ? 595 : 612;
    const pageHeight = format === 'A4' ? 842 : 792;
    
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Embed logo once for reuse across all pages
    let logoImage: any = null;
    let logoWidth = 150;
    let logoHeight = 0;
    
    if (includeLogo) {
      try {
        const logoBuffer = await documentLogoService.getLogoBuffer();
        logoImage = await pdfDoc.embedPng(logoBuffer);
        logoHeight = (logoImage.height / logoImage.width) * logoWidth;
      } catch (error) {
        console.error('[DocumentPDFService] Error embedding logo:', error);
      }
    }

    // Helper function to add logo to a page
    const addLogoToPage = (targetPage: any): number => {
      if (logoImage) {
        targetPage.drawImage(logoImage, {
          x: (pageWidth - logoWidth) / 2,
          y: pageHeight - 80,
          width: logoWidth,
          height: logoHeight,
        });
        return pageHeight - 100 - logoHeight;
      }
      return pageHeight - margins.top;
    };

    // Add logo to first page
    let yPosition = addLogoToPage(page);

    // Convert HTML to plain text (simplified)
    const text = documentRenderService.htmlToPlainText(html);
    
    const fontSize = 12;
    const lineHeight = fontSize * 1.5;
    const maxWidth = pageWidth - margins.left - margins.right;

    // Write text to PDF with automatic page breaks
    const lines = text.split('\n');
    let currentPage = page;
    
    for (const line of lines) {
      // Check if we need a new page
      if (yPosition < margins.bottom) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = addLogoToPage(currentPage);
      }
      
      // Word wrap long lines
      const wrappedLines = this.wrapText(line, font, fontSize, maxWidth);
      
      for (const wrappedLine of wrappedLines) {
        if (yPosition < margins.bottom) {
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          yPosition = addLogoToPage(currentPage);
        }
        
        currentPage.drawText(wrappedLine, {
          x: margins.left,
          y: yPosition,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
          maxWidth: maxWidth,
        });
        
        yPosition -= lineHeight;
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  /**
   * Wrap text to fit within max width
   */
  private wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
    if (!text) return [''];
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);
      
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines.length > 0 ? lines : [''];
  }
}

export const documentPDFService = new DocumentPDFService();
