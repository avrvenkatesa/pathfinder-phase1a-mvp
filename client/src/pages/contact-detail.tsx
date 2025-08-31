import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import EnhancedContactForm from "@/components/enhanced-contact-form";
import { apiRequest } from "@/lib/queryClient";
import { getContact, updateContact, deleteContact } from "@/lib/contactsClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Contact, WorkflowAssignment, ContactActivity } from "@shared/schema";
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Mail, 
  Phone, 
  Globe, 
  MapPin,
  Building,
  User,
  Calendar,
  Clock,
  Briefcase,
  Settings,
  ExternalLink,
  Download
} from "lucide-react";

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditForm, setShowEditForm] = useState(false);

  const { data: contact, isLoading, error } = useQuery<Contact>({
    queryKey: ["/api/contacts", id],
    queryFn: async () => {
      if (!id) throw new Error("No contact ID");
      return await getContact(id);
    },
    retry: false,
  });

  const { data: hierarchy } = useQuery<Contact[]>({
    queryKey: ["/api/contacts/hierarchy"],
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No contact ID");
      await deleteContact(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/hierarchy"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/stats"] });
      toast({
        title: "Success",
        description: "Contact deleted successfully",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      if (error.code === 428) {
        toast({
          title: "Precondition Required", 
          description: "Please reload this contact before deleting (precondition required).",
          variant: "destructive",
        });
        return;
      }
      
      if (error.code === 412) {
        toast({
          title: "Contact Changed",
          description: "This contact changed in another tab. Reload to get the latest, then try again.",
          variant: "destructive", 
        });
        return;
      }
      
      if (isUnauthorizedError(error)) {
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
      toast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      });
    },
  });

  // Get related contacts (same company/division)
  const getRelatedContacts = () => {
    if (!contact || !hierarchy) return [];
    
    const flattenContacts = (contactList: Contact[]): Contact[] => {
      const result: Contact[] = [];
      contactList.forEach(c => {
        result.push(c);
        if (c.children) {
          result.push(...flattenContacts(c.children));
        }
      });
      return result;
    };

    const allContacts = flattenContacts(hierarchy);
    
    if (contact.type === 'person') {
      // For persons, show others in same division/company
      return allContacts.filter(c => 
        c.id !== contact.id && 
        (c.parentId === contact.parentId || c.id === contact.parentId)
      );
    } else {
      // For companies/divisions, show children
      return allContacts.filter(c => c.parentId === contact.id);
    }
  };

  const relatedContacts = getRelatedContacts();

  // Mock workflow assignments and activities for demonstration
  const mockWorkflowAssignments: WorkflowAssignment[] = [
    {
      id: "1",
      contactId: id || "",
      workflowName: "Q1 2024 Product Launch",
      status: "active",
      assignedAt: new Date("2024-01-15"),
      completedAt: null,
      notes: "Leading frontend development team"
    },
    {
      id: "2", 
      contactId: id || "",
      workflowName: "Customer Onboarding Optimization",
      status: "completed",
      assignedAt: new Date("2023-12-01"),
      completedAt: new Date("2024-01-10"),
      notes: "Successfully improved onboarding flow by 40%"
    }
  ];

  const mockActivities: ContactActivity[] = [
    {
      id: "1",
      contactId: id || "",
      activityType: "updated",
      description: "Contact information updated",
      metadata: { field: "phone", oldValue: "+1234567890", newValue: "+1987654321" },
      createdAt: new Date("2024-01-20"),
      userId: "user1"
    },
    {
      id: "2",
      contactId: id || "",
      activityType: "assigned",
      description: "Assigned to Q1 2024 Product Launch workflow",
      metadata: { workflowId: "wf1", role: "lead" },
      createdAt: new Date("2024-01-15"),
      userId: "user1"
    },
    {
      id: "3",
      contactId: id || "",
      activityType: "contacted",
      description: "Email sent regarding project status",
      metadata: { subject: "Project Update Required", type: "email" },
      createdAt: new Date("2024-01-10"),
      userId: "user1"
    }
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Contact Not Found</h2>
          <p className="text-gray-600 mb-4">The contact you're looking for doesn't exist or has been deleted.</p>
          <Button onClick={() => setLocation("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Contacts
          </Button>
        </div>
      </div>
    );
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'available': return 'default';
      case 'busy': return 'destructive';  
      case 'partially_available': return 'secondary';
      case 'unavailable': return 'outline';
      default: return 'secondary';
    }
  };

  const formatAvailabilityStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={() => setLocation("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Contacts
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{contact.name}</h1>
                <p className="text-gray-600">
                  {contact.type === 'person' && contact.jobTitle && (
                    <span>{contact.jobTitle} • </span>
                  )}
                  <span className="capitalize">{contact.type}</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm">
                <Briefcase className="h-4 w-4 mr-2" />
                Assign to Workflow
              </Button>
              <EnhancedContactForm 
                contact={contact} 
                onClose={() => setShowEditForm(false)}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {contact.name}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Header Card */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                    {contact.type === 'person' ? (
                      <User className="h-8 w-8 text-gray-500" />
                    ) : (
                      <Building className="h-8 w-8 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h2 className="text-2xl font-bold">{contact.name}</h2>
                      {contact.availabilityStatus && (
                        <Badge variant={getStatusBadgeVariant(contact.availabilityStatus)}>
                          {formatAvailabilityStatus(contact.availabilityStatus)}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1 text-gray-600">
                      {contact.jobTitle && (
                        <p className="flex items-center">
                          <Briefcase className="h-4 w-4 mr-2" />
                          {contact.jobTitle}
                          {contact.department && ` • ${contact.department}`}
                        </p>
                      )}
                      {contact.description && (
                        <p className="text-sm">{contact.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="h-5 w-5 mr-2" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contact.email && (
                    <div className="flex items-center space-x-3">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <a 
                          href={`mailto:${contact.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {contact.phone && (
                    <div className="flex items-center space-x-3">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <a 
                          href={`tel:${contact.phone}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    </div>
                  )}

                  {contact.secondaryPhone && (
                    <div className="flex items-center space-x-3">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Secondary Phone</p>
                        <a 
                          href={`tel:${contact.secondaryPhone}`}
                          className="text-blue-600 hover:underline"
                        >
                          {contact.secondaryPhone}
                        </a>
                      </div>
                    </div>
                  )}

                  {contact.website && (
                    <div className="flex items-center space-x-3">
                      <Globe className="h-4 w-4 text-gray-500" />
                      <div>
                        <p className="text-sm text-gray-500">Website</p>
                        <a 
                          href={contact.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline flex items-center"
                        >
                          {contact.website}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {contact.address && (
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-4 w-4 text-gray-500 mt-1" />
                    <div>
                      <p className="text-sm text-gray-500">Address</p>
                      <p className="whitespace-pre-line">{contact.address}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Skills & Workflow Info */}
            <Card>
              <CardContent className="p-6">
                <Tabs defaultValue="skills">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="skills">Skills & Availability</TabsTrigger>
                    <TabsTrigger value="workflow">Workflow Preferences</TabsTrigger>
                    <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
                  </TabsList>

                  <TabsContent value="skills" className="space-y-4">
                    {contact.skills && contact.skills.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {contact.skills.map((skill) => (
                            <Badge key={skill} variant="secondary">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {contact.preferredWorkHours && (
                      <div>
                        <h4 className="font-medium mb-2">Preferred Work Hours</h4>
                        <p className="text-gray-600 flex items-center">
                          <Clock className="h-4 w-4 mr-2" />
                          {contact.preferredWorkHours}
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="workflow" className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {contact.rolePreference && (
                        <div>
                          <h4 className="font-medium mb-2">Role Preference</h4>
                          <Badge variant="outline" className="capitalize">
                            {contact.rolePreference.replace('_', ' ')}
                          </Badge>
                        </div>
                      )}

                      {contact.assignmentCapacity && (
                        <div>
                          <h4 className="font-medium mb-2">Assignment Capacity</h4>
                          <Badge variant="outline" className="capitalize">
                            {contact.assignmentCapacity}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {contact.projectTypes && contact.projectTypes.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Preferred Project Types</h4>
                        <div className="flex flex-wrap gap-2">
                          {contact.projectTypes.map((type) => (
                            <Badge key={type} variant="secondary">
                              {type}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-medium mb-2">Current Assignments</h4>
                      <div className="space-y-2">
                        {mockWorkflowAssignments.filter(a => a.status === 'active').map((assignment) => (
                          <div key={assignment.id} className="p-3 bg-blue-50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <h5 className="font-medium">{assignment.workflowName}</h5>
                              <Badge variant="default">Active</Badge>
                            </div>
                            {assignment.notes && (
                              <p className="text-sm text-gray-600 mt-1">{assignment.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="activity" className="space-y-4">
                    <div className="space-y-3">
                      {mockActivities.map((activity) => (
                        <div key={activity.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                          <div className="flex-1">
                            <p className="font-medium">{activity.description}</p>
                            <p className="text-sm text-gray-500 flex items-center mt-1">
                              <Calendar className="h-3 w-3 mr-1" />
                              {activity.createdAt?.toLocaleDateString()} at {activity.createdAt?.toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Notes Section */}
            {contact.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-line text-gray-700">{contact.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Organizational Hierarchy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="h-5 w-5 mr-2" />
                  Organizational Hierarchy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {contact.parent && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Parent Organization</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="justify-start"
                        onClick={() => setLocation(`/contacts/${contact.parent?.id}`)}
                      >
                        <Building className="h-3 w-3 mr-2" />
                        {contact.parent.name}
                      </Button>
                    </div>
                  )}
                  
                  {contact.children && contact.children.length > 0 && (
                    <div>
                      <p className="text-sm text-gray-500 mb-2">Sub-organizations</p>
                      <div className="space-y-1">
                        {contact.children.map((child) => (
                          <Button
                            key={child.id}
                            variant="outline"
                            size="sm"
                            className="justify-start w-full"
                            onClick={() => setLocation(`/contacts/${child.id}`)}
                          >
                            {child.type === 'person' ? (
                              <User className="h-3 w-3 mr-2" />
                            ) : (
                              <Building className="h-3 w-3 mr-2" />
                            )}
                            {child.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Related Contacts */}
            {relatedContacts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Related Contacts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {relatedContacts.slice(0, 5).map((relatedContact) => (
                      <Button
                        key={relatedContact.id}
                        variant="outline"
                        size="sm"
                        className="justify-start w-full"
                        onClick={() => setLocation(`/contacts/${relatedContact.id}`)}
                      >
                        {relatedContact.type === 'person' ? (
                          <User className="h-3 w-3 mr-2" />
                        ) : (
                          <Building className="h-3 w-3 mr-2" />
                        )}
                        <div className="text-left">
                          <p className="font-medium">{relatedContact.name}</p>
                          {relatedContact.jobTitle && (
                            <p className="text-xs text-gray-500">{relatedContact.jobTitle}</p>
                          )}
                        </div>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {contact.email && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => window.open(`mailto:${contact.email}`, '_blank')}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Send Email
                  </Button>
                )}
                
                {contact.phone && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start"
                    onClick={() => window.open(`tel:${contact.phone}`, '_blank')}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call Contact
                  </Button>
                )}
                
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Meeting
                </Button>
                
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Settings className="h-4 w-4 mr-2" />
                  Add to Project
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}