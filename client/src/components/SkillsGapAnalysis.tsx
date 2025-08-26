import React, { useState, useMemo } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, X, Zap, BarChart3, ChevronDown, ChevronRight, ExternalLink, Users, Clock, TrendingUp } from 'lucide-react';

interface Skill {
  name: string;
  level: string;
  weight: number;
}

interface AnalysisContact {
  id: string | number;
  name: string;
  title?: string;
  department?: string;
  skills: Array<{ name: string; level: string }>;
  availability?: string;
  currentWorkload?: number;
}

interface SkillGap {
  skill: string;
  requiredLevel: string;
  weight: number;
  severity: 'critical' | 'moderate' | 'minor';
  type: 'NO_MATCH' | 'INSUFFICIENT_LEVEL' | 'SCARCE' | 'OVERSUBSCRIBED';
  availableCount: number;
  closestMatches: Array<{ name: string; level: string; distance: number }>;
  suggestions: Array<{
    type: 'lower_requirement' | 'split_task' | 'training' | 'external_hire' | 'postpone';
    description: string;
    impact: string;
    effort: 'low' | 'medium' | 'high';
    timeEstimate?: string;
  }>;
  coveragePercentage: number;
}

interface SkillsGapAnalysisProps {
  requiredSkills: Skill[];
  availableContacts: AnalysisContact[];
  onSuggestionClick?: (suggestion: any, skill: string) => void;
  onUpdateRequirement?: (skillName: string, newLevel: string) => void;
}

