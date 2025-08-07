import React from 'react';
import AssignmentEngineDemo from '@/components/AssignmentEngineDemo';
import ConnectorDemo from '@/components/ConnectorDemo';

export default function AssignmentEnginePage() {
  return (
    <div className="space-y-6">
      <AssignmentEngineDemo />
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">BPMN Workflow Connectors</h2>
        <ConnectorDemo />
      </div>
    </div>
  );
}