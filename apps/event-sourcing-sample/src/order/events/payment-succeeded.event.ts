/**
 * 결제 성공 이벤트
 * - 결제가 성공적으로 완료되었을 때 발생
 */
export class PaymentSucceededEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly transactionId: string, // 결제 트랜잭션 ID
    public readonly succeededAt: Date,
  ) {}
}