const SkillsGapAnalysis: React.FC<SkillsGapAnalysisProps> = ({
  requiredSkills,
  availableContacts,
  onSuggestionClick,
  onUpdateRequirement
}) => {
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());
  const [showExportModal, setShowExportModal] = useState(false);

  // Skill level hierarchy for comparison
  const skillLevels = {
    'beginner': 1,
    'intermediate': 2,
    'advanced': 3,
    'expert': 4
  };

  const meetsLevel = (contactLevel: string, requiredLevel: string): boolean => {
    return (skillLevels[contactLevel.toLowerCase() as keyof typeof skillLevels] || 0) >= 
           (skillLevels[requiredLevel.toLowerCase() as keyof typeof skillLevels] || 0);
  };

  const getLevelDistance = (contactLevel: string, requiredLevel: string): number => {
    return Math.abs(
      (skillLevels[contactLevel.toLowerCase() as keyof typeof skillLevels] || 0) - 
      (skillLevels[requiredLevel.toLowerCase() as keyof typeof skillLevels] || 0)
    );
  };

  const generateSuggestions = (requirement: Skill, contacts: AnalysisContact[]): SkillGap['suggestions'] => {
    const suggestions: SkillGap['suggestions'] = [];
    
    // Find closest matches
    const partialMatches = contacts
      .map(contact => {
        const skill = contact.skills.find(s => 
          s.name.toLowerCase() === requirement.name.toLowerCase()
        );
        return skill ? { contact, skill, distance: getLevelDistance(skill.level, requirement.level) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a!.distance - b!.distance);

    if (partialMatches.length > 0) {
      suggestions.push({
        type: 'lower_requirement',
        description: `Lower requirement from ${requirement.level} to ${partialMatches[0]!.skill.level}`,
        impact: requirement.weight >= 8 ? 'High impact on quality' : 'Moderate impact',
        effort: 'low'
      });

      suggestions.push({
        type: 'training',
        description: `Train ${partialMatches[0]!.contact.name} from ${partialMatches[0]!.skill.level} to ${requirement.level}`,
        impact: 'Maintains quality standards',
        effort: partialMatches[0]!.distance <= 1 ? 'low' : 'medium',
        timeEstimate: partialMatches[0]!.distance <= 1 ? '1-2 weeks' : '4-6 weeks'
      });
    }

    if (requirement.weight >= 6) {
      suggestions.push({
        type: 'external_hire',
        description: `Hire contractor/freelancer with ${requirement.level} ${requirement.name} skills`,
        impact: 'Immediate solution, higher cost',
        effort: 'medium',
        timeEstimate: '1-3 weeks'
      });
    }

    suggestions.push({
      type: 'split_task',
      description: `Split task among multiple team members with lower skill levels`,
      impact: 'Requires coordination, may take longer',
      effort: 'medium'
    });

    if (requirement.weight < 8) {
      suggestions.push({
        type: 'postpone',
        description: `Postpone until qualified resources become available`,
        impact: 'Delays timeline',
        effort: 'low'
      });
    }

    return suggestions;
  };

  const analyzeSkillGaps = useMemo((): SkillGap[] => {
    if (!requiredSkills?.length || !availableContacts?.length) return [];

    return requiredSkills.map(requirement => {
      // Find all contacts with this skill at required level or higher
      const qualifiedContacts = availableContacts.filter(contact => {
        const skill = contact.skills.find(s => 
          s.name.toLowerCase() === requirement.name.toLowerCase()
        );
        return skill && meetsLevel(skill.level, requirement.level);
      });

      // Find contacts with skill but lower level
      const partialMatches = availableContacts
        .map(contact => {
          const skill = contact.skills.find(s => 
            s.name.toLowerCase() === requirement.name.toLowerCase()
          );
          if (!skill || meetsLevel(skill.level, requirement.level)) return null;
          return {
            name: contact.name,
            level: skill.level,
            distance: getLevelDistance(skill.level, requirement.level)
          };
        })
        .filter(Boolean)
        .sort((a, b) => a!.distance - b!.distance)
        .slice(0, 3);

      // Determine gap type and severity
      let type: SkillGap['type'] = 'NO_MATCH';
      let severity: SkillGap['severity'] = 'minor';

      if (qualifiedContacts.length === 0) {
        type = partialMatches.length > 0 ? 'INSUFFICIENT_LEVEL' : 'NO_MATCH';
        severity = requirement.weight >= 8 ? 'critical' : requirement.weight >= 5 ? 'moderate' : 'minor';
      } else if (qualifiedContacts.length === 1) {
        type = 'SCARCE';
        severity = requirement.weight >= 7 ? 'moderate' : 'minor';
      } else if (qualifiedContacts.length >= 3) {
        // Good coverage
        severity = 'minor';
      }

      const coveragePercentage = qualifiedContacts.length === 0 ? 0 : 
        Math.min(100, (qualifiedContacts.length / Math.max(1, Math.ceil(requirement.weight / 3))) * 100);

      return {
        skill: requirement.name,
        requiredLevel: requirement.level,
        weight: requirement.weight,
        severity,
        type,
        availableCount: qualifiedContacts.length,
        closestMatches: partialMatches as Array<{ name: string; level: string; distance: number }>,
        suggestions: generateSuggestions(requirement, availableContacts),
        coveragePercentage
      };
    });
  }, [requiredSkills, availableContacts]);

  const toggleExpanded = (skill: string) => {
    setExpandedGaps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(skill)) {
        newSet.delete(skill);
      } else {
        newSet.add(skill);
      }
      return newSet;
    });
  };

  const getSeverityIcon = (severity: SkillGap['severity']) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'moderate': return <Zap className="h-4 w-4 text-yellow-600" />;
      default: return <BarChart3 className="h-4 w-4 text-green-600" />;
    }
  };

  const getSeverityColor = (severity: SkillGap['severity']) => {
    switch (severity) {
      case 'critical': return 'border-red-200 bg-red-50';
      case 'moderate': return 'border-yellow-200 bg-yellow-50';
      default: return 'border-green-200 bg-green-50';
    }
  };

  const getEffortBadgeColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const criticalGaps = analyzeSkillGaps.filter(gap => gap.severity === 'critical');
  const moderateGaps = analyzeSkillGaps.filter(gap => gap.severity === 'moderate');
  const hasGaps = criticalGaps.length > 0 || moderateGaps.length > 0;

  if (!hasGaps) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <BarChart3 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-800">
          <strong>Excellent skill coverage!</strong> All required skills have adequate team coverage.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Alert */}
      <Alert className={`${criticalGaps.length > 0 ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'}`}>
        {criticalGaps.length > 0 ? (
          <AlertTriangle className="h-4 w-4 text-red-600" />
        ) : (
          <Zap className="h-4 w-4 text-yellow-600" />
        )}
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <strong>Skills Gap Analysis:</strong> {criticalGaps.length} critical gaps, {moderateGaps.length} moderate gaps detected
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportModal(true)}
              className="ml-4"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Export Report
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      {/* Critical Gaps */}
      {criticalGaps.map(gap => (
        <Card key={gap.skill} className={`border-2 ${getSeverityColor(gap.severity)}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getSeverityIcon(gap.severity)}
                <CardTitle className="text-sm font-semibold text-red-800">
                  Critical Gap: "{gap.skill}" ({gap.requiredLevel})
                </CardTitle>
                <Badge variant="destructive" className="text-xs">
                  Weight: {gap.weight}
                </Badge>
              </div>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(gap.skill)}
                    className="p-1"
                  >
                    {expandedGaps.has(gap.skill) ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>
            <div className="text-sm text-red-700">
              {gap.type === 'NO_MATCH' && 'No contacts have this skill'}
              {gap.type === 'INSUFFICIENT_LEVEL' && `Available skill levels too low (need ${gap.requiredLevel})`}
              {gap.type === 'SCARCE' && 'Only one qualified contact available - risk of bottleneck'}
            </div>
            <div className="mt-2">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span>Coverage:</span>
                <Progress value={gap.coveragePercentage} className="flex-1 h-2" />
                <span>{gap.coveragePercentage}%</span>
              </div>
            </div>
          </CardHeader>
          
          <Collapsible open={expandedGaps.has(gap.skill)}>
            <CollapsibleContent>
              <CardContent className="pt-0">
                {gap.closestMatches.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Closest Matches:</h4>
                    <div className="space-y-1">
                      {gap.closestMatches.map((match, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Users className="h-3 w-3 text-gray-400" />
                          <span>{match.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {match.level}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            ({match.distance} level{match.distance !== 1 ? 's' : ''} below required)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recommended Actions:</h4>
                  <div className="space-y-2">
                    {gap.suggestions.slice(0, 3).map((suggestion, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-white rounded border">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{suggestion.description}</span>
                            <Badge className={`text-xs ${getEffortBadgeColor(suggestion.effort)}`}>
                              {suggestion.effort} effort
                            </Badge>
                            {suggestion.timeEstimate && (
                              <Badge variant="outline" className="text-xs">
                                <Clock className="h-3 w-3 mr-1" />
                                {suggestion.timeEstimate}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">{suggestion.impact}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onSuggestionClick?.(suggestion, gap.skill)}
                          className="text-xs"
                        >
                          Apply
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}

      {/* Moderate Gaps */}
      {moderateGaps.map(gap => (
        <Card key={gap.skill} className={`${getSeverityColor(gap.severity)}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getSeverityIcon(gap.severity)}
                <CardTitle className="text-sm font-semibold text-yellow-800">
                  Warning: "{gap.skill}" ({gap.requiredLevel})
                </CardTitle>
                <Badge variant="outline" className="text-xs">
                  Weight: {gap.weight}
                </Badge>
              </div>
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(gap.skill)}
                    className="p-1"
                  >
                    {expandedGaps.has(gap.skill) ? 
                      <ChevronDown className="h-4 w-4" /> : 
                      <ChevronRight className="h-4 w-4" />
                    }
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>
            <div className="text-sm text-yellow-700">
              {gap.type === 'SCARCE' && `Only ${gap.availableCount} qualified contact(s) - potential bottleneck`}
              {gap.type === 'INSUFFICIENT_LEVEL' && 'Some contacts available but at lower proficiency'}
            </div>
            <div className="mt-2">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span>Coverage:</span>
                <Progress value={gap.coveragePercentage} className="flex-1 h-2" />
                <span>{gap.coveragePercentage}%</span>
              </div>
            </div>
          </CardHeader>
          
          <Collapsible open={expandedGaps.has(gap.skill)}>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {gap.suggestions.slice(0, 2).map((suggestion, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 bg-white rounded border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm">{suggestion.description}</span>
                          <Badge className={`text-xs ${getEffortBadgeColor(suggestion.effort)}`}>
                            {suggestion.effort}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600">{suggestion.impact}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSuggestionClick?.(suggestion, gap.skill)}
                        className="text-xs"
                      >
                        Apply
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      ))}
    </div>
  );
};

export default SkillsGapAnalysis;