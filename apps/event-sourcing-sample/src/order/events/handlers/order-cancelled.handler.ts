import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OrderCancelledEvent } from '../order-cancelled.event';

@EventsHandler(OrderCancelledEvent)
export class OrderCancelledHandler implements IEventHandler<OrderCancelledEvent> {
  handle(event: OrderCancelledEvent) {
    // TODO: 비지니스 스트림 저장소에 저장
    console.log(`💾 [OrderCompletedEvent] 비지니스 스트림 저장소에 저장`);
  }
}