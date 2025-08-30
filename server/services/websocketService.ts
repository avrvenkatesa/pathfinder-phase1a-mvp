import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';

export interface WebSocketMessage {
  type: 'CONTACT_DELETED' | 'CONTACT_MODIFIED' | 'CONTACT_VALIDATION_ERROR' | 'HEARTBEAT' | 'AUTH_REQUIRED' | 'ERROR';
  contactId?: string;
  data?: any;
  timestamp: string;
  affectedWorkflows?: string[];
}

export class ContactWebSocketService {
  private wss: WebSocketServer | null = null;
  private clients = new Set<WebSocket>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  public initialize(server: Server): void {
    this.wss = new WebSocketServer({ 
      server,
      path: '/contacts'
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('New WebSocket connection established');
      this.clients.add(ws);

      // Send welcome message
      this.sendToClient(ws, {
        type: 'HEARTBEAT',
        timestamp: new Date().toISOString(),
        data: { message: 'Connected to contact events' }
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
          this.sendToClient(ws, {
            type: 'ERROR',
            timestamp: new Date().toISOString(),
            data: { message: 'Invalid message format' }
          });
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    // Start heartbeat to keep connections alive
    this.startHeartbeat();
    
    console.log('Contact WebSocket service initialized');
  }

  private handleClientMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'HEARTBEAT':
        this.sendToClient(ws, {
          type: 'HEARTBEAT',
          timestamp: new Date().toISOString()
        });
        break;
      
      case 'AUTH_REQUIRED':
        // Handle authentication if needed
        break;
        
      default:
        console.log('Received client message:', message.type);
    }
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
      }
    }
  }

  private broadcast(message: WebSocketMessage): void {
    console.log(`Broadcasting ${message.type} to ${this.clients.size} clients`);
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        this.sendToClient(client, message);
      } else {
        // Remove dead connections
        this.clients.delete(client);
      }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({
        type: 'HEARTBEAT',
        timestamp: new Date().toISOString()
      });
    }, 30000); // 30 seconds
  }

  public stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
    });
    
    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }

  // Public methods for broadcasting contact events
  public broadcastContactDeleted(
    contactId: string,
    contactData?: any,
    affectedWorkflows: string[] = []
  ): void {
    this.broadcast({
      type: 'CONTACT_DELETED',
      contactId,
      timestamp: new Date().toISOString(),
      data: contactData,
      affectedWorkflows,
    });
  }

  public broadcastContactModified(
    contactId: string,
    changes: any,
    contactData?: any,
    affectedWorkflows: string[] = []
  ): void {
    this.broadcast({
      type: 'CONTACT_MODIFIED',
      contactId,
      timestamp: new Date().toISOString(),
      data: {
        changes,
        contactName: contactData?.name,
        ...contactData
      },
      affectedWorkflows,
    });
  }

  public broadcastValidationError(contactId: string, error: string): void {
    this.broadcast({
      type: 'CONTACT_VALIDATION_ERROR',
      contactId,
      timestamp: new Date().toISOString(),
      data: { error }
    });
  }

  public getConnectionStats(): { connectedClients: number; state: string } {
    return {
      connectedClients: this.clients.size,
      state: this.wss ? 'running' : 'stopped'
    };
  }
}

// Export singleton instance
export const contactWebSocketService = new ContactWebSocketService();