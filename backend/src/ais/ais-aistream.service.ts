// src/ais/ais-aistream.service.ts
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subject } from 'rxjs';
import { WebSocket } from 'ws';
import aisConfig from '../config/ais.config';
import { AisModel } from './ais.types';

interface AISStreamMessage {
  MessageType: string;
  MetaData?: {
    MMSI?: number;
    ShipName?: string;
    latitude?: number;
    longitude?: number;
    time_utc?: string;
    [key: string]: any;
  };
  Message?: {
    PositionReport?: PositionReportData;
    ShipStaticData?: ShipStaticData;
    StandardClassBPositionReport?: any;
    ExtendedClassBPositionReport?: any;
    [key: string]: any;
  };
}

interface PositionReportData {
  UserID?: number; // MMSI
  Latitude?: number;
  Longitude?: number;
  Cog?: number; // Course over ground
  Sog?: number; // Speed over ground
  TrueHeading?: number;
  Timestamp?: number;
  NavigationalStatus?: number;
  [key: string]: any;
}

interface ShipStaticData {
  UserID?: number;
  Name?: string;
  CallSign?: string;
  ImoNumber?: number;
  Type?: number;
  [key: string]: any;
}

/**
 * AISStream.io WebSocket Service
 *
 * Connects to aisstream.io WebSocket API and streams real-time AIS data.
 * Transforms incoming messages to AisModel format for fusion pipeline.
 */
