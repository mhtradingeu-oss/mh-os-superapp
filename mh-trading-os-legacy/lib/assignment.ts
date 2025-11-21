/**
 * CRM Lead Assignment System
 * Assigns leads to owners based on territories and assignment rules
 */

import { GoogleSheetsService } from './sheets.js';

export interface Territory {
  TerritoryID: string;
  Name: string;
  Owner?: string;
  CountryCode?: string;
  CitiesCSV?: string;
  PostalRangesJSON?: string;
  Notes?: string;
}

export interface AssignmentRule {
  RuleID: string;
  TerritoryID?: string;
  When?: string;
  ConditionJSON?: string;
  AssignTo?: string;
  Priority?: number;
  ActiveFlag?: boolean;
  Notes?: string;
}

export interface AssignmentContext {
  city?: string;
  country?: string;
  postal?: string;
  status?: string[];
}

export interface AssignmentResult {
  leadID: string;
  assignedTo: string;
  ruleID: string;
  territoryID: string;
}

/**
 * Parse postal ranges JSON
 * Format: ["10000-10999", "20000-20999"]
 */
function isInPostalRange(postal: string, rangesJSON?: string): boolean {
  if (!rangesJSON || !postal) return false;

  try {
    const ranges = JSON.parse(rangesJSON) as string[];
    const postalNum = parseInt(postal, 10);
    if (isNaN(postalNum)) return false;

    for (const range of ranges) {
      if (range.includes('-')) {
        const [min, max] = range.split('-').map(s => parseInt(s, 10));
        if (postalNum >= min && postalNum <= max) {
          return true;
        }
      } else {
        // Exact match
        if (postal === range) {
          return true;
        }
      }
    }
  } catch (error) {
    console.error('Error parsing postal ranges:', error);
  }

  return false;
}

/**
 * Check if a city is in the territory's cities list
 */
function isInTerritoryCities(city: string, citiesCSV?: string): boolean {
  if (!citiesCSV || !city) return false;

  const cities = citiesCSV.split(',').map(c => c.trim().toLowerCase());
  return cities.includes(city.toLowerCase());
}

/**
 * Evaluate a condition from ConditionJSON
 * Format: { "Score": { "gte": 15 }, "TierHint": "High" }
 */
