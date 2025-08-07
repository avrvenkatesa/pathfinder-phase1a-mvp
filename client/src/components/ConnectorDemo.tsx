import React, { useState } from 'react';
import { WorkflowConnector, ConnectionCreator, Connection } from './WorkflowConnector';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const ConnectorDemo: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([
    {
      id: '1',
      sourceId: 'task1',
      targetId: 'task2',
      sourceAnchor: 'right',
      targetAnchor: 'left',
      type: 'sequence'
    }
  ]);
  
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);

  // Demo elements
  const elements = [
    { id: 'task1', x: 100, y: 100, width: 120, height: 80, name: 'Start Task' },
    { id: 'task2', x: 300, y: 100, width: 120, height: 80, name: 'Process' },
    { id: 'task3', x: 500, y: 100, width: 120, height: 80, name: 'End Task' }
  ];

  const handleConnectionCreate = (connection: Omit<Connection, 'id'>) => {
    const newConnection: Connection = {
      ...connection,
      id: Date.now().toString()
    };
    setConnections(prev => [...prev, newConnection]);
  };

  const handleConnectionSelect = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
  };

  const handleConnectionDelete = (connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId));
    setSelectedConnectionId(null);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">BPMN Connectors Demo</h3>
      <p className="text-sm text-gray-600 mb-4">
        Click on blue anchor points to create connections between elements. 
        Click existing connections to select and delete them.
      </p>
      
      <div className="relative bg-gray-50 border rounded-lg" style={{ width: 700, height: 400 }}>
        {/* Demo Elements */}
        {elements.map(element => (
          <div
            key={element.id}
            className="absolute bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center shadow-sm"
            style={{
              left: element.x,
              top: element.y,
              width: element.width,
              height: element.height
            }}
          >
            <span className="text-sm font-medium">{element.name}</span>
          </div>
        ))}

        {/* SVG for Connectors */}
        <svg
          className="absolute top-0 left-0 pointer-events-auto"
          width="700"
          height="400"
        >
          {/* Render existing connections */}
          {connections.map(connection => {
            const sourceElement = elements.find(el => el.id === connection.sourceId);
            const targetElement = elements.find(el => el.id === connection.targetId);
            
            if (!sourceElement || !targetElement) return null;
            
            return (
              <WorkflowConnector
                key={connection.id}
                connection={connection}
                sourceElement={sourceElement}
                targetElement={targetElement}
                onSelect={handleConnectionSelect}
                onDelete={handleConnectionDelete}
                isSelected={selectedConnectionId === connection.id}
              />
            );
          })}
          
          {/* Connection Creator */}
          <ConnectionCreator
            elements={elements}
            onConnectionCreate={handleConnectionCreate}
          />
        </svg>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          onClick={() => {
            setConnections([
              {
                id: '1',
                sourceId: 'task1',
                targetId: 'task2',
                sourceAnchor: 'right',
                targetAnchor: 'left',
                type: 'sequence'
              },
              {
                id: '2',
                sourceId: 'task2',
                targetId: 'task3',
                sourceAnchor: 'right',
                targetAnchor: 'left',
                type: 'sequence'
              }
            ]);
          }}
          variant="outline"
        >
          Add Demo Connections
        </Button>
        <Button
          onClick={() => setConnections([])}
          variant="outline"
        >
          Clear All
        </Button>
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        <p><strong>Features:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Visual anchor points on hover for connection creation</li>
          <li>Smooth bezier curves for professional workflow appearance</li>
          <li>Click to select connections with visual feedback</li>
          <li>Delete button appears on selected connections</li>
          <li>Support for different connection types (sequence, conditional, message)</li>
          <li>Fully integrated with the workflow canvas system</li>
        </ul>
      </div>
    </Card>
  );
};

export default ConnectorDemo;