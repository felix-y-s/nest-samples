import {
  EventBus,
  EventPublisher,
  EventsHandler,
  IEventHandler,
} from '@nestjs/cqrs';
import { PaymentStartedEvent } from '../payment-started.event';
import { PaymentSuccessedEvent } from '../payment-successed.event';
import { PaymentAggregate } from '@payment/aggregates';
import { PaymentGateway } from '@payment/mocks';
import { PaymentProcessingEvent } from '../payment-processing.event';
import { PaymentRepository } from '@payment/repositories/payment.repository';

@EventsHandler(PaymentStartedEvent)
export class PaymentStartedHandler
  implements IEventHandler<PaymentStartedEvent>
{
  constructor(
    private readonly eventBus: EventBus,
    private readonly publisher: EventPublisher,
    private readonly paymentGateway: PaymentGateway,
    private readonly repository: PaymentRepository,
  ) {}

  async handle(event: PaymentStartedEvent) {
    /**
     *  ❌ 잘못된 방식:
     * - eventBus.publish()는 Aggregate를 거치지 않으므로
     * - apply/commit 흐름에 포함되지 않아 Event Store에 기록되지 않는다.
    */
   // this.eventBus.publish(new PaymentProcessingEvent(event.paymentId, event.orderId, event.userId, event.amount));
   
   // 🔁 Payment Aggregate를 저장소에서 복원하여
   // EventPublisher 컨텍스트와 다시 연결
   const paymentAggregate = await this.repository.findById(event.paymentId);
   if (!paymentAggregate) {
     throw new Error('paymentAggregate 복원 실패');
   }
   const payment = this.publisher.mergeObjectContext(paymentAggregate);
   
   // 결재 시작 알림
   payment.processingPayment();
   payment.commit();

    // 결재 로직 실행
    const transactionId = await this.paymentGateway.paymentProcessing();

    // 결재 완료 알림
    payment.completePayment(transactionId);
    payment.commit();
  }
}