function evaluateCondition(lead: any, conditionJSON?: string): boolean {
  if (!conditionJSON) return true;

  try {
    const condition = JSON.parse(conditionJSON);

    for (const [field, criterion] of Object.entries(condition)) {
      const leadValue = lead[field];

      if (typeof criterion === 'object' && criterion !== null) {
        // Comparison operators - fail if field is missing/undefined
        const criterionObj = criterion as Record<string, any>;
        
        // For numeric comparisons, require the field to exist and be a valid number
        if ('gte' in criterionObj) {
          if (leadValue === undefined || leadValue === null || leadValue < criterionObj.gte) return false;
        }
        if ('lte' in criterionObj) {
          if (leadValue === undefined || leadValue === null || leadValue > criterionObj.lte) return false;
        }
        if ('gt' in criterionObj) {
          if (leadValue === undefined || leadValue === null || leadValue <= criterionObj.gt) return false;
        }
        if ('lt' in criterionObj) {
          if (leadValue === undefined || leadValue === null || leadValue >= criterionObj.lt) return false;
        }
        if ('eq' in criterionObj) {
          if (leadValue !== criterionObj.eq) return false;
        }
        if ('ne' in criterionObj) {
          if (leadValue === criterionObj.ne) return false;
        }
      } else {
        // Direct equality - fail if field doesn't match
        if (leadValue !== criterion) return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error evaluating condition:', error);
    return false;
  }
}

/**
 * Find matching territory for a lead
 */
export function findMatchingTerritory(
  lead: { City?: string; CountryCode?: string; Postal?: string },
  territories: Territory[]
): Territory | null {
  for (const territory of territories) {
    // Check country code
    if (territory.CountryCode && lead.CountryCode) {
      if (territory.CountryCode.toLowerCase() !== lead.CountryCode.toLowerCase()) {
        continue;
      }
    }

    // Check cities
    if (territory.CitiesCSV && lead.City) {
      if (!isInTerritoryCities(lead.City, territory.CitiesCSV)) {
        continue;
      }
    }

    // Check postal ranges
    if (territory.PostalRangesJSON && lead.Postal) {
      if (!isInPostalRange(lead.Postal, territory.PostalRangesJSON)) {
        continue;
      }
    }

    // If we reach here, territory matches
    return territory;
  }

  return null;
}

/**
 * Find applicable assignment rule for a lead
 */
export function findApplicableRule(
  lead: any,
  territory: Territory,
  rules: AssignmentRule[]
): AssignmentRule | null {
  // Filter active rules for this territory
  const applicableRules = rules
    .filter(rule => rule.ActiveFlag !== false)
    .filter(rule => !rule.TerritoryID || rule.TerritoryID === territory.TerritoryID)
    .filter(rule => evaluateCondition(lead, rule.ConditionJSON))
    .sort((a, b) => (b.Priority || 0) - (a.Priority || 0)); // Higher priority first

  return applicableRules[0] || null;
}

/**
 * Assign leads based on territories and assignment rules
 */
export async function assignLeads(
  sheetsService: GoogleSheetsService,
  context: AssignmentContext = {}
): Promise<AssignmentResult[]> {
  const results: AssignmentResult[] = [];

  // Load territories and rules
  const territories = await sheetsService.readSheet<Territory>('Territories');
  const rules = await sheetsService.readSheet<AssignmentRule>('Assignment_Rules');

  // Load leads to assign (NEW/OPEN status, no owner, matching context)
  const allLeads = await sheetsService.readSheet<any>('CRM_Leads');
  
  const statusFilter = context.status || ['NEW', 'OPEN'];
  let leadsToAssign = allLeads.filter(lead => {
    // Must not have owner
    if (lead.Owner && lead.Owner.trim().length > 0) return false;

    // Must be in target status
    if (!statusFilter.includes(lead.Status)) return false;

    // Optional city filter
    if (context.city && lead.City?.toLowerCase() !== context.city.toLowerCase()) {
      return false;
    }

    // Optional country filter
    if (context.country && lead.CountryCode?.toLowerCase() !== context.country.toLowerCase()) {
      return false;
    }

    // Optional postal filter
    if (context.postal && !lead.Postal?.startsWith(context.postal)) {
      return false;
    }

    return true;
  });

  // Assign each lead
  for (const lead of leadsToAssign) {
    try {
      // Find matching territory
      const territory = findMatchingTerritory(lead, territories);
      if (!territory) {
        console.log(`No territory found for lead ${lead.LeadID}`);
        continue;
      }

      // Find applicable rule
      const rule = findApplicableRule(lead, territory, rules);
      
      // Determine owner (from rule or territory default)
      const owner = rule?.AssignTo || territory.Owner || '';
      if (!owner) {
        console.log(`No owner found for lead ${lead.LeadID}`);
        continue;
      }

      // Update lead with owner
      await sheetsService.updateRow('CRM_Leads', 'LeadID', lead.LeadID, {
        Owner: owner,
      });

      // Add touch record
      const { nanoid } = await import('nanoid');
      const touchID = `TOUCH-${Date.now()}-${nanoid(6)}`;
      const now = new Date().toISOString();

      await sheetsService.writeRows('Lead_Touches', [{
        TouchID: touchID,
        TS: now,
        LeadID: lead.LeadID,
        Channel: 'SYSTEM',
        Action: 'ASSIGN',
        Actor: 'AUTO_ASSIGNMENT',
        Notes: `Assigned to ${owner} via ${rule ? `rule ${rule.RuleID}` : `territory ${territory.TerritoryID}`}`,
        Outcome: 'SUCCESS',
      }]);

      results.push({
        leadID: lead.LeadID,
        assignedTo: owner,
        ruleID: rule?.RuleID || '',
        territoryID: territory.TerritoryID,
      });
    } catch (error: any) {
      console.error(`Error assigning lead ${lead.LeadID}:`, error);
    }
  }

  return results;
}
