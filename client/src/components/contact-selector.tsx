import React, { useState, useCallback } from 'react';
import { Check, ChevronDown, X, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Contact, AvailabilityStatus } from '@/types/contact';
import { ContactSearch } from './contact-search';
import { cn } from '@/lib/utils';

interface ContactSelectorProps {
  selectedContacts?: Contact[];
  onContactsChange?: (contacts: Contact[]) => void;
  multiSelect?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  maxSelection?: number;
  showWorkflowCompatibleOnly?: boolean;
}

export function ContactSelector({
  selectedContacts = [],
  onContactsChange,
  multiSelect = true,
  placeholder = "Select contacts...",
  className,
  disabled = false,
  maxSelection,
  showWorkflowCompatibleOnly = false
}: ContactSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleContactSelect = useCallback((contact: Contact) => {
    if (multiSelect) {
      const isAlreadySelected = selectedContacts.some(c => c.contactId === contact.contactId);
      
      if (isAlreadySelected) {
        // Remove from selection
        const updated = selectedContacts.filter(c => c.contactId !== contact.contactId);
        onContactsChange?.(updated);
      } else {
        // Add to selection (check max limit)
        if (maxSelection && selectedContacts.length >= maxSelection) {
          return; // Don't add if at max
        }
        const updated = [...selectedContacts, contact];
        onContactsChange?.(updated);
      }
    } else {
      // Single select
      onContactsChange?.([contact]);
      setIsOpen(false);
    }
  }, [selectedContacts, onContactsChange, multiSelect, maxSelection]);

  const handleMultipleSelect = useCallback((contacts: Contact[]) => {
    if (maxSelection && contacts.length > maxSelection) {
      // Truncate to max selection
      contacts = contacts.slice(0, maxSelection);
    }
    onContactsChange?.(contacts);
  }, [onContactsChange, maxSelection]);

  const removeContact = useCallback((contactId: string) => {
    const updated = selectedContacts.filter(c => c.contactId !== contactId);
    onContactsChange?.(updated);
  }, [selectedContacts, onContactsChange]);

  const clearAll = useCallback(() => {
    onContactsChange?.([]);
  }, [onContactsChange]);

  const getAvailabilityColor = (status: AvailabilityStatus) => {
    switch (status) {
      case AvailabilityStatus.AVAILABLE: return 'bg-green-500';
      case AvailabilityStatus.BUSY: return 'bg-yellow-500';
      case AvailabilityStatus.OFFLINE: return 'bg-gray-500';
      case AvailabilityStatus.ON_LEAVE: return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getDisplayText = () => {
    if (selectedContacts.length === 0) {
      return placeholder;
    }
    
    if (selectedContacts.length === 1) {
      const contact = selectedContacts[0];
      return `${contact.firstName} ${contact.lastName}`;
    }
    
    return `${selectedContacts.length} contacts selected`;
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className={cn(
              "w-full justify-between",
              selectedContacts.length === 0 && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{getDisplayText()}</span>
            </div>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-[500px] p-0" align="start">
          <ContactSearch
            onContactSelect={handleContactSelect}
            onMultipleSelect={handleMultipleSelect}
            selectedContacts={selectedContacts.map(c => c.contactId)}
            multiSelect={multiSelect}
            filters={showWorkflowCompatibleOnly ? { isWorkflowCompatible: true } : {}}
            placeholder="Search contacts..."
            showFilters={true}
            maxResults={100}
          />
        </PopoverContent>
      </Popover>

      {/* Selected contacts display */}
      {selectedContacts.length > 0 && (
        <div className="mt-2 space-y-2">
          {multiSelect && selectedContacts.length > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Selected contacts ({selectedContacts.length}
                {maxSelection && `/${maxSelection}`})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-6 px-2 text-xs"
              >
                Clear all
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {selectedContacts.map((contact) => (
              <div
                key={contact.contactId}
                className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 text-sm"
              >
                <div className="relative">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={contact.profileImage} />
                    <AvatarFallback className="text-xs">
                      {contact.firstName[0]}{contact.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div 
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white",
                      getAvailabilityColor(contact.availability)
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {contact.firstName} {contact.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {contact.title} • {contact.department}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Badge 
                    variant={contact.availability === AvailabilityStatus.AVAILABLE ? 'default' : 'secondary'}
                    className="text-xs h-5"
                  >
                    {contact.availability}
                  </Badge>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeContact(contact.contactId)}
                    className="h-5 w-5 p-0 ml-1"
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {maxSelection && selectedContacts.length >= maxSelection && (
            <div className="text-xs text-muted-foreground">
              Maximum selection limit reached ({maxSelection} contacts)
            </div>
          )}
        </div>
      )}
    </div>
  );
}