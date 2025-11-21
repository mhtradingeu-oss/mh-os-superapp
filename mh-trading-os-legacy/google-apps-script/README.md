# 📊 HAIROTICMEN Trading OS — Google Apps Script Schema Manager

**Version**: V2.2  
**Purpose**: Automated workbook scanner, schema reconciler, formula injector, and data validator for Google Sheets

---

## 🎯 What It Does

This single Google Apps Script file (`Code.gs`) provides a **comprehensive workbook management system** that:

### ✅ Core Features

1. **Deep Workbook Scanning**
   - Detects and renames "Table X" leftovers from Numbers/Excel exports
   - Maps sheets to canonical schema using 80% header similarity
   - Archives or deletes unknown sheets

2. **Schema Reconciliation**
   - Enforces exact headers for 20 canonical sheets
   - Renames synonyms (e.g., GTIN → EAN, TargetGM → Target_GM_UVP)
   - Reorders columns to match canonical sequence
   - Adds missing columns, removes extras

3. **Formula Injection**
   - Injects 40+ formulas into Products sheet
   - Implements V2.2 pricing engine logic
   - Calculates guardrails for OwnStore/FBM/FBA
   - Computes Grundpreis (€/100ml) for PAngV compliance

4. **Cross-Sheet Relations**
   - Wires all lookups (Products ↔ LineTargets, Boxes, Channels, AmazonSizeTiers)
   - Creates data validations (dropdowns)
   - Sets up named ranges from Settings

5. **Final Price List Builder**
   - Computes role-based pricing (Partner, Sales Rep, Stand, Dealer, Distributor)
   - Applies discounts, caps, and floors
   - Generates complete price list for all 89 products

6. **KPI Dashboard**
   - Calculates coverage % (OwnStore, FBM, FBA)
   - Median UVP Net, Median Full Cost
   - UVP vs Floor compliance

7. **Protection**
   - Protects formula columns (warning-only)
   - Keeps input columns editable

8. **Safety Features**
   - **Dry-run mode**: Test without making changes
   - **Archive option**: Save deleted content before removal
   - **Migration report**: Detailed log of all changes
   - **Idempotent**: Safe to run multiple times

---

## 🚀 Installation

### Step 1: Open Google Sheets
1. Open your HAIROTICMEN Trading OS workbook
2. Go to **Extensions → Apps Script**

### Step 2: Paste the Script
1. Delete any existing code in `Code.gs`
2. Copy **ALL** content from `Code.gs` (this file)
3. Paste into the Apps Script editor
4. Click **Save** (💾 icon)

### Step 3: Authorize
1. Click **Run** → Select `onOpen`
2. Click **Review Permissions**
3. Choose your Google account
4. Click **Advanced** → **Go to [Project]**
5. Click **Allow**

### Step 4: Reload Sheets
1. Close Apps Script editor
2. Reload your Google Sheets
3. You'll see a new menu: **HAIROTICMEN**

---

## 📋 Menu Options

### 1) Setup (Scan, Normalize, Repair)
**What it does**:
- Scans all sheets in workbook
- Renames "Table X" sheets to canonical names
- Deletes/archives unknown sheets
- Fixes all headers
- Seeds default data (if sheets are empty)
- Injects formulas into Products
- Sets up data validations

**When to use**: 
- First time setup
- After importing from Numbers/Excel
- After major schema changes

**Duration**: 30-60 seconds

---

### 2) Refresh Formulas (Products)
**What it does**:
- Re-injects all 40+ formulas into Products sheet
- Overwrites any manual edits in formula columns

**When to use**:
- After adding new products (rows)
- If formulas got accidentally deleted
- After changing Settings values

**Duration**: 10-20 seconds

---

### 3) Build Final Price List
**What it does**:
- Reads all products from Products sheet
- Reads role tiers from PartnerTiers
- Computes final net prices for each role
- Populates FinalPriceList sheet

**When to use**:
- After changing UVP prices
- After updating PartnerTiers discounts
- Before distributing price lists to partners

**Duration**: 5-10 seconds

---

### 4) Rebuild KPIs
**What it does**:
- Calculates coverage % for all channels
- Computes median UVP and Full Cost
- Updates KPIs sheet

**When to use**:
- After changing prices
- For daily/weekly monitoring
- Before board presentations

**Duration**: 2-5 seconds

---

