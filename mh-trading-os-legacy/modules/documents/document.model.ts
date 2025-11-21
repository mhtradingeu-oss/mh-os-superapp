/**
 * Document Models and Types
 * Centralized type definitions for the Document OS
 */

export type DocumentCategory = 
  | 'B2B_Agreements'
  | 'Partner_Programs'
  | 'Sales_CRM'
  | 'Accounting'
  | 'HR_Legal'
  | 'Operations'
  | 'End_User';

export type DocumentType = 
  // B2B Agreements
  | 'Distributor_Agreement'
  | 'Dealer_Agreement'
  // Partner Programs
  | 'Stand_Partner_Contract'
  | 'Affiliate_Agreement'
  | 'Brand_Partnership_Offer'
  // Sales & CRM
  | 'Sales_Quote'
  | 'Proforma_Invoice'
  | 'Purchase_Order'
  | 'Sales_Offer'
  // Accounting
  | 'Tax_Invoice'
  | 'Credit_Note'
  | 'Refund_Confirmation'
  | 'Receipt'
  // HR & Legal
  | 'HR_Contract'
  | 'NDA'
  | 'Confidentiality_Agreement'
  // Operations
  | 'Return_Authorization'
  | 'Delivery_Note'
  | 'Shipping_Label'
  | 'Customs_Document'
  // End User
  | 'Product_Certificate'
  | 'Warranty_Document'
  | 'GDPR_Consent';

export interface DocumentTemplate {
  TemplateID: string;
  TemplateType: DocumentType;
  TemplateName: string;
  Category: DocumentCategory;
  Language: 'EN' | 'AR' | 'DE';
  ContentHTML: string;
  Variables: string; // JSON array of variable definitions
  Version: string;
  Active: boolean;
  CreatedTS: string;
  UpdatedTS?: string;
  UpdatedBy?: string;
  Notes?: string;
  Tags?: string; // JSON array for searchability
}

export interface DocumentTranslation {
  TranslationKey: string;
  Language: 'EN' | 'AR' | 'DE';
  TranslationValue: string;
  Category: string;
  Notes?: string;
}

export interface DocumentVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'list' | 'image' | 'signature';
  label: string;
  required: boolean;
  defaultValue?: string;
  validation?: string; // JSON schema or regex
  placeholder?: string;
  options?: string[]; // For list type
}

export interface RenderOptions {
  templateId: string;
  variables: Record<string, any>;
  language?: 'EN' | 'AR' | 'DE';
  includeLogo?: boolean;
}

export interface PDFOptions extends RenderOptions {
  format?: 'A4' | 'Letter';
  margins?: { top: number; right: number; bottom: number; left: number };
}

export interface TemplateAnalytics {
  totalTemplates: number;
  activeTemplates: number;
  inactiveTemplates: number;
  byCategory: Record<string, number>;
  byType: Record<string, number>;
  byLanguage: Record<string, number>;
  recentlyCreated: DocumentTemplate[];
  mostUsed: Array<{ templateId: string; name: string; usage: number }>;
}

export interface AIDocumentRequest {
  type: DocumentType;
  description?: string;
  context?: Record<string, any>;
  language?: 'EN' | 'AR' | 'DE';
  tone?: 'formal' | 'casual' | 'legal' | 'friendly';
}

export interface AIAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  supportedTypes: DocumentType[];
}
