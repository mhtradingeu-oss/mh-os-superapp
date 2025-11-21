// HAIROTICMEN Trading OS — Google Apps Script Schema Manager V2.2
// Idempotent workbook scanner, schema reconciler, formula injector, and data validator

const DRY_RUN = false;
const ARCHIVE_BEFORE_DELETE = true;
const MAX_ROWS = 5000;

const CANONICAL_SHEETS = [
  'README', 'Settings', 'LineTargets', 'CostPresets', 'Boxes', 'ShippingMatrix',
  'Channels', 'LoyaltyGift', 'PartnerTiers', 'QuantityDiscounts', 'DiscountCap',
  'OrderDiscounts', 'Products', 'SKUGifts', 'AmazonSizeTiers', 'FinalPriceList',
  'KPIs', 'QuoteBuilder', 'QuoteBuilder_Lines', 'QuoteBuilder_Summary'
];

const SCHEMA = {
  Settings: ['Key', 'Value', 'Description'],
  LineTargets: ['Line', 'GM_UVP', 'Floor_Multiplier', 'Ad_Pct_Default'],
  CostPresets: ['Product_Group', 'EPR_LUCID', 'GS1', 'Retail_Packaging', 'QC_PIF', 'Operations', 'Marketing'],
  Boxes: ['Box_Size', 'Description', 'Box_Cost_per_Order', 'MaxUnitsRecommended'],
  ShippingMatrix: ['Route', 'Zone', 'WeightBand_kg', 'BasePrice_EUR', 'Energy_Surcharge_EUR', 'LKW_CO2_EUR', 'Peak_EUR', 'Peak_in_Peak_EUR', 'Pickup_Label_EUR', 'Notes'],
  Channels: ['Channel', 'Referral_Low_Pct_<=10€', 'Referral_High_Pct_>10€', 'Min_Referral_Fee_EUR', 'Platform_Pct', 'Label_Fee_EUR', 'Apply_Payment_Fee_1or0', 'Ad_Pct_Premium', 'Ad_Pct_Skin', 'Ad_Pct_Professional', 'Ad_Pct_Basic', 'Ad_Pct_Tools', 'AvgUnitsPerOrder_Default'],
  LoyaltyGift: ['Program', 'Points_per_EUR_Net', 'Point_Value_EUR', 'Expected_Redemption_Pct', 'Accounting_Cost_Pct'],
  PartnerTiers: ['Role', 'Discount_Pct', 'Cap_Pct', 'Min_EUR_Add', 'Commission_Pct_OffInvoice'],
  QuantityDiscounts: ['Min_Qty', 'Max_Qty', 'Discount_Pct', 'Apply_To_Roles'],
  DiscountCap: ['Role', 'Cap_Pct'],
  OrderDiscounts: ['Min_Subtotal_Net', 'Order_Discount_Pct'],
  Products: ['EAN', 'Item', 'Box_Size', 'Product_Group', 'Line', 'Category', 'UnitsPerCarton', 'UnitPerPice', 'TotalFactoryPriceCarton', 'FactoryPriceUnit_Manual', 'Shipping_Inbound_per_unit', 'FactoryPriceUnit_Final', 'EPR_LUCID', 'GS1', 'Retail_Packaging', 'QC_PIF', 'Operations', 'Marketing', 'FullCost_Unit', 'Floor_Multiplier', 'Floor_B2C_Net', 'Target_GM_UVP', 'Manual_UVP_Inc', 'UVP_Net', 'EndUser_Inc', 'UVP_NonBinding_Inc', 'UVP_vs_Floor_Flag', 'Net_Content_ml', 'Grundpreis_Net_€/100ml', 'Grundpreis_Inc_€/100ml', 'AvgUnitsPerOrder', 'Ad_Pct', 'B2C_BoxCost_per_unit', 'B2C_Gift_Cost_Unit', 'B2C_ShippingBox_Unit', 'MinInc_Own_.99', 'MinInc_Own', 'Recommended_UVP_Net_TargetGM', 'Payment_Fee_Net', 'Payment_Fee_Pct_Blended', 'Returns_Cost_Net', 'Returns_Pct', 'Loyalty_Cost_Net', 'Loyalty_Pct', 'Ad_Cost_Net', 'Ad_Pct_Effective', 'GM_at_Rec_UVP_Net', 'GM_at_Rec_UVP_Pct', 'Channel_Type', 'Referral_Fee_Net', 'Platform_Fee_Net', 'Label_Fee_Net', 'FBA_PickPack', 'FBA_WeightSurcharge', 'FBA_Storage', 'FBA_LabelPrep', 'FBA_Returns', 'FBA_TotalFee', 'Post_Channel_Margin_Net', 'Post_Channel_Margin_Pct', 'MinInc_FBM', 'MinInc_FBM_.99', 'MinInc_FBA', 'MinInc_FBA_.99', 'Amazon_TierKey'],
  SKUGifts: ['SKU_EAN', 'Gift_SKU', 'Gift_SKU_Cost', 'Attach_Rate', 'Funding_Pct', 'Shipping_Increment', 'Allowed_Channels', 'Excluded_Roles', 'Start_Date', 'End_Date', 'MaxGiftsPerOrder'],
  AmazonSizeTiers: ['TierKey', 'Pick_Pack_EUR', 'Weight_Surcharge_EUR', 'Storage_EUR', 'Label_Prep_EUR', 'Returns_Pct'],
  FinalPriceList: ['EAN', 'Item', 'Line', 'UVP_Net', 'EndUser_Inc_.99', 'Floor_B2C_Net', 'Partner_Net', 'SalesRep_Net', 'StandPartner_Net', 'DealerBasic_Net', 'DealerPlus_Net', 'Distributor_Net'],
  KPIs: ['Metric', 'Value', 'Notes'],
  QuoteBuilder: ['Quote_ID', 'Partner', 'Role', 'VAT_Mode', 'Channel', 'Shipping_EUR', 'Order_Discount_Pct', 'Subtotal_Net', 'VAT_EUR', 'Total_Gross', 'Loyalty_Points', 'Commission_EUR'],
  QuoteBuilder_Lines: ['Quote_ID', 'EAN', 'Item', 'Qty', 'Unit_Net', 'Line_Net'],
  QuoteBuilder_Summary: ['Quote_ID', 'Lines_Count', 'Guardrail_OK_All', 'Created_At'],
  README: ['Info']
};

