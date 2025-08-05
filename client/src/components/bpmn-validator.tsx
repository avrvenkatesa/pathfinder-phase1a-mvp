import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { BpmnElement, BpmnConnection, WorkflowDefinition } from '@shared/schema';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  id: string;
  type: 'error';
  message: string;
  elementId?: string;
  severity: 'high' | 'medium' | 'low';
}

export interface ValidationWarning {
  id: string;
  type: 'warning';
  message: string;
  elementId?: string;
  severity: 'high' | 'medium' | 'low';
}

// BPMN 2.0 Validation Rules
export class BpmnValidator {
  static validate(workflow: WorkflowDefinition): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    
    // Rule 1: Must have at least one start event
    const startEvents = workflow.elements.filter(e => e.type === 'start_event');
    if (startEvents.length === 0) {
      errors.push({
        id: 'no-start-event',
        type: 'error',
        message: 'Workflow must have at least one Start Event',
        severity: 'high'
      });
    } else if (startEvents.length > 1) {
      warnings.push({
        id: 'multiple-start-events',
        type: 'warning',
        message: 'Multiple Start Events detected. Consider using a single entry point.',
        severity: 'medium'
      });
    }

    // Rule 2: Must have at least one end event
    const endEvents = workflow.elements.filter(e => e.type === 'end_event');
    if (endEvents.length === 0) {
      errors.push({
        id: 'no-end-event',
        type: 'error',
        message: 'Workflow must have at least one End Event',
        severity: 'high'
      });
    }

    // Rule 3: All elements must have names
    workflow.elements.forEach(element => {
      if (!element.name || element.name.trim() === '') {
        warnings.push({
          id: `unnamed-element-${element.id}`,
          type: 'warning',
          message: `Element "${element.type}" should have a name`,
          elementId: element.id,
          severity: 'low'
        });
      }
    });

    // Rule 4: Check for disconnected elements
    const connectedElementIds = new Set<string>();
    workflow.connections.forEach(conn => {
      connectedElementIds.add(conn.sourceId);
      connectedElementIds.add(conn.targetId);
    });

    workflow.elements.forEach(element => {
      if (!connectedElementIds.has(element.id) && workflow.elements.length > 1) {
        // Start events don't need incoming connections
        if (element.type === 'start_event') {
          const hasOutgoing = workflow.connections.some(c => c.sourceId === element.id);
          if (!hasOutgoing) {
            errors.push({
              id: `disconnected-start-${element.id}`,
              type: 'error',
              message: `Start Event "${element.name}" has no outgoing connections`,
              elementId: element.id,
              severity: 'high'
            });
          }
        }
        // End events don't need outgoing connections
        else if (element.type === 'end_event') {
          const hasIncoming = workflow.connections.some(c => c.targetId === element.id);
          if (!hasIncoming) {
            errors.push({
              id: `disconnected-end-${element.id}`,
              type: 'error',
              message: `End Event "${element.name}" has no incoming connections`,
              elementId: element.id,
              severity: 'high'
            });
          }
        }
        // Other elements need both incoming and outgoing connections
        else {
          const hasIncoming = workflow.connections.some(c => c.targetId === element.id);
          const hasOutgoing = workflow.connections.some(c => c.sourceId === element.id);
          
          if (!hasIncoming && !hasOutgoing) {
            errors.push({
              id: `isolated-element-${element.id}`,
              type: 'error',
              message: `Element "${element.name}" is not connected to the workflow`,
              elementId: element.id,
              severity: 'high'
            });
          } else if (!hasIncoming) {
            warnings.push({
              id: `no-incoming-${element.id}`,
              type: 'warning',
              message: `Element "${element.name}" has no incoming connections`,
              elementId: element.id,
              severity: 'medium'
            });
          } else if (!hasOutgoing) {
            // Only warn about missing outgoing connections for non-end elements
            if (element.type === 'user_task' || element.type === 'system_task' || element.type === 'decision_gateway') {
              warnings.push({
                id: `no-outgoing-${element.id}`,
                type: 'warning',
                message: `Element "${element.name}" has no outgoing connections`,
                elementId: element.id,
                severity: 'medium'
              });
            }
          }
        }
      }
    });