### 5) Protect Formula Columns
**What it does**:
- Protects all formula columns in Products
- Sets warning-only protection (doesn't block edits)
- Prevents accidental overwrites

**When to use**:
- After setup
- Before distributing to team members
- Periodically for safety

**Duration**: 1-2 seconds

---

## 🔧 Configuration

### Dry-Run Mode
```javascript
const DRY_RUN = false;  // Set to true to test without changes
```

**When `DRY_RUN = true`**:
- Script only logs intended actions
- No actual changes to sheets
- Check MIGRATION_REPORT for what would happen

**Usage**: Test major changes safely

---

### Archive Before Delete
```javascript
const ARCHIVE_BEFORE_DELETE = true;  // Set to false to skip archiving
```

**When `true`**:
- Creates `Archive_YYYYMMDD_HHMM` sheet
- Copies deleted sheets/columns before removal
- Safer for production use

**When `false`**:
- Deletes immediately (no backup)
- Faster, but riskier

---

### Max Rows
```javascript
const MAX_ROWS = 5000;  // Maximum rows for formulas
```

**Controls**:
- How many rows get formulas injected
- Default: 5000 (plenty for 89 products + growth)

---

## 📊 Canonical Sheets (20 total)

### Core Configuration (8 sheets)
1. **README** - Instructions
2. **Settings** - System-wide settings (VAT, margins, fees)
3. **LineTargets** - Product line targets (Premium, Professional, Basic, etc.)
4. **CostPresets** - Default costs by product group
5. **Boxes** - Shipping box sizes and costs
6. **ShippingMatrix** - DHL shipping rates
7. **Channels** - Sales channel configs (OwnStore, FBM, FBA)
8. **LoyaltyGift** - Loyalty program settings

### Partner & Pricing (4 sheets)
9. **PartnerTiers** - Role discounts and caps
10. **QuantityDiscounts** - Volume discounts
11. **DiscountCap** - Maximum discount limits
12. **OrderDiscounts** - Order-level discounts

### Product Data (3 sheets)
13. **Products** - Main product catalog (89 SKUs)
14. **SKUGifts** - Gift-with-purchase programs
15. **AmazonSizeTiers** - FBA fee tiers

### Outputs (3 sheets)
16. **FinalPriceList** - Computed prices for all roles
17. **KPIs** - Key performance indicators
18. **QuoteBuilder** - Quote generation

### Quote Support (2 sheets)
19. **QuoteBuilder_Lines** - Quote line items
20. **QuoteBuilder_Summary** - Quote summaries

---

## 🔍 Header Synonyms

The script automatically normalizes these variations:

| Canonical | Accepted Synonyms |
|-----------|-------------------|
| `EAN` | GTIN, Barcode |
| `UnitPerPice` | UnitPerPiece |
| `Target_GM_UVP` | TargetGM, GM_Target |
| `Amazon_TierKey` | FBA_TierKey, TierKey |
| `Referral_Low_Pct_<=10€` | Referral Low %, Referral <=10€ |
| `Grundpreis_€/100ml` | Grundpreis €/100 ml, Grundpreis €/100ml |

**Matching Logic**: 
- Case-insensitive
- Ignores spaces, underscores, hyphens
- 80%+ similarity = match

---

## 📝 Migration Report

Every action is logged to `MIGRATION_REPORT` sheet:

| Timestamp | Level | Action | Details |
|-----------|-------|--------|---------|
| 2025-11-15T12:00:00 | INFO | Starting Setup | |
| 2025-11-15T12:00:01 | INFO | Rename sheet | Table 1 → Products |
| 2025-11-15T12:00:02 | WARN | Delete unknown sheet | Sheet2 (no match ≥0.80) |
| 2025-11-15T12:00:03 | SUCCESS | Formulas injected | Rows 2:5000 |

**Levels**:
- `INFO` - Normal operations
- `WARN` - Potentially destructive (delete, archive)
- `ERROR` - Something failed
- `SUCCESS` - Operation completed
- `DRY_RUN` - What would happen (dry-run mode)

---

## 🎓 Usage Workflow

### First-Time Setup (Numbers Export)

1. **Export from Numbers**
   - Export as `.xlsx`
   - Upload to Google Sheets
   - You'll see "Table 1", "Table 2", etc.

2. **Install Script**
   - Follow installation steps above
   - Menu appears: **HAIROTICMEN**

3. **Run Setup**
   - HAIROTICMEN → **1) Setup**
   - Wait 30-60 seconds
   - Check MIGRATION_REPORT

4. **Verify Results**
   - All sheets renamed to canonical names
   - Headers fixed
   - Formulas injected
   - Products sheet has calculations

