import { ContactMockServer, mockAvailabilityUpdates } from './contactMockServer';
import type { Contact, ContactSearchParams, ContactListResponse } from '@/types/contact';

// Development mode flag
const isDevelopment = import.meta.env.MODE === 'development';

// Mock API integration for development
export class MockContactService {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private static setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: this.CACHE_TTL
    });
  }

  private static getCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  // Simulate network delay for realistic testing
  private static async delay(ms: number = 300): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async getContacts(params?: ContactSearchParams): Promise<ContactListResponse> {
    const cacheKey = `contacts:${JSON.stringify(params)}`;
    const cached = this.getCache<ContactListResponse>(cacheKey);
    
    if (cached) {
      return cached;
    }

    await this.delay();
    
    const result = ContactMockServer.getContacts({
      query: params?.query,
      department: params?.department,
      availability: params?.availability,
      page: params?.page,
      limit: params?.limit
    });

    this.setCache(cacheKey, result);
    return result;
  }

  static async getContact(contactId: string): Promise<Contact | null> {
    const cacheKey = `contact:${contactId}`;
    const cached = this.getCache<Contact>(cacheKey);
    
    if (cached) {
      return cached;
    }

    await this.delay(200);
    
    const result = ContactMockServer.getContact(contactId);
    if (result) {
      this.setCache(cacheKey, result);
    }
    
    return result;
  }

  static async searchContacts(query: string, filters?: any): Promise<any[]> {
    if (!query || query.length < 2) {
      return [];
    }

    await this.delay(250);
    return ContactMockServer.searchContacts(query);
  }

  static async getWorkflowCompatibleContacts(filters?: ContactSearchParams): Promise<Contact[]> {
    const cacheKey = `workflow-contacts:${JSON.stringify(filters)}`;
    const cached = this.getCache<Contact[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    await this.delay(200);
    
    const result = ContactMockServer.getWorkflowCompatibleContacts();
    this.setCache(cacheKey, result);
    
    return result;
  }

  // Mock real-time availability updates
  static getAvailabilityUpdate(contactId: string) {
    return mockAvailabilityUpdates.get(contactId);
  }

  // Simulate availability changes for testing
  static simulateAvailabilityChange(contactId: string, newAvailability: string) {
    const current = mockAvailabilityUpdates.get(contactId);
    if (current) {
      mockAvailabilityUpdates.set(contactId, {
        ...current,
        availability: newAvailability as any,
        timestamp: new Date()
      });
    }
  }
}

// Mock WebSocket service for real-time updates
export class MockContactWebSocketService {
  private static listeners = new Map<string, Set<(update: any) => void>>();
  private static connectionState = 'CONNECTED';

  static subscribe(contactId: string, callback: (update: any) => void): () => void {
    if (!this.listeners.has(contactId)) {
      this.listeners.set(contactId, new Set());
    }
    
    this.listeners.get(contactId)!.add(callback);
    
    // Send initial state
    const initialUpdate = MockContactService.getAvailabilityUpdate(contactId);
    if (initialUpdate) {
      setTimeout(() => callback(initialUpdate), 100);
    }

    // Return unsubscribe function
    return () => {
      this.listeners.get(contactId)?.delete(callback);
      if (this.listeners.get(contactId)?.size === 0) {
        this.listeners.delete(contactId);
      }
    };
  }

  static getConnectionState() {
    return this.connectionState;
  }

  static isConnected() {
    return this.connectionState === 'CONNECTED';
  }

  // Simulate real-time updates for testing
  static simulateUpdate(contactId: string, update: any) {
    const listeners = this.listeners.get(contactId);
    if (listeners) {
      listeners.forEach(callback => callback(update));
    }
  }
}

// Development helper functions
export const contactMockHelpers = {
  // Enable mock mode
  enableMockMode() {
    console.log('🔧 Contact Mock Mode Enabled - Using mock data for development');
  },

  // Test real-time updates
  testRealTimeUpdates() {
    console.log('🔄 Testing real-time contact updates...');
    
    // Simulate some availability changes
    setTimeout(() => {
      MockContactService.simulateAvailabilityChange('1', 'Busy');
      MockContactWebSocketService.simulateUpdate('1', 
        MockContactService.getAvailabilityUpdate('1')
      );
    }, 2000);

    setTimeout(() => {
      MockContactService.simulateAvailabilityChange('2', 'Available');
      MockContactWebSocketService.simulateUpdate('2', 
        MockContactService.getAvailabilityUpdate('2')
      );
    }, 4000);
  },

  // Get mock statistics
  getMockStats() {
    return {
      totalContacts: ContactMockServer.getContacts().total,
      availableContacts: ContactMockServer.getContacts({ availability: ['Available'] }).total,
      workflowCompatible: ContactMockServer.getWorkflowCompatibleContacts().length,
      departments: [...new Set(ContactMockServer.getContacts().contacts.map(c => c.department))],
      skills: [...new Set(ContactMockServer.getContacts().contacts.flatMap(c => c.skills.map(s => s.name)))]
    };
  }
};

// Export development mode flag and services
export { isDevelopment, MockContactService as contactService, MockContactWebSocketService as contactWebSocketService };