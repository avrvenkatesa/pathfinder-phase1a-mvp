import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Contact,
  ContactSearchParams,
  ContactListResponse,
  ContactSearchResult,
  ContactAvailabilityUpdate,
} from '@/types/contact';
import { contactService } from '@/services/contact-service-factory';
import { contactWebSocketService, WebSocketState } from '@/services/contact-websocket.service';

export interface UseContactsOptions {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  cacheTime?: number;
  staleTime?: number;
  retry?: number;
  retryDelay?: number;
}

export interface UseContactsResult {
  data: ContactListResponse | null;
  contacts: Contact[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  fetchMore: () => Promise<void>;
  hasMore: boolean;
  isRefetching: boolean;
}

export function useContacts(
  params?: ContactSearchParams,
  options: UseContactsOptions = {}
): UseContactsResult {
  const [data, setData] = useState<ContactListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefetching, setIsRefetching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const {
    enabled = true,
    refetchOnWindowFocus = true,
    retry = 3,
    retryDelay = 1000
  } = options;

  const retryCountRef = useRef(0);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchContacts = useCallback(async (isRefetch = false, loadMore = false) => {
    if (!enabled) return;

    try {
      if (isRefetch) {
        setIsRefetching(true);
      } else if (!loadMore) {
        setLoading(true);
      }
      
      setError(null);

      const currentParams = loadMore && data ? {
        ...paramsRef.current,
        page: (data.page || 0) + 1
      } : paramsRef.current;

      const result = await contactService.getContacts(currentParams);
      
      if (loadMore && data) {
        setData(prev => prev ? {
          ...result,
          contacts: [...prev.contacts, ...result.contacts]
        } : result);
      } else {
        setData(result);
      }
      
      retryCountRef.current = 0;
    } catch (err) {
      const error = err as Error;
      setError(error);
      
      // Retry logic
      if (retryCountRef.current < retry) {
        retryCountRef.current++;
        setTimeout(() => {
          fetchContacts(isRefetch, loadMore);
        }, retryDelay * retryCountRef.current);
      }
    } finally {
      setLoading(false);
      setIsRefetching(false);
    }
  }, [enabled, retry, retryDelay, data]);

  const refetch = useCallback(() => fetchContacts(true), [fetchContacts]);
  const fetchMore = useCallback(() => fetchContacts(false, true), [fetchContacts]);

  // Initial fetch
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts, JSON.stringify(params)]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus) return;

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleFocus);
    return () => document.removeEventListener('visibilitychange', handleFocus);
  }, [refetch, refetchOnWindowFocus]);

  return {
    data,
    contacts: data?.contacts || [],
    loading,
    error,
    refetch,
    fetchMore,
    hasMore: data?.hasMore || false,
    isRefetching
  };
}

export interface UseContactResult {
  contact: Contact | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  update: (updates: Partial<Contact>) => Promise<void>;
}

