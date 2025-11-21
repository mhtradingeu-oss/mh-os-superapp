# AI Multi-Agent System - Expansion Guide

## Overview

This system implements a production-grade multi-agent AI framework with draft-based approval workflows and comprehensive guardrails. The core foundation includes 5 working agents that serve as templates for expansion to the full 16-agent system.

## Architecture

### Core Components

1. **Agent Registry** (`server/lib/ai-agent-registry.ts`)
   - Central registry of all AI agents
   - Defines agent capabilities, tasks, guardrails, and scheduling

2. **Guardrails System** (`server/lib/ai-guardrails.ts`)
   - MAP compliance (pricing)
   - GDPR compliance (outreach/marketing)
   - Brand voice validation
   - Budget limits
   - Extensible for custom rules

3. **Approval Workflow** (`server/lib/ai-approval-workflow.ts`)
   - Draft → Approval → Production pipeline
   - Prevents direct writes to production sheets
   - Full audit trail via AI_Jobs table

4. **Agent Implementations** (`server/lib/ai-agents/`)
   - Individual agent logic
   - Task-specific implementations
   - Guardrail integration

## Core Agents (Implemented)

### 1. Pricing Agent (A-PRC-100)
**Department:** Pricing  
**Tasks:**
- `suggest-price-changes`: Analyzes competitor data and suggests price optimizations
- `analyze-competitive-pricing`: Market analysis
- `validate-map-compliance`: Ensures MAP compliance
- `optimize-margins`: Margin optimization

**Guardrails:**
- MAP compliance check
- Margin floor validation
- Competitor ceiling

**Draft Table:** `Pricing_Suggestions_Draft`  
**Production Table:** `Pricing_Suggestions`

**Schedule:** Daily at 6 AM (`0 6 * * *`)

### 2. Outreach Agent (A-OUT-101)
**Department:** Growth  
**Tasks:**
- `generate-email-template`: Creates personalized email templates
- `create-sequence`: Multi-step outreach sequences
- `suggest-followup`: Follow-up recommendations
- `analyze-performance`: Campaign analytics

**Guardrails:**
- GDPR compliance (unsubscribe links)
- Spam detection
- Brand voice validation

**Draft Table:** `Outreach_Templates_Draft`  
**Production Table:** `Outreach_Templates`

**Schedule:** On-demand

### 3. Social Media Agent (A-SOC-102)
**Department:** Marketing  
**Tasks:**
- `suggest-post`: Generate social media content
- `plan-calendar`: 2-week content calendar
- `generate-captions`: Instagram/Facebook captions
- `analyze-engagement`: Performance metrics

**Guardrails:**
- Brand guidelines
- Content policy
- Hashtag limits

**Draft Table:** `Social_Calendar_Draft`  
**Production Table:** `Social_Calendar`

**Schedule:** Weekly on Monday at 9 AM (`0 9 * * 1`)

### 4. SEO Agent (A-SEO-103)
**Department:** Marketing  
**Tasks:**
- `harvest-keywords`: Keyword research
- `analyze-serp`: SERP analysis
- `suggest-content`: Content recommendations
- `track-rankings`: Ranking monitoring

**Guardrails:**
- Keyword relevance
- Content quality
- No keyword stuffing

**Draft Table:** `SEO_Keywords_Draft`  
**Production Table:** `SEO_Keywords`

**Schedule:** Weekly on Sunday at 7 AM (`0 7 * * 0`)

### 5. CRM Agent (A-CRM-104)
**Department:** Sales  
**Tasks:**
- `enrich-lead`: Lead data enrichment
- `assign-territory`: Territory assignment
- `suggest-next-action`: Next best action
- `score-lead`: Lead scoring

**Guardrails:**
- Data privacy compliance
- Duplicate detection
- Valid contact info

**Draft Table:** `CRM_Leads_Draft`  
**Production Table:** `CRM_Leads`

**Schedule:** Every 4 hours (`0 */4 * * *`)

