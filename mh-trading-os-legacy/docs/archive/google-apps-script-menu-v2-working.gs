/**
 * HAIROTICMEN Trading OS - Google Apps Script Menu (WORKING VERSION)
 * This version only includes features that are currently implemented in the backend
 * 
 * Installation Instructions:
 * 1. Open your Google Sheet (ID: 1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0)
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code
 * 4. Paste this entire script
 * 5. Update CONFIG section with your deployed app URL and API key
 * 6. Save (Ctrl+S)
 * 7. Refresh your Google Sheet
 */

// ============================================================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================================================

const CONFIG = {
  // Your deployed Replit app URL (REQUIRED)
  API_BASE_URL: 'https://your-replit-app.replit.dev',
  
  // Your API key for authentication (REQUIRED for production)
  // In dev mode, this can be empty
  API_KEY: '',
  
  // Sheet names (do not change)
  SHEETS: {
    PRICE_LIST: 'FinalPriceList',
    PRICING_PARAMS: 'Pricing_Params',
    PARTNERS: 'Partners',
    QUOTES: 'Quotes',
    ORDERS: 'Orders',
    INVOICES: 'Invoices',
    STANDS: 'Stands',
    STAND_INVENTORY: 'Stand_Inventory',
    LEADS: 'Leads',
    TERRITORIES: 'Territories',
    AI_JOBS: 'AI_Jobs',
    OS_HEALTH: 'OS_Health',
    OS_LOGS: 'OS_Logs'
  }
};

// ============================================================================
// MENU CREATION
// ============================================================================

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('🚀 HAIROTICMEN OS')
    
    // === SHEET NAVIGATION ===
    .addSubMenu(ui.createMenu('📊 Go To Sheet')
      .addItem('💰 Price List', 'goToPriceList')
      .addItem('⚙️ Pricing Parameters', 'goToPricingParams')
      .addItem('👥 Partners', 'goToPartners')
      .addItem('📋 Quotes', 'goToQuotes')
      .addItem('📦 Orders', 'goToOrders')
      .addItem('🧾 Invoices', 'goToInvoices')
      .addSeparator()
      .addItem('🏪 Stands', 'goToStands')
      .addItem('📦 Stand Inventory', 'goToStandInventory')
      .addSeparator()
      .addItem('👤 Leads', 'goToLeads')
      .addItem('🗺️ Territories', 'goToTerritories')
      .addSeparator()
      .addItem('🤖 AI Jobs', 'goToAIJobs')
      .addItem('🏥 System Health', 'goToOSHealth')
      .addItem('📝 System Logs', 'goToOSLogs')
    )
    
    // === WEB APP FEATURES ===
    .addSubMenu(ui.createMenu('🌐 Open Web App')
      .addItem('📊 Dashboard', 'openDashboard')
      .addItem('💰 Pricing Studio', 'openPricingStudio')
      .addItem('📋 Sales Desk', 'openSalesDesk')
      .addItem('🏪 Stand Center', 'openStandCenter')
      .addItem('📊 Reports & Analytics', 'openReports')
      .addSeparator()
      .addItem('🤖 AI Hub', 'openAIHub')
      .addItem('🔒 AI Guardrails', 'openAIGuardrails')
      .addItem('📢 AI Marketing', 'openAIMarketing')
      .addSeparator()
      .addItem('👥 CRM & Leads', 'openCRM')
      .addItem('✉️ Email Outreach', 'openOutreach')
      .addSeparator()
      .addItem('⚙️ Admin Panel', 'openAdmin')
    )
    
    // === AI ASSISTANTS (IMPLEMENTED) ===
    .addSubMenu(ui.createMenu('🤖 AI Assistants')
      .addItem('🔍 SEO: Generate Brief', 'aiSEOBrief')
      .addItem('🔍 SEO: Audit Page', 'aiSEOAudit')
      .addSeparator()
      .addItem('🎯 Ads: Expand Keywords', 'aiAdsKeywords')
      .addItem('📝 Ads: Generate Copy', 'aiAdsCopy')
      .addSeparator()
      .addItem('📱 Social: Plan Calendar', 'aiSocialCalendar')
      .addItem('✍️ Social: Rewrite Caption', 'aiSocialRewrite')
      .addSeparator()
      .addItem('📊 View AI Job Log', 'viewAIJobLog')
    )
    
    // === DATA OPERATIONS ===
    .addSubMenu(ui.createMenu('⚡ Data Operations')
      .addItem('🔄 Regenerate All Sheets', 'regenerateAllSheets')
      .addItem('🔍 Search Products', 'searchProducts')
      .addItem('📤 Export to CSV', 'exportToCSV')
      .addSeparator()
      .addItem('📊 Show Statistics', 'showStatistics')
      .addItem('✅ Validate Data', 'validateData')
    )
    
    // === ADMIN & HELP ===
    .addSubMenu(ui.createMenu('⚙️ Admin & Help')
      .addItem('🏥 System Health Check', 'systemHealthCheck')
      .addItem('📊 View Logs', 'viewOSLogs')
      .addSeparator()
      .addItem('📚 User Guide', 'showUserGuide')
      .addItem('ℹ️ About', 'showAbout')
      .addItem('🆘 Support', 'showSupport')
    )
    
    .addSeparator()
    .addItem('🔄 Reload Menu', 'onOpen')
    
    .addToUi();
  
  showWelcomeMessage();
}