    // Rule 5: Decision gateways should have conditions
    workflow.elements
      .filter(e => e.type === 'decision_gateway')
      .forEach(gateway => {
        const outgoingConnections = workflow.connections.filter(c => c.sourceId === gateway.id);
        if (outgoingConnections.length > 1) {
          outgoingConnections.forEach(conn => {
            if (!conn.condition || conn.condition.trim() === '') {
              warnings.push({
                id: `missing-condition-${conn.id}`,
                type: 'warning',
                message: `Decision Gateway "${gateway.name}" has outgoing connection without condition`,
                elementId: gateway.id,
                severity: 'medium'
              });
            }
          });
        }
        
        if (outgoingConnections.length < 2) {
          warnings.push({
            id: `single-output-gateway-${gateway.id}`,
            type: 'warning',
            message: `Decision Gateway "${gateway.name}" should have at least 2 outgoing paths`,
            elementId: gateway.id,
            severity: 'low'
          });
        }
      });

    // Rule 6: User tasks should have assignees
    workflow.elements
      .filter(e => e.type === 'user_task')
      .forEach(task => {
        if (!task.properties?.assignee) {
          warnings.push({
            id: `no-assignee-${task.id}`,
            type: 'warning',
            message: `User Task "${task.name}" should have an assignee`,
            elementId: task.id,
            severity: 'medium'
          });
        }
      });

    // Rule 7: Check for circular references (infinite loops)
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    const hasCircularReference = (elementId: string): boolean => {
      if (recursionStack.has(elementId)) {
        return true;
      }
      if (visited.has(elementId)) {
        return false;
      }
      
      visited.add(elementId);
      recursionStack.add(elementId);
      
      const outgoingConnections = workflow.connections.filter(c => c.sourceId === elementId);
      for (const conn of outgoingConnections) {
        if (hasCircularReference(conn.targetId)) {
          return true;
        }
      }
      
      recursionStack.delete(elementId);
      return false;
    };

    startEvents.forEach(startEvent => {
      if (hasCircularReference(startEvent.id)) {
        errors.push({
          id: `circular-reference-${startEvent.id}`,
          type: 'error',
          message: 'Circular reference detected in workflow - this may cause infinite loops',
          elementId: startEvent.id,
          severity: 'high'
        });
      }
    });

    // Rule 8: Check for unreachable elements
    const reachableElements = new Set<string>();
    
    const markReachable = (elementId: string) => {
      if (reachableElements.has(elementId)) return;
      reachableElements.add(elementId);
      
      const outgoingConnections = workflow.connections.filter(c => c.sourceId === elementId);
      outgoingConnections.forEach(conn => markReachable(conn.targetId));
    };

    startEvents.forEach(startEvent => markReachable(startEvent.id));

