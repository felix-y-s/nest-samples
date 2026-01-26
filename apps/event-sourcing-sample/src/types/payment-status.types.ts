export enum PaymentStatus {
  PENDING = 'PENDING', // 결제 대기
  STARTED = 'STARTED', // 결제 시작됨 (잔액 체크 통과)
  PROCESSING = 'PROCESSING', // 결제 처리 중
  SUCCEEDED = 'SUCCEEDED', // 결제 성공
  FAILED = 'FAILED', // 결제 실패
  CANCELLED = 'CANCELLED', // 결제 취소
}
