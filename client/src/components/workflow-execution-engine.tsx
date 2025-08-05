import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Pause, 
  Square, 
  SkipForward, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Activity,
  User,
  Settings,
  FileText,
  ArrowRight
} from 'lucide-react';
import type { 
  WorkflowDefinition, 
  WorkflowInstance, 
  WorkflowTask, 
  BpmnElement, 
  BpmnConnection,
  TaskExecution,
  WorkflowExecution
} from '@shared/schema';

// Workflow execution engine class
export class WorkflowExecutor {
  private instance: WorkflowInstance;
  private workflow: WorkflowDefinition;
  private currentTasks: Map<string, WorkflowTask> = new Map();
  private completedTasks: Set<string> = new Set();
  private executionHistory: Array<{
    timestamp: Date;
    action: string;
    elementId?: string;
    details: Record<string, any>;
  }> = [];

  constructor(workflow: WorkflowDefinition, instance: WorkflowInstance) {
    this.workflow = workflow;
    this.instance = instance;
  }

  // Start workflow execution
  async start(): Promise<void> {
    this.instance.status = 'running';
    this.instance.startedAt = new Date();
    
    this.addToHistory('workflow_started', undefined, {
      workflowId: this.workflow.id,
      instanceId: this.instance.id
    });

    // Find start events and begin execution
    const startEvents = this.workflow.elements.filter(e => e.type === 'start_event');
    for (const startEvent of startEvents) {
      await this.executeElement(startEvent);
    }
  }

  // Pause workflow execution
  async pause(): Promise<void> {
    this.instance.status = 'pending';
    this.instance.pausedAt = new Date();
    
    this.addToHistory('workflow_paused', undefined, {
      pausedTasks: Array.from(this.currentTasks.keys())
    });
  }

  // Resume workflow execution
  async resume(): Promise<void> {
    this.instance.status = 'running';
    this.instance.pausedAt = null;
    
    this.addToHistory('workflow_resumed', undefined, {
      resumedTasks: Array.from(this.currentTasks.keys())
    });

    // Continue executing current tasks
    for (const task of Array.from(this.currentTasks.values())) {
      if (task.status === 'pending' || task.status === 'in_progress') {
        await this.continueTaskExecution(task);
      }
    }
  }

  // Stop workflow execution
  async stop(): Promise<void> {
    this.instance.status = 'cancelled';
    this.instance.completedAt = new Date();
    
    // Cancel all current tasks
    Array.from(this.currentTasks.values()).forEach(task => {
      if (task.status === 'pending' || task.status === 'in_progress') {
        task.status = 'skipped';
        task.completedAt = new Date();
      }
    });
    
    this.addToHistory('workflow_stopped', undefined, {
      cancelledTasks: Array.from(this.currentTasks.keys())
    });
  }

