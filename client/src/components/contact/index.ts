export { ContactSearch } from '../contact-search';
export { ContactSelector } from '../contact-selector';
export { ContactAvailabilityIndicator } from '../contact-availability-indicator';
export { ContactErrorBoundary, useContactErrorHandler } from '../contact-error-boundary';
export { 
  ContactLoadingSkeleton,
  ContactSearchSkeleton,
  ContactSelectorSkeleton,
  ContactIndicatorSkeleton
} from '../contact-loading-skeleton';

// Re-export types and hooks for convenience
export type { Contact, ContactSearchParams, AvailabilityStatus, ContactType } from '../../types/contact';
export { 
  useContacts,
  useContact,
  useContactSearch,
  useContactAvailability,
  useWorkflowContacts
} from '../../hooks/useContacts';