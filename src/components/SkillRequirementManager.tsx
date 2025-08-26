import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { SkillRequirement, ProficiencyLevel } from '../services/skillMatchCalculator';
import SkillBadge, { DraggableSkillBadge } from './SkillBadge';
import './SkillRequirementManager.css';

interface SkillRequirementManagerProps {
  requirements: SkillRequirement[];
  onChange: (requirements: SkillRequirement[]) => void;
  availableSkills?: string[]; // For autocomplete
  showWeightsAsPercentages?: boolean;
}

interface AddSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (requirement: SkillRequirement) => void;
  availableSkills: string[];
  existingSkills: string[];
}

interface SkillItemProps {
  requirement: SkillRequirement;
  index: number;
  totalWeight: number;
  showAsPercentage: boolean;
  onUpdate: (index: number, requirement: SkillRequirement) => void;
  onRemove: (index: number) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  isDragging: boolean;
  dragOverIndex: number | null;
}

// Default skills database for autocomplete
const DEFAULT_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Vue.js', 'Angular', 'Node.js',
  'Python', 'Django', 'Flask', 'Java', 'Spring', 'C#', '.NET',
  'PHP', 'Laravel', 'Ruby', 'Rails', 'Go', 'Rust', 'Swift',
  'HTML', 'CSS', 'SASS', 'LESS', 'Bootstrap', 'Tailwind CSS',
  'SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Jenkins',
  'Git', 'GitHub', 'GitLab', 'Jira', 'Confluence',
  'API Development', 'REST API', 'GraphQL', 'Microservices',
  'Testing', 'Unit Testing', 'Integration Testing', 'Jest', 'Cypress',
  'Agile', 'Scrum', 'Project Management', 'Team Leadership',
  'UI/UX Design', 'Figma', 'Adobe Creative Suite', 'Sketch'
];