## Additional Agents (To Be Implemented)

### 6. Growth Agent (A-GRW-105)
**Department:** Growth  
**Focus:** A/B testing, conversion optimization, funnel analysis

### 7. Ads Agent (A-ADS-106)
**Department:** Marketing  
**Focus:** Google/Meta ads optimization, budget allocation

### 8. E-commerce Agent (A-ECO-107)
**Department:** Sales  
**Focus:** Product listings, inventory sync, marketplace management

### 9. Stand Ops Agent (A-OPS-108)
**Department:** Operations  
**Focus:** Inventory planning, refill schedules, stockout prediction

### 10. Logistics Agent (A-LOG-109)
**Department:** Operations  
**Focus:** Shipping optimization, carrier selection, route planning

### 11. Finance Agent (A-FIN-110)
**Department:** Finance  
**Focus:** Invoice generation, payment tracking, AR/AP

### 12. Legal Agent (A-LEG-111)
**Department:** Legal  
**Focus:** Contract review, compliance checks, terms validation

### 13. Executive Assistant (A-EXE-112)
**Department:** Executive  
**Focus:** Report generation, meeting prep, executive summaries

### 14. DevOps Agent (A-DEV-113)
**Department:** Technology  
**Focus:** System monitoring, error detection, performance alerts

### 15. QA Agent (A-QA-114)
**Department:** Quality  
**Focus:** Data validation, quality checks, anomaly detection

### 16. Moderator Agent (A-MOD-115)
**Department:** Orchestration  
**Focus:** Multi-agent workflows, task coordination, conflict resolution

## How to Add a New Agent (Step-by-Step)

### Step 1: Define Agent in Registry

Edit `server/lib/ai-agent-registry.ts`:

```typescript
{
  AgentID: 'A-XXX-1XX',
  Name: 'Your Agent Name',
  Department: 'Department',
  Description: 'What this agent does',
  TasksJSON: JSON.stringify([
    'task-1',
    'task-2',
    'task-3'
  ]),
  GuardrailsJSON: JSON.stringify([
    'guardrail-1',
    'guardrail-2'
  ]),
  RequiresApproval: true,
  ModelSettings: JSON.stringify({
    model: 'gpt-4',
    temperature: 0.5,
    maxTokens: 2000
  }),
  Active: true,
  ScheduleCron: '0 6 * * *', // Or undefined for on-demand
  Notes: 'Additional context'
}
```

### Step 2: Create Draft Table Schema

Edit `shared/schema.ts`:

```typescript
// YourFeature_Draft - Draft data before approval
export const yourFeatureDraftSchema = z.object({
  FeatureID: z.string(),
  JobID: z.string(), // Link to AI_Jobs
  // ... your fields
  CreatedTS: z.string().optional(),
  Status: z.string().optional(),
  Notes: z.string().optional(),
});
export type YourFeatureDraft = z.infer<typeof yourFeatureDraftSchema>;
```

### Step 3: Implement Agent Logic

Create `server/lib/ai-agents/your-agent.ts`:

```typescript
import { nanoid } from 'nanoid';
import type { GoogleSheetsService } from '../sheets';
import { runGuardrails } from '../ai-guardrails';
import { createDraftJob } from '../ai-approval-workflow';

export interface YourTaskInput {
  // Input parameters
}

export async function yourTask(
  sheetsService: GoogleSheetsService,
  input: YourTaskInput
): Promise<{ jobId: string; results: any; guardrailsPassed: boolean }> {
  const now = new Date().toISOString();
  
  // 1. Fetch data from sheets
  const data = await sheetsService.readSheet<any>('YourSheet');
  
  // 2. Process / generate results (call OpenAI if needed)
  const results = processData(data, input);
  
  // 3. Run guardrails
  const guardrailResult = await runGuardrails(
    'A-XXX-1XX',
    'your-task',
    { /* guardrail data */ },
    sheetsService
  );
  
  // 4. Create draft job
  const jobId = await createDraftJob(
    sheetsService,
    'A-XXX-1XX',
    'your-task',
    JSON.stringify(input),
    JSON.stringify({ results, guardrailResult }),
    guardrailResult.passed,
    true
  );
  
  // 5. Write to draft table
  const drafts = results.map(r => ({ ...r, JobID: jobId }));
  await sheetsService.writeRows('YourFeature_Draft', drafts);
  
  return { jobId, results, guardrailsPassed: guardrailResult.passed };
}
```

