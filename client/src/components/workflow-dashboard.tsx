import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Play, 
  Pause, 
  Edit, 
  Copy, 
  Trash2, 
  FileText, 
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  BarChart3
} from 'lucide-react';
import type { Workflow, WorkflowInstance, WorkflowTemplate } from '@shared/schema';

// Mock API functions (to be replaced with actual API calls)
const mockWorkflows: Workflow[] = [
  {
    id: '1',
    name: 'Client Onboarding',
    description: 'Standard process for onboarding new clients',
    category: 'Client Management',
    definitionJson: { elements: [], connections: [] },
    bpmnXml: null,
    status: 'active',
    version: '1.0',
    isTemplate: false,
    isPublic: false,
    createdBy: 'user1',
    userId: 'user1',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: '2',
    name: 'Content Review Process',
    description: 'Review and approval workflow for content',
    category: 'Editorial',
    definitionJson: { elements: [], connections: [] },
    bpmnXml: null,
    status: 'draft',
    version: '1.0',
    isTemplate: false,
    isPublic: false,
    createdBy: 'user1',
    userId: 'user1',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-18'),
  }
];

const mockInstances: WorkflowInstance[] = [
  {
    id: '1',
    workflowId: '1',
    name: 'Acme Corp Onboarding',
    status: 'running',
    currentStepId: 'step_2',
    variables: { clientName: 'Acme Corp', priority: 'high' },
    startedAt: new Date('2024-01-20T10:00:00Z'),
    completedAt: null,
    pausedAt: null,
    errorMessage: null,
    executionLog: [],
    createdBy: 'user1',
    userId: 'user1',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-21'),
  }
];

const mockTemplates: WorkflowTemplate[] = [
  {
    id: '1',
    name: 'Basic Client Onboarding',
    description: 'Template for client onboarding workflows',
    category: 'Client Management',
    workflowDefinition: { elements: [], connections: [] },
    isPublic: true,
    tags: ['onboarding', 'client'],
    usageCount: '15',
    createdBy: 'system',
    userId: 'system',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  }
];

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', icon: React.ComponentType<any> }> = {
    draft: { variant: 'secondary', icon: FileText },
    active: { variant: 'default', icon: CheckCircle },
    paused: { variant: 'outline', icon: Pause },
    completed: { variant: 'default', icon: CheckCircle },
    archived: { variant: 'secondary', icon: FileText },
    pending: { variant: 'outline', icon: Clock },
    running: { variant: 'default', icon: Activity },
    failed: { variant: 'destructive', icon: XCircle },
    cancelled: { variant: 'secondary', icon: XCircle },
  };

  const config = variants[status] || variants.draft;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon size={12} />
      {status}
    </Badge>
  );
}

