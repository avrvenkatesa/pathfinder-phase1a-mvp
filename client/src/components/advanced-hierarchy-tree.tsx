import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MeasuringStrategy,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Contact, ContactRelationship } from "@shared/schema";
import {
  Building,
  Users,
  User,
  Eye,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  Plus,
  Move,
  Filter,
  Download,
  Maximize,
  Minimize,
  Search,
  UserCheck,
  UserX,
  Clock,
  Target,
  Network,
  Settings,
  History,
  ArrowRight,
  Briefcase,
} from "lucide-react";

interface HierarchyNode {
  id: string;
  contact: Contact;
  children: HierarchyNode[];
  level: number;
  expanded: boolean;
  parentId?: string;
}

interface AdvancedHierarchyTreeProps {
  contacts: Contact[];
  className?: string;
}

interface DragItem {
  id: string;
  contact: Contact;
  level: number;
}

// Sortable tree node component
function SortableTreeNode({ node, onToggle, onEdit, onDelete, onView, isDragging = false }: {
  node: HierarchyNode;
  onToggle: (id: string) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onView: (contact: Contact) => void;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: sortableIsDragging || isDragging ? 0.5 : 1,
  };

  const { contact, level, expanded, children } = node;
  const hasChildren = children.length > 0;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'company': return <Building className="h-4 w-4" />;
      case 'division': return <Users className="h-4 w-4" />;
      case 'person': return <User className="h-4 w-4" />;
      default: return <Building className="h-4 w-4" />;
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'company': return 'bg-blue-100 text-blue-800';
      case 'division': return 'bg-orange-100 text-orange-800';
      case 'person': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAvailabilityColor = (status?: string) => {
    switch (status) {
      case 'available': return 'text-green-600';
      case 'busy': return 'text-red-600';
      case 'partially_available': return 'text-yellow-600';
      case 'unavailable': return 'text-gray-600';
      default: return 'text-gray-400';
    }
  };

  const getSkillsCount = () => contact.skills?.length || 0;
  const getChildrenCount = () => children.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging || sortableIsDragging ? 'z-50' : ''}`}
    >
      {/* Connection lines */}
      {level > 0 && (
        <>
          <div 
            className="absolute left-4 top-0 w-px h-6 bg-gray-300"
            style={{ marginLeft: `${(level - 1) * 32}px` }}
          />
          <div 
            className="absolute left-4 top-6 w-4 h-px bg-gray-300"
            style={{ marginLeft: `${(level - 1) * 32}px` }}
          />
        </>
      )}

      <Card 
        className={`mb-2 transition-all duration-200 hover:shadow-md border-l-4 ${
          contact.type === 'company' ? 'border-l-blue-500' :
          contact.type === 'division' ? 'border-l-orange-500' :
          'border-l-green-500'
        }`}
        style={{ marginLeft: `${level * 32}px` }}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {/* Left side - Contact info */}
            <div className="flex items-center space-x-3 flex-1">
              {/* Expand/collapse button */}
              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-6 w-6"
                onClick={() => onToggle(node.id)}
                disabled={!hasChildren}
              >
                {hasChildren ? (
                  expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                ) : (
                  <div className="w-3 h-3" />
                )}
              </Button>

              {/* Drag handle */}
              <div 
                {...attributes} 
                {...listeners}
                className="cursor-move p-1 rounded hover:bg-gray-100 transition-colors"
              >
                <Move className="h-4 w-4 text-gray-400" />
              </div>

              {/* Contact icon */}
              <div className={`p-2 rounded-full ${
                contact.type === 'company' ? 'bg-blue-100 text-blue-600' :
                contact.type === 'division' ? 'bg-orange-100 text-orange-600' :
                'bg-green-100 text-green-600'
              }`}>
                {getTypeIcon(contact.type)}
              </div>

              {/* Contact details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className="font-semibold text-gray-900 truncate">
                    {contact.name}
                  </h4>
                  <Badge variant="outline" className={getTypeBadgeColor(contact.type)}>
                    {contact.type}
                  </Badge>
                  {contact.type === 'person' && contact.availabilityStatus && (
                    <div className={`flex items-center space-x-1 ${getAvailabilityColor(contact.availabilityStatus)}`}>
                      <Clock className="h-3 w-3" />
                      <span className="text-xs font-medium">
                        {contact.availabilityStatus.replace('_', ' ')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  {contact.jobTitle && (
                    <span className="truncate">{contact.jobTitle}</span>
                  )}
                  {contact.email && (
                    <span className="truncate">{contact.email}</span>
                  )}
                  {hasChildren && (
                    <span className="flex items-center space-x-1">
                      <Users className="h-3 w-3" />
                      <span>{getChildrenCount()}</span>
                    </span>
                  )}
                  {getSkillsCount() > 0 && (
                    <span className="flex items-center space-x-1">
                      <Target className="h-3 w-3" />
                      <span>{getSkillsCount()} skills</span>
                    </span>
                  )}
                </div>

                {/* Quick skills preview */}
                {contact.skills && contact.skills.length > 0 && (
                  <div className="flex items-center space-x-1 mt-2">
                    {contact.skills.slice(0, 3).map((skill) => (
                      <Badge key={skill} variant="secondary" className="text-xs py-0 px-1">
                        {skill}
                      </Badge>
                    ))}
                    {contact.skills.length > 3 && (
                      <Badge variant="secondary" className="text-xs py-0 px-1">
                        +{contact.skills.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Actions */}
            <div className="flex items-center space-x-1 opacity-75 hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onView(contact)}
                className="text-blue-600 hover:text-blue-700"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(contact)}
                className="text-green-600 hover:text-green-700"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(contact)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Render children */}
      {expanded && hasChildren && (
        <div className="space-y-0">
          {children.map((child) => (
            <SortableTreeNode
              key={child.id}
              node={child}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onView={onView}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdvancedHierarchyTree({ contacts, className }: AdvancedHierarchyTreeProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAvailability, setFilterAvailability] = useState<string>("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [showRelationshipModal, setShowRelationshipModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Build hierarchy tree structure
  const hierarchyTree = useMemo(() => {
    const buildTree = (contacts: Contact[], parentId: string | null = null, level = 0): HierarchyNode[] => {
      return contacts
        .filter(contact => contact.parentId === parentId)
        .map(contact => ({
          id: contact.id,
          contact,
          level,
          expanded: expandedNodes.has(contact.id),
          parentId: parentId || undefined,
          children: buildTree(contacts, contact.id, level + 1),
        }));
    };

    let filteredContacts = contacts;

    // Apply search filter
    if (searchTerm) {
      filteredContacts = filteredContacts.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (filterType !== "all") {
      filteredContacts = filteredContacts.filter(contact => contact.type === filterType);
    }

    // Apply availability filter
    if (filterAvailability !== "all") {
      filteredContacts = filteredContacts.filter(contact => 
        contact.availabilityStatus === filterAvailability
      );
    }

    return buildTree(filteredContacts);
  }, [contacts, expandedNodes, searchTerm, filterType, filterAvailability]);

  // Get all sortable items for DnD
  const sortableItems = useMemo(() => {
    const extractItems = (nodes: HierarchyNode[]): string[] => {
      return nodes.reduce((acc, node) => {
        acc.push(node.id);
        if (node.expanded) {
          acc.push(...extractItems(node.children));
        }
        return acc;
      }, [] as string[]);
    };
    return extractItems(hierarchyTree);
  }, [hierarchyTree]);

  // Move contact mutation
  const moveContactMutation = useMutation({
    mutationFn: async ({ contactId, newParentId, oldParentId }: {
      contactId: string;
      newParentId: string | null;
      oldParentId: string | null;
    }) => {
      // Update contact's parent
      await apiRequest("PUT", `/api/contacts/${contactId}`, { parentId: newParentId });
      
      // Log hierarchy change
      await apiRequest("POST", "/api/hierarchy-changes", {
        contactId,
        oldParentId,
        newParentId,
        changeReason: "Drag and drop reorganization",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/hierarchy"] });
      toast({
        title: "Success",
        description: "Contact moved successfully",
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
        description: "Failed to move contact",
        variant: "destructive",
      });
    },
  });

  // Event handlers
  const handleToggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    const allIds = new Set<string>();
    const extractIds = (nodes: HierarchyNode[]) => {
      nodes.forEach(node => {
        if (node.children.length > 0) {
          allIds.add(node.id);
          extractIds(node.children);
        }
      });
    };
    extractIds(hierarchyTree);
    setExpandedNodes(allIds);
  }, [hierarchyTree]);

  const handleCollapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const contact = contacts.find(c => c.id === event.active.id);
    if (contact) {
      const node = findNodeById(hierarchyTree, contact.id);
      setDraggedItem({
        id: contact.id,
        contact,
        level: node?.level || 0,
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (!over || active.id === over.id) return;

    const activeContact = contacts.find(c => c.id === active.id);
    const overContact = contacts.find(c => c.id === over.id);

    if (!activeContact || !overContact) return;

    // Validate the move with enhanced feedback
    const moveValidation = isValidMove(activeContact, overContact);
    if (!moveValidation.valid) {
      toast({
        title: "Cannot Move Contact",
        description: `${moveValidation.reason}${moveValidation.suggestion ? `. ${moveValidation.suggestion}` : ''}`,
        variant: "destructive",
      });
      return;
    }
    
    // Show warning for moves that need confirmation
    if (moveValidation.reason && moveValidation.reason.includes("confirmation")) {
      const confirmed = confirm(`${moveValidation.reason}. ${moveValidation.suggestion || ''}\n\nDo you want to proceed?`);
      if (!confirmed) return;
    }

    // Perform the move
    moveContactMutation.mutate({
      contactId: activeContact.id,
      newParentId: overContact.id,
      oldParentId: activeContact.parentId || null,
    });
  };

  const handleViewContact = (contact: Contact) => {
    setLocation(`/contacts/${contact.id}`);
  };

  const handleEditContact = (contact: Contact) => {
    // This would open the enhanced contact form in edit mode
    setSelectedContact(contact);
  };

  const handleDeleteContact = (contact: Contact) => {
    if (confirm(`Are you sure you want to delete ${contact.name}?`)) {
      // Implement delete functionality
    }
  };

  // Utility functions
  const findNodeById = (nodes: HierarchyNode[], id: string): HierarchyNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
    return null;
  };

  const isValidMove = (draggedContact: Contact, targetContact: Contact): { valid: boolean; reason?: string; suggestion?: string } => {
    // Prevent moving to self
    if (draggedContact.id === targetContact.id) {
      return { valid: false, reason: "Cannot move contact to itself" };
    }
    
    // Prevent circular references
    if (isDescendant(targetContact, draggedContact, contacts)) {
      return { 
        valid: false, 
        reason: "Would create circular reporting relationship",
        suggestion: "Choose a different target that doesn't report to this contact"
      };
    }
    
    // Check if contact has direct reports (for supervisors)
    const hasDirectReports = contacts.some(c => c.parentId === draggedContact.id);
    
    // Enhanced business rules for valid relationships
    switch (draggedContact.type) {
      case 'company':
        return { 
          valid: false, 
          reason: "Companies cannot be moved under other entities",
          suggestion: "Companies must remain at the root level"
        };
        
      case 'division':
        if (targetContact.type === 'company') {
          if (hasDirectReports) {
            return {
              valid: true, // Allow but with warning - could suggest bulk move
              reason: "Division has employees - consider bulk move",
              suggestion: "Use 'Move with Team' option to transfer all employees"
            };
          }
          return { valid: true };
        }
        return { 
          valid: false, 
          reason: "Divisions can only be moved under companies",
          suggestion: "Select a company as the target"
        };
        
      case 'person':
        // Allow people to move between divisions and companies
        if (targetContact.type === 'company' || targetContact.type === 'division') {
          // Check for cross-company moves
          const draggedCompany = findRootCompany(draggedContact.id, contacts);
          const targetCompany = findRootCompany(targetContact.id, contacts);
          
          if (draggedCompany && targetCompany && draggedCompany.id !== targetCompany.id) {
            return {
              valid: true, // Allow cross-company moves but with confirmation
              reason: "Cross-company transfer requires confirmation",
              suggestion: "This will transfer the employee to a different company"
            };
          }
          
          // Regular department transfer within same company
          return { valid: true };
        }
        return { 
          valid: false, 
          reason: "People can only be moved under companies or divisions",
          suggestion: "Select a company or division as the target"
        };
        
      default:
        return { 
          valid: false, 
          reason: "Unknown contact type",
          suggestion: "Contact type not recognized"
        };
    }
  };

  const isDescendant = (potentialAncestor: Contact, contact: Contact, allContacts: Contact[]): boolean => {
    const children = allContacts.filter(c => c.parentId === contact.id);
    for (const child of children) {
      if (child.id === potentialAncestor.id) return true;
      if (isDescendant(potentialAncestor, child, allContacts)) return true;
    }
    return false;
  };

  const findRootCompany = (contactId: string, allContacts: Contact[]): Contact | null => {
    const contact = allContacts.find(c => c.id === contactId);
    if (!contact) return null;
    
    if (contact.type === 'company') return contact;
    if (!contact.parentId) return null;
    
    return findRootCompany(contact.parentId, allContacts);
  };

  const getStats = () => {
    const stats = {
      companies: contacts.filter(c => c.type === 'company').length,
      divisions: contacts.filter(c => c.type === 'division').length,
      people: contacts.filter(c => c.type === 'person').length,
      available: contacts.filter(c => c.availabilityStatus === 'available').length,
    };
    return stats;
  };

  const stats = getStats();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Network className="h-5 w-5" />
              <span>Advanced Hierarchy Tree</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExpandAll}
              >
                <Maximize className="h-4 w-4 mr-1" />
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCollapseAll}
              >
                <Minimize className="h-4 w-4 mr-1" />
                Collapse All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Statistics */}
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.companies}</div>
              <div className="text-sm text-gray-600">Companies</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.divisions}</div>
              <div className="text-sm text-gray-600">Divisions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.people}</div>
              <div className="text-sm text-gray-600">People</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats.available}</div>
              <div className="text-sm text-gray-600">Available</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="company">Companies</SelectItem>
                <SelectItem value="division">Divisions</SelectItem>
                <SelectItem value="person">People</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAvailability} onValueChange={setFilterAvailability}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="partially_available">Partially Available</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Hierarchy Tree */}
      <Card className={isFullscreen ? "fixed inset-4 z-50 overflow-auto" : ""}>
        <CardContent className="p-6">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            measuring={{
              droppable: {
                strategy: MeasuringStrategy.Always,
              },
            }}
          >
            <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
              <div className="space-y-0">
                {hierarchyTree.map((node) => (
                  <SortableTreeNode
                    key={node.id}
                    node={node}
                    onToggle={handleToggleNode}
                    onEdit={handleEditContact}
                    onDelete={handleDeleteContact}
                    onView={handleViewContact}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {draggedItem ? (
                <Card className="shadow-lg border-2 border-blue-500 opacity-90">
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${
                        draggedItem.contact.type === 'company' ? 'bg-blue-100 text-blue-600' :
                        draggedItem.contact.type === 'division' ? 'bg-orange-100 text-orange-600' :
                        'bg-green-100 text-green-600'
                      }`}>
                        {draggedItem.contact.type === 'company' ? <Building className="h-4 w-4" /> :
                         draggedItem.contact.type === 'division' ? <Users className="h-4 w-4" /> :
                         <User className="h-4 w-4" />}
                      </div>
                      <div>
                        <h4 className="font-semibold">{draggedItem.contact.name}</h4>
                        <p className="text-sm text-gray-600">{draggedItem.contact.type}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </DragOverlay>
          </DndContext>

          {hierarchyTree.length === 0 && (
            <div className="text-center py-12">
              <Network className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
              <p className="text-gray-500">
                {searchTerm || filterType !== "all" || filterAvailability !== "all" 
                  ? "Try adjusting your filters to see more contacts."
                  : "Add some contacts to get started with your hierarchy."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Export Tree
        </Button>
        <Button variant="outline" size="sm">
          <History className="h-4 w-4 mr-1" />
          View History
        </Button>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-1" />
          Tree Settings
        </Button>
      </div>
    </div>
  );
}