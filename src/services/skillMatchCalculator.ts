import { Contact } from '../interfaces/contact';

// Proficiency levels
export enum ProficiencyLevel {
  BEGINNER = 1,
  INTERMEDIATE = 2,
  ADVANCED = 3,
  EXPERT = 4
}

// Core interfaces
export interface SkillRequirement {
  skillName: string;
  requiredLevel: ProficiencyLevel;
  weight: number; // 0-100, importance of this skill
  isRequired: boolean; // true = must have, false = nice to have
  alternativeSkills?: string[]; // Skills that can substitute
}

export interface ContactSkill {
  skillName: string;
  level: ProficiencyLevel;
  yearsOfExperience?: number;
  lastUsed?: Date;
  certified?: boolean;
  validatedBy?: string; // Who validated this skill
}

export interface MatchOptions {
  considerRecency?: boolean;
  recencyWeightFactor?: number; // 0-1, how much to weight recent experience
  considerCertifications?: boolean;
  certificationBonus?: number; // Bonus points for certified skills
  includeRelatedSkills?: boolean;
  relatedSkillWeight?: number; // 0-1, weight for related skills
  minConfidenceThreshold?: number; // Minimum confidence to include in results
}

export interface MatchResult {
  contactId: number;
  score: number; // 0-100
  breakdown: {
    skillMatch: number;
    availabilityScore: number;
    workloadScore: number;
    departmentBonus: number;
    certificationBonus?: number;
    recencyBonus?: number;
  };
  matchedSkills: Array<{
    skill: string;
    required: string;
    has: string;
    score: number;
  }>;
  missingSkills: Array<{
    skill: string;
    required: string;
    has: string | null;
    impact: 'high' | 'medium' | 'low';
  }>;
  partialMatches?: Array<{
    skill: string;
    matchType: 'related' | 'partial' | 'outdated';
    score: number;
  }>;
  recommendations: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface RankedContact {
  contact: Contact;
  matchResult: MatchResult;
  rank: number;
}

export interface GapAnalysis {
  totalRequirements: number;
  fullyMet: number;
  partiallyMet: number;
  unmet: number;
  criticalGaps: Array<{
    skill: string;
    requiredLevel: ProficiencyLevel;
    availableLevel: ProficiencyLevel | null;
    potentialContacts: number[];
  }>;
  recommendations: {
    training: string[];
    hiring: string[];
    reassignment: string[];
  };
}

export interface Assignment {
  id: string;
  contactId: number;
  taskId: string;
  requiredSkills: SkillRequirement[];
  assignedDate: Date;
  completedDate?: Date;
}

export interface AssignmentOutcome {
  assignmentId: string;
  success: boolean;
  performanceScore: number; // 0-100
  feedback?: string;
  skillsUsed: string[];
  skillsLacking?: string[];
}

// Skill taxonomy definition
export interface SkillRelationship {
  related: string[]; // Related skills that provide partial competency
  implies: string[]; // Skills that are implied if you have this skill
  requires: string[]; // Prerequisites
  categories: string[]; // Skill categories for grouping
  alternativeNames: string[]; // Alternative names for the same skill
}

// Cache interface for performance optimization
interface SkillMatchCache {
  key: string;
  result: MatchResult;
  timestamp: Date;
}

export class SkillMatchCalculator {
  private skillTaxonomy: Map<string, SkillRelationship>;
  private matchCache: Map<string, SkillMatchCache>;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private learningWeights: Map<string, number>;

  constructor() {
    this.skillTaxonomy = this.initializeSkillTaxonomy();
    this.matchCache = new Map();
    this.learningWeights = new Map();
  }

