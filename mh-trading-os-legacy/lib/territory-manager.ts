/**
 * Territory Manager for MH Trading OS
 * Handles territory assignment for leads, stands, and partners
 * Implements No Double-Claim policy to prevent ownership conflicts
 */

import type { CRMLead, StandSite, Territory, AssignmentRule, PartnerRegistry } from '@shared/schema';

export interface TerritoryAssignmentResult {
  leadId: string;
  assignedTo: string | null;
  territoryId: string | null;
  reason: string;
  conflictDetected: boolean;
  previousOwner?: string;
}

export interface ConflictCheck {
  hasConflict: boolean;
  currentOwner: string | null;
  conflictReason?: string;
}

/**
 * Check if a lead/stand/partner is already claimed
 */
export function checkOwnershipConflict(
  entityId: string,
  currentOwner: string | null,
  newOwner: string
): ConflictCheck {
  if (!currentOwner) {
    return {
      hasConflict: false,
      currentOwner: null,
    };
  }

  if (currentOwner === newOwner) {
    return {
      hasConflict: false,
      currentOwner,
    };
  }

  return {
    hasConflict: true,
    currentOwner,
    conflictReason: `${entityId} is already owned by ${currentOwner}. Cannot reassign to ${newOwner} without manager approval.`,
  };
}

/**
 * Assign territory based on geographical rules
 */
