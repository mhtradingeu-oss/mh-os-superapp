/**
 * Document Rendering Engine
 * Handles HTML rendering with variable substitution and translations
 */

import type { RenderOptions, DocumentTemplate } from './document.model';
import { documentLogoService } from './document.logo';

class DocumentRenderService {
  /**
   * Render HTML template with variable substitution
   */
  async renderToHTML(
    template: DocumentTemplate,
    variables: Record<string, any>,
    translations: Record<string, string>,
    options: {
      includeLogo?: boolean;
      language?: 'EN' | 'AR' | 'DE';
    } = {}
  ): Promise<string> {
    const { includeLogo = true, language } = options;
    const lang = language || template.Language;

    let html = template.ContentHTML;

    // Add logo if requested
    if (includeLogo) {
      const logoDataUri = await documentLogoService.getLogoBase64();
      if (logoDataUri) {
        const logoHtml = `
          <div style="text-align: center; margin-bottom: 30px;">
            <img src="${logoDataUri}" alt="MH Trading Logo" style="max-width: 200px; height: auto;" />
          </div>
        `;
        html = logoHtml + html;
      }
    }

    // Replace variables {{variableName}}
    Object.keys(variables).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = this.formatValue(variables[key]);
      html = html.replace(new RegExp(placeholder, 'g'), value);
    });

    // Replace translation keys {{t.keyName}}
    Object.keys(translations).forEach(key => {
      const placeholder = `{{t.${key}}}`;
      html = html.replace(
        new RegExp(placeholder.replace(/\./g, '\\.'), 'g'),
        translations[key]
      );
    });

    // Wrap in HTML document with proper styling
    html = this.wrapInHTMLDocument(html, lang);

    return html;
  }

  /**
   * Format value for display
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    if (value instanceof Date) {
      return value.toLocaleDateString();
    }
    return String(value);
  }

  /**
   * Wrap content in full HTML document
   */
  private wrapInHTMLDocument(content: string, language: 'EN' | 'AR' | 'DE'): string {
    const isRTL = language === 'AR';
    const dir = isRTL ? 'rtl' : 'ltr';
    const align = isRTL ? 'right' : 'left';

    return `
<!DOCTYPE html>
<html dir="${dir}" lang="${language.toLowerCase()}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    @page {
      size: A4;
      margin: 2cm;
    }
    
    body {
      direction: ${dir};
      text-align: ${align};
      font-family: Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #000;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px;
    }
    
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: bold;
    }
    
    h1 { font-size: 18pt; }
    h2 { font-size: 16pt; }
    h3 { font-size: 14pt; }
    
    p {
      margin: 0.5em 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
    }
    
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: ${align};
    }
    
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    
    .signature-line {
      margin-top: 60px;
      padding-top: 20px;
      border-top: 2px solid #000;
      width: 200px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 10pt;
      color: #666;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>
    `.trim();
  }

  /**
   * Strip HTML to plain text (for PDF fallback)
   */
  htmlToPlainText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gs, '')
      .replace(/<script[^>]*>.*?<\/script>/gs, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }
}

export const documentRenderService = new DocumentRenderService();
