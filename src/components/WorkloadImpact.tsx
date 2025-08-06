import React, { useState, useMemo, useCallback } from 'react';
import { Contact } from '../interfaces/contact';
import './WorkloadImpact.css';

interface WorkloadImpactProps {
  contact: Contact;
  taskHours: number;
  taskName?: string;
  timeframe: 'day' | 'week' | 'sprint' | 'month';
  startDate?: Date;
  alternatives?: Contact[];
  onSplitTask?: () => void;
  onFindAlternative?: () => void;
  onAdjustTimeline?: () => void;
  onReduceScope?: () => void;
}

interface Assignment {
  id: string;
  taskName: string;
  hours: number;
  startDate: Date;
  endDate: Date;
  priority: 'high' | 'medium' | 'low';
}

interface TimeOff {
  startDate: Date;
  endDate: Date;
  type: 'vacation' | 'sick' | 'personal' | 'holiday';
  hours: number;
}

interface WorkloadData {
  currentHours: number;
  addingHours: number;
  totalHours: number;
  capacity: number;
  percentUsed: number;
  status: 'healthy' | 'near-capacity' | 'at-capacity' | 'overallocated';
  assignments: Assignment[];
  timeOff: TimeOff[];
  meetingOverhead: number;
}

interface WorkloadWarningProps {
  contact: Contact;
  impact: {
    currentHours: number;
    addingHours: number;
    totalHours: number;
    capacity: number;
    percentUsed: number;
  };
  message: string;
  suggestions: string[];
  onActionClick: (action: string) => void;
}

interface WeeklyImpact {
  week: number;
  startDate: Date;
  currentHours: number;
  addingHours: number;
  totalHours: number;
  capacity: number;
  percentUsed: number;
  status: 'healthy' | 'near-capacity' | 'at-capacity' | 'overallocated';
  assignments: Assignment[];
}

