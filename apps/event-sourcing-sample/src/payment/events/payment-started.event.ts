import { BaseEvent } from '@/types/domain.event.types';
import { PriceSnapshot } from '@/types';

/**
 * 결재 시작 이벤트
 */
export class PaymentStartedEvent extends BaseEvent {
  aggregateId: string;
  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly priceSnapshot: PriceSnapshot,
    public readonly startedAt: Date,
  ) {
    super();
    this.aggregateId = paymentId;
  }
}



