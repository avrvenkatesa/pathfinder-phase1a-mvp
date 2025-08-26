import React, { useState, useCallback, useMemo } from 'react';
import { Search, Filter, X, Users, Briefcase, Clock, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ContactType, 
  AvailabilityStatus, 
  ContactSearchParams, 
  Contact,
  ContactSearchResult 
} from '@/types/contact';
import { useContactSearch, useContacts } from '@/hooks/useContacts';
import { cn } from '@/lib/utils';

interface ContactSearchProps {
  onContactSelect?: (contact: Contact) => void;
  onMultipleSelect?: (contacts: Contact[]) => void;
  selectedContacts?: string[];
  multiSelect?: boolean;
  filters?: Partial<ContactSearchParams>;
  placeholder?: string;
  showFilters?: boolean;
  maxResults?: number;
  className?: string;
}

export function ContactSearch({
  onContactSelect,
  onMultipleSelect,
  selectedContacts = [],
  multiSelect = false,
  filters = {},
  placeholder = "Search contacts...",
  showFilters = true,
  maxResults = 50,
  className
}: ContactSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<ContactSearchParams>(filters);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(selectedContacts));

  // Use search hook for query-based search
  const { 
    results: searchResults, 
    loading: searching, 
    search, 
    clear: clearSearch 
  } = useContactSearch(activeFilters, {
    debounceMs: 300,
    minQueryLength: 2
  });

  // Use contacts hook for filtered results when no search query
  const {
    contacts: filteredContacts,
    loading: filtering
  } = useContacts(searchQuery ? undefined : activeFilters, {
    enabled: !searchQuery
  });

  const displayResults = useMemo(() => {
    const results = searchQuery ? searchResults : filteredContacts.slice(0, maxResults);
    return results;
  }, [searchQuery, searchResults, filteredContacts, maxResults]);

  const loading = searching || filtering;

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      search(value);
    } else {
      clearSearch();
    }
  }, [search, clearSearch]);

  const handleContactClick = useCallback((contact: Contact) => {
    if (multiSelect) {
      const newSelectedIds = new Set(selectedIds);
      if (newSelectedIds.has(contact.contactId)) {
        newSelectedIds.delete(contact.contactId);
      } else {
        newSelectedIds.add(contact.contactId);
      }
      setSelectedIds(newSelectedIds);
      
      const selectedContacts = displayResults.filter(c => 
        newSelectedIds.has(c.contactId)
      );
      onMultipleSelect?.(selectedContacts);
    } else {
      onContactSelect?.(contact);
    }
  }, [multiSelect, selectedIds, displayResults, onContactSelect, onMultipleSelect]);

  const handleFilterChange = useCallback((key: keyof ContactSearchParams, value: any) => {
    setActiveFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters({});
    setSearchQuery('');
    clearSearch();
  }, [clearSearch]);

  const getAvailabilityColor = (status: AvailabilityStatus) => {
    switch (status) {
      case AvailabilityStatus.AVAILABLE: return 'bg-green-500';
      case AvailabilityStatus.BUSY: return 'bg-yellow-500';
      case AvailabilityStatus.OFFLINE: return 'bg-gray-500';
      case AvailabilityStatus.ON_LEAVE: return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getContactTypeIcon = (type: ContactType) => {
    switch (type) {
      case ContactType.PERSON: return <Users className="h-4 w-4" />;
      case ContactType.FREELANCER: return <Star className="h-4 w-4" />;
      case ContactType.CUSTOMER_COMPANY: return <Briefcase className="h-4 w-4" />;
      case ContactType.DIVISION: return <Briefcase className="h-4 w-4" />;
      default: return <Users className="h-4 w-4" />;
    }
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Contact Search</CardTitle>
          {showFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          )}
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSearchChange('')}
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {multiSelect && selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {selectedIds.size} selected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedIds(new Set());
                onMultipleSelect?.([]);
              }}
            >
              Clear Selection
            </Button>
          </div>
        )}
      </CardHeader>

      {showFilterPanel && showFilters && (
        <CardContent className="pt-0">
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Department</label>
                <Select
                  value={activeFilters.department?.[0] || ''}
                  onValueChange={(value) => 
                    handleFilterChange('department', value ? [value] : undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All departments</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Sales">Sales</SelectItem>
                    <SelectItem value="Support">Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Availability</label>
                <Select
                  value={activeFilters.availability?.[0] || ''}
                  onValueChange={(value) => 
                    handleFilterChange('availability', value ? [value as AvailabilityStatus] : undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value={AvailabilityStatus.AVAILABLE}>Available</SelectItem>
                    <SelectItem value={AvailabilityStatus.BUSY}>Busy</SelectItem>
                    <SelectItem value={AvailabilityStatus.OFFLINE}>Offline</SelectItem>
                    <SelectItem value={AvailabilityStatus.ON_LEAVE}>On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Contact Type</label>
                <Select
                  value={activeFilters.type?.[0] || ''}
                  onValueChange={(value) => 
                    handleFilterChange('type', value ? [value as ContactType] : undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    <SelectItem value={ContactType.PERSON}>Person</SelectItem>
                    <SelectItem value={ContactType.FREELANCER}>Freelancer</SelectItem>
                    <SelectItem value={ContactType.CUSTOMER_COMPANY}>Customer Company</SelectItem>
                    <SelectItem value={ContactType.DIVISION}>Division</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="workflow-compatible"
                checked={activeFilters.isWorkflowCompatible || false}
                onCheckedChange={(checked) => 
                  handleFilterChange('isWorkflowCompatible', checked)
                }
              />
              <label
                htmlFor="workflow-compatible"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Workflow compatible only
              </label>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      )}

      <CardContent>
        <ScrollArea className="h-96">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : displayResults.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No contacts found matching your search.' : 'No contacts available.'}
            </div>
          ) : (
            <div className="space-y-2">
              {displayResults.map((contact) => {
                const isSearchResult = 'relevanceScore' in contact;
                const isSelected = selectedIds.has(contact.contactId);
                
                return (
                  <div
                    key={contact.contactId}
                    onClick={() => handleContactClick(contact)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    {multiSelect && (
                      <Checkbox
                        checked={isSelected}
                        onChange={() => {}} // Handled by parent click
                      />
                    )}

                    <div className="relative">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={contact.profileImage} />
                        <AvatarFallback>
                          {contact.firstName[0]}{contact.lastName[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div 
                        className={cn(
                          "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white",
                          getAvailabilityColor(contact.availability)
                        )}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {contact.firstName} {contact.lastName}
                        </p>
                        {getContactTypeIcon(contact.type)}
                        {isSearchResult && (
                          <Badge variant="secondary" className="text-xs">
                            {Math.round((contact as ContactSearchResult).relevanceScore * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {contact.title} • {contact.department}
                      </p>
                      {contact.company && (
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.company.name}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <Badge 
                        variant={contact.availability === AvailabilityStatus.AVAILABLE ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {contact.availability}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {contact.workload.currentWorkload}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}