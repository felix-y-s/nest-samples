import { EventPublisher, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PaymentSuccessedEvent } from '../payment-successed.event';
import { OrderRepository } from '@order/repositories/order.repository';

@EventsHandler(PaymentSuccessedEvent)
export class PaymentSuccessedHandler
  implements IEventHandler<PaymentSuccessedEvent>
{
  constructor(
    private readonly publisher: EventPublisher,
    private readonly orderRepository: OrderRepository,
  ) {}
  async handle(event: PaymentSuccessedEvent) {
    // TODO: 비지니스 스트림 저장소에 저장
    console.log(`💾 [PaymentSuccessedEvent] 비지니스 스트림 저장소에 저장`);

    const orderAggregate = await this.orderRepository.findById(event.orderId);
    if (!orderAggregate) {
      throw new Error(`이벤트 orderAggregate 조회 실패: ${event.orderId}`);
    }
    const order = this.publisher.mergeObjectContext(orderAggregate);
    order.completeOrder();
    // order.commit();
    await this.orderRepository.save(order);
  }
}
