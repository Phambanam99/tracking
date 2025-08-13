import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { API_VERSION } from './common/version';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
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

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

void bootstrap();
