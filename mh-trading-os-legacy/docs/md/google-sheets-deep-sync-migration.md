# Google Sheets Deep Sync Migration Guide

## Overview
This guide describes how to add the missing manual override columns to the FinalPriceList tab in Google Sheets to enable full Deep Sync functionality.

**Status**: Schema migration required before full Deep Sync visual indicators work
**Impact**: Medium (manual data entry required)
**Estimated Time**: 15-30 minutes

## Prerequisites
- Access to HAIROTICMEN Google Sheets workbook
- Permission to edit FinalPriceList tab
- Understanding of manual override vs calculated pricing concepts

## Missing Columns

### Required Manual Override Columns
The following columns must be added to the FinalPriceList tab:

1. **Manual_UVP_Inc** (Type: Number, Format: Currency €0.00)
   - Purpose: Manually set UVP that overrides calculated pricing
   - Default: Leave blank (empty cells = use calculated value)
   - Example: 24.99

2. **FactoryPriceUnit_Manual** (Type: Number, Format: Currency €0.00)
   - Purpose: Manually set factory unit cost that overrides contract pricing
   - Default: Leave blank (empty cells = use contract pricing)
   - Example: 8.50

3. **Ad_Pct** (Type: Number, Format: Percentage 0.00%)
   - Purpose: Manual advertising cost override
   - Default: Leave blank (empty cells = use Pricing_Params value)
   - Example: 12.5 (displays as 12.50%)

4. **Returns_Pct** (Type: Number, Format: Percentage 0.00%)
   - Purpose: Manual returns cost override
   - Default: Leave blank (empty cells = use Pricing_Params value)
   - Example: 3.0 (displays as 3.00%)

5. **Loyalty_Pct** (Type: Number, Format: Percentage 0.00%)
   - Purpose: Manual loyalty program cost override
   - Default: Leave blank (empty cells = use Pricing_Params value)
   - Example: 5.0 (displays as 5.00%)

6. **Weight_g** (Type: Number, Format: Number 0)
   - Purpose: Manual product weight override for shipping calculations
   - Default: Leave blank (empty cells = use calculated/estimated weight)
   - Example: 450

7. **Amazon_TierKey** (Type: Text)
   - Purpose: Manual Amazon shipping tier override
   - Default: Leave blank (empty cells = auto-calculate from weight)
   - Valid Values: "Small_Std", "Large_Std", "Small_Oversize", "Medium_Oversize", "Large_Oversize"
   - Example: "Small_Std"

8. **Gift_Attach_Rate** (Type: Number, Format: Percentage 0.00%)
   - Purpose: Manual gift attachment rate override
   - Default: Leave blank (empty cells = use Pricing_Params value)
   - Example: 8.0 (displays as 8.00%)

## Migration Steps

### Step 1: Backup Current Sheet
1. Navigate to Google Sheets HAIROTICMEN workbook
2. Right-click on FinalPriceList tab
3. Select "Copy to" → "New spreadsheet"
4. Name it "FinalPriceList_Backup_YYYY-MM-DD"
5. Share backup link with team

### Step 2: Add Columns to FinalPriceList
1. Open FinalPriceList tab
2. Locate the rightmost column (currently around column Z or beyond)
3. Insert 8 new columns after the last existing column
4. Add column headers exactly as shown above (case-sensitive)
5. Set data validation:
   - Currency columns: Format → Number → Currency (€)
   - Percentage columns: Format → Number → Percent
   - Amazon_TierKey: Data → Data validation → List from a range: "Small_Std, Large_Std, Small_Oversize, Medium_Oversize, Large_Oversize"

### Step 3: Set Column Formatting
For each new column, apply the following:

```
Manual_UVP_Inc: 
  Format: Custom number format "€#,##0.00"
  
FactoryPriceUnit_Manual:
  Format: Custom number format "€#,##0.00"
  
Ad_Pct, Returns_Pct, Loyalty_Pct, Gift_Attach_Rate:
  Format: Custom number format "0.00%"
  
Weight_g:
  Format: Number, 0 decimal places
  
Amazon_TierKey:
  Format: Plain text
  Data validation: List from dropdown
```

### Step 4: Freeze Headers (Optional but Recommended)
1. Select row 1 (header row)
2. View → Freeze → 1 row
3. This keeps headers visible while scrolling

### Step 5: Add Column Descriptions (Optional)
Add a comment to each column header explaining its purpose:
1. Right-click on column header cell
2. Insert comment
3. Paste description from "Required Manual Override Columns" section above

