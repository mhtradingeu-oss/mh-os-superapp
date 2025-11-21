# MH Trading OS — Setup & Deployment Guide

**Version**: 1.0.0  
**Date**: November 9, 2025  
**Status**: Production-Ready for Core Features

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Initial Setup](#initial-setup)
4. [Google Sheets Configuration](#google-sheets-configuration)
5. [Environment Variables](#environment-variables)
6. [Running the Application](#running-the-application)
7. [Bootstrap Process](#bootstrap-process)
8. [Feature Configuration](#feature-configuration)
9. [Deployment to Production](#deployment-to-production)
10. [Troubleshooting](#troubleshooting)
11. [Next Steps](#next-steps)

---

## Overview

MH Trading OS is a comprehensive trading operations platform that manages the complete cycle from factory costs to sales, shipping, and commissions. The system uses **Google Sheets as the authoritative data source**, making it easy to manage, audit, and backup your data.

**Key Capabilities:**
- Pricing Studio with tier-based calculations
- Partner & Stand Center with QR codes
- Sales Desk (Quotes → Orders → Invoices)
- Logistics (DHL shipping, manifests)
- Smart Assistant (AI-powered command palette)
- Multi-language support (Arabic RTL, English)

---

## Prerequisites

### 1. Google Account
- You need a Google account with access to Google Sheets
- Google Sheets API must be enabled for your project

### 2. Replit Account
- This application is designed to run on Replit
- Google Sheets integration is already configured via Replit Connector

### 3. Optional Services
- **Email**: Brevo (or any SMTP provider) for notifications
- **AI Features**: OpenAI API key (via Replit AI Integrations)
- **E-commerce**: WooCommerce and/or Odoo credentials

---

## Initial Setup

### Step 1: Clone/Fork the Project

If you're starting fresh on Replit:
1. Fork this Repl
2. Wait for dependencies to install automatically
3. The workflow "Start application" will run automatically

### Step 2: Create Google Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a **new blank spreadsheet**
3. Name it: `MH Trading OS - Production Data`
4. **Copy the Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_HERE/edit
   ```
5. Add this to your Replit Secrets as `SHEETS_SPREADSHEET_ID`

### Step 3: Configure Google Sheets Connector

The application uses Replit's Google Sheets connector:

1. In Replit, the connector should already be installed
2. Go to the **Integrations** tab in your Repl
3. Find **Google Sheets** connector
4. Click **Connect** and authorize with your Google account
5. The connector will automatically provide credentials

**No manual API key setup needed!** The connector handles OAuth automatically.

---

## Google Sheets Configuration

### Option A: Automatic Bootstrap (Recommended)

The easiest way to set up all required sheets:

1. Start the application
2. Navigate to `/admin` page
3. Click **"Run Full Bootstrap"** button
4. Wait for the process to complete (~30 seconds)
5. Check your Google Spreadsheet - you should now see **29 new tabs**

The bootstrap process will:
- ✅ Create all 29 required sheets with correct headers
- ✅ Set 7 critical settings (currency, VAT, AI model, etc.)
- ✅ Log all operations to `OS_Logs` and `OS_Health`
- ✅ Skip existing sheets (idempotent - safe to re-run)

### Option B: Manual Setup (Advanced)

If you prefer manual control or bootstrap fails, see [Manual Sheets Setup](#manual-sheets-setup) section below.

---

## Environment Variables

### Required Variables

Add these to Replit Secrets:

```bash
# Google Sheets (REQUIRED)
SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here

# Session Security (REQUIRED)
SESSION_SECRET=random_string_minimum_32_characters
```

### Optional Variables (Recommended)

```bash
# Application Base URL
APP_BASE_URL=https://your-repl-name.your-username.repl.co

# Environment Mode
ENV=production  # or 'staging' for dry-run mode

# Email Notifications (Brevo SMTP)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_email
SMTP_PASS=your_brevo_api_key
EMAIL_FROM=noreply@yourdomain.com
EMAIL_BCC_LOG=admin@yourdomain.com  # receives copies of all emails
REPLY_TO=support@yourdomain.com

# OpenAI (for AI features)
# This is managed by Replit AI Integrations connector
# No manual setup needed if connector is installed
```

### Optional Variables (External Integrations)

```bash
# WooCommerce Integration
API_WOO_BASE=https://yourstore.com
API_WOO_KEY=ck_xxxxxxxxxxxx
API_WOO_SECRET=cs_xxxxxxxxxxxx

# Odoo Integration
API_ODOO_BASE=https://yourcompany.odoo.com
API_ODOO_DB=your_database_name
API_ODOO_USER=your_odoo_email
API_ODOO_PASS=your_odoo_password

# Google Places API (for address autocomplete)
API_PLACES_KEY=your_google_places_api_key
```

---

## Running the Application

### Development Mode

The application runs automatically on Replit:

1. The workflow **"Start application"** starts automatically
2. Opens at `http://0.0.0.0:5000`
3. Hot-reload enabled for development
4. Logs visible in the Console tab

**Command:** `npm run dev`

### Access the Application

Once running, you can access:
- **Main App**: Click the webview button in Replit
- **Direct URL**: `https://your-repl-name.your-username.repl.co`

### Default Pages

- `/` - Dashboard (home page)
- `/pricing` - Pricing Studio
- `/partners` - Partner & Stand Center
- `/sales` - Sales Desk
- `/operations` - Logistics & Operations
- `/ai` - AI Hub
- `/admin` - Admin & Settings

---

## Bootstrap Process

### What Bootstrap Does

The bootstrap system automatically:

1. **Creates 29 Google Sheets** with correct headers:
   - Core: Settings, OS_Logs, OS_Health
   - Pricing: Pricing_Params, FinalPriceList, CompetitorPrices, MAP_Guardrails, Pricing_Suggestions
   - Partners: PartnerTiers, PartnerRegistry, AuthorizedAssortment
   - Stands: StandSites, Stand_Inventory, Stand_Refill_Plans, Stand_Visits, Stand_KPIs, StarterBundles, RefillPlans
   - Sales: Quotes, QuoteLines, Orders, OrderLines
   - Finance: Commission_Ledger, Loyalty_Ledger
   - Logistics: DHL_Rates, DHL_Tariffs, Shipments_DHL
   - AI: AI_Playbooks, AI_Tasks
   - Sync: Sync_Queue

2. **Sets Critical Settings** in the Settings sheet:
   - `HM_CURRENCY` = EUR
   - `VAT_Default_Pct` = 19
   - `HM_DRIVE_ROOT_ID` = (placeholder)
   - `AI_Default_Model` = gpt-4o-mini
   - `ENV` = (from environment variable)
   - `Pricing_Default_Margin_Pct` = 40
   - `Loyalty_Earn_Pct` = 1

3. **Logs Everything** to:
   - `OS_Logs` - detailed operation log
   - `OS_Health` - system health checks

### Running Bootstrap

**Via UI (Recommended):**
1. Go to `/admin` page
2. Click **"Run Full Bootstrap"** button
3. Wait for completion message
4. Refresh your Google Spreadsheet to see new tabs

**Via API:**
```bash
curl -X POST https://your-app-url/api/admin/bootstrap/run
```

**Safety:**
- ✅ Idempotent - safe to run multiple times
- ✅ Skips existing sheets
- ✅ Never deletes data
- ✅ All operations logged

### After Bootstrap

You should see:
- ✅ 29 new tabs in your Google Spreadsheet
- ✅ Settings sheet with 7+ key-value pairs
- ✅ OS_Logs sheet with bootstrap operations
- ✅ OS_Health sheet with timestamp

**Next:** Add seed data to key sheets (see [Seed Data](#seed-data) section)

---

## Seed Data

### Minimum Required Data

For the system to work properly, add these minimal records:

#### 1. PartnerTiers Sheet
Add 4 rows with tier definitions:
```
TierName    | Commission_Pct | Bonus_Multiplier | MinOrderQty | Notes
Basic       | 5              | 1.0              | 0           | Entry level
Plus        | 6              | 1.1              | 100         | Regular partners
Premium     | 7              | 1.2              | 500         | High volume
Distributor | 10             | 1.5              | 1000        | Wholesale
```

#### 2. Pricing_Params Sheet
Add 1 row with default parameters:
```
Default_Margin_Pct | Fulfillment_Cost_Per_Unit | Shipping_Cost_Per_Unit
40                 | 0.50                      | 1.20
```

#### 3. FinalPriceList Sheet
Add 1-2 test products:
```
SKU       | Description     | COGS | UVP   | MAP   | AutoPriceFlag
TEST-001  | Test Product 1  | 10.0 | 24.99 | 22.99 | TRUE
TEST-002  | Test Product 2  | 15.0 | 34.99 | 31.99 | FALSE
```

#### 4. DHL_Rates Sheet
Add sample shipping zones:
```
Zone | MinWeight | MaxWeight | Rate_EUR
DE   | 0         | 5         | 5.99
DE   | 5         | 10        | 8.99
EU1  | 0         | 5         | 12.99
INT  | 0         | 5         | 24.99
```

---

## Feature Configuration

### Feature Flags

The system automatically detects available integrations and enables features:

**Always Enabled:**
- Bootstrap system
- Pricing Studio
- Partners & Stands
- Sales Desk
- Logistics

**Conditionally Enabled (based on credentials):**
- `enableEmailNotifications` - if SMTP_HOST configured
- `enableAIFeatures` - if OpenAI key available
- `enableWooCommerce` - if WooCommerce credentials set
- `enableOdoo` - if Odoo credentials set
- `enableDHLShipping` - always enabled (uses rate tables)
- `enableDriveIntegration` - if Drive connector available

**Dry-Run Mode:**
- Enabled when `ENV=staging` or `ENV=development`
- External API calls are simulated (no real requests)
- Perfect for testing without affecting external systems

### Check Feature Status

**Via API:**
```bash
curl https://your-app-url/api/admin/feature-flags
```

**Response:**
```json
{
  "enableWooCommerce": false,
  "enableOdoo": false,
  "enableEmailNotifications": true,
  "enableAIFeatures": true,
  "enableDHLShipping": true,
  "enableDriveIntegration": false,
  "dryRunMode": false
}
```

---

## Deployment to Production

### Pre-Deployment Checklist

Before deploying to production:

- [ ] ✅ Bootstrap completed successfully
- [ ] ✅ All 29 sheets exist in Google Spreadsheet
- [ ] ✅ Settings sheet has required keys
- [ ] ✅ Seed data added (see [Seed Data](#seed-data))
- [ ] ✅ Environment variables set
- [ ] ✅ Email SMTP tested (if enabled)
- [ ] ✅ OpenAI integration tested (if enabled)
- [ ] ✅ Set `ENV=production` in secrets

### Replit Deployment

**Option 1: Replit Deployments (Recommended)**

1. Click the **Deploy** button in Replit
2. Choose **Production** deployment
3. Configure:
   - Type: Autoscale or Reserved VM
   - Region: Choose closest to your users
4. Click **Deploy**
5. Your app will be available at `https://your-app.replit.app`

**Option 2: Always-On Repl**

1. Enable **Always On** in your Repl settings
2. Your app stays running 24/7
3. Uses your Repl's default URL

### Post-Deployment Verification

After deployment:

1. **Health Check:**
   ```bash
   curl https://your-app.replit.app/api/admin/health
   ```
   Should return status 200 with integration statuses

2. **Test Bootstrap:**
   - Visit `/admin`
   - Verify bootstrap status
   - Check OS_Health sheet for recent entries

3. **Test Critical Flows:**
   - Create a test partner
   - Create a test quote
   - Convert quote to order
   - Generate invoice PDF
   - Check all operations logged in OS_Logs

4. **Monitor Logs:**
   - Check Replit console for errors
   - Review OS_Logs sheet for warnings
   - Monitor OS_Health for system status

---

## Troubleshooting

### Common Issues

#### 1. "Google Sheets API Error: 404"
**Problem:** Spreadsheet doesn't exist or ID is wrong  
**Solution:**
- Verify `SHEETS_SPREADSHEET_ID` in Replit Secrets
- Make sure you created the spreadsheet first
- Check spreadsheet sharing permissions

#### 2. "Bootstrap failed: Missing permissions"
**Problem:** Google Sheets connector not authorized  
**Solution:**
- Go to Integrations tab in Replit
- Reconnect Google Sheets connector
- Make sure you authorize with the correct Google account

#### 3. "Port 5000 already in use"
**Problem:** Previous server instance still running  
**Solution:**
- Stop the workflow in Replit
- Wait 10 seconds
- Restart the workflow

#### 4. "Email test failed"
**Problem:** SMTP credentials incorrect or missing  
**Solution:**
- Verify all SMTP_* variables in Replit Secrets
- Check Brevo dashboard for API key status

#### 5. "OpenAI features disabled"
**Problem:** OpenAI connector not configured  
**Solution:**
- Install Replit AI Integrations connector
- The system will auto-detect and enable AI features

### Debug Mode

Enable detailed logging:

1. Check `/api/admin/health` for integration status
2. Review `OS_Logs` sheet for error messages
3. Check Replit Console for server logs
4. Look at `OS_Health` sheet for system status

---

## Next Steps

### After Initial Setup

1. **Add Real Data:**
   - Import your product catalog to FinalPriceList
   - Add your partner database to PartnerRegistry
   - Set up stand locations in StandSites
   - Configure pricing parameters

2. **Customize Settings:**
   - Adjust default margins in Pricing_Params
   - Set your currency in Settings (HM_CURRENCY)
   - Configure VAT rate for your country
   - Set up partner tier commission rates

3. **Test Workflows:**
   - Create a test quote
   - Convert it to an order
   - Generate an invoice PDF
   - Create a shipping manifest
   - Test AI assistant commands (Ctrl+K)

4. **Configure Integrations:**
   - Set up email templates
   - Connect WooCommerce (if using)
   - Connect Odoo (if using)
   - Test external API integrations in dry-run mode first

### Recommended Workflow

**Week 1: Setup & Testing**
- Day 1: Bootstrap, verify all sheets created
- Day 2-3: Add seed data (products, partners, settings)
- Day 4-5: Test all major workflows end-to-end
- Day 6-7: Configure integrations, test email/AI

**Week 2: Soft Launch**
- Set `ENV=staging` for testing
- Use system with test data
- Identify any missing features

**Week 3: Production**
- Set `ENV=production`
- Import real data
- Train users on the system
- Monitor OS_Logs and OS_Health daily

---

## Manual Sheets Setup

If bootstrap fails or you prefer manual setup, create these 29 sheets with exact headers:

### Core Sheets (3)
1. **Settings**: SettingKey | SettingValue | Category | Notes
2. **OS_Logs**: Timestamp | Level | Source | Message | Details
3. **OS_Health**: Timestamp | Status | Message | Details

### Pricing Sheets (5)
4. **Pricing_Params**: (multiple columns for margins, costs, multipliers)
5. **FinalPriceList**: SKU | Description | COGS | UVP | MAP | AutoPriceFlag | (+ tier prices)
6. **CompetitorPrices**: SKU | Competitor | Price | URL | LastChecked
7. **MAP_Guardrails**: SKU | MAP_Floor | MAP_Ceiling | Violation_Count | LastViolation
8. **Pricing_Suggestions**: SKU | Suggested_UVP | Suggested_MAP | Reason | Confidence | CreatedAt

### Partner Sheets (3)
9. **PartnerTiers**: TierName | Commission_Pct | Bonus_Multiplier | MinOrderQty | Notes
10. **PartnerRegistry**: PartnerID | PartnerName | Tier | Email | Phone | Address | (+ more fields)
11. **AuthorizedAssortment**: PartnerID | SKU | Authorized | MaxOrderQty | Notes

### Stand Sheets (7)
12. **StandSites**: SiteID | SiteName | Address | GPS_Lat | GPS_Lng | Status | (+ more)
13. **Stand_Inventory**: SiteID | SKU | CurrentStock | MinStock | MaxStock | LastRestockDate
14. **Stand_Refill_Plans**: SiteID | RefillDate | Status | Notes
15. **Stand_Visits**: SiteID | VisitDate | CheckInTime | CheckOutTime | Notes
16. **Stand_KPIs**: SiteID | Period | Revenue | Units_Sold | Stockout_Days | Visit_Count
17. **StarterBundles**: BundleID | BundleName | SKUs | Quantities | TotalCost | Notes
18. **RefillPlans**: PlanID | SiteID | Frequency | SKUs | Quantities | Notes

### Sales Sheets (4)
19. **Quotes**: QuoteID | PartnerID | QuoteDate | Subtotal | Total | Status | Notes
20. **QuoteLines**: QuoteID | LineNum | SKU | Quantity | UnitPrice | Subtotal
21. **Orders**: OrderID | PartnerID | OrderDate | Total | Commission_Amt | Status | Notes
22. **OrderLines**: OrderID | LineNum | SKU | Quantity | UnitPrice | Subtotal

### Finance Sheets (2)
23. **Commission_Ledger**: PartnerID | OrderID | Commission_Amt | Tier | PaidDate | Status
24. **Loyalty_Ledger**: PartnerID | TransactionType | OrderID | Points_Delta | Points_Balance | TransactionDate

### Logistics Sheets (3)
25. **DHL_Rates**: Zone | MinWeight | MaxWeight | Rate_EUR
26. **DHL_Tariffs**: ServiceType | Zone | Surcharge_EUR
27. **Shipments_DHL**: ShipmentID | OrderID | Zone | Weight | Cost | Status | ShippedDate

### AI Sheets (2)
28. **AI_Playbooks**: PlaybookID | PlaybookName | AssistantRole | Prompt_Template | Variables | CreatedDate
29. **AI_Tasks**: TaskID | TaskType | InputData | Result | Status | CreatedAt | CompletedAt

### Sync Sheet (1)
30. **Sync_Queue**: QueueID | TargetSystem | Operation | EntityType | EntityID | Status | Retries

---

## Conclusion

You now have everything needed to deploy and run MH Trading OS in production!

**Quick Start Path:**
1. ✅ Create Google Spreadsheet
2. ✅ Set SHEETS_SPREADSHEET_ID in Replit Secrets
3. ✅ Run Bootstrap from Admin page
4. ✅ Add seed data (partners, products, settings)
5. ✅ Test workflows
6. ✅ Deploy to production

**Support:**
- Check `OS_Logs` sheet for issues
- Review this guide for troubleshooting
- Monitor `OS_Health` for system status

Good luck! 🚀
