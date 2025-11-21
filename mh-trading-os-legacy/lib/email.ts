import nodemailer from 'nodemailer';
import type { Order, Quote } from '@shared/schema';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export async function sendEmail(options: SendEmailOptions) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'MH Trading <noreply@mhtrading-eu.com>',
      to: options.to,
      bcc: process.env.EMAIL_BCC_LOG,
      replyTo: process.env.REPLY_TO || 'support@mhtrading-eu.com',
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    });
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email send failed:', error);
    return { success: false, error: String(error) };
  }
}

export async function sendOrderConfirmation(order: Order, partnerEmail: string, invoicePDF?: Buffer) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #14b8a6; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .order-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f0f0f0; font-weight: bold; }
        .total { font-size: 18px; font-weight: bold; color: #14b8a6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmation</h1>
          <p>Thank you for your order!</p>
        </div>
        <div class="content">
          <div class="order-details">
            <h2>Order #${order.OrderID}</h2>
            <p><strong>Date:</strong> ${new Date(order.CreatedTS).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${order.Status}</p>
            <p><strong>Total:</strong> <span class="total">€${order.Total?.toFixed(2) || '0.00'}</span></p>
          </div>
          <p>Your invoice is attached to this email. If you have any questions, please contact our support team.</p>
        </div>
        <div class="footer">
          <p>MH Trading GmbH</p>
          <p>Email: ${process.env.REPLY_TO || 'support@mhtrading-eu.com'}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const attachments = invoicePDF ? [{
    filename: `invoice-${order.OrderID}.pdf`,
    content: invoicePDF,
    contentType: 'application/pdf'
  }] : undefined;

  return sendEmail({
    to: partnerEmail,
    subject: `Order Confirmation #${order.OrderID} - MH Trading`,
    html,
    attachments
  });
}

export async function sendQuoteEmail(quote: Quote, partnerEmail: string, quotePDF?: Buffer) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #14b8a6; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .quote-details { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        .total { font-size: 18px; font-weight: bold; color: #14b8a6; }
        .cta-button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Your Quote</h1>
          <p>MH Trading Quote #${quote.QuoteID}</p>
        </div>
        <div class="content">
          <div class="quote-details">
            <h2>Quote #${quote.QuoteID}</h2>
            <p><strong>Date:</strong> ${new Date(quote.CreatedTS).toLocaleDateString()}</p>
            <p><strong>Status:</strong> ${quote.Status}</p>
            <p><strong>Total:</strong> <span class="total">€${quote.Total?.toFixed(2) || '0.00'}</span></p>
          </div>
          <p>Please find your detailed quote attached to this email. This quote is valid for 30 days.</p>
          <p>If you have any questions or would like to proceed with the order, please contact us.</p>
          <div style="text-align: center;">
            <a href="${process.env.APP_BASE_URL}/sales" class="cta-button">View in System</a>
          </div>
        </div>
        <div class="footer">
          <p>MH Trading GmbH</p>
          <p>Email: ${process.env.REPLY_TO || 'support@mhtrading-eu.com'}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const attachments = quotePDF ? [{
    filename: `quote-${quote.QuoteID}.pdf`,
    content: quotePDF,
    contentType: 'application/pdf'
  }] : undefined;

  return sendEmail({
    to: partnerEmail,
    subject: `Quote #${quote.QuoteID} - MH Trading`,
    html,
    attachments
  });
}

export async function sendStandRefillNotification(standID: string, repEmail: string, suggestedItems: any[]) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #14b8a6; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 20px; }
        .items { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f0f0f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Stand Refill Required</h1>
          <p>Stand #${standID}</p>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>The following stand requires a refill visit. Here are the suggested items:</p>
          <div class="items">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Suggested Qty</th>
                </tr>
              </thead>
              <tbody>
                ${suggestedItems.map(item => `
                  <tr>
                    <td>${item.sku}</td>
                    <td>${item.quantity}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <p>Please schedule a visit to restock this stand.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to: repEmail,
    subject: `Stand Refill Required - ${standID}`,
    html
  });
}
