// File: client/src/pages/runtime-dashboard.tsx
import React from 'react';
import { 
  LiveMetricsOverview,
  WorkflowTimeline,
  TeamWorkloadView,
  IssuesAndBlockers
} from '@/components/runtime-dashboard-enhancements';

export default function RuntimeDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Runtime Dashboard</h1>
            <p className="text-gray-600 mt-1">Real-time workflow monitoring and team performance</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-600">Live Updates</span>
          </div>
        </div>

        {/* Live Metrics Overview */}
        <section>
          <LiveMetricsOverview />
        </section>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Workflow Timeline</h2>
              <WorkflowTimeline />
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Workload</h2>
              <TeamWorkloadView />
            </section>
          </div>
        </div>

        {/* Issues and Blockers - Full Width */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Issues & Blockers</h2>
          <IssuesAndBlockers />
        </section>
      </div>
    </div>
  );
}