# AI Orchestrator MVP - Technical Design Specification

## Overview
The AI Orchestrator is the central coordination system for MH Trading OS's AI Crew, managing task routing, approval workflows, guardrails enforcement, and audit trails for all AI operations.

## Current State Analysis

### Existing AI Agents
1. **A-OUT-101 "Outreach Sequencer"** (`server/lib/outreach-ai.ts`)
   - Template generation (GDPR-compliant)
   - Reply analysis and classification
   - Campaign drafting

2. **A-SEO-201 "Keyword Harvester"** (`server/lib/seo-engine.ts`)
   - Keyword generation from seed terms
   - Intent classification
   - Business fit scoring

3. **A-SEO-202 "Cluster Architect"** (`server/lib/seo-engine.ts`)
   - Semantic keyword clustering
   - Thematic grouping

### Existing Infrastructure
- OpenAI GPT-5 integration
- AI_Outbox sheet for logging
- OS_Health sheet for monitoring
- Individual agent implementations (no orchestration)

### Gaps Identified
1. No central orchestrator for task routing
2. No human approval workflows
3. No MAP/GDPR guardrails enforcement
4. No draft-only write restrictions
5. No unified AI_Crew tracking
6. Agents work independently without coordination

## Architecture Design

### Core Components

#### 1. Orchestrator Service (`server/lib/ai-orchestrator.ts`)
Central coordination service that:
- Routes tasks to appropriate AI agents
- Enforces guardrails (MAP, GDPR, draft-only writes)
- Manages approval workflows
- Tracks all AI operations in AI_Crew sheet
- Provides unified interface for AI operations

#### 2. AI_Crew Sheet (New)
Master tracking sheet for all AI operations:
```typescript
{
  JobID: string;           // Unique job identifier
  CreatedTS: string;       // ISO timestamp
  AgentID: string;         // Which agent (A-OUT-101, A-SEO-201, etc.)
  Task: string;            // Task type (harvest-keywords, suggest-template, etc.)
  InputJSON: string;       // Serialized input parameters
  OutputJSON: string;      // Serialized output (DRAFT mode)
  Status: 'PENDING' | 'RUNNING' | 'DRAFT' | 'APPROVED' | 'REJECTED' | 'ERROR';
  GuardrailsPassed: boolean;  // Did guardrails checks pass?
  RequiresApproval: boolean;  // Does this need human review?
  ApprovedBy: string;      // Who approved (if applicable)
  ApprovedTS: string;      // When approved
  AppliedTS: string;       // When changes applied to production sheets
  ErrorMsg: string;        // Error details if failed
  Notes: string;           // Additional context
}
```

#### 3. Guardrails System
Enforcement layer that validates AI outputs before execution:

**MAP Guardrails:**
- Check pricing changes don't violate MAP (Minimum Advertised Price)
- Block any UVP/Price_Web/Price_Amazon below MAP threshold
- Log violations to MAP_Guardrails sheet

**GDPR Guardrails:**
- Validate email templates for compliance (A-OUT-101)
- Block pressure tactics, false promises, urgency manipulation
- Ensure unsubscribe link presence
- Verify data processing transparency

**Write Enforcement:**
- AI agents can ONLY write to draft columns/sheets
- Production data requires human approval
- All writes logged to AI_Crew for audit

#### 4. Approval Workflow
Human-in-the-loop system for critical operations:

**Auto-Approved Tasks** (no human review needed):
- Keyword harvesting (A-SEO-201)
- Keyword clustering (A-SEO-202)
- Reply classification (A-OUT-101)
- Non-destructive reads/analysis

**Requires Approval** (human review mandatory):
- Email template generation (A-OUT-101)
- Pricing changes (A-PRC-301, future)
- Campaign launches (A-OUT-101)
- Content publishing (A-SEO-203, future)
- Any writes to production sheets

### Data Flow

```
User Request
    ↓
Orchestrator.submitTask(agentId, task, input)
    ↓
1. Create AI_Crew job record (Status: PENDING)
    ↓
2. Run guardrails checks (MAP, GDPR, permissions)
    ↓
3. If guardrails pass → Route to agent
    ↓
4. Agent executes task → Returns output
    ↓
5. Update AI_Crew (Status: DRAFT, output saved)
    ↓
6. If requiresApproval → Wait for human approval
    ├─ Approved → Apply changes (Status: APPROVED, write to production)
    └─ Rejected → Mark rejected (Status: REJECTED, no writes)
    ↓
7. If auto-approved → Apply immediately (Status: APPROVED)
    ↓
8. Log completion to AI_Crew, OS_Logs, OS_Health
```

