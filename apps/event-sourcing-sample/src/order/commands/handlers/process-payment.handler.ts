import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { EventStoreService } from '../../services/event-store.service';
import { ProcessPaymentCommand } from '../process-payment.command';

/**
 * 결제 처리 커맨드 핸들러
 * - ProcessPaymentCommand를 받아서 처리
 */
@CommandHandler(ProcessPaymentCommand)
export class ProcessPaymentHandler
  implements ICommandHandler<ProcessPaymentCommand>
{
  constructor(
    private readonly eventPublisher: EventPublisher,
    private readonly eventStore: EventStoreService,
  ) {}

  async execute(command: ProcessPaymentCommand): Promise<void> {
    const { orderId, userBalance } = command;

    // 1. 이벤트 스토어에서 주문의 이벤트 히스토리를 가져와서 상태 복원
    const order = await this.eventStore.getOrderById(orderId);

    if (!order) {
      throw new Error(`주문을 찾을 수 없습니다: ${orderId}`);
    }

    // 2. EventPublisher로 Aggregate를 래핑
    const orderWithPublisher = this.eventPublisher.mergeObjectContext(order);

    // 3. 비즈니스 로직 실행 (이벤트 발행)
    orderWithPublisher.processPayment(userBalance);

    // 4. 이벤트 커밋 (실제 이벤트 발행)
    orderWithPublisher.commit();
  }
}