const SYNONYMS = {
  'GTIN': 'EAN', 'Barcode': 'EAN',
  'UnitPerPiece': 'UnitPerPice',
  'TargetGM': 'Target_GM_UVP', 'GM_Target': 'Target_GM_UVP',
  'FBA_TierKey': 'Amazon_TierKey', 'TierKey': 'Amazon_TierKey'
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('HAIROTICMEN')
    .addItem('1) Setup (Scan, Normalize, Repair)', 'setupWorkbook')
    .addItem('2) Refresh Formulas (Products)', 'refreshFormulas')
    .addItem('3) Build Final Price List', 'buildFinalPriceList')
    .addItem('4) Rebuild KPIs', 'rebuildKPIs')
    .addItem('5) Protect Formula Columns', 'protectFormulaColumns')
    .addToUi();
}

function setupWorkbook() {
  const report = initMigrationReport();
  try {
    logReport(report, 'INFO', 'Starting Setup (Scan, Normalize, Repair)');
    scanAndNormalizeSheets(report);
    reconcileAllHeaders(report);
    seedDefaults(report);
    injectFormulas(report);
    setupValidations(report);
    protectFormulaColumns();
    logReport(report, 'SUCCESS', 'Setup completed successfully');
    SpreadsheetApp.getActiveSpreadsheet().toast('Setup completed!', 'HAIROTICMEN', 5);
  } catch (e) {
    logReport(report, 'ERROR', 'Setup failed: ' + e.toString() + '\n' + e.stack);
    throw e;
  }
}

function refreshFormulas() {
  const report = initMigrationReport();
  try {
    logReport(report, 'INFO', 'Refreshing formulas in Products');
    injectProductFormulas(report);
    logReport(report, 'SUCCESS', 'Formulas refreshed');
    SpreadsheetApp.getActiveSpreadsheet().toast('Formulas refreshed!', 'HAIROTICMEN', 3);
  } catch (e) {
    logReport(report, 'ERROR', 'Refresh failed: ' + e.toString());
    throw e;
  }
}

function buildFinalPriceList() {
  const report = initMigrationReport();
  try {
    logReport(report, 'INFO', 'Building Final Price List');
    buildFinalPriceListImpl(report);
    logReport(report, 'SUCCESS', 'Final Price List built');
    SpreadsheetApp.getActiveSpreadsheet().toast('Final Price List ready!', 'HAIROTICMEN', 3);
  } catch (e) {
    logReport(report, 'ERROR', 'Build failed: ' + e.toString());
    throw e;
  }
}

function rebuildKPIs() {
  const report = initMigrationReport();
  try {
    logReport(report, 'INFO', 'Rebuilding KPIs');
    buildKPIs(report);
    logReport(report, 'SUCCESS', 'KPIs rebuilt');
    SpreadsheetApp.getActiveSpreadsheet().toast('KPIs updated!', 'HAIROTICMEN', 3);
  } catch (e) {
    logReport(report, 'ERROR', 'KPIs rebuild failed: ' + e.toString());
    throw e;
  }
}

function initMigrationReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let reportSheet = ss.getSheetByName('MIGRATION_REPORT');
  if (!reportSheet) {
    reportSheet = ss.insertSheet('MIGRATION_REPORT');
    reportSheet.getRange(1, 1, 1, 4).setValues([['Timestamp', 'Level', 'Action', 'Details']]);
    reportSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#4a86e8').setFontColor('white');
  }
  return reportSheet;
}

function logReport(reportSheet, level, action, details) {
  if (!reportSheet) return;
  const timestamp = new Date().toISOString();
  const row = [timestamp, level, action, details || ''];
  reportSheet.appendRow(row);
}

