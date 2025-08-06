import {
  ContactWorkload,
  TaskRequirements,
  TaskPriority,
  BulkAssignmentRequest,
  BulkAssignmentResult,
  BulkAssignmentConstraints,
  OptimizationStrategy,
  ContactAlternative,
  AssignmentConflict,
  ConflictType,
  ConflictSeverity
} from '@/types/assignment';

// Priority weights for workload calculation
const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  [TaskPriority.LOW]: 1.0,
  [TaskPriority.MEDIUM]: 1.5,
  [TaskPriority.HIGH]: 2.0,
  [TaskPriority.CRITICAL]: 3.0
};

export class WorkloadBalancer {
  private maxUtilizationThreshold: number;
  private overloadPenalty: number;
  private urgencyBonus: number;

  constructor(config?: {
    maxUtilizationThreshold?: number;
    overloadPenalty?: number;
    urgencyBonus?: number;
  }) {
    this.maxUtilizationThreshold = config?.maxUtilizationThreshold || 0.85;
    this.overloadPenalty = config?.overloadPenalty || 50;
    this.urgencyBonus = config?.urgencyBonus || 20;
  }

  /**
   * Calculate workload score for a contact considering a new task
   */
  calculateWorkloadScore(
    contactWorkload: ContactWorkload,
    taskRequirements: TaskRequirements
  ): {
    score: number;
    newUtilization: number;
    isOverloaded: boolean;
    conflicts: AssignmentConflict[];
    recommendations: string[];
  } {
    const currentUtilization = contactWorkload.utilizationPercentage / 100;
    const additionalHours = taskRequirements.estimatedHours;
    const weightedHours = additionalHours * PRIORITY_WEIGHTS[taskRequirements.priority];
    
    // Calculate new utilization
    const newTotalHours = contactWorkload.currentHours + additionalHours;
    const newUtilization = Math.min(2.0, newTotalHours / contactWorkload.maxCapacity);
    const newUtilizationPercentage = newUtilization * 100;

    const conflicts: AssignmentConflict[] = [];
    const recommendations: string[] = [];
    
    // Base score calculation (higher utilization = lower score)
    let baseScore = 100;
    
    if (newUtilization <= this.maxUtilizationThreshold) {
      // Optimal range - slight preference for balanced load
      baseScore = 100 - (newUtilization * 20);
    } else if (newUtilization <= 1.0) {
      // Approaching capacity
      baseScore = 80 - ((newUtilization - this.maxUtilizationThreshold) * 100);
      
      conflicts.push({
        type: ConflictType.WORKLOAD,
        severity: ConflictSeverity.MEDIUM,
        description: `Contact will be at ${Math.round(newUtilizationPercentage)}% capacity`,
        suggestedResolution: 'Consider redistributing existing tasks or extending timeline'
      });
      
      recommendations.push('Monitor workload closely');
      recommendations.push('Consider task prioritization');
    } else {
      // Overloaded
      baseScore = Math.max(0, 40 - ((newUtilization - 1.0) * this.overloadPenalty));
      
      conflicts.push({
        type: ConflictType.WORKLOAD,
        severity: newUtilization > 1.2 ? ConflictSeverity.BLOCKING : ConflictSeverity.HIGH,
        description: `Contact would be overloaded at ${Math.round(newUtilizationPercentage)}% capacity`,
        suggestedResolution: 'Reassign existing tasks or find alternative contact'
      });
      
      recommendations.push('Find alternative assignee');
      recommendations.push('Reduce task scope or extend timeline');
    }

    // Deadline pressure adjustment
    if (taskRequirements.deadline) {
      const daysUntilDeadline = Math.ceil(
        (taskRequirements.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      if (daysUntilDeadline <= 3 && newUtilization > 0.9) {
        conflicts.push({
          type: ConflictType.SCHEDULE,
          severity: ConflictSeverity.HIGH,
          description: 'Tight deadline with high workload may compromise quality',
          suggestedResolution: 'Extend deadline or reduce scope'
        });
      }
    }

    // Active projects consideration
    if (contactWorkload.activeProjects >= 5) {
      baseScore *= 0.9; // Context switching penalty
      recommendations.push('Consider impact of context switching between multiple projects');
    }

    // Upcoming deadlines stress
    const upcomingDeadlines = contactWorkload.upcomingDeadlines.filter(
      deadline => deadline.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000 // Next 7 days
    );
    
    if (upcomingDeadlines.length >= 2) {
      baseScore *= 0.85;
      conflicts.push({
        type: ConflictType.SCHEDULE,
        severity: ConflictSeverity.MEDIUM,
        description: `${upcomingDeadlines.length} deadlines in the next 7 days`,
        suggestedResolution: 'Consider delaying non-critical tasks'
      });
    }

    const finalScore = Math.max(0, Math.min(100, Math.round(baseScore)));
    const isOverloaded = newUtilization > this.maxUtilizationThreshold;

    return {
      score: finalScore,
      newUtilization: Math.round(newUtilizationPercentage),
      isOverloaded,
      conflicts,
      recommendations
    };
  }

  /**
   * Find alternative contacts when primary choice is overloaded
   */
  findAlternatives(
    overloadedContactId: string,
    allContacts: ContactWorkload[],
    taskRequirements: TaskRequirements,
    maxAlternatives: number = 3
  ): ContactAlternative[] {
    const alternatives: ContactAlternative[] = [];
    
    // Filter out the overloaded contact and sort by utilization
    const availableContacts = allContacts
      .filter(contact => contact.contactId !== overloadedContactId)
      .map(contact => {
        const workloadResult = this.calculateWorkloadScore(contact, taskRequirements);
        return {
          contact,
          workloadScore: workloadResult.score,
          newUtilization: workloadResult.newUtilization,
          isOverloaded: workloadResult.isOverloaded
        };
      })
      .filter(item => !item.isOverloaded) // Only consider non-overloaded contacts
      .sort((a, b) => b.workloadScore - a.workloadScore);

    for (let i = 0; i < Math.min(maxAlternatives, availableContacts.length); i++) {
      const item = availableContacts[i];
      const estimatedDelay = this.calculateEstimatedDelay(item.contact, taskRequirements);
      
      alternatives.push({
        contactId: item.contact.contactId,
        contactName: `Contact ${item.contact.contactId}`, // This would be populated from actual contact data
        score: item.workloadScore,
        reason: `Available capacity: ${100 - item.newUtilization}%, ${item.contact.activeProjects} active projects`,
        estimatedDelay
      });
    }

    return alternatives;
  }

  /**
   * Calculate estimated delay based on contact's current workload
   */
  private calculateEstimatedDelay(
    contactWorkload: ContactWorkload,
    taskRequirements: TaskRequirements
  ): number {
    // Simple calculation based on current utilization
    // In a real system, this would consider actual schedules and dependencies
    const utilizationFactor = contactWorkload.utilizationPercentage / 100;
    const baseDelay = utilizationFactor > 0.7 ? (utilizationFactor - 0.7) * 24 : 0; // Hours
    const priorityMultiplier = PRIORITY_WEIGHTS[taskRequirements.priority];
    
    return Math.round(baseDelay / priorityMultiplier);
  }

  /**
   * Optimize bulk assignment to balance workload across team
   */
  optimizeBulkAssignment(request: BulkAssignmentRequest): BulkAssignmentResult {
    const { tasks, constraints, optimization } = request;
    const assignments = new Map<string, string>();
    const unassigned: string[] = [];
    const conflicts: AssignmentConflict[] = [];
    const alternatives = new Map<string, ContactAlternative[]>();

    // This is a simplified implementation
    // A real implementation would use more sophisticated algorithms like:
    // - Hungarian algorithm for optimal assignment
    // - Genetic algorithms for complex constraints
    // - Machine learning for predictive optimization

    switch (optimization) {
      case OptimizationStrategy.BALANCE_WORKLOAD:
        return this.optimizeForWorkloadBalance(request);
      
      case OptimizationStrategy.MAXIMIZE_SKILL_MATCH:
        return this.optimizeForSkillMatch(request);
      
      case OptimizationStrategy.MINIMIZE_CONFLICTS:
        return this.optimizeForConflictMinimization(request);
      
      case OptimizationStrategy.OPTIMIZE_TIMELINE:
        return this.optimizeForTimeline(request);
      
      default:
        return this.optimizeForWorkloadBalance(request);
    }
  }

  /**
   * Optimize assignments to balance workload evenly
   */
  private optimizeForWorkloadBalance(request: BulkAssignmentRequest): BulkAssignmentResult {
    const assignments = new Map<string, string>();
    const unassigned: string[] = [];
    const conflicts: AssignmentConflict[] = [];
    const alternatives = new Map<string, ContactAlternative[]>();

    // Sort tasks by priority and estimated hours
    const sortedTasks = [...request.tasks].sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
      return priorityDiff !== 0 ? priorityDiff : b.estimatedHours - a.estimatedHours;
    });

    // Mock workload data - in real implementation, this would come from the system
    const mockContactWorkloads: ContactWorkload[] = [
      {
        contactId: 'contact-1',
        currentHours: 30,
        maxCapacity: 40,
        activeProjects: 2,
        upcomingDeadlines: [],
        availableHours: 10,
        utilizationPercentage: 75,
        lastUpdated: new Date()
      },
      {
        contactId: 'contact-2',
        currentHours: 25,
        maxCapacity: 40,
        activeProjects: 1,
        upcomingDeadlines: [],
        availableHours: 15,
        utilizationPercentage: 62.5,
        lastUpdated: new Date()
      },
      {
        contactId: 'contact-3',
        currentHours: 35,
        maxCapacity: 40,
        activeProjects: 3,
        upcomingDeadlines: [new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)],
        availableHours: 5,
        utilizationPercentage: 87.5,
        lastUpdated: new Date()
      }
    ];

