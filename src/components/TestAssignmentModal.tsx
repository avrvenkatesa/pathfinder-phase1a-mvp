import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Contact } from '../interfaces/contact';
import { SkillRequirement } from '../services/skillMatchCalculator';
import skillMatchCalculator from '../services/skillMatchCalculator';
import './TestAssignmentModal.css';

interface Task {
  id: string;
  name: string;
  requirements: SkillRequirement[];
  estimatedHours: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
  description?: string;
}

interface TestAssignmentModalProps {
  isOpen: boolean;
  task: Task;
  contact: Contact;
  alternativeContacts?: Contact[];
  onConfirm: (assignment: TestAssignment) => void;
  onCancel: () => void;
  onSaveDraft?: (scenario: AssignmentScenario) => void;
}

interface TestAssignment {
  taskId: string;
  contactId: number;
  estimatedHours: number;
  startDate: Date;
  endDate: Date;
  confidence: number;
  risks: string[];
  benefits: string[];
}

interface AssignmentScenario {
  id: string;
  name: string;
  contact: Contact;
  simulation: SimulationResult;
  createdAt: Date;
  notes?: string;
}

interface SimulationResult {
  skillMatch: number;
  workloadImpact: {
    currentHours: number;
    addingHours: number;
    totalHours: number;
    capacity: number;
    utilizationPercent: number;
  };
  timelineImpact: {
    estimatedCompletion: Date;
    conflicts: Conflict[];
    dependencies: string[];
  };
  teamImpact: {
    balanceScore: number;
    knowledgeGaps: string[];
    backupOptions: Contact[];
  };
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: RiskFactor[];
    mitigation: string[];
  };
  costImpact?: {
    hourlyRate: number;
    totalCost: number;
    budgetImpact: number;
  };
}

interface Conflict {
  type: 'workload' | 'timeline' | 'skills' | 'availability';
  severity: 'low' | 'medium' | 'high';
  description: string;
  startDate: Date;
  endDate: Date;
  resolution?: string;
}

interface RiskFactor {
  category: 'skills' | 'workload' | 'timeline' | 'team';
  description: string;
  probability: number; // 0-100
  impact: number; // 0-100
  score: number; // probability * impact
}

interface TimelineEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  type: 'current' | 'proposed' | 'conflict' | 'dependency';
  contactId: number;
  color: string;
}