function normalizeHeader(h) {
  return h.toLowerCase().replace(/[\s_\-]/g, '').replace(/[^a-z0-9€]/g, '');
}

function headerSimilarity(h1, h2) {
  const t1 = normalizeHeader(h1).split('');
  const t2 = normalizeHeader(h2).split('');
  const intersection = t1.filter(c => t2.includes(c)).length;
  const union = Math.max(t1.length, t2.length);
  return union === 0 ? 0 : intersection / union;
}

function findCanonicalSheet(headers) {
  let bestMatch = null;
  let bestScore = 0;
  for (const canonical in SCHEMA) {
    const canonicalHeaders = SCHEMA[canonical];
    let score = 0;
    for (const h of headers) {
      for (const ch of canonicalHeaders) {
        const sim = headerSimilarity(h, ch);
        if (sim > 0.8) score += sim;
      }
    }
    const avgScore = score / Math.max(headers.length, canonicalHeaders.length);
    if (avgScore > bestScore && avgScore >= 0.8) {
      bestScore = avgScore;
      bestMatch = canonical;
    }
  }
  return bestMatch;
}

function scanAndNormalizeSheets(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const archiveTimestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmm');
  let archiveSheet = null;
  
  for (const sheet of sheets) {
    const name = sheet.getName();
    if (name === 'MIGRATION_REPORT' || CANONICAL_SHEETS.includes(name)) continue;
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const canonical = findCanonicalSheet(headers);
    
    if (canonical) {
      logReport(report, 'INFO', 'Rename sheet', name + ' → ' + canonical);
      if (!DRY_RUN) {
        const existing = ss.getSheetByName(canonical);
        if (existing && existing !== sheet) {
          if (ARCHIVE_BEFORE_DELETE) {
            if (!archiveSheet) archiveSheet = ss.insertSheet('Archive_' + archiveTimestamp);
            archiveSheet.appendRow(['Archived from: ' + existing.getName()]);
            const data = existing.getDataRange().getValues();
            archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, data.length, data[0].length).setValues(data);
          }
          ss.deleteSheet(existing);
        }
        sheet.setName(canonical);
      }
    } else {
      logReport(report, 'WARN', 'Delete unknown sheet', name + ' (no match ≥0.80)');
      if (!DRY_RUN) {
        if (ARCHIVE_BEFORE_DELETE) {
          if (!archiveSheet) archiveSheet = ss.insertSheet('Archive_' + archiveTimestamp);
          archiveSheet.appendRow(['Archived sheet: ' + name]);
          const data = sheet.getDataRange().getValues();
          archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, data.length, data[0].length).setValues(data);
        }
        ss.deleteSheet(sheet);
      }
    }
  }
  
  for (const canonical of CANONICAL_SHEETS) {
    if (!ss.getSheetByName(canonical)) {
      logReport(report, 'INFO', 'Create missing sheet', canonical);
      if (!DRY_RUN) {
        const newSheet = ss.insertSheet(canonical);
        newSheet.getRange(1, 1, 1, SCHEMA[canonical].length).setValues([SCHEMA[canonical]]);
        formatHeaderRow(newSheet);
      }
    }
  }
}

function reconcileAllHeaders(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  for (const canonical of CANONICAL_SHEETS) {
    const sheet = ss.getSheetByName(canonical);
    if (!sheet) continue;
    reconcileHeaders(sheet, canonical, report);
  }
}

function reconcileHeaders(sheet, canonical, report) {
  const expectedHeaders = SCHEMA[canonical];
  const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const normalized = currentHeaders.map(h => {
    const norm = normalizeHeader(h);
    for (const syn in SYNONYMS) {
      if (normalizeHeader(syn) === norm) return SYNONYMS[syn];
    }
    for (const exp of expectedHeaders) {
      if (headerSimilarity(h, exp) >= 0.8) return exp;
    }
    return h;
  });
  
  const missing = expectedHeaders.filter(h => !normalized.includes(h));
  const extra = normalized.filter((h, i) => !expectedHeaders.includes(h) && currentHeaders[i]);
  
  if (missing.length > 0 || extra.length > 0) {
    logReport(report, 'INFO', 'Reconcile headers: ' + canonical, 'Missing: ' + missing.join(', ') + ' | Extra: ' + extra.join(', '));
  }
  
  if (!DRY_RUN && (missing.length > 0 || extra.length > 0 || normalized.join() !== expectedHeaders.join())) {
    const newHeaders = [...expectedHeaders];
    sheet.getRange(1, 1, 1, newHeaders.length).setValues([newHeaders]);
    if (sheet.getLastColumn() > newHeaders.length) {
      sheet.deleteColumns(newHeaders.length + 1, sheet.getLastColumn() - newHeaders.length);
    }
    formatHeaderRow(sheet);
  }
}

