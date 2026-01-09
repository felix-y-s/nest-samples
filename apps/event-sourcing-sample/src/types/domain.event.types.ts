// Base Event Interface
export abstract class BaseEvent {
  abstract readonly aggregateId: string; // ✅ 모든 이벤트 필수
}
