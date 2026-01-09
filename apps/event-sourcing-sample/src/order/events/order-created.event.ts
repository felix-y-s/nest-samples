import { BaseEvent } from '@/types/domain.event.types';

/**
 * 주문 생성 이벤트
 * - 사용자가 주문을 생성했을 때 발생
 */
export class OrderCreatedEvent implements BaseEvent {
  public readonly aggregateId: string;
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly productId: string,
    public readonly productName: string,
    public readonly quantity: number,
    public readonly price: number,
    public readonly discountRate: number, // 할인율 (0-100)
    public readonly totalAmount: number, // ✅ 계산된 값 저장 (할인 적용 전)
    public readonly discountAmount: number, // ✅ 계산된 값 저장
    public readonly finalAmount: number, // ✅ 계산된 값 저장 (할인 적용 후)
    public readonly createdAt: Date,
  ) {
    this.aggregateId = orderId;
  }

  // ✅ getter 함수 제거 - 계산 로직 없음, 저장된 값만 사용
}
