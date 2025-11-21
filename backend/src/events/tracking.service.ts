import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { ViewportManager } from './viewport.manager';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private server: Server;
  private clientMap = new Map<string, Date>();
  private readonly CLIENT_TIMEOUT_MS = 30000;

  // Track last sent positions per client to avoid redundant broadcasts
  private lastSentPositions = new Map<
    string,
    Map<string, { timestamp: Date; lat: number; lon: number }>
  >();

  constructor(
    private readonly redisService: RedisService,
    private readonly viewportManager: ViewportManager,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  addClient(clientId: string) {
    this.clientMap.set(clientId, new Date());
    // Initialize position tracking for new client
    if (!this.lastSentPositions.has(clientId)) {
      this.lastSentPositions.set(clientId, new Map());
    }
  }

  removeClient(clientId: string) {
    this.clientMap.delete(clientId);
    // Clean up position tracking
    this.lastSentPositions.delete(clientId);
  }

  getClientCount(): number {
    return this.clientMap.size;
  }

  getConnectionStats() {
    return {
      totalClients: this.clientMap.size,
      activeViewports: this.viewportManager.getViewportCount(),
      timestamp: new Date().toISOString(),
    };
  }

  handleAircraftUpdate(data: any) {
    const { aircraftId, longitude, latitude } = data;

    // Broadcast to specific room
    this.server.to(`aircraft:${aircraftId}`).emit('aircraftPositionUpdate', data);
    this.server.to('aircraft:all').emit('aircraftPositionUpdate', data);

    // Broadcast to viewport rooms only if coordinates are valid
    if (this.isValidCoordinate(longitude, latitude)) {
      const targetGeoHashes = this.viewportManager.findMatchingGeoHashes(longitude, latitude);
      for (const geoHash of targetGeoHashes) {
        this.server.to(`viewport:${geoHash}`).emit('aircraftPositionUpdate', data);
      }
    }
  }

  handleVesselUpdate(data: any) {
    const { vesselId, longitude, latitude } = data;

    this.server.to(`vessel:${vesselId}`).emit('vesselPositionUpdate', data);
    this.server.to('vessel:all').emit('vesselPositionUpdate', data);

    // Broadcast to viewport rooms only if coordinates are valid
    if (this.isValidCoordinate(longitude, latitude)) {
      const targetGeoHashes = this.viewportManager.findMatchingGeoHashes(longitude, latitude);
      for (const geoHash of targetGeoHashes) {
        this.server.to(`viewport:${geoHash}`).emit('vesselPositionUpdate', data);
      }
    }
  }

  /**
   * Check if position has changed significantly for a client
   * Returns true if should send update
   */
  shouldSendUpdate(
    clientId: string,
    entityId: string,
    timestamp: Date,
    lat: number,
    lon: number,
    threshold: number = 0.0001, // ~11 meters
  ): boolean {
    const clientTracking = this.lastSentPositions.get(clientId);
    if (!clientTracking) {
      // First time for this client, send everything
      return true;
    }

    const lastSent = clientTracking.get(entityId);
    if (!lastSent) {
      // First time for this entity, send it
      return true;
    }

    // Check if position changed significantly
    const latDiff = Math.abs(lat - lastSent.lat);
    const lonDiff = Math.abs(lon - lastSent.lon);
    const positionChanged = latDiff > threshold || lonDiff > threshold;

    // Only send if position changed (ignore static entities)
    return positionChanged;
  }

  /**
   * Update last sent position for a client
   */
  updateLastSent(clientId: string, entityId: string, timestamp: Date, lat: number, lon: number) {
    let clientTracking = this.lastSentPositions.get(clientId);
    if (!clientTracking) {
      clientTracking = new Map();
      this.lastSentPositions.set(clientId, clientTracking);
    }
    clientTracking.set(entityId, { timestamp, lat, lon });
  }

  /**
   * Clean up stale tracking data (older than 1 hour)
   */
  cleanupStaleTracking() {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    let cleaned = 0;

    for (const [clientId, tracking] of this.lastSentPositions.entries()) {
      for (const [entityId, data] of tracking.entries()) {
        if (data.timestamp < oneHourAgo) {
          tracking.delete(entityId);
          cleaned++;
        }
      }
      // Remove empty client tracking
      if (tracking.size === 0) {
        this.lastSentPositions.delete(clientId);
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`🧹 Cleaned up ${cleaned} stale position trackings`);
    }
  }

  /**
   * Validate coordinates before geohash calculation
   */
  private isValidCoordinate(lon: number, lat: number): boolean {
    return (
      lon != null &&
      lat != null &&
      Number.isFinite(lon) &&
      Number.isFinite(lat) &&
      lon >= -180 &&
      lon <= 180 &&
      lat >= -90 &&
      lat <= 90
    );
  }
}