5. **Fill Data**
   - Add your 89 products to Products sheet
   - Fill EAN, Item, Line, Category, etc.
   - Formulas auto-calculate

6. **Build Outputs**
   - HAIROTICMEN → **3) Build Final Price List**
   - HAIROTICMEN → **4) Rebuild KPIs**
   - Distribute to team!

---

### Daily Operations

1. **Update Products**
   - Edit Products sheet (input columns only)
   - Formulas auto-recalculate

2. **Refresh if Needed**
   - If formulas break: **2) Refresh Formulas**
   - If prices change: **3) Build Final Price List**
   - For KPIs: **4) Rebuild KPIs**

3. **Monthly Review**
   - Update Settings (VAT, margins, fees)
   - **2) Refresh Formulas** (applies new settings)
   - **3) Build Final Price List**
   - Check coverage in KPIs

---

## ⚠️ Important Notes

### Input vs Formula Columns

**Input Columns** (editable):
- EAN, Item, Box_Size, Product_Group, Line, Category
- UnitsPerCarton, UnitPerPice, TotalFactoryPriceCarton
- FactoryPriceUnit_Manual, Shipping_Inbound_per_unit
- EPR_LUCID, GS1, Retail_Packaging, QC_PIF, Operations, Marketing
- Manual_UVP_Inc, Net_Content_ml
- Amazon_TierKey, Channel_Type

**Formula Columns** (auto-generated, protected):
- All other columns in Products
- Do NOT manually edit formula columns
- Use **2) Refresh Formulas** if they break

---

### Data Validations

Products sheet has dropdowns for:
- **Line** → LineTargets
- **Box_Size** → Boxes
- **Channel_Type** → Channels
- **Amazon_TierKey** → AmazonSizeTiers

**Use the dropdowns** instead of typing to avoid errors.

---

### Seed Data

If sheets are **empty**, Setup seeds defaults:

**Settings**:
- VAT = 19%
- target_post_channel_margin = 38%
- returns_pct = 2%
- payment_fee_pct = 2.5%
- consumer_round_to = 0.99

**LineTargets**:
- Premium: 75% GM, 2.50x floor, 11% ads
- Professional: 62% GM, 2.40x floor, 9% ads
- Basic: 50% GM, 2.10x floor, 7% ads
- Tools: 48% GM, 1.80x floor, 5% ads

**Channels**:
- OwnStore: no referral, no platform fee
- Amazon_FBM: 8%/15% referral, €0.35 label
- Amazon_FBA: 8%/15% referral, FBA fees

**PartnerTiers**:
- Partner: -25%, cap 35%
- Sales Rep: -25%, cap 35%, +5% commission
- Stand: -30%, cap 40%, +5% performance
- Dealer Basic: -40%, cap 50%
- Dealer Plus: -50%, cap 55%
- Distributor: -60%, cap 60%

**You can edit** these after seeding.

---

## 🐛 Troubleshooting

### "Script authorization required"
**Solution**: Follow Step 3 (Authorize) in installation

### "Cannot find sheet Products"
**Solution**: Run **1) Setup** first

### "Formulas not calculating"
**Solution**: Run **2) Refresh Formulas**

### "Unknown sheet detected"
**Check**: MIGRATION_REPORT for details
**Solution**: Either:
- Rename manually to canonical name
- Let script delete/archive it (if not needed)

### "Validations not working"
**Solution**: 
1. Check that LineTargets, Boxes, Channels, AmazonSizeTiers have data
2. Run **1) Setup** again

### "FinalPriceList empty"
**Solution**:
1. Ensure Products has data (rows 2+)
2. Ensure PartnerTiers has roles
3. Run **3) Build Final Price List**

---

## 📦 Files

```
google-apps-script/
├── Code.gs          # Main script (paste into Apps Script)
└── README.md        # This file (documentation)
```

---

## 🎉 Benefits

✅ **Automated**: No manual formula copying  
✅ **Consistent**: Enforces schema across team  
✅ **Safe**: Dry-run + archive + migration report  
✅ **Fast**: 30-60 seconds for full setup  
✅ **Idempotent**: Run multiple times safely  
✅ **Comprehensive**: 40+ formulas, 20 sheets, all relations  

---

## 📞 Support

**Issues**:
1. Check MIGRATION_REPORT sheet
2. Review this README
3. Enable DRY_RUN and test
4. Contact: [Your support email]

**Version**: V2.2  
**Last Updated**: November 15, 2025  
**Compatible with**: HAIROTICMEN Trading OS V2.2

---

**Happy automating!** 🚀
