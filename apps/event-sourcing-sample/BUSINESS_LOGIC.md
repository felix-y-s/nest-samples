# 비즈니스 로직 배치 가이드

이벤트 소싱/CQRS 패턴에서 비즈니스 로직을 **어디에 배치해야 하는지** 명확하게 설명합니다.

## 📚 목차

1. [비즈니스 로직의 두 가지 종류](#비즈니스-로직의-두-가지-종류)
2. [Command vs Aggregate 차이](#command-vs-aggregate-차이)
3. [외부 시스템 연동: Event Handler](#외부-시스템-연동-event-handler)
4. [실전 예시: 재고 감소](#실전-예시-재고-감소)
5. [왜 분리하나요?](#왜-분리하나요)
6. [비즈니스 로직 배치 원칙](#비즈니스-로직-배치-원칙)

---

## 비즈니스 로직의 두 가지 종류

비즈니스 로직을 **역할에 따라** 구분해야 합니다:

### 1. 도메인 로직 (Aggregate 내부)

**주문 자체의 규칙** - 주문 Aggregate가 책임짐

```typescript
// order.aggregate.ts
export class OrderAggregate extends AggregateRoot {
  processPayment(userBalance: number) {
    // ✅ 도메인 로직: 주문의 비즈니스 규칙
    if (this.status !== OrderStatus.CREATED) {
      throw new Error('주문 생성 상태에서만 결제를 시도할 수 있습니다');
    }

    // 할인율 검증 (주문 도메인의 규칙)
    if (this.discountRate > 50) {
      this.apply(
        new PaymentFailedEvent(
          this.orderId,
          this.userId,
          this.finalAmount,
          PaymentFailureReason.INVALID_DISCOUNT_RATE,
          `할인율이 최대 허용치(50%)를 초과했습니다`,
          new Date(),
        ),
      );
      return;
    }

    // 잔액 검증 (결제 도메인의 규칙)
    if (userBalance < this.finalAmount) {
      this.apply(
        new PaymentFailedEvent(
          this.orderId,
          this.userId,
          this.finalAmount,
          PaymentFailureReason.INSUFFICIENT_BALANCE,
          `잔액이 부족합니다`,
          new Date(),
        ),
      );
      return;
    }

    // 결제 성공
    this.apply(new PaymentSucceededEvent(...));
    this.apply(new OrderCompletedEvent(...));
  }
}
```

**특징**:
- 주문 자체의 상태와 규칙만 다룸
- 외부 시스템에 의존하지 않음
- 순수한 도메인 로직

### 2. 애플리케이션 로직 (Event Handler)

**다른 시스템과의 연동** - Event Handler가 책임짐

```typescript
// product/handlers/product-stock.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { OrderCompletedEvent } from '../../order/events';

/**
 * 주문 완료 이벤트를 구독하여 상품 재고를 감소시키는 핸들러
 */
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly productRepository: ProductRepository) {}

  async handle(event: OrderCompletedEvent) {
    // ✅ 애플리케이션 로직: 재고 감소
    await this.productRepository.decreaseStock(
      event.productId,
      event.quantity
    );

    console.log(`[재고 감소] 상품 ${event.productId}: -${event.quantity}`);
  }
}

// notification/handlers/email-notification.handler.ts
@EventsHandler(OrderCompletedEvent)
export class EmailNotificationHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly emailService: EmailService) {}

  async handle(event: OrderCompletedEvent) {
    // ✅ 애플리케이션 로직: 이메일 발송
    await this.emailService.sendOrderConfirmation(
      event.userId,
      event.orderId,
      event.amount,
    );

    console.log(`[이메일 발송] 사용자 ${event.userId}`);
  }
}

// point/handlers/point-reward.handler.ts
@EventsHandler(OrderCompletedEvent)
export class PointRewardHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly pointService: PointService) {}

  async handle(event: OrderCompletedEvent) {
    // ✅ 애플리케이션 로직: 포인트 적립 (주문 금액의 1%)
    const points = Math.floor(event.amount * 0.01);
    await this.pointService.addPoints(event.userId, points);

    console.log(`[포인트 적립] 사용자 ${event.userId}: +${points}P`);
  }
}
```

**특징**:
- 다른 도메인/시스템 업데이트
- 외부 서비스 호출 (이메일, SMS, 알림 등)
- 이벤트 기반 느슨한 결합

---

## Command vs Aggregate 차이

README에서 둘 다 "비즈니스 로직"이라고 했지만, **역할이 다릅니다**:

### Command: 입력 검증 (간단한 규칙)

```typescript
// commands/create-order.command.ts
import { IsNotEmpty, IsNumber, Min, Max } from 'class-validator';

export class CreateOrderCommand {
  @IsNotEmpty()
  userId: string;

  @IsNotEmpty()
  productId: string;

  @IsNotEmpty()
  productName: string;

  @IsNumber()
  @Min(1)
  quantity: number;        // ← DTO 레벨 검증: 숫자인가? 1 이상인가?

  @IsNumber()
  @Min(0)
  price: number;           // ← DTO 레벨 검증: 숫자인가? 0 이상인가?

  @IsNumber()
  @Min(0)
  @Max(100)
  discountRate: number;    // ← DTO 레벨 검증: 0-100 범위인가?
}
```

**Command의 역할**:
- 형식 검증 (타입, 필수값)
- 간단한 범위 검증
- **비즈니스 의미 없는 기본 검증**

### Aggregate: 도메인 규칙 (핵심 비즈니스 로직)

```typescript
// aggregates/order.aggregate.ts
export class OrderAggregate extends AggregateRoot {
  createOrder(
    userId: string,
    productId: string,
    productName: string,
    quantity: number,
    price: number,
    discountRate: number,
  ) {
    // ✅ 도메인 규칙: 비즈니스 의미가 있는 검증
    if (quantity <= 0) {
      throw new Error('수량은 0보다 커야 합니다');
    }

    if (price <= 0) {
      throw new Error('가격은 0보다 커야 합니다');
    }

    if (discountRate < 0 || discountRate > 100) {
      throw new Error('할인율은 0-100 사이여야 합니다');
    }

    // ✅ 비즈니스 로직 실행
    this.apply(
      new OrderCreatedEvent(
        this.orderId,
        userId,
        productId,
        productName,
        quantity,
        price,
        discountRate,
        new Date(),
      ),
    );
  }

  processPayment(userBalance: number) {
    // ✅ 도메인 규칙: 주문 상태에 따른 결제 가능 여부
    if (this.status !== OrderStatus.CREATED) {
      throw new Error('주문 생성 상태에서만 결제를 시도할 수 있습니다');
    }

    // ✅ 도메인 규칙: 할인율 최대 허용치
    const MAX_DISCOUNT_RATE = 50;
    if (this.discountRate > MAX_DISCOUNT_RATE) {
      this.apply(
        new PaymentFailedEvent(
          this.orderId,
          this.userId,
          this.finalAmount,
          PaymentFailureReason.INVALID_DISCOUNT_RATE,
          `할인율이 최대 허용치(${MAX_DISCOUNT_RATE}%)를 초과했습니다`,
          new Date(),
        ),
      );
      return;
    }

    // ✅ 도메인 규칙: 잔액 검증
    if (userBalance < this.finalAmount) {
      this.apply(
        new PaymentFailedEvent(
          this.orderId,
          this.userId,
          this.finalAmount,
          PaymentFailureReason.INSUFFICIENT_BALANCE,
          `잔액이 부족합니다`,
          new Date(),
        ),
      );
      return;
    }

    // 결제 성공
    this.apply(new PaymentSucceededEvent(...));
    this.apply(new OrderCompletedEvent(...));
  }
}
```

**Aggregate의 역할**:
- 도메인 규칙 적용
- 비즈니스 의미가 있는 검증
- **주문의 핵심 로직**

---

## 외부 시스템 연동: Event Handler

Aggregate는 **자신의 도메인 규칙만** 다룹니다. 다른 시스템 업데이트는 **Event Handler**가 책임집니다.

### 전체 흐름: 결제 완료 시 재고 감소

```
1. Controller → Command 실행
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST /orders/:orderId/payment
  ↓
CommandBus.execute(ProcessPaymentCommand)

2. Aggregate → 결제 처리 (도메인 로직)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ProcessPaymentHandler
  ↓
order.processPayment(userBalance)
  ↓
  ├─ 상태 검증 (CREATED 상태인가?)
  ├─ 할인율 검증 (50% 이하인가?)
  ├─ 잔액 검증 (충분한가?)
  ↓
this.apply(new PaymentSucceededEvent(...))
this.apply(new OrderCompletedEvent(...)) ← 이벤트 발행
  ↓
order.commit()

3. EventBus → 이벤트 전파
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EventBus.publish(OrderCompletedEvent)
  ↓
  ├─→ EventStoreService.saveEvent()        // 이벤트 저장
  │
  ├─→ ProductStockHandler.handle()         // ← 재고 감소!
  │   └─→ productRepository.decreaseStock()
  │       └─→ UPDATE products SET stock = stock - 1
  │
  ├─→ EmailNotificationHandler.handle()    // ← 이메일 발송!
  │   └─→ emailService.sendConfirmation()
  │
  └─→ PointRewardHandler.handle()          // ← 포인트 적립!
      └─→ pointService.addPoints()
```

**핵심**:
- Aggregate는 **이벤트만 발행**
- Event Handler가 **실제 외부 작업 수행**
- 느슨한 결합으로 확장성 확보

---

## 실전 예시: 재고 감소

### ❌ 나쁜 예: Aggregate에 모든 로직

```typescript
// ❌ 나쁜 예: 강한 결합, 테스트 어려움
export class OrderAggregate extends AggregateRoot {
  constructor(
    orderId: string,
    // ❌ 외부 의존성 주입 - Aggregate가 무거워짐
    private readonly productRepository: ProductRepository,
    private readonly emailService: EmailService,
    private readonly pointService: PointService,
  ) {
    super();
    this.orderId = orderId;
  }

  async processPayment(userBalance: number) {
    // 도메인 로직
    if (this.discountRate > 50) {
      throw new Error('할인율 초과');
    }

    // ❌ 문제 1: 외부 시스템 직접 호출 - 강한 결합
    await this.productRepository.decreaseStock(
      this.productId,
      this.quantity,
    );

    // ❌ 문제 2: 재고 감소 실패 시 전체 트랜잭션 실패
    // ❌ 문제 3: 이메일 발송 실패 시에도 전체 실패
    await this.emailService.sendConfirmation(this.userId);

    // ❌ 문제 4: 포인트 서비스 장애 시에도 전체 실패
    await this.pointService.addPoints(this.userId, this.finalAmount * 0.01);

    this.apply(new OrderCompletedEvent(...));
  }
}
```

**문제점**:
1. **강한 결합**: Aggregate가 여러 시스템에 의존
2. **트랜잭션 범위 과다**: 하나 실패 시 전체 실패
3. **테스트 어려움**: 모든 외부 시스템 Mock 필요
4. **확장 어려움**: 새 기능 추가 시 Aggregate 수정 필요

### ✅ 좋은 예: 관심사 분리

```typescript
// ✅ 좋은 예: 도메인 로직만 담당
export class OrderAggregate extends AggregateRoot {
  processPayment(userBalance: number) {
    // ✅ 도메인 로직만
    if (this.discountRate > 50) {
      this.apply(new PaymentFailedEvent(..., INVALID_DISCOUNT_RATE));
      return;
    }

    if (userBalance < this.finalAmount) {
      this.apply(new PaymentFailedEvent(..., INSUFFICIENT_BALANCE));
      return;
    }

    // ✅ 이벤트만 발행 (외부 시스템 호출 없음)
    this.apply(new PaymentSucceededEvent(...));
    this.apply(new OrderCompletedEvent(...));
  }
}

// ✅ 각 관심사별 Event Handler

// 재고 감소 전담
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly productRepository: ProductRepository) {}

  async handle(event: OrderCompletedEvent) {
    // ✅ 재고 감소만 책임
    try {
      await this.productRepository.decreaseStock(
        event.productId,
        event.quantity,
      );
      console.log(`[재고 감소] 상품 ${event.productId}: -${event.quantity}`);
    } catch (error) {
      // ✅ 실패해도 다른 Handler에 영향 없음
      console.error('[재고 감소 실패]', error);
      // 보상 트랜잭션 발행 가능
      // this.eventBus.publish(new StockDecreaseFailed(...));
    }
  }
}

// 이메일 발송 전담
@EventsHandler(OrderCompletedEvent)
export class EmailNotificationHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly emailService: EmailService) {}

  async handle(event: OrderCompletedEvent) {
    // ✅ 이메일 발송만 책임
    try {
      await this.emailService.sendOrderConfirmation(
        event.userId,
        event.orderId,
        event.amount,
      );
      console.log(`[이메일 발송] 사용자 ${event.userId}`);
    } catch (error) {
      // ✅ 실패해도 주문은 완료됨 (재시도 가능)
      console.error('[이메일 발송 실패]', error);
      // 재시도 큐에 추가 가능
    }
  }
}

// 포인트 적립 전담
@EventsHandler(OrderCompletedEvent)
export class PointRewardHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly pointService: PointService) {}

  async handle(event: OrderCompletedEvent) {
    // ✅ 포인트 적립만 책임 (주문 금액의 1%)
    try {
      const points = Math.floor(event.amount * 0.01);
      await this.pointService.addPoints(event.userId, points);
      console.log(`[포인트 적립] 사용자 ${event.userId}: +${points}P`);
    } catch (error) {
      // ✅ 실패해도 주문과 재고 감소는 성공
      console.error('[포인트 적립 실패]', error);
    }
  }
}
```

**장점**:
1. **느슨한 결합**: 각 Handler가 독립적
2. **부분 실패 허용**: 이메일 실패해도 주문은 완료
3. **테스트 용이**: 각 Handler를 독립적으로 테스트
4. **확장 용이**: 새 Handler 추가만 하면 됨 (쿠폰, SMS 등)

---

## 왜 분리하나요?

### 단일 책임 원칙 (SRP)

```typescript
// ❌ 하나의 클래스가 모든 것을 담당
class OrderAggregate {
  processPayment() {
    // 주문 로직
    // 재고 로직
    // 이메일 로직
    // 포인트 로직
    // ... 너무 많은 책임!
  }
}

// ✅ 각자의 책임만 담당
class OrderAggregate {
  processPayment() {
    // 주문 로직만
  }
}

class ProductStockHandler {
  handle() {
    // 재고 로직만
  }
}

class EmailNotificationHandler {
  handle() {
    // 이메일 로직만
  }
}
```

### 변경의 영향 최소화

```typescript
// ❌ 이메일 서비스 변경 → OrderAggregate 수정 필요
class OrderAggregate {
  async processPayment() {
    // ...
    await this.emailService.send(...); // ← 여기 수정해야 함
  }
}

// ✅ 이메일 서비스 변경 → EmailNotificationHandler만 수정
@EventsHandler(OrderCompletedEvent)
class EmailNotificationHandler {
  async handle(event: OrderCompletedEvent) {
    // ← 여기만 수정하면 됨!
    await this.newEmailService.sendAsync(...);
  }
}
```

### 확장성

```typescript
// ❌ 새 기능 추가 → OrderAggregate 수정 필요
class OrderAggregate {
  async processPayment() {
    // 기존 로직...

    // 새로운 기능 추가하려면 여기 수정!
    await this.smsService.send(...);
    await this.slackService.notify(...);
  }
}

// ✅ 새 기능 추가 → Handler만 추가
@EventsHandler(OrderCompletedEvent)
class SmsNotificationHandler {
  async handle(event: OrderCompletedEvent) {
    await this.smsService.send(...);
  }
}

@EventsHandler(OrderCompletedEvent)
class SlackNotificationHandler {
  async handle(event: OrderCompletedEvent) {
    await this.slackService.notify(...);
  }
}
```

### 테스트 용이성

```typescript
// ❌ 모든 외부 시스템 Mock 필요
describe('OrderAggregate', () => {
  it('processPayment', async () => {
    const productRepo = mock(ProductRepository);
    const emailService = mock(EmailService);
    const pointService = mock(PointService);
    const smsService = mock(SmsService);
    // ... 너무 많은 Mock!

    const order = new OrderAggregate(
      'order-1',
      productRepo,
      emailService,
      pointService,
      smsService,
    );

    await order.processPayment(1000000);

    // 모든 서비스 호출 검증...
  });
});

// ✅ 각 Handler를 독립적으로 테스트
describe('OrderAggregate', () => {
  it('processPayment - 도메인 로직만 테스트', () => {
    const order = new OrderAggregate('order-1'); // Mock 불필요!

    order.processPayment(1000000);

    // 이벤트 발행만 검증
    expect(order.getUncommittedEvents()).toContainEqual(
      expect.objectContaining({
        constructor: { name: 'OrderCompletedEvent' }
      }),
    );
  });
});

describe('ProductStockHandler', () => {
  it('재고 감소만 테스트', async () => {
    const productRepo = mock(ProductRepository);
    const handler = new ProductStockHandler(productRepo);

    await handler.handle(new OrderCompletedEvent(...));

    expect(productRepo.decreaseStock).toHaveBeenCalledWith('prod-1', 2);
  });
});
```

---

## 비즈니스 로직 배치 원칙

### 📋 빠른 참고 테이블

| 로직 유형 | 위치 | 책임 | 예시 |
|----------|------|------|------|
| **입력 검증** | Command/DTO | 형식, 필수값, 타입 체크 | `@IsNotEmpty()`, `@IsNumber()`, `@Min(0)` |
| **도메인 규칙** | Aggregate | 주문 자체의 비즈니스 규칙 | 할인율 검증, 결제 가능 상태 확인, 주문 취소 가능 여부 |
| **외부 연동** | Event Handler | 다른 도메인/시스템 업데이트 | 재고 감소, 이메일 발송, 포인트 적립, SMS 발송 |

### 🎯 판단 기준

질문에 답하면서 배치 위치를 결정하세요:

#### "이 검증이 실패하면 요청 자체가 잘못된 건가요?"
- **Yes** → Command/DTO 검증
- **No** → Aggregate 도메인 규칙

예시:
```typescript
// ✅ Command: quantity가 문자열이면 요청 자체가 잘못됨
@IsNumber()
quantity: number;

// ✅ Aggregate: quantity가 0이면 비즈니스 규칙 위반
if (quantity <= 0) throw new Error('수량은 0보다 커야 합니다');
```

#### "이 로직이 주문 자체의 규칙인가요?"
- **Yes** → Aggregate 도메인 로직
- **No** → Event Handler 애플리케이션 로직

예시:
```typescript
// ✅ Aggregate: 할인율은 주문의 규칙
if (this.discountRate > 50) {
  this.apply(new PaymentFailedEvent(...));
}

// ✅ Event Handler: 재고는 상품의 규칙
@EventsHandler(OrderCompletedEvent)
class ProductStockHandler {
  async handle(event) {
    await this.productRepository.decreaseStock(...);
  }
}
```

#### "이 작업이 실패해도 주문은 성공한 건가요?"
- **Yes** → Event Handler (느슨한 결합)
- **No** → Aggregate (강한 일관성)

예시:
```typescript
// ✅ Aggregate: 잔액 부족이면 주문 실패
if (userBalance < this.finalAmount) {
  this.apply(new PaymentFailedEvent(...));
  return; // 주문 실패
}

// ✅ Event Handler: 이메일 실패해도 주문은 성공
@EventsHandler(OrderCompletedEvent)
class EmailNotificationHandler {
  async handle(event) {
    try {
      await this.emailService.send(...);
    } catch (error) {
      console.error('이메일 실패 - 주문은 성공');
      // 재시도 큐에 추가 가능
    }
  }
}
```

### 🚀 실전 가이드

```typescript
// 1단계: 요청 받기
@Post('/orders')
async createOrder(@Body() dto: CreateOrderDto) {
  // ✅ DTO 검증 (자동)
  // - @IsNotEmpty(), @IsNumber() 등
  // - 형식, 필수값, 타입 체크

  const command = new CreateOrderCommand(...dto);
  await this.commandBus.execute(command);
}

// 2단계: 도메인 로직 실행
@CommandHandler(CreateOrderCommand)
class CreateOrderHandler {
  execute(command: CreateOrderCommand) {
    const order = new OrderAggregate(orderId);

    // ✅ Aggregate: 도메인 규칙 적용
    order.createOrder(
      command.userId,
      command.productId,
      command.productName,
      command.quantity,
      command.price,
      command.discountRate,
    );

    order.commit(); // 이벤트 발행
  }
}

// 3단계: 외부 연동 (Event Handler들이 자동 실행)
@EventsHandler(OrderCreatedEvent)
class ProductReservationHandler {
  // ✅ 재고 예약 (다른 도메인)
  async handle(event: OrderCreatedEvent) {
    await this.productRepository.reserveStock(
      event.productId,
      event.quantity,
    );
  }
}

@EventsHandler(OrderCreatedEvent)
class OrderNotificationHandler {
  // ✅ 알림 발송 (외부 시스템)
  async handle(event: OrderCreatedEvent) {
    await this.notificationService.sendOrderCreated(event.userId);
  }
}
```

---

## 정리

### 핵심 원칙

1. **Command**: 입력 형식 검증 (DTO 레벨)
2. **Aggregate**: 도메인 규칙 적용 (주문의 비즈니스 로직)
3. **Event Handler**: 외부 연동 및 부가 기능 (느슨한 결합)

### 비즈니스 로직이 "분산"된 게 아닙니다!

**역할에 따라 적절히 배치**된 것입니다:
- 각 컴포넌트가 **자신의 책임**만 수행
- **단일 책임 원칙** (SRP) 준수
- **느슨한 결합**으로 유연성 확보
- **테스트 용이성** 향상
- **확장성** 극대화

### 추가 학습 자료

- [EVENT_FLOW.md](./EVENT_FLOW.md) - 이벤트 흐름 상세 가이드
- [COMMAND_QUERY_BUS.md](./COMMAND_QUERY_BUS.md) - Command Bus & Query Bus 가이드
- [README.md](./README.md) - 프로젝트 전체 개요
