import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { contactWebSocketService } from '@/services/contact-websocket.service';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft,
  ArrowRight,
  Save,
  Eye,
  Settings,
  Users,
  Activity,
  Sparkles,
  CheckCircle,
  Circle,
  AlertCircle
} from 'lucide-react';
import { WorkflowDesigner } from '@/components/workflow-designer';
import WorkflowCanvas from '@/components/workflow-canvas';
import type { WorkflowDefinition } from '@shared/schema';

// Create a blank workflow template
const createBlankWorkflow = (): WorkflowDefinition => ({
  id: '',
  name: '',
  description: '',
  elements: [],
  connections: [],
  variables: {},
  version: '1.0',
  metadata: {
    category: 'General',
    created_by: 'current_user'
  }
});

// Tab configuration
const workflowTabs = [
  { 
    id: 'setup', 
    label: 'Setup', 
    icon: Settings, 
    description: 'Basic information'
  },
  { 
    id: 'designer', 
    label: 'Designer', 
    icon: Sparkles, 
    description: 'Build workflow'
  },
  { 
    id: 'assignments', 
    label: 'Assignments', 
    icon: Users, 
    description: 'Assign contacts'
  },
  { 
    id: 'execution', 
    label: 'Execution', 
    icon: Activity, 
    description: 'Configure execution'
  },
  { 
    id: 'preview', 
    label: 'Preview', 
    icon: Eye, 
    description: 'Review & save'
  }
];

