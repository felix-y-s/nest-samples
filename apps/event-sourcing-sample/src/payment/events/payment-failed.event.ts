import { BaseEvent } from '@/types/domain.event.types';

/**
 * 결제 실패 원인
 */
export enum PaymentFailureReason {
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE', // 잔액 부족,

  PAYMENT_GATEWAY_ERROR = 'PAYMENT_GATEWAY_ERROR', // 결제 게이트웨이 오류
  INVALID_PAYMENT_METHOD = 'INVALID_PAYMENT_METHOD', // 잘못된 결제 수단
}

/**
 * 결제 실패 이벤트
 * - 주문에 대한 결제가 실패했을 때 발생
 */
export class PaymentFailedEvent implements BaseEvent {
  readonly aggregateId: string;

  constructor(
    public readonly paymentId: string,
    public readonly orderId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly reason: PaymentFailureReason,
    public readonly errorMessage: string,
    public readonly failedAt: Date,
    // 실패 원인별 추가 정보
    public readonly additionlInfo?: {
      currentBalance?: number; // 잔액 부족 시 현재 잔액
    },
  ) {
    this.aggregateId = paymentId;
  }
}