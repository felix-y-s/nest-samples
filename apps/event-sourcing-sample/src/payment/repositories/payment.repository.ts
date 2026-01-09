import { Injectable } from '@nestjs/common';
import { IEvent } from '@nestjs/cqrs';
import { PaymentAggregate } from '@payment/aggregates';
import { PaymentFailedEvent, PaymentSuccessedEvent } from '@payment/events';
import { PaymentProcessingEvent } from '@payment/events/payment-processing.event';
import { PaymentStartedEvent } from '@payment/events/payment-started.event';
import { EventStoreService } from '@shared/event-store/event-store.service';

export interface PaymentReadModel {
  paymentId: string;
}

@Injectable()
export class PaymentRepository {
  constructor(
    private readonly eventStore: EventStoreService,
  ) {}

  /**
   * ID로 주문 Aggregate 조회 및 복원
   */
  async findById(paymentId: string): Promise<PaymentAggregate | null> {
    const events = this.eventStore.getEvents(paymentId);

    if (events.length === 0) {
      return null;
    }

    // Aggregate 생성
    const payment = new PaymentAggregate(paymentId);

    for (const event of events) {
      this.applyEventToAggregate(payment, event);
    }

    return payment;
  }

  /**
   * Aggregate에 이벤트 적용 (Replay)
   */
  private applyEventToAggregate(payment: PaymentAggregate, event: IEvent) {
    if (event instanceof PaymentStartedEvent) {
      payment.onPaymentStartedEvent(event);
    } else if (event instanceof PaymentProcessingEvent) {
      payment.onPaymentProcessingEvent(event);
    } else if (event instanceof PaymentSuccessedEvent) {
      payment.onPaymentSuccessedEvent(event);
    } else if (event instanceof PaymentFailedEvent) {
      payment.onPaymentFailedEvent(event);
    }
  }
}