function formatHeaderRow(sheet) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  const headerRange = sheet.getRange(1, 1, 1, lastCol);
  headerRange.setFontWeight('bold').setBackground('#4a86e8').setFontColor('white').setWrap(false);
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 28);
  for (let i = 1; i <= lastCol; i++) {
    sheet.setColumnWidth(i, 150);
  }
}

function seedDefaults(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  seedSettings(ss, report);
  seedLineTargets(ss, report);
  seedChannels(ss, report);
  seedPartnerTiers(ss, report);
  seedQuantityDiscounts(ss, report);
  seedOrderDiscounts(ss, report);
  seedBoxes(ss, report);
  seedLoyaltyGift(ss, report);
  seedAmazonSizeTiers(ss, report);
  seedREADME(ss, report);
}

function seedSettings(ss, report) {
  const sheet = ss.getSheetByName('Settings');
  if (!sheet || sheet.getLastRow() > 1) return;
  logReport(report, 'INFO', 'Seed Settings');
  if (DRY_RUN) return;
  const data = [
    ['VAT', 0.19, 'German VAT rate'],
    ['fx_buffer_pct', 0.03, 'Currency buffer'],
    ['target_post_channel_margin', 0.38, 'Target margin post-channel'],
    ['returns_pct', 0.02, 'Expected returns %'],
    ['payment_fee_pct', 0.025, 'Payment processing fee'],
    ['consumer_round_to', 0.99, 'Consumer price rounding'],
    ['loyalty_points_per_eur', 1, 'Loyalty points per €'],
    ['loyalty_point_value_eur', 0.01, 'Loyalty point value'],
    ['loyalty_expected_redemption', 0.70, 'Expected redemption rate'],
    ['loyalty_cost_pct', 0.007, 'Loyalty cost as %'],
    ['avg_units_per_order_default', 1.8, 'Default avg units/order']
  ];
  sheet.getRange(2, 1, data.length, 3).setValues(data);
}

function seedLineTargets(ss, report) {
  const sheet = ss.getSheetByName('LineTargets');
  if (!sheet || sheet.getLastRow() > 1) return;
  logReport(report, 'INFO', 'Seed LineTargets');
  if (DRY_RUN) return;
  const data = [
    ['Premium', 0.75, 2.50, 0.11],
    ['Skin', 0.75, 2.50, 0.11],
    ['Professional', 0.62, 2.40, 0.09],
    ['Basic', 0.50, 2.10, 0.07],
    ['Tools', 0.48, 1.80, 0.05]
  ];
  sheet.getRange(2, 1, data.length, 4).setValues(data);
}

function seedChannels(ss, report) {
  const sheet = ss.getSheetByName('Channels');
  if (!sheet || sheet.getLastRow() > 1) return;
  logReport(report, 'INFO', 'Seed Channels');
  if (DRY_RUN) return;
  const data = [
    ['OwnStore', 0, 0, 0, 0, 0, 1, 0.11, 0.11, 0.09, 0.07, 0.05, 1.8],
    ['Amazon_FBM', 0.08, 0.15, 0.30, 0, 0.35, 1, 0.08, 0.08, 0.07, 0.06, 0.04, 1.8],
    ['Amazon_FBA', 0.08, 0.15, 0.30, 0, 0, 1, 0.08, 0.08, 0.07, 0.06, 0.04, 1.8]
  ];
  sheet.getRange(2, 1, data.length, 13).setValues(data);
}

function seedPartnerTiers(ss, report) {
  const sheet = ss.getSheetByName('PartnerTiers');
  if (!sheet || sheet.getLastRow() > 1) return;
  logReport(report, 'INFO', 'Seed PartnerTiers');
  if (DRY_RUN) return;
  const data = [
    ['Partner', 0.25, 0.35, 0, 0],
    ['Sales Rep', 0.25, 0.35, 0, 0.05],
    ['Stand', 0.30, 0.40, 0, 0.05],
    ['Dealer Basic', 0.40, 0.50, 0, 0],
    ['Dealer Plus', 0.50, 0.55, 0, 0],
    ['Distributor', 0.60, 0.60, 0, 0]
  ];
  sheet.getRange(2, 1, data.length, 5).setValues(data);
}

function seedQuantityDiscounts(ss, report) {
  const sheet = ss.getSheetByName('QuantityDiscounts');
  if (!sheet || sheet.getLastRow() > 1) return;
  logReport(report, 'INFO', 'Seed QuantityDiscounts');
  if (DRY_RUN) return;
  const data = [
    [6, 11, 0.02, 'All except Distributor'],
    [12, 23, 0.04, 'All except Distributor'],
    [24, 47, 0.07, 'All except Distributor'],
    [48, 999999, 0.10, 'All except Distributor']
  ];
  sheet.getRange(2, 1, data.length, 4).setValues(data);
}

function seedOrderDiscounts(ss, report) {
  const sheet = ss.getSheetByName('OrderDiscounts');
  if (!sheet || sheet.getLastRow() > 1) return;
  logReport(report, 'INFO', 'Seed OrderDiscounts');
  if (DRY_RUN) return;
  const data = [
    [1000, 0.02],
    [3000, 0.03],
    [6000, 0.05]
  ];
  sheet.getRange(2, 1, data.length, 2).setValues(data);
}

