// server/websocket/server.ts
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { SocketIOEventPublisher, setEventPublisher } from '../events/publisher';
import { logger } from '../logger';

export class WebSocketServer {
  private io: SocketIOServer;
  private eventPublisher: SocketIOEventPublisher;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.FRONTEND_URL 
          : ['http://localhost:3000', 'http://localhost:5173'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.eventPublisher = new SocketIOEventPublisher(this.io);
    setEventPublisher(this.eventPublisher);
    
    this.setupConnectionHandlers();
  }

  private setupConnectionHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info('WebSocket client connected', { 
        socketId: socket.id,
        connectedClients: this.io.sockets.sockets.size
      });

      // Handle authentication (simplified for M1)
      socket.on('authenticate', (data) => {
        if (data.userId || process.env.NODE_ENV === 'test') {
          socket.data.userId = data.userId || 'test-user';
          socket.join(`user:${socket.data.userId}`);
          socket.emit('auth:success', { userId: socket.data.userId });
        }
      });

      // Handle room subscriptions
      socket.on('subscribe', (data) => {
        if (data.type && data.id) {
          const room = `${data.type}:${data.id}`;
          socket.join(room);
          socket.emit('subscription:success', { room });
          logger.info('Client subscribed', { socketId: socket.id, room });
        }
      });

      socket.on('disconnect', (reason) => {
        logger.info('WebSocket client disconnected', { 
          socketId: socket.id, 
          reason,
          connectedClients: this.io.sockets.sockets.size - 1
        });
      });

      // Send welcome message
      socket.emit('connected', { 
        message: 'Connected to Pathfinder WebSocket',
        socketId: socket.id 
      });
    });
  }

  public getEventPublisher(): SocketIOEventPublisher {
    return this.eventPublisher;
  }

  public async close(): Promise<void> {
    await this.eventPublisher.disconnect();
  }

  public getStats() {
    return {
      connectedClients: this.io.sockets.sockets.size,
      uptime: process.uptime()
    };
  }
}
