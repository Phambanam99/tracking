import { Injectable, Logger } from '@nestjs/common';
import { NormVesselMsg, VesselSource } from './types';

export interface SourceConfig {
  weight: number;
  speedUnit: 'knots' | 'mps' | 'kmh';
  reliability: number;
  typicalUpdateInterval: number;
}

@Injectable()
export class DataValidationService {
  private readonly logger = new Logger(DataValidationService.name);
  
  // Pattern detection for repeated values
  private readonly speedHistory = new Map<string, Array<{speed: number, timestamp: Date, source: string}>>();
  private readonly ANOMALY_THRESHOLD = 3; // 3 consecutive readings

  // Configuration cho từng nguồn dữ liệu
  private readonly sourceConfigs: Record<VesselSource, SourceConfig> = {
    'aisstream.io': {
      weight: 0.88,
      speedUnit: 'knots', // AIS standard
      reliability: 0.9,
      typicalUpdateInterval: 10000 // 10 seconds
    },
    'signalr': {
      weight: 0.82,
      speedUnit: 'mps', // Giả sử SignalR gửi m/s
      reliability: 0.8,
      typicalUpdateInterval: 30000 // 30 seconds
    },
    'marine_traffic': {
      weight: 0.9,
      speedUnit: 'knots',
      reliability: 0.95,
      typicalUpdateInterval: 60000 // 1 minute
    },
    'vessel_finder': {
      weight: 0.85,
      speedUnit: 'knots',
      reliability: 0.85,
      typicalUpdateInterval: 60000 // 1 minute
    },
    'china_port': {
      weight: 0.8,
      speedUnit: 'knots',
      reliability: 0.8,
      typicalUpdateInterval: 120000 // 2 minutes
    },
    'custom': {
      weight: 0.7,
      speedUnit: 'knots',
      reliability: 0.7,
      typicalUpdateInterval: 60000 // 1 minute
    },
    'fused': {
      weight: 0.95,
      speedUnit: 'knots',
      reliability: 0.95,
      typicalUpdateInterval: 30000 // 30 seconds
    },
    'unknown': {
      weight: 0.5,
      speedUnit: 'knots',
      reliability: 0.5,
      typicalUpdateInterval: 60000 // 1 minute
    },
    'ais': {
      weight: 0.75,
      speedUnit: 'knots',
      reliability: 0.75,
      typicalUpdateInterval: 30000 // 30 seconds
    }
  };

  /**
   * Validate và normalize một message NormVesselMsg
   */
  validateAndNormalize(msg: NormVesselMsg): NormVesselMsg {
    const result = { ...msg };

    // Validate và normalize speed
    if (msg.speed !== undefined && msg.speed !== null) {
      const normalizedSpeed = this.normalizeSpeed(msg.speed, msg.source);
      
      // Check for anomalous patterns (only if mmsi is available)
      if (msg.mmsi) {
        const patternCheck = this.detectAnomalousPattern(msg.mmsi, normalizedSpeed, msg.source);
        if (patternCheck.isAnomalous) {
          this.logger.warn(
            `Anomalous speed pattern detected for MMSI ${msg.mmsi}: ${patternCheck.pattern} from ${msg.source}`
          );
          // Still normalize but flag for monitoring
        }
      }
      
      if (this.isValidSpeed(normalizedSpeed)) {
        result.speed = normalizedSpeed;
      } else {
        this.logger.warn(
          `Invalid speed ${msg.speed} (normalized: ${normalizedSpeed}) from ${msg.source} for MMSI ${msg.mmsi || 'unknown'}`
        );
        result.speed = undefined;
      }
      
      // Update speed history for pattern detection (only if mmsi is available)
      if (msg.mmsi) {
        this.updateSpeedHistory(msg.mmsi, normalizedSpeed, msg.source);
      }
    }

    // Validate và normalize course
    if (msg.course !== undefined && msg.course !== null) {
      if (this.isValidCourse(msg.course)) {
        result.course = this.normalizeCourse(msg.course);
      } else {
        this.logger.warn(
          `Invalid course ${msg.course} from ${msg.source} for MMSI ${msg.mmsi}`
        );
        result.course = undefined;
      }
    }

    // Validate và normalize heading
    if (msg.heading !== undefined && msg.heading !== null) {
      if (this.isValidHeading(msg.heading)) {
        result.heading = this.normalizeHeading(msg.heading);
      } else {
        this.logger.warn(
          `Invalid heading ${msg.heading} from ${msg.source} for MMSI ${msg.mmsi}`
        );
        result.heading = undefined;
      }
    }

    // Validate coordinates
    if (!this.isValidCoordinates(msg.lat, msg.lon)) {
      this.logger.error(
        `Invalid coordinates (${msg.lat}, ${msg.lon}) from ${msg.source} for MMSI ${msg.mmsi}`
      );
      // Không set undefined vì coordinates là required fields
    }

    return result;
  }

  /**
   * Normalize speed về knots
   */
  private normalizeSpeed(value: number, source: VesselSource): number {
    const config = this.sourceConfigs[source];
    
    switch (config.speedUnit) {
      case 'mps':
        // meters per second -> knots
        return value * 1.94384;
      case 'kmh':
        // kilometers per hour -> knots
        return value * 0.539957;
      case 'knots':
      default:
        return value;
    }
  }

