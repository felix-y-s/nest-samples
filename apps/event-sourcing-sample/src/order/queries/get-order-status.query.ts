/**
 * 주문 상태 조회 쿼리
 */
export class GetOrderStatusQuery {
  constructor(public readonly orderId: string) {}
}
