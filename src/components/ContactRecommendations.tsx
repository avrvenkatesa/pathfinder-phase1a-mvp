import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Contact } from '../interfaces/contact';
import { 
  SkillRequirement, 
  RankedContact,
  MatchResult,
  ProficiencyLevel,
  ContactSkill
} from '../services/skillMatchCalculator';
import skillMatchCalculator from '../services/skillMatchCalculator';
import './ContactRecommendations.css';

interface ContactRecommendationsProps {
  requirements: SkillRequirement[];
  contacts: Contact[];
  onAssign: (contact: Contact) => void;
  onCompareToggle?: (contacts: Contact[]) => void;
  maxRecommendations?: number;
  departmentPreference?: string;
}

interface RecommendationCardProps {
  contact: Contact;
  matchResult: MatchResult;
  rank: number;
  isCompareSelected: boolean;
  onAssign: () => void;
  onCompareToggle: () => void;
  onViewProfile: () => void;
  requirements: SkillRequirement[];
}

const ContactRecommendations: React.FC<ContactRecommendationsProps> = ({
  requirements,
  contacts,
  onAssign,
  onCompareToggle,
  maxRecommendations = 5,
  departmentPreference
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [compareList, setCompareList] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forceRefresh, setForceRefresh] = useState(0);

  // Calculate recommendations
  const recommendations = useMemo(() => {
    if (!requirements.length || !contacts.length) return [];

    setIsLoading(true);
    setError(null);

    try {
      // Filter contacts based on availability if needed
      const filteredContacts = showOnlyAvailable 
        ? contacts.filter(c => c.availability === 'available')
        : contacts;

      // Get ranked recommendations
      const ranked = skillMatchCalculator.rankContacts(
        requirements,
        filteredContacts,
        isExpanded ? undefined : maxRecommendations
      );

      setIsLoading(false);
      return ranked;
    } catch (err) {
      setError('Failed to calculate recommendations');
      setIsLoading(false);
      return [];
    }
  }, [requirements, contacts, showOnlyAvailable, isExpanded, maxRecommendations, forceRefresh]);

  const handleCompareToggle = useCallback((contactId: number) => {
    setCompareList(prev => {
      const newList = prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId];
      
      if (onCompareToggle) {
        const selectedContacts = contacts.filter(c => newList.includes(c.id));
        onCompareToggle(selectedContacts);
      }
      
      return newList;
    });
  }, [contacts, onCompareToggle]);

  const handleRefresh = () => {
    skillMatchCalculator.clearCache();
    setForceRefresh(prev => prev + 1);
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={handleRefresh} />;
  }

  if (!requirements.length) {
    return (
      <div className="recommendation-panel">
        <div className="panel-header">
          <h4>📊 Recommended Contacts</h4>
        </div>
        <div className="empty-state">
          <p>Add required skills to see contact recommendations</p>
        </div>
      </div>
    );
  }

  if (!recommendations.length) {
    return <EmptyState showOnlyAvailable={showOnlyAvailable} />;
  }

  const displayRecommendations = isExpanded 
    ? recommendations 
    : recommendations.slice(0, maxRecommendations);

  return (
    <div className="recommendation-panel">
      <div className="panel-header">
        <h4>📊 Recommended Contacts (Auto-matched)</h4>
        <div className="panel-controls">
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showOnlyAvailable}
              onChange={(e) => setShowOnlyAvailable(e.target.checked)}
            />
            <span>Show only available</span>
          </label>
          <button 
            className="refresh-btn"
            onClick={handleRefresh}
            title="Refresh recommendations"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="recommendations-list">
        {displayRecommendations.map((rec) => (
          <RecommendationCard
            key={rec.contact.id}
            contact={rec.contact}
            matchResult={rec.matchResult}
            rank={rec.rank}
            requirements={requirements}
            isCompareSelected={compareList.includes(rec.contact.id)}
            onAssign={() => onAssign(rec.contact)}
            onCompareToggle={() => handleCompareToggle(rec.contact.id)}
            onViewProfile={() => window.open(`/contacts/${rec.contact.id}`, '_blank')}
          />
        ))}
      </div>

      {recommendations.length > maxRecommendations && (
        <div className="expand-controls">
          <button
            className="expand-btn"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded 
              ? `Show less (${maxRecommendations})` 
              : `Show all (${recommendations.length})`}
          </button>
        </div>
      )}

      {compareList.length >= 2 && (
        <div className="compare-actions">
          <button className="compare-btn primary">
            Compare Selected ({compareList.length})
          </button>
          <button 
            className="compare-btn secondary"
            onClick={() => setCompareList([])}
          >
            Clear Selection
          </button>
        </div>
      )}
    </div>
  );
};

