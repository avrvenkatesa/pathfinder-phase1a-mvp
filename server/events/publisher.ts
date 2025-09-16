// server/events/publisher.ts
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { EventPublisher, WorkflowEvent } from './types';
import { logger } from '../logger';

export class SocketIOEventPublisher implements EventPublisher {
  constructor(private io: SocketIOServer) {}

  async publish(event: WorkflowEvent): Promise<void> {
    this.io.emit(event.type, {
      id: event.id,
      timestamp: event.timestamp,
      payload: event.payload
    });
    logger.info('Event published', { eventType: event.type, eventId: event.id });
  }

  async publishToUser(userId: string, event: WorkflowEvent): Promise<void> {
    this.io.to(`user:${userId}`).emit(event.type, {
      id: event.id,
      timestamp: event.timestamp,
      payload: event.payload
    });
  }

  async publishToRoom(room: string, event: WorkflowEvent): Promise<void> {
    this.io.to(room).emit(event.type, {
      id: event.id,
      timestamp: event.timestamp,
      payload: event.payload
    });
  }

  async disconnect(): Promise<void> {
    this.io.close();
  }
}

export const createEvent = {
  stepAdvanced: (instanceId: string, stepId: string, status: string, previousStatus: string): WorkflowEvent => ({
    id: uuidv4(),
    timestamp: new Date(),
    type: 'step.advanced',
    payload: { instanceId, stepId, status, previousStatus }
  }),
  
  stepCompleted: (instanceId: string, stepId: string, completedAt: Date): WorkflowEvent => ({
    id: uuidv4(),
    timestamp: new Date(),
    type: 'step.completed',
    payload: { instanceId, stepId, completedAt }
  }),
  
  instanceCancelled: (instanceId: string, cancelledAt: Date, reason?: string): WorkflowEvent => ({
    id: uuidv4(),
    timestamp: new Date(),
    type: 'instance.cancelled',
    payload: { instanceId, cancelledAt, reason }
  })
};

export let eventPublisher: EventPublisher | null = null;
export function setEventPublisher(publisher: EventPublisher): void {
  eventPublisher = publisher;
}
export function getEventPublisher(): EventPublisher {
  if (!eventPublisher) throw new Error('Event publisher not initialized');
  return eventPublisher;
}
