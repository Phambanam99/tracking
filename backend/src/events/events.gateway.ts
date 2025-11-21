import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, ValidationPipe, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { AircraftService } from '../aircraft/aircraft.service';
import { VesselService } from '../vessel/vessel.service';
import { WsAuthGuard } from './ws-auth.guard';
import { SubscribeAircraftDto, SubscribeVesselDto, ViewportDto, PingDto } from './tracking.dtos';
import { ViewportManager } from './viewport.manager';
import { TrackingService } from './tracking.service';

@WebSocketGateway({
  cors: {
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:4000')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
  namespace: '/tracking',
})
@UseGuards(WsAuthGuard)
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private broadcastInterval: NodeJS.Timeout | null = null;
  private BROADCAST_INTERVAL_MS: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly aircraftService: AircraftService,
    private readonly vesselService: VesselService,
    private readonly viewportManager: ViewportManager,
    private readonly trackingService: TrackingService,
  ) {
    this.BROADCAST_INTERVAL_MS = parseInt(
      this.configService.get<string>('BROADCAST_INTERVAL_MS', '5000'),
      10,
    );
  }

  async afterInit() {
    this.logger.log('🚀 WebSocket Gateway initialized');
    this.trackingService.setServer(this.server);

    // Setup Redis subscriptions with error handling
    try {
      await this.setupRedisSubscriptions();
      this.logger.log('✅ Redis subscriptions set up');
    } catch (error) {
      this.logger.warn('⚠️ Redis subscriptions setup failed (may retry):', error.message);
      // Don't block gateway initialization if Redis subscriptions fail
    }

    // Start periodic broadcast
    this.startPeriodicBroadcast();

    // Cleanup stale tracking data every 30 minutes
    setInterval(
      () => {
        this.trackingService.cleanupStaleTracking();
      },
      30 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.logger.log('Stopped periodic broadcast');
    }
  }

  handleConnection(client: Socket) {
    this.trackingService.addClient(client.id);
    const clientInfo = {
      id: client.id,
      remoteAddress: client.handshake?.address,
      authenticated: client.data?.authenticated || false,
    };
    this.logger.log(
      `🔗 Client connected: ${JSON.stringify(clientInfo)} (Total: ${this.trackingService.getClientCount()})`,
    );
    this.broadcastConnectionStats();
  }

  handleDisconnect(client: Socket) {
    this.viewportManager.removeViewport(client.id);
    this.trackingService.removeClient(client.id);
    this.logger.log(
      `🔌 Client disconnected: ${client.id} (Total: ${this.trackingService.getClientCount()})`,
    );
    this.broadcastConnectionStats();
  }

  @SubscribeMessage('subscribeToAircraft')
  handleSubscribeToAircraft(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ValidationPipe()) data: SubscribeAircraftDto,
  ) {
    const { aircraftId } = data;
    const room = aircraftId ? `aircraft:${aircraftId}` : 'aircraft:all';
    client.join(room);
    this.logger.log(`📡 Client ${client.id} joined room: ${room}`);
    return { event: 'subscribed', data: { channel: room } };
  }

  @SubscribeMessage('subscribeToVessels')
  handleSubscribeToVessels(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ValidationPipe()) data: SubscribeVesselDto,
  ) {
    const { vesselId } = data;
    const room = vesselId ? `vessel:${vesselId}` : 'vessel:all';
    client.join(room);
    this.logger.log(`🚢 Client ${client.id} joined room: ${room}`);
    return { event: 'subscribed', data: { channel: room } };
  }

  @SubscribeMessage('subscribeViewport')
  handleSubscribeViewport(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ValidationPipe()) data: ViewportDto,
  ) {
    const { bbox } = data;
    this.viewportManager.setViewport(client.id, bbox);

    // Join geo-hash room
    const geoHash = this.viewportManager.calculateGeoHash(bbox);
    client.join(`viewport:${geoHash}`);

    this.logger.debug(`🗺️ Viewport set for ${client.id}: ${JSON.stringify(bbox)}`);
    return { event: 'viewportSubscribed', data: { bbox, geoHash } };
  }

  @SubscribeMessage('updateViewport')
  handleUpdateViewport(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ValidationPipe()) data: ViewportDto,
  ) {
    // Leave old viewport rooms
    const oldGeoHash = this.viewportManager.getGeoHash(client.id);
    if (oldGeoHash) {
      client.leave(`viewport:${oldGeoHash}`);
    }
    return this.handleSubscribeViewport(client, data);
  }

  @SubscribeMessage('ping')
  handlePing(@MessageBody() data?: PingDto) {
    return {
      event: 'pong',
      data: {
        timestamp: new Date().toISOString(),
        latency: data?.timestamp ? Date.now() - new Date(data.timestamp).getTime() : 0,
      },
    };
  }

  private async setupRedisSubscriptions() {
    try {
      // Subscribe to aircraft updates
      await this.redisService.subscribe('aircraft:position:update', (message) => {
        try {
          const data = JSON.parse(message);
          this.trackingService.handleAircraftUpdate(data);
          // this.logger.debug(`📡 Aircraft update: ${data.aircraftId}`);
        } catch (error) {
          this.logger.error('Error processing aircraft update:', error);
        }
      });

      // Subscribe to vessel updates
      await this.redisService.subscribe('vessel:position:update', (message) => {
        try {
          const data = JSON.parse(message);
          this.trackingService.handleVesselUpdate(data);
          this.logger.debug(`🚢 Vessel update: ${data.vesselId}`);
        } catch (error) {
          this.logger.error('Error processing vessel update:', error);
        }
      });

      // Subscribe to alerts
      await this.redisService.subscribe('aircraft:new', (message) => {
        this.server.emit('newAircraft', JSON.parse(message));
      });

      await this.redisService.subscribe('vessel:new', (message) => {
        this.server.emit('newVessel', JSON.parse(message));
      });

      await this.redisService.subscribe('region:alert', (message) => {
        const alert = JSON.parse(message);
        this.logger.log(`🚨 Broadcasting region alert to clients:`, alert);
        this.server.emit('regionAlert', alert);
      });

      await this.redisService.subscribe('config:update', (message) => {
        this.server.emit('configUpdate', JSON.parse(message));
      });

      this.logger.log('✅ Redis subscriptions established');
    } catch (error) {
      this.logger.error('❌ Failed to setup Redis subscriptions:', error);
    }
  }

  private startPeriodicBroadcast() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }

    this.broadcastInterval = setInterval(async () => {
      const clientCount = this.trackingService.getClientCount();
      const viewportCount = this.viewportManager.getViewportCount();

      this.logger.debug(`📊 Broadcast check: ${clientCount} clients, ${viewportCount} viewports`);

      if (clientCount === 0) {
        this.logger.debug('No clients connected, skipping broadcast');
        return;
      }

      if (viewportCount === 0) {
        this.logger.debug(
          `${clientCount} client(s) connected but no viewports subscribed, skipping broadcast`,
        );
        return;
      }

      try {
        // Get vessel data from Redis cache instead of DB
        const vesselsFromRedis = await this.getVesselsFromRedis();

        // Get aircraft from DB (for now - can be optimized later)
        const [aircrafts, allSockets] = await Promise.all([
          this.aircraftService.findAllWithLastPosition(),
          this.server.fetchSockets(),
        ]);

        this.logger.debug(`📦 From Redis: ${vesselsFromRedis.length} vessels | From DB: ${aircrafts.length} aircraft`);

        // Different thresholds for aircraft (2 hours) and vessels (24 hours)
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        let totalAircraftSent = 0;
        let totalVesselsSent = 0;

        // Get viewport list once
        const viewports = Array.from(this.viewportManager.getAllViewports().entries());

        for (const [clientId, bbox] of viewports) {
          const socket = allSockets.find((s) => s.id === clientId);
          if (!socket) {
            // Client disconnected, remove viewport
            this.viewportManager.removeViewport(clientId);
            continue;
          }

          let clientAircraftSent = 0;
          let clientVesselsSent = 0;

          // Filter and send aircraft updates
          for (const aircraft of aircrafts) {
            if (!aircraft.lastPosition) continue;

            const lastUpdate = new Date(aircraft.lastPosition.timestamp);
            if (lastUpdate < twoHoursAgo) continue;

            const { longitude, latitude } = aircraft.lastPosition;
            if (!this.viewportManager.isPointInViewport(longitude, latitude, bbox)) continue;

            if (
              this.trackingService.shouldSendUpdate(
                clientId,
                `aircraft:${aircraft.id}`,
                lastUpdate,
                latitude,
                longitude,
              )
            ) {
              socket.emit('aircraftPositionUpdate', aircraft);
              this.trackingService.updateLastSent(
                clientId,
                `aircraft:${aircraft.id}`,
                lastUpdate,
                latitude,
                longitude,
              );
              clientAircraftSent++;
            }
          }

          // Filter and send vessel updates from Redis cache
          for (const vessel of vesselsFromRedis) {
            if (!vessel.lat || !vessel.lon) continue;

            // Check timestamp (Redis stores as milliseconds)
            if (vessel.ts < oneDayAgo) continue;

            if (!this.viewportManager.isPointInViewport(vessel.lon, vessel.lat, bbox)) continue;

            // Check if position changed for this client
            const lastUpdate = new Date(vessel.ts);
            if (
              this.trackingService.shouldSendUpdate(
                clientId,
                `vessel:${vessel.mmsi}`,
                lastUpdate,
                vessel.lat,
                vessel.lon,
              )
            ) {
              // Format vessel data to match frontend expectations
              const vesselUpdate = {
                mmsi: vessel.mmsi,
                vesselName: vessel.name,
                lastPosition: {
                  latitude: vessel.lat,
                  longitude: vessel.lon,
                  speed: vessel.speed,
                  course: vessel.course,
                  heading: vessel.heading,
                  status: vessel.status,
                  timestamp: lastUpdate,
                },
              };

              socket.emit('vesselPositionUpdate', vesselUpdate);
              this.trackingService.updateLastSent(
                clientId,
                `vessel:${vessel.mmsi}`,
                lastUpdate,
                vessel.lat,
                vessel.lon,
              );
              clientVesselsSent++;
            }
          }

          totalAircraftSent += clientAircraftSent;
          totalVesselsSent += clientVesselsSent;
        }

        this.logger.debug(
          `📡 Broadcasted ${totalAircraftSent} aircraft, ${totalVesselsSent} vessels to ${viewports.length} clients`,
        );
      } catch (error) {
        this.logger.error('Error in periodic broadcast:', error);
      }
    }, this.BROADCAST_INTERVAL_MS);

    this.logger.log(`▶️ Started periodic broadcast (${this.BROADCAST_INTERVAL_MS}ms interval)`);
  }

  /**
   * Get vessels from Redis cache (ais:vessel:* keys)
   * This avoids expensive database queries
   */
  private async getVesselsFromRedis(): Promise<any[]> {
    try {
      const redis = this.redisService.getClientWithoutPrefix();

      // Scan for all vessel keys (pattern: ais:vessel:*)
      const keys: string[] = [];
      let cursor = '0';

      do {
        const result = await redis.scan(cursor, 'MATCH', 'ais:vessel:*', 'COUNT', 1000);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      if (keys.length === 0) {
        return [];
      }

      // Fetch all vessel data in parallel using pipeline
      const pipeline = redis.pipeline();
      for (const key of keys) {
        pipeline.hgetall(key);
      }

      const results = await pipeline.exec();
      if (!results) {
        return [];
      }

      const vessels: any[] = [];

      for (let i = 0; i < results.length; i++) {
        const [err, data] = results[i];
        if (err || !data) continue;

        // Type cast to any to access hash fields
        const vesselData = data as any;
        if (!vesselData.mmsi) continue;

        // Convert Redis hash to vessel object
        vessels.push({
          mmsi: vesselData.mmsi,
          name: vesselData.name || null,
          lat: parseFloat(vesselData.lat),
          lon: parseFloat(vesselData.lon),
          ts: parseInt(vesselData.ts), // timestamp in milliseconds
          speed: vesselData.speed ? parseFloat(vesselData.speed) : null,
          course: vesselData.course ? parseFloat(vesselData.course) : null,
          heading: vesselData.heading ? parseInt(vesselData.heading) : null,
          status: vesselData.status || null,
          source: vesselData.source || null,
        });
      }

      return vessels;
    } catch (error) {
      this.logger.error('Error fetching vessels from Redis:', error.message);
      return [];
    }
  }

  private broadcastConnectionStats() {
    const stats = this.trackingService.getConnectionStats();
    this.server.emit('connectionStats', stats);
  }
}