### Step 4: Add Route Handler

Edit `server/routes-ai.ts`:

```typescript
router.post("/submit", async (req, res) => {
  try {
    const validated = submitTaskSchema.parse(req.body);
    
    // Add your agent routing
    if (validated.agentId.startsWith('A-XXX-')) {
      const { yourTask } = await import('./lib/ai-agents/your-agent');
      const result = await yourTask(
        (await import('./sheets')).sheetsService,
        validated.input
      );
      return res.json(result);
    }
    
    // ... existing routes
  } catch (error: any) {
    // ... error handling
  }
});
```

### Step 5: Add Custom Guardrails (If Needed)

Edit `server/lib/ai-guardrails.ts`:

```typescript
export function checkYourCustomGuardrail(
  data: YourDataType
): GuardrailResult {
  const violations: string[] = [];
  const warnings: string[] = [];
  
  // Your validation logic
  if (/* violation condition */) {
    violations.push('Violation message');
  }
  
  return {
    passed: violations.length === 0,
    violations,
    warnings
  };
}

// Add to runGuardrails function
if (agentId.startsWith('A-XXX-')) {
  const result = checkYourCustomGuardrail(data.yourData);
  allViolations.push(...result.violations);
  allWarnings.push(...result.warnings);
}
```

### Step 6: Update Approval Tables Mapping

Edit `server/routes-ai.ts` in `getDraftProductionTables`:

```typescript
function getDraftProductionTables(agentId: string, task: string) {
  // ... existing mappings
  
  if (agentId.startsWith('A-XXX-')) {
    return {
      draftTable: 'YourFeature_Draft',
      productionTable: 'YourFeature'
    };
  }
  
  // ... default
}
```

### Step 7: Create UI Tab (Frontend)

Edit `client/src/pages/ai-hub.tsx`:

```tsx
// Add to tabs array
{
  id: 'your-agent',
  label: 'Your Agent',
  agentId: 'A-XXX-1XX'
}

// Add dashboard component
function YourAgentDashboard({ agentId }: { agentId: string }) {
  return (
    <div>
      <h2>Your Agent Dashboard</h2>
      {/* Agent-specific UI */}
    </div>
  );
}
```

## Workflow: How Agents Operate

```
1. USER REQUEST (via UI or schedule)
   ↓
2. AGENT EXECUTION
   - Fetch data from Google Sheets
   - Process with business logic or OpenAI
   - Generate draft changes
   ↓
3. GUARDRAILS CHECK
   - MAP compliance
   - GDPR compliance
   - Brand guidelines
   - Budget limits
   - Custom rules
   ↓
4. WRITE TO DRAFT TABLE
   - Agent_Feature_Draft (e.g., Pricing_Suggestions_Draft)
   - Create job in AI_Jobs with status='DRAFT'
   ↓
5. HUMAN APPROVAL (via /ai-crew page)
   - Review changes
   - View diffs
   - Approve or Reject
   ↓
6. APPLY TO PRODUCTION (if approved)
   - Copy from Draft table to Production table
   - Update AI_Jobs status='APPROVED'
   - Audit trail complete
```

## Google Sheets Required

### Core Tables (Must Exist)
- `AI_Agents`: Agent registry
- `AI_Jobs`: Job tracking
- `AI_Playbooks`: Automated workflows

### Draft Tables (Created as needed)
- `Pricing_Suggestions_Draft`
- `CRM_Leads_Draft`
- `Social_Calendar_Draft`
- `SEO_Keywords_Draft`
- `Outreach_Templates_Draft`

