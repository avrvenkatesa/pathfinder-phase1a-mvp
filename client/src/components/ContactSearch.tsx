import React, { useState, useEffect, useCallback } from 'react';
import { Search, X, Users, Check } from 'lucide-react';
import { useContactSearch } from '../hooks/useContacts';
import { Contact } from '../types/contact';

interface ContactSearchProps {
  onSelect: (contact: Contact) => void;
  multiple?: boolean;
  requiredSkills?: string[];
  placeholder?: string;
}

const ContactSearch: React.FC<ContactSearchProps> = ({
  onSelect,
  multiple = false,
  requiredSkills = [],
  placeholder = "Search contacts..."
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const { search, results, loading: searching } = useContactSearch();

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchTerm.length >= 2) {
        search(searchTerm);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchTerm, search]);

  const handleSelect = (contact: Contact) => {
    if (multiple) {
      setSelectedContacts(prev => [...prev, contact]);
    }
    onSelect(contact);
    if (!multiple) {
      setSearchTerm('');
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {searching && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {results.length > 0 && searchTerm.length >= 2 && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map(contact => (
            <div
              key={contact.contactId}
              onClick={() => handleSelect(contact)}
              className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{contact.firstName} {contact.lastName}</p>
                  <p className="text-sm text-gray-600">{contact.title} • {contact.department}</p>
                </div>
                {selectedContacts.some(c => c.contactId === contact.contactId) && (
                  <Check className="w-5 h-5 text-green-500" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContactSearch;