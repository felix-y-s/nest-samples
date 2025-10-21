/**
 * 사용자 역할 열거형
 *
 * 시스템에서 사용되는 사용자 권한 레벨을 정의합니다.
 * Prisma schema의 Role enum과 일치해야 합니다.
 */
export enum Role {
  /**
   * 관리자 - 모든 권한 보유
   */
  ADMIN = 'ADMIN',

  /**
   * 일반 사용자 - 기본 권한
   */
  USER = 'USER',

  /**
   * 게스트 - 제한적 권한 (읽기 전용)
   */
  GUEST = 'GUEST',

  /**
   * 판매자 - 상품 판매 권한
   */
  SELLER = 'SELLER',

  /**
   * 구매자 - 상품 구매 권한
   */
  BUYER = 'BUYER',
}