@Injectable()
export class AisAistreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AisAistreamService.name);
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private disposed = false;

  // Connection limits
  private readonly MAX_RECONNECTION_ATTEMPTS = 20;
  private reconnectionAttempts = 0;
  private readonly MAX_RECONNECT_DELAY = 60000; // 60 seconds max delay

  constructor() {
    // Logger enabled for monitoring AISStream.io connection status
  }

  // Data stream subject
  private data$ = new Subject<AisModel[]>();
  dataStream$ = this.data$.asObservable();

  // Configuration
  private cfg = aisConfig();

  // Metrics
  private metrics = {
    messagesReceived: 0,
    positionReports: 0,
    staticDataReports: 0,
    errors: 0,
    reconnects: 0,
    lastMessageAt: 0,
  };

  /** Public status snapshot for diagnostics */
  getStatus() {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      enabled: this.cfg.AISTREAM_ENABLED,
      metrics: { ...this.metrics },
      lastMessageAt: this.metrics.lastMessageAt
        ? new Date(this.metrics.lastMessageAt).toISOString()
        : null,
    };
  }

  async onModuleInit() {
    if (!this.cfg.AISTREAM_ENABLED) {
      this.logger.warn('⚠️  AISStream.io integration is DISABLED');
      this.logger.warn('   Set AISTREAM_ENABLED=true in .env to enable');
      return;
    }

    if (!this.cfg.AI_STREAM_API) {
      this.logger.error('❌ AISStream.io CANNOT CONNECT: Missing API key!');
      this.logger.error('   Set AI_STREAM_API in .env file');
      this.logger.error('   Get API key at: https://aisstream.io/');
      return;
    }

    this.logger.log('✅ AISStream.io starting...');
    this.logger.log(`📡 Endpoint: ${this.cfg.AISTREAM_ENDPOINT}`);
    await this.connect();
  }

  async onModuleDestroy() {
    this.disposed = true;
    this.disconnect();
  }

  /**
   * Connect to AISStream.io WebSocket
   */
  private async connect() {
    if (this.disposed) return;

    try {
      this.logger.log(`Connecting to AISStream.io: ${this.cfg.AISTREAM_ENDPOINT}`);

      this.ws = new WebSocket(this.cfg.AISTREAM_ENDPOINT);

      this.ws.on('open', () => {
        this.logger.log('✅ AISStream.io WebSocket CONNECTED');
        this.logger.log('📩 Sending subscription...');
        // Reset reconnection attempts on successful connection
        this.reconnectionAttempts = 0;
        this.subscribe();
      });

      this.ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
        try {
          const message: AISStreamMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (e: any) {
          this.logger.error(`Failed to parse message: ${e.message}`);
          this.metrics.errors++;
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error(`AISStream.io WebSocket error: ${error.message}`);
        this.metrics.errors++;
      });

      this.ws.on('close', (code, reason) => {
        this.logger.warn(
          `AISStream.io WebSocket closed: ${code} ${reason?.toString() || '(no reason)'}`,
        );
        this.ws = null;
        this.scheduleReconnect();
      });
    } catch (e: any) {
      this.logger.error(`Failed to connect to AISStream.io: ${e.message}`);
      this.scheduleReconnect();
    }
  }

  /**
   * Send subscription message to AISStream.io
   */
  private subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('Cannot subscribe: WebSocket not open');
      return;
    }

    // Subscribe to the entire world, filtering for PositionReport messages
    const subscription = {
      APIKey: this.cfg.AI_STREAM_API,
      BoundingBoxes: [
        [
          [-90, -180],
          [90, 180],
        ],
      ], // Entire world
      FilterMessageTypes: ['PositionReport', 'ShipStaticData'], // Only position and static data
    };

    this.logger.log('Sending subscription to AISStream.io');
    this.ws.send(JSON.stringify(subscription));
  }

  /**
   * Handle incoming AISStream message
   */
  private handleMessage(message: AISStreamMessage) {
    this.metrics.messagesReceived++;
    this.metrics.lastMessageAt = Date.now();

    // Log first message
    if (this.metrics.messagesReceived === 1) {
      this.logger.log('🎉 First message received from AISStream.io!');
    }

    // Log every 100 messages
    if (this.metrics.messagesReceived % 100 === 0) {
      this.logger.log(
        `📊 AISStream: ${this.metrics.messagesReceived} msgs, ` +
        `${this.metrics.positionReports} positions`,
      );
    }

    // Check for error messages
    if ((message as any).error) {
      this.logger.error(`AISStream.io error: ${(message as any).error}`);
      this.metrics.errors++;
      return;
    }

    const messageType = message.MessageType;

    // Process PositionReport messages
    if (messageType === 'PositionReport' && message.Message?.PositionReport) {
      this.metrics.positionReports++;
      const posReport = message.Message.PositionReport;
      const metadata = message.MetaData || {};

      const aisModel: AisModel = this.transformPositionReport(posReport, metadata);

      if (this.isValidAisModel(aisModel)) {
        this.data$.next([aisModel]);
      }
    }
    // Process ShipStaticData messages (contains name, etc.)
    else if (messageType === 'ShipStaticData' && message.Message?.ShipStaticData) {
      this.metrics.staticDataReports++;
      // Static data could be stored separately or merged with position data
      // For now, we'll log it for debugging
      if (process.env.AIS_DEBUG?.match(/^(1|true|yes|on)$/i)) {
        const staticData = message.Message.ShipStaticData;
        // this.logger.debug(
        //   `ShipStaticData: MMSI=${staticData.UserID} Name=${staticData.Name}`,
        // );
      }
    }

    // Debug logging
    if (
      process.env.AIS_DEBUG?.match(/^(1|true|yes|on)$/i) &&
      this.metrics.messagesReceived % 100 === 0
    ) {
      //   this.logger.debug(
      //     `AISStream.io metrics: ${JSON.stringify(this.metrics)}`,
      //   );
    }
  }

  /**
   * Transform AISStream PositionReport to AisModel
   */
  private transformPositionReport(posReport: PositionReportData, metadata: any): AisModel {
    return {
      mmsi: String(posReport.UserID || metadata.MMSI || ''),
      shipName: metadata.ShipName || undefined,
      lat: posReport.Latitude ?? metadata.latitude,
      lon: posReport.Longitude ?? metadata.longitude,
      speed: posReport.Sog,
      course: posReport.Cog,
      heading: posReport.TrueHeading,
      updatetime: metadata.time_utc || new Date().toISOString(),
      sourceId: 'aisstream.io',
      // Additional fields from AISStream
      navigationalStatus: posReport.NavigationalStatus,
      timestamp: posReport.Timestamp,
    };
  }

  /**
   * Validate AisModel has required fields
   */
  private isValidAisModel(model: AisModel): boolean {
    if (!model.mmsi) {
      this.logger.warn('AisModel missing MMSI');
      return false;
    }
    if (model.lat == null || model.lon == null) {
      this.logger.warn(`AisModel missing coordinates: MMSI=${model.mmsi}`);
      return false;
    }
    if (isNaN(model.lat) || isNaN(model.lon)) {
      this.logger.warn(`AisModel invalid coordinates: MMSI=${model.mmsi}`);
      return false;
    }
    return true;
  }

  /**
   * Disconnect from WebSocket
   */
  private disconnect() {
    // Defensive cleanup: clear timer before setting to null
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.logger.log('AISStream.io WebSocket disconnected');
    }
  }

  /**
   * Schedule reconnection with exponential backoff and max attempts limit
   */
  private scheduleReconnect() {
    if (this.disposed || !this.cfg.AISTREAM_ENABLED) return;

    // Check max reconnection attempts
    if (this.reconnectionAttempts >= this.MAX_RECONNECTION_ATTEMPTS) {
      this.logger.error(
        `Max reconnection attempts (${this.MAX_RECONNECTION_ATTEMPTS}) reached. Stopping AISStream.io reconnection.`,
      );
      return;
    }

    this.reconnectionAttempts++;

    // Exponential backoff with max delay cap
    const delay = Math.min(
      5000 * Math.pow(2, Math.min(this.reconnectionAttempts, 5)),
      this.MAX_RECONNECT_DELAY,
    );

    this.logger.log(
      `Scheduling AISStream.io reconnect in ${delay}ms (attempt ${this.reconnectionAttempts}/${this.MAX_RECONNECTION_ATTEMPTS})`,
    );

    // Defensive cleanup: clear existing timer before creating new one
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.reconnectTimer = setTimeout(() => {
      this.metrics.reconnects++;
      this.connect();
    }, delay);
  }
}
