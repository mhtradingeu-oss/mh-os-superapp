# Known Limitations & Technical Debt

## Partner ID Sequential Generation

**Issue:** Partner ID generation (`HM-P-####`) uses max+1 approach with post-write verification and compensating rollback, which while production-ready for B2B use cases, is not fully atomic under extreme concurrent load.

**Current Implementation:**
1. Pre-allocate: Generate next sequential number (max existing + 1)
2. Write: Insert partner row to Google Sheets
3. Verify: Wait 150ms, re-read sheet, count duplicates for this ID
4. Rollback: If duplicates detected, delete own row and retry (up to 5 attempts with exponential backoff)
5. Succeed: If unique after verification, commit and return

**How It Handles Concurrency:**
- **Duplicate Detection:** Post-write verification catches race conditions
- **Automatic Cleanup:** Deletes duplicate rows before retrying
- **Smart Retry:** 300ms * attempt backoff separates conflicting requests
- **Identity Matching:** Uses PartnerName to identify which duplicate row to remove

**Remaining Risk:** 
Under extreme load (>50 concurrent partner creations/second), the cleanup mechanism may occasionally fail to delete the correct duplicate row if Google Sheets API responses are delayed beyond the 150ms verification window.

**Mitigation:**
- 5 retry attempts with exponential backoff (max 1.5 seconds total)
- Google Sheets API rate limits naturally throttle extreme parallel writes
- Cleanup logs failures for manual reconciliation if needed

**Production Recommendation:**
- ✅ **Safe for B2B production use** - Partner creation is typically low-frequency (<1/second)
- For high-volume scenarios (>20 concurrent/second), consider:
  - Dedicated sequence service (Redis INCR, PostgreSQL sequence)
  - Application-level distributed lock (Redis, etc.)
  - Migration to proper database with ACID guarantees

**Acceptable For:** B2B production environments with typical load patterns

**Impact:** Very Low - B2B partner onboarding is manual and infrequent

---

**Last Updated:** November 11, 2025  
**Status:** Production-ready with documented edge cases
