import { Module, Global } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { EventStoreService } from './event-store.service';

@Global()
@Module({
  imports: [CqrsModule],
  providers: [EventStoreService],
  exports: [EventStoreService],
})
export class EventStoreModule {}
