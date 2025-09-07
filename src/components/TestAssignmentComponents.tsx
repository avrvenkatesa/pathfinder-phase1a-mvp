import React, { useState, useMemo } from 'react';
import { Task, AssignmentScenario, SimulationResult } from './TestAssignmentModal';
import './TestAssignmentModal.css';

interface ScenarioComparisonProps {
  scenarios: AssignmentScenario[];
  selectedScenarioId: string | null;
  onScenarioSelect: (scenarioId: string) => void;
}

interface TimelinePreviewProps {
  task: Task;
  scenario: AssignmentScenario;
  allScenarios: AssignmentScenario[];
}

interface ImpactSummaryProps {
  task: Task;
  scenario: AssignmentScenario;
  notes: string;
  onNotesChange: (notes: string) => void;
}

interface ConfirmationDialogProps {
  scenario: AssignmentScenario;
  task: Task;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ScenarioComparison: React.FC<ScenarioComparisonProps> = ({
  scenarios,
  selectedScenarioId,
  onScenarioSelect
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'skillMatch' | 'utilization' | 'risk'>('skillMatch');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const sortedScenarios = useMemo(() => {
    return [...scenarios].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'skillMatch':
          aVal = a.simulation.skillMatch;
          bVal = b.simulation.skillMatch;
          break;
        case 'utilization':
          aVal = a.simulation.workloadImpact.utilizationPercent;
          bVal = b.simulation.workloadImpact.utilizationPercent;
          break;
        case 'risk':
          aVal = getRiskScore(a.simulation.riskAssessment.level);
          bVal = getRiskScore(b.simulation.riskAssessment.level);
          break;
        default:
          aVal = a.simulation.skillMatch;
          bVal = b.simulation.skillMatch;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [scenarios, sortBy, sortOrder]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getCompletionTime = (simulation: SimulationResult) => {
    const days = Math.ceil(simulation.workloadImpact.addingHours / 8);
    return `${days} day${days !== 1 ? 's' : ''}`;
  };

  const getBestScenario = () => {
    return scenarios.reduce((best, current) => {
      const bestScore = calculateOverallScore(best.simulation);
      const currentScore = calculateOverallScore(current.simulation);
      return currentScore > bestScore ? current : best;
    });
  };

  const bestScenario = getBestScenario();

  return (
    <div className="scenario-comparison">
      <div className="comparison-header">
        <h3>📊 Scenario Comparison</h3>
        <div className="comparison-controls">
          <div className="best-recommendation">
            <span className="recommendation-label">💡 Recommended:</span>
            <button 
              className={`recommendation-btn ${selectedScenarioId === bestScenario.id ? 'active' : ''}`}
              onClick={() => onScenarioSelect(bestScenario.id)}
            >
              {bestScenario.name}
            </button>
          </div>
        </div>
      </div>

      <div className="comparison-table-container">
        <table className="comparison-table">
          <thead>
            <tr>
              <th 
                className={`sortable ${sortBy === 'name' ? `sorted-${sortOrder}` : ''}`}
                onClick={() => handleSort('name')}
              >
                Contact {getSortIcon('name', sortBy, sortOrder)}
              </th>
              <th 
                className={`sortable ${sortBy === 'skillMatch' ? `sorted-${sortOrder}` : ''}`}
                onClick={() => handleSort('skillMatch')}
              >
                Skill Match {getSortIcon('skillMatch', sortBy, sortOrder)}
              </th>
              <th>Availability</th>
              <th>Completion Time</th>
              <th 
                className={`sortable ${sortBy === 'utilization' ? `sorted-${sortOrder}` : ''}`}
                onClick={() => handleSort('utilization')}
              >
                Utilization {getSortIcon('utilization', sortBy, sortOrder)}
              </th>
              <th 
                className={`sortable ${sortBy === 'risk' ? `sorted-${sortOrder}` : ''}`}
                onClick={() => handleSort('risk')}
              >
                Risk Level {getSortIcon('risk', sortBy, sortOrder)}
              </th>
              <th>Cost</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedScenarios.map((scenario) => (
              <tr 
                key={scenario.id}
                className={`comparison-row ${selectedScenarioId === scenario.id ? 'selected' : ''} ${scenario.id === bestScenario.id ? 'recommended' : ''}`}
                onClick={() => onScenarioSelect(scenario.id)}
              >
                <td className="contact-cell">
                  <div className="contact-info">
                    <span className="contact-name">{scenario.contact.name}</span>
                    <span className="contact-title">{scenario.contact.title}</span>
                    {scenario.id === bestScenario.id && (
                      <span className="best-badge">⭐ Best</span>
                    )}
                  </div>
                </td>
                
                <td className="skill-match-cell">
                  <div className="skill-match">
                    <div className={`score ${getScoreClass(scenario.simulation.skillMatch)}`}>
                      {scenario.simulation.skillMatch}%
                    </div>
                    <div className="skill-bar">
                      <div 
                        className="skill-fill"
                        style={{ width: `${scenario.simulation.skillMatch}%` }}
                      />
                    </div>
                  </div>
                </td>
                
                <td className="availability-cell">
                  <span className={`availability ${scenario.contact.availability || 'unknown'}`}>
                    {getAvailabilityIcon(scenario.contact.availability)} 
                    {scenario.contact.availability || 'Unknown'}
                  </span>
                </td>
                
                <td className="completion-cell">
                  <span className="completion-time">
                    {getCompletionTime(scenario.simulation)}
                  </span>
                  <span className="completion-date">
                    {scenario.simulation.timelineImpact.estimatedCompletion.toLocaleDateString()}
                  </span>
                </td>
                
                <td className="utilization-cell">
                  <div className="utilization">
                    <div className={`utilization-percent ${getUtilizationClass(scenario.simulation.workloadImpact.utilizationPercent)}`}>
                      {scenario.simulation.workloadImpact.utilizationPercent}%
                    </div>
                    <div className="utilization-bar">
                      <div 
                        className="utilization-fill"
                        style={{ width: `${Math.min(scenario.simulation.workloadImpact.utilizationPercent, 100)}%` }}
                      />
                      {scenario.simulation.workloadImpact.utilizationPercent > 100 && (
                        <div 
                          className="overload-indicator"
                          style={{ width: `${Math.min(scenario.simulation.workloadImpact.utilizationPercent - 100, 50)}%` }}
                        />
                      )}
                    </div>
                  </div>
                </td>
                
                <td className="risk-cell">
                  <span className={`risk-badge ${scenario.simulation.riskAssessment.level}`}>
                    {getRiskIcon(scenario.simulation.riskAssessment.level)} 
                    {scenario.simulation.riskAssessment.level.toUpperCase()}
                  </span>
                </td>
                
                <td className="cost-cell">
                  {scenario.simulation.costImpact && (
                    <div className="cost-info">
                      <span className="cost-total">
                        ${scenario.simulation.costImpact.totalCost.toLocaleString()}
                      </span>
                      <span className="cost-rate">
                        ${scenario.simulation.costImpact.hourlyRate}/hr
                      </span>
                    </div>
                  )}
                </td>
                
                <td className="actions-cell">
                  <button 
                    className={`select-btn ${selectedScenarioId === scenario.id ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onScenarioSelect(scenario.id);
                    }}
                  >
                    {selectedScenarioId === scenario.id ? 'Selected' : 'Select'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="comparison-summary">
        <div className="summary-stats">
          <div className="stat">
            <span className="stat-label">Best Skill Match:</span>
            <span className="stat-value">
              {Math.max(...scenarios.map(s => s.simulation.skillMatch))}%
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Fastest Completion:</span>
            <span className="stat-value">
              {Math.min(...scenarios.map(s => Math.ceil(s.simulation.workloadImpact.addingHours / 8)))} days
            </span>
          </div>
          <div className="stat">
            <span className="stat-label">Lowest Risk:</span>
            <span className="stat-value">
              {scenarios.reduce((lowest, s) => 
                getRiskScore(s.simulation.riskAssessment.level) < getRiskScore(lowest.simulation.riskAssessment.level) 
                  ? s : lowest
              ).simulation.riskAssessment.level.toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const TimelinePreview: React.FC<TimelinePreviewProps> = ({
  task,
  scenario,
  allScenarios
}) => {
  const [viewMode, setViewMode] = useState<'gantt' | 'calendar'>('gantt');
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');

  // Generate timeline events
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];
    const startDate = new Date();
    
    // Current assignments (mock data)
    events.push({
      id: 'current-1',
      title: 'Current Project Alpha',
      startDate: new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000),
      type: 'current',
      contactId: scenario.contact.id,
      color: '#3498db'
    });

    // Proposed assignment
    events.push({
      id: 'proposed',
      title: task.name,
      startDate: startDate,
      endDate: scenario.simulation.timelineImpact.estimatedCompletion,
      type: 'proposed',
      contactId: scenario.contact.id,
      color: '#27ae60'
    });

    // Conflicts
    scenario.simulation.timelineImpact.conflicts.forEach((conflict, index) => {
      events.push({
        id: `conflict-${index}`,
        title: `Conflict: ${conflict.description}`,
        startDate: conflict.startDate,
        endDate: conflict.endDate,
        type: 'conflict',
        contactId: scenario.contact.id,
        color: '#e74c3c'
      });
    });

    return events;
  }, [task, scenario]);

  const generateTimelineGrid = () => {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + (timeRange === 'week' ? 0 : timeRange === 'month' ? 1 : 3));
    
    const days = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const timelineDays = generateTimelineGrid();

  return (
    <div className="timeline-preview">
      <div className="timeline-header">
        <h3>📅 Timeline Preview</h3>
        <div className="timeline-controls">
          <div className="view-mode-selector">
            <button 
              className={`mode-btn ${viewMode === 'gantt' ? 'active' : ''}`}
              onClick={() => setViewMode('gantt')}
            >
              Gantt
            </button>
            <button 
              className={`mode-btn ${viewMode === 'calendar' ? 'active' : ''}`}
              onClick={() => setViewMode('calendar')}
            >
              Calendar
            </button>
          </div>
          <div className="time-range-selector">
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value as typeof timeRange)}
            >
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="quarter">This Quarter</option>
            </select>
          </div>
        </div>
      </div>

      {viewMode === 'gantt' && (
        <div className="gantt-chart">
          <div className="gantt-header">
            <div className="gantt-task-header">Tasks</div>
            <div className="gantt-timeline-header">
              {timelineDays.map((day, index) => (
                <div key={index} className="timeline-day">
                  <div className="day-date">{day.getDate()}</div>
                  <div className="day-name">{day.toLocaleDateString('en', { weekday: 'short' })}</div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="gantt-body">
            {timelineEvents.map((event) => (
              <div key={event.id} className="gantt-row">
                <div className="gantt-task">
                  <div className={`task-info ${event.type}`}>
                    <span className="task-title">{event.title}</span>
                    <span className="task-type">{event.type}</span>
                  </div>
                </div>
                <div className="gantt-timeline">
                  <GanttBar 
                    event={event}
                    timelineDays={timelineDays}
                    totalDays={timelineDays.length}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewMode === 'calendar' && (
        <div className="calendar-view">
          <CalendarTimeline 
            events={timelineEvents}
            startDate={timelineDays[0]}
            endDate={timelineDays[timelineDays.length - 1]}
          />
        </div>
      )}

      <div className="timeline-legend">
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-color current"></span>
            <span>Current Assignments</span>
          </div>
          <div className="legend-item">
            <span className="legend-color proposed"></span>
            <span>Proposed Assignment</span>
          </div>
          <div className="legend-item">
            <span className="legend-color conflict"></span>
            <span>Conflicts</span>
          </div>
        </div>
      </div>

      <div className="timeline-insights">
        <h4>📊 Timeline Insights</h4>
        <div className="insights-grid">
          <div className="insight-card">
            <div className="insight-title">Project Duration</div>
            <div className="insight-value">
              {Math.ceil((scenario.simulation.timelineImpact.estimatedCompletion.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-title">Conflicts</div>
            <div className="insight-value">
              {scenario.simulation.timelineImpact.conflicts.length}
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-title">Buffer Time</div>
            <div className="insight-value">
              {scenario.simulation.workloadImpact.utilizationPercent < 90 ? 'Available' : 'Limited'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ImpactSummary: React.FC<ImpactSummaryProps> = ({
  task,
  scenario,
  notes,
  onNotesChange
}) => {
  const overallScore = calculateOverallScore(scenario.simulation);
  const recommendations = generateRecommendations(scenario.simulation);

  return (
    <div className="impact-summary">
      <div className="summary-header">
        <h3>📋 Impact Summary</h3>
        <div className="overall-score">
          <div className="score-circle">
            <svg width="80" height="80">
              <circle
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke="#e0e0e0"
                strokeWidth="6"
              />
              <circle
                cx="40"
                cy="40"
                r="35"
                fill="none"
                stroke={getScoreColor(overallScore)}
                strokeWidth="6"
                strokeDasharray={`${(overallScore / 100) * 219.8} 219.8`}
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="score-text">
              <span className="score-number">{overallScore}</span>
              <span className="score-label">Overall</span>
            </div>
          </div>
        </div>
      </div>

      <div className="summary-content">
        <div className="summary-section">
          <h4>✅ Strengths</h4>
          <ul className="strengths-list">
            {scenario.simulation.skillMatch >= 80 && (
              <li>Excellent skill match ({scenario.simulation.skillMatch}%)</li>
            )}
            {scenario.simulation.workloadImpact.utilizationPercent <= 90 && (
              <li>Healthy workload utilization ({scenario.simulation.workloadImpact.utilizationPercent}%)</li>
            )}
            {scenario.simulation.riskAssessment.level === 'low' && (
              <li>Low risk assignment</li>
            )}
            {scenario.simulation.teamImpact.backupOptions.length > 0 && (
              <li>Backup options available</li>
            )}
          </ul>
        </div>

        <div className="summary-section">
          <h4>⚠️ Concerns</h4>
          <ul className="concerns-list">
            {scenario.simulation.skillMatch < 60 && (
              <li>Below-average skill match ({scenario.simulation.skillMatch}%)</li>
            )}
            {scenario.simulation.workloadImpact.utilizationPercent > 100 && (
              <li>Contact will be overallocated ({scenario.simulation.workloadImpact.utilizationPercent}%)</li>
            )}
            {scenario.simulation.timelineImpact.conflicts.length > 0 && (
              <li>{scenario.simulation.timelineImpact.conflicts.length} scheduling conflicts detected</li>
            )}
            {scenario.simulation.teamImpact.knowledgeGaps.length > 0 && (
              <li>Knowledge gaps: {scenario.simulation.teamImpact.knowledgeGaps.join(', ')}</li>
            )}
          </ul>
        </div>

        <div className="summary-section">
          <h4>💡 Recommendations</h4>
          <ul className="recommendations-list">
            {recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>

        <div className="summary-section">
          <h4>📝 Notes</h4>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add your notes about this assignment..."
            className="notes-textarea"
            rows={4}
          />
        </div>

        <div className="summary-stats">
          <div className="stat-grid">
            <div className="stat-item">
              <span className="stat-label">Estimated Completion</span>
              <span className="stat-value">
                {scenario.simulation.timelineImpact.estimatedCompletion.toLocaleDateString()}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Cost</span>
              <span className="stat-value">
                ${scenario.simulation.costImpact?.totalCost.toLocaleString() || 'N/A'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Risk Level</span>
              <span className={`stat-value ${scenario.simulation.riskAssessment.level}`}>
                {scenario.simulation.riskAssessment.level.toUpperCase()}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Team Balance</span>
              <span className="stat-value">
                {scenario.simulation.teamImpact.balanceScore}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  scenario,
  task,
  onConfirm,
  onCancel
}) => {
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [approvalReason, setApprovalReason] = useState('');

  const needsApproval = useMemo(() => {
    return (
      scenario.simulation.workloadImpact.utilizationPercent > 100 ||
      scenario.simulation.riskAssessment.level === 'high' ||
      scenario.simulation.riskAssessment.level === 'critical' ||
      (scenario.simulation.costImpact?.totalCost || 0) > 10000
    );
  }, [scenario]);

  useEffect(() => {
    if (needsApproval) {
      setRequiresApproval(true);
      if (scenario.simulation.workloadImpact.utilizationPercent > 100) {
        setApprovalReason('Contact overallocation');
      } else if (scenario.simulation.riskAssessment.level === 'high') {
        setApprovalReason('High risk assignment');
      } else if ((scenario.simulation.costImpact?.totalCost || 0) > 10000) {
        setApprovalReason('High cost assignment');
      }
    }
  }, [needsApproval, scenario]);

  return (
    <div className="confirmation-overlay">
      <div className="confirmation-dialog">
        <div className="confirmation-header">
          <h3>🎯 Confirm Assignment</h3>
        </div>

        <div className="confirmation-content">
          <div className="assignment-summary">
            <div className="summary-item">
              <strong>Task:</strong> {task.name}
            </div>
            <div className="summary-item">
              <strong>Assigned to:</strong> {scenario.contact.name}
            </div>
            <div className="summary-item">
              <strong>Estimated hours:</strong> {task.estimatedHours}h
            </div>
            <div className="summary-item">
              <strong>Expected completion:</strong> {scenario.simulation.timelineImpact.estimatedCompletion.toLocaleDateString()}
            </div>
          </div>

          <div className="impact-highlight">
            <h4>Impact Assessment</h4>
            <div className="impact-items">
              <div className="impact-item">
                <span className="impact-label">Skill Match:</span>
                <span className={`impact-value ${getScoreClass(scenario.simulation.skillMatch)}`}>
                  {scenario.simulation.skillMatch}%
                </span>
              </div>
              <div className="impact-item">
                <span className="impact-label">Utilization:</span>
                <span className={`impact-value ${getUtilizationClass(scenario.simulation.workloadImpact.utilizationPercent)}`}>
                  {scenario.simulation.workloadImpact.utilizationPercent}%
                </span>
              </div>
              <div className="impact-item">
                <span className="impact-label">Risk Level:</span>
                <span className={`impact-value ${scenario.simulation.riskAssessment.level}`}>
                  {scenario.simulation.riskAssessment.level.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {requiresApproval && (
            <div className="approval-section">
              <div className="approval-warning">
                ⚠️ This assignment requires approval due to: <strong>{approvalReason}</strong>
              </div>
              <div className="approval-note">
                The assignment will be saved as a draft and sent for approval.
              </div>
            </div>
          )}
        </div>

        <div className="confirmation-actions">
          <button className="cancel-btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="confirm-btn primary" onClick={onConfirm}>
            {requiresApproval ? 'Send for Approval' : 'Confirm Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper interfaces and functions
interface TimelineEvent {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  type: 'current' | 'proposed' | 'conflict' | 'dependency';
  contactId: number;
  color: string;
}

const GanttBar: React.FC<{
  event: TimelineEvent;
  timelineDays: Date[];
  totalDays: number;
}> = ({ event, timelineDays, totalDays }) => {
  const startIndex = timelineDays.findIndex(day => 
    day.toDateString() === event.startDate.toDateString()
  );
  const endIndex = timelineDays.findIndex(day => 
    day.toDateString() === event.endDate.toDateString()
  );

  if (startIndex === -1 || endIndex === -1) return null;

  const left = (startIndex / totalDays) * 100;
  const width = ((endIndex - startIndex + 1) / totalDays) * 100;

  return (
    <div 
      className={`gantt-bar ${event.type}`}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        backgroundColor: event.color
      }}
      title={`${event.title} (${event.startDate.toLocaleDateString()} - ${event.endDate.toLocaleDateString()})`}
    >
      <span className="bar-label">{event.title}</span>
    </div>
  );
};

const CalendarTimeline: React.FC<{
  events: TimelineEvent[];
  startDate: Date;
  endDate: Date;
}> = ({ events, startDate, endDate }) => {
  // Simplified calendar implementation
  return (
    <div className="calendar-timeline">
      <div className="calendar-grid">
        {events.map(event => (
          <div key={event.id} className={`calendar-event ${event.type}`}>
            <div className="event-title">{event.title}</div>
            <div className="event-dates">
              {event.startDate.toLocaleDateString()} - {event.endDate.toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper functions
function getRiskScore(level: string): number {
  switch (level) {
    case 'low': return 1;
    case 'medium': return 2;
    case 'high': return 3;
    case 'critical': return 4;
    default: return 0;
  }
}

function getSortIcon(column: string, sortBy: string, sortOrder: string): string {
  if (sortBy !== column) return '↕️';
  return sortOrder === 'asc' ? '↑' : '↓';
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

function getAvailabilityIcon(availability?: string): string {
  switch (availability) {
    case 'available': return '🟢';
    case 'busy': return '🟡';
    case 'unavailable': return '🔴';
    default: return '⚪';
  }
}

function getRiskIcon(level: string): string {
  switch (level) {
    case 'low': return '🟢';
    case 'medium': return '🟡';
    case 'high': return '🟠';
    case 'critical': return '🔴';
    default: return '⚪';
  }
}

function calculateOverallScore(simulation: SimulationResult): number {
  const weights = {
    skillMatch: 0.4,
    workload: 0.3,
    risk: 0.2,
    team: 0.1
  };

  const workloadScore = Math.max(0, 100 - Math.abs(simulation.workloadImpact.utilizationPercent - 80));
  const riskScore = 100 - (getRiskScore(simulation.riskAssessment.level) * 25);
  
  return Math.round(
    simulation.skillMatch * weights.skillMatch +
    workloadScore * weights.workload +
    riskScore * weights.risk +
    simulation.teamImpact.balanceScore * weights.team
  );
}

function generateRecommendations(simulation: SimulationResult): string[] {
  const recommendations = [];

  if (simulation.skillMatch < 70) {
    recommendations.push('Consider providing additional training or mentoring');
  }

  if (simulation.workloadImpact.utilizationPercent > 90) {
    recommendations.push('Monitor workload closely and consider redistributing tasks');
  }

  if (simulation.timelineImpact.conflicts.length > 0) {
    recommendations.push('Review and resolve scheduling conflicts before starting');
  }

  if (simulation.riskAssessment.level === 'high' || simulation.riskAssessment.level === 'critical') {
    recommendations.push('Implement additional risk mitigation measures');
  }

  if (recommendations.length === 0) {
    recommendations.push('Assignment looks good to proceed');
  }

  return recommendations;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#27ae60';
  if (score >= 60) return '#f39c12';
  if (score >= 40) return '#e67e22';
  return '#e74c3c';
}