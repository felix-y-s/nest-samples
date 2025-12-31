/**
 * 결제 처리 커맨드
 * - 주문에 대한 결제를 처리하라는 명령
 */
export class ProcessPaymentCommand {
  constructor(
    public readonly orderId: string,
    public readonly userBalance: number, // 사용자의 현재 잔액
  ) {}
}