  /**
   * Initialize skill taxonomy with relationships
   */
  private initializeSkillTaxonomy(): Map<string, SkillRelationship> {
    const taxonomy = new Map<string, SkillRelationship>();

    // JavaScript ecosystem
    taxonomy.set('JavaScript', {
      related: ['TypeScript', 'Node.js', 'CoffeeScript'],
      implies: ['HTML', 'CSS', 'JSON'],
      requires: [],
      categories: ['Frontend', 'Programming', 'Web'],
      alternativeNames: ['JS', 'Javascript', 'ECMAScript', 'ES6', 'ES2015']
    });

    taxonomy.set('TypeScript', {
      related: ['JavaScript', 'Flow'],
      implies: ['JavaScript', 'HTML', 'CSS'],
      requires: ['JavaScript'],
      categories: ['Frontend', 'Programming', 'Web'],
      alternativeNames: ['TS', 'Typescript']
    });

    taxonomy.set('React', {
      related: ['Vue.js', 'Angular', 'Preact', 'Solid.js'],
      implies: ['Component-Based Architecture', 'SPA'],
      requires: ['JavaScript', 'HTML', 'CSS'],
      categories: ['Frontend', 'Framework', 'Web'],
      alternativeNames: ['React.js', 'ReactJS']
    });

    taxonomy.set('Vue.js', {
      related: ['React', 'Angular', 'Svelte'],
      implies: ['Component-Based Architecture', 'SPA'],
      requires: ['JavaScript', 'HTML', 'CSS'],
      categories: ['Frontend', 'Framework', 'Web'],
      alternativeNames: ['Vue', 'VueJS', 'Vue 3']
    });

    taxonomy.set('Angular', {
      related: ['React', 'Vue.js', 'AngularJS'],
      implies: ['TypeScript', 'RxJS', 'Component-Based Architecture'],
      requires: ['TypeScript', 'JavaScript'],
      categories: ['Frontend', 'Framework', 'Web'],
      alternativeNames: ['Angular 2+', 'Angular CLI']
    });

    // Backend
    taxonomy.set('Node.js', {
      related: ['Express.js', 'Deno', 'Bun'],
      implies: ['JavaScript', 'NPM', 'Package Management'],
      requires: ['JavaScript'],
      categories: ['Backend', 'Runtime', 'Server'],
      alternativeNames: ['Node', 'NodeJS']
    });

    taxonomy.set('Python', {
      related: ['Ruby', 'JavaScript', 'Go'],
      implies: ['Scripting', 'pip'],
      requires: [],
      categories: ['Backend', 'Programming', 'Data Science'],
      alternativeNames: ['Python3', 'Python 3']
    });

    taxonomy.set('Django', {
      related: ['Flask', 'FastAPI', 'Rails'],
      implies: ['Python', 'MVC', 'ORM'],
      requires: ['Python'],
      categories: ['Backend', 'Framework', 'Web'],
      alternativeNames: ['Django REST']
    });

    // Databases
    taxonomy.set('SQL', {
      related: ['PostgreSQL', 'MySQL', 'SQLite'],
      implies: ['Database Design', 'Query Optimization'],
      requires: [],
      categories: ['Database', 'Query Language'],
      alternativeNames: ['Structured Query Language']
    });

    taxonomy.set('MongoDB', {
      related: ['CouchDB', 'DynamoDB', 'Cassandra'],
      implies: ['NoSQL', 'Document Database'],
      requires: [],
      categories: ['Database', 'NoSQL'],
      alternativeNames: ['Mongo']
    });

    // DevOps
    taxonomy.set('Docker', {
      related: ['Kubernetes', 'Podman', 'containerd'],
      implies: ['Containerization', 'DevOps'],
      requires: [],
      categories: ['DevOps', 'Containerization'],
      alternativeNames: ['Docker Compose', 'Dockerfile']
    });

    taxonomy.set('Kubernetes', {
      related: ['Docker Swarm', 'OpenShift', 'Rancher'],
      implies: ['Container Orchestration', 'Docker'],
      requires: ['Docker'],
      categories: ['DevOps', 'Orchestration'],
      alternativeNames: ['K8s', 'K8S']
    });

    taxonomy.set('AWS', {
      related: ['Azure', 'GCP', 'Digital Ocean'],
      implies: ['Cloud Computing', 'IaaS'],
      requires: [],
      categories: ['Cloud', 'Infrastructure'],
      alternativeNames: ['Amazon Web Services', 'AWS Cloud']
    });

    // Soft skills
    taxonomy.set('Project Management', {
      related: ['Team Leadership', 'Scrum Master', 'Product Owner'],
      implies: ['Planning', 'Communication'],
      requires: [],
      categories: ['Soft Skills', 'Management'],
      alternativeNames: ['PM', 'Project Manager']
    });

    taxonomy.set('Agile', {
      related: ['Scrum', 'Kanban', 'Lean'],
      implies: ['Iterative Development', 'Sprint Planning'],
      requires: [],
      categories: ['Methodology', 'Process'],
      alternativeNames: ['Agile Methodology', 'Agile Development']
    });

    return taxonomy;
  }

