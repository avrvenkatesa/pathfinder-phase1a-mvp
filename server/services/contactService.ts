import { storage } from "../storage";
import type { 
  Contact, 
  ContactSkill, 
  ContactCertification, 
  ContactAvailability,
  InsertContactSkill,
  InsertContactCertification,
  InsertContactAvailability
} from "@shared/schema";

// Event types for future microservices integration
export interface ContactEvent {
  eventType: string;
  contactId: string;
  userId: string;
  timestamp: Date;
  data: any;
}

// Assignment scoring interface
export interface AssignmentScore {
  contactId: string;
  contact: Contact;
  totalScore: number;
  skillsScore: number;
  availabilityScore: number;
  workloadScore: number;
  departmentScore: number;
  matchingSkills: string[];
  recommendationLevel: 'excellent' | 'good' | 'fair' | 'poor';
  reasoning: string[];
}

export class ContactService {
  private eventQueue: ContactEvent[] = [];

  // Event publishing for future microservices
  private publishEvent(eventType: string, contactId: string, userId: string, data: any) {
    const event: ContactEvent = {
      eventType,
      contactId,
      userId,
      timestamp: new Date(),
      data
    };
    
    this.eventQueue.push(event);
    console.log(`Event published: ${eventType}`, event);
    
    // In future microservices architecture, this would publish to message queue
    // For now, we just log and store in memory
  }

  // Enhanced contact creation with skills, certifications, and availability
  async createContactWithDetails(
    contactData: any,
    skills: InsertContactSkill[],
    certifications: InsertContactCertification[],
    availability: InsertContactAvailability[],
    userId: string
  ): Promise<{
    contact: Contact;
    skills: ContactSkill[];
    certifications: ContactCertification[];
    availability: ContactAvailability[];
  }> {
    // Create the contact
    const contact = await storage.createContact(contactData, userId);
    
    // Add skills if provided
    const createdSkills: ContactSkill[] = [];
    for (const skillData of skills) {
      const skill = await storage.createContactSkill({
        ...skillData,
        contactId: contact.id
      });
      createdSkills.push(skill);
    }

    // Add certifications if provided
    const createdCertifications: ContactCertification[] = [];
    for (const certData of certifications) {
      const cert = await storage.createContactCertification({
        ...certData,
        contactId: contact.id
      });
      createdCertifications.push(cert);
    }

    // Add availability if provided
    const createdAvailability: ContactAvailability[] = [];
    for (const availData of availability) {
      const avail = await storage.createContactAvailability({
        ...availData,
        contactId: contact.id
      });
      createdAvailability.push(avail);
    }

    // Publish event
    this.publishEvent('contact.created.enhanced', contact.id, userId, {
      contact,
      skillsCount: createdSkills.length,
      certificationsCount: createdCertifications.length,
      availabilityCount: createdAvailability.length
    });

    return {
      contact,
      skills: createdSkills,
      certifications: createdCertifications,
      availability: createdAvailability
    };
  }

