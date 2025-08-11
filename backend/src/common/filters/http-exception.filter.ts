import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { API_VERSION } from '../version';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)
        : 'Internal server error';

    try {
      response.setHeader('X-API-Version', API_VERSION);
    } catch {}

    response.status(status).json({
      success: false,
      error:
        typeof message === 'string'
          ? { message }
          : message,
      path: request?.url,
      timestamp: new Date().toISOString(),
    });
  }
}