  /**
   * Calculate skill match between requirements and contact skills
   */
  calculateMatch(
    required: SkillRequirement[],
    contactSkills: ContactSkill[],
    options?: MatchOptions
  ): MatchResult {
    const opts = this.normalizeOptions(options);
    
    // Check cache first
    const cacheKey = this.generateCacheKey(required, contactSkills, opts);
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // Initialize result structure
    const result: MatchResult = {
      contactId: 0, // Will be set by caller
      score: 0,
      breakdown: {
        skillMatch: 0,
        availabilityScore: 100, // Default, should be set by caller
        workloadScore: 100, // Default, should be set by caller
        departmentBonus: 0 // Default, should be set by caller
      },
      matchedSkills: [],
      missingSkills: [],
      partialMatches: [],
      recommendations: [],
      confidence: 'low'
    };

    // Create skill map for faster lookup
    const skillMap = this.createSkillMap(contactSkills);

    let totalWeight = 0;
    let achievedScore = 0;
    let requiredSkillsMet = 0;
    let totalRequiredSkills = 0;

    // Process each requirement
    for (const req of required) {
      if (req.isRequired) totalRequiredSkills++;

      const matchInfo = this.findBestMatch(req, skillMap, opts);
      
      if (matchInfo.exactMatch) {
        const score = this.calculateSkillScore(
          req.requiredLevel,
          matchInfo.skill!.level,
          req.weight,
          matchInfo.skill!,
          opts
        );

        achievedScore += score;
        totalWeight += req.weight;

        result.matchedSkills.push({
          skill: req.skillName,
          required: this.levelToString(req.requiredLevel),
          has: this.levelToString(matchInfo.skill!.level),
          score: Math.round((score / req.weight) * 100)
        });

        if (req.isRequired && matchInfo.skill!.level >= req.requiredLevel) {
          requiredSkillsMet++;
        }
      } else if (matchInfo.relatedMatch && opts.includeRelatedSkills) {
        const score = this.calculateRelatedSkillScore(
          req,
          matchInfo.skill!,
          matchInfo.relationshipType!,
          opts
        );

        achievedScore += score;
        totalWeight += req.weight;

        result.partialMatches?.push({
          skill: req.skillName,
          matchType: 'related',
          score: Math.round((score / req.weight) * 100)
        });
      } else {
        totalWeight += req.weight;
        
        result.missingSkills.push({
          skill: req.skillName,
          required: this.levelToString(req.requiredLevel),
          has: null,
          impact: req.isRequired ? 'high' : req.weight > 50 ? 'medium' : 'low'
        });
      }
    }

    // Calculate final score
    result.breakdown.skillMatch = totalWeight > 0 
      ? Math.round((achievedScore / totalWeight) * 100)
      : 0;

    // Add bonuses
    if (opts.considerCertifications) {
      const certBonus = this.calculateCertificationBonus(contactSkills, required, opts);
      result.breakdown.certificationBonus = certBonus;
    }

    if (opts.considerRecency) {
      const recencyBonus = this.calculateRecencyBonus(contactSkills, required, opts);
      result.breakdown.recencyBonus = recencyBonus;
    }

    // Calculate overall score (weighted average)
    result.score = this.calculateOverallScore(result.breakdown);

    // Set confidence level
    if (requiredSkillsMet === totalRequiredSkills && result.score > 80) {
      result.confidence = 'high';
    } else if (requiredSkillsMet >= totalRequiredSkills * 0.7 && result.score > 60) {
      result.confidence = 'medium';
    } else {
      result.confidence = 'low';
    }

    // Generate recommendations
    result.recommendations = this.generateRecommendations(result, required, contactSkills);

    // Cache the result
    this.cacheResult(cacheKey, result);

    return result;
  }