function seedBoxes(ss, report) {
  const sheet = ss.getSheetByName('Boxes');
  if (!sheet || sheet.getLastRow() > 1) return;
  logReport(report, 'INFO', 'Seed Boxes');
  if (DRY_RUN) return;
  const data = [
    ['S', 'Small box', 0.42, 2],
    ['M', 'Medium box', 0.55, 4],
    ['L', 'Large box', 0.75, 6]
  ];
  sheet.getRange(2, 1, data.length, 4).setValues(data);
}

function seedLoyaltyGift(ss, report) {
  const sheet = ss.getSheetByName('LoyaltyGift');
  if (!sheet || sheet.getLastRow() > 1) return;
  logReport(report, 'INFO', 'Seed LoyaltyGift');
  if (DRY_RUN) return;
  const data = [
    ['B2C', 1, 0.01, 0.70, 0.007]
  ];
  sheet.getRange(2, 1, data.length, 5).setValues(data);
}

function seedAmazonSizeTiers(ss, report) {
  const sheet = ss.getSheetByName('AmazonSizeTiers');
  if (!sheet || sheet.getLastRow() > 1) return;
  logReport(report, 'INFO', 'Seed AmazonSizeTiers (sample)');
  if (DRY_RUN) return;
  const data = [
    ['Std_Parcel_S', 3.00, 0.10, 0.20, 0.30, 0.02],
    ['Std_Parcel_M', 3.50, 0.15, 0.25, 0.30, 0.02],
    ['Std_Parcel_L', 4.00, 0.20, 0.30, 0.30, 0.02]
  ];
  sheet.getRange(2, 1, data.length, 6).setValues(data);
}

function seedREADME(ss, report) {
  const sheet = ss.getSheetByName('README');
  if (!sheet || sheet.getLastRow() > 1) return;
  logReport(report, 'INFO', 'Seed README');
  if (DRY_RUN) return;
  sheet.getRange('A2').setValue('HAIROTICMEN Trading OS V2.2\n\nRun order:\n1) Setup (Scan, Normalize, Repair)\n2) Fill Products data\n3) Refresh Formulas\n4) Build Final Price List\n5) Rebuild KPIs\n6) Protect Formula Columns');
}

function injectFormulas(report) {
  logReport(report, 'INFO', 'Injecting formulas into Products');
  injectProductFormulas(report);
}

