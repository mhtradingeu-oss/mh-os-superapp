/**
 * Outreach Assistant Agent - مساعد التواصل
 * Helps create personalized communication for partner engagement
 */

import { createLogger } from '../../../../lib/logger';
import { generateAIResponse } from '../../../../lib/openai';

const logger = createLogger('OutreachAssistant');

export interface OutreachMessage {
  id: string;
  type: 'Email' | 'SMS' | 'Letter' | 'Call Script';
  purpose: 'Welcome' | 'Check-in' | 'Issue Alert' | 'Performance Update' | 'Contract Renewal' | 'Celebration' | 'Training' | 'Support';
  recipient: string;
  subject?: string;
  content: string;
  tone: 'Professional' | 'Friendly' | 'Urgent' | 'Celebratory' | 'Supportive';
  callsToAction: string[];
  generatedAt: string;
}

export interface OutreachRecommendation {
  standId: string;
  priority: 'Urgent' | 'High' | 'Medium' | 'Low';
  suggestedMessages: OutreachMessage[];
  aiInsights: string[];
  bestTimeToContact?: string;
  channelRecommendation?: string;
}

export class OutreachAssistantAgent {
  /**
   * Generate personalized outreach recommendations
   */
  async generateOutreach(
    standId: string,
    stand: any,
    purpose: string,
    context?: {
      performance?: any;
      issues?: string[];
      achievements?: string[];
      contract?: any;
    }
  ): Promise<OutreachRecommendation> {
    try {
      logger.info({ standId, purpose }, 'Generating outreach recommendation');

      // Generate appropriate messages
      const messages = await this.generateMessages(standId, stand, purpose, context);

      // Get AI insights
      const aiInsights = await this.getAIOutreachInsights(standId, stand, purpose, context);

      // Determine priority
      const priority = this.determinePriority(purpose, context);

      // Best time and channel recommendations
      const bestTimeToContact = this.recommendContactTime(purpose);
      const channelRecommendation = this.recommendChannel(purpose, context);

      const recommendation: OutreachRecommendation = {
        standId,
        priority,
        suggestedMessages: messages,
        aiInsights,
        bestTimeToContact,
        channelRecommendation,
      };

      logger.info({ standId, messagesCount: messages.length }, 'Outreach recommendation generated');
      return recommendation;
    } catch (error: any) {
      logger.error({ err: error, standId }, 'Failed to generate outreach');
      
      // Return fallback recommendation instead of throwing
      return {
        standId,
        priority: 'Medium',
        suggestedMessages: [{
          id: `MSG-${Date.now()}-FALLBACK`,
          type: 'Email',
          purpose: 'Check-in',
          recipient: stand.Owner || 'Partner',
          subject: 'Update from MH Trading',
          content: 'Dear Partner, We wanted to reach out regarding your stand. Please contact us for more details.',
          tone: 'Professional',
          callsToAction: ['Contact your account manager'],
          generatedAt: new Date().toISOString(),
        }],
        aiInsights: ['Unable to generate personalized outreach - using fallback'],
        bestTimeToContact: 'Business hours',
        channelRecommendation: 'Email',
      };
    }
  }

  /**
   * Generate personalized messages
   */
  private async generateMessages(
    standId: string,
    stand: any,
    purpose: string,
    context?: any
  ): Promise<OutreachMessage[]> {
    const messages: OutreachMessage[] = [];

    try {
      // Generate AI-powered personalized message
      const aiMessage = await this.generateAIMessage(standId, stand, purpose, context);
      if (aiMessage) {
        messages.push(aiMessage);
      }

      // Generate template-based backup message
      const templateMessage = this.generateTemplateMessage(standId, stand, purpose, context);
      if (templateMessage) {
        messages.push(templateMessage);
      }

      return messages;
    } catch (error: any) {
      logger.warn({ err: error }, 'Failed to generate some messages');
      
      // Fallback to template only
      const templateMessage = this.generateTemplateMessage(standId, stand, purpose, context);
      return templateMessage ? [templateMessage] : [];
    }
  }