  /**
   * Rank multiple contacts by match score
   */
  rankContacts(
    requirements: SkillRequirement[],
    contacts: Contact[],
    limit?: number
  ): RankedContact[] {
    const results: RankedContact[] = [];

    // Calculate matches for all contacts in parallel (simulation)
    for (const contact of contacts) {
      // Assuming contact has skills property
      const contactSkills = this.extractContactSkills(contact);
      
      const matchResult = this.calculateMatch(requirements, contactSkills);
      matchResult.contactId = contact.id;

      // Add availability and workload scores (these would come from contact data)
      matchResult.breakdown.availabilityScore = contact.availability || 100;
      matchResult.breakdown.workloadScore = this.calculateWorkloadScore(contact);
      matchResult.breakdown.departmentBonus = this.calculateDepartmentBonus(contact, requirements);

      // Recalculate overall score with all factors
      matchResult.score = this.calculateOverallScore(matchResult.breakdown);

      results.push({
        contact,
        matchResult,
        rank: 0
      });
    }

    // Sort by score
    results.sort((a, b) => b.matchResult.score - a.matchResult.score);

    // Assign ranks
    results.forEach((result, index) => {
      result.rank = index + 1;
    });

    // Apply limit if specified
    return limit ? results.slice(0, limit) : results;
  }

  /**
   * Analyze skill gaps across a team
   */
  analyzeGaps(
    requirements: SkillRequirement[],
    teamSkills: Map<string, ContactSkill[]>
  ): GapAnalysis {
    const analysis: GapAnalysis = {
      totalRequirements: requirements.length,
      fullyMet: 0,
      partiallyMet: 0,
      unmet: 0,
      criticalGaps: [],
      recommendations: {
        training: [],
        hiring: [],
        reassignment: []
      }
    };

    // Aggregate all team skills
    const allSkills = new Map<string, { contacts: number[]; levels: ProficiencyLevel[] }>();
    
    for (const [contactId, skills] of teamSkills) {
      for (const skill of skills) {
        const normalizedName = this.normalizeSkillName(skill.skillName);
        if (!allSkills.has(normalizedName)) {
          allSkills.set(normalizedName, { contacts: [], levels: [] });
        }
        const entry = allSkills.get(normalizedName)!;
        entry.contacts.push(parseInt(contactId));
        entry.levels.push(skill.level);
      }
    }

    // Analyze each requirement
    for (const req of requirements) {
      const normalizedReq = this.normalizeSkillName(req.skillName);
      const teamCapability = allSkills.get(normalizedReq);

      if (!teamCapability) {
        analysis.unmet++;
        if (req.isRequired) {
          analysis.criticalGaps.push({
            skill: req.skillName,
            requiredLevel: req.requiredLevel,
            availableLevel: null,
            potentialContacts: []
          });
          analysis.recommendations.hiring.push(
            `Hire ${this.levelToString(req.requiredLevel)} ${req.skillName} developer`
          );
        }
      } else {
        const maxLevel = Math.max(...teamCapability.levels);
        const qualifiedContacts = teamCapability.contacts.filter(
          (_, index) => teamCapability.levels[index] >= req.requiredLevel
        );

        if (maxLevel >= req.requiredLevel) {
          analysis.fullyMet++;
        } else {
          analysis.partiallyMet++;
          if (req.isRequired) {
            analysis.criticalGaps.push({
              skill: req.skillName,
              requiredLevel: req.requiredLevel,
              availableLevel: maxLevel,
              potentialContacts: teamCapability.contacts
            });
            analysis.recommendations.training.push(
              `Train existing ${req.skillName} developers to ${this.levelToString(req.requiredLevel)} level`
            );
          }
        }

        // Check for workload distribution
        if (qualifiedContacts.length === 1 && req.isRequired) {
          analysis.recommendations.training.push(
            `Cross-train additional team members in ${req.skillName} to reduce single point of failure`
          );
        }
      }
    }

    return analysis;
  }