  /**
   * Validate speed range (đã normalized về knots)
   */
  private isValidSpeed(speed: number): boolean {
    // Speed phải >= 0
    if (speed < 0) return false;
    
    // Check against vessel type limits
    const maxSpeed = this.getVesselTypeMaxSpeed(speed);
    return speed <= maxSpeed;
  }

  /**
   * Get maximum speed based on vessel type and special cases
   */
  private getVesselTypeMaxSpeed(speed: number): number {
    // Special case: 102.3 knots could be valid for high-speed craft
    if (Math.abs(speed - 102.3) < 0.1) {
      return 102.3; // Allow exact 102.3 for special vessels
    }
    
    // Standard limits by vessel type
    const standardLimits = {
      'high_speed_craft': 102.3, // Racing boats, hovercraft
      'military': 60, // Warships, patrol vessels
      'passenger': 40, // Fast ferries, cruise ships
      'cargo': 25, // Container ships, bulk carriers
      'tanker': 20, // Oil tankers, chemical tankers
      'fishing': 20, // Fishing vessels
      'default': 50 // General commercial vessels
    };
    
    return standardLimits.default;
  }

  /**
   * Normalize course về 0-360 degrees
   */
  private normalizeCourse(course: number): number {
    let normalized = course % 360;
    if (normalized < 0) {
      normalized += 360;
    }
    return normalized;
  }

  /**
   * Validate course range
   */
  private isValidCourse(course: number): boolean {
    return !isNaN(course) && isFinite(course);
  }

  /**
   * Normalize heading về 0-360 degrees
   */
  private normalizeHeading(heading: number): number {
    let normalized = heading % 360;
    if (normalized < 0) {
      normalized += 360;
    }
    return normalized;
  }

  /**
   * Validate heading range
   */
  private isValidHeading(heading: number): boolean {
    return !isNaN(heading) && isFinite(heading);
  }

  /**
   * Validate coordinates
   */
  private isValidCoordinates(lat: number, lon: number): boolean {
    return (
      !isNaN(lat) && isFinite(lat) &&
      !isNaN(lon) && isFinite(lon) &&
      lat >= -90 && lat <= 90 &&
      lon >= -180 && lon <= 180
    );
  }

  /**
   * Get source configuration
   */
  getSourceConfig(source: VesselSource): SourceConfig {
    return this.sourceConfigs[source] || this.sourceConfigs['unknown'];
  }

  /**
   * Detect anomaly trong speed value
   */
  detectSpeedAnomaly(speed: number, source: VesselSource, vesselType?: string): boolean {
    const expectedRange = this.getExpectedSpeedRange(vesselType);
    const normalizedSpeed = this.normalizeSpeed(speed, source);
    
    const isAnomaly = normalizedSpeed < expectedRange.min || normalizedSpeed > expectedRange.max;
    
    if (isAnomaly) {
      this.logger.warn(
        `Speed anomaly detected: ${normalizedSpeed} knots (raw: ${speed}) from ${source} ` +
        `for vessel type ${vesselType || 'unknown'} (expected: ${expectedRange.min}-${expectedRange.max})`
      );
    }
    
    return isAnomaly;
  }

  /**
   * Get expected speed range dựa trên loại tàu
   */
  private getExpectedSpeedRange(vesselType?: string): {min: number, max: number} {
    const ranges: Record<string, {min: number, max: number}> = {
      'cargo': {min: 0, max: 25},
      'tanker': {min: 0, max: 20},
      'passenger': {min: 0, max: 30},
      'fishing': {min: 0, max: 15},
      'tug': {min: 0, max: 12},
      'high_speed_craft': {min: 0, max: 102.3}, // Special case for racing boats
      'military': {min: 0, max: 60},
      'default': {min: 0, max: 40}
    };
    
    return vesselType ? (ranges[vesselType] || ranges.default) : ranges.default;
  }

  /**
   * Detect anomalous patterns in speed readings
   */
  private detectAnomalousPattern(
    mmsi: string,
    currentSpeed: number,
    source: VesselSource
  ): {isAnomalous: boolean; pattern?: string} {
    const history = this.speedHistory.get(mmsi) || [];
    const recentReadings = history
      .filter(r => (Date.now() - r.timestamp.getTime()) < 5 * 60 * 1000) // 5 minutes
      .slice(-10); // Last 10 readings
    
    // Check for exact same value repetition
    const sameValueCount = recentReadings.filter(r => r.speed === currentSpeed).length;
    if (sameValueCount >= this.ANOMALY_THRESHOLD) {
      return {
        isAnomalous: true,
        pattern: `repeated_exact_value_${currentSpeed}`
      };
    }
    
    // Check for suspicious consistency
    const allSameSource = recentReadings.every(r => r.source === source);
    if (recentReadings.length >= 5 && allSameSource) {
      return {
        isAnomalous: true,
        pattern: `single_source_consistency_${source}`
      };
    }
    
    return {isAnomalous: false};
  }

  /**
   * Update speed history for pattern detection
   */
  private updateSpeedHistory(mmsi: string, speed: number, source: VesselSource): void {
    const history = this.speedHistory.get(mmsi) || [];
    history.push({
      speed,
      timestamp: new Date(),
      source
    });
    
    // Keep only last 50 readings per vessel
    if (history.length > 50) {
      history.shift();
    }
    
    this.speedHistory.set(mmsi, history);
  }
}