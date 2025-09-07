import React, { useState, useMemo, useRef, useEffect } from 'react';
import SkillBadge from './SkillBadge';
import { ProficiencyLevel } from '../services/skillMatchCalculator';
import skillMatchCalculator from '../services/skillMatchCalculator';
import './EnhancedAddSkillButton.css';

interface Skill {
  name: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  weight: number;
  isRequired?: boolean;
  alternativeSkills?: string[];
}

interface EnhancedAddSkillButtonProps {
  onAddSkill: (skill: Skill) => void;
  existingSkills?: Skill[];
  showWeightsAsPercentages?: boolean;
  allowBatchAdd?: boolean;
  onTestAssignment?: (skills: Skill[]) => void; // For test simulation integration
}

interface SkillSuggestion {
  name: string;
  category: string;
  related: string[];
  popularity: number;
  description?: string;
}

// Expanded skill database with categories and relationships
const SKILL_DATABASE: SkillSuggestion[] = [
  // Frontend
  { name: 'JavaScript', category: 'Frontend', related: ['TypeScript', 'Node.js'], popularity: 95, description: 'Essential web programming language' },
  { name: 'TypeScript', category: 'Frontend', related: ['JavaScript', 'Angular'], popularity: 88, description: 'Typed superset of JavaScript' },
  { name: 'React', category: 'Frontend', related: ['JavaScript', 'Redux', 'Next.js'], popularity: 92, description: 'Popular UI library' },
  { name: 'Vue.js', category: 'Frontend', related: ['JavaScript', 'Nuxt.js'], popularity: 78, description: 'Progressive JavaScript framework' },
  { name: 'Angular', category: 'Frontend', related: ['TypeScript', 'RxJS'], popularity: 75, description: 'Full-featured framework' },
  { name: 'HTML', category: 'Frontend', related: ['CSS', 'JavaScript'], popularity: 98, description: 'Markup language for web' },
  { name: 'CSS', category: 'Frontend', related: ['HTML', 'SASS', 'Tailwind'], popularity: 96, description: 'Styling language' },
  { name: 'SASS', category: 'Frontend', related: ['CSS', 'LESS'], popularity: 65, description: 'CSS preprocessor' },
  { name: 'Tailwind CSS', category: 'Frontend', related: ['CSS'], popularity: 72, description: 'Utility-first CSS framework' },
  
  // Backend
  { name: 'Node.js', category: 'Backend', related: ['JavaScript', 'Express'], popularity: 87, description: 'Server-side JavaScript runtime' },
  { name: 'Python', category: 'Backend', related: ['Django', 'Flask', 'FastAPI'], popularity: 91, description: 'Versatile programming language' },
  { name: 'Java', category: 'Backend', related: ['Spring', 'Maven'], popularity: 85, description: 'Enterprise programming language' },
  { name: 'C#', category: 'Backend', related: ['.NET', 'ASP.NET'], popularity: 73, description: 'Microsoft programming language' },
  { name: 'PHP', category: 'Backend', related: ['Laravel', 'Symfony'], popularity: 69, description: 'Web development language' },
  { name: 'Ruby', category: 'Backend', related: ['Rails'], popularity: 58, description: 'Dynamic programming language' },
  { name: 'Go', category: 'Backend', related: ['Docker', 'Kubernetes'], popularity: 67, description: 'Google systems language' },
  { name: 'Rust', category: 'Backend', related: [], popularity: 52, description: 'Systems programming language' },
  
  // Frameworks
  { name: 'Express.js', category: 'Framework', related: ['Node.js'], popularity: 82, description: 'Node.js web framework' },
  { name: 'Django', category: 'Framework', related: ['Python'], popularity: 78, description: 'Python web framework' },
  { name: 'Flask', category: 'Framework', related: ['Python'], popularity: 71, description: 'Lightweight Python framework' },
  { name: 'Spring', category: 'Framework', related: ['Java'], popularity: 80, description: 'Java enterprise framework' },
  { name: 'Laravel', category: 'Framework', related: ['PHP'], popularity: 74, description: 'PHP web framework' },
  { name: 'Rails', category: 'Framework', related: ['Ruby'], popularity: 61, description: 'Ruby web framework' },
  { name: 'Next.js', category: 'Framework', related: ['React'], popularity: 79, description: 'React production framework' },
  { name: 'Nuxt.js', category: 'Framework', related: ['Vue.js'], popularity: 64, description: 'Vue.js application framework' },
  
  // Databases
  { name: 'SQL', category: 'Database', related: ['PostgreSQL', 'MySQL'], popularity: 89, description: 'Database query language' },
  { name: 'PostgreSQL', category: 'Database', related: ['SQL'], popularity: 83, description: 'Advanced relational database' },
  { name: 'MySQL', category: 'Database', related: ['SQL'], popularity: 81, description: 'Popular relational database' },
  { name: 'MongoDB', category: 'Database', related: ['NoSQL'], popularity: 76, description: 'Document-based database' },
  { name: 'Redis', category: 'Database', related: [], popularity: 68, description: 'In-memory data store' },
  { name: 'Elasticsearch', category: 'Database', related: [], popularity: 59, description: 'Search and analytics engine' },
  
  // DevOps & Cloud
  { name: 'Docker', category: 'DevOps', related: ['Kubernetes', 'Containerization'], popularity: 84, description: 'Containerization platform' },
  { name: 'Kubernetes', category: 'DevOps', related: ['Docker'], popularity: 74, description: 'Container orchestration' },
  { name: 'AWS', category: 'Cloud', related: ['Azure', 'GCP'], popularity: 86, description: 'Amazon cloud services' },
  { name: 'Azure', category: 'Cloud', related: ['AWS', 'GCP'], popularity: 71, description: 'Microsoft cloud platform' },
  { name: 'GCP', category: 'Cloud', related: ['AWS', 'Azure'], popularity: 63, description: 'Google cloud platform' },
  { name: 'Jenkins', category: 'DevOps', related: ['CI/CD'], popularity: 67, description: 'Automation server' },
  { name: 'GitLab CI', category: 'DevOps', related: ['Git', 'CI/CD'], popularity: 62, description: 'Integrated CI/CD' },
  
  // Tools & Others
  { name: 'Git', category: 'Tools', related: ['GitHub', 'GitLab'], popularity: 97, description: 'Version control system' },
  { name: 'API Development', category: 'Backend', related: ['REST', 'GraphQL'], popularity: 88, description: 'Building APIs' },
  { name: 'REST API', category: 'Backend', related: ['API Development'], popularity: 85, description: 'RESTful web services' },
  { name: 'GraphQL', category: 'Backend', related: ['API Development'], popularity: 69, description: 'Query language for APIs' },
  { name: 'Testing', category: 'Quality', related: ['Jest', 'Cypress'], popularity: 84, description: 'Software testing practices' },
  { name: 'Jest', category: 'Testing', related: ['Testing', 'JavaScript'], popularity: 77, description: 'JavaScript testing framework' },
  { name: 'Cypress', category: 'Testing', related: ['Testing', 'E2E'], popularity: 68, description: 'End-to-end testing' },
  
  // Soft Skills & Management
  { name: 'Project Management', category: 'Management', related: ['Agile', 'Scrum'], popularity: 82, description: 'Managing projects effectively' },
  { name: 'Agile', category: 'Methodology', related: ['Scrum', 'Kanban'], popularity: 79, description: 'Agile development methodology' },
  { name: 'Scrum', category: 'Methodology', related: ['Agile'], popularity: 76, description: 'Scrum framework' },
  { name: 'Team Leadership', category: 'Management', related: ['Project Management'], popularity: 74, description: 'Leading development teams' },
  { name: 'UI/UX Design', category: 'Design', related: ['Figma', 'Adobe'], popularity: 71, description: 'User interface design' },
  { name: 'Figma', category: 'Design', related: ['UI/UX Design'], popularity: 73, description: 'Design collaboration tool' },
];