### Step 6: Verify Integration
1. Return to MH Trading OS Pricing Studio
2. Navigate to Pricing Control Panel
3. Click "Sync Pricing" button
4. Wait for sync to complete
5. Verify manual override indicators appear in product table
6. Click "Validate All" button
7. Check health status is PASS or WARN (not FAIL)
8. Export CSV to review validation results

## Expected Column Order (Suggested)
Place the new columns after existing pricing columns, before notes/metadata:

```
... UVP | MAP | Manual_UVP_Inc | FactoryPriceUnit_Manual | Ad_Pct | Returns_Pct | Loyalty_Pct | Weight_g | Amazon_TierKey | Gift_Attach_Rate | Notes ...
```

## Data Population Guidelines

### When to Use Manual Overrides
- **Manual_UVP_Inc**: Use when market conditions require non-standard pricing
- **FactoryPriceUnit_Manual**: Use for negotiated one-off pricing or promotional costs
- **Ad_Pct/Returns_Pct/Loyalty_Pct**: Use for products with different cost structures
- **Weight_g**: Use when actual weight differs from packaging specs
- **Amazon_TierKey**: Use to force specific shipping tier for cost optimization
- **Gift_Attach_Rate**: Use for seasonal or promotional products

### Best Practices
1. **Document Overrides**: Always add a note in the adjacent Notes column explaining why manual override was used
2. **Review Regularly**: Monthly review of all manual overrides to ensure still valid
3. **Minimize Overrides**: Use manual overrides sparingly - let automation work
4. **Track Changes**: Use Google Sheets version history to track who changed what when

## Testing Manual Overrides

### Test Case 1: Manual UVP Override
1. Select a test product (e.g., SKU: "HM-001")
2. Enter value in Manual_UVP_Inc column: 29.99
3. Trigger pricing sync in Pricing Studio
4. Verify product table shows "Manual" badge next to UVP
5. Hover over badge - tooltip should show: "UVP manually set: €29.99"

### Test Case 2: Manual Factory Price Override
1. Select same test product
2. Enter value in FactoryPriceUnit_Manual column: 12.50
3. Trigger pricing sync
4. Verify COGS column shows "Edit" badge
5. Hover over badge - tooltip should show: "Factory price manually set: €12.50"

### Test Case 3: Clear Manual Override
1. Delete value from Manual_UVP_Inc column
2. Trigger pricing sync
3. Verify "Manual" badge disappears
4. Verify UVP reverts to calculated value

## Rollback Plan
If migration causes issues:

1. **Immediate Rollback**:
   - Delete the 8 new columns from FinalPriceList
   - Trigger pricing sync to recalculate using standard logic
   - Verify system returns to normal operation

2. **Data Recovery**:
   - Restore from backup spreadsheet created in Step 1
   - Copy data back to original FinalPriceList tab
   - Verify data integrity

## Validation Checklist
- [ ] All 8 columns added to FinalPriceList
- [ ] Column names match exactly (case-sensitive)
- [ ] Proper formatting applied (currency, percentage, text)
- [ ] Data validation rules set for Amazon_TierKey
- [ ] Headers frozen for better usability
- [ ] Column descriptions added as comments
- [ ] Backup created and shared
- [ ] Test manual override added and verified
- [ ] Pricing sync completed successfully
- [ ] Manual override indicators appear in UI
- [ ] Health status shows PASS or WARN
- [ ] CSV export reviewed

## Troubleshooting

### Issue: Manual override indicators don't appear
**Solution**: Verify column names match exactly (case-sensitive). Run "Validate All" to check for errors.

### Issue: Sync fails after adding columns
**Solution**: Check Google Sheets API permissions. Ensure service account has write access. Review OS_Logs for detailed error messages.

### Issue: Values not calculating correctly
**Solution**: Verify Pricing_Params tab has all required parameters. Check that manual override values are valid numbers (not text).

### Issue: Percentage columns showing wrong format
**Solution**: Google Sheets stores percentages as decimals. Enter 12.5 for 12.5%, not 0.125.

## Support
For issues with this migration:
1. Check OS_Logs sheet for detailed error messages
2. Review docs/pricing-engine-deep-sync-audit.md for technical details
3. Contact development team with specific error messages and SKUs affected

## Completion
After successful migration:
- [ ] Update this document with actual migration date
- [ ] Document any issues encountered and resolutions
- [ ] Share migration completion status with team
- [ ] Monitor system for 24 hours to ensure stability

**Migration Date**: _____________
**Migrated By**: _____________
**Validation Status**: _____________
