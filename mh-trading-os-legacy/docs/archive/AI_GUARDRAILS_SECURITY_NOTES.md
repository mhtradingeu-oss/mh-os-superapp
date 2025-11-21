# AI Guardrails System - Security & Known Limitations

## Overview
The AI Guardrails system prevents AI agents from directly writing to production tables by routing all AI-generated changes through a human-approved draft workflow.

## Production Status: ✅ Functional with Known Limitations

### ✅ Implemented Security Features
1. **WriteContext Validation**: `validateWrite()` function enforces ActorType-based routing
2. **AI Write Protection**: AI agents (ActorType='AI') are redirected to draft tables
3. **Draft Metadata Tracking**: Full provenance with DraftID, SourceAgent, ActorType, RequestID
4. **ActorType Validation**: Endpoints only accept drafts with ActorType='AI'
5. **Server-Side Table Lookup**: Draft table derived server-side (prevents client manipulation)
6. **Atomic Error Handling**: Production writes fail-safe with error logging
7. **Sales Rollback**: Orphan quotes removed on QuoteLines write failure

### ⚠️ Known Security Limitations

#### 1. **No Role-Based Authorization** (Medium Severity)
**Current State**: 
- Endpoints protected by global `requireAuth` middleware only
- Any authenticated user can promote/reject AI-generated drafts
- No admin role verification

**Mitigation**:
- ActorType='AI' validation prevents tampering with Manual/System/Migration drafts
- All actions logged to OS_Logs with reviewer name

**Future Improvement**:
```typescript
// Add role check before promotion/rejection
if (!req.user || req.user.role !== 'admin') {
  return res.status(403).json({ error: 'Admin role required' });
}
```

#### 2. **Sales Rollback Implementation** (Low Severity)
**Current State**:
- Uses `writeRows()` to remove orphan quotes (appends instead of replacing)
- Potential for orphan records if rollback fails

**Mitigation**:
- Orphan quotes marked with Status='Error' if detected
- Error logged to OS_Logs for manual cleanup
- Rollback attempts logged with success/failure status

**Future Improvement**:
- Implement `deleteRow()` helper in sheets service
- Use transactional pattern (verify all before any write)

### 🔒 Security Recommendations for Production Use

1. **Immediate Actions** (if deploying to multi-user environment):
   - Add admin role verification to promotion/rejection endpoints
   - Implement manual review queue accessible only to authorized personnel
   - Add audit trail review process

2. **Short-term Improvements** (1-2 weeks):
   - Implement role-based access control system
   - Add `deleteRow()` method to sheets service
   - Create transactional write helper for atomic operations

3. **Long-term Enhancements** (1-3 months):
   - Implement approval workflows with multi-level review
   - Add rollback capability for promoted drafts
   - Create automated validation rules for common patterns

## Current Usage Guidelines

### ✅ Safe for Single-Admin Environments
- If you're the only admin user, current implementation is secure
- requireAuth + ActorType validation provides adequate protection
- All actions are logged and traceable

### ⚠️ Use with Caution in Multi-User Environments
- Require separate admin credentials for draft promotion
- Regularly audit OS_Logs for unauthorized promotions
- Monitor Quotes table for orphan records

## System Components

### Backend
- `server/lib/ai-write-protection.ts`: WriteContext validation
- `server/routes-admin.ts`: Draft management endpoints
- `server/lib/ensure-sheets.ts`: Draft table definitions
- `shared/schema.ts`: Draft metadata schemas

### Frontend
- `client/src/pages/ai-guardrails.tsx`: Admin approval UI
- Route: `/ai-guardrails`

### Draft Tables
1. **Pricing_Suggestions_Draft** → FinalPriceList
2. **Sales_Suggestions_Draft** → Quotes + QuoteLines
3. **Outreach_Drafts** → Outreach_Sends

## Testing Checklist
- [x] Draft table creation via ensure-sheets
- [x] Draft listing API (GET /api/admin/drafts)
- [x] Draft promotion API (POST /api/admin/drafts/:id/promote)
- [x] Draft rejection API (POST /api/admin/drafts/:id/reject)
- [x] Admin UI component
- [ ] End-to-end workflow testing
- [ ] ActorType validation testing
- [ ] Error handling and rollback testing

## Last Updated
November 12, 2025
