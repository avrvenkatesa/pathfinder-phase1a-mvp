import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Save, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Settings, 
  ZoomIn, 
  ZoomOut,
  Copy,
  FileText,
  Activity,
  GitBranch,
  Circle,
  Square,
  Diamond,
  ArrowRight
} from 'lucide-react';
import type { BpmnElement, BpmnConnection, WorkflowDefinition } from '@shared/schema';

// BPMN Element Types
interface ElementType {
  id: string;
  name: string;
  type: BpmnElement['type'];
  icon: React.ComponentType<any>;
  color: string;
  description: string;
}

const ELEMENT_TYPES: ElementType[] = [
  {
    id: 'start_event',
    name: 'Start Event',
    type: 'start_event',
    icon: Circle,
    color: 'bg-green-500',
    description: 'Triggers the start of the workflow'
  },
  {
    id: 'end_event',
    name: 'End Event',
    type: 'end_event',
    icon: Circle,
    color: 'bg-red-500',
    description: 'Marks the end of the workflow'
  },
  {
    id: 'user_task',
    name: 'User Task',
    type: 'user_task',
    icon: Square,
    color: 'bg-blue-500',
    description: 'Task that requires human interaction'
  },
  {
    id: 'system_task',
    name: 'System Task',
    type: 'system_task',
    icon: Square,
    color: 'bg-purple-500',
    description: 'Automated system task'
  },
  {
    id: 'decision_gateway',
    name: 'Decision Gateway',
    type: 'decision_gateway',
    icon: Diamond,
    color: 'bg-orange-500',
    description: 'Decision point with multiple paths'
  }
];

// Grid settings
const GRID_SIZE = 20;
const SNAP_TO_GRID = true;

// Draggable Element from Palette
function DraggableElement({ elementType }: { elementType: ElementType }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `palette-${elementType.id}`,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  const Icon = elementType.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="flex items-center space-x-2 p-2 border rounded-lg cursor-grab hover:bg-gray-50 active:cursor-grabbing"
    >
      <div className={`w-6 h-6 rounded flex items-center justify-center text-white ${elementType.color}`}>
        <Icon size={14} />
      </div>
      <div className="text-sm font-medium">{elementType.name}</div>
    </div>
  );
}

