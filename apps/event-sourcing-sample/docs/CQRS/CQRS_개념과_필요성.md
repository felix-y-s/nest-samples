# CQRS: 왜 필요하고 무엇인가?

> Event Sourcing의 조회 성능 한계를 극복하는 아키텍처 패턴

---

## 🤔 시작: 당신이 발견한 문제

당신은 매우 중요한 질문을 던졌습니다:

> "주문 금액이 1000원 이상인 주문을 조회한다면, CRUD 방식에서는 간단한 조회가 가능하지만, 이벤트 소싱 방식에서는 조회가 사실상 어렵다"

**이것은 100% 정확한 분석입니다.** 👏

### CRUD 방식의 조회
```sql
-- ✅ CRUD: 간단하고 빠름
SELECT * FROM orders WHERE total_amount >= 1000;
```

### Pure Event Sourcing의 조회
```typescript
// ❌ Pure Event Sourcing: 복잡하고 느림
async function getOrdersAbove1000() {
  const allOrderIds = await eventStore.getAllOrderIds(); // 1,000,000개 주문 ID
  const results = [];
  
  for (const orderId of allOrderIds) {
    // 각 주문마다 이벤트를 모두 재생해야 함!
    const events = await eventStore.getEvents(orderId);
    const order = reconstructOrder(events); // 평균 10개 이벤트 재생
    
    if (order.totalAmount >= 1000) {
      results.push(order);
    }
  }
  
  return results; // 😱 1,000,000개 주문 × 10개 이벤트 = 10,000,000번 이벤트 재생!
}
```

**문제점:**
- 모든 주문의 모든 이벤트를 재생해야 조회 가능
- 주문 100만 건 × 이벤트 10개 = 1000만 번 이벤트 재생
- 조회 시간: CRUD 0.1초 vs Event Sourcing 수십 분 😱

---

## 🎯 왜 CQRS가 필요한가?

### 1. Event Sourcing의 근본적인 트레이드오프

Event Sourcing은 **"쓰기"에 최적화**된 패턴입니다:

| 특성 | Event Sourcing | 전통적 CRUD |
|------|----------------|-------------|
| ✅ **쓰기 성능** | 매우 빠름 (이벤트만 추가) | 보통 (UPDATE 필요) |
| ✅ **감사 추적** | 완벽 (모든 변경 기록) | 없음 (마지막 상태만) |
| ✅ **시간 여행** | 가능 (과거 상태 복원) | 불가능 |
| ✅ **비즈니스 로직** | 명확 (이벤트 기반) | 복잡 (상태 기반) |
| ❌ **읽기 성능** | 매우 느림 (재생 필요) | 매우 빠름 (직접 조회) |
| ❌ **복잡한 쿼리** | 거의 불가능 | 매우 쉬움 |
| ❌ **집계 쿼리** | 불가능 | 간단함 |

### 2. 실전 시나리오: 왜 느린가?

**시나리오: "오늘 완료된 주문 중 10만원 이상인 주문 수"**

```typescript
// ❌ Pure Event Sourcing: 재앙
async function getTodayHighValueOrderCount() {
  let count = 0;
  const allOrderIds = await eventStore.getAllOrderIds(); // 1,000,000개
  
  for (const orderId of allOrderIds) {
    const events = await eventStore.getEvents(orderId); // DB 조회 1
    const order = reconstructOrder(events); // 이벤트 재생
    
    if (
      order.status === 'COMPLETED' &&
      order.completedAt >= todayStart &&
      order.totalAmount >= 100000
    ) {
      count++;
    }
  }
  
  return count;
  // 😱 성능: 1,000,000번 DB 조회 + 10,000,000번 이벤트 재생 = 수십 분
}
```

```sql
-- ✅ CRUD: 간단
SELECT COUNT(*) FROM orders 
WHERE status = 'COMPLETED' 
  AND completed_at >= '2024-01-01 00:00:00'
  AND total_amount >= 100000;
-- ⚡ 성능: 0.01초
```

### 3. 더 심각한 문제들

**조인 쿼리는 사실상 불가능:**
```sql
-- ❌ Event Sourcing: 어떻게 구현?
SELECT o.order_id, u.name, p.product_name, o.total_amount
FROM orders o
  JOIN users u ON o.user_id = u.user_id
  JOIN products p ON o.product_id = p.product_id
WHERE o.status = 'COMPLETED'
  AND o.total_amount >= 100000
ORDER BY o.created_at DESC
LIMIT 10;
```

