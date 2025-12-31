/**
 * 결제 시도 이벤트
 * - 주문에 대한 결제를 시도했을 때 발생
 */
export class PaymentAttemptedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly attemptedAt: Date,
  ) {}
}
