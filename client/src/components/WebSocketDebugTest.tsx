import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function WebSocketDebugTest() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<string[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  const addMessage = (msg: string) => {
    setMessages(prev => [...prev.slice(-9), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const connect = () => {
    if (ws) {
      ws.close();
    }

    const isDev = import.meta.env.DEV;
    const wsUrl = isDev ? 'ws://localhost:5000/contacts' : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/contacts`;
    
    addMessage(`🔌 Connecting to: ${wsUrl}`);
    setStatus('connecting');
    setLastError(null);

    try {
      const newWs = new WebSocket(wsUrl);

      newWs.onopen = () => {
        addMessage('✅ WebSocket connected successfully');
        setStatus('connected');
      };

      newWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        addMessage(`📨 Received: ${data.type}`);
      };

      newWs.onclose = (event) => {
        addMessage(`🔌 Connection closed: ${event.code} ${event.reason}`);
        setStatus('disconnected');
      };

      newWs.onerror = (error) => {
        console.error('WebSocket error:', error);
        addMessage(`❌ Connection error occurred`);
        setStatus('error');
        setLastError('Connection failed');
      };

      setWs(newWs);
    } catch (error) {
      addMessage(`❌ Failed to create WebSocket: ${error}`);
      setStatus('error');
      setLastError(String(error));
    }
  };

  const disconnect = () => {
    if (ws) {
      ws.close();
      setWs(null);
    }
  };

  useEffect(() => {
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [ws]);

  const getStatusColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          WebSocket Debug Test
          <Badge className={getStatusColor()}>{status}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button onClick={connect} disabled={status === 'connecting'}>
            Connect
          </Button>
          <Button onClick={disconnect} disabled={status === 'disconnected'}>
            Disconnect
          </Button>
        </div>
        
        {lastError && (
          <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
            Error: {lastError}
          </div>
        )}
        
        <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs font-mono h-40 overflow-y-auto">
          <div className="text-sm font-medium mb-2">Connection Log:</div>
          {messages.length === 0 ? (
            <div className="text-gray-500">No messages yet...</div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className="mb-1">{msg}</div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}