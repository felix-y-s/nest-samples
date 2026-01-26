import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OrderCompletedEvent } from '../order-completed.event';

@EventsHandler(OrderCompletedEvent)
export class OrderCompletedHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(
  ) {}

  async handle(event: OrderCompletedEvent) {
    // TODO: 비지니스 스트림 저장소에 저장
    console.log(`💾 [OrderCompletedEvent] 비지니스 스트림 저장소에 저장`);
  }
}