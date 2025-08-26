// Assignment Engine Types and Interfaces

export interface Skill {
  id: string;
  name: string;
  category: string;
  level: SkillLevel;
  yearsExperience?: number;
  lastUsed?: Date;
  verified: boolean;
  certifications?: string[];
}

export enum SkillLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert'
}

export enum SkillImportance {
  CRITICAL = 'critical',
  IMPORTANT = 'important',
  NICE_TO_HAVE = 'nice-to-have'
}

export interface RequiredSkill {
  skillId: string;
  skillName: string;
  importance: SkillImportance;
  minimumLevel: SkillLevel;
  weight: number; // 1-10 scale
}

export interface TaskRequirements {
  taskId: string;
  requiredSkills: RequiredSkill[];
  estimatedHours: number;
  deadline?: Date;
  priority: TaskPriority;
  department?: string;
  roleRequirements?: string[];
  locationRequirements?: LocationRequirement;
  teamSize?: number;
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum LocationRequirement {
  ONSITE = 'onsite',
  REMOTE = 'remote',
  HYBRID = 'hybrid',
  ANY = 'any'
}

export interface ContactWorkload {
  contactId: string;
  currentHours: number;
  maxCapacity: number;
  activeProjects: number;
  upcomingDeadlines: Date[];
  availableHours: number;
  utilizationPercentage: number;
  lastUpdated: Date;
}

export interface AvailabilitySlot {
  start: Date;
  end: Date;
  type: 'available' | 'busy' | 'tentative' | 'out-of-office';
  title?: string;
  conflictLevel?: number; // 0-1 scale
}

export interface ContactAvailability {
  contactId: string;
  timezone: string;
  workingHours: {
    start: string; // HH:mm format
    end: string;
    daysOfWeek: number[]; // 0-6, Sunday-Saturday
  };
  timeSlots: AvailabilitySlot[];
  lastUpdated: Date;
  isOnLeave: boolean;
  leaveUntil?: Date;
}

export interface SkillMatch {
  skillId: string;
  skillName: string;
  contactLevel: SkillLevel;
  requiredLevel: SkillLevel;
  matchScore: number; // 0-100
  gap: number; // negative if over-qualified, positive if under-qualified
  yearsExperience?: number;
  isVerified: boolean;
}

export interface AssignmentScore {
  contactId: string;
  totalScore: number; // 0-100
  confidence: number; // 0-100
  breakdown: {
    skillMatch: number;
    availability: number;
    workload: number;
    performance: number;
    preference: number;
  };
  skillMatches: SkillMatch[];
  warnings: string[];
  recommendations: string[];
}

export interface AssignmentRecommendation {
  contactId: string;
  contactName: string;
  score: AssignmentScore;
  estimatedStartDate: Date;
  estimatedCompletionDate: Date;
  conflicts: AssignmentConflict[];
  alternatives: ContactAlternative[];
  reasoning: string[];
}

export interface AssignmentConflict {
  type: ConflictType;
  severity: ConflictSeverity;
  description: string;
  conflictingTaskId?: string;
  suggestedResolution?: string;
}

export enum ConflictType {
  SCHEDULE = 'schedule',
  WORKLOAD = 'workload',
  SKILL_GAP = 'skill-gap',
  LOCATION = 'location',
  ROLE_RESTRICTION = 'role-restriction'
}

export enum ConflictSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  BLOCKING = 'blocking'
}

export interface ContactAlternative {
  contactId: string;
  contactName: string;
  score: number;
  reason: string;
  estimatedDelay?: number; // hours
}

export interface AssignmentRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  isActive: boolean;
  department?: string;
  roles?: string[];
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not-equals' | 'greater-than' | 'less-than' | 'contains' | 'not-contains';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface RuleAction {
  type: 'assign' | 'exclude' | 'prefer' | 'require-approval' | 'escalate';
  target?: string;
  value?: any;
  message?: string;
}

export interface AssignmentHistory {
  id: string;
  taskId: string;
  contactId: string;
  assignedBy: string;
  assignedAt: Date;
  completedAt?: Date;
  status: AssignmentStatus;
  originalScore: AssignmentScore;
  actualPerformance?: PerformanceRating;
  feedback?: string;
  lessons: LearningPoint[];
}

export enum AssignmentStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  ESCALATED = 'escalated'
}

export interface PerformanceRating {
  quality: number; // 1-5
  timeliness: number; // 1-5
  communication: number; // 1-5
  overall: number; // 1-5
  notes?: string;
}

export interface LearningPoint {
  category: 'skill-match' | 'availability' | 'workload' | 'performance';
  insight: string;
  confidence: number;
  impact: number; // How much this should influence future recommendations
}

export interface AssignmentEngineConfig {
  skillMatchWeight: number;
  availabilityWeight: number;
  workloadWeight: number;
  performanceWeight: number;
  preferenceWeight: number;
  maxWorkloadUtilization: number;
  conflictThreshold: number;
  recommendationCount: number;
  learningEnabled: boolean;
  autoAssignmentEnabled: boolean;
}

export interface BulkAssignmentRequest {
  tasks: TaskRequirements[];
  constraints: BulkAssignmentConstraints;
  optimization: OptimizationStrategy;
}

export interface BulkAssignmentConstraints {
  maxTasksPerContact: number;
  respectWorkingHours: boolean;
  balanceWorkload: boolean;
  prioritizeExperience: boolean;
  allowOverallocation: boolean;
  overallocationThreshold: number;
}

export enum OptimizationStrategy {
  MAXIMIZE_SKILL_MATCH = 'maximize-skill-match',
  BALANCE_WORKLOAD = 'balance-workload',
  MINIMIZE_CONFLICTS = 'minimize-conflicts',
  OPTIMIZE_TIMELINE = 'optimize-timeline',
  COST_EFFECTIVE = 'cost-effective'
}

export interface BulkAssignmentResult {
  assignments: Map<string, string>; // taskId -> contactId
  unassigned: string[];
  conflicts: AssignmentConflict[];
  optimization: {
    totalScore: number;
    efficiency: number;
    timeline: Date;
    utilizationDistribution: Map<string, number>;
  };
  alternatives: Map<string, ContactAlternative[]>;
}

// Event types for real-time updates
export interface AssignmentEvent {
  type: AssignmentEventType;
  timestamp: Date;
  data: any;
  source: string;
}

export enum AssignmentEventType {
  WORKLOAD_UPDATED = 'workload-updated',
  AVAILABILITY_CHANGED = 'availability-changed',
  SKILL_UPDATED = 'skill-updated',
  ASSIGNMENT_COMPLETED = 'assignment-completed',
  NEW_TASK_CREATED = 'new-task-created',
  PERFORMANCE_RATED = 'performance-rated'
}