function injectProductFormulas(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Products');
  if (!sheet) return;
  
  const lastRow = Math.max(sheet.getLastRow(), 2);
  const targetRow = Math.min(lastRow + MAX_ROWS, 5001);
  
  if (DRY_RUN) {
    logReport(report, 'DRY_RUN', 'Would inject formulas rows 2:' + targetRow);
    return;
  }
  
  const headers = SCHEMA.Products;
  const colIdx = {};
  headers.forEach((h, i) => { colIdx[h] = i + 1; });
  
  for (let row = 2; row <= targetRow; row++) {
    const formulas = [
      ['FactoryPriceUnit_Final', `=IF(ISBLANK(J${row}),IF(ISBLANK(I${row}),0,I${row}/G${row}),J${row})`],
      ['FullCost_Unit', `=L${row}+K${row}+M${row}+N${row}+O${row}+P${row}+Q${row}+R${row}`],
      ['Floor_Multiplier', `=IFERROR(VLOOKUP(E${row},LineTargets!A:C,3,0),2.0)`],
      ['Floor_B2C_Net', `=S${row}*T${row}`],
      ['Target_GM_UVP', `=IFERROR(VLOOKUP(E${row},LineTargets!A:B,2,0),0.50)`],
      ['UVP_Net', `=IF(ISBLANK(W${row}),IF(V${row}=0,0,S${row}/(1-V${row})),W${row}/(1+VLOOKUP("VAT",Settings!A:B,2,0)))`],
      ['EndUser_Inc', `=X${row}*(1+VLOOKUP("VAT",Settings!A:B,2,0))`],
      ['UVP_NonBinding_Inc', `=ROUNDDOWN(Y${row},0)+VLOOKUP("consumer_round_to",Settings!A:B,2,0)`],
      ['UVP_vs_Floor_Flag', `=IF(X${row}<U${row},"RAISE_UVP","OK")`],
      ['Grundpreis_Net_€/100ml', `=IF(AB${row}=0,0,X${row}/(AB${row}/100))`],
      ['Grundpreis_Inc_€/100ml', `=IF(AB${row}=0,0,Z${row}/(AB${row}/100))`],
      ['AvgUnitsPerOrder', `=IFERROR(VLOOKUP(AT${row},Channels!A:M,13,0),VLOOKUP("avg_units_per_order_default",Settings!A:B,2,0))`],
      ['Ad_Pct', `=IFERROR(VLOOKUP(AT${row},Channels!A:M,IF(E${row}="Premium",8,IF(E${row}="Skin",9,IF(E${row}="Professional",10,IF(E${row}="Basic",11,12)))),0),IFERROR(VLOOKUP(E${row},LineTargets!A:D,4,0),0.07))`],
      ['B2C_BoxCost_per_unit', `=IFERROR(VLOOKUP(C${row},Boxes!A:C,3,0),0.50)/AE${row}`],
      ['B2C_Gift_Cost_Unit', `=0`],
      ['B2C_ShippingBox_Unit', `=0`],
      ['MinInc_Own_.99', `=ROUNDDOWN((S${row}+AG${row}+AH${row}+AI${row})/(1-VLOOKUP("target_post_channel_margin",Settings!A:B,2,0)-VLOOKUP("returns_pct",Settings!A:B,2,0)-VLOOKUP("payment_fee_pct",Settings!A:B,2,0)-VLOOKUP("loyalty_cost_pct",Settings!A:B,2,0)-AF${row})*(1+VLOOKUP("VAT",Settings!A:B,2,0)),0)+VLOOKUP("consumer_round_to",Settings!A:B,2,0)`],
      ['MinInc_Own', `=(S${row}+AG${row}+AH${row}+AI${row})/(1-VLOOKUP("target_post_channel_margin",Settings!A:B,2,0)-VLOOKUP("returns_pct",Settings!A:B,2,0)-VLOOKUP("payment_fee_pct",Settings!A:B,2,0)-VLOOKUP("loyalty_cost_pct",Settings!A:B,2,0)-AF${row})*(1+VLOOKUP("VAT",Settings!A:B,2,0))`],
      ['Recommended_UVP_Net_TargetGM', `=IF(V${row}=0,0,S${row}/(1-V${row}))`],
      ['Payment_Fee_Net', `=X${row}*VLOOKUP("payment_fee_pct",Settings!A:B,2,0)`],
      ['Payment_Fee_Pct_Blended', `=VLOOKUP("payment_fee_pct",Settings!A:B,2,0)`],
      ['Returns_Cost_Net', `=X${row}*VLOOKUP("returns_pct",Settings!A:B,2,0)`],
      ['Returns_Pct', `=VLOOKUP("returns_pct",Settings!A:B,2,0)`],
      ['Loyalty_Cost_Net', `=X${row}*VLOOKUP("loyalty_cost_pct",Settings!A:B,2,0)`],
      ['Loyalty_Pct', `=VLOOKUP("loyalty_cost_pct",Settings!A:B,2,0)`],
      ['Ad_Cost_Net', `=X${row}*AF${row}`],
      ['Ad_Pct_Effective', `=AF${row}`],
      ['GM_at_Rec_UVP_Net', `=AL${row}-S${row}-AM${row}-AO${row}-AQ${row}-AS${row}`],
      ['GM_at_Rec_UVP_Pct', `=IF(AL${row}=0,0,AU${row}/AL${row})`],
      ['Channel_Type', `="OwnStore"`],
      ['Referral_Fee_Net', `=IF(AT${row}="",0,IF(Z${row}<=10,Z${row}*VLOOKUP(AT${row},Channels!A:C,2,0),MAX(Z${row}*VLOOKUP(AT${row},Channels!A:D,3,0),VLOOKUP(AT${row},Channels!A:D,4,0))))`],
      ['Platform_Fee_Net', `=X${row}*IFERROR(VLOOKUP(AT${row},Channels!A:E,5,0),0)`],
      ['Label_Fee_Net', `=IFERROR(VLOOKUP(AT${row},Channels!A:F,6,0),0)`],
      ['FBA_PickPack', `=IF(AT${row}="Amazon_FBA",IFERROR(VLOOKUP(BC${row},AmazonSizeTiers!A:B,2,0),0),0)`],
      ['FBA_WeightSurcharge', `=IF(AT${row}="Amazon_FBA",IFERROR(VLOOKUP(BC${row},AmazonSizeTiers!A:C,3,0),0),0)`],
      ['FBA_Storage', `=IF(AT${row}="Amazon_FBA",IFERROR(VLOOKUP(BC${row},AmazonSizeTiers!A:D,4,0),0),0)`],
      ['FBA_LabelPrep', `=IF(AT${row}="Amazon_FBA",IFERROR(VLOOKUP(BC${row},AmazonSizeTiers!A:E,5,0),0),0)`],
      ['FBA_Returns', `=IF(AT${row}="Amazon_FBA",X${row}*IFERROR(VLOOKUP(BC${row},AmazonSizeTiers!A:F,6,0),0.02),0)`],
      ['FBA_TotalFee', `=AY${row}+AZ${row}+BA${row}+BB${row}+BC${row}`],
      ['Post_Channel_Margin_Net', `=X${row}-S${row}-AM${row}-AO${row}-AQ${row}-AS${row}-AW${row}-AX${row}-AY${row}-BD${row}`],
      ['Post_Channel_Margin_Pct', `=IF(X${row}=0,0,BE${row}/X${row})`],
      ['MinInc_FBM', `=(S${row}+AG${row}+AH${row}+AI${row}+AX${row}+AY${row})/(1-VLOOKUP("target_post_channel_margin",Settings!A:B,2,0)-VLOOKUP("returns_pct",Settings!A:B,2,0)-VLOOKUP("payment_fee_pct",Settings!A:B,2,0)-VLOOKUP("loyalty_cost_pct",Settings!A:B,2,0)-AF${row})*(1+VLOOKUP("VAT",Settings!A:B,2,0))`],
      ['MinInc_FBM_.99', `=ROUNDDOWN(BG${row},0)+VLOOKUP("consumer_round_to",Settings!A:B,2,0)`],
      ['MinInc_FBA', `=(S${row}+AG${row}+AH${row}+AI${row}+AX${row}+AY${row}+BD${row})/(1-VLOOKUP("target_post_channel_margin",Settings!A:B,2,0)-VLOOKUP("returns_pct",Settings!A:B,2,0)-VLOOKUP("payment_fee_pct",Settings!A:B,2,0)-VLOOKUP("loyalty_cost_pct",Settings!A:B,2,0)-AF${row})*(1+VLOOKUP("VAT",Settings!A:B,2,0))`],
      ['MinInc_FBA_.99', `=ROUNDDOWN(BI${row},0)+VLOOKUP("consumer_round_to",Settings!A:B,2,0)`]
    ];
    
    formulas.forEach(([header, formula]) => {
      if (colIdx[header]) {
        const col = colIdx[header];
        sheet.getRange(row, col).setFormula(formula);
      }
    });
  }
  
  sheet.getRange(2, colIdx['FactoryPriceUnit_Final'], targetRow - 1, 1).setNumberFormat('€#,##0.00');
  sheet.getRange(2, colIdx['FullCost_Unit'], targetRow - 1, 1).setNumberFormat('€#,##0.00');
  sheet.getRange(2, colIdx['Floor_B2C_Net'], targetRow - 1, 1).setNumberFormat('€#,##0.00');
  sheet.getRange(2, colIdx['UVP_Net'], targetRow - 1, 1).setNumberFormat('€#,##0.00');
  sheet.getRange(2, colIdx['Target_GM_UVP'], targetRow - 1, 1).setNumberFormat('0.00%');
  sheet.getRange(2, colIdx['Ad_Pct'], targetRow - 1, 1).setNumberFormat('0.00%');
  
  logReport(report, 'SUCCESS', 'Formulas injected', 'Rows 2:' + targetRow);
}