const TestAssignmentModal: React.FC<TestAssignmentModalProps> = ({
  isOpen,
  task,
  contact,
  alternativeContacts = [],
  onConfirm,
  onCancel,
  onSaveDraft
}) => {
  const [currentTab, setCurrentTab] = useState<'simulation' | 'comparison' | 'timeline' | 'summary'>('simulation');
  const [scenarios, setScenarios] = useState<AssignmentScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<AssignmentScenario[]>([]);
  const [redoStack, setRedoStack] = useState<AssignmentScenario[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [notes, setNotes] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);

  // Generate initial simulation
  const primarySimulation = useMemo(() => {
    return generateSimulation(task, contact);
  }, [task, contact]);

  // Generate alternative scenarios
  const alternativeScenarios = useMemo(() => {
    return alternativeContacts.map(altContact => ({
      id: `scenario-${altContact.id}`,
      name: altContact.name,
      contact: altContact,
      simulation: generateSimulation(task, altContact),
      createdAt: new Date(),
      notes: ''
    }));
  }, [task, alternativeContacts]);

  // Initialize scenarios on open
  useEffect(() => {
    if (isOpen) {
      const primaryScenario: AssignmentScenario = {
        id: `primary-${contact.id}`,
        name: `${contact.name} (Primary)`,
        contact,
        simulation: primarySimulation,
        createdAt: new Date(),
        notes: ''
      };

      setScenarios([primaryScenario, ...alternativeScenarios]);
      setSelectedScenario(primaryScenario.id);
      setCurrentTab('simulation');
      setShowConfirmation(false);
      setNotes('');
    }
  }, [isOpen, contact, primarySimulation, alternativeScenarios]);

  const handleTabChange = (tab: typeof currentTab) => {
    setCurrentTab(tab);
  };

  const handleScenarioSelect = (scenarioId: string) => {
    const currentScenario = scenarios.find(s => s.id === selectedScenario);
    if (currentScenario) {
      setUndoStack(prev => [...prev, currentScenario]);
      setRedoStack([]);
    }
    setSelectedScenario(scenarioId);
  };

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const prevScenario = undoStack[undoStack.length - 1];
      const currentScenario = scenarios.find(s => s.id === selectedScenario);
      
      if (currentScenario) {
        setRedoStack(prev => [...prev, currentScenario]);
      }
      
      setUndoStack(prev => prev.slice(0, -1));
      setSelectedScenario(prevScenario.id);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const nextScenario = redoStack[redoStack.length - 1];
      const currentScenario = scenarios.find(s => s.id === selectedScenario);
      
      if (currentScenario) {
        setUndoStack(prev => [...prev, currentScenario]);
      }
      
      setRedoStack(prev => prev.slice(0, -1));
      setSelectedScenario(nextScenario.id);
    }
  };

  const handleSaveScenario = () => {
    const scenario = scenarios.find(s => s.id === selectedScenario);
    if (scenario && onSaveDraft) {
      onSaveDraft({ ...scenario, notes });
    }
  };

  const handleConfirmAssignment = () => {
    const scenario = scenarios.find(s => s.id === selectedScenario);
    if (scenario) {
      const assignment: TestAssignment = {
        taskId: task.id,
        contactId: scenario.contact.id,
        estimatedHours: task.estimatedHours,
        startDate: new Date(),
        endDate: scenario.simulation.timelineImpact.estimatedCompletion,
        confidence: scenario.simulation.skillMatch,
        risks: scenario.simulation.riskAssessment.factors.map(f => f.description),
        benefits: []
      };
      
      onConfirm(assignment);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const currentScenario = scenarios.find(s => s.id === selectedScenario);

  if (!isOpen) return null;

  return (
    <div className="test-assignment-overlay" onClick={handleOverlayClick}>
      <div className="test-assignment-modal" ref={modalRef}>
        <div className="modal-header">
          <div className="header-info">
            <h2>Test Assignment</h2>
            <div className="task-info">
              <span className="task-name">{task.name}</span>
              <span className="task-hours">{task.estimatedHours}h</span>
              <span className={`task-priority ${task.priority}`}>{task.priority}</span>
            </div>
          </div>
          
          <div className="header-controls">
            <button 
              className="undo-btn" 
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              title="Undo"
            >
              ↶
            </button>
            <button 
              className="redo-btn" 
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              title="Redo"
            >
              ↷
            </button>
            <button className="close-btn" onClick={onCancel}>✗</button>
          </div>
        </div>

        <div className="modal-nav">
          <div className="nav-tabs">
            {[
              { key: 'simulation', label: '📊 Simulation', count: null },
              { key: 'comparison', label: '⚖️ Compare', count: scenarios.length },
              { key: 'timeline', label: '📅 Timeline', count: null },
              { key: 'summary', label: '📋 Summary', count: null }
            ].map(tab => (
              <button
                key={tab.key}
                className={`nav-tab ${currentTab === tab.key ? 'active' : ''}`}
                onClick={() => handleTabChange(tab.key as typeof currentTab)}
              >
                {tab.label}
                {tab.count && <span className="tab-count">{tab.count}</span>}
              </button>
            ))}
          </div>

          <div className="scenario-selector">
            <select 
              value={selectedScenario || ''} 
              onChange={(e) => handleScenarioSelect(e.target.value)}
              className="scenario-select"
            >
              {scenarios.map(scenario => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="modal-content">
          {currentTab === 'simulation' && currentScenario && (
            <SimulationResults 
              task={task}
              scenario={currentScenario}
            />
          )}

          {currentTab === 'comparison' && (
            <ScenarioComparison 
              scenarios={scenarios}
              selectedScenarioId={selectedScenario}
              onScenarioSelect={handleScenarioSelect}
            />
          )}

          {currentTab === 'timeline' && currentScenario && (
            <TimelinePreview 
              task={task}
              scenario={currentScenario}
              allScenarios={scenarios}
            />
          )}

          {currentTab === 'summary' && currentScenario && (
            <ImpactSummary 
              task={task}
              scenario={currentScenario}
              notes={notes}
              onNotesChange={setNotes}
            />
          )}
        </div>

        <div className="modal-footer">
          <div className="footer-actions">
            <button className="cancel-btn" onClick={onCancel}>
              Cancel
            </button>
            
            {onSaveDraft && (
              <button className="draft-btn" onClick={handleSaveScenario}>
                Save as Draft
              </button>
            )}
            
            <button 
              className="test-more-btn"
              onClick={() => setCurrentTab('comparison')}
            >
              Test More Options
            </button>
            
            <button 
              className="confirm-btn primary"
              onClick={() => setShowConfirmation(true)}
            >
              Proceed with Assignment
            </button>
          </div>
        </div>

        {showConfirmation && currentScenario && (
          <ConfirmationDialog
            scenario={currentScenario}
            task={task}
            onConfirm={handleConfirmAssignment}
            onCancel={() => setShowConfirmation(false)}
          />
        )}
      </div>
    </div>
  );
};

const SimulationResults: React.FC<{ task: Task; scenario: AssignmentScenario }> = ({
  task,
  scenario
}) => {
  const { simulation } = scenario;

  return (
    <div className="simulation-results">
      <div className="results-grid">
        {/* Skill Match Card */}
        <div className="result-card skill-match">
          <div className="card-header">
            <h3>🎯 Skill Match</h3>
            <div className={`score ${getScoreClass(simulation.skillMatch)}`}>
              {simulation.skillMatch}%
            </div>
          </div>
          <div className="card-content">
            <div className="skill-breakdown">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${simulation.skillMatch}%` }}
                />
              </div>
              <div className="match-details">
                <span>Strong match for {Math.floor(simulation.skillMatch / 20)} out of {task.requirements.length} skills</span>
              </div>
            </div>
          </div>
        </div>

        {/* Workload Impact Card */}
        <div className="result-card workload">
          <div className="card-header">
            <h3>⚡ Workload Impact</h3>
            <div className={`utilization ${getUtilizationClass(simulation.workloadImpact.utilizationPercent)}`}>
              {simulation.workloadImpact.utilizationPercent}%
            </div>
          </div>
          <div className="card-content">
            <div className="workload-breakdown">
              <div className="workload-bar">
                <div 
                  className="current-load"
                  style={{ width: `${(simulation.workloadImpact.currentHours / simulation.workloadImpact.capacity) * 100}%` }}
                />
                <div 
                  className="adding-load"
                  style={{ 
                    width: `${(simulation.workloadImpact.addingHours / simulation.workloadImpact.capacity) * 100}%`,
                    left: `${(simulation.workloadImpact.currentHours / simulation.workloadImpact.capacity) * 100}%`
                  }}
                />
              </div>
              <div className="workload-numbers">
                <span>{simulation.workloadImpact.currentHours}h current</span>
                <span>+{simulation.workloadImpact.addingHours}h new</span>
                <span>= {simulation.workloadImpact.totalHours}h total</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Impact Card */}
        <div className="result-card timeline">
          <div className="card-header">
            <h3>📅 Timeline</h3>
            <div className="completion-date">
              {simulation.timelineImpact.estimatedCompletion.toLocaleDateString()}
            </div>
          </div>
          <div className="card-content">
            <div className="timeline-info">
              <div className="timeline-item">
                <span className="timeline-label">Estimated completion:</span>
                <span className="timeline-value">
                  {simulation.timelineImpact.estimatedCompletion.toLocaleDateString()}
                </span>
              </div>
              <div className="timeline-item">
                <span className="timeline-label">Conflicts:</span>
                <span className={`timeline-value ${simulation.timelineImpact.conflicts.length > 0 ? 'warning' : 'success'}`}>
                  {simulation.timelineImpact.conflicts.length === 0 ? 'None' : `${simulation.timelineImpact.conflicts.length} found`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Risk Assessment Card */}
        <div className="result-card risk">
          <div className="card-header">
            <h3>⚠️ Risk Assessment</h3>
            <div className={`risk-level ${simulation.riskAssessment.level}`}>
              {simulation.riskAssessment.level.toUpperCase()}
            </div>
          </div>
          <div className="card-content">
            <div className="risk-factors">
              {simulation.riskAssessment.factors.slice(0, 3).map((factor, index) => (
                <div key={index} className="risk-factor">
                  <span className="factor-desc">{factor.description}</span>
                  <div className="factor-score">
                    <div 
                      className="score-bar"
                      style={{ width: `${factor.score}%` }}
                    />
                    <span className="score-text">{factor.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Team Impact Card */}
        <div className="result-card team">
          <div className="card-header">
            <h3>👥 Team Impact</h3>
            <div className={`balance-score ${getScoreClass(simulation.teamImpact.balanceScore)}`}>
              {simulation.teamImpact.balanceScore}%
            </div>
          </div>
          <div className="card-content">
            <div className="team-info">
              <div className="team-item">
                <span className="team-label">Balance score:</span>
                <span className="team-value">{simulation.teamImpact.balanceScore}%</span>
              </div>
              <div className="team-item">
                <span className="team-label">Backup options:</span>
                <span className="team-value">{simulation.teamImpact.backupOptions.length} available</span>
              </div>
              {simulation.teamImpact.knowledgeGaps.length > 0 && (
                <div className="team-item">
                  <span className="team-label">Knowledge gaps:</span>
                  <span className="team-value warning">
                    {simulation.teamImpact.knowledgeGaps.length} identified
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Cost Impact Card (if applicable) */}
        {simulation.costImpact && (
          <div className="result-card cost">
            <div className="card-header">
              <h3>💰 Cost Impact</h3>
              <div className="cost-total">
                ${simulation.costImpact.totalCost.toLocaleString()}
              </div>
            </div>
            <div className="card-content">
              <div className="cost-breakdown">
                <div className="cost-item">
                  <span className="cost-label">Hourly rate:</span>
                  <span className="cost-value">${simulation.costImpact.hourlyRate}</span>
                </div>
                <div className="cost-item">
                  <span className="cost-label">Total hours:</span>
                  <span className="cost-value">{task.estimatedHours}h</span>
                </div>
                <div className="cost-item">
                  <span className="cost-label">Budget impact:</span>
                  <span className={`cost-value ${simulation.costImpact.budgetImpact > 0 ? 'positive' : 'negative'}`}>
                    {simulation.costImpact.budgetImpact > 0 ? '+' : ''}${simulation.costImpact.budgetImpact}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Conflicts Section */}
      {simulation.timelineImpact.conflicts.length > 0 && (
        <div className="conflicts-section">
          <h3>⚠️ Potential Conflicts</h3>
          <div className="conflicts-list">
            {simulation.timelineImpact.conflicts.map((conflict, index) => (
              <div key={index} className={`conflict-item ${conflict.severity}`}>
                <div className="conflict-header">
                  <span className="conflict-type">{conflict.type.toUpperCase()}</span>
                  <span className="conflict-severity">{conflict.severity}</span>
                </div>
                <div className="conflict-description">{conflict.description}</div>
                <div className="conflict-timeline">
                  {conflict.startDate.toLocaleDateString()} - {conflict.endDate.toLocaleDateString()}
                </div>
                {conflict.resolution && (
                  <div className="conflict-resolution">
                    <strong>Suggested resolution:</strong> {conflict.resolution}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions (continue in next part due to length)
function generateSimulation(task: Task, contact: Contact): SimulationResult {
  // Mock simulation generation - in real app would use complex algorithms
  const skillMatchResult = skillMatchCalculator.calculateMatch(
    task.requirements,
    extractContactSkills(contact)
  );

  const currentWorkload = contact.currentWorkload || 0;
  const capacity = 40; // 40 hours per week
  const addingHours = task.estimatedHours;
  const totalHours = currentWorkload + addingHours;
  const utilizationPercent = Math.round((totalHours / capacity) * 100);

  const estimatedCompletion = new Date();
  estimatedCompletion.setDate(estimatedCompletion.getDate() + Math.ceil(task.estimatedHours / 8));

  const conflicts: Conflict[] = [];
  if (utilizationPercent > 100) {
    conflicts.push({
      type: 'workload',
      severity: 'high',
      description: 'Contact will be overallocated',
      startDate: new Date(),
      endDate: estimatedCompletion,
      resolution: 'Consider splitting the task or extending timeline'
    });
  }

  const riskFactors: RiskFactor[] = [
    {
      category: 'skills',
      description: 'Skill gap in advanced requirements',
      probability: skillMatchResult.score < 80 ? 70 : 20,
      impact: 60,
      score: skillMatchResult.score < 80 ? 42 : 12
    },
    {
      category: 'workload',
      description: 'High workload utilization',
      probability: utilizationPercent > 90 ? 80 : 30,
      impact: 50,
      score: utilizationPercent > 90 ? 40 : 15
    }
  ];

  return {
    skillMatch: skillMatchResult.score,
    workloadImpact: {
      currentHours: currentWorkload,
      addingHours,
      totalHours,
      capacity,
      utilizationPercent
    },
    timelineImpact: {
      estimatedCompletion,
      conflicts,
      dependencies: []
    },
    teamImpact: {
      balanceScore: Math.max(0, 100 - Math.abs(utilizationPercent - 75)),
      knowledgeGaps: skillMatchResult.missingSkills.map(s => s.skill),
      backupOptions: []
    },
    riskAssessment: {
      level: getRiskLevel(riskFactors),
      factors: riskFactors,
      mitigation: [
        'Provide additional training for skill gaps',
        'Monitor workload closely',
        'Establish clear communication channels'
      ]
    },
    costImpact: {
      hourlyRate: contact.hourlyRate || 75,
      totalCost: (contact.hourlyRate || 75) * task.estimatedHours,
      budgetImpact: 0
    }
  };
}

function extractContactSkills(contact: Contact) {
  return contact.skills?.map(skill => ({
    skillName: skill.name,
    level: skill.level || 2,
    yearsOfExperience: skill.years,
    lastUsed: skill.lastUsed ? new Date(skill.lastUsed) : undefined,
    certified: skill.certified || false
  })) || [];
}

function getRiskLevel(factors: RiskFactor[]): 'low' | 'medium' | 'high' | 'critical' {
  const maxScore = Math.max(...factors.map(f => f.score));
  if (maxScore > 60) return 'critical';
  if (maxScore > 40) return 'high';
  if (maxScore > 20) return 'medium';
  return 'low';
}

function getScoreClass(score: number): string {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

function getUtilizationClass(utilization: number): string {
  if (utilization > 100) return 'overloaded';
  if (utilization > 90) return 'critical';
  if (utilization > 70) return 'high';
  return 'normal';
}

// Export component and types
export default TestAssignmentModal;
export type { Task, TestAssignment, AssignmentScenario, SimulationResult };