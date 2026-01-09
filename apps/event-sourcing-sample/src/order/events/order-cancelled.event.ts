import { BaseEvent } from '@/types/domain.event.types';

/**
 * 주문 취소 이벤트
 * - 결제 실패로 인해 주문이 취소되었을 때 발생
 */
export class OrderCancelledEvent implements BaseEvent {
  public readonly aggregateId: string;

  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly reason: string,
    public readonly cancelledAt: Date,
  ) {
    this.aggregateId = orderId;
  }
}