// Canvas Element
function CanvasElement({ 
  element, 
  onSelect, 
  onDelete, 
  isSelected 
}: { 
  element: BpmnElement; 
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
}) {
  const elementType = ELEMENT_TYPES.find(t => t.type === element.type);
  if (!elementType) return null;

  const Icon = elementType.icon;

  return (
    <div
      className={`absolute cursor-pointer group ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
      style={{
        left: element.position.x,
        top: element.position.y,
        transform: 'translate(-50%, -50%)'
      }}
      onClick={() => onSelect(element.id)}
    >
      <div className={`w-16 h-12 rounded-lg border-2 border-gray-300 bg-white flex items-center justify-center shadow-sm hover:shadow-md transition-shadow ${elementType.color} bg-opacity-10`}>
        <Icon size={20} className={`text-white`} style={{ color: elementType.color.replace('bg-', '').replace('-500', '') }} />
      </div>
      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-700 whitespace-nowrap">
        {element.name}
      </div>
      {isSelected && (
        <Button
          size="sm"
          variant="destructive"
          className="absolute -top-2 -right-2 w-6 h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(element.id);
          }}
        >
          <Trash2 size={12} />
        </Button>
      )}
    </div>
  );
}

// Connection Line Component
function ConnectionLine({ connection, elements }: { connection: BpmnConnection; elements: BpmnElement[] }) {
  const sourceElement = elements.find(e => e.id === connection.sourceId);
  const targetElement = elements.find(e => e.id === connection.targetId);
  
  if (!sourceElement || !targetElement) return null;

  const startX = sourceElement.position.x;
  const startY = sourceElement.position.y;
  const endX = targetElement.position.x;
  const endY = targetElement.position.y;

  // Calculate arrow path
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 1 }}
    >
      <defs>
        <marker
          id={`arrowhead-${connection.id}`}
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill="#6b7280"
          />
        </marker>
      </defs>
      <path
        d={`M ${startX} ${startY} Q ${midX} ${startY} ${endX} ${endY}`}
        stroke="#6b7280"
        strokeWidth="2"
        fill="none"
        markerEnd={`url(#arrowhead-${connection.id})`}
      />
      {connection.name && (
        <text
          x={midX}
          y={midY - 10}
          textAnchor="middle"
          className="text-xs fill-gray-600"
          style={{ fontSize: '12px' }}
        >
          {connection.name}
        </text>
      )}
    </svg>
  );
}

// Main Workflow Designer Component
export function WorkflowDesigner() {
  const [workflow, setWorkflow] = useState<WorkflowDefinition>({
    id: '',
    name: 'New Workflow',
    description: '',
    elements: [],
    connections: [],
    variables: {},
    version: '1.0',
    metadata: {}
  });
  
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // Droppable canvas
  const { setNodeRef: setCanvasRef } = useDroppable({
    id: 'workflow-canvas',
  });

  // Auto-save functionality
  useEffect(() => {
    const autoSave = setInterval(() => {
      // Auto-save logic here
      console.log('Auto-saving workflow...');
    }, 30000); // 30 seconds

    return () => clearInterval(autoSave);
  }, [workflow]);

  // Handle drag end from palette to canvas
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || over.id !== 'workflow-canvas') return;
    
    const activeId = active.id as string;
    if (activeId.startsWith('palette-')) {
      const elementTypeId = activeId.replace('palette-', '');
      const elementType = ELEMENT_TYPES.find(t => t.id === elementTypeId);
      
      if (elementType && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = (event.activatorEvent as MouseEvent).clientX - rect.left;
        const y = (event.activatorEvent as MouseEvent).clientY - rect.top;
        
        // Snap to grid
        const snappedX = SNAP_TO_GRID ? Math.round(x / GRID_SIZE) * GRID_SIZE : x;
        const snappedY = SNAP_TO_GRID ? Math.round(y / GRID_SIZE) * GRID_SIZE : y;
        
        const newElement: BpmnElement = {
          id: `${elementType.type}_${Date.now()}`,
          type: elementType.type,
          name: elementType.name,
          position: { x: snappedX, y: snappedY },
          properties: {}
        };
        
        setWorkflow(prev => ({
          ...prev,
          elements: [...prev.elements, newElement]
        }));
      }
    }
  }, []);

  // Select element
  const handleSelectElement = useCallback((elementId: string) => {
    setSelectedElementId(elementId);
  }, []);

  // Delete element
  const handleDeleteElement = useCallback((elementId: string) => {
    setWorkflow(prev => ({
      ...prev,
      elements: prev.elements.filter(e => e.id !== elementId),
      connections: prev.connections.filter(c => c.sourceId !== elementId && c.targetId !== elementId)
    }));
    setSelectedElementId(null);
  }, []);

  // Update selected element properties
  const handleUpdateElement = useCallback((updates: Partial<BpmnElement>) => {
    if (!selectedElementId) return;
    
    setWorkflow(prev => ({
      ...prev,
      elements: prev.elements.map(element =>
        element.id === selectedElementId ? { ...element, ...updates } : element
      )
    }));
  }, [selectedElementId]);

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoom(1);

  // Save workflow
  const handleSave = async () => {
    try {
      // API call to save workflow
      console.log('Saving workflow:', workflow);
      // TODO: Implement actual save functionality
    } catch (error) {
      console.error('Failed to save workflow:', error);
    }
  };

  // Export workflow
  const handleExport = () => {
    const dataStr = JSON.stringify(workflow, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${workflow.name.replace(/\s+/g, '_')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const selectedElement = selectedElementId ? workflow.elements.find(e => e.id === selectedElementId) : null;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex h-screen bg-gray-100">
        {/* Element Palette */}
        <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Elements</h3>
            <p className="text-sm text-gray-500">Drag elements to canvas</p>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              {ELEMENT_TYPES.map((elementType) => (
                <DraggableElement
                  key={elementType.id}
                  elementType={elementType}
                />
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Input
                value={workflow.name}
                onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                className="text-lg font-semibold border-none p-0 h-auto focus:ring-0"
                placeholder="Workflow Name"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Button size="sm" variant="outline" onClick={handleZoomOut}>
                <ZoomOut size={16} />
              </Button>
              <span className="text-sm text-gray-600 min-w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button size="sm" variant="outline" onClick={handleZoomIn}>
                <ZoomIn size={16} />
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <Button size="sm" variant="outline" onClick={handleSave}>
                <Save size={16} className="mr-1" />
                Save
              </Button>
              <Button size="sm" variant="outline" onClick={handleExport}>
                <Download size={16} className="mr-1" />
                Export
              </Button>
              <Button size="sm">
                <Play size={16} className="mr-1" />
                Execute
              </Button>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative overflow-hidden">
            <div
              ref={(node) => {
                setCanvasRef(node);
                if (canvasRef.current !== node) {
                  (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
                }
              }}
              className="w-full h-full relative"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                backgroundImage: `
                  radial-gradient(circle, #e5e7eb 1px, transparent 1px)
                `,
                backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
              }}
            >
              {/* Render connections */}
              {workflow.connections.map((connection) => (
                <ConnectionLine
                  key={connection.id}
                  connection={connection}
                  elements={workflow.elements}
                />
              ))}
              
              {/* Render elements */}
              {workflow.elements.map((element) => (
                <CanvasElement
                  key={element.id}
                  element={element}
                  onSelect={handleSelectElement}
                  onDelete={handleDeleteElement}
                  isSelected={selectedElementId === element.id}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Properties</h3>
          </div>
          
          <ScrollArea className="flex-1">
            {selectedElement ? (
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <Input
                    value={selectedElement.name}
                    onChange={(e) => handleUpdateElement({ name: e.target.value })}
                    placeholder="Element name"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type
                  </label>
                  <Badge variant="secondary" className="capitalize">
                    {selectedElement.type.replace('_', ' ')}
                  </Badge>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      value={selectedElement.position.x}
                      onChange={(e) => handleUpdateElement({
                        position: { ...selectedElement.position, x: parseInt(e.target.value) || 0 }
                      })}
                      placeholder="X"
                    />
                    <Input
                      type="number"
                      value={selectedElement.position.y}
                      onChange={(e) => handleUpdateElement({
                        position: { ...selectedElement.position, y: parseInt(e.target.value) || 0 }
                      })}
                      placeholder="Y"
                    />
                  </div>
                </div>

                {selectedElement.type === 'user_task' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Assignee
                    </label>
                    <Input
                      value={selectedElement.properties?.assignee || ''}
                      onChange={(e) => handleUpdateElement({
                        properties: { ...selectedElement.properties, assignee: e.target.value }
                      })}
                      placeholder="Select contact..."
                    />
                  </div>
                )}

                {selectedElement.type === 'decision_gateway' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Condition
                    </label>
                    <Textarea
                      value={selectedElement.properties?.condition || ''}
                      onChange={(e) => handleUpdateElement({
                        properties: { ...selectedElement.properties, condition: e.target.value }
                      })}
                      placeholder="Enter condition logic..."
                      rows={3}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4">
                <div className="text-center text-gray-500">
                  <Settings size={48} className="mx-auto mb-2 opacity-50" />
                  <p>Select an element to view its properties</p>
                </div>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </DndContext>
  );
}

export default WorkflowDesigner;