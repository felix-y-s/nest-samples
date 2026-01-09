import { AggregateRoot } from '@nestjs/cqrs';
import {
  OrderCreatedEvent,
  OrderCompletedEvent,
  OrderCancelledEvent,
} from '../events';

/**
 * 주문 상태
 */
export enum OrderStatus {
  CREATED = 'CREATED', // 주문 생성됨
  PAYMENT_PENDING = 'PAYMENT_PENDING', // 결제 대기 중
  PAYMENT_FAILED = 'PAYMENT_FAILED', // 결제 실패
  PAYMENT_SUCCEEDED = 'PAYMENT_SUCCEEDED', // 결제 성공
  COMPLETED = 'COMPLETED', // 주문 완료
  CANCELLED = 'CANCELLED', // 주문 취소
}

/**
 * 주문 Aggregate
 * - 주문의 생명주기를 관리하고 비즈니스 로직을 처리
 * - 이벤트를 발행하여 상태 변경을 기록
 */
export class OrderAggregate extends AggregateRoot {
  private orderId: string;
  private userId: string;
  private productId: string;
  private paymentId: string;
  private discountRate: number;
  private status: OrderStatus;
  private totalAmount: number; // 할인 적용 전, 주문의 원래 금액
  private discountAmount: number; // 할인 금액
  private finalAmount: number; // 실제로 결제해야 하는 최종 금액
  private completedAt: Date;
  private cancelledAt: Date;
  private cancelledReason: string;

  constructor(orderId: string) {
    super();
    this.orderId = orderId;
    this.status = OrderStatus.CREATED;
  }

  /**
   * 주문 생성
   */
  createOrder(
    userId: string,
    productId: string,
    productName: string,
    quantity: number,
    price: number,
    discountRate: number,
  ) {
    // 비즈니스 로직 검증
    if (quantity <= 0) {
      throw new Error('수량은 0보다 커야 합니다');
    }
    if (price <= 0) {
      throw new Error('가격은 0보다 커야 합니다');
    }
    if (discountRate < 0 || discountRate > 100) {
      throw new Error('할인율은 0-100 사이여야 합니다');
    }

    /**
     * 여기서는 비지니스 로직 검증 + 이벤트 발행 만
     * 🖍️ 절대하면 안되는것(외부 시스템 연동)
     * - DB 직접 저장
     * - 이메일 전송
     * - 재고 차감
     * - 결제 처리
     * ☝️ 외부 시스템 연동은 EventHandler에서 처리
     */

    // ✅ 계산 로직은 여기서 수행 (이벤트 발행 전)
    const totalAmount = price * quantity;
    const discountAmount = totalAmount * (discountRate / 100);
    const finalAmount = totalAmount - discountAmount;

    // ✅ 계산된 값을 이벤트에 전달
    this.apply(
      new OrderCreatedEvent(
        this.orderId,
        userId,
        productId,
        productName,
        quantity,
        price,
        discountRate,
        totalAmount, // 계산된 값
        discountAmount, // 계산된 값
        finalAmount, // 계산된 값
        new Date(),
      ),
    );
  }

  /**
   * 주문 완료
   */
  completeOrder() {
    if (this.status !== OrderStatus.CREATED) {
      throw new Error('주문 완료는 CREATED 상태에서만 가능합니다');
    }

    this.apply(
      new OrderCompletedEvent(
        this.orderId,
        this.userId,
        this.finalAmount,
        new Date(),
      ),
    );
  }

  /**
   * 주문 취소
   */
  cancelOrder(reason: string) {
    if (this.status === OrderStatus.COMPLETED) {
      throw new Error('완료된 주문은 취소할 수 없습니다');
    }

    this.apply(
      new OrderCancelledEvent(this.orderId, this.userId, reason, new Date()),
    );
  }

  // ========== 이벤트 핸들러 (상태 변경) ==========

  /**
   * 주문 생성 이벤트 처리
   * - 실제 상태 변경은 여기서 발생
   * - ✅ 이벤트에 저장된 계산된 값을 그대로 사용
   */
  onOrderCreatedEvent(event: OrderCreatedEvent) {
    this.userId = event.userId;
    this.productId = event.productId;
    this.discountRate = event.discountRate;
    this.totalAmount = event.totalAmount; // ✅ 계산된 값
    this.discountAmount = event.discountAmount; // ✅ 계산된 값
    this.finalAmount = event.finalAmount; // ✅ 계산된 값
    this.status = OrderStatus.CREATED;
  }

  /**
   * 주문 완료 이벤트 처리
   */
  onOrderCompletedEvent(event: OrderCompletedEvent) {
    this.status = OrderStatus.COMPLETED;
    this.completedAt = event.completedAt;
  }

  /**
   * 주문 취소 이벤트 처리
   */
  onOrderCancelledEvent(event: OrderCancelledEvent) {
    this.status = OrderStatus.CANCELLED;
    this.cancelledReason = event.reason;
    this.cancelledAt = event.cancelledAt;
  }

  // ========== Getter 메서드 ==========

  getOrderId(): string {
    return this.orderId;
  }

  getStatus(): OrderStatus {
    return this.status;
  }

  getFinalAmount(): number {
    return this.finalAmount;
  }
}