### Agent Registration System

```typescript
interface AgentDefinition {
  agentId: string;                    // e.g., "A-OUT-101"
  name: string;                       // e.g., "Outreach Sequencer"
  description: string;
  tasks: string[];                    // Supported tasks
  requiresApproval: boolean;          // Does output need approval?
  guardrails: ('MAP' | 'GDPR')[];     // Which guardrails apply
  maxTokens: number;                  // OpenAI token limit
  model: 'gpt-5' | 'gpt-4';          // Which model to use
}
```

**Registered Agents:**
1. A-OUT-101: Outreach Sequencer (approval required, GDPR guardrails)
2. A-SEO-201: Keyword Harvester (auto-approved, no guardrails)
3. A-SEO-202: Cluster Architect (auto-approved, no guardrails)
4. A-PRC-301: Pricing Analyst (approval required, MAP guardrails) - FUTURE
5. A-SOP-401: Stand Ops Bot (auto-approved, no guardrails) - FUTURE
6. A-GRW-501: Growth Writer (approval required, GDPR guardrails) - FUTURE

### API Endpoints

**New Routes:**
```typescript
// Get all registered AI agents
GET /api/ai/agents
Response: AgentDefinition[]

// Submit AI task
POST /api/ai/submit
Body: { agentId: string, task: string, inputJSON: string }
Response: { jobId: string, status: string }

// Get job status
GET /api/ai/jobs/:jobId
Response: AI_Crew record

// List pending approvals
GET /api/ai/approvals/pending
Response: AI_Crew[] (Status: DRAFT, RequiresApproval: true)

// Approve job
POST /api/ai/approvals/:jobId/approve
Response: { success: boolean, applied: boolean }

// Reject job
POST /api/ai/approvals/:jobId/reject
Body: { reason: string }
Response: { success: boolean }
```

### Security & Compliance

**Secrets Protection:**
- All OpenAI API calls use `process.env.AI_INTEGRATIONS_OPENAI_API_KEY`
- No secrets in AI_Crew or AI_Outbox sheets
- API keys never exposed in logs

**GDPR Compliance:**
- Email templates validated for consent language
- Unsubscribe links mandatory
- No pressure tactics or false promises
- Transparent data processing

**MAP Enforcement:**
- All pricing changes validated against MAP_Guardrails
- Violations blocked and logged
- Human approval required for pricing changes

## Implementation Plan

### Phase 1: Core Orchestrator (MVP)
1. Create AI_Crew sheet schema
2. Implement `server/lib/ai-orchestrator.ts`:
   - `submitTask()`
   - `getJobStatus()`
   - `approveJob()`
   - `rejectJob()`
3. Add agent registration system
4. Implement basic guardrails (MAP, GDPR validation functions)

### Phase 2: Integration
1. Refactor existing agents to use orchestrator:
   - Update A-OUT-101 to use submitTask()
   - Update A-SEO-201 to use submitTask()
   - Update A-SEO-202 to use submitTask()
2. Add approval workflow endpoints
3. Test end-to-end with existing agents

### Phase 3: Frontend (AI Hub UI)
1. Build AI Hub page with 4 tabs (Pricing Analyst, Stand Ops, Growth Writer, Ops Assistant)
2. Build AI Crew Outbox Review section:
   - List pending approvals
   - Show draft outputs
   - Approve/Reject/Apply buttons
3. Add real-time job status monitoring

### Phase 4: New Agents (Future)
1. A-PRC-301: Pricing Analyst
2. A-SOP-401: Stand Ops Bot
3. A-GRW-501: Growth Writer
4. A-OPS-601: Ops Assistant

## Technology Stack

- **Language**: TypeScript
- **AI Model**: OpenAI GPT-5 (via javascript_openai_ai_integrations connector)
- **Data Storage**: Google Sheets (AI_Crew sheet)
- **Logging**: OS_Logs, OS_Health, AI_Outbox sheets
- **Frontend**: React + TanStack Query
- **Validation**: Zod schemas

## Success Criteria

1. All AI operations tracked in AI_Crew sheet
2. MAP/GDPR guardrails enforce compliance
3. Human approval workflow functional
4. Draft-only writes prevent accidental production changes
5. All existing agents migrated to orchestrator
6. API endpoints respond < 500ms (excluding AI processing)
7. Zero secrets exposed in sheets
8. 100% audit trail for AI operations

## Notes

- This design preserves existing agent implementations
- Orchestrator acts as coordination layer, not replacement
- Backward compatible with current AI_Outbox logging
- Extensible for future agents without core changes
- Follows principle: "AI drafts, humans approve, system applies"
