import {
  Contact,
  ContactSearchParams,
  ContactListResponse,
  ContactSearchResult,
  ContactAvailabilityUpdate,
  ApiResponse,
  ContactServiceConfig,
  ApiError
} from '@/types/contact';

class ContactServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, any>,
    public status?: number
  ) {
    super(message);
    this.name = 'ContactServiceError';
  }
}

export class ContactService {
  private config: ContactServiceConfig;
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private authToken: string | null = null;
  private retryQueue: Array<() => Promise<any>> = [];
  
  constructor(config?: Partial<ContactServiceConfig>) {
    this.config = {
      baseUrl: (typeof window !== 'undefined' && (window as any).ENV?.NEXT_PUBLIC_API_URL) || '/api',
      apiVersion: 'v1',
      timeout: 10000,
      retryAttempts: 3,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      websocketUrl: (typeof window !== 'undefined' && (window as any).ENV?.NEXT_PUBLIC_WS_URL) || 'ws://localhost:3001',
      ...config
    };
    
    // Initialize auth token from localStorage or context
    this.initializeAuth();
  }

  private initializeAuth(): void {
    // Try to get token from localStorage, sessionStorage, or auth context
    try {
      this.authToken = localStorage.getItem('authToken') || 
                      sessionStorage.getItem('authToken') ||
                      null;
    } catch (error) {
      console.warn('Failed to initialize auth token:', error);
    }
  }

  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    
    return headers;
  }

  private getCacheKey(endpoint: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${endpoint}:${paramString}`;
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.config.cacheTimeout
    });
  }

  private getCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data as T;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useCache = true
  ): Promise<T> {
    const url = `${this.config.baseUrl}/${this.config.apiVersion}${endpoint}`;
    const cacheKey = this.getCacheKey(endpoint, options.method === 'GET' ? options : undefined);
    
    // Check cache for GET requests
    if (options.method === 'GET' && useCache) {
      const cached = this.getCache<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.config.timeout),
    };

    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new ContactServiceError(
            errorData.code || `HTTP_${response.status}`,
            errorData.message || response.statusText,
            errorData.details,
            response.status
          );
        }
        
        const data = await response.json();
        
        // Cache successful GET requests
        if (options.method === 'GET' && useCache) {
          this.setCache(cacheKey, data);
        }
        
        return data;
        
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on authentication errors or client errors
        if (error instanceof ContactServiceError && 
            (error.status === 401 || error.status === 403 || 
             (error.status && error.status >= 400 && error.status < 500))) {
          throw error;
        }
        
        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  // Contact CRUD Operations
  
  /**
   * Get paginated list of contacts with optional filtering
   */
  async getContacts(params?: ContactSearchParams): Promise<ContactListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v.toString()));
          } else {
            queryParams.set(key, value.toString());
          }
        }
      });
    }
    
    const endpoint = `/contacts?${queryParams.toString()}`;
    return this.makeRequest<ContactListResponse>(endpoint, { method: 'GET' });
  }

  /**
   * Get single contact by ID
   */
  async getContact(contactId: string): Promise<Contact> {
    const endpoint = `/contacts/${contactId}`;
    return this.makeRequest<Contact>(endpoint, { method: 'GET' });
  }

  /**
   * Search contacts with query string
   */
  async searchContacts(
    query: string, 
    filters?: Omit<ContactSearchParams, 'query'>
  ): Promise<ContactSearchResult[]> {
    const params = { query, ...filters };
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v.toString()));
        } else {
          queryParams.set(key, value.toString());
        }
      }
    });
    
    const endpoint = `/contacts/search?${queryParams.toString()}`;
    return this.makeRequest<ContactSearchResult[]>(endpoint, { method: 'GET' });
  }

  /**
   * Filter contacts by criteria
   */
  async filterContacts(filters: ContactSearchParams): Promise<ContactListResponse> {
    const queryParams = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => queryParams.append(key, v.toString()));
        } else {
          queryParams.set(key, value.toString());
        }
      }
    });
    
    const endpoint = `/contacts/filter?${queryParams.toString()}`;
    return this.makeRequest<ContactListResponse>(endpoint, { method: 'GET' });
  }

  /**
   * Get workflow-compatible contacts
   */
  async getWorkflowCompatibleContacts(filters?: ContactSearchParams): Promise<Contact[]> {
    const queryParams = new URLSearchParams();
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, v.toString()));
          } else {
            queryParams.set(key, value.toString());
          }
        }
      });
    }
    
    const endpoint = `/contacts/workflow-compatible?${queryParams.toString()}`;
    return this.makeRequest<Contact[]>(endpoint, { method: 'GET' });
  }

  /**
   * Create a new contact
   */
  async createContact(contactData: Omit<Contact, 'contactId'>): Promise<Contact> {
    const endpoint = '/contacts';
    return this.makeRequest<Contact>(endpoint, {
      method: 'POST',
      body: JSON.stringify(contactData),
    }, false);
  }

  /**
   * Update existing contact
   */
  async updateContact(contactId: string, updates: Partial<Contact>): Promise<Contact> {
    const endpoint = `/contacts/${contactId}`;
    
    // Clear cache for this contact
    this.cache.delete(`/contacts/${contactId}:`);
    
    return this.makeRequest<Contact>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, false);
  }

  /**
   * Delete contact
   */
  async deleteContact(contactId: string): Promise<void> {
    const endpoint = `/contacts/${contactId}`;
    
    // Clear cache for this contact
    this.cache.delete(`/contacts/${contactId}:`);
    
    await this.makeRequest<void>(endpoint, { method: 'DELETE' }, false);
  }

  /**
   * Batch update contacts
   */
  async batchUpdateContacts(updates: Array<{ contactId: string; data: Partial<Contact> }>): Promise<Contact[]> {
    const endpoint = '/contacts/batch';
    
    // Clear cache for updated contacts
    updates.forEach(({ contactId }) => {
      this.cache.delete(`/contacts/${contactId}:`);
    });
    
    return this.makeRequest<Contact[]>(endpoint, {
      method: 'PUT',
      body: JSON.stringify({ updates }),
    }, false);
  }

  // Utility methods

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size and stats
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Prefetch contact data
   */
  async prefetchContacts(contactIds: string[]): Promise<void> {
    const promises = contactIds.map(id => 
      this.getContact(id).catch(error => {
        console.warn(`Failed to prefetch contact ${id}:`, error);
      })
    );
    
    await Promise.allSettled(promises);
  }

  /**
   * Get offline queue status
   */
  getOfflineQueueStatus(): { pending: number; items: any[] } {
    return {
      pending: this.retryQueue.length,
      items: this.retryQueue.slice() // Return copy
    };
  }
}

// Export singleton instance
export const contactService = new ContactService();

// Export class for testing or custom instances
export default ContactService;