import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import EnhancedContactForm from "./enhanced-contact-form";
import { Clock, Users, TrendingUp, Zap, Settings, UserCheck, FileText, Calendar } from "lucide-react";

export default function EnhancedContactDemo() {
  const [selectedSkills, setSelectedSkills] = useState(["JavaScript", "Project Management"]);
  const [showForm, setShowForm] = useState(false);

  // Query for assignment recommendations
  const { data: recommendations, isLoading: recLoading } = useQuery({
    queryKey: ["/api/contacts/assignment-recommendations", selectedSkills],
    queryFn: async () => {
      if (selectedSkills.length === 0) return [];
      const response = await apiRequest("POST", "/api/contacts/assignment-recommendations", {
        requiredSkills: selectedSkills,
        options: { maxResults: 5, includePartialMatches: true }
      });
      return response.json();
    },
    enabled: selectedSkills.length > 0
  });

  // Query for capacity analysis
  const { data: capacityAnalysis, isLoading: capLoading } = useQuery({
    queryKey: ["/api/contacts/capacity-analysis"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/contacts/capacity-analysis");
      return response.json();
    }
  });

  // Query for skills gap analysis
  const { data: skillsGap, isLoading: gapLoading } = useQuery({
    queryKey: ["/api/contacts/skills-gap-analysis", selectedSkills],
    queryFn: async () => {
      if (selectedSkills.length === 0) return null;
      const response = await apiRequest("POST", "/api/contacts/skills-gap-analysis", {
        requiredSkills: selectedSkills
      });
      return response.json();
    },
    enabled: selectedSkills.length > 0
  });

  // Query for events
  const { data: events } = useQuery({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/events");
      return response.json();
    },
    refetchInterval: 5000
  });

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600 bg-green-100";
    if (score >= 70) return "text-blue-600 bg-blue-100";
    if (score >= 55) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="enhanced-contact-demo">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          <Zap className="h-8 w-8 text-primary" />
          Enhanced Contact Management System
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Comprehensive contact management with workflow integration, skills tracking, 
          assignment recommendations, and capacity analysis powered by microservices architecture.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 justify-center mb-6">
        <Button 
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2"
          data-testid="button-create-enhanced-contact"
        >
          <UserCheck className="h-4 w-4" />
          Create Enhanced Contact
        </Button>
        <Button 
          variant="outline"
          onClick={() => setSelectedSkills(prev => 
            prev.includes("React") ? prev.filter(s => s !== "React") : [...prev, "React"]
          )}
          data-testid="button-toggle-react-skill"
        >
          {selectedSkills.includes("React") ? "Remove" : "Add"} React to Requirements
        </Button>
      </div>

      {/* Enhanced Contact Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <EnhancedContactForm onClose={() => setShowForm(false)} />
          </div>
        </div>
      )}

      <Tabs defaultValue="assignments" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl mx-auto">
          <TabsTrigger value="assignments" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="capacity" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Capacity
          </TabsTrigger>
          <TabsTrigger value="skills" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Skills Analysis
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Events
          </TabsTrigger>
        </TabsList>

        {/* Assignment Recommendations Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assignment Recommendations
              </CardTitle>
              <CardDescription>
                Intelligent recommendations based on skills: {selectedSkills.join(", ")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2">Analyzing team capabilities...</p>
                </div>
              ) : recommendations && recommendations.length > 0 ? (
                <div className="grid gap-4">
                  {recommendations.map((rec: any) => (
                    <div key={rec.contactId} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{rec.contact.name}</h3>
                          <p className="text-sm text-gray-600">
                            {rec.contact.jobTitle} • {rec.contact.department}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(rec.totalScore)}`}>
                            {rec.totalScore}% Match
                          </div>
                          <Badge 
                            variant={rec.recommendationLevel === 'excellent' ? 'default' : 'secondary'}
                            className="mt-1"
                          >
                            {rec.recommendationLevel}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Skills</p>
                          <p className="font-medium">{rec.skillsScore}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Availability</p>
                          <p className="font-medium">{rec.availabilityScore}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Workload</p>
                          <p className="font-medium">{rec.workloadScore}%</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Department</p>
                          <p className="font-medium">{rec.departmentScore}%</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500 mb-1">Matching Skills:</p>
                        <div className="flex gap-1 flex-wrap">
                          {rec.matchingSkills.map((skill: string) => (
                            <Badge key={skill} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm text-gray-500 mb-1">Reasoning:</p>
                        <ul className="text-sm space-y-1">
                          {rec.reasoning.map((reason: string, idx: number) => (
                            <li key={idx} className="flex items-center gap-2">
                              <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500" data-testid="text-no-recommendations">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No team members found for the selected skills</p>
                  <p className="text-sm">Try creating some contacts with the Enhanced Contact Form</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Capacity Analysis Tab */}
        <TabsContent value="capacity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Team Capacity Analysis
              </CardTitle>
              <CardDescription>
                Optimize workload distribution and identify capacity issues
              </CardDescription>
            </CardHeader>
            <CardContent>
              {capLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2">Analyzing team capacity...</p>
                </div>
              ) : capacityAnalysis ? (
                <div className="space-y-6">
                  {capacityAnalysis.suggestions.length > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Optimization Suggestions
                      </h4>
                      <ul className="space-y-1">
                        {capacityAnalysis.suggestions.map((suggestion: string, idx: number) => (
                          <li key={idx} className="text-sm flex items-center gap-2">
                            <div className="w-1 h-1 bg-blue-600 rounded-full"></div>
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-6">
                    {capacityAnalysis.overloadedContacts.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-red-600 mb-2">Overloaded ({capacityAnalysis.overloadedContacts.length})</h4>
                        <div className="space-y-2">
                          {capacityAnalysis.overloadedContacts.map((contact: any) => (
                            <div key={contact.id} className="bg-red-50 p-3 rounded">
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-sm text-gray-600">{contact.department}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {capacityAnalysis.underutilizedContacts.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-green-600 mb-2">Underutilized ({capacityAnalysis.underutilizedContacts.length})</h4>
                        <div className="space-y-2">
                          {capacityAnalysis.underutilizedContacts.map((contact: any) => (
                            <div key={contact.id} className="bg-green-50 p-3 rounded">
                              <p className="font-medium">{contact.name}</p>
                              <p className="text-sm text-gray-600">{contact.department}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No capacity data available</p>
                  <p className="text-sm">Create some contacts to see capacity analysis</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Skills Gap Analysis Tab */}
        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Skills Gap Analysis
              </CardTitle>
              <CardDescription>
                Identify skill shortages and coverage gaps for: {selectedSkills.join(", ")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {gapLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2">Analyzing skills coverage...</p>
                </div>
              ) : skillsGap ? (
                <div className="space-y-6">
                  {skillsGap.missingSkills.length > 0 && (
                    <div className="bg-red-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-red-600 mb-2">Missing Skills</h4>
                      <div className="flex gap-2 flex-wrap">
                        {skillsGap.missingSkills.map((skill: string) => (
                          <Badge key={skill} variant="destructive">{skill}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-semibold mb-3">Skills Coverage Analysis</h4>
                    <div className="space-y-3">
                      {skillsGap.skillGaps.map((gap: any) => (
                        <div key={gap.skill} className="border rounded p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{gap.skill}</span>
                            <span className={`px-2 py-1 rounded text-sm ${
                              gap.gap > 50 ? 'bg-red-100 text-red-800' :
                              gap.gap > 25 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {gap.gap}% gap
                            </span>
                          </div>
                          <Progress value={100 - gap.gap} className="mb-2" />
                          <ul className="text-sm text-gray-600 space-y-1">
                            {gap.suggestions.map((suggestion: string, idx: number) => (
                              <li key={idx}>• {suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {skillsGap.availableSkills.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3">Available Skills</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {skillsGap.availableSkills.map((skill: any) => (
                          <div key={skill.skill} className="bg-gray-50 p-3 rounded">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">{skill.skill}</span>
                              <Badge variant="outline">{skill.avgProficiency}</Badge>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              {skill.contactCount} team member{skill.contactCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select skills to analyze coverage gaps</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Microservices Event Stream
              </CardTitle>
              <CardDescription>
                Real-time events published for future microservices integration
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events && events.events && events.events.length > 0 ? (
                <div className="space-y-2" data-testid="events-list">
                  {events.events.slice(0, 10).map((event: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <Badge variant="outline">{event.eventType}</Badge>
                        <span className="text-xs text-gray-500">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-600">
                        Contact: {event.contactId || 'System'} • User: {event.userId || 'System'}
                      </p>
                      {event.data && (
                        <pre className="text-xs mt-1 overflow-x-auto">
                          {JSON.stringify(event.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-gray-500 text-center mt-4">
                    Showing latest {Math.min(events.events.length, 10)} events • Total: {events.count}
                  </p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No events yet</p>
                  <p className="text-sm">Events will appear here as you interact with the system</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}