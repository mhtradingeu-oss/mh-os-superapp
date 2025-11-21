# AI Orchestrator System — Architecture & Guardrails

## Overview

The AI Orchestrator is a production-ready system for managing AI-powered tasks with human-in-the-loop approval workflows, automated guardrails, and secure write enforcement.

## System Architecture

```
┌─────────────────┐
│   AI Hub UI     │ ← User submits tasks
└────────┬────────┘
         │ POST /api/ai/submit
         ▼
┌─────────────────┐
│  Orchestrator   │ ← Validates, creates job
│  submitTask()   │   Status=DRAFT if requiresApproval
└────────┬────────┘
         │ Writes to AI_Crew sheet
         ▼
┌─────────────────┐
│ MAP/GDPR Guards │ ← validateMAP(), validateGDPR()
└────────┬────────┘
         │ Logs to MAP_Guardrails
         ▼
┌─────────────────┐
│  AI Crew UI     │ ← Human reviews job
└────────┬────────┘
         │ POST /api/ai/approvals/:id/approve
         ▼
┌─────────────────┐
│  approveJob()   │ ← Updates Status=APPROVED
│  applyJob()     │   Calls apply handler
└────────┬────────┘
         │ Writes to production sheets
         ▼
┌─────────────────┐
│ Production Data │ ← Outreach_Templates,
│                 │   Outreach_Campaigns,
│                 │   Final_Price_List
└─────────────────┘
```

## Components

### 1. AI Orchestrator (`server/lib/ai-orchestrator.ts`)

**Core Functions:**
- `submitTask()` - Creates new job in AI_Crew, validates guardrails
- `approveJob()` - Approves job, runs apply handler
- `rejectJob()` - Rejects job with reason
- `getJobStatus()` - Fetches single job
- `getPendingApprovals()` - Lists pending jobs

**Agent Registry:**
- A-PRICE-301: Pricing Analyst (MAP guardrails)
- A-STAND-401: Stand Ops Bot
- A-GROWTH-501: Growth Writer (GDPR guardrails)
- A-OPS-601: Ops Assistant
- A-OUT-101: Outreach Sequencer (GDPR guardrails)
- A-SEO-201: Keyword Harvester
- A-SEO-202: Cluster Architect

### 2. Guardrails

**MAP Guardrail (`validateMAP`)**:
- Validates price changes against MAP (Minimum Advertised Price)
- Checks if new price < MAP or price < COGS
- Logs violations to MAP_Guardrails sheet
- **Blocks job** if validation fails

**GDPR Guardrail (`validateGDPR`)**:
- Checks outreach templates for unsubscribe links
- Detects pressure tactics (e.g., "limited time", "act now")
- Ensures GDPR compliance for email campaigns
- **Blocks job** if validation fails

### 3. Apply Handlers (`applyApprovedJob`)

Task-specific logic for writing approved outputs to production sheets:

**suggest-template:**
```typescript
Output: { templateId, name, subject, body, locale }
Writes to: Outreach_Templates
```

**draft-campaign:**
```typescript
Output: { campaignId, name, templateId }
Writes to: Outreach_Campaigns (Status='draft')
```

**suggest-pricing:**
```typescript
Output: { sku, price }
Updates: Final_Price_List (UVP column)
```

**harvest-keywords / cluster-keywords / summarize-replies:**
```typescript
No apply action (read-only tasks)
Output stays in OutputJSON
```

### 4. Write Protection (`aiSheetsService`)

Wraps `sheetsService` to enforce write whitelist:

**Allowed:**
- AI_Crew
- AI_Outbox
- MAP_Guardrails
- OS_Health
- SEO_Keywords
- SEO_Clusters
- Patterns: AI_* and *_Draft

**Blocked:**
- All production sheets (unless via apply handler after approval)

## Data Flow

### Job Creation Flow
1. User submits task via AI Hub
2. `submitTask()` creates job with Status='DRAFT' (if requiresApproval)
3. Guardrails validate input (MAP/GDPR)
4. Job written to AI_Crew via `aiSheetsService`
5. JobID returned to user

### Approval Flow
1. User views pending jobs in AI Crew
2. User clicks "Approve" with optional notes
3. `approveJob()` updates Status='APPROVED'
4. `applyApprovedJob()` writes to production sheet
5. AppliedTS timestamp recorded
6. User notified of success

### Rejection Flow
1. User views pending job
2. User clicks "Reject" with required reason
3. `rejectJob()` updates Status='REJECTED'
4. RejectedBy and RejectedTS recorded
5. No changes applied to production

## Job Lifecycle

```
DRAFT → APPROVED → (applied) → COMPLETED
  ↓
REJECTED
  ↓
ERROR (guardrail failure)
```

**Status Meanings:**
- **DRAFT**: Waiting for human approval
- **APPROVED**: Approved, changes applied successfully
- **REJECTED**: Human rejected the job
- **ERROR**: Guardrail validation failed
- **COMPLETED**: Execution finished (for no-approval tasks)

## API Endpoints

