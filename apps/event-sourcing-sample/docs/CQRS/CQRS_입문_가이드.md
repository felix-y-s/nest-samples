# CQRS 입문 가이드: 이벤트 소싱의 단짝 친구

작성해주신 메모를 바탕으로, CQRS가 왜 필요한지, 그리고 어떤 개념인지 아주 쉽게 설명해 드립니다.

## 1. 당신이 발견한 핵심 문제점 🎯

작성해주신 메모에서 가장 중요한 통찰은 바로 이 부분입니다:

> **"이벤트 소싱 방식은 CRUD 방식의 order 테이블을 가지지 않는다... 그래서 '주문 금액이 1000원 이상인 주문'과 같은 조회가 어렵다."**

이것이 바로 **CQRS가 탄생한 이유**입니다.

### 상황 비유: 도서관 📚

- **CRUD 방식**: 책의 현재 위치만 기록된 장부.
  - "해리포터 책 어디 있어?" → "A구역 3번 꽂혀있음" (바로 알 수 있음)
- **이벤트 소싱 방식**: 책의 대출/반납 이력만 적힌 로그.
  - "해리포터 책 어디 있어?" → (로그를 처음부터 끝까지 읽어봄) "1일 대출, 3일 반납, 5일 대출..." → "아, 지금은 대출 중이네!"

**문제점**: "현재 대출 가능한 모든 책을 찾아줘"라고 하면, 이벤트 소싱은 도서관의 모든 책의 이력을 다 계산해봐야 합니다. **너무 느리고 비효율적이죠.**

## 2. CQRS란 무엇인가?

**CQRS**는 **C**ommand **Q**uery **R**esponsibility **S**egregation의 약자입니다.
어렵게 들리지만, 한국어로 풀면 **"명령(쓰기)과 조회(읽기)의 책임을 분리한다"**는 뜻입니다.

### 아주 쉬운 개념도

```
[쓰기 전용 (Command)]          [읽기 전용 (Query)]
      (이벤트 소싱)                  (일반 DB)
         │                            │
    "주문 생성해!"               "1000원 이상 주문 보여줘"
         │                            │
    [Event Store] ───────────> [Order Table]
    (이벤트 저장)      동기화      (조회용 테이블)
```

1. **쓰기 (Command)**:
   - 당신이 이해한 대로 **이벤트 소싱**을 사용합니다.
   - `OrderCreated`, `PaymentSucceeded` 같은 이벤트를 저장합니다.
   - 목적: 데이터의 무결성, 이력 관리, 복잡한 비즈니스 로직 처리.

2. **읽기 (Query)**:
   - 우리가 익숙한 **일반적인 DB 테이블(RDBMS, NoSQL)**을 사용합니다.
   - 목적: 빠르고 편리한 조회 (`SELECT * FROM orders WHERE price >= 1000`).

## 3. 어떻게 동작하나요? (동기화 과정)

"쓰기 모델"과 "읽기 모델"이 분리되어 있다면, 둘을 어떻게 일치시킬까요?

1.  **사용자가 주문을 합니다.**
    -   `Command`가 실행되어 `OrderCreated`와 같은 이벤트가 발생합니다.
2.  **이벤트 저장 및 발행(Publish)**
    -   발생한 이벤트는 **Event Store**에 저장되는 **동시에**, `EventBus`를 통해 시스템에 **발행(Publish)**됩니다.
3.  **읽기 모델 업데이트 (Projection)**
    -   `EventBus`를 **구독(Subscribe)**하고 있던 `Event Handler`가 이벤트를 전달받아, **읽기 전용 DB(Order Table)**를 업데이트합니다.
    -   이 과정을 **"Projection(투영)"**이라고 부릅니다.

### 결과
- 사용자가 "주문 내역 조회"를 요청하면, 복잡한 이벤트 계산 없이 **읽기 전용 DB**에서 바로 가져옵니다.
- **CRUD의 장점(빠른 조회)과 이벤트 소싱의 장점(완벽한 이력)을 모두 가질 수 있게 됩니다.**

## 4. 요약: 왜 필요한가요?

작성해주신 메모의 질문에 대한 답이 바로 CQRS입니다.

- **질문**: "이벤트 소싱은 order 테이블이 없어서 조회가 어려운데 어떡하죠?"
- **CQRS의 답**: "조회를 위한 order 테이블을 **따로** 만드세요! 단, 그 테이블은 비즈니스 로직을 처리하는 곳이 아니라, 이벤트가 발생할 때마다 업데이트되는 **조회 전용**입니다."

### 핵심 용어 정리

| 용어 | 설명 | 비유 |
|------|------|------|
| **Command** | 상태를 변경하는 명령 (쓰기) | "입금해주세요" |
| **Query** | 상태를 조회하는 요청 (읽기) | "잔액 보여주세요" |
| **Event Store** | 모든 이력이 저장되는 곳 (진실의 원천) | 은행 거래 내역 원장 |
| **Read Model** | 조회를 위해 최적화된 테이블 | 통장 잔액 표시 |
| **Projection** | 이벤트를 Read Model로 변환하는 과정 | 거래 내역을 보고 잔액 계산해서 적기 |