function buildFinalPriceListImpl(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const products = ss.getSheetByName('Products');
  const partners = ss.getSheetByName('PartnerTiers');
  const finalSheet = ss.getSheetByName('FinalPriceList');
  
  if (!products || !partners || !finalSheet) {
    logReport(report, 'ERROR', 'Missing required sheets');
    return;
  }
  
  const prodData = products.getDataRange().getValues();
  const partnerData = partners.getDataRange().getValues();
  
  const roles = {};
  for (let i = 1; i < partnerData.length; i++) {
    const [role, disc, cap, minAdd] = partnerData[i];
    roles[role] = { disc, cap, minAdd };
  }
  
  const output = [SCHEMA.FinalPriceList];
  
  for (let i = 1; i < prodData.length; i++) {
    const [ean, item, , , line] = prodData[i];
    if (!ean) continue;
    
    const uvpNet = prodData[i][23] || 0;
    const endUserInc = prodData[i][25] || 0;
    const floorNet = prodData[i][20] || 0;
    const fullCost = prodData[i][18] || 0;
    
    const row = [ean, item, line, uvpNet, endUserInc, floorNet];
    
    ['Partner', 'SalesRep', 'StandPartner', 'DealerBasic', 'DealerPlus', 'Distributor'].forEach(role => {
      const roleName = role === 'SalesRep' ? 'Sales Rep' : (role === 'StandPartner' ? 'Stand' : (role === 'DealerBasic' ? 'Dealer Basic' : (role === 'DealerPlus' ? 'Dealer Plus' : role)));
      const r = roles[roleName];
      if (!r) {
        row.push(uvpNet);
        return;
      }
      const discounted = uvpNet * (1 - r.disc);
      const capped = uvpNet * (1 - r.cap);
      const minPrice = fullCost + r.minAdd;
      const finalPrice = Math.max(discounted, capped, floorNet, minPrice);
      row.push(finalPrice);
    });
    
    output.push(row);
  }
  
  if (!DRY_RUN) {
    finalSheet.clear();
    finalSheet.getRange(1, 1, output.length, output[0].length).setValues(output);
    formatHeaderRow(finalSheet);
    finalSheet.getRange(2, 4, output.length - 1, 8).setNumberFormat('€#,##0.00');
  }
  
  logReport(report, 'SUCCESS', 'FinalPriceList built', output.length - 1 + ' products');
}

