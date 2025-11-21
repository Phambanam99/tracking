import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();

    // Determine mode: in DEV we can be more permissive to ease debugging
    const isDev = process.env.NODE_ENV !== 'production';
    const strictAuth = process.env.WS_STRICT_AUTH === 'true' || !isDev;

    // Prefer token from Socket.IO auth payload, fallback to Authorization header
    const authPayloadToken = client.handshake?.auth?.token;
    const authHeader = client.handshake?.headers?.authorization as string | undefined;
    const headerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;

    const token = authPayloadToken || headerToken;

    if (!token) {
      const msg = `WebSocket missing token for client ${client.id}`;
      if (strictAuth) {
        this.logger.warn(msg);
        throw new WsException('Unauthorized: missing token');
      }

      // Relaxed mode (development): allow anonymous connection
      this.logger.warn(`⚠️ ${msg}, allowing anonymous connection in non-strict mode`);
      client.data = { user: null, authenticated: false };
      return true;
    }

    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        const msg = 'JWT_SECRET is not configured for WebSocket auth';
        if (strictAuth) {
          this.logger.error(msg);
          throw new WsException('Server configuration error');
        }
        this.logger.warn(`⚠️ ${msg}, falling back to anonymous user in non-strict mode`);
        client.data = { user: null, authenticated: false };
        return true;
      }

      const decoded = jwt.verify(token, secret) as any;
      client.data = { user: decoded, authenticated: true };
      this.logger.debug(
        `✅ WebSocket authenticated client ${client.id} as ${decoded.sub || decoded.id || 'unknown'}`,
      );
      return true;
    } catch (err: any) {
      const msg = `WebSocket token invalid for client ${client.id}: ${err?.message || err}`;
      if (strictAuth) {
        this.logger.warn(msg);
        throw new WsException('Unauthorized: invalid token');
      }

      // Relaxed mode (development): allow but mark unauthenticated
      this.logger.warn(`⚠️ ${msg}, allowing anonymous connection in non-strict mode`);
      client.data = { user: null, authenticated: false };
      return true;
    }
  }
}
