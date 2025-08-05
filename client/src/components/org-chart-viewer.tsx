import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tree, TreeNode } from "react-organizational-chart";
import { useLocation } from "wouter";
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
import type { Contact } from "@shared/schema";
import {
  Building,
  Users,
  User,
  Download,
  Filter,
  Search,
  Maximize,
  Minimize,
  Eye,
  Settings,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Share,
  Printer,
} from "lucide-react";

interface OrgChartNode {
  id: string;
  contact: Contact;
  children: OrgChartNode[];
}

interface OrgChartViewerProps {
  contacts: Contact[];
  className?: string;
}

// Individual contact node component
function ContactNode({ contact, onClick }: { contact: Contact; onClick: (contact: Contact) => void }) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'company': return <Building className="h-4 w-4" />;
      case 'division': return <Users className="h-4 w-4" />;
      case 'person': return <User className="h-4 w-4" />;
      default: return <Building className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'company': return 'bg-blue-500 text-white';
      case 'division': return 'bg-orange-500 text-white';
      case 'person': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getAvailabilityColor = (status?: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-red-100 text-red-800';
      case 'partially_available': return 'bg-yellow-100 text-yellow-800';
      case 'unavailable': return 'bg-gray-100 text-gray-800';
      default: return '';
    }
  };

  return (
    <Card 
      className="w-64 cursor-pointer hover:shadow-lg transition-all duration-200 border-2 hover:border-blue-300"
      onClick={() => onClick(contact)}
    >
      <CardHeader className={`pb-2 ${getTypeColor(contact.type)}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {getTypeIcon(contact.type)}
            <Badge variant="secondary" className="bg-white/20 text-white">
              {contact.type}
            </Badge>
          </div>
          {contact.type === 'person' && contact.availabilityStatus && (
            <Badge variant="outline" className="bg-white/90 text-gray-800 text-xs">
              {contact.availabilityStatus.replace('_', ' ')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <h4 className="font-semibold text-gray-900 mb-1 truncate" title={contact.name}>
          {contact.name}
        </h4>
        
        {contact.jobTitle && (
          <p className="text-sm text-gray-600 mb-1 truncate" title={contact.jobTitle}>
            {contact.jobTitle}
          </p>
        )}
        
        {contact.department && (
          <p className="text-xs text-gray-500 mb-2 truncate" title={contact.department}>
            {contact.department}
          </p>
        )}
        
        {contact.email && (
          <p className="text-xs text-blue-600 mb-2 truncate" title={contact.email}>
            {contact.email}
          </p>
        )}

        {/* Skills preview */}
        {contact.skills && contact.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {contact.skills.slice(0, 2).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs py-0 px-1">
                {skill}
              </Badge>
            ))}
            {contact.skills.length > 2 && (
              <Badge variant="secondary" className="text-xs py-0 px-1">
                +{contact.skills.length - 2}
              </Badge>
            )}
          </div>
        )}

        {/* Quick stats */}
        <div className="flex justify-between text-xs text-gray-500">
          {contact.children && contact.children.length > 0 && (
            <span className="flex items-center space-x-1">
              <Users className="h-3 w-3" />
              <span>{contact.children.length}</span>
            </span>
          )}
          {contact.type === 'person' && contact.assignmentCapacity && (
            <span className="capitalize">{contact.assignmentCapacity} load</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Recursive tree renderer
function renderTree(node: OrgChartNode, onContactClick: (contact: Contact) => void): JSX.Element {
  return (
    <TreeNode
      key={node.id}
      label={<ContactNode contact={node.contact} onClick={onContactClick} />}
    >
      {node.children.map(child => renderTree(child, onContactClick))}
    </TreeNode>
  );
}

export default function OrgChartViewer({ contacts, className }: OrgChartViewerProps) {
  const [, setLocation] = useLocation();
  const chartRef = useRef<HTMLDivElement>(null);
  
  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterAvailability, setFilterAvailability] = useState<string>("all");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showSettings, setShowSettings] = useState(false);

  // Build org chart tree structure
  const orgChartTree = useMemo(() => {
    const buildTree = (contacts: Contact[], parentId: string | null = null): OrgChartNode[] => {
      return contacts
        .filter(contact => contact.parentId === parentId)
        .map(contact => ({
          id: contact.id,
          contact,
          children: buildTree(contacts, contact.id),
        }));
    };

    let filteredContacts = contacts;

    // Apply filters
    if (searchTerm) {
      filteredContacts = filteredContacts.filter(contact =>
        contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.department?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterType !== "all") {
      filteredContacts = filteredContacts.filter(contact => contact.type === filterType);
    }

    if (filterDepartment !== "all") {
      filteredContacts = filteredContacts.filter(contact => 
        contact.department === filterDepartment
      );
    }

    if (filterAvailability !== "all") {
      filteredContacts = filteredContacts.filter(contact => 
        contact.availabilityStatus === filterAvailability
      );
    }

    return buildTree(filteredContacts);
  }, [contacts, searchTerm, filterType, filterDepartment, filterAvailability]);

  // Get unique departments for filter
  const departments = useMemo(() => {
    const depts = new Set(contacts.map(c => c.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [contacts]);

  // Event handlers
  const handleContactClick = (contact: Contact) => {
    setLocation(`/contacts/${contact.id}`);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoom(1);

  const handleExportChart = () => {
    // This would implement chart export functionality
    if (chartRef.current) {
      // Export logic here
      console.log("Exporting chart...");
    }
  };

  const handlePrintChart = () => {
    window.print();
  };

  const getChartStats = () => {
    const stats = {
      totalNodes: contacts.length,
      companies: contacts.filter(c => c.type === 'company').length,
      divisions: contacts.filter(c => c.type === 'division').length,
      people: contacts.filter(c => c.type === 'person').length,
      maxDepth: 0,
    };

    // Calculate max depth
    const calculateDepth = (nodes: OrgChartNode[], depth: number = 0): number => {
      if (nodes.length === 0) return depth;
      return Math.max(...nodes.map(node => 
        Math.max(depth, calculateDepth(node.children, depth + 1))
      ));
    };

    stats.maxDepth = calculateDepth(orgChartTree);
    return stats;
  };

  const stats = getChartStats();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Building className="h-5 w-5" />
              <span>Organization Chart</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm px-2">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="sm" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetZoom}>
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportChart}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrintChart}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </Button>
              <Dialog open={showSettings} onOpenChange={setShowSettings}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Chart Settings</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Layout Direction</label>
                      <Select defaultValue="vertical">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vertical">Vertical</SelectItem>
                          <SelectItem value="horizontal">Horizontal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Node Size</label>
                      <Select defaultValue="medium">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Small</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="large">Large</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Statistics */}
          <div className="grid grid-cols-5 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{stats.totalNodes}</div>
              <div className="text-sm text-gray-600">Total Nodes</div>
            </div>
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
              <div className="text-2xl font-bold text-purple-600">{stats.maxDepth}</div>
              <div className="text-sm text-gray-600">Max Depth</div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="company">Companies</SelectItem>
                <SelectItem value="division">Divisions</SelectItem>
                <SelectItem value="person">People</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAvailability} onValueChange={setFilterAvailability}>
              <SelectTrigger>
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

      {/* Organization Chart */}
      <Card className={isFullscreen ? "fixed inset-4 z-50 overflow-auto" : ""}>
        <CardContent className="p-6">
          <div 
            ref={chartRef}
            className="org-chart-container overflow-auto"
            style={{ 
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              minHeight: '600px'
            }}
          >
            {orgChartTree.length > 0 ? (
              <Tree
                lineWidth="2px"
                lineColor="#e5e7eb"
                lineBorderRadius="10px"
                label={<div className="text-center text-lg font-semibold text-gray-700 mb-4">Organization Structure</div>}
              >
                {orgChartTree.map(node => renderTree(node, handleContactClick))}
              </Tree>
            ) : (
              <div className="text-center py-12">
                <Building className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No organization structure found</h3>
                <p className="text-gray-500">
                  {searchTerm || filterType !== "all" || filterDepartment !== "all" || filterAvailability !== "all"
                    ? "Try adjusting your filters to see the organization chart."
                    : "Add contacts and set up hierarchical relationships to visualize your organization."}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}