### Production Tables (Your existing sheets)
- `Pricing_Suggestions`
- `CRM_Leads`
- `Social_Calendar`
- `SEO_Keywords`
- `Outreach_Templates`

## Testing a New Agent

```bash
# 1. Submit a task
curl -X POST http://localhost:5000/api/ai/submit \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "A-PRC-100",
    "task": "suggest-price-changes",
    "input": {
      "skus": ["SKU-001"],
      "marginTarget": 25
    }
  }'

# Response:
# {
#   "jobId": "JOB-abc123",
#   "suggestions": 5,
#   "guardrailsPassed": true
# }

# 2. Check pending approvals
curl http://localhost:5000/api/ai/approvals/pending

# 3. Approve the job
curl -X POST http://localhost:5000/api/ai/approvals/JOB-abc123/approve \
  -H "Content-Type: application/json" \
  -d '{
    "approvedBy": "admin@example.com"
  }'

# 4. Verify data in production table
# Check Google Sheets: Pricing_Suggestions
```

## Security & Compliance

### Guardrails Prevent:
✅ Price changes below MAP minimums  
✅ Emails without unsubscribe links (GDPR)  
✅ Content violating brand guidelines  
✅ Budget overruns  
✅ Unauthorized data access  

### Audit Trail Includes:
- Who requested the task
- When it was executed
- What guardrails were run
- Who approved/rejected
- When changes were applied to production

## Scheduling

Agents can run on schedules using cron expressions:

```
'0 6 * * *'      // Daily at 6 AM
'0 9 * * 1'      // Monday at 9 AM
'0 */4 * * *'    // Every 4 hours
'0 7 * * 0'      // Sunday at 7 AM
```

Implement scheduling using a cron job runner or cloud scheduler that calls:

```bash
POST /api/ai/submit
{
  "agentId": "A-PRC-100",
  "task": "suggest-price-changes",
  "input": {},
  "requestedBy": "scheduler"
}
```

## Common Patterns

### Pattern 1: Data Enrichment Agent
Reads from one table, enriches, writes to draft, requires approval

### Pattern 2: Content Generation Agent
Takes input parameters, calls OpenAI, writes content drafts, approval workflow

### Pattern 3: Analytics Agent
Analyzes existing data, generates insights, writes recommendations

### Pattern 4: Monitoring Agent
Checks thresholds, detects anomalies, creates alerts/tasks

## Best Practices

1. **Always use draft tables** - Never write directly to production
2. **Run all guardrails** - Compliance first
3. **Descriptive job names** - Easy to understand in approval queue
4. **Clear violation messages** - Help users understand what failed
5. **Test with sample data** - Before enabling scheduling
6. **Monitor guardrail pass rates** - Tune if too many failures
7. **Keep agents focused** - One agent, one department
8. **Document assumptions** - In agent description and notes

## Troubleshooting

### Agent not showing in /ai page
- Check CORE_AGENTS in `ai-agent-registry.ts`
- Verify Active=true
- Check frontend tabs array

### Guardrails always failing
- Check guardrail logic in `ai-guardrails.ts`
- Verify input data format
- Check thresholds (MAP minimums, margin floors)

### Approval not applying to production
- Verify draft table exists
- Check getDraftProductionTables mapping
- Ensure JobID field exists in draft records

### Agent tasks timing out
- Reduce batch size
- Optimize sheet reads (use caching)
- Increase OpenAI timeout

## Next Steps

1. **Implement remaining 11 agents** using the template above
2. **Create Google Sheets tables** for all draft/production tables
3. **Build UI dashboards** for each agent in /ai page
4. **Set up scheduling** for automated agents
5. **Monitor and tune** guardrails based on real usage

## Support

For questions or issues:
1. Review this guide
2. Check existing agent implementations
3. Test with small datasets first
4. Review AI_Jobs table for error messages
