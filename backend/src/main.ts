import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType, Logger } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import * as express from 'express';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { API_VERSION } from './common/version';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const configService = app.get(ConfigService);

  // ==========================================
  // 1️⃣ CORS Configuration (from your code)
  // ==========================================
  const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:4000')
    .split(',')
    .map((s) => s.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Version'],
  });

  // ==========================================
  // 2️⃣ Static File Serving
  // ==========================================
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsDir));

  // ==========================================
  // 3️⃣ Global Pipes, Guards, Filters
  // ==========================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false, // Keep as false to avoid breaking existing endpoints
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // ==========================================
  // 4️⃣ Security & API Versioning
  // ==========================================
  app.use(helmet());
  // Only apply global prefix to REST routes, not WebSocket routes
  app.setGlobalPrefix('api', {
    exclude: ['/socket.io'],
  });
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: 'X-API-Version',
    defaultVersion: API_VERSION,
  });

  // ==========================================
  // 5️⃣ Swagger/OpenAPI (from your code)
  // ==========================================
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tracking API')
    .setDescription('API documentation for Tracking service')
    .setVersion(API_VERSION)
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-API-Version' }, 'api-version')
    .addSecurityRequirements('api-version')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
      defaultModelsExpandDepth: -1,
      defaultModelExpandDepth: 3,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      showExtensions: true,
      showCommonExtensions: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'Tracking API Documentation',
    customCss: `
      .swagger-ui .auth-wrapper .authorize {
        background-color: #4CAF50 !important;
        color: white !important;
      }
      .swagger-ui .auth-wrapper .authorize:hover {
        background-color: #45a049 !important;
      }
    `,
    customJs: `
      window.addEventListener('load', function() {
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          if (url.includes('/api/') && !options.headers) {
            options.headers = {};
          }
          if (url.includes('/api/') && options.headers && !options.headers['X-API-Version']) {
            options.headers['X-API-Version'] = '${API_VERSION}';
          }
          return originalFetch(url, options);
        };
      });
    `,
  });

  // ==========================================
  // 6️⃣ WebSocket Configuration (Simple - no Redis needed for single server)
  // ==========================================

  // ==========================================
  // 7️⃣ Start Server
  // ==========================================
  const port = configService.get<number>('PORT') || 3001;
  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 Application running on port ${port}`);

  // ==========================================
  // 8️⃣ Graceful Shutdown
  // ==========================================
  app.enableShutdownHooks();
  
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.log(`⚠️  Received ${signal}, starting graceful shutdown...`);
      await app.close();
      logger.log('✅ Application closed gracefully');
      process.exit(0);
    });
  });

  // ==========================================
  // 9️⃣ Debug Routes (from your code)
  // ==========================================
  const server: any = app.getHttpServer();
  const router = server._events?.request?._router || server._router;
  const globalPrefix = 'api';

  if (router?.stack) {
    logger.log('--- Registered Routes ---');
    router.stack
      .filter((l: any) => l.route)
      .forEach((l: any) => {
        const methods = Object.keys(l.route.methods)
          .filter((m) => l.route.methods[m])
          .map((m) => m.toUpperCase())
          .join(',');
        const path = `/${globalPrefix}${l.route.path}`;
        logger.log(`${methods.padEnd(10)} ${path}`);
      });
    logger.log('-------------------------');
  }
}

void bootstrap();
