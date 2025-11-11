import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';
import * as express from 'express';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { API_VERSION } from './common/version';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Ensure uploads directory exists & serve it statically
  const uploadsDir = join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  // Serve static files for uploaded images
  app.use('/uploads', express.static(uploadsDir));

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // forbidNonWhitelisted: true, // Disabled - too strict, causes 400 for endpoints without DTO
      transform: true,
    }),
  );

  // Global interceptors & filters
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable CORS using env var FRONTEND_ORIGIN (comma-separated allowed)
  const allowedOrigins = (process.env.FRONTEND_ORIGIN || 'http://localhost:4000')
    .split(',')
    .map((s) => s.trim());
  app.enableCors({
    origin: allowedOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Basic security headers
  app.use(helmet());

  // Global API prefix and versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.HEADER,
    header: 'X-API-Version',
    defaultVersion: API_VERSION,
  });

  // Swagger / OpenAPI
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
      // Auto-inject X-API-Version header for all requests
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
        
        // Also intercept XMLHttpRequest
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
          if (url.includes('/api/')) {
            this.addEventListener('readystatechange', function() {
              if (this.readyState === 1) { // OPENED
                if (!this.getRequestHeader('X-API-Version')) {
                  this.setRequestHeader('X-API-Version', '${API_VERSION}');
                }
              }
            });
          }
          return originalOpen.call(this, method, url, ...args);
        };
      });
    `,
  });

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');

  // Debug: liệt kê toàn bộ routes đã đăng ký (tạm thời)
  const server: any = app.getHttpServer();
  const router = server._events?.request?._router || server._router; // express router
  const globalPrefix = 'api'; // we know we set it above
  if (router && router.stack) {
    console.log('--- Registered Routes ---');
    router.stack
      .filter((l: any) => l.route)
      .forEach((l: any) => {
        const methods = Object.keys(l.route.methods)
          .filter((m) => l.route.methods[m])
          .map((m) => m.toUpperCase())
          .join(',');
        const path = `/${globalPrefix}${l.route.path}`;
        console.log(methods.padEnd(10), path);
      });
    console.log('-------------------------');
  }
}

void bootstrap();
