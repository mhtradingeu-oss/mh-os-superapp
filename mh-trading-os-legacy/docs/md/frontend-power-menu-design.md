# Frontend Power Menu Structure

## 🎯 Overview

Organized navigation system with Tools, Admin, and Operations submenus for easy access to all system features.

---

## 📊 Menu Structure

### Main Navigation (Sidebar)

```
├── 🏠 Dashboard
├── 💰 Pricing
│   ├── Price List
│   ├── Pricing Studio
│   └── Bundles
├── 🏪 Sales
│   ├── Quotes
│   ├── Orders
│   └── Invoices
├── 🤝 Partners
│   ├── Registry
│   ├── Tiers
│   └── Territories
├── 📍 Stands
│   ├── Stand Center
│   ├── Inventory
│   └── Visits
├── 📦 Catalog
├── 📊 Reports
├── 🤖 AI Hub
├── ⚙️  Tools ◄── NEW POWER MENU
│   ├── 💰 Pricing Tools
│   ├── 🚚 Shipping Tools
│   ├── 🔗 QR Tools
│   └── 📤 Export Tools
├── 🔧 Admin ◄── NEW POWER MENU
│   ├── System Settings
│   ├── Health Monitor
│   ├── Sheet Manager
│   └── API Console
└── 🛠️  Operations ◄── NEW POWER MENU
    ├── DHL Shipping
    ├── Inventory Sync
    ├── Cron Jobs
    └── Backups
```

---

## 🎛️ Power Menu Details

### 1. Tools Menu

#### 💰 Pricing Tools
- **Calculate All Pricing**
  - Description: Run Pricing Engine V2.2 on all 89 products
  - Script: `pricing-master.ts`
  - Features: Dry-run mode, CSV export, change tracking
  
- **Analyze Coverage**
  - Description: Check pricing gaps and bundling recommendations
  - Script: `analyze-all-products-v22.ts`
  - Output: Coverage report, bundle suggestions
  
- **Fix Data Gaps**
  - Description: Auto-fill missing COGS, QRUrls, Factory prices
  - Script: `fix-pricing-gaps.ts --force`
  - Safety: Preview mode, selective fixes
  
- **Generate Report**
  - Description: Comprehensive pricing analysis
  - Script: `generate-pricing-report-sheet.ts`
  - Output: Multi-sheet report with KPIs

#### 🚚 Shipping Tools
- **Calculate Shipping**
  - Description: Run Unified Shipping V3 (all channels)
  - Script: `calculate-shipping-costs.ts`
  - Features: Smart defaults, batch API, per-channel costs
  
- **View DHL Rates**
  - Description: Browse current DHL pricing bands
  - Source: ShippingWeightBands sheet
  
- **Shipping Analytics**
  - Description: Average costs by channel, weight distribution
  - Charts: Cost breakdown, volume trends

#### 🔗 QR Tools
- **Generate All QR Codes**
  - Description: Create QR codes for all 89 products
  - Script: `generate-all-qr-codes.ts`
  - Output: PNG files + QRUrl column update
  
- **Update QR URLs**
  - Description: Refresh QRUrl column in FinalPriceList
  - Script: `update-qr-urls.ts`
  
- **Fix Malformed URLs**
  - Description: Repair broken QR links
  - Script: `fix-qr-urls.ts`
  - Validation: URL format, barcode presence

#### 📤 Export Tools
- **Export to CSV**
  - Sheets: FinalPriceList, Quotes, Orders, Partners
  - Format: UTF-8, Excel-compatible
  
- **Export to JSON**
  - Full data dump for backups
  - Structured format for API integration
  
- **Generate PDF Catalog**
  - Product catalog with images and prices
  - Multi-language support (EN/AR)

---

### 2. Admin Menu

#### System Settings
- **Environment Variables**
  - View/edit API keys (masked)
  - Update system parameters
  - Test connections
  
- **User Management**
  - Access levels
  - API tokens
  - Activity logs

#### Health Monitor
- **System Health**
  - Google Sheets API status
  - Database connections
  - Integration health
  
- **Performance Metrics**
  - API call quotas (60/min check)
  - Response times
  - Error rates
  