const EnhancedAddSkillButton: React.FC<EnhancedAddSkillButtonProps> = ({ 
  onAddSkill, 
  existingSkills = [], 
  showWeightsAsPercentages = false,
  allowBatchAdd = false,
  onTestAssignment
}) => {
  // State management
  const [showModal, setShowModal] = useState(false);
  const [skillName, setSkillName] = useState('');
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'advanced' | 'expert'>('intermediate');
  const [weight, setWeight] = useState(5);
  const [isRequired, setIsRequired] = useState(true);
  const [alternativeSkills, setAlternativeSkills] = useState<string[]>([]);
  const [batchSkills, setBatchSkills] = useState<Skill[]>([]);
  const [showPreview, setShowPreview] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Autocomplete state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<SkillSuggestion[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(SKILL_DATABASE.map(s => s.category)));
    return ['all', ...cats.sort()];
  }, []);

  // Filter and sort suggestions
  const suggestions = useMemo(() => {
    let filtered = SKILL_DATABASE;
    
    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(s => s.category === selectedCategory);
    }
    
    // Filter by search term
    if (skillName.length > 0) {
      const searchTerm = skillName.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchTerm) ||
        s.description?.toLowerCase().includes(searchTerm) ||
        s.related.some(r => r.toLowerCase().includes(searchTerm))
      );
    }
    
    // Remove already added skills
    filtered = filtered.filter(s => 
      !existingSkills.some(existing => 
        existing.name.toLowerCase() === s.name.toLowerCase()
      )
    );
    
    // Sort by relevance (exact match first, then popularity)
    return filtered.sort((a, b) => {
      const aExact = a.name.toLowerCase().startsWith(skillName.toLowerCase());
      const bExact = b.name.toLowerCase().startsWith(skillName.toLowerCase());
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      return b.popularity - a.popularity;
    }).slice(0, 10);
  }, [skillName, selectedCategory, existingSkills]);

  // Update suggestions when input changes
  useEffect(() => {
    setFilteredSuggestions(suggestions);
    setHighlightedIndex(-1);
    setShowSuggestions(skillName.length > 0 && suggestions.length > 0);
  }, [suggestions, skillName]);

  // Get weight category and validation
  const weightCategory = getWeightCategory(weight);
  const weightLabel = getWeightLabel(weight);
  const isDuplicate = existingSkills.some(skill => 
    skill.name.toLowerCase() === skillName.toLowerCase()
  );
  
  // Get related skills for current input
  const relatedSkills = useMemo(() => {
    if (!skillName) return [];
    
    const skill = SKILL_DATABASE.find(s => 
      s.name.toLowerCase() === skillName.toLowerCase()
    );
    
    if (!skill) return [];
    
    // Also check skill taxonomy
    const taxonomy = skillMatchCalculator.getSkillTaxonomy(skillName);
    const taxonomyRelated = taxonomy?.related || [];
    
    return Array.from(new Set([...skill.related, ...taxonomyRelated]));
  }, [skillName]);

  // Calculate total weight for normalization
  const totalWeight = useMemo(() => {
    return [...existingSkills, ...batchSkills].reduce((sum, skill) => sum + skill.weight, 0) + weight;
  }, [existingSkills, batchSkills, weight]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
          selectSuggestion(filteredSuggestions[highlightedIndex]);
        } else {
          handleAdd();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const selectSuggestion = (suggestion: SkillSuggestion) => {
    setSkillName(suggestion.name);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    
    // Auto-suggest level based on popularity/complexity
    if (suggestion.popularity > 80) {
      setLevel('intermediate');
    } else if (suggestion.popularity > 60) {
      setLevel('advanced');
    }
  };

  const handleAdd = () => {
    if (!skillName.trim() || isDuplicate) return;

    const newSkill: Skill = {
      name: skillName.trim(),
      level,
      weight,
      isRequired,
      alternativeSkills: alternativeSkills.length > 0 ? alternativeSkills : undefined
    };

    if (allowBatchAdd) {
      setBatchSkills(prev => [...prev, newSkill]);
    } else {
      onAddSkill(newSkill);
    }

    resetForm();
  };

  const handleBatchAdd = () => {
    batchSkills.forEach(skill => onAddSkill(skill));
    setBatchSkills([]);
    setShowModal(false);
  };

  const handleTestAssignment = () => {
    if (onTestAssignment) {
      const allSkills = [...existingSkills, ...batchSkills];
      if (skillName.trim() && !isDuplicate) {
        allSkills.push({
          name: skillName.trim(),
          level,
          weight,
          isRequired,
          alternativeSkills: alternativeSkills.length > 0 ? alternativeSkills : undefined
        });
      }
      onTestAssignment(allSkills);
    }
  };

  const resetForm = () => {
    setSkillName('');
    setLevel('intermediate');
    setWeight(5);
    setIsRequired(true);
    setAlternativeSkills([]);
    setShowSuggestions(false);
    setHighlightedIndex(-1);
    
    if (!allowBatchAdd) {
      setShowModal(false);
    }
  };

  const removeBatchSkill = (index: number) => {
    setBatchSkills(prev => prev.filter((_, i) => i !== index));
  };

  const addAlternativeSkill = (skillName: string) => {
    if (!alternativeSkills.includes(skillName)) {
      setAlternativeSkills(prev => [...prev, skillName]);
    }
  };

  const removeAlternativeSkill = (skillName: string) => {
    setAlternativeSkills(prev => prev.filter(s => s !== skillName));
  };

  const normalizeWeights = () => {
    if (totalWeight === 0) return;
    
    const normalizedWeight = Math.round((weight / totalWeight) * 100);
    setWeight(normalizedWeight);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="enhanced-add-skill-btn"
      >
        <svg className="add-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Skill
        {existingSkills.length > 0 && (
          <span className="skill-count">{existingSkills.length}</span>
        )}
      </button>

      {showModal && (
        <div className="enhanced-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="enhanced-modal">
            <div className="modal-header">
              <h3>Add Required Skill</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="close-btn"
              >
                ✗
              </button>
            </div>

            <div className="modal-content">
              {/* Category Filter */}
              <div className="form-group">
                <label>Skill Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="category-select"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Skill Name Input with Autocomplete */}
              <div className="form-group">
                <label>Skill Name</label>
                <div className="autocomplete-container">
                  <input
                    ref={inputRef}
                    type="text"
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className={`skill-input ${isDuplicate ? 'error' : ''}`}
                    placeholder="Start typing to search skills..."
                  />
                  
                  {showSuggestions && (
                    <div ref={suggestionsRef} className="suggestions-dropdown">
                      {filteredSuggestions.map((suggestion, index) => (
                        <div
                          key={suggestion.name}
                          className={`suggestion-item ${index === highlightedIndex ? 'highlighted' : ''}`}
                          onClick={() => selectSuggestion(suggestion)}
                        >
                          <div className="suggestion-main">
                            <span className="suggestion-name">{suggestion.name}</span>
                            <span className="suggestion-category">{suggestion.category}</span>
                            <span className="suggestion-popularity">{suggestion.popularity}% popular</span>
                          </div>
                          {suggestion.description && (
                            <div className="suggestion-description">{suggestion.description}</div>
                          )}
                          {suggestion.related.length > 0 && (
                            <div className="suggestion-related">
                              Related: {suggestion.related.slice(0, 3).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {isDuplicate && (
                  <div className="error-message">This skill is already added</div>
                )}
              </div>

              {/* Proficiency Level */}
              <div className="form-group">
                <label>Proficiency Level</label>
                <div className="level-selector">
                  {(['beginner', 'intermediate', 'advanced', 'expert'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLevel(lvl)}
                      className={`level-btn ${level === lvl ? 'active' : ''} level-${lvl}`}
                    >
                      {getLevelIcon(lvl)} {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weight/Importance Slider */}
              <div className="form-group">
                <label>
                  Importance (Weight: {weight} - {weightLabel})
                  {totalWeight !== 100 && totalWeight > 0 && (
                    <button onClick={normalizeWeights} className="normalize-btn">
                      Normalize to 100%
                    </button>
                  )}
                </label>
                <div className="weight-slider-container">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={weight}
                    onChange={(e) => setWeight(parseInt(e.target.value))}
                    className={`weight-slider ${weightCategory}`}
                  />
                  <div className="weight-labels">
                    <span className="weight-label nice-to-have">1-3: Nice to have</span>
                    <span className="weight-label important">4-7: Important</span>
                    <span className="weight-label critical">8-10: Critical</span>
                  </div>
                </div>
                {showWeightsAsPercentages && totalWeight > 0 && (
                  <div className="weight-percentage">
                    {Math.round((weight / totalWeight) * 100)}% of total weight
                  </div>
                )}
              </div>

              {/* Required Skill Toggle */}
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isRequired}
                    onChange={(e) => setIsRequired(e.target.checked)}
                  />
                  <span>This is a required skill (must-have vs nice-to-have)</span>
                </label>
              </div>

              {/* Alternative Skills */}
              {relatedSkills.length > 0 && (
                <div className="form-group">
                  <label>Alternative/Related Skills</label>
                  <div className="related-skills">
                    {relatedSkills.map(skill => (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => addAlternativeSkill(skill)}
                        className={`related-skill-btn ${alternativeSkills.includes(skill) ? 'selected' : ''}`}
                      >
                        {skill}
                      </button>
                    ))}
                  </div>
                  {alternativeSkills.length > 0 && (
                    <div className="selected-alternatives">
                      <span>Selected alternatives:</span>
                      {alternativeSkills.map(skill => (
                        <span key={skill} className="alternative-tag">
                          {skill}
                          <button onClick={() => removeAlternativeSkill(skill)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Skill Preview */}
              {showPreview && skillName && (
                <div className="form-group">
                  <label>Preview</label>
                  <SkillBadge
                    skillName={skillName}
                    level={convertLevel(level)}
                    weight={weight}
                    showWeight={true}
                    showProgression={true}
                    editable={false}
                    className="preview-badge"
                  />
                </div>
              )}

              {/* Batch Skills Display */}
              {allowBatchAdd && batchSkills.length > 0 && (
                <div className="form-group">
                  <label>Skills to Add ({batchSkills.length})</label>
                  <div className="batch-skills-list">
                    {batchSkills.map((skill, index) => (
                      <div key={index} className="batch-skill-item">
                        <SkillBadge
                          skillName={skill.name}
                          level={convertLevel(skill.level)}
                          weight={skill.weight}
                          showWeight={true}
                          onDelete={() => removeBatchSkill(index)}
                          editable={true}
                          compact={true}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="modal-actions">
              <button
                onClick={() => setShowModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              
              {onTestAssignment && (
                <button
                  onClick={handleTestAssignment}
                  className="test-btn"
                >
                  🧪 Test Assignment
                </button>
              )}
              
              {allowBatchAdd && batchSkills.length > 0 && (
                <button
                  onClick={handleBatchAdd}
                  className="batch-add-btn"
                >
                  Add All ({batchSkills.length})
                </button>
              )}
              
              <button
                onClick={handleAdd}
                disabled={!skillName.trim() || isDuplicate}
                className="add-btn primary"
              >
                {allowBatchAdd ? 'Add to Batch' : 'Add Skill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// Helper functions
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

function getLevelIcon(level: string): string {
  switch (level) {
    case 'beginner': return '⭐';
    case 'intermediate': return '⭐⭐';
    case 'advanced': return '⭐⭐⭐';
    case 'expert': return '⭐⭐⭐⭐';
    default: return '⭐⭐';
  }
}

function convertLevel(level: string): ProficiencyLevel {
  switch (level) {
    case 'beginner': return ProficiencyLevel.BEGINNER;
    case 'intermediate': return ProficiencyLevel.INTERMEDIATE;
    case 'advanced': return ProficiencyLevel.ADVANCED;
    case 'expert': return ProficiencyLevel.EXPERT;
    default: return ProficiencyLevel.INTERMEDIATE;
  }
}

export default EnhancedAddSkillButton;
export type { Skill, EnhancedAddSkillButtonProps };