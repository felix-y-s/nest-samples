import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetOrderStatusQuery } from '../get-order-status.query';
import { OrderRepository } from '../../repositories/order.repository';
import { OrderStatus } from '../../aggregates/order.aggregate';
import { EventStoreService } from '../../../shared/event-store/event-store.service';

/**
 * 주문 상태 조회 결과 DTO
 */
export interface OrderStatusDto {
  orderId: string;
  status: OrderStatus;
  finalAmount?: number;
  eventCount: number; // 이벤트 개수
}

/**
 * 주문 상태 조회 쿼리 핸들러
 */
@QueryHandler(GetOrderStatusQuery)
export class GetOrderStatusHandler
  implements IQueryHandler<GetOrderStatusQuery>
{
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly eventStore: EventStoreService,
  ) {}

  async execute(query: GetOrderStatusQuery): Promise<OrderStatusDto | null> {
    const { orderId } = query;

    // 이벤트 스토어에서 주문 복원
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      return null;
    }

    // 이벤트 개수 조회
    const events = this.eventStore.getEvents(orderId);

    return {
      orderId: order.getOrderId(),
      status: order.getStatus(),
      finalAmount: order.getFinalAmount(),
      eventCount: events.length,
    };
  }
}