export function useContact(contactId: string | null): UseContactResult {
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchContact = useCallback(async () => {
    if (!contactId) {
      setContact(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await contactService.getContact(contactId);
      setContact(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [contactId]);

  const updateContact = useCallback(async (updates: Partial<Contact>) => {
    if (!contactId) return;

    try {
      const updatedContact = await contactService.updateContact(contactId, updates);
      setContact(updatedContact);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [contactId]);

  useEffect(() => {
    fetchContact();
  }, [fetchContact]);

  return {
    contact,
    loading,
    error,
    refetch: fetchContact,
    update: updateContact
  };
}

export interface UseContactSearchOptions {
  debounceMs?: number;
  minQueryLength?: number;
  enabled?: boolean;
}

export interface UseContactSearchResult {
  results: ContactSearchResult[];
  loading: boolean;
  error: Error | null;
  search: (query: string) => void;
  clear: () => void;
}

export function useContactSearch(
  filters?: Omit<ContactSearchParams, 'query'>,
  options: UseContactSearchOptions = {}
): UseContactSearchResult {
  const [results, setResults] = useState<ContactSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [query, setQuery] = useState('');

  const {
    debounceMs = 300,
    minQueryLength = 2,
    enabled = true
  } = options;

  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!enabled || !searchQuery || searchQuery.length < minQueryLength) {
      setResults([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const searchResults = await contactService.searchContacts(searchQuery, filters);
      setResults(searchResults);
    } catch (err) {
      setError(err as Error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, minQueryLength, filters]);

  const search = useCallback((searchQuery: string) => {
    setQuery(searchQuery);

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      performSearch(searchQuery);
    }, debounceMs);
  }, [debounceMs, performSearch]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setError(null);
    setLoading(false);
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    results,
    loading,
    error,
    search,
    clear
  };
}

export interface UseContactAvailabilityResult {
  availability: Map<string, ContactAvailabilityUpdate>;
  connectionState: WebSocketState;
  isConnected: boolean;
  subscribe: (contactId: string) => () => void;
  subscribeMultiple: (contactIds: string[]) => () => void;
  reconnect: () => void;
}

export function useContactAvailability(
  initialContactIds: string[] = []
): UseContactAvailabilityResult {
  const [availability, setAvailability] = useState<Map<string, ContactAvailabilityUpdate>>(new Map());
  const [connectionState, setConnectionState] = useState<WebSocketState>(WebSocketState.DISCONNECTED);
  
  const subscriptionsRef = useRef<Map<string, () => void>>(new Map());

  // Initialize WebSocket connection
  useEffect(() => {
    contactWebSocketService.onStateChanged(setConnectionState);
    contactWebSocketService.onErrorOccurred((error) => {
      console.error('Contact WebSocket error:', error);
    });

    contactWebSocketService.connect().catch((error) => {
      console.error('Failed to connect to contact WebSocket:', error);
    });

    return () => {
      contactWebSocketService.disconnect();
    };
  }, []);

  const subscribe = useCallback((contactId: string) => {
    // Unsubscribe if already subscribed
    const existingUnsub = subscriptionsRef.current.get(contactId);
    if (existingUnsub) {
      existingUnsub();
    }

    const unsubscribe = contactWebSocketService.subscribeToContact(
      contactId,
      (update: ContactAvailabilityUpdate) => {
        setAvailability(prev => new Map(prev.set(update.contactId, update)));
      }
    );

    subscriptionsRef.current.set(contactId, unsubscribe);
    return unsubscribe;
  }, []);

  const subscribeMultiple = useCallback((contactIds: string[]) => {
    const unsubscribes = contactIds.map(id => subscribe(id));
    
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [subscribe]);

  const reconnect = useCallback(() => {
    contactWebSocketService.reconnect();
  }, []);

  // Subscribe to initial contact IDs
  useEffect(() => {
    if (initialContactIds.length > 0) {
      const unsubscribe = subscribeMultiple(initialContactIds);
      return unsubscribe;
    }
  }, [initialContactIds, subscribeMultiple]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptionsRef.current.forEach(unsub => unsub());
      subscriptionsRef.current.clear();
    };
  }, []);

  return {
    availability,
    connectionState,
    isConnected: connectionState === WebSocketState.CONNECTED,
    subscribe,
    subscribeMultiple,
    reconnect
  };
}

// Utility hook for workflow-compatible contacts
export function useWorkflowContacts(filters?: ContactSearchParams) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchWorkflowContacts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await contactService.getWorkflowCompatibleContacts(filters);
      setContacts(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchWorkflowContacts();
  }, [fetchWorkflowContacts]);

  return {
    contacts,
    loading,
    error,
    refetch: fetchWorkflowContacts
  };
}

// Hook to monitor service connection status
export function useContactServiceStatus() {
  const [status, setStatus] = useState<'api' | 'mock' | 'unknown'>('unknown');
  const [isChecking, setIsChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    try {
      await (contactService as any).forceApiCheck?.();
      const newStatus = (contactService as any).getConnectionStatus?.() || 'unknown';
      setStatus(newStatus);
    } catch (error) {
      console.error('Failed to check service status:', error);
      setStatus('unknown');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // Check status on mount
    checkStatus();
    
    // Set up periodic status checks every 30 seconds
    const interval = setInterval(checkStatus, 30000);
    
    return () => clearInterval(interval);
  }, [checkStatus]);

  return {
    status,
    isChecking,
    isUsingMock: status === 'mock',
    isUsingApi: status === 'api',
    refresh: checkStatus
  };
}