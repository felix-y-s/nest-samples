# Event-Driven Architecture with RxJS 📡

> 도메인 이벤트와 Subject를 활용한 느슨한 결합 아키텍처 구현

## 📚 목차

1. [개념 이해](#개념-이해)
2. [EventEmitter2 vs RxJS Subject](#eventemitter2-vs-rxjs-subject)
3. [기본 구현](#기본-구현)
4. [실전 패턴](#실전-패턴)
5. [실습 과제](#실습-과제)

---

## 🎯 개념 이해

### Event-Driven Architecture (EDA)란?

이벤트를 중심으로 시스템 컴포넌트 간 통신하는 아키텍처 패턴입니다.

```
기존 방식 (강한 결합):
OrderService → InventoryService.reduceStock()
            → PaymentService.process()
            → NotificationService.send()

이벤트 방식 (느슨한 결합):
OrderService → [ORDER_CREATED 이벤트 발행]
                      ↓
        ┌─────────────┼─────────────┐
        ↓             ↓             ↓
InventoryService  PaymentService  NotificationService
(구독 & 처리)     (구독 & 처리)    (구독 & 처리)
```

### 장점

- ✅ **느슨한 결합**: 서비스 간 직접 의존성 제거
- ✅ **확장성**: 새 기능 추가 시 기존 코드 수정 불필요
- ✅ **비동기 처리**: 긴 작업을 백그라운드에서 처리
- ✅ **감사 추적**: 모든 이벤트 로깅으로 시스템 상태 추적
- ✅ **이벤트 소싱**: 이벤트 히스토리 기반 상태 재구성

### 도메인 이벤트

비즈니스 로직에서 발생한 중요한 사건을 나타냅니다.

```typescript
// 주문 도메인 이벤트
OrderCreated       // 주문 생성됨
OrderPaid          // 결제 완료됨
OrderShipped       // 배송 시작됨
OrderDelivered     // 배송 완료됨
OrderCancelled     // 주문 취소됨
```

---

## 🤔 EventEmitter2 vs RxJS Subject

### EventEmitter2 (NestJS 내장)

```typescript
// 발행
this.eventEmitter.emit('order.created', { orderId: 1 });

// 구독
@OnEvent('order.created')
handleOrderCreated(payload: any) {
  console.log('Order created:', payload);
}
```

**특징:**
- ✅ 간단한 사용법
- ✅ 데코레이터 기반 구독
- ❌ 제한적인 변환 기능
- ❌ 에러 처리 제한적

### RxJS Subject

```typescript
// 발행
this.orderEvents$.next({ type: 'ORDER_CREATED', data: { orderId: 1 } });

// 구독
this.orderEvents$.pipe(
  filter(event => event.type === 'ORDER_CREATED'),
  map(event => event.data),
  debounceTime(1000),
  retry(3)
).subscribe(data => {
  console.log('Order created:', data);
});
```

**특징:**
- ✅ 강력한 Operator 체이닝
- ✅ 세밀한 에러 처리
- ✅ 변환/필터링/조합 자유로움
- ❌ 코드가 약간 복잡

### 언제 무엇을 사용할까?

| 시나리오 | 추천 |
|----------|------|
| 간단한 이벤트 처리 | EventEmitter2 |
| 복잡한 변환/필터링 | RxJS Subject |
| 이벤트 조합 필요 | RxJS Subject |
| 재시도/타임아웃 | RxJS Subject |
| 두 가지 혼용 | ✅ 가능 (추천) |

---

## 🚀 기본 구현

### 1. EventEmitter2 설치 및 설정

```bash
npm install @nestjs/event-emitter
```

```typescript
// app.module.ts
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,           // 와일드카드 지원
      delimiter: '.',           // 이벤트 구분자
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
  ],
})
export class AppModule {}
```

### 2. 기본 이벤트 발행 및 구독

```typescript
// events/order.events.ts
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly amount: number,
    public readonly createdAt: Date,
  ) {}
}

// order.service.ts
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class OrderService {
  constructor(private eventEmitter: EventEmitter2) {}

  async createOrder(createOrderDto: CreateOrderDto) {
    // 1. 주문 생성
    const order = await this.orderRepository.save(createOrderDto);

    // 2. 이벤트 발행
    this.eventEmitter.emit(
      'order.created',
      new OrderCreatedEvent(
        order.id,
        order.userId,
        order.amount,
        new Date(),
      ),
    );

    return order;
  }
}

// order.listener.ts
@Injectable()
export class OrderListener {
  @OnEvent('order.created')
  handleOrderCreated(event: OrderCreatedEvent) {
    console.log(`Order created: ${event.orderId}`);
    // 재고 감소, 결제 처리 등
  }

  @OnEvent('order.created', { async: true })
  async handleOrderCreatedAsync(event: OrderCreatedEvent) {
    // 비동기 처리
    await this.notificationService.sendEmail(event.userId);
  }
}
```

### 3. RxJS Subject로 이벤트 버스 구현

```typescript
// events/event-bus.service.ts
import { Injectable } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';

export interface DomainEvent {
  type: string;
  payload: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class EventBusService {
  private eventStream$ = new Subject<DomainEvent>();

  // 이벤트 발행
  publish(type: string, payload: any, metadata?: Record<string, any>) {
    this.eventStream$.next({
      type,
      payload,
      timestamp: new Date(),
      metadata,
    });
  }

  // 특정 타입 이벤트 구독
  on(eventType: string): Observable<DomainEvent> {
    return this.eventStream$.pipe(
      filter((event) => event.type === eventType)
    );
  }

  // 여러 타입 이벤트 구독
  onAny(eventTypes: string[]): Observable<DomainEvent> {
    return this.eventStream$.pipe(
      filter((event) => eventTypes.includes(event.type))
    );
  }

  // 모든 이벤트 구독
  onAll(): Observable<DomainEvent> {
    return this.eventStream$.asObservable();
  }
}

// 사용 예시
@Injectable()
export class OrderService {
  constructor(private eventBus: EventBusService) {}

  async createOrder(dto: CreateOrderDto) {
    const order = await this.orderRepository.save(dto);

    // 이벤트 발행
    this.eventBus.publish('ORDER_CREATED', order, {
      source: 'OrderService',
      userId: dto.userId,
    });

    return order;
  }
}

@Injectable()
export class InventoryService implements OnModuleInit {
  constructor(private eventBus: EventBusService) {}

  onModuleInit() {
    // 이벤트 구독
    this.eventBus.on('ORDER_CREATED').subscribe((event) => {
      console.log('Reducing inventory for order:', event.payload.id);
      this.reduceStock(event.payload.items);
    });
  }

  private async reduceStock(items: any[]) {
    // 재고 감소 로직
  }
}
```

---

## 💡 실전 패턴

### Pattern 1: 이벤트 체이닝 (Saga 패턴)

```typescript
// 주문 생성 → 결제 → 재고 확인 → 배송 준비
@Injectable()
export class OrderSagaService implements OnModuleInit {
  constructor(
    private eventBus: EventBusService,
    private paymentService: PaymentService,
    private inventoryService: InventoryService,
    private shippingService: ShippingService,
  ) {}

  onModuleInit() {
    // 1. 주문 생성 → 결제 시도
    this.eventBus.on('ORDER_CREATED')
      .pipe(
        switchMap(async (event) => {
          try {
            const payment = await this.paymentService.process(event.payload);
            this.eventBus.publish('PAYMENT_COMPLETED', payment);
            return payment;
          } catch (error) {
            this.eventBus.publish('PAYMENT_FAILED', {
              orderId: event.payload.id,
              error: error.message,
            });
            throw error;
          }
        }),
        retry(3),
        catchError((error) => {
          console.error('Payment failed after retries:', error);
          return EMPTY;
        })
      )
      .subscribe();

    // 2. 결제 완료 → 재고 확인
    this.eventBus.on('PAYMENT_COMPLETED')
      .pipe(
        switchMap(async (event) => {
          const hasStock = await this.inventoryService.checkStock(
            event.payload.items
          );
          if (hasStock) {
            this.eventBus.publish('STOCK_CONFIRMED', event.payload);
          } else {
            this.eventBus.publish('STOCK_INSUFFICIENT', event.payload);
          }
        })
      )
      .subscribe();

    // 3. 재고 확인 → 배송 준비
    this.eventBus.on('STOCK_CONFIRMED')
      .pipe(
        switchMap(async (event) => {
          await this.shippingService.prepareShipment(event.payload);
          this.eventBus.publish('SHIPMENT_PREPARED', event.payload);
        })
      )
      .subscribe();

    // 4. 보상 트랜잭션 (재고 부족 시 환불)
    this.eventBus.on('STOCK_INSUFFICIENT')
      .pipe(
        tap((event) => {
          console.log('Refunding payment due to insufficient stock');
          this.paymentService.refund(event.payload.paymentId);
          this.eventBus.publish('ORDER_CANCELLED', event.payload);
        })
      )
      .subscribe();
  }
}
```

**학습 포인트:**
- `switchMap`: 순차적 비동기 작업
- 이벤트 체이닝으로 복잡한 워크플로우 구현
- 보상 트랜잭션 (Compensation Transaction)

### Pattern 2: 이벤트 조합 (combineLatest)

```typescript
// 사용자 정보 + 주문 정보 + 배송 정보 모두 준비되면 알림 발송
@Injectable()
export class NotificationOrchestratorService implements OnModuleInit {
  constructor(
    private eventBus: EventBusService,
    private notificationService: NotificationService,
  ) {}

  onModuleInit() {
    const userUpdates$ = this.eventBus.on('USER_UPDATED');
    const orderUpdates$ = this.eventBus.on('ORDER_UPDATED');
    const shippingUpdates$ = this.eventBus.on('SHIPPING_UPDATED');

    // 3가지 이벤트 중 하나라도 발생하면 알림 발송
    combineLatest([userUpdates$, orderUpdates$, shippingUpdates$])
      .pipe(
        debounceTime(1000), // 1초 내 여러 이벤트 발생 시 한 번만 처리
        map(([userEvent, orderEvent, shippingEvent]) => ({
          user: userEvent.payload,
          order: orderEvent.payload,
          shipping: shippingEvent.payload,
        })),
        tap((data) => {
          console.log('All data ready, sending notification:', data);
        })
      )
      .subscribe((data) => {
        this.notificationService.sendComprehensiveUpdate(data);
      });
  }
}
```

**학습 포인트:**
- `combineLatest`: 여러 스트림의 최신 값 조합
- `debounceTime`: 연속 이벤트 제한
- 복잡한 비즈니스 조건 처리

### Pattern 3: 이벤트 필터링 및 라우팅

```typescript
@Injectable()
export class EventRouterService implements OnModuleInit {
  constructor(
    private eventBus: EventBusService,
    private emailService: EmailService,
    private smsService: SmsService,
    private pushService: PushService,
  ) {}

  onModuleInit() {
    // 모든 알림 이벤트 구독
    this.eventBus.onAll()
      .pipe(
        filter((event) => event.type.startsWith('NOTIFICATION_')),
        tap((event) => console.log('Routing notification:', event.type))
      )
      .subscribe((event) => {
        this.routeNotification(event);
      });
  }

  private routeNotification(event: DomainEvent) {
    const { type, payload } = event;

    switch (type) {
      case 'NOTIFICATION_EMAIL':
        this.emailService.send(payload);
        break;
      case 'NOTIFICATION_SMS':
        this.smsService.send(payload);
        break;
      case 'NOTIFICATION_PUSH':
        this.pushService.send(payload);
        break;
      case 'NOTIFICATION_ALL':
        // 모든 채널로 발송
        this.emailService.send(payload);
        this.smsService.send(payload);
        this.pushService.send(payload);
        break;
    }
  }
}
```

**학습 포인트:**
- 이벤트 타입 기반 라우팅
- `filter`: 특정 패턴 이벤트만 처리
- 단일 진입점에서 여러 핸들러로 분산

### Pattern 4: 이벤트 리플레이 (ReplaySubject)

```typescript
@Injectable()
export class EventHistoryService {
  // 최근 100개 이벤트 저장
  private eventHistory$ = new ReplaySubject<DomainEvent>(100);

  constructor(private eventBus: EventBusService) {
    // 모든 이벤트를 히스토리에 저장
    this.eventBus.onAll().subscribe((event) => {
      this.eventHistory$.next(event);
    });
  }

  // 최근 이벤트 조회
  getRecentEvents(count: number): Observable<DomainEvent[]> {
    return this.eventHistory$.pipe(
      take(count),
      toArray()
    );
  }

  // 특정 타입 이벤트 히스토리
  getEventHistory(eventType: string): Observable<DomainEvent> {
    return this.eventHistory$.pipe(
      filter((event) => event.type === eventType)
    );
  }

  // 특정 엔티티의 이벤트 히스토리
  getEntityHistory(entityId: string): Observable<DomainEvent[]> {
    return this.eventHistory$.pipe(
      filter((event) => event.payload?.id === entityId),
      toArray()
    );
  }
}

// 사용 예시: 주문 상태 재구성
@Injectable()
export class OrderQueryService {
  constructor(private eventHistory: EventHistoryService) {}

  async reconstructOrderState(orderId: string) {
    const events = await firstValueFrom(
      this.eventHistory.getEntityHistory(orderId)
    );

    let orderState = { id: orderId, status: 'PENDING' };

    events.forEach((event) => {
      switch (event.type) {
        case 'ORDER_CREATED':
          orderState = { ...orderState, ...event.payload };
          break;
        case 'ORDER_PAID':
          orderState.status = 'PAID';
          break;
        case 'ORDER_SHIPPED':
          orderState.status = 'SHIPPED';
          break;
        case 'ORDER_DELIVERED':
          orderState.status = 'DELIVERED';
          break;
      }
    });

    return orderState;
  }
}
```

**학습 포인트:**
- `ReplaySubject`: 이벤트 히스토리 저장
- 이벤트 소싱 패턴 기초
- 상태 재구성 (Event Sourcing)

### Pattern 5: 에러 처리 및 Dead Letter Queue

```typescript
@Injectable()
export class ResilientEventHandlerService implements OnModuleInit {
  private deadLetterQueue$ = new Subject<DomainEvent>();

  constructor(private eventBus: EventBusService) {}

  onModuleInit() {
    // 일반 이벤트 처리
    this.eventBus.on('ORDER_CREATED')
      .pipe(
        tap((event) => console.log('Processing order:', event.payload.id)),
        switchMap((event) => this.processOrder(event)),
        retry({
          count: 3,
          delay: (error, retryCount) => {
            console.log(`Retry ${retryCount} after error:`, error.message);
            return timer(1000 * retryCount); // 지수 백오프
          },
        }),
        catchError((error, caught) => {
          console.error('Failed after retries, sending to DLQ:', error);
          // Dead Letter Queue로 전송
          this.deadLetterQueue$.next(error.event);
          return EMPTY;
        })
      )
      .subscribe();

    // Dead Letter Queue 처리
    this.deadLetterQueue$
      .pipe(
        debounceTime(5000), // 5초마다 배치 처리
        tap((event) => {
          console.log('Processing failed event from DLQ:', event);
          // 1. 에러 로깅
          // 2. 관리자 알림
          // 3. 수동 처리 대기열에 추가
        })
      )
      .subscribe();
  }

  private async processOrder(event: DomainEvent): Promise<void> {
    // 주문 처리 로직 (실패 가능)
    if (Math.random() > 0.7) {
      throw new Error('Processing failed');
    }
    console.log('Order processed successfully');
  }
}
```

**학습 포인트:**
- `retry`: 재시도 로직
- Dead Letter Queue 패턴
- 실패한 이벤트 별도 관리

### Pattern 6: 이벤트 버스와 EventEmitter2 통합

```typescript
@Injectable()
export class HybridEventService implements OnModuleInit {
  constructor(
    private eventEmitter: EventEmitter2,
    private eventBus: EventBusService,
  ) {}

  onModuleInit() {
    // EventEmitter2 이벤트를 RxJS 이벤트 버스로 브릿지
    this.eventEmitter.on('**', (payload) => {
      // 와일드카드로 모든 이벤트 캡처
      const eventName = this.eventEmitter.eventNames()[0];
      this.eventBus.publish(eventName as string, payload);
    });

    // RxJS 이벤트 버스의 특정 이벤트를 EventEmitter2로 브릿지
    this.eventBus.onAll()
      .pipe(
        filter((event) => event.metadata?.emitToLegacy === true)
      )
      .subscribe((event) => {
        this.eventEmitter.emit(event.type, event.payload);
      });
  }
}

// 사용 예시
@Injectable()
export class OrderService {
  constructor(
    private eventEmitter: EventEmitter2,
    private eventBus: EventBusService,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    const order = await this.orderRepository.save(dto);

    // EventEmitter2로 발행
    this.eventEmitter.emit('order.created', order);

    // RxJS로도 발행 (복잡한 처리 필요 시)
    this.eventBus.publish('ORDER_CREATED', order);

    return order;
  }
}
```

---

## 📝 실습 과제

### 과제 1: 기본 이벤트 시스템 ⭐

**요구사항:**
- EventEmitter2 설치 및 설정
- OrderCreatedEvent 클래스 생성
- 이벤트 발행 및 구독 구현
- 3개 리스너 작성 (재고, 결제, 알림)

**체크리스트:**
- [ ] EventEmitterModule 설정
- [ ] 이벤트 클래스 정의
- [ ] OrderService에서 이벤트 발행
- [ ] @OnEvent 데코레이터로 리스너 구현
- [ ] 로깅으로 동작 확인

### 과제 2: RxJS 이벤트 버스 ⭐⭐

**요구사항:**
- EventBusService 구현 (Subject 기반)
- publish(), on(), onAll() 메서드
- 타입 안전성 추가 (제네릭)
- 여러 서비스에서 구독

**체크리스트:**
- [ ] EventBusService 생성
- [ ] DomainEvent 인터페이스 정의
- [ ] publish/subscribe 메서드 구현
- [ ] 타입별 필터링 테스트
- [ ] 3개 이상 서비스에서 사용

### 과제 3: Saga 패턴 구현 ⭐⭐⭐

**요구사항:**
- 주문 → 결제 → 재고 → 배송 워크플로우
- 각 단계별 이벤트 발행
- 실패 시 보상 트랜잭션
- switchMap으로 순차 처리

**체크리스트:**
- [ ] OrderSagaService 구현
- [ ] 4단계 이벤트 체이닝
- [ ] 각 단계별 에러 처리
- [ ] 보상 트랜잭션 구현 (환불)
- [ ] 전체 플로우 테스트

### 과제 4: 이벤트 히스토리 ⭐⭐⭐

**요구사항:**
- ReplaySubject로 이벤트 저장
- 최근 100개 이벤트 유지
- 엔티티별 이벤트 조회
- 상태 재구성 기능

**체크리스트:**
- [ ] EventHistoryService 구현
- [ ] ReplaySubject(100) 생성
- [ ] 이벤트 저장 로직
- [ ] 조회 API 구현
- [ ] 주문 상태 재구성 예제

### 과제 5: Dead Letter Queue ⭐⭐⭐

**요구사항:**
- 재시도 로직 (3번, 지수 백오프)
- 실패한 이벤트를 DLQ로 전송
- DLQ 모니터링 및 알림
- 수동 재처리 기능

**체크리스트:**
- [ ] retry 로직 구현
- [ ] Dead Letter Queue Subject 생성
- [ ] 실패 이벤트 저장
- [ ] 관리자 알림 연동
- [ ] 재처리 API 구현

### 과제 6: 종합 프로젝트 - E-Commerce Event System ⭐⭐⭐⭐

**시나리오:** 완전한 이벤트 기반 이커머스 시스템

**요구사항:**
1. 주문 Saga (생성 → 결제 → 재고 → 배송)
2. 실시간 알림 (이메일, SMS, 푸시)
3. 이벤트 히스토리 (감사 추적)
4. 에러 처리 및 DLQ
5. 이벤트 모니터링 대시보드
6. EventEmitter2 + RxJS 혼용

**체크리스트:**
- [ ] 10개 이상의 도메인 이벤트 정의
- [ ] Saga 패턴 구현
- [ ] 이벤트 라우터 구현
- [ ] 히스토리 및 감사 로그
- [ ] DLQ 및 모니터링
- [ ] E2E 테스트 작성

---

## 🧪 테스트 예제

### 이벤트 버스 테스트

```typescript
describe('EventBusService', () => {
  let eventBus: EventBusService;

  beforeEach(() => {
    eventBus = new EventBusService();
  });

  it('이벤트 발행 및 구독', (done) => {
    eventBus.on('TEST_EVENT').subscribe((event) => {
      expect(event.type).toBe('TEST_EVENT');
      expect(event.payload).toEqual({ data: 'test' });
      done();
    });

    eventBus.publish('TEST_EVENT', { data: 'test' });
  });

  it('여러 구독자에게 브로드캐스트', () => {
    const received1: DomainEvent[] = [];
    const received2: DomainEvent[] = [];

    eventBus.on('TEST_EVENT').subscribe((event) => received1.push(event));
    eventBus.on('TEST_EVENT').subscribe((event) => received2.push(event));

    eventBus.publish('TEST_EVENT', { data: 'test' });

    expect(received1.length).toBe(1);
    expect(received2.length).toBe(1);
  });
});
```

---

## 📊 아키텍처 패턴

### 1. Event Sourcing

```typescript
// 모든 상태 변경을 이벤트로 저장
const orderEvents = [
  { type: 'ORDER_CREATED', data: { id: 1, items: [...] } },
  { type: 'ORDER_PAID', data: { id: 1, amount: 100 } },
  { type: 'ORDER_SHIPPED', data: { id: 1, trackingNumber: 'ABC' } },
];

// 이벤트로부터 현재 상태 재구성
const currentState = orderEvents.reduce((state, event) => {
  switch (event.type) {
    case 'ORDER_CREATED': return { ...state, ...event.data };
    case 'ORDER_PAID': return { ...state, status: 'PAID' };
    case 'ORDER_SHIPPED': return { ...state, status: 'SHIPPED' };
    default: return state;
  }
}, {});
```

### 2. CQRS (Command Query Responsibility Segregation)

```typescript
// Command: 상태 변경 (쓰기)
@Injectable()
export class OrderCommandService {
  constructor(private eventBus: EventBusService) {}

  async createOrder(dto: CreateOrderDto) {
    const order = await this.orderRepository.save(dto);
    this.eventBus.publish('ORDER_CREATED', order);
    return order;
  }
}

// Query: 상태 조회 (읽기)
@Injectable()
export class OrderQueryService {
  async getOrder(id: string) {
    return await this.orderReadModel.findById(id);
  }

  async getOrderHistory(id: string) {
    return await this.eventHistory.getEntityHistory(id);
  }
}
```

---

## 🎓 학습 정리

### 핵심 Operator

| Operator | 용도 | 예제 |
|----------|------|------|
| `filter` | 이벤트 필터링 | `filter(e => e.type === 'ORDER')` |
| `switchMap` | 순차 처리 | `switchMap(e => processOrder(e))` |
| `combineLatest` | 여러 스트림 조합 | `combineLatest([user$, order$])` |
| `merge` | 스트림 합치기 | `merge(event1$, event2$)` |
| `debounceTime` | 연속 이벤트 제한 | `debounceTime(1000)` |
| `retry` | 재시도 | `retry(3)` |
| `catchError` | 에러 처리 | `catchError(() => EMPTY)` |

### 다음 단계

✅ Event-Driven Architecture 완료 후:
- **[05-data-pipeline.md](./05-data-pipeline.md)** - Data Pipeline Processing
- 복잡한 데이터 조합 및 변환 패턴 학습

---

**축하합니다! 🎉**

> 이벤트 기반 아키텍처는 확장 가능한 시스템의 핵심입니다!
> 느슨한 결합과 높은 확장성을 동시에 달성할 수 있습니다!
