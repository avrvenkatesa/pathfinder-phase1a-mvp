import { ContactService } from './contact.service';
import { MockContactService } from '../mocks/mockIntegration';
import type { 
  Contact, 
  ContactSearchParams, 
  ContactListResponse, 
  ContactSearchResult 
} from '@/types/contact';

// Service interface that both real and mock services implement
interface IContactService {
  getContacts(params?: ContactSearchParams): Promise<ContactListResponse>;
  getContact(contactId: string): Promise<Contact>;
  searchContacts(query: string, filters?: any): Promise<ContactSearchResult[]>;
  getWorkflowCompatibleContacts(filters?: ContactSearchParams): Promise<Contact[]>;
  createContact(contactData: Omit<Contact, 'contactId'>): Promise<Contact>;
  updateContact(contactId: string, updates: Partial<Contact>): Promise<Contact>;
  deleteContact(contactId: string): Promise<void>;
  batchUpdateContacts(updates: Array<{ contactId: string; data: Partial<Contact> }>): Promise<Contact[]>;
  clearCache(): void;
  getCacheStats(): { size: number; keys: string[] };
}

// Enhanced ContactService with automatic fallback
export class EnhancedContactService implements IContactService {
  private realService: ContactService;
  private mockService: typeof MockContactService;
  private isApiAvailable: boolean | null = null;
  private fallbackEnabled: boolean;
  
  constructor() {
    this.realService = new ContactService();
    this.mockService = MockContactService;
    
    // Enable fallback in development or when explicitly configured
    this.fallbackEnabled = 
      import.meta.env.MODE === 'development' || 
      import.meta.env.VITE_ENABLE_MOCK_FALLBACK === 'true';
  }

  // Check if API is available (with caching to avoid repeated checks)
  private async checkApiAvailability(): Promise<boolean> {
    if (this.isApiAvailable !== null) {
      return this.isApiAvailable;
    }

    try {
      // Try a simple API call with short timeout
      const response = await fetch('/api/v1/health', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(3000) 
      });
      
      this.isApiAvailable = response.ok;
      return this.isApiAvailable;
    } catch (error) {
      console.warn('API availability check failed:', error);
      this.isApiAvailable = false;
      return false;
    }
  }

  // Generic method wrapper with fallback logic
  private async withFallback<T>(
    methodName: keyof IContactService,
    ...args: any[]
  ): Promise<T> {
    if (!this.fallbackEnabled) {
      // Production mode - always use real service
      return (this.realService[methodName] as any)(...args);
    }

    try {
      // Try real service first
      const result = await (this.realService[methodName] as any)(...args);
      
      // Mark API as available on success
      if (this.isApiAvailable === false) {
        console.log('✅ API is now available, switching back from mock mode');
        this.isApiAvailable = true;
      }
      
      return result;
    } catch (error) {
      console.warn(`Real API failed for ${String(methodName)}:`, error);
      
      // Check if we should use mock fallback
      const apiAvailable = await this.checkApiAvailability();
      
      if (!apiAvailable && this.fallbackEnabled) {
        console.log(`🔄 Falling back to mock data for ${String(methodName)}`);
        
        // Use mock service
        return (this.mockService[methodName] as any)(...args);
      }
      
      // Re-throw error if fallback not enabled or not available
      throw error;
    }
  }

  // Implement all IContactService methods with fallback
  async getContacts(params?: ContactSearchParams): Promise<ContactListResponse> {
    return this.withFallback<ContactListResponse>('getContacts', params);
  }

  async getContact(contactId: string): Promise<Contact> {
    return this.withFallback<Contact>('getContact', contactId);
  }

  async searchContacts(query: string, filters?: any): Promise<ContactSearchResult[]> {
    return this.withFallback<ContactSearchResult[]>('searchContacts', query, filters);
  }

  async getWorkflowCompatibleContacts(filters?: ContactSearchParams): Promise<Contact[]> {
    return this.withFallback<Contact[]>('getWorkflowCompatibleContacts', filters);
  }

  async createContact(contactData: Omit<Contact, 'contactId'>): Promise<Contact> {
    // Create operations should prefer real API
    try {
      return await this.realService.createContact(contactData);
    } catch (error) {
      if (this.fallbackEnabled) {
        console.warn('Cannot create contacts in mock mode');
        throw new Error('Contact creation requires real API connection');
      }
      throw error;
    }
  }

  async updateContact(contactId: string, updates: Partial<Contact>): Promise<Contact> {
    // Update operations should prefer real API
    try {
      return await this.realService.updateContact(contactId, updates);
    } catch (error) {
      if (this.fallbackEnabled) {
        console.warn('Cannot update contacts in mock mode');
        // Could implement local mock updates here if needed
        throw new Error('Contact updates require real API connection');
      }
      throw error;
    }
  }

  async deleteContact(contactId: string): Promise<void> {
    // Delete operations should only work with real API
    try {
      return await this.realService.deleteContact(contactId);
    } catch (error) {
      if (this.fallbackEnabled) {
        throw new Error('Contact deletion requires real API connection');
      }
      throw error;
    }
  }

  async batchUpdateContacts(updates: Array<{ contactId: string; data: Partial<Contact> }>): Promise<Contact[]> {
    try {
      return await this.realService.batchUpdateContacts(updates);
    } catch (error) {
      if (this.fallbackEnabled) {
        throw new Error('Batch updates require real API connection');
      }
      throw error;
    }
  }

  clearCache(): void {
    this.realService.clearCache();
  }

  getCacheStats(): { size: number; keys: string[] } {
    return this.realService.getCacheStats();
  }

  // Additional utility methods
  isUsingMockMode(): boolean {
    return this.isApiAvailable === false && this.fallbackEnabled;
  }

  async forceApiCheck(): Promise<boolean> {
    this.isApiAvailable = null; // Reset cache
    return this.checkApiAvailability();
  }

  setAuthToken(token: string): void {
    this.realService.setAuthToken(token);
  }

  getConnectionStatus(): 'api' | 'mock' | 'unknown' {
    if (this.isApiAvailable === true) return 'api';
    if (this.isApiAvailable === false && this.fallbackEnabled) return 'mock';
    return 'unknown';
  }
}

// Export singleton instance
export const contactService = new EnhancedContactService();

// Export for testing or custom instances
export default EnhancedContactService;