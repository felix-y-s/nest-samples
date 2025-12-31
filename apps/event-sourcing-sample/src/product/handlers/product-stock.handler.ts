import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OrderCompletedEvent } from '../../order/events';

/**
 * 주문 완료 이벤트를 구독하여 상품 재고를 감소시키는 핸들러
 *
 * 역할:
 * - OrderCompletedEvent 구독
 * - 상품 재고 감소 처리 (다른 도메인 연동)
 * - 재고 부족 시 보상 이벤트 발행 가능
 */
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler implements IEventHandler<OrderCompletedEvent> {
  async handle(event: OrderCompletedEvent) {
    console.log('[ProductStockHandler] 주문 완료 이벤트 수신:', {
      orderId: event.orderId,
      userId: event.userId,
      amount: event.amount,
      completedAt: event.completedAt,
    });

    // TODO(human): 여기에 상품 재고 감소 로직을 구현하세요.
    //
    // 구현 가이드:
    // 1. event에서 productId와 quantity 정보 추출 필요
    //    (현재 OrderCompletedEvent에는 없음 - 이벤트 확장 필요)
    //
    // 2. ProductRepository를 통해 재고 감소:
    //    await this.productRepository.decreaseStock(productId, quantity);
    //
    // 3. 재고 부족 시 예외 처리:
    //    - 보상 트랜잭션 (Saga 패턴)
    //    - ProductStockInsufficientEvent 발행
    //
    // 4. 성공 시 로그:
    //    console.log(`[재고 감소 완료] 상품 ${productId}: -${quantity}`);

    // 현재는 시뮬레이션만 (실제 DB 업데이트 없음)
    console.log('[시뮬레이션] 상품 재고 감소 완료');
  }
}