  /**
   * Generate AI-powered personalized message
   */
  private async generateAIMessage(
    standId: string,
    stand: any,
    purpose: string,
    context?: any
  ): Promise<OutreachMessage | null> {
    try {
      const issuesSummary = context?.issues ? context.issues.slice(0, 3).join(', ') : '';
      const achievementsSummary = context?.achievements ? context.achievements.slice(0, 3).join(', ') : '';
      
      const prompt = `Outreach AI for ${stand.SalonName || 'Partner'} (${standId}): ${purpose}
${issuesSummary ? `Issues: ${issuesSummary}` : ''}
${achievementsSummary ? `Achievements: ${achievementsSummary}` : ''}

Generate email JSON: {"subject": "string", "body": "150 words", "callsToAction": ["action1", "action2"]}`;

      const response = await generateAIResponse(prompt);
      const data = JSON.parse(response);

      return {
        id: `MSG-${Date.now()}-AI`,
        type: 'Email',
        purpose: this.mapPurpose(purpose),
        recipient: stand.Owner || 'Partner',
        subject: data.subject,
        content: data.body,
        tone: this.determineTone(purpose),
        callsToAction: data.callsToAction || [],
        generatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.warn({ err: error }, 'Failed to generate AI message');
      return null;
    }
  }

  /**
   * Generate template-based message
   */
  private generateTemplateMessage(
    standId: string,
    stand: any,
    purpose: string,
    context?: any
  ): OutreachMessage | null {
    const templates: Record<string, any> = {
      'Welcome': {
        subject: `Welcome to MH Trading Partnership - ${stand.SalonName}`,
        body: `Dear ${stand.Owner || 'Partner'},

Welcome to MH Trading! We're excited to have you as our partner in ${stand.City}.

Your stand (${standId}) is now active and ready to start generating revenue. Our team is here to support you every step of the way.

We've prepared initial inventory and resources to help you get started. Please review the attached materials and don't hesitate to reach out if you have any questions.

Looking forward to a successful partnership!

Best regards,
MH Trading Partnership Team`,
        callsToAction: [
          'Review your initial inventory',
          'Complete partner onboarding',
          'Schedule kickoff call',
        ],
      },
      'Check-in': {
        subject: `Partner Check-in - ${stand.SalonName}`,
        body: `Dear ${stand.Owner || 'Partner'},

Hope you're doing well! We wanted to check in and see how things are going with your stand in ${stand.City}.

${context?.performance ? `
Your recent performance shows:
- Revenue: €${context.performance.RevenueGross || 0}
- Sell-through: ${context.performance['SellThrough%'] || 0}%

${context.performance.RevenueGross > 1000 ? "Great job on the strong sales!" : "Let's discuss strategies to boost sales."}
` : ''}

We're here to support you. Please let us know if there's anything you need or any challenges you're facing.

Best regards,
MH Trading Team`,
        callsToAction: [
          'Share any feedback or concerns',
          'Request inventory refill if needed',
          'Schedule support call',
        ],
      },
      'Issue Alert': {
        subject: `Action Required - ${stand.SalonName} Stand`,
        body: `Dear ${stand.Owner || 'Partner'},

We've identified some issues that require your attention:

${context?.issues ? context.issues.map((issue: string) => `• ${issue}`).join('\n') : '• Please review stand performance'}

We're committed to helping you resolve these issues quickly. Our team is ready to provide support and guidance.

Please respond within 24-48 hours so we can address these matters together.

Best regards,
MH Trading Support Team`,
        callsToAction: [
          'Review and acknowledge issues',
          'Contact support team',
          'Implement corrective actions',
        ],
      },
      'Performance Update': {
        subject: `Performance Update - ${stand.SalonName}`,
        body: `Dear ${stand.Owner || 'Partner'},

Here's your latest performance summary for ${stand.SalonName}:

${context?.performance ? `
📊 Key Metrics:
- Revenue: €${context.performance.RevenueGross || 0}
- Sell-Through: ${context.performance['SellThrough%'] || 0}%
- Stockouts: ${context.performance.Stockouts || 0}
` : ''}

${context?.achievements && context.achievements.length > 0 ? `
🎉 Achievements:
${context.achievements.map((a: string) => `• ${a}`).join('\n')}
` : ''}

Keep up the great work! Let us know if you need any support to maintain this momentum.

Best regards,
MH Trading Team`,
        callsToAction: [
          'Review detailed performance report',
          'Share success strategies',
          'Request growth support',
        ],
      },
      'Contract Renewal': {
        subject: `Contract Renewal - ${stand.SalonName}`,
        body: `Dear ${stand.Owner || 'Partner'},

${context?.contract?.EndDate ? `
Your partnership contract is ${new Date(context.contract.EndDate) > new Date() ? 'approaching renewal' : 'due for renewal'}.

Current Contract:
- Commission: ${context.contract['Commission%']}%
- Terms: Net ${context.contract.PaymentTermsDays || 30} days
` : 'We would like to discuss renewing your partnership contract.'}

We value our partnership and would like to continue working together. We're open to discussing terms that work well for both parties.

Let's schedule a time to discuss the renewal and any adjustments you'd like to consider.

Best regards,
MH Trading Partnerships`,
        callsToAction: [
          'Schedule renewal discussion',
          'Review current contract terms',
          'Prepare renewal preferences',
        ],
      },
      'Celebration': {
        subject: `Congratulations! - ${stand.SalonName}`,
        body: `Dear ${stand.Owner || 'Partner'},

🎉 Congratulations on your outstanding performance!

${context?.achievements ? context.achievements.map((a: string) => `• ${a}`).join('\n') : '• Excellent sales performance'}

Your hard work and dedication are paying off, and we're proud to have you as a partner.

Thank you for your continued partnership and commitment to excellence!

Best regards,
MH Trading Team`,
        callsToAction: [
          'Share your success story',
          'Continue the momentum',
          'Explore growth opportunities',
        ],
      },
    };

    const template = templates[purpose];
    if (!template) return null;

    return {
      id: `MSG-${Date.now()}-TPL`,
      type: 'Email',
      purpose: this.mapPurpose(purpose),
      recipient: stand.Owner || 'Partner',
      subject: template.subject,
      content: template.body,
      tone: this.determineTone(purpose),
      callsToAction: template.callsToAction,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Get AI outreach insights
   */
  private async getAIOutreachInsights(
    standId: string,
    stand: any,
    purpose: string,
    context?: any
  ): Promise<string[]> {
    try {
      const prompt = `
You are a Partner Communication AI. Provide 3-4 strategic insights for effective partner outreach.

Stand: ${stand.SalonName} (${standId})
Location: ${stand.City}
Purpose: ${purpose}

${context ? `Context: ${JSON.stringify(context, null, 2)}` : ''}

Provide insights about:
1. Best communication approach
2. Key points to emphasize
3. Potential concerns to address
4. Relationship building opportunities

Return ONLY a JSON array of insight strings:
["insight 1", "insight 2", "insight 3"]
`;

      const response = await generateAIResponse(prompt);
      const insights = JSON.parse(response);

      if (Array.isArray(insights)) {
        return insights.slice(0, 4);
      }

      return ['Personalize communication', 'Be clear and direct', 'Show appreciation'];
    } catch (error: any) {
      logger.warn({ err: error }, 'Failed to get AI outreach insights');
      return ['Personalize communication', 'Be clear and direct', 'Show appreciation'];
    }
  }

  /**
   * Determine priority
   */
  private determinePriority(purpose: string, context?: any): 'Urgent' | 'High' | 'Medium' | 'Low' {
    if (purpose === 'Issue Alert') return 'Urgent';
    if (purpose === 'Contract Renewal' && context?.contract?.EndDate) {
      const daysUntilExpiry = Math.floor(
        (new Date(context.contract.EndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry < 30) return 'Urgent';
      if (daysUntilExpiry < 90) return 'High';
    }
    if (purpose === 'Performance Update') return 'Medium';
    if (purpose === 'Welcome') return 'High';
    return 'Low';
  }

  /**
   * Recommend contact time
   */
  private recommendContactTime(purpose: string): string {
    const timeRecommendations: Record<string, string> = {
      'Welcome': 'Within 24 hours of account creation',
      'Check-in': 'Mid-week mornings (Tuesday-Thursday, 10 AM - 12 PM)',
      'Issue Alert': 'Immediately during business hours',
      'Performance Update': 'Beginning of month',
      'Contract Renewal': '60-90 days before expiry',
      'Celebration': 'Same day as achievement',
      'Training': 'Weekly scheduled sessions',
      'Support': 'Within 4 hours of request',
    };

    return timeRecommendations[purpose] || 'During business hours';
  }

  /**
   * Recommend communication channel
   */
  private recommendChannel(purpose: string, context?: any): string {
    if (purpose === 'Issue Alert') return 'Email + Phone Call';
    if (purpose === 'Welcome') return 'Email with follow-up call';
    if (purpose === 'Contract Renewal') return 'Video call or in-person meeting';
    if (purpose === 'Celebration') return 'Email + Personal call';
    return 'Email';
  }

  /**
   * Map purpose to enum
   */
  private mapPurpose(purpose: string): OutreachMessage['purpose'] {
    const purposeMap: Record<string, OutreachMessage['purpose']> = {
      'Welcome': 'Welcome',
      'Check-in': 'Check-in',
      'Issue Alert': 'Issue Alert',
      'Performance Update': 'Performance Update',
      'Contract Renewal': 'Contract Renewal',
      'Celebration': 'Celebration',
      'Training': 'Training',
      'Support': 'Support',
    };

    return purposeMap[purpose] || 'Check-in';
  }

  /**
   * Determine message tone
   */
  private determineTone(purpose: string): OutreachMessage['tone'] {
    const toneMap: Record<string, OutreachMessage['tone']> = {
      'Welcome': 'Friendly',
      'Check-in': 'Friendly',
      'Issue Alert': 'Urgent',
      'Performance Update': 'Professional',
      'Contract Renewal': 'Professional',
      'Celebration': 'Celebratory',
      'Training': 'Supportive',
      'Support': 'Supportive',
    };

    return toneMap[purpose] || 'Professional';
  }
}

export const outreachAssistantAgent = new OutreachAssistantAgent();
