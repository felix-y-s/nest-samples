/**
 * 주문 생성 이벤트
 * - 사용자가 주문을 생성했을 때 발생
 */
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly productId: string,
    public readonly productName: string,
    public readonly quantity: number,
    public readonly price: number,
    public readonly discountRate: number, // 할인율 (0-100)
    public readonly createdAt: Date,
  ) {}

  // 총 주문 금액 계산 (할인 적용 전)
  get totalAmount(): number {
    return this.price * this.quantity;
  }

  // 할인 금액 계산
  get discountAmount(): number {
    return this.totalAmount * (this.discountRate / 100);
  }

  // 최종 결제 금액 (할인 적용 후)
  get finalAmount(): number {
    return this.totalAmount - this.discountAmount;
  }
}
