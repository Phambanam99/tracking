import { Injectable, Logger } from '@nestjs/common';
import geohash from 'latlon-geohash';

export interface ViewportData {
  bbox: [number, number, number, number];
  geoHash: string;
  lastUpdated: Date;
}

@Injectable()
export class ViewportManager {
  private readonly logger = new Logger(ViewportManager.name);
  private readonly GEOHASH_PRECISION = 4;
  private viewportMap = new Map<string, ViewportData>();

  setViewport(clientId: string, bbox: [number, number, number, number]) {
    const geoHash = this.calculateGeoHash(bbox);
    this.viewportMap.set(clientId, {
      bbox,
      geoHash,
      lastUpdated: new Date(),
    });
  }

  removeViewport(clientId: string) {
    this.viewportMap.delete(clientId);
  }

  getViewportCount(): number {
    return this.viewportMap.size;
  }

  getGeoHash(clientId: string): string | undefined {
    return this.viewportMap.get(clientId)?.geoHash;
  }

  getAllViewports(): Map<string, [number, number, number, number]> {
    const map = new Map<string, [number, number, number, number]>();
    for (const [clientId, data] of this.viewportMap.entries()) {
      map.set(clientId, data.bbox);
    }
    return map;
  }

  calculateGeoHash(bbox: [number, number, number, number]): string {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    const centerLon = (minLon + maxLon) / 2;
    const centerLat = (minLat + maxLat) / 2;
    return geohash.encode(centerLat, centerLon, this.GEOHASH_PRECISION);
  }

  findMatchingGeoHashes(lon: number, lat: number): string[] {
    const pointGeoHash = geohash.encode(lat, lon, this.GEOHASH_PRECISION);
    const neighbors = geohash.neighbours(pointGeoHash);
    return [pointGeoHash, ...Object.values(neighbors)];
  }

  isPointInViewport(lon: number, lat: number, bbox: [number, number, number, number]): boolean {
    const [minLon, minLat, maxLon, maxLat] = bbox;
    return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
  }

  cleanupStaleViewports(maxAgeMs: number = 300000) {
    const now = new Date();
    let cleaned = 0;
    for (const [clientId, data] of this.viewportMap.entries()) {
      if (now.getTime() - data.lastUpdated.getTime() > maxAgeMs) {
        this.viewportMap.delete(clientId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.warn(`Cleaned ${cleaned} stale viewports`);
    }
  }
}
