import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataFetcherService } from './data-fetcher/data-fetcher.service';

async function bootstrap() {
  // Silence logs if requested
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: process.env.DISABLE_LOGS === 'true' ? false : undefined,
  });

  try {
    // Optionally disable SignalR in worker if desired
    // process.env.DISABLE_SIGNALR === 'true' can be set at runtime by the user

    // Keep the application context running to allow cron jobs to execute
    // Touch the service so Nest instantiates it
    app.get(DataFetcherService);
    // eslint-disable-next-line no-console
    if (process.env.DISABLE_LOGS !== 'true') console.log('[Worker] Data fetcher worker started');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[Worker] Failed to start worker', err);
    process.exit(1);
  }
}

void bootstrap();