  /**
   * Improve matching based on historical data (machine learning simulation)
   */
  improveMatching(
    historicalAssignments: Assignment[],
    outcomes: AssignmentOutcome[]
  ): void {
    // Create outcome map for quick lookup
    const outcomeMap = new Map(
      outcomes.map(o => [o.assignmentId, o])
    );

    // Analyze patterns in successful vs unsuccessful assignments
    const skillSuccessRates = new Map<string, { success: number; total: number }>();
    const skillPairSuccess = new Map<string, { success: number; total: number }>();

    for (const assignment of historicalAssignments) {
      const outcome = outcomeMap.get(assignment.id);
      if (!outcome) continue;

      // Track individual skill success rates
      for (const skill of outcome.skillsUsed) {
        if (!skillSuccessRates.has(skill)) {
          skillSuccessRates.set(skill, { success: 0, total: 0 });
        }
        const stats = skillSuccessRates.get(skill)!;
        stats.total++;
        if (outcome.success) stats.success++;
      }

      // Track skill pair combinations
      for (let i = 0; i < outcome.skillsUsed.length; i++) {
        for (let j = i + 1; j < outcome.skillsUsed.length; j++) {
          const pair = [outcome.skillsUsed[i], outcome.skillsUsed[j]].sort().join('+');
          if (!skillPairSuccess.has(pair)) {
            skillPairSuccess.set(pair, { success: 0, total: 0 });
          }
          const stats = skillPairSuccess.get(pair)!;
          stats.total++;
          if (outcome.success) stats.success++;
        }
      }

      // Update learning weights based on performance
      const weight = outcome.performanceScore / 100;
      for (const req of assignment.requiredSkills) {
        const currentWeight = this.learningWeights.get(req.skillName) || 1.0;
        const adjustment = outcome.success ? weight * 0.1 : -weight * 0.05;
        this.learningWeights.set(
          req.skillName,
          Math.max(0.5, Math.min(1.5, currentWeight + adjustment))
        );
      }
    }

    // Identify skills that often lead to success together
    for (const [pair, stats] of skillPairSuccess) {
      if (stats.total > 5 && stats.success / stats.total > 0.8) {
        const [skill1, skill2] = pair.split('+');
        // Update taxonomy to reflect this relationship
        const rel1 = this.skillTaxonomy.get(skill1);
        if (rel1 && !rel1.related.includes(skill2)) {
          rel1.related.push(skill2);
        }
      }
    }
  }

  // Helper methods

  private normalizeOptions(options?: MatchOptions): Required<MatchOptions> {
    return {
      considerRecency: options?.considerRecency ?? true,
      recencyWeightFactor: options?.recencyWeightFactor ?? 0.2,
      considerCertifications: options?.considerCertifications ?? true,
      certificationBonus: options?.certificationBonus ?? 10,
      includeRelatedSkills: options?.includeRelatedSkills ?? true,
      relatedSkillWeight: options?.relatedSkillWeight ?? 0.5,
      minConfidenceThreshold: options?.minConfidenceThreshold ?? 0
    };
  }

