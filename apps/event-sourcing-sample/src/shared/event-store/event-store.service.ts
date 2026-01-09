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
      // ID를 식별할 수 없는 이벤트는 저장하지 않고 로그만 남김
      console.warn(`[EventStore] Cannot identify aggregateId for event: ${event.constructor.name}`);
      return;
    }

    // 해당 Aggregate의 이벤트 배열 가져오기 (없으면 새로 생성)
    const events = this.eventStore.get(aggregateId) || [];
    events.push(event);
    this.eventStore.set(aggregateId, events);

    console.log(`💾 [중앙 EventStore 저장] ${event.constructor.name}:`, {
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

    // ✅ aggregateId만 확인 (명확하고 단순)
    if (event.aggregateId && typeof event.aggregateId === 'string') {
      return event.aggregateId;
    }

    // Fallback (하위 호환성, 점진적 마이그레이션)
    console.warn(`[EventStore] aggregateId 없음: ${event.constructor.name}`);

    if (event.paymentId) return event.paymentId;
    if (event.orderId) return event.orderId;

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
