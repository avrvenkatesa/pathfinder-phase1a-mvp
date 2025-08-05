import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Filter, Download, TrendingUp, Users, Target, MapPin, Clock, ChevronDown, X, Plus, Bookmark, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import type { Contact } from '@shared/schema';

interface AdvancedSearchProps {
  contacts: Contact[];
  onResultsUpdate: (results: Contact[]) => void;
  className?: string;
}

interface SearchFilters {
  types: string[];
  availabilityStatus: string[];
  skills: string[];
  departments: string[];
  locations: string[];
  workloadStatus: string[];
  hasWorkflows: boolean | null;
}

interface SavedSearch {
  id: string;
  name: string;
  filters: SearchFilters;
  createdAt: Date;
}

export function AdvancedSearch({ contacts, onResultsUpdate, className = "" }: AdvancedSearchProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({
    types: [],
    availabilityStatus: [],
    skills: [],
    departments: [],
    locations: [],
    workloadStatus: [],
    hasWorkflows: null,
  });
  
  // UI state
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf' | 'vcard'>('csv');

  // Debounced search - use a separate state to avoid infinite loops
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Get unique values for filter options
  const filterOptions = useMemo(() => {
    const skillsSet = new Set<string>();
    const departmentsSet = new Set<string>();
    const locationsSet = new Set<string>();
    
    contacts.forEach(c => {
      if (c.skills) {
        c.skills.forEach(skill => skillsSet.add(skill));
      }
      if (c.department) {
        departmentsSet.add(c.department);
      }
      if (c.notes?.includes('Location:')) {
        const locationMatch = c.notes.match(/Location:\s*([^,\n]+)/);
        if (locationMatch) {
          locationsSet.add(locationMatch[1].trim());
        }
      }
    });
    
    const skills = Array.from(skillsSet).sort();
    const departments = Array.from(departmentsSet).sort();
    const locations = Array.from(locationsSet).sort();
    
    return { skills, departments, locations };
  }, [contacts]);

  // Search suggestions
  const searchSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    
    const suggestions = new Set<string>();
    const query = searchQuery.toLowerCase();
    
    contacts.forEach(contact => {
      // Name suggestions
      if (contact.name.toLowerCase().includes(query)) {
        suggestions.add(contact.name);
      }
      
      // Email suggestions
      if (contact.email?.toLowerCase().includes(query)) {
        suggestions.add(contact.email);
      }
      
      // Company suggestions (from parent hierarchy)
      if (contact.type === 'person' || contact.type === 'division') {
        // Find root company for this contact
        const parentCompany = findParentCompany(contact.id, contacts);
        if (parentCompany?.name.toLowerCase().includes(query)) {
          suggestions.add(parentCompany.name);
        }
      }
      
      // Skills suggestions
      contact.skills?.forEach(skill => {
        if (skill.toLowerCase().includes(query)) {
          suggestions.add(skill);
        }
      });
    });
    
    return Array.from(suggestions).slice(0, 8);
  }, [searchQuery, contacts]);

  // Advanced search with multiple criteria
  const searchResults = useMemo(() => {
    let results = contacts;
    
    // Text search across multiple fields
    if (debouncedQuery) {
      const query = debouncedQuery.toLowerCase();
      const terms = query.split(/\s+/).filter(term => term.length > 0);
      
      results = results.filter(contact => {
        const parentCompany = findParentCompany(contact.id, contacts);
        const searchableText = [
          contact.name,
          contact.email,
          parentCompany?.name,
          contact.department,
          contact.jobTitle,
          ...(contact.skills || []),
          contact.notes
        ].filter(Boolean).join(' ').toLowerCase();
        
        // Support AND logic (all terms must be present)
        return terms.every(term => {
          if (term.startsWith('-')) {
            // NOT logic for terms starting with -
            return !searchableText.includes(term.substring(1));
          }
          return searchableText.includes(term);
        });
      });
    }
    
    // Type filter
    if (filters.types.length > 0) {
      results = results.filter(contact => filters.types.includes(contact.type));
    }
    
    // Availability filter
    if (filters.availabilityStatus.length > 0) {
      results = results.filter(contact => 
        contact.availabilityStatus && filters.availabilityStatus.includes(contact.availabilityStatus)
      );
    }
    
    // Skills filter
    if (filters.skills.length > 0) {
      results = results.filter(contact => 
        contact.skills && filters.skills.some(skill => contact.skills!.includes(skill))
      );
    }
    
    // Department filter
    if (filters.departments.length > 0) {
      results = results.filter(contact => 
        contact.department && filters.departments.includes(contact.department)
      );
    }
    
    // Location filter (from notes)
    if (filters.locations.length > 0) {
      results = results.filter(contact => {
        if (contact.notes?.includes('Location:')) {
          const locationMatch = contact.notes.match(/Location:\s*([^,\n]+)/);
          if (locationMatch) {
            return filters.locations.includes(locationMatch[1].trim());
          }
        }
        return false;
      });
    }
    
    return results;
  }, [contacts, debouncedQuery, filters.types, filters.availabilityStatus, filters.skills, filters.departments, filters.locations]);

  // Update parent component only when search actually happens
  useEffect(() => {
    const timer = setTimeout(() => {
      onResultsUpdate(searchResults);
    }, 100); // Small delay to batch updates
    return () => clearTimeout(timer);
  }, [debouncedQuery, filters.types, filters.availabilityStatus, filters.skills, filters.departments, filters.locations]); // Only update when search criteria change, not when results change

  // Save search to history
  const saveToHistory = useCallback((query: string) => {
    setSearchHistory(prev => {
      if (query.trim() && !prev.includes(query)) {
        return [query, ...prev.slice(0, 9)];
      }
      return prev;
    });
  }, []);

  // Handle search input
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(value.length > 1);
  };

  // Handle search submit
  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      saveToHistory(searchQuery);
      setShowSuggestions(false);
    }
  };

  // Save current search
  const handleSaveSearch = () => {
    const name = prompt("Enter a name for this search:");
    if (name) {
      const savedSearch: SavedSearch = {
        id: Date.now().toString(),
        name,
        filters: { ...filters },
        createdAt: new Date(),
      };
      setSavedSearches(prev => [...prev, savedSearch]);
      toast({
        title: "Search Saved",
        description: `Search "${name}" has been saved`,
      });
    }
  };

  // Load saved search
  const handleLoadSearch = (savedSearch: SavedSearch) => {
    setFilters(savedSearch.filters);
    setIsAdvancedOpen(true);
  };

  // Export results
  const handleExport = () => {
    const csvContent = generateExportContent(searchResults, exportFormat);
    downloadFile(csvContent, `contacts.${exportFormat}`, exportFormat);
    
    toast({
      title: "Export Complete",
      description: `${searchResults.length} contacts exported as ${exportFormat.toUpperCase()}`,
    });
  };

  // Multi-select filter components
  const MultiSelectFilter = ({ 
    options, 
    selected, 
    onChange, 
    placeholder,
    icon: Icon 
  }: {
    options: string[];
    selected: string[];
    onChange: (values: string[]) => void;
    placeholder: string;
    icon: React.ElementType;
  }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between">
          <div className="flex items-center space-x-2">
            <Icon className="h-4 w-4" />
            <span>{selected.length > 0 ? `${selected.length} selected` : placeholder}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} />
          <CommandEmpty>No options found.</CommandEmpty>
          <CommandGroup className="max-h-64 overflow-y-auto">
            {options.map((option) => (
              <CommandItem
                key={option}
                onSelect={() => {
                  const newSelected = selected.includes(option)
                    ? selected.filter(item => item !== option)
                    : [...selected, option];
                  onChange(newSelected);
                }}
              >
                <Checkbox
                  checked={selected.includes(option)}
                  className="mr-2"
                />
                {option}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Main Search Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search contacts by name, email, skills, company..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-8 w-8 p-0"
                    onClick={() => {
                      setSearchQuery("");
                      setShowSuggestions(false);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              <Button
                variant="outline"
                onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                className="whitespace-nowrap"
              >
                <Filter className="h-4 w-4 mr-2" />
                Advanced
              </Button>
              
              <Button variant="outline" onClick={handleSaveSearch}>
                <Bookmark className="h-4 w-4 mr-2" />
                Save
              </Button>
              
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
            
            {/* Search Suggestions */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <Card className="absolute top-full mt-1 w-full z-50 shadow-lg">
                <CardContent className="p-2">
                  <div className="space-y-1">
                    {searchSuggestions.map((suggestion, index) => (
                      <Button
                        key={index}
                        variant="ghost"
                        className="w-full justify-start text-sm"
                        onClick={() => {
                          setSearchQuery(suggestion);
                          setShowSuggestions(false);
                          handleSearchSubmit();
                        }}
                      >
                        <Search className="h-3 w-3 mr-2" />
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Filters Panel */}
      {isAdvancedOpen && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Advanced Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filter Row 1 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Contact Type</label>
                <MultiSelectFilter
                  options={['company', 'division', 'person']}
                  selected={filters.types}
                  onChange={(types) => setFilters(prev => ({ ...prev, types }))}
                  placeholder="All Types"
                  icon={Users}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Availability</label>
                <MultiSelectFilter
                  options={['available', 'busy', 'partially_available', 'unavailable']}
                  selected={filters.availabilityStatus}
                  onChange={(availabilityStatus) => setFilters(prev => ({ ...prev, availabilityStatus }))}
                  placeholder="All Statuses"
                  icon={Clock}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Skills</label>
                <MultiSelectFilter
                  options={filterOptions.skills}
                  selected={filters.skills}
                  onChange={(skills) => setFilters(prev => ({ ...prev, skills }))}
                  placeholder="All Skills"
                  icon={Target}
                />
              </div>
            </div>
            
            {/* Filter Row 2 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <MultiSelectFilter
                  options={filterOptions.departments}
                  selected={filters.departments}
                  onChange={(departments) => setFilters(prev => ({ ...prev, departments }))}
                  placeholder="All Departments"
                  icon={Users}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <MultiSelectFilter
                  options={filterOptions.locations}
                  selected={filters.locations}
                  onChange={(locations) => setFilters(prev => ({ ...prev, locations }))}
                  placeholder="All Locations"
                  icon={MapPin}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Export Format</label>
                <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="vcard">vCard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Clear Filters */}
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFilters({
                      types: [],
                      availabilityStatus: [],
                      skills: [],
                      departments: [],
                      locations: [],
                      workloadStatus: [],
                      hasWorkflows: null,
                    });
                    setSearchQuery("");
                  }}
                >
                  Clear All
                </Button>
              </div>
              
              <div className="text-sm text-gray-600">
                {searchResults.length} of {contacts.length} contacts found
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search History & Saved Searches */}
      {(searchHistory.length > 0 || savedSearches.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search History */}
          {searchHistory.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-sm">
                  <History className="h-4 w-4" />
                  <span>Recent Searches</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {searchHistory.slice(0, 5).map((query, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start text-sm"
                    onClick={() => {
                      setSearchQuery(query);
                      handleSearchSubmit();
                    }}
                  >
                    <Search className="h-3 w-3 mr-2" />
                    {query}
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Saved Searches */}
          {savedSearches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-sm">
                  <Bookmark className="h-4 w-4" />
                  <span>Saved Searches</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {savedSearches.slice(0, 5).map((search) => (
                  <div key={search.id} className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      className="flex-1 justify-start text-sm"
                      onClick={() => handleLoadSearch(search)}
                    >
                      <Bookmark className="h-3 w-3 mr-2" />
                      {search.name}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSavedSearches(prev => prev.filter(s => s.id !== search.id))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Active Filters Display */}
      {(filters.types.length > 0 || filters.skills.length > 0 || filters.availabilityStatus.length > 0 || 
        filters.departments.length > 0 || filters.locations.length > 0) && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 flex-wrap gap-2">
              <span className="text-sm font-medium">Active Filters:</span>
              
              {filters.types.map(type => (
                <Badge key={type} variant="secondary" className="capitalize">
                  {type}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-3 w-3 p-0"
                    onClick={() => setFilters(prev => ({ 
                      ...prev, 
                      types: prev.types.filter(t => t !== type) 
                    }))}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              ))}
              
              {filters.skills.map(skill => (
                <Badge key={skill} variant="outline">
                  {skill}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-3 w-3 p-0"
                    onClick={() => setFilters(prev => ({ 
                      ...prev, 
                      skills: prev.skills.filter(s => s !== skill) 
                    }))}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              ))}
              
              {filters.availabilityStatus.map(status => (
                <Badge key={status} variant="default">
                  {status.replace('_', ' ')}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-3 w-3 p-0"
                    onClick={() => setFilters(prev => ({ 
                      ...prev, 
                      availabilityStatus: prev.availabilityStatus.filter(s => s !== status) 
                    }))}
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Utility functions
function generateExportContent(contacts: Contact[], format: string): string {
  switch (format) {
    case 'csv':
      const headers = ['Name', 'Email', 'Type', 'Company', 'Department', 'Job Title', 'Location', 'Skills', 'Availability'];
      const rows = contacts.map(contact => [
        contact.name,
        contact.email || '',
        contact.type,
        findParentCompany(contact.id, contacts)?.name || '',
        contact.department || '',
        contact.jobTitle || '',
        contact.notes?.match(/Location:\s*([^,\n]+)/)?.[1]?.trim() || '',
        (contact.skills || []).join('; '),
        contact.availabilityStatus || ''
      ]);
      
      return [headers, ...rows].map(row => 
        row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')
      ).join('\n');
      
    case 'vcard':
      return contacts.map(contact => 
        `BEGIN:VCARD\nVERSION:3.0\nFN:${contact.name}\nEMAIL:${contact.email || ''}\nORG:${findParentCompany(contact.id, contacts)?.name || ''}\nTITLE:${contact.jobTitle || ''}\nEND:VCARD`
      ).join('\n\n');
      
    default:
      return generateExportContent(contacts, 'csv');
  }
}

function downloadFile(content: string, filename: string, format: string) {
  const mimeTypes = {
    csv: 'text/csv',
    excel: 'application/vnd.ms-excel',
    pdf: 'application/pdf',
    vcard: 'text/vcard'
  };
  
  const blob = new Blob([content], { type: mimeTypes[format as keyof typeof mimeTypes] });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

// Helper function to find parent company
function findParentCompany(contactId: string, contacts: Contact[]): Contact | null {
  const contact = contacts.find(c => c.id === contactId);
  if (!contact) return null;
  
  if (contact.type === 'company') return contact;
  if (!contact.parentId) return null;
  
  return findParentCompany(contact.parentId, contacts);
}