// Mock API responses for testing
export const mockContacts = [
  {
    contactId: '1',
    firstName: 'John',
    lastName: 'Smith',
    email: 'john.smith@s4carlisle.com',
    title: 'Senior Editor',
    department: 'Editorial',
    type: 'PERSON',
    company: { id: '1', name: 'S4 Carlisle', type: 'Internal', location: 'US' },
    skills: [
      { id: '1', name: 'Editing', level: 'Expert', verified: true, yearsExperience: 8 },
      { id: '2', name: 'Proofreading', level: 'Expert', verified: true, yearsExperience: 10 },
      { id: '3', name: 'Content Management', level: 'Advanced', verified: true, yearsExperience: 5 }
    ],
    availability: 'Available',
    workload: {
      currentWorkload: 40,
      maxCapacity: 5,
      activeProjects: 2,
      upcomingDeadlines: [new Date('2024-08-15'), new Date('2024-08-20')]
    },
    profileImage: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face',
    phoneNumber: '+1-555-0101',
    timezone: 'America/New_York',
    lastActive: new Date('2024-08-06T10:30:00Z'),
    isWorkflowCompatible: true,
    preferences: {
      notifications: true,
      autoAssign: true,
      workingHours: { start: '09:00', end: '17:00', timezone: 'America/New_York' }
    },
    metadata: {
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-08-06'),
      createdBy: 'admin',
      tags: ['senior', 'editorial', 'reliable']
    }
  },
  {
    contactId: '2',
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@s4carlisle.com',
    title: 'Graphic Designer',
    department: 'Design',
    type: 'PERSON',
    company: { id: '1', name: 'S4 Carlisle', type: 'Internal', location: 'US' },
    skills: [
      { id: '4', name: 'Graphic Design', level: 'Advanced', verified: true, yearsExperience: 6 },
      { id: '5', name: 'Adobe Creative Suite', level: 'Expert', verified: true, yearsExperience: 7 },
      { id: '6', name: 'Layout Design', level: 'Advanced', verified: true, yearsExperience: 5 }
    ],
    availability: 'Busy',
    workload: {
      currentWorkload: 80,
      maxCapacity: 4,
      activeProjects: 4,
      upcomingDeadlines: [new Date('2024-08-10'), new Date('2024-08-18')]
    },
    profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b1ef?w=32&h=32&fit=crop&crop=face',
    phoneNumber: '+1-555-0102',
    timezone: 'America/New_York',
    lastActive: new Date('2024-08-06T11:15:00Z'),
    isWorkflowCompatible: true,
    preferences: {
      notifications: true,
      autoAssign: false,
      workingHours: { start: '10:00', end: '18:00', timezone: 'America/New_York' }
    },
    metadata: {
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date('2024-08-06'),
      createdBy: 'admin',
      tags: ['designer', 'creative', 'adobe-expert']
    }
  },
  {
    contactId: '3',
    firstName: 'Mike',
    lastName: 'Chen',
    email: 'mike.chen@freelance.com',
    title: 'Technical Writer',
    department: 'Documentation',
    type: 'FREELANCER',
    skills: [
      { id: '7', name: 'Technical Writing', level: 'Expert', verified: true, yearsExperience: 10 },
      { id: '8', name: 'API Documentation', level: 'Advanced', verified: true, yearsExperience: 5 },
      { id: '9', name: 'Markdown', level: 'Expert', verified: true, yearsExperience: 8 }
    ],
    availability: 'Available',
    workload: {
      currentWorkload: 30,
      maxCapacity: 3,
      activeProjects: 1,
      upcomingDeadlines: [new Date('2024-08-25')]
    },
    profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=32&h=32&fit=crop&crop=face',
    phoneNumber: '+1-555-0103',
    timezone: 'America/Los_Angeles',
    lastActive: new Date('2024-08-06T09:45:00Z'),
    isWorkflowCompatible: true,
    preferences: {
      notifications: true,
      autoAssign: true,
      workingHours: { start: '08:00', end: '16:00', timezone: 'America/Los_Angeles' }
    },
    metadata: {
      createdAt: new Date('2024-03-10'),
      updatedAt: new Date('2024-08-06'),
      createdBy: 'admin',
      tags: ['freelancer', 'technical', 'documentation']
    }
  },
  {
    contactId: '4',
    firstName: 'Emily',
    lastName: 'Rodriguez',
    email: 'emily.rodriguez@s4carlisle.com',
    title: 'Project Manager',
    department: 'Operations',
    type: 'PERSON',
    company: { id: '1', name: 'S4 Carlisle', type: 'Internal', location: 'US' },
    skills: [
      { id: '10', name: 'Project Management', level: 'Expert', verified: true, yearsExperience: 12 },
      { id: '11', name: 'Agile Methodology', level: 'Advanced', verified: true, yearsExperience: 6 },
      { id: '12', name: 'Team Leadership', level: 'Advanced', verified: true, yearsExperience: 8 }
    ],
    availability: 'Available',
    workload: {
      currentWorkload: 60,
      maxCapacity: 6,
      activeProjects: 3,
      upcomingDeadlines: [new Date('2024-08-12'), new Date('2024-08-22'), new Date('2024-09-01')]
    },
    profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=32&h=32&fit=crop&crop=face',
    phoneNumber: '+1-555-0104',
    timezone: 'America/New_York',
    lastActive: new Date('2024-08-06T12:00:00Z'),
    isWorkflowCompatible: true,
    preferences: {
      notifications: true,
      autoAssign: true,
      workingHours: { start: '08:30', end: '17:30', timezone: 'America/New_York' }
    },
    metadata: {
      createdAt: new Date('2023-11-01'),
      updatedAt: new Date('2024-08-06'),
      createdBy: 'admin',
      tags: ['manager', 'agile', 'leadership']
    }
  },
  {
    contactId: '5',
    firstName: 'David',
    lastName: 'Kim',
    email: 'david.kim@s4carlisle.com',
    title: 'QA Engineer',
    department: 'Engineering',
    type: 'PERSON',
    company: { id: '1', name: 'S4 Carlisle', type: 'Internal', location: 'US' },
    skills: [
      { id: '13', name: 'Quality Assurance', level: 'Advanced', verified: true, yearsExperience: 7 },
      { id: '14', name: 'Test Automation', level: 'Advanced', verified: true, yearsExperience: 5 },
      { id: '15', name: 'Bug Tracking', level: 'Expert', verified: true, yearsExperience: 8 }
    ],
    availability: 'Offline',
    workload: {
      currentWorkload: 0,
      maxCapacity: 4,
      activeProjects: 0,
      upcomingDeadlines: []
    },
    profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=32&h=32&fit=crop&crop=face',
    phoneNumber: '+1-555-0105',
    timezone: 'America/New_York',
    lastActive: new Date('2024-08-05T17:30:00Z'),
    isWorkflowCompatible: true,
    preferences: {
      notifications: false,
      autoAssign: false,
      workingHours: { start: '09:00', end: '17:00', timezone: 'America/New_York' }
    },
    metadata: {
      createdAt: new Date('2024-01-20'),
      updatedAt: new Date('2024-08-05'),
      createdBy: 'admin',
      tags: ['qa', 'testing', 'automation']
    }
  }
];