// ============================================================================
// SHEET NAVIGATION
// ============================================================================

function goToPriceList() {
  navigateToSheet(CONFIG.SHEETS.PRICE_LIST, 'Price List - 89 products with calculated pricing');
}

function goToPricingParams() {
  navigateToSheet(CONFIG.SHEETS.PRICING_PARAMS, 'Pricing Parameters - Edit VAT, margins, MAP settings');
}

function goToPartners() {
  navigateToSheet(CONFIG.SHEETS.PARTNERS, 'Partners - B2B partner registry with tier assignments');
}

function goToQuotes() {
  navigateToSheet(CONFIG.SHEETS.QUOTES, 'Quotes - Sales proposals and quotations');
}

function goToOrders() {
  navigateToSheet(CONFIG.SHEETS.ORDERS, 'Orders - Confirmed orders from quotes');
}

function goToInvoices() {
  navigateToSheet(CONFIG.SHEETS.INVOICES, 'Invoices - Generated invoices with PDF links');
}

function goToStands() {
  navigateToSheet(CONFIG.SHEETS.STANDS, 'Stands - Physical stand locations with GPS');
}

function goToStandInventory() {
  navigateToSheet(CONFIG.SHEETS.STAND_INVENTORY, 'Stand Inventory - Current stock levels per stand');
}

function goToLeads() {
  navigateToSheet(CONFIG.SHEETS.LEADS, 'Leads - CRM leads from Google Places and other sources');
}

function goToTerritories() {
  navigateToSheet(CONFIG.SHEETS.TERRITORIES, 'Territories - Sales territory assignments');
}

function goToAIJobs() {
  navigateToSheet(CONFIG.SHEETS.AI_JOBS, 'AI Jobs - Queue of AI tasks and their status');
}

function goToOSHealth() {
  navigateToSheet(CONFIG.SHEETS.OS_HEALTH, 'System Health - Monitoring and diagnostics');
}

function goToOSLogs() {
  navigateToSheet(CONFIG.SHEETS.OS_LOGS, 'System Logs - Operation logs and errors');
}

