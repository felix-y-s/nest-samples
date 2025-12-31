/**
 * 주문 완료 이벤트
 * - 결제 성공 후 주문이 완료되었을 때 발생
 */
export class OrderCompletedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly totalAmount: number,
    public readonly completedAt: Date,
  ) {}
}
