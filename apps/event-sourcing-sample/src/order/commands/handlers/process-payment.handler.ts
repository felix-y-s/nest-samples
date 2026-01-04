import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { OrderRepository } from '../../repositories/order.repository';
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
    private readonly orderRepository: OrderRepository,
  ) {}

  async execute(command: ProcessPaymentCommand): Promise<void> {
    const { orderId, userBalance } = command;

    // 1. 이벤트 스토어에서 주문의 이벤트 히스토리를 가져와서 상태 복원
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new Error(`주문을 찾을 수 없습니다: ${orderId}`);
    }

    // 2. EventPublisher로 Aggregate를 래핑
    const orderWithPublisher = this.eventPublisher.mergeObjectContext(order);

    // 3. 결제 시작 (상태 변경 -> PENDING)
    orderWithPublisher.initiatePayment();
    orderWithPublisher.commit();

    // 4. 외부 결제 시스템 호출 (시뮬레이션)
    try {
      // NOTE: 실제로는 PG사 API를 호출하거나, 다른 마이크로서비스를 호출함
      // 여기서는 간단히 잔액 체크를 시뮬레이션
      this.simulateExternalPayment(userBalance, order.getFinalAmount());

      // 5-1. 결제 성공 처리
      const transactionId = `TXN-${Date.now()}-${orderId}`;

      // 다시 Aggregate를 로드해서 처리하거나,
      // 현재 컨텍스트(orderWithPublisher)가 유효하다면 재사용할 수 있으나
      // Event Sourcing에서는 보통 commit 후 버전이 올라가므로 주의 필요.
      // 여기서는 편의상 orderWithPublisher를 계속 사용하되,
      // 실제로는 commit() 호출 후에는 새로 로드하는 것이 안전할 수 있음.
      // 다만 NestCQRS의 mergeObjectContext는 연속 commit을 지원함.

      orderWithPublisher.completePayment(transactionId);
    } catch (error) {
      // 5-2. 결제 실패 처리
      orderWithPublisher.failPayment(error.message);
    }

    // 6. 최종 상태 커밋
    orderWithPublisher.commit();
  }

  private simulateExternalPayment(userBalance: number, amount: number) {
    if (amount <= 0) {
      throw new Error('결제 금액은 0보다 커야 합니다');
    }
    if (userBalance < amount) {
      throw new Error(
        `잔액이 부족합니다. (필요: ${amount}, 보유: ${userBalance})`,
      );
    }
    // 성공 시 아무것도 반환하지 않거나 txId 반환
  }
}
