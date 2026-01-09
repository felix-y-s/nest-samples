import { BaseEvent } from '@/types/domain.event.types';

export class PaymentProcessingEvent extends BaseEvent {
  readonly aggregateId: string;

  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly userId: string,
    public readonly amount: number,
  ) {
    super();
    this.aggregateId = paymentId;
  }
}