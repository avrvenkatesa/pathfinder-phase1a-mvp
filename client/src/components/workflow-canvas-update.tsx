import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3x3,
  Trash2,
  Settings,
  Hand,
  Minimize2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  MousePointer,
  Copy,
  MoreHorizontal,
  CheckSquare,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import ContactSelector from './ContactSelector';
import ContactAvailabilityIndicator from './ContactAvailabilityIndicator';
import ContactErrorBoundary from './ContactErrorBoundary';
import { Contact, AvailabilityStatus } from '@/types/contact';
import { useContacts, useContactAvailability } from '@/hooks/useContacts';

// Enhanced BPMN Element Types with Contact Integration
interface BPMNElement {
  id: string;
  type: string;
  name: string;
  icon: string;
  category: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  properties: {
    color: string;
    assignedContacts: string[];
    assignedTo: string;
    description: string;
    priority: 'Low' | 'Medium' | 'High' | 'Critical';
    estimatedTime: string;
    skills: string[];
    contactRequirements: {
      minSkillLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
      requiredSkills: string[];
      maxWorkload: number;
      preferredDepartments: string[];
    };
    [key: string]: any;
  };
  connections: string[];
}

// Canvas State with enhanced features
interface CanvasState {
  elements: BPMNElement[];
  connections: Array<{
    id: string;
    from: string;
    to: string;
    type: 'sequence' | 'message' | 'association';
  }>;
  selectedElements: string[];
  zoom: number;
  offset: { x: number; y: number };
  gridVisible: boolean;
  canvasSize: { width: number; height: number };
  isFullScreen: boolean;
}

interface WorkflowCanvasProps {
  workflowData?: any;
  onContactAssignment?: (elementId: string, contacts: Contact[]) => void;
  enableContactIntegration?: boolean;
}

const EnhancedWorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ 
  workflowData, 
  onContactAssignment,
  enableContactIntegration = true 
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Contact management with enhanced integration
  const { contacts: availableContacts, loading: contactsLoading, error: contactsError } = useContacts();
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
    elements: [],
    connections: [],
    selectedElements: [],
    zoom: 1,
    offset: { x: 0, y: 0 },
    gridVisible: true,
    canvasSize: { width: 3000, height: 2000 },
    isFullScreen: false
  });

  // Get assigned contact IDs for availability monitoring
  const assignedContactIds = canvasState.elements
    .flatMap(el => el.properties.assignedContacts || [])
    .filter((id, index, arr) => arr.indexOf(id) === index); // unique IDs

  const { availability, isConnected } = useContactAvailability(assignedContactIds);

  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    dragType: 'element' | 'canvas' | 'new-element' | null;
    startPos: { x: number; y: number };
    startOffset?: { x: number; y: number };
    elementType?: string;
    draggedElementId?: string;
  }>({
    isDragging: false,
    dragType: null,
    startPos: { x: 0, y: 0 }
  });

  const [isPanning, setIsPanning] = useState(false);
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const [contactAssignmentAlert, setContactAssignmentAlert] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  // Enhanced contact assignment handler
  const handleContactAssignment = useCallback((elementId: string, contactIds: string[]) => {
    const contacts = availableContacts.filter(c => contactIds.includes(c.contactId));
    
    // Validate contact assignments
    const element = canvasState.elements.find(el => el.id === elementId);
    if (!element) return;

    // Check for availability conflicts
    const busyContacts = contacts.filter(c => c.availability === AvailabilityStatus.BUSY);
    const overloadedContacts = contacts.filter(c => 
      c.workload.currentWorkload > element.properties.contactRequirements?.maxWorkload || 80
    );

    // Show warnings for problematic assignments
    if (busyContacts.length > 0) {
      setContactAssignmentAlert({
        type: 'warning',
        message: `${busyContacts.length} contacts are currently busy: ${busyContacts.map(c => `${c.firstName} ${c.lastName}`).join(', ')}`
      });
    } else if (overloadedContacts.length > 0) {
      setContactAssignmentAlert({
        type: 'warning', 
        message: `${overloadedContacts.length} contacts may be overloaded`
      });
    } else if (contacts.length > 0) {
      setContactAssignmentAlert({
        type: 'success',
        message: `Successfully assigned ${contacts.length} contact${contacts.length > 1 ? 's' : ''} to ${element.name}`
      });
    }

    // Clear alert after 5 seconds
    if (contactAssignmentAlert) {
      setTimeout(() => setContactAssignmentAlert(null), 5000);
    }

    // Update element properties
    setCanvasState(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === elementId 
          ? { 
              ...el, 
              properties: { 
                ...el.properties, 
                assignedContacts: contactIds,
                assignedTo: contacts.length > 0 
                  ? contacts.map(c => `${c.firstName} ${c.lastName}`).join(', ')
                  : ''
              }
            }
          : el
      )
    }));

    // Notify parent component
    onContactAssignment?.(elementId, contacts);
  }, [availableContacts, canvasState.elements, contactAssignmentAlert, onContactAssignment]);

  // Get contacts for an element with real-time availability
  const getElementContacts = (element: BPMNElement) => {
    return (element.properties.assignedContacts || [])
      .map((contactId: string) => {
        const contact = availableContacts.find(c => c.contactId === contactId);
        if (!contact) return null;
        
        // Merge with real-time availability data
        const liveAvailability = availability.get(contactId);
        return liveAvailability ? {
          ...contact,
          availability: liveAvailability.availability,
          workload: liveAvailability.workload,
          lastActive: liveAvailability.lastActive
        } : contact;
      })
      .filter(Boolean) as Contact[];
  };

  // Enhanced contact indicator for canvas elements
  const renderContactIndicators = (element: BPMNElement) => {
    if (!enableContactIntegration || !element.properties.assignedContacts?.length) {
      return null;
    }

    const assignedContacts = getElementContacts(element);
    const maxVisible = 3;

    return (
      <div className="absolute -top-3 -left-3 flex items-center gap-0.5 z-30">
        {assignedContacts.slice(0, maxVisible).map((contact, index) => {
          const liveAvailability = availability.get(contact.contactId);
          const currentStatus = liveAvailability?.availability || contact.availability;
          
          return (
            <div key={contact.contactId} className={`relative ${index > 0 ? '-ml-2' : ''}`}>
              <div 
                className="w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs font-medium text-white"
                style={{ 
                  backgroundColor: currentStatus === AvailabilityStatus.AVAILABLE ? '#10B981' :
                                 currentStatus === AvailabilityStatus.BUSY ? '#F59E0B' :
                                 currentStatus === AvailabilityStatus.ON_LEAVE ? '#EF4444' : '#6B7280'
                }}
                title={`${contact.firstName} ${contact.lastName} - ${currentStatus}`}
              >
                {contact.firstName[0]}{contact.lastName[0]}
              </div>
              
              {/* Real-time indicator */}
              {liveAvailability && isConnected && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse border border-white" />
              )}
            </div>
          );
        })}
        
        {assignedContacts.length > maxVisible && (
          <div className="w-7 h-7 bg-gray-600 border-2 border-white rounded-full flex items-center justify-center text-xs font-medium text-white -ml-2">
            +{assignedContacts.length - maxVisible}
          </div>
        )}
      </div>
    );
  };

  // Enhanced properties panel with contact integration
  const renderContactAssignmentSection = (selectedElement: BPMNElement) => {
    if (!enableContactIntegration || !selectedElement.type.includes('task')) {
      return null;
    }

    const assignedContacts = getElementContacts(selectedElement);
    
    return (
      <ContactErrorBoundary>
        <div className="space-y-4">
          {/* Contact Assignment Alert */}
          {contactAssignmentAlert && (
            <Alert className={`
              ${contactAssignmentAlert.type === 'success' ? 'border-green-200 bg-green-50' : ''}
              ${contactAssignmentAlert.type === 'warning' ? 'border-yellow-200 bg-yellow-50' : ''}
              ${contactAssignmentAlert.type === 'error' ? 'border-red-200 bg-red-50' : ''}
            `}>
              {contactAssignmentAlert.type === 'success' && <CheckCircle className="h-4 w-4" />}
              {contactAssignmentAlert.type === 'warning' && <AlertTriangle className="h-4 w-4" />}
              {contactAssignmentAlert.type === 'error' && <AlertTriangle className="h-4 w-4" />}
              <AlertDescription className="text-sm">
                {contactAssignmentAlert.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Contact Selector */}
          <div>
            <Label htmlFor="assigned-contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assigned Contacts
              {!isConnected && (
                <Badge variant="outline" className="text-xs">
                  Offline
                </Badge>
              )}
            </Label>
            
            <ContactSelector
              value={selectedElement.properties.assignedContacts || []}
              onChange={(contactIds) => handleContactAssignment(selectedElement.id, contactIds)}
              multiple={true}
              maxSelections={5}
              requiredSkills={selectedElement.properties.skills || []}
            />

            {contactsError && (
              <Alert className="mt-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Error loading contacts: {contactsError.message}
                </AlertDescription>
              </Alert>
            )}

            {contactsLoading && (
              <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full" />
                Loading contacts...
              </div>
            )}
          </div>

          {/* Contact Requirements */}
          <div>
            <Label className="text-sm font-medium">Contact Requirements</Label>
            <div className="mt-2 space-y-3">
              <div>
                <Label htmlFor="min-skill-level" className="text-xs">Minimum Skill Level</Label>
                <Select
                  value={selectedElement.properties.contactRequirements?.minSkillLevel || 'Intermediate'}
                  onValueChange={(value) => {
                    setCanvasState(prev => ({
                      ...prev,
                      elements: prev.elements.map(el => 
                        el.id === selectedElement.id
                          ? {
                              ...el,
                              properties: {
                                ...el.properties,
                                contactRequirements: {
                                  ...el.properties.contactRequirements,
                                  minSkillLevel: value
                                }
                              }
                            }
                          : el
                      )
                    }));
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Beginner">Beginner</SelectItem>
                    <SelectItem value="Intermediate">Intermediate</SelectItem>
                    <SelectItem value="Advanced">Advanced</SelectItem>
                    <SelectItem value="Expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="max-workload" className="text-xs">Max Workload (%)</Label>
                <Input
                  id="max-workload"
                  type="number"
                  min="0"
                  max="100"
                  value={selectedElement.properties.contactRequirements?.maxWorkload || 80}
                  onChange={(e) => {
                    setCanvasState(prev => ({
                      ...prev,
                      elements: prev.elements.map(el => 
                        el.id === selectedElement.id
                          ? {
                              ...el,
                              properties: {
                                ...el.properties,
                                contactRequirements: {
                                  ...el.properties.contactRequirements,
                                  maxWorkload: parseInt(e.target.value) || 80
                                }
                              }
                            }
                          : el
                      )
                    }));
                  }}
                  className="h-8"
                />
              </div>
            </div>
          </div>

          {/* Assigned Team Display */}
          {assignedContacts.length > 0 && (
            <div>
              <Label className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assigned Team ({assignedContacts.length})
                {isConnected && (
                  <Badge variant="outline" className="text-xs text-green-600">
                    Live
                  </Badge>
                )}
              </Label>
              <div className="mt-2 space-y-2">
                {assignedContacts.map((contact) => {
                  const liveAvailability = availability.get(contact.contactId);
                  const currentStatus = liveAvailability?.availability || contact.availability;
                  const currentWorkload = liveAvailability?.workload?.currentWorkload || contact.workload.currentWorkload;
                  
                  return (
                    <div key={contact.contactId} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-50">
                      <div className="relative">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {contact.firstName[0]}{contact.lastName[0]}
                        </div>
                        <div 
                          className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                            currentStatus === AvailabilityStatus.AVAILABLE ? 'bg-green-500' :
                            currentStatus === AvailabilityStatus.BUSY ? 'bg-yellow-500' :
                            currentStatus === AvailabilityStatus.ON_LEAVE ? 'bg-red-500' : 'bg-gray-500'
                          }`}
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{contact.firstName} {contact.lastName}</p>
                        <p className="text-xs text-gray-600">{contact.title} • {contact.department}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <Badge 
                            variant={currentStatus === AvailabilityStatus.AVAILABLE ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {currentStatus}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Clock className="h-3 w-3" />
                            {currentWorkload}% load
                          </div>
                        </div>
                      </div>
                      
                      {liveAvailability && (
                        <div className="text-xs text-green-600 font-medium">
                          LIVE
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </ContactErrorBoundary>
    );
  };

  // Simplified example of canvas element rendering with contact indicators
  const renderCanvasElement = (element: BPMNElement, isSelected: boolean) => (
    <div
      key={element.id}
      className={`absolute cursor-pointer flex flex-col items-center justify-center rounded-lg border-2 transition-all duration-200 ${
        isSelected ? 'border-blue-500 shadow-lg' : 'border-gray-300 hover:border-gray-400'
      }`}
      style={{
        left: element.position.x,
        top: element.position.y,
        width: element.size.width,
        height: element.size.height,
        backgroundColor: element.properties.color || '#fff',
        zIndex: isSelected ? 25 : 22
      }}
    >
      <span className="text-2xl mb-1">{element.icon}</span>
      <span className="text-xs font-medium text-center px-2 leading-tight">
        {element.name}
      </span>
      
      {/* Contact Assignment Indicators */}
      {renderContactIndicators(element)}
      
      {/* Selection Indicators */}
      {isSelected && (
        <div className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-lg">
          ✓
        </div>
      )}
    </div>
  );

  const selectedElement = canvasState.selectedElements.length === 1 
    ? canvasState.elements.find(el => el.id === canvasState.selectedElements[0]) 
    : null;

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Canvas Area */}
      <div className="flex-1 relative">
        <Card className="h-full rounded-none border-0">
          <div className="relative w-full h-full overflow-hidden bg-white">
            <div
              ref={canvasRef}
              className="absolute inset-0 canvas-background"
              style={{
                transform: `scale(${canvasState.zoom}) translate(${canvasState.offset.x}px, ${canvasState.offset.y}px)`,
                transformOrigin: '0 0',
                backgroundImage: canvasState.gridVisible 
                  ? 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)'
                  : 'none',
                backgroundSize: '20px 20px',
                cursor: isPanning ? 'grabbing' : 'grab'
              }}
            >
              {/* Render Canvas Elements */}
              {canvasState.elements.map(element => 
                renderCanvasElement(element, canvasState.selectedElements.includes(element.id))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Enhanced Properties Panel */}
      <Card className="w-[360px] ml-2 flex flex-col overflow-hidden">
        <CardHeader className="p-4 border-b">
          <CardTitle className="text-lg flex items-center justify-between">
            Properties
            {selectedElement && (
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary"
                  style={{ backgroundColor: `${selectedElement.properties.color}40` }}
                >
                  {selectedElement.type}
                </Badge>
                {enableContactIntegration && selectedElement.properties.assignedContacts?.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {selectedElement.properties.assignedContacts.length}
                  </Badge>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 p-4 overflow-auto">
          {selectedElement ? (
            <div className="space-y-4">
              {/* Basic Properties */}
              <div>
                <Label htmlFor="element-name">Element Name</Label>
                <Input
                  id="element-name"
                  value={selectedElement.name}
                  onChange={(e) => {
                    setCanvasState(prev => ({
                      ...prev,
                      elements: prev.elements.map(el => 
                        el.id === selectedElement.id ? { ...el, name: e.target.value } : el
                      )
                    }));
                  }}
                  className="mt-1"
                />
              </div>

              {/* Task-specific Properties with Contact Integration */}
              {selectedElement.type.includes('task') && (
                <>
                  <Separator />
                  {renderContactAssignmentSection(selectedElement)}
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Select an element to view properties</p>
              {enableContactIntegration && (
                <p className="text-xs mt-1">Contact assignment available for tasks</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedWorkflowCanvas;