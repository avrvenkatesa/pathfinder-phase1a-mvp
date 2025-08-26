import React, { useState, useRef, useEffect } from 'react';

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  sourceAnchor: 'top' | 'right' | 'bottom' | 'left';
  targetAnchor: 'top' | 'right' | 'bottom' | 'left';
  type: 'sequence' | 'conditional' | 'default' | 'message';
  label?: string;
  condition?: string;
  selected?: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface ConnectorProps {
  connection: Connection;
  sourceElement: any;
  targetElement: any;
  onSelect: (connectionId: string) => void;
  onDelete: (connectionId: string) => void;
  isSelected: boolean;
}

export const WorkflowConnector: React.FC<ConnectorProps> = ({
  connection,
  sourceElement,
  targetElement,
  onSelect,
  onDelete,
  isSelected
}) => {
  const getAnchorPoint = (element: any, anchor: string): Point => {
    const { x, y, width, height } = element;
    
    switch (anchor) {
      case 'top':
        return { x: x + width / 2, y };
      case 'right':
        return { x: x + width, y: y + height / 2 };
      case 'bottom':
        return { x: x + width / 2, y: y + height };
      case 'left':
        return { x, y: y + height / 2 };
      default:
        return { x: x + width / 2, y: y + height / 2 };
    }
  };

  const createPath = (start: Point, end: Point): string => {
    // Simple bezier curve for smooth connections
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Calculate control points for bezier curve
    const cx1 = start.x + dx * 0.5;
    const cy1 = start.y;
    const cx2 = end.x - dx * 0.5;
    const cy2 = end.y;
    
    // For straight lines when elements are aligned
    if (Math.abs(dx) < 20 || Math.abs(dy) < 20) {
      return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }
    
    // Curved path for better visibility
    return `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`;
  };

  const startPoint = getAnchorPoint(sourceElement, connection.sourceAnchor);
  const endPoint = getAnchorPoint(targetElement, connection.targetAnchor);
  const pathData = createPath(startPoint, endPoint);

  // Calculate arrow rotation
  const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
  const arrowTransform = `translate(${endPoint.x}, ${endPoint.y}) rotate(${angle * 180 / Math.PI})`;

  const getStrokeDasharray = () => {
    switch (connection.type) {
      case 'conditional':
        return '5,5';
      case 'message':
        return '10,5';
      default:
        return 'none';
    }
  };

  return (
    <g className="connector-group">
      {/* Invisible wider path for easier selection */}
      <path
        d={pathData}
        stroke="transparent"
        strokeWidth="20"
        fill="none"
        style={{ cursor: 'pointer' }}
        onClick={() => onSelect(connection.id)}
      />
      
      {/* Visible connection line */}
      <path
        d={pathData}
        stroke={isSelected ? '#3b82f6' : '#6b7280'}
        strokeWidth={isSelected ? 2.5 : 2}
        strokeDasharray={getStrokeDasharray()}
        fill="none"
        className="transition-all duration-200"
      />
      
      {/* Arrow head */}
      <g transform={arrowTransform}>
        <path
          d="M 0 0 L -10 -5 L -10 5 Z"
          fill={isSelected ? '#3b82f6' : '#6b7280'}
        />
      </g>
      
      {/* Connection label */}
      {connection.label && (
        <g>
          <rect
            x={startPoint.x + (endPoint.x - startPoint.x) / 2 - 30}
            y={startPoint.y + (endPoint.y - startPoint.y) / 2 - 10}
            width="60"
            height="20"
            fill="white"
            stroke={isSelected ? '#3b82f6' : '#6b7280'}
            rx="3"
          />
          <text
            x={startPoint.x + (endPoint.x - startPoint.x) / 2}
            y={startPoint.y + (endPoint.y - startPoint.y) / 2 + 4}
            textAnchor="middle"
            fontSize="12"
            fill="#374151"
          >
            {connection.label}
          </text>
        </g>
      )}
      
      {/* Delete button when selected */}
      {isSelected && (
        <g
          transform={`translate(${startPoint.x + (endPoint.x - startPoint.x) / 2}, ${
            startPoint.y + (endPoint.y - startPoint.y) / 2 - 30
          })`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(connection.id);
          }}
          style={{ cursor: 'pointer' }}
        >
          <circle r="10" fill="#ef4444" />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill="white"
            fontSize="14"
            fontWeight="bold"
          >
            ×
          </text>
        </g>
      )}
    </g>
  );
};

// Connection Creation Handler Component
export const ConnectionCreator: React.FC<{
  elements: any[];
  onConnectionCreate: (connection: Omit<Connection, 'id'>) => void;
}> = ({ elements, onConnectionCreate }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{
    elementId: string;
    anchor: 'top' | 'right' | 'bottom' | 'left';
    x: number;
    y: number;
  } | null>(null);
  const [currentMousePos, setCurrentMousePos] = useState({ x: 0, y: 0 });
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const [hoveredAnchor, setHoveredAnchor] = useState<{
    elementId: string;
    anchor: 'top' | 'right' | 'bottom' | 'left';
  } | null>(null);

  const getAnchorPosition = (element: any, anchor: 'top' | 'right' | 'bottom' | 'left') => {
    switch (anchor) {
      case 'top':
        return { x: element.x + element.width / 2, y: element.y };
      case 'right':
        return { x: element.x + element.width, y: element.y + element.height / 2 };
      case 'bottom':
        return { x: element.x + element.width / 2, y: element.y + element.height };
      case 'left':
        return { x: element.x, y: element.y + element.height / 2 };
      default:
        return { x: element.x, y: element.y };
    }
  };

  const handleMouseDown = (elementId: string, anchor: 'top' | 'right' | 'bottom' | 'left', event: React.MouseEvent) => {
    event.preventDefault();
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    const anchorPos = getAnchorPosition(element, anchor);
    setDragStart({
      elementId,
      anchor,
      x: anchorPos.x,
      y: anchorPos.y
    });
    setIsDragging(true);
    setCurrentMousePos({ x: anchorPos.x, y: anchorPos.y });
  };

  const handleMouseMove = (event: React.MouseEvent<SVGGElement>) => {
    if (!isDragging || !dragStart) return;
    
    const rect = (event.currentTarget as SVGGElement).getBoundingClientRect();
    setCurrentMousePos({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    });
  };

  const handleMouseUp = (event: React.MouseEvent<SVGGElement>) => {
    if (!isDragging || !dragStart) return;

    // Check if we're over a valid target anchor
    if (hoveredAnchor && hoveredAnchor.elementId !== dragStart.elementId) {
      onConnectionCreate({
        sourceId: dragStart.elementId,
        targetId: hoveredAnchor.elementId,
        sourceAnchor: dragStart.anchor,
        targetAnchor: hoveredAnchor.anchor,
        type: 'sequence'
      });
    }

    // Reset drag state
    setIsDragging(false);
    setDragStart(null);
    setHoveredAnchor(null);
  };

  return (
    <g onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      {/* Invisible hover areas for each element */}
      {elements.map(element => (
        <rect
          key={`hover-${element.id}`}
          x={element.x - 10}
          y={element.y - 10}
          width={element.width + 20}
          height={element.height + 20}
          fill="transparent"
          onMouseEnter={() => setHoveredElement(element.id)}
          onMouseLeave={() => setHoveredElement(null)}
        />
      ))}

      {/* Connection anchors on elements */}
      {elements.map(element => {
        const showAnchors = hoveredElement === element.id || isDragging;
        const anchors: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
        
        return (
          <g key={element.id}>
            {anchors.map(anchor => {
              const pos = getAnchorPosition(element, anchor);
              const isHovered = hoveredAnchor?.elementId === element.id && hoveredAnchor?.anchor === anchor;
              
              return (
                <circle
                  key={anchor}
                  cx={pos.x}
                  cy={pos.y}
                  r="6"
                  fill={isHovered ? "#1d4ed8" : "#3b82f6"}
                  stroke={isHovered ? "#ffffff" : "none"}
                  strokeWidth="2"
                  opacity={showAnchors ? 1 : 0}
                  className="transition-all duration-200"
                  style={{ 
                    cursor: 'crosshair', 
                    pointerEvents: showAnchors ? 'auto' : 'none' 
                  }}
                  onMouseDown={(e) => handleMouseDown(element.id, anchor, e)}
                  onMouseEnter={() => setHoveredAnchor({ elementId: element.id, anchor })}
                  onMouseLeave={() => setHoveredAnchor(null)}
                />
              );
            })}
          </g>
        );
      })}
      
      {/* Preview line while dragging */}
      {isDragging && dragStart && (
        <line
          x1={dragStart.x}
          y1={dragStart.y}
          x2={currentMousePos.x}
          y2={currentMousePos.y}
          stroke="#3b82f6"
          strokeWidth="2"
          strokeDasharray="5,5"
          opacity="0.7"
          markerEnd="url(#arrowhead)"
        />
      )}

      {/* Arrow marker definition */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill="#3b82f6"
            opacity="0.7"
          />
        </marker>
      </defs>
    </g>
  );
};