    // Track utilization as we assign tasks
    const contactUtilization = new Map<string, number>();
    mockContactWorkloads.forEach(contact => {
      contactUtilization.set(contact.contactId, contact.currentHours);
    });

    for (const task of sortedTasks) {
      let bestContact: string | null = null;
      let bestScore = -1;

      for (const contact of mockContactWorkloads) {
        const currentHours = contactUtilization.get(contact.contactId) || 0;
        const tempWorkload: ContactWorkload = {
          ...contact,
          currentHours,
          utilizationPercentage: (currentHours / contact.maxCapacity) * 100
        };

        const workloadResult = this.calculateWorkloadScore(tempWorkload, task);
        
        if (workloadResult.score > bestScore && !workloadResult.isOverloaded) {
          bestScore = workloadResult.score;
          bestContact = contact.contactId;
        }
      }

      if (bestContact) {
        assignments.set(task.taskId, bestContact);
        const currentHours = contactUtilization.get(bestContact) || 0;
        contactUtilization.set(bestContact, currentHours + task.estimatedHours);
      } else {
        unassigned.push(task.taskId);
        
        // Find alternatives for unassigned tasks
        const taskAlternatives = this.findAlternatives('', mockContactWorkloads, task);
        if (taskAlternatives.length > 0) {
          alternatives.set(task.taskId, taskAlternatives);
        }
      }
    }