- **Data Integrity**
  - Row counts verification
  - Duplicate detection
  - Formula validation

#### Sheet Manager
- **View All Sheets** (92 sheets)
  - Schema viewer
  - Column definitions
  - Relationships
  
- **Bootstrap Sheets**
  - Run: `01-create-spreadsheet-structure.ts`
  - Initialize all 92 sheets
  - Validate headers
  
- **Validate Schema**
  - Check headers match REQUIRED_SHEETS
  - Detect missing columns
  - Find duplicates

#### API Console
- **Test Endpoints**
  - Manual API calls
  - Response inspection
  - Rate limit testing
  
- **Webhook Logs**
  - Recent webhook events
  - Payload inspector
  - Retry failed webhooks

---

### 3. Operations Menu

#### DHL Shipping
- **Rate Calculator**
  - Weight → DHL cost lookup
  - Volumetric weight calculator
  - Zone-based pricing
  
- **Shipping Labels**
  - Generate DHL labels
  - Batch label creation
  - Tracking integration

#### Inventory Sync
- **Stand Inventory**
  - Sync inventory from stands
  - Low stock alerts
  - Refill recommendations
  
- **Product Sync**
  - Import from WooCommerce
  - Export to Amazon
  - SKU mapping

#### Cron Jobs
- **Scheduled Tasks**
  - Daily pricing updates
  - Weekly reports
  - Monthly backups
  
- **Job Monitoring**
  - Last run timestamp
  - Success/failure status
  - Error logs

#### Backups
- **Auto Backup**
  - Schedule: Daily at 2 AM CET
  - Retention: 30 days
  - Storage: Drive _BACKUPS folder
  
- **Manual Backup**
  - One-click backup
  - Download as ZIP
  - Restore point creation

---

## 🎨 UI/UX Design

### Sidebar Menu Items
```tsx
// Tools submenu
{
  icon: <Wrench />,
  label: "Tools",
  badge: "16", // Total tools count
  children: [
    {
      icon: <DollarSign />,
      label: "Pricing Tools",
      badge: "5"
    },
    {
      icon: <Truck />,
      label: "Shipping Tools",
      badge: "3"
    },
    {
      icon: <QrCode />,
      label: "QR Tools",
      badge: "3"
    },
    {
      icon: <Download />,
      label: "Export Tools",
      badge: "3"
    }
  ]
}
```

### Tool Cards UI
- Card-based layout (grid)
- Each tool shows:
  - Icon
  - Title
  - Description
  - Status badge (Ready/Running/Error)
  - Last run timestamp
  - Run button
  - Settings cog (if configurable)

### Run Dialog
- Dry-run toggle
- Parameters (if any)
- Real-time progress
- Output logs (streaming)
- Cancel button
- Download results

---

## 📱 Mobile Responsive

### Collapsed Sidebar (< 768px)
- Hamburger menu
- Icons only
- Tooltips on hover
- Expandable submenus

### Tool Cards (< 768px)
- Single column
- Larger touch targets
- Simplified UI
- Bottom sheet for dialogs

---

## 🔒 Security

### Role-Based Access
- **Admin**: Full access to all menus
- **Manager**: Tools + Reports (read-only Admin)
- **Sales**: Sales + Partners only
- **Field Rep**: Stands + Catalog only

### Audit Trail
- Log all tool executions
- Track who ran what and when
- Parameter logging
- Result archival

---

## 🚀 Implementation Priority

### Phase 1 (Immediate)
1. ✅ Add Tools menu to sidebar
2. ✅ Pricing Tools page with 5 tools
3. ✅ Basic run dialog with logs

### Phase 2 (Week 1)
1. Shipping Tools page
2. QR Tools page
3. Admin menu skeleton
4. Health monitor basic view

### Phase 3 (Week 2)
1. Operations menu
2. Advanced admin features
3. Cron job scheduler
4. Backup manager

### Phase 4 (Future)
1. Visual query builder
2. Custom report generator
3. Workflow automation
4. Integration marketplace

---

## 📊 Analytics

Track tool usage:
- Most used tools
- Average execution time
- Success/failure rates
- User adoption metrics

---

**Design Status**: ✅ Ready for Implementation  
**Created**: November 16, 2025  
**Version**: 1.0
