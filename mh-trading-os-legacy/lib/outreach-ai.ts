import OpenAI from "openai";
import { sheetsService } from "./sheets";
import { nanoid } from "nanoid";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

interface SuggestTemplateInput {
  locale: "en" | "de";
  productLine?: string;
  tone: "professional" | "friendly";
  variables?: Record<string, string>;
}

interface TemplateOutput {
  subject: string;
  bodyMarkdown: string;
  locale: string;
  notes: string;
}

interface SummarizeRepliesInput {
  threadHTML: string;
}

interface ReplyAnalysis {
  classification: "INTERESTED" | "MAYBE" | "NOT_INTERESTED" | "OUT_OF_OFFICE" | "BOUNCED";
  nextStep: string;
  confidence: number; // 0.0 to 1.0
  reasoning: string;
}

export async function suggestTemplate(input: SuggestTemplateInput): Promise<TemplateOutput> {
  const { locale, productLine, tone, variables } = input;

  const prompt = `You are A-OUT-101 "Outreach Sequencer", an AI assistant specialized in B2B email outreach for trading operations.

Generate a professional email template for outreach campaigns with the following requirements:

**Language**: ${locale === "de" ? "German (Deutsch)" : "English"}
**Tone**: ${tone === "professional" ? "Professional and formal" : "Friendly but professional"}
${productLine ? `**Product Line**: ${productLine}` : ""}
${variables ? `**Available Variables**: ${Object.keys(variables).join(", ")}` : ""}

**CRITICAL GDPR Compliance Rules**:
1. NO false promises or guarantees
2. NO pressure tactics or urgency manipulation
3. Clear value proposition only
4. Must include unsubscribe option reference
5. Honest and transparent language
6. Respect recipient's time and privacy
7. Professional B2B context only

**Template Requirements**:
- Subject line: Concise, value-focused, no spam triggers (max 60 chars)
- Body: 3-4 short paragraphs maximum
- Use merge variables where appropriate: {{first_name}}, {{name}}, {{company}}, {{city}}, {{country}}
- Clear call-to-action
- Professional signature placeholder
- Include unsubscribe link reference: {{unsubscribe_link}}

**Context**: This is for MH Trading OS, a B2B trading platform serving businesses in Germany and Europe. Focus on genuine business value, partnership opportunities, and mutual growth.

Generate the template in valid Markdown format.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are A-OUT-101, a GDPR-compliant B2B email outreach specialist. You generate professional, compliant email templates that respect privacy and provide genuine value."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content) as {
      subject: string;
      body: string;
      notes?: string;
    };

    const templateOutput: TemplateOutput = {
      subject: parsed.subject || "New Business Opportunity",
      bodyMarkdown: parsed.body || "",
      locale,
      notes: parsed.notes || `AI-generated template (A-OUT-101) - ${tone} tone, ${locale.toUpperCase()}, GDPR-compliant`
    };

    await logToAIOutbox({
      agentId: "A-OUT-101",
      task: "suggest-template",
      input: JSON.stringify(input),
      output: JSON.stringify(templateOutput),
      status: "SUCCESS"
    });

    await sheetsService.writeOSHealth(
      "A-OUT-101 Template",
      "PASS",
      `Generated ${locale} template (${tone})`,
      { locale, tone, productLine: productLine || "none" }
    );

    return templateOutput;
  } catch (error: any) {
    console.error('[A-OUT-101] Template suggestion failed:', error);
    
    await logToAIOutbox({
      agentId: "A-OUT-101",
      task: "suggest-template",
      input: JSON.stringify(input),
      output: "",
      status: "ERROR",
      errorMessage: error.message
    });

    await sheetsService.writeOSHealth(
      "A-OUT-101 Template",
      "FAIL",
      `Template generation failed: ${error.message}`,
      { locale: input.locale, tone: input.tone }
    );

    throw new Error(`Template generation failed: ${error.message}`);
  }
}

export async function summarizeReplies(input: SummarizeRepliesInput): Promise<ReplyAnalysis> {
  const { threadHTML } = input;

  const prompt = `You are A-OUT-101 "Outreach Sequencer", analyzing email replies for B2B outreach campaigns.

Analyze the following email thread and classify the recipient's response:

**Email Thread**:
${threadHTML}

**Classification Categories**:
1. **INTERESTED**: Recipient shows genuine interest, asks questions, wants more info, or requests a meeting
2. **MAYBE**: Not interested currently but open to future contact, timing issue, currently satisfied
3. **NOT_INTERESTED**: Explicitly requests to be removed, not interested ever, angry/hostile response
4. **OUT_OF_OFFICE**: Automatic out-of-office reply, vacation notice, will respond later
5. **BOUNCED**: Email bounced, invalid address, delivery failure notification

**Your Task**:
1. Classify the reply into ONE of the five categories above (must match exactly: INTERESTED, MAYBE, NOT_INTERESTED, OUT_OF_OFFICE, or BOUNCED)
2. Provide a clear next step recommendation
3. Rate your confidence (0.0 to 1.0, where 1.0 is 100% confident)
4. Explain your reasoning briefly

Respond with valid JSON matching this schema:
{
  "classification": "INTERESTED" | "MAYBE" | "NOT_INTERESTED" | "OUT_OF_OFFICE" | "BOUNCED",
  "nextStep": "Specific action recommendation",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are A-OUT-101, a B2B email response analyzer. You classify replies accurately and suggest appropriate next steps."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const analysis = JSON.parse(content) as ReplyAnalysis;

    await logToAIOutbox({
      agentId: "A-OUT-101",
      task: "summarize-replies",
      input: JSON.stringify({ threadHTML: threadHTML.substring(0, 500) + "..." }),
      output: JSON.stringify(analysis),
      status: "SUCCESS"
    });

    await sheetsService.writeOSHealth(
      "A-OUT-101 Replies",
      "PASS",
      `Analyzed reply: ${analysis.classification} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`,
      { classification: analysis.classification, confidence: analysis.confidence }
    );

    return analysis;
  } catch (error: any) {
    console.error('[A-OUT-101] Reply analysis failed:', error);
    
    await logToAIOutbox({
      agentId: "A-OUT-101",
      task: "summarize-replies",
      input: JSON.stringify({ threadHTML: "ERROR" }),
      output: "",
      status: "ERROR",
      errorMessage: error.message
    });

    await sheetsService.writeOSHealth(
      "A-OUT-101 Replies",
      "FAIL",
      `Reply analysis failed: ${error.message}`
    );

    throw new Error(`Reply analysis failed: ${error.message}`);
  }
}

