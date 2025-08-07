import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { WorkflowConnector } from './WorkflowConnector';
interface BpmnConnection {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'sequence' | 'conditional' | 'message';
}

interface WorkflowElement {
  id: string;
  type: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface BpmnCanvasConnectorProps {
  canvasState: {
    elements: WorkflowElement[];
    selectedElements: string[];
  };
  bpmnConnections: BpmnConnection[];
  selectedBpmnConnection: string | null;
  onConnectionCreate: (connection: Omit<BpmnConnection, 'id'>) => void;
  onConnectionSelect: (connectionId: string) => void;
  onConnectionDelete: (connectionId: string) => void;
}

export function BpmnCanvasConnector({
  canvasState,
  bpmnConnections,
  selectedBpmnConnection,
  onConnectionCreate,
  onConnectionSelect,
  onConnectionDelete
}: BpmnCanvasConnectorProps) {
  const [isConnectionMode, setIsConnectionMode] = useState(false);

  return (
    <>
      {/* Connection Mode Button */}
      <div className="absolute top-4 right-4 z-50">
        <Button
          size="sm"
          variant={isConnectionMode ? "default" : "outline"}
          onClick={() => setIsConnectionMode(!isConnectionMode)}
          className={`shadow-lg ${isConnectionMode ? "bg-blue-500 text-white" : "bg-white"}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          {isConnectionMode ? "Exit" : "Connect"}
        </Button>
      </div>

      {/* BPMN Connectors Visual Layer */}
      <svg className="absolute top-0 left-0 pointer-events-none" style={{ width: '100%', height: '100%', zIndex: 15 }}>
        {bpmnConnections.map(connection => {
          const sourceEl = canvasState.elements.find(el => el.id === connection.sourceId);
          const targetEl = canvasState.elements.find(el => el.id === connection.targetId);
          if (!sourceEl || !targetEl) return null;
          return (
            <WorkflowConnector
              key={connection.id}
              connection={connection}
              sourceElement={{ ...sourceEl, x: sourceEl.position.x, y: sourceEl.position.y, width: sourceEl.size.width, height: sourceEl.size.height }}
              targetElement={{ ...targetEl, x: targetEl.position.x, y: targetEl.position.y, width: targetEl.size.width, height: targetEl.size.height }}
              onSelect={onConnectionSelect}
              onDelete={onConnectionDelete}
              isSelected={selectedBpmnConnection === connection.id}
            />
          );
        })}
      </svg>

      {/* Interactive Connection Creator - Simple implementation */}
      {isConnectionMode && (
        <div className="absolute top-16 right-4 bg-white p-2 rounded shadow-lg border z-50">
          <p className="text-sm text-gray-600">Connection Mode Active</p>
          <p className="text-xs text-gray-500">Click between elements to connect</p>
        </div>
      )}
    </>
  );
}