---

### 🚀 다음 단계

이제 개념을 이해하셨으니, 실제 코드에서 `Command Handler`(쓰기)와 `Query Handler`(읽기)가 어떻게 나뉘어 있는지 살펴보시면 훨씬 이해가 빠르실 겁니다.

- CQRS 개념과 필요성 상세 (더 깊은 내용)

## 5. 실제 코드에서는 어떻게 보일까요? (간단한 예시)

NestJS와 같은 프레임워크에서 CQRS가 어떻게 구현되는지 간단한 코드로 살펴봅시다.

### 📁 디렉토리 구조 예시

```
src/
└── orders/
    ├── commands/
    │   ├── create-order.command.ts
    │   └── create-order.handler.ts
    ├── queries/
    │   ├── find-order-by-id.query.ts
    │   └── find-order-by-id.handler.ts
    ├── events/
    │   └── order-created.event.ts
    ├── projections/
    │   └── order.projection.ts
    ├── read-models/
    │   └── order.read-model.ts
    ├── order.aggregate.ts
    └── order.controller.ts
```

### 1. 쓰기 (Command) 측 흐름

**"주문을 생성한다"** 는 쓰기 작업의 흐름입니다.

1.  **Controller**: HTTP 요청을 받아 Command를 발행합니다.

    ```typescript
    // order.controller.ts
    @Post()
    createOrder(@Body() dto: CreateOrderDto) {
      // 💡 가격, 상품명 등은 직접 받지 않고 서버에서 조회합니다.
      const command = new CreateOrderCommand(dto.userId, dto.productId, dto.quantity);
      return this.commandBus.execute(command);
    }
    ```

2.  **Command Handler**: Command를 받아 비즈니스 로직을 처리하고, Aggregate를 통해 이벤트를 발생시킵니다.

    ```typescript
    // create-order.handler.ts
    @CommandHandler(CreateOrderCommand)
    export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
      constructor(
        private readonly productService: ProductService, // 외부 데이터 조회
        private readonly eventPublisher: EventPublisher,
      ) {}

      async execute(command: CreateOrderCommand) {
        const { productId, quantity } = command;

        // 🔍 외부 데이터 조회 및 검증 (가격, 재고 등)
        const product = await this.productService.getProduct(productId);

        // ✅ Aggregate는 순수한 도메인 로직만 처리
        const order = this.eventPublisher.mergeObjectContext(new OrderAggregate());
        order.createOrder(product.id, product.name, product.price, quantity);
        order.commit(); // OrderCreatedEvent 발행
      }
    }
    ```

### 2. 읽기 (Query) 측 흐름

**"특정 주문을 조회한다"** 는 읽기 작업의 흐름입니다.

1.  **Controller**: HTTP 요청을 받아 Query를 발행합니다.

    ```typescript
    // order.controller.ts
    @Get(':id')
    getOrder(@Param('id') id: string) {
      const query = new FindOrderByIdQuery(id);
      return this.queryBus.execute(query);
    }
    ```

2.  **Query Handler**: Query를 받아 **조회용으로 최적화된 Read Model**을 직접 조회합니다.

    ```typescript
    // find-order-by-id.handler.ts
    @QueryHandler(FindOrderByIdQuery)
    export class FindOrderByIdHandler {
      constructor(
        // 💡 복잡한 이벤트 재생 없이, 미리 만들어진 조회용 테이블을 사용합니다.
        private readonly orderReadModelRepository: OrderReadModelRepository,
      ) {}

      async execute(query: FindOrderByIdQuery) {
        // 🚀 매우 빠르고 간단하게 데이터를 조회합니다.
        return this.orderReadModelRepository.findById(query.orderId);
      }
    }
    ```

### 3. 동기화 (Projection)

`OrderCreatedEvent`가 발생했을 때, 이벤트를 감지하여 **읽기 모델(Read Model)**을 업데이트합니다.

```typescript
// order.projection.ts
@EventsHandler(OrderCreatedEvent)
export class OrderProjection implements IEventHandler<OrderCreatedEvent> {
  constructor(
    private readonly orderReadModelRepository: OrderReadModelRepository,
  ) {}

  // 💡 이벤트가 발생하면 이 핸들러가 비동기적으로 실행됩니다.
  async handle(event: OrderCreatedEvent) {
    // 📝 읽기 전용 테이블에 데이터를 저장(INSERT/UPDATE)합니다.
    await this.orderReadModelRepository.save({
      id: event.orderId,
      status: 'CREATED',
      amount: event.finalAmount,
      orderedAt: event.createdAt,
      // ... 필요한 다른 데이터들
    });
  }
}
```

이처럼 CQRS는 **쓰기 모델(Command, Aggregate)**과 **읽기 모델(Query, Read Model)**의 책임을 명확히 분리하여, 각자의 목적에 맞게 최적화할 수 있도록 돕는 강력한 패턴입니다.