import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PaymentFailedEvent } from '../payment-failed.event';

@EventsHandler(PaymentFailedEvent)
export class PaymentFailedHandler implements IEventHandler<PaymentFailedEvent> {
  handle(event: PaymentFailedEvent) {
    // TODO: 비지니스 스트림 저장소에 저장
    console.log(`💾 [PaymentFailedEvent] 비지니스 스트림 저장소에 저장`);
  }
}