// Contact Data Models and Types

export enum ContactType {
  CUSTOMER_COMPANY = 'CUSTOMER_COMPANY',
  DIVISION = 'DIVISION',
  PERSON = 'PERSON',
  FREELANCER = 'FREELANCER'
}

export enum AvailabilityStatus {
  AVAILABLE = 'Available',
  BUSY = 'Busy',
  OFFLINE = 'Offline',
  ON_LEAVE = 'On Leave'
}

export interface Skill {
  id: string;
  name: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  verified: boolean;
  yearsExperience?: number;
}

export interface Workload {
  currentWorkload: number; // 0-100 percentage
  maxCapacity: number; // Maximum concurrent tasks
  activeProjects: number;
  upcomingDeadlines: Date[];
}

export interface Company {
  id: string;
  name: string;
  type: 'Client' | 'Internal' | 'Partner';
  department?: string;
  location?: string;
}

export interface Contact {
  contactId: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  department: string;
  type: ContactType;
  company?: Company;
  skills: Skill[];
  availability: AvailabilityStatus;
  workload: Workload;
  profileImage?: string;
  phoneNumber?: string;
  timezone: string;
  lastActive: Date;
  isWorkflowCompatible: boolean;
  preferences?: {
    notifications: boolean;
    autoAssign: boolean;
    workingHours: {
      start: string; // HH:mm format
      end: string;
      timezone: string;
    };
  };
  metadata?: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    tags: string[];
  };
}

export interface ContactSearchParams {
  query?: string;
  department?: string[];
  skills?: string[];
  availability?: AvailabilityStatus[];
  type?: ContactType[];
  workloadMax?: number;
  isWorkflowCompatible?: boolean;
  company?: string[];
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'availability' | 'workload' | 'lastActive' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ContactListResponse {
  contacts: Contact[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  filters: {
    departments: string[];
    skills: string[];
    companies: string[];
    availableStatuses: AvailabilityStatus[];
  };
}

export interface ContactAvailabilityUpdate {
  contactId: string;
  availability: AvailabilityStatus;
  workload: Workload;
  lastActive: Date;
  timestamp: Date;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  requestId?: string;
}

export interface ContactServiceConfig {
  baseUrl: string;
  apiVersion: string;
  timeout: number;
  retryAttempts: number;
  cacheTimeout: number;
  websocketUrl: string;
}

// Utility types for API responses
export type ApiResponse<T> = {
  success: true;
  data: T;
  meta?: {
    timestamp: Date;
    requestId: string;
  };
} | {
  success: false;
  error: ApiError;
};

// Contact assignment for workflow tasks
export interface ContactAssignment {
  taskId: string;
  contactId: string;
  assignedAt: Date;
  assignedBy: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedHours?: number;
  dueDate?: Date;
  notes?: string;
}

// Search result with relevance scoring
export interface ContactSearchResult extends Contact {
  relevanceScore: number;
  matchedFields: string[];
  distance?: number; // For geographic proximity if applicable
}