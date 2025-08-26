import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AssignmentRecommendation,
  TaskRequirements,

  ContactWorkload,
  ContactAvailability,
  AssignmentEngineConfig,
  BulkAssignmentRequest,
  BulkAssignmentResult,
  AssignmentHistory,
  AssignmentRule,
  AssignmentEvent,
  AssignmentEventType
} from '@/types/assignment';
import { AssignmentEngine } from '@/services/AssignmentEngine';

interface UseAssignmentEngineProps {
  config?: Partial<AssignmentEngineConfig>;
  enableRealTimeUpdates?: boolean;
}

interface UseAssignmentEngineReturn {
  // Core functionality
  getRecommendations: (taskRequirements: TaskRequirements) => Promise<AssignmentRecommendation[]>;
  processBulkAssignment: (request: BulkAssignmentRequest) => Promise<BulkAssignmentResult>;
  
  // State
  recommendations: AssignmentRecommendation[] | null;
  bulkResult: BulkAssignmentResult | null;
  isLoading: boolean;
  error: string | null;
  
  // Engine management
  engine: AssignmentEngine | null;
  config: AssignmentEngineConfig;
  updateConfig: (newConfig: Partial<AssignmentEngineConfig>) => void;
  
  // Rules management
  rules: AssignmentRule[];
  addRule: (rule: AssignmentRule) => void;
  removeRule: (ruleId: string) => void;
  
  // History and learning
  history: AssignmentHistory[];
  recordAssignment: (assignment: AssignmentHistory) => void;
  
  // Real-time updates
  addEventListener: (eventType: AssignmentEventType, callback: (event: AssignmentEvent) => void) => void;
  removeEventListener: (eventType: AssignmentEventType, callback: (event: AssignmentEvent) => void) => void;
  
  // Statistics
  statistics: {
    totalAssignments: number;
    averagePerformance: number;
    rulesCount: number;
    lastUpdated: Date;
  } | null;
}

