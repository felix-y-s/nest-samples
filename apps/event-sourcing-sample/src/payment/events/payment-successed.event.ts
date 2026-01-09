import { BaseEvent } from '@/types/domain.event.types';

/**
 * 결제 성공 이벤트
 * - 결제가 성공적으로 완료되었을 때 발생
 */
export class PaymentSuccessedEvent implements BaseEvent {
  readonly aggregateId: string;

  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly paymentId: string,
    public readonly transactionId: string, // 결제 트랜잭션 ID
    public readonly successedAt: Date,
  ) {
    this.aggregateId = paymentId;
  }
}