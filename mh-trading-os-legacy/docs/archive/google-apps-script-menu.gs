/**
 * HAIROTICMEN Trading OS - Comprehensive Menu System
 * Google Apps Script for Google Sheets Integration
 * 
 * Installation Instructions:
 * 1. Open your Google Sheet (ID: 1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0)
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code
 * 4. Paste this entire script
 * 5. Save (Ctrl+S or Cmd+S)
 * 6. Refresh your Google Sheet
 * 7. You'll see "HAIROTICMEN OS" menu in the menu bar
 * 
 * Configuration:
 * - Update API_BASE_URL with your deployed Replit app URL
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Update this with your Replit deployment URL
  API_BASE_URL: 'https://your-replit-app.replit.dev',
  
  // Sheet names (do not change unless you modify the system)
  SHEETS: {
    PRICE_LIST: 'FinalPriceList',
    PRICING_PARAMS: 'Pricing_Params',
    PARTNERS: 'Partners',
    QUOTES: 'Quotes',
    QUOTE_LINES: 'QuoteLines',
    ORDERS: 'Orders',
    ORDER_LINES: 'OrderLines',
    INVOICES: 'Invoices',
    STANDS: 'Stands',
    STAND_INVENTORY: 'Stand_Inventory',
    STAND_VISITS: 'Stand_Visits',
    LEADS: 'Leads',
    TERRITORIES: 'Territories',
    COMMISSION_LEDGER: 'Commission_Ledger',
    EMAIL_QUEUE: 'Email_Queue',
    AI_JOBS: 'AI_Jobs',
    OS_HEALTH: 'OS_Health',
    OS_LOGS: 'OS_Logs'
  },
  
  // Feature flags
  FEATURES: {
    ENABLE_AI: true,
    ENABLE_MARKETING: true,
    ENABLE_AUTO_PRICING: true,
    ENABLE_TEMPLATES: true
  }
};

// ============================================================================
// MENU CREATION
// ============================================================================

/**
 * Creates the main menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  const menu = ui.createMenu('🚀 HAIROTICMEN OS')
    
    // === PRICING TOOLS ===
    .addSubMenu(ui.createMenu('💰 Pricing Studio')
      .addItem('📊 Calculate All Prices', 'calculateAllPrices')
      .addItem('🔄 Auto-Reprice Products', 'autoRepriceProducts')
      .addItem('✅ Validate MAP Compliance', 'validateMAPCompliance')
      .addItem('📈 Price Optimization Report', 'generatePriceReport')
      .addSeparator()
      .addItem('⚙️ Edit Pricing Parameters', 'editPricingParams')
      .addItem('🎯 Bulk Price Update', 'bulkPriceUpdate')
      .addItem('🔍 Price Comparison Analysis', 'priceComparisonAnalysis')
    )
    
    // === SALES TOOLS ===
    .addSubMenu(ui.createMenu('📋 Sales Desk')
      .addItem('✨ Create New Quote', 'createNewQuote')
      .addItem('📄 Generate Quote PDF', 'generateQuotePDF')
      .addItem('✅ Convert Quote to Order', 'convertQuoteToOrder')
      .addSeparator()
      .addItem('🧾 Generate Invoice', 'generateInvoice')
      .addItem('📧 Send Invoice Email', 'sendInvoiceEmail')
      .addItem('💶 Calculate Commission', 'calculateCommission')
      .addSeparator()
      .addItem('👥 View All Partners', 'viewAllPartners')
      .addItem('📊 Sales Dashboard', 'openSalesDashboard')
    )
    
    // === STAND OPERATIONS ===
    .addSubMenu(ui.createMenu('🏪 Stand Center')
      .addItem('📦 Check Inventory Levels', 'checkStandInventory')
      .addItem('🔄 Plan Refill', 'planStandRefill')
      .addItem('📍 Record Stand Visit', 'recordStandVisit')
      .addItem('📊 Stand Performance Report', 'standPerformanceReport')
      .addSeparator()
      .addItem('⚠️ Low Stock Alert', 'checkLowStock')
      .addItem('🎯 Set Min/Max Levels', 'setInventoryLevels')
      .addItem('📈 Stand KPI Dashboard', 'standKPIDashboard')
    )
    
    // === AI ASSISTANTS ===
    .addSubMenu(ui.createMenu('🤖 AI Hub')
      .addItem('💎 Pricing Analyst (A-PRC-301)', 'aiPricingAnalyst')
      .addItem('🏪 Stand Ops Bot (A-STAND-401)', 'aiStandOpsBot')
      .addItem('✍️ Growth Writer (A-GROWTH-501)', 'aiGrowthWriter')
      .addItem('🛠️ Ops Assistant (A-OPS-601)', 'aiOpsAssistant')
      .addSeparator()
      .addItem('📊 View AI Job Queue', 'viewAIJobs')
      .addItem('✅ Review AI Drafts', 'reviewAIDrafts')
      .addItem('🔒 AI Guardrails Dashboard', 'aiGuardrailsDashboard')
    )
    
    // === MARKETING TOOLS ===
    .addSubMenu(ui.createMenu('📢 Marketing Suite')
      .addSubMenu(ui.createMenu('🔍 SEO Tools')
        .addItem('🔑 Harvest Keywords (A-SEO-103)', 'seoHarvestKeywords')
        .addItem('🗂️ Cluster Keywords', 'seoClusterKeywords')
        .addItem('📝 Generate SEO Brief', 'seoGenerateBrief')
        .addItem('🔎 Page Audit', 'seoPageAudit')
      )
      .addSubMenu(ui.createMenu('📱 Social Media')
        .addItem('📅 Plan Content Calendar (A-SOC-102)', 'socialPlanCalendar')
        .addItem('✍️ Rewrite Caption', 'socialRewriteCaption')
        .addItem('📊 View Calendar', 'socialViewCalendar')
      )
      .addSubMenu(ui.createMenu('🎯 Google Ads')
        .addItem('🔑 Expand Keywords (A-ADS-105)', 'adsExpandKeywords')
        .addItem('📝 Generate Ad Copy', 'adsGenerateCopy')
        .addItem('📊 Export Campaigns CSV', 'adsExportCSV')
      )
      .addSeparator()
      .addItem('📊 Marketing KPIs Dashboard', 'marketingKPIDashboard')
    )
    
    // === CRM & LEADS ===
    .addSubMenu(ui.createMenu('👥 CRM & Leads')
      .addItem('🗺️ Harvest Places (A-CRM-104)', 'harvestPlacesLeads')
      .addItem('✨ AI Enrich Leads', 'aiEnrichLeads')
      .addItem('🎯 Auto-Assign Territories', 'autoAssignTerritories')
      .addItem('📊 Lead Scoring', 'scoreLead')
      .addSeparator()
      .addItem('📧 Plan Email Campaign', 'planEmailCampaign')
      .addItem('✉️ Send Outreach Sequence', 'sendOutreachSequence')
      .addItem('📊 Campaign Analytics', 'campaignAnalytics')
      .addSeparator()
      .addItem('🗺️ Territory Coverage Report', 'territoryCoverageReport')
      .addItem('📊 Lead Funnel Dashboard', 'leadFunnelDashboard')
    )
    
    // === TEMPLATES ===
    .addSubMenu(ui.createMenu('📄 Templates')
      .addItem('📋 Edit Quote Template', 'editQuoteTemplate')
      .addItem('🧾 Edit Invoice Template', 'editInvoiceTemplate')
      .addItem('📧 Edit Email Templates', 'editEmailTemplates')
      .addSeparator()
      .addItem('🎨 Customize PDF Layout', 'customizePDFLayout')
      .addItem('🌐 Multi-Language Settings', 'multiLanguageSettings')
    )
    
    // === QUICK ACTIONS ===
    .addSubMenu(ui.createMenu('⚡ Quick Actions')
      .addItem('🔄 Refresh All Data', 'refreshAllData')
      .addItem('📊 Open Dashboard', 'openMainDashboard')
      .addItem('🔍 Search Products', 'searchProducts')
      .addItem('👤 Search Partners', 'searchPartners')
      .addSeparator()
      .addItem('📤 Export Data (CSV)', 'exportDataCSV')
      .addItem('📥 Import Data', 'importData')
      .addItem('🔄 Sync with WooCommerce', 'syncWooCommerce')
    )
    
    // === ADMIN & SETTINGS ===
    .addSubMenu(ui.createMenu('⚙️ Admin & Settings')
      .addItem('🏥 System Health Check', 'systemHealthCheck')
      .addItem('📊 View OS Logs', 'viewOSLogs')
      .addItem('🔧 Configuration Settings', 'configurationSettings')
      .addSeparator()
      .addItem('📚 User Guide', 'showUserGuide')
      .addItem('🆘 Support & Help', 'showSupport')
      .addItem('ℹ️ About HAIROTICMEN OS', 'showAbout')
    )
    
    .addSeparator()
    .addItem('🔄 Reload Menu', 'onOpen')
    
    .addToUi();
  
  // Show welcome message on first load
  showWelcomeMessage();
}

// ============================================================================
// PRICING TOOLS
// ============================================================================

function calculateAllPrices() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Calculate All Prices',
    'This will recalculate prices for all active products based on current Factory Prices and pricing parameters.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    showProgress('Calculating prices for all products...');
    
    try {
      const result = callAPI('/api/pricing/calculate-all', 'POST', {});
      
      if (result.success) {
        ui.alert(
          '✅ Success',
          `Calculated prices for ${result.productsUpdated} products.\n\n` +
          `UVP Range: €${result.uvpMin} - €${result.uvpMax}\n` +
          `Average Margin: ${result.avgMargin}%`,
          ui.ButtonSet.OK
        );
        
        // Refresh the active sheet
        SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PRICE_LIST).getDataRange().activate();
      } else {
        ui.alert('❌ Error', result.error || 'Failed to calculate prices', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to connect to API: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function autoRepriceProducts() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Auto-Reprice Products',
    'This will automatically adjust prices for products with AutoPriceFlag enabled based on market data and pricing strategy.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    showProgress('Running auto-reprice algorithm...');
    
    try {
      const result = callAPI('/api/pricing/auto-reprice', 'POST', {});
      
      if (result.success) {
        ui.alert(
          '✅ Success',
          `Repriced ${result.productsRepriced} products.\n\n` +
          `Average price change: ${result.avgPriceChange}%\n` +
          `Total revenue impact: €${result.revenueImpact}`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to reprice products', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to connect to API: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function validateMAPCompliance() {
  showProgress('Validating MAP compliance...');
  
  try {
    const result = callAPI('/api/pricing/validate-map', 'GET', null);
    
    const ui = SpreadsheetApp.getUi();
    
    if (result.violations && result.violations.length > 0) {
      let message = `Found ${result.violations.length} MAP violations:\n\n`;
      result.violations.slice(0, 5).forEach(v => {
        message += `• ${v.sku}: ${v.productName}\n  Current: €${v.currentPrice} | MAP: €${v.map}\n\n`;
      });
      
      if (result.violations.length > 5) {
        message += `... and ${result.violations.length - 5} more violations.`;
      }
      
      ui.alert('⚠️ MAP Violations Found', message, ui.ButtonSet.OK);
    } else {
      ui.alert('✅ All Clear', 'No MAP compliance violations found. All prices are within allowed ranges.', ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', 'Failed to validate MAP: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function generatePriceReport() {
  showProgress('Generating pricing optimization report...');
  
  try {
    const result = callAPI('/api/pricing/optimization-report', 'GET', null);
    
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '📈 Pricing Optimization Report',
      `Total Products: ${result.totalProducts}\n` +
      `Optimal Price: ${result.optimalCount} (${result.optimalPct}%)\n` +
      `Too High: ${result.tooHighCount} (${result.tooHighPct}%)\n` +
      `Too Low: ${result.tooLowCount} (${result.tooLowPct}%)\n\n` +
      `Average Margin: ${result.avgMargin}%\n` +
      `Revenue Potential: €${result.revenuePotential}`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', 'Failed to generate report: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function editPricingParams() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PRICING_PARAMS);
  if (sheet) {
    sheet.activate();
    SpreadsheetApp.getUi().alert(
      'Pricing Parameters',
      'You can now edit pricing parameters in this sheet.\n\n' +
      'Key parameters:\n' +
      '• VAT_Pct: Default 19%\n' +
      '• Target_Margin_Pct: Default 45%\n' +
      '• Floor_Margin_Pct: Default 25%\n' +
      '• MAP_Floor_Multiplier: Default 0.9 (90% of UVP)\n\n' +
      'After editing, run "Calculate All Prices" to apply changes.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert('❌ Error', 'Pricing_Params sheet not found', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function bulkPriceUpdate() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Bulk Price Update',
    'Enter adjustment percentage (e.g., 5 for +5%, -10 for -10%):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const adjustment = parseFloat(response.getResponseText());
    
    if (isNaN(adjustment)) {
      ui.alert('❌ Error', 'Invalid percentage value', ui.ButtonSet.OK);
      return;
    }
    
    const confirm = ui.alert(
      'Confirm Bulk Update',
      `This will adjust all product prices by ${adjustment > 0 ? '+' : ''}${adjustment}%.\n\nContinue?`,
      ui.ButtonSet.YES_NO
    );
    
    if (confirm === ui.Button.YES) {
      showProgress('Applying bulk price update...');
      
      try {
        const result = callAPI('/api/pricing/bulk-update', 'POST', {
          adjustmentPct: adjustment
        });
        
        ui.alert(
          '✅ Success',
          `Updated ${result.productsUpdated} products by ${adjustment}%`,
          ui.ButtonSet.OK
        );
      } catch (error) {
        ui.alert('❌ Error', 'Failed to update prices: ' + error.toString(), ui.ButtonSet.OK);
      }
    }
  }
}

function priceComparisonAnalysis() {
  showProgress('Running price comparison analysis...');
  
  try {
    const result = callAPI('/api/pricing/comparison', 'GET', null);
    
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '📊 Price Comparison Analysis',
      `B2C vs B2B Analysis:\n` +
      `Average B2C (UVP): €${result.avgUVP}\n` +
      `Average B2B (Stand): €${result.avgB2B}\n` +
      `Average Discount: ${result.avgDiscount}%\n\n` +
      `Channel Profitability:\n` +
      `B2C Margin: ${result.b2cMargin}%\n` +
      `B2B Margin: ${result.b2bMargin}%\n` +
      `Amazon Margin: ${result.amazonMargin}%`,
      ui.ButtonSet.OK
    );
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', 'Failed to analyze prices: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ============================================================================
// SALES TOOLS
// ============================================================================

function createNewQuote() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Create New Quote',
    'Enter Partner ID or Partner Name:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const partnerInput = response.getResponseText();
    
    showProgress('Creating new quote...');
    
    try {
      const result = callAPI('/api/sales/quotes', 'POST', {
        partnerId: partnerInput,
        notes: 'Created via Google Sheets menu'
      });
      
      if (result.quoteId) {
        ui.alert(
          '✅ Quote Created',
          `Quote ID: ${result.quoteId}\n` +
          `Partner: ${result.partnerName}\n` +
          `Status: ${result.status}\n\n` +
          `Add products in the Quotes sheet or use the Sales Desk in the web app.`,
          ui.ButtonSet.OK
        );
        
        // Navigate to Quotes sheet
        SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.QUOTES).activate();
      } else {
        ui.alert('❌ Error', result.error || 'Failed to create quote', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to create quote: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function generateQuotePDF() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Generate Quote PDF',
    'Enter Quote ID:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const quoteId = response.getResponseText();
    
    showProgress('Generating PDF...');
    
    try {
      const result = callAPI(`/api/sales/quotes/${quoteId}/pdf`, 'POST', {});
      
      if (result.pdfUrl) {
        ui.alert(
          '✅ PDF Generated',
          `Quote PDF has been generated.\n\n` +
          `Download URL:\n${result.pdfUrl}\n\n` +
          `The PDF will also be emailed to the partner if configured.`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to generate PDF', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to generate PDF: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function convertQuoteToOrder() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Convert Quote to Order',
    'Enter Quote ID to convert:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const quoteId = response.getResponseText();
    
    const confirm = ui.alert(
      'Confirm Conversion',
      `Convert Quote ${quoteId} to Order?\n\n` +
      `This will:\n` +
      `• Create a new order\n` +
      `• Mark quote as Converted\n` +
      `• Trigger commission calculation\n` +
      `• Update inventory reservations`,
      ui.ButtonSet.YES_NO
    );
    
    if (confirm === ui.Button.YES) {
      showProgress('Converting quote to order...');
      
      try {
        const result = callAPI(`/api/sales/quotes/${quoteId}/convert`, 'POST', {});
        
        if (result.orderId) {
          ui.alert(
            '✅ Conversion Successful',
            `Quote ${quoteId} → Order ${result.orderId}\n\n` +
            `Total: €${result.totalAmount}\n` +
            `Commission: €${result.commissionAmount}\n` +
            `Status: ${result.status}`,
            ui.ButtonSet.OK
          );
          
          // Navigate to Orders sheet
          SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.ORDERS).activate();
        } else {
          ui.alert('❌ Error', result.error || 'Failed to convert quote', ui.ButtonSet.OK);
        }
      } catch (error) {
        ui.alert('❌ Error', 'Failed to convert: ' + error.toString(), ui.ButtonSet.OK);
      }
    }
  }
}

function generateInvoice() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Generate Invoice',
    'Enter Order ID:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const orderId = response.getResponseText();
    
    showProgress('Generating invoice...');
    
    try {
      const result = callAPI(`/api/sales/orders/${orderId}/invoice`, 'POST', {});
      
      if (result.invoiceId) {
        ui.alert(
          '✅ Invoice Generated',
          `Invoice ID: ${result.invoiceId}\n` +
          `Invoice Number: ${result.invoiceNumber}\n` +
          `Total: €${result.totalAmount}\n` +
          `Status: ${result.status}\n\n` +
          `PDF URL: ${result.pdfUrl || 'Generating...'}`,
          ui.ButtonSet.OK
        );
        
        // Navigate to Invoices sheet
        SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.INVOICES).activate();
      } else {
        ui.alert('❌ Error', result.error || 'Failed to generate invoice', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to generate invoice: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function sendInvoiceEmail() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Send Invoice Email',
    'Enter Invoice ID:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const invoiceId = response.getResponseText();
    
    showProgress('Sending invoice email...');
    
    try {
      const result = callAPI(`/api/sales/invoices/${invoiceId}/send`, 'POST', {});
      
      if (result.sent) {
        ui.alert(
          '✅ Email Sent',
          `Invoice sent to: ${result.recipientEmail}\n` +
          `Subject: ${result.subject}\n` +
          `Sent at: ${new Date(result.sentAt).toLocaleString()}`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to send email', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to send email: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function calculateCommission() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Calculate Commission',
    'Enter Order ID or Quote ID:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const entityId = response.getResponseText();
    
    showProgress('Calculating commission...');
    
    try {
      const result = callAPI('/api/sales/commissions/calculate', 'POST', {
        entityId: entityId
      });
      
      if (result.commissionAmount !== undefined) {
        ui.alert(
          '💶 Commission Calculated',
          `Rep: ${result.repName}\n` +
          `Net Amount: €${result.netAmount}\n` +
          `Commission Rate: ${result.commissionPct}%\n` +
          `Multiplier: ${result.multiplier}x\n` +
          `Commission: €${result.commissionAmount}\n\n` +
          `Monthly Target Met: ${result.monthlyTargetMet ? 'Yes' : 'No'}\n` +
          `Payment Stage: ${result.paymentStage}`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to calculate commission', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to calculate: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function viewAllPartners() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PARTNERS);
  if (sheet) {
    sheet.activate();
    SpreadsheetApp.getUi().alert(
      'Partners',
      'Viewing all partners. You can:\n\n' +
      '• View partner details\n' +
      '• Edit partner tiers\n' +
      '• Update contact information\n' +
      '• Add new partners',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert('❌ Error', 'Partners sheet not found', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function openSalesDashboard() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📊 Sales Dashboard',
    'Opening Sales Dashboard in web app...\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/sales\n\n` +
    'Please visit the URL above for the full sales dashboard with real-time analytics.',
    ui.ButtonSet.OK
  );
}

// ============================================================================
// STAND OPERATIONS
// ============================================================================

function checkStandInventory() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Check Stand Inventory',
    'Enter Stand ID (or leave blank for all stands):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const standId = response.getResponseText();
    
    showProgress('Checking inventory...');
    
    try {
      const endpoint = standId ? `/api/stands/${standId}/inventory` : '/api/stands/inventory/all';
      const result = callAPI(endpoint, 'GET', null);
      
      if (result.inventory) {
        let message = `Stand Inventory Report\n\n`;
        message += `Total Items: ${result.totalItems}\n`;
        message += `Low Stock Items: ${result.lowStockCount}\n`;
        message += `Out of Stock: ${result.outOfStockCount}\n\n`;
        
        if (result.lowStockItems && result.lowStockItems.length > 0) {
          message += 'Low Stock Products:\n';
          result.lowStockItems.slice(0, 5).forEach(item => {
            message += `• ${item.productName}: ${item.currentQty}/${item.maxQty}\n`;
          });
        }
        
        ui.alert('📦 Inventory Status', message, ui.ButtonSet.OK);
      } else {
        ui.alert('❌ Error', result.error || 'Failed to check inventory', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to check inventory: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function planStandRefill() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Plan Stand Refill',
    'Enter Stand ID:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const standId = response.getResponseText();
    
    showProgress('Planning refill...');
    
    try {
      const result = callAPI(`/api/stands/${standId}/plan-refill`, 'POST', {});
      
      if (result.refillPlan) {
        let message = `Refill Plan for Stand ${standId}\n\n`;
        message += `Total Items: ${result.itemsToRefill}\n`;
        message += `Estimated Cost: €${result.estimatedCost}\n`;
        message += `Priority: ${result.priority}\n\n`;
        
        message += 'Top Items to Refill:\n';
        result.refillPlan.slice(0, 5).forEach(item => {
          message += `• ${item.productName}: +${item.qtyNeeded} units\n`;
        });
        
        const confirm = ui.alert(
          '📦 Refill Plan',
          message + '\n\nCreate refill order?',
          ui.ButtonSet.YES_NO
        );
        
        if (confirm === ui.Button.YES) {
          // Trigger refill order creation
          const orderResult = callAPI(`/api/stands/${standId}/create-refill-order`, 'POST', {
            refillPlan: result.refillPlan
          });
          
          ui.alert('✅ Success', `Refill order created: ${orderResult.orderId}`, ui.ButtonSet.OK);
        }
      } else {
        ui.alert('❌ Error', result.error || 'Failed to plan refill', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to plan refill: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function recordStandVisit() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Record Stand Visit',
    'Enter Stand ID:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const standId = response.getResponseText();
    
    const notesResponse = ui.prompt(
      'Visit Notes',
      'Enter visit notes (optional):',
      ui.ButtonSet.OK_CANCEL
    );
    
    if (notesResponse.getSelectedButton() === ui.Button.OK) {
      showProgress('Recording visit...');
      
      try {
        const result = callAPI('/api/stands/visits', 'POST', {
          standId: standId,
          notes: notesResponse.getResponseText(),
          timestamp: new Date().toISOString()
        });
        
        if (result.visitId) {
          ui.alert(
            '✅ Visit Recorded',
            `Visit ID: ${result.visitId}\n` +
            `Stand: ${result.standName}\n` +
            `Time: ${new Date(result.timestamp).toLocaleString()}\n` +
            `Rep: ${result.repName}`,
            ui.ButtonSet.OK
          );
          
          // Navigate to Stand_Visits sheet
          SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.STAND_VISITS).activate();
        } else {
          ui.alert('❌ Error', result.error || 'Failed to record visit', ui.ButtonSet.OK);
        }
      } catch (error) {
        ui.alert('❌ Error', 'Failed to record visit: ' + error.toString(), ui.ButtonSet.OK);
      }
    }
  }
}

function standPerformanceReport() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Stand Performance Report',
    'Enter Stand ID (or leave blank for all stands):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const standId = response.getResponseText();
    
    showProgress('Generating performance report...');
    
    try {
      const endpoint = standId ? `/api/stands/${standId}/performance` : '/api/stands/performance/all';
      const result = callAPI(endpoint, 'GET', null);
      
      if (result.performance) {
        let message = `Stand Performance Report\n\n`;
        message += `Revenue (MTD): €${result.revenueMTD}\n`;
        message += `Orders (MTD): ${result.ordersMTD}\n`;
        message += `Avg Order Value: €${result.avgOrderValue}\n`;
        message += `Visit Frequency: ${result.visitFrequency}\n`;
        message += `Stock Turnover: ${result.stockTurnover}x\n\n`;
        message += `Top Products:\n`;
        
        result.topProducts.slice(0, 5).forEach(p => {
          message += `• ${p.name}: ${p.unitsSold} units\n`;
        });
        
        ui.alert('📊 Performance Report', message, ui.ButtonSet.OK);
      } else {
        ui.alert('❌ Error', result.error || 'Failed to generate report', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to generate report: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function checkLowStock() {
  showProgress('Checking low stock items...');
  
  try {
    const result = callAPI('/api/stands/inventory/low-stock', 'GET', null);
    
    const ui = SpreadsheetApp.getUi();
    
    if (result.lowStockItems && result.lowStockItems.length > 0) {
      let message = `⚠️ Low Stock Alert\n\n`;
      message += `Total Low Stock Items: ${result.lowStockItems.length}\n\n`;
      
      result.lowStockItems.slice(0, 10).forEach(item => {
        message += `• Stand: ${item.standName}\n`;
        message += `  Product: ${item.productName}\n`;
        message += `  Current: ${item.currentQty} / Min: ${item.minQty}\n\n`;
      });
      
      if (result.lowStockItems.length > 10) {
        message += `... and ${result.lowStockItems.length - 10} more items`;
      }
      
      ui.alert('⚠️ Low Stock Alert', message, ui.ButtonSet.OK);
    } else {
      ui.alert('✅ All Good', 'No low stock items found. All stands are well-stocked!', ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', 'Failed to check stock: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function setInventoryLevels() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.STAND_INVENTORY);
  if (sheet) {
    sheet.activate();
    SpreadsheetApp.getUi().alert(
      'Set Inventory Levels',
      'You can now edit Min/Max inventory levels in this sheet.\n\n' +
      'Columns:\n' +
      '• MinQty: Minimum quantity before reorder alert\n' +
      '• MaxQty: Maximum capacity for this stand\n\n' +
      'The system will alert you when stock falls below MinQty.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert('❌ Error', 'Stand_Inventory sheet not found', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function standKPIDashboard() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📊 Stand KPI Dashboard',
    'Opening Stand KPI Dashboard in web app...\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/stands\n\n` +
    'Please visit the URL above for the full dashboard with real-time stand analytics.',
    ui.ButtonSet.OK
  );
}

// ============================================================================
// AI ASSISTANTS
// ============================================================================

function aiPricingAnalyst() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '💎 Pricing Analyst (A-PRC-301)',
    'AI Pricing Analyst helps you:\n\n' +
    '✓ Analyze current pricing strategy\n' +
    '✓ Suggest optimal price adjustments\n' +
    '✓ Validate MAP compliance\n' +
    '✓ Identify pricing opportunities\n\n' +
    'This will create an AI job that runs asynchronously.\n' +
    'Check AI Job Queue for results.',
    ui.ButtonSet.OK
  );
  
  showProgress('Queueing pricing analysis...');
  
  try {
    const result = callAPI('/api/ai/pricing-analyst/analyze', 'POST', {
      task: 'suggest-pricing',
      targetMargin: 45
    });
    
    if (result.jobId) {
      ui.alert(
        '✅ Job Queued',
        `AI Job ID: ${result.jobId}\n` +
        `Agent: Pricing Analyst\n` +
        `Status: ${result.status}\n\n` +
        `Check "AI Hub > View AI Job Queue" for progress.`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert('❌ Error', result.error || 'Failed to queue job', ui.ButtonSet.OK);
    }
  } catch (error) {
    ui.alert('❌ Error', 'Failed to queue job: ' + error.toString(), ui.ButtonSet.OK);
  }
}

function aiStandOpsBot() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🏪 Stand Ops Bot (A-STAND-401)',
    'What would you like to analyze?\n' +
    '1. Refill Planning\n' +
    '2. Stockout Prediction\n' +
    '3. Performance Analysis\n\n' +
    'Enter Stand ID (or leave blank for all):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const standId = response.getResponseText();
    
    showProgress('Queueing stand ops analysis...');
    
    try {
      const result = callAPI('/api/ai/stand-ops/analyze', 'POST', {
        task: 'plan-refill',
        standId: standId || null
      });
      
      if (result.jobId) {
        ui.alert(
          '✅ Job Queued',
          `AI Job ID: ${result.jobId}\n` +
          `Agent: Stand Ops Bot\n` +
          `Status: ${result.status}\n\n` +
          `Check "AI Hub > View AI Job Queue" for results.`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to queue job', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to queue job: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function aiGrowthWriter() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '✍️ Growth Writer (A-GROWTH-501)',
    'AI Growth Writer helps you:\n\n' +
    '✓ Generate email templates\n' +
    '✓ Draft marketing campaigns\n' +
    '✓ Create social media content\n' +
    '✓ Write product descriptions\n\n' +
    'All content is GDPR-compliant and requires approval before use.',
    ui.ButtonSet.OK
  );
  
  const taskResponse = ui.prompt(
    'Select Task',
    'What would you like to create?\n' +
    '1. Email Template\n' +
    '2. Campaign Draft\n' +
    '3. Social Content\n\n' +
    'Enter number (1-3):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (taskResponse.getSelectedButton() === ui.Button.OK) {
    const task = parseInt(taskResponse.getResponseText());
    let taskName = '';
    
    switch(task) {
      case 1: taskName = 'suggest-template'; break;
      case 2: taskName = 'draft-campaign'; break;
      case 3: taskName = 'create-content'; break;
      default:
        ui.alert('❌ Error', 'Invalid task number', ui.ButtonSet.OK);
        return;
    }
    
    showProgress('Queueing content generation...');
    
    try {
      const result = callAPI('/api/ai/growth-writer/create', 'POST', {
        task: taskName,
        locale: 'en'
      });
      
      if (result.jobId) {
        ui.alert(
          '✅ Job Queued',
          `AI Job ID: ${result.jobId}\n` +
          `Agent: Growth Writer\n` +
          `Task: ${taskName}\n\n` +
          `Draft content will require approval in AI Guardrails.`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to queue job', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to queue job: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function aiOpsAssistant() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🛠️ Ops Assistant (A-OPS-601)',
    'What can I help you with?\n\n' +
    'Examples:\n' +
    '• Draft email to partner\n' +
    '• Create sales report\n' +
    '• Analyze order data\n\n' +
    'Enter your request:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const request = response.getResponseText();
    
    showProgress('Processing request...');
    
    try {
      const result = callAPI('/api/ai/ops-assistant', 'POST', {
        request: request
      });
      
      if (result.response) {
        ui.alert(
          '🛠️ Ops Assistant Response',
          result.response,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to process request', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to process: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function viewAIJobs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.AI_JOBS);
  if (sheet) {
    sheet.activate();
    SpreadsheetApp.getUi().alert(
      'AI Job Queue',
      'Viewing all AI jobs. Status values:\n\n' +
      '• Queued: Waiting to run\n' +
      '• Running: In progress\n' +
      '• Completed: Finished successfully\n' +
      '• Failed: Error occurred\n\n' +
      'Jobs marked "RequiresApproval" need review in AI Guardrails.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert('❌ Error', 'AI_Jobs sheet not found', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function reviewAIDrafts() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '✅ Review AI Drafts',
    'Opening AI Guardrails Dashboard in web app...\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/ai-guardrails\n\n` +
    'Review and approve/reject AI-generated content before it goes live.',
    ui.ButtonSet.OK
  );
}

function aiGuardrailsDashboard() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '🔒 AI Guardrails',
    'AI Guardrails protect your business by:\n\n' +
    '✓ MAP Compliance Checks\n' +
    '✓ GDPR Validation\n' +
    '✓ Brand Voice Consistency\n' +
    '✓ Budget Cap Enforcement\n\n' +
    'All AI-generated content requires human approval before production use.',
    ui.ButtonSet.OK
  );
  
  try {
    const result = callAPI('/api/ai/guardrails/stats', 'GET', null);
    
    if (result.stats) {
      ui.alert(
        '📊 Guardrails Stats',
        `Pending Approvals: ${result.stats.pending}\n` +
        `Approved Today: ${result.stats.approvedToday}\n` +
        `Rejected Today: ${result.stats.rejectedToday}\n` +
        `Success Rate: ${result.stats.successRate}%\n\n` +
        `Common Violations:\n` +
        `• MAP: ${result.stats.mapViolations}\n` +
        `• GDPR: ${result.stats.gdprViolations}`,
        ui.ButtonSet.OK
      );
    }
  } catch (error) {
    ui.alert('❌ Error', 'Failed to load stats: ' + error.toString(), ui.ButtonSet.OK);
  }
}

// ============================================================================
// MARKETING TOOLS (SEO, Social, Ads)
// ============================================================================

function seoHarvestKeywords() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🔑 SEO Keyword Harvester',
    'Enter product category (or leave blank for all):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const category = response.getResponseText();
    
    showProgress('Harvesting keywords...');
    
    try {
      const result = callAPI('/api/marketing/seo/harvest', 'POST', {
        category: category || null,
        locale: 'de'
      });
      
      if (result.jobId) {
        ui.alert(
          '✅ Keyword Harvest Queued',
          `AI Job ID: ${result.jobId}\n` +
          `Keywords to generate: ${result.estimatedCount}\n\n` +
          `Results will be added to SEO_Keywords sheet after AI processing.`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to harvest keywords', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to harvest: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function seoClusterKeywords() {
  showProgress('Clustering keywords...');
  
  try {
    const result = callAPI('/api/marketing/seo/cluster', 'POST', {
      locale: 'de'
    });
    
    const ui = SpreadsheetApp.getUi();
    
    if (result.clusters) {
      ui.alert(
        '🗂️ Keyword Clusters',
        `Created ${result.clusters.length} clusters:\n\n` +
        result.clusters.slice(0, 5).map(c => 
          `• ${c.name} (${c.keywords.length} keywords)`
        ).join('\n') +
        `\n\n${result.clusters.length > 5 ? `...and ${result.clusters.length - 5} more` : ''}`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert('❌ Error', result.error || 'Failed to cluster keywords', ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', 'Failed to cluster: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function seoGenerateBrief() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '📝 Generate SEO Brief',
    'Enter target keywords (one per line):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const keywords = response.getResponseText().split('\n').filter(k => k.trim());
    
    showProgress('Generating SEO brief...');
    
    try {
      const result = callAPI('/api/ai/seo/brief', 'POST', {
        keywords: keywords,
        language: 'DE'
      });
      
      if (result.jobId) {
        ui.alert(
          '✅ SEO Brief Generated',
          `AI Job ID: ${result.jobId}\n` +
          `Keywords: ${keywords.length}\n\n` +
          `Brief will be ready in AI Job Queue.`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to generate brief', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to generate: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function seoPageAudit() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🔎 SEO Page Audit',
    'Enter page URL to audit:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const url = response.getResponseText();
    
    showProgress('Auditing page...');
    
    try {
      const result = callAPI('/api/ai/seo/audit', 'POST', {
        pageURL: url
      });
      
      if (result.audit) {
        ui.alert(
          '🔎 SEO Audit Results',
          `Page: ${url}\n\n` +
          `Score: ${result.audit.score}/100\n` +
          `Title: ${result.audit.title ? '✓' : '✗'}\n` +
          `Meta: ${result.audit.meta ? '✓' : '✗'}\n` +
          `H1: ${result.audit.h1 ? '✓' : '✗'}\n` +
          `Alt Tags: ${result.audit.altTags}%\n\n` +
          `Top Issues:\n` +
          result.audit.issues.slice(0, 3).map(i => `• ${i}`).join('\n'),
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to audit page', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to audit: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function socialPlanCalendar() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '📅 Plan Social Calendar',
    'How many days to plan? (1-30):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const days = parseInt(response.getResponseText());
    
    if (isNaN(days) || days < 1 || days > 30) {
      ui.alert('❌ Error', 'Invalid number of days (1-30)', ui.ButtonSet.OK);
      return;
    }
    
    showProgress('Planning content calendar...');
    
    try {
      const result = callAPI('/api/ai/social/generate-plan', 'POST', {
        days: days,
        platforms: ['Instagram', 'Facebook'],
        locale: 'de'
      });
      
      if (result.jobId) {
        ui.alert(
          '✅ Calendar Planned',
          `AI Job ID: ${result.jobId}\n` +
          `Posts planned: ${result.postsCount}\n` +
          `Days: ${days}\n\n` +
          `Review content in AI Guardrails before publishing.`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to plan calendar', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to plan: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function socialRewriteCaption() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '✍️ Rewrite Caption',
    'Enter original caption:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const caption = response.getResponseText();
    
    const toneResponse = ui.prompt(
      'Select Tone',
      'Enter tone (professional/friendly/playful):',
      ui.ButtonSet.OK_CANCEL
    );
    
    if (toneResponse.getSelectedButton() === ui.Button.OK) {
      showProgress('Rewriting caption...');
      
      try {
        const result = callAPI('/api/ai/social/rewrite-caption', 'POST', {
          caption: caption,
          tone: toneResponse.getResponseText(),
          locale: 'de'
        });
        
        if (result.rewritten) {
          ui.alert(
            '✍️ Rewritten Caption',
            `Original:\n${caption}\n\n` +
            `Rewritten:\n${result.rewritten}\n\n` +
            `Hashtags: ${result.hashtags}`,
            ui.ButtonSet.OK
          );
        } else {
          ui.alert('❌ Error', result.error || 'Failed to rewrite', ui.ButtonSet.OK);
        }
      } catch (error) {
        ui.alert('❌ Error', 'Failed to rewrite: ' + error.toString(), ui.ButtonSet.OK);
      }
    }
  }
}

function socialViewCalendar() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📅 Social Calendar',
    'Opening Social Calendar in web app...\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/marketing/social\n\n` +
    'View and manage your content calendar with scheduling, analytics, and more.',
    ui.ButtonSet.OK
  );
}

function adsExpandKeywords() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🔑 Expand Keywords',
    'Enter seed keywords (one per line):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const seeds = response.getResponseText().split('\n').filter(k => k.trim());
    
    showProgress('Expanding keywords...');
    
    try {
      const result = callAPI('/api/ai/ads/expand-keywords', 'POST', {
        seedKeywords: seeds,
        language: 'DE',
        matchType: 'Phrase'
      });
      
      if (result.keywords) {
        ui.alert(
          '✅ Keywords Expanded',
          `Seed Keywords: ${seeds.length}\n` +
          `Generated: ${result.keywords.length}\n\n` +
          `Top Keywords:\n` +
          result.keywords.slice(0, 5).map(k => `• ${k.keyword}`).join('\n') +
          `\n\n${result.keywords.length > 5 ? `...and ${result.keywords.length - 5} more` : ''}`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to expand keywords', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to expand: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function adsGenerateCopy() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '📝 Generate Ad Copy',
    'Enter product name or keyword:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const keyword = response.getResponseText();
    
    showProgress('Generating ad copy...');
    
    try {
      const result = callAPI('/api/ai/ads/generate-copy', 'POST', {
        keyword: keyword,
        language: 'DE'
      });
      
      if (result.adCopy) {
        ui.alert(
          '📝 Ad Copy Generated',
          `Headline 1: ${result.adCopy.headline1}\n` +
          `Headline 2: ${result.adCopy.headline2}\n` +
          `Headline 3: ${result.adCopy.headline3}\n\n` +
          `Description:\n${result.adCopy.description}`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to generate copy', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to generate: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function adsExportCSV() {
  showProgress('Exporting ads to CSV...');
  
  try {
    const result = callAPI('/api/marketing/ads/export', 'GET', null);
    
    const ui = SpreadsheetApp.getUi();
    
    if (result.csvUrl) {
      ui.alert(
        '✅ Export Ready',
        `CSV file generated:\n${result.csvUrl}\n\n` +
        `Campaigns: ${result.campaignCount}\n` +
        `Ad Groups: ${result.adGroupCount}\n` +
        `Ads: ${result.adCount}\n\n` +
        `Import this CSV directly into Google Ads.`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert('❌ Error', result.error || 'Failed to export', ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', 'Failed to export: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function marketingKPIDashboard() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📊 Marketing KPIs',
    'Opening Marketing Dashboard in web app...\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/marketing/kpis\n\n` +
    'View SEO rankings, ad performance, social engagement, and more.',
    ui.ButtonSet.OK
  );
}

// ============================================================================
// CRM & LEADS
// ============================================================================

function harvestPlacesLeads() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🗺️ Harvest Places',
    'Enter city to search (or leave blank for multiple cities):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const city = response.getResponseText();
    
    showProgress('Harvesting leads from Google Places...');
    
    try {
      const result = callAPI('/api/growth/places/search', 'POST', {
        city: city || null,
        maxLeads: 50
      });
      
      if (result.leadsHarvested) {
        ui.alert(
          '✅ Leads Harvested',
          `New Leads: ${result.leadsHarvested}\n` +
          `Duplicates Skipped: ${result.duplicatesSkipped}\n` +
          `Quality Score: ${result.avgQualityScore}/100\n\n` +
          `Leads added to CRM_Leads sheet.`,
          ui.ButtonSet.OK
        );
        
        // Navigate to Leads sheet
        SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.LEADS).activate();
      } else {
        ui.alert('❌ Error', result.error || 'Failed to harvest leads', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to harvest: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function aiEnrichLeads() {
  showProgress('Enriching leads with AI...');
  
  try {
    const result = callAPI('/api/growth/enrich/queue', 'POST', {});
    
    const ui = SpreadsheetApp.getUi();
    
    if (result.jobsQueued) {
      ui.alert(
        '✅ Enrichment Queued',
        `AI Jobs Queued: ${result.jobsQueued}\n` +
        `Leads to enrich: ${result.leadsCount}\n\n` +
        `AI will:\n` +
        '• Score lead quality\n' +
        '• Assign territories\n' +
        '• Suggest outreach strategy\n\n' +
        'Check AI Job Queue for progress.',
        ui.ButtonSet.OK
      );
    } else {
      ui.alert('❌ Error', result.error || 'No leads to enrich', ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', 'Failed to enrich: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function autoAssignTerritories() {
  showProgress('Auto-assigning territories...');
  
  try {
    const result = callAPI('/api/territories/assign/bulk', 'POST', {});
    
    const ui = SpreadsheetApp.getUi();
    
    if (result.assigned) {
      ui.alert(
        '✅ Territories Assigned',
        `Leads assigned: ${result.assigned}\n` +
        `Unassigned: ${result.unassigned}\n\n` +
        `Assignment Method:\n` +
        `• Rules: ${result.byRules}\n` +
        `• Geography: ${result.byGeography}\n` +
        `• Round-Robin: ${result.byRoundRobin}`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert('❌ Error', result.error || 'Failed to assign territories', ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', 'Failed to assign: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function scoreLead() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🎯 Score Lead',
    'Enter Lead ID to score:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const leadId = response.getResponseText();
    
    showProgress('Scoring lead...');
    
    try {
      const result = callAPI('/api/growth/score', 'POST', {
        leadId: leadId
      });
      
      if (result.score !== undefined) {
        ui.alert(
          '🎯 Lead Score',
          `Lead: ${result.businessName}\n` +
          `Score: ${result.score}/100\n\n` +
          `Breakdown:\n` +
          `• Business Type: ${result.breakdown.businessType}\n` +
          `• Location: ${result.breakdown.location}\n` +
          `• Engagement: ${result.breakdown.engagement}\n` +
          `• Data Quality: ${result.breakdown.dataQuality}\n\n` +
          `Priority: ${result.priority}`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to score lead', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to score: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function planEmailCampaign() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📧 Email Campaign Planner',
    'Opening Campaign Planner in web app...\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/outreach\n\n` +
    'Plan multi-step email sequences with templates, scheduling, and analytics.',
    ui.ButtonSet.OK
  );
}

function sendOutreachSequence() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '✉️ Send Outreach',
    'Enter campaign ID to send:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const campaignId = response.getResponseText();
    
    const confirm = ui.alert(
      'Confirm Send',
      `Send campaign ${campaignId}?\n\n` +
      'This will queue emails for delivery based on your campaign settings.\n\n' +
      'Continue?',
      ui.ButtonSet.YES_NO
    );
    
    if (confirm === ui.Button.YES) {
      showProgress('Queueing emails...');
      
      try {
        const result = callAPI(`/api/outreach/campaigns/${campaignId}/send`, 'POST', {});
        
        if (result.queued) {
          ui.alert(
            '✅ Campaign Queued',
            `Emails queued: ${result.queued}\n` +
            `Recipients: ${result.recipients}\n` +
            `Estimated send time: ${result.estimatedTime}\n\n` +
            'Check Email_Queue sheet for delivery status.',
            ui.ButtonSet.OK
          );
        } else {
          ui.alert('❌ Error', result.error || 'Failed to queue campaign', ui.ButtonSet.OK);
        }
      } catch (error) {
        ui.alert('❌ Error', 'Failed to send: ' + error.toString(), ui.ButtonSet.OK);
      }
    }
  }
}

function campaignAnalytics() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📊 Campaign Analytics',
    'Opening Campaign Analytics in web app...\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/outreach/analytics\n\n` +
    'View open rates, click rates, replies, and conversions for all campaigns.',
    ui.ButtonSet.OK
  );
}

function territoryCoverageReport() {
  showProgress('Generating territory coverage report...');
  
  try {
    const result = callAPI('/api/territories/coverage', 'GET', null);
    
    const ui = SpreadsheetApp.getUi();
    
    if (result.territories) {
      let message = `Territory Coverage Report\n\n`;
      message += `Total Territories: ${result.territories.length}\n`;
      message += `Total Leads: ${result.totalLeads}\n`;
      message += `Assigned: ${result.assignedLeads}\n`;
      message += `Unassigned: ${result.unassignedLeads}\n\n`;
      message += `Top Territories:\n`;
      
      result.territories.slice(0, 5).forEach(t => {
        message += `• ${t.name}: ${t.leadCount} leads (${t.coverage}%)\n`;
      });
      
      ui.alert('🗺️ Territory Coverage', message, ui.ButtonSet.OK);
    } else {
      ui.alert('❌ Error', result.error || 'Failed to generate report', ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', 'Failed to generate: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function leadFunnelDashboard() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📊 Lead Funnel',
    'Opening Lead Funnel Dashboard in web app...\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/growth\n\n` +
    'Track leads through: New → Qualified → Contacted → Converted',
    ui.ButtonSet.OK
  );
}

// ============================================================================
// TEMPLATES
// ============================================================================

function editQuoteTemplate() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📋 Edit Quote Template',
    'Quote templates are configured in the web app.\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/admin/templates/quote\n\n` +
    'Customize:\n' +
    '• Header/footer layout\n' +
    '• Logo and branding\n' +
    '• Terms and conditions\n' +
    '• Multi-language content',
    ui.ButtonSet.OK
  );
}

function editInvoiceTemplate() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '🧾 Edit Invoice Template',
    'Invoice templates are configured in the web app.\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/admin/templates/invoice\n\n` +
    'Customize:\n' +
    '• Company details\n' +
    '• Tax information\n' +
    '• Payment terms\n' +
    '• Legal disclaimers',
    ui.ButtonSet.OK
  );
}

function editEmailTemplates() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📧 Edit Email Templates',
    'Email templates are managed in the Outreach module.\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/outreach/templates\n\n` +
    'Create templates for:\n' +
    '• Quote notifications\n' +
    '• Invoice delivery\n' +
    '• Campaign sequences\n' +
    '• Follow-ups',
    ui.ButtonSet.OK
  );
}

function customizePDFLayout() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '🎨 Customize PDF Layout',
    'PDF layouts are configured in the web app.\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/admin/templates/pdf\n\n` +
    'Customize:\n' +
    '• Page size and margins\n' +
    '• Font families and sizes\n' +
    '• Color schemes\n' +
    '• Header/footer sections',
    ui.ButtonSet.OK
  );
}

function multiLanguageSettings() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '🌐 Multi-Language Settings',
    'Language settings are managed in Admin panel.\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/admin/settings/languages\n\n` +
    'Supported languages:\n' +
    '• English (EN)\n' +
    '• German (DE)\n' +
    '• Arabic (AR)\n\n' +
    'Configure translations for UI, templates, and documents.',
    ui.ButtonSet.OK
  );
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

function refreshAllData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Refresh All Data',
    'This will reload all data from the API and refresh all sheets.\n\nContinue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    showProgress('Refreshing all data...');
    
    try {
      const result = callAPI('/api/admin/refresh-all', 'POST', {});
      
      if (result.success) {
        ui.alert(
          '✅ Refresh Complete',
          `Sheets refreshed: ${result.sheetsRefreshed}\n` +
          `Records updated: ${result.recordsUpdated}\n` +
          `Last sync: ${new Date(result.lastSync).toLocaleString()}`,
          ui.ButtonSet.OK
        );
        
        // Reload the spreadsheet
        SpreadsheetApp.getActiveSpreadsheet().toast('Data refreshed successfully!', '✅ Success', 3);
      } else {
        ui.alert('❌ Error', result.error || 'Failed to refresh data', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Failed to refresh: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function openMainDashboard() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📊 Main Dashboard',
    'Opening HAIROTICMEN Trading OS Dashboard...\n\n' +
    `URL: ${CONFIG.API_BASE_URL}\n\n` +
    'Access all features:\n' +
    '• Real-time analytics\n' +
    '• Sales desk\n' +
    '• Stand operations\n' +
    '• AI tools\n' +
    '• Marketing suite',
    ui.ButtonSet.OK
  );
}

function searchProducts() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🔍 Search Products',
    'Enter SKU, Name, or UPC:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const query = response.getResponseText();
    
    showProgress('Searching products...');
    
    try {
      const result = callAPI(`/api/products/search?q=${encodeURIComponent(query)}`, 'GET', null);
      
      if (result.products && result.products.length > 0) {
        let message = `Found ${result.products.length} product(s):\n\n`;
        
        result.products.slice(0, 5).forEach(p => {
          message += `${p.SKU}: ${p.Name}\n`;
          message += `  UVP: €${p.UVP_Inc} | Status: ${p.Status}\n\n`;
        });
        
        if (result.products.length > 5) {
          message += `...and ${result.products.length - 5} more`;
        }
        
        ui.alert('🔍 Search Results', message, ui.ButtonSet.OK);
        
        // Navigate to price list
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PRICE_LIST);
        if (sheet && result.products.length === 1) {
          // Find and highlight the product
          const data = sheet.getDataRange().getValues();
          for (let i = 0; i < data.length; i++) {
            if (data[i][0] === result.products[0].SKU) {
              sheet.setActiveRange(sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()));
              break;
            }
          }
          sheet.activate();
        }
      } else {
        ui.alert('🔍 No Results', 'No products found matching your search.', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Search failed: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function searchPartners() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '👤 Search Partners',
    'Enter Partner ID or Company Name:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const query = response.getResponseText();
    
    showProgress('Searching partners...');
    
    try {
      const result = callAPI(`/api/partners/search?q=${encodeURIComponent(query)}`, 'GET', null);
      
      if (result.partners && result.partners.length > 0) {
        let message = `Found ${result.partners.length} partner(s):\n\n`;
        
        result.partners.slice(0, 5).forEach(p => {
          message += `${p.PartnerID}: ${p.CompanyName}\n`;
          message += `  Tier: ${p.TierKey} | Status: ${p.Status}\n\n`;
        });
        
        if (result.partners.length > 5) {
          message += `...and ${result.partners.length - 5} more`;
        }
        
        ui.alert('👤 Search Results', message, ui.ButtonSet.OK);
        
        // Navigate to partners sheet
        const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PARTNERS);
        if (sheet && result.partners.length === 1) {
          // Find and highlight the partner
          const data = sheet.getDataRange().getValues();
          for (let i = 0; i < data.length; i++) {
            if (data[i][0] === result.partners[0].PartnerID) {
              sheet.setActiveRange(sheet.getRange(i + 1, 1, 1, sheet.getLastColumn()));
              break;
            }
          }
          sheet.activate();
        }
      } else {
        ui.alert('👤 No Results', 'No partners found matching your search.', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Search failed: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function exportDataCSV() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '📤 Export Data',
    'Which sheet to export?\n\n' +
    'Options:\n' +
    '• products\n' +
    '• partners\n' +
    '• quotes\n' +
    '• orders\n' +
    '• invoices\n' +
    '• leads\n\n' +
    'Enter sheet name:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const sheetName = response.getResponseText().toLowerCase();
    
    showProgress('Exporting to CSV...');
    
    try {
      const result = callAPI(`/api/export/${sheetName}`, 'GET', null);
      
      if (result.csvUrl) {
        ui.alert(
          '✅ Export Ready',
          `CSV file generated:\n${result.csvUrl}\n\n` +
          `Records: ${result.recordCount}\n` +
          `File size: ${result.fileSize}\n\n` +
          'Download the file from the URL above.',
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Failed to export', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Export failed: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function importData() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📥 Import Data',
    'Data import is available in the web app.\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/admin/import\n\n` +
    'Supported formats:\n' +
    '• CSV\n' +
    '• Excel (XLSX)\n' +
    '• JSON\n\n' +
    'Features:\n' +
    '• Column mapping\n' +
    '• Validation\n' +
    '• Duplicate detection\n' +
    '• Bulk updates',
    ui.ButtonSet.OK
  );
}

function syncWooCommerce() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Sync with WooCommerce',
    'This will sync product data with hairoticmen.de WooCommerce store.\n\n' +
    'Sync includes:\n' +
    '• Product prices\n' +
    '• Stock levels\n' +
    '• Product details\n' +
    '• QR codes\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    showProgress('Syncing with WooCommerce...');
    
    try {
      const result = callAPI('/api/woocommerce/sync', 'POST', {});
      
      if (result.success) {
        ui.alert(
          '✅ Sync Complete',
          `Products synced: ${result.productsSynced}\n` +
          `Updated: ${result.productsUpdated}\n` +
          `Skipped: ${result.productsSkipped}\n` +
          `Errors: ${result.errors}\n\n` +
          `Last sync: ${new Date(result.syncTime).toLocaleString()}`,
          ui.ButtonSet.OK
        );
      } else {
        ui.alert('❌ Error', result.error || 'Sync failed', ui.ButtonSet.OK);
      }
    } catch (error) {
      ui.alert('❌ Error', 'Sync failed: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

// ============================================================================
// ADMIN & SETTINGS
// ============================================================================

function systemHealthCheck() {
  showProgress('Running system health check...');
  
  try {
    const result = callAPI('/api/admin/health', 'GET', null);
    
    const ui = SpreadsheetApp.getUi();
    
    if (result.health) {
      let status = result.health.status === 'healthy' ? '✅' : '⚠️';
      
      ui.alert(
        `${status} System Health`,
        `Status: ${result.health.status}\n` +
        `API: ${result.health.api}\n` +
        `Database: ${result.health.database}\n` +
        `Sheets: ${result.health.sheets}\n` +
        `AI Services: ${result.health.ai}\n\n` +
        `Uptime: ${result.health.uptime}\n` +
        `Last check: ${new Date(result.health.lastCheck).toLocaleString()}`,
        ui.ButtonSet.OK
      );
      
      // Navigate to OS_Health sheet
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.OS_HEALTH);
      if (sheet) {
        sheet.activate();
      }
    } else {
      ui.alert('❌ Error', 'Health check failed', ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('❌ Error', 'Health check failed: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function viewOSLogs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.OS_LOGS);
  if (sheet) {
    sheet.activate();
    SpreadsheetApp.getUi().alert(
      '📊 System Logs',
      'Viewing OS_Logs sheet.\n\n' +
      'Log levels:\n' +
      '• INFO: General information\n' +
      '• WARN: Warnings\n' +
      '• ERROR: Errors\n' +
      '• DEBUG: Debug information\n\n' +
      'Filter by Component to view specific logs.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert('❌ Error', 'OS_Logs sheet not found', SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function configurationSettings() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '⚙️ Configuration',
    'System configuration is managed in the Admin panel.\n\n' +
    `URL: ${CONFIG.API_BASE_URL}/admin/settings\n\n` +
    'Configure:\n' +
    '• API endpoints\n' +
    '• Email providers\n' +
    '• Payment gateways\n' +
    '• Integration keys\n' +
    '• Feature flags',
    ui.ButtonSet.OK
  );
}

function showUserGuide() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📚 User Guide',
    'HAIROTICMEN Trading OS - Quick Start\n\n' +
    '1. PRICING:\n' +
    '   • Update Factory Prices in FinalPriceList\n' +
    '   • Run "Calculate All Prices"\n' +
    '   • Review MAP compliance\n\n' +
    '2. SALES:\n' +
    '   • Create quotes in Sales Desk\n' +
    '   • Convert to orders\n' +
    '   • Generate invoices\n\n' +
    '3. STAND OPS:\n' +
    '   • Check inventory levels\n' +
    '   • Plan refills\n' +
    '   • Record visits\n\n' +
    '4. AI TOOLS:\n' +
    '   • Run AI assistants\n' +
    '   • Review drafts in Guardrails\n' +
    '   • Approve for production\n\n' +
    'Full documentation: ' + CONFIG.API_BASE_URL + '/docs',
    ui.ButtonSet.OK
  );
}

function showSupport() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '🆘 Support',
    'Need help?\n\n' +
    '📧 Email: support@hairoticmen.de\n' +
    '📞 Phone: +49 XXX XXXXXXX\n' +
    '💬 Chat: Available in web app\n\n' +
    `Documentation: ${CONFIG.API_BASE_URL}/docs\n` +
    `Status Page: ${CONFIG.API_BASE_URL}/status\n\n` +
    'For urgent issues, use the chat support in the web app.',
    ui.ButtonSet.OK
  );
}

function showAbout() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'ℹ️ About HAIROTICMEN Trading OS',
    'HAIROTICMEN Trading OS\n' +
    'Version: 3.0.0\n' +
    'Build: November 2025\n\n' +
    'Comprehensive B2B trading platform for grooming products.\n\n' +
    'Features:\n' +
    '✓ German PAngV compliance (Grundpreis)\n' +
    '✓ Multi-channel pricing (B2C, Amazon, B2B)\n' +
    '✓ Stand operations management\n' +
    '✓ AI-powered tools\n' +
    '✓ Marketing automation\n' +
    '✓ CRM & lead management\n\n' +
    '© 2025 HAIROTICMEN\n' +
    'hairoticmen.de',
    ui.ButtonSet.OK
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Call the API with proper error handling
 */