**집계 쿼리도 불가능:**
```sql
-- ❌ Event Sourcing: 어떻게 구현?
SELECT 
  DATE(completed_at) as date,
  COUNT(*) as order_count,
  SUM(total_amount) as daily_revenue,
  AVG(total_amount) as avg_order_value
FROM orders
WHERE status = 'COMPLETED'
  AND completed_at >= '2024-01-01'
GROUP BY DATE(completed_at)
ORDER BY date DESC;
```

**결론: Event Sourcing만으로는 현실적인 서비스 운영이 불가능합니다.**

---

## 💡 CQRS란 무엇인가?

### 핵심 개념

**CQRS = Command Query Responsibility Segregation**
- **Command**: 명령 (쓰기, 상태 변경)
- **Query**: 조회 (읽기, 상태 조회)
- **Responsibility**: 책임
- **Segregation**: 분리

**한마디로: "쓰기 모델"과 "읽기 모델"을 분리하는 것**

### 🔑 핵심 아이디어

```
전통적 아키텍처 (동일 모델):
┌─────────────────────────────────────┐
│         Order (Domain Model)         │
│  - 쓰기: createOrder(), cancelOrder() │
│  - 읽기: getOrders(), getOrderById()  │
└─────────────────────────────────────┘
           ↓ 저장/조회
     ┌─────────────┐
     │ orders 테이블 │
     └─────────────┘


CQRS 아키텍처 (분리 모델):
┌────────────────────┐           ┌──────────────────────┐
│   Command Model    │           │     Query Model      │
│ (쓰기 최적화)        │           │   (읽기 최적화)        │
│                    │           │                      │
│ OrderAggregate     │           │ OrderReadModel       │
│ - createOrder()    │           │ - getOrders()        │
│ - cancelOrder()    │    동기화    │ - getOrderById()     │
│ - processPayment() │    ════>   │ - searchOrders()     │
│                    │           │ - getDashboard()     │
└────────────────────┘           └──────────────────────┘
         ↓                                  ↓
  ┌──────────────┐               ┌─────────────────────┐
  │ Event Store  │               │ order_read 테이블    │
  │ (이벤트 저장) │               │ (조회 전용 최적화)    │
  └──────────────┘               └─────────────────────┘
```

### 🎨 비유: 은행의 장부 시스템

**전통적 방식 (CRUD):**
```
은행원이 하나의 장부에:
- 입금/출금을 기록하고 (쓰기)
- 잔액을 조회한다 (읽기)

문제점: 여러 은행원이 동시에 쓰고 읽으면 느려짐
```

**CQRS 방식:**
```
📓 원장 (Event Store):
- 모든 거래 내역을 시간순으로 기록
- 절대 수정하지 않음 (이벤트 추가만)
- 쓰기 전용

📊 집계표 (Read Model):
- 원장을 보고 주기적으로 업데이트
- 빠른 조회를 위한 요약 정보
- 읽기 전용
- 여러 형태로 존재 가능 (일별 집계, 월별 집계, 고객별 집계)

은행원:
- 입금/출금할 때는 "원장"에만 기록
- 잔액 조회할 때는 "집계표"만 확인
```

---

## 🏗️ CQRS의 구조

### 1. Command 측 (쓰기 모델)

**역할: 비즈니스 로직 실행 및 이벤트 발행**

```typescript
// Command 측: Event Sourcing 패턴
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler {
  async execute(command: CreateOrderCommand) {
    // 1. Aggregate 생성
    const order = new OrderAggregate(command.orderId);
    
    // 2. 비즈니스 로직 실행 → 이벤트 발행
    order.createOrder(
      command.userId,
      command.productId,
      command.productName,
      command.quantity,
      command.price,
      command.discountRate,
    );
    
    // 3. 이벤트를 Event Store에 저장
    order.commit();
    // → OrderCreatedEvent가 Event Store에 저장됨
  }
}
```

**특징:**
- ✅ 비즈니스 로직에 집중
- ✅ 이벤트 발행만 담당
- ✅ 조회 성능 신경 쓰지 않음
- ❌ 조회 기능 없음 (Query 측에 위임)