async function logToAIOutbox(log: {
  agentId: string;
  task: string;
  input: string;
  output: string;
  status: "SUCCESS" | "ERROR";
  errorMessage?: string;
}) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      JobID: `AI-${nanoid(10)}`,
      Timestamp: timestamp,
      AgentID: log.agentId,
      Task: log.task,
      InputJSON: log.input,
      OutputJSON: log.output,
      Status: log.status,
      ErrorMsg: log.errorMessage || "",
      Notes: `${log.agentId} ${log.task} - ${log.status}`
    };

    await sheetsService.writeRows("AI_Outbox", [logEntry]);
  } catch (error) {
    console.error('[A-OUT-101] Failed to log to AI_Outbox:', error);
  }
}

export async function saveTemplateToSheet(template: TemplateOutput & { name: string }): Promise<string> {
  try {
    const { submitTask } = await import('./ai-orchestrator');
    const templateId = `TPL-${nanoid(8)}`;

    const outputJSON = JSON.stringify({
      templateId,
      name: template.name,
      subject: template.subject,
      body: template.bodyMarkdown,
      locale: template.locale
    });

    const jobId = await submitTask({
      agentId: 'A-OUT-101',
      task: 'suggest-template',
      inputJSON: JSON.stringify({ name: template.name, locale: template.locale }),
      outputJSON,
      requiresApproval: true,
      notes: template.notes || 'AI-generated template via A-OUT-101'
    });

    await sheetsService.writeOSHealth(
      "A-OUT-101 Save",
      "PASS",
      `Template submitted for approval: ${template.name} (${template.locale})`,
      { jobId, templateId, locale: template.locale }
    );

    return jobId;
  } catch (error: any) {
    console.error('[A-OUT-101] Failed to submit template:', error);
    
    await sheetsService.writeOSHealth(
      "A-OUT-101 Save",
      "FAIL",
      `Failed to submit template: ${error.message}`
    );

    throw new Error(`Failed to submit template: ${error.message}`);
  }
}

export async function draftCampaign(input: {
  name: string;
  productLine?: string;
  targetAudience?: string;
  locale: "en" | "de";
}): Promise<{ goal: string; audienceQueryJSON: string }> {
  const prompt = `You are A-OUT-101 "Outreach Sequencer", helping draft a B2B email campaign.

Generate a campaign goal and audience query for:

**Campaign Name**: ${input.name}
${input.productLine ? `**Product Line**: ${input.productLine}` : ""}
${input.targetAudience ? `**Target Audience**: ${input.targetAudience}` : ""}
**Locale**: ${input.locale}

**Task**:
1. Write a clear campaign goal (1-2 sentences describing what this campaign aims to achieve)
2. Generate an audience query JSON for filtering leads/partners from:
   - CRM_Leads (fields: City, Country, Status, Score, Industry)
   - PartnerRegistry (fields: City, Country, Tier, ActiveFlag)

Example audience query:
{
  "source": "CRM_Leads",
  "filters": {
    "City": "Berlin",
    "ScoreMin": 60,
    "Status": "NEW"
  }
}

Respond with valid JSON:
{
  "goal": "Campaign goal description",
  "audienceQuery": { audience query object }
}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are A-OUT-101, a campaign planning specialist. You create clear goals and precise audience targeting."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const result = JSON.parse(content) as {
      goal: string;
      audienceQuery: any;
    };

    const output = {
      goal: result.goal || "New outreach campaign",
      audienceQueryJSON: JSON.stringify(result.audienceQuery || {})
    };

    await sheetsService.writeOSHealth(
      "A-OUT-101 Campaign",
      "PASS",
      `Drafted campaign: ${input.name} (${input.locale})`,
      { name: input.name, locale: input.locale }
    );

    return output;
  } catch (error: any) {
    console.error('[A-OUT-101] Campaign draft failed:', error);
    
    await sheetsService.writeOSHealth(
      "A-OUT-101 Campaign",
      "FAIL",
      `Campaign draft failed: ${error.message}`,
      { name: input.name }
    );

    throw new Error(`Campaign draft failed: ${error.message}`);
  }
}
