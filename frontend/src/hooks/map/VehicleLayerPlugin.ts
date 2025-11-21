/**
 * Vehicle layer plugin implementation
 * Provides pluggable architecture for different vehicle types
 */

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
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
  private layer?: VectorLayer<any>;
  private map?: Map;

  constructor(config: VehicleLayerPluginConfig) {
    this.config = config.vehicleConfig;
    this.styleFactory = config.styleFactory;
    this.id = `${config.vehicleConfig.type}-layer`;
    this.name = `${config.vehicleConfig.type.charAt(0).toUpperCase() + config.vehicleConfig.type.slice(1)} Layer`;

    // Create source
    this.source = new VectorSource();
  }

  initialize(map: Map): void {
    this.map = map;
  }

  createLayer(): VectorLayer<any> {
    const styleFunction = this.createStyleFunction();

    this.layer = new VectorLayer({
      source: this.source,
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
  }

  /**
   * Create the style function for this vehicle type
   */
  private createStyleFunction(): (feature: any, resolution: number) => Style {
    return (feature, resolution) => {
      const zoom = getZoomFromResolution(resolution);
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
