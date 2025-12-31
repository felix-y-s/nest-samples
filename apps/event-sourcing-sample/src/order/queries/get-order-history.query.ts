/**
 * 주문 이벤트 히스토리 조회 쿼리
 * - 주문의 모든 이벤트 히스토리를 조회
 */
export class GetOrderHistoryQuery {
  constructor(public readonly orderId: string) {}
}
