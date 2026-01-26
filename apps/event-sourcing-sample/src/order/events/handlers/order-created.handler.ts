import { UserRepositoryMock } from '@/mocks/user.repository.mock';
import { PriceSnapshot } from '@/types';
import {
  EventBus,
  EventPublisher,
  EventsHandler,
  IEventHandler,
} from '@nestjs/cqrs';
import { OrderCreatedEvent } from '@order/events';
import { HighValueOrderRepository } from '@order/repositories/high-value-order.repository';
import { PaymentAggregate } from '@payment/aggregates';
import { PaymentRepository } from '@payment/repositories/payment.repository';

@EventsHandler(OrderCreatedEvent)
export class OrderCreatedHandler implements IEventHandler<OrderCreatedEvent> {
  constructor(
    private readonly repository: HighValueOrderRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly eventBus: EventBus,
    private readonly publisher: EventPublisher,
    private readonly userRepository: UserRepositoryMock,
  ) {}

  async handle(event: OrderCreatedEvent) {
    // TODO: 비지니스 스트림 저장소에 저장
    console.log(`💾 [OrderCreatedEvent] 비지니스 스트림 저장소에 저장`);

    // OrderCreatedEvent가 단일 상품 주문을 가정하거나,
    // 혹은 전체 주문의 대표 이벤트라고 가정하고 처리
    // 여기서는 event.finalAmount를 사용
    await this.repository.sync({
      orderId: event.orderId,
      userId: event.userId,
      totalAmount: event.finalAmount, // 할인 후 최종 금액 사용
      createdAt: event.createdAt,
    });

    // 0. 사용자 정보 조회(DB 조회 목킹)
    const mockUser = this.userRepository.findUserById(event.userId);

    // 방식1. 작동함
    // const paymentEvent = new PaymnetStartedEvent(
    //   paymentId,
    //   event.orderId,
    //   event.userId,
    //   event.totalAmount,
    //   new Date(),
    // );

    // this.eventBus.publish(paymentEvent);

    // 방식2. 작동함
    const random = Math.random().toFixed(5);
    const paymentId = `pay-${Date.now()}-${random}`;
    const payment = this.publisher.mergeObjectContext(
      new PaymentAggregate(paymentId),
    );

    const priceSnapshot: PriceSnapshot = {
      originalAmount: event.totalAmount,
      discountAmount: event.discountAmount,
      finalAmount: event.finalAmount,
      currency: 'card',
      pricingRevision: 1, // Order 가격 버전(선택)
    };
    
    payment.startPayment(
      paymentId,
      event.orderId,
      event.userId,
      mockUser.balance,
      event.finalAmount,
      priceSnapshot,
    );
    // payment.commit();
    await this.paymentRepository.save(payment);
  }
}
