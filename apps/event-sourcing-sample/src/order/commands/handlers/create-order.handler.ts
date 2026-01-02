import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { CreateOrderCommand } from '../create-order.command';
import { OrderAggregate } from '../../aggregates/order.aggregate';

/**
 * 주문 생성 커맨드 핸들러
 * - CreateOrderCommand를 받아서 처리
 */
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler
  implements ICommandHandler<CreateOrderCommand>
{
  constructor(private readonly eventPublisher: EventPublisher) {}

  async execute(command: CreateOrderCommand): Promise<void> {
    const {
      orderId,
      userId,
      productId,
      productName,
      quantity,
      price,
      discountRate,
    } = command;

    // 1. Aggregate 생성
    const order = this.eventPublisher.mergeObjectContext(
      new OrderAggregate(orderId),
    );

    // 2. 비즈니스 로직 실행 (이벤트 발행)
    order.createOrder(userId, productId, productName, quantity, price, discountRate);

    // 3. 이벤트 커밋 (실제 이벤트 발행)
    order.commit();
  }
}