  private createSkillMap(skills: ContactSkill[]): Map<string, ContactSkill> {
    const map = new Map<string, ContactSkill>();
    for (const skill of skills) {
      const normalized = this.normalizeSkillName(skill.skillName);
      map.set(normalized, skill);
      
      // Also add alternative names
      const taxonomy = this.skillTaxonomy.get(normalized);
      if (taxonomy) {
        for (const altName of taxonomy.alternativeNames) {
          map.set(this.normalizeSkillName(altName), skill);
        }
      }
    }
    return map;
  }

  private normalizeSkillName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9+#]/g, '');
  }

  private findBestMatch(
    requirement: SkillRequirement,
    skillMap: Map<string, ContactSkill>,
    options: Required<MatchOptions>
  ): {
    exactMatch: boolean;
    relatedMatch: boolean;
    skill?: ContactSkill;
    relationshipType?: 'related' | 'implies' | 'alternative';
  } {
    const normalized = this.normalizeSkillName(requirement.skillName);
    
    // Check for exact match
    if (skillMap.has(normalized)) {
      return {
        exactMatch: true,
        relatedMatch: false,
        skill: skillMap.get(normalized)
      };
    }

    // Check alternative skills
    if (requirement.alternativeSkills) {
      for (const alt of requirement.alternativeSkills) {
        const normalizedAlt = this.normalizeSkillName(alt);
        if (skillMap.has(normalizedAlt)) {
          return {
            exactMatch: true,
            relatedMatch: false,
            skill: skillMap.get(normalizedAlt)
          };
        }
      }
    }

    // Check for related skills if enabled
    if (options.includeRelatedSkills) {
      // Check if any contact skill implies the required skill
      for (const [skillName, contactSkill] of skillMap) {
        const taxonomy = this.skillTaxonomy.get(skillName);
        if (taxonomy?.implies.some(s => this.normalizeSkillName(s) === normalized)) {
          return {
            exactMatch: false,
            relatedMatch: true,
            skill: contactSkill,
            relationshipType: 'implies'
          };
        }
      }

      // Check if contact has related skills
      const reqTaxonomy = this.skillTaxonomy.get(normalized);
      if (reqTaxonomy) {
        for (const related of reqTaxonomy.related) {
          const normalizedRelated = this.normalizeSkillName(related);
          if (skillMap.has(normalizedRelated)) {
            return {
              exactMatch: false,
              relatedMatch: true,
              skill: skillMap.get(normalizedRelated),
              relationshipType: 'related'
            };
          }
        }
      }
    }

    return {
      exactMatch: false,
      relatedMatch: false
    };
  }

  private calculateSkillScore(
    requiredLevel: ProficiencyLevel,
    actualLevel: ProficiencyLevel,
    weight: number,
    skill: ContactSkill,
    options: Required<MatchOptions>
  ): number {
    let score = 0;

    // Base score based on level comparison
    if (actualLevel >= requiredLevel) {
      score = weight; // 100% of weight
    } else if (actualLevel === requiredLevel - 1) {
      score = weight * 0.5; // 50% of weight
    } else if (actualLevel === requiredLevel - 2) {
      score = weight * 0.2; // 20% of weight
    } else {
      score = 0;
    }

    // Apply learning weight if available
    const learningWeight = this.learningWeights.get(skill.skillName) || 1.0;
    score *= learningWeight;

    // Apply recency factor
    if (options.considerRecency && skill.lastUsed) {
      const monthsSinceUse = this.getMonthsSince(skill.lastUsed);
      if (monthsSinceUse < 6) {
        score *= 1 + (options.recencyWeightFactor * 0.5);
      } else if (monthsSinceUse < 12) {
        score *= 1;
      } else if (monthsSinceUse < 24) {
        score *= 1 - (options.recencyWeightFactor * 0.25);
      } else {
        score *= 1 - (options.recencyWeightFactor * 0.5);
      }
    }

    // Apply certification bonus
    if (options.considerCertifications && skill.certified) {
      score *= 1 + (options.certificationBonus / 100);
    }

    return Math.min(score, weight * 1.2); // Cap at 120% of weight
  }

