import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Contact } from "@shared/schema";
import {
  Users,
  User,
  Building,
  Search,
  Filter,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  Plus,
  Minus,
  Calendar,
  BarChart3,
  Settings,
  Download,
  Upload,
  Briefcase,
  UserCheck,
  UserX,
  Star,
} from "lucide-react";

// Workflow assignment form schema
const workflowAssignmentSchema = z.object({
  workflowName: z.string().min(1, "Workflow name is required"),
  selectedContacts: z.array(z.string()).min(1, "Select at least one contact"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  deadline: z.string().optional(),
  notes: z.string().optional(),
  requiresApproval: z.boolean().default(false),
});

type WorkflowAssignmentFormData = z.infer<typeof workflowAssignmentSchema>;

interface WorkflowContactSelectionProps {
  contacts: Contact[];
  onAssignmentComplete?: (assignedContacts: Contact[]) => void;
  className?: string;
}

interface ContactWithScore extends Contact {
  matchScore: number;
  skillMatches: string[];
  availabilityScore: number;
  capacityScore: number;
}

export default function WorkflowContactSelection({
  contacts,
  onAssignmentComplete,
  className
}: WorkflowContactSelectionProps) {
  const [open, setOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [skillFilter, setSkillFilter] = useState<string[]>([]);
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [capacityFilter, setCapacityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("score");
  const [viewMode, setViewMode] = useState<"list" | "grid" | "hierarchy">("list");
  const [bulkSelectMode, setBulkSelectMode] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form setup
  const form = useForm<WorkflowAssignmentFormData>({
    resolver: zodResolver(workflowAssignmentSchema),
    defaultValues: {
      workflowName: "",
      selectedContacts: [],
      priority: "medium",
      deadline: "",
      notes: "",
      requiresApproval: false,
    },
  });

  // Get available skills and departments
  const { availableSkills, availableDepartments } = useMemo(() => {
    const skills = new Set<string>();
    const departments = new Set<string>();
    
    contacts.forEach(contact => {
      if (contact.skills) {
        contact.skills.forEach(skill => skills.add(skill));
      }
      if (contact.department) departments.add(contact.department);
    });
    
    return {
      availableSkills: Array.from(skills).sort(),
      availableDepartments: Array.from(departments).sort(),
    };
  }, [contacts]);

  // Calculate contact scores and filter
  const scoredAndFilteredContacts = useMemo(() => {
    const calculateMatchScore = (contact: Contact): ContactWithScore => {
      let matchScore = 0;
      let skillMatches: string[] = [];

      // Calculate skill match score
      if (skillFilter.length > 0 && contact.skills) {
        const matches = contact.skills.filter(skill => 
          skillFilter.some(filterSkill => 
            skill.toLowerCase().includes(filterSkill.toLowerCase())
          )
        );
        skillMatches = matches;
        matchScore += (matches.length / skillFilter.length) * 40;
      } else if (skillFilter.length === 0) {
        matchScore += 20; // Base score when no skill filter
      }

      // Calculate availability score
      let availabilityScore = 0;
      switch (contact.availabilityStatus) {
        case 'available': availabilityScore = 30; break;
        case 'partially_available': availabilityScore = 20; break;
        case 'busy': availabilityScore = 10; break;
        case 'unavailable': availabilityScore = 0; break;
        default: availabilityScore = 15;
      }

      // Calculate capacity score
      let capacityScore = 0;
      switch (contact.assignmentCapacity) {
        case 'high': capacityScore = 30; break;
        case 'normal': capacityScore = 20; break;
        case 'low': capacityScore = 10; break;
        default: capacityScore = 15;
      }

      // Add experience bonus
      if (contact.jobTitle) matchScore += 5;
      if (contact.email) matchScore += 5;

      return {
        ...contact,
        matchScore: matchScore + availabilityScore + capacityScore,
        skillMatches,
        availabilityScore,
        capacityScore,
      };
    };

    let filtered = contacts
      .filter(contact => contact.type === 'person') // Only people can be assigned to workflows
      .map(calculateMatchScore);

    // Apply filters
    if (searchTerm) {
      filtered = filtered.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contact.skills && contact.skills.some(skill => 
          skill.toLowerCase().includes(searchTerm.toLowerCase())
        ))
      );
    }

    if (availabilityFilter !== "all") {
      filtered = filtered.filter(contact => 
        contact.availabilityStatus === availabilityFilter
      );
    }

    if (departmentFilter !== "all") {
      filtered = filtered.filter(contact => 
        contact.department === departmentFilter
      );
    }

    if (capacityFilter !== "all") {
      filtered = filtered.filter(contact => 
        contact.assignmentCapacity === capacityFilter
      );
    }

    // Sort contacts
    switch (sortBy) {
      case 'score':
        filtered.sort((a, b) => b.matchScore - a.matchScore);
        break;
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'availability':
        filtered.sort((a, b) => b.availabilityScore - a.availabilityScore);
        break;
      case 'capacity':
        filtered.sort((a, b) => b.capacityScore - a.capacityScore);
        break;
      default:
        break;
    }

    return filtered;
  }, [contacts, searchTerm, skillFilter, availabilityFilter, departmentFilter, capacityFilter, sortBy]);

  // Bulk assignment mutation
  const bulkAssignmentMutation = useMutation({
    mutationFn: async (data: WorkflowAssignmentFormData) => {
      const assignments = data.selectedContacts.map(contactId => ({
        contactId,
        workflowName: data.workflowName,
        status: data.requiresApproval ? "pending_approval" : "active",
        notes: data.notes,
      }));

      await apiRequest("POST", "/api/workflow-assignments/bulk", {
        assignments,
        priority: data.priority,
        deadline: data.deadline,
      });

      return assignments;
    },
    onSuccess: (assignments) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-assignments"] });

      const assignedContacts = contacts.filter(c => 
        assignments.some(a => a.contactId === c.id)
      );

      toast({
        title: "Success",
        description: `${assignments.length} contacts assigned to workflow`,
      });

      onAssignmentComplete?.(assignedContacts);
      setSelectedContacts([]);
      form.reset();
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
        description: "Failed to assign contacts to workflow",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleContactSelect = (contactId: string, selected: boolean) => {
    if (selected) {
      setSelectedContacts(prev => [...prev, contactId]);
    } else {
      setSelectedContacts(prev => prev.filter(id => id !== contactId));
    }
  };

  const handleSelectAll = () => {
    const visibleContactIds = scoredAndFilteredContacts.map(c => c.id);
    setSelectedContacts(visibleContactIds);
  };

  const handleDeselectAll = () => {
    setSelectedContacts([]);
  };

  const handleBulkSelectByScore = (minScore: number) => {
    const qualifiedContacts = scoredAndFilteredContacts
      .filter(contact => contact.matchScore >= minScore)
      .map(contact => contact.id);
    setSelectedContacts(qualifiedContacts);
  };

  const handleBulkSelectByAvailability = (status: string) => {
    const availableContacts = scoredAndFilteredContacts
      .filter(contact => contact.availabilityStatus === status)
      .map(contact => contact.id);
    setSelectedContacts(prev => Array.from(new Set([...prev, ...availableContacts])));
  };

  const onSubmit = (data: WorkflowAssignmentFormData) => {
    const formDataWithContacts = {
      ...data,
      selectedContacts,
    };
    bulkAssignmentMutation.mutate(formDataWithContacts);
  };

  // Utility functions
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getAvailabilityIcon = (status?: string) => {
    switch (status) {
      case 'available': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partially_available': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'busy': return <Clock className="h-4 w-4 text-red-500" />;
      case 'unavailable': return <UserX className="h-4 w-4 text-gray-500" />;
      default: return <User className="h-4 w-4 text-gray-400" />;
    }
  };

  const getCapacityIndicator = (capacity?: string) => {
    const width = capacity === 'high' ? '100%' : capacity === 'normal' ? '66%' : '33%';
    const color = capacity === 'high' ? 'bg-green-500' : capacity === 'normal' ? 'bg-yellow-500' : 'bg-red-500';
    return (
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all duration-300`} style={{ width }} />
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5" />
              <span>Workflow Contact Selection</span>
            </CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button disabled={selectedContacts.length === 0}>
                  <Briefcase className="h-4 w-4 mr-2" />
                  Assign to Workflow ({selectedContacts.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Assign Contacts to Workflow</DialogTitle>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="workflowName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Workflow Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter workflow name..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deadline"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Deadline (Optional)</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Additional notes about this assignment..."
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="requiresApproval"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Requires approval before activation
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    {/* Selected contacts summary */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Selected Contacts ({selectedContacts.length})</h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {selectedContacts.map(contactId => {
                          const contact = contacts.find(c => c.id === contactId);
                          return contact ? (
                            <div key={contactId} className="flex items-center justify-between text-sm">
                              <span>{contact.name} - {contact.jobTitle}</span>
                              <Badge variant="outline" className="text-xs">
                                {contact.availabilityStatus?.replace('_', ' ')}
                              </Badge>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={bulkAssignmentMutation.isPending || selectedContacts.length === 0}>
                        {bulkAssignmentMutation.isPending ? "Assigning..." : `Assign ${selectedContacts.length} Contacts`}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters and Search */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search contacts by name, email, title, or skills..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="score">Match Score</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="availability">Availability</SelectItem>
                  <SelectItem value="capacity">Capacity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Availability</SelectItem>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="partially_available">Partially Available</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>

              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {availableDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={capacityFilter} onValueChange={setCapacityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by capacity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Capacity</SelectItem>
                  <SelectItem value="high">High Capacity</SelectItem>
                  <SelectItem value="normal">Normal Capacity</SelectItem>
                  <SelectItem value="low">Low Capacity</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={() => setBulkSelectMode(!bulkSelectMode)}>
                  {bulkSelectMode ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  Bulk
                </Button>
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  All
                </Button>
                <Button variant="outline" size="sm" onClick={handleDeselectAll}>
                  None
                </Button>
              </div>
            </div>

            {/* Skill filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Filter by Skills:</label>
              <div className="flex flex-wrap gap-2">
                {availableSkills.slice(0, 10).map((skill) => (
                  <Badge
                    key={skill}
                    variant={skillFilter.includes(skill) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (skillFilter.includes(skill)) {
                        setSkillFilter(prev => prev.filter(s => s !== skill));
                      } else {
                        setSkillFilter(prev => [...prev, skill]);
                      }
                    }}
                  >
                    {skill}
                  </Badge>
                ))}
                {availableSkills.length > 10 && (
                  <Badge variant="outline" className="cursor-pointer">
                    +{availableSkills.length - 10} more
                  </Badge>
                )}
              </div>
            </div>

            {/* Bulk selection options */}
            {bulkSelectMode && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Quick Selection Options:</h4>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleBulkSelectByScore(80)}>
                    High Score (80+)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkSelectByScore(60)}>
                    Good Score (60+)
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkSelectByAvailability('available')}>
                    Available Only
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleBulkSelectByAvailability('partially_available')}>
                    + Partially Available
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Results Summary */}
          <div className="mb-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium">
                  {scoredAndFilteredContacts.length} contacts found
                </span>
                <span className="text-sm text-gray-600">
                  {selectedContacts.length} selected
                </span>
                <span className="text-sm text-gray-600">
                  Avg. score: {scoredAndFilteredContacts.length > 0 ? 
                    Math.round(scoredAndFilteredContacts.reduce((sum, c) => sum + c.matchScore, 0) / scoredAndFilteredContacts.length) : 0}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {scoredAndFilteredContacts.filter(c => c.availabilityStatus === 'available').length} Available
                </Badge>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                  {scoredAndFilteredContacts.filter(c => c.availabilityStatus === 'partially_available').length} Partial
                </Badge>
              </div>
            </div>
          </div>

          {/* Contact List */}
          <div className="space-y-3">
            {scoredAndFilteredContacts.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
                <p className="text-gray-500">
                  Try adjusting your filters or search terms to find contacts for your workflow.
                </p>
              </div>
            ) : (
              scoredAndFilteredContacts.map((contact) => (
                <Card 
                  key={contact.id} 
                  className={`border-l-4 transition-all duration-200 hover:shadow-md cursor-pointer ${
                    selectedContacts.includes(contact.id) 
                      ? 'border-l-blue-500 bg-blue-50' 
                      : 'border-l-gray-300'
                  }`}
                  onClick={() => handleContactSelect(contact.id, !selectedContacts.includes(contact.id))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <Checkbox
                          checked={selectedContacts.includes(contact.id)}
                          onChange={() => {}}
                          onClick={(e) => e.stopPropagation()}
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-semibold text-gray-900">{contact.name}</h4>
                            <Badge variant="outline" className={getScoreColor(contact.matchScore)}>
                              {Math.round(contact.matchScore)}% match
                            </Badge>
                            {getAvailabilityIcon(contact.availabilityStatus || undefined)}
                            <Badge variant="outline" className="text-xs">
                              {contact.availabilityStatus?.replace('_', ' ') || 'Unknown'}
                            </Badge>
                          </div>

                          <div className="flex items-center space-x-4 text-sm text-gray-600 mb-2">
                            {contact.jobTitle && (
                              <span className="flex items-center space-x-1">
                                <Briefcase className="h-3 w-3" />
                                <span>{contact.jobTitle}</span>
                              </span>
                            )}
                            {contact.department && (
                              <span className="flex items-center space-x-1">
                                <Building className="h-3 w-3" />
                                <span>{contact.department}</span>
                              </span>
                            )}
                            {contact.email && (
                              <span className="truncate">{contact.email}</span>
                            )}
                          </div>

                          {/* Skills matches */}
                          {contact.skillMatches.length > 0 && (
                            <div className="flex items-center space-x-1 mb-2">
                              <Star className="h-3 w-3 text-yellow-500" />
                              <span className="text-xs text-gray-600">Skill matches:</span>
                              {contact.skillMatches.slice(0, 3).map((skill) => (
                                <Badge key={skill} variant="secondary" className="text-xs py-0 px-1">
                                  {skill}
                                </Badge>
                              ))}
                              {contact.skillMatches.length > 3 && (
                                <span className="text-xs text-gray-500">+{contact.skillMatches.length - 3} more</span>
                              )}
                            </div>
                          )}

                          {/* All skills */}
                          {contact.skills && contact.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {contact.skills.slice(0, 5).map((skill) => (
                                <Badge 
                                  key={skill} 
                                  variant={contact.skillMatches.includes(skill) ? "default" : "outline"}
                                  className="text-xs py-0 px-1"
                                >
                                  {skill}
                                </Badge>
                              ))}
                              {contact.skills.length > 5 && (
                                <Badge variant="outline" className="text-xs py-0 px-1">
                                  +{contact.skills.length - 5}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right space-y-2">
                        <div className="text-sm">
                          <div className="text-xs text-gray-500 mb-1">Capacity</div>
                          {getCapacityIndicator(contact.assignmentCapacity || undefined)}
                          <div className="text-xs text-gray-600 mt-1 capitalize">
                            {contact.assignmentCapacity || 'normal'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}