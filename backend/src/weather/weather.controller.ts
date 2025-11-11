import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { WeatherService } from './weather.service';
import { AuthGuard } from '../auth/guards/auth.guard';

@Controller('weather')
@UseGuards(AuthGuard)
export class WeatherController {
  constructor(private readonly weatherService: WeatherService) {}

  /**
   * GET /weather/current?lat=21.0285&lon=105.8542
   * Get current weather for a location
   */
  @Get('current')
  async getCurrentWeather(@Query('lat') latitude: string, @Query('lon') longitude: string) {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return { error: 'Invalid coordinates' };
    }

    return this.weatherService.getCurrentWeather(lat, lon);
  }

  /**
   * GET /weather/forecast?lat=21.0285&lon=105.8542
   * Get weather forecast (48h hourly)
   */
  @Get('forecast')
  async getForecast(@Query('lat') latitude: string, @Query('lon') longitude: string) {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return { error: 'Invalid coordinates' };
    }

    return this.weatherService.getWeatherForecast(lat, lon);
  }

  /**
   * GET /weather/grid?minLat=10&maxLat=20&minLon=100&maxLon=110&gridSize=5
   * Get weather grid for map visualization
   */
  @Get('grid')
  async getWeatherGrid(
    @Query('minLat') minLat: string,
    @Query('maxLat') maxLat: string,
    @Query('minLon') minLon: string,
    @Query('maxLon') maxLon: string,
    @Query('gridSize') gridSize?: string,
  ) {
    const minLatNum = parseFloat(minLat);
    const maxLatNum = parseFloat(maxLat);
    const minLonNum = parseFloat(minLon);
    const maxLonNum = parseFloat(maxLon);
    const gridSizeNum = gridSize ? parseInt(gridSize, 10) : 5;

    if (isNaN(minLatNum) || isNaN(maxLatNum) || isNaN(minLonNum) || isNaN(maxLonNum)) {
      return { error: 'Invalid coordinates' };
    }

    return this.weatherService.getWeatherGrid(
      minLatNum,
      maxLatNum,
      minLonNum,
      maxLonNum,
      gridSizeNum,
    );
  }

  /**
   * GET /weather/marine?lat=21.0285&lon=105.8542
   * Get marine weather (waves)
   */
  @Get('marine')
  async getMarineWeather(@Query('lat') latitude: string, @Query('lon') longitude: string) {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lon)) {
      return { error: 'Invalid coordinates' };
    }

    return this.weatherService.getMarineWeather(lat, lon);
  }
}
