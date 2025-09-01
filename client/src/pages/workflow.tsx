import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  ArrowLeft,
  Settings,
  Play,
  Save,
  Eye,
  FileText,
  Activity,
  Users,
  CheckCircle
} from 'lucide-react';
import { WorkflowDesigner } from '@/components/workflow-designer';
import { BpmnValidator, BpmnValidationDisplay } from '@/components/bpmn-validator';
import { WorkflowContactAssignment } from '@/components/workflow-contact-assignment';
import { WorkflowExecutionMonitor } from '@/components/workflow-execution-engine';
import WorkflowCrossTabBanner from '@/components/WorkflowCrossTabBanner';
import type { WorkflowDefinition, WorkflowInstance, Contact } from '@shared/schema';

// Mock workflow data
const mockWorkflow: WorkflowDefinition = {
  id: 'workflow_1',
  name: 'Client Onboarding Process',
  description: 'Complete client onboarding workflow with approval steps',
  elements: [
    {
      id: 'start_1',
      type: 'start_event',
      name: 'Start Onboarding',
      position: { x: 100, y: 200 },
      properties: {}
    },
    {
      id: 'task_1',
      type: 'user_task',
      name: 'Collect Client Information',
      position: { x: 250, y: 200 },
      properties: { assignee: '181d031f-acb0-40e9-8656-2c1c54e5ebda' }
    },
    {
      id: 'gateway_1',
      type: 'decision_gateway',
      name: 'Information Complete?',
      position: { x: 400, y: 200 },
      properties: { condition: 'information_complete' }
    },
    {
      id: 'task_2',
      type: 'user_task',
      name: 'Review and Approve',
      position: { x: 550, y: 200 },
      properties: { assignee: '3f1ab40c-d269-4ba3-ac20-fba3bf9ad589' }
    },
    {
      id: 'end_1',
      type: 'end_event',
      name: 'Onboarding Complete',
      position: { x: 700, y: 200 },
      properties: {}
    }
  ],
  connections: [
    {
      id: 'flow_1',
      type: 'sequence_flow',
      sourceId: 'start_1',
      targetId: 'task_1',
      name: ''
    },
    {
      id: 'flow_2',
      type: 'sequence_flow',
      sourceId: 'task_1',
      targetId: 'gateway_1',
      name: ''
    },
    {
      id: 'flow_3',
      type: 'sequence_flow',
      sourceId: 'gateway_1',
      targetId: 'task_2',
      name: 'Complete',
      condition: 'information_complete === true'
    },
    {
      id: 'flow_4',
      type: 'sequence_flow',
      sourceId: 'task_2',
      targetId: 'end_1',
      name: ''
    }
  ],
  variables: {
    client_name: '',
    information_complete: false,
    approved: false
  },
  version: '1.0',
  metadata: {
    created_by: 'john_doe',
    category: 'Client Management'
  }
};

const mockInstance: WorkflowInstance = {
  id: 'instance_1',
  workflowId: 'workflow_1',
  name: 'Acme Corp Onboarding',
  status: 'pending',
  currentStepId: null,
  variables: {
    client_name: 'Acme Corporation',
    information_complete: false,
    approved: false
  },
  startedAt: null,
  completedAt: null,
  pausedAt: null,
  errorMessage: null,
  executionLog: [],
  createdBy: 'user1',
  userId: 'user1',
  createdAt: new Date('2024-01-20'),
  updatedAt: new Date('2024-01-20'),
};

