import { AggregateRoot } from '@nestjs/cqrs';
import {
  OrderCreatedEvent,
  PaymentAttemptedEvent,
  PaymentFailedEvent,
  PaymentFailureReason,
  PaymentSucceededEvent,
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
  private productName: string;
  private quantity: number;
  private price: number;
  private discountRate: number;
  private status: OrderStatus;
  private totalAmount: number;
  private finalAmount: number;

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

    // 여기서 실제 비지니스 로직을 실행하는거야? 예를들어 주문을 생성해서 디비에 저장하는 등의 일을 진행해?

    // 이벤트 발행 - 상태 변경은 이벤트 핸들러에서 처리
    this.apply(
      new OrderCreatedEvent(
        this.orderId,
        userId,
        productId,
        productName,
        quantity,
        price,
        discountRate,
        new Date(),
      ),
    );
  }

  /**
   * 결제 처리
   */
  processPayment(userBalance: number) {
    // 주문이 생성된 상태인지 확인
    if (this.status !== OrderStatus.CREATED) {
      throw new Error('주문 생성 상태에서만 결제를 시도할 수 있습니다');
    }

    // 결제 시도 이벤트 발행
    this.apply(
      new PaymentAttemptedEvent(
        this.orderId,
        this.userId,
        this.finalAmount,
        new Date(),
      ),
    );

    // 할인율 검증 (최대 50%까지만 허용한다고 가정)
    const MAX_DISCOUNT_RATE = 50;
    if (this.discountRate > MAX_DISCOUNT_RATE) {
      this.apply(
        new PaymentFailedEvent(
          this.orderId,
          this.userId,
          this.finalAmount,
          PaymentFailureReason.INVALID_DISCOUNT_RATE,
          `할인율이 최대 허용치(${MAX_DISCOUNT_RATE}%)를 초과했습니다`,
          new Date(),
          {
            requestedDiscountRate: this.discountRate,
            maxAllowedDiscountRate: MAX_DISCOUNT_RATE,
          },
        ),
      );
      return;
    }

    // 잔액 검증
    if (userBalance < this.finalAmount) {
      this.apply(
        new PaymentFailedEvent(
          this.orderId,
          this.userId,
          this.finalAmount,
          PaymentFailureReason.INSUFFICIENT_BALANCE,
          `잔액이 부족합니다. 필요 금액: ${this.finalAmount}, 현재 잔액: ${userBalance}`,
          new Date(),
          {
            currentBalance: userBalance,
          },
        ),
      );
      return;
    }

    // 결제 성공
    const transactionId = `TXN-${Date.now()}-${this.orderId}`;
    this.apply(
      new PaymentSucceededEvent(
        this.orderId,
        this.userId,
        this.finalAmount,
        transactionId,
        new Date(),
      ),
    );

    // 주문 완료
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
   */
  onOrderCreatedEvent(event: OrderCreatedEvent) {
    this.orderId = event.orderId;
    this.userId = event.userId;
    this.productId = event.productId;
    this.productName = event.productName;
    this.quantity = event.quantity;
    this.price = event.price;
    this.discountRate = event.discountRate;
    this.totalAmount = event.totalAmount;
    this.finalAmount = event.finalAmount;
    this.status = OrderStatus.CREATED;
  }

  /**
   * 결제 시도 이벤트 처리
   */
  onPaymentAttemptedEvent(event: PaymentAttemptedEvent) {
    this.status = OrderStatus.PAYMENT_PENDING;
  }

  /**
   * 결제 실패 이벤트 처리
   */
  onPaymentFailedEvent(event: PaymentFailedEvent) {
    this.status = OrderStatus.PAYMENT_FAILED;
  }

  /**
   * 결제 성공 이벤트 처리
   */
  onPaymentSucceededEvent(event: PaymentSucceededEvent) {
    this.status = OrderStatus.PAYMENT_SUCCEEDED;
  }

  /**
   * 주문 완료 이벤트 처리
   */
  onOrderCompletedEvent(event: OrderCompletedEvent) {
    this.status = OrderStatus.COMPLETED;
  }

  /**
   * 주문 취소 이벤트 처리
   */
  onOrderCancelledEvent(event: OrderCancelledEvent) {
    this.status = OrderStatus.CANCELLED;
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
