import type { AIAgent } from '@shared/schema';

/**
 * AI Agent Registry - Core 5 Agents (Template for 16-agent expansion)
 * 
 * ARCHITECTURE:
 * - Each agent has a unique ID, department, and set of tasks
 * - Agents write to *_Draft tables, never directly to production
 * - All changes require approval workflow unless explicitly configured otherwise
 * - Guardrails check compliance before draft creation
 * 
 * EXPANSION GUIDE:
 * To add new agents (6-16), follow this pattern:
 * 1. Add agent definition to CORE_AGENTS array
 * 2. Create corresponding draft table schema in shared/schema.ts
 * 3. Implement agent logic in server/lib/ai-agents/[agent-name].ts
 * 4. Add routes to server/routes-ai.ts
 * 5. Add UI tab in client/src/pages/ai-hub.tsx
 */

export const CORE_AGENTS: AIAgent[] = [
  {
    AgentID: 'A-PRC-100',
    Name: 'Pricing Agent',
    Department: 'Pricing',
    Description: 'Analyzes market data and suggests optimal pricing adjustments',
    TasksJSON: JSON.stringify([
      'analyze-competitive-pricing',
      'suggest-price-changes',
      'validate-map-compliance',
      'optimize-margins'
    ]),
    GuardrailsJSON: JSON.stringify([
      'map-compliance',
      'margin-floor',
      'competitor-ceiling'
    ]),
    RequiresApproval: true,
    ModelSettings: JSON.stringify({
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 2000
    }),
    Active: true,
    ScheduleCron: '0 6 * * *', // Daily at 6 AM
    Notes: 'Primary agent for pricing optimization'
  },
  {
    AgentID: 'A-OUT-101',
    Name: 'Outreach Agent',
    Department: 'Growth',
    Description: 'Generates personalized outreach emails and manages campaigns',
    TasksJSON: JSON.stringify([
      'generate-email-template',
      'create-sequence',
      'suggest-followup',
      'analyze-performance'
    ]),
    GuardrailsJSON: JSON.stringify([
      'gdpr-compliance',
      'spam-check',
      'brand-voice'
    ]),
    RequiresApproval: true,
    ModelSettings: JSON.stringify({
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1500
    }),
    Active: true,
    ScheduleCron: undefined,
    Notes: 'Handles cold outreach and nurture sequences'
  },
  {
    AgentID: 'A-SOC-102',
    Name: 'Social Media Agent',
    Department: 'Marketing',
    Description: 'Creates social media content and manages posting calendar',
    TasksJSON: JSON.stringify([
      'suggest-post',
      'plan-calendar',
      'generate-captions',
      'analyze-engagement'
    ]),
    GuardrailsJSON: JSON.stringify([
      'brand-guidelines',
      'content-policy',
      'hashtag-limits'
    ]),
    RequiresApproval: true,
    ModelSettings: JSON.stringify({
      model: 'gpt-4',
      temperature: 0.8,
      maxTokens: 1000
    }),
    Active: true,
    ScheduleCron: '0 9 * * 1', // Monday at 9 AM (weekly planning)
    Notes: 'Manages Instagram, Facebook, LinkedIn content'
  },
  {
    AgentID: 'A-SEO-103',
    Name: 'SEO Agent',
    Department: 'Marketing',
    Description: 'Harvests keywords, optimizes content, and tracks rankings',
    TasksJSON: JSON.stringify([
      'harvest-keywords',
      'analyze-serp',
      'suggest-content',
      'track-rankings'
    ]),
    GuardrailsJSON: JSON.stringify([
      'keyword-relevance',
      'content-quality',
      'no-keyword-stuffing'
    ]),
    RequiresApproval: true,
    ModelSettings: JSON.stringify({
      model: 'gpt-4',
      temperature: 0.5,
      maxTokens: 2500
    }),
    Active: true,
    ScheduleCron: '0 7 * * 0', // Sunday at 7 AM (weekly analysis)
    Notes: 'Focuses on organic search optimization'
  },
  {
    AgentID: 'A-CRM-104',
    Name: 'CRM Agent',
    Department: 'Sales',
    Description: 'Enriches leads, assigns territories, and tracks touchpoints',
    TasksJSON: JSON.stringify([
      'enrich-lead',
      'assign-territory',
      'suggest-next-action',
      'score-lead'
    ]),
    GuardrailsJSON: JSON.stringify([
      'data-privacy',
      'duplicate-check',
      'valid-contact-info'
    ]),
    RequiresApproval: false, // Auto-approve enrichment, but not data changes
    ModelSettings: JSON.stringify({
      model: 'gpt-4',
      temperature: 0.3,
      maxTokens: 1500
    }),
    Active: true,
    ScheduleCron: '0 */4 * * *', // Every 4 hours
    Notes: 'Automated lead enrichment and routing'
  }
];

/**
 * ADDITIONAL AGENTS (6-16) - To be implemented:
 * 
 * A-GRW-105: Growth Agent - A/B testing, conversion optimization
 * A-ADS-106: Ads Agent - Google/Meta ads optimization
 * A-ECO-107: E-commerce Agent - Product listings, inventory sync
 * A-OPS-108: Stand Ops Agent - Inventory planning, refill schedules
 * A-LOG-109: Logistics Agent - Shipping optimization, carrier selection
 * A-FIN-110: Finance Agent - Invoice generation, payment tracking
 * A-LEG-111: Legal Agent - Contract review, compliance checks
 * A-EXE-112: Executive Assistant - Report generation, meeting prep
 * A-DEV-113: DevOps Agent - System monitoring, error detection
 * A-QA-114: QA Agent - Data validation, quality checks
 * A-MOD-115: Moderator Agent - Orchestrates multi-agent workflows
 */

export function getAgentById(agentId: string): AIAgent | undefined {
  return CORE_AGENTS.find(a => a.AgentID === agentId);
}

export function getAgentsByDepartment(department: string): AIAgent[] {
  return CORE_AGENTS.filter(a => a.Department === department);
}

export function getActiveAgents(): AIAgent[] {
  return CORE_AGENTS.filter(a => a.Active);
}

export function getScheduledAgents(): AIAgent[] {
  return CORE_AGENTS.filter(a => a.Active && a.ScheduleCron);
}
