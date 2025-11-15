import { Module } from '@nestjs/common';
import { RxjsController } from './rxjs.controller';
import { RxjsService } from './rxjs.service';

@Module({
  controllers: [RxjsController],
  providers: [
    RxjsService,
    {
      provide: 'TIMEOUT_CONFIG',
      useValue: {
        default: 1000,
        '/': 1000,
      },
    },
    {
      provide: 'RETRY_CONFIG',
      useValue: {
        retry: 2,
        delay: Math.random() * 200 + 300
      },
    },
  ],
})
export class RxjsModule {}
