# 도메인 로직 vs 애플리케이션 로직 명확화

이벤트 소싱/CQRS 패턴에서 가장 헷갈리는 개념인 **도메인 로직**과 **애플리케이션 로직**을 명확하게 구분합니다.

## 📚 목차

1. [용어 정의](#용어-정의)
2. [올바른 분류](#올바른-분류)
3. [핵심 차이점](#핵심-차이점)
4. [실전 예시로 비교](#실전-예시로-비교)
5. [DDD 관점에서의 계층](#ddd-관점에서의-계층)
6. [자주 하는 오해](#자주-하는-오해)

---

## 용어 정의

### 도메인 로직 (Domain Logic)

**비즈니스의 핵심 규칙** - "주문"이라는 개념 자체의 규칙

```typescript
// ✅ 도메인 로직 (Aggregate)
export class OrderAggregate extends AggregateRoot {
  processPayment(userBalance: number) {
    // ⭐ 도메인 규칙: 주문의 핵심 비즈니스 규칙
    if (this.status !== OrderStatus.CREATED) {
      throw new Error('주문 생성 상태에서만 결제를 시도할 수 있습니다');
    }

    // ⭐ 도메인 규칙: 할인율 최대치 (회사 정책)
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

    // ⭐ 도메인 규칙: 잔액 검증 (결제의 기본 규칙)
    if (userBalance < this.finalAmount) {
      this.apply(
        new PaymentFailedEvent(
          this.orderId,
          this.userId,
          this.finalAmount,
          PaymentFailureReason.INSUFFICIENT_BALANCE,
          `잔액이 부족합니다. 필요 금액: ${this.finalAmount}, 현재 잔액: ${userBalance}`,
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
- **비즈니스 의미가 명확**: "왜 이 규칙이 필요한가?"에 대한 명확한 비즈니스 이유
- **도메인 전문가와 협의 가능**: 업무 담당자와 직접 대화 가능한 규칙
- **외부 시스템 독립적**: 다른 시스템 없이도 검증 가능
- **불변의 핵심**: 시스템이 바뀌어도 비즈니스 규칙은 유지

### 애플리케이션 로직 (Application Logic)

**도메인 간 조정 및 외부 연동** - 주문과 "다른 것들"의 연결

```typescript
// ✅ 애플리케이션 로직 (Event Handler)
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly productRepository: ProductRepository) {}

  async handle(event: OrderCompletedEvent) {
    // ⭐ 애플리케이션 로직: 주문 → 상품 도메인 연동
    await this.productRepository.decreaseStock(
      event.productId,
      event.quantity,
    );

    console.log(`[재고 감소] 상품 ${event.productId}: -${event.quantity}`);
  }
}

@EventsHandler(OrderCompletedEvent)
export class EmailNotificationHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly emailService: EmailService) {}

  async handle(event: OrderCompletedEvent) {
    // ⭐ 애플리케이션 로직: 주문 → 이메일 시스템 연동
    await this.emailService.sendOrderConfirmation(
      event.userId,
      event.orderId,
      event.amount,
    );

    console.log(`[이메일 발송] 사용자 ${event.userId}`);
  }
}

@EventsHandler(OrderCompletedEvent)
export class PointRewardHandler implements IEventHandler<OrderCompletedEvent> {
  constructor(private readonly pointService: PointService) {}

  async handle(event: OrderCompletedEvent) {
    // ⭐ 애플리케이션 로직: 주문 → 포인트 도메인 연동
    const points = Math.floor(event.amount * 0.01); // 1% 적립
    await this.pointService.addPoints(event.userId, points);

    console.log(`[포인트 적립] 사용자 ${event.userId}: +${points}P`);
  }
}
```

**특징**:
- **도메인 간 조정**: 여러 도메인을 연결하고 조정
- **외부 시스템 호출**: 이메일, SMS, 알림 등 외부 서비스 연동
- **부가 기능**: 핵심 비즈니스는 아니지만 필요한 기능
- **느슨한 결합**: 실패해도 핵심 비즈니스는 영향 없음

### 입력 검증 (Validation)

**형식 체크** - 기술적 검증 (비즈니스 의미 없음)

```typescript
// ✅ 입력 검증 (Command/DTO)
import { IsNotEmpty, IsNumber, Min, Max } from 'class-validator';

export class CreateOrderCommand {
  @IsNotEmpty()    // 기술적 검증: 비어있지 않은가?
  userId: string;

  @IsNotEmpty()
  productId: string;

  @IsNotEmpty()
  productName: string;

  @IsNumber()      // 기술적 검증: 숫자인가?
  @Min(1)          // 기술적 검증: 1 이상인가?
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  discountRate: number;

  // ❌ 여기는 비즈니스 로직 없음!
  // "왜 1 이상이어야 하는가?"의 비즈니스 이유는 모름
}
```

**특징**:
- **형식 체크**: 타입, 필수값, 범위 등 기술적 검증
- **비즈니스 의미 없음**: "왜?"에 대한 답이 없음
- **프레임워크 의존**: 데코레이터, 벨리데이터 사용
- **요청 레벨**: HTTP 요청이 올바른지만 체크

---

## 올바른 분류

### ✅ 정답

| 컴포넌트 | 로직 유형 | 역할 | 위치 |
|---------|----------|------|------|
| **Command/DTO** | 입력 검증 | 형식, 타입, 필수값 체크 | `commands/*.command.ts` |
| **Aggregate** | **도메인 로직** ⭐ | 핵심 비즈니스 규칙 | `aggregates/*.aggregate.ts` |
| **Event Handler** | 애플리케이션 로직 | 외부 시스템 연동, 도메인 간 조정 | `handlers/*-handler.ts` |

### ❌ 자주 하는 오해

| 잘못된 이해 | 올바른 이해 |
|-----------|-----------|
| Command = 도메인 로직 | Command = 입력 검증 (기술적) |
| Aggregate = 애플리케이션 로직 | Aggregate = 도메인 로직 (핵심!) |
| Event Handler = 부가 기능 | Event Handler = 애플리케이션 로직 (중요!) |

---

## 핵심 차이점

### Command: 입력 검증 (기술적)

```typescript
// Command에서의 검증
export class CreateOrderCommand {
  @IsNumber()
  @Min(0)
  @Max(100)
  discountRate: number;
}

// 의미: "숫자 형태이고, 0~100 범위인가?" (형식만 체크)
// 질문: "왜 100까지인가?" → 답: 모름 (그냥 형식)
// HTTP 400 Bad Request
```

### Aggregate: 도메인 로직 (비즈니스적)

```typescript
// Aggregate에서의 검증
export class OrderAggregate {
  processPayment(userBalance: number) {
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
  }
}

// 의미: "우리 회사 정책상 50% 이상 할인은 불가" (비즈니스 규칙)
// 질문: "왜 50%인가?" → 답: 회사의 할인 정책 (명확한 비즈니스 이유)
// HTTP 422 Unprocessable Entity
```

### Event Handler: 애플리케이션 로직 (연동/조정)

```typescript
// Event Handler에서의 로직
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler {
  async handle(event: OrderCompletedEvent) {
    await this.productRepository.decreaseStock(
      event.productId,
      event.quantity,
    );
  }
}

// 의미: "주문 완료 시 재고를 감소시킨다" (도메인 간 조정)
// 질문: "왜 재고를 감소시키는가?" → 답: 주문과 상품 도메인 연결 (애플리케이션 규칙)
// 실패해도 주문 자체는 성공 (느슨한 결합)
```

---

## 실전 예시로 비교

### 시나리오 1: "수량은 1개 이상이어야 한다"

#### Command 관점 (입력 검증)

```typescript
export class CreateOrderCommand {
  @IsNumber()
  @Min(1)  // ← 기술적 검증: "1 미만이면 요청 형식 오류"
  quantity: number;
}

// HTTP 400 Bad Request
// { "message": "quantity must not be less than 1" }
```

**의미**:
- "숫자여야 하고, 1 이상이어야 함" (형식)
- 비즈니스 이유는 모름
- 클라이언트 잘못된 요청

#### Aggregate 관점 (도메인 로직)

```typescript
export class OrderAggregate {
  createOrder(..., quantity: number) {
    if (quantity <= 0) {
      // ← 도메인 로직: "0개 주문은 업무상 불가능"
      throw new Error('수량은 0보다 커야 합니다');
    }

    // 비즈니스 로직 계속...
    this.apply(new OrderCreatedEvent(...));
  }
}

// HTTP 422 Unprocessable Entity (또는 도메인 예외)
// "수량은 0보다 커야 합니다" (비즈니스 규칙 위반)
```

**의미**:
- "0개 주문은 비즈니스적으로 의미 없음" (도메인 규칙)
- 명확한 비즈니스 이유 존재
- 업무 규칙 위반

### 시나리오 2: "재고 감소"

#### ❌ Aggregate에 넣으면? (잘못된 설계)

```typescript
// ❌ 나쁜 예: Aggregate에 외부 연동
export class OrderAggregate {
  constructor(
    orderId: string,
    private readonly productRepository: ProductRepository, // ❌
  ) {
    super();
  }

  async processPayment(userBalance: number) {
    // 도메인 로직
    if (userBalance < this.finalAmount) {
      throw new Error('잔액 부족');
    }

    // ❌ 문제: 재고 감소 실패 시 전체 주문 실패
    await this.productRepository.decreaseStock(
      this.productId,
      this.quantity,
    );

    this.apply(new OrderCompletedEvent(...));
  }
}
```

**문제점**:
- 재고 시스템 장애 시 주문도 실패
- Aggregate가 Product 도메인에 강하게 결합
- 테스트 시 ProductRepository Mock 필요

#### ✅ Event Handler에 넣으면? (올바른 설계)

```typescript
// ✅ 좋은 예: Event Handler로 분리
export class OrderAggregate {
  processPayment(userBalance: number) {
    // ✅ 도메인 로직만
    if (userBalance < this.finalAmount) {
      this.apply(new PaymentFailedEvent(...));
      return;
    }

    // ✅ 이벤트만 발행
    this.apply(new OrderCompletedEvent(...));
  }
}

// ✅ 애플리케이션 로직: 별도 Handler
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler {
  async handle(event: OrderCompletedEvent) {
    try {
      await this.productRepository.decreaseStock(
        event.productId,
        event.quantity,
      );
    } catch (error) {
      // ✅ 실패해도 주문은 성공 (보상 트랜잭션 가능)
      console.error('[재고 감소 실패]', error);
    }
  }
}
```

**장점**:
- 재고 시스템 장애와 주문 성공 분리
- 느슨한 결합
- 테스트 용이

---

## DDD 관점에서의 계층

```
┌─────────────────────────────────────────────────────────┐
│  Controller (REST API)                                  │
│  - HTTP 요청/응답 처리                                  │
│  - 라우팅, 미들웨어                                     │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│  Command/DTO                          [입력 검증 계층]  │
│  - @IsNotEmpty(), @IsNumber(), @Min(), @Max()           │
│  - 형식, 타입, 필수값 체크                              │
│  - 비즈니스 의미 없는 기술적 검증                       │
│                                                         │
│  예시: quantity가 문자열 → 400 Bad Request             │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│  Command Handler                  [애플리케이션 계층]   │
│  - 트랜잭션 관리                                        │
│  - Aggregate 생성/조회                                  │
│  - Event Publisher 연결                                 │
│                                                         │
│  예시: EventStore에서 Order 복원 → 비즈니스 로직 실행  │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│  Aggregate (Domain Model)           [도메인 계층] ⭐⭐⭐  │
│  - 비즈니스 규칙 적용 (핵심!)                           │
│  - 주문의 상태 관리                                     │
│  - 도메인 이벤트 발행                                   │
│  - 외부 시스템 독립적                                   │
│                                                         │
│  예시: 할인율 > 50% → PaymentFailedEvent 발행          │
│       잔액 < 금액 → PaymentFailedEvent 발행             │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│  Event Bus                           [인프라 계층]      │
│  - 이벤트 라우팅                                        │
│  - 비동기 처리                                          │
└────────────────────┬────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────────────────────┐
│  Event Handler                    [애플리케이션 계층]   │
│  - 다른 도메인 연동 (재고, 포인트)                      │
│  - 외부 시스템 호출 (이메일, SMS)                       │
│  - 부가 기능 실행                                       │
│                                                         │
│  예시: OrderCompletedEvent 수신                         │
│       → ProductRepository.decreaseStock() 호출          │
│       → EmailService.send() 호출                        │
└─────────────────────────────────────────────────────────┘
```

### 계층별 책임

| 계층 | 책임 | 실패 시 HTTP 코드 |
|------|------|-----------------|
| **Command/DTO** | 형식 검증 | 400 Bad Request |
| **Command Handler** | 트랜잭션, 조정 | 500 Internal Server Error |
| **Aggregate** | 도메인 규칙 | 422 Unprocessable Entity |
| **Event Handler** | 외부 연동 | 주문은 성공 (비동기 재시도) |

---

## 자주 하는 오해

### 오해 1: "Command에 비즈니스 로직이 있다"

```typescript
// ❌ 잘못된 생각
export class CreateOrderCommand {
  @Min(1)  // ← "이게 비즈니스 로직 아닌가?"
  quantity: number;
}

// ✅ 올바른 이해
// → Command: 기술적 검증 (형식만 체크)
// → Aggregate: 도메인 로직 (비즈니스 이유)
```

**구분 방법**:
- Command의 `@Min(1)`: "1 미만이면 요청 형식이 잘못됨"
- Aggregate의 `quantity <= 0` 체크: "0개 주문은 업무상 불가능"

### 오해 2: "Aggregate가 애플리케이션 로직이다"

```typescript
// ❌ 잘못된 생각
// "Aggregate는 애플리케이션에서 사용되니까 애플리케이션 로직?"

// ✅ 올바른 이해
// Aggregate = 도메인 모델 = 비즈니스 핵심 규칙
// Event Handler = 애플리케이션 로직 = 도메인 간 조정
```

**용어 주의**:
- "애플리케이션 로직" ≠ "애플리케이션에서 사용되는 로직"
- "애플리케이션 로직" = "여러 도메인을 조정하는 로직"

### 오해 3: "왜 똑같은 검증을 두 번 하나?"

```typescript
// Command
@Min(1)
quantity: number;

// Aggregate
if (quantity <= 0) throw new Error(...);

// ❓ "중복 아닌가?"
```

**답변**:
- Command: **방어적 검증** (잘못된 요청 조기 차단)
- Aggregate: **도메인 규칙** (비즈니스 불변식 보호)
- 역할이 다르므로 중복이 아님!

**실전 예시**:
```typescript
// Command: 0~100 범위 체크 (기술적)
@Min(0)
@Max(100)
discountRate: number;

// Aggregate: 50% 이하 체크 (비즈니스)
if (this.discountRate > 50) {
  // 회사 정책상 50% 초과 불가
  this.apply(new PaymentFailedEvent(...));
}
```

---

## 정리

### 핵심 분류 (절대 헷갈리지 말 것!)

```typescript
// 1. Command/DTO - 입력 검증 (기술적, 비즈니스 의미 없음)
export class CreateOrderCommand {
  @IsNumber()  // ← 형식 체크
  @Min(1)      // ← 범위 체크 (비즈니스 이유 모름)
  quantity: number;
}

// 2. Aggregate - 도메인 로직 (비즈니스 핵심!) ⭐⭐⭐
export class OrderAggregate {
  createOrder(..., quantity: number) {
    if (quantity <= 0) {
      // ← 비즈니스 규칙: "0개 주문은 의미 없음"
      throw new Error('수량은 0보다 커야 합니다');
    }
  }

  processPayment(userBalance: number) {
    if (this.discountRate > 50) {
      // ← 비즈니스 규칙: "회사 정책상 50% 초과 불가"
      this.apply(new PaymentFailedEvent(...));
    }
  }
}

// 3. Event Handler - 애플리케이션 로직 (도메인 간 연동/조정)
@EventsHandler(OrderCompletedEvent)
export class ProductStockHandler {
  async handle(event: OrderCompletedEvent) {
    // ← 애플리케이션 로직: 주문 → 상품 도메인 연동
    await this.productRepository.decreaseStock(...);
  }
}
```

### 판단 기준

| 질문 | Command | Aggregate | Event Handler |
|------|---------|-----------|---------------|
| "비즈니스 이유가 있나요?" | ❌ 없음 | ✅ 있음 | ✅ 있음 |
| "도메인 전문가와 대화 가능?" | ❌ 불가 | ✅ 가능 | △ 부분 가능 |
| "외부 시스템 독립적인가요?" | ✅ 독립 | ✅ 독립 | ❌ 의존 |
| "실패 시 주문도 실패?" | ✅ 예 | ✅ 예 | ❌ 아니오 |

### 기억할 것

1. **Command ≠ 도메인 로직** (기술적 검증일 뿐!)
2. **Aggregate = 도메인 로직** (핵심 비즈니스 규칙!)
3. **Event Handler = 애플리케이션 로직** (도메인 간 연동!)

---

## 추가 학습 자료

- [BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md) - 비즈니스 로직 배치 가이드
- [EVENT_FLOW.md](./EVENT_FLOW.md) - 이벤트 흐름 로드맵
- [COMMAND_QUERY_BUS.md](./COMMAND_QUERY_BUS.md) - Command Bus & Query Bus 가이드
- [README.md](./README.md) - 프로젝트 전체 개요