export function useAssignmentEngine({
  config: initialConfig,
  enableRealTimeUpdates = true
}: UseAssignmentEngineProps = {}): UseAssignmentEngineReturn {
  const queryClient = useQueryClient();
  const engineRef = useRef<AssignmentEngine | null>(null);
  
  // State management
  const [recommendations, setRecommendations] = useState<AssignmentRecommendation[] | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkAssignmentResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AssignmentEngineConfig>({
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
    ...initialConfig
  });
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [history, setHistory] = useState<AssignmentHistory[]>([]);
  const [statistics, setStatistics] = useState<any>(null);

  // Event listeners management
  const eventListenersRef = useRef<Map<AssignmentEventType, Array<(event: AssignmentEvent) => void>>>(
    new Map()
  );

  // Initialize engine
  useEffect(() => {
    engineRef.current = new AssignmentEngine(config);
    
    // Set up event listeners if real-time updates are enabled
    if (enableRealTimeUpdates) {
      setupRealtimeUpdates();
    }
    
    // Update statistics
    updateStatistics();
    
    return () => {
      // Cleanup event listeners
      eventListenersRef.current.clear();
    };
  }, [config, enableRealTimeUpdates]);

  // Fetch contacts data
  const { data: contacts = [] } = useQuery({
    queryKey: ['/api/contacts'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch workload data
  const { data: workloadData = new Map() } = useQuery({
    queryKey: ['/api/contacts/workload'],
    queryFn: async () => {
      // This would fetch real workload data
      // For now, return mock data
      const mockWorkloads = new Map<string, ContactWorkload>();
      (contacts as any[]).forEach((contact: any, index: number) => {
        mockWorkloads.set(contact.id || contact.contactId, {
          contactId: contact.id || contact.contactId,
          currentHours: 20 + (index * 5),
          maxCapacity: 40,
          activeProjects: 1 + (index % 3),
          upcomingDeadlines: [],
          availableHours: 20 - (index * 5),
          utilizationPercentage: (20 + (index * 5)) / 40 * 100,
          lastUpdated: new Date()
        });
      });
      return mockWorkloads;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch availability data
  const { data: availabilityData = new Map() } = useQuery({
    queryKey: ['/api/contacts/availability'],
    queryFn: async () => {
      // This would fetch real availability data
      // For now, return mock data
      const mockAvailability = new Map<string, ContactAvailability>();
      (contacts as any[]).forEach((contact: any) => {
        mockAvailability.set(contact.id || contact.contactId, {
          contactId: contact.id || contact.contactId,
          timezone: 'UTC',
          workingHours: {
            start: '09:00',
            end: '17:00',
            daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
          },
          timeSlots: [],
          lastUpdated: new Date(),
          isOnLeave: false
        });
      });
      return mockAvailability;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Setup real-time updates
  const setupRealtimeUpdates = useCallback(() => {
    if (!engineRef.current) return;

    // Workload updates
    engineRef.current.on(AssignmentEventType.WORKLOAD_UPDATED, (event) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts/workload'] });
      updateStatistics();
    });

    // Availability changes
    engineRef.current.on(AssignmentEventType.AVAILABILITY_CHANGED, (event) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts/availability'] });
    });

    // Skill updates
    engineRef.current.on(AssignmentEventType.SKILL_UPDATED, (event) => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    });
  }, [queryClient]);

  // Update statistics
  const updateStatistics = useCallback(() => {
    if (engineRef.current) {
      setStatistics(engineRef.current.getStatistics());
    }
  }, []);

  // Get recommendations mutation
  const recommendationsMutation = useMutation({
    mutationFn: async (taskRequirements: TaskRequirements): Promise<AssignmentRecommendation[]> => {
      if (!engineRef.current) {
        throw new Error('Assignment engine not initialized');
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await engineRef.current.getAssignmentRecommendations(
          taskRequirements,
          contacts as any[],
          workloadData,
          availabilityData
        );
        
        setRecommendations(result);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    }
  });

  // Bulk assignment mutation
  const bulkAssignmentMutation = useMutation({
    mutationFn: async (request: BulkAssignmentRequest): Promise<BulkAssignmentResult> => {
      if (!engineRef.current) {
        throw new Error('Assignment engine not initialized');
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await engineRef.current.processBulkAssignment(request);
        setBulkResult(result);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    }
  });

  // Core functionality
  const getRecommendations = useCallback(
    (taskRequirements: TaskRequirements) => {
      return recommendationsMutation.mutateAsync(taskRequirements);
    },
    [recommendationsMutation]
  );

  const processBulkAssignment = useCallback(
    (request: BulkAssignmentRequest) => {
      return bulkAssignmentMutation.mutateAsync(request);
    },
    [bulkAssignmentMutation]
  );

  // Configuration management
  const updateConfig = useCallback((newConfig: Partial<AssignmentEngineConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    if (engineRef.current) {
      engineRef.current.updateConfig(newConfig);
    }
  }, []);

  // Rules management
  const addRule = useCallback((rule: AssignmentRule) => {
    setRules(prev => [...prev, rule]);
    if (engineRef.current) {
      engineRef.current.addBusinessRule(rule);
    }
  }, []);

  const removeRule = useCallback((ruleId: string) => {
    setRules(prev => prev.filter(rule => rule.id !== ruleId));
    // Note: Engine doesn't have removeRule method, would need to be added
  }, []);

  // History management
  const recordAssignment = useCallback((assignment: AssignmentHistory) => {
    setHistory(prev => [...prev, assignment]);
    if (engineRef.current) {
      engineRef.current.recordAssignment(assignment);
    }
    updateStatistics();
  }, [updateStatistics]);

  // Event listener management
  const addEventListener = useCallback(
    (eventType: AssignmentEventType, callback: (event: AssignmentEvent) => void) => {
      const listeners = eventListenersRef.current.get(eventType) || [];
      listeners.push(callback);
      eventListenersRef.current.set(eventType, listeners);
      
      if (engineRef.current) {
        engineRef.current.on(eventType, callback);
      }
    },
    []
  );

  const removeEventListener = useCallback(
    (eventType: AssignmentEventType, callback: (event: AssignmentEvent) => void) => {
      const listeners = eventListenersRef.current.get(eventType) || [];
      const updatedListeners = listeners.filter(listener => listener !== callback);
      eventListenersRef.current.set(eventType, updatedListeners);
      
      // Note: Engine doesn't have removeEventListener method, would need to be added
    },
    []
  );

  // Clear recommendations when dependencies change
  useEffect(() => {
    setRecommendations(null);
    setBulkResult(null);
    setError(null);
  }, [contacts, workloadData, availabilityData]);

  return {
    // Core functionality
    getRecommendations,
    processBulkAssignment,
    
    // State
    recommendations,
    bulkResult,
    isLoading: isLoading || recommendationsMutation.isPending || bulkAssignmentMutation.isPending,
    error,
    
    // Engine management
    engine: engineRef.current,
    config,
    updateConfig,
    
    // Rules management
    rules,
    addRule,
    removeRule,
    
    // History and learning
    history,
    recordAssignment,
    
    // Real-time updates
    addEventListener,
    removeEventListener,
    
    // Statistics
    statistics
  };
}

// Utility hook for quick task assignment
export function useQuickAssignment() {
  const { getRecommendations, isLoading, error } = useAssignmentEngine();
  
  const assignTask = useCallback(async (
    taskRequirements: TaskRequirements,
    autoSelect: boolean = false
  ) => {
    const recommendations = await getRecommendations(taskRequirements);
    
    if (autoSelect && recommendations.length > 0) {
      const bestRecommendation = recommendations[0];
      // Auto-assign to best recommendation
      // This would trigger the actual assignment process
      return bestRecommendation;
    }
    
    return recommendations;
  }, [getRecommendations]);
  
  return {
    assignTask,
    isLoading,
    error
  };
}

// Hook for workload monitoring
export function useWorkloadMonitoring() {
  const { addEventListener, removeEventListener, statistics } = useAssignmentEngine();
  const [workloadAlerts, setWorkloadAlerts] = useState<string[]>([]);
  
  useEffect(() => {
    const handleWorkloadUpdate = (event: AssignmentEvent) => {
      // Check for overload conditions and create alerts
      if (event.data.utilization > 90) {
        setWorkloadAlerts(prev => [
          ...prev,
          `Contact ${event.data.contactId} is overloaded at ${event.data.utilization}%`
        ]);
      }
    };
    
    addEventListener(AssignmentEventType.WORKLOAD_UPDATED, handleWorkloadUpdate);
    
    return () => {
      removeEventListener(AssignmentEventType.WORKLOAD_UPDATED, handleWorkloadUpdate);
    };
  }, [addEventListener, removeEventListener]);
  
  const clearAlert = useCallback((index: number) => {
    setWorkloadAlerts(prev => prev.filter((_, i) => i !== index));
  }, []);
  
  return {
    workloadAlerts,
    clearAlert,
    statistics
  };
}