function callAPI(endpoint, method, data) {
  const url = CONFIG.API_BASE_URL + endpoint;
  
  const options = {
    method: method,
    contentType: 'application/json',
    muteHttpExceptions: true
  };
  
  if (data !== null && method !== 'GET') {
    options.payload = JSON.stringify(data);
  }
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode >= 200 && responseCode < 300) {
      return JSON.parse(responseText);
    } else {
      throw new Error(`API Error (${responseCode}): ${responseText}`);
    }
  } catch (error) {
    console.error('API Call Failed:', error);
    throw error;
  }
}

/**
 * Show progress toast
 */
function showProgress(message) {
  SpreadsheetApp.getActiveSpreadsheet().toast(message, '⏳ Processing...', -1);
}

/**
 * Show welcome message on first load
 */
function showWelcomeMessage() {
  const userProperties = PropertiesService.getUserProperties();
  const hasSeenWelcome = userProperties.getProperty('hasSeenWelcome');
  
  if (!hasSeenWelcome) {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '🚀 Welcome to HAIROTICMEN Trading OS',
      'Your comprehensive menu system is ready!\n\n' +
      'Quick tips:\n' +
      '• All features accessible via "HAIROTICMEN OS" menu\n' +
      '• Start with Pricing Studio to calculate prices\n' +
      '• Use AI Hub for intelligent automation\n' +
      '• Check System Health regularly\n\n' +
      'IMPORTANT: Update CONFIG.API_BASE_URL in the script\n' +
      'with your deployed Replit app URL.\n\n' +
      'Need help? Go to Admin & Settings > User Guide',
      ui.ButtonSet.OK
    );
    
    userProperties.setProperty('hasSeenWelcome', 'true');
  }
}
