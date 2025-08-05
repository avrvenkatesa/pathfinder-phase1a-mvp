import { Request, Response } from 'express';
import { eq, inArray, and, sql, desc, gte, lte } from 'drizzle-orm';
import { getDatabase } from '../config/database.js';
import { contacts, relationships, auditLog } from '@shared/schema';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// Workflow-related schemas (preparation for Phase 1B)
const workflowAssignmentSchema = z.object({
  workflowId: z.string().uuid(),
  contactIds: z.array(z.string().uuid()).min(1).max(100),
  assignmentType: z.enum(['primary', 'secondary', 'observer', 'backup']),
  requiredSkills: z.array(z.string()).optional(),
  estimatedHours: z.number().positive().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  deadline: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

const skillRequirementSchema = z.object({
  skills: z.array(z.object({
    skill: z.string().min(1).max(100),
    proficiencyLevel: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
    required: z.boolean().default(true),
    weight: z.number().min(0).max(10).default(5),
  })).min(1),
  workloadCapacity: z.object({
    minHours: z.number().min(0).optional(),
    maxHours: z.number().min(0).optional(),
    preferredHours: z.number().min(0).optional(),
  }).optional(),
  availabilityRequirement: z.array(z.enum(['available', 'partially_available'])).default(['available']),
  departmentPreference: z.array(z.string()).optional(),
  locationPreference: z.array(z.string()).optional(),
});

const capacityAnalysisSchema = z.object({
  timeframe: z.object({
    startDate: z.string().datetime(),
    endDate: z.string().datetime(),
  }),
  filters: z.object({
    departments: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    contactTypes: z.array(z.enum(['person'])).default(['person']),
    availabilityStatus: z.array(z.enum(['available', 'busy', 'partially_available', 'unavailable'])).optional(),
  }).optional(),
});

// Contact matching for workflow assignment
export const findMatchingContacts = asyncHandler(async (req: Request, res: Response) => {
  const requirements = skillRequirementSchema.parse(req.body);
  const { db } = getDatabase();

  try {
    // Extract required and preferred skills
    const requiredSkills = requirements.skills.filter(s => s.required).map(s => s.skill);
    const preferredSkills = requirements.skills.filter(s => !s.required).map(s => s.skill);
    const skillWeights = new Map(requirements.skills.map(s => [s.skill, s.weight]));

    // Base query for people contacts
    let query = db
      .select({
        id: contacts.id,
        name: contacts.name,
        email: contacts.email,
        department: contacts.department,
        jobTitle: contacts.jobTitle,
        skills: contacts.skills,
        availabilityStatus: contacts.availabilityStatus,
        notes: contacts.notes,
      })
      .from(contacts)
      .where(and(
        eq(contacts.type, 'person'),
        sql`${contacts.deletedAt} IS NULL`,
        requirements.availabilityRequirement.length > 0 
          ? sql`${contacts.availabilityStatus} = ANY(${requirements.availabilityRequirement})`
          : undefined
      ));

    // Add department filter if specified
    if (requirements.departmentPreference?.length) {
      query = query.where(and(
        sql`${contacts.department} = ANY(${requirements.departmentPreference})`
      ));
    }

    const candidates = await query;

    // Score each candidate based on skill matching
    const scoredCandidates = candidates.map(candidate => {
      let score = 0;
      let matchedRequired = 0;
      let matchedPreferred = 0;
      const candidateSkills = candidate.skills || [];

      // Check required skills
      requiredSkills.forEach(requiredSkill => {
        if (candidateSkills.includes(requiredSkill)) {
          matchedRequired++;
          score += (skillWeights.get(requiredSkill) || 5) * 2; // Double weight for required skills
        }
      });

      // Check preferred skills
      preferredSkills.forEach(preferredSkill => {
        if (candidateSkills.includes(preferredSkill)) {
          matchedPreferred++;
          score += skillWeights.get(preferredSkill) || 5;
        }
      });

      // Bonus for having all required skills
      if (matchedRequired === requiredSkills.length) {
        score += 20;
      }

      // Availability bonus
      if (candidate.availabilityStatus === 'available') {
        score += 10;
      } else if (candidate.availabilityStatus === 'partially_available') {
        score += 5;
      }

      // Calculate skill match percentage
      const totalRequiredSkills = requiredSkills.length;
      const skillMatchPercentage = totalRequiredSkills > 0 
        ? Math.round((matchedRequired / totalRequiredSkills) * 100)
        : 100;

      return {
        ...candidate,
        matchScore: score,
        skillMatchPercentage,
        matchedRequiredSkills: matchedRequired,
        totalRequiredSkills,
        matchedPreferredSkills: matchedPreferred,
        missingSkills: requiredSkills.filter(skill => !candidateSkills.includes(skill)),
        qualificationStatus: matchedRequired === totalRequiredSkills ? 'fully_qualified' : 
                           matchedRequired > 0 ? 'partially_qualified' : 'not_qualified',
      };
    });

    // Sort by score and filter based on requirements
    const rankedCandidates = scoredCandidates
      .filter(candidate => {
        // Only include candidates with at least some required skills
        return requirements.skills.length === 0 || candidate.matchedRequiredSkills > 0;
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 50); // Limit to top 50 matches

    res.json({
      success: true,
      data: {
        totalCandidates: candidates.length,
        qualifiedCandidates: rankedCandidates.length,
        requirements: {
          requiredSkills,
          preferredSkills,
          availabilityRequirement: requirements.availabilityRequirement,
        },
        matches: rankedCandidates,
        summary: {
          fullyQualified: rankedCandidates.filter(c => c.qualificationStatus === 'fully_qualified').length,
          partiallyQualified: rankedCandidates.filter(c => c.qualificationStatus === 'partially_qualified').length,
          notQualified: rankedCandidates.filter(c => c.qualificationStatus === 'not_qualified').length,
        },
      },
    });

  } catch (error) {
    throw new AppError(500, 'Failed to find matching contacts', error);
  }
});

// Analyze team capacity for workflow planning
export const analyzeTeamCapacity = asyncHandler(async (req: Request, res: Response) => {
  const analysis = capacityAnalysisSchema.parse(req.body);
  const { db } = getDatabase();

  try {
    // Build filters
    const filters = [
      eq(contacts.type, 'person'),
      sql`${contacts.deletedAt} IS NULL`,
    ];

    if (analysis.filters?.departments?.length) {
      filters.push(sql`${contacts.department} = ANY(${analysis.filters.departments})`);
    }

    if (analysis.filters?.availabilityStatus?.length) {
      filters.push(sql`${contacts.availabilityStatus} = ANY(${analysis.filters.availabilityStatus})`);
    }

    // Get team members
    const teamMembers = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        department: contacts.department,
        skills: contacts.skills,
        availabilityStatus: contacts.availabilityStatus,
      })
      .from(contacts)
      .where(and(...filters));

    // Analyze capacity by department
    const departmentCapacity = teamMembers.reduce((acc, member) => {
      const dept = member.department || 'Unassigned';
      if (!acc[dept]) {
        acc[dept] = {
          totalMembers: 0,
          available: 0,
          busy: 0,
          partiallyAvailable: 0,
          unavailable: 0,
          skills: new Set<string>(),
        };
      }

      acc[dept].totalMembers++;
      
      switch (member.availabilityStatus) {
        case 'available':
          acc[dept].available++;
          break;
        case 'busy':
          acc[dept].busy++;
          break;
        case 'partially_available':
          acc[dept].partiallyAvailable++;
          break;
        case 'unavailable':
          acc[dept].unavailable++;
          break;
      }

      // Collect unique skills
      member.skills?.forEach(skill => acc[dept].skills.add(skill));

      return acc;
    }, {} as Record<string, any>);

    // Convert skills sets to arrays and calculate utilization
    Object.keys(departmentCapacity).forEach(dept => {
      const capacity = departmentCapacity[dept];
      capacity.skills = Array.from(capacity.skills);
      capacity.utilizationRate = capacity.totalMembers > 0 
        ? Math.round(((capacity.busy + capacity.partiallyAvailable) / capacity.totalMembers) * 100)
        : 0;
      capacity.availableCapacity = capacity.available + capacity.partiallyAvailable;
    });

    // Analyze skill distribution
    const skillDistribution = teamMembers.reduce((acc, member) => {
      member.skills?.forEach(skill => {
        if (!acc[skill]) {
          acc[skill] = {
            totalPeople: 0,
            available: 0,
            busy: 0,
            partiallyAvailable: 0,
            departments: new Set<string>(),
          };
        }

        acc[skill].totalPeople++;
        acc[skill].departments.add(member.department || 'Unassigned');

        switch (member.availabilityStatus) {
          case 'available':
            acc[skill].available++;
            break;
          case 'busy':
            acc[skill].busy++;
            break;
          case 'partially_available':
            acc[skill].partiallyAvailable++;
            break;
        }
      });

      return acc;
    }, {} as Record<string, any>);

    // Convert department sets to arrays and calculate availability rates
    Object.keys(skillDistribution).forEach(skill => {
      const dist = skillDistribution[skill];
      dist.departments = Array.from(dist.departments);
      dist.availabilityRate = dist.totalPeople > 0 
        ? Math.round(((dist.available + dist.partiallyAvailable) / dist.totalPeople) * 100)
        : 0;
    });

    // Calculate overall metrics
    const totalMembers = teamMembers.length;
    const overallUtilization = totalMembers > 0 
      ? Math.round((teamMembers.filter(m => 
          m.availabilityStatus === 'busy' || m.availabilityStatus === 'partially_available'
        ).length / totalMembers) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        analysisTimeframe: analysis.timeframe,
        overview: {
          totalTeamMembers: totalMembers,
          overallUtilization,
          availableMembers: teamMembers.filter(m => m.availabilityStatus === 'available').length,
          busyMembers: teamMembers.filter(m => m.availabilityStatus === 'busy').length,
          partiallyAvailableMembers: teamMembers.filter(m => m.availabilityStatus === 'partially_available').length,
          unavailableMembers: teamMembers.filter(m => m.availabilityStatus === 'unavailable').length,
        },
        departmentBreakdown: departmentCapacity,
        skillDistribution,
        recommendations: generateCapacityRecommendations(departmentCapacity, skillDistribution),
      },
    });

  } catch (error) {
    throw new AppError(500, 'Failed to analyze team capacity', error);
  }
});