  // Execute a workflow element
  private async executeElement(element: BpmnElement): Promise<void> {
    try {
      this.addToHistory('element_started', element.id, {
        elementType: element.type,
        elementName: element.name
      });

      switch (element.type) {
        case 'start_event':
          await this.executeStartEvent(element);
          break;
        case 'end_event':
          await this.executeEndEvent(element);
          break;
        case 'user_task':
          await this.executeUserTask(element);
          break;
        case 'system_task':
          await this.executeSystemTask(element);
          break;
        case 'decision_gateway':
          await this.executeDecisionGateway(element);
          break;
        default:
          throw new Error(`Unsupported element type: ${element.type}`);
      }

      this.addToHistory('element_completed', element.id, {
        elementType: element.type,
        elementName: element.name
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.addToHistory('element_failed', element.id, {
        elementType: element.type,
        elementName: element.name,
        error: errorMessage
      });
      
      // Handle error - for now, we'll mark the workflow as failed
      this.instance.status = 'failed';
      this.instance.errorMessage = errorMessage;
      this.instance.completedAt = new Date();
    }
  }

  // Execute start event
  private async executeStartEvent(element: BpmnElement): Promise<void> {
    // Start events just trigger the next elements
    await this.moveToNextElements(element.id);
  }

  // Execute end event
  private async executeEndEvent(element: BpmnElement): Promise<void> {
    // Check if this is the last active path
    const activeTaskCount = Array.from(this.currentTasks.values())
      .filter(task => task.status === 'pending' || task.status === 'in_progress').length;
    
    if (activeTaskCount === 0) {
      // Workflow completed
      this.instance.status = 'completed';
      this.instance.completedAt = new Date();
      
      this.addToHistory('workflow_completed', element.id, {
        totalTasks: this.currentTasks.size,
        completedTasks: this.completedTasks.size
      });
    }
  }

  // Execute user task
  private async executeUserTask(element: BpmnElement): Promise<void> {
    const task: WorkflowTask = {
      id: `task_${element.id}_${Date.now()}`,
      instanceId: this.instance.id,
      elementId: element.id,
      taskName: element.name,
      taskType: 'user_task',
      assignedContactId: element.properties?.assignee || null,
      status: 'pending',
      input: element.properties || {},
      output: {},
      startedAt: null,
      completedAt: null,
      dueDate: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.currentTasks.set(task.id, task);
    
    // User tasks need manual completion - they'll be updated externally
    // For demo purposes, we'll simulate completion after a delay
    setTimeout(() => {
      if (task.status === 'pending') {
        this.completeTask(task.id, { result: 'completed' });
      }
    }, 5000); // 5 second delay for demo
  }

  // Execute system task
  private async executeSystemTask(element: BpmnElement): Promise<void> {
    const task: WorkflowTask = {
      id: `task_${element.id}_${Date.now()}`,
      instanceId: this.instance.id,
      elementId: element.id,
      taskName: element.name,
      taskType: 'system_task',
      assignedContactId: null,
      status: 'in_progress',
      input: element.properties || {},
      output: {},
      startedAt: new Date(),
      completedAt: null,
      dueDate: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.currentTasks.set(task.id, task);

    // Simulate system task execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    task.status = 'completed';
    task.completedAt = new Date();
    task.output = { result: 'System task executed successfully' };
    
    this.completedTasks.add(task.id);
    await this.moveToNextElements(element.id);
  }

  // Execute decision gateway
  private async executeDecisionGateway(element: BpmnElement): Promise<void> {
    const outgoingConnections = this.workflow.connections.filter(c => c.sourceId === element.id);
    
    // Evaluate conditions and determine which path to take
    for (const connection of outgoingConnections) {
      if (this.evaluateCondition(connection.condition, this.instance.variables || {})) {
        // Take this path
        const targetElement = this.workflow.elements.find(e => e.id === connection.targetId);
        if (targetElement) {
          await this.executeElement(targetElement);
        }
        return; // Only take one path for exclusive gateway
      }
    }
    
    // If no condition matched, take the default path (first one without condition)
    const defaultConnection = outgoingConnections.find(c => !c.condition);
    if (defaultConnection) {
      const targetElement = this.workflow.elements.find(e => e.id === defaultConnection.targetId);
      if (targetElement) {
        await this.executeElement(targetElement);
      }
    }
  }

  // Move to next elements in the workflow
  private async moveToNextElements(elementId: string): Promise<void> {
    const outgoingConnections = this.workflow.connections.filter(c => c.sourceId === elementId);
    
    for (const connection of outgoingConnections) {
      const targetElement = this.workflow.elements.find(e => e.id === connection.targetId);
      if (targetElement) {
        await this.executeElement(targetElement);
      }
    }
  }

  // Complete a task
  async completeTask(taskId: string, output: Record<string, any>): Promise<void> {
    const task = this.currentTasks.get(taskId);
    if (!task) return;

    task.status = 'completed';
    task.completedAt = new Date();
    task.output = output;
    
    this.completedTasks.add(taskId);
    
    this.addToHistory('task_completed', task.elementId, {
      taskId,
      taskName: task.taskName,
      output
    });

    // Move to next elements
    await this.moveToNextElements(task.elementId);
  }

  // Continue task execution (for resume)
  private async continueTaskExecution(task: WorkflowTask): Promise<void> {
    // Implementation depends on task type
    if (task.taskType === 'system_task' && task.status === 'in_progress') {
      // Re-execute system task
      const element = this.workflow.elements.find(e => e.id === task.elementId);
      if (element) {
        await this.executeSystemTask(element);
      }
    }
  }

  // Evaluate condition (simple implementation)
  private evaluateCondition(condition: string | undefined, variables: Record<string, any>): boolean {
    if (!condition) return true;
    
    try {
      // Simple condition evaluation - in a real implementation, use a proper expression evaluator
      // For now, just check if variable exists and is truthy
      const variableName = condition.replace(/[^a-zA-Z0-9_]/g, '');
      return !!variables[variableName];
    } catch {
      return false;
    }
  }

  // Add entry to execution history
  private addToHistory(action: string, elementId?: string, details: Record<string, any> = {}): void {
    this.executionHistory.push({
      timestamp: new Date(),
      action,
      elementId,
      details
    });
  }

  // Get current execution state
  getExecutionState(): WorkflowExecution {
    const tasks: TaskExecution[] = Array.from(this.currentTasks.values()).map(task => ({
      taskId: task.id,
      status: task.status || 'pending',
      assignedTo: task.assignedContactId || undefined,
      startedAt: task.startedAt || undefined,
      completedAt: task.completedAt || undefined,
      input: task.input as Record<string, any> || {},
      output: task.output as Record<string, any> || {},
      notes: task.notes || undefined
    }));

    return {
      instanceId: this.instance.id,
      workflowId: this.workflow.id,
      status: this.instance.status || 'pending',
      currentStep: this.instance.currentStepId || undefined,
      variables: this.instance.variables || {},
      tasks,
      history: this.executionHistory
    };
  }
}

// Task status component
function TaskStatusBadge({ status }: { status: string }) {
  const variants = {
    pending: { variant: 'outline' as const, icon: Clock, text: 'Pending' },
    in_progress: { variant: 'default' as const, icon: Activity, text: 'In Progress' },
    completed: { variant: 'default' as const, icon: CheckCircle, text: 'Completed' },
    skipped: { variant: 'secondary' as const, icon: SkipForward, text: 'Skipped' },
    failed: { variant: 'destructive' as const, icon: XCircle, text: 'Failed' },
  };

  const config = variants[status as keyof typeof variants] || variants.pending;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon size={12} />
      {config.text}
    </Badge>
  );
}

// Execution timeline component
function ExecutionTimeline({ history }: { history: Array<{ timestamp: Date; action: string; elementId?: string; details: Record<string, any> }> }) {
  return (
    <ScrollArea className="h-64">
      <div className="space-y-2">
        {history.map((entry, index) => (
          <div key={index} className="flex items-start gap-3 p-2 border-l-2 border-gray-200">
            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{entry.action.replace('_', ' ')}</span>
                <span className="text-xs text-gray-500">
                  {entry.timestamp.toLocaleTimeString()}
                </span>
              </div>
              {entry.elementId && (
                <p className="text-xs text-gray-600">Element: {entry.elementId}</p>
              )}
              {Object.keys(entry.details).length > 0 && (
                <pre className="text-xs text-gray-600 bg-gray-50 p-1 rounded mt-1">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// Main workflow execution monitor component
interface WorkflowExecutionMonitorProps {
  workflow: WorkflowDefinition;
  instance: WorkflowInstance;
  onStatusChange?: (status: string) => void;
}

export function WorkflowExecutionMonitor({ 
  workflow, 
  instance, 
  onStatusChange 
}: WorkflowExecutionMonitorProps) {
  const [executor, setExecutor] = useState<WorkflowExecutor | null>(null);
  const [executionState, setExecutionState] = useState<WorkflowExecution | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  // Initialize executor
  useEffect(() => {
    const newExecutor = new WorkflowExecutor(workflow, instance);
    setExecutor(newExecutor);
    setExecutionState(newExecutor.getExecutionState());
  }, [workflow, instance]);

  // Set up refresh interval for real-time updates
  useEffect(() => {
    if (executor) {
      const interval = setInterval(() => {
        const state = executor.getExecutionState();
        setExecutionState(state);
        onStatusChange?.(state.status);
      }, 1000);
      
      setRefreshInterval(interval);
      
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [executor, onStatusChange]);

  const handleStart = async () => {
    if (executor) {
      await executor.start();
      setExecutionState(executor.getExecutionState());
    }
  };

  const handlePause = async () => {
    if (executor) {
      await executor.pause();
      setExecutionState(executor.getExecutionState());
    }
  };

  const handleResume = async () => {
    if (executor) {
      await executor.resume();
      setExecutionState(executor.getExecutionState());
    }
  };

  const handleStop = async () => {
    if (executor) {
      await executor.stop();
      setExecutionState(executor.getExecutionState());
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (executor) {
      await executor.completeTask(taskId, { manualCompletion: true, completedAt: new Date() });
      setExecutionState(executor.getExecutionState());
    }
  };

  if (!executionState) {
    return <div>Loading execution state...</div>;
  }

  const progress = executionState.tasks.length > 0 
    ? (executionState.tasks.filter(t => t.status === 'completed').length / executionState.tasks.length) * 100 
    : 0;

  const activeTasks = executionState.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const completedTasks = executionState.tasks.filter(t => t.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Execution Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Activity size={20} />
              Workflow Execution
            </span>
            <TaskStatusBadge status={executionState.status} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Progress */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-sm text-gray-600">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>

            {/* Control Buttons */}
            <div className="flex items-center gap-2">
              {executionState.status === 'pending' && (
                <Button onClick={handleStart} className="flex items-center gap-1">
                  <Play size={16} />
                  Start
                </Button>
              )}
              
              {executionState.status === 'running' && (
                <>
                  <Button onClick={handlePause} variant="outline" className="flex items-center gap-1">
                    <Pause size={16} />
                    Pause
                  </Button>
                  <Button onClick={handleStop} variant="destructive" className="flex items-center gap-1">
                    <Square size={16} />
                    Stop
                  </Button>
                </>
              )}
              
              {executionState.status === 'pending' && instance.pausedAt && (
                <Button onClick={handleResume} className="flex items-center gap-1">
                  <Play size={16} />
                  Resume
                </Button>
              )}
              
              <Button 
                onClick={() => setExecutionState(executor!.getExecutionState())} 
                variant="outline" 
                className="flex items-center gap-1"
              >
                <RefreshCw size={16} />
                Refresh
              </Button>
            </div>

            {/* Execution Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{executionState.tasks.length}</div>
                <div className="text-sm text-gray-600">Total Tasks</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{completedTasks.length}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{activeTasks.length}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution Details */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="variables">Variables</TabsTrigger>
        </TabsList>
        
        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Task Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {executionState.tasks.map((task) => (
                  <div key={task.taskId} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">Task {task.taskId}</h4>
                        <TaskStatusBadge status={task.status} />
                      </div>
                      {task.assignedTo && (
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <User size={14} />
                          Assigned to: {task.assignedTo}
                        </p>
                      )}
                      {task.startedAt && (
                        <p className="text-xs text-gray-500">
                          Started: {task.startedAt.toLocaleString()}
                        </p>
                      )}
                    </div>
                    
                    {(task.status === 'pending' || task.status === 'in_progress') && (
                      <Button 
                        size="sm" 
                        onClick={() => handleCompleteTask(task.taskId)}
                        className="flex items-center gap-1"
                      >
                        <CheckCircle size={14} />
                        Complete
                      </Button>
                    )}
                  </div>
                ))}
                
                {executionState.tasks.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No tasks created yet</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Execution History</CardTitle>
            </CardHeader>
            <CardContent>
              <ExecutionTimeline history={executionState.history} />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="variables">
          <Card>
            <CardHeader>
              <CardTitle>Workflow Variables</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded text-sm">
                {JSON.stringify(executionState.variables, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error Display */}
      {executionState.status === 'failed' && instance.errorMessage && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Execution Failed</AlertTitle>
          <AlertDescription>{instance.errorMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default WorkflowExecutionMonitor;