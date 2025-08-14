// src/ais/ais.module.ts
import { Module } from '@nestjs/common';
import { AisSignalrService } from './ais-signalr.service';
import { AisController } from './ais.controller';

@Module({
  providers: [
    {
      provide: AisSignalrService,
      useFactory: () => {
        const disabled = process.env.DISABLE_SIGNALR === 'true';
        if (disabled) {
          return {
            startStream$: { subscribe: () => ({ unsubscribe() {} }) },
            dataStream$: { subscribe: () => ({ unsubscribe() {} }) },
            endStream$: { subscribe: () => ({ unsubscribe() {} }) },
            connect: async () => {},
            triggerQuery: async () => false as const,
            disconnect: async () => {},
          } as unknown as AisSignalrService;
        }
        return new AisSignalrService();
      },
    },
  ],
  controllers: [AisController],
  exports: [AisSignalrService],
})
export class AisModule {}
