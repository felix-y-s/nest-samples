import { IQueryHandler, QueryHandler, IEvent } from '@nestjs/cqrs';
import { GetOrderHistoryQuery } from '../get-order-history.query';
import { EventStoreService } from '../../services/event-store.service';

/**
 * 주문 히스토리 조회 결과 DTO
 */
export interface OrderHistoryDto {
  orderId: string;
  events: EventDto[];
  totalEvents: number;
}

/**
 * 이벤트 DTO
 */
export interface EventDto {
  eventType: string;
  timestamp: Date | string;
  data: any;
}

/**
 * 주문 히스토리 조회 쿼리 핸들러
 */
@QueryHandler(GetOrderHistoryQuery)
export class GetOrderHistoryHandler
  implements IQueryHandler<GetOrderHistoryQuery>
{
  constructor(private readonly eventStore: EventStoreService) {}

  async execute(query: GetOrderHistoryQuery): Promise<OrderHistoryDto | null> {
    const { orderId } = query;

    // 이벤트 스토어에서 모든 이벤트 조회
    const events = this.eventStore.getEventsByOrderId(orderId);

    if (events.length === 0) {
      return null;
    }

    // 이벤트를 DTO로 변환
    const eventDtos = events.map((event) => this.convertToDto(event));

    return {
      orderId,
      events: eventDtos,
      totalEvents: events.length,
    };
  }

  /**
   * 이벤트를 DTO로 변환
   */
  private convertToDto(event: IEvent): EventDto {
    return {
      eventType: event.constructor.name,
      timestamp: this.extractTimestamp(event),
      data: { ...event },
    };
  }

  /**
   * 이벤트에서 타임스탬프 추출
   */
  private extractTimestamp(event: any): Date | string {
    // 대부분의 이벤트에 타임스탬프 필드가 있다고 가정
    if (event.createdAt) return event.createdAt;
    if (event.attemptedAt) return event.attemptedAt;
    if (event.failedAt) return event.failedAt;
    if (event.succeededAt) return event.succeededAt;
    if (event.completedAt) return event.completedAt;
    if (event.cancelledAt) return event.cancelledAt;
    return new Date();
  }
}