  // Advanced assignment recommendation algorithm
  async getAssignmentRecommendations(
    requiredSkills: string[],
    userId: string,
    options: {
      maxResults?: number;
      minSkillMatch?: number;
      includePartialMatches?: boolean;
      preferredDepartment?: string;
      urgencyLevel?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<AssignmentScore[]> {
    const {
      maxResults = 10,
      minSkillMatch = 1,
      includePartialMatches = true,
      preferredDepartment,
      urgencyLevel = 'medium'
    } = options;

    // Get all potential candidates
    const candidates = await storage.getContactsForAssignment(requiredSkills, userId);
    const scores: AssignmentScore[] = [];

    for (const contact of candidates) {
      const score = await this.calculateAssignmentScore(
        contact,
        requiredSkills,
        preferredDepartment,
        urgencyLevel
      );

      if (score.skillsScore >= minSkillMatch || includePartialMatches) {
        scores.push(score);
      }
    }

    // Sort by total score and return top results
    const sortedScores = scores
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, maxResults);

    // Publish analytics event
    this.publishEvent('assignment.recommendations.generated', '', userId, {
      requiredSkills,
      candidatesEvaluated: candidates.length,
      recommendationsReturned: sortedScores.length,
      options
    });

    return sortedScores;
  }

  private async calculateAssignmentScore(
    contact: Contact,
    requiredSkills: string[],
    preferredDepartment?: string,
    urgencyLevel: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<AssignmentScore> {
    // Get contact's detailed information
    const [skills, capacity] = await Promise.all([
      storage.getContactSkills(contact.id),
      storage.calculateContactCapacity(contact.id)
    ]);

    // Calculate skills score (45% weight)
    const contactSkillNames = skills.map(s => s.skillName);
    const matchingSkills = requiredSkills.filter(skill => 
      contactSkillNames.includes(skill)
    );
    const skillsScore = (matchingSkills.length / requiredSkills.length) * 45;

    // Calculate availability score (25% weight)
    const availabilityScore = (capacity.availabilityScore / 100) * 25;

    // Calculate workload score (20% weight) - lower workload is better
    const workloadScore = Math.max(0, (1 - (capacity.currentCapacity / capacity.maxCapacity))) * 20;

    // Calculate department score (10% weight)
    let departmentScore = 5; // Base score
    if (preferredDepartment && contact.department === preferredDepartment) {
      departmentScore = 10;
    }

    // Apply urgency multipliers
    const urgencyMultiplier = urgencyLevel === 'high' ? 1.2 : urgencyLevel === 'low' ? 0.8 : 1.0;
    
    const totalScore = Math.min(100, (skillsScore + availabilityScore + workloadScore + departmentScore) * urgencyMultiplier);

    // Determine recommendation level
    let recommendationLevel: 'excellent' | 'good' | 'fair' | 'poor';
    if (totalScore >= 85) recommendationLevel = 'excellent';
    else if (totalScore >= 70) recommendationLevel = 'good';
    else if (totalScore >= 55) recommendationLevel = 'fair';
    else recommendationLevel = 'poor';

    // Generate reasoning
    const reasoning: string[] = [];
    if (matchingSkills.length === requiredSkills.length) {
      reasoning.push("Has all required skills");
    } else if (matchingSkills.length > 0) {
      reasoning.push(`Matches ${matchingSkills.length} of ${requiredSkills.length} required skills`);
    } else {
      reasoning.push("No direct skill matches found");
    }

    if (capacity.availabilityScore >= 80) {
      reasoning.push("High availability");
    } else if (capacity.availabilityScore >= 50) {
      reasoning.push("Moderate availability");
    } else {
      reasoning.push("Limited availability");
    }

    if (capacity.currentCapacity < capacity.maxCapacity * 0.7) {
      reasoning.push("Low current workload");
    } else if (capacity.currentCapacity < capacity.maxCapacity) {
      reasoning.push("Some capacity available");
    } else {
      reasoning.push("At full capacity");
    }

    if (preferredDepartment && contact.department === preferredDepartment) {
      reasoning.push("From preferred department");
    }

    return {
      contactId: contact.id,
      contact,
      totalScore: Math.round(totalScore),
      skillsScore: Math.round(skillsScore),
      availabilityScore: Math.round(availabilityScore),
      workloadScore: Math.round(workloadScore),
      departmentScore: Math.round(departmentScore),
      matchingSkills,
      recommendationLevel,
      reasoning
    };
  }

  // Bulk skills assignment
  async assignSkillsBulk(
    contactId: string,
    skills: { name: string; level: string; experience?: number }[]
  ): Promise<ContactSkill[]> {
    const createdSkills: ContactSkill[] = [];
    
    for (const skillData of skills) {
      const skill = await storage.createContactSkill({
        contactId,
        skillName: skillData.name,
        proficiencyLevel: skillData.level as any,
        yearsExperience: skillData.experience,
        isCertified: false
      });
      createdSkills.push(skill);
    }

    this.publishEvent('contact.skills.bulk_assigned', contactId, '', {
      skillsAssigned: skills.length,
      skills: skills.map(s => s.name)
    });

    return createdSkills;
  }

  // Capacity optimization suggestions
  async getCapacityOptimizationSuggestions(
    userId: string
  ): Promise<{
    overloadedContacts: Contact[];
    underutilizedContacts: Contact[];
    suggestions: string[];
  }> {
    const contacts = await storage.getAvailableContacts(userId, 0); // Get all contacts
    const overloaded: Contact[] = [];
    const underutilized: Contact[] = [];
    const suggestions: string[] = [];

    for (const contact of contacts) {
      const capacity = await storage.calculateContactCapacity(contact.id);
      
      if (capacity.currentCapacity >= capacity.maxCapacity) {
        overloaded.push(contact);
      } else if (capacity.currentCapacity < capacity.maxCapacity * 0.3) {
        underutilized.push(contact);
      }
    }

    // Generate suggestions
    if (overloaded.length > 0) {
      suggestions.push(`${overloaded.length} contacts are at full capacity. Consider redistributing work or increasing their limits.`);
    }
    
    if (underutilized.length > 0) {
      suggestions.push(`${underutilized.length} contacts are underutilized. Consider assigning them more tasks.`);
    }

    if (overloaded.length > 0 && underutilized.length > 0) {
      suggestions.push("Consider redistributing work from overloaded to underutilized team members.");
    }

    this.publishEvent('capacity.analysis.performed', '', userId, {
      totalContacts: contacts.length,
      overloadedCount: overloaded.length,
      underutilizedCount: underutilized.length,
      suggestionsGenerated: suggestions.length
    });

    return {
      overloadedContacts: overloaded,
      underutilizedContacts: underutilized,
      suggestions
    };
  }

  // Get pending events for microservices integration
  getAndClearEventQueue(): ContactEvent[] {
    const events = [...this.eventQueue];
    this.eventQueue = [];
    return events;
  }

  // Skills gap analysis
  async analyzeSkillsGap(
    requiredSkills: string[],
    userId: string
  ): Promise<{
    availableSkills: { skill: string; contactCount: number; avgProficiency: string }[];
    missingSkills: string[];
    skillGaps: { skill: string; gap: number; suggestions: string[] }[];
  }> {
    const contacts = await storage.getContacts(userId, { isActive: true, type: ['person'] });
    const skillAnalysis = new Map<string, { contactCount: number; totalProficiency: number; proficiencyLevels: string[] }>();
    
    // Analyze current skills
    for (const contact of contacts) {
      const skills = await storage.getContactSkills(contact.id);
      for (const skill of skills) {
        const current = skillAnalysis.get(skill.skillName) || {
          contactCount: 0,
          totalProficiency: 0,
          proficiencyLevels: []
        };
        
        current.contactCount++;
        current.proficiencyLevels.push(skill.proficiencyLevel);
        skillAnalysis.set(skill.skillName, current);
      }
    }

    const availableSkills = Array.from(skillAnalysis.entries()).map(([skill, data]) => ({
      skill,
      contactCount: data.contactCount,
      avgProficiency: this.calculateAverageProficiency(data.proficiencyLevels)
    }));

    const missingSkills = requiredSkills.filter(skill => !skillAnalysis.has(skill));
    
    const skillGaps = requiredSkills.map(skill => {
      const data = skillAnalysis.get(skill);
      if (!data) {
        return {
          skill,
          gap: 100,
          suggestions: [
            "Hire external specialist",
            "Provide training to existing team members",
            "Partner with external service provider"
          ]
        };
      }
      
      const gap = Math.max(0, 100 - (data.contactCount * 20)); // Assume need 5 people for full coverage
      const suggestions: string[] = [];
      
      if (gap > 50) {
        suggestions.push("Critical skill shortage - immediate hiring recommended");
      } else if (gap > 25) {
        suggestions.push("Moderate shortage - consider cross-training existing staff");
      } else {
        suggestions.push("Adequate coverage - monitor for future needs");
      }

      return { skill, gap, suggestions };
    });

    return {
      availableSkills,
      missingSkills,
      skillGaps
    };
  }

  private calculateAverageProficiency(levels: string[]): string {
    const scores = levels.map(level => {
      switch (level) {
        case 'beginner': return 1;
        case 'intermediate': return 2;
        case 'advanced': return 3;
        case 'expert': return 4;
        default: return 2;
      }
    });
    
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    if (avg >= 3.5) return 'expert';
    if (avg >= 2.5) return 'advanced';
    if (avg >= 1.5) return 'intermediate';
    return 'beginner';
  }
}

export const contactService = new ContactService();