export function assignByGeography(
  lead: Partial<CRMLead>,
  territories: Territory[]
): { territoryId: string | null; owner: string | null; reason: string } {
  // Priority 1: Exact postal code match
  for (const territory of territories) {
    if (territory.PostalRangesJSON) {
      try {
        const ranges: Array<{ from: string; to: string }> = JSON.parse(territory.PostalRangesJSON);
        if (lead.Postal) {
          for (const range of ranges) {
            if (lead.Postal >= range.from && lead.Postal <= range.to) {
              return {
                territoryId: territory.TerritoryID,
                owner: territory.Owner || null,
                reason: `Postal code ${lead.Postal} matches ${territory.Name} range`,
              };
            }
          }
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }
  }

  // Priority 2: City match
  for (const territory of territories) {
    if (territory.CitiesCSV && lead.City) {
      const cities = territory.CitiesCSV.split(',').map(c => c.trim().toLowerCase());
      if (cities.includes(lead.City.toLowerCase())) {
        return {
          territoryId: territory.TerritoryID,
          owner: territory.Owner || null,
          reason: `City ${lead.City} is in ${territory.Name}`,
        };
      }
    }
  }

  // Priority 3: Country match
  for (const territory of territories) {
    if (territory.CountryCode && lead.CountryCode) {
      if (territory.CountryCode === lead.CountryCode) {
        return {
          territoryId: territory.TerritoryID,
          owner: territory.Owner || null,
          reason: `Country code ${lead.CountryCode} matches ${territory.Name}`,
        };
      }
    }
  }

  return {
    territoryId: null,
    owner: null,
    reason: 'No matching territory found',
  };
}

/**
 * Assign based on assignment rules
 */
export function assignByRules(
  lead: Partial<CRMLead>,
  rules: AssignmentRule[]
): { owner: string | null; ruleId: string | null; reason: string } {
  // Sort rules by priority (higher priority first)
  const sortedRules = [...rules]
    .filter(r => r.ActiveFlag !== false)
    .sort((a, b) => (b.Priority || 0) - (a.Priority || 0));

  for (const rule of sortedRules) {
    // Check if rule applies
    if (rule.ConditionJSON) {
      try {
        const condition = JSON.parse(rule.ConditionJSON);
        
        // Check score condition
        if (condition.minScore !== undefined && (lead.Score || 0) < condition.minScore) {
          continue;
        }

        // Check category condition
        if (condition.categories && lead.Category) {
          const categories: string[] = condition.categories;
          if (!categories.includes(lead.Category)) {
            continue;
          }
        }

        // Check tier hint condition
        if (condition.tierHints && lead.TierHint) {
          const tierHints: string[] = condition.tierHints;
          if (!tierHints.includes(lead.TierHint)) {
            continue;
          }
        }

        // Rule matches!
        return {
          owner: rule.AssignTo || null,
          ruleId: rule.RuleID,
          reason: `Assignment rule ${rule.RuleID} matched`,
        };
      } catch (e) {
        // Invalid condition JSON, skip
        continue;
      }
    }
  }

  return {
    owner: null,
    ruleId: null,
    reason: 'No matching assignment rule',
  };
}

/**
 * Round-robin assignment when no rules/territories match
 */
let roundRobinIndex = 0;

export function assignByRoundRobin(
  availableReps: string[]
): { owner: string | null; reason: string } {
  if (availableReps.length === 0) {
    return {
      owner: null,
      reason: 'No available reps for round-robin',
    };
  }

  const owner = availableReps[roundRobinIndex % availableReps.length];
  roundRobinIndex++;

  return {
    owner,
    reason: `Assigned via round-robin`,
  };
}

/**
 * Main territory assignment function
 */
export function assignTerritory(
  lead: Partial<CRMLead>,
  territories: Territory[],
  rules: AssignmentRule[],
  availableReps: string[]
): TerritoryAssignmentResult {
  // Check for existing owner (No Double-Claim)
  if (lead.Owner) {
    const conflict = checkOwnershipConflict(
      lead.LeadID || 'UNKNOWN',
      lead.Owner,
      lead.Owner // Same owner, no conflict
    );

    return {
      leadId: lead.LeadID || '',
      assignedTo: lead.Owner,
      territoryId: null,
      reason: 'Lead already has an owner',
      conflictDetected: false,
      previousOwner: lead.Owner,
    };
  }

  // Priority 1: Assignment Rules
  const ruleAssignment = assignByRules(lead, rules);
  if (ruleAssignment.owner) {
    return {
      leadId: lead.LeadID || '',
      assignedTo: ruleAssignment.owner,
      territoryId: null,
      reason: ruleAssignment.reason,
      conflictDetected: false,
    };
  }

  // Priority 2: Geography-based Territory
  const geoAssignment = assignByGeography(lead, territories);
  if (geoAssignment.owner) {
    return {
      leadId: lead.LeadID || '',
      assignedTo: geoAssignment.owner,
      territoryId: geoAssignment.territoryId || undefined,
      reason: geoAssignment.reason,
      conflictDetected: false,
    };
  }

  // Priority 3: Round-Robin
  const roundRobinAssignment = assignByRoundRobin(availableReps);
  return {
    leadId: lead.LeadID || '',
    assignedTo: roundRobinAssignment.owner,
    territoryId: null,
    reason: roundRobinAssignment.reason,
    conflictDetected: false,
  };
}

/**
 * Reassign with manager approval
 */
export function reassignWithApproval(
  entityId: string,
  currentOwner: string | null,
  newOwner: string,
  managerId: string,
  approved: boolean
): TerritoryAssignmentResult {
  const conflict = checkOwnershipConflict(entityId, currentOwner, newOwner);

  if (conflict.hasConflict && !approved) {
    return {
      leadId: entityId,
      assignedTo: currentOwner,
      territoryId: null,
      reason: conflict.conflictReason || 'Reassignment requires manager approval',
      conflictDetected: true,
      previousOwner: currentOwner || undefined,
    };
  }

  return {
    leadId: entityId,
    assignedTo: newOwner,
    territoryId: null,
    reason: approved 
      ? `Reassigned from ${currentOwner} to ${newOwner} by manager ${managerId}`
      : `Assigned to ${newOwner}`,
    conflictDetected: false,
    previousOwner: currentOwner || undefined,
  };
}

/**
 * Get territory coverage report
 */
export interface TerritoryCoverage {
  territoryId: string;
  territoryName: string;
  owner: string | null;
  leadsCount: number;
  standsCount: number;
  totalValue: number;
}

export function getTerritoryCoverage(
  territories: Territory[],
  leads: CRMLead[],
  stands: StandSite[]
): TerritoryCoverage[] {
  return territories.map(territory => {
    const leadsInTerritory = leads.filter(lead => {
      const assignment = assignByGeography(lead, [territory]);
      return assignment.territoryId === territory.TerritoryID;
    });

    const standsInTerritory = stands.filter(stand => {
      const leadLike = {
        City: stand.City,
        Postal: stand.Postal,
        CountryCode: stand.CountryCode,
      };
      const assignment = assignByGeography(leadLike, [territory]);
      return assignment.territoryId === territory.TerritoryID;
    });

    return {
      territoryId: territory.TerritoryID,
      territoryName: territory.Name,
      owner: territory.Owner || null,
      leadsCount: leadsInTerritory.length,
      standsCount: standsInTerritory.length,
      totalValue: 0, // TODO: Calculate from actual orders
    };
  });
}

/**
 * Validate no double claims across system
 */
export interface DoubleClaimReport {
  valid: boolean;
  conflicts: Array<{
    entityId: string;
    entityType: 'Lead' | 'Stand' | 'Partner';
    owners: string[];
  }>;
}

export function validateNoDoubleClaims(
  leads: CRMLead[],
  stands: StandSite[],
  partners: PartnerRegistry[]
): DoubleClaimReport {
  const conflicts: DoubleClaimReport['conflicts'] = [];

  // Check leads
  const leadOwners = new Map<string, Set<string>>();
  leads.forEach(lead => {
    if (lead.Owner) {
      if (!leadOwners.has(lead.LeadID)) {
        leadOwners.set(lead.LeadID, new Set());
      }
      leadOwners.get(lead.LeadID)!.add(lead.Owner);
    }
  });

  leadOwners.forEach((owners, leadId) => {
    if (owners.size > 1) {
      conflicts.push({
        entityId: leadId,
        entityType: 'Lead',
        owners: Array.from(owners),
      });
    }
  });

  // Check stands
  const standOwners = new Map<string, Set<string>>();
  stands.forEach(stand => {
    if (stand.Owner) {
      if (!standOwners.has(stand.StandID)) {
        standOwners.set(stand.StandID, new Set());
      }
      standOwners.get(stand.StandID)!.add(stand.Owner);
    }
  });

  standOwners.forEach((owners, standId) => {
    if (owners.size > 1) {
      conflicts.push({
        entityId: standId,
        entityType: 'Stand',
        owners: Array.from(owners),
      });
    }
  });

  // Check partners
  const partnerOwners = new Map<string, Set<string>>();
  partners.forEach(partner => {
    if (partner.Owner) {
      if (!partnerOwners.has(partner.PartnerID)) {
        partnerOwners.set(partner.PartnerID, new Set());
      }
      partnerOwners.get(partner.PartnerID)!.add(partner.Owner);
    }
  });

  partnerOwners.forEach((owners, partnerId) => {
    if (owners.size > 1) {
      conflicts.push({
        entityId: partnerId,
        entityType: 'Partner',
        owners: Array.from(owners),
      });
    }
  });

  return {
    valid: conflicts.length === 0,
    conflicts,
  };
}