function buildKPIs(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const products = ss.getSheetByName('Products');
  const kpisSheet = ss.getSheetByName('KPIs');
  
  if (!products || !kpisSheet) return;
  
  const data = products.getDataRange().getValues();
  let ownOK = 0, fbmOK = 0, fbaOK = 0, uvpFloorOK = 0;
  const uvpNets = [], fullCosts = [];
  
  for (let i = 1; i < data.length; i++) {
    const uvpInc = data[i][25];
    const minOwn = data[i][39];
    const minFBM = data[i][47];
    const minFBA = data[i][49];
    const uvpNet = data[i][23];
    const floorNet = data[i][20];
    const fullCost = data[i][18];
    
    if (uvpInc && minOwn && uvpInc >= minOwn) ownOK++;
    if (uvpInc && minFBM && uvpInc >= minFBM) fbmOK++;
    if (uvpInc && minFBA && uvpInc >= minFBA) fbaOK++;
    if (uvpNet && floorNet && uvpNet >= floorNet) uvpFloorOK++;
    if (uvpNet) uvpNets.push(uvpNet);
    if (fullCost) fullCosts.push(fullCost);
  }
  
  const total = data.length - 1;
  const ownCov = total > 0 ? (ownOK / total * 100).toFixed(1) + '%' : '0%';
  const fbmCov = total > 0 ? (fbmOK / total * 100).toFixed(1) + '%' : '0%';
  const fbaCov = total > 0 ? (fbaOK / total * 100).toFixed(1) + '%' : '0%';
  const uvpFloorCov = total > 0 ? (uvpFloorOK / total * 100).toFixed(1) + '%' : '0%';
  
  const medianUVP = uvpNets.length > 0 ? median(uvpNets).toFixed(2) : '0';
  const medianCost = fullCosts.length > 0 ? median(fullCosts).toFixed(2) : '0';
  
  const kpis = [
    ['Metric', 'Value', 'Notes'],
    ['OwnStore Guardrail Coverage', ownCov, ownOK + ' of ' + total],
    ['Amazon FBM Coverage', fbmCov, fbmOK + ' of ' + total],
    ['Amazon FBA Coverage', fbaCov, fbaOK + ' of ' + total],
    ['UVP vs Floor OK', uvpFloorCov, uvpFloorOK + ' of ' + total],
    ['Median UVP Net', '€' + medianUVP, ''],
    ['Median Full Cost', '€' + medianCost, '']
  ];
  
  if (!DRY_RUN) {
    kpisSheet.clear();
    kpisSheet.getRange(1, 1, kpis.length, 3).setValues(kpis);
    formatHeaderRow(kpisSheet);
  }
  
  logReport(report, 'SUCCESS', 'KPIs rebuilt', kpis.length - 1 + ' metrics');
}

function median(arr) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function setupValidations(report) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const products = ss.getSheetByName('Products');
  if (!products) return;
  
  logReport(report, 'INFO', 'Setting up data validations');
  if (DRY_RUN) return;
  
  const lineTargets = ss.getSheetByName('LineTargets');
  const boxes = ss.getSheetByName('Boxes');
  const channels = ss.getSheetByName('Channels');
  const tiers = ss.getSheetByName('AmazonSizeTiers');
  
  if (lineTargets && lineTargets.getLastRow() > 1) {
    const lineRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(lineTargets.getRange('A2:A'), true)
      .build();
    products.getRange('E2:E5000').setDataValidation(lineRule);
  }
  
  if (boxes && boxes.getLastRow() > 1) {
    const boxRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(boxes.getRange('A2:A'), true)
      .build();
    products.getRange('C2:C5000').setDataValidation(boxRule);
  }
  
  if (channels && channels.getLastRow() > 1) {
    const channelRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(channels.getRange('A2:A'), true)
      .build();
    products.getRange('AT2:AT5000').setDataValidation(channelRule);
  }
  
  if (tiers && tiers.getLastRow() > 1) {
    const tierRule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(tiers.getRange('A2:A'), true)
      .build();
    products.getRange('BC2:BC5000').setDataValidation(tierRule);
  }
  
  const settings = ss.getSheetByName('Settings');
  if (settings) {
    const data = settings.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const key = data[i][0];
      if (key) {
        const rangeName = 'Setting_' + key.replace(/[^a-zA-Z0-9_]/g, '_');
        try {
          ss.setNamedRange(rangeName, settings.getRange(i + 1, 2));
        } catch (e) {
          // ignore if name already exists
        }
      }
    }
  }
  
  logReport(report, 'SUCCESS', 'Validations set up');
}

function protectFormulaColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const products = ss.getSheetByName('Products');
  if (!products) return;
  
  const formulaCols = [12, 19, 20, 21, 24, 25, 26, 27, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55];
  
  const protections = products.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  protections.forEach(p => p.remove());
  
  formulaCols.forEach(col => {
    const range = products.getRange(2, col, MAX_ROWS);
    const protection = range.protect().setDescription('Formula column (auto-generated)');
    protection.setWarningOnly(true);
  });
  
  SpreadsheetApp.getActiveSpreadsheet().toast('Formula columns protected (warning-only)', 'HAIROTICMEN', 3);
}
