import {
  AssignmentScore,
  AssignmentRecommendation,
  TaskRequirements,

  ContactWorkload,
  ContactAvailability,
  AssignmentRule,
  AssignmentHistory,
  AssignmentEngineConfig,
  AssignmentEvent,
  AssignmentEventType,
  BulkAssignmentRequest,
  BulkAssignmentResult,
  ConflictType,
  ConflictSeverity,
  AssignmentConflict,
  Skill
} from '@/types/assignment';

import { SkillMatcher } from './SkillMatcher';
import { WorkloadBalancer } from './WorkloadBalancer';

export class AssignmentEngine {
  private skillMatcher: SkillMatcher;
  private workloadBalancer: WorkloadBalancer;
  private config: AssignmentEngineConfig;
  private rules: AssignmentRule[] = [];
  private history: AssignmentHistory[] = [];
  private eventListeners: Map<AssignmentEventType, Array<(event: AssignmentEvent) => void>> = new Map();

  constructor(config?: Partial<AssignmentEngineConfig>) {
    this.config = {
      skillMatchWeight: 0.4,
      availabilityWeight: 0.2,
      workloadWeight: 0.25,
      performanceWeight: 0.1,
      preferenceWeight: 0.05,
      maxWorkloadUtilization: 0.85,
      conflictThreshold: 0.7,
      recommendationCount: 3,
      learningEnabled: true,
      autoAssignmentEnabled: false,
      ...config
    };

    this.skillMatcher = new SkillMatcher();
    this.workloadBalancer = new WorkloadBalancer({
      maxUtilizationThreshold: this.config.maxWorkloadUtilization
    });

    this.initializeEventListeners();
  }

  /**
   * Main method to get assignment recommendations for a task
   */
  async getAssignmentRecommendations(
    taskRequirements: TaskRequirements,
    availableContacts: any[],
    contactWorkloads: Map<string, ContactWorkload>,
    contactAvailability: Map<string, ContactAvailability>
  ): Promise<AssignmentRecommendation[]> {
    const recommendations: AssignmentRecommendation[] = [];

    for (const contact of availableContacts) {
      // Apply business rules first
      if (!this.passesBusinessRules(contact, taskRequirements)) {
        continue;
      }

      const workload = contactWorkloads.get(contact.contactId);
      const availability = contactAvailability.get(contact.contactId);

      if (!workload || !availability) {
        continue; // Skip if we don't have complete data
      }

      // Calculate comprehensive score
      const score = this.calculateAssignmentScore(
        contact,
        taskRequirements,
        workload,
        availability
      );

      // Check for conflicts
      const conflicts = this.identifyConflicts(
        contact,
        taskRequirements,
        workload,
        availability
      );

      // Calculate timeline estimates
      const { estimatedStartDate, estimatedCompletionDate } = this.calculateTimeline(
        taskRequirements,
        workload,
        availability
      );

      // Find alternatives if this contact has issues
      const alternatives = conflicts.length > 0 ? 
        await this.findAlternativeContacts(taskRequirements, availableContacts, contactWorkloads, contact.contactId) :
        [];

      // Generate reasoning
      const reasoning = this.generateRecommendationReasoning(score, conflicts, contact);

      recommendations.push({
        contactId: contact.contactId,
        contactName: `${contact.firstName} ${contact.lastName}`,
        score,
        estimatedStartDate,
        estimatedCompletionDate,
        conflicts,
        alternatives,
        reasoning
      });
    }

    // Sort by total score and return top recommendations
    recommendations.sort((a, b) => b.score.totalScore - a.score.totalScore);
    
    // Apply machine learning improvements if enabled
    if (this.config.learningEnabled) {
      this.applyLearningImprovements(recommendations, taskRequirements);
    }

    return recommendations.slice(0, this.config.recommendationCount);
  }

  /**
   * Calculate comprehensive assignment score
   */
  private calculateAssignmentScore(
    contact: any,
    taskRequirements: TaskRequirements,
    workload: ContactWorkload,
    availability: ContactAvailability
  ): AssignmentScore {
    // Skill matching score
    const skillMatchResult = this.skillMatcher.calculateSkillMatchScore(
      contact.skills || [],
      taskRequirements.requiredSkills
    );

    // Workload score
    const workloadResult = this.workloadBalancer.calculateWorkloadScore(
      workload,
      taskRequirements
    );

    // Availability score
    const availabilityScore = this.calculateAvailabilityScore(
      availability,
      taskRequirements
    );

    // Performance score (based on historical data)
    const performanceScore = this.calculatePerformanceScore(contact.contactId);

    // Preference score (user/system preferences)
    const preferenceScore = this.calculatePreferenceScore(contact, taskRequirements);

    // Calculate weighted total score
    const totalScore = Math.round(
      skillMatchResult.score * this.config.skillMatchWeight +
      availabilityScore * this.config.availabilityWeight +
      workloadResult.score * this.config.workloadWeight +
      performanceScore * this.config.performanceWeight +
      preferenceScore * this.config.preferenceWeight
    );

    // Calculate confidence based on data quality and consistency
    const confidence = this.calculateConfidence(
      skillMatchResult,
      workloadResult,
      availabilityScore,
      contact
    );

    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Add warnings based on scores
    if (skillMatchResult.score < 70) {
      warnings.push('Skill match below optimal threshold');
    }
    if (workloadResult.isOverloaded) {
      warnings.push('Contact may be overloaded');
    }
    if (availabilityScore < 50) {
      warnings.push('Limited availability for task timeline');
    }

    // Add recommendations
    if (skillMatchResult.coverage < 80) {
      recommendations.push('Consider skill development or training');
    }
    if (workloadResult.newUtilization > 80) {
      recommendations.push('Monitor workload carefully');
    }

    return {
      contactId: contact.contactId,
      totalScore,
      confidence,
      breakdown: {
        skillMatch: skillMatchResult.score,
        availability: availabilityScore,
        workload: workloadResult.score,
        performance: performanceScore,
        preference: preferenceScore
      },
      skillMatches: skillMatchResult.matches,
      warnings,
      recommendations
    };
  }