### 2. Query 측 (읽기 모델)

**역할: 빠른 조회를 위한 최적화된 데이터 제공**

```typescript
// Query 측: 조회 전용 모델
@Injectable()
export class OrderQueryService {
  constructor(
    @InjectRepository(OrderReadModel)
    private readonly orderReadRepo: Repository<OrderReadModel>,
  ) {}
  
  // ✅ 빠른 조회 (DB에서 직접 조회)
  async getOrdersAbove1000(): Promise<OrderReadModel[]> {
    return this.orderReadRepo.find({
      where: { totalAmount: MoreThan(1000) },
    });
  }
  
  // ✅ 복잡한 조회도 가능
  async getDailyRevenue(date: Date): Promise<number> {
    const result = await this.orderReadRepo
      .createQueryBuilder('order')
      .select('SUM(order.totalAmount)', 'total')
      .where('DATE(order.completedAt) = :date', { date })
      .andWhere('order.status = :status', { status: 'COMPLETED' })
      .getRawOne();
    
    return result.total || 0;
  }
}
```

**특징:**
- ✅ 조회 성능 최적화
- ✅ 복잡한 쿼리 가능
- ✅ 인덱스 최적화 가능
- ❌ 쓰기 기능 없음 (Command 측에 위임)

### 3. 연결: Event Handler (동기화)

**역할: Command 측 이벤트를 듣고 Query 측 DB 업데이트**

```typescript
@EventsHandler(OrderCreatedEvent)
export class OrderReadModelHandler implements IEventHandler<OrderCreatedEvent> {
  constructor(
    @InjectRepository(OrderReadModel)
    private readonly orderReadRepo: Repository<OrderReadModel>,
  ) {}
  
  async handle(event: OrderCreatedEvent) {
    // Event Store의 이벤트를 듣고
    // Query 측 DB에 저장 (Projection)
    const orderReadModel = new OrderReadModel();
    orderReadModel.orderId = event.orderId;
    orderReadModel.userId = event.userId;
    orderReadModel.productId = event.productId;
    orderReadModel.productName = event.productName;
    orderReadModel.quantity = event.quantity;
    orderReadModel.price = event.price;
    orderReadModel.totalAmount = event.totalAmount;
    orderReadModel.finalAmount = event.finalAmount;
    orderReadModel.status = 'CREATED';
    orderReadModel.createdAt = event.timestamp;
    
    await this.orderReadRepo.save(orderReadModel);
  }
}
```

---

## 🔄 Read Model (Projection)이란?

### 개념

**Projection = Event를 "투영"하여 만든 조회용 데이터**

- **Event Store**: 원본 진실 (Source of Truth)
- **Read Model**: 조회 최적화를 위한 "그림자" (투영된 복사본)

### 왜 "Projection"이라고 부르는가?

영화관을 상상해보세요:

```
🎞️ 필름 (Event Store):
- 원본 진실
- 시간순으로 모든 장면 저장
- 변경 불가

     ↓ 빛을 쏨 (Event 발행)

🎬 스크린 (Read Model):
- 필름을 투영한 이미지
- 보기 좋게 최적화됨
- 여러 각도로 볼 수 있음 (여러 Projection 가능)
```

### 여러 개의 Projection

**하나의 Event Store → 여러 개의 Read Model 가능**

```typescript
// Event Store (하나)
OrderCreatedEvent
OrderCompletedEvent
PaymentSucceededEvent

// Read Model 1: 주문 상세 조회용
orders_read 테이블:
- order_id, user_id, product_id, status, total_amount, created_at
- 인덱스: order_id (PK), user_id, created_at

// Read Model 2: 대시보드용 (일별 집계)
daily_revenue 테이블:
- date, order_count, total_revenue, avg_order_value
- 인덱스: date (PK)

// Read Model 3: 사용자별 주문 이력
user_order_history 테이블:
- user_id, order_id, product_name, amount, status, purchased_at
- 인덱스: user_id (PK), purchased_at

// Read Model 4: 상품별 판매 통계
product_sales 테이블:
- product_id, total_sold, total_revenue, last_sold_at
- 인덱스: product_id (PK), total_revenue DESC
```

**각 Projection은 특정 조회 목적에 최적화됨:**
- 주문 상세: `orders_read`
- 대시보드: `daily_revenue`
- 마이페이지: `user_order_history`
- 판매자 통계: `product_sales`