### GET /api/ai/agents
Lists all registered agents with metadata.

**Response:**
```json
[
  {
    "agentId": "A-PRICE-301",
    "name": "Pricing Analyst",
    "description": "Pricing strategy expert...",
    "tasks": ["suggest-pricing", "analyze-pricing"],
    "requiresApproval": true,
    "guardrails": ["MAP"],
    "maxTokens": 2048,
    "model": "gpt-4"
  }
]
```

### POST /api/ai/submit
Submits new job to AI orchestrator.

**Request:**
```json
{
  "agentId": "A-PRICE-301",
  "task": "suggest-pricing",
  "input": { "prompt": "Analyze SKU123", "sku": "SKU123" }
}
```

**Response:**
```json
{
  "jobId": "AI-abc123def456",
  "status": "DRAFT",
  "requiresApproval": true,
  "message": "Task submitted for approval. Job ID: AI-abc123def456"
}
```

### GET /api/ai/jobs
Lists all jobs (with optional filters).

**Response:**
```json
[
  {
    "JobID": "AI-abc123",
    "AgentID": "A-PRICE-301",
    "Task": "suggest-pricing",
    "Status": "DRAFT",
    "CreatedTS": "2025-11-10T12:00:00Z",
    "InputJSON": "{\"sku\":\"SKU123\"}",
    "OutputJSON": "{\"price\":49.99}",
    "RequiresApproval": true,
    "GuardrailsPassed": true
  }
]
```

### GET /api/ai/jobs/:id
Fetches single job by ID.

### POST /api/ai/approvals/:id/approve
Approves job and applies changes.

**Request:**
```json
{
  "approvedBy": "john@example.com",
  "notes": "Looks good"
}
```

**Response:**
```json
{
  "success": true,
  "applied": true
}
```

### POST /api/ai/approvals/:id/reject
Rejects job with reason.

**Request:**
```json
{
  "rejectedBy": "sarah@example.com",
  "reason": "Price too high, violates internal policy"
}
```

**Response:**
```json
{
  "success": true
}
```

## Security

### Write Whitelist Enforcement
- AI writes go through `aiSheetsService`
- Validates sheet name against whitelist
- Throws error if production sheet accessed directly
- Apply handlers use `sheetsService` (post-approval bypass)

### Guardrail Enforcement
- MAP: Prevents pricing below MAP or COGS
- GDPR: Ensures compliant outreach templates
- Violations logged to MAP_Guardrails
- Jobs blocked if guardrails fail

### Audit Trail
- All jobs logged in AI_Crew with timestamps
- ApprovedBy / RejectedBy fields track actors
- OS_Health entries for orchestrator actions
- MAP_Guardrails logs price violations

## Error Handling

### Guardrail Failures
```typescript
Status: 'ERROR'
GuardrailsPassed: false
ErrorMsg: "MAP violation: Price 45.00€ below MAP 49.99€"
```

### Apply Failures
```typescript
Status: 'APPROVED' (approval succeeds)
AppliedTS: null (apply failed)
ErrorMsg: "Apply failed: Invalid OutputJSON"
Notes: "Approved but apply failed: ..."
```

### Unknown Task Types
```typescript
Throws: "Unknown task type: xyz - no apply handler defined"
```

## Monitoring

### OS_Health Entries
- **AI Orchestrator**: Job submission, approval, rejection
- **AI Orchestrator Apply**: Apply handler executions
- **MAP Guardrails**: Price validation results

### AI_Crew Sheet
- Central log of all AI jobs
- Queryable for reporting and auditing
- Tracks full lifecycle of each job

## Future Enhancements

1. **Task Selection UI**: Dropdown for agents with multiple tasks
2. **Sheet Diff Preview**: Show what changes before approval
3. **Apply Feedback**: Display which sheets were updated
4. **Websockets**: Real-time job status updates
5. **Bulk Approval**: Approve multiple jobs at once
6. **Scheduled Jobs**: Cron-based task execution
7. **Agent Analytics**: Track success rates, execution times

## Troubleshooting

### Job Stuck in DRAFT
- Check if agent requires approval (`requiresApproval: true`)
- View job in AI Crew to approve/reject

### Guardrail Blocking Job
- Check ErrorMsg in job details
- Review MAP_Guardrails sheet for pricing issues
- Adjust input to satisfy guardrail constraints

### Apply Failed
- Check OutputJSON format matches handler expectations
- Verify production sheet exists and is writable
- Review OS_Health for apply errors

### Agent Not Found
- Verify agent is registered in REGISTERED_AGENTS
- Check agentId matches exactly (case-sensitive)

## Contributing

When adding new agents:
1. Add to `REGISTERED_AGENTS` in `server/lib/ai-orchestrator.ts`
2. Implement apply handler in `applyApprovedJob()` if needed
3. Add guardrails to agent definition if needed
4. Update AI Hub UI to include new agent tab

When adding new tasks:
1. Add task name to agent's `tasks` array
2. Implement apply handler for write operations
3. Update guardrail logic if needed
4. Test full workflow: submit → approve → verify