export function NewWorkflow() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('setup');
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(createBlankWorkflow());
  const [formValid, setFormValid] = useState(false);
  const [completedTabs, setCompletedTabs] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // WebSocket connection for cross-tab validation
  useEffect(() => {
    console.log('NewWorkflow: Connecting to WebSocket for cross-tab validation');
    contactWebSocketService.connect();
    
    const unsubscribe = contactWebSocketService.subscribeToContactDeletions('test-workflow-cross-tab', (message) => {
      console.log('NewWorkflow: Received WebSocket message:', message);
      
      if (message.type === 'CONTACT_DELETED') {
        toast({
          title: "Contact Deleted",
          description: `Contact "${message.data?.name || 'Unknown'}" was deleted in another tab. This may affect workflow assignments.`,
          variant: "destructive",
        });
      } else if (message.type === 'CONTACT_MODIFIED') {
        toast({
          title: "Contact Modified", 
          description: `Contact "${message.data?.name || 'Unknown'}" was updated in another tab. Review assignments if needed.`,
          variant: "default",
        });
      }
    });

    return () => {
      console.log('NewWorkflow: Cleaning up WebSocket subscription');
      unsubscribe();
    };
  }, [toast]);

  // Validation effect
  useEffect(() => {
    const isValid = workflow.name.trim().length > 0;
    setFormValid(isValid);
    
    if (isValid && !completedTabs.has('setup')) {
      setCompletedTabs(prev => new Set([...prev, 'setup']));
    } else if (!isValid && completedTabs.has('setup')) {
      setCompletedTabs(prev => {
        const newSet = new Set(prev);
        newSet.delete('setup');
        return newSet;
      });
    }
  }, [workflow.name, completedTabs]);

  const handleBack = () => {
    setLocation('/workflows');
  };

  const handleTabChange = (tabId: string) => {
    // Only allow tab navigation if setup is complete or we're going back to setup
    if (tabId === 'setup' || formValid) {
      setActiveTab(tabId);
    }
  };

  const handleNext = () => {
    const currentIndex = workflowTabs.findIndex(tab => tab.id === activeTab);
    if (currentIndex < workflowTabs.length - 1 && formValid) {
      const nextTab = workflowTabs[currentIndex + 1];
      setActiveTab(nextTab.id);
    }
  };

  const handlePrevious = () => {
    const currentIndex = workflowTabs.findIndex(tab => tab.id === activeTab);
    if (currentIndex > 0) {
      const prevTab = workflowTabs[currentIndex - 1];
      setActiveTab(prevTab.id);
    }
  };

  const handleSaveWorkflow = async () => {
    try {
      console.log('Saving workflow:', workflow);
      // TODO: Implement actual save API call
      setLocation('/workflows');
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  const getCurrentTabIndex = () => workflowTabs.findIndex(tab => tab.id === activeTab);
  const getProgressPercentage = () => ((getCurrentTabIndex() + 1) / workflowTabs.length) * 100;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost" 
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Back to Workflows
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {workflow.name || 'Create New Workflow'}
              </h1>
              <p className="text-sm text-gray-600">
                {workflow.description || 'Set up a new workflow from scratch'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {activeTab !== 'setup' && (
              <Button onClick={handleSaveWorkflow} variant="outline" size="sm">
                <Save size={14} className="mr-1" />
                Save Workflow
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Progress</span>
            <span className="text-gray-600">
              Step {getCurrentTabIndex() + 1} of {workflowTabs.length}
            </span>
          </div>
          <Progress value={getProgressPercentage()} className="h-2" />
        </div>

        {/* Step Indicator */}
        <div className="mt-4 flex items-center justify-between">
          {workflowTabs.map((tab, index) => {
            const isActive = tab.id === activeTab;
            const isCompleted = completedTabs.has(tab.id);
            const isAccessible = tab.id === 'setup' || formValid;
            
            return (
              <div key={tab.id} className="flex flex-col items-center">
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTabChange(tab.id)}
                    disabled={!isAccessible}
                    className={`rounded-full w-10 h-10 p-0 ${
                      isActive 
                        ? 'bg-blue-100 text-blue-600 border-2 border-blue-600' 
                        : isCompleted 
                          ? 'bg-green-100 text-green-600' 
                          : isAccessible 
                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle size={16} />
                    ) : isActive ? (
                      <tab.icon size={16} />
                    ) : (
                      <Circle size={16} />
                    )}
                  </Button>
                  {index < workflowTabs.length - 1 && (
                    <Separator 
                      orientation="horizontal" 
                      className={`w-8 mx-2 ${
                        isCompleted ? 'bg-green-300' : 'bg-gray-300'
                      }`} 
                    />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <div className={`text-xs font-medium ${
                    isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {tab.label}
                  </div>
                  <div className="text-xs text-gray-400">
                    {tab.description}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tab Navigation */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4">
          <TabsList className="grid w-full grid-cols-5">
            {workflowTabs.map((tab) => {
              const Icon = tab.icon;
              const isAccessible = tab.id === 'setup' || formValid;
              const isCompleted = completedTabs.has(tab.id);
              
              return (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  disabled={!isAccessible}
                  className="flex items-center gap-2 relative"
                >
                  <Icon size={16} />
                  {tab.label}
                  {isCompleted && (
                    <CheckCircle size={12} className="text-green-500 absolute -top-1 -right-1" />
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content Area - Takes remaining height */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        {/* Setup Tab - Special handling for scrolling */}
        {activeTab === 'setup' && (
          <div className="flex-1 overflow-auto p-6 pb-24">
            <div className="max-w-2xl mx-auto space-y-6">
              <Card className="shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-center mb-6">
                    <div className="p-3 bg-blue-50 rounded-lg mr-3 flex items-center justify-center">
                      <Settings size={24} className="text-blue-600" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">Workflow Information</h1>
                      <p className="text-sm text-gray-600 mt-1">
                        Define the basic properties and settings for your new workflow.
                        All fields marked with * are required.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Workflow Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Workflow Name *
                      </label>
                      <Input
                        value={workflow.name}
                        onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter workflow name"
                        className={`w-full ${!workflow.name.trim() ? 'border-red-300' : ''}`}
                      />
                      {!workflow.name.trim() ? (
                        <p className="text-red-500 text-xs mt-1">Workflow name is required</p>
                      ) : (
                        <p className="text-gray-500 text-xs mt-1">Give your workflow a descriptive name</p>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <Textarea
                        value={workflow.description || ''}
                        onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Describe what this workflow does, its purpose, and expected outcomes..."
                        rows={4}
                        className="w-full"
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Provide a detailed description to help others understand this workflow
                      </p>
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category *
                      </label>
                      <Select 
                        value={workflow.metadata?.category || 'General'}
                        onValueChange={(value) => setWorkflow(prev => ({
                          ...prev,
                          metadata: { ...prev.metadata, category: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="General">General</SelectItem>
                          <SelectItem value="Client Management">Client Management</SelectItem>
                          <SelectItem value="Editorial">Editorial</SelectItem>
                          <SelectItem value="Design">Design</SelectItem>
                          <SelectItem value="Quality Assurance">Quality Assurance</SelectItem>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Publishing">Publishing</SelectItem>
                          <SelectItem value="Marketing">Marketing</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="Human Resources">Human Resources</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-gray-500 text-xs mt-1">
                        Select the category that best describes this workflow
                      </p>
                    </div>

                    {/* Version */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Version
                      </label>
                      <Input
                        value={workflow.version}
                        onChange={(e) => setWorkflow(prev => ({ ...prev, version: e.target.value }))}
                        placeholder="1.0"
                        className="w-full"
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Version number for this workflow (e.g., 1.0, 1.1, 2.0)
                      </p>
                    </div>

                    {/* Advanced Settings Section */}
                    <Separator className="my-6" />
                    
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Advanced Settings</h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Priority Level
                          </label>
                          <Select defaultValue="Medium">
                            <SelectTrigger>
                              <SelectValue placeholder="Select priority" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Low">Low Priority</SelectItem>
                              <SelectItem value="Medium">Medium Priority</SelectItem>
                              <SelectItem value="High">High Priority</SelectItem>
                              <SelectItem value="Critical">Critical Priority</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-gray-500 text-xs mt-1">
                            Default priority for workflow instances
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Initial Status
                          </label>
                          <Select defaultValue="Draft">
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Draft">Draft</SelectItem>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="Testing">Testing</SelectItem>
                              <SelectItem value="Inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-gray-500 text-xs mt-1">
                            Starting status for this workflow
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Owner/Creator
                          </label>
                          <Input
                            defaultValue="Current User"
                            className="w-full"
                          />
                          <p className="text-gray-500 text-xs mt-1">
                            Person responsible for this workflow
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Department
                          </label>
                          <Input
                            placeholder="e.g., Editorial, Design, QA"
                            className="w-full"
                          />
                          <p className="text-gray-500 text-xs mt-1">
                            Primary department using this workflow
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Workflow Configuration */}
                    <Separator className="my-6" />
                    
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow Configuration</h2>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Expected Duration
                          </label>
                          <Input
                            placeholder="e.g., 2 weeks, 30 days"
                            className="w-full"
                          />
                          <p className="text-gray-500 text-xs mt-1">
                            Typical time to complete this workflow
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tags
                          </label>
                          <Input
                            placeholder="Enter tags separated by commas"
                            className="w-full"
                          />
                          <p className="text-gray-500 text-xs mt-1">
                            Tags to help categorize and find this workflow
                          </p>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <Checkbox id="auto-assign" defaultChecked />
                            <label
                              htmlFor="auto-assign"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Auto-assign tasks based on skills
                            </label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox id="require-approval" />
                            <label
                              htmlFor="require-approval"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Require approval for task completion
                            </label>
                          </div>

                          <div className="flex items-center space-x-2">
                            <Checkbox id="send-notifications" defaultChecked />
                            <label
                              htmlFor="send-notifications"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Send notifications for task assignments
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Call to Action */}
                    <div className="mt-8 p-6 bg-blue-50 rounded-lg text-center">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Ready to design your workflow?
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Click the button below to proceed to the visual workflow designer
                        where you can add tasks, gateways, and connections.
                      </p>
                      <Button
                        size="lg"
                        onClick={handleNext}
                        disabled={!formValid}
                        className="px-6 py-3"
                      >
                        Continue to Designer →
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Getting Started Guide - Now shown as a side panel on larger screens */}
            </div>
          </div>
        )}

        {/* Designer Tab */}
        {activeTab === 'designer' && (
          <div className="flex-1 overflow-hidden">
            <WorkflowCanvas workflowData={workflow} />
          </div>
        )}

        {/* Assignments Tab */}
        {activeTab === 'assignments' && (
          <div className="flex-1 overflow-auto p-6 pb-24">
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Task Assignments</h2>
                <p className="text-gray-600">Assign contacts to workflow tasks. Tasks will appear here once you add them in the designer.</p>
              </div>

              <Card>
                <CardContent className="text-center py-12">
                  <Users size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Tasks Yet</h3>
                  <p className="text-gray-500 mb-4">
                    Add user tasks in the workflow designer to assign contacts.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => handleTabChange('designer')}
                  >
                    Go to Designer
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Execution Tab */}
        {activeTab === 'execution' && (
          <div className="flex-1 overflow-auto p-6 pb-24">
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Execution Settings</h2>
                <p className="text-gray-600">Configure how this workflow will execute and handle tasks.</p>
              </div>

              <Card>
                <CardContent className="text-center py-12">
                  <Activity size={48} className="mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Execution Engine</h3>
                  <p className="text-gray-500 mb-4">
                    Workflow execution engine will be available in Phase 1B.
                  </p>
                  <Badge variant="outline">Coming Soon</Badge>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Preview Tab */}
        {activeTab === 'preview' && (
          <div className="flex-1 overflow-auto p-6 pb-24">
            <div className="max-w-4xl mx-auto space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Workflow Preview</h2>
                <p className="text-gray-600">Review your workflow configuration before saving.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Workflow Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Name</label>
                      <p className="text-sm">{workflow.name || 'Untitled Workflow'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Description</label>
                      <p className="text-sm">{workflow.description || 'No description provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Category</label>
                      <p className="text-sm">{workflow.metadata?.category || 'General'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Version</label>
                      <p className="text-sm">{workflow.version}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Elements Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Total Elements</span>
                        <span className="text-sm font-medium">{workflow.elements.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Connections</span>
                        <span className="text-sm font-medium">{workflow.connections.length}</span>
                      </div>
                      {workflow.elements.length === 0 && (
                        <div className="flex items-center gap-2 text-amber-600 mt-2">
                          <AlertCircle size={16} />
                          <p className="text-sm">
                            No workflow elements added yet. Go to the designer to add elements.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 shadow-lg z-50">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={getCurrentTabIndex() === 0}
          >
            <ArrowLeft size={16} className="mr-2" />
            Previous
          </Button>
          
          {/* Progress Info */}
          <div className="flex items-center gap-4 flex-1 justify-center">
            <span className="text-sm text-gray-500">
              Step {getCurrentTabIndex() + 1} of {workflowTabs.length}
            </span>
            
            {/* Progress Bar */}
            <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
            
            <span className="text-sm font-medium text-blue-600">
              {workflowTabs[getCurrentTabIndex()].label}
            </span>
          </div>
          
          {getCurrentTabIndex() < workflowTabs.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!formValid}
            >
              Next
              <ArrowRight size={16} className="ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSaveWorkflow} disabled={!formValid}>
              <Save size={16} className="mr-2" />
              Save Workflow
            </Button>
          )}
        </div>
      </div>

      {/* Spacer for fixed bottom bar */}
      <div className="h-20 flex-shrink-0" />
    </div>
  );
}

export default NewWorkflow;