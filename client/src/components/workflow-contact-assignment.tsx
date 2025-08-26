import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Search, 
  User, 
  Users, 
  Building, 
  ChevronRight,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  Filter,
  UserCheck,
  Calendar
} from 'lucide-react';
import type { Contact } from '@shared/schema';

// Mock contact data with workflow-specific properties
const mockContacts: Contact[] = [
  {
    id: '1',
    firstName: 'John',
    lastName: 'Smith',
    name: 'John Smith',
    type: 'person',
    jobTitle: 'Senior Developer',
    department: 'Engineering',
    title: 'Senior Developer',
    description: null,
    email: 'john.smith@company.com',
    phone: null,
    secondaryPhone: null,
    address: null,
    website: null,
    parentId: '2',
    userId: 'user1',
    skills: ['React', 'TypeScript', 'Node.js', 'Project Management'],
    availabilityStatus: 'available',
    preferredWorkHours: '9am-5pm EST',
    rolePreference: 'leader',
    projectTypes: ['Software Development', 'Web Application'],
    assignmentCapacity: 'normal',
    tags: [],
    notes: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    firstName: null,
    lastName: null,
    name: 'Engineering Division',
    type: 'division',
    jobTitle: null,
    department: 'Technology',
    title: null,
    description: 'Software engineering and development',
    email: null,
    phone: null,
    secondaryPhone: null,
    address: null,
    website: null,
    parentId: '3',
    userId: 'user1',
    skills: [],
    availabilityStatus: 'available',
    preferredWorkHours: null,
    rolePreference: 'any',
    projectTypes: ['Software Development', 'System Integration'],
    assignmentCapacity: 'high',
    tags: [],
    notes: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '3',
    firstName: null,
    lastName: null,
    name: 'TechCorp Inc.',
    type: 'company',
    jobTitle: null,
    department: null,
    title: null,
    description: 'Technology consulting company',
    email: 'info@techcorp.com',
    phone: null,
    secondaryPhone: null,
    address: null,
    website: null,
    parentId: null,
    userId: 'user1',
    skills: [],
    availabilityStatus: 'available',
    preferredWorkHours: null,
    rolePreference: 'any',
    projectTypes: ['Software Development', 'Consulting'],
    assignmentCapacity: 'high',
    tags: [],
    notes: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '4',
    firstName: 'Sarah',
    lastName: 'Johnson',
    name: 'Sarah Johnson',
    type: 'person',
    jobTitle: 'UX Designer',
    department: 'Design',
    title: 'UX Designer',
    description: null,
    email: 'sarah.johnson@company.com',
    phone: null,
    secondaryPhone: null,
    address: null,
    website: null,
    parentId: '5',
    userId: 'user1',
    skills: ['UI/UX Design', 'Figma', 'User Research', 'Prototyping'],
    availabilityStatus: 'busy',
    preferredWorkHours: '10am-6pm PST',
    rolePreference: 'specialist',
    projectTypes: ['UI/UX Design', 'Web Application'],
    assignmentCapacity: 'low',
    tags: [],
    notes: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: '5',
    firstName: null,
    lastName: null,
    name: 'Design Division',
    type: 'division',
    jobTitle: null,
    department: 'Creative',
    title: null,
    description: 'User experience and visual design',
    email: null,
    phone: null,
    secondaryPhone: null,
    address: null,
    website: null,
    parentId: '3',
    userId: 'user1',
    skills: [],
    availabilityStatus: 'partially_available',
    preferredWorkHours: null,
    rolePreference: 'any',
    projectTypes: ['UI/UX Design', 'Marketing Campaign'],
    assignmentCapacity: 'normal',
    tags: [],
    notes: null,
    isActive: true,
    deletedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  }
];

// Mock workload data
const mockWorkload = {
  '1': { currentTasks: 3, maxCapacity: 5, avgCompletionTime: '2.5h' },
  '4': { currentTasks: 7, maxCapacity: 6, avgCompletionTime: '4.2h' },
  '2': { currentTasks: 12, maxCapacity: 20, avgCompletionTime: '1.8h' },
  '5': { currentTasks: 8, maxCapacity: 15, avgCompletionTime: '3.0h' },
};

