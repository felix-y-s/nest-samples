/**
 * 주문 생성 커맨드
 * - 새로운 주문을 생성하라는 명령
 */
export class CreateOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly productId: string,
    public readonly productName: string,
    public readonly quantity: number,
    public readonly price: number,
    public readonly discountRate: number,
  ) {}
}
