import { ContactAvailabilityUpdate, Contact } from '@/types/contact';

export enum WebSocketState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

export interface ContactWebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  authToken?: string;
}

export interface WebSocketMessage {
  type: 'CONTACT_AVAILABILITY_UPDATE' | 'CONTACT_WORKLOAD_UPDATE' | 'CONTACT_STATUS_CHANGE' | 'CONTACT_DELETED' | 'CONTACT_MODIFIED' | 'CONTACT_VALIDATION_ERROR' | 'HEARTBEAT' | 'AUTH_REQUIRED' | 'ERROR';
  data?: any;
  timestamp: string;
  contactId?: string;
  affectedWorkflows?: string[];
}

export interface ContactAvailabilitySubscription {
  contactId: string;
  callback: (update: ContactAvailabilityUpdate) => void;
}

export class ContactWebSocketService {
  private ws: WebSocket | null = null;
  private config: ContactWebSocketConfig;
  private state: WebSocketState = WebSocketState.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private subscriptions = new Map<string, Set<(update: ContactAvailabilityUpdate) => void>>();
  private globalListeners = new Set<(message: WebSocketMessage) => void>();
  private workflowSubscribers = new Map<string, Set<(msg: WebSocketMessage) => void>>();
  private messageQueue: WebSocketMessage[] = [];
  private lastHeartbeat: number = 0;

