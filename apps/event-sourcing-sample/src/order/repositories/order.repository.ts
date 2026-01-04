import { Injectable } from '@nestjs/common';
import { EventStoreService } from '../../shared/event-store/event-store.service';
import { OrderAggregate } from '../aggregates/order.aggregate';
import { IEvent } from '@nestjs/cqrs';
import {
  OrderCreatedEvent,
  PaymentAttemptedEvent,
  PaymentFailedEvent,
  PaymentSucceededEvent,
  OrderCompletedEvent,
  OrderCancelledEvent,
} from '../events';

@Injectable()
export class OrderRepository {
  constructor(private readonly eventStore: EventStoreService) {}

  /**
   * ID로 주문 Aggregate 조회 및 복원
   */
  async findById(orderId: string): Promise<OrderAggregate | null> {
    const events = this.eventStore.getEvents(orderId);

    if (events.length === 0) {
      return null;
    }

    // Aggregate 생성
    const order = new OrderAggregate(orderId);

    // 모든 이벤트를 순서대로 재생하여 상태 복원
    for (const event of events) {
      this.applyEventToAggregate(order, event);
    }

    return order;
  }

  /**
   * Aggregate에 이벤트 적용 (Replay)
   */
  private applyEventToAggregate(order: OrderAggregate, event: IEvent) {
    if (event instanceof OrderCreatedEvent) {
      order.onOrderCreatedEvent(event);
    } else if (event instanceof PaymentAttemptedEvent) {
      order.onPaymentAttemptedEvent(event);
    } else if (event instanceof PaymentFailedEvent) {
      order.onPaymentFailedEvent(event);
    } else if (event instanceof PaymentSucceededEvent) {
      order.onPaymentSucceededEvent(event);
    } else if (event instanceof OrderCompletedEvent) {
      order.onOrderCompletedEvent(event);
    } else if (event instanceof OrderCancelledEvent) {
      order.onOrderCancelledEvent(event);
    }
  }
}
