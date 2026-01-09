# 🚌 Command Bus & Query Bus 상세 가이드

CQRS 패턴의 핵심인 Command Bus와 Query Bus의 동작 원리와 실제 사용법을 설명합니다.

## 📋 목차

1. [CQRS 패턴 개요](#cqrs-패턴-개요)
2. [Command Bus 상세](#command-bus-상세)
3. [Query Bus 상세](#query-bus-상세)
4. [비교 및 차이점](#비교-및-차이점)
5. [왜 분리할까?](#왜-분리할까)
6. [실전 활용법](#실전-활용법)
7. [실습 예제](#실습-예제)

---

## CQRS 패턴 개요

### CQRS란?

**CQRS** = Command Query Responsibility Segregation (명령 조회 책임 분리)

쓰기(Command)와 읽기(Query) 작업을 완전히 분리하는 아키텍처 패턴입니다.

### 전통적인 방식 vs CQRS

```
전통적인 방식:
┌──────────────────────┐
│   OrderService       │
│  - createOrder()     │ ← 쓰기
│  - processPayment()  │ ← 쓰기
│  - getOrderStatus()  │ ← 읽기
│  - getOrderHistory() │ ← 읽기
└──────────────────────┘
→ 쓰기와 읽기가 섞여있음
→ 최적화 어려움

CQRS 방식:
┌──────────────────┐     ┌─────────────────┐
│ Command 모델      │     │  Query 모델      │
│ (쓰기 최적화)     │     │ (읽기 최적화)     │
│                  │     │                  │
│ - createOrder    │     │ - getStatus     │
│ - processPayment │     │ - getHistory    │
└────────┬─────────┘     └─────────┬───────┘
         │                         │
         ▼                         ▼
    Command Bus               Query Bus
         │                         │
         ▼                         ▼
   Command Handler            Query Handler
```

### 핵심 개념

- **Command**: "~하라"는 명령 (상태 변경)
- **Query**: "~를 조회하라"는 요청 (상태 조회)
- **Bus**: 명령/요청을 적절한 Handler로 라우팅하는 메시지 버스

---

## Command Bus 상세

### 💡 개념

**상태를 변경하는 명령**을 적절한 핸들러로 전달하는 메시지 버스

### 특징

| 항목 | 설명 |
|------|------|
| **목적** | 데이터 변경 (Create, Update, Delete) |
| **반환값** | void 또는 성공/실패 상태만 |
| **부작용** | 있음 (시스템 상태 변경) |
| **멱등성** | 보장되지 않음 (같은 명령을 여러 번 실행하면 여러 번 변경) |
| **캐싱** | 불가능 |

### 🔄 동작 흐름

```
1. Controller에서 Command 생성
   ↓
2. commandBus.execute(command) 호출
   ↓
3. Command Bus 내부 동작:
   - Command 타입 확인
   - @CommandHandler(CommandType) 데코레이터로
     등록된 Handler 검색
   - Handler.execute(command) 호출
   ↓
4. Command Handler 실행
   - Aggregate 생성/조회
   - 비즈니스 로직 실행
   - 이벤트 발행
   ↓
5. 완료
```

### 📝 Command 정의

```typescript
/**
 * Command 클래스
 * - 명령형 이름 (CreateOrder, ProcessPayment)
 * - 불변 객체 (readonly 필드)
 * - 명령 수행에 필요한 모든 데이터 포함
 */
export class CreateOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly productId: string,
    public readonly productName: string,
    public readonly quantity: number,
    public readonly price: number,
    public readonly discountRate: number,
  ) {}
}

export class ProcessPaymentCommand {
  constructor(
    public readonly orderId: string,
    public readonly userBalance: number,
  ) {}
}
```

### 🛠️ Command Handler 구현

```typescript
import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';

/**
 * Command Handler
 * - @CommandHandler 데코레이터로 등록
 * - ICommandHandler 인터페이스 구현
 * - execute() 메서드에서 비즈니스 로직 실행
 */
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler
  implements ICommandHandler<CreateOrderCommand>
{
  constructor(private readonly eventPublisher: EventPublisher) {}

  async execute(command: CreateOrderCommand): Promise<void> {
    const { orderId, userId, productId, productName, quantity, price, discountRate } = command;

    // 1. Aggregate 생성
    const order = this.eventPublisher.mergeObjectContext(
      new OrderAggregate(orderId),
    );

    // 2. 비즈니스 로직 실행
    order.createOrder(userId, productId, productName, quantity, price, discountRate);

    // 3. 이벤트 커밋 (실제 이벤트 발행)
    order.commit();
  }
}
```

### 🎯 Controller에서 사용

```typescript
@Controller('orders')
export class OrderController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    // 1. Command 생성
    const command = new CreateOrderCommand(
      orderId,
      dto.userId,
      dto.productId,
      dto.productName,
      dto.quantity,
      dto.price,
      dto.discountRate,
    );

    // 2. Command Bus를 통해 실행
    await this.commandBus.execute(command);
    //    ↑
    //    내부적으로 CreateOrderHandler를 찾아서 실행

    // 3. 결과 반환 (성공/실패만)
    return {
      success: true,
      orderId,
      message: '주문이 생성되었습니다',
    };
  }
}
```

### 💡 핵심 포인트

1. **단일 책임**: 하나의 Command는 하나의 작업만 수행
2. **검증 포함**: Command Handler에서 비즈니스 규칙 검증
3. **이벤트 발행**: 상태 변경 후 이벤트 발행
4. **트랜잭션**: Command는 원자적(atomic)으로 실행

---

## Query Bus 상세

### 💡 개념

**상태를 조회하는 요청**을 적절한 핸들러로 전달하는 메시지 버스

### 특징

| 항목 | 설명 |
|------|------|
| **목적** | 데이터 조회 (Read) |
| **반환값** | 조회 결과 DTO |
| **부작용** | 없음 (시스템 상태 변경 안 함) |
| **멱등성** | 보장됨 (같은 쿼리를 여러 번 실행해도 같은 결과) |
| **캐싱** | 가능 (같은 요청에 대해 캐싱 적용 가능) |

### 🔄 동작 흐름

```
1. Controller에서 Query 생성
   ↓
2. queryBus.execute(query) 호출
   ↓
3. Query Bus 내부 동작:
   - Query 타입 확인
   - @QueryHandler(QueryType) 데코레이터로
     등록된 Handler 검색
   - Handler.execute(query) 호출
   ↓
4. Query Handler 실행
   - EventStore 또는 DB에서 조회
   - DTO로 변환
   - 결과 반환
   ↓
5. Controller로 결과 반환
```

### 📝 Query 정의

```typescript
/**
 * Query 클래스
 * - 조회형 이름 (GetOrderStatus, GetOrderHistory)
 * - 조회 조건만 포함
 * - 간단한 구조
 */
export class GetOrderStatusQuery {
  constructor(public readonly orderId: string) {}
}

export class GetOrderHistoryQuery {
  constructor(public readonly orderId: string) {}
}
```

### 🛠️ Query Handler 구현

```typescript
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

/**
 * 조회 결과 DTO
 */
export interface OrderStatusDto {
  orderId: string;
  status: OrderStatus;
  finalAmount?: number;
  eventCount: number;
}

/**
 * Query Handler
 * - @QueryHandler 데코레이터로 등록
 * - IQueryHandler 인터페이스 구현
 * - execute() 메서드에서 조회 로직 실행
 * - 결과를 DTO로 반환
 */
@QueryHandler(GetOrderStatusQuery)
export class GetOrderStatusHandler
  implements IQueryHandler<GetOrderStatusQuery>
{
  constructor(private readonly eventStore: EventStoreService) {}

  async execute(query: GetOrderStatusQuery): Promise<OrderStatusDto | null> {
    const { orderId } = query;

    // 1. EventStore에서 주문 복원
    const order = await this.eventStore.getOrderById(orderId);

    if (!order) {
      return null;
    }

    // 2. 이벤트 개수 조회
    const events = this.eventStore.getEventsByOrderId(orderId);

    // 3. DTO로 변환하여 반환
    return {
      orderId: order.getOrderId(),
      status: order.getStatus(),
      finalAmount: order.getFinalAmount(),
      eventCount: events.length,
    };
  }
}
```

### 🎯 Controller에서 사용

```typescript
@Controller('orders')
export class OrderController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':orderId/status')
  async getOrderStatus(@Param('orderId') orderId: string) {
    // 1. Query 생성
    const query = new GetOrderStatusQuery(orderId);

    // 2. Query Bus를 통해 실행
    const result = await this.queryBus.execute(query);
    //    ↑
    //    내부적으로 GetOrderStatusHandler를 찾아서 실행
    //    조회 결과를 반환받음

    // 3. 결과가 없으면 404
    if (!result) {
      throw new HttpException(
        { success: false, message: '주문을 찾을 수 없습니다' },
        HttpStatus.NOT_FOUND,
      );
    }

    // 4. 조회 결과 반환
    return {
      success: true,
      data: result,
    };
  }
}
```

### 💡 핵심 포인트

1. **읽기 전용**: 시스템 상태를 변경하지 않음
2. **캐싱 가능**: 같은 쿼리에 대해 캐싱 적용 가능
3. **DTO 반환**: 클라이언트에 필요한 형태로 데이터 변환
4. **최적화**: 읽기 전용 DB 복제본 사용 가능

---

## 비교 및 차이점

### 📊 Command vs Query 비교표

| 구분 | Command Bus | Query Bus |
|------|-------------|-----------|
| **목적** | 상태 변경 | 상태 조회 |
| **동사** | Create, Update, Delete, Process | Get, Find, List, Search |
| **반환값** | void 또는 성공/실패 | 조회 결과 DTO |
| **부작용** | 있음 (상태 변경) | 없음 (읽기만) |
| **멱등성** | 보장 안 됨 | 보장됨 |
| **캐싱** | 불가능 | 가능 |
| **최적화** | 쓰기 최적화 | 읽기 최적화 |
| **트랜잭션** | 필요 | 불필요 |
| **예시** | CreateOrder, ProcessPayment | GetOrderStatus, GetOrderHistory |

### 🔄 실행 흐름 비교

```
Command 흐름:
Controller
  → CreateOrderCommand
  → CommandBus
  → CreateOrderHandler
  → OrderAggregate
  → 이벤트 발행
  → EventStore 저장
  → 완료 (반환값 없음)

Query 흐름:
Controller
  → GetOrderStatusQuery
  → QueryBus
  → GetOrderStatusHandler
  → EventStore 조회
  → DTO 생성
  → 결과 반환 (OrderStatusDto)
```

---

## 왜 분리할까?

### 1. 🎯 독립적인 확장

```typescript
// Command 모델 - 쓰기 최적화
- 강력한 트랜잭션 관리
- 비즈니스 규칙 검증
- 이벤트 발행 로직
- 복잡한 상태 변경

// Query 모델 - 읽기 최적화
- 캐싱 적용
- 인덱싱 최적화
- 비정규화된 뷰
- 읽기 전용 복제본 사용
```

### 2. 🔒 보안 분리

```typescript
// Command - 엄격한 권한 검증
@CommandHandler(DeleteOrderCommand)
export class DeleteOrderHandler {
  async execute(command: DeleteOrderCommand) {
    // 관리자만 삭제 가능
    if (!user.isAdmin()) {
      throw new ForbiddenException('권한이 없습니다');
    }
    // 삭제 로직
  }
}

// Query - 읽기 권한만 확인
@QueryHandler(GetOrderQuery)
export class GetOrderHandler {
  async execute(query: GetOrderQuery) {
    // 본인 주문만 조회 가능
    if (order.userId !== user.id) {
      throw new ForbiddenException('권한이 없습니다');
    }
    // 조회 로직
  }
}
```

### 3. ⚡ 성능 최적화

```typescript
// Command - 마스터 DB (쓰기)
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler {
  async execute(command: CreateOrderCommand) {
    // 마스터 DB에 쓰기
    await this.masterDB.insert(order);
  }
}

// Query - 읽기 복제본 (읽기)
@QueryHandler(GetOrderQuery)
export class GetOrderHandler {
  async execute(query: GetOrderQuery) {
    // 읽기 전용 복제본에서 조회
    return await this.replicaDB.findOne(orderId);
  }
}
```

### 4. 🧪 테스트 용이성

```typescript
// Command Handler 테스트
describe('CreateOrderHandler', () => {
  it('주문을 생성해야 함', async () => {
    const command = new CreateOrderCommand(...);
    await handler.execute(command);

    // 이벤트가 발행되었는지 확인
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        constructor: { name: 'OrderCreatedEvent' }
      })
    );
  });
});

// Query Handler 테스트
describe('GetOrderStatusHandler', () => {
  it('주문 상태를 반환해야 함', async () => {
    const query = new GetOrderStatusQuery(orderId);
    const result = await handler.execute(query);

    // 반환값 확인
    expect(result.status).toBe('COMPLETED');
    expect(result.eventCount).toBe(4);
  });
});
```

---

## 실전 활용법

### 📦 모듈 설정

```typescript
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

@Module({
  imports: [
    CqrsModule, // Command Bus & Query Bus 제공
  ],
  providers: [
    // Command Handlers
    CreateOrderHandler,
    ProcessPaymentHandler,
    CancelOrderHandler,

    // Query Handlers
    GetOrderStatusHandler,
    GetOrderHistoryHandler,
    ListOrdersHandler,

    // Services
    EventStoreService,
  ],
})
export class OrderModule {}
```

### 🎯 Controller 패턴

```typescript
@Controller('orders')
export class OrderController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  // ========== Commands (상태 변경) ==========

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    const command = new CreateOrderCommand(...);
    await this.commandBus.execute(command);
    return { success: true };
  }

  @Post(':id/payment')
  async processPayment(@Param('id') id: string, @Body() dto: PaymentDto) {
    const command = new ProcessPaymentCommand(id, dto.userBalance);
    await this.commandBus.execute(command);
    return { success: true };
  }

  @Delete(':id')
  async cancelOrder(@Param('id') id: string) {
    const command = new CancelOrderCommand(id);
    await this.commandBus.execute(command);
    return { success: true };
  }

  // ========== Queries (상태 조회) ==========

  @Get(':id')
  async getOrder(@Param('id') id: string) {
    const query = new GetOrderQuery(id);
    const result = await this.queryBus.execute(query);
    return { success: true, data: result };
  }

  @Get(':id/status')
  async getOrderStatus(@Param('id') id: string) {
    const query = new GetOrderStatusQuery(id);
    const result = await this.queryBus.execute(query);
    return { success: true, data: result };
  }

  @Get()
  async listOrders(@Query() filters: OrderFiltersDto) {
    const query = new ListOrdersQuery(filters);
    const result = await this.queryBus.execute(query);
    return { success: true, data: result };
  }
}
```

---

## 실습 예제

### 🧪 1. 로그 추가해서 Bus 동작 확인

```typescript
// CreateOrderHandler.ts
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler implements ICommandHandler<CreateOrderCommand> {
  async execute(command: CreateOrderCommand): Promise<void> {
    console.log('🔵 [Command Bus] CreateOrderHandler 실행');
    console.log('  → Command:', command);

    // 기존 로직
    const order = this.eventPublisher.mergeObjectContext(
      new OrderAggregate(command.orderId),
    );
    order.createOrder(...);
    order.commit();

    console.log('🔵 [Command Bus] 주문 생성 완료');
  }
}

// GetOrderStatusHandler.ts
@QueryHandler(GetOrderStatusQuery)
export class GetOrderStatusHandler implements IQueryHandler<GetOrderStatusQuery> {
  async execute(query: GetOrderStatusQuery): Promise<OrderStatusDto | null> {
    console.log('🟢 [Query Bus] GetOrderStatusHandler 실행');
    console.log('  → Query:', query);

    const order = await this.eventStore.getOrderById(query.orderId);

    if (!order) {
      console.log('🟢 [Query Bus] 주문을 찾을 수 없음');
      return null;
    }

    const result = {
      orderId: order.getOrderId(),
      status: order.getStatus(),
      finalAmount: order.getFinalAmount(),
      eventCount: this.eventStore.getEventsByOrderId(query.orderId).length,
    };

    console.log('🟢 [Query Bus] 조회 완료:', result);
    return result;
  }
}
```

### 🚀 2. 실행 및 확인

```bash
# 서버 실행
pnpm run es:start:dev

# 주문 생성 (Command)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER-001",
    "productId": "PROD-001",
    "productName": "테스트 상품",
    "quantity": 1,
    "price": 10000,
    "discountRate": 10
  }'

# 콘솔 출력:
# 🔵 [Command Bus] CreateOrderHandler 실행
# 🔵 [Command Bus] 주문 생성 완료
# [이벤트 저장] OrderCreatedEvent: { orderId: 'ORDER-xxx', totalEvents: 1 }

# 상태 조회 (Query)
curl http://localhost:3000/orders/ORDER-xxx/status

# 콘솔 출력:
# 🟢 [Query Bus] GetOrderStatusHandler 실행
# 🟢 [Query Bus] 조회 완료: { orderId: 'ORDER-xxx', status: 'CREATED', ... }
```

### 📊 3. 결과 분석

```
Command 실행 결과:
✓ CreateOrderHandler가 실행됨
✓ OrderCreatedEvent가 발행됨
✓ EventStore에 저장됨
✓ 반환값 없음 (void)

Query 실행 결과:
✓ GetOrderStatusHandler가 실행됨
✓ EventStore에서 조회
✓ OrderStatusDto 반환
✓ 상태 변경 없음
```

---

## 🎯 핵심 정리

### Command Bus
- **역할**: 상태 변경 명령을 Handler로 전달
- **특징**: 부작용 있음, 반환값 없음, 트랜잭션 필요
- **예시**: CreateOrder, ProcessPayment, CancelOrder

### Query Bus
- **역할**: 상태 조회 요청을 Handler로 전달
- **특징**: 부작용 없음, 결과 반환, 캐싱 가능
- **예시**: GetOrderStatus, GetOrderHistory, ListOrders

### 왜 분리?
1. **독립적인 확장**: 쓰기와 읽기를 각각 최적화
2. **보안**: 권한 검증을 명확히 분리
3. **성능**: 마스터/복제본 DB 분리 가능
4. **유지보수**: 변경 영향 범위가 명확

### 실제 사용
```typescript
// Command 실행
await this.commandBus.execute(new CreateOrderCommand(...));

// Query 실행
const result = await this.queryBus.execute(new GetOrderStatusQuery(id));
```

---

## 📚 참고 자료

- [NestJS CQRS 공식 문서](https://docs.nestjs.com/recipes/cqrs)
- [CQRS 패턴 (Martin Fowler)](https://martinfowler.com/bliki/CQRS.html)
- [이벤트 소싱 + CQRS](https://docs.microsoft.com/en-us/azure/architecture/patterns/cqrs)
- [EVENT_FLOW.md](./EVENT_FLOW.md) - 전체 이벤트 흐름 로드맵