    workflow.elements.forEach(element => {
      if (!reachableElements.has(element.id) && element.type !== 'start_event') {
        warnings.push({
          id: `unreachable-${element.id}`,
          type: 'warning',
          message: `Element "${element.name}" may be unreachable from start events`,
          elementId: element.id,
          severity: 'medium'
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // Export workflow as BPMN 2.0 XML
  static exportToBpmnXml(workflow: WorkflowDefinition): string {
    const processId = workflow.id || 'Process_1';
    const processName = workflow.name || 'Workflow';
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                   id="Definitions_1" 
                   targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="${processId}" name="${processName}" isExecutable="true">`;

    // Add elements
    workflow.elements.forEach(element => {
      switch (element.type) {
        case 'start_event':
          xml += `\n    <bpmn2:startEvent id="${element.id}" name="${element.name}" />`;
          break;
        case 'end_event':
          xml += `\n    <bpmn2:endEvent id="${element.id}" name="${element.name}" />`;
          break;
        case 'user_task':
          xml += `\n    <bpmn2:userTask id="${element.id}" name="${element.name}">`;
          if (element.properties?.assignee) {
            xml += `\n      <bpmn2:potentialOwner>
        <bpmn2:resourceAssignmentExpression>
          <bpmn2:formalExpression>${element.properties.assignee}</bpmn2:formalExpression>
        </bpmn2:resourceAssignmentExpression>
      </bpmn2:potentialOwner>`;
          }
          xml += `\n    </bpmn2:userTask>`;
          break;
        case 'system_task':
          xml += `\n    <bpmn2:serviceTask id="${element.id}" name="${element.name}" />`;
          break;
        case 'decision_gateway':
          xml += `\n    <bpmn2:exclusiveGateway id="${element.id}" name="${element.name}" />`;
          break;
      }
    });

    // Add sequence flows
    workflow.connections.forEach(connection => {
      xml += `\n    <bpmn2:sequenceFlow id="${connection.id}" sourceRef="${connection.sourceId}" targetRef="${connection.targetId}"`;
      if (connection.name) {
        xml += ` name="${connection.name}"`;
      }
      if (connection.condition) {
        xml += `>
      <bpmn2:conditionExpression xsi:type="bpmn2:tFormalExpression">${connection.condition}</bpmn2:conditionExpression>
    </bpmn2:sequenceFlow>`;
      } else {
        xml += ` />`;
      }
    });

    xml += `\n  </bpmn2:process>`;

    // Add diagram information
    xml += `\n  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${processId}">`;

    workflow.elements.forEach(element => {
      xml += `\n      <bpmndi:BPMNShape id="${element.id}_di" bpmnElement="${element.id}">
        <dc:Bounds x="${element.position.x - 25}" y="${element.position.y - 25}" width="50" height="50" />
      </bpmndi:BPMNShape>`;
    });

    workflow.connections.forEach(connection => {
      const sourceElement = workflow.elements.find(e => e.id === connection.sourceId);
      const targetElement = workflow.elements.find(e => e.id === connection.targetId);
      if (sourceElement && targetElement) {
        xml += `\n      <bpmndi:BPMNEdge id="${connection.id}_di" bpmnElement="${connection.id}">
        <di:waypoint x="${sourceElement.position.x}" y="${sourceElement.position.y}" />
        <di:waypoint x="${targetElement.position.x}" y="${targetElement.position.y}" />
      </bpmndi:BPMNEdge>`;
      }
    });

    xml += `\n    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

    return xml;
  }
}

// Validation Results Display Component
interface BpmnValidationDisplayProps {
  validation: ValidationResult;
  onElementSelect?: (elementId: string) => void;
}

export function BpmnValidationDisplay({ validation, onElementSelect }: BpmnValidationDisplayProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-orange-600 bg-orange-50';
      case 'low': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-4">
      {/* Validation Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {validation.isValid ? (
              <CheckCircle className="text-green-600" size={20} />
            ) : (
              <XCircle className="text-red-600" size={20} />
            )}
            BPMN 2.0 Validation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant={validation.errors.length > 0 ? 'destructive' : 'secondary'}>
                {validation.errors.length} Errors
              </Badge>
              <Badge variant={validation.warnings.length > 0 ? 'outline' : 'secondary'}>
                {validation.warnings.length} Warnings
              </Badge>
            </div>
            {validation.isValid && (
              <span className="text-green-600 font-medium">✓ Valid BPMN 2.0 Workflow</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Errors */}
      {validation.errors.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-red-600 flex items-center gap-2">
            <XCircle size={20} />
            Errors ({validation.errors.length})
          </h3>
          {validation.errors.map((error) => (
            <Alert key={error.id} variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{error.message}</span>
                <Badge className={getSeverityColor(error.severity)}>
                  {error.severity}
                </Badge>
              </AlertTitle>
              {error.elementId && onElementSelect && (
                <AlertDescription>
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => onElementSelect(error.elementId!)}
                  >
                    Go to element
                  </button>
                </AlertDescription>
              )}
            </Alert>
          ))}
        </div>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-orange-600 flex items-center gap-2">
            <AlertTriangle size={20} />
            Warnings ({validation.warnings.length})
          </h3>
          {validation.warnings.map((warning) => (
            <Alert key={warning.id}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="flex items-center justify-between">
                <span>{warning.message}</span>
                <Badge className={getSeverityColor(warning.severity)}>
                  {warning.severity}
                </Badge>
              </AlertTitle>
              {warning.elementId && onElementSelect && (
                <AlertDescription>
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => onElementSelect(warning.elementId!)}
                  >
                    Go to element
                  </button>
                </AlertDescription>
              )}
            </Alert>
          ))}
        </div>
      )}

      {/* All Clear */}
      {validation.isValid && validation.warnings.length === 0 && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Workflow is valid!</AlertTitle>
          <AlertDescription>
            Your workflow follows BPMN 2.0 standards and is ready for execution.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default BpmnValidator;