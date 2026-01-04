import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OrderCreatedEvent } from '../../events/order-created.event';
import { HighValueOrderRepository } from '../../repositories/high-value-order.repository';

@EventsHandler(OrderCreatedEvent)
export class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
  constructor(private readonly repository: HighValueOrderRepository) {}

  async handle(event: OrderCreatedEvent) {
    // OrderCreatedEvent가 단일 상품 주문을 가정하거나, 
    // 혹은 전체 주문의 대표 이벤트라고 가정하고 처리
    // 여기서는 event.finalAmount를 사용
    await this.repository.sync({
      orderId: event.orderId,
      userId: event.userId,
      totalAmount: event.finalAmount, // 할인 후 최종 금액 사용
      createdAt: event.createdAt,
    });
  }
}
