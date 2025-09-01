import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertTriangle, Users, RefreshCw, Trash2 } from 'lucide-react';
import { subscribe, announceContactDeleted, announceContactChanged, CrossTabEvent } from '@/lib/crossTab';
import { useToast } from '@/hooks/use-toast';

interface TestResult {
  step: string;
  status: 'pending' | 'passed' | 'failed';
  message: string;
  timestamp?: string;
}

export function EventDrivenValidationTest() {
  const { toast } = useToast();
  const [testResults, setTestResults] = useState<TestResult[]>([
    { step: 'BroadcastChannel Setup', status: 'pending', message: 'Checking BroadcastChannel availability...' },
    { step: 'Cross-Tab Event Broadcasting', status: 'pending', message: 'Testing event transmission...' },
    { step: 'Event Reception', status: 'pending', message: 'Verifying event reception across tabs...' },
    { step: 'Contact Deletion Event', status: 'pending', message: 'Testing contact deletion broadcasts...' },
    { step: 'Contact Update Event', status: 'pending', message: 'Testing contact update broadcasts...' }
  ]);
  
  const [receivedEvents, setReceivedEvents] = useState<CrossTabEvent[]>([]);
  const [isTestRunning, setIsTestRunning] = useState(false);

  // Update test result
  const updateTestResult = (step: string, status: 'passed' | 'failed', message: string) => {
    setTestResults(prev => 
      prev.map(result => 
        result.step === step 
          ? { ...result, status, message, timestamp: new Date().toLocaleTimeString() }
          : result
      )
    );
  };

  // Test BroadcastChannel availability
  useEffect(() => {
    const hasBroadcastChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window;
    
    if (hasBroadcastChannel) {
      updateTestResult('BroadcastChannel Setup', 'passed', 'BroadcastChannel API is available');
    } else {
      updateTestResult('BroadcastChannel Setup', 'failed', 'BroadcastChannel API not supported - using localStorage fallback');
    }
  }, []);

  // Subscribe to cross-tab events
  useEffect(() => {
    let eventCount = 0;
    
    const unsubscribe = subscribe((event: CrossTabEvent) => {
      console.log('📡 Received cross-tab event:', event);
      setReceivedEvents(prev => [...prev.slice(-9), event]);
      eventCount++;
      
      // Verify event reception
      if (eventCount === 1) {
        updateTestResult('Event Reception', 'passed', 'Successfully receiving cross-tab events');
      }
      
      // Check specific event types
      if (event.type === 'contact:deleted') {
        updateTestResult('Contact Deletion Event', 'passed', `Deletion event received for contact ${event.id}`);
      }
      
      if (event.type === 'contact:changed') {
        updateTestResult('Contact Update Event', 'passed', `Update event received for contact ${event.id}`);
      }
    });

    return unsubscribe;
  }, []);

  const runEventTest = () => {
    setIsTestRunning(true);
    
    // Test 1: Contact Deletion Event
    setTimeout(() => {
      console.log('🧪 Broadcasting test deletion event...');
      announceContactDeleted('test-contact-tc4-delete', { name: 'Test Contact', type: 'person' });
      updateTestResult('Cross-Tab Event Broadcasting', 'passed', 'Successfully broadcasting deletion event');
    }, 500);

    // Test 2: Contact Update Event  
    setTimeout(() => {
      console.log('🧪 Broadcasting test update event...');
      announceContactChanged('test-contact-tc4-update', 'etag-abc123', { name: 'Updated Test Contact', type: 'person' });
    }, 1000);

    setTimeout(() => {
      setIsTestRunning(false);
      toast({
        title: "Event Test Complete",
        description: "Cross-tab event broadcasting test finished",
      });
    }, 2000);
  };

  const clearEvents = () => {
    setReceivedEvents([]);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <RefreshCw className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'passed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const passedTests = testResults.filter(r => r.status === 'passed').length;
  const totalTests = testResults.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Test Case 4: Event-Driven Validation
            <Badge className={passedTests === totalTests ? 'bg-green-500' : 'bg-blue-500'}>
              {passedTests}/{totalTests} Tests Passed
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>BroadcastChannel System:</strong> This test validates PathFinder's real-time 
              cross-tab event system using BroadcastChannel API for instant contact change notifications.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            {testResults.map((result, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <div className="font-medium text-sm">{result.step}</div>
                  <div className="text-xs text-muted-foreground">{result.message}</div>
                  {result.timestamp && (
                    <div className="text-xs text-muted-foreground">at {result.timestamp}</div>
                  )}
                </div>
                <Badge className={getStatusColor(result.status)}>{result.status}</Badge>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={runEventTest} 
              disabled={isTestRunning}
              data-testid="button-run-event-test"
            >
              {isTestRunning ? 'Running Test...' : 'Run Event Test'}
            </Button>
            <Button variant="outline" onClick={clearEvents}>
              Clear Events
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Real-Time Event Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs font-mono h-48 overflow-y-auto">
            {receivedEvents.length === 0 ? (
              <div className="text-gray-500">No events received yet. Run the test or open multiple tabs to see real-time events.</div>
            ) : (
              receivedEvents.map((event, i) => (
                <div key={i} className="mb-2 p-2 bg-white dark:bg-gray-800 rounded border">
                  <div className="flex items-center gap-2 mb-1">
                    {event.type === 'contact:deleted' ? (
                      <Trash2 className="h-3 w-3 text-red-500" />
                    ) : (
                      <RefreshCw className="h-3 w-3 text-blue-500" />
                    )}
                    <Badge variant="outline" className="text-xs">{event.type}</Badge>
                    <span className="text-gray-500">Contact: {event.id}</span>
                  </div>
                  {event.summary && (
                    <div className="text-gray-600 text-xs">
                      Name: {event.summary.name} | Type: {event.summary.type}
                    </div>
                  )}
                  <div className="text-gray-400 text-xs">
                    From tab: {event.origin} | Time: {new Date(event.ts).toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Instructions for Multi-Tab Testing:</strong><br/>
          1. Open this page in multiple browser tabs<br/>
          2. Run the event test in one tab<br/>
          3. Watch events appear in all tabs instantly<br/>
          4. Try deleting contacts in one tab to see real-time warnings in others
        </AlertDescription>
      </Alert>
    </div>
  );
}