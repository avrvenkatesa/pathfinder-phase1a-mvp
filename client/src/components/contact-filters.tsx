import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import type { ContactStats } from "@shared/schema";

interface ContactFiltersProps {
  onFiltersChange?: (filters: FilterState) => void;
}

interface FilterState {
  search: string;
  showCompanies: boolean;
  showDivisions: boolean;
  showPeople: boolean;
  location: string;
  tags: string[];
}

export default function ContactFilters({ onFiltersChange }: ContactFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    showCompanies: true,
    showDivisions: true,
    showPeople: true,
    location: '',
    tags: []
  });

  const { data: stats } = useQuery<ContactStats>({
    queryKey: ["/api/contacts/stats"],
    retry: false,
  });

  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handleTypeChange = (type: keyof Pick<FilterState, 'showCompanies' | 'showDivisions' | 'showPeople'>, checked: boolean) => {
    setFilters(prev => ({ ...prev, [type]: checked }));
  };

  const handleLocationChange = (value: string) => {
    setFilters(prev => ({ ...prev, location: value }));
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Search & Filter</h3>
      
      {/* Search Input */}
      <div className="mb-4">
        <Label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
          Search Contacts
        </Label>
        <div className="relative">
          <Input
            id="search"
            type="text"
            placeholder="Search by name, company..."
            value={filters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
          <i className="fas fa-search absolute left-3 top-2.5 text-gray-400"></i>
        </div>
      </div>

      {/* Contact Type Filter */}
      <div className="mb-4">
        <Label className="block text-sm font-medium text-gray-700 mb-2">Contact Type</Label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="companies"
                checked={filters.showCompanies}
                onCheckedChange={(checked) => handleTypeChange('showCompanies', checked as boolean)}
              />
              <Label htmlFor="companies" className="text-sm text-gray-700">Companies</Label>
            </div>
            <span className="text-xs text-gray-500">{stats?.totalCompanies || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="divisions"
                checked={filters.showDivisions}
                onCheckedChange={(checked) => handleTypeChange('showDivisions', checked as boolean)}
              />
              <Label htmlFor="divisions" className="text-sm text-gray-700">Divisions</Label>
            </div>
            <span className="text-xs text-gray-500">{stats?.totalDivisions || 0}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="people"
                checked={filters.showPeople}
                onCheckedChange={(checked) => handleTypeChange('showPeople', checked as boolean)}
              />
              <Label htmlFor="people" className="text-sm text-gray-700">People</Label>
            </div>
            <span className="text-xs text-gray-500">{stats?.totalPeople || 0}</span>
          </div>
        </div>
      </div>

      {/* Location Filter */}
      <div className="mb-4">
        <Label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
          Location
        </Label>
        <Select value={filters.location} onValueChange={handleLocationChange}>
          <SelectTrigger>
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Locations</SelectItem>
            <SelectItem value="us">United States</SelectItem>
            <SelectItem value="uk">United Kingdom</SelectItem>
            <SelectItem value="ca">Canada</SelectItem>
            <SelectItem value="au">Australia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tags Filter */}
      <div>
        <Label className="block text-sm font-medium text-gray-700 mb-2">Tags</Label>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary cursor-pointer hover:bg-primary/20">
            Client
            <i className="fas fa-times ml-1 text-primary/60"></i>
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200">
            Vendor
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 cursor-pointer hover:bg-gray-200">
            Partner
          </span>
        </div>
      </div>
    </div>
  );
}