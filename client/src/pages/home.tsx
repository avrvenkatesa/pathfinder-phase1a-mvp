import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/header";
import ContactFilters from "@/components/contact-filters";
import ContactTree from "@/components/contact-tree";
import AdvancedHierarchyTree from "@/components/advanced-hierarchy-tree";
import RelationshipManagement from "@/components/relationship-management";
import OrgChartViewer from "@/components/org-chart-viewer";
import WorkflowContactSelection from "@/components/workflow-contact-selection";
import ContactFormModal from "@/components/contact-form-modal";
import EnhancedContactForm from "@/components/enhanced-contact-form";
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
} from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("hierarchy");

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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="hierarchy" className="flex items-center space-x-2">
              <Network className="h-4 w-4" />
              <span>Advanced Tree</span>
            </TabsTrigger>
            <TabsTrigger value="relationships" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Relationships</span>
            </TabsTrigger>
            <TabsTrigger value="orgchart" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Org Chart</span>
            </TabsTrigger>
            <TabsTrigger value="workflow" className="flex items-center space-x-2">
              <Briefcase className="h-4 w-4" />
              <span>Workflow</span>
            </TabsTrigger>
            <TabsTrigger value="classic" className="flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>Classic View</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hierarchy" className="space-y-6">
            <AdvancedHierarchyTree contacts={contacts} />
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
