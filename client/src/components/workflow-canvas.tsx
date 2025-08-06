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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  CheckSquare
} from 'lucide-react';
import ContactSelector from './ContactSelector';
import ContactAvailabilityIndicator from './ContactAvailabilityIndicator';
import ContactErrorBoundary from './ContactErrorBoundary';
import { Contact } from '@/types/contact';
import { useContacts } from '@/hooks/useContacts';

// BPMN Element Types
interface BPMNElement {
  id: string;
  type: string;
  name: string;
  icon: string;
  category: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  properties: Record<string, any>;
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
  selectedElements: string[]; // Changed to array for multi-select
  zoom: number;
  offset: { x: number; y: number };
  gridVisible: boolean;
  canvasSize: { width: number; height: number };
  isFullScreen: boolean;
}

interface WorkflowCanvasProps {
  workflowData?: any;
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ workflowData }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Contact management
  const { contacts: availableContacts } = useContacts();
  
  const [canvasState, setCanvasState] = useState<CanvasState>({
    elements: [],
    connections: [],
    selectedElements: [], // Multi-select support
    zoom: 1,
    offset: { x: 0, y: 0 },
    gridVisible: true,
    canvasSize: { width: 3000, height: 2000 }, // Larger canvas
    isFullScreen: false
  });

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
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [draggedSkillIndex, setDraggedSkillIndex] = useState<number | null>(null);
  const [showRecommendations, setShowRecommendations] = useState(true);

  // Handle skill removal
  const removeSkill = (elementId: string, index: number) => {
    setCanvasState(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === elementId 
          ? { 
              ...el, 
              properties: { 
                ...el.properties, 
                requiredSkills: (el.properties.requiredSkills || []).filter((_: any, i: number) => i !== index)
              }
            }
          : el
      )
    }));
  };

  // Handle skill reordering via drag and drop
  const handleSkillDragStart = (elementId: string, index: number) => {
    setDraggedSkillIndex(index);
  };

  const handleSkillDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleSkillDrop = (elementId: string, dropIndex: number) => {
    if (draggedSkillIndex === null) return;
    
    setCanvasState(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === elementId 
          ? { 
              ...el, 
              properties: { 
                ...el.properties, 
                requiredSkills: reorderArray(el.properties.requiredSkills || [], draggedSkillIndex, dropIndex)
              }
            }
          : el
      )
    }));
    setDraggedSkillIndex(null);
  };

  // Helper function to reorder array
  const reorderArray = (arr: any[], fromIndex: number, toIndex: number) => {
    const result = [...arr];
    const [removed] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, removed);
    return result;
  };

  // Helper functions for skill display styling
  const getProficiencyColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner': return 'bg-gray-100 text-gray-700';
      case 'intermediate': return 'bg-blue-100 text-blue-700';
      case 'advanced': return 'bg-purple-100 text-purple-700';
      case 'expert': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getWeightBadgeColor = (weight: number) => {
    if (weight >= 8) return 'bg-red-100 text-red-700';
    if (weight >= 4) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  const getProficiencyStars = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner': return '⭐';
      case 'intermediate': return '⭐⭐';
      case 'advanced': return '⭐⭐⭐';
      case 'expert': return '⭐⭐⭐⭐';
      default: return '⭐';
    }
  };

  // Handle keyboard events for Ctrl key and shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        setIsCtrlPressed(true);
      }
      if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSelectAll();
      }
      if (e.key === 'Delete' && canvasState.selectedElements.length > 0) {
        handleDeleteElements();
      }
      if (e.key === 'Escape') {
        setCanvasState(prev => ({ ...prev, selectedElements: [] }));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        setIsCtrlPressed(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('keyup', handleKeyUp, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('keyup', handleKeyUp, { capture: true });
    };
  }, [canvasState.selectedElements]);

  // Complete BPMN Element Library
  const bpmnElementLibrary = [
    // Events
    { 
      id: 'start-event', 
      name: 'Start Event', 
      icon: '⚪', 
      category: 'Events',
      color: '#4CAF50',
      size: { width: 60, height: 60 }
    },
    { 
      id: 'end-event', 
      name: 'End Event', 
      icon: '🔴', 
      category: 'Events',
      color: '#F44336',
      size: { width: 60, height: 60 }
    },
    { 
      id: 'intermediate-event', 
      name: 'Intermediate Event', 
      icon: '🟡', 
      category: 'Events',
      color: '#FF9800',
      size: { width: 60, height: 60 }
    },
    
    // Tasks
    { 
      id: 'user-task', 
      name: 'User Task', 
      icon: '👤', 
      category: 'Tasks',
      color: '#2196F3',
      size: { width: 120, height: 80 }
    },
    { 
      id: 'system-task', 
      name: 'System Task', 
      icon: '⚙️', 
      category: 'Tasks',
      color: '#9C27B0',
      size: { width: 120, height: 80 }
    },
    { 
      id: 'manual-task', 
      name: 'Manual Task', 
      icon: '✋', 
      category: 'Tasks',
      color: '#FF5722',
      size: { width: 120, height: 80 }
    },
    { 
      id: 'service-task', 
      name: 'Service Task', 
      icon: '🔧', 
      category: 'Tasks',
      color: '#795548',
      size: { width: 120, height: 80 }
    },
    { 
      id: 'script-task', 
      name: 'Script Task', 
      icon: '📜', 
      category: 'Tasks',
      color: '#607D8B',
      size: { width: 120, height: 80 }
    },
    { 
      id: 'business-rule-task', 
      name: 'Business Rule', 
      icon: '📋', 
      category: 'Tasks',
      color: '#3F51B5',
      size: { width: 120, height: 80 }
    },
    
    // Gateways
    { 
      id: 'exclusive-gateway', 
      name: 'Exclusive Gateway', 
      icon: '◆', 
      category: 'Gateways',
      color: '#FFEB3B',
      size: { width: 80, height: 80 }
    },
    { 
      id: 'parallel-gateway', 
      name: 'Parallel Gateway', 
      icon: '⧫', 
      category: 'Gateways',
      color: '#CDDC39',
      size: { width: 80, height: 80 }
    },
    { 
      id: 'inclusive-gateway', 
      name: 'Inclusive Gateway', 
      icon: '◇', 
      category: 'Gateways',
      color: '#8BC34A',
      size: { width: 80, height: 80 }
    },
    
    // Data Objects
    { 
      id: 'data-object', 
      name: 'Data Object', 
      icon: '📄', 
      category: 'Data',
      color: '#00BCD4',
      size: { width: 80, height: 100 }
    },
    { 
      id: 'data-store', 
      name: 'Data Store', 
      icon: '🗃️', 
      category: 'Data',
      color: '#009688',
      size: { width: 100, height: 80 }
    }
  ];

  // Group elements by category
  const elementsByCategory = bpmnElementLibrary.reduce((acc, element) => {
    if (!acc[element.category]) {
      acc[element.category] = [];
    }
    acc[element.category].push(element);
    return acc;
  }, {} as Record<string, typeof bpmnElementLibrary>);

  // Generate unique ID for elements
  const generateId = () => `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Handle mouse down on canvas (for panning)
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Check if clicking on canvas background (not on an element)
    const isCanvasBackground = target === canvasRef.current || 
                              target === canvasContainerRef.current ||
                              target.classList.contains('canvas-background') ||
                              target.classList.contains('canvas-grid');
    
    if (isCanvasBackground) {
      // Clear selection if not holding Ctrl/Cmd
      const isMultiSelectMode = isCtrlPressed || e.ctrlKey || e.metaKey;
      if (!isMultiSelectMode) {
        setCanvasState(prev => ({ ...prev, selectedElements: [] }));
      }

      setDragState({
        isDragging: true,
        dragType: 'canvas',
        startPos: { x: e.clientX, y: e.clientY },
        startOffset: { ...canvasState.offset }
      });
      setIsPanning(true);
      e.preventDefault();
      e.stopPropagation();
    }
  }, [canvasState.offset]);

  // Handle mouse move (for panning and element dragging)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.isDragging) return;

    if (dragState.dragType === 'canvas' && dragState.startOffset) {
      // Canvas panning
      const deltaX = e.clientX - dragState.startPos.x;
      const deltaY = e.clientY - dragState.startPos.y;
      
      setCanvasState(prev => ({
        ...prev,
        offset: {
          x: dragState.startOffset!.x + deltaX,
          y: dragState.startOffset!.y + deltaY
        }
      }));
    } else if (dragState.dragType === 'element' && canvasState.selectedElements.length > 0) {
      // Element dragging
      if (!canvasRef.current) return;
      
      const deltaX = (e.clientX - dragState.startPos.x) / canvasState.zoom;
      const deltaY = (e.clientY - dragState.startPos.y) / canvasState.zoom;

      // Snap to grid (smaller grid for smoother movement)
      const gridSize = 10;
      const snappedDeltaX = Math.round(deltaX / gridSize) * gridSize;
      const snappedDeltaY = Math.round(deltaY / gridSize) * gridSize;

      // Only update if there's actual movement to prevent unnecessary re-renders
      if (Math.abs(snappedDeltaX) > 0 || Math.abs(snappedDeltaY) > 0) {
        setCanvasState(prev => ({
          ...prev,
          elements: prev.elements.map(el => {
            if (prev.selectedElements.includes(el.id)) {
              const newX = el.position.x + snappedDeltaX;
              const newY = el.position.y + snappedDeltaY;
              
              // Ensure elements don't go negative
              const clampedX = Math.max(0, newX);
              const clampedY = Math.max(0, newY);
              
              return { ...el, position: { x: clampedX, y: clampedY } };
            }
            return el;
          })
        }));

        // Update drag start position for next delta calculation
        setDragState(prev => ({
          ...prev,
          startPos: { x: e.clientX, y: e.clientY }
        }));
      }
    }
  }, [dragState, canvasState.offset, canvasState.zoom, canvasState.selectedElements]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      dragType: null,
      startPos: { x: 0, y: 0 }
    });
    setIsPanning(false);
  }, []);

  // Add event listeners for mouse move and up
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);

  // Handle element drag start from palette
  const handleElementDragStart = (elementType: string) => {
    setDragState({
      isDragging: true,
      dragType: 'new-element',
      startPos: { x: 0, y: 0 },
      elementType
    });
  };

  // Handle drop on canvas
  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    if (!canvasRef.current || !dragState.elementType) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const elementTemplate = bpmnElementLibrary.find(el => el.id === dragState.elementType);
    
    if (!elementTemplate) return;

    // Calculate position accounting for zoom and offset
    const x = (e.clientX - rect.left - canvasState.offset.x) / canvasState.zoom;
    const y = (e.clientY - rect.top - canvasState.offset.y) / canvasState.zoom;

    // Snap to grid (20px grid)
    const gridSize = 20;
    const snappedX = Math.round(x / gridSize) * gridSize;
    const snappedY = Math.round(y / gridSize) * gridSize;

    const newElement: BPMNElement = {
      id: generateId(),
      type: elementTemplate.id,
      name: elementTemplate.name,
      icon: elementTemplate.icon,
      category: elementTemplate.category,
      position: { x: snappedX, y: snappedY },
      size: elementTemplate.size,
      properties: {
        color: elementTemplate.color,
        assignedTo: '',
        assignedContacts: [], // Array of contact IDs
        description: '',
        priority: 'Medium',
        estimatedTime: '',
        skills: [],
        contactRequirements: {
          minSkillLevel: 'Intermediate',
          requiredSkills: [],
          maxWorkload: 80,
          preferredDepartments: []
        }
      },
      connections: []
    };

    setCanvasState(prev => ({
      ...prev,
      elements: [...prev.elements, newElement],
      selectedElements: [newElement.id]
    }));

    setDragState({
      isDragging: false,
      dragType: null,
      startPos: { x: 0, y: 0 }
    });
  }, [dragState.elementType, canvasState.zoom, canvasState.offset, bpmnElementLibrary]);

  // Handle element selection and start dragging
  const handleElementMouseDown = useCallback((elementId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Check for Ctrl/Cmd key from both state and event
    const isMultiSelectMode = isCtrlPressed || e.ctrlKey || e.metaKey;
    
    // Multi-select with Ctrl/Cmd
    if (isMultiSelectMode) {
      setCanvasState(prev => ({
        ...prev,
        selectedElements: prev.selectedElements.includes(elementId)
          ? prev.selectedElements.filter(id => id !== elementId)
          : [...prev.selectedElements, elementId]
      }));
      
      // Don't start dragging when doing multi-select
      return;
    } else {
      // Single select - always select the clicked element for dragging
      setCanvasState(prev => ({
        ...prev,
        selectedElements: [elementId]
      }));

      // Start element dragging
      setDragState({
        isDragging: true,
        dragType: 'element',
        startPos: { x: e.clientX, y: e.clientY },
        draggedElementId: elementId
      });
    }
  }, [isCtrlPressed, canvasState.selectedElements]);

  // Handle element deletion (multiple selected elements)
  const handleDeleteElements = () => {
    if (canvasState.selectedElements.length === 0) return;
    
    setCanvasState(prev => ({
      ...prev,
      elements: prev.elements.filter(el => !prev.selectedElements.includes(el.id)),
      connections: prev.connections.filter(conn => 
        !prev.selectedElements.includes(conn.from) && !prev.selectedElements.includes(conn.to)
      ),
      selectedElements: []
    }));
  };

  // Handle contact assignment for elements
  const handleContactAssignment = useCallback((elementId: string, contacts: Contact[]) => {
    // Update element properties with contact IDs
    const contactIds = contacts.map(c => c.contactId);
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
  }, []);

  // Handle select all
  const handleSelectAll = () => {
    setCanvasState(prev => ({
      ...prev,
      selectedElements: prev.elements.map(el => el.id)
    }));
  };

  // Enhanced alignment of selected elements
  const alignElements = (alignment: 'left' | 'center-horizontal' | 'right' | 'top' | 'center-vertical' | 'bottom' | 'distribute-horizontal' | 'distribute-vertical') => {
    if (canvasState.selectedElements.length < 2) return;

    const selectedEls = canvasState.elements.filter(el => canvasState.selectedElements.includes(el.id));
    let newElements = [...canvasState.elements];
    
    switch (alignment) {
      case 'left':
        const leftmostX = Math.min(...selectedEls.map(el => el.position.x));
        newElements = newElements.map(el => 
          canvasState.selectedElements.includes(el.id)
            ? { ...el, position: { ...el.position, x: leftmostX } }
            : el
        );
        break;

      case 'center-horizontal':
        const avgX = selectedEls.reduce((sum, el) => sum + el.position.x + el.size.width / 2, 0) / selectedEls.length;
        newElements = newElements.map(el => 
          canvasState.selectedElements.includes(el.id)
            ? { ...el, position: { ...el.position, x: avgX - el.size.width / 2 } }
            : el
        );
        break;

      case 'right':
        const rightmostX = Math.max(...selectedEls.map(el => el.position.x + el.size.width));
        newElements = newElements.map(el => 
          canvasState.selectedElements.includes(el.id)
            ? { ...el, position: { ...el.position, x: rightmostX - el.size.width } }
            : el
        );
        break;

      case 'top':
        const topmostY = Math.min(...selectedEls.map(el => el.position.y));
        newElements = newElements.map(el => 
          canvasState.selectedElements.includes(el.id)
            ? { ...el, position: { ...el.position, y: topmostY } }
            : el
        );
        break;

      case 'center-vertical':
        const avgY = selectedEls.reduce((sum, el) => sum + el.position.y + el.size.height / 2, 0) / selectedEls.length;
        newElements = newElements.map(el => 
          canvasState.selectedElements.includes(el.id)
            ? { ...el, position: { ...el.position, y: avgY - el.size.height / 2 } }
            : el
        );
        break;

      case 'bottom':
        const bottommostY = Math.max(...selectedEls.map(el => el.position.y + el.size.height));
        newElements = newElements.map(el => 
          canvasState.selectedElements.includes(el.id)
            ? { ...el, position: { ...el.position, y: bottommostY - el.size.height } }
            : el
        );
        break;

      case 'distribute-horizontal':
        if (selectedEls.length >= 3) {
          const sortedByX = [...selectedEls].sort((a, b) => a.position.x - b.position.x);
          const leftmost = sortedByX[0].position.x;
          const rightmost = sortedByX[sortedByX.length - 1].position.x + sortedByX[sortedByX.length - 1].size.width;
          const totalWidth = rightmost - leftmost;
          const spacing = totalWidth / (sortedByX.length - 1);

          sortedByX.forEach((el, index) => {
            if (index > 0 && index < sortedByX.length - 1) {
              const newX = leftmost + (spacing * index) - el.size.width / 2;
              newElements = newElements.map(element => 
                element.id === el.id
                  ? { ...element, position: { ...element.position, x: newX } }
                  : element
              );
            }
          });
        }
        break;

      case 'distribute-vertical':
        if (selectedEls.length >= 3) {
          const sortedByY = [...selectedEls].sort((a, b) => a.position.y - b.position.y);
          const topmost = sortedByY[0].position.y;
          const bottommost = sortedByY[sortedByY.length - 1].position.y + sortedByY[sortedByY.length - 1].size.height;
          const totalHeight = bottommost - topmost;
          const spacing = totalHeight / (sortedByY.length - 1);

          sortedByY.forEach((el, index) => {
            if (index > 0 && index < sortedByY.length - 1) {
              const newY = topmost + (spacing * index) - el.size.height / 2;
              newElements = newElements.map(element => 
                element.id === el.id
                  ? { ...element, position: { ...element.position, y: newY } }
                  : element
              );
            }
          });
        }
        break;
    }

    setCanvasState(prev => ({ ...prev, elements: newElements }));
  };

  // Handle zoom controls
  const handleZoom = (delta: number) => {
    setCanvasState(prev => ({
      ...prev,
      zoom: Math.max(0.25, Math.min(4, prev.zoom + delta))
    }));
  };

  // Handle fit to screen
  const handleFitToScreen = () => {
    if (!canvasContainerRef.current || canvasState.elements.length === 0) {
      setCanvasState(prev => ({ ...prev, zoom: 1, offset: { x: 0, y: 0 } }));
      return;
    }

    // Calculate bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    canvasState.elements.forEach(element => {
      minX = Math.min(minX, element.position.x);
      minY = Math.min(minY, element.position.y);
      maxX = Math.max(maxX, element.position.x + element.size.width);
      maxY = Math.max(maxY, element.position.y + element.size.height);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const containerRect = canvasContainerRef.current.getBoundingClientRect();
    
    // Calculate zoom to fit content with padding
    const padding = 100;
    const zoomX = (containerRect.width - padding) / contentWidth;
    const zoomY = (containerRect.height - padding) / contentHeight;
    const newZoom = Math.min(zoomX, zoomY, 1); // Don't zoom in beyond 100%

    // Calculate offset to center content
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const offsetX = containerRect.width / 2 - centerX * newZoom;
    const offsetY = containerRect.height / 2 - centerY * newZoom;

    setCanvasState(prev => ({
      ...prev,
      zoom: newZoom,
      offset: { x: offsetX, y: offsetY }
    }));
  };

  // Handle element property updates
  const updateElementProperty = (elementId: string, property: string, value: any) => {
    setCanvasState(prev => ({
      ...prev,
      elements: prev.elements.map(el => 
        el.id === elementId 
          ? { ...el, properties: { ...el.properties, [property]: value } }
          : el
      )
    }));
  };

  // Toggle full-screen mode
  const toggleFullScreen = () => {
    setCanvasState(prev => ({ ...prev, isFullScreen: !prev.isFullScreen }));
  };

  // Get selected elements (for properties panel - show first selected)
  const selectedElement = canvasState.selectedElements.length > 0 
    ? canvasState.elements.find(el => el.id === canvasState.selectedElements[0])
    : null;

  return (
    <div className={`flex min-h-0 overflow-hidden ${canvasState.isFullScreen ? 'fixed inset-0 z-50 bg-white h-screen w-screen' : 'h-full'}`}>
      {/* BPMN Elements Palette */}
      <Card className="w-[300px] flex flex-col mr-2 overflow-hidden">
        {/* Palette Header */}
        <CardHeader className="p-4 border-b">
          <CardTitle className="text-lg">BPMN Elements</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Drag elements to canvas</p>
        </CardHeader>

        {/* Element Categories */}
        <div className="flex-1 overflow-auto">
          <Accordion type="multiple" defaultValue={Object.keys(elementsByCategory)} className="w-full">
            {Object.entries(elementsByCategory).map(([category, elements]) => (
              <AccordionItem key={category} value={category}>
                <AccordionTrigger className="px-4 py-3 text-sm font-medium">
                  {category} ({elements.length})
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-3">
                  <div className="space-y-2">
                    {elements.map((element) => (
                      <button
                        key={element.id}
                        draggable
                        onDragStart={() => handleElementDragStart(element.id)}
                        className="w-full px-3 py-2 text-left border rounded-md hover:shadow-sm transition-all duration-200 cursor-move"
                        style={{
                          borderColor: element.color,
                          backgroundColor: `${element.color}10`
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${element.color}20`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = `${element.color}10`;
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{element.icon}</span>
                          <div>
                            <p className="text-sm font-medium">{element.name}</p>
                            <p className="text-xs text-gray-500">
                              {element.size.width}×{element.size.height}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Card>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        {/* Canvas Toolbar */}
        <Card className="p-2 mb-2 flex items-center gap-2 flex-shrink-0">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleZoom(-0.25)}
              disabled={canvasState.zoom <= 0.25}
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-w-[80px] text-xs"
            >
              {Math.round(canvasState.zoom * 100)}%
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleZoom(0.25)}
              disabled={canvasState.zoom >= 4}
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </Button>
          </div>

          {/* View Controls */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleFitToScreen}
              title="Fit to Screen"
            >
              <Maximize2 size={16} />
            </Button>
            <Button
              size="sm"
              variant={canvasState.gridVisible ? "default" : "ghost"}
              onClick={() => setCanvasState(prev => ({ ...prev, gridVisible: !prev.gridVisible }))}
              title="Toggle Grid"
            >
              <Grid3x3 size={16} />
            </Button>
            <Button
              size="sm"
              variant={isPanning ? "default" : "ghost"}
              title={isPanning ? "Panning Mode" : "Pan Canvas"}
            >
              <Hand size={16} />
            </Button>
            <Button
              size="sm"
              variant={canvasState.isFullScreen ? "default" : "ghost"}
              onClick={toggleFullScreen}
              title={canvasState.isFullScreen ? "Exit Full Screen" : "Enter Full Screen"}
            >
              {canvasState.isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </Button>
          </div>

          {/* Element Actions */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDeleteElements}
              disabled={canvasState.selectedElements.length === 0}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              title={`Delete Selected (${canvasState.selectedElements.length})`}
            >
              <Trash2 size={16} />
            </Button>
          </div>

          {/* Alignment Tools */}
          {canvasState.selectedElements.length > 1 && (
            <div className="flex items-center gap-1 border-r pr-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => alignElements('left')}
                disabled={canvasState.selectedElements.length < 2}
                title="Align Left"
              >
                <AlignLeft size={16} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => alignElements('center-horizontal')}
                disabled={canvasState.selectedElements.length < 2}
                title="Align Center Horizontal"
              >
                <AlignCenter size={16} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => alignElements('right')}
                disabled={canvasState.selectedElements.length < 2}
                title="Align Right"
              >
                <AlignRight size={16} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => alignElements('top')}
                disabled={canvasState.selectedElements.length < 2}
                title="Align Top"
              >
                <AlignVerticalJustifyStart size={16} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => alignElements('center-vertical')}
                disabled={canvasState.selectedElements.length < 2}
                title="Align Center Vertical"
              >
                <AlignVerticalJustifyCenter size={16} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => alignElements('bottom')}
                disabled={canvasState.selectedElements.length < 2}
                title="Align Bottom"
              >
                <AlignVerticalJustifyEnd size={16} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => alignElements('distribute-horizontal')}
                disabled={canvasState.selectedElements.length < 3}
                title="Distribute Horizontally (3+ elements)"
              >
                <MoreHorizontal size={16} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => alignElements('distribute-vertical')}
                disabled={canvasState.selectedElements.length < 3}
                title="Distribute Vertically (3+ elements)"
                className="[&>svg]:rotate-90"
              >
                <MoreHorizontal size={16} />
              </Button>
            </div>
          )}

          {/* Selection Controls */}
          <div className="flex items-center gap-1 border-r pr-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSelectAll}
              disabled={canvasState.elements.length === 0}
              title="Select All (Ctrl+A)"
            >
              <CheckSquare size={16} />
            </Button>
            {canvasState.selectedElements.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCanvasState(prev => ({ ...prev, selectedElements: [] }))}
                title="Clear Selection (Escape)"
              >
                <MousePointer size={16} />
              </Button>
            )}
          </div>

          {/* Selection Info */}
          {canvasState.selectedElements.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {canvasState.selectedElements.length} selected
              </Badge>
            </div>
          )}

          <div className="flex-1" />

          {/* Workflow Info */}
          <span className="text-sm text-gray-500">
            {canvasState.elements.length} elements • {canvasState.selectedElements.length > 0 ? `${canvasState.selectedElements.length} selected • ` : ''}{Math.round(canvasState.zoom * 100)}% zoom
            {isCtrlPressed && <span className="ml-2 text-blue-600 font-medium">• Multi-select mode</span>}
          </span>
        </Card>

        {/* Canvas Container with Enhanced Scrolling */}
        <Card
          ref={canvasContainerRef}
          className={`flex-1 relative overflow-hidden bg-gray-50 select-none ${ 
            isPanning ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onMouseDown={handleCanvasMouseDown}
          onDrop={handleCanvasDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {/* Scrollable Canvas Area */}
          <div
            ref={canvasRef}
            className="canvas-background absolute top-0 left-0 w-full h-full"
            style={{
              transform: `translate(${canvasState.offset.x}px, ${canvasState.offset.y}px)`
            }}
            onMouseDown={handleCanvasMouseDown}
          >
            {/* Grid Background */}
            {canvasState.gridVisible && (
              <div
                className="canvas-grid absolute top-0 left-0 pointer-events-auto"
                style={{
                  width: canvasState.canvasSize.width * canvasState.zoom,
                  height: canvasState.canvasSize.height * canvasState.zoom,
                  backgroundImage: `
                    linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: `${20 * canvasState.zoom}px ${20 * canvasState.zoom}px`
                }}
                onMouseDown={handleCanvasMouseDown}
              />
            )}

            {/* Canvas Elements */}
            <div
              className="relative"
              style={{
                width: canvasState.canvasSize.width * canvasState.zoom,
                height: canvasState.canvasSize.height * canvasState.zoom,
                transform: `scale(${canvasState.zoom})`,
                transformOrigin: '0 0',
                zIndex: 20 // Ensure elements container is on top
              }}
            >
              {canvasState.elements.map((element) => {
                const isSelected = canvasState.selectedElements.includes(element.id);
                const isGateway = element.type.includes('gateway');
                const isEvent = element.type.includes('event');
                
                return (
                  <div
                    key={element.id}
                    onMouseDown={(e) => handleElementMouseDown(element.id, e)}
                    className={`
                      absolute flex items-center justify-center flex-col select-none element-hover
                      ${isSelected ? 'selected-element ring-4 ring-blue-500 ring-offset-4' : 'ring-2 ring-gray-300'}
                      ${isGateway || isEvent ? 'rounded-full' : 'rounded-md'}
                      ${isCtrlPressed ? 'cursor-pointer' : 'cursor-move'}
                    `}
                    draggable={false}
                    style={{
                      left: element.position.x,
                      top: element.position.y,
                      width: element.size.width,
                      height: element.size.height,
                      backgroundColor: element.properties.color || '#fff',
                      boxShadow: isSelected 
                        ? '0 4px 12px rgba(59,130,246,0.3), 0 0 0 4px rgba(59,130,246,0.1)' 
                        : '0 2px 4px rgba(0,0,0,0.1)',
                      outline: isSelected ? '2px solid #3b82f6' : 'none',
                      outlineOffset: isSelected ? '4px' : '0',
                      pointerEvents: 'auto', // Ensure the element can receive mouse events
                      zIndex: isSelected ? 25 : 22 // Ensure selected elements are on top
                    }}
                  >
                    <span className="text-2xl mb-1">{element.icon}</span>
                    <span className="text-xs font-medium text-center px-2 leading-tight">
                      {element.name}
                    </span>
                    
                    {/* Contact Assignment Indicator */}
                    {element.properties.assignedContacts?.length > 0 && (
                      <div className="absolute -top-8 -left-2 flex flex-col gap-0.5">
                        {element.properties.assignedContacts.slice(0, 3).map((contactId: string, index: number) => (
                          <div key={contactId} className={`relative ${index > 0 ? '-ml-1' : ''}`}>
                            <div className="bg-blue-500 text-white px-2 py-0.5 rounded text-xs font-medium shadow-sm border border-white max-w-20 truncate">
                              {(() => {
                                const contact = availableContacts.find(c => (c as any).contactId === contactId || (c as any).id === contactId);
                                return contact ? `${(contact as any).firstName || (contact as any).name || ''} ${(contact as any).lastName || ''}`.trim() : 'Unknown';
                              })()}
                            </div>
                            <ContactAvailabilityIndicator
                              contactId={contactId}
                              showDetails={false}
                            />
                          </div>
                        ))}
                        {element.properties.assignedContacts.length > 3 && (
                          <div className="w-6 h-6 bg-muted border-2 border-white rounded-full flex items-center justify-center text-xs font-medium -ml-1">
                            +{element.properties.assignedContacts.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Selection Indicators - Corner dots and badge */}
                    {isSelected && (
                      <>
                        {/* Top-left corner */}
                        <div className="selection-indicator absolute -top-1.5 -left-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md" />
                        
                        {/* Top-right corner */}
                        <div className="selection-indicator absolute -top-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md" />
                        
                        {/* Bottom-left corner */}
                        <div className="selection-indicator absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md" />
                        
                        {/* Bottom-right corner */}
                        <div className="selection-indicator absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-md" />
                        
                        {/* Selection badge */}
                        <div className="selection-indicator absolute -top-3 -right-3 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold border-2 border-white shadow-lg">
                          ✓
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Empty State */}
            {canvasState.elements.length === 0 && (
              <div className="canvas-background absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none z-10">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Start building your workflow
                </h3>
                <p className="text-sm text-gray-500 mb-2">
                  Drag BPMN elements from the palette to begin
                </p>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>• Drag elements to place them</p>
                  <p>• Click and drag canvas to pan</p>
                  <p>• Use zoom controls in toolbar</p>
                  <p>• Select elements to edit properties</p>
                </div>
              </div>
            )}

            {/* Invisible pan area to catch clicks */}
            <div
              className="canvas-background absolute top-0 left-0 bg-transparent"
              style={{
                width: canvasState.canvasSize.width * canvasState.zoom,
                height: canvasState.canvasSize.height * canvasState.zoom,
                pointerEvents: canvasState.elements.length > 0 ? 'auto' : 'none',
                zIndex: 1 // Keep this below elements
              }}
              onMouseDown={handleCanvasMouseDown}
            />
          </div>
        </Card>
      </div>

      {/* Enhanced Properties Panel */}
      <Card className="w-[320px] ml-2 flex flex-col overflow-hidden">
        <CardHeader className="p-4 border-b">
          <CardTitle className="text-lg flex items-center justify-between">
            Properties
            <div className="flex items-center gap-1">
              {selectedElement && (
                <Badge 
                  variant="secondary"
                  style={{ backgroundColor: `${selectedElement.properties.color}40` }}
                >
                  {selectedElement.type}
                </Badge>
              )}
              {canvasState.selectedElements.length > 1 && (
                <Badge variant="outline" className="text-xs">
                  {canvasState.selectedElements.length} selected
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 p-4 overflow-auto">
          {canvasState.selectedElements.length > 1 ? (
            // Multiple elements selected
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-2 bg-purple-50 rounded border selection-indicator">
                <div className="text-lg">📋</div>
                <div>
                  <div className="font-medium text-purple-900">Multiple Selection</div>
                  <div className="text-xs text-purple-600">{canvasState.selectedElements.length} elements selected</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Alignment Tools
                </label>
                <div className="grid grid-cols-3 gap-1">
                  <Button size="sm" variant="outline" onClick={() => alignElements('left')} title="Align Left">
                    <AlignLeft size={14} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => alignElements('center-horizontal')} title="Align Center Horizontal">
                    <AlignCenter size={14} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => alignElements('right')} title="Align Right">
                    <AlignRight size={14} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => alignElements('top')} title="Align Top">
                    <AlignVerticalJustifyStart size={14} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => alignElements('center-vertical')} title="Align Center Vertical">
                    <AlignVerticalJustifyCenter size={14} />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => alignElements('bottom')} title="Align Bottom">
                    <AlignVerticalJustifyEnd size={14} />
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Distribution
                </label>
                <div className="grid grid-cols-2 gap-1">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => alignElements('distribute-horizontal')} 
                    disabled={canvasState.selectedElements.length < 3}
                    title="Distribute Horizontally (3+ elements)"
                  >
                    <MoreHorizontal size={14} className="mr-1" />
                    Horizontal
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => alignElements('distribute-vertical')} 
                    disabled={canvasState.selectedElements.length < 3}
                    title="Distribute Vertically (3+ elements)"
                  >
                    <MoreHorizontal size={14} className="mr-1 rotate-90" />
                    Vertical
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Elements
                </label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {canvasState.selectedElements.map(id => {
                    const element = canvasState.elements.find(el => el.id === id);
                    return element ? (
                      <div key={id} className="flex items-center justify-between text-xs p-1 bg-gray-50 rounded">
                        <span className="truncate">{element.name}</span>
                        <Badge variant="outline" className="text-xs">{element.type.replace(/-/g, ' ')}</Badge>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => setCanvasState(prev => ({ ...prev, selectedElements: [] }))}
                  className="flex-1"
                >
                  Clear Selection
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={handleDeleteElements}
                  className="flex-1"
                >
                  Delete All
                </Button>
              </div>
            </div>
          ) : selectedElement ? (
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

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={selectedElement.properties.description || ''}
                  onChange={(e) => updateElementProperty(selectedElement.id, 'description', e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Task-specific Properties */}
              {selectedElement.type.includes('task') && (
                <>
                  <div>
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={selectedElement.properties.priority || 'Medium'}
                      onValueChange={(value) => updateElementProperty(selectedElement.id, 'priority', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                        <SelectItem value="Critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="estimated-time">Estimated Time</Label>
                    <Input
                      id="estimated-time"
                      placeholder="e.g., 2 hours, 1 day"
                      value={selectedElement.properties.estimatedTime || ''}
                      onChange={(e) => updateElementProperty(selectedElement.id, 'estimatedTime', e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="skills">Required Skills</Label>
                    <Input
                      id="skills"
                      placeholder="Enter skills separated by commas"
                      value={selectedElement.properties.skills?.join(', ') || ''}
                      onChange={(e) => {
                        const skills = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                        updateElementProperty(selectedElement.id, 'skills', skills);
                      }}
                      className="mt-1"
                    />
                  </div>

                  <ContactErrorBoundary>
                    <div>
                      <Label htmlFor="assigned-contacts">Assigned Contacts</Label>
                      <ContactSelector
                        value={selectedElement.properties.assignedContacts || []}
                        onChange={(contactIds) => {
                          // Find the contacts by their IDs and call the assignment handler
                          const selectedContacts = availableContacts.filter(c => contactIds.includes(c.contactId));
                          handleContactAssignment(selectedElement.id, selectedContacts);
                        }}
                        multiple={true}
                        maxSelections={5}
                        requiredSkills={selectedElement.properties.skills || []}
                      />
                    </div>

                    {/* Contact Requirements */}
                    <div>
                      <Label>Contact Requirements</Label>
                      <div className="mt-2 space-y-3">
                        <div>
                          <Label htmlFor="min-skill-level" className="text-sm">Minimum Skill Level</Label>
                          <Select
                            value={selectedElement.properties.contactRequirements?.minSkillLevel || 'Intermediate'}
                            onValueChange={(value) => updateElementProperty(selectedElement.id, 'contactRequirements', {
                              ...selectedElement.properties.contactRequirements,
                              minSkillLevel: value
                            })}
                          >
                            <SelectTrigger className="mt-1">
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
                          <Label htmlFor="max-workload" className="text-sm">Max Workload (%)</Label>
                          <Input
                            id="max-workload"
                            type="number"
                            min="0"
                            max="100"
                            value={selectedElement.properties.contactRequirements?.maxWorkload || 80}
                            onChange={(e) => updateElementProperty(selectedElement.id, 'contactRequirements', {
                              ...selectedElement.properties.contactRequirements,
                              maxWorkload: parseInt(e.target.value) || 80
                            })}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="preferred-departments" className="text-sm">Preferred Departments</Label>
                          <Input
                            id="preferred-departments"
                            placeholder="Engineering, Design, Marketing..."
                            value={selectedElement.properties.contactRequirements?.preferredDepartments?.join(', ') || ''}
                            onChange={(e) => {
                              const departments = e.target.value.split(',').map(d => d.trim()).filter(Boolean);
                              updateElementProperty(selectedElement.id, 'contactRequirements', {
                                ...selectedElement.properties.contactRequirements,
                                preferredDepartments: departments
                              });
                            }}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Required Skills Section */}
                    <div className="mb-4">
                      <Label className="text-sm font-medium text-gray-700 mb-1 block">
                        Required Skills
                      </Label>
                      
                      {/* Enhanced skills list with drag-and-drop */}
                      <div className="space-y-2 mb-2">
                        {selectedElement?.properties?.requiredSkills?.map((skill: any, index: number) => {
                          const requiredSkills = selectedElement.properties.requiredSkills || [];
                          const totalWeight = requiredSkills.reduce((sum: number, s: any) => sum + s.weight, 0);
                          const percentage = totalWeight > 0 ? Math.round((skill.weight / totalWeight) * 100) : 0;
                          
                          return (
                            <div
                              key={index}
                              draggable
                              onDragStart={() => handleSkillDragStart(selectedElement.id, index)}
                              onDragOver={handleSkillDragOver}
                              onDrop={() => handleSkillDrop(selectedElement.id, index)}
                              className="flex items-center justify-between p-2 bg-white border rounded-lg cursor-move hover:shadow-md transition-shadow"
                            >
                              {/* Drag Handle */}
                              <span className="text-gray-400 mr-2">⋮⋮</span>
                              
                              {/* Skill Info */}
                              <div className="flex-1 flex items-center gap-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getProficiencyColor(skill.level)}`}>
                                  {getProficiencyStars(skill.level)} {skill.level}
                                </span>
                                <span className="font-medium text-gray-800">{skill.name}</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getWeightBadgeColor(skill.weight)}`}>
                                  Weight: {skill.weight} ({percentage}%)
                                </span>
                              </div>
                              
                              {/* Delete Button */}
                              <button
                                onClick={() => removeSkill(selectedElement.id, index)}
                                className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                              >
                                🗑️
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Weight Distribution Display */}
                      {selectedElement?.properties?.requiredSkills?.length > 0 && (
                        <WeightSystemDisplay 
                          requiredSkills={selectedElement.properties.requiredSkills}
                          onNormalizeWeights={(normalizedSkills) => {
                            setCanvasState(prev => ({
                              ...prev,
                              elements: prev.elements.map(el => 
                                el.id === selectedElement.id 
                                  ? { 
                                      ...el, 
                                      properties: { 
                                        ...el.properties, 
                                        requiredSkills: normalizedSkills
                                      }
                                    }
                                  : el
                              )
                            }));
                          }}
                        />
                      )}
                      
                      {/* Add skill button */}
                      <Dialog open={showAddSkillModal} onOpenChange={setShowAddSkillModal}>
                        <DialogTrigger asChild>
                          <Button
                            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2"
                            variant="outline"
                          >
                            <span>➕</span>
                            <span>Add Skill</span>
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Add Required Skill</DialogTitle>
                          </DialogHeader>
                          <SkillForm 
                            onSubmit={(skill) => {
                              const selectedId = canvasState.selectedElements[0];
                              if (selectedId) {
                                setCanvasState(prev => ({
                                  ...prev,
                                  elements: prev.elements.map(el => 
                                    el.id === selectedId 
                                      ? { 
                                          ...el, 
                                          properties: { 
                                            ...el.properties, 
                                            requiredSkills: [...(el.properties.requiredSkills || []), skill]
                                          }
                                        }
                                      : el
                                  )
                                }));
                                setShowAddSkillModal(false);
                              }
                            }}
                            onCancel={() => setShowAddSkillModal(false)}
                          />
                        </DialogContent>
                      </Dialog>

                      {/* Assignment Recommendations Section */}
                      {selectedElement?.properties?.requiredSkills?.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                          <button
                            onClick={() => setShowRecommendations(!showRecommendations)}
                            className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900"
                          >
                            <span className="flex items-center gap-2">
                              📊 Recommended Contacts
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                Auto-matching
                              </span>
                            </span>
                            <span>{showRecommendations ? '▼' : '▶'}</span>
                          </button>
                          
                          {showRecommendations && (
                            <AssignmentRecommendations 
                              requiredSkills={selectedElement.properties.requiredSkills}
                              estimatedHours={selectedElement.properties.estimatedHours}
                              department={selectedElement.properties.contactRequirements?.preferredDepartments?.[0]}
                              onAssignContact={(contact) => {
                                console.log('Assigning contact:', contact);
                                // Add assignment logic here
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Display assigned contacts with real-time availability */}
                    {selectedElement.properties.assignedContacts?.length > 0 && (
                      <div>
                        <Label className="text-sm font-medium">Assigned Team ({selectedElement.properties.assignedContacts.length})</Label>
                        <div className="mt-2 space-y-2">
                          {selectedElement.properties.assignedContacts.map((contactId: string) => {
                            const contact = availableContacts.find(c => (c as any).contactId === contactId || (c as any).id === contactId);
                            return contact ? (
                              <div key={contactId} className="flex items-center gap-3 p-2 border rounded-lg">
                                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                                  {((contact as any).firstName?.[0] || (contact as any).name?.[0] || '?')}{((contact as any).lastName?.[0] || '')}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{(contact as any).firstName || (contact as any).name} {(contact as any).lastName || ''}</p>
                                  <p className="text-xs text-gray-600">{(contact as any).title || (contact as any).jobTitle} • {(contact as any).department}</p>
                                </div>
                                <ContactAvailabilityIndicator
                                  contactId={contactId}
                                  showDetails={true}
                                />
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </ContactErrorBoundary>
                </>
              )}

              {/* Position and Size */}
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">Position & Size</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="pos-x" className="text-xs">X</Label>
                    <Input
                      id="pos-x"
                      type="number"
                      value={selectedElement.position.x}
                      disabled
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pos-y" className="text-xs">Y</Label>
                    <Input
                      id="pos-y"
                      type="number"
                      value={selectedElement.position.y}
                      disabled
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="width" className="text-xs">Width</Label>
                    <Input
                      id="width"
                      type="number"
                      value={selectedElement.size.width}
                      disabled
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="height" className="text-xs">Height</Label>
                    <Input
                      id="height"
                      type="number"
                      value={selectedElement.size.height}
                      disabled
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500 mt-12">
              <Settings size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm mb-2">
                Select elements to view and edit properties
              </p>
              <div className="text-xs text-gray-400 space-y-1">
                <p>• Click elements to select (hold Ctrl for multi-select)</p>
                <p>• Ctrl+A to select all elements</p>
                <p>• Delete key to remove selected elements</p>
                <p>• Use alignment tools when multiple elements are selected</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// SkillForm component for the modal
const SkillForm = ({ onSubmit, onCancel }: { 
  onSubmit: (skill: { name: string; level: string; weight: number }) => void;
  onCancel: () => void;
}) => {
  const [skillName, setSkillName] = useState('');
  const [skillLevel, setSkillLevel] = useState('Intermediate');
  const [skillWeight, setSkillWeight] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (skillName.trim()) {
      onSubmit({
        name: skillName.trim(),
        level: skillLevel,
        weight: skillWeight
      });
      // Reset form
      setSkillName('');
      setSkillLevel('Intermediate');
      setSkillWeight(1);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="skill-name" className="text-sm font-medium">
          Skill Name
        </Label>
        <Input
          id="skill-name"
          value={skillName}
          onChange={(e) => setSkillName(e.target.value)}
          placeholder="e.g., JavaScript, Leadership, Design..."
          className="mt-1"
          required
        />
      </div>

      <div>
        <Label htmlFor="skill-level" className="text-sm font-medium">
          Required Level
        </Label>
        <Select value={skillLevel} onValueChange={setSkillLevel}>
          <SelectTrigger className="mt-1">
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
        <Label htmlFor="skill-weight" className="text-sm font-medium">
          Weight (1-10)
        </Label>
        <Input
          id="skill-weight"
          type="number"
          min="1"
          max="10"
          value={skillWeight}
          onChange={(e) => setSkillWeight(parseInt(e.target.value) || 1)}
          className="mt-1"
        />
        <p className="text-xs text-gray-500 mt-1">
          Higher values indicate more critical skills
        </p>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="submit">
          Add Skill
        </Button>
      </div>
    </form>
  );
};

// Weight System Display Component
const WeightSystemDisplay = ({ requiredSkills, onNormalizeWeights }: { 
  requiredSkills: Array<{ name: string; level: string; weight: number }>;
  onNormalizeWeights: (normalizedSkills: Array<{ name: string; level: string; weight: number }>) => void;
}) => {
  // Calculate total weight and percentages
  const calculateWeightStats = () => {
    if (!requiredSkills || requiredSkills.length === 0) return null;
    
    const totalWeight = requiredSkills.reduce((sum, skill) => sum + skill.weight, 0);
    const skillsWithPercentage = requiredSkills.map(skill => ({
      ...skill,
      percentage: Math.round((skill.weight / totalWeight) * 100)
    }));
    
    return { totalWeight, skillsWithPercentage };
  };

  // Helper function for weight colors
  const getWeightColor = (weight: number) => {
    if (weight >= 8) return 'bg-red-500';
    if (weight >= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Function to normalize weights to 100
  const normalizeWeights = () => {
    const totalWeight = requiredSkills.reduce((sum, skill) => sum + skill.weight, 0);
    const normalizedSkills = requiredSkills.map(skill => ({
      ...skill,
      weight: Math.round((skill.weight / totalWeight) * 100)
    }));
    onNormalizeWeights(normalizedSkills);
  };

  const stats = calculateWeightStats();
  if (!stats) return null;
  
  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          Total Weight: {stats.totalWeight} points
        </span>
        <Button
          onClick={normalizeWeights}
          variant="outline"
          size="sm"
          className="text-xs px-2 py-1 h-6 bg-blue-100 text-blue-700 hover:bg-blue-200"
        >
          Normalize to 100%
        </Button>
      </div>
      
      {/* Weight Distribution Bar */}
      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden flex mb-2">
        {stats.skillsWithPercentage.map((skill, idx) => (
          <div
            key={idx}
            className={`h-full ${getWeightColor(skill.weight)}`}
            style={{ width: `${skill.percentage}%` }}
            title={`${skill.name}: ${skill.percentage}%`}
          />
        ))}
      </div>
      
      {/* Skill Breakdown */}
      <div className="space-y-1 mb-2">
        {stats.skillsWithPercentage.map((skill, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${getWeightColor(skill.weight)}`}></div>
              <span className="text-gray-700">{skill.name}</span>
            </div>
            <span className="text-gray-600 font-medium">{skill.percentage}%</span>
          </div>
        ))}
      </div>
      
      {/* Weight Legend */}
      <div className="flex justify-between text-xs text-gray-600 pt-2 border-t border-gray-300">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded bg-green-500"></div>
          Nice-to-have (1-3)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded bg-yellow-500"></div>
          Important (4-7)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded bg-red-500"></div>
          Critical (8-10)
        </span>
      </div>
    </div>
  );
};

// Assignment Recommendations Component
const AssignmentRecommendations = ({ 
  requiredSkills, 
  estimatedHours, 
  department,
  onAssignContact 
}: {
  requiredSkills: Array<{ name: string; level: string; weight: number }>;
  estimatedHours?: number;
  department?: string;
  onAssignContact: (contact: any) => void;
}) => {
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Mock contacts data (replace with your actual contacts)
  const mockContacts = [
    {
      id: 1,
      name: 'John Smith',
      title: 'Senior Developer',
      department: 'Engineering',
      avatar: 'JS',
      skills: [
        { name: 'JavaScript', level: 'expert' },
        { name: 'React', level: 'intermediate' },
        { name: 'Node.js', level: 'intermediate' }
      ],
      availability: 'available',
      currentWorkload: 60,
      maxCapacity: 100
    },
    {
      id: 2,
      name: 'Sarah Johnson',
      title: 'Full Stack Engineer',
      department: 'Engineering',
      avatar: 'SJ',
      skills: [
        { name: 'JavaScript', level: 'intermediate' },
        { name: 'MySQL', level: 'expert' },
        { name: 'AWS', level: 'beginner' }
      ],
      availability: 'busy',
      currentWorkload: 80,
      maxCapacity: 100
    },
    {
      id: 3,
      name: 'Mike Chen',
      title: 'Tech Lead',
      department: 'Engineering',
      avatar: 'MC',
      skills: [
        { name: 'JavaScript', level: 'expert' },
        { name: 'HTML', level: 'expert' },
        { name: 'MySQL', level: 'intermediate' }
      ],
      availability: 'available',
      currentWorkload: 40,
      maxCapacity: 100
    },
    {
      id: 4,
      name: 'Emily Davis',
      title: 'Backend Developer',
      department: 'Engineering',
      avatar: 'ED',
      skills: [
        { name: 'Python', level: 'expert' },
        { name: 'MySQL', level: 'expert' },
        { name: 'AWS', level: 'intermediate' }
      ],
      availability: 'available',
      currentWorkload: 30,
      maxCapacity: 100
    }
  ];

  // Calculate match score for each contact
  const calculateMatchScore = (contact: any) => {
    if (!requiredSkills || requiredSkills.length === 0) return 0;

    const levelValues: Record<string, number> = {
      beginner: 1,
      intermediate: 2,
      expert: 3,
      advanced: 3 // Map 'advanced' to expert level
    };

    let totalWeight = requiredSkills.reduce((sum, skill) => sum + skill.weight, 0);
    let achievedScore = 0;
    let matchedSkills: string[] = [];
    let missingSkills: string[] = [];

    requiredSkills.forEach(reqSkill => {
      const contactSkill = contact.skills.find(
        (cs: any) => cs.name.toLowerCase() === reqSkill.name.toLowerCase()
      );

      if (contactSkill) {
        const reqLevel = levelValues[reqSkill.level] || 2;
        const hasLevel = levelValues[contactSkill.level] || 1;
        
        if (hasLevel >= reqLevel) {
          achievedScore += reqSkill.weight;
          matchedSkills.push(reqSkill.name);
        } else if (hasLevel === reqLevel - 1) {
          achievedScore += reqSkill.weight * 0.5;
          matchedSkills.push(`${reqSkill.name} (partial)`);
        } else {
          missingSkills.push(reqSkill.name);
        }
      } else {
        missingSkills.push(reqSkill.name);
      }
    });

    const skillScore = totalWeight > 0 ? Math.round((achievedScore / totalWeight) * 100) : 0;
    
    // Factor in availability (25% weight)
    const availabilityScore = 
      contact.availability === 'available' ? 100 :
      contact.availability === 'busy' ? 50 : 0;
    
    // Factor in workload (20% weight)
    const workloadScore = Math.max(0, 100 - contact.currentWorkload);
    
    // Factor in department match (10% weight)
    const deptScore = contact.department === department ? 100 : 50;
    
    // Calculate final score
    const finalScore = Math.round(
      skillScore * 0.45 +
      availabilityScore * 0.25 +
      workloadScore * 0.20 +
      deptScore * 0.10
    );

    return {
      ...contact,
      matchScore: finalScore,
      skillMatchScore: skillScore,
      matchedSkills,
      missingSkills,
      recommendation: getRecommendationReason(finalScore, matchedSkills.length, contact.availability)
    };
  };

  const getRecommendationReason = (score: number, matchedCount: number, availability: string) => {
    if (score >= 80) return `Excellent match with ${matchedCount} matching skills`;
    if (score >= 60) return `Good match, ${availability === 'available' ? 'available now' : 'currently busy'}`;
    if (score >= 40) return `Partial match, may need support`;
    return `Limited match, consider alternatives`;
  };

  // Generate recommendations when skills change
  useEffect(() => {
    if (requiredSkills && requiredSkills.length > 0) {
      setLoading(true);
      setTimeout(() => {
        const scored = mockContacts
          .map(calculateMatchScore)
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 5);
        setRecommendations(scored);
        setLoading(false);
      }, 500); // Simulate API delay
    } else {
      setRecommendations([]);
    }
  }, [requiredSkills, department]);

  const getAvailabilityColor = (availability: string) => {
    switch(availability) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  if (!requiredSkills || requiredSkills.length === 0) {
    return null; // Don't show recommendations if no skills defined
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          📊 Recommended Contacts
          {loading && (
            <span className="text-xs text-gray-500">(Auto-matching...)</span>
          )}
        </h3>
        {recommendations.length > 3 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            {showAll ? 'Show Less' : `Show All (${recommendations.length})`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-20 bg-gray-100 rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : recommendations.length > 0 ? (
        <div className="space-y-2">
          {recommendations.slice(0, showAll ? undefined : 3).map((contact, idx) => (
            <div
              key={contact.id}
              className="p-3 bg-white border rounded-lg hover:shadow-md transition-shadow"
            >
              {/* Contact Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
                    {contact.avatar}
                  </div>
                  
                  {/* Contact Info */}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{contact.name}</span>
                      <div className={`w-2 h-2 rounded-full ${getAvailabilityColor(contact.availability)}`} 
                           title={contact.availability} />
                    </div>
                    <div className="text-xs text-gray-600">
                      {contact.title} • {contact.department}
                    </div>
                  </div>
                </div>

                {/* Match Score */}
                <div className={`px-2 py-1 rounded-full text-xs font-semibold ${getScoreColor(contact.matchScore)}`}>
                  {contact.matchScore}%
                </div>
              </div>

              {/* Skills Match */}
              <div className="mb-2">
                <div className="flex flex-wrap gap-1">
                  {contact.matchedSkills.slice(0, 3).map((skill: string, i: number) => (
                    <span key={i} className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                      ✓ {skill}
                    </span>
                  ))}
                  {contact.missingSkills.length > 0 && (
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">
                      Missing: {contact.missingSkills.slice(0, 2).join(', ')}
                      {contact.missingSkills.length > 2 && ` +${contact.missingSkills.length - 2}`}
                    </span>
                  )}
                </div>
              </div>

              {/* Workload Bar */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                  <span>Workload</span>
                  <span>{contact.currentWorkload}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      contact.currentWorkload > 80 ? 'bg-red-500' :
                      contact.currentWorkload > 60 ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${contact.currentWorkload}%` }}
                  />
                </div>
              </div>

              {/* Recommendation Reason */}
              <div className="text-xs text-gray-600 italic mb-2">
                💡 {contact.recommendation}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => onAssignContact(contact)}
                  className="flex-1 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                >
                  Assign
                </button>
                <button
                  className="px-3 py-1 border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50"
                >
                  View Profile
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded-lg text-center text-sm text-gray-600">
          No recommendations available. Add required skills to see matching contacts.
        </div>
      )}
    </div>
  );
};

export default WorkflowCanvas;