  private calculateRelatedSkillScore(
    requirement: SkillRequirement,
    relatedSkill: ContactSkill,
    relationshipType: 'related' | 'implies' | 'alternative',
    options: Required<MatchOptions>
  ): number {
    let baseScore = this.calculateSkillScore(
      requirement.requiredLevel,
      relatedSkill.level,
      requirement.weight,
      relatedSkill,
      options
    );

    // Apply relationship weight
    switch (relationshipType) {
      case 'implies':
        return baseScore * 0.8; // Strong relationship
      case 'alternative':
        return baseScore * 0.9; // Very strong relationship
      case 'related':
      default:
        return baseScore * options.relatedSkillWeight;
    }
  }

  private calculateCertificationBonus(
    contactSkills: ContactSkill[],
    requirements: SkillRequirement[],
    options: Required<MatchOptions>
  ): number {
    const certifiedCount = contactSkills.filter(s => s.certified).length;
    const totalSkills = contactSkills.length;
    
    if (totalSkills === 0) return 0;
    
    const certificationRate = certifiedCount / totalSkills;
    return Math.round(certificationRate * options.certificationBonus);
  }

  private calculateRecencyBonus(
    contactSkills: ContactSkill[],
    requirements: SkillRequirement[],
    options: Required<MatchOptions>
  ): number {
    const recentSkills = contactSkills.filter(s => {
      if (!s.lastUsed) return false;
      return this.getMonthsSince(s.lastUsed) < 12;
    });

    const recencyRate = recentSkills.length / Math.max(contactSkills.length, 1);
    return Math.round(recencyRate * options.recencyWeightFactor * 20);
  }

