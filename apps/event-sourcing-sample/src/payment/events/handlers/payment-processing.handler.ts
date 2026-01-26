import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PaymentProcessingEvent } from '../payment-processing.event';

@EventsHandler(PaymentProcessingEvent)
export class PaymentProcessingHandler implements IEventHandler<PaymentProcessingEvent> {
  handle(event: PaymentProcessingEvent) {
    // TODO: 비지니스 스트림 저장소에 저장
    console.log(`💾 [PaymentProcessingEvent] 비지니스 스트림 저장소에 저장`);
  }
}