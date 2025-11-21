/**
 * AI Document Assistant
 * Unified AI service for document generation, translation, and optimization
 */

import { generateAIResponse } from '../../../lib/openai';
import type { DocumentType, DocumentCategory } from '../document.model';

export interface AIDocumentRequest {
  type: DocumentType;
  description?: string;
  context?: Record<string, any>;
  language?: 'EN' | 'AR' | 'DE';
  tone?: 'formal' | 'casual' | 'legal' | 'friendly';
}

export interface AITranslateRequest {
  html: string;
  fromLanguage: 'EN' | 'AR' | 'DE';
  toLanguage: 'EN' | 'AR' | 'DE';
  preserveFormatting?: boolean;
}

export interface AIVariableExtractRequest {
  html: string;
  suggestTypes?: boolean;
}

export interface AIVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'list';
  label: string;
  required: boolean;
  placeholder?: string;
}

export interface AISuggestionRequest {
  html: string;
  documentType: DocumentType;
  language: 'EN' | 'AR' | 'DE';
}

class AIDocumentAssistant {
  /**
   * Generate document HTML from description
   */
  async generateDocument(request: AIDocumentRequest): Promise<string> {
    const { type, description, context, language = 'EN', tone = 'formal' } = request;

    const prompt = `
You are a professional document generator. Create a complete HTML document template for the following:

Document Type: ${type}
Language: ${language}
Tone: ${tone}
Description: ${description || 'Standard template'}
Context: ${context ? JSON.stringify(context, null, 2) : 'None provided'}

Requirements:
1. Generate clean, well-structured HTML
2. Use semantic HTML tags (h1, h2, p, table, etc.)
3. Include placeholders for variables using {{variableName}} format
4. For translations, use {{t.keyName}} format
5. Make it professional and suitable for business use
6. Include sections like: header, body, terms/conditions (if applicable), signature area
7. DO NOT include <html>, <head>, or <body> tags - just the content
8. Use proper formatting and spacing

Generate the HTML content now:
    `.trim();

    const html = await generateAIResponse(prompt, {
      model: 'gpt-4o-mini',
      max_tokens: 2000,
      temperature: 0.7,
    });

    return html;
  }

  /**
   * Translate document HTML
   */
  async translateDocument(request: AITranslateRequest): Promise<string> {
    const { html, fromLanguage, toLanguage, preserveFormatting = true } = request;

    const prompt = `
You are a professional translator specializing in business documents.

Translate the following HTML content:
FROM: ${fromLanguage}
TO: ${toLanguage}

${preserveFormatting ? 'IMPORTANT: Preserve all HTML tags, placeholders ({{...}}), and formatting exactly as is. Only translate the text content.' : ''}

HTML to translate:
${html}

Provide the translated HTML:
    `.trim();

    const translated = await generateAIResponse(prompt, {
      model: 'gpt-4o-mini',
      max_tokens: 2500,
      temperature: 0.3,
    });

    return translated;
  }

  /**
   * Extract variables from HTML template
   */
  async extractVariables(request: AIVariableExtractRequest): Promise<AIVariable[]> {
    const { html, suggestTypes = true } = request;

    const prompt = `
You are an expert at analyzing document templates and extracting variable information.

Analyze this HTML template and extract all variables (in {{variableName}} format):

${html}

For each variable found, determine:
1. Variable name (from the placeholder)
2. Appropriate type (text, number, date, boolean, list)
3. A clear label for the user
4. Whether it's required
5. A helpful placeholder

Return the result as a JSON array of objects with this structure:
[
  {
    "name": "companyName",
    "type": "text",
    "label": "Company Name",
    "required": true,
    "placeholder": "Enter company name"
  },
  ...
]

Return ONLY the JSON array, no additional text.
    `.trim();

    const response = await generateAIResponse(prompt, {
      model: 'gpt-4o-mini',
      max_tokens: 1500,
      temperature: 0.2,
    });

    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;
      const variables = JSON.parse(jsonString);
      return variables as AIVariable[];
    } catch (error) {
      console.error('[AIDocumentAssistant] Error parsing variables:', error);
      return [];
    }
  }

  /**
   * Get suggestions for document improvement
   */
  async getSuggestions(request: AISuggestionRequest): Promise<string[]> {
    const { html, documentType, language } = request;

    const prompt = `
You are a legal and business document expert. Review this ${documentType} template and provide suggestions for improvement.

Language: ${language}
Template HTML:
${html}

Provide 3-5 specific, actionable suggestions to improve:
- Clarity and readability
- Legal completeness (if applicable)
- Professional formatting
- Missing important sections
- Variable placement and naming

Return suggestions as a JSON array of strings:
["Suggestion 1", "Suggestion 2", "Suggestion 3"]

Return ONLY the JSON array, no additional text.
    `.trim();

    const response = await generateAIResponse(prompt, {
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      temperature: 0.5,
    });

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;
      const suggestions = JSON.parse(jsonString);
      return suggestions as string[];
    } catch (error) {
      console.error('[AIDocumentAssistant] Error parsing suggestions:', error);
      return ['Unable to generate suggestions at this time.'];
    }
  }

  /**
   * Check document compliance (basic legal/business check)
   */
  async checkCompliance(html: string, documentType: DocumentType): Promise<{
    score: number;
    issues: string[];
    recommendations: string[];
  }> {
    const prompt = `
You are a compliance and legal expert. Review this ${documentType} template for business compliance.

Template HTML:
${html}

Analyze and return:
1. Compliance score (0-100)
2. Potential legal/business issues
3. Recommendations

Return as JSON:
{
  "score": 85,
  "issues": ["Issue 1", "Issue 2"],
  "recommendations": ["Rec 1", "Rec 2"]
}

Return ONLY the JSON object, no additional text.
    `.trim();

    const response = await generateAIResponse(prompt, {
      model: 'gpt-4o-mini',
      max_tokens: 1200,
      temperature: 0.3,
    });

    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : response;
      const result = JSON.parse(jsonString);
      return result;
    } catch (error) {
      console.error('[AIDocumentAssistant] Error parsing compliance check:', error);
      return {
        score: 0,
        issues: ['Unable to perform compliance check'],
        recommendations: [],
      };
    }
  }
}

export const aiDocumentAssistant = new AIDocumentAssistant();
