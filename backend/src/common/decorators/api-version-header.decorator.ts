import { applyDecorators } from '@nestjs/common';
import { ApiHeader, ApiSecurity } from '@nestjs/swagger';

export function ApiVersionHeader() {
  return applyDecorators(
    ApiSecurity('api-version'),
    ApiHeader({
      name: 'X-API-Version',
      description: 'API version header',
      required: true,
      example: '1',
    }),
  );
}
