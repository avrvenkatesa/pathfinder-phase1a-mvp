import React, { useState } from 'react';
import { ChevronDown, X, User } from 'lucide-react';
import { useContacts } from '../hooks/useContacts';
import { Contact } from '../types/contact';

interface ContactSelectorProps {
  value: string[];
  onChange: (contactIds: string[]) => void;
  multiple?: boolean;
  maxSelections?: number;
  requiredSkills?: string[];
}

const ContactSelector: React.FC<ContactSelectorProps> = ({
  value,
  onChange,
  multiple = false,
  maxSelections,
  requiredSkills = []
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { contacts, loading } = useContacts();

  const selectedContacts = contacts.filter(c => value.includes(c.contactId));

  const handleSelect = (contactId: string) => {
    if (multiple) {
      if (value.includes(contactId)) {
        onChange(value.filter(id => id !== contactId));
      } else if (!maxSelections || value.length < maxSelections) {
        onChange([...value, contactId]);
      }
    } else {
      onChange([contactId]);
      setIsOpen(false);
    }
  };

  const handleRemove = (contactId: string) => {
    onChange(value.filter(id => id !== contactId));
  };

  return (
    <div className="relative">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[42px] px-3 py-2 border rounded-lg cursor-pointer flex items-center justify-between hover:border-gray-400"
      >
        <div className="flex flex-wrap gap-1">
          {selectedContacts.length > 0 ? (
            selectedContacts.map(contact => (
              <span
                key={contact.contactId}
                className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm"
              >
                {contact.firstName} {contact.lastName}
                {multiple && (
                  <X
                    className="ml-1 w-3 h-3 cursor-pointer hover:text-blue-900"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(contact.contactId);
                    }}
                  />
                )}
              </span>
            ))
          ) : (
            <span className="text-gray-400">Select contact(s)...</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : (
            contacts.map(contact => {
              const isSelected = value.includes(contact.contactId);
              const isDisabled = !isSelected && maxSelections && value.length >= maxSelections;
              
              return (
                <div
                  key={contact.contactId}
                  onClick={() => !isDisabled && handleSelect(contact.contactId)}
                  className={`
                    p-3 border-b last:border-b-0 cursor-pointer
                    ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                        <p className="text-sm text-gray-600">
                          {contact.title} • {contact.availability}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default ContactSelector;