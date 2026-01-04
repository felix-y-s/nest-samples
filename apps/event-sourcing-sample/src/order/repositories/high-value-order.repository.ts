import { Injectable } from '@nestjs/common';

export interface OrderView {
  orderId: string;
  userId: string;
  totalAmount: number;
  createdAt: Date;
}

@Injectable()
export class HighValueOrderRepository {
  // 모든 주문의 View를 메모리에 보관 (orderId -> OrderView)
  // 실제 서비스에서는 RDBMS나 NoSQL(MongoDB, Elasticsearch) 등을 사용할 것
  private readonly storage = new Map<string, OrderView>();

  /**
   * 주문 데이터 동기화 (Upsert)
   */
  async sync(order: OrderView): Promise<void> {
    this.storage.set(order.orderId, order);
    console.log(`[HighValueOrderRepository] Synced order: ${order.orderId}, Amount: ${order.totalAmount}`);
  }

  /**
   * 최고 금액 주문 조회
   * - 저장된 모든 주문을 확인하여 최고 금액을 찾음
   */
  async findHighest(): Promise<OrderView | null> {
    if (this.storage.size === 0) {
      return null;
    }

    let highestOrder: OrderView | null = null;

    for (const order of this.storage.values()) {
      if (!highestOrder || order.totalAmount > highestOrder.totalAmount) {
        highestOrder = order;
      }
    }

    return highestOrder;
  }

  /**
   * 모든 주문 조회 (디버깅용)
   */
  async findAll(): Promise<OrderView[]> {
    return Array.from(this.storage.values());
  }
}
