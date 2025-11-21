# Interactive Toolkit Demo

## How to Use

Run the interactive toolkit:

```bash
tsx server/scripts/build-sheet-from-scratch/07-interactive-toolkit.ts
```

## Available Features

### 1. ⚡ Full Validation & Repair
- Runs the complete 103-sheet validation
- Shows progress with color-coded output
- Logs all fixes to Validation_Log sheet

### 2. 📋 Setup Data Validations & Dropdowns
- Applies dropdown lists to columns:
  - Line (Premium, Skin, Professional, Basic, Tools)
  - Status (Active, Inactive, Discontinued)
  - Amazon_TierKey (Std_Parcel_S/M/L)
  - Box_Size (Small, Medium, Large)
- Choose which sheets to apply to

### 3. 🧮 Setup Grundpreis Formulas
- Calculates €/L: `(UVP_Inc / Net_Content_ml) × 1000`
- Calculates €/kg: `(UVP_Inc / Size_g) × 1000`
- Validates columns exist before applying
- Shows column availability check

### 4. ✨ Smart Fill
**Example Output:**
```
Smart fill analysis:
  Line: 12 fields
  Category: 8 fields
  Subcategory: 15 fields
  Box_Size: 23 fields
  Amazon_TierKey: 23 fields
  Total: 81 fields
```

**Pattern Matching Rules:**
- **Line**: 
  - "skin/face/serum/mask" → Skin
  - "tool/accessor/comb/brush" → Tools
  - "pro/barber/salon" → Professional
  - Default → Premium

- **Category**:
  - "beard/oil/balm" → Beard Care
  - "shaving/razor" → Shaving
  - "cologne/perfume" → Cologne
  - "hair gel" → Hair Gel
  - "hair wax/pomade" → Hair Wax
  - And 5 more categories...

- **Box_Size** (by weight):
  - ≤250g → Small
  - ≤700g → Medium
  - >700g → Large

### 5. 🔖 Generate QR/Barcode URLs
Creates product URLs:
```
https://hairoticmen.de/product/BAR-BEARDOIL50-003
https://hairoticmen.de/product/BAR-BEARDOIL50-003?barcode=4260123456789
```

### 6. ✅ Validate/Repair EAN-13 Checksums
**Example Output:**
```
EAN-13 analysis:
  Valid: 76
  Fixed: 13
  Invalid (skipped): 0
```

Repairs:
- Incorrect checksums (4260123456788 → 4260123456789)
- Missing checksums (426012345678 → 4260123456789)

### 7. 🔎 Data Quality Audit
**Example Output:**
```
┌────────────────────────────────────────┬──────────────┐
│ Issue                                  │ Count        │
├────────────────────────────────────────┼──────────────┤
│ Missing SKU or Name                    │ 3            │
│ Duplicate SKUs                         │ 0            │
│ UVP below Floor Price                  │ 5            │
│ Guardrail NOT OK                       │ 12           │
└────────────────────────────────────────┴──────────────┘
```

### 8. 📦 Carton Field Audit
Checks completeness of:
- UnitsPerCarton
- Carton_L_cm, Carton_W_cm, Carton_H_cm
- Carton_Cost_EUR

**Example Output:**
```
Carton field analysis:
  Total rows: 89
  Rows with complete carton data: 67
  Rows with gaps: 22
```

### 9. 📊 Statistics Dashboard
Quick overview of sheets:
```
┌─────────────────────────┬────────────┬──────────────┐
│ Sheet                   │ Rows       │ Columns      │
├─────────────────────────┼────────────┼──────────────┤
│ FinalPriceList          │ 89         │ 94           │
│ Products                │ 89         │ 45           │
└─────────────────────────┴────────────┴──────────────┘
```

## DRY-RUN Mode

Test without making changes:

```bash
DRY_RUN=true tsx server/scripts/build-sheet-from-scratch/07-interactive-toolkit.ts
```

All operations will show what *would* happen without actually modifying the spreadsheet.

## Tips

1. **Start with Statistics** - Get an overview of your data
2. **Run Audits** - Identify issues before fixing
3. **Use Smart Fill** - Let the system suggest values
4. **Validate Checksums** - Ensure EAN-13 codes are correct
5. **Full Validation** - Deep check of all 103 sheets

## Menu Navigation

Use arrow keys to navigate, Enter to select, Ctrl+C to exit anytime.

The menu remembers your position and returns you to the main menu after each action.
