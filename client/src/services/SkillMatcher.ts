import {
  Skill,
  SkillLevel,
  SkillImportance,
  RequiredSkill,
  SkillMatch
} from '@/types/assignment';

// Skill taxonomy for related skills matching
const SKILL_TAXONOMY: Record<string, string[]> = {
  'javascript': ['typescript', 'node.js', 'react', 'vue', 'angular'],
  'python': ['django', 'flask', 'fastapi', 'pandas', 'numpy'],
  'java': ['spring', 'hibernate', 'maven', 'gradle', 'kotlin'],
  'react': ['javascript', 'typescript', 'jsx', 'redux', 'next.js'],
  'aws': ['ec2', 's3', 'lambda', 'cloudformation', 'terraform'],
  'docker': ['kubernetes', 'containerization', 'devops', 'ci/cd'],
  'machine-learning': ['python', 'tensorflow', 'pytorch', 'scikit-learn', 'data-science'],
  'project-management': ['scrum', 'agile', 'kanban', 'jira', 'confluence'],
  'ui-design': ['figma', 'sketch', 'adobe-xd', 'prototyping', 'user-experience'],
  'backend-development': ['api-design', 'database-design', 'microservices', 'rest', 'graphql']
};

// Skill level weights for scoring
const LEVEL_WEIGHTS: Record<SkillLevel, number> = {
  [SkillLevel.BEGINNER]: 1,
  [SkillLevel.INTERMEDIATE]: 2,
  [SkillLevel.ADVANCED]: 3,
  [SkillLevel.EXPERT]: 4
};

// Importance multipliers
const IMPORTANCE_MULTIPLIERS: Record<SkillImportance, number> = {
  [SkillImportance.CRITICAL]: 3.0,
  [SkillImportance.IMPORTANT]: 2.0,
  [SkillImportance.NICE_TO_HAVE]: 1.0
};

export class SkillMatcher {
  private skillTaxonomy: Record<string, string[]>;

  constructor(customTaxonomy?: Record<string, string[]>) {
    this.skillTaxonomy = { ...SKILL_TAXONOMY, ...customTaxonomy };
  }

  /**
   * Calculate overall skill match score for a contact against task requirements
   */
  calculateSkillMatchScore(
    contactSkills: Skill[],
    requiredSkills: RequiredSkill[]
  ): { score: number; matches: SkillMatch[]; coverage: number } {
    const matches: SkillMatch[] = [];
    let totalWeight = 0;
    let weightedScore = 0;
    let criticalSkillsMet = 0;
    let totalCriticalSkills = 0;

    // Create skill lookup for efficient access
    const contactSkillMap = new Map<string, Skill>();
    contactSkills.forEach(skill => {
      contactSkillMap.set(skill.name.toLowerCase(), skill);
      // Also map by ID if available
      if (skill.id) {
        contactSkillMap.set(skill.id, skill);
      }
    });

    for (const required of requiredSkills) {
      const weight = required.weight * IMPORTANCE_MULTIPLIERS[required.importance];
      totalWeight += weight;

      if (required.importance === SkillImportance.CRITICAL) {
        totalCriticalSkills++;
      }

      // Look for exact match first
      let contactSkill = contactSkillMap.get(required.skillId) || 
                        contactSkillMap.get(required.skillName.toLowerCase());

      let skillMatch: SkillMatch;

      if (contactSkill) {
        // Direct skill match
        skillMatch = this.calculateDirectSkillMatch(contactSkill, required);
        if (required.importance === SkillImportance.CRITICAL && skillMatch.matchScore >= 70) {
          criticalSkillsMet++;
        }
      } else {
        // Look for related skills
        const relatedMatch = this.findBestRelatedSkillMatch(contactSkills, required);
        if (relatedMatch) {
          skillMatch = relatedMatch;
          if (required.importance === SkillImportance.CRITICAL && skillMatch.matchScore >= 50) {
            criticalSkillsMet += 0.5; // Partial credit for related skills
          }
        } else {
          // No match found
          skillMatch = {
            skillId: required.skillId,
            skillName: required.skillName,
            contactLevel: SkillLevel.BEGINNER,
            requiredLevel: required.minimumLevel,
            matchScore: 0,
            gap: LEVEL_WEIGHTS[required.minimumLevel],
            isVerified: false
          };
        }
      }

      matches.push(skillMatch);
      weightedScore += skillMatch.matchScore * weight;
    }

    // Calculate final score
    const baseScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    // Apply critical skills penalty
    const criticalSkillsRatio = totalCriticalSkills > 0 ? criticalSkillsMet / totalCriticalSkills : 1;
    const criticalPenalty = criticalSkillsRatio < 0.8 ? (0.8 - criticalSkillsRatio) * 30 : 0;
    
    const finalScore = Math.max(0, Math.min(100, baseScore - criticalPenalty));
    
    // Calculate coverage (percentage of required skills that have some match)
    const skillsWithMatches = matches.filter(m => m.matchScore > 0).length;
    const coverage = requiredSkills.length > 0 ? (skillsWithMatches / requiredSkills.length) * 100 : 100;

    return {
      score: Math.round(finalScore),
      matches,
      coverage: Math.round(coverage)
    };
  }

