export type PriceSnapshot = {
  originalAmount: number; // 할인 전
  discountAmount: number; // 총 할인
  finalAmount: number; // 결제 요청(=amount)
  currency?: string;
  pricingRevision?: number; // Order 가격 버전(선택)
};