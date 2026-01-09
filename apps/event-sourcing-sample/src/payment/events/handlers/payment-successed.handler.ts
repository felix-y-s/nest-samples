import { Injectable } from '@nestjs/common';
import { EventPublisher, EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PaymentSuccessedEvent } from '../payment-successed.event';
import { OrderAggregate } from '@order/aggregates/order.aggregate';
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
    const orderAggregate = await this.orderRepository.findById(event.orderId);
    if (!orderAggregate) {
      throw new Error(`이벤트 aggergate 조회 실패: ${event.orderId}`);
    }
    const order = this.publisher.mergeObjectContext(orderAggregate);
    order.completeOrder();
    order.commit();
  }
}