  /**
   * Calculate match score for a direct skill match
   */
  private calculateDirectSkillMatch(contactSkill: Skill, required: RequiredSkill): SkillMatch {
    const contactLevelWeight = LEVEL_WEIGHTS[contactSkill.level];
    const requiredLevelWeight = LEVEL_WEIGHTS[required.minimumLevel];
    
    // Base score calculation
    let baseScore = 0;
    if (contactLevelWeight >= requiredLevelWeight) {
      // Contact meets or exceeds requirement
      baseScore = 85 + ((contactLevelWeight - requiredLevelWeight) * 5);
    } else {
      // Contact is below requirement
      const gap = requiredLevelWeight - contactLevelWeight;
      baseScore = Math.max(20, 85 - (gap * 25));
    }

    // Bonuses
    let bonusScore = 0;
    
    // Verification bonus
    if (contactSkill.verified) {
      bonusScore += 10;
    }
    
    // Experience bonus
    if (contactSkill.yearsExperience) {
      if (contactSkill.yearsExperience >= 5) bonusScore += 5;
      if (contactSkill.yearsExperience >= 10) bonusScore += 5;
    }
    
    // Recent usage bonus
    if (contactSkill.lastUsed) {
      const daysSinceUsed = (Date.now() - contactSkill.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUsed <= 90) bonusScore += 5;
      else if (daysSinceUsed <= 365) bonusScore += 2;
    }

    const finalScore = Math.min(100, baseScore + bonusScore);
    const gap = requiredLevelWeight - contactLevelWeight;

    return {
      skillId: required.skillId,
      skillName: required.skillName,
      contactLevel: contactSkill.level,
      requiredLevel: required.minimumLevel,
      matchScore: Math.round(finalScore),
      gap,
      yearsExperience: contactSkill.yearsExperience,
      isVerified: contactSkill.verified
    };
  }

  /**
   * Find the best related skill match using skill taxonomy
   */
  private findBestRelatedSkillMatch(
    contactSkills: Skill[],
    required: RequiredSkill
  ): SkillMatch | null {
    const requiredSkillKey = required.skillName.toLowerCase();
    const relatedSkills = this.skillTaxonomy[requiredSkillKey] || [];
    
    let bestMatch: SkillMatch | null = null;
    let bestScore = 0;

    for (const contactSkill of contactSkills) {
      const contactSkillKey = contactSkill.name.toLowerCase();
      
      // Check if this contact skill is related to the required skill
      const isRelated = relatedSkills.includes(contactSkillKey) ||
                       (this.skillTaxonomy[contactSkillKey]?.includes(requiredSkillKey));
      
      if (isRelated) {
        // Calculate related skill match (with penalty)
        const directMatch = this.calculateDirectSkillMatch(contactSkill, required);
        const relatedScore = Math.round(directMatch.matchScore * 0.7); // 30% penalty for related skills
        
        if (relatedScore > bestScore) {
          bestScore = relatedScore;
          bestMatch = {
            ...directMatch,
            matchScore: relatedScore,
            skillName: `${required.skillName} (via ${contactSkill.name})`
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Get skill recommendations for improvement
   */
  getSkillGapAnalysis(
    contactSkills: Skill[],
    requiredSkills: RequiredSkill[]
  ): {
    criticalGaps: RequiredSkill[];
    improvementOpportunities: Array<{
      skill: RequiredSkill;
      currentLevel: SkillLevel | null;
      levelsToImprove: number;
      priority: number;
    }>;
    strengths: Skill[];
  } {
    const { matches } = this.calculateSkillMatchScore(contactSkills, requiredSkills);
    
    const criticalGaps = requiredSkills.filter(req => {
      const match = matches.find(m => m.skillId === req.skillId);
      return req.importance === SkillImportance.CRITICAL && 
             (!match || match.matchScore < 50);
    });

    const improvementOpportunities = matches
      .filter(match => match.matchScore < 85 && match.matchScore > 0)
      .map(match => {
        const required = requiredSkills.find(r => r.skillId === match.skillId)!;
        return {
          skill: required,
          currentLevel: match.contactLevel,
          levelsToImprove: Math.max(0, match.gap),
          priority: IMPORTANCE_MULTIPLIERS[required.importance] * (85 - match.matchScore)
        };
      })
      .sort((a, b) => b.priority - a.priority);

    const strengths = contactSkills.filter(skill => {
      const match = matches.find(m => m.skillName.includes(skill.name));
      return match && match.matchScore >= 85;
    });

    return {
      criticalGaps,
      improvementOpportunities,
      strengths
    };
  }

  /**
   * Update skill taxonomy with new relationships
   */
  updateSkillTaxonomy(skill: string, relatedSkills: string[]): void {
    this.skillTaxonomy[skill.toLowerCase()] = relatedSkills.map(s => s.toLowerCase());
    
    // Add reverse relationships
    for (const related of relatedSkills) {
      const relatedKey = related.toLowerCase();
      if (!this.skillTaxonomy[relatedKey]) {
        this.skillTaxonomy[relatedKey] = [];
      }
      if (!this.skillTaxonomy[relatedKey].includes(skill.toLowerCase())) {
        this.skillTaxonomy[relatedKey].push(skill.toLowerCase());
      }
    }
  }

  /**
   * Learn from assignment outcomes to improve matching
   */
  learnFromAssignment(
    contactSkills: Skill[],
    requiredSkills: RequiredSkill[],
    actualPerformance: number // 0-100
  ): void {
    // This would implement machine learning logic to improve skill matching
    // For now, we'll log the data for future ML implementation
    console.log('Learning from assignment:', {
      contactSkills: contactSkills.length,
      requiredSkills: requiredSkills.length,
      performance: actualPerformance,
      timestamp: new Date()
    });
  }
}