/**
 * ADSB Data Transfer Objects
 * Based on the C# AdsbController and Oracle database structure
 */

export interface AdsbModel {
  id?: number;
  squawk?: string;
  updateTime?: string;
  hexident: string; // Unique identifier (key in Redis)
  receiverSourceId?: number;
  longitude?: number;
  constructorNumber?: string;
  speed?: number;
  secsOfTrack?: number;
  country?: string;
  bearing?: number;
  heading?: number; // Added heading field
  aircraftId?: number;
  type?: string;
  register?: string;
  speedType?: string;
  distance?: number;
  targetAlt?: number;
  engines?: string;
  isTisb?: boolean;
  manufacture?: string;
  fromPort?: string;
  toPort?: string;
  altitude?: number;
  unixTime?: number;
  engineType?: string;
  altitudeType?: string;
  callSign?: string;
  operator?: string;
  transponderType?: string;
  source?: string;
  operatorCode?: string;
  latitude?: number;
  verticalSpeed?: number;
}

export class AdsbStreamRequestDto {
  /**
   * Field filter query (e.g., "altitude > 30000 AND speed > 400")
   * Supports dynamic LINQ-like queries
   */
  fieldFilter?: string;

  /**
   * Position filter for geographic boundaries
   * Example: "Polygon((108.621826171875 17.800996047667, ...))"
   */
  positionFilter?: string;
}

export class AdsbQueryRequestDto {
  /**
   * Field filter query
   */
  fieldFilter?: string;

  /**
   * Position filter for geographic boundaries
   */
  positionFilter?: string;

  /**
   * Page number (for pagination)
   */
  page?: number;

  /**
   * Number of records per page
   */
  limit?: number;
}

export class AdsbtFetchRequestDto {
  /**
   * Array of ADSB data to be stored in Redis and database
   */
  data: AdsbModel[];
}

export interface AdsbConfig {
  /**
   * Fields to select from database
   */
  selectField?: string;

  /**
   * Maximum number of records to query at once
   */
  limitQuery: number;

  /**
   * Redis Hash key for storing current flights
   */
  redisHashKey: string;

  /**
   * Time to live for Redis cache (in seconds)
   */
  redisTTL: number;
}