// Simulate workflow assignment (preparation for actual workflow integration)
export const simulateWorkflowAssignment = asyncHandler(async (req: Request, res: Response) => {
  const assignment = workflowAssignmentSchema.parse(req.body);
  const { db } = getDatabase();

  try {
    // Validate that all contacts exist and are available
    const contacts_data = await db
      .select({
        id: contacts.id,
        name: contacts.name,
        availabilityStatus: contacts.availabilityStatus,
        skills: contacts.skills,
      })
      .from(contacts)
      .where(and(
        inArray(contacts.id, assignment.contactIds),
        sql`${contacts.deletedAt} IS NULL`
      ));

    if (contacts_data.length !== assignment.contactIds.length) {
      const foundIds = contacts_data.map(c => c.id);
      const missingIds = assignment.contactIds.filter(id => !foundIds.includes(id));
      throw new AppError(400, `Contacts not found: ${missingIds.join(', ')}`);
    }

    // Check availability conflicts
    const busyContacts = contacts_data.filter(c => c.availabilityStatus === 'unavailable');
    if (busyContacts.length > 0) {
      console.warn(`Warning: ${busyContacts.length} contacts are unavailable`);
    }

    // Validate skill requirements if provided
    let skillAnalysis = null;
    if (assignment.requiredSkills?.length) {
      skillAnalysis = contacts_data.map(contact => {
        const contactSkills = contact.skills || [];
        const hasRequiredSkills = assignment.requiredSkills!.every(skill => 
          contactSkills.includes(skill)
        );
        const missingSkills = assignment.requiredSkills!.filter(skill => 
          !contactSkills.includes(skill)
        );

        return {
          contactId: contact.id,
          contactName: contact.name,
          hasAllRequiredSkills: hasRequiredSkills,
          missingSkills,
          skillMatchPercentage: Math.round(
            ((assignment.requiredSkills!.length - missingSkills.length) / assignment.requiredSkills!.length) * 100
          ),
        };
      });
    }

    // Simulate assignment record (in Phase 1B, this would be stored in workflow_assignments table)
    const simulatedAssignment = {
      id: nanoid(),
      workflowId: assignment.workflowId,
      assignmentType: assignment.assignmentType,
      contactIds: assignment.contactIds,
      requiredSkills: assignment.requiredSkills || [],
      estimatedHours: assignment.estimatedHours,
      priority: assignment.priority,
      deadline: assignment.deadline,
      notes: assignment.notes,
      status: 'simulated',
      createdAt: new Date().toISOString(),
      assignedContacts: contacts_data.map(c => ({
        id: c.id,
        name: c.name,
        availabilityStatus: c.availabilityStatus,
        skills: c.skills || [],
      })),
    };

    // Create audit log entries for the simulation
    const userId = (req as any).user?.id;
    if (userId) {
      await db.insert(auditLog).values({
        id: nanoid(),
        userId,
        action: 'CREATE',
        resourceType: 'workflow_assignment_simulation',
        resourceId: simulatedAssignment.id,
        changes: simulatedAssignment,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      data: {
        assignmentSimulation: simulatedAssignment,
        validation: {
          allContactsFound: contacts_data.length === assignment.contactIds.length,
          availabilityConflicts: busyContacts.length,
          conflictingContacts: busyContacts.map(c => ({ id: c.id, name: c.name })),
          skillAnalysis,
        },
        recommendations: {
          estimatedSuccessRate: calculateAssignmentSuccessRate(contacts_data, assignment),
          suggestedAlternatives: [], // Would be populated with alternative contacts
          riskFactors: identifyRiskFactors(contacts_data, assignment),
        },
      },
    });

  } catch (error) {
    throw new AppError(500, 'Failed to simulate workflow assignment', error);
  }
});

// Get workflow assignment history (preparation for Phase 1B)
export const getWorkflowAssignmentHistory = asyncHandler(async (req: Request, res: Response) => {
  const { db } = getDatabase();
  const { contactId, workflowId, limit = 50, offset = 0 } = req.query;

  try {
    let whereConditions = [
      eq(auditLog.resourceType, 'workflow_assignment_simulation'),
    ];

    if (contactId) {
      whereConditions.push(sql`${auditLog.changes}->>'contactIds' LIKE '%${contactId}%'`);
    }

    if (workflowId) {
      whereConditions.push(sql`${auditLog.changes}->>'workflowId' = '${workflowId}'`);
    }

    const history = await db
      .select({
        id: auditLog.id,
        userId: auditLog.userId,
        action: auditLog.action,
        resourceId: auditLog.resourceId,
        changes: auditLog.changes,
        timestamp: auditLog.timestamp,
      })
      .from(auditLog)
      .where(and(...whereConditions))
      .orderBy(desc(auditLog.timestamp))
      .limit(Number(limit))
      .offset(Number(offset));

    res.json({
      success: true,
      data: {
        history,
        pagination: {
          limit: Number(limit),
          offset: Number(offset),
          total: history.length,
        },
      },
    });

  } catch (error) {
    throw new AppError(500, 'Failed to retrieve workflow assignment history', error);
  }
});

// Helper functions
function generateCapacityRecommendations(departmentCapacity: any, skillDistribution: any) {
  const recommendations = [];

  // Check for over-utilized departments
  Object.entries(departmentCapacity).forEach(([dept, capacity]: [string, any]) => {
    if (capacity.utilizationRate > 80) {
      recommendations.push({
        type: 'capacity_warning',
        message: `${dept} department is ${capacity.utilizationRate}% utilized - consider redistributing workload`,
        department: dept,
        severity: 'high',
      });
    }
  });

  // Check for skill bottlenecks
  Object.entries(skillDistribution).forEach(([skill, dist]: [string, any]) => {
    if (dist.availabilityRate < 30 && dist.totalPeople > 1) {
      recommendations.push({
        type: 'skill_bottleneck',
        message: `${skill} skill has low availability (${dist.availabilityRate}%) - consider training more team members`,
        skill,
        severity: 'medium',
      });
    }
  });

  return recommendations;
}

function calculateAssignmentSuccessRate(contacts: any[], assignment: any): number {
  let score = 100;

  // Reduce score for unavailable contacts
  const unavailableCount = contacts.filter(c => c.availabilityStatus === 'unavailable').length;
  score -= (unavailableCount / contacts.length) * 30;

  // Reduce score for missing skills
  if (assignment.requiredSkills?.length) {
    const skillsScore = contacts.reduce((acc, contact) => {
      const hasAllSkills = assignment.requiredSkills.every((skill: string) => 
        contact.skills?.includes(skill)
      );
      return acc + (hasAllSkills ? 1 : 0);
    }, 0);
    
    const skillMatchRate = skillsScore / contacts.length;
    score *= skillMatchRate;
  }

  return Math.max(0, Math.round(score));
}

function identifyRiskFactors(contacts: any[], assignment: any): string[] {
  const risks = [];

  const unavailableCount = contacts.filter(c => c.availabilityStatus === 'unavailable').length;
  if (unavailableCount > 0) {
    risks.push(`${unavailableCount} contact(s) unavailable`);
  }

  const busyCount = contacts.filter(c => c.availabilityStatus === 'busy').length;
  if (busyCount > contacts.length * 0.5) {
    risks.push('More than 50% of assigned contacts are busy');
  }

  if (assignment.requiredSkills?.length) {
    const contactsWithAllSkills = contacts.filter(contact => 
      assignment.requiredSkills.every((skill: string) => contact.skills?.includes(skill))
    );
    
    if (contactsWithAllSkills.length === 0) {
      risks.push('No contacts have all required skills');
    } else if (contactsWithAllSkills.length < contacts.length * 0.5) {
      risks.push('Less than 50% of contacts have all required skills');
    }
  }

  if (assignment.deadline) {
    const deadline = new Date(assignment.deadline);
    const daysUntilDeadline = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDeadline < 7) {
      risks.push('Tight deadline (less than 7 days)');
    }
  }

  return risks;
}