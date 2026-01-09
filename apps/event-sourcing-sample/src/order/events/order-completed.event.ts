import { BaseEvent } from '@/types/domain.event.types';

/**
 * 주문 완료 이벤트
 * - 결제 성공 후 주문이 완료되었을 때 발생
 */
export class OrderCompletedEvent implements BaseEvent {
  public readonly aggregateId: string;
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly totalAmount: number,
    public readonly completedAt: Date,
  ) {
    this.aggregateId = orderId;
  }
}
