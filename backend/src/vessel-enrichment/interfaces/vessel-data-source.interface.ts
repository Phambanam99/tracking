/**
 * Interface for vessel data sources
 */
export interface VesselDataSource {
  name: string;
  priority: number;
  rateLimit: number; // requests per minute

  /**
   * Fetch vessel information by MMSI
   */
  fetchByMmsi(mmsi: string): Promise<VesselEnrichmentData | null>;

  /**
   * Fetch vessel information by IMO
   */
  fetchByImo?(imo: string): Promise<VesselEnrichmentData | null>;

  /**
   * Check if the data source is available
   */
  isAvailable(): Promise<boolean>;
}

/**
 * Enriched vessel data from external sources
 */
export interface VesselEnrichmentData {
  mmsi?: string;
  imo?: string;
  vesselName?: string;
  vesselType?: string;
  flag?: string;
  callSign?: string;
  length?: number;
  width?: number;
  draught?: number;
  destination?: string;
  eta?: Date;
  yearBuilt?: number;
  grossTonnage?: number;
  deadweight?: number;
  homePort?: string;
  owner?: string;
  operator?: string;
  manager?: string;
  classification?: string;
  imageUrl?: string;
  dataQualityScore?: number;
}

/**
 * Enrichment result with metadata
 */
export interface EnrichmentResult {
  success: boolean;
  data?: VesselEnrichmentData;
  source: string;
  fieldsUpdated: string[];
  error?: string;
  duration: number;
}
