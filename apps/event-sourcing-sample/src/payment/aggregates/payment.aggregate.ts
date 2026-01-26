import { AggregateRoot } from '@nestjs/cqrs';
import {
  PaymentFailedEvent,
  PaymentFailureReason,
  PaymentSuccessedEvent,
} from '../events';
import { PaymentStartedEvent } from '@payment/events/payment-started.event';
import { PaymentProcessingEvent } from '@payment/events/payment-processing.event';
import { PaymentStatus, PriceSnapshot } from '@/types';

export class PaymentAggregate extends AggregateRoot {
  private paymentId: string;
  private orderId: string;
  private userId: string;
  private amount: number;
  private status: PaymentStatus;
  private reason?: PaymentFailureReason;
  private transactionId?: string;
  private startedAt?: Date;
  private successedAt?: Date;
  private failedAt?: Date;

  constructor(paymentId: string) {
    super();
    this.paymentId = paymentId;
    this.status = PaymentStatus.PENDING;
  }

  /**
   * Payment 시작 비즈니스 메서드
   * - Order 생성 이벤트 수신 시 호출
   */
  startPayment(
    paymentId: string,
    orderId: string,
    userId: string,
    currentBalance: number,
    amount: number,
    priceSnapshot: PriceSnapshot,
  ) {
    if (this.status !== PaymentStatus.PENDING) {
      throw new Error('결제는 PENDING 상태에서만 시작할 수 있습니다');
    }

    // 잔액 부족 검증
    if (currentBalance < amount) {
      this.apply(
        new PaymentFailedEvent(
          paymentId,
          orderId,
          userId,
          amount,
          PaymentFailureReason.INSUFFICIENT_BALANCE,
          '잔액 부족',
          new Date(),
          { currentBalance },
        ),
      );
      return;
    }

    this.apply(
      new PaymentStartedEvent(
        paymentId,
        orderId,
        userId,
        amount,
        priceSnapshot,
        new Date(),
      ),
    );
  }

  processingPayment() {
    if (this.status !== PaymentStatus.STARTED) {
      throw new Error(
        'STARTED 상태에서만 PROCESSING 상태로 변경할 수 있습니다',
      );
    }

    this.apply(
      new PaymentProcessingEvent(
        this.paymentId,
        this.orderId,
        this.userId,
        this.amount,
      ),
    );
  }

  /**
   * 결재 게이트웨이로 부터 성공 응답 수신
   */
  completePayment(transactionId: string) {
    if (this.status !== PaymentStatus.PROCESSING) {
      throw new Error('결재 처리 진행 중에만 성공으로 변경할 수 없습니다');
    }

    this.apply(
      new PaymentSuccessedEvent(
        this.orderId,
        this.userId,
        this.amount,
        this.paymentId,
        transactionId,
        new Date(),
      ),
    );
  }

  /**
   * 결재 게이트웨이로 부터 실패 응답 수신
   */
  faliPayment(
    reason: PaymentFailureReason,
    errorMessage?: string,
    additionlInfo?: {
      currentBalance?: number; // 잔액 부족 시 현재 잔액
    },
  ) {
    this.apply(
      new PaymentFailedEvent(
        this.paymentId,
        this.orderId,
        this.userId,
        this.amount,
        reason,
        errorMessage || '',
        new Date(),
        additionlInfo,
      ),
    );
  }

  // ✅ 이벤트 핸들러 메서드 추가!
  onPaymentStartedEvent(event: PaymentStartedEvent) {
    this.orderId = event.orderId;
    this.userId = event.userId;
    this.amount = event.amount;
    this.startedAt = event.startedAt;
    this.status = PaymentStatus.STARTED;
  }

  onPaymentProcessingEvent(event: PaymentProcessingEvent) {
    this.status = PaymentStatus.PROCESSING;
  }

  onPaymentSuccessedEvent(event: PaymentSuccessedEvent) {
    this.status = PaymentStatus.SUCCEEDED;
    this.transactionId = event.transactionId;
    this.successedAt = event.successedAt;
  }

  onPaymentFailedEvent(event: PaymentFailedEvent) {
    this.status = PaymentStatus.FAILED;
    this.reason = event.reason;
    this.failedAt = event.failedAt;
  }

  getId() {
    return this.paymentId;
  }
}