export function WorkflowPage() {
  const params = useParams();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('designer');
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(mockWorkflow);
  const [instance, setInstance] = useState<WorkflowInstance>(mockInstance);
  const { toast } = useToast();

  // BroadcastChannel connection for cross-tab validation
  useEffect(() => {
    console.log('WorkflowPage: Setting up BroadcastChannel for cross-tab validation');
    
    const { subscribe } = require('@/lib/crossTab');
    
    const unsubscribe = subscribe((event: any) => {
      console.log('WorkflowPage: Received BroadcastChannel event:', event);
      
      if (event.type === 'contact:deleted') {
        toast({
          title: "Contact Deleted",
          description: `Contact "${event.summary?.name || 'Unknown'}" was deleted in another tab. This may affect workflow assignments.`,
          variant: "destructive",
        });
      } else if (event.type === 'contact:changed') {
        toast({
          title: "Contact Modified",
          description: `Contact "${event.summary?.name || 'Unknown'}" was updated in another tab. Review assignments if needed.`,
          variant: "default",
        });
      }
    });

    return () => {
      console.log('WorkflowPage: Cleaning up BroadcastChannel subscription');
      unsubscribe();
    };
  }, [toast]);
  const [validationOpen, setValidationOpen] = useState(false);

  // Validate workflow
  const validation = BpmnValidator.validate(workflow);

  const handleSaveWorkflow = async () => {
    try {
      // API call to save workflow
      console.log('Saving workflow:', workflow);
      // TODO: Implement actual save functionality
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  const handleExecuteWorkflow = async () => {
    if (!validation.isValid) {
      setValidationOpen(true);
      return;
    }

    try {
      // Create new instance and switch to execution tab
      console.log('Executing workflow:', workflow.id);
      setActiveTab('execution');
      // TODO: Implement actual execution start
    } catch (error) {
      console.error('Failed to execute workflow:', error);
    }
  };

  const handleAssignContact = (elementId: string, contacts: Contact[]) => {
    setWorkflow(prev => ({
      ...prev,
      elements: prev.elements.map(element =>
        element.id === elementId
          ? { ...element, properties: { ...element.properties, assignee: contacts[0]?.id } }
          : element
      )
    }));
  };

  const handleSelectElement = (elementId: string) => {
    // Scroll to element in designer
    console.log('Selecting element:', elementId);
  };

  // Extract assigned contact IDs from workflow elements
  const assignedContactIds = React.useMemo(() => {
    return workflow.elements
      .filter(element => element.properties?.assignee)
      .map(element => element.properties?.assignee)
      .filter(Boolean) as string[];
  }, [workflow.elements]);

  // Fetch contact details for assigned contacts
  const { data: contactsData } = useQuery({
    queryKey: ['/api/contacts'],
    enabled: assignedContactIds.length > 0
  });

  // Create contact lookup for banner
  const contactLookup = React.useMemo(() => {
    const lookup: Record<string, { name?: string; type?: string }> = {};
    if (contactsData && Array.isArray(contactsData)) {
      assignedContactIds.forEach(id => {
        const contact = contactsData.find((c: Contact) => c.id === id);
        lookup[id] = { 
          name: contact?.name || (contact?.firstName ? `${contact.firstName} ${contact.lastName}`.trim() : id), 
          type: contact?.type || 'person' 
        };
      });
    }
    return lookup;
  }, [assignedContactIds, contactsData]);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => setLocation('/workflows')}
              className="flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to Workflows
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{workflow.name}</h1>
              <p className="text-sm text-gray-600">{workflow.description}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {/* Validation Status */}
            <Dialog open={validationOpen} onOpenChange={setValidationOpen}>
              <DialogTrigger asChild>
                <Button
                  variant={validation.isValid ? "outline" : "destructive"}
                  size="sm"
                  className="flex items-center gap-1"
                >
                  {validation.isValid ? (
                    <CheckCircle size={14} />
                  ) : (
                    <Settings size={14} />
                  )}
                  {validation.errors.length > 0 ? `${validation.errors.length} Errors` : 'Valid'}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Workflow Validation</DialogTitle>
                  <DialogDescription>
                    BPMN 2.0 compliance check results
                  </DialogDescription>
                </DialogHeader>
                <BpmnValidationDisplay 
                  validation={validation} 
                  onElementSelect={handleSelectElement}
                />
              </DialogContent>
            </Dialog>

            <Button onClick={handleSaveWorkflow} variant="outline" size="sm">
              <Save size={14} className="mr-1" />
              Save
            </Button>
            
            <Button onClick={handleExecuteWorkflow} size="sm">
              <Play size={14} className="mr-1" />
              Execute
            </Button>
          </div>
        </div>

        {/* Workflow Cross-tab Banner */}
        <div className="mt-4 px-0">
          <WorkflowCrossTabBanner
            contactIds={assignedContactIds}
            contactLookup={contactLookup}
            onReloadWorkflow={() => {
              // Refresh workflow data
              toast({
                title: "Workflow Refreshed",
                description: "Workflow data has been reloaded due to contact changes.",
              });
            }}
            onAnyContactChanged={(ids) => {
              console.log("Workflow assignees changed:", ids);
            }}
            onAnyContactDeleted={(ids) => {
              console.log("Workflow assignees deleted:", ids);
              toast({
                title: "Assignment Issue",
                description: `Contact(s) deleted: ${ids.join(", ")}. Please review assignments.`,
                variant: "destructive",
              });
            }}
          />
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="designer" className="flex items-center gap-2">
              <Settings size={16} />
              Designer
            </TabsTrigger>
            <TabsTrigger value="assignments" className="flex items-center gap-2">
              <Users size={16} />
              Assignments
            </TabsTrigger>
            <TabsTrigger value="execution" className="flex items-center gap-2">
              <Activity size={16} />
              Execution
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye size={16} />
              Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {/* Workflow Designer Tab */}
          <TabsContent value="designer" className="h-full">
            <WorkflowDesigner />
          </TabsContent>

          {/* Contact Assignments Tab */}
          <TabsContent value="assignments" className="h-full p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Task Assignments</h2>
                <p className="text-gray-600">Assign contacts to workflow tasks based on skills and availability.</p>
              </div>

              <div className="grid gap-4">
                {workflow.elements
                  .filter(e => e.type === 'user_task')
                  .map((task) => (
                    <Card key={task.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <FileText size={20} />
                            {task.name}
                          </span>
                          <WorkflowContactAssignment
                            taskType={task.type}
                            taskName={task.name}
                            requiredSkills={task.properties?.requiredSkills || []}
                            onAssign={(contacts) => handleAssignContact(task.id, contacts)}
                          >
                            <Button variant="outline" size="sm">
                              <Users size={14} className="mr-1" />
                              {task.properties?.assignee ? 'Change Assignee' : 'Assign Contact'}
                            </Button>
                          </WorkflowContactAssignment>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {task.properties?.assignee ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-600">Assigned to:</span>
                            <span className="font-medium">{task.properties.assignee}</span>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No contact assigned</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                {workflow.elements.filter(e => e.type === 'user_task').length === 0 && (
                  <Card>
                    <CardContent className="text-center py-8">
                      <Users size={48} className="mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500">No user tasks found in this workflow.</p>
                      <p className="text-sm text-gray-400">Add user tasks in the designer to assign contacts.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Workflow Execution Tab */}
          <TabsContent value="execution" className="h-full p-6">
            <div className="max-w-6xl mx-auto">
              <WorkflowExecutionMonitor
                workflow={workflow}
                instance={instance}
                onStatusChange={(status) => {
                  setInstance(prev => ({ ...prev, status: status as any }));
                }}
              />
            </div>
          </TabsContent>

          {/* Workflow Preview Tab */}
          <TabsContent value="preview" className="h-full p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Workflow Preview</h2>
                <p className="text-gray-600">Preview the workflow structure and properties.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Workflow Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Workflow Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Name</label>
                      <p className="text-sm">{workflow.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Description</label>
                      <p className="text-sm">{workflow.description || 'No description'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Version</label>
                      <p className="text-sm">{workflow.version}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Elements</label>
                      <p className="text-sm">{workflow.elements.length} elements</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Connections</label>
                      <p className="text-sm">{workflow.connections.length} connections</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Elements Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Elements Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {Object.entries(
                        workflow.elements.reduce((acc, element) => {
                          acc[element.type] = (acc[element.type] || 0) + 1;
                          return acc;
                        }, {} as Record<string, number>)
                      ).map(([type, count]) => (
                        <div key={type} className="flex justify-between items-center">
                          <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                          <span className="text-sm font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Elements List */}
              <Card>
                <CardHeader>
                  <CardTitle>Workflow Elements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {workflow.elements.map((element) => (
                      <div key={element.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <h4 className="font-medium">{element.name}</h4>
                          <p className="text-sm text-gray-600 capitalize">{element.type.replace('_', ' ')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            Position: ({element.position.x}, {element.position.y})
                          </p>
                          {element.properties?.assignee && (
                            <p className="text-sm text-blue-600">
                              Assigned to: {element.properties.assignee}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* BPMN XML Export */}
              <Card>
                <CardHeader>
                  <CardTitle>BPMN 2.0 Export</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Export this workflow as BPMN 2.0 XML for use in other workflow engines.
                    </p>
                    <Button
                      onClick={() => {
                        const xml = BpmnValidator.exportToBpmnXml(workflow);
                        const blob = new Blob([xml], { type: 'application/xml' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${workflow.name.replace(/\s+/g, '_')}.bpmn`;
                        a.click();
                      }}
                      className="flex items-center gap-1"
                    >
                      <FileText size={14} />
                      Export BPMN XML
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default WorkflowPage;