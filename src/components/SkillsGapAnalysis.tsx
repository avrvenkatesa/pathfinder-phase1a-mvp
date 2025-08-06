import React, { useState, useMemo, useCallback } from 'react';
import { Contact } from '../interfaces/contact';
import { 
  SkillRequirement, 
  ProficiencyLevel,
  ContactSkill,
  GapAnalysis
} from '../services/skillMatchCalculator';
import skillMatchCalculator from '../services/skillMatchCalculator';
import './SkillsGapAnalysis.css';

interface SkillsGapAnalysisProps {
  requirements: SkillRequirement[];
  contacts: Contact[];
  workflowTasks?: Array<{
    id: string;
    name: string;
    requirements: SkillRequirement[];
  }>;
  onRequirementChange?: (skillName: string, newLevel: ProficiencyLevel) => void;
  onSuggestTraining?: (contactId: number, skillName: string) => void;
  onRequestExternal?: (skillName: string, level: ProficiencyLevel) => void;
}

interface GapInfo {
  skill: string;
  requiredLevel: ProficiencyLevel;
  weight: number;
  isRequired: boolean;
  gapType: 'critical' | 'moderate' | 'scarce' | 'good';
  availableContacts: ContactMatch[];
  closestMatch?: ContactMatch;
  suggestions: ActionableSuggestion[];
  overallDemand: number; // Across all workflow tasks
}

interface ContactMatch {
  contact: Contact;
  skill: ContactSkill | null;
  gap: number; // Levels below requirement (0 = meets, 1 = one below, etc.)
}

interface ActionableSuggestion {
  type: 'lower_requirement' | 'split_task' | 'training' | 'external' | 'postpone';
  description: string;
  effort: 'low' | 'medium' | 'high';
  timeframe: string;
  action?: () => void;
}

interface SkillGapAlertProps {
  gapInfo: GapInfo;
  onActionClick: (suggestion: ActionableSuggestion) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

const SkillsGapAnalysis: React.FC<SkillsGapAnalysisProps> = ({
  requirements,
  contacts,
  workflowTasks = [],
  onRequirementChange,
  onSuggestTraining,
  onRequestExternal
}) => {
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [expandedGaps, setExpandedGaps] = useState<Set<string>>(new Set());
  const [selectedSeverity, setSelectedSeverity] = useState<string[]>(['critical', 'moderate']);

  // Calculate comprehensive gap analysis
  const gapAnalysis = useMemo(() => {
    return analyzeSkillGaps(requirements, contacts, workflowTasks);
  }, [requirements, contacts, workflowTasks]);

  // Filter gaps based on severity selection
  const filteredGaps = useMemo(() => {
    return gapAnalysis.filter(gap => selectedSeverity.includes(gap.gapType));
  }, [gapAnalysis, selectedSeverity]);

  const handleActionClick = useCallback((suggestion: ActionableSuggestion) => {
    if (suggestion.action) {
      suggestion.action();
    }
  }, []);

  const handleToggleExpanded = useCallback((skillName: string) => {
    setExpandedGaps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(skillName)) {
        newSet.delete(skillName);
      } else {
        newSet.add(skillName);
      }
      return newSet;
    });
  }, []);

  const exportReport = () => {
    const report = generateGapReport(gapAnalysis, workflowTasks);
    downloadReport(report);
  };

  if (!requirements.length) {
    return null;
  }

  const criticalGaps = gapAnalysis.filter(g => g.gapType === 'critical');
  const moderateGaps = gapAnalysis.filter(g => g.gapType === 'moderate');
  const scarceGaps = gapAnalysis.filter(g => g.gapType === 'scarce');

  return (
    <div className="skills-gap-analysis">
      {/* Quick Summary */}
      {(criticalGaps.length > 0 || moderateGaps.length > 0) && (
        <div className="gap-summary-alert">
          <div className="alert-header">
            <span className="alert-icon">⚠️</span>
            <h4>Skills Gap Analysis</h4>
            <div className="gap-counts">
              {criticalGaps.length > 0 && (
                <span className="gap-count critical">
                  🔴 {criticalGaps.length} Critical
                </span>
              )}
              {moderateGaps.length > 0 && (
                <span className="gap-count moderate">
                  🟡 {moderateGaps.length} Moderate
                </span>
              )}
              {scarceGaps.length > 0 && (
                <span className="gap-count scarce">
                  🟠 {scarceGaps.length} Scarce
                </span>
              )}
            </div>
          </div>
          
          {/* Quick Preview of Critical Gaps */}
          <div className="critical-gaps-preview">
            {criticalGaps.slice(0, 2).map((gap) => (
              <div key={gap.skill} className="gap-preview-item">
                <span className="skill-name">"{gap.skill}"</span>
                <span className="level">({levelToString(gap.requiredLevel)})</span>
                <span className="issue">: No contacts available</span>
                {gap.closestMatch && (
                  <div className="suggestion">
                    → {gap.closestMatch.contact.name} has {levelToString(gap.closestMatch.skill?.level || ProficiencyLevel.BEGINNER)} level
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="summary-actions">
            <button 
              className="view-full-btn"
              onClick={() => setShowFullAnalysis(!showFullAnalysis)}
            >
              {showFullAnalysis ? 'Hide' : 'View Full Analysis'}
            </button>
            <button 
              className="export-btn"
              onClick={exportReport}
            >
              Export Report
            </button>
          </div>
        </div>
      )}

      {/* Full Analysis View */}
      {showFullAnalysis && (
        <div className="full-analysis-panel">
          <div className="analysis-header">
            <h4>Detailed Gap Analysis</h4>
            <div className="severity-filter">
              <span>Show:</span>
              {[
                { key: 'critical', label: '🔴 Critical', count: criticalGaps.length },
                { key: 'moderate', label: '🟡 Moderate', count: moderateGaps.length },
                { key: 'scarce', label: '🟠 Scarce', count: scarceGaps.length },
                { key: 'good', label: '🟢 Good', count: gapAnalysis.filter(g => g.gapType === 'good').length }
              ].map(({ key, label, count }) => (
                <label key={key} className="severity-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedSeverity.includes(key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSeverity(prev => [...prev, key]);
                      } else {
                        setSelectedSeverity(prev => prev.filter(s => s !== key));
                      }
                    }}
                  />
                  <span>{label} ({count})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="gaps-list">
            {filteredGaps.map((gap) => (
              <SkillGapAlert
                key={gap.skill}
                gapInfo={gap}
                onActionClick={handleActionClick}
                isExpanded={expandedGaps.has(gap.skill)}
                onToggleExpanded={() => handleToggleExpanded(gap.skill)}
              />
            ))}
          </div>

          {workflowTasks.length > 1 && (
            <WorkflowGapsOverview 
              tasks={workflowTasks}
              gapAnalysis={gapAnalysis}
            />
          )}
        </div>
      )}
    </div>
  );
};

const SkillGapAlert: React.FC<SkillGapAlertProps> = ({
  gapInfo,
  onActionClick,
  isExpanded,
  onToggleExpanded
}) => {
  const getAlertClass = (type: string) => {
    return `gap-alert ${type}`;
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical': return '🔴';
      case 'moderate': return '🟡';
      case 'scarce': return '🟠';
      case 'good': return '🟢';
      default: return '❓';
    }
  };

  return (
    <div className={getAlertClass(gapInfo.gapType)}>
      <div className="alert-main" onClick={onToggleExpanded}>
        <div className="alert-content">
          <span className="alert-type-icon">{getAlertIcon(gapInfo.gapType)}</span>
          <div className="gap-info">
            <span className="skill-name">"{gapInfo.skill}"</span>
            <span className="required-level">({levelToString(gapInfo.requiredLevel)})</span>
            {gapInfo.isRequired && <span className="required-badge">Required</span>}
            {gapInfo.weight > 70 && <span className="high-weight">High Priority</span>}
          </div>
          <div className="gap-description">
            {getGapDescription(gapInfo)}
          </div>
        </div>
        <button className="expand-toggle">
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <div className="alert-details">
          {/* Available Contacts */}
          {gapInfo.availableContacts.length > 0 && (
            <div className="available-contacts">
              <h5>Available Contacts:</h5>
              <div className="contacts-grid">
                {gapInfo.availableContacts.map((match) => (
                  <div key={match.contact.id} className="contact-match">
                    <span className="contact-name">{match.contact.name}</span>
                    <span className={`skill-level ${match.gap === 0 ? 'meets' : 'below'}`}>
                      {match.skill ? levelToString(match.skill.level) : 'None'}
                      {match.gap > 0 && ` (-${match.gap} levels)`}
                    </span>
                    {match.contact.availability && (
                      <span className={`availability ${match.contact.availability}`}>
                        {match.contact.availability}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actionable Suggestions */}
          <div className="suggestions-section">
            <h5>Suggested Actions:</h5>
            <div className="suggestions-grid">
              {gapInfo.suggestions.map((suggestion, idx) => (
                <div key={idx} className={`suggestion-card ${suggestion.effort}`}>
                  <div className="suggestion-header">
                    <span className="suggestion-type">{getSuggestionIcon(suggestion.type)}</span>
                    <span className="suggestion-effort">{suggestion.effort} effort</span>
                    <span className="suggestion-time">{suggestion.timeframe}</span>
                  </div>
                  <p className="suggestion-description">{suggestion.description}</p>
                  {suggestion.action && (
                    <button 
                      className="suggestion-action"
                      onClick={() => onActionClick(suggestion)}
                    >
                      Take Action
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Workflow Demand */}
          {gapInfo.overallDemand > 1 && (
            <div className="demand-info">
              <span className="demand-label">High Demand:</span>
              <span className="demand-count">
                This skill is needed in {gapInfo.overallDemand} workflow tasks
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const WorkflowGapsOverview: React.FC<{
  tasks: Array<{ id: string; name: string; requirements: SkillRequirement[] }>;
  gapAnalysis: GapInfo[];
}> = ({ tasks, gapAnalysis }) => {
  const skillDemandMap = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach(task => {
      task.requirements.forEach(req => {
        map.set(req.skillName, (map.get(req.skillName) || 0) + 1);
      });
    });
    return map;
  }, [tasks]);

  const highDemandSkills = Array.from(skillDemandMap.entries())
    .filter(([_, count]) => count > 1)
    .sort(([, a], [, b]) => b - a);

  return (
    <div className="workflow-overview">
      <h4>Workflow Skills Overview</h4>
      
      <div className="demand-chart">
        <h5>High-Demand Skills Across Tasks:</h5>
        <div className="demand-bars">
          {highDemandSkills.slice(0, 8).map(([skill, count]) => {
            const gap = gapAnalysis.find(g => g.skill === skill);
            return (
              <div key={skill} className="demand-bar">
                <span className="skill-label">{skill}</span>
                <div className="bar-container">
                  <div 
                    className={`bar ${gap?.gapType || 'good'}`}
                    style={{ width: `${(count / Math.max(...highDemandSkills.map(([, c]) => c))) * 100}%` }}
                  />
                  <span className="count">{count} tasks</span>
                </div>
                {gap && gap.gapType !== 'good' && (
                  <span className="gap-indicator">{getGapTypeIcon(gap.gapType)}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="workflow-recommendations">
        <h5>Workflow Recommendations:</h5>
        <ul>
          {getWorkflowRecommendations(gapAnalysis, skillDemandMap).map((rec, idx) => (
            <li key={idx}>{rec}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// Helper Functions
function analyzeSkillGaps(
  requirements: SkillRequirement[],
  contacts: Contact[],
  workflowTasks: Array<{ id: string; name: string; requirements: SkillRequirement[] }>
): GapInfo[] {
  const gaps: GapInfo[] = [];
  
  // Calculate demand across workflow
  const skillDemandMap = new Map<string, number>();
  [{ id: 'current', name: 'current', requirements }, ...workflowTasks].forEach(task => {
    task.requirements.forEach(req => {
      skillDemandMap.set(req.skillName, (skillDemandMap.get(req.skillName) || 0) + 1);
    });
  });

  for (const req of requirements) {
    const contactSkills = extractAllContactSkills(contacts);
    const gapInfo = analyzeSkillRequirement(req, contactSkills, skillDemandMap.get(req.skillName) || 1);
    gaps.push(gapInfo);
  }

  return gaps.sort((a, b) => {
    const severityOrder = { critical: 0, moderate: 1, scarce: 2, good: 3 };
    const aSeverity = severityOrder[a.gapType];
    const bSeverity = severityOrder[b.gapType];
    
    if (aSeverity !== bSeverity) {
      return aSeverity - bSeverity;
    }
    
    return b.weight - a.weight;
  });
}

function analyzeSkillRequirement(
  requirement: SkillRequirement,
  allContactSkills: Map<Contact, ContactSkill[]>,
  overallDemand: number
): GapInfo {
  const matches: ContactMatch[] = [];
  let closestMatch: ContactMatch | undefined;
  let minGap = Infinity;

  for (const [contact, skills] of allContactSkills) {
    const matchingSkill = findMatchingSkill(requirement.skillName, skills);
    
    if (matchingSkill && matchingSkill.level >= requirement.requiredLevel) {
      matches.push({
        contact,
        skill: matchingSkill,
        gap: 0
      });
    } else {
      const gap = matchingSkill 
        ? Math.max(0, requirement.requiredLevel - matchingSkill.level)
        : requirement.requiredLevel;
      
      if (gap < minGap) {
        minGap = gap;
        closestMatch = {
          contact,
          skill: matchingSkill,
          gap
        };
      }

      if (matchingSkill) {
        matches.push({
          contact,
          skill: matchingSkill,
          gap
        });
      }
    }
  }

  // Determine gap type
  let gapType: GapInfo['gapType'];
  const qualifiedCount = matches.filter(m => m.gap === 0).length;
  
  if (qualifiedCount === 0 && requirement.isRequired && requirement.weight >= 80) {
    gapType = 'critical';
  } else if (qualifiedCount === 0 || (qualifiedCount <= 1 && requirement.weight >= 60)) {
    gapType = 'moderate';
  } else if (qualifiedCount <= 2) {
    gapType = 'scarce';
  } else {
    gapType = 'good';
  }

  // Generate suggestions
  const suggestions = generateActionableSuggestions(
    requirement,
    matches,
    closestMatch,
    gapType
  );

  return {
    skill: requirement.skillName,
    requiredLevel: requirement.requiredLevel,
    weight: requirement.weight,
    isRequired: requirement.isRequired,
    gapType,
    availableContacts: matches.slice(0, 5), // Limit for UI
    closestMatch,
    suggestions,
    overallDemand
  };
}

function findMatchingSkill(skillName: string, skills: ContactSkill[]): ContactSkill | null {
  const normalized = skillName.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  for (const skill of skills) {
    const skillNormalized = skill.skillName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (skillNormalized === normalized) {
      return skill;
    }
  }

  // Check for related skills using taxonomy
  const taxonomy = skillMatchCalculator.getSkillTaxonomy(skillName);
  if (taxonomy) {
    for (const altName of taxonomy.alternativeNames) {
      const altNormalized = altName.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const skill of skills) {
        const skillNormalized = skill.skillName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (skillNormalized === altNormalized) {
          return skill;
        }
      }
    }
  }

  return null;
}

function extractAllContactSkills(contacts: Contact[]): Map<Contact, ContactSkill[]> {
  const map = new Map<Contact, ContactSkill[]>();
  
  contacts.forEach(contact => {
    const skills = contact.skills?.map(skill => ({
      skillName: skill.name,
      level: skill.level || ProficiencyLevel.INTERMEDIATE,
      yearsOfExperience: skill.years,
      lastUsed: skill.lastUsed ? new Date(skill.lastUsed) : undefined,
      certified: skill.certified || false
    })) || [];
    
    map.set(contact, skills);
  });

  return map;
}

function generateActionableSuggestions(
  requirement: SkillRequirement,
  matches: ContactMatch[],
  closestMatch: ContactMatch | undefined,
  gapType: GapInfo['gapType']
): ActionableSuggestion[] {
  const suggestions: ActionableSuggestion[] = [];

  // Lower requirement suggestion
  if (requirement.requiredLevel > ProficiencyLevel.BEGINNER && closestMatch) {
    suggestions.push({
      type: 'lower_requirement',
      description: `Lower requirement to ${levelToString(closestMatch.skill?.level || ProficiencyLevel.BEGINNER)} level${closestMatch.contact ? ` (${closestMatch.contact.name} available)` : ''}`,
      effort: 'low',
      timeframe: 'Immediate',
      action: () => {
        // Would trigger callback to parent component
      }
    });
  }

  // Training suggestion
  if (closestMatch && closestMatch.gap <= 2) {
    suggestions.push({
      type: 'training',
      description: `Provide training to ${closestMatch.contact.name} (${closestMatch.gap === 1 ? '1 level' : `${closestMatch.gap} levels`} to go)`,
      effort: closestMatch.gap === 1 ? 'medium' : 'high',
      timeframe: closestMatch.gap === 1 ? '1-2 weeks' : '1-2 months',
      action: () => {
        // Would trigger training suggestion
      }
    });
  }

  // Split task suggestion
  if (matches.length >= 2) {
    suggestions.push({
      type: 'split_task',
      description: `Split task between ${matches.slice(0, 2).map(m => m.contact.name).join(' and ')}`,
      effort: 'medium',
      timeframe: '1 week planning',
      action: () => {
        // Would trigger task splitting UI
      }
    });
  }

  // External hiring
  if (gapType === 'critical' || (gapType === 'moderate' && requirement.isRequired)) {
    suggestions.push({
      type: 'external',
      description: `Hire contractor/freelancer with ${levelToString(requirement.requiredLevel)} ${requirement.skillName} skills`,
      effort: 'high',
      timeframe: '1-4 weeks',
      action: () => {
        // Would trigger external hiring flow
      }
    });
  }

  // Postpone task
  if (!requirement.isRequired || requirement.weight < 50) {
    suggestions.push({
      type: 'postpone',
      description: 'Postpone task until skills are available or requirements change',
      effort: 'low',
      timeframe: 'Flexible',
      action: () => {
        // Would trigger postpone workflow
      }
    });
  }

  return suggestions;
}

function getGapDescription(gapInfo: GapInfo): string {
  const qualifiedCount = gapInfo.availableContacts.filter(c => c.gap === 0).length;
  
  switch (gapInfo.gapType) {
    case 'critical':
      return 'No contacts available';
    case 'moderate':
      if (qualifiedCount === 0) {
        return `No qualified contacts (${gapInfo.closestMatch ? 'closest match: ' + gapInfo.closestMatch.contact.name : 'none close'})`;
      } else {
        return `Limited qualified contacts (${qualifiedCount})`;
      }
    case 'scarce':
      return `Only ${qualifiedCount} qualified contact${qualifiedCount === 1 ? '' : 's'}`;
    case 'good':
      return `${qualifiedCount} qualified contacts available`;
    default:
      return 'Unknown gap status';
  }
}

function getSuggestionIcon(type: string): string {
  switch (type) {
    case 'lower_requirement': return '📉';
    case 'split_task': return '✂️';
    case 'training': return '📚';
    case 'external': return '🔗';
    case 'postpone': return '⏰';
    default: return '💡';
  }
}

function getGapTypeIcon(type: string): string {
  switch (type) {
    case 'critical': return '🔴';
    case 'moderate': return '🟡';
    case 'scarce': return '🟠';
    case 'good': return '🟢';
    default: return '❓';
  }
}

function levelToString(level: ProficiencyLevel): string {
  switch (level) {
    case ProficiencyLevel.BEGINNER: return 'beginner';
    case ProficiencyLevel.INTERMEDIATE: return 'intermediate';
    case ProficiencyLevel.ADVANCED: return 'advanced';
    case ProficiencyLevel.EXPERT: return 'expert';
    default: return 'unknown';
  }
}

function getWorkflowRecommendations(
  gapAnalysis: GapInfo[],
  skillDemandMap: Map<string, number>
): string[] {
  const recommendations: string[] = [];
  
  const criticalSkills = gapAnalysis
    .filter(g => g.gapType === 'critical')
    .map(g => g.skill);
  
  const highDemandCritical = criticalSkills
    .filter(skill => (skillDemandMap.get(skill) || 0) > 1);

  if (highDemandCritical.length > 0) {
    recommendations.push(
      `Priority hiring needed for: ${highDemandCritical.join(', ')} (critical skills needed across multiple tasks)`
    );
  }

  const scarceHighDemand = gapAnalysis
    .filter(g => g.gapType === 'scarce' && g.overallDemand > 2)
    .map(g => g.skill);

  if (scarceHighDemand.length > 0) {
    recommendations.push(
      `Cross-train additional team members in: ${scarceHighDemand.join(', ')} (high demand, limited availability)`
    );
  }

  const postponableTasks = gapAnalysis
    .filter(g => g.gapType === 'critical' && !g.isRequired)
    .length;

  if (postponableTasks > 0) {
    recommendations.push(
      `Consider postponing ${postponableTasks} task${postponableTasks === 1 ? '' : 's'} with non-critical skill gaps`
    );
  }

  return recommendations;
}

function generateGapReport(gapAnalysis: GapInfo[], workflowTasks: any[]): string {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_skills: gapAnalysis.length,
      critical_gaps: gapAnalysis.filter(g => g.gapType === 'critical').length,
      moderate_gaps: gapAnalysis.filter(g => g.gapType === 'moderate').length,
      scarce_skills: gapAnalysis.filter(g => g.gapType === 'scarce').length
    },
    gaps: gapAnalysis.map(gap => ({
      skill: gap.skill,
      required_level: levelToString(gap.requiredLevel),
      gap_type: gap.gapType,
      available_contacts: gap.availableContacts.length,
      suggestions: gap.suggestions.map(s => s.description)
    })),
    workflow_analysis: workflowTasks.length > 0 ? {
      total_tasks: workflowTasks.length,
      high_demand_skills: []
    } : null
  };
  
  return JSON.stringify(report, null, 2);
}

function downloadReport(report: string) {
  const blob = new Blob([report], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `skills-gap-analysis-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default SkillsGapAnalysis;