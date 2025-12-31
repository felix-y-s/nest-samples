import { Injectable } from '@nestjs/common';
import { EventBus, IEvent } from '@nestjs/cqrs';
import { OrderAggregate } from '../aggregates/order.aggregate';
import {
  OrderCreatedEvent,
  PaymentAttemptedEvent,
  PaymentFailedEvent,
  PaymentSucceededEvent,
  OrderCompletedEvent,
  OrderCancelledEvent,
} from '../events';

/**
 * 이벤트 스토어 서비스
 * - 이벤트를 저장하고 조회하는 역할
 * - 실제 프로덕션에서는 데이터베이스를 사용하지만, 예제에서는 메모리 기반으로 구현
 */
@Injectable()
export class EventStoreService {
  // 메모리 기반 이벤트 저장소: orderId -> 이벤트 배열
  private readonly eventStore = new Map<string, IEvent[]>();

  constructor(private readonly eventBus: EventBus) {
    // 이벤트 버스에서 발행되는 모든 이벤트를 구독하여 저장
    this.subscribeToEvents();
  }

  /**
   * 이벤트 버스에서 발행되는 모든 이벤트를 구독
   */
  private subscribeToEvents() {
    // 모든 이벤트를 저장하기 위해 EventBus 구독
    this.eventBus.subscribe((event: IEvent) => {
      this.saveEvent(event);
    });
  }

  /**
   * 이벤트 저장
   */
  private saveEvent(event: IEvent) {
    // 이벤트에서 orderId 추출
    const orderId = this.extractOrderId(event);
    if (!orderId) {
      return;
    }

    // 해당 주문의 이벤트 배열 가져오기 (없으면 새로 생성)
    const events = this.eventStore.get(orderId) || [];
    events.push(event);
    this.eventStore.set(orderId, events);

    console.log(`[이벤트 저장] ${event.constructor.name}:`, {
      orderId,
      totalEvents: events.length,
    });
  }

  /**
   * 이벤트에서 orderId 추출
   */
  private extractOrderId(event: IEvent): string | null {
    if ('orderId' in event && typeof event.orderId === 'string') {
      return event.orderId;
    }
    return null;
  }

  /**
   * 특정 주문의 모든 이벤트 조회
   */
  getEventsByOrderId(orderId: string): IEvent[] {
    return this.eventStore.get(orderId) || [];
  }

  /**
   * 이벤트 히스토리를 사용하여 주문 Aggregate 복원
   */
  async getOrderById(orderId: string): Promise<OrderAggregate | null> {
    const events = this.getEventsByOrderId(orderId);

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
   * Aggregate에 이벤트 적용
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

  /**
   * 모든 주문 ID 목록 조회
   */
  getAllOrderIds(): string[] {
    return Array.from(this.eventStore.keys());
  }

  /**
   * 이벤트 스토어 초기화 (테스트용)
   */
  clearAll() {
    this.eventStore.clear();
  }
}
