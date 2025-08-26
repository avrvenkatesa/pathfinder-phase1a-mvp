import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Star,
  Calendar,
  BarChart3,
  Lightbulb,
  Target
} from 'lucide-react';
import {
  AssignmentRecommendation,
  TaskRequirements,
  ConflictSeverity,
  ConflictType,
  SkillImportance
} from '@/types/assignment';
import { useAssignmentEngine } from '@/hooks/useAssignmentEngine';

interface AssignmentRecommendationsProps {
  taskRequirements: TaskRequirements;
  onAssignContact: (contactId: string, recommendation: AssignmentRecommendation) => void;
  onTaskRequirementsChange?: (requirements: TaskRequirements) => void;
  showBulkActions?: boolean;
  maxRecommendations?: number;
}

export function AssignmentRecommendations({
  taskRequirements,
  onAssignContact,
  onTaskRequirementsChange,
  showBulkActions = false,
  maxRecommendations = 3
}: AssignmentRecommendationsProps) {
  const {
    getRecommendations,
    recommendations,
    isLoading,
    error,
    config,
    updateConfig
  } = useAssignmentEngine();

  const [selectedRecommendation, setSelectedRecommendation] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch recommendations when task requirements change
  useEffect(() => {
    if (taskRequirements.requiredSkills.length > 0) {
      handleRefreshRecommendations();
    }
  }, [taskRequirements, refreshKey]);

  const handleRefreshRecommendations = async () => {
    try {
      await getRecommendations(taskRequirements);
    } catch (err) {
      console.error('Failed to get recommendations:', err);
    }
  };

  const handleAssignContact = (contactId: string, recommendation: AssignmentRecommendation) => {
    setSelectedRecommendation(contactId);
    onAssignContact(contactId, recommendation);
  };

  const toggleDetails = (contactId: string) => {
    setShowDetails(prev => ({
      ...prev,
      [contactId]: !prev[contactId]
    }));
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 80) return 'default';
    if (score >= 60) return 'secondary';
    return 'destructive';
  };

  const getConflictSeverityColor = (severity: ConflictSeverity) => {
    switch (severity) {
      case ConflictSeverity.LOW: return 'text-yellow-500';
      case ConflictSeverity.MEDIUM: return 'text-orange-500';
      case ConflictSeverity.HIGH: return 'text-red-500';
      case ConflictSeverity.BLOCKING: return 'text-red-700';
      default: return 'text-gray-500';
    }
  };

  const getSkillImportanceColor = (importance: SkillImportance) => {
    switch (importance) {
      case SkillImportance.CRITICAL: return 'destructive';
      case SkillImportance.IMPORTANT: return 'default';
      case SkillImportance.NICE_TO_HAVE: return 'secondary';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Finding Best Matches...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-48"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Error Loading Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button 
            onClick={handleRefreshRecommendations} 
            className="mt-4"
            variant="outline"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assignment Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              No suitable contacts found for this task
            </p>
            <Button 
              onClick={handleRefreshRecommendations}
              variant="outline"
            >
              Refresh Recommendations
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Assignment Recommendations
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleRefreshRecommendations}
                variant="outline"
                size="sm"
              >
                Refresh
              </Button>
              <Badge variant="outline">
                {recommendations.length} matches found
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Task Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Task Requirements Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm">{taskRequirements.estimatedHours}h estimated</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm">
                {taskRequirements.deadline ? 
                  `Due ${taskRequirements.deadline.toLocaleDateString()}` : 
                  'No deadline'
                }
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-gray-500" />
              <span className="text-sm capitalize">{taskRequirements.priority} priority</span>
            </div>
          </div>
          
          {taskRequirements.requiredSkills.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">Required Skills:</p>
              <div className="flex flex-wrap gap-2">
                {taskRequirements.requiredSkills.map((skill) => (
                  <Badge 
                    key={skill.skillId}
                    variant={getSkillImportanceColor(skill.importance)}
                  >
                    {skill.skillName}
                    {skill.importance === SkillImportance.CRITICAL && ' *'}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations List */}
      <div className="space-y-3">
        {recommendations.slice(0, maxRecommendations).map((recommendation, index) => (
          <Card 
            key={recommendation.contactId}
            className={`transition-all duration-200 ${
              selectedRecommendation === recommendation.contactId 
                ? 'ring-2 ring-blue-500 shadow-md' 
                : 'hover:shadow-sm'
            }`}
          >
            <CardContent className="p-4">
              {/* Main recommendation row */}
              <div className="flex items-center gap-4">
                {/* Contact Avatar and Info */}
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={`/api/avatar/${recommendation.contactId}`} />
                    <AvatarFallback>
                      {recommendation.contactName.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{recommendation.contactName}</h3>
                      {index === 0 && (
                        <Badge variant="default" className="text-xs">
                          Best Match
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                      <span className="flex items-center gap-1">
                        <BarChart3 className="h-3 w-3" />
                        {recommendation.score.confidence}% confidence
                      </span>
                      
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Available {recommendation.estimatedStartDate.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score */}
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getScoreColor(recommendation.score.totalScore)}`}>
                    {recommendation.score.totalScore}
                  </div>
                  <div className="text-xs text-gray-500">Overall Score</div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => handleAssignContact(recommendation.contactId, recommendation)}
                    variant={selectedRecommendation === recommendation.contactId ? "default" : "outline"}
                    size="sm"
                    disabled={recommendation.conflicts.some(c => c.severity === ConflictSeverity.BLOCKING)}
                  >
                    {selectedRecommendation === recommendation.contactId ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Assigned
                      </>
                    ) : (
                      'Assign'
                    )}
                  </Button>
                  
                  <Button
                    onClick={() => toggleDetails(recommendation.contactId)}
                    variant="ghost"
                    size="sm"
                  >
                    {showDetails[recommendation.contactId] ? 'Less' : 'Details'}
                  </Button>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="mt-4 grid grid-cols-5 gap-2">
                <div className="text-center">
                  <div className="text-sm font-medium">{recommendation.score.breakdown.skillMatch}</div>
                  <div className="text-xs text-gray-500">Skills</div>
                  <Progress 
                    value={recommendation.score.breakdown.skillMatch} 
                    className="h-1 mt-1"
                  />
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium">{recommendation.score.breakdown.availability}</div>
                  <div className="text-xs text-gray-500">Available</div>
                  <Progress 
                    value={recommendation.score.breakdown.availability} 
                    className="h-1 mt-1"
                  />
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium">{recommendation.score.breakdown.workload}</div>
                  <div className="text-xs text-gray-500">Workload</div>
                  <Progress 
                    value={recommendation.score.breakdown.workload} 
                    className="h-1 mt-1"
                  />
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium">{recommendation.score.breakdown.performance}</div>
                  <div className="text-xs text-gray-500">History</div>
                  <Progress 
                    value={recommendation.score.breakdown.performance} 
                    className="h-1 mt-1"
                  />
                </div>
                
                <div className="text-center">
                  <div className="text-sm font-medium">{recommendation.score.breakdown.preference}</div>
                  <div className="text-xs text-gray-500">Fit</div>
                  <Progress 
                    value={recommendation.score.breakdown.preference} 
                    className="h-1 mt-1"
                  />
                </div>
              </div>

              {/* Conflicts and Warnings */}
              {recommendation.conflicts.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Potential Issues</span>
                  </div>
                  
                  <div className="space-y-1">
                    {recommendation.conflicts.map((conflict, i) => (
                      <div 
                        key={i}
                        className="flex items-start gap-2 text-sm p-2 bg-orange-50 rounded"
                      >
                        <span className={`font-medium ${getConflictSeverityColor(conflict.severity)}`}>
                          {conflict.severity.toUpperCase()}:
                        </span>
                        <span className="flex-1">{conflict.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed View */}
              {showDetails[recommendation.contactId] && (
                <>
                  <Separator className="my-4" />
                  
                  {/* Skill Matches */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Skill Analysis</h4>
                    <div className="space-y-2">
                      {recommendation.score.skillMatches.map((match, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>{match.skillName}</span>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={match.matchScore >= 70 ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {match.matchScore}%
                            </Badge>
                            {match.isVerified && (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reasoning */}
                  {recommendation.reasoning.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                        <Lightbulb className="h-4 w-4" />
                        Why This Match?
                      </h4>
                      <ul className="text-sm space-y-1">
                        {recommendation.reasoning.map((reason, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-green-500 mt-1">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium mb-2">Timeline Estimate</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Start Date:</span>
                        <div className="font-medium">
                          {recommendation.estimatedStartDate.toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Completion:</span>
                        <div className="font-medium">
                          {recommendation.estimatedCompletionDate.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Alternatives */}
                  {recommendation.alternatives.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Alternative Options</h4>
                      <div className="space-y-1">
                        {recommendation.alternatives.map((alt, i) => (
                          <div key={i} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded">
                            <span>{alt.contactName}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{alt.score}% match</Badge>
                              {alt.estimatedDelay && (
                                <span className="text-xs text-orange-600">
                                  +{alt.estimatedDelay}h delay
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bulk Actions */}
      {showBulkActions && recommendations.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Bulk Actions</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Compare All
                </Button>
                <Button variant="outline" size="sm">
                  Assign Multiple
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default AssignmentRecommendations;