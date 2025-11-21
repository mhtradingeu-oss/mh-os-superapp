# G6 — Production Switch Report

**Timestamp:** 2025-11-17T15:14:32.938Z
**STAGING Sheet:** 1awpDVj3GkJMlDVXrPy2NVvV57hgg5T4GGsp126ctUJg
**PROD Sheet:** 1QntalpXMbGaYCkDrr81g5Ros6NXXj43QpBvdriFVRJY

## Summary

- **Sheets processed:** 21
- **Successful copies:** 10
- **Total rows copied:** 155
- **Errors:** 0

## Sheet Details

| Sheet | STAGING Rows | Copied Rows | Status |
|-------|--------------|-------------|--------|
| FinalPriceList | 89 | 89 | ✅ Success |
| Products | 10 | 10 | ✅ Success |
| Enums | 34 | 34 | ✅ Success |
| Packaging_Catalog | 4 | 4 | ✅ Success |
| Shipping_Carriers | 2 | 2 | ✅ Success |
| Shipping_WeightBands | 5 | 5 | ✅ Success |
| Shipping_Costs_Fixed | 0 | 0 | ⚠️ Empty |
| CRM_Leads | 2 | 2 | ✅ Success |
| CRM_Accounts | 2 | 2 | ✅ Success |
| CRM_Activities | 0 | 0 | ⚠️ Empty |
| AI_Crew_Queue | 0 | 0 | ⚠️ Empty |
| AI_Crew_Drafts | 0 | 0 | ⚠️ Empty |
| AI_Crew_Logs | 0 | 0 | ⚠️ Empty |
| Dev_Tasks | 0 | 0 | ⚠️ Empty |
| Site_Inventory | 0 | 0 | ⚠️ Empty |
| Plugin_Registry | 0 | 0 | ⚠️ Empty |
| SEO_Tech_Backlog | 0 | 0 | ⚠️ Empty |
| Integrations | 0 | 0 | ⚠️ Empty |
| _README | 3 | 3 | ✅ Success |
| _SETTINGS | 4 | 4 | ✅ Success |
| _LOGS | 0 | 0 | ⚠️ Empty |

## Next Steps

### ✅ Production Switch Complete!

**Critical Actions Required:**

1. **Update Environment Variable**
   - Set `GOOGLE_SHEET_ID` to: `1QntalpXMbGaYCkDrr81g5Ros6NXXj43QpBvdriFVRJY`
   - This can be done in Replit Secrets or .env file

2. **Restart Application**
   - Restart the workflow to load the new PROD sheet

3. **Verify Application**
   - Test critical features to ensure they work with new PROD sheet
   - Check that data loads correctly
   - Monitor for errors

4. **Proceed to G7**
   - Once verified, run G7 (Archival & Cleanup) to archive legacy and clean up STAGING
