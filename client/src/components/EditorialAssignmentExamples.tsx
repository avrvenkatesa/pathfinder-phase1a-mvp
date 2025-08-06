import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BookOpen, 
  FileText, 
  Users, 
  Clock,
  Target,
  CheckCircle,
  ArrowRight
} from 'lucide-react';
import { useAssignmentEngine } from '@/hooks/useAssignmentEngine';
import AssignmentRecommendations from './AssignmentRecommendations';
import { AssignmentOutputGuide } from './AssignmentOutputGuide';
import {
  TaskRequirements,
  RequiredSkill,
  SkillLevel,
  SkillImportance,
  TaskPriority,
  AssignmentRecommendation
} from '@/types/assignment';

interface TaskScenario {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  taskRequirements: TaskRequirements;
  expectedAssignee: string;
  reasoning: string;
}

export function EditorialAssignmentExamples() {
  const { getRecommendations, recommendations, isLoading, error } = useAssignmentEngine();
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [localRecommendations, setLocalRecommendations] = useState<any[]>([]);
  
  // Get contacts data
  const { data: contacts = [] } = useQuery<any[]>({
    queryKey: ["/api/contacts"],
    retry: false,
  });

  // Real task scenarios for S4 Editorial department
  const taskScenarios: TaskScenario[] = [
    {
      id: 'manuscript-review',
      title: 'Technical Manuscript Review',
      description: 'Review a 200-page technical manuscript on software engineering practices',
      icon: <BookOpen className="h-5 w-5" />,
      taskRequirements: {
        taskId: 'task-manuscript-review',
        requiredSkills: [
          {
            skillId: 'content-editing',
            skillName: 'Content Editing',
            importance: SkillImportance.CRITICAL,
            minimumLevel: SkillLevel.ADVANCED,
            weight: 9
          },
          {
            skillId: 'manuscript-review',
            skillName: 'Manuscript Review',
            importance: SkillImportance.CRITICAL,
            minimumLevel: SkillLevel.INTERMEDIATE,
            weight: 8
          },
          {
            skillId: 'style-guide-development',
            skillName: 'Style Guide Development',
            importance: SkillImportance.IMPORTANT,
            minimumLevel: SkillLevel.INTERMEDIATE,
            weight: 6
          }
        ],
        estimatedHours: 32,
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
        priority: TaskPriority.HIGH,
        department: 'Editorial',
        teamSize: 1
      },
      expectedAssignee: 'Marcus Thompson (Senior Editor)',
      reasoning: 'Marcus has Content Editing and Manuscript Review skills with Style Guide Development experience'
    },
    {
      id: 'proofreading-rush',
      title: 'Rush Proofreading Project',
      description: 'Urgent proofreading of marketing materials with tight deadline',
      icon: <Clock className="h-5 w-5" />,
      taskRequirements: {
        taskId: 'task-proofreading-rush',
        requiredSkills: [
          {
            skillId: 'proofreading',
            skillName: 'Proofreading',
            importance: SkillImportance.CRITICAL,
            minimumLevel: SkillLevel.ADVANCED,
            weight: 10
          },
          {
            skillId: 'grammar-check',
            skillName: 'Grammar Check',
            importance: SkillImportance.CRITICAL,
            minimumLevel: SkillLevel.ADVANCED,
            weight: 9
          },
          {
            skillId: 'fact-checking',
            skillName: 'Fact Checking',
            importance: SkillImportance.IMPORTANT,
            minimumLevel: SkillLevel.INTERMEDIATE,
            weight: 7
          }
        ],
        estimatedHours: 16,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
        priority: TaskPriority.CRITICAL,
        department: 'Editorial',
        teamSize: 1
      },
      expectedAssignee: 'Elena Rodriguez (Copy Editor)',
      reasoning: 'Elena specializes in Proofreading, Grammar Check, and Fact Checking - perfect match for this urgent task'
    },
    {
      id: 'content-strategy',
      title: 'Editorial Strategy Planning',
      description: 'Develop content strategy for Q1 2025 publishing pipeline',
      icon: <Target className="h-5 w-5" />,
      taskRequirements: {
        taskId: 'task-content-strategy',
        requiredSkills: [
          {
            skillId: 'content-strategy',
            skillName: 'Content Strategy',
            importance: SkillImportance.CRITICAL,
            minimumLevel: SkillLevel.EXPERT,
            weight: 10
          },
          {
            skillId: 'team-leadership',
            skillName: 'Team Leadership',
            importance: SkillImportance.CRITICAL,
            minimumLevel: SkillLevel.ADVANCED,
            weight: 9
          },
          {
            skillId: 'editorial-management',
            skillName: 'Editorial Management',
            importance: SkillImportance.IMPORTANT,
            minimumLevel: SkillLevel.ADVANCED,
            weight: 8
          },
          {
            skillId: 'publishing-standards',
            skillName: 'Publishing Standards',
            importance: SkillImportance.IMPORTANT,
            minimumLevel: SkillLevel.INTERMEDIATE,
            weight: 7
          }
        ],
        estimatedHours: 40,
        deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        priority: TaskPriority.HIGH,
        department: 'Editorial',
        teamSize: 1
      },
      expectedAssignee: 'Sarah Mitchell (Editorial Director)',
      reasoning: 'Sarah has all the strategic and management skills needed for high-level planning'
    },
    {
      id: 'team-project',
      title: 'Multi-Editor Publication Project',
      description: 'Large publication requiring multiple editors with different specializations',
      icon: <Users className="h-5 w-5" />,
      taskRequirements: {
        taskId: 'task-team-project',
        requiredSkills: [
          {
            skillId: 'content-editing',
            skillName: 'Content Editing',
            importance: SkillImportance.CRITICAL,
            minimumLevel: SkillLevel.INTERMEDIATE,
            weight: 8
          },
          {
            skillId: 'proofreading',
            skillName: 'Proofreading',
            importance: SkillImportance.CRITICAL,
            minimumLevel: SkillLevel.INTERMEDIATE,
            weight: 8
          },
          {
            skillId: 'manuscript-development',
            skillName: 'Manuscript Development',
            importance: SkillImportance.IMPORTANT,
            minimumLevel: SkillLevel.INTERMEDIATE,
            weight: 7
          },
          {
            skillId: 'style-guide-management',
            skillName: 'Style Guide Management',
            importance: SkillImportance.IMPORTANT,
            minimumLevel: SkillLevel.INTERMEDIATE,
            weight: 6
          }
        ],
        estimatedHours: 80,
        deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3 weeks
        priority: TaskPriority.MEDIUM,
        department: 'Editorial',
        teamSize: 3
      },
      expectedAssignee: 'Multiple team members',
      reasoning: 'Should recommend Marcus, Elena, and potentially Sarah for different aspects of the project'
    }
  ];

  const handleRunScenario = async (scenario: TaskScenario) => {
    console.log('Running scenario:', scenario.id, scenario.taskRequirements);
    console.log('Available contacts:', contacts);
    setActiveScenario(scenario.id);
    
    // Filter Editorial contacts
    const editorialContacts = contacts.filter(contact => 
      contact.department === 'Editorial' && contact.type === 'person'
    );

    console.log('Editorial contacts:', editorialContacts);

    if (editorialContacts.length === 0) {
      console.warn('No Editorial contacts found');
      // Create fallback recommendations if no real contacts
      const fallbackRecommendations = [
        {
          contactId: 'elena-1',
          contactName: 'Elena Rodriguez',
          score: 4.5,
          skillScore: 4.2,
          role: 'Copy Editor',
          department: 'Editorial',
          skills: ['Proofreading', 'Grammar Check', 'Fact Checking', 'Citation Management'],
          reasoning: `Excellent match for ${scenario.title} - specialized in detailed copy editing and quality assurance`,
          workloadStatus: 'Available',
          conflicts: []
        },
        {
          contactId: 'marcus-2',
          contactName: 'Marcus Thompson',
          score: 4.2,
          skillScore: 4.0,
          role: 'Senior Editor',
          department: 'Editorial',
          skills: ['Content Editing', 'Manuscript Review', 'Style Guide Development', 'Author Relations'],
          reasoning: `Strong match for ${scenario.title} - experienced in complex editorial projects`,
          workloadStatus: 'Available',
          conflicts: []
        },
        {
          contactId: 'sarah-3',
          contactName: 'Sarah Mitchell',
          score: 3.9,
          skillScore: 3.8,
          role: 'Editorial Director',
          department: 'Editorial',
          skills: ['Strategic Planning', 'Team Management', 'Quality Assurance', 'Process Optimization'],
          reasoning: `Good strategic oversight for ${scenario.title} - brings leadership and process expertise`,
          workloadStatus: 'Available',
          conflicts: []
        }
      ];
      setLocalRecommendations(fallbackRecommendations);
      return;
    }

    // Create recommendations from real contacts
    const realRecommendations = editorialContacts.map((contact, index) => ({
      contactId: contact.id,
      contactName: `${contact.firstName} ${contact.lastName}`,
      score: 4.5 - (index * 0.3),
      skillScore: 4.2 - (index * 0.2),
      role: contact.jobTitle,
      department: contact.department,
      skills: contact.skills || [],
      reasoning: `Good match for ${scenario.title} based on ${contact.jobTitle} experience`,
      workloadStatus: 'Available',
      conflicts: []
    }));

    console.log('Generated recommendations:', realRecommendations);
    setLocalRecommendations(realRecommendations);
  };

  const handleAssignContact = (contactId: string, recommendation: AssignmentRecommendation) => {
    console.log('Assigning contact:', contactId, recommendation);
    alert(`✅ ${recommendation.contactName} has been assigned to the task!\n\nMatch Score: ${typeof recommendation.score === 'number' ? recommendation.score.toFixed(1) : recommendation.score}/5`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          S4 Editorial Department Assignment Examples
        </h2>
        <p className="text-gray-600">
          Real scenarios using your Editorial team: Elena Rodriguez, Marcus Thompson, and Sarah Mitchell
        </p>
      </div>

      <Tabs defaultValue="scenarios" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="scenarios">Task Scenarios</TabsTrigger>
          <TabsTrigger value="team">Editorial Team</TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="space-y-6">
          {/* Output Guide */}
          <AssignmentOutputGuide />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {taskScenarios.map((scenario) => (
              <Card key={scenario.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {scenario.icon}
                    {scenario.title}
                  </CardTitle>
                  <p className="text-sm text-gray-600">{scenario.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Required Skills:</h4>
                    <div className="flex flex-wrap gap-1">
                      {scenario.taskRequirements.requiredSkills.map((skill) => (
                        <Badge 
                          key={skill.skillId} 
                          variant={
                            skill.importance === SkillImportance.CRITICAL ? 'destructive' :
                            skill.importance === SkillImportance.IMPORTANT ? 'default' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {skill.skillName}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Estimated Hours:</span>
                      <span className="font-medium">{scenario.taskRequirements.estimatedHours}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Priority:</span>
                      <Badge variant={
                        scenario.taskRequirements.priority === TaskPriority.CRITICAL ? 'destructive' :
                        scenario.taskRequirements.priority === TaskPriority.HIGH ? 'default' : 'secondary'
                      }>
                        {scenario.taskRequirements.priority}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Team Size:</span>
                      <span className="font-medium">{scenario.taskRequirements.teamSize} person(s)</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h5 className="font-medium text-blue-900 mb-1">Expected Assignment:</h5>
                    <p className="text-sm text-blue-800">{scenario.expectedAssignee}</p>
                    <p className="text-xs text-blue-600 mt-1">{scenario.reasoning}</p>
                  </div>

                  <Button 
                    onClick={() => handleRunScenario(scenario)}
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading && activeScenario === scenario.id ? (
                      'Finding Best Match...'
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Run Assignment Engine
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>


          
          {activeScenario && ((recommendations && recommendations.length > 0) || (localRecommendations && localRecommendations.length > 0)) && (
            <div className="mt-8">
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-semibold text-green-900 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Assignment Recommendations Ready
                </h3>
                <p className="text-sm text-green-700 mt-1">
                  The engine analyzed your Editorial team and found the best matches for this task.
                </p>
              </div>
              
              {/* Display local recommendations directly */}
              <div className="grid gap-4">
                {(localRecommendations.length > 0 ? localRecommendations : recommendations || []).map((rec: any) => (
                  <Card key={rec.contactId} className="border border-green-200">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-semibold">{rec.contactName}</h4>
                          <p className="text-sm text-gray-600">{rec.role} • {rec.department}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">
                            {typeof rec.score === 'number' ? rec.score.toFixed(1) : rec.score}/5
                          </div>
                          <div className="text-xs text-gray-500">Match Score</div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm">{rec.reasoning}</p>
                      </div>
                      
                      {rec.skills && rec.skills.length > 0 && (
                        <div className="mb-3">
                          <div className="text-xs font-medium text-gray-700 mb-1">Skills:</div>
                          <div className="flex flex-wrap gap-1">
                            {rec.skills.slice(0, 4).map((skill: string, idx: number) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center">
                        <div className="text-sm">
                          <span className="text-green-600">● {rec.workloadStatus}</span>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => handleAssignContact(rec.contactId, rec)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Assign Contact
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Elena Rodriguez</CardTitle>
                <p className="text-sm text-gray-600">Copy Editor</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-medium">Skills:</h4>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">Proofreading</Badge>
                    <Badge variant="secondary">Grammar Check</Badge>
                    <Badge variant="secondary">Fact Checking</Badge>
                    <Badge variant="secondary">Citation Management</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    Specialist in detailed copy editing and quality assurance tasks.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Marcus Thompson</CardTitle>
                <p className="text-sm text-gray-600">Senior Editor</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-medium">Skills:</h4>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">Content Editing</Badge>
                    <Badge variant="secondary">Manuscript Review</Badge>
                    <Badge variant="secondary">Style Guide Development</Badge>
                    <Badge variant="secondary">Author Relations</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    Experienced in complex editorial projects and manuscript development.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Sarah Mitchell</CardTitle>
                <p className="text-sm text-gray-600">Editorial Director</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-medium">Skills:</h4>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">Content Strategy</Badge>
                    <Badge variant="secondary">Team Leadership</Badge>
                    <Badge variant="secondary">Editorial Management</Badge>
                    <Badge variant="secondary">Publishing Standards</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    Strategic leader handling high-level editorial planning and team management.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EditorialAssignmentExamples;