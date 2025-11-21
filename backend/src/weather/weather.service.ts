import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

// OpenWeatherMap API response interfaces
export interface OpenWeatherMapResponse {
  coord?: {
    lon: number;
    lat: number;
  };
  weather?: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  base?: string;
  main?: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
    sea_level?: number;
    grnd_level?: number;
  };
  visibility?: number;
  wind?: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds?: {
    all: number;
  };
  rain?: {
    '1h'?: number;
    '3h'?: number;
  };
  snow?: {
    '1h'?: number;
    '3h'?: number;
  };
  dt: number;
  sys?: {
    type?: number;
    id?: number;
    country?: string;
    sunrise?: number;
    sunset?: number;
  };
  timezone?: number;
  id?: number;
  name?: string;
  cod?: number;
}

export interface MarineWeatherData {
  latitude: number;
  longitude: number;
  timestamp: string;
  temperature: number; // °C
  weatherDescription: string;
  humidity: number; // %
  pressure: number; // hPa
  windSpeed: number; // m/s converted to km/h
  windDirection: number; // degrees
  visibility: number; // meters
  cloudCover: number; // %
}

@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);
  private readonly baseUrl = 'https://api.open-meteo.com/v1';
  private readonly openWeatherMapApiKey: string;
  private readonly openWeatherMapBaseUrl: string;

  constructor(private configService: ConfigService) {
    this.openWeatherMapApiKey = this.configService.get<string>('OPENWEATHER_API_KEY') || '';
    this.openWeatherMapBaseUrl = 'https://api.openweathermap.org/data/2.5';

    if (!this.openWeatherMapApiKey) {
      this.logger.warn(
        'OpenWeatherMap API key not configured. Marine weather features may not work.',
      );
    }
  }

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
   * Get marine weather using OpenWeatherMap API
   * Extracts: temperature, weather description, humidity, pressure, wind speed, wind direction
   */
  async getMarineWeather(latitude: number, longitude: number): Promise<MarineWeatherData | null> {
    // Validate API key
    if (!this.openWeatherMapApiKey) {
      this.logger.error('OpenWeatherMap API key is not configured');
      return null;
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      this.logger.error(`Invalid coordinates: latitude=${latitude}, longitude=${longitude}`);
      return null;
    }

    try {
      const url = `${this.openWeatherMapBaseUrl}/weather`;

      this.logger.debug(`Fetching marine weather from OpenWeatherMap for ${latitude},${longitude}`);

      const response = await axios.get<OpenWeatherMapResponse>(url, {
        params: {
          lat: latitude,
          lon: longitude,
          appid: this.openWeatherMapApiKey,
          units: 'metric', // Use metric units (Celsius, m/s, etc.)
        },
        timeout: 10000, // 10 second timeout
      });

      // Validate response
      if (!response.data) {
        this.logger.error('Empty response from OpenWeatherMap API');
        return null;
      }

      const data = response.data;

      // Extract weather data with fallback values
      const marineWeather: MarineWeatherData = {
        latitude,
        longitude,
        timestamp: new Date(data.dt * 1000).toISOString(),
        temperature: data.main?.temp ?? 0,
        weatherDescription: data.weather?.[0]?.description ?? 'Unknown',
        humidity: data.main?.humidity ?? 0,
        pressure: data.main?.pressure ?? 0,
        windSpeed: (data.wind?.speed ?? 0) * 3.6, // Convert m/s to km/h
        windDirection: data.wind?.deg ?? 0,
        visibility: data.visibility ?? 0,
        cloudCover: data.clouds?.all ?? 0,
      };

      this.logger.log(
        `Marine weather fetched successfully for ${latitude},${longitude}: ` +
          `${marineWeather.temperature}°C, ${marineWeather.weatherDescription}, ` +
          `wind ${marineWeather.windSpeed.toFixed(1)} km/h`,
      );

      return marineWeather;
    } catch (error) {
      // Enhanced error handling
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // API returned error response
          const statusCode = error.response.status;
          const message = error.response.data?.message || error.message;

          switch (statusCode) {
            case 401:
              this.logger.error(`OpenWeatherMap API authentication failed: Invalid API key`);
              break;
            case 404:
              this.logger.error(`Location not found: ${latitude},${longitude}`);
              break;
            case 429:
              this.logger.error(`OpenWeatherMap API rate limit exceeded`);
              break;
            default:
              this.logger.error(`OpenWeatherMap API error (${statusCode}): ${message}`);
          }
        } else if (error.request) {
          // Network error - no response received
          this.logger.error(
            `Network error fetching marine weather for ${latitude},${longitude}: ${error.message}`,
          );
        } else {
          // Request setup error
          this.logger.error(`Error setting up marine weather request: ${error.message}`);
        }
      } else {
        // Non-Axios error
        this.logger.error(
          `Unexpected error fetching marine weather for ${latitude},${longitude}:`,
          error instanceof Error ? error.message : String(error),
        );
      }

      return null;
    }
  }
}