function navigateToSheet(sheetName, description) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  
  if (sheet) {
    sheet.activate();
    SpreadsheetApp.getUi().alert(
      sheetName,
      description,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } else {
    SpreadsheetApp.getUi().alert(
      'Sheet Not Found',
      `Sheet "${sheetName}" does not exist.\n\nRun "Regenerate All Sheets" to create missing sheets.`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

// ============================================================================
// WEB APP FEATURES
// ============================================================================

function openDashboard() {
  openWebApp('/', 'Main Dashboard - Real-time KPIs and system overview');
}

function openPricingStudio() {
  openWebApp('/pricing', 'Pricing Studio - Calculate prices, validate MAP, manage pricing');
}

function openSalesDesk() {
  openWebApp('/sales', 'Sales Desk - Create quotes, convert to orders, generate invoices');
}

function openStandCenter() {
  openWebApp('/stands', 'Stand Center - Manage stand inventory, visits, and performance');
}

function openReports() {
  openWebApp('/reports', 'Reports & Analytics - Revenue, products, partners analytics');
}

function openAIHub() {
  openWebApp('/ai-hub', 'AI Hub - Access all AI assistants and tools');
}

function openAIGuardrails() {
  openWebApp('/ai-guardrails', 'AI Guardrails - Review and approve AI-generated content');
}

function openAIMarketing() {
  openWebApp('/ai-marketing', 'AI Marketing - SEO, Ads, and Social Media assistants');
}

function openCRM() {
  openWebApp('/growth', 'CRM & Leads - Lead management, scoring, territory assignment');
}

function openOutreach() {
  openWebApp('/outreach', 'Email Outreach - Campaign management and email sequences');
}

function openAdmin() {
  openWebApp('/admin', 'Admin Panel - System settings and configuration');
}

function openWebApp(path, description) {
  const url = CONFIG.API_BASE_URL + path;
  const ui = SpreadsheetApp.getUi();
  
  const html = `<html>
    <body>
      <p>${description}</p>
      <p><strong>Opening:</strong> <a href="${url}" target="_blank">${url}</a></p>
      <p>Click the link above to open in a new tab.</p>
      <script>
        google.script.host.close();
        window.open('${url}', '_blank');
      </script>
    </body>
  </html>`;
  
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(400)
    .setHeight(150);
  
  ui.showModalDialog(htmlOutput, 'Opening Web App');
}

// ============================================================================
// AI ASSISTANTS (IMPLEMENTED ENDPOINTS)
// ============================================================================

function aiSEOBrief() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🔍 SEO Brief Generator',
    'Enter target keywords (one per line):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const keywords = response.getResponseText().split('\n').filter(k => k.trim());
    
    if (keywords.length === 0) {
      ui.alert('Error', 'Please enter at least one keyword.', ui.ButtonSet.OK);
      return;
    }
    
    showProgress('Generating SEO brief...');
    
    try {
      const result = callAPI('/api/ai/seo/brief', 'POST', {
        keywords: keywords,
        language: 'DE'
      });
      
      ui.alert(
        '✅ SEO Brief Generated',
        `Brief created for ${keywords.length} keyword(s).\n\n` +
        `Check the AI Job Log for results.`,
        ui.ButtonSet.OK
      );
    } catch (error) {
      ui.alert('Error', 'Failed to generate brief: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function aiSEOAudit() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🔍 SEO Page Audit',
    'Enter page URL to audit:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const url = response.getResponseText();
    
    if (!url.startsWith('http')) {
      ui.alert('Error', 'Please enter a valid URL starting with http:// or https://', ui.ButtonSet.OK);
      return;
    }
    
    showProgress('Auditing page...');
    
    try {
      const result = callAPI('/api/ai/seo/audit', 'POST', {
        pageURL: url
      });
      
      ui.alert(
        '✅ SEO Audit Complete',
        `Page audited: ${url}\n\n` +
        `Check the AI Job Log for detailed results.`,
        ui.ButtonSet.OK
      );
    } catch (error) {
      ui.alert('Error', 'Failed to audit page: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function aiAdsKeywords() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🎯 Expand Keywords',
    'Enter seed keywords (one per line):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const seeds = response.getResponseText().split('\n').filter(k => k.trim());
    
    if (seeds.length === 0) {
      ui.alert('Error', 'Please enter at least one seed keyword.', ui.ButtonSet.OK);
      return;
    }
    
    showProgress('Expanding keywords...');
    
    try {
      const result = callAPI('/api/ai/ads/expand-keywords', 'POST', {
        seedKeywords: seeds,
        language: 'DE',
        matchType: 'Phrase'
      });
      
      ui.alert(
        '✅ Keywords Expanded',
        `Seed keywords: ${seeds.length}\n\n` +
        `Check the AI Job Log for expanded keyword list.`,
        ui.ButtonSet.OK
      );
    } catch (error) {
      ui.alert('Error', 'Failed to expand keywords: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function aiAdsCopy() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '📝 Generate Ad Copy',
    'Enter product name or keyword:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const keyword = response.getResponseText();
    
    if (!keyword.trim()) {
      ui.alert('Error', 'Please enter a keyword.', ui.ButtonSet.OK);
      return;
    }
    
    showProgress('Generating ad copy...');
    
    try {
      const result = callAPI('/api/ai/ads/generate-copy', 'POST', {
        keyword: keyword,
        language: 'DE'
      });
      
      ui.alert(
        '✅ Ad Copy Generated',
        `Generated ad copy for: ${keyword}\n\n` +
        `Check the AI Job Log for results.`,
        ui.ButtonSet.OK
      );
    } catch (error) {
      ui.alert('Error', 'Failed to generate copy: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function aiSocialCalendar() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '📱 Plan Social Calendar',
    'How many days to plan? (1-30):',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const days = parseInt(response.getResponseText());
    
    if (isNaN(days) || days < 1 || days > 30) {
      ui.alert('Error', 'Please enter a number between 1 and 30.', ui.ButtonSet.OK);
      return;
    }
    
    showProgress('Planning content calendar...');
    
    try {
      const result = callAPI('/api/ai/social/generate-plan', 'POST', {
        days: days,
        platforms: ['Instagram', 'Facebook'],
        locale: 'de'
      });
      
      ui.alert(
        '✅ Calendar Planned',
        `Planned ${days} days of content.\n\n` +
        `Check AI Guardrails to review and approve posts.`,
        ui.ButtonSet.OK
      );
    } catch (error) {
      ui.alert('Error', 'Failed to plan calendar: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function aiSocialRewrite() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '✍️ Rewrite Caption',
    'Enter original caption:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const caption = response.getResponseText();
    
    if (!caption.trim()) {
      ui.alert('Error', 'Please enter a caption.', ui.ButtonSet.OK);
      return;
    }
    
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
        
        ui.alert(
          '✅ Caption Rewritten',
          `Original:\n${caption.substring(0, 100)}...\n\n` +
          `Check the AI Job Log for the rewritten version.`,
          ui.ButtonSet.OK
        );
      } catch (error) {
        ui.alert('Error', 'Failed to rewrite: ' + error.toString(), ui.ButtonSet.OK);
      }
    }
  }
}

function viewAIJobLog() {
  try {
    showProgress('Loading AI job log...');
    
    const result = callAPI('/api/ai/agents/log', 'GET', null);
    
    const ui = SpreadsheetApp.getUi();
    
    if (result.jobs && result.jobs.length > 0) {
      let message = `Recent AI Jobs (${result.jobs.length}):\n\n`;
      
      result.jobs.slice(0, 10).forEach(job => {
        message += `• ${job.agent}: ${job.task}\n`;
        message += `  Status: ${job.status} | ${new Date(job.timestamp).toLocaleString()}\n\n`;
      });
      
      if (result.jobs.length > 10) {
        message += `...and ${result.jobs.length - 10} more jobs`;
      }
      
      ui.alert('🤖 AI Job Log', message, ui.ButtonSet.OK);
    } else {
      ui.alert('🤖 AI Job Log', 'No AI jobs found.', ui.ButtonSet.OK);
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert('Error', 'Failed to load jobs: ' + error.toString(), SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

// ============================================================================
// DATA OPERATIONS
// ============================================================================

function regenerateAllSheets() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Regenerate All Sheets',
    'This will regenerate all 28 Google Sheets with fresh schema and seed data.\n\n' +
    '⚠️ WARNING: This will overwrite existing data!\n\n' +
    'Only use this for initial setup or complete reset.\n\n' +
    'Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    showProgress('Regenerating all sheets... This may take a few minutes.');
    
    try {
      // This would call the bootstrap script
      // For now, show instructions
      ui.alert(
        'Manual Action Required',
        'To regenerate all sheets, run this command on your Replit backend:\n\n' +
        'npx tsx server/scripts/bootstrap-sheets.ts\n\n' +
        'This will create all 28 sheets with proper schema and seed data.',
        ui.ButtonSet.OK
      );
    } catch (error) {
      ui.alert('Error', 'Failed to regenerate: ' + error.toString(), ui.ButtonSet.OK);
    }
  }
}

function searchProducts() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    '🔍 Search Products',
    'Enter SKU, Name, or UPC to search:',
    ui.ButtonSet.OK_CANCEL
  );
  
  if (response.getSelectedButton() === ui.Button.OK) {
    const query = response.getResponseText();
    
    if (!query.trim()) {
      ui.alert('Error', 'Please enter a search term.', ui.ButtonSet.OK);
      return;
    }
    
    showProgress('Searching products...');
    
    // Search in FinalPriceList sheet
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.PRICE_LIST);
    if (!sheet) {
      ui.alert('Error', 'Price List sheet not found.', ui.ButtonSet.OK);
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const skuCol = headers.indexOf('SKU');
    const nameCol = headers.indexOf('Name');
    const upcCol = headers.indexOf('UPC');
    
    const results = [];
    const searchTerm = query.toLowerCase();
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const sku = String(row[skuCol] || '').toLowerCase();
      const name = String(row[nameCol] || '').toLowerCase();
      const upc = String(row[upcCol] || '').toLowerCase();
      
      if (sku.includes(searchTerm) || name.includes(searchTerm) || upc.includes(searchTerm)) {
        results.push({
          rowIndex: i + 1,
          sku: row[skuCol],
          name: row[nameCol],
          uvp: row[headers.indexOf('UVP_Inc')]
        });
      }
    }
    
    if (results.length > 0) {
      let message = `Found ${results.length} product(s):\n\n`;
      
      results.slice(0, 5).forEach(r => {
        message += `${r.sku}: ${r.name}\n`;
        message += `  UVP: €${r.uvp || 'N/A'}\n\n`;
      });
      
      if (results.length > 5) {
        message += `...and ${results.length - 5} more`;
      }
      
      ui.alert('🔍 Search Results', message, ui.ButtonSet.OK);
      
      // Highlight first result
      if (results.length === 1) {
        sheet.setActiveRange(sheet.getRange(results[0].rowIndex, 1, 1, sheet.getLastColumn()));
        sheet.activate();
      }
    } else {
      ui.alert('🔍 No Results', 'No products found matching your search.', ui.ButtonSet.OK);
    }
  }
}

function exportToCSV() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📤 Export to CSV',
    'To export data to CSV:\n\n' +
    '1. Open the sheet you want to export\n' +
    '2. Click File > Download > Comma-separated values (.csv)\n\n' +
    'Or use the web app for advanced export options.',
    ui.ButtonSet.OK
  );
}

function showStatistics() {
  showProgress('Calculating statistics...');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Count rows in each sheet
  const stats = [];
  Object.entries(CONFIG.SHEETS).forEach(([key, sheetName]) => {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const rowCount = sheet.getLastRow() - 1; // Exclude header
      stats.push(`${sheetName}: ${rowCount} records`);
    }
  });
  
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📊 System Statistics',
    stats.join('\n'),
    ui.ButtonSet.OK
  );
}

function validateData() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '✅ Data Validation',
    'Data validation is available in the web app.\n\n' +
    'Features:\n' +
    '• Schema validation\n' +
    '• Duplicate detection\n' +
    '• Constraint checking\n' +
    '• Pricing verification\n\n' +
    `Open: ${CONFIG.API_BASE_URL}/admin/validate`,
    ui.ButtonSet.OK
  );
}

// ============================================================================
// ADMIN & HELP
// ============================================================================

function systemHealthCheck() {
  showProgress('Running health check...');
  
  try {
    // Try to ping the API
    const response = UrlFetchApp.fetch(CONFIG.API_BASE_URL + '/health', {
      method: 'get',
      muteHttpExceptions: true
    });
    
    const ui = SpreadsheetApp.getUi();
    
    if (response.getResponseCode() === 200) {
      ui.alert(
        '✅ System Health',
        'API is reachable and healthy!\n\n' +
        `URL: ${CONFIG.API_BASE_URL}\n` +
        `Status: Online\n\n` +
        'For detailed health metrics, view the OS_Health sheet.',
        ui.ButtonSet.OK
      );
      
      goToOSHealth();
    } else {
      ui.alert(
        '⚠️ System Health',
        `API returned status: ${response.getResponseCode()}\n\n` +
        'There may be issues with the backend.',
        ui.ButtonSet.OK
      );
    }
  } catch (error) {
    SpreadsheetApp.getUi().alert(
      '❌ Connection Error',
      'Cannot reach API.\n\n' +
      'Please check:\n' +
      '1. API_BASE_URL is correct in CONFIG\n' +
      '2. Your Replit app is running\n' +
      '3. Your internet connection\n\n' +
      `Error: ${error.toString()}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

function showUserGuide() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '📚 User Guide',
    'HAIROTICMEN Trading OS - Quick Start\n\n' +
    '1. NAVIGATION:\n' +
    '   • Use "Go To Sheet" menu for quick navigation\n' +
    '   • Use "Open Web App" for full features\n\n' +
    '2. AI ASSISTANTS:\n' +
    '   • Run AI tasks from menu\n' +
    '   • Check results in AI Job Log\n' +
    '   • Review drafts in AI Guardrails\n\n' +
    '3. DATA OPERATIONS:\n' +
    '   • Search products quickly\n' +
    '   • View statistics\n' +
    '   • Export to CSV\n\n' +
    '4. WEB APP:\n' +
    '   • Full pricing calculations\n' +
    '   • Sales workflows\n' +
    '   • Stand management\n' +
    '   • Advanced AI features\n\n' +
    `Full docs: ${CONFIG.API_BASE_URL}/docs`,
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
    'B2B Trading Platform for Grooming Products\n\n' +
    'Features:\n' +
    '✓ German PAngV compliance\n' +
    '✓ Multi-channel pricing\n' +
    '✓ Stand operations\n' +
    '✓ AI-powered tools\n' +
    '✓ CRM & marketing\n\n' +
    '© 2025 HAIROTICMEN\n' +
    'hairoticmen.de',
    ui.ButtonSet.OK
  );
}

function showSupport() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    '🆘 Support',
    'Need help?\n\n' +
    '📧 Email: support@hairoticmen.de\n' +
    '💬 Chat: Available in web app\n\n' +
    `Documentation: ${CONFIG.API_BASE_URL}/docs\n\n` +
    'For technical issues, check OS_Logs sheet.',
    ui.ButtonSet.OK
  );
}

function showWelcomeMessage() {
  const userProperties = PropertiesService.getUserProperties();
  const hasSeenWelcome = userProperties.getProperty('hasSeenWelcome_v2');
  
  if (!hasSeenWelcome) {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      '🚀 Welcome to HAIROTICMEN Trading OS',
      'Your menu system is ready!\n\n' +
      '⚠️ IMPORTANT: Update CONFIG settings:\n' +
      '1. Go to Extensions > Apps Script\n' +
      '2. Update API_BASE_URL with your app URL\n' +
      '3. Add API_KEY if using production mode\n' +
      '4. Save changes\n\n' +
      'Quick Start:\n' +
      '• Navigate sheets via "Go To Sheet"\n' +
      '• Open full features via "Open Web App"\n' +
      '• Run AI tools via "AI Assistants"\n' +
      '• Check health with "System Health Check"\n\n' +
      'Enjoy!',
      ui.ButtonSet.OK
    );
    
    userProperties.setProperty('hasSeenWelcome_v2', 'true');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Call API with authentication
 */
function callAPI(endpoint, method, data) {
  const url = CONFIG.API_BASE_URL + endpoint;
  
  const options = {
    method: method,
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {}
  };
  
  // Add API key if configured
  if (CONFIG.API_KEY) {
    options.headers['x-api-key'] = CONFIG.API_KEY;
  }
  
  if (data !== null && method !== 'GET') {
    options.payload = JSON.stringify(data);
  }
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    if (responseCode >= 200 && responseCode < 300) {
      return JSON.parse(responseText);
    } else if (responseCode === 401) {
      throw new Error('Authentication failed. Check your API_KEY in CONFIG.');
    } else if (responseCode === 404) {
      throw new Error('Endpoint not found. This feature may not be implemented yet.');
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
