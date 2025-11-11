import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface WeatherData {
  latitude: number;
  longitude: number;
  timestamp: string;
  temperature: number; // °C
  windSpeed: number; // km/h
  windDirection: number; // degrees
  precipitation: number; // mm
  visibility: number; // meters
  cloudCover: number; // %
  pressure: number; // hPa
}

export interface WeatherForecast {
  current: WeatherData;
  hourly: WeatherData[];
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly baseUrl = 'https://api.open-meteo.com/v1';

  /**
   * Get current weather for a specific location
   */
  async getCurrentWeather(latitude: number, longitude: number): Promise<WeatherData | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          latitude,
          longitude,
          current: [
            'temperature_2m',
            'wind_speed_10m',
            'wind_direction_10m',
            'precipitation',
            'visibility',
            'cloud_cover',
            'surface_pressure',
          ].join(','),
          timezone: 'auto',
        },
      });

      const { current } = response.data;

      return {
        latitude,
        longitude,
        timestamp: current.time,
        temperature: current.temperature_2m,
        windSpeed: current.wind_speed_10m,
        windDirection: current.wind_direction_10m,
        precipitation: current.precipitation,
        visibility: current.visibility,
        cloudCover: current.cloud_cover,
        pressure: current.surface_pressure,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch weather for ${latitude},${longitude}:`, error.message);
      return null;
    }
  }

  /**
   * Get weather forecast (48 hours hourly)
   */
  async getWeatherForecast(latitude: number, longitude: number): Promise<WeatherForecast | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/forecast`, {
        params: {
          latitude,
          longitude,
          current: [
            'temperature_2m',
            'wind_speed_10m',
            'wind_direction_10m',
            'precipitation',
            'visibility',
            'cloud_cover',
            'surface_pressure',
          ].join(','),
          hourly: [
            'temperature_2m',
            'wind_speed_10m',
            'wind_direction_10m',
            'precipitation',
            'visibility',
            'cloud_cover',
            'surface_pressure',
          ].join(','),
          forecast_days: 2,
          timezone: 'auto',
        },
      });

      const { current, hourly } = response.data;

      const currentWeather: WeatherData = {
        latitude,
        longitude,
        timestamp: current.time,
        temperature: current.temperature_2m,
        windSpeed: current.wind_speed_10m,
        windDirection: current.wind_direction_10m,
        precipitation: current.precipitation,
        visibility: current.visibility,
        cloudCover: current.cloud_cover,
        pressure: current.surface_pressure,
      };

      const hourlyWeather: WeatherData[] = hourly.time.map((time: string, index: number) => ({
        latitude,
        longitude,
        timestamp: time,
        temperature: hourly.temperature_2m[index],
        windSpeed: hourly.wind_speed_10m[index],
        windDirection: hourly.wind_direction_10m[index],
        precipitation: hourly.precipitation[index],
        visibility: hourly.visibility[index],
        cloudCover: hourly.cloud_cover[index],
        pressure: hourly.surface_pressure[index],
      }));

      return {
        current: currentWeather,
        hourly: hourlyWeather,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch forecast for ${latitude},${longitude}:`, error.message);
      return null;
    }
  }

  /**
   * Get weather grid for map area (for visualization)
   */
  async getWeatherGrid(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    gridSize: number = 5, // grid points per dimension
  ): Promise<WeatherData[]> {
    // Limit grid size to prevent too many API calls (max 20x20 = 400 points)
    const clampedGridSize = Math.min(Math.max(gridSize, 3), 20);

    if (gridSize !== clampedGridSize) {
      this.logger.warn(`Grid size ${gridSize} clamped to ${clampedGridSize} (min: 3, max: 20)`);
    }

    const weatherPoints: WeatherData[] = [];
    const latStep = (maxLat - minLat) / clampedGridSize;
    const lonStep = (maxLon - minLon) / clampedGridSize;

    const promises: Promise<WeatherData | null>[] = [];

    // Generate grid points
    for (let i = 0; i <= clampedGridSize; i++) {
      for (let j = 0; j <= clampedGridSize; j++) {
        const lat = minLat + i * latStep;
        const lon = minLon + j * lonStep;
        promises.push(this.getCurrentWeather(lat, lon));
      }
    }

    const results = await Promise.all(promises);
    return results.filter((data): data is WeatherData => data !== null);
  }

  /**
   * Get marine weather (for maritime applications)
   */
  async getMarineWeather(latitude: number, longitude: number): Promise<any> {
    try {
      const response = await axios.get('https://marine-api.open-meteo.com/v1/marine', {
        params: {
          latitude,
          longitude,
          current: ['wave_height', 'wave_direction', 'wave_period'].join(','),
          hourly: ['wave_height', 'wave_direction', 'wave_period'].join(','),
          forecast_days: 2,
          timezone: 'auto',
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to fetch marine weather for ${latitude},${longitude}:`,
        error.message,
      );
      return null;
    }
  }
}
