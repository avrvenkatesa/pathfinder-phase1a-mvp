// Enhanced Runtime Dashboard Components for Issue #15
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  Users, 
  Zap,
  Timer
} from 'lucide-react';

// WebSocket hook for real-time updates
function useWebSocketConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [liveData, setLiveData] = useState({
    activeInstances: 12,
    completedToday: 8,
    avgCompletionTime: 4.2,
    teamWorkload: []
  });

  useEffect(() => {
    // Simulate real-time updates for demo
    const interval = setInterval(() => {
      setLiveData(prevData => ({
        ...prevData,
        activeInstances: Math.floor(Math.random() * 20) + 8,
        completedToday: Math.floor(Math.random() * 15) + 5,
        avgCompletionTime: parseFloat((Math.random() * 8 + 2).toFixed(1))
      }));
    }, 5000);

    setIsConnected(true);
    return () => clearInterval(interval);
  }, []);

  return { isConnected, liveData };
}

// Live Metrics Overview Component
export function LiveMetricsOverview() {
  const { isConnected, liveData } = useWebSocketConnection();

  const metrics = [
    {
      title: "Active Instances",
      value: liveData.activeInstances,
      icon: Activity,
      color: "text-blue-600",
      bgColor: "bg-blue-50"
    },
    {
      title: "Completed Today", 
      value: liveData.completedToday,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Avg Completion",
      value: `${liveData.avgCompletionTime}h`,
      icon: Timer,
      color: "text-purple-600", 
      bgColor: "bg-purple-50"
    },
    {
      title: "Connection",
      value: isConnected ? "Live" : "Offline",
      icon: Zap,
      color: isConnected ? "text-green-600" : "text-red-600",
      bgColor: isConnected ? "bg-green-50" : "bg-red-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {metric.title}
                  </p>
                  <p className="text-2xl font-bold">{metric.value}</p>
                </div>
                <div className={`p-2 rounded-full ${metric.bgColor}`}>
                  <Icon className={`h-4 w-4 ${metric.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Timeline Component for Workflow Progress
export function WorkflowTimeline() {
  const timelineEvents = [
    {
      id: 1,
      title: "Content Production Started",
      description: "Chapter 1-3 assignment to Sarah",
      timestamp: "2 hours ago",
      status: "completed",
      assignee: "Sarah Johnson"
    },
    {
      id: 2, 
      title: "Quality Review In Progress",
      description: "Technical review by QA team",
      timestamp: "1 hour ago",
      status: "in_progress",
      assignee: "QA Team"
    },
    {
      id: 3,
      title: "Client Approval Pending",
      description: "Waiting for client feedback",
      timestamp: "30 minutes ago", 
      status: "pending",
      assignee: "Client Portal"
    },
    {
      id: 4,
      title: "Final Composition",
      description: "Layout and formatting stage",
      timestamp: "Scheduled",
      status: "scheduled",
      assignee: "Design Team"
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500'; 
      case 'pending': return 'bg-yellow-500';
      case 'scheduled': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Workflow Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-4">
            {timelineEvents.map((event, index) => (
              <div key={event.id} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(event.status)}`} />
                  {index < timelineEvents.length - 1 && (
                    <div className="w-px h-12 bg-gray-200 mt-2" />
                  )}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{event.title}</h4>
                    <span className="text-sm text-muted-foreground">
                      {event.timestamp}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {event.description}
                  </p>
                  <Badge variant="outline" className="mt-2">
                    {event.assignee}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Team Workload View Component
export function TeamWorkloadView() {
  const teamMembers = [
    {
      id: 1,
      name: "Sarah Johnson", 
      role: "Content Writer",
      activeTasksCount: 3,
      workloadPercent: 75,
      currentTask: "Chapter 4-6 Content Creation",
      estimatedCompletion: "2 hours"
    },
    {
      id: 2,
      name: "Mike Chen",
      role: "Technical Editor", 
      activeTasksCount: 2,
      workloadPercent: 60,
      currentTask: "Technical Review - Mathematics",
      estimatedCompletion: "4 hours"
    },
    {
      id: 3,
      name: "Emily Rodriguez",
      role: "Quality Assurance",
      activeTasksCount: 1,
      workloadPercent: 30,
      currentTask: "Final Quality Check",
      estimatedCompletion: "1 hour"
    },
    {
      id: 4,
      name: "David Kim",
      role: "Layout Designer",
      activeTasksCount: 4,
      workloadPercent: 90,
      currentTask: "Page Layout - Chapters 1-3", 
      estimatedCompletion: "6 hours"
    }
  ];

  const getWorkloadColor = (percent: number) => {
    if (percent >= 80) return "text-red-600";
    if (percent >= 60) return "text-yellow-600"; 
    return "text-green-600";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team Workload
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-4">
            {teamMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-4 p-3 rounded-lg border">
                <Avatar>
                  <AvatarFallback>
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{member.name}</h4>
                      <p className="text-sm text-muted-foreground">{member.role}</p>
                    </div>
                    <div className="text-right">
                      <span className={`font-medium ${getWorkloadColor(member.workloadPercent)}`}>
                        {member.workloadPercent}%
                      </span>
                      <p className="text-sm text-muted-foreground">
                        {member.activeTasksCount} tasks
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-2">
                    <Progress value={member.workloadPercent} className="h-2" />
                  </div>
                  
                  <div className="mt-2">
                    <p className="text-sm font-medium">{member.currentTask}</p>
                    <p className="text-xs text-muted-foreground">
                      Est. completion: {member.estimatedCompletion}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Issues and Blockers Component
export function IssuesAndBlockers() {
  const issues = [
    {
      id: 1,
      title: "Client Feedback Delayed",
      description: "Waiting for approval on Chapter 2 content",
      severity: "high",
      affectedWorkflows: ["Content Production WF #123"],
      assignedTo: "Project Manager",
      timeBlocked: "2 days"
    },
    {
      id: 2,
      title: "Resource Overallocation", 
      description: "David Kim at 90% capacity, potential bottleneck",
      severity: "medium",
      affectedWorkflows: ["Layout Design WF #456", "Formatting WF #789"],
      assignedTo: "Resource Manager", 
      timeBlocked: "4 hours"
    },
    {
      id: 3,
      title: "Technical Review Dependency",
      description: "Mathematics content pending subject matter expert",
      severity: "low",
      affectedWorkflows: ["Technical Review WF #321"],
      assignedTo: "Technical Lead",
      timeBlocked: "1 day"
    }
  ];

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50'; 
      case 'low': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Issues & Blockers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80">
          <div className="space-y-3">
            {issues.map((issue) => (
              <div 
                key={issue.id} 
                className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{issue.title}</h4>
                      <Badge variant={getSeverityBadge(issue.severity) as any}>
                        {issue.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {issue.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>Blocked: {issue.timeBlocked}</span>
                      <span>Assigned: {issue.assignedTo}</span>
                    </div>
                  </div>
                </div>
                <Separator className="my-2" />
                <div className="text-xs">
                  <span className="font-medium">Affected: </span>
                  {issue.affectedWorkflows.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