const SkillRequirementManager: React.FC<SkillRequirementManagerProps> = ({
  requirements,
  onChange,
  availableSkills = DEFAULT_SKILLS,
  showWeightsAsPercentages = false
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showAsPercentage, setShowAsPercentage] = useState(showWeightsAsPercentages);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [animatingItems, setAnimatingItems] = useState<Set<number>>(new Set());

  // Calculate total weight and percentages
  const totalWeight = useMemo(() => {
    return requirements.reduce((sum, req) => sum + req.weight, 0);
  }, [requirements]);

  const normalizedRequirements = useMemo(() => {
    if (totalWeight === 0) return requirements;
    return requirements.map(req => ({
      ...req,
      normalizedWeight: Math.round((req.weight / totalWeight) * 100)
    }));
  }, [requirements, totalWeight]);

  const handleAddSkill = useCallback((newRequirement: SkillRequirement) => {
    const updatedRequirements = [...requirements, newRequirement];
    onChange(updatedRequirements);
    setIsModalOpen(false);
    
    // Animate the new item
    setTimeout(() => {
      setAnimatingItems(new Set([requirements.length]));
      setTimeout(() => setAnimatingItems(new Set()), 500);
    }, 50);
  }, [requirements, onChange]);

  const handleUpdateSkill = useCallback((index: number, updatedRequirement: SkillRequirement) => {
    const updatedRequirements = [...requirements];
    updatedRequirements[index] = updatedRequirement;
    onChange(updatedRequirements);
  }, [requirements, onChange]);

  const handleRemoveSkill = useCallback((index: number) => {
    setAnimatingItems(new Set([index]));
    setTimeout(() => {
      const updatedRequirements = requirements.filter((_, i) => i !== index);
      onChange(updatedRequirements);
      setAnimatingItems(new Set());
    }, 300);
  }, [requirements, onChange]);

  const handleNormalizeWeights = useCallback(() => {
    if (totalWeight === 0) return;
    
    const normalizedRequirements = requirements.map(req => ({
      ...req,
      weight: Math.round((req.weight / totalWeight) * 100)
    }));
    onChange(normalizedRequirements);
  }, [requirements, totalWeight, onChange]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
    
    if (dragIndex === dropIndex) return;

    const updatedRequirements = [...requirements];
    const [draggedItem] = updatedRequirements.splice(dragIndex, 1);
    updatedRequirements.splice(dropIndex, 0, draggedItem);
    
    onChange(updatedRequirements);
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [requirements, onChange]);

  const handleDragEnter = useCallback((index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const getWeightCategory = (weight: number) => {
    if (weight >= 8) return 'critical';
    if (weight >= 4) return 'important';
    return 'nice-to-have';
  };

  const getWeightLabel = (weight: number) => {
    if (weight >= 8) return 'Critical';
    if (weight >= 4) return 'Important';
    return 'Nice to have';
  };

  return (
    <div className="skill-requirement-manager">
      <div className="skills-header">
        <h4>Required Skills</h4>
        <div className="header-controls">
          <label className="percentage-toggle">
            <input
              type="checkbox"
              checked={showAsPercentage}
              onChange={(e) => setShowAsPercentage(e.target.checked)}
            />
            <span>Show as %</span>
          </label>
        </div>
      </div>

      <div className="skills-list" data-testid="skills-list">
        {requirements.map((requirement, index) => (
          <div 
            key={`${requirement.skillName}-${index}`}
            className="skill-requirement-wrapper"
            onDragEnter={() => handleDragEnter(index)}
            onDragLeave={handleDragLeave}
          >
            <DraggableSkillBadge
              skillName={requirement.skillName}
              level={requirement.requiredLevel}
              weight={requirement.weight}
              showWeight={showAsPercentage}
              showProgression={true}
              onEdit={() => {
                // Handle inline editing - could open a modal or enable inline editing
                console.log('Edit skill:', requirement.skillName);
              }}
              onDelete={() => handleRemoveSkill(index)}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className={`skill-requirement-badge ${draggedIndex === index ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
              animated={animatingItems.has(index)}
            />
          </div>
        ))}
        
        {requirements.length === 0 && (
          <div className="empty-skills">
            <span className="empty-icon">🎯</span>
            <p>No skills added yet</p>
            <p className="empty-hint">Click "Add Skill" to get started</p>
          </div>
        )}
      </div>

      <div className="skills-summary">
        <div className="weight-distribution">
          <div className="total-weight">
            <span className="weight-label">Total Weight:</span>
            <span className="weight-value">{totalWeight} points</span>
            {totalWeight !== 100 && totalWeight > 0 && (
              <button 
                className="normalize-btn"
                onClick={handleNormalizeWeights}
                title="Normalize weights to 100%"
              >
                Normalize to 100%
              </button>
            )}
          </div>
          
          {requirements.length > 0 && (
            <WeightDistributionBar requirements={normalizedRequirements} />
          )}
        </div>
        
        <div className="weight-explanation">
          <span className="tooltip-icon" title="Weights help prioritize skills. Higher weight = more critical">
            ℹ️ Weights help prioritize skills. Higher weight = more critical
          </span>
        </div>
      </div>

      <div className="add-skill-section">
        <button 
          className="add-skill-btn"
          onClick={() => setIsModalOpen(true)}
        >
          <span className="add-icon">+</span>
          Add Skill
        </button>
      </div>

      <AddSkillModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddSkill}
        availableSkills={availableSkills}
        existingSkills={requirements.map(req => req.skillName)}
      />
    </div>
  );
};

const SkillItem: React.FC<SkillItemProps> = ({
  requirement,
  index,
  totalWeight,
  showAsPercentage,
  onUpdate,
  onRemove,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  dragOverIndex
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editWeight, setEditWeight] = useState(requirement.weight);
  const [editLevel, setEditLevel] = useState(requirement.requiredLevel);

  const percentage = totalWeight > 0 ? Math.round((requirement.weight / totalWeight) * 100) : 0;
  const weightCategory = getWeightCategory(requirement.weight);
  const weightLabel = getWeightLabel(requirement.weight);

  const handleSaveEdit = () => {
    onUpdate(index, {
      ...requirement,
      weight: editWeight,
      requiredLevel: editLevel
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditWeight(requirement.weight);
    setEditLevel(requirement.requiredLevel);
    setIsEditing(false);
  };

  const levelToString = (level: ProficiencyLevel) => {
    switch (level) {
      case ProficiencyLevel.BEGINNER: return 'Beginner';
      case ProficiencyLevel.INTERMEDIATE: return 'Intermediate';
      case ProficiencyLevel.ADVANCED: return 'Advanced';
      case ProficiencyLevel.EXPERT: return 'Expert';
      default: return 'Intermediate';
    }
  };

  return (
    <div 
      className={`skill-item ${weightCategory} ${isDragging ? 'dragging' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
      draggable={!isEditing}
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      onDragEnter={() => {}}
      onDragLeave={() => {}}
    >
      <div className="drag-handle" title="Drag to reorder">
        ⋮⋮
      </div>
      
      <div className="skill-content">
        <div className="skill-main">
          <span className="skill-name">{requirement.skillName}</span>
          <span className="skill-level">
            {isEditing ? (
              <select
                value={editLevel}
                onChange={(e) => setEditLevel(parseInt(e.target.value) as ProficiencyLevel)}
                className="level-select"
              >
                <option value={ProficiencyLevel.BEGINNER}>Beginner</option>
                <option value={ProficiencyLevel.INTERMEDIATE}>Intermediate</option>
                <option value={ProficiencyLevel.ADVANCED}>Advanced</option>
                <option value={ProficiencyLevel.EXPERT}>Expert</option>
              </select>
            ) : (
              levelToString(requirement.requiredLevel)
            )}
          </span>
        </div>
        
        <div className="skill-weight">
          {isEditing ? (
            <div className="weight-editor">
              <input
                type="range"
                min="1"
                max="10"
                value={editWeight}
                onChange={(e) => setEditWeight(parseInt(e.target.value))}
                className={`weight-slider ${getWeightCategory(editWeight)}`}
              />
              <span className="weight-display">
                Weight: {editWeight} ({getWeightLabel(editWeight)})
              </span>
            </div>
          ) : (
            <span className="weight-display">
              Weight: {requirement.weight}
              {showAsPercentage && ` (${percentage}%)`}
              <span className="weight-category"> - {weightLabel}</span>
            </span>
          )}
        </div>
      </div>

      <div className="skill-actions">
        {isEditing ? (
          <div className="edit-actions">
            <button className="save-btn" onClick={handleSaveEdit}>✓</button>
            <button className="cancel-btn" onClick={handleCancelEdit}>✗</button>
          </div>
        ) : (
          <div className="view-actions">
            <button 
              className="edit-btn"
              onClick={() => setIsEditing(true)}
              title="Edit skill"
            >
              ✏️
            </button>
            <button 
              className="remove-btn"
              onClick={() => onRemove(index)}
              title="Remove skill"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const AddSkillModal: React.FC<AddSkillModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  availableSkills,
  existingSkills
}) => {
  const [skillName, setSkillName] = useState('');
  const [requiredLevel, setRequiredLevel] = useState<ProficiencyLevel>(ProficiencyLevel.INTERMEDIATE);
  const [weight, setWeight] = useState(5);
  const [isRequired, setIsRequired] = useState(true);
  const [filteredSkills, setFilteredSkills] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const skillInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      skillInputRef.current?.focus();
      setSkillName('');
      setRequiredLevel(ProficiencyLevel.INTERMEDIATE);
      setWeight(5);
      setIsRequired(true);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (skillName.length > 0) {
      const filtered = availableSkills
        .filter(skill => 
          skill.toLowerCase().includes(skillName.toLowerCase()) &&
          !existingSkills.includes(skill)
        )
        .slice(0, 8);
      setFilteredSkills(filtered);
      setShowSuggestions(true);
    } else {
      setFilteredSkills([]);
      setShowSuggestions(false);
    }
  }, [skillName, availableSkills, existingSkills]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!skillName.trim()) {
      setError('Skill name is required');
      return;
    }

    if (existingSkills.includes(skillName.trim())) {
      setError('This skill is already added');
      return;
    }

    const newRequirement: SkillRequirement = {
      skillName: skillName.trim(),
      requiredLevel,
      weight,
      isRequired
    };

    onAdd(newRequirement);
    setError('');
  };

  const handleSkillSelect = (skill: string) => {
    setSkillName(skill);
    setShowSuggestions(false);
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getWeightCategory = (weight: number) => {
    if (weight >= 8) return 'critical';
    if (weight >= 4) return 'important';
    return 'nice-to-have';
  };

  const getWeightLabel = (weight: number) => {
    if (weight >= 8) return 'Critical';
    if (weight >= 4) return 'Important';
    return 'Nice to have';
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="add-skill-modal" ref={modalRef}>
        <div className="modal-header">
          <h3>Add New Skill</h3>
          <button className="close-btn" onClick={onClose}>✗</button>
        </div>

        <form onSubmit={handleSubmit} className="skill-form">
          <div className="form-group">
            <label htmlFor="skillName">Skill Name</label>
            <div className="autocomplete-container">
              <input
                id="skillName"
                ref={skillInputRef}
                type="text"
                value={skillName}
                onChange={(e) => setSkillName(e.target.value)}
                placeholder="e.g., JavaScript, React, Project Management"
                className={error ? 'error' : ''}
                autoComplete="off"
              />
              
              {showSuggestions && filteredSkills.length > 0 && (
                <div className="suggestions-dropdown">
                  {filteredSkills.map((skill, index) => (
                    <button
                      key={index}
                      type="button"
                      className="suggestion-item"
                      onClick={() => handleSkillSelect(skill)}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {error && <span className="error-text">{error}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="requiredLevel">Required Level</label>
            <select
              id="requiredLevel"
              value={requiredLevel}
              onChange={(e) => setRequiredLevel(parseInt(e.target.value) as ProficiencyLevel)}
              className="level-select"
            >
              <option value={ProficiencyLevel.BEGINNER}>Beginner</option>
              <option value={ProficiencyLevel.INTERMEDIATE}>Intermediate</option>
              <option value={ProficiencyLevel.ADVANCED}>Advanced</option>
              <option value={ProficiencyLevel.EXPERT}>Expert</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="weight">
              Importance Weight: {weight} ({getWeightLabel(weight)})
            </label>
            <input
              id="weight"
              type="range"
              min="1"
              max="10"
              value={weight}
              onChange={(e) => setWeight(parseInt(e.target.value))}
              className={`weight-slider ${getWeightCategory(weight)}`}
            />
            <div className="weight-labels">
              <span className="weight-label nice-to-have">1-3: Nice to have</span>
              <span className="weight-label important">4-7: Important</span>
              <span className="weight-label critical">8-10: Critical</span>
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
              />
              <span>This is a required skill</span>
            </label>
          </div>

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Add Skill
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WeightDistributionBar: React.FC<{ requirements: any[] }> = ({ requirements }) => {
  const totalWeight = requirements.reduce((sum, req) => sum + req.weight, 0);
  
  return (
    <div className="weight-distribution-bar">
      <div className="distribution-visual">
        {requirements.map((req, index) => {
          const percentage = (req.weight / totalWeight) * 100;
          const category = getWeightCategory(req.weight);
          
          return (
            <div
              key={index}
              className={`weight-segment ${category}`}
              style={{ width: `${percentage}%` }}
              title={`${req.skillName}: ${req.weight} points (${Math.round(percentage)}%)`}
            />
          );
        })}
      </div>
      
      <div className="distribution-legend">
        <div className="legend-item">
          <span className="legend-color critical"></span>
          <span>Critical (8-10)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color important"></span>
          <span>Important (4-7)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color nice-to-have"></span>
          <span>Nice to have (1-3)</span>
        </div>
      </div>
    </div>
  );
};

// Helper function
function getWeightCategory(weight: number): string {
  if (weight >= 8) return 'critical';
  if (weight >= 4) return 'important';
  return 'nice-to-have';
}

function getWeightLabel(weight: number): string {
  if (weight >= 8) return 'Critical';
  if (weight >= 4) return 'Important';
  return 'Nice to have';
}

export default SkillRequirementManager;