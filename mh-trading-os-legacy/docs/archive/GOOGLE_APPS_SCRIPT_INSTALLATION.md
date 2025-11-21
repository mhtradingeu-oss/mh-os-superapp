# Google Apps Script Menu - Installation Guide

## 📦 What You'll Get

A comprehensive menu system in your Google Sheet with 80+ features organized into 8 main categories:

1. **💰 Pricing Studio** - Price calculations, MAP validation, auto-repricing
2. **📋 Sales Desk** - Quotes, invoices, orders, commissions
3. **🏪 Stand Center** - Inventory, refills, visits, performance
4. **🤖 AI Hub** - 4 AI assistants, job queue, guardrails
5. **📢 Marketing Suite** - SEO, Social Media, Google Ads
6. **👥 CRM & Leads** - Lead harvesting, scoring, territory assignment
7. **📄 Templates** - PDF layouts, email templates, multi-language
8. **⚡ Quick Actions** - Search, export, sync, refresh

---

## 🚀 Installation Steps

### Step 1: Open Google Apps Script Editor

1. Open your Google Sheet (ID: `1U5UP_9gPkB-8TVLPKxnG1Ey3Q2aChG2KvzjjnbcFsg0`)
2. Click **Extensions** in the menu bar
3. Click **Apps Script**
4. A new tab will open with the Apps Script editor

### Step 2: Clear Existing Code

1. If there's any existing code in the editor, select all and delete it
2. You should have a blank editor window

### Step 3: Paste the Menu Script

1. Open the file: `attached_assets/google-apps-script-menu.gs`
2. Copy the entire contents (Ctrl+A, Ctrl+C)
3. Paste into the Apps Script editor (Ctrl+V)

### Step 4: Update Configuration

**CRITICAL:** Update the API_BASE_URL in the CONFIG section:

```javascript
const CONFIG = {
  // Update this with your Replit deployment URL
  API_BASE_URL: 'https://your-replit-app.replit.dev',
  // ... rest of config
};
```

Replace `'https://your-replit-app.replit.dev'` with your actual deployed Replit app URL.

### Step 5: Save the Script

1. Click the **Save** icon (💾) or press Ctrl+S / Cmd+S
2. Give the project a name: "HAIROTICMEN OS Menu"
3. Click **Save**

### Step 6: Authorize the Script

1. Click the **Run** button (▶️) in the toolbar
2. Select the function `onOpen` from the dropdown
3. Click **Run**
4. A dialog will appear asking for authorization
5. Click **Review Permissions**
6. Select your Google account
7. Click **Advanced** → **Go to HAIROTICMEN OS Menu (unsafe)**
8. Click **Allow**

### Step 7: Refresh Your Google Sheet

1. Go back to your Google Sheet tab
2. Refresh the page (F5 or Cmd+R)
3. Wait a few seconds for the sheet to load

### Step 8: Verify Installation

You should now see **"🚀 HAIROTICMEN OS"** in the menu bar!

Click it to see all the submenus.

---

## 🎯 First Steps After Installation

### 1. Test the Menu

Click: **HAIROTICMEN OS** → **Admin & Settings** → **System Health Check**

This will verify your API connection is working.

### 2. Run Your First Pricing Calculation

Click: **HAIROTICMEN OS** → **Pricing Studio** → **Calculate All Prices**

This will calculate prices for all 89 products.

### 3. Explore AI Features

Click: **HAIROTICMEN OS** → **AI Hub** → **AI Guardrails Dashboard**

This shows pending AI-generated content requiring approval.

---

## 📋 Menu Structure

### 💰 Pricing Studio
- Calculate All Prices
- Auto-Reprice Products
- Validate MAP Compliance
- Price Optimization Report
- Edit Pricing Parameters
- Bulk Price Update
- Price Comparison Analysis

### 📋 Sales Desk
- Create New Quote
- Generate Quote PDF
- Convert Quote to Order
- Generate Invoice
- Send Invoice Email
- Calculate Commission
- View All Partners
- Sales Dashboard

### 🏪 Stand Center
- Check Inventory Levels
- Plan Refill
- Record Stand Visit
- Stand Performance Report
- Low Stock Alert
- Set Min/Max Levels
- Stand KPI Dashboard

### 🤖 AI Hub
- Pricing Analyst (A-PRC-301)
- Stand Ops Bot (A-STAND-401)
- Growth Writer (A-GROWTH-501)
- Ops Assistant (A-OPS-601)
- View AI Job Queue
- Review AI Drafts
- AI Guardrails Dashboard

### 📢 Marketing Suite
**SEO Tools:**
- Harvest Keywords (A-SEO-103)
- Cluster Keywords
- Generate SEO Brief
- Page Audit

**Social Media:**
- Plan Content Calendar (A-SOC-102)
- Rewrite Caption
- View Calendar

**Google Ads:**
- Expand Keywords (A-ADS-105)
- Generate Ad Copy
- Export Campaigns CSV

- Marketing KPIs Dashboard