// Availability status component
function AvailabilityBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary', icon: React.ComponentType<any>, text: string }> = {
    available: { variant: 'default' as const, icon: CheckCircle, text: 'Available' },
    busy: { variant: 'destructive' as const, icon: AlertCircle, text: 'Busy' },
    partially_available: { variant: 'outline' as const, icon: Clock, text: 'Partially Available' },
    unavailable: { variant: 'secondary' as const, icon: AlertCircle, text: 'Unavailable' },
  };

  const config = variants[status] || variants.unavailable;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon size={12} />
      {config.text}
    </Badge>
  );
}

// Workload indicator component
function WorkloadIndicator({ contactId }: { contactId: string }) {
  const workload = (mockWorkload as Record<string, any>)[contactId];
  if (!workload) return null;

  const utilization = (workload.currentTasks / workload.maxCapacity) * 100;
  const getColor = () => {
    if (utilization < 60) return 'bg-green-500';
    if (utilization < 85) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>Workload</span>
        <span>{workload.currentTasks}/{workload.maxCapacity}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${getColor()}`}
          style={{ width: `${Math.min(utilization, 100)}%` }}
        />
      </div>
      <div className="text-xs text-gray-500">
        Avg: {workload.avgCompletionTime}
      </div>
    </div>
  );
}

// Skills matching component
function SkillsMatch({ contactSkills, requiredSkills }: { contactSkills: string[] | null, requiredSkills: string[] }) {
  const skills = contactSkills || [];
  
  if (!requiredSkills || requiredSkills.length === 0) {
    return (
      <div className="flex flex-wrap gap-1">
        {skills.slice(0, 3).map(skill => (
          <Badge key={skill} variant="secondary" className="text-xs">
            {skill}
          </Badge>
        ))}
        {skills.length > 3 && (
          <Badge variant="outline" className="text-xs">
            +{skills.length - 3} more
          </Badge>
        )}
      </div>
    );
  }

  const matchingSkills = skills.filter(skill => 
    requiredSkills.some(req => req.toLowerCase().includes(skill.toLowerCase()))
  );
  const matchPercentage = requiredSkills.length > 0 ? (matchingSkills.length / requiredSkills.length) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-600">Skill Match</span>
        <div className="flex items-center gap-1">
          <Star size={12} className={matchPercentage > 70 ? 'text-yellow-500' : 'text-gray-300'} />
          <span className="text-xs">{Math.round(matchPercentage)}%</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {matchingSkills.slice(0, 2).map(skill => (
          <Badge key={skill} variant="default" className="text-xs">
            {skill}
          </Badge>
        ))}
        {skills.filter(s => !matchingSkills.includes(s)).slice(0, 2).map(skill => (
          <Badge key={skill} variant="secondary" className="text-xs">
            {skill}
          </Badge>
        ))}
      </div>
    </div>
  );
}

// Contact card component
function ContactCard({ 
  contact, 
  onSelect, 
  isSelected, 
  requiredSkills = [] 
}: { 
  contact: Contact;
  onSelect: (contact: Contact) => void;
  isSelected: boolean;
  requiredSkills?: string[];
}) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-blue-500 shadow-md' : ''
      }`}
      onClick={() => onSelect(contact)}
    >
      <CardContent className="p-4">
        <div className="flex items-start space-x-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${contact.name}`} />
            <AvatarFallback>
              {contact.type === 'person' ? (
                <User size={16} />
              ) : contact.type === 'division' ? (
                <Users size={16} />
              ) : (
                <Building size={16} />
              )}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="font-medium truncate">{contact.name}</h3>
              <AvailabilityBadge status={contact.availabilityStatus || 'unavailable'} />
            </div>
            
            {contact.jobTitle && (
              <p className="text-sm text-gray-600">{contact.jobTitle}</p>
            )}
            
            {contact.department && (
              <p className="text-xs text-gray-500">{contact.department}</p>
            )}
            
            <div className="mt-2 space-y-2">
              <SkillsMatch contactSkills={contact.skills} requiredSkills={requiredSkills} />
              
              {contact.type === 'person' && (
                <WorkloadIndicator contactId={contact.id} />
              )}
              
              {contact.preferredWorkHours && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar size={12} />
                  {contact.preferredWorkHours}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Assignment suggestion component
function AssignmentSuggestions({ 
  taskType, 
  requiredSkills, 
  onSelect 
}: {
  taskType: string;
  requiredSkills: string[];
  onSelect: (contact: Contact) => void;
}) {
  const suggestions = mockContacts
    .filter(contact => contact.type === 'person' && contact.availabilityStatus !== 'unavailable')
    .map(contact => {
      let score = 0;
      
      // Availability score
      if (contact.availabilityStatus === 'available') score += 30;
      else if (contact.availabilityStatus === 'partially_available') score += 15;
      
      // Skills match score
      const skills = contact.skills || [];
      const matchingSkills = skills.filter(skill => 
        requiredSkills.some(req => req.toLowerCase().includes(skill.toLowerCase()))
      );
      score += (matchingSkills.length / Math.max(requiredSkills.length, 1)) * 40;
      
      // Workload score
      const workload = (mockWorkload as Record<string, any>)[contact.id];
      if (workload) {
        const utilization = workload.currentTasks / workload.maxCapacity;
        if (utilization < 0.6) score += 20;
        else if (utilization < 0.85) score += 10;
      }
      
      // Role preference score
      if (taskType === 'user_task' && contact.rolePreference === 'leader') score += 10;
      
      return { contact, score: Math.round(score) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Star className="text-yellow-500" size={20} />
        Suggested Assignments
      </h3>
      
      {suggestions.map(({ contact, score }) => (
        <div key={contact.id} className="relative">
          <ContactCard
            contact={contact}
            onSelect={onSelect}
            isSelected={false}
            requiredSkills={requiredSkills}
          />
          <Badge 
            className="absolute top-2 right-2 bg-green-500 text-white"
          >
            {score}% Match
          </Badge>
        </div>
      ))}
      
      {suggestions.length === 0 && (
        <p className="text-gray-500 text-center py-4">
          No suitable contacts found for this task type
        </p>
      )}
    </div>
  );
}

// Hierarchical contact browser component
function HierarchicalBrowser({ onSelect, selectedIds }: {
  onSelect: (contact: Contact) => void;
  selectedIds: string[];
}) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['3'])); // Expand root by default
  
  const buildHierarchy = (contacts: Contact[]) => {
    const contactMap = new Map(contacts.map(c => [c.id, { ...c, children: [] as Contact[] }]));
    const roots: Contact[] = [];
    
    contacts.forEach(contact => {
      const contactWithChildren = contactMap.get(contact.id)!;
      if (contact.parentId && contactMap.has(contact.parentId)) {
        const parent = contactMap.get(contact.parentId)!;
        parent.children = parent.children || [];
        parent.children.push(contactWithChildren);
      } else {
        roots.push(contactWithChildren);
      }
    });
    
    return roots;
  };
  
  const hierarchy = buildHierarchy(mockContacts);
  
  const toggleExpanded = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };
  
  const renderNode = (contact: Contact, level: number = 0) => {
    const hasChildren = contact.children && contact.children.length > 0;
    const isExpanded = expandedNodes.has(contact.id);
    const isSelected = selectedIds.includes(contact.id);
    
    return (
      <div key={contact.id}>
        <div 
          className={`flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer rounded ${
            isSelected ? 'bg-blue-50 border border-blue-200' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          {hasChildren ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-6 h-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(contact.id);
              }}
            >
              <ChevronRight 
                size={14} 
                className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </Button>
          ) : (
            <div className="w-6" />
          )}
          
          <div 
            className="flex items-center gap-2 flex-1"
            onClick={() => onSelect(contact)}
          >
            {contact.type === 'person' ? (
              <User size={16} />
            ) : contact.type === 'division' ? (
              <Users size={16} />
            ) : (
              <Building size={16} />
            )}
            
            <span className="font-medium">{contact.name}</span>
            
            {contact.jobTitle && (
              <span className="text-sm text-gray-500">- {contact.jobTitle}</span>
            )}
            
            <AvailabilityBadge status={contact.availabilityStatus || 'unavailable'} />
          </div>
          
          <Checkbox
            checked={isSelected}
            onChange={() => onSelect(contact)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        
        {hasChildren && isExpanded && (
          <div>
            {contact.children!.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <ScrollArea className="h-96">
      <div className="space-y-1">
        {hierarchy.map(root => renderNode(root))}
      </div>
    </ScrollArea>
  );
}

// Main contact assignment dialog
interface WorkflowContactAssignmentProps {
  taskType: string;
  taskName: string;
  requiredSkills?: string[];
  currentAssignees?: Contact[];
  onAssign: (contacts: Contact[]) => void;
  children: React.ReactNode;
}

export function WorkflowContactAssignment({
  taskType,
  taskName,
  requiredSkills = [],
  currentAssignees = [],
  onAssign,
  children
}: WorkflowContactAssignmentProps) {
  const [open, setOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>(currentAssignees);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<string>('all');
  
  // Mock query - replace with actual API call
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', searchTerm, departmentFilter, availabilityFilter],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockContacts.filter(contact => {
        if (searchTerm && !contact.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (departmentFilter !== 'all' && contact.department !== departmentFilter) return false;
        if (availabilityFilter !== 'all' && contact.availabilityStatus !== availabilityFilter) return false;
        return true;
      });
    }
  });
  
  const handleSelectContact = (contact: Contact) => {
    const isSelected = selectedContacts.some(c => c.id === contact.id);
    if (isSelected) {
      setSelectedContacts(prev => prev.filter(c => c.id !== contact.id));
    } else {
      setSelectedContacts(prev => [...prev, contact]);
    }
  };
  
  const handleAssign = () => {
    onAssign(selectedContacts);
    setOpen(false);
  };
  
  const selectedIds = selectedContacts.map(c => c.id);
  
  const departments = [...new Set(mockContacts.map(c => c.department).filter((dept): dept is string => Boolean(dept)))];
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck size={20} />
            Assign Contacts to {taskName}
          </DialogTitle>
          <DialogDescription>
            Select contacts to assign to this {taskType.replace('_', ' ')}. 
            {requiredSkills.length > 0 && (
              <span> Required skills: {requiredSkills.join(', ')}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="search" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">Search & Filter</TabsTrigger>
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            <TabsTrigger value="hierarchy">Browse Hierarchy</TabsTrigger>
          </TabsList>
          
          <div className="flex-1 overflow-hidden">
            <TabsContent value="search" className="h-full flex flex-col">
              {/* Filters */}
              <div className="flex items-center space-x-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                  <Input
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Availability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="partially_available">Partially Available</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Contact list */}
              <ScrollArea className="flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {contacts.map(contact => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onSelect={handleSelectContact}
                      isSelected={selectedIds.includes(contact.id)}
                      requiredSkills={requiredSkills}
                    />
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="suggestions" className="h-full">
              <ScrollArea className="h-full">
                <AssignmentSuggestions
                  taskType={taskType}
                  requiredSkills={requiredSkills}
                  onSelect={handleSelectContact}
                />
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="hierarchy" className="h-full">
              <HierarchicalBrowser
                onSelect={handleSelectContact}
                selectedIds={selectedIds}
              />
            </TabsContent>
          </div>
        </Tabs>
        
        {/* Selected contacts and actions */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">
                Selected: {selectedContacts.length} contact{selectedContacts.length !== 1 ? 's' : ''}
              </span>
              {selectedContacts.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedContacts.slice(0, 3).map(contact => (
                    <Badge key={contact.id} variant="outline" className="text-xs">
                      {contact.name}
                    </Badge>
                  ))}
                  {selectedContacts.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{selectedContacts.length - 3} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAssign}
                disabled={selectedContacts.length === 0}
              >
                Assign {selectedContacts.length > 0 ? `(${selectedContacts.length})` : ''}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WorkflowContactAssignment;