---

## 🎯 Event Sourcing + CQRS 전체 흐름

### 주문 생성 시나리오

```
👤 사용자: "상품 구매"
     ↓
┌──────────────────────────────────────────────────────────────┐
│ 1️⃣ Command 측 (쓰기)                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  CreateOrderCommand                                          │
│       ↓                                                      │
│  CreateOrderHandler                                          │
│       ↓                                                      │
│  OrderAggregate.createOrder()                                │
│       ↓                                                      │
│  OrderCreatedEvent 발행                                       │
│       ↓                                                      │
│  Event Store 저장 ✅                                          │
│                                                              │
│  [Event Store]                                               │
│  orderId: "ORDER-001"                                        │
│  events: [                                                   │
│    {                                                         │
│      type: "OrderCreatedEvent",                              │
│      orderId: "ORDER-001",                                   │
│      userId: "USER-001",                                     │
│      totalAmount: 10000,                                     │
│      timestamp: "2024-01-01T10:00:00Z"                       │
│    }                                                         │
│  ]                                                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                      ↓
                Event 발행 (EventBus)
                      ↓
┌──────────────────────────────────────────────────────────────┐
│ 2️⃣ Query 측 (읽기) - Projection 업데이트                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  OrderCreatedEvent 수신                                       │
│       ↓                                                      │
│  OrderReadModelHandler                                       │
│       ↓                                                      │
│  orders_read 테이블 INSERT ✅                                 │
│                                                              │
│  [orders_read 테이블]                                         │
│  order_id    | user_id  | total_amount | status  | ...      │
│  ORDER-001   | USER-001 | 10000        | CREATED | ...      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                      ↓
┌──────────────────────────────────────────────────────────────┐
│ 3️⃣ 조회 요청 (Query)                                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  👤 사용자: "내 주문 조회"                                     │
│       ↓                                                      │
│  OrderQueryService.getMyOrders(userId)                       │
│       ↓                                                      │
│  SELECT * FROM orders_read                                   │
│  WHERE user_id = 'USER-001' ✅                               │
│       ↓                                                      │
│  [ { orderId: "ORDER-001", totalAmount: 10000, ... } ]       │
│       ↓                                                      │
│  👤 사용자에게 응답 (0.01초) ⚡                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 핵심 포인트

1. **Command (쓰기)**: Event Store에만 저장
2. **Event Handler**: Event를 듣고 Read Model 업데이트
3. **Query (읽기)**: Read Model에서만 조회

---

## ⏱️ Eventual Consistency (최종 일관성)

### 개념

**CQRS의 중요한 특성: 쓰기와 읽기 사이에 시간 지연이 있을 수 있음**

```
시간 ────────────────────────────────────────>

10:00:00.000  Command 실행 (주문 생성)
              └─> Event Store 저장 ✅
              
10:00:00.001  Event 발행 (EventBus)
              
10:00:00.002  Event Handler 실행 시작
              
10:00:00.005  Read Model 업데이트 완료 ✅
              
              ⚠️ 이 사이 약 5ms 동안:
              - Event Store에는 데이터 있음
              - Read Model에는 아직 없음
              
