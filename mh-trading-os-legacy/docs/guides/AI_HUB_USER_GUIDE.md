# AI Hub User Guide

## What is AI Hub?

AI Hub is your command center for AI-powered tasks across pricing, operations, growth, and support. It features 4 specialized AI agents that help automate complex workflows with human approval before any changes hit production.

## Getting Started

### 1. Navigate to AI Hub

Click **AI Hub** in the left sidebar, or visit `/ai` in your browser.

### 2. Choose Your Agent

Select one of 4 tabs based on your task:

- **Pricing Analyst** - Price analysis, MAP validation, optimization
- **Stand Ops Bot** - Refill planning, stockout predictions
- **Growth Writer** - Email templates, marketing copy, campaigns
- **Ops Assistant** - Reports, email drafts, data analysis

## How to Submit a Task

### Step 1: Describe Your Task

Type your request in plain English (or Arabic):

**Examples:**
- *"Suggest optimal price for SKU123"*
- *"Generate refill plan for Stand S01"*
- *"Draft welcome email for new B2B partners"*
- *"Summarize shipping errors from last 7 days"*

### Step 2: Add Advanced Parameters (Optional)

Click **"Advanced: Optional JSON parameters"** to add structured data:

```json
{
  "sku": "SKU123",
  "targetMargin": 0.25
}
```

This is useful for providing specific data the AI needs.

### Step 3: Click "Explain inputs" for Help

Not sure what to ask? Click the helper icon to see:
- What this agent can do
- Example prompts
- Required vs. optional parameters

### Step 4: Submit

Click **"Submit Task"** button. The system will:
1. Validate your input
2. Run guardrail checks (MAP/GDPR if applicable)
3. Create a job with unique Job ID
4. Show you the result

## Understanding Job Results

After submission, you'll see a status card:

### ✅ Success (Status: DRAFT)
```
Job Submitted
Status: DRAFT

Job ID: AI-abc123def456

Task submitted for approval. Job ID: AI-abc123def456

[View in AI Crew for approval]
```

**What This Means:**
- Your job is waiting for human approval
- Click the link to review and approve in AI Crew
- No changes have been made yet

### ✅ Success (Status: COMPLETED)
```
Job Submitted
Status: COMPLETED

Job ID: AI-xyz789

Task completed successfully
```

