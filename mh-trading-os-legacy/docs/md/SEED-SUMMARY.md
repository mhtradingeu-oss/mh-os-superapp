# G2 Safe Seeding Summary

**Timestamp:** 2025-11-17T14:42:45.841Z

**Target:** STAGING Sheet (1awpDVj3GkJMlDVXrPy2NVvV57hgg5T4GGsp126ctUJg)

## Seeded Sheets

| Sheet Name | Rows | Errors |
|------------|------|--------|
| Products | 10 | 0 |
| FinalPriceList | 5 | 0 |
| Enums | 10 | 0 |
| Packaging_Catalog | 4 | 0 |
| Shipping_Carriers | 2 | 0 |
| Shipping_WeightBands | 5 | 0 |
| CRM_Leads | 3 | 0 |
| CRM_Accounts | 2 | 0 |
| _SETTINGS | 4 | 0 |
| _README | 3 | 0 |

**Total Rows:** 48
**Total Errors:** 0

## Data Sources

- Products: Demo data with realistic product information
- Pricing: Calculated using basic pricing engine (COGS * 2.5, .99 ending)
- Shipping: Standard DHL and pickup options
- CRM: Sample leads and accounts for testing

## Notes

- All financial calculations are deterministic and traceable
- No NaN or Infinity values in pricing
- All demo data is clearly marked as such
- Settings configured for STAGING environment