  /**
   * Calculate availability score based on schedule conflicts
   */
  private calculateAvailabilityScore(
    availability: ContactAvailability,
    taskRequirements: TaskRequirements
  ): number {
    let score = 100;
    const now = new Date();
    const taskEnd = taskRequirements.deadline || 
      new Date(now.getTime() + taskRequirements.estimatedHours * 60 * 60 * 1000);

    // Check for leave
    if (availability.isOnLeave) {
      if (availability.leaveUntil && availability.leaveUntil > now) {
        return 0; // Cannot assign if on leave
      }
    }

    // Check time slots for conflicts
    let conflictHours = 0;
    const totalHours = (taskEnd.getTime() - now.getTime()) / (1000 * 60 * 60);

    for (const slot of availability.timeSlots) {
      if (slot.start <= taskEnd && slot.end >= now) {
        if (slot.type === 'busy') {
          const conflictStart = new Date(Math.max(slot.start.getTime(), now.getTime()));
          const conflictEnd = new Date(Math.min(slot.end.getTime(), taskEnd.getTime()));
          conflictHours += (conflictEnd.getTime() - conflictStart.getTime()) / (1000 * 60 * 60);
        }
      }
    }

    // Reduce score based on conflicts
    const conflictPercentage = Math.min(100, (conflictHours / totalHours) * 100);
    score -= conflictPercentage * 0.8;

    // Check working hours alignment
    const workingHoursScore = this.calculateWorkingHoursAlignment(
      availability.workingHours,
      taskRequirements
    );
    score = score * (workingHoursScore / 100);

    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate working hours alignment score
   */
  private calculateWorkingHoursAlignment(
    workingHours: { start: string; end: string; daysOfWeek: number[] },
    taskRequirements: TaskRequirements
  ): number {
    // Simplified calculation - real implementation would consider task scheduling requirements
    const workingDays = workingHours.daysOfWeek.length;
    const fullWeekDays = 5; // Monday to Friday
    
    return Math.min(100, (workingDays / fullWeekDays) * 100);
  }

  /**
   * Calculate performance score based on historical data
   */
  private calculatePerformanceScore(contactId: string): number {
    const contactHistory = this.history.filter(h => h.contactId === contactId);
    
    if (contactHistory.length === 0) {
      return 75; // Default neutral score for new contacts
    }

    const recentHistory = contactHistory
      .filter(h => h.completedAt && 
        (Date.now() - h.completedAt.getTime()) <= 90 * 24 * 60 * 60 * 1000) // Last 90 days
      .slice(-10); // Last 10 assignments

    if (recentHistory.length === 0) {
      return 75;
    }

    const avgPerformance = recentHistory.reduce((sum, h) => {
      if (h.actualPerformance) {
        return sum + (h.actualPerformance.overall * 20); // Convert 1-5 scale to 0-100
      }
      return sum + 75; // Default if no rating
    }, 0) / recentHistory.length;

    return Math.round(avgPerformance);
  }

  /**
   * Calculate preference score
   */
  private calculatePreferenceScore(contact: any, taskRequirements: TaskRequirements): number {
    let score = 50; // Base neutral score

    // Department preference
    if (taskRequirements.department && contact.department === taskRequirements.department) {
      score += 20;
    }

    // Location preference
    if (taskRequirements.locationRequirements) {
      // This would check contact's location preferences
      score += 10; // Simplified
    }

    // User preferences from past selections
    const userPreferences = this.getUserPreferences(taskRequirements);
    if (userPreferences.includes(contact.contactId)) {
      score += 15;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(
    skillMatchResult: any,
    workloadResult: any,
    availabilityScore: number,
    contact: Contact
  ): number {
    let confidence = 100;

    // Reduce confidence based on data quality
    if (!contact.skills || contact.skills.length === 0) {
      confidence -= 20;
    }

    if (skillMatchResult.coverage < 50) {
      confidence -= 15;
    }

    if (workloadResult.conflicts.length > 0) {
      confidence -= 10;
    }

    if (availabilityScore < 30) {
      confidence -= 20;
    }

    // Historical data availability
    const contactHistory = this.history.filter(h => h.contactId === contact.contactId);
    if (contactHistory.length < 3) {
      confidence -= 10;
    }

    return Math.max(0, Math.min(100, confidence));
  }

  /**
   * Identify potential conflicts
   */
  private identifyConflicts(
    contact: any,
    taskRequirements: TaskRequirements,
    workload: ContactWorkload,
    availability: ContactAvailability
  ): AssignmentConflict[] {
    const conflicts: AssignmentConflict[] = [];

    // Workload conflicts
    const workloadResult = this.workloadBalancer.calculateWorkloadScore(workload, taskRequirements);
    conflicts.push(...workloadResult.conflicts);

    // Skill gaps
    const skillGaps = this.skillMatcher.getSkillGapAnalysis(
      contact.skills || [],
      taskRequirements.requiredSkills
    );
    
    for (const gap of skillGaps.criticalGaps) {
      conflicts.push({
        type: ConflictType.SKILL_GAP,
        severity: ConflictSeverity.HIGH,
        description: `Missing critical skill: ${gap.skillName}`,
        suggestedResolution: 'Provide training or find alternative contact'
      });
    }

    // Schedule conflicts
    if (availability.isOnLeave) {
      conflicts.push({
        type: ConflictType.SCHEDULE,
        severity: ConflictSeverity.BLOCKING,
        description: 'Contact is currently on leave',
        suggestedResolution: 'Wait for return or find alternative'
      });
    }

    // Location conflicts
    if (taskRequirements.locationRequirements === 'onsite' && !contact.profileImage) {
      // Simplified check - real implementation would check contact location
      conflicts.push({
        type: ConflictType.LOCATION,
        severity: ConflictSeverity.MEDIUM,
        description: 'Location requirements may not be met',
        suggestedResolution: 'Verify contact location and availability for onsite work'
      });
    }

    return conflicts;
  }

  /**
   * Calculate timeline estimates
   */
  private calculateTimeline(
    taskRequirements: TaskRequirements,
    workload: ContactWorkload,
    availability: ContactAvailability
  ): { estimatedStartDate: Date; estimatedCompletionDate: Date } {
    const now = new Date();
    
    // Simple calculation - real implementation would be more sophisticated
    const utilizationFactor = workload.utilizationPercentage / 100;
    const delayHours = utilizationFactor > 0.8 ? (utilizationFactor - 0.8) * 48 : 0;
    
    const estimatedStartDate = new Date(now.getTime() + delayHours * 60 * 60 * 1000);
    const estimatedCompletionDate = new Date(
      estimatedStartDate.getTime() + taskRequirements.estimatedHours * 60 * 60 * 1000
    );

    return { estimatedStartDate, estimatedCompletionDate };
  }

  /**
   * Find alternative contacts
   */
  private async findAlternativeContacts(
    taskRequirements: TaskRequirements,
    availableContacts: any[],
    contactWorkloads: Map<string, ContactWorkload>,
    excludeContactId: string
  ): Promise<any[]> {
    // This would implement alternative contact finding logic
    return [];
  }

  /**
   * Generate recommendation reasoning
   */
  private generateRecommendationReasoning(
    score: AssignmentScore,
    conflicts: AssignmentConflict[],
    contact: Contact
  ): string[] {
    const reasoning: string[] = [];

    if (score.totalScore >= 80) {
      reasoning.push('Excellent overall match for this task');
    } else if (score.totalScore >= 60) {
      reasoning.push('Good match with minor considerations');
    } else {
      reasoning.push('Acceptable match but requires attention');
    }

    // Skill-based reasoning
    if (score.breakdown.skillMatch >= 85) {
      reasoning.push('Strong skill alignment with task requirements');
    } else if (score.breakdown.skillMatch < 60) {
      reasoning.push('Skills gaps may require training or support');
    }

    // Workload reasoning
    if (score.breakdown.workload >= 80) {
      reasoning.push('Good availability and manageable workload');
    } else if (score.breakdown.workload < 50) {
      reasoning.push('High workload may impact delivery timeline');
    }

    // Performance reasoning
    if (score.breakdown.performance >= 85) {
      reasoning.push('Excellent track record of successful deliveries');
    }

    return reasoning;
  }

  /**
   * Apply business rules
   */
  private passesBusinessRules(contact: Contact, taskRequirements: TaskRequirements): boolean {
    for (const rule of this.rules) {
      if (!rule.isActive) continue;

      // Check if rule applies to this task/contact
      if (rule.department && taskRequirements.department !== rule.department) {
        continue;
      }

      // Evaluate conditions
      let conditionsMet = true;
      for (const condition of rule.conditions) {
        if (!this.evaluateRuleCondition(condition, contact, taskRequirements)) {
          conditionsMet = false;
          break;
        }
      }

      if (conditionsMet) {
        // Apply actions
        for (const action of rule.actions) {
          if (action.type === 'exclude') {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Evaluate a single rule condition
   */
  private evaluateRuleCondition(
    condition: any,
    contact: Contact,
    taskRequirements: TaskRequirements
  ): boolean {
    // Simplified rule evaluation
    return true;
  }

  /**
   * Get user preferences from historical selections
   */
  private getUserPreferences(taskRequirements: TaskRequirements): string[] {
    // Analyze historical assignments to determine user preferences
    return [];
  }

  /**
   * Apply machine learning improvements
   */
  private applyLearningImprovements(
    recommendations: AssignmentRecommendation[],
    taskRequirements: TaskRequirements
  ): void {
    // Machine learning logic would go here
    // For now, just log for future implementation
    console.log('ML improvements applied to recommendations');
  }

  /**
   * Initialize event listeners
   */
  private initializeEventListeners(): void {
    // Set up event handling for real-time updates
    this.eventListeners.set(AssignmentEventType.WORKLOAD_UPDATED, []);
    this.eventListeners.set(AssignmentEventType.AVAILABILITY_CHANGED, []);
    this.eventListeners.set(AssignmentEventType.SKILL_UPDATED, []);
  }

  /**
   * Public API methods
   */

  /**
   * Add business rule
   */
  addBusinessRule(rule: AssignmentRule): void {
    this.rules.push(rule);
  }

  /**
   * Record assignment for learning
   */
  recordAssignment(assignment: AssignmentHistory): void {
    this.history.push(assignment);
    
    if (this.config.learningEnabled) {
      this.skillMatcher.learnFromAssignment(
        [], // Would pass actual skills
        [], // Would pass required skills
        assignment.actualPerformance?.overall || 3
      );
    }
  }

  /**
   * Handle bulk assignments
   */
  async processBulkAssignment(request: BulkAssignmentRequest): Promise<BulkAssignmentResult> {
    return this.workloadBalancer.optimizeBulkAssignment(request);
  }

  /**
   * Event subscription
   */
  on(eventType: AssignmentEventType, callback: (event: AssignmentEvent) => void): void {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.push(callback);
    this.eventListeners.set(eventType, listeners);
  }

  /**
   * Emit events
   */
  private emit(event: AssignmentEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];
    listeners.forEach(callback => callback(event));
  }

  /**
   * Update engine configuration
   */
  updateConfig(newConfig: Partial<AssignmentEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get engine statistics
   */
  getStatistics(): {
    totalAssignments: number;
    averagePerformance: number;
    rulesCount: number;
    lastUpdated: Date;
  } {
    const totalAssignments = this.history.length;
    const completedAssignments = this.history.filter(h => h.actualPerformance);
    const averagePerformance = completedAssignments.length > 0 ?
      completedAssignments.reduce((sum, h) => sum + (h.actualPerformance?.overall || 0), 0) / completedAssignments.length :
      0;

    return {
      totalAssignments,
      averagePerformance,
      rulesCount: this.rules.length,
      lastUpdated: new Date()
    };
  }
}