10:00:00.006  조회 시 데이터 보임
```

### 실전 시나리오

```typescript
// ❌ 문제 상황
async function createAndReadOrder() {
  // 1. 주문 생성
  await commandBus.execute(new CreateOrderCommand(...));
  console.log('주문 생성 완료!');
  
  // 2. 즉시 조회
  const order = await queryService.getOrder(orderId);
  console.log(order); // ⚠️ null 또는 이전 상태일 수 있음!
  
  // 왜냐하면:
  // - Command는 완료됨 (Event Store 저장)
  // - 하지만 Event Handler가 아직 실행 안 됨 (Read Model 미업데이트)
}
```

### 해결 방법

**방법 1: 클라이언트에서 기다리기**
```typescript
// ✅ Optimistic UI Update
async function createOrder() {
  // 1. 주문 생성
  await commandBus.execute(new CreateOrderCommand(...));
  
  // 2. UI는 즉시 업데이트 (낙관적 업데이트)
  showMessage('주문이 생성되었습니다!');
  
  // 3. 약간의 지연 후 조회
  await new Promise(resolve => setTimeout(resolve, 100));
  const order = await queryService.getOrder(orderId);
  updateUI(order);
}
```

**방법 2: Command 응답에 필요 데이터 포함**
```typescript
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler {
  async execute(command: CreateOrderCommand): Promise<OrderCreatedResponse> {
    const order = new OrderAggregate(command.orderId);
    order.createOrder(...);
    order.commit();
    
    // ✅ Command 실행 결과 반환
    return {
      orderId: command.orderId,
      totalAmount: order.getFinalAmount(),
      status: order.getStatus(),
    };
  }
}
```

**방법 3: Event-Driven UI**
```typescript
// ✅ WebSocket으로 실시간 업데이트
@EventsHandler(OrderCreatedEvent)
export class OrderWebSocketHandler {
  async handle(event: OrderCreatedEvent) {
    // Read Model 업데이트 완료 후
    // WebSocket으로 클라이언트에 알림
    this.websocketGateway.emit('order-created', {
      orderId: event.orderId,
      totalAmount: event.totalAmount,
    });
  }
}
```

### Eventual Consistency는 문제인가?

**대부분의 경우 문제가 되지 않습니다:**

- ✅ 주문 생성 후 0.1초 뒤 조회 → 괜찮음
- ✅ 주문 목록 새로고침 → 괜찮음
- ✅ 대시보드 통계 (1분 지연) → 괜찮음
- ⚠️ 주문 생성 직후 즉시 취소 → 처리 필요

**강한 일관성이 필요한 경우:**
```typescript
// ✅ Command에서 직접 반환
@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler {
  async execute(command: CreateOrderCommand) {
    const order = new OrderAggregate(command.orderId);
    order.createOrder(...);
    order.commit();
    
    // Read Model 기다리지 않고 Aggregate 상태 직접 반환
    return {
      orderId: order.getOrderId(),
      status: order.getStatus(),
      finalAmount: order.getFinalAmount(),
    };
  }
}
```

---

## 🎓 Insight: CQRS의 본질

### 핵심 개념 정리

1. **CQRS = 쓰기와 읽기의 분리**
   - Command (쓰기): 비즈니스 로직 실행, 이벤트 발행
   - Query (읽기): 조회 최적화, 복잡한 쿼리

2. **Event Sourcing의 문제를 CQRS가 해결**
   - Event Sourcing: 쓰기 우수, 읽기 느림
   - CQRS: 읽기용 별도 모델 제공

3. **Read Model (Projection)**
   - Event를 투영한 조회 최적화 데이터
   - 여러 개 가능 (목적별 최적화)
   - Event Store가 원본 진실

4. **Eventual Consistency (최종 일관성)**
   - 쓰기와 읽기 사이 시간 지연 존재
   - 대부분 경우 문제 없음
   - 필요 시 Command 응답 직접 사용

### 당신의 질문에 대한 답변

**Q: "주문 금액 1000원 이상 조회가 Event Sourcing에서 어려운가?"**

**A: 맞습니다! Pure Event Sourcing으로는 거의 불가능합니다.**

그래서 **CQRS**를 함께 사용합니다:

```typescript
// ✅ CQRS 패턴
// Command 측: Event Store에 이벤트 저장
order.createOrder(...); // → OrderCreatedEvent → Event Store

// Query 측: Read Model에서 빠르게 조회
const orders = await orderReadRepo.find({
  where: { totalAmount: MoreThan(1000) }
}); // ⚡ 0.01초
```

### 다음 단계

이제 당신은 **"왜 CQRS가 필요한지"**와 **"CQRS가 무엇인지"** 이해했습니다!

다음 학습 주제:
1. 📚 **CQRS 실전 구현** (NestJS + TypeORM)
2. 📚 **여러 개의 Read Model 설계**
3. 📚 **Eventual Consistency 처리 패턴**
4. 📚 **Event Sourcing + CQRS 통합 아키텍처**

---

**✅ 핵심 요약**

- Event Sourcing: 쓰기 우수, 읽기 느림
- CQRS: 쓰기 모델과 읽기 모델 분리
- Read Model (Projection): 조회 최적화 데이터
- Eventual Consistency: 쓰기-읽기 사이 지연 허용
- Event Store = 원본 진실, Read Model = 투영된 그림자
