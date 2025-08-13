import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { API_VERSION } from '../version';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const isSse =
      !!request?.headers?.accept && String(request.headers.accept).includes('text/event-stream');

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as any)
        : 'Internal server error';

    if (response && typeof response.setHeader === 'function' && !response.headersSent) {
      response.setHeader('X-API-Version', API_VERSION);
    }

    // If this is an SSE request and headers/body may already be streaming, write as an SSE error event
    if (isSse) {
      try {
        if (!response.headersSent) {
          response.setHeader('Content-Type', 'text/event-stream');
          response.setHeader('Cache-Control', 'no-cache');
          response.setHeader('Connection', 'keep-alive');
        }
        const errorPayload = {
          success: false,
          error: typeof message === 'string' ? { message } : message,
          path: request?.url,
          timestamp: new Date().toISOString(),
        };
        response.write(`event: error\n`);
        response.write(`id: ${Date.now()}\n`);
        response.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
        // Do not end the stream; leave it to the controller/connection lifecycle
      } catch {
        // Fallback: end safely if write fails
        try {
          response.end();
        } catch {}
      }
      return;
    }

    response.status(status).json({
      success: false,
      error: typeof message === 'string' ? { message } : message,
      path: request?.url,
      timestamp: new Date().toISOString(),
    });
  }
}