// Workflows tab content
function WorkflowsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const queryClient = useQueryClient();
  
  // Mock query - replace with actual API call
  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows', searchTerm, statusFilter, categoryFilter],
    queryFn: async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockWorkflows.filter(w => {
        if (searchTerm && !w.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (statusFilter !== 'all' && w.status !== statusFilter) return false;
        if (categoryFilter !== 'all' && w.category !== categoryFilter) return false;
        return true;
      });
    }
  });

  const executeWorkflow = useMutation({
    mutationFn: async (workflowId: string) => {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { id: 'new-instance', workflowId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
    }
  });

  const duplicateWorkflow = useMutation({
    mutationFn: async (workflowId: string) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { ...mockWorkflows.find(w => w.id === workflowId), id: 'new-id', name: 'Copy of Workflow' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    }
  });

  const deleteWorkflow = useMutation({
    mutationFn: async (workflowId: string) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return workflowId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    }
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <Input
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Client Management">Client Management</SelectItem>
            <SelectItem value="Editorial">Editorial</SelectItem>
            <SelectItem value="Design">Design</SelectItem>
            <SelectItem value="Quality Assurance">Quality Assurance</SelectItem>
          </SelectContent>
        </Select>
        <Button>
          <Plus size={16} className="mr-1" />
          New Workflow
        </Button>
      </div>

      {/* Workflows Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workflows.map((workflow) => (
              <TableRow key={workflow.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{workflow.name}</div>
                    <div className="text-sm text-gray-500">{workflow.description || ''}</div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{workflow.category}</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge status={workflow.status || 'draft'} />
                </TableCell>
                <TableCell>{workflow.version ?? '1.0'}</TableCell>
                <TableCell>{workflow.updatedAt ? workflow.updatedAt.toLocaleDateString() : ''}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit size={16} className="mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => executeWorkflow.mutate(workflow.id)}>
                        <Play size={16} className="mr-2" />
                        Execute
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateWorkflow.mutate(workflow.id)}>
                        <Copy size={16} className="mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteWorkflow.mutate(workflow.id)}
                        className="text-red-600"
                      >
                        <Trash2 size={16} className="mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// Instances tab content
function InstancesTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Mock query
  const { data: instances = [] } = useQuery({
    queryKey: ['workflow-instances', searchTerm, statusFilter],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockInstances.filter(i => {
        if (searchTerm && !i.name?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (statusFilter !== 'all' && i.status !== statusFilter) return false;
        return true;
      });
    }
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <Input
            placeholder="Search instances..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Instances Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Instance Name</TableHead>
              <TableHead>Workflow</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instances.map((instance) => (
              <TableRow key={instance.id}>
                <TableCell>
                  <div className="font-medium">{instance.name}</div>
                </TableCell>
                <TableCell>
                  {mockWorkflows.find(w => w.id === instance.workflowId)?.name || 'Unknown Workflow'}
                </TableCell>
                <TableCell>
                  <StatusBadge status={instance.status || 'pending'} />
                </TableCell>
                <TableCell>
                  {instance.startedAt ? instance.startedAt.toLocaleDateString() : ''}
                </TableCell>
                <TableCell>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${Math.random() * 100}%` }}
                    ></div>
                  </div>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Activity size={16} className="mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Pause size={16} className="mr-2" />
                        Pause
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600">
                        <XCircle size={16} className="mr-2" />
                        Cancel
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// Templates tab content
function TemplatesTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const queryClient = useQueryClient();
  
  // Mock query
  const { data: templates = [] } = useQuery({
    queryKey: ['workflow-templates', searchTerm, categoryFilter],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockTemplates.filter(t => {
        if (searchTerm && !t.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
        return true;
      });
    }
  });

  const useTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { id: 'new-workflow', templateId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    }
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <Input
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Client Management">Client Management</SelectItem>
            <SelectItem value="Editorial">Editorial</SelectItem>
            <SelectItem value="Design">Design</SelectItem>
          </SelectContent>
        </Select>
        <Button>
          <Plus size={16} className="mr-1" />
          Create Template
        </Button>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              <div className="flex items-center justify-between">
                <Badge variant="outline">{template.category}</Badge>
                <div className="flex items-center text-sm text-gray-500">
                  <Users size={14} className="mr-1" />
                  {template.usageCount} uses
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">{template.description}</p>
              <div className="flex flex-wrap gap-1 mb-4">
                {(template.tags || []).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Button 
                className="w-full" 
                onClick={() => useTemplate.mutate(template.id)}
                disabled={useTemplate.isPending}
              >
                {useTemplate.isPending ? 'Creating...' : 'Use Template'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Analytics tab content
function AnalyticsTab() {
  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">+2 from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Instances</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">+4 from yesterday</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">+100% from yesterday</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Completion Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.4h</div>
            <p className="text-xs text-muted-foreground">-12% from last week</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Workflow Completion Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <BarChart3 size={48} className="mx-auto mb-2" />
                <p>Chart visualization would go here</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Task Assignment Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Users size={48} className="mx-auto mb-2" />
                <p>Chart visualization would go here</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Main dashboard component
export function WorkflowDashboard() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Workflow Manager</h1>
        <Button>
          <Plus size={16} className="mr-1" />
          New Workflow
        </Button>
      </div>

      <Tabs defaultValue="workflows" className="space-y-4">
        <TabsList>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="instances">Active Instances</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="workflows">
          <WorkflowsTab />
        </TabsContent>
        
        <TabsContent value="instances">
          <InstancesTab />
        </TabsContent>
        
        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
        
        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default WorkflowDashboard;