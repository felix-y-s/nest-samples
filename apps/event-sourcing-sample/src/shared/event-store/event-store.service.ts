import { Injectable } from '@nestjs/common';
import { EventBus, IEvent } from '@nestjs/cqrs';

@Injectable()
export class EventStoreService {
  // 메모리 기반 이벤트 저장소: aggregateId -> 이벤트 배열
  private readonly eventStore = new Map<string, IEvent[]>();

  constructor(private readonly eventBus: EventBus) {}

  /**
   * 이벤트 저장
   * - Repository 클래스에서 명시적으로 호출함
   */
  async saveEvents(events: IEvent[], aggregateId: string) {
    // 현재: 메모리 저장 (Map)
    // - 해당 Aggregate의 이벤트 배열 가져오기 (없으면 새로 생성)
    const existingEvents = this.eventStore.get(aggregateId) || [];
    const newEvents = [...existingEvents, ...events];
    this.eventStore.set(aggregateId, newEvents);

    // ⭐️ 미래: MongoDB 도입 시 여기만 바꾸면 됨 (Repository 수정 불필요)
    // await this.mongoModel.insertMany(events.map(e => ({ ... })));

    console.debug(`[중앙 EventStore 저장]`, {
      aggregateId,
      totalEvents: events.length,
      eventData: events,
    });
  }

  /**
   * 특정 Aggregate의 모든 이벤트 조회
   */
  getEvents(aggregateId: string): ReadonlyArray<IEvent> {
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
