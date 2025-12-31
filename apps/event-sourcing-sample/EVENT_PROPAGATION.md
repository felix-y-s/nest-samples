# 이벤트 전파 및 Pub/Sub 패턴

EventBus를 통한 이벤트 전파 메커니즘과 Event Store, Event Handler가 이벤트를 동시에 수신하는 Pub/Sub 패턴을 상세히 설명합니다.

## 📚 목차

1. [이벤트 전파 구조](#이벤트-전파-구조)
2. [동시 수신 흐름](#동시-수신-흐름)
3. [NestJS EventBus 내부 동작](#nestjs-eventbus-내부-동작)
4. [실행 순서 시뮬레이션](#실행-순서-시뮬레이션)
5. [동시 실행의 장점과 주의사항](#동시-실행의-장점과-주의사항)
6. [실전 디버깅 팁](#실전-디버깅-팁)

---

## 이벤트 전파 구조

### 핵심 원리: Pub/Sub 패턴

EventBus가 이벤트를 발행하면 **Event Store와 모든 Event Handler가 동시에** 이벤트를 수신합니다.

```
order.commit()
  ↓
EventBus.publish(OrderCompletedEvent)
  ↓
┌─────────────────────────────────────────────┐
│  모든 구독자에게 동시 전파 (Pub/Sub 패턴)   │
└─────────────────────────────────────────────┘
  ↓
  ├─→ EventStoreService.saveEvent()           ← 동시 실행 1
  ├─→ ProductStockHandler.handle()            ← 동시 실행 2
  ├─→ EmailNotificationHandler.handle()       ← 동시 실행 3
  └─→ PointRewardHandler.handle()             ← 동시 실행 4
```

### 전체 흐름

```typescript
// 1. Aggregate가 이벤트 발행
order.apply(new OrderCompletedEvent(...));
order.commit();
  ↓
// 2. EventBus가 모든 구독자에게 동시 전파
EventBus.publish(OrderCompletedEvent)
  ↓
  ├─→ EventStoreService.saveEvent()           // 동시 실행 1
  ├─→ ProductStockHandler.handle()            // 동시 실행 2
  ├─→ EmailNotificationHandler.handle()       // 동시 실행 3
  └─→ PointRewardHandler.handle()             // 동시 실행 4
```

---

## 동시 수신 흐름

### 실제 코드에서 보기

#### Step 1: Aggregate에서 이벤트 발행

```typescript
// handlers/process-payment.handler.ts
@CommandHandler(ProcessPaymentCommand)
export class ProcessPaymentHandler {
  constructor(
    private readonly eventPublisher: EventPublisher,
    private readonly eventStore: EventStoreService,
  ) {}

  async execute(command: ProcessPaymentCommand) {
    // 1. 이벤트 스토어에서 주문 복원
    const order = await this.eventStore.getOrderById(command.orderId);

    // 2. EventPublisher로 래핑
    const orderWithPublisher = this.eventPublisher.mergeObjectContext(order);

    // 3. 비즈니스 로직 실행 (이벤트 발행)
    orderWithPublisher.processPayment(command.userBalance);

    // 4. 👉 여기서 EventBus에 이벤트 발행!
    orderWithPublisher.commit();
    // → OrderCompletedEvent가 EventBus에 전달됨
  }
}
```

#### Step 2-1: EventStore가 수신 (모든 이벤트)

```typescript
// services/event-store.service.ts
@Injectable()
export class EventStoreService {
  private readonly eventStore = new Map<string, IEvent[]>();

  constructor(private readonly eventBus: EventBus) {
    // 👂 모든 이벤트 구독 시작
    this.subscribeToEvents();
  }

  private subscribeToEvents() {
    // EventBus에서 발행되는 모든 이벤트를 구독
    this.eventBus.subscribe((event: IEvent) => {
      this.saveEvent(event);  // 즉시 실행!
    });
  }

  private saveEvent(event: IEvent) {
    const orderId = this.extractOrderId(event);
    const events = this.eventStore.get(orderId) || [];
    events.push(event);
    this.eventStore.set(orderId, events);

    console.log(`[EventStore] ${event.constructor.name} 저장 완료`);
  }
}
```

#### Step 2-2: ProductStockHandler가 수신 (OrderCompletedEvent만)

```typescript
// product/handlers/product-stock.handler.ts
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly productRepository: ProductRepository) {}

  async handle(event: OrderCompletedEvent) {
    // 👂 OrderCompletedEvent 수신 시 즉시 실행!
    await this.productRepository.decreaseStock(
      event.productId,
      event.quantity,
    );

    console.log(`[ProductStockHandler] 재고 감소 완료`);
  }
}
```

#### Step 2-3: EmailNotificationHandler가 수신 (OrderCompletedEvent만)

```typescript
// notification/handlers/email-notification.handler.ts
@EventsHandler(OrderCompletedEvent)
export class EmailNotificationHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly emailService: EmailService) {}

  async handle(event: OrderCompletedEvent) {
    // 👂 OrderCompletedEvent 수신 시 즉시 실행!
    await this.emailService.sendConfirmation(
      event.userId,
      event.orderId,
      event.amount,
    );

    console.log(`[EmailNotificationHandler] 이메일 발송 완료`);
  }
}
```

#### Step 2-4: PointRewardHandler가 수신 (OrderCompletedEvent만)

```typescript
// point/handlers/point-reward.handler.ts
@EventsHandler(OrderCompletedEvent)
export class PointRewardHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly pointService: PointService) {}

  async handle(event: OrderCompletedEvent) {
    // 👂 OrderCompletedEvent 수신 시 즉시 실행!
    const points = Math.floor(event.amount * 0.01); // 1% 적립
    await this.pointService.addPoints(event.userId, points);

    console.log(`[PointRewardHandler] 포인트 적립 완료: +${points}P`);
  }
}
```

### 구독자 등록 구조

```typescript
// order.module.ts
@Module({
  providers: [
    // Event Store (모든 이벤트 구독)
    EventStoreService,

    // Event Handlers (특정 이벤트만 선택적 구독)
    ProductStockHandler,           // OrderCompletedEvent 구독
    EmailNotificationHandler,      // OrderCompletedEvent 구독
    PointRewardHandler,            // OrderCompletedEvent 구독
    PaymentFailureLogger,          // PaymentFailedEvent 구독
  ],
})
export class OrderModule {}
```

---

## NestJS EventBus 내부 동작

### EventBus 구현 원리 (단순화)

```typescript
// NestJS의 EventBus 내부 (개념적 구현)
export class EventBus {
  private subscribers: Array<(event: any) => void> = [];

  /**
   * 구독 등록
   */
  subscribe(handler: (event: any) => void) {
    this.subscribers.push(handler);
  }

  /**
   * 이벤트 발행 - 모든 구독자에게 동시 전달
   */
  publish(event: any) {
    // 👉 모든 구독자에게 동시에 전달!
    this.subscribers.forEach((handler) => {
      handler(event);  // 각 handler 즉시 실행
    });
  }
}
```

### 실제 사용 예시

```typescript
// EventBus 생성
const eventBus = new EventBus();

// 구독자 등록
eventBus.subscribe((event) => {
  console.log('Handler 1:', event);
});

eventBus.subscribe((event) => {
  console.log('Handler 2:', event);
});

eventBus.subscribe((event) => {
  console.log('Handler 3:', event);
});

// 이벤트 발행
eventBus.publish({
  type: 'OrderCompleted',
  orderId: '123',
  amount: 100000,
});

// 출력 (동시 실행):
// Handler 1: { type: 'OrderCompleted', orderId: '123', amount: 100000 }
// Handler 2: { type: 'OrderCompleted', orderId: '123', amount: 100000 }
// Handler 3: { type: 'OrderCompleted', orderId: '123', amount: 100000 }
```

### NestJS에서의 이벤트 필터링

```typescript
// @EventsHandler 데코레이터가 자동으로 필터링
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler {
  async handle(event: OrderCompletedEvent) {
    // 👉 OrderCompletedEvent만 수신
    // PaymentFailedEvent는 무시
  }
}

@EventsHandler(PaymentFailedEvent)
export class PaymentFailureLogger {
  async handle(event: PaymentFailedEvent) {
    // 👉 PaymentFailedEvent만 수신
    // OrderCompletedEvent는 무시
  }
}
```

---

## 실행 순서 시뮬레이션

### 콘솔 로그로 보는 동시 실행

```bash
# ProcessPaymentHandler 실행
[ProcessPaymentHandler] 결제 처리 시작

# order.commit() 호출 → EventBus.publish()
[EventBus] OrderCompletedEvent 발행

# 👉 모든 구독자가 동시에 수신!
[EventStore] OrderCompletedEvent 수신
[ProductStockHandler] OrderCompletedEvent 수신
[EmailNotificationHandler] OrderCompletedEvent 수신
[PointRewardHandler] OrderCompletedEvent 수신

# 각 Handler 처리 (비동기 실행 - 완료 순서는 랜덤)
[EventStore] OrderCompletedEvent 저장 완료          # 5ms 후
[ProductStockHandler] 재고 감소 완료                # 50ms 후 (DB 쿼리)
[PointRewardHandler] 포인트 적립 완료               # 100ms 후 (DB 쿼리)
[EmailNotificationHandler] 이메일 발송 완료         # 200ms 후 (외부 API)

# ProcessPaymentHandler 완료
[ProcessPaymentHandler] 결제 처리 완료
```

### 실제 타임라인 (밀리초 단위)

```
T=0ms:   order.commit() 호출
         ↓
T=1ms:   EventBus.publish(OrderCompletedEvent)
         ↓
T=2ms:   모든 구독자에게 동시 전달
         ├─→ EventStore.saveEvent() 시작
         ├─→ ProductStockHandler.handle() 시작
         ├─→ EmailNotificationHandler.handle() 시작
         └─→ PointRewardHandler.handle() 시작

T=5ms:   EventStore 저장 완료 (메모리 저장 - 빠름)
T=50ms:  ProductStockHandler 재고 감소 완료 (DB 쿼리)
T=100ms: PointRewardHandler 포인트 적립 완료 (DB 쿼리)
T=200ms: EmailNotificationHandler 이메일 발송 완료 (외부 API - 느림)
```

### 병렬 실행 vs 순차 실행 비교

```
┌─────────────────────────────────────────────────────┐
│ 순차 실행 (만약 Pub/Sub가 아니라면)                 │
├─────────────────────────────────────────────────────┤
│ EventStore 저장 (5ms)                               │
│   → 재고 감소 (50ms)                                │
│     → 포인트 적립 (100ms)                           │
│       → 이메일 발송 (200ms)                         │
│                                                     │
│ 총 소요 시간: 5 + 50 + 100 + 200 = 355ms            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 병렬 실행 (Pub/Sub 패턴 - 현재 구조)                │
├─────────────────────────────────────────────────────┤
│ ┌─ EventStore 저장 (5ms) ──────────────┐           │
│ ├─ 재고 감소 (50ms) ─────────────────────────┐     │
│ ├─ 포인트 적립 (100ms) ──────────────────────────┐ │
│ └─ 이메일 발송 (200ms) ────────────────────────────┘ │
│                                                     │
│ 총 소요 시간: max(5, 50, 100, 200) = 200ms        │
└─────────────────────────────────────────────────────┘

⚡ 성능 향상: 355ms → 200ms (약 44% 개선!)
```

---

## 동시 실행의 장점과 주의사항

### ✅ 장점

#### 1. 느슨한 결합

```typescript
// Event Store가 실패해도 다른 Handler는 계속 실행
@Injectable()
export class EventStoreService {
  private saveEvent(event: IEvent) {
    try {
      const orderId = this.extractOrderId(event);
      const events = this.eventStore.get(orderId) || [];
      events.push(event);
      this.eventStore.set(orderId, events);
    } catch (error) {
      // ✅ 저장 실패해도 다른 Handler는 영향 없음
      console.error('[EventStore 저장 실패]', error);
    }
  }
}

@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler {
  async handle(event: OrderCompletedEvent) {
    try {
      await this.productRepository.decreaseStock(
        event.productId,
        event.quantity,
      );
    } catch (error) {
      // ✅ 재고 감소 실패해도 이메일 발송은 계속 진행
      console.error('[재고 감소 실패]', error);
    }
  }
}
```

#### 2. 확장성

```typescript
// 새로운 Handler 추가가 기존 코드에 영향 없음
@EventsHandler(OrderCompletedEvent)
export class SlackNotificationHandler {
  async handle(event: OrderCompletedEvent) {
    // ✅ 새 Handler 추가해도 기존 Handler는 그대로!
    await this.slackService.sendMessage(
      `주문 완료: ${event.orderId} (${event.amount}원)`,
    );
  }
}

@EventsHandler(OrderCompletedEvent)
export class AnalyticsTracker {
  async handle(event: OrderCompletedEvent) {
    // ✅ 분석 추적 기능도 쉽게 추가
    await this.analyticsService.trackOrderCompleted({
      orderId: event.orderId,
      amount: event.amount,
      userId: event.userId,
    });
  }
}
```

#### 3. 병렬 처리

```typescript
// 여러 작업이 동시에 실행되어 전체 처리 시간 단축
@EventsHandler(OrderCompletedEvent)
export class OrderCompletedHandlers {
  // 순차 실행 시: 500ms (저장) + 100ms (재고) + 200ms (이메일) = 800ms
  // 병렬 실행 시: max(500ms, 100ms, 200ms) = 500ms

  // ⚡ 300ms 절약! (37.5% 성능 향상)
}
```

### ⚠️ 주의사항

#### 1. 순서 보장 없음

```typescript
// ❌ 잘못된 가정: EventStore 저장이 먼저 완료될 것
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler {
  async handle(event: OrderCompletedEvent) {
    // ❌ EventStore 저장이 완료되지 않았을 수 있음!
    // 각 Handler는 독립적으로 실행됨

    await this.productRepository.decreaseStock(...);
  }
}

// ✅ 올바른 접근: 각 Handler는 독립적으로 동작
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler {
  async handle(event: OrderCompletedEvent) {
    // ✅ 다른 Handler의 완료 여부와 무관하게 동작
    // 필요한 모든 정보는 event에서 가져옴

    await this.productRepository.decreaseStock(
      event.productId,
      event.quantity,
    );
  }
}
```

#### 2. 트랜잭션 분리

```typescript
// ❌ 잘못된 기대: 모두 성공하거나 모두 실패
// EventStore 저장 실패해도 다른 Handler는 실행됨

// ✅ 올바른 접근: 보상 트랜잭션(Saga) 패턴 필요
@EventsHandler(PaymentFailedEvent)
export class PaymentCompensationHandler {
  async handle(event: PaymentFailedEvent) {
    // 결제 실패 시 보상 로직 실행
    if (await this.wasStockDecreased(event.orderId)) {
      await this.productRepository.increaseStock(
        event.productId,
        event.quantity,
      );
    }
  }
}
```

#### 3. 멱등성 필요

```typescript
// ❌ 멱등하지 않음: 같은 이벤트가 여러 번 전달되면 문제
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler {
  async handle(event: OrderCompletedEvent) {
    // ❌ 같은 주문이 여러 번 처리되면 재고가 과다 감소!
    await this.productRepository.decreaseStock(
      event.productId,
      event.quantity,
    );
  }
}

// ✅ 멱등하게 구현: 같은 이벤트가 여러 번 와도 안전
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler {
  async handle(event: OrderCompletedEvent) {
    // ✅ 이미 처리했는지 체크
    const alreadyProcessed = await this.checkIfProcessed(event.orderId);
    if (alreadyProcessed) {
      console.log(`[이미 처리됨] 주문 ${event.orderId} 스킵`);
      return;
    }

    // 재고 감소
    await this.productRepository.decreaseStock(
      event.productId,
      event.quantity,
    );

    // 처리 완료 기록
    await this.markAsProcessed(event.orderId);
  }

  private async checkIfProcessed(orderId: string): Promise<boolean> {
    // DB에서 처리 이력 확인
    return await this.processedOrdersRepository.exists(orderId);
  }

  private async markAsProcessed(orderId: string): Promise<void> {
    // DB에 처리 완료 기록
    await this.processedOrdersRepository.save({
      orderId,
      processedAt: new Date(),
    });
  }
}
```

---

## 실전 디버깅 팁

### 1. 이벤트 흐름 추적하기

#### EventStoreService에 로그 추가

```typescript
@Injectable()
export class EventStoreService {
  constructor(private readonly eventBus: EventBus) {
    this.eventBus.subscribe((event: IEvent) => {
      const timestamp = new Date().toISOString();
      const eventName = event.constructor.name;

      console.log(`[${timestamp}] [EventStore] 📥 ${eventName} 수신`);

      this.saveEvent(event);

      console.log(`[${timestamp}] [EventStore] ✅ ${eventName} 저장 완료`);
    });
  }
}
```

#### 각 Handler에 로그 추가

```typescript
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler {
  async handle(event: OrderCompletedEvent) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [ProductStockHandler] 📥 시작`);

    await this.productRepository.decreaseStock(
      event.productId,
      event.quantity,
    );

    console.log(`[${timestamp}] [ProductStockHandler] ✅ 완료`);
  }
}

@EventsHandler(OrderCompletedEvent)
export class EmailNotificationHandler {
  async handle(event: OrderCompletedEvent) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [EmailNotificationHandler] 📥 시작`);

    await this.emailService.sendConfirmation(
      event.userId,
      event.orderId,
      event.amount,
    );

    console.log(`[${timestamp}] [EmailNotificationHandler] ✅ 완료`);
  }
}
```

### 2. 실행 결과 예시

```bash
# 결제 처리 시작
[2025-01-01T10:00:00.000Z] [ProcessPaymentHandler] 결제 처리 시작

# 이벤트 발행
[2025-01-01T10:00:00.001Z] [EventBus] OrderCompletedEvent 발행

# 모든 구독자 동시 수신
[2025-01-01T10:00:00.002Z] [EventStore] 📥 OrderCompletedEvent 수신
[2025-01-01T10:00:00.002Z] [ProductStockHandler] 📥 시작
[2025-01-01T10:00:00.002Z] [EmailNotificationHandler] 📥 시작
[2025-01-01T10:00:00.002Z] [PointRewardHandler] 📥 시작

# 각 Handler 완료 (완료 순서는 랜덤)
[2025-01-01T10:00:00.005Z] [EventStore] ✅ OrderCompletedEvent 저장 완료
[2025-01-01T10:00:00.050Z] [ProductStockHandler] ✅ 완료
[2025-01-01T10:00:00.100Z] [PointRewardHandler] ✅ 완료
[2025-01-01T10:00:00.200Z] [EmailNotificationHandler] ✅ 완료

# 결제 처리 완료
[2025-01-01T10:00:00.201Z] [ProcessPaymentHandler] 결제 처리 완료
```

### 3. 성능 측정 유틸리티

```typescript
// 성능 측정 데코레이터
function measurePerformance() {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const start = Date.now();
      const className = target.constructor.name;

      console.log(`[${className}.${propertyKey}] ⏱️  시작`);

      try {
        const result = await originalMethod.apply(this, args);
        const duration = Date.now() - start;

        console.log(`[${className}.${propertyKey}] ✅ 완료 (${duration}ms)`);

        return result;
      } catch (error) {
        const duration = Date.now() - start;

        console.error(`[${className}.${propertyKey}] ❌ 실패 (${duration}ms)`, error);

        throw error;
      }
    };

    return descriptor;
  };
}

// 사용 예시
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler {
  @measurePerformance()
  async handle(event: OrderCompletedEvent) {
    await this.productRepository.decreaseStock(
      event.productId,
      event.quantity,
    );
  }
}

// 출력:
// [ProductStockHandler.handle] ⏱️  시작
// [ProductStockHandler.handle] ✅ 완료 (48ms)
```

---

## 정리

### 이벤트 전파 핵심 정리

```
1. EventBus.publish() 호출
   ↓
2. 모든 구독자에게 동시 전파 (Pub/Sub)
   ↓
3. 각 구독자는 독립적으로 병렬 실행
   ↓
4. 실패는 격리됨 (한 곳 실패 ≠ 전체 실패)
```

### 구독자 유형

| 구독자 | 구독 방식 | 목적 |
|--------|----------|------|
| **EventStore** | 모든 이벤트 | 이벤트 영속화, 감사 추적 |
| **Event Handler** | 특정 이벤트만 선택 | 비즈니스 로직, 외부 연동 |

### 주요 특징

1. **동시 수신**: 모든 구독자가 즉시 이벤트 수신
2. **독립 실행**: 각 구독자는 독립적으로 병렬 실행
3. **느슨한 결합**: 발행자는 구독자를 몰라도 됨
4. **확장 용이**: 새 구독자 추가 시 기존 코드 변경 불필요
5. **성능 향상**: 병렬 실행으로 전체 처리 시간 단축

### 주의사항 체크리스트

- [ ] 각 Handler는 독립적으로 동작하도록 구현
- [ ] 순서 보장이 필요하면 별도 로직 구현
- [ ] 멱등성 보장 (같은 이벤트 여러 번 처리 가능)
- [ ] 실패 시 보상 트랜잭션 고려
- [ ] 로그 추가로 이벤트 흐름 추적

---

## 추가 학습 자료

- [EVENT_FLOW.md](./EVENT_FLOW.md) - 이벤트 흐름 로드맵
- [COMMAND_QUERY_BUS.md](./COMMAND_QUERY_BUS.md) - Command Bus & Query Bus 가이드
- [BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md) - 비즈니스 로직 배치 가이드
- [DOMAIN_VS_APPLICATION_LOGIC.md](./DOMAIN_VS_APPLICATION_LOGIC.md) - 도메인/애플리케이션 로직 구분
- [README.md](./README.md) - 프로젝트 전체 개요
