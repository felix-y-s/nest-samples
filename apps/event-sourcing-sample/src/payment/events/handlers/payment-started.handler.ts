import {
  EventBus,
  EventPublisher,
  EventsHandler,
  IEventHandler,
} from '@nestjs/cqrs';
import { PaymentStartedEvent } from '../payment-started.event';
import { PaymentRepository } from '@payment/repositories/payment.repository';
import { PaymentFailureReason } from '../payment-failed.event';
import { PaymentGatewayMock } from '@/mocks';

@EventsHandler(PaymentStartedEvent)
export class PaymentStartedHandler
  implements IEventHandler<PaymentStartedEvent>
{
  constructor(
    private readonly eventBus: EventBus,
    private readonly publisher: EventPublisher,
    private readonly paymentGateway: PaymentGatewayMock,
    private readonly paymentRepository: PaymentRepository,
  ) {}

  async handle(event: PaymentStartedEvent) {
    // TODO: 비지니스 스트림 저장소에 저장
    console.log(`💾 [PaymentStartedEvent] 비지니스 스트림 저장소에 저장`);

    /**
     *  ❌ 잘못된 방식:
     * - eventBus.publish()는 Aggregate를 거치지 않으므로
     * - apply/commit 흐름에 포함되지 않아 Event Store에 기록되지 않는다.
     */
    // this.eventBus.publish(new PaymentProcessingEvent(event.paymentId, event.orderId, event.userId, event.amount));

    // 🔁 Payment Aggregate를 저장소에서 복원하여
    // EventPublisher 컨텍스트와 다시 연결
    const paymentAggregate = await this.paymentRepository.findById(event.paymentId);
    if (!paymentAggregate) {
      throw new Error('paymentAggregate 복원 실패');
    }
    const payment = this.publisher.mergeObjectContext(paymentAggregate);

    // 결재 시작 알림
    payment.processingPayment();
    // ✅ 명시적 저장 (여기서 DB 저장 + 이벤트 발행 일어남)
    this.paymentRepository.save(payment);

    let transactionId: string;
    try {
      // 결재 로직 실행
      transactionId = await this.paymentGateway.paymentProcessing();
    } catch (error) {
      payment.faliPayment(
        PaymentFailureReason.PAYMENT_GATEWAY_ERROR,
        error.message,
      );
      throw new Error(error);
    }

    // 결재 완료 알림
    payment.completePayment(transactionId);
    // ✅ 명시적 저장 (여기서 DB 저장 + 이벤트 발행 일어남)
    this.paymentRepository.save(payment);
  }
}
