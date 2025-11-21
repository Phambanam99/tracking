/**
 * Vehicle configuration factory
 * Centralized configuration for different vehicle types
 */

import { VehicleTypeConfig } from './types';

interface ConfigFactoryOptions {
  operatorColors: Record<string, string>;
  flagColors: Record<string, string>;
}

/**
 * Create aircraft configuration
 */
export function createAircraftConfig(options: ConfigFactoryOptions): VehicleTypeConfig {
  return {
    type: 'aircraft',
    iconPath: './aircraft-icon.svg',
    defaultColor: '#2563eb', // Blue
    getColor: (operator?: string) => {
      if (!operator) return '#2563eb';
      return options.operatorColors[operator.toUpperCase()] || '#2563eb';
    },
    getHeading: (data: any) => {
      // Check both heading and bearing fields, default to 0 if missing
      const heading = data?.lastPosition?.heading ?? data?.lastPosition?.bearing ?? 0;
      return typeof heading === 'number' && !isNaN(heading) ? heading : 0;
    },
    getIdentifier: (data: any) => {
      return data?.operator as string | undefined;
    },
  };
}

/**
 * Create vessel configuration
 */
export function createVesselConfig(options: ConfigFactoryOptions): VehicleTypeConfig {
  return {
    type: 'vessel',
    iconPath: './vessel-icon.svg',
    defaultColor: '#eab308', // Yellow
    getColor: (flag?: string) => {
      if (!flag) return '#eab308';
      return options.flagColors[flag.toUpperCase()] || '#eab308';
    },
    getHeading: (data: any) => {
      // Check both heading and bearing fields, default to 0 if missing
      const heading = data?.lastPosition?.heading ?? data?.lastPosition?.bearing ?? 0;
      return typeof heading === 'number' && !isNaN(heading) ? heading : 0;
    },
    getIdentifier: (data: any) => {
      return data?.flag as string | undefined;
    },
  };
}

/**
 * Create drone configuration (example for future expansion)
 */
export function createDroneConfig(options: ConfigFactoryOptions): VehicleTypeConfig {
  return {
    type: 'drone',
    iconPath: './drone-icon.svg',
    defaultColor: '#8b5cf6', // Purple
    getColor: (operator?: string) => {
      if (!operator) return '#8b5cf6';
      return options.operatorColors[operator.toUpperCase()] || '#8b5cf6';
    },
    getHeading: (data: any) => {
      return data?.heading || 0;
    },
    getIdentifier: (data: any) => {
      return data?.operator as string | undefined;
    },
  };
}

/**
 * Create satellite configuration (example for future expansion)
 */
export function createSatelliteConfig(options: ConfigFactoryOptions): VehicleTypeConfig {
  return {
    type: 'satellite',
    iconPath: './satellite-icon.svg',
    defaultColor: '#ec4899', // Pink
    getColor: (operator?: string) => {
      if (!operator) return '#ec4899';
      return options.operatorColors[operator.toUpperCase()] || '#ec4899';
    },
    getHeading: (data: any) => {
      return data?.heading || 0;
    },
    getIdentifier: (data: any) => {
      return data?.operator as string | undefined;
    },
  };
}

/**
 * Configuration factory
 */
export class VehicleConfigFactory {
  static createConfig(
    type: 'aircraft' | 'vessel' | 'drone' | 'satellite',
    options: ConfigFactoryOptions
  ): VehicleTypeConfig {
    switch (type) {
      case 'aircraft':
        return createAircraftConfig(options);
      case 'vessel':
        return createVesselConfig(options);
      case 'drone':
        return createDroneConfig(options);
      case 'satellite':
        return createSatelliteConfig(options);
      default:
        throw new Error(`Unknown vehicle type: ${type}`);
    }
  }
}
