// server/websocket/index.ts
import { Server as HTTPServer } from 'http';
import { WebSocketServer } from './server';

export function initializeWebSocket(httpServer: HTTPServer): WebSocketServer {
  return new WebSocketServer(httpServer);
}

export * from './server';
export * from '../events/types';
export * from '../events/publisher';
