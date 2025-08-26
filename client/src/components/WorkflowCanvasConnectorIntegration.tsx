import React from 'react';
import { Connection } from '../types/workflow';
import { WorkflowConnector } from './WorkflowConnector';
import { ConnectionCreator } from './ConnectionCreator';

interface WorkflowElement {
  id: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface WorkflowCanvasConnectorProps {
  bpmnConnections: Connection[];
  isConnectionMode: boolean;
  selectedBpmnConnection: string | null;
  canvasState: {
    elements: WorkflowElement[];
    canvasSize: { width: number; height: number };
    zoom: number;
  };
  onConnectionCreate: (connection: Omit<Connection, 'id'>) => void;
  onConnectionSelect: (connectionId: string) => void;
  onConnectionDelete: (connectionId: string) => void;
}

export const WorkflowCanvasConnectorIntegration: React.FC<WorkflowCanvasConnectorProps> = ({
  bpmnConnections,
  isConnectionMode,
  selectedBpmnConnection,
  canvasState,
  onConnectionCreate,
  onConnectionSelect,
  onConnectionDelete
}) => {
  return (
    <svg
      className="absolute top-0 left-0 pointer-events-auto"
      style={{
        width: canvasState.canvasSize.width * canvasState.zoom,
        height: canvasState.canvasSize.height * canvasState.zoom,
        transform: `scale(${canvasState.zoom})`,
        transformOrigin: '0 0',
        zIndex: 15 // Below elements but above grid
      }}
    >
      {/* Render BPMN connections */}
      {bpmnConnections.map(connection => {
        const sourceEl = canvasState.elements.find(el => el.id === connection.sourceId);
        const targetEl = canvasState.elements.find(el => el.id === connection.targetId);
        
        if (!sourceEl || !targetEl) return null;
        
        return (
          <WorkflowConnector
            key={connection.id}
            connection={connection}
            sourceElement={{
              ...sourceEl,
              x: sourceEl.position.x,
              y: sourceEl.position.y,
              width: sourceEl.size.width,
              height: sourceEl.size.height
            }}
            targetElement={{
              ...targetEl,
              x: targetEl.position.x,
              y: targetEl.position.y,
              width: targetEl.size.width,
              height: targetEl.size.height
            }}
            onSelect={onConnectionSelect}
            onDelete={onConnectionDelete}
            isSelected={selectedBpmnConnection === connection.id}
          />
        );
      })}
      
      {/* Connection creation mode */}
      {isConnectionMode && (
        <ConnectionCreator
          elements={canvasState.elements.map(el => ({
            id: el.id,
            x: el.position.x,
            y: el.position.y,
            width: el.size.width,
            height: el.size.height
          }))}
          onConnectionCreate={onConnectionCreate}
        />
      )}
    </svg>
  );
};