  // Event callbacks
  private onStateChange: ((state: WebSocketState) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  private onReconnect: (() => void) | null = null;

  constructor(config?: Partial<ContactWebSocketConfig>) {
    const defaultUrl =
      (typeof window !== 'undefined' && (window as any).ENV?.NEXT_PUBLIC_WS_URL) ||
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_WS_URL) ||
      // In development, connect directly to API server
      (window.location.hostname === 'localhost' || window.location.hostname.includes('replit.dev')
        ? 'ws://localhost:5000/contacts'
        : (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/contacts');

    this.config = {
      url: defaultUrl,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000, // 30 seconds
      authToken: this.getAuthToken(),
      ...config
    };
  }

  private getAuthToken(): string | undefined {
    try {
      return localStorage.getItem('authToken') || 
             sessionStorage.getItem('authToken') || 
             undefined;
    } catch {
      return undefined;
    }
  }

  public setAuthToken(token: string): void {
    this.config.authToken = token;
    if (this.ws && this.state === WebSocketState.CONNECTED) {
      this.authenticate();
    }
  }

  private setState(newState: WebSocketState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.onStateChange?.(newState);
      
      // Handle reconnection success
      if (oldState === WebSocketState.RECONNECTING && newState === WebSocketState.CONNECTED) {
        this.onReconnect?.();
      }
    }
  }

  private authenticate(): void {
    if (this.config.authToken && this.state === WebSocketState.CONNECTED) {
      this.sendMessage({
        type: 'AUTH_REQUIRED',
        data: { token: this.config.authToken },
        timestamp: new Date().toISOString()
      });
    }
  }

  private setupHeartbeat(): void {
    this.clearHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.state === WebSocketState.CONNECTED) {
        this.sendMessage({
          type: 'HEARTBEAT',
          timestamp: new Date().toISOString()
        });
        
        // Check if we missed heartbeats (connection might be dead)
        const now = Date.now();
        if (this.lastHeartbeat > 0 && (now - this.lastHeartbeat) > this.config.heartbeatInterval * 2) {
          console.warn('Heartbeat timeout detected, reconnecting...');
          this.reconnect();
        }
      }
    }, this.config.heartbeatInterval);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // Update last heartbeat timestamp
      if (message.type === 'HEARTBEAT') {
        this.lastHeartbeat = Date.now();
        return;
      }

      // Notify global listeners
      this.globalListeners.forEach(listener => {
        try {
          listener(message);
        } catch (error) {
          console.error('Error in WebSocket global listener:', error);
        }
      });

      // Handle contact availability updates
      if (message.type === 'CONTACT_AVAILABILITY_UPDATE' || 
          message.type === 'CONTACT_WORKLOAD_UPDATE' || 
          message.type === 'CONTACT_STATUS_CHANGE') {
        
        const update = message.data as ContactAvailabilityUpdate;
        const contactSubscriptions = this.subscriptions.get(update.contactId);
        
        if (contactSubscriptions) {
          contactSubscriptions.forEach(callback => {
            try {
              callback(update);
            } catch (error) {
              console.error('Error in contact availability callback:', error);
            }
          });
        }
      }

      // Handle deletion/modification events for workflow subscribers
      if (message.type === 'CONTACT_DELETED' || message.type === 'CONTACT_MODIFIED') {
        const targets = Array.isArray(message.affectedWorkflows) ? message.affectedWorkflows : [];

        if (targets.length) {
          // Notify only the subscribers of impacted workflows
          targets.forEach((wfId) => {
            const set = this.workflowSubscribers.get(`workflow:${wfId}`);
            if (set && set.size) {
              set.forEach((callback) => {
                try {
                  callback(message);
                } catch (error) {
                  console.error('Error in workflow subscriber callback:', error);
                }
              });
            }
          });
        } else {
          // Fallback: if server didn't include affectedWorkflows, notify all workflow subscribers
          this.workflowSubscribers.forEach((callbacks, key) => {
            if (key.startsWith('workflow:')) {
              callbacks.forEach(callback => {
                try {
                  callback(message);
                } catch (error) {
                  console.error('Error in workflow deletion callback:', error);
                }
              });
            }
          });
        }
      }

      // Handle authentication requirements
      if (message.type === 'AUTH_REQUIRED') {
        this.authenticate();
      }

      // Handle errors
      if (message.type === 'ERROR') {
        const error = new Error(message.data?.message || 'WebSocket error');
        this.onError?.(error);
      }

    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.onError?.(error as Error);
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.state === WebSocketState.CONNECTED) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  private sendMessage(message: WebSocketMessage): void {
    if (this.state === WebSocketState.CONNECTED && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Failed to send WebSocket message:', error);
        this.messageQueue.push(message);
        this.reconnect();
      }
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
    }
  }

  public connect(): void {
    if (this.state === WebSocketState.CONNECTED || this.state === WebSocketState.CONNECTING) {
      console.log('WebSocket already connected/connecting, state:', this.state);
      return;
    }

    console.log('Attempting to connect to WebSocket:', this.config.url);
    this.setState(WebSocketState.CONNECTING);

    try {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => {
        console.log('Contact WebSocket connected to:', this.config.url);
        this.setState(WebSocketState.CONNECTED);
        this.reconnectAttempts = 0;
        this.authenticate();
        this.setupHeartbeat();
        this.processMessageQueue();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        console.log('Contact WebSocket disconnected:', event.code, event.reason);
        this.setState(WebSocketState.DISCONNECTED);
        this.clearHeartbeat();
        
        // Only auto-reconnect if it wasn't a clean close
        if (event.code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('Contact WebSocket error:', error);
        this.setState(WebSocketState.ERROR);
        const err = new Error('WebSocket connection error');
        this.onError?.(err);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.setState(WebSocketState.ERROR);
      this.onError?.(error as Error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.setState(WebSocketState.RECONNECTING);
    this.reconnectAttempts++;

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnect();
    }, delay);
  }

  public reconnect(): void {
    this.disconnect();
    this.connect();
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.clearHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState(WebSocketState.DISCONNECTED);
  }

  public subscribeToContact(contactId: string, callback: (update: ContactAvailabilityUpdate) => void): () => void {
    if (!this.subscriptions.has(contactId)) {
      this.subscriptions.set(contactId, new Set());
    }
    
    this.subscriptions.get(contactId)?.add(callback);

    // Send subscription message if connected
    if (this.state === WebSocketState.CONNECTED) {
      this.sendMessage({
        type: 'CONTACT_AVAILABILITY_UPDATE',
        data: { action: 'subscribe', contactId },
        timestamp: new Date().toISOString(),
        contactId
      });
    }

    // Return unsubscribe function
    return () => {
      const contactSubscriptions = this.subscriptions.get(contactId);
      if (contactSubscriptions) {
        contactSubscriptions.delete(callback);
        
        if (contactSubscriptions.size === 0) {
          this.subscriptions.delete(contactId);
          
          // Send unsubscribe message if connected
          if (this.state === WebSocketState.CONNECTED) {
            this.sendMessage({
              type: 'CONTACT_AVAILABILITY_UPDATE',
              data: { action: 'unsubscribe', contactId },
              timestamp: new Date().toISOString(),
              contactId
            });
          }
        }
      }
    };
  }

  public subscribeToMultipleContacts(
    contactIds: string[], 
    callback: (update: ContactAvailabilityUpdate) => void
  ): () => void {
    const unsubscribeFunctions = contactIds.map(id => 
      this.subscribeToContact(id, callback)
    );

    return () => {
      unsubscribeFunctions.forEach(unsub => unsub());
    };
  }

  public addGlobalListener(callback: (message: WebSocketMessage) => void): () => void {
    this.globalListeners.add(callback);
    
    return () => {
      this.globalListeners.delete(callback);
    };
  }

  // Event handlers

  public onStateChanged(callback: (state: WebSocketState) => void): void {
    this.onStateChange = callback;
  }

  public onErrorOccurred(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  public onReconnected(callback: () => void): void {
    this.onReconnect = callback;
  }

  // Status getters

  public getState(): WebSocketState {
    return this.state;
  }

  public isConnected(): boolean {
    return this.state === WebSocketState.CONNECTED;
  }

  public getConnectionInfo(): {
    state: WebSocketState;
    reconnectAttempts: number;
    subscriptions: number;
    queuedMessages: number;
    lastHeartbeat: number;
  } {
    return {
      state: this.state,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: this.subscriptions.size,
      queuedMessages: this.messageQueue.length,
      lastHeartbeat: this.lastHeartbeat
    };
  }

  // NEW: Workflow-specific subscription method for contact deletion/modification events
  public subscribeToContactDeletions(workflowId: string, callback: (msg: WebSocketMessage) => void): () => void {
    const key = `workflow:${workflowId}`;
    if (!this.workflowSubscribers.has(key)) {
      this.workflowSubscribers.set(key, new Set());
    }
    this.workflowSubscribers.get(key)?.add(callback);

    // Return unsubscribe function
    return () => {
      this.workflowSubscribers.get(key)?.delete(callback);
      if (this.workflowSubscribers.get(key)?.size === 0) {
        this.workflowSubscribers.delete(key);
      }
    };
  }
}

// Export singleton instance
export const contactWebSocketService = new ContactWebSocketService();

// Export class for custom instances
export default ContactWebSocketService;