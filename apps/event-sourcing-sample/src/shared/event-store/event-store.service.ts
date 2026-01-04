import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventBus, IEvent } from '@nestjs/cqrs';

@Injectable()
export class EventStoreService implements OnModuleInit {
  // 메모리 기반 이벤트 저장소: aggregateId -> 이벤트 배열
  private readonly eventStore = new Map<string, IEvent[]>();

  constructor(private readonly eventBus: EventBus) {}

  onModuleInit() {
    // 모든 이벤트를 저장하기 위해 EventBus 구독
    this.eventBus.subscribe((event: IEvent) => {
      this.saveEvent(event);
    });
  }

  /**
   * 이벤트 저장
   */
  private saveEvent(event: IEvent) {
    // Aggregate ID 추출
    const aggregateId = this.extractAggregateId(event);
    if (!aggregateId) {
      // ID를 식별할 수 없는 이벤트는 저장하지 않음 (또는 로그만 남김)
      // console.warn(`[EventStore] Cannot identify aggregateId for event: ${event.constructor.name}`);
      return;
    }

    // 해당 Aggregate의 이벤트 배열 가져오기 (없으면 새로 생성)
    const events = this.eventStore.get(aggregateId) || [];
    events.push(event);
    this.eventStore.set(aggregateId, events);

    console.log(`[중앙 EventStore 저장] ${event.constructor.name}:`, {
      aggregateId,
      totalEvents: events.length,
      eventData: event,
    });
  }

  /**
   * 이벤트에서 Aggregate ID 추출하는 전략
   * - 다양한 모듈의 이벤트를 지원하기 위해 유연하게 처리
   */
  private extractAggregateId(event: any): string | null {
    if (!event) return null;

    // 1. 대부분의 경우 orderId, userId, id 중 하나를 사용한다고 가정
    if (event.orderId && typeof event.orderId === 'string') return event.orderId;
    if (event.userId && typeof event.userId === 'string') return event.userId;
    if (event.id && typeof event.id === 'string') return event.id;

     // 2. BaseEvent 추상 클래스나 인터페이스를 사용한다면 `aggregateId` 속성을 직접 확인 가능
    if (event.aggregateId && typeof event.aggregateId === 'string') return event.aggregateId;

    return null;
  }

  /**
   * 특정 Aggregate의 모든 이벤트 조회
   */
  getEvents(aggregateId: string): IEvent[] {
    return this.eventStore.get(aggregateId) || [];
  }

  /**
   * 모든 Aggregate ID 조회 (디버깅용)
   */
  getAllAggregateIds(): string[] {
    return Array.from(this.eventStore.keys());
  }

  /**
   * 스토어 초기화 (테스트용)
   */
  clearAll() {
    this.eventStore.clear();
  }
}
