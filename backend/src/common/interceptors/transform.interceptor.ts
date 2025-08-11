import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { API_VERSION } from '../version';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const response = http.getResponse();
    const request = http.getRequest();

    // Ensure version header is present on all responses
    if (response && typeof response.setHeader === 'function') {
      response.setHeader('X-API-Version', API_VERSION);
    }

    return next.handle().pipe(
      map((data: unknown) => {
        if (
          data &&
          typeof data === 'object' &&
          'success' in (data as Record<string, unknown>)
        ) {
          // Already standardized
          return data;
        }

        const payload = {
          success: true as const,
          data,
          path: request?.url,
          timestamp: new Date().toISOString(),
        };
        return payload;
      }),
    );
  }
}
