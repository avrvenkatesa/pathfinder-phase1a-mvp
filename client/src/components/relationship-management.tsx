import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Contact, ContactRelationship } from "@shared/schema";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  ArrowRight,
  Network,
  History,
  UserCheck,
  AlertTriangle,
  Calendar,
  Clock,
  Filter,
  Search,
} from "lucide-react";

// Relationship form schema
const relationshipSchema = z.object({
  fromContactId: z.string().min(1, "Please select a contact"),
  toContactId: z.string().min(1, "Please select a related contact"),
  relationshipType: z.enum(["reports_to", "works_with", "supervises", "collaborates", "manages", "peers"]),
  notes: z.string().optional(),
  startDate: z.string().optional(),
});

type RelationshipFormData = z.infer<typeof relationshipSchema>;

interface RelationshipManagementProps {
  contacts: Contact[];
  selectedContact?: Contact;
  onClose?: () => void;
}

export default function RelationshipManagement({ 
  contacts, 
  selectedContact, 
  onClose 
}: RelationshipManagementProps) {
  const [open, setOpen] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState<ContactRelationship | null>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [selectedRelationships, setSelectedRelationships] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<RelationshipFormData>({
    resolver: zodResolver(relationshipSchema),
    defaultValues: {
      fromContactId: selectedContact?.id || "",
      toContactId: "",
      relationshipType: "works_with",
      notes: "",
      startDate: new Date().toISOString().split('T')[0],
    },
  });

  // Query existing relationships
  const { data: relationships = [], isLoading } = useQuery<ContactRelationship[]>({
    queryKey: ["/api/relationships"],
    retry: false,
  });

  // Create/Update relationship mutation
  const saveRelationshipMutation = useMutation({
    mutationFn: async (data: RelationshipFormData & { id?: string }) => {
      const endpoint = data.id ? `/api/relationships/${data.id}` : "/api/relationships";
      const method = data.id ? "PUT" : "POST";
      const response = await apiRequest(method, endpoint, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Success",
        description: `Relationship ${editingRelationship ? 'updated' : 'created'} successfully`,
      });
      form.reset();
      setEditingRelationship(null);
      setOpen(false);
    },
    onError: (error) => {
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
        description: `Failed to ${editingRelationship ? 'update' : 'create'} relationship`,
        variant: "destructive",
      });
    },
  });

  // Delete relationship mutation
  const deleteRelationshipMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/relationships/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Success",
        description: "Relationship deleted successfully",
      });
    },
    onError: (error) => {
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
        description: "Failed to delete relationship",
        variant: "destructive",
      });
    },
  });

  // Bulk operations mutation
  const bulkOperationMutation = useMutation({
    mutationFn: async ({ operation, relationshipIds }: { 
      operation: 'delete' | 'deactivate'; 
      relationshipIds: string[] 
    }) => {
      await apiRequest("POST", "/api/relationships/bulk", {
        operation,
        relationshipIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/relationships"] });
      setSelectedRelationships([]);
      toast({
        title: "Success",
        description: "Bulk operation completed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to complete bulk operation",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleEditRelationship = (relationship: ContactRelationship) => {
    setEditingRelationship(relationship);
    form.reset({
      fromContactId: relationship.fromContactId,
      toContactId: relationship.toContactId,
      relationshipType: relationship.relationshipType,
      notes: relationship.notes || "",
      startDate: relationship.startDate?.toISOString().split('T')[0] || "",
    });
    setOpen(true);
  };

  const handleDeleteRelationship = (id: string) => {
    if (confirm("Are you sure you want to delete this relationship?")) {
      deleteRelationshipMutation.mutate(id);
    }
  };

  const onSubmit = (data: RelationshipFormData) => {
    // Check for duplicate relationships
    const existingRelationship = relationships.find(r => 
      r.fromContactId === data.fromContactId && 
      r.toContactId === data.toContactId &&
      r.relationshipType === data.relationshipType &&
      r.isActive &&
      r.id !== editingRelationship?.id
    );

    if (existingRelationship) {
      toast({
        title: "Duplicate Relationship",
        description: "This relationship already exists",
        variant: "destructive",
      });
      return;
    }

    // Check for circular relationships
    if (data.relationshipType === "reports_to") {
      const wouldCreateCircle = checkCircularRelationship(
        data.toContactId, 
        data.fromContactId, 
        relationships
      );
      if (wouldCreateCircle) {
        toast({
          title: "Circular Relationship",
          description: "This would create a circular reporting structure",
          variant: "destructive",
        });
        return;
      }
    }

    saveRelationshipMutation.mutate({
      ...data,
      id: editingRelationship?.id,
    });
  };

  // Utility functions
  const checkCircularRelationship = (
    fromId: string, 
    toId: string, 
    relationships: ContactRelationship[]
  ): boolean => {
    const visited = new Set<string>();
    
    const dfs = (currentId: string): boolean => {
      if (currentId === toId) return true;
      if (visited.has(currentId)) return false;
      
      visited.add(currentId);
      
      const subordinates = relationships
        .filter(r => r.fromContactId === currentId && r.relationshipType === "reports_to" && r.isActive)
        .map(r => r.toContactId);
        
      return subordinates.some(subordinateId => dfs(subordinateId));
    };
    
    return dfs(fromId);
  };

  const getContactName = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    return contact?.name || "Unknown Contact";
  };

  const getRelationshipTypeLabel = (type: string) => {
    const labels = {
      reports_to: "Reports to",
      works_with: "Works with",
      supervises: "Supervises",
      collaborates: "Collaborates",
      manages: "Manages",
      peers: "Peers with",
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getRelationshipIcon = (type: string) => {
    switch (type) {
      case 'reports_to': return '↗️';
      case 'supervises': return '↙️';
      case 'manages': return '👨‍💼';
      case 'works_with': return '🤝';
      case 'collaborates': return '🔗';
      case 'peers': return '👥';
      default: return '🔗';
    }
  };

  // Filter relationships
  const filteredRelationships = relationships.filter(rel => {
    if (!rel.isActive) return false;
    
    if (searchTerm) {
      const fromName = getContactName(rel.fromContactId).toLowerCase();
      const toName = getContactName(rel.toContactId).toLowerCase();
      if (!fromName.includes(searchTerm.toLowerCase()) && 
          !toName.includes(searchTerm.toLowerCase())) {
        return false;
      }
    }
    
    if (filterType !== "all" && rel.relationshipType !== filterType) {
      return false;
    }
    
    return true;
  });

  // Get relationship conflicts
  const getRelationshipConflicts = () => {
    const conflicts: { type: string; relationships: ContactRelationship[] }[] = [];
    
    // Check for circular reporting
    const reportingRelationships = relationships.filter(r => 
      r.relationshipType === "reports_to" && r.isActive
    );
    
    // Add more conflict detection logic here
    
    return conflicts;
  };

  const conflicts = getRelationshipConflicts();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Network className="h-5 w-5" />
              <span>Relationship Management</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              {selectedRelationships.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkActions(!showBulkActions)}
                >
                  Bulk Actions ({selectedRelationships.length})
                </Button>
              )}
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Relationship
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[600px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingRelationship ? 'Edit Relationship' : 'Create New Relationship'}
                    </DialogTitle>
                  </DialogHeader>
                  
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="fromContactId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>From Contact</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select contact" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {contacts.map((contact) => (
                                    <SelectItem key={contact.id} value={contact.id}>
                                      {contact.name} ({contact.type})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="toContactId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>To Contact</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select related contact" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {contacts
                                    .filter(contact => contact.id !== form.watch("fromContactId"))
                                    .map((contact) => (
                                    <SelectItem key={contact.id} value={contact.id}>
                                      {contact.name} ({contact.type})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="relationshipType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Relationship Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select relationship type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="reports_to">Reports to</SelectItem>
                                <SelectItem value="supervises">Supervises</SelectItem>
                                <SelectItem value="manages">Manages</SelectItem>
                                <SelectItem value="works_with">Works with</SelectItem>
                                <SelectItem value="collaborates">Collaborates</SelectItem>
                                <SelectItem value="peers">Peers with</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="startDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Start Date</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Additional notes about this relationship..."
                                {...field}
                                value={field.value || ""}
                                rows={3}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={saveRelationshipMutation.isPending}>
                          {saveRelationshipMutation.isPending ? "Saving..." : 
                           editingRelationship ? "Update" : "Create"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search relationships..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="reports_to">Reports to</SelectItem>
                <SelectItem value="supervises">Supervises</SelectItem>
                <SelectItem value="manages">Manages</SelectItem>
                <SelectItem value="works_with">Works with</SelectItem>
                <SelectItem value="collaborates">Collaborates</SelectItem>
                <SelectItem value="peers">Peers with</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {showBulkActions && selectedRelationships.length > 0 && (
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedRelationships.length} relationships selected
                </span>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bulkOperationMutation.mutate({
                      operation: 'deactivate',
                      relationshipIds: selectedRelationships
                    })}
                  >
                    Deactivate Selected
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm("Are you sure you want to delete all selected relationships?")) {
                        bulkOperationMutation.mutate({
                          operation: 'delete',
                          relationshipIds: selectedRelationships
                        });
                      }
                    }}
                  >
                    Delete Selected
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Conflicts Warning */}
          {conflicts.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <span className="font-medium text-yellow-800">Relationship Conflicts Detected</span>
              </div>
              <div className="space-y-1">
                {conflicts.map((conflict, index) => (
                  <p key={index} className="text-sm text-yellow-700">
                    {conflict.type}: {conflict.relationships.length} affected relationships
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Relationships List */}
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active">Active Relationships</TabsTrigger>
              <TabsTrigger value="history">Relationship History</TabsTrigger>
              <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading relationships...</p>
                </div>
              ) : filteredRelationships.length === 0 ? (
                <div className="text-center py-8">
                  <Network className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No relationships found</h3>
                  <p className="text-gray-500">
                    {searchTerm || filterType !== "all" 
                      ? "Try adjusting your filters to see more relationships."
                      : "Create your first relationship to get started."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRelationships.map((relationship) => (
                    <Card key={relationship.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <input
                              type="checkbox"
                              checked={selectedRelationships.includes(relationship.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRelationships(prev => [...prev, relationship.id]);
                                } else {
                                  setSelectedRelationships(prev => 
                                    prev.filter(id => id !== relationship.id)
                                  );
                                }
                              }}
                              className="rounded"
                            />
                            <div className="flex items-center space-x-3">
                              <span className="text-2xl">
                                {getRelationshipIcon(relationship.relationshipType)}
                              </span>
                              <div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">
                                    {getContactName(relationship.fromContactId)}
                                  </span>
                                  <ArrowRight className="h-4 w-4 text-gray-400" />
                                  <Badge variant="outline">
                                    {getRelationshipTypeLabel(relationship.relationshipType)}
                                  </Badge>
                                  <ArrowRight className="h-4 w-4 text-gray-400" />
                                  <span className="font-medium">
                                    {getContactName(relationship.toContactId)}
                                  </span>
                                </div>
                                {relationship.notes && (
                                  <p className="text-sm text-gray-600 mt-1">{relationship.notes}</p>
                                )}
                                <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                                  <span className="flex items-center space-x-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>
                                      {relationship.startDate?.toLocaleDateString() || "No start date"}
                                    </span>
                                  </span>
                                  <span className="flex items-center space-x-1">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                      Created {relationship.createdAt?.toLocaleDateString()}
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditRelationship(relationship)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRelationship(relationship.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              <div className="text-center py-8">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Relationship History</h3>
                <p className="text-gray-500">View historical relationship changes and timeline.</p>
              </div>
            </TabsContent>

            <TabsContent value="conflicts">
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Relationship Conflicts</h3>
                <p className="text-gray-500">
                  {conflicts.length === 0 
                    ? "No relationship conflicts detected."
                    : `${conflicts.length} conflicts need attention.`}
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}