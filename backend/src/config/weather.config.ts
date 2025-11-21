export interface WeatherConfig {
  openWeatherMapApiKey: string;
  openWeatherMapBaseUrl: string;
}

export const weatherConfig = (): WeatherConfig => ({
  openWeatherMapApiKey: process.env.OPENWEATHER_API_KEY || '',
  openWeatherMapBaseUrl: 'https://api.openweathermap.org/data/2.5',
});