const WorkloadImpact: React.FC<WorkloadImpactProps> = ({
  contact,
  taskHours,
  taskName = 'New Task',
  timeframe,
  startDate = new Date(),
  alternatives = [],
  onSplitTask,
  onFindAlternative,
  onAdjustTimeline,
  onReduceScope
}) => {
  const [showTimeline, setShowTimeline] = useState(true);
  const [showForecast, setShowForecast] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // Calculate workload data
  const workloadData = useMemo(() => {
    return calculateWorkloadImpact(contact, taskHours, timeframe, startDate);
  }, [contact, taskHours, timeframe, startDate]);

  // Calculate weekly breakdown
  const weeklyImpact = useMemo(() => {
    return calculateWeeklyImpact(contact, taskHours, startDate, 4); // 4 weeks forecast
  }, [contact, taskHours, startDate]);

  // Generate alternative suggestions
  const alternativeSuggestions = useMemo(() => {
    if (workloadData.status === 'overallocated') {
      return generateAlternativeSuggestions(workloadData, alternatives, taskHours);
    }
    return [];
  }, [workloadData, alternatives, taskHours]);

  const handleActionClick = useCallback((action: string) => {
    switch (action) {
      case 'split-task':
        onSplitTask?.();
        break;
      case 'find-alternative':
        onFindAlternative?.();
        break;
      case 'adjust-timeline':
        onAdjustTimeline?.();
        break;
      case 'reduce-scope':
        onReduceScope?.();
        break;
    }
  }, [onSplitTask, onFindAlternative, onAdjustTimeline, onReduceScope]);

  return (
    <div className="workload-impact">
      <div className="impact-header">
        <h4>📊 Workload Impact Analysis</h4>
        <div className="contact-info">
          <span className="contact-name">{contact.name}</span>
          <span className="task-info">{taskName} ({taskHours}h)</span>
        </div>
      </div>

      {/* Current Impact Summary */}
      <div className="impact-summary">
        <div className="impact-metrics">
          <div className="metric">
            <span className="metric-label">Current Workload</span>
            <span className="metric-value">{workloadData.currentHours}h</span>
          </div>
          <div className="metric">
            <span className="metric-label">Task Requirement</span>
            <span className="metric-value">+{workloadData.addingHours}h</span>
          </div>
          <div className="metric">
            <span className="metric-label">New Total</span>
            <span className="metric-value">{workloadData.totalHours}h</span>
          </div>
          <div className="metric">
            <span className="metric-label">Capacity Used</span>
            <span className={`metric-value ${workloadData.status}`}>
              {Math.round(workloadData.percentUsed)}%
            </span>
          </div>
        </div>

        <div className="capacity-visualization">
          <CapacityBar
            current={workloadData.currentHours}
            adding={workloadData.addingHours}
            capacity={workloadData.capacity}
            status={workloadData.status}
          />
          <div className="capacity-legend">
            <span className="capacity-remaining">
              {workloadData.capacity - workloadData.totalHours > 0 
                ? `${workloadData.capacity - workloadData.totalHours}h remaining`
                : `${workloadData.totalHours - workloadData.capacity}h over capacity`
              }
            </span>
          </div>
        </div>
      </div>

      {/* Warning Component */}
      {workloadData.status === 'overallocated' && (
        <WorkloadWarning
          contact={contact}
          impact={{
            currentHours: workloadData.currentHours,
            addingHours: workloadData.addingHours,
            totalHours: workloadData.totalHours,
            capacity: workloadData.capacity,
            percentUsed: workloadData.percentUsed
          }}
          message={`This will overallocate ${contact.name} by ${workloadData.totalHours - workloadData.capacity} hours this ${timeframe}`}
          suggestions={[
            'Split task across multiple weeks',
            'Assign to multiple people',
            'Reduce task scope',
            'Adjust timeline'
          ]}
          onActionClick={handleActionClick}
        />
      )}

      {/* Timeline View */}
      {showTimeline && (
        <div className="timeline-view">
          <div className="timeline-header">
            <h5>📅 Timeline Impact</h5>
            <button 
              className="toggle-forecast"
              onClick={() => setShowForecast(!showForecast)}
            >
              {showForecast ? 'Hide Forecast' : 'Show Forecast'}
            </button>
          </div>
          
          <div className="weekly-timeline">
            {weeklyImpact.map((week, index) => (
              <WeeklyImpactBar
                key={index}
                week={week}
                isSelected={selectedWeek === index}
                onClick={() => setSelectedWeek(selectedWeek === index ? null : index)}
                showForecast={showForecast}
              />
            ))}
          </div>

          {selectedWeek !== null && weeklyImpact[selectedWeek] && (
            <WeekDetails week={weeklyImpact[selectedWeek]} />
          )}
        </div>
      )}

      {/* Alternative Suggestions */}
      {alternativeSuggestions.length > 0 && (
        <div className="alternatives-section">
          <h5>🔄 Alternative Solutions</h5>
          <div className="alternatives-grid">
            {alternativeSuggestions.map((suggestion, index) => (
              <AlternativeSuggestion
                key={index}
                suggestion={suggestion}
                onSelect={() => handleActionClick(suggestion.action)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Forecast View */}
      {showForecast && (
        <ForecastView
          contact={contact}
          weeklyImpact={weeklyImpact}
          taskHours={taskHours}
        />
      )}
    </div>
  );
};

const CapacityBar: React.FC<{
  current: number;
  adding: number;
  capacity: number;
  status: string;
}> = ({ current, adding, capacity, status }) => {
  const currentPercent = Math.min((current / capacity) * 100, 100);
  const addingPercent = Math.min((adding / capacity) * 100, 100 - currentPercent);
  const overflowPercent = Math.max(((current + adding) / capacity) * 100 - 100, 0);

  return (
    <div className={`capacity-bar ${status}`}>
      <div className="bar-container">
        <div 
          className="current-workload"
          style={{ width: `${currentPercent}%` }}
        />
        <div 
          className="adding-workload"
          style={{ 
            width: `${addingPercent}%`,
            left: `${currentPercent}%`
          }}
        />
        {overflowPercent > 0 && (
          <div 
            className="overflow-workload"
            style={{ 
              width: `${Math.min(overflowPercent, 100)}%`,
              left: '100%'
            }}
          />
        )}
      </div>
      <div className="capacity-markers">
        <span className="marker healthy">70%</span>
        <span className="marker warning">90%</span>
        <span className="marker danger">100%</span>
      </div>
    </div>
  );
};

const WorkloadWarning: React.FC<WorkloadWarningProps> = ({
  contact,
  impact,
  message,
  suggestions,
  onActionClick
}) => {
  return (
    <div className={`workload-warning ${impact.percentUsed > 100 ? 'critical' : 'warning'}`}>
      <div className="warning-header">
        <span className="warning-icon">
          {impact.percentUsed > 100 ? '🚨' : '⚠️'}
        </span>
        <h5>Workload Alert</h5>
      </div>
      
      <div className="warning-message">
        <p>{message}</p>
        <div className="impact-breakdown">
          <span>Current: {impact.currentHours}h</span>
          <span>Adding: +{impact.addingHours}h</span>
          <span>Total: {impact.totalHours}h</span>
          <span>Capacity: {impact.capacity}h</span>
        </div>
      </div>

      <div className="warning-suggestions">
        <h6>Suggested Actions:</h6>
        <div className="suggestions-list">
          {suggestions.map((suggestion, index) => {
            const actionMap: Record<string, string> = {
              'Split task across multiple weeks': 'split-task',
              'Assign to multiple people': 'find-alternative', 
              'Reduce task scope': 'reduce-scope',
              'Adjust timeline': 'adjust-timeline'
            };
            
            return (
              <button
                key={index}
                className="suggestion-btn"
                onClick={() => onActionClick(actionMap[suggestion] || 'split-task')}
              >
                {getSuggestionIcon(suggestion)} {suggestion}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const WeeklyImpactBar: React.FC<{
  week: WeeklyImpact;
  isSelected: boolean;
  onClick: () => void;
  showForecast: boolean;
}> = ({ week, isSelected, onClick, showForecast }) => {
  const getWeekLabel = (startDate: Date) => {
    const weekOfYear = getWeekNumber(startDate);
    return `Week ${weekOfYear}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return '✅';
      case 'near-capacity': return '⚠️';
      case 'at-capacity': return '🔶';
      case 'overallocated': return '🚨';
      default: return '';
    }
  };

  return (
    <div 
      className={`weekly-impact-bar ${week.status} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="week-header">
        <span className="week-label">{getWeekLabel(week.startDate)}</span>
        <span className="week-percent">{Math.round(week.percentUsed)}%</span>
        <span className="status-icon">{getStatusIcon(week.status)}</span>
      </div>
      
      <div className="week-bar">
        <div className="week-capacity-bar">
          <div 
            className="current-fill"
            style={{ width: `${Math.min((week.currentHours / week.capacity) * 100, 100)}%` }}
          />
          <div 
            className="adding-fill"
            style={{ 
              width: `${Math.min((week.addingHours / week.capacity) * 100, 100)}%`,
              left: `${Math.min((week.currentHours / week.capacity) * 100, 100)}%`
            }}
          />
        </div>
        <div className="week-text">
          {'█'.repeat(Math.round((week.totalHours / week.capacity) * 10))}
          {'░'.repeat(Math.max(0, 10 - Math.round((week.totalHours / week.capacity) * 10)))}
        </div>
      </div>

      <div className="week-details">
        <span>{week.currentHours}h + {week.addingHours}h = {week.totalHours}h</span>
      </div>
    </div>
  );
};

const WeekDetails: React.FC<{ week: WeeklyImpact }> = ({ week }) => {
  return (
    <div className="week-details-panel">
      <h6>Week of {week.startDate.toLocaleDateString()}</h6>
      
      <div className="assignments-list">
        <h6>Current Assignments:</h6>
        {week.assignments.length > 0 ? (
          <ul>
            {week.assignments.map((assignment, index) => (
              <li key={index} className={`assignment ${assignment.priority}`}>
                <span className="task-name">{assignment.taskName}</span>
                <span className="task-hours">{assignment.hours}h</span>
                <span className="task-priority">{assignment.priority}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-assignments">No current assignments</p>
        )}
      </div>
      
      <div className="capacity-breakdown">
        <div className="breakdown-item">
          <span>Available Capacity:</span>
          <span>{week.capacity}h</span>
        </div>
        <div className="breakdown-item">
          <span>Current Usage:</span>
          <span>{week.currentHours}h</span>
        </div>
        <div className="breakdown-item">
          <span>Adding:</span>
          <span>+{week.addingHours}h</span>
        </div>
        <div className="breakdown-item total">
          <span>Total Usage:</span>
          <span>{week.totalHours}h ({Math.round(week.percentUsed)}%)</span>
        </div>
      </div>
    </div>
  );
};

const AlternativeSuggestion: React.FC<{
  suggestion: {
    type: string;
    title: string;
    description: string;
    effort: string;
    action: string;
  };
  onSelect: () => void;
}> = ({ suggestion, onSelect }) => {
  return (
    <div className={`alternative-card ${suggestion.effort}`}>
      <div className="card-header">
        <span className="suggestion-icon">{getSuggestionIcon(suggestion.title)}</span>
        <h6>{suggestion.title}</h6>
        <span className="effort-badge">{suggestion.effort}</span>
      </div>
      
      <p className="suggestion-description">{suggestion.description}</p>
      
      <button className="select-alternative" onClick={onSelect}>
        Select This Option
      </button>
    </div>
  );
};

const ForecastView: React.FC<{
  contact: Contact;
  weeklyImpact: WeeklyImpact[];
  taskHours: number;
}> = ({ contact, weeklyImpact, taskHours }) => {
  const trendAnalysis = useMemo(() => {
    return analyzeTrends(weeklyImpact);
  }, [weeklyImpact]);

  return (
    <div className="forecast-view">
      <h5>📈 Capacity Forecast</h5>
      
      <div className="trend-analysis">
        <div className="trend-item">
          <span className="trend-label">Peak Week:</span>
          <span className="trend-value">
            Week {trendAnalysis.peakWeek + 1} ({trendAnalysis.peakUsage}%)
          </span>
        </div>
        <div className="trend-item">
          <span className="trend-label">Bottlenecks:</span>
          <span className="trend-value">{trendAnalysis.bottlenecks} week(s)</span>
        </div>
        <div className="trend-item">
          <span className="trend-label">Available Weeks:</span>
          <span className="trend-value">{trendAnalysis.availableWeeks}</span>
        </div>
      </div>

      <div className="forecast-recommendations">
        <h6>Recommendations:</h6>
        <ul>
          {trendAnalysis.recommendations.map((rec, index) => (
            <li key={index}>{rec}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// Helper Functions

function calculateWorkloadImpact(
  contact: Contact, 
  taskHours: number, 
  timeframe: string, 
  startDate: Date
): WorkloadData {
  // Mock capacity calculation - in real app would come from contact data
  const baseCapacity = getBaseCapacity(timeframe);
  const meetingOverhead = baseCapacity * 0.2; // 20% for meetings
  const capacity = baseCapacity - meetingOverhead;
  
  // Mock current workload - would come from existing assignments
  const currentHours = contact.currentWorkload || 0;
  const addingHours = taskHours;
  const totalHours = currentHours + addingHours;
  const percentUsed = (totalHours / capacity) * 100;
  
  let status: WorkloadData['status'];
  if (percentUsed <= 70) status = 'healthy';
  else if (percentUsed <= 90) status = 'near-capacity';
  else if (percentUsed <= 100) status = 'at-capacity';
  else status = 'overallocated';

  return {
    currentHours,
    addingHours,
    totalHours,
    capacity,
    percentUsed,
    status,
    assignments: generateMockAssignments(contact, currentHours),
    timeOff: generateMockTimeOff(contact, startDate),
    meetingOverhead
  };
}

function calculateWeeklyImpact(
  contact: Contact,
  taskHours: number,
  startDate: Date,
  weeks: number
): WeeklyImpact[] {
  const weeklyImpacts: WeeklyImpact[] = [];
  const weeklyCapacity = 40; // 40 hours per week
  
  for (let i = 0; i < weeks; i++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(weekStart.getDate() + (i * 7));
    
    // Distribute task hours over weeks (could be smarter distribution)
    const weekTaskHours = i === 0 ? Math.min(taskHours, weeklyCapacity) : 0;
    const currentWeekHours = Math.max(0, (contact.currentWorkload || 0) - (i * 10)); // Decreasing existing work
    
    const totalWeekHours = currentWeekHours + weekTaskHours;
    const percentUsed = (totalWeekHours / weeklyCapacity) * 100;
    
    let status: WeeklyImpact['status'];
    if (percentUsed <= 70) status = 'healthy';
    else if (percentUsed <= 90) status = 'near-capacity';
    else if (percentUsed <= 100) status = 'at-capacity';
    else status = 'overallocated';

    weeklyImpacts.push({
      week: i,
      startDate: weekStart,
      currentHours: currentWeekHours,
      addingHours: weekTaskHours,
      totalHours: totalWeekHours,
      capacity: weeklyCapacity,
      percentUsed,
      status,
      assignments: generateMockAssignments(contact, currentWeekHours)
    });
  }
  
  return weeklyImpacts;
}

function generateAlternativeSuggestions(
  workloadData: WorkloadData,
  alternatives: Contact[],
  taskHours: number
) {
  const suggestions = [];
  
  suggestions.push({
    type: 'split',
    title: 'Split Task Across Time',
    description: `Break the ${taskHours}h task into smaller chunks across multiple weeks`,
    effort: 'low',
    action: 'split-task'
  });
  
  if (alternatives.length > 0) {
    const availableAlts = alternatives.filter(c => (c.currentWorkload || 0) < 30);
    if (availableAlts.length > 0) {
      suggestions.push({
        type: 'delegate',
        title: 'Assign to Available Team Member',
        description: `${availableAlts[0].name} has capacity available`,
        effort: 'medium',
        action: 'find-alternative'
      });
    }
  }
  
  suggestions.push({
    type: 'scope',
    title: 'Reduce Task Scope',
    description: 'Identify non-essential requirements to reduce effort',
    effort: 'medium',
    action: 'reduce-scope'
  });
  
  return suggestions;
}

function getBaseCapacity(timeframe: string): number {
  switch (timeframe) {
    case 'day': return 8;
    case 'week': return 40;
    case 'sprint': return 80; // 2 weeks
    case 'month': return 160;
    default: return 40;
  }
}

function generateMockAssignments(contact: Contact, hours: number): Assignment[] {
  if (hours === 0) return [];
  
  return [
    {
      id: '1',
      taskName: 'Current Project Alpha',
      hours: Math.min(hours, 20),
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      priority: 'high'
    },
    ...(hours > 20 ? [{
      id: '2',
      taskName: 'Code Review & Meetings',
      hours: Math.min(hours - 20, 15),
      startDate: new Date(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      priority: 'medium'
    }] : [])
  ];
}

function generateMockTimeOff(contact: Contact, startDate: Date): TimeOff[] {
  return []; // Would be populated from contact's calendar
}

function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function analyzeTrends(weeklyImpact: WeeklyImpact[]) {
  const peakWeek = weeklyImpact.reduce((maxIdx, week, idx) => 
    week.percentUsed > weeklyImpact[maxIdx].percentUsed ? idx : maxIdx, 0);
  
  const bottlenecks = weeklyImpact.filter(w => w.status === 'overallocated' || w.status === 'at-capacity').length;
  const availableWeeks = weeklyImpact.filter(w => w.status === 'healthy').length;
  const peakUsage = Math.round(weeklyImpact[peakWeek].percentUsed);
  
  const recommendations = [];
  if (bottlenecks > 0) {
    recommendations.push(`Consider redistributing work from ${bottlenecks} bottleneck week(s)`);
  }
  if (availableWeeks > 0) {
    recommendations.push(`Utilize ${availableWeeks} week(s) with available capacity`);
  }
  if (peakUsage > 100) {
    recommendations.push('Peak utilization exceeds capacity - task splitting recommended');
  }
  
  return {
    peakWeek,
    peakUsage,
    bottlenecks,
    availableWeeks,
    recommendations
  };
}

function getSuggestionIcon(suggestion: string): string {
  if (suggestion.includes('Split') || suggestion.includes('time')) return '✂️';
  if (suggestion.includes('people') || suggestion.includes('team')) return '👥';
  if (suggestion.includes('scope') || suggestion.includes('Reduce')) return '📉';
  if (suggestion.includes('timeline') || suggestion.includes('Adjust')) return '📅';
  return '💡';
}

export default WorkloadImpact;