### 👥 CRM & Leads
- Harvest Places (A-CRM-104)
- AI Enrich Leads
- Auto-Assign Territories
- Lead Scoring
- Plan Email Campaign
- Send Outreach Sequence
- Campaign Analytics
- Territory Coverage Report
- Lead Funnel Dashboard

### 📄 Templates
- Edit Quote Template
- Edit Invoice Template
- Edit Email Templates
- Customize PDF Layout
- Multi-Language Settings

### ⚡ Quick Actions
- Refresh All Data
- Open Dashboard
- Search Products
- Search Partners
- Export Data (CSV)
- Import Data
- Sync with WooCommerce

### ⚙️ Admin & Settings
- System Health Check
- View OS Logs
- Configuration Settings
- User Guide
- Support & Help
- About HAIROTICMEN OS

---

## 🔧 Troubleshooting

### Menu Not Appearing?

1. **Refresh the page** - Close and reopen the Google Sheet
2. **Check authorization** - Run `onOpen` function again in Apps Script
3. **Check console** - View > Logs in Apps Script for errors

### "API Error" Messages?

1. **Verify API URL** - Make sure CONFIG.API_BASE_URL is correct
2. **Check deployment** - Ensure your Replit app is running
3. **Test endpoint** - Visit API_BASE_URL in browser to verify it's live

### Features Not Working?

1. **Check API connection** - Run System Health Check
2. **Review logs** - Click "View OS Logs" in Admin menu
3. **Verify permissions** - Make sure script has necessary permissions

### Authorization Issues?

1. **Re-authorize** - Extensions > Apps Script > Run > onOpen
2. **Clear authorization** - Sign out and sign back in
3. **Check account** - Make sure you're using the correct Google account

---

## 🎨 Customization

### Change Menu Icon

Edit the menu creation in `onOpen()`:

```javascript
const menu = ui.createMenu('🚀 HAIROTICMEN OS')
```

Change the emoji to any icon you prefer.

### Add Custom Menu Items

Add new menu items in the appropriate section:

```javascript
.addItem('My Custom Function', 'myCustomFunction')
```

Then create the function:

```javascript
function myCustomFunction() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('My Custom Feature', 'This is my custom feature!', ui.ButtonSet.OK);
}
```

### Hide Features

Comment out menu items you don't need:

```javascript
// .addItem('Feature I Don't Need', 'someFunction')
```

---

## 📚 Usage Examples

### Example 1: Calculate Prices for All Products

1. Click **HAIROTICMEN OS** → **Pricing Studio** → **Calculate All Prices**
2. Click **Yes** to confirm
3. Wait for calculation to complete
4. Review the summary showing updated products

### Example 2: Create a New Quote

1. Click **HAIROTICMEN OS** → **Sales Desk** → **Create New Quote**
2. Enter Partner ID or Partner Name
3. Click **OK**
4. Add products in the Quotes sheet or web app

### Example 3: Check Low Stock Items

1. Click **HAIROTICMEN OS** → **Stand Center** → **Low Stock Alert**
2. Review the list of low stock items
3. Click **Plan Refill** to generate refill orders

### Example 4: Run AI Pricing Analysis

1. Click **HAIROTICMEN OS** → **AI Hub** → **Pricing Analyst**
2. AI will queue analysis job
3. Click **View AI Job Queue** to see progress
4. Review results when complete

### Example 5: Search for a Product

1. Click **HAIROTICMEN OS** → **Quick Actions** → **Search Products**
2. Enter SKU, Name, or UPC
3. View search results
4. Sheet will highlight the found product

---

## 🔐 Security Notes

### API Key Protection

The menu system communicates with your Replit backend API. Make sure:

1. Your API endpoints are properly secured
2. Authentication is implemented on sensitive operations
3. CORS is configured correctly

### User Permissions

The script requires these permissions:

- **Access your Google Sheets** - To read/write data
- **Connect to external services** - To call your API
- **Display UI elements** - To show menus and dialogs

These are standard permissions for Google Apps Script.

### Data Privacy

- No data is stored by the script itself
- All data operations go through your API
- User preferences are stored in PropertiesService (Google's storage)

---

## 🆘 Support

### Getting Help

1. **User Guide** - Click HAIROTICMEN OS → Admin & Settings → User Guide
2. **System Health** - Check if all services are running properly
3. **Logs** - View OS_Logs sheet for error details

### Common Issues

**Issue:** Menu items are grayed out  
**Solution:** Some items require data to exist first (e.g., quotes, orders)

**Issue:** Slow performance  
**Solution:** Check your internet connection and API server status

**Issue:** Data not syncing  
**Solution:** Click Quick Actions → Refresh All Data

---

## 🎉 You're All Set!

Your Google Sheet now has a powerful menu system with 80+ features at your fingertips.

Start exploring the features and automate your B2B trading operations!

---

**Version:** 3.0.0  
**Last Updated:** November 2025  
**Support:** support@hairoticmen.de
