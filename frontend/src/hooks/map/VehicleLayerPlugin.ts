/**
 * Vehicle layer plugin implementation
 * Provides pluggable architecture for different vehicle types
 */

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Cluster from 'ol/source/Cluster';
import { Style } from 'ol/style';
import Map from 'ol/Map';
import { IMapLayerPlugin, VehicleTypeConfig } from './types';
import { getZoomFromResolution, shouldSimplifyIcons } from '../../utils/mapUtils';

interface VehicleLayerPluginConfig {
  vehicleConfig: VehicleTypeConfig;
  styleFactory: {
    createClusterStyle: (config: any) => Style;
    createDotStyle: (color: string) => Style;
    createIconStyle: (heading: number, identifier?: string) => Style;
  };
}

/**
 * Base vehicle layer plugin
 */
export class VehicleLayerPlugin implements IMapLayerPlugin {
  readonly id: string;
  readonly name: string;

  private config: VehicleTypeConfig;
  private styleFactory: VehicleLayerPluginConfig['styleFactory'];
  private source: VectorSource;
  private clusterSource?: Cluster;
  private layer?: VectorLayer<any>;
  private map?: Map;

  constructor(config: VehicleLayerPluginConfig) {
    this.config = config.vehicleConfig;
    this.styleFactory = config.styleFactory;
    this.id = `${config.vehicleConfig.type}-layer`;
    this.name = `${config.vehicleConfig.type.charAt(0).toUpperCase() + config.vehicleConfig.type.slice(1)} Layer`;

    // Create source
    this.source = new VectorSource();

    // Create cluster if enabled
    if (config.vehicleConfig.clusterEnabled) {
      this.clusterSource = new Cluster({
        source: this.source,
        distance: config.vehicleConfig.clusterDistance,
        minDistance: config.vehicleConfig.minClusterDistance,
      });
    }
  }

  initialize(map: Map): void {
    this.map = map;
  }

  createLayer(): VectorLayer<any> {
    const styleFunction = this.createStyleFunction();

    this.layer = new VectorLayer({
      source: this.clusterSource ?? this.source,
      style: styleFunction,
      declutter: false,
      renderBuffer: 32,
      updateWhileAnimating: false,
      updateWhileInteracting: false,
    });

    return this.layer;
  }

  getSource(): VectorSource {
    return this.source;
  }

  setVisible(visible: boolean): void {
    this.layer?.setVisible(visible);
  }

  destroy(): void {
    this.layer?.setSource(null as any);
    this.source.clear();
    this.clusterSource?.clear();
  }

  /**
   * Update cluster distance dynamically
   */
  updateClusterDistance(distance: number): void {
    if (this.clusterSource) {
      this.clusterSource.setDistance(distance);
    }
  }

  /**
   * Create the style function for this vehicle type
   */
  private createStyleFunction(): (feature: any, resolution: number) => Style {
    return (feature, resolution) => {
      const zoom = getZoomFromResolution(resolution);
      const clusterMembers = feature.get('features') as any[] | undefined;

      // Clustered rendering
      if (this.config.clusterEnabled && clusterMembers) {
        if (!Array.isArray(clusterMembers)) return new Style();

        const size = clusterMembers.length;

        // Multiple items in cluster
        if (size > 1) {
          const bucket = Math.min(99, Math.max(2, size));
          const showText = zoom > 6;
          return this.styleFactory.createClusterStyle({
            sizeBucket: bucket,
            withText: showText,
            color: this.config.defaultColor,
            type: this.config.type,
          });
        }

        // Single item - extract data
        const data = clusterMembers[0]?.get(this.config.type);
        if (!data) return new Style();

        // Simplified rendering at low zoom
        if (shouldSimplifyIcons(zoom)) {
          const identifier = this.config.getIdentifier(data);
          const color = this.config.getColor(identifier);
          return this.styleFactory.createDotStyle(color);
        }

        // Full icon rendering
        const heading = this.config.getHeading(data);
        const identifier = this.config.getIdentifier(data);
        return this.styleFactory.createIconStyle(heading, identifier);
      }

      // Non-clustered rendering
      const data = feature.get(this.config.type);
      if (!data) return new Style();

      if (shouldSimplifyIcons(zoom)) {
        const identifier = this.config.getIdentifier(data);
        const color = this.config.getColor(identifier);
        return this.styleFactory.createDotStyle(color);
      }

      const heading = this.config.getHeading(data);
      const identifier = this.config.getIdentifier(data);
      return this.styleFactory.createIconStyle(heading, identifier);
    };
  }
}

/**
 * Factory for creating vehicle layer plugins
 */
export class VehicleLayerFactory {
  static createPlugin(
    vehicleConfig: VehicleTypeConfig,
    styleFactory: VehicleLayerPluginConfig['styleFactory']
  ): VehicleLayerPlugin {
    return new VehicleLayerPlugin({
      vehicleConfig,
      styleFactory,
    });
  }
}