  private calculateOverallScore(breakdown: MatchResult['breakdown']): number {
    // Weighted average of all scores
    const weights = {
      skillMatch: 0.5,
      availabilityScore: 0.2,
      workloadScore: 0.15,
      departmentBonus: 0.05,
      certificationBonus: 0.05,
      recencyBonus: 0.05
    };

    let totalScore = 0;
    let totalWeight = 0;

    for (const [key, weight] of Object.entries(weights)) {
      const value = breakdown[key as keyof typeof breakdown];
      if (value !== undefined) {
        totalScore += value * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  }

  private calculateWorkloadScore(contact: Contact): number {
    // Simplified workload calculation
    // In real implementation, this would consider current assignments
    const currentWorkload = contact.currentWorkload || 0;
    if (currentWorkload < 50) return 100;
    if (currentWorkload < 70) return 80;
    if (currentWorkload < 90) return 50;
    return 20;
  }

  private calculateDepartmentBonus(contact: Contact, requirements: SkillRequirement[]): number {
    // Give bonus if contact is from relevant department
    // This is a simplified implementation
    return 0;
  }

  private extractContactSkills(contact: Contact): ContactSkill[] {
    // Convert contact skills to ContactSkill format
    // This assumes contact has a skills property
    if (!contact.skills) return [];
    
    return contact.skills.map(skill => ({
      skillName: skill.name,
      level: skill.level || ProficiencyLevel.INTERMEDIATE,
      yearsOfExperience: skill.years,
      lastUsed: skill.lastUsed ? new Date(skill.lastUsed) : undefined,
      certified: skill.certified || false
    }));
  }

  private generateRecommendations(
    result: MatchResult,
    requirements: SkillRequirement[],
    contactSkills: ContactSkill[]
  ): string[] {
    const recommendations: string[] = [];

    // Recommend training for missing required skills
    for (const missing of result.missingSkills) {
      if (missing.impact === 'high') {
        recommendations.push(`Priority: Acquire ${missing.skill} skills (${missing.required} level)`);
      }
    }

    // Recommend skill updates for outdated skills
    for (const skill of contactSkills) {
      if (skill.lastUsed && this.getMonthsSince(skill.lastUsed) > 24) {
        recommendations.push(`Refresh ${skill.skillName} skills (last used ${this.getMonthsSince(skill.lastUsed)} months ago)`);
      }
    }

    // Recommend certifications for key skills
    const keySkills = requirements
      .filter(r => r.weight > 70 && r.isRequired)
      .map(r => r.skillName);
    
    for (const skillName of keySkills) {
      const contactSkill = contactSkills.find(
        s => this.normalizeSkillName(s.skillName) === this.normalizeSkillName(skillName)
      );
      if (contactSkill && !contactSkill.certified) {
        recommendations.push(`Consider certification in ${skillName}`);
      }
    }

    return recommendations.slice(0, 5); // Limit to top 5 recommendations
  }

  private getMonthsSince(date: Date): number {
    const now = new Date();
    const months = (now.getFullYear() - date.getFullYear()) * 12 +
                  (now.getMonth() - date.getMonth());
    return Math.max(0, months);
  }

  private levelToString(level: ProficiencyLevel): string {
    switch (level) {
      case ProficiencyLevel.BEGINNER: return 'beginner';
      case ProficiencyLevel.INTERMEDIATE: return 'intermediate';
      case ProficiencyLevel.ADVANCED: return 'advanced';
      case ProficiencyLevel.EXPERT: return 'expert';
      default: return 'unknown';
    }
  }

  private generateCacheKey(
    requirements: SkillRequirement[],
    skills: ContactSkill[],
    options: Required<MatchOptions>
  ): string {
    const reqKey = requirements
      .map(r => `${r.skillName}:${r.requiredLevel}:${r.weight}`)
      .sort()
      .join('|');
    const skillKey = skills
      .map(s => `${s.skillName}:${s.level}`)
      .sort()
      .join('|');
    const optKey = JSON.stringify(options);
    return `${reqKey}::${skillKey}::${optKey}`;
  }

  private getFromCache(key: string): MatchResult | null {
    const cached = this.matchCache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp.getTime();
    if (age > this.CACHE_TTL) {
      this.matchCache.delete(key);
      return null;
    }

    return cached.result;
  }

  private cacheResult(key: string, result: MatchResult): void {
    this.matchCache.set(key, {
      key,
      result,
      timestamp: new Date()
    });

    // Clean old cache entries
    if (this.matchCache.size > 1000) {
      const entries = Array.from(this.matchCache.entries());
      entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      
      // Remove oldest 20%
      const toRemove = Math.floor(entries.length * 0.2);
      for (let i = 0; i < toRemove; i++) {
        this.matchCache.delete(entries[i][0]);
      }
    }
  }

  /**
   * Clear the cache (useful for testing or when data changes significantly)
   */
  clearCache(): void {
    this.matchCache.clear();
  }

  /**
   * Export current learning weights (for persistence)
   */
  exportLearningWeights(): Map<string, number> {
    return new Map(this.learningWeights);
  }

  /**
   * Import learning weights (for restoration)
   */
  importLearningWeights(weights: Map<string, number>): void {
    this.learningWeights = new Map(weights);
  }

  /**
   * Get skill taxonomy for a specific skill
   */
  getSkillTaxonomy(skillName: string): SkillRelationship | undefined {
    return this.skillTaxonomy.get(this.normalizeSkillName(skillName));
  }

  /**
   * Add or update skill taxonomy
   */
  updateSkillTaxonomy(skillName: string, relationship: SkillRelationship): void {
    this.skillTaxonomy.set(this.normalizeSkillName(skillName), relationship);
    this.clearCache(); // Clear cache as relationships have changed
  }
}

// Export default instance
export default new SkillMatchCalculator();