// Simple mock server functions (without MSW dependency)
export class ContactMockServer {
  static getContacts(params?: {
    query?: string;
    department?: string[];
    availability?: string[];
    page?: number;
    limit?: number;
  }) {
    let filtered = [...mockContacts];
    
    if (params?.query) {
      const query = params.query.toLowerCase();
      filtered = filtered.filter(c => 
        `${c.firstName} ${c.lastName} ${c.email} ${c.title}`.toLowerCase().includes(query)
      );
    }
    
    if (params?.department?.length) {
      filtered = filtered.filter(c => params.department!.includes(c.department));
    }
    
    if (params?.availability?.length) {
      filtered = filtered.filter(c => params.availability!.includes(c.availability));
    }

    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      contacts: paginated,
      total: filtered.length,
      page,
      limit,
      hasMore: offset + paginated.length < filtered.length,
      filters: {
        departments: [...new Set(mockContacts.map(c => c.department))],
        skills: [...new Set(mockContacts.flatMap(c => c.skills.map(s => s.name)))],
        companies: [...new Set(mockContacts.map(c => c.company?.name).filter(Boolean))],
        availableStatuses: [...new Set(mockContacts.map(c => c.availability))]
      }
    };
  }

  static getContact(contactId: string) {
    return mockContacts.find(c => c.contactId === contactId) || null;
  }

  static searchContacts(query: string) {
    if (!query || query.length < 2) return [];
    
    const lowerQuery = query.toLowerCase();
    return mockContacts
      .filter(c => 
        `${c.firstName} ${c.lastName} ${c.email} ${c.title} ${c.department}`.toLowerCase().includes(lowerQuery)
      )
      .map(contact => ({
        ...contact,
        relevanceScore: this.calculateRelevanceScore(contact, query),
        matchedFields: this.getMatchedFields(contact, query)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 20);
  }

  static getWorkflowCompatibleContacts() {
    return mockContacts.filter(c => c.isWorkflowCompatible);
  }

  private static calculateRelevanceScore(contact: any, query: string): number {
    const lowerQuery = query.toLowerCase();
    let score = 0;

    if (contact.firstName?.toLowerCase().includes(lowerQuery)) score += 10;
    if (contact.lastName?.toLowerCase().includes(lowerQuery)) score += 10;
    if (contact.email?.toLowerCase().includes(lowerQuery)) score += 8;
    if (contact.title?.toLowerCase().includes(lowerQuery)) score += 6;
    if (contact.department?.toLowerCase().includes(lowerQuery)) score += 4;

    return Math.min(score / 10, 1);
  }

  private static getMatchedFields(contact: any, query: string): string[] {
    const lowerQuery = query.toLowerCase();
    const matches: string[] = [];

    if (contact.firstName?.toLowerCase().includes(lowerQuery)) matches.push('firstName');
    if (contact.lastName?.toLowerCase().includes(lowerQuery)) matches.push('lastName');
    if (contact.email?.toLowerCase().includes(lowerQuery)) matches.push('email');
    if (contact.title?.toLowerCase().includes(lowerQuery)) matches.push('title');
    if (contact.department?.toLowerCase().includes(lowerQuery)) matches.push('department');

    return matches;
  }
}

// Mock WebSocket availability updates
export const mockAvailabilityUpdates = new Map([
  ['1', { contactId: '1', availability: 'Available', workload: { currentWorkload: 40, maxCapacity: 5, activeProjects: 2, upcomingDeadlines: [] }, lastActive: new Date(), timestamp: new Date() }],
  ['2', { contactId: '2', availability: 'Busy', workload: { currentWorkload: 80, maxCapacity: 4, activeProjects: 4, upcomingDeadlines: [] }, lastActive: new Date(), timestamp: new Date() }],
  ['3', { contactId: '3', availability: 'Available', workload: { currentWorkload: 30, maxCapacity: 3, activeProjects: 1, upcomingDeadlines: [] }, lastActive: new Date(), timestamp: new Date() }],
  ['4', { contactId: '4', availability: 'Available', workload: { currentWorkload: 60, maxCapacity: 6, activeProjects: 3, upcomingDeadlines: [] }, lastActive: new Date(), timestamp: new Date() }],
  ['5', { contactId: '5', availability: 'Offline', workload: { currentWorkload: 0, maxCapacity: 4, activeProjects: 0, upcomingDeadlines: [] }, lastActive: new Date(Date.now() - 24 * 60 * 60 * 1000), timestamp: new Date() }]
]);