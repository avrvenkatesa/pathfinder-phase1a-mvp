// server/events/types.ts
/**
 * Event system for real-time notifications
 * Abstracted to support evolution: Socket.io → Redis → Kafka
 */

export interface BaseEvent {
  id: string;
  timestamp: Date;
  type: string;
  userId?: string;
}

// Workflow Events
export interface StepAdvancedEvent extends BaseEvent {
  type: 'step.advanced';
  payload: {
    instanceId: string;
    stepId: string;
    status: string;
    previousStatus: string;
  };
}

export interface StepCompletedEvent extends BaseEvent {
  type: 'step.completed';
  payload: {
    instanceId: string;
    stepId: string;
    completedAt: Date;
    duration?: number;
  };
}

export interface InstanceCancelledEvent extends BaseEvent {
  type: 'instance.cancelled';
  payload: {
    instanceId: string;
    cancelledAt: Date;
    reason?: string;
  };
}

export type WorkflowEvent = 
  | StepAdvancedEvent 
  | StepCompletedEvent 
  | InstanceCancelledEvent;

export interface EventPublisher {
  publish(event: WorkflowEvent): Promise<void>;
  publishToUser(userId: string, event: WorkflowEvent): Promise<void>;
  publishToRoom(room: string, event: WorkflowEvent): Promise<void>;
  disconnect(): Promise<void>;
}