const RecommendationCard: React.FC<RecommendationCardProps> = ({
  contact,
  matchResult,
  rank,
  requirements,
  isCompareSelected,
  onAssign,
  onCompareToggle,
  onViewProfile
}) => {
  const getAvailabilityColor = (status: string) => {
    switch (status) {
      case 'available': return 'green';
      case 'busy': return 'yellow';
      case 'unavailable': return 'red';
      default: return 'gray';
    }
  };

  const getConfidenceEmoji = (confidence: string) => {
    switch (confidence) {
      case 'high': return '✅';
      case 'medium': return '⚠️';
      case 'low': return '❌';
      default: return '❓';
    }
  };

  const getWorkloadCapacity = (workload: number) => {
    const maxCapacity = 5;
    const used = Math.round((workload / 100) * maxCapacity);
    return `${used}/${maxCapacity} capacity`;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Calculate primary recommendation reason
  const getRecommendationReason = (): string => {
    const { breakdown, confidence } = matchResult;
    const reasons = [];

    if (breakdown.skillMatch >= 80) {
      reasons.push('Excellent skill match');
    } else if (breakdown.skillMatch >= 60) {
      reasons.push('Good skill match');
    }

    if (breakdown.availabilityScore >= 90) {
      reasons.push('fully available');
    }

    if (breakdown.workloadScore >= 80) {
      reasons.push('has capacity');
    }

    if (breakdown.departmentBonus > 0) {
      reasons.push('same department');
    }

    if (reasons.length === 0) {
      if (confidence === 'high') {
        return 'Strong overall match';
      } else if (confidence === 'medium') {
        return 'Moderate match with growth potential';
      } else {
        return 'Partial match - may need support';
      }
    }

    return reasons.slice(0, 2).join(', ');
  };

  return (
    <div className={`recommendation-card ${isCompareSelected ? 'selected' : ''}`}>
      <div className="card-header">
        <div className="contact-info">
          <div className="avatar">
            {contact.avatar ? (
              <img src={contact.avatar} alt={contact.name} />
            ) : (
              <div className="avatar-initials">{getInitials(contact.name)}</div>
            )}
            <span 
              className="availability-dot"
              style={{ backgroundColor: getAvailabilityColor(contact.availability || 'unknown') }}
              title={contact.availability || 'Unknown'}
            />
          </div>
          <div className="contact-details">
            <h5>{contact.name}</h5>
            <span className="title">{contact.title || 'Team Member'}</span>
            <span className="department">{contact.department || 'Engineering'}</span>
          </div>
        </div>
        <div className="rank-badge">#{rank}</div>
      </div>

      <div className="match-score-section">
        <div className="score-display">
          <div className="score-ring">
            <svg width="60" height="60">
              <circle
                cx="30"
                cy="30"
                r="25"
                fill="none"
                stroke="#e0e0e0"
                strokeWidth="5"
              />
              <circle
                cx="30"
                cy="30"
                r="25"
                fill="none"
                stroke={matchResult.score >= 70 ? '#4caf50' : matchResult.score >= 40 ? '#ff9800' : '#f44336'}
                strokeWidth="5"
                strokeDasharray={`${(matchResult.score / 100) * 157} 157`}
                transform="rotate(-90 30 30)"
              />
            </svg>
            <div className="score-text">{matchResult.score}%</div>
          </div>
          <div className="score-details">
            <div className="confidence">
              {getConfidenceEmoji(matchResult.confidence)} {matchResult.confidence} confidence
            </div>
            <div className="workload">
              💼 {getWorkloadCapacity(matchResult.breakdown.workloadScore)}
            </div>
          </div>
        </div>
      </div>

      <div className="skills-section">
        <div className="matched-skills">
          <span className="section-label">✓ Matched Skills:</span>
          <div className="skill-tags">
            {matchResult.matchedSkills.map((skill, idx) => (
              <span 
                key={idx} 
                className="skill-tag matched"
                title={`Has: ${skill.has}, Required: ${skill.required}`}
              >
                {skill.skill} ({skill.score}%)
              </span>
            ))}
          </div>
        </div>
        
        {matchResult.missingSkills.length > 0 && (
          <div className="missing-skills">
            <span className="section-label">✗ Missing Skills:</span>
            <div className="skill-tags">
              {matchResult.missingSkills.map((skill, idx) => (
                <span 
                  key={idx} 
                  className={`skill-tag missing ${skill.impact}`}
                  title={`Required: ${skill.required}, Impact: ${skill.impact}`}
                >
                  {skill.skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {matchResult.partialMatches && matchResult.partialMatches.length > 0 && (
          <div className="partial-skills">
            <span className="section-label">~ Related Skills:</span>
            <div className="skill-tags">
              {matchResult.partialMatches.map((skill, idx) => (
                <span 
                  key={idx} 
                  className="skill-tag partial"
                  title={`Match type: ${skill.matchType}`}
                >
                  {skill.skill} ({skill.score}%)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="recommendation-reason">
        <span className="reason-label">💡 Why recommended?</span>
        <p>{getRecommendationReason()}</p>
      </div>

      <div className="score-breakdown">
        <div className="breakdown-item">
          <span>Skills</span>
          <div className="breakdown-bar">
            <div 
              className="breakdown-fill"
              style={{ width: `${matchResult.breakdown.skillMatch}%` }}
            />
          </div>
          <span>{matchResult.breakdown.skillMatch}%</span>
        </div>
        <div className="breakdown-item">
          <span>Availability</span>
          <div className="breakdown-bar">
            <div 
              className="breakdown-fill"
              style={{ width: `${matchResult.breakdown.availabilityScore}%` }}
            />
          </div>
          <span>{matchResult.breakdown.availabilityScore}%</span>
        </div>
        <div className="breakdown-item">
          <span>Workload</span>
          <div className="breakdown-bar">
            <div 
              className="breakdown-fill"
              style={{ width: `${matchResult.breakdown.workloadScore}%` }}
            />
          </div>
          <span>{matchResult.breakdown.workloadScore}%</span>
        </div>
      </div>

      <div className="card-actions">
        <button 
          className="action-btn primary"
          onClick={onAssign}
        >
          Assign
        </button>
        <button 
          className="action-btn secondary"
          onClick={onViewProfile}
        >
          View Profile
        </button>
        <label className="compare-checkbox">
          <input
            type="checkbox"
            checked={isCompareSelected}
            onChange={onCompareToggle}
          />
          <span>Compare</span>
        </label>
      </div>

      {matchResult.recommendations.length > 0 && (
        <div className="recommendations-list">
          <span className="section-label">📝 Recommendations:</span>
          <ul>
            {matchResult.recommendations.slice(0, 2).map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const LoadingState: React.FC = () => (
  <div className="recommendation-panel loading">
    <div className="panel-header">
      <h4>📊 Calculating Recommendations...</h4>
    </div>
    <div className="loading-cards">
      {[1, 2, 3].map(i => (
        <div key={i} className="loading-card">
          <div className="loading-shimmer" />
        </div>
      ))}
    </div>
  </div>
);

const ErrorState: React.FC<{ message: string; onRetry: () => void }> = ({ 
  message, 
  onRetry 
}) => (
  <div className="recommendation-panel error">
    <div className="panel-header">
      <h4>📊 Recommended Contacts</h4>
    </div>
    <div className="error-state">
      <span className="error-icon">⚠️</span>
      <p>{message}</p>
      <button onClick={onRetry} className="retry-btn">
        Try Again
      </button>
    </div>
  </div>
);

const EmptyState: React.FC<{ showOnlyAvailable: boolean }> = ({ 
  showOnlyAvailable 
}) => (
  <div className="recommendation-panel empty">
    <div className="panel-header">
      <h4>📊 Recommended Contacts</h4>
    </div>
    <div className="empty-state">
      <span className="empty-icon">🔍</span>
      <h5>No suitable contacts found</h5>
      <p>
        {showOnlyAvailable 
          ? 'No available contacts match the requirements. Try removing the availability filter.'
          : 'No contacts match the current requirements.'}
      </p>
      <div className="empty-actions">
        <button className="action-btn secondary">
          Relax Requirements
        </button>
        <button className="action-btn primary">
          Request External Help
        </button>
      </div>
    </div>
  </div>
);

export default ContactRecommendations;