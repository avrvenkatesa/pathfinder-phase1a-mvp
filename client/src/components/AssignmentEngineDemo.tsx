import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Brain, 
  Users, 
  Target, 
  BarChart3, 
  Settings, 
  Plus,
  Trash2,
  Lightbulb,
  Activity
} from 'lucide-react';
import AssignmentRecommendations from './AssignmentRecommendations';
import { useAssignmentEngine } from '@/hooks/useAssignmentEngine';
import { useQuery } from '@tanstack/react-query';
import type { Contact } from '@shared/schema';
import {
  TaskRequirements,
  RequiredSkill,
  SkillLevel,
  SkillImportance,
  TaskPriority,
  LocationRequirement,
  AssignmentRecommendation
} from '@/types/assignment';

export function AssignmentEngineDemo() {
  const {
    getRecommendations,
    recommendations,
    isLoading,
    error,
    config,
    updateConfig,
    statistics
  } = useAssignmentEngine();

  const [taskRequirements, setTaskRequirements] = useState<TaskRequirements>({
    taskId: 'demo-task-1',
    requiredSkills: [
      {
        skillId: 'js-1',
        skillName: 'JavaScript',
        importance: SkillImportance.CRITICAL,
        minimumLevel: SkillLevel.INTERMEDIATE,
        weight: 8
      },
      {
        skillId: 'react-1',
        skillName: 'React',
        importance: SkillImportance.IMPORTANT,
        minimumLevel: SkillLevel.INTERMEDIATE,
        weight: 7
      },
      {
        skillId: 'api-1',
        skillName: 'API Development',
        importance: SkillImportance.NICE_TO_HAVE,
        minimumLevel: SkillLevel.BEGINNER,
        weight: 5
      }
    ],
    estimatedHours: 40,
    deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
    priority: TaskPriority.HIGH,
    department: 'Engineering',
    teamSize: 1
  });

  const [newSkill, setNewSkill] = useState({
    skillName: '',
    importance: SkillImportance.IMPORTANT,
    minimumLevel: SkillLevel.INTERMEDIATE,
    weight: 5
  });

  const [showRecommendations, setShowRecommendations] = useState(false);

  // Fetch contacts to get company and department data
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
    retry: false,
  });

  // Extract companies and their departments from contacts
  const companiesAndDepartments = useMemo(() => {
    const companies = new Map<string, Set<string>>();
    
    contacts.forEach(contact => {
      if (contact.type === 'company') {
        if (!companies.has(contact.name)) {
          companies.set(contact.name, new Set());
        }
      } else if (contact.type === 'person' && contact.department) {
        // Find the company this person belongs to by traversing up the hierarchy
        let currentContact = contact;
        let company = null;
        
        // Simple approach: find the root company
        const findCompany = (contactId: string): string | null => {
          const c = contacts.find(c => c.id === contactId);
          if (!c) return null;
          if (c.type === 'company') return c.name;
          if (c.parentId) return findCompany(c.parentId);
          return null;
        };
        
        if (contact.parentId) {
          company = findCompany(contact.parentId);
        }
        
        if (company) {
          if (!companies.has(company)) {
            companies.set(company, new Set());
          }
          companies.get(company)!.add(contact.department);
        }
      }
    });
    
    return Array.from(companies.entries()).map(([company, departments]) => ({
      company,
      departments: Array.from(departments)
    }));
  }, [contacts]);

  // Get all unique departments across all companies
  const allDepartments = useMemo(() => {
    const depts = new Set<string>();
    companiesAndDepartments.forEach(({ departments }) => {
      departments.forEach(dept => depts.add(dept));
    });
    return Array.from(depts).sort();
  }, [companiesAndDepartments]);

  const handleAddSkill = () => {
    if (newSkill.skillName.trim()) {
      const skill: RequiredSkill = {
        skillId: `skill-${Date.now()}`,
        skillName: newSkill.skillName.trim(),
        importance: newSkill.importance,
        minimumLevel: newSkill.minimumLevel,
        weight: newSkill.weight
      };

      setTaskRequirements(prev => ({
        ...prev,
        requiredSkills: [...prev.requiredSkills, skill]
      }));

      setNewSkill({
        skillName: '',
        importance: SkillImportance.IMPORTANT,
        minimumLevel: SkillLevel.INTERMEDIATE,
        weight: 5
      });
    }
  };

  const handleRemoveSkill = (skillId: string) => {
    setTaskRequirements(prev => ({
      ...prev,
      requiredSkills: prev.requiredSkills.filter(skill => skill.skillId !== skillId)
    }));
  };

  const handleGetRecommendations = async () => {
    try {
      setShowRecommendations(true);
      await getRecommendations(taskRequirements);
    } catch (err) {
      console.error('Failed to get recommendations:', err);
    }
  };

  const handleAssignContact = (contactId: string, recommendation: AssignmentRecommendation) => {
    console.log('Assigning contact:', contactId, recommendation);
    // In a real implementation, this would update the workflow
    alert(`Contact ${recommendation.contactName} has been assigned to the task!`);
  };

  const getImportanceColor = (importance: SkillImportance) => {
    switch (importance) {
      case SkillImportance.CRITICAL: return 'destructive';
      case SkillImportance.IMPORTANT: return 'default';
      case SkillImportance.NICE_TO_HAVE: return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-blue-600" />
            Skills-Based Assignment Engine
          </h1>
          <p className="text-gray-600 mt-2">
            Intelligent matching of contacts to workflow tasks based on skills, availability, and workload
          </p>
        </div>
        
        {statistics && (
          <Card className="w-64">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{statistics.totalAssignments}</div>
                <div className="text-sm text-gray-500">Total Assignments</div>
                <div className="text-lg font-semibold mt-2">{statistics.averagePerformance.toFixed(1)}/5</div>
                <div className="text-xs text-gray-500">Avg Performance</div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="demo" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="demo" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Task Assignment Demo
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Engine Configuration
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Task Assignment Demo */}
        <TabsContent value="demo" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Task Requirements Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Task Requirements
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Basic Task Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="estimated-hours">Estimated Hours</Label>
                    <Input
                      id="estimated-hours"
                      type="number"
                      value={taskRequirements.estimatedHours}
                      onChange={(e) => setTaskRequirements(prev => ({
                        ...prev,
                        estimatedHours: parseInt(e.target.value) || 0
                      }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={taskRequirements.priority}
                      onValueChange={(value) => setTaskRequirements(prev => ({
                        ...prev,
                        priority: value as TaskPriority
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
                        <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
                        <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
                        <SelectItem value={TaskPriority.CRITICAL}>Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={taskRequirements.department || ''}
                    onValueChange={(value) => setTaskRequirements(prev => ({
                      ...prev,
                      department: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {allDepartments.length > 0 ? (
                        allDepartments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="Engineering" disabled>
                          No departments found - Engineering (demo)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  
                  {/* Show company breakdown */}
                  {companiesAndDepartments.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      <p className="font-medium mb-1">Available departments by company:</p>
                      {companiesAndDepartments.map(({ company, departments }) => (
                        <div key={company} className="mb-1">
                          <span className="font-medium text-blue-600">{company}:</span> {departments.join(', ')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Required Skills */}
                <div>
                  <Label className="text-base font-semibold">Required Skills</Label>
                  <p className="text-sm text-gray-600 mb-3">
                    Define the skills needed for this task
                  </p>

                  {/* Existing Skills */}
                  <div className="space-y-2 mb-4">
                    {taskRequirements.requiredSkills.map((skill) => (
                      <div key={skill.skillId} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant={getImportanceColor(skill.importance)}>
                            {skill.skillName}
                          </Badge>
                          <span className="text-sm text-gray-600">
                            {skill.minimumLevel} • Weight: {skill.weight}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSkill(skill.skillId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {/* Add New Skill */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <Input
                      placeholder="Skill name"
                      value={newSkill.skillName}
                      onChange={(e) => setNewSkill(prev => ({
                        ...prev,
                        skillName: e.target.value
                      }))}
                    />
                    
                    <Select
                      value={newSkill.importance}
                      onValueChange={(value) => setNewSkill(prev => ({
                        ...prev,
                        importance: value as SkillImportance
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SkillImportance.CRITICAL}>Critical</SelectItem>
                        <SelectItem value={SkillImportance.IMPORTANT}>Important</SelectItem>
                        <SelectItem value={SkillImportance.NICE_TO_HAVE}>Nice to Have</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <Select
                      value={newSkill.minimumLevel}
                      onValueChange={(value) => setNewSkill(prev => ({
                        ...prev,
                        minimumLevel: value as SkillLevel
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SkillLevel.BEGINNER}>Beginner</SelectItem>
                        <SelectItem value={SkillLevel.INTERMEDIATE}>Intermediate</SelectItem>
                        <SelectItem value={SkillLevel.ADVANCED}>Advanced</SelectItem>
                        <SelectItem value={SkillLevel.EXPERT}>Expert</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="number"
                      placeholder="Weight (1-10)"
                      value={newSkill.weight}
                      onChange={(e) => setNewSkill(prev => ({
                        ...prev,
                        weight: parseInt(e.target.value) || 5
                      }))}
                      min="1"
                      max="10"
                    />
                  </div>

                  <Button onClick={handleAddSkill} className="w-full" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Skill Requirement
                  </Button>
                </div>

                <Separator />

                {/* Get Recommendations Button */}
                <Button 
                  onClick={handleGetRecommendations}
                  className="w-full"
                  disabled={isLoading || taskRequirements.requiredSkills.length === 0}
                >
                  {isLoading ? (
                    <>
                      <Activity className="h-4 w-4 mr-2 animate-spin" />
                      Finding Best Matches...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Get Assignment Recommendations
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Engine Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Engine Capabilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-semibold text-blue-700">Skill Matching Algorithm</h4>
                    <p className="text-sm text-gray-600">
                      Calculates compatibility scores based on skill overlap, proficiency levels, 
                      and related skills using advanced taxonomy mapping.
                    </p>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-semibold text-green-700">Workload Balancing</h4>
                    <p className="text-sm text-gray-600">
                      Real-time workload calculation considering current assignments, 
                      capacity, and prevents overallocation.
                    </p>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-semibold text-purple-700">Availability Checking</h4>
                    <p className="text-sm text-gray-600">
                      Integrates with calendar systems, checks conflicts, 
                      and considers time zones for global teams.
                    </p>
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4">
                    <h4 className="font-semibold text-orange-700">Business Rules Engine</h4>
                    <p className="text-sm text-gray-600">
                      Configurable rules for automatic assignment, role constraints, 
                      and approval requirements.
                    </p>
                  </div>

                  <div className="border-l-4 border-red-500 pl-4">
                    <h4 className="font-semibold text-red-700">Machine Learning Ready</h4>
                    <p className="text-sm text-gray-600">
                      Learns from assignment outcomes to improve future recommendations 
                      and optimize team performance.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Assignment Recommendations */}
          {showRecommendations && (
            <div className="mt-6">
              <AssignmentRecommendations
                taskRequirements={taskRequirements}
                onAssignContact={handleAssignContact}
                showBulkActions={true}
                maxRecommendations={5}
              />
            </div>
          )}
        </TabsContent>

        {/* Engine Configuration */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Engine Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="skill-weight">Skill Match Weight ({config.skillMatchWeight})</Label>
                    <Input
                      id="skill-weight"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.skillMatchWeight}
                      onChange={(e) => updateConfig({ skillMatchWeight: parseFloat(e.target.value) })}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="availability-weight">Availability Weight ({config.availabilityWeight})</Label>
                    <Input
                      id="availability-weight"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.availabilityWeight}
                      onChange={(e) => updateConfig({ availabilityWeight: parseFloat(e.target.value) })}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="workload-weight">Workload Weight ({config.workloadWeight})</Label>
                    <Input
                      id="workload-weight"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.workloadWeight}
                      onChange={(e) => updateConfig({ workloadWeight: parseFloat(e.target.value) })}
                      className="mt-2"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="performance-weight">Performance Weight ({config.performanceWeight})</Label>
                    <Input
                      id="performance-weight"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={config.performanceWeight}
                      onChange={(e) => updateConfig({ performanceWeight: parseFloat(e.target.value) })}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="max-utilization">Max Workload Utilization ({Math.round(config.maxWorkloadUtilization * 100)}%)</Label>
                    <Input
                      id="max-utilization"
                      type="range"
                      min="0.5"
                      max="1.0"
                      step="0.05"
                      value={config.maxWorkloadUtilization}
                      onChange={(e) => updateConfig({ maxWorkloadUtilization: parseFloat(e.target.value) })}
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="recommendation-count">Number of Recommendations ({config.recommendationCount})</Label>
                    <Input
                      id="recommendation-count"
                      type="range"
                      min="1"
                      max="10"
                      step="1"
                      value={config.recommendationCount}
                      onChange={(e) => updateConfig({ recommendationCount: parseInt(e.target.value) })}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-4">
                  Analytics dashboard will show assignment success rates, 
                  performance trends, and optimization recommendations.
                </p>
                <p className="text-sm text-gray-400">
                  This feature will be available once assignment history data is collected.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AssignmentEngineDemo;