import React from 'react';
import { useContactAvailability } from '../hooks/useContacts';
import { AvailabilityStatus } from '../types/contact';

interface ContactAvailabilityIndicatorProps {
  contactId: string;
  showDetails?: boolean;
}

const ContactAvailabilityIndicator: React.FC<ContactAvailabilityIndicatorProps> = ({
  contactId,
  showDetails = false
}) => {
  const { availability } = useContactAvailability([contactId]);
  const contactAvailability = availability.get(contactId);
  const status = contactAvailability?.availability || AvailabilityStatus.OFFLINE;

  const getStatusColor = () => {
    switch (status) {
      case AvailabilityStatus.AVAILABLE: return 'bg-green-500';
      case AvailabilityStatus.BUSY: return 'bg-yellow-500';
      case AvailabilityStatus.OFFLINE: return 'bg-gray-500';
      case AvailabilityStatus.ON_LEAVE: return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
      {showDetails && (
        <span className="text-sm text-gray-600">{status}</span>
      )}
    </div>
  );
};

export default ContactAvailabilityIndicator;