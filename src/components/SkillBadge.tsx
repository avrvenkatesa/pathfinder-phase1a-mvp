import React, { useState, useRef, useEffect } from 'react';
import { ProficiencyLevel } from '../services/skillMatchCalculator';
import './SkillBadge.css';

interface SkillBadgeProps {
  skillName: string;
  level: ProficiencyLevel | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  weight?: number;
  onDelete?: () => void;
  onEdit?: () => void;
  showWeight?: boolean;
  showProgression?: boolean;
  compact?: boolean;
  editable?: boolean;
  animated?: boolean;
  className?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

interface TooltipProps {
  level: string;
  weight?: number;
  children: React.ReactNode;
  disabled?: boolean;
}

interface ProgressionIndicatorProps {
  currentLevel: string;
  compact?: boolean;
}

const SkillBadge: React.FC<SkillBadgeProps> = ({
  skillName,
  level,
  weight,
  onDelete,
  onEdit,
  showWeight = false,
  showProgression = false,
  compact = false,
  editable = true,
  animated = true,
  className = '',
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const badgeRef = useRef<HTMLDivElement>(null);

  // Normalize level to string
  const normalizedLevel = normalizeLevel(level);
  const levelConfig = getLevelConfig(normalizedLevel);
  const weightCategory = weight ? getWeightCategory(weight) : 'normal';

  // Animate on level change
  useEffect(() => {
    if (animated) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 300);
      return () => clearTimeout(timer);
    }
  }, [level, animated]);

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.key === 'Enter' && onEdit) {
        onEdit();
      }
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (onDelete) {
        onDelete();
      }
    }
  };

  return (
    <SkillTooltip 
      level={normalizedLevel} 
      weight={weight} 
      disabled={compact}
    >
      <div
        ref={badgeRef}
        className={`skill-badge ${levelConfig.className} ${weightCategory} ${compact ? 'compact' : ''} ${isAnimating ? 'animating' : ''} ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        tabIndex={editable ? 0 : -1}
        onKeyDown={handleKeyDown}
        role="button"
        aria-label={`${skillName} skill, ${normalizedLevel} level${weight ? `, weight ${weight}` : ''}${editable ? ', press Enter to edit, Delete to remove' : ''}`}
        aria-describedby={`${skillName}-tooltip`}
      >
        {/* Drag Handle (if draggable) */}
        {draggable && (
          <div className="drag-handle" aria-hidden="true">
            <span className="drag-dots">⋮⋮</span>
          </div>
        )}

        {/* Level Icon */}
        <div className="level-icon" aria-hidden="true">
          {levelConfig.icon}
        </div>

        {/* Skill Name */}
        <span className="skill-name">{skillName}</span>

        {/* Level Text (hidden on compact) */}
        {!compact && (
          <span className="level-text" aria-hidden="true">
            {levelConfig.label}
          </span>
        )}

        {/* Weight Display */}
        {showWeight && weight !== undefined && (
          <span className="skill-weight">
            <span className="weight-label" aria-hidden="true">Weight:</span>
            <span className="weight-value">{weight}</span>
          </span>
        )}

        {/* Progression Indicator */}
        {showProgression && !compact && (
          <ProgressionIndicator currentLevel={normalizedLevel} />
        )}

        {/* Action Buttons */}
        <div className="skill-actions">
          {onEdit && editable && (
            <button
              className="edit-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="Edit skill"
              aria-label={`Edit ${skillName} skill`}
            >
              ✏️
            </button>
          )}
          
          {onDelete && editable && (
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Remove skill"
              aria-label={`Remove ${skillName} skill`}
            >
              ❌
            </button>
          )}
        </div>

        {/* Hover Effect Overlay */}
        {isHovered && !compact && (
          <div className="hover-overlay" aria-hidden="true" />
        )}
      </div>
    </SkillTooltip>
  );
};

const SkillTooltip: React.FC<TooltipProps> = ({ 
  level, 
  weight, 
  children, 
  disabled = false 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (disabled) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setIsVisible(true);
  };

  const handleMouseLeave = () => {
    setIsVisible(false);
  };

  const getTooltipContent = () => {
    const levelConfig = getLevelConfig(level);
    const baseText = `Requires ${levelConfig.label} level proficiency`;
    
    if (weight !== undefined) {
      const weightLabel = getWeightLabel(weight);
      return `${baseText} (${weightLabel} - ${weight}/10)`;
    }
    
    return baseText;
  };

  return (
    <div
      className="tooltip-container"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {isVisible && !disabled && (
        <div
          ref={tooltipRef}
          className="skill-tooltip"
          style={{
            position: 'fixed',
            left: `${position.x}px`,
            top: `${position.y}px`,
            transform: 'translateX(-50%) translateY(-100%)',
            zIndex: 1000
          }}
          role="tooltip"
          aria-hidden="false"
        >
          <div className="tooltip-content">
            {getTooltipContent()}
          </div>
          <div className="tooltip-arrow" />
        </div>
      )}
    </div>
  );
};

const ProgressionIndicator: React.FC<ProgressionIndicatorProps> = ({ 
  currentLevel, 
  compact = false 
}) => {
  const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
  const currentIndex = levels.indexOf(currentLevel);

  if (compact) {
    return (
      <div className="progression-compact" aria-hidden="true">
        <span className="current-step">{currentIndex + 1}</span>
        <span className="total-steps">/{levels.length}</span>
      </div>
    );
  }

  return (
    <div 
      className="progression-indicator"
      aria-label={`Progression: ${currentLevel} (${currentIndex + 1} of ${levels.length})`}
    >
      <div className="progression-line">
        {levels.map((levelName, index) => {
          const isActive = index <= currentIndex;
          const isCurrent = index === currentIndex;
          const levelConfig = getLevelConfig(levelName);
          
          return (
            <div
              key={levelName}
              className={`progression-step ${isActive ? 'active' : ''} ${isCurrent ? 'current' : ''}`}
              title={levelConfig.label}
            >
              <div className={`step-icon ${levelConfig.className}`}>
                {levelConfig.shortIcon}
              </div>
              {index < levels.length - 1 && (
                <div className={`step-connector ${isActive ? 'active' : ''}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Utility Functions
function normalizeLevel(level: ProficiencyLevel | string): string {
  if (typeof level === 'number') {
    switch (level) {
      case ProficiencyLevel.BEGINNER: return 'beginner';
      case ProficiencyLevel.INTERMEDIATE: return 'intermediate';
      case ProficiencyLevel.ADVANCED: return 'advanced';
      case ProficiencyLevel.EXPERT: return 'expert';
      default: return 'intermediate';
    }
  }
  return level.toLowerCase();
}

function getLevelConfig(level: string) {
  switch (level) {
    case 'beginner':
      return {
        className: 'level-beginner',
        label: 'Beginner',
        icon: '⭐',
        shortIcon: 'B',
        description: 'Basic understanding and limited experience'
      };
    case 'intermediate':
      return {
        className: 'level-intermediate',
        label: 'Intermediate',
        icon: '⭐⭐',
        shortIcon: 'I',
        description: 'Good working knowledge and practical experience'
      };
    case 'advanced':
      return {
        className: 'level-advanced',
        label: 'Advanced',
        icon: '⭐⭐⭐',
        shortIcon: 'A',
        description: 'Deep expertise and extensive experience'
      };
    case 'expert':
      return {
        className: 'level-expert',
        label: 'Expert',
        icon: '⭐⭐⭐⭐',
        shortIcon: 'E',
        description: 'Mastery level with ability to teach and innovate'
      };
    default:
      return {
        className: 'level-intermediate',
        label: 'Intermediate',
        icon: '⭐⭐',
        shortIcon: 'I',
        description: 'Good working knowledge and practical experience'
      };
  }
}

function getWeightCategory(weight: number): string {
  if (weight >= 8) return 'critical';
  if (weight >= 4) return 'important';
  return 'normal';
}

function getWeightLabel(weight: number): string {
  if (weight >= 8) return 'Critical';
  if (weight >= 4) return 'Important';
  return 'Nice to have';
}

// Variant Components for Different Use Cases
export const CompactSkillBadge: React.FC<Omit<SkillBadgeProps, 'compact'>> = (props) => (
  <SkillBadge {...props} compact={true} />
);

export const EditableSkillBadge: React.FC<SkillBadgeProps> = (props) => (
  <SkillBadge {...props} editable={true} animated={true} />
);

export const ReadOnlySkillBadge: React.FC<Omit<SkillBadgeProps, 'onDelete' | 'onEdit' | 'editable'>> = (props) => (
  <SkillBadge {...props} editable={false} />
);

export const DraggableSkillBadge: React.FC<SkillBadgeProps> = (props) => (
  <SkillBadge {...props} draggable={true} />
);

// Hook for managing skill badge interactions
export const useSkillBadge = (skillName: string, initialLevel: string, initialWeight?: number) => {
  const [level, setLevel] = useState(initialLevel);
  const [weight, setWeight] = useState(initialWeight || 5);
  const [isEditing, setIsEditing] = useState(false);

  const handleEdit = () => setIsEditing(true);
  const handleSave = (newLevel: string, newWeight: number) => {
    setLevel(newLevel);
    setWeight(newWeight);
    setIsEditing(false);
  };
  const handleCancel = () => setIsEditing(false);

  return {
    level,
    weight,
    isEditing,
    handleEdit,
    handleSave,
    handleCancel,
    setLevel,
    setWeight
  };
};

export default SkillBadge;