import { useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import Header from "@/components/header";
import ContactFilters from "@/components/contact-filters";
import ContactTree from "@/components/contact-tree";
import AdvancedHierarchyTree from "@/components/advanced-hierarchy-tree";
import RelationshipManagement from "@/components/relationship-management";
import OrgChartViewer from "@/components/org-chart-viewer";
import WorkflowContactSelection from "@/components/workflow-contact-selection";
import ContactFormModal from "@/components/contact-form-modal";
import EnhancedContactForm from "@/components/enhanced-contact-form";
import { AdvancedSearch } from "@/components/advanced-search";
import { ContactAnalytics } from "@/components/contact-analytics";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { ContactStats, Contact } from "@shared/schema";
import { 
  Building, 
  Users, 
  User, 
  Network, 
  Briefcase,
  BarChart3,
  Settings,
  Eye,
  Search,
  TrendingUp,
} from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("search");
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);

  // Stable callback to prevent infinite re-renders in AdvancedSearch
  const handleResultsUpdate = useCallback((results: Contact[]) => {
    setFilteredContacts(results);
  }, []);

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: stats, isLoading: statsLoading } = useQuery<ContactStats>({
    queryKey: ["/api/contacts/stats"],
    retry: false,
  });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    retry: false,
  });

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Contact Management</h2>
              <p className="mt-1 text-sm text-gray-500">Manage your hierarchical contact relationships</p>
            </div>
            <div className="mt-4 sm:mt-0 flex space-x-3">
              <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <i className="fas fa-download mr-2"></i>
                Export
              </button>
              <EnhancedContactForm />
            </div>
          </div>
        </div>

        {/* Quick Stats Cards */}
        {!statsLoading && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Building className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Companies</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalCompanies}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-orange-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Divisions</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalDivisions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <User className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">People</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.totalPeople}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <BarChart3 className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">Total Contacts</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalCompanies + stats.totalDivisions + stats.totalPeople}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Advanced Hierarchy Management Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="search" className="flex items-center space-x-1">
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center space-x-1">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="hierarchy" className="flex items-center space-x-1">
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">Tree</span>
            </TabsTrigger>
            <TabsTrigger value="relationships" className="flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Relations</span>
            </TabsTrigger>
            <TabsTrigger value="orgchart" className="flex items-center space-x-1">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Org Chart</span>
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex items-center space-x-1">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Workflow</span>
            </TabsTrigger>
            <TabsTrigger value="classic" className="flex items-center space-x-1">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Classic</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-6">
            <AdvancedSearch 
              contacts={contacts} 
              onResultsUpdate={handleResultsUpdate}
            />
            {(filteredContacts.length > 0 || contacts.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>
                    {filteredContacts.length > 0 
                      ? `Search Results (${filteredContacts.length} contacts)` 
                      : `All Contacts (${contacts.length} contacts)`
                    }
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(filteredContacts.length > 0 ? filteredContacts : contacts).slice(0, 12).map((contact) => (
                      <div 
                        key={contact.id} 
                        className="p-4 border rounded-lg space-y-2 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setLocation(`/contacts/${contact.id}`)}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">{contact.name}</h4>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            contact.type === 'company' ? 'bg-blue-100 text-blue-800' :
                            contact.type === 'division' ? 'bg-orange-100 text-orange-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {contact.type}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{contact.jobTitle || contact.email}</p>
                        <p className="text-xs text-gray-500">{contact.department}</p>
                        {contact.skills && contact.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {contact.skills.slice(0, 3).map((skill) => (
                              <span key={skill} className="px-2 py-1 text-xs bg-gray-100 rounded">
                                {skill}
                              </span>
                            ))}
                            {contact.skills.length > 3 && (
                              <span className="px-2 py-1 text-xs bg-gray-100 rounded">
                                +{contact.skills.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {(filteredContacts.length > 0 ? filteredContacts : contacts).length > 12 && (
                    <p className="text-center text-sm text-gray-500 mt-4">
                      Showing first 12 {filteredContacts.length > 0 ? 'results' : 'contacts'}. 
                      {filteredContacts.length > 0 ? 'Use filters to narrow down your search.' : 'Use the search above to find specific contacts.'}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <ContactAnalytics contacts={contacts} />
          </TabsContent>

          <TabsContent value="hierarchy" className="space-y-6">
            <AdvancedHierarchyTree contacts={filteredContacts.length > 0 ? filteredContacts : contacts} />
          </TabsContent>

          <TabsContent value="relationships" className="space-y-6">
            <RelationshipManagement contacts={contacts} />
          </TabsContent>

          <TabsContent value="orgchart" className="space-y-6">
            <OrgChartViewer contacts={contacts} />
          </TabsContent>

          <TabsContent value="workflow" className="space-y-6">
            <WorkflowContactSelection 
              contacts={contacts}
              onAssignmentComplete={(assignedContacts) => {
                toast({
                  title: "Assignment Complete",
                  description: `${assignedContacts.length} contacts assigned to workflow`,
                });
              }}
            />
          </TabsContent>

          <TabsContent value="classic" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-1">
                <ContactFilters />
              </div>
              
              <div className="lg:col-span-3">
                <ContactTree />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