    // Calculate optimization metrics
    const totalScore = Array.from(assignments.values()).reduce((sum, contactId) => {
      const contact = mockContactWorkloads.find(c => c.contactId === contactId);
      return sum + (contact ? 100 - (contact.utilizationPercentage || 0) : 0);
    }, 0);

    const efficiency = assignments.size / request.tasks.length;
    
    const utilizationDistribution = new Map<string, number>();
    contactUtilization.forEach((hours, contactId) => {
      const contact = mockContactWorkloads.find(c => c.contactId === contactId);
      if (contact) {
        utilizationDistribution.set(contactId, (hours / contact.maxCapacity) * 100);
      }
    });

    // Estimate completion timeline
    const maxUtilization = Math.max(...Array.from(utilizationDistribution.values()));
    const timelineWeeks = Math.ceil(maxUtilization / 25); // Rough estimate
    const timeline = new Date(Date.now() + timelineWeeks * 7 * 24 * 60 * 60 * 1000);

    return {
      assignments,
      unassigned,
      conflicts,
      optimization: {
        totalScore: Math.round(totalScore),
        efficiency: Math.round(efficiency * 100),
        timeline,
        utilizationDistribution
      },
      alternatives
    };
  }

  /**
   * Other optimization strategies (simplified implementations)
   */
  private optimizeForSkillMatch(request: BulkAssignmentRequest): BulkAssignmentResult {
    // Implementation would prioritize skill matching over workload balance
    return this.optimizeForWorkloadBalance(request); // Placeholder
  }

  private optimizeForConflictMinimization(request: BulkAssignmentRequest): BulkAssignmentResult {
    // Implementation would minimize scheduling and resource conflicts
    return this.optimizeForWorkloadBalance(request); // Placeholder
  }

  private optimizeForTimeline(request: BulkAssignmentRequest): BulkAssignmentResult {
    // Implementation would optimize for fastest completion
    return this.optimizeForWorkloadBalance(request); // Placeholder
  }

  /**
   * Real-time workload monitoring
   */
  updateContactWorkload(
    contactId: string,
    hoursWorked: number,
    projectCompleted?: boolean
  ): ContactWorkload {
    // This would update the contact's workload in real-time
    // For now, return a mock updated workload
    return {
      contactId,
      currentHours: hoursWorked,
      maxCapacity: 40,
      activeProjects: projectCompleted ? 1 : 2,
      upcomingDeadlines: [],
      availableHours: 40 - hoursWorked,
      utilizationPercentage: (hoursWorked / 40) * 100,
      lastUpdated: new Date()
    };
  }

  /**
   * Predict future workload based on current trends
   */
  predictFutureWorkload(
    contactWorkload: ContactWorkload,
    daysAhead: number
  ): ContactWorkload {
    // Simple prediction based on current trend
    // Real implementation would use more sophisticated forecasting
    const dailyHours = contactWorkload.currentHours / 7; // Assume weekly data
    const predictedHours = Math.min(
      contactWorkload.maxCapacity,
      contactWorkload.currentHours + (dailyHours * daysAhead)
    );

    return {
      ...contactWorkload,
      currentHours: predictedHours,
      availableHours: contactWorkload.maxCapacity - predictedHours,
      utilizationPercentage: (predictedHours / contactWorkload.maxCapacity) * 100,
      lastUpdated: new Date()
    };
  }
}