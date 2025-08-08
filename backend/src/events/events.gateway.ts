import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3001', 'http://localhost:3000'], // Frontend URLs
    credentials: true,
  },
  namespace: '/tracking',
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private logger: Logger = new Logger('EventsGateway');
  private connectedClients = new Set<string>();

  constructor(private readonly redisService: RedisService) {}

  async afterInit() {
    this.logger.log('🚀 WebSocket Gateway initialized');

    // Subscribe to Redis channels for real-time data broadcasting
    await this.setupRedisSubscriptions();
  }

  handleConnection(client: Socket) {
    this.connectedClients.add(client.id);
    this.logger.log(
      `🔗 Client connected: ${client.id} (Total: ${this.connectedClients.size})`,
    );

    // Send current connection count to all clients
    this.server.emit('connectionCount', this.connectedClients.size);
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    this.logger.log(
      `🔌 Client disconnected: ${client.id} (Total: ${this.connectedClients.size})`,
    );

    // Send updated connection count to all clients
    this.server.emit('connectionCount', this.connectedClients.size);
  }

  @SubscribeMessage('subscribeToAircraft')
  handleSubscribeToAircraft(@MessageBody() data: { aircraftId?: number }) {
    const { aircraftId } = data;

    if (aircraftId) {
      this.logger.log(`📡 Client subscribed to aircraft: ${aircraftId}`);
      // Join specific aircraft room for targeted updates
      return { event: 'aircraftSubscribed', data: { aircraftId } };
    } else {
      this.logger.log('📡 Client subscribed to all aircraft updates');
      return { event: 'allAircraftSubscribed', data: {} };
    }
  }

  @SubscribeMessage('subscribeToVessels')
  handleSubscribeToVessels(@MessageBody() data: { vesselId?: number }) {
    const { vesselId } = data;

    if (vesselId) {
      this.logger.log(`🚢 Client subscribed to vessel: ${vesselId}`);
      // Join specific vessel room for targeted updates
      return { event: 'vesselSubscribed', data: { vesselId } };
    } else {
      this.logger.log('🚢 Client subscribed to all vessel updates');
      return { event: 'allVesselsSubscribed', data: {} };
    }
  }

  @SubscribeMessage('ping')
  handlePing(): { event: string; data: any } {
    return { event: 'pong', data: { timestamp: new Date().toISOString() } };
  }

  // Setup Redis subscriptions for real-time data
  private async setupRedisSubscriptions() {
    try {
      // Subscribe to aircraft position updates
      await this.redisService.subscribe(
        'aircraft:position:update',
        (message) => {
          try {
            const data = JSON.parse(message) as any;
            this.server.emit('aircraftPositionUpdate', data);
            this.logger.debug(
              `📡 Broadcasted aircraft position: ${data.aircraftId}`,
            );
          } catch (error) {
            this.logger.error('Error parsing aircraft position update:', error);
          }
        },
      );

      // Subscribe to vessel position updates
      await this.redisService.subscribe('vessel:position:update', (message) => {
        try {
          const data = JSON.parse(message) as any;
          this.server.emit('vesselPositionUpdate', data);
          this.logger.debug(`🚢 Broadcasted vessel position: ${data.vesselId}`);
        } catch (error) {
          this.logger.error('Error parsing vessel position update:', error);
        }
      });

      // Subscribe to new aircraft alerts
      await this.redisService.subscribe('aircraft:new', (message) => {
        try {
          const data = JSON.parse(message) as any;
          this.server.emit('newAircraft', data);
          this.logger.log(`📡 New aircraft detected: ${data.flightId}`);
        } catch (error) {
          this.logger.error('Error parsing new aircraft alert:', error);
        }
      });

      // Subscribe to new vessel alerts
      await this.redisService.subscribe('vessel:new', (message) => {
        try {
          const data = JSON.parse(message) as any;
          this.server.emit('newVessel', data);
          this.logger.log(`🚢 New vessel detected: ${data.vesselName}`);
        } catch (error) {
          this.logger.error('Error parsing new vessel alert:', error);
        }
      });

      // Subscribe to region alerts
      await this.redisService.subscribe('region:alert', (message) => {
        try {
          const data = JSON.parse(message) as any;
          this.server.emit('regionAlert', data);
          this.logger.log(
            `🚨 Region alert: ${data.alertType} in ${data.regionName}`,
          );
        } catch (error) {
          this.logger.error('Error parsing region alert:', error);
        }
      });

      this.logger.log(
        '✅ Redis subscriptions established for real-time updates',
      );
    } catch (error) {
      this.logger.error('❌ Failed to setup Redis subscriptions:', error);
    }
  }

  // Method to broadcast custom events
  broadcastToAll(event: string, data: any) {
    this.server.emit(event, data);
    this.logger.debug(`📣 Broadcasted event: ${event}`);
  }

  // Get connection statistics
  getConnectionStats() {
    return {
      connectedClients: this.connectedClients.size,
      clients: Array.from(this.connectedClients),
    };
  }
}