**What This Means:**
- Job executed immediately (agent doesn't require approval)
- Check AI Crew Outbox to see results

### ❌ Error (Status: ERROR)
```
Job Submitted
Status: ERROR

Job ID: AI-err456

Guardrail checks failed: MAP violation: Price 45.00€ below MAP 49.99€
```

**What This Means:**
- Guardrails blocked the job
- Read the error message to understand why
- Adjust your input and try again

## Approval Requirements

Some agents require human approval before making changes:

| Agent | Requires Approval | Guardrails |
|-------|-------------------|------------|
| Pricing Analyst | ✅ Yes | MAP |
| Stand Ops Bot | ✅ Yes | None |
| Growth Writer | ✅ Yes | GDPR |
| Ops Assistant | ❌ No | None |

**Why Approval?**
- Pricing changes affect revenue
- Templates must comply with GDPR
- Stand operations impact physical inventory

## What Happens Next?

### For Jobs Requiring Approval:

1. Navigate to **AI Crew** page (`/ai-crew`)
2. Find your job in "Pending Approval" tab
3. Click the job to see details
4. Review:
   - Input parameters
   - AI-generated output
   - Guardrail checks
5. Choose:
   - **Approve** → Changes applied to production sheets
   - **Reject** → Job cancelled, no changes made

### For Jobs Without Approval:

1. Navigate to **AI Crew** page
2. Go to "Completed" tab
3. Click your job to see results
4. Review OutputJSON for AI-generated data

## Agent-Specific Guides

### 1. Pricing Analyst (A-PRICE-301)

**What It Does:**
- Suggests optimal prices based on COGS, MAP, competition
- Validates if proposed prices violate MAP
- Analyzes pricing competitiveness

**Example Tasks:**
- *"Suggest optimal price for SKU123"*
- *"Check if 49.99€ violates MAP for product XYZ"*
- *"Analyze pricing competitiveness for category ABC"*

**Advanced JSON:**
```json
{
  "sku": "SKU123",
  "targetMargin": 0.30,
  "considerCompetition": true
}
```

**Guardrails:**
- ✅ **MAP Validation**: Prevents pricing below Minimum Advertised Price
- ✅ **COGS Check**: Prevents pricing below cost
- ✅ Logs violations to MAP_Guardrails sheet

**Output Example:**
```json
{
  "sku": "SKU123",
  "recommendedPrice": 54.99,
  "reasoning": "Based on 30% margin over COGS (42.30€), below MAP (59.99€), competitive with market median (55.00€)",
  "mapCompliant": true
}
```

### 2. Stand Ops Bot (A-STAND-401)

**What It Does:**
- Generates refill plans for physical stands
- Predicts stockout risks
- Analyzes stand performance metrics

**Example Tasks:**
- *"Generate refill plan for Stand S01"*
- *"Predict stockout risk for Stand S02"*
- *"Analyze performance of all stands in Berlin"*

**Advanced JSON:**
```json
{
  "standId": "S01",
  "daysAhead": 7
}
```

**Output Example:**
```json
{
  "standId": "S01",
  "refillPlan": [
    { "sku": "SKU123", "currentQty": 5, "refillQty": 20, "urgency": "high" },
    { "sku": "SKU456", "currentQty": 15, "refillQty": 10, "urgency": "medium" }
  ],
  "estimatedCost": 450.00,
  "notes": "Prioritize SKU123 due to high sales velocity"
}
```

### 3. Growth Writer (A-GROWTH-501)

**What It Does:**
- Drafts B2B email templates
- Generates marketing campaigns
- Creates social media posts

**Example Tasks:**
- *"Draft welcome email for new B2B partners"*
- *"Create social media post about product launch"*
- *"Write product description for SKU456"*

**Advanced JSON:**
```json
{
  "locale": "de",
  "tone": "professional",
  "includeUnsubscribe": true
}
```

**Guardrails:**
- ✅ **GDPR Compliance**: Ensures unsubscribe link present
- ✅ **Pressure Tactics**: Detects and blocks aggressive language
- ✅ Validates before allowing template creation

**Output Example:**
```json
{
  "templateId": "TPL-abc123",
  "name": "B2B Partner Welcome Email (DE)",
  "subject": "Willkommen bei MH Trading",
  "body": "Sehr geehrte(r)...",
  "locale": "de",
  "gdprCompliant": true
}
```

### 4. Ops Assistant (A-OPS-601)

**What It Does:**
- Generates operational reports
- Drafts response emails
- Analyzes data from various sheets

**Example Tasks:**
- *"Summarize shipping errors from last 7 days"*
- *"Draft response email for customer inquiry about delivery"*
- *"Generate weekly operations report"*

**Advanced JSON:**
```json
{
  "period": "last_7_days",
  "includeCharts": false
}
```

**Output Example:**
```json
{
  "summary": "7 shipping errors detected (5 address issues, 2 carrier delays)",
  "details": [...],
  "recommendations": ["Implement address validation", "Add carrier backup"]
}
```

## Tips & Best Practices

### ✅ Do's

1. **Be Specific**: *"Suggest price for SKU123"* is better than *"Help with pricing"*
2. **Use Examples**: Click "Explain inputs" to see example prompts
3. **Check Guardrails**: Review error messages if job blocked
4. **Review Before Approving**: Always check OutputJSON in AI Crew
5. **Add Notes on Approval**: Document why you approved/rejected

### ❌ Don'ts

1. **Don't Skip Review**: Never approve without checking output
2. **Don't Ignore MAP Violations**: Guardrails exist for a reason
3. **Don't Use for Emergency Changes**: Jobs require approval time
4. **Don't Reuse Job IDs**: Each job is unique
5. **Don't Bypass Guardrails**: Fix the input instead

## Troubleshooting

### Problem: Job Stuck in DRAFT

**Solution:**
1. Go to AI Crew page
2. Find job in "Pending Approval" tab
3. Click job to review
4. Approve or reject

### Problem: Guardrail Blocked My Job

**Solution:**
1. Read error message carefully
2. Common issues:
   - **MAP Violation**: Adjust price above MAP
   - **GDPR Issue**: Add unsubscribe link or remove pressure language
3. Fix input and resubmit

### Problem: Can't Find My Job

**Solution:**
1. Copy Job ID from submission result
2. Go to AI Crew page
3. Use search box to find by Job ID
4. Check all tabs (Pending/Completed/Rejected)

### Problem: Apply Failed After Approval

**Solution:**
1. View job details in AI Crew
2. Check ErrorMsg field
3. Common causes:
   - Invalid OutputJSON format
   - Target sheet missing or locked
4. Contact admin if persists

## Keyboard Shortcuts

(Future enhancement - Command-K palette)

- `Cmd+K` (Mac) / `Ctrl+K` (Windows): Open command palette
- Quick actions:
  - *"Explain price math for SKU123"*
  - *"Open last failed job"*
  - *"Re-run with different params"*

## Support

### Getting Help

1. **Documentation**: Read AI_ORCHESTRATOR_README.md for system details
2. **Admin Tools**: Check `/admin` for system health
3. **OS Health**: View `/health` for orchestrator logs
4. **Contact**: Reach out to system administrator

### Providing Feedback

When reporting issues, include:
- Job ID
- Agent used
- Input provided
- Error message (if any)
- Screenshots of AI Crew job details

## FAQ

**Q: How long do jobs take?**
A: Jobs requiring approval wait for human review. No-approval jobs execute immediately.

**Q: Can I edit a job after submission?**
A: No, but you can reject it and submit a new one with updated parameters.

**Q: What happens if I approve a bad suggestion?**
A: Changes are applied to production sheets. Always review carefully. Use rollback if needed.

**Q: Can multiple people approve jobs?**
A: Yes, any authorized user can approve. The approver is logged in ApprovedBy field.

**Q: Are there usage limits?**
A: Check with admin. Some agents have rate limits or token quotas.

**Q: Can I bulk approve jobs?**
A: Not yet (planned for future release).

## Language Support

The UI supports both English and Arabic:

- Click language toggle in top-right corner
- All prompts can be in either language
- Output language depends on agent and `locale` parameter

## Next Steps

1. Try submitting your first job using Ops Assistant (no approval required)
2. Review the result in AI Crew "Completed" tab
3. Try a job requiring approval (Pricing Analyst)
4. Practice approving/rejecting jobs

Happy automating! 🚀
