# 🔄 이벤트 소싱 흐름 로드맵

이 문서는 사용자 요청부터 이벤트가 발생하고 저장되기까지의 **전체 흐름**을 단계별로 설명합니다.

## 📋 목차

1. [전체 아키텍처 개요](#전체-아키텍처-개요)
2. [성공 시나리오: 주문 생성 및 결제 성공](#성공-시나리오-주문-생성-및-결제-성공)
3. [실패 시나리오 1: 잔액 부족](#실패-시나리오-1-잔액-부족)
4. [실패 시나리오 2: 할인율 초과](#실패-시나리오-2-할인율-초과)
5. [컴포넌트 역할 상세 설명](#컴포넌트-역할-상세-설명)
6. [이벤트 스토어 동작 원리](#이벤트-스토어-동작-원리)

---

## 전체 아키텍처 개요

```
┌─────────────┐
│   사용자     │
└──────┬──────┘
       │ HTTP Request
       ▼
┌─────────────────────────────────────────────────────────┐
│                    Controller                            │
│  (order.controller.ts)                                   │
│  - HTTP 요청 수신                                          │
│  - DTO 검증                                               │
│  - Command/Query 버스로 전달                               │
└────────────┬────────────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
┌─────────┐     ┌──────────┐
│ Command │     │  Query   │
│   Bus   │     │   Bus    │
└────┬────┘     └────┬─────┘
     │               │
     ▼               ▼
┌─────────────┐ ┌────────────────┐
│  Command    │ │ Query Handler  │
│  Handler    │ │ - 상태 조회      │
└──────┬──────┘ │ - 이벤트 히스토리  │
       │        └────────┬───────┘
       ▼                 │
┌──────────────┐         │
│  Aggregate   │         │
│  - 비즈니스    │         │
│    로직 실행   │         │
│  - 이벤트     │         │
│    발행       │         │
└──────┬───────┘         │
       │                 │
       ▼                 │
┌──────────────┐         │
│  Event Bus   │         │
└──────┬───────┘         │
       │                 │
       ▼                 ▼
┌─────────────────────────────┐
│      Event Store            │
│  - 이벤트 저장                 │
│  - 상태 복원                  │
│  - 히스토리 조회               │
└─────────────────────────────┘
```

> **💡 Command Bus & Query Bus 상세 설명**
> **📖 [COMMAND_QUERY_BUS.md](./COMMAND_QUERY_BUS.md)** - CQRS 패턴의 핵심인 Command Bus와 Query Bus의 동작 원리, 차이점, 사용법을 상세히 설명합니다.

---

## 성공 시나리오: 주문 생성 및 결제 성공

### 📝 시나리오 개요
사용자가 100만원짜리 노트북을 10% 할인으로 주문하고, 충분한 잔액(100만원)으로 결제에 성공하는 케이스

### 🔄 전체 흐름

```
1️⃣ 주문 생성 요청
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

사용자
  │
  │ POST /orders
  │ {
  │   "productName": "노트북",
  │   "price": 1000000,
  │   "discountRate": 10
  │ }
  ▼
OrderController
  │
  │ CreateOrderCommand 생성
  │ commandBus.execute()
  ▼
CreateOrderHandler
  │
  │ 1. OrderAggregate 생성
  │ 2. createOrder() 메서드 호출
  ▼
OrderAggregate
  │
  │ [비즈니스 로직 검증]
  │ ✓ 수량 > 0?
  │ ✓ 가격 > 0?
  │ ✓ 할인율 0-100?
  │
  │ [이벤트 발행]
  │ apply(OrderCreatedEvent)
  ▼
EventBus
  │
  │ 이벤트 전파
  ▼
EventStore
  │
  │ [이벤트 저장]
  │ orderId -> [OrderCreatedEvent]
  │
  │ 콘솔 출력:
  │ [이벤트 저장] OrderCreatedEvent:
  │   { orderId: 'ORDER-xxx', totalEvents: 1 }
  ▼
Aggregate 상태 변경
  │
  │ onOrderCreatedEvent() 호출
  │ - orderId 설정
  │ - status = CREATED
  │ - finalAmount = 900,000 (할인 적용)
  ▼
응답 반환
  │
  │ {
  │   "success": true,
  │   "orderId": "ORDER-xxx",
  │   "message": "주문이 생성되었습니다"
  │ }
  ▼
사용자
```

### 이벤트 스토어 상태

```
┌─────────────────────────────────────────┐
│ Event Store                             │
├─────────────────────────────────────────┤
│ ORDER-xxx:                              │
│   1. OrderCreatedEvent                  │
│      - price: 1,000,000                 │
│      - discountRate: 10                 │
│      - finalAmount: 900,000             │
│      - status: CREATED                  │
└─────────────────────────────────────────┘
```

---

```
2️⃣ 결제 처리 요청
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

사용자
  │
  │ POST /orders/{orderId}/payment
  │ { "userBalance": 1000000 }
  ▼
OrderController
  │
  │ ProcessPaymentCommand 생성
  │ commandBus.execute()
  ▼
ProcessPaymentHandler
  │
  │ 1. EventStore에서 주문 복원
  │    eventStore.getOrderById(orderId)
  ▼
EventStore
  │
  │ [상태 복원 과정]
  │ 1. orderId로 이벤트 배열 조회
  │    events = [OrderCreatedEvent]
  │
  │ 2. 새 Aggregate 생성
  │    order = new OrderAggregate(orderId)
  │
  │ 3. 이벤트 재생
  │    order.onOrderCreatedEvent(events[0])
  │    → status = CREATED
  │    → finalAmount = 900,000
  │
  │ 4. 복원된 Aggregate 반환
  ▼
ProcessPaymentHandler
  │
  │ order.processPayment(1000000)
  ▼
OrderAggregate.processPayment()
  │
  │ [상태 검증]
  │ ✓ status === CREATED?
  │
  │ [이벤트 1: 결제 시도]
  │ apply(PaymentAttemptedEvent)
  │   → status = PAYMENT_PENDING
  │
  │ [비즈니스 로직 검증]
  │ ✓ 할인율 <= 50%? (10% ✓)
  │ ✓ 잔액 >= 필요금액? (1,000,000 >= 900,000 ✓)
  │
  │ [이벤트 2: 결제 성공]
  │ apply(PaymentSucceededEvent)
  │   → transactionId = "TXN-xxx"
  │   → status = PAYMENT_SUCCEEDED
  │
  │ [이벤트 3: 주문 완료]
  │ apply(OrderCompletedEvent)
  │   → status = COMPLETED
  ▼
EventBus (3개의 이벤트 전파)
  │
  ├─→ PaymentAttemptedEvent
  ├─→ PaymentSucceededEvent
  └─→ OrderCompletedEvent
  ▼
EventStore
  │
  │ [이벤트 저장 - 3회]
  │ orderId -> [
  │   OrderCreatedEvent,
  │   PaymentAttemptedEvent,    ← 추가
  │   PaymentSucceededEvent,    ← 추가
  │   OrderCompletedEvent       ← 추가
  │ ]
  │
  │ 콘솔 출력:
  │ [이벤트 저장] PaymentAttemptedEvent: totalEvents: 2
  │ [이벤트 저장] PaymentSucceededEvent: totalEvents: 3
  │ [이벤트 저장] OrderCompletedEvent: totalEvents: 4
  ▼
응답 반환
  │
  │ {
  │   "success": true,
  │   "message": "결제 처리가 완료되었습니다"
  │ }
  ▼
사용자
```

### 최종 이벤트 스토어 상태

```
┌─────────────────────────────────────────────────┐
│ Event Store                                     │
├─────────────────────────────────────────────────┤
│ ORDER-xxx:                                      │
│   1. OrderCreatedEvent                          │
│      - timestamp: T0                            │
│      - finalAmount: 900,000                     │
│                                                 │
│   2. PaymentAttemptedEvent                      │
│      - timestamp: T1                            │
│      - amount: 900,000                          │
│                                                 │
│   3. PaymentSucceededEvent                      │
│      - timestamp: T2                            │
│      - transactionId: "TXN-xxx"                 │
│                                                 │
│   4. OrderCompletedEvent                        │
│      - timestamp: T3                            │
│      - status: COMPLETED                        │
└─────────────────────────────────────────────────┘
```

### 📊 상태 조회 요청

```
사용자
  │
  │ GET /orders/{orderId}/status
  ▼
OrderController
  │
  │ GetOrderStatusQuery 생성
  │ queryBus.execute()
  ▼
GetOrderStatusHandler
  │
  │ eventStore.getOrderById(orderId)
  ▼
EventStore
  │
  │ [상태 복원]
  │ 4개의 이벤트를 순서대로 재생
  │ 1. onOrderCreatedEvent()
  │ 2. onPaymentAttemptedEvent()
  │ 3. onPaymentSucceededEvent()
  │ 4. onOrderCompletedEvent()
  │
  │ 최종 상태: COMPLETED
  ▼
응답
  │
  │ {
  │   "orderId": "ORDER-xxx",
  │   "status": "COMPLETED",
  │   "finalAmount": 900000,
  │   "eventCount": 4
  │ }
  ▼
사용자
```

---

## 실패 시나리오 1: 잔액 부족

### 📝 시나리오 개요
50만원 상품을 10% 할인으로 주문(결제 금액: 45만원)하지만, 사용자 잔액이 30만원만 있어 결제 실패

### 🔄 주요 차이점

```
OrderAggregate.processPayment(300000)  ← 부족한 잔액
  │
  │ [상태 검증] ✓
  │ [이벤트 1] PaymentAttemptedEvent ✓
  │
  │ [할인율 검증] ✓ (10% <= 50%)
  │
  │ [잔액 검증] ✗
  │ userBalance(300,000) < finalAmount(450,000)
  │
  │ [이벤트 2: 결제 실패]
  │ apply(PaymentFailedEvent)
  │   - reason: INSUFFICIENT_BALANCE
  │   - errorMessage: "잔액이 부족합니다"
  │   - additionalInfo: {
  │       currentBalance: 300000
  │     }
  │   - status: PAYMENT_FAILED
  │
  │ ⛔ return (더 이상 진행하지 않음)
  ▼
EventStore
  │
  │ [저장된 이벤트]
  │ orderId -> [
  │   OrderCreatedEvent,
  │   PaymentAttemptedEvent,
  │   PaymentFailedEvent      ← 실패 이벤트
  │ ]
```

### 이벤트 스토어 상태

```
┌─────────────────────────────────────────────────┐
│ Event Store                                     │
├─────────────────────────────────────────────────┤
│ ORDER-xxx:                                      │
│   1. OrderCreatedEvent                          │
│      - finalAmount: 450,000                     │
│                                                 │
│   2. PaymentAttemptedEvent                      │
│      - amount: 450,000                          │
│                                                 │
│   3. PaymentFailedEvent ⚠️                      │
│      - reason: INSUFFICIENT_BALANCE             │
│      - errorMessage: "잔액이 부족합니다..."          │
│      - additionalInfo: {                        │
│          currentBalance: 300000                 │
│        }                                        │
│      - status: PAYMENT_FAILED                   │
└─────────────────────────────────────────────────┘
```

### 💡 핵심 포인트

1. **이벤트 불변성**: 결제 실패도 이벤트로 기록됨
2. **상세한 실패 정보**: `additionalInfo`에 현재 잔액 저장
3. **감사 추적**: "왜 실패했는가"를 정확히 추적 가능
4. **조기 반환**: 실패 시 더 이상 이벤트 발행하지 않음

---

## 실패 시나리오 2: 할인율 초과

### 📝 시나리오 개요
20만원 상품을 60% 할인으로 주문하려 하지만, 최대 할인율(50%)을 초과하여 결제 실패

### 🔄 주요 차이점

```
OrderAggregate.processPayment(1000000)  ← 충분한 잔액
  │
  │ [상태 검증] ✓
  │ [이벤트 1] PaymentAttemptedEvent ✓
  │
  │ [할인율 검증] ✗
  │ discountRate(60) > MAX_DISCOUNT_RATE(50)
  │
  │ [이벤트 2: 결제 실패]
  │ apply(PaymentFailedEvent)
  │   - reason: INVALID_DISCOUNT_RATE
  │   - errorMessage: "할인율이 최대 허용치를 초과..."
  │   - additionalInfo: {
  │       requestedDiscountRate: 60,
  │       maxAllowedDiscountRate: 50
  │     }
  │   - status: PAYMENT_FAILED
  │
  │ ⛔ return (잔액 검증까지 가지 않음)
  ▼
EventStore
  │
  │ [저장된 이벤트]
  │ orderId -> [
  │   OrderCreatedEvent,
  │   PaymentAttemptedEvent,
  │   PaymentFailedEvent      ← 할인율 문제
  │ ]
```

### 이벤트 스토어 상태

```
┌─────────────────────────────────────────────────┐
│ Event Store                                     │
├─────────────────────────────────────────────────┤
│ ORDER-xxx:                                      │
│   1. OrderCreatedEvent                          │
│      - price: 200,000                           │
│      - discountRate: 60                         │
│      - finalAmount: 80,000                      │
│                                                 │
│   2. PaymentAttemptedEvent                      │
│      - amount: 80,000                           │
│                                                 │
│   3. PaymentFailedEvent ⚠️                      │
│      - reason: INVALID_DISCOUNT_RATE            │
│      - errorMessage: "할인율이 최대 허용치..."       │
│      - additionalInfo: {                        │
│          requestedDiscountRate: 60,             │
│          maxAllowedDiscountRate: 50             │
│        }                                        │
│      - status: PAYMENT_FAILED                   │
└─────────────────────────────────────────────────┘
```

### 💡 핵심 포인트

1. **검증 순서**: 할인율 → 잔액 순으로 검증
2. **조기 실패**: 첫 번째 검증 실패 시 즉시 중단
3. **상세한 컨텍스트**: 요청한 할인율과 최대 허용치 모두 기록

---

## 컴포넌트 역할 상세 설명

### 1️⃣ Controller (HTTP 계층)

**역할**: HTTP 요청을 Command/Query로 변환

```typescript
OrderController
  │
  ├─ 요청 검증
  │  - DTO 유효성 검사
  │  - 필수 필드 확인
  │
  ├─ Command 생성
  │  - CreateOrderCommand
  │  - ProcessPaymentCommand
  │
  ├─ Query 생성
  │  - GetOrderStatusQuery
  │  - GetOrderHistoryQuery
  │
  └─ 응답 포맷팅
     - 성공: { success: true, data }
     - 실패: { success: false, message }
```

### 2️⃣ Command Handler

**역할**: Command를 받아 Aggregate 조작

```typescript
CreateOrderHandler
  1. EventPublisher로 Aggregate 생성
  2. Aggregate.createOrder() 호출
  3. commit() - 이벤트 발행

ProcessPaymentHandler
  1. EventStore에서 Aggregate 복원
  2. EventPublisher로 래핑
  3. Aggregate.processPayment() 호출
  4. commit() - 이벤트 발행
```

### 3️⃣ Aggregate (핵심 비즈니스 로직)

**역할**: 비즈니스 규칙 검증 및 이벤트 발행

```typescript
OrderAggregate
  │
  ├─ 상태 관리
  │  - orderId, userId, status 등
  │  - 이벤트로만 상태 변경
  │
  ├─ 비즈니스 로직
  │  - createOrder(): 주문 생성 검증
  │  - processPayment(): 결제 검증
  │  - cancelOrder(): 취소 검증
  │
  ├─ 이벤트 발행
  │  - apply(event): 이벤트 발행 및 적용
  │
  └─ 이벤트 핸들러
     - onOrderCreatedEvent()
     - onPaymentAttemptedEvent()
     - onPaymentFailedEvent()
     - onPaymentSucceededEvent()
     - onOrderCompletedEvent()
```

### 4️⃣ Event Store

**역할**: 이벤트 저장 및 Aggregate 복원

```typescript
EventStore
  │
  ├─ 이벤트 저장
  │  - subscribeToEvents(): EventBus 구독
  │  - saveEvent(): Map에 이벤트 저장
  │  - Map<orderId, Event[]>
  │
  ├─ 이벤트 조회
  │  - getEventsByOrderId(): 특정 주문의 이벤트
  │  - getAllOrderIds(): 모든 주문 ID
  │
  └─ Aggregate 복원
     - getOrderById(): 이벤트 재생으로 복원
     - applyEventToAggregate(): 이벤트 적용
```

### 5️⃣ Query Handler

**역할**: 읽기 전용 조회

```typescript
GetOrderStatusHandler
  1. EventStore.getOrderById()
  2. Aggregate 상태 반환
  3. OrderStatusDto 생성

GetOrderHistoryHandler
  1. EventStore.getEventsByOrderId()
  2. 이벤트 배열을 DTO로 변환
  3. OrderHistoryDto 생성
```

---

## 이벤트 스토어 동작 원리

### 📦 저장 구조

```typescript
// 메모리 기반 저장소
private eventStore = new Map<string, IEvent[]>();

// 예시 데이터
{
  "ORDER-123": [
    OrderCreatedEvent { ... },
    PaymentAttemptedEvent { ... },
    PaymentSucceededEvent { ... },
    OrderCompletedEvent { ... }
  ],
  "ORDER-456": [
    OrderCreatedEvent { ... },
    PaymentAttemptedEvent { ... },
    PaymentFailedEvent { ... }
  ]
}
```

### 🔄 상태 복원 과정

```
getOrderById(orderId) 호출
  │
  ├─ 1. 이벤트 배열 조회
  │    const events = eventStore.get(orderId)
  │    // [Event1, Event2, Event3, ...]
  │
  ├─ 2. 빈 Aggregate 생성
  │    const order = new OrderAggregate(orderId)
  │    // 초기 상태
  │
  ├─ 3. 이벤트 순차 재생
  │    for (const event of events) {
  │      applyEventToAggregate(order, event)
  │    }
  │
  │    Event1 적용 → 상태1
  │    Event2 적용 → 상태2
  │    Event3 적용 → 상태3 (현재 상태)
  │
  └─ 4. 복원된 Aggregate 반환
```

### 💾 이벤트 저장 과정

```
EventBus.publish(event)
  │
  ├─ EventStore.subscribeToEvents()가 수신
  │
  ├─ saveEvent(event) 호출
  │   │
  │   ├─ orderId 추출
  │   │
  │   ├─ 기존 이벤트 배열 가져오기
  │   │  events = eventStore.get(orderId) || []
  │   │
  │   ├─ 새 이벤트 추가
  │   │  events.push(event)
  │   │
  │   ├─ Map에 저장
  │   │  eventStore.set(orderId, events)
  │   │
  │   └─ 로그 출력
  │      console.log(`[이벤트 저장] ${event.constructor.name}`)
  │
  └─ 완료
```

---

## 🎯 이벤트 흐름 요약

### ✅ 성공 플로우
```
POST /orders
  → CreateOrderCommand
  → OrderAggregate.createOrder()
  → OrderCreatedEvent
  → EventStore 저장

POST /orders/{id}/payment
  → ProcessPaymentCommand
  → EventStore에서 복원
  → OrderAggregate.processPayment()
  → 검증 통과
  → PaymentAttemptedEvent
  → PaymentSucceededEvent
  → OrderCompletedEvent
  → EventStore 저장 (3개 추가)

GET /orders/{id}/status
  → GetOrderStatusQuery
  → EventStore에서 복원
  → 상태 반환: COMPLETED
```

### ❌ 실패 플로우 (잔액 부족)
```
POST /orders
  → OrderCreatedEvent 저장 ✓

POST /orders/{id}/payment (잔액 부족)
  → ProcessPaymentCommand
  → EventStore에서 복원
  → OrderAggregate.processPayment()
  → PaymentAttemptedEvent ✓
  → 할인율 검증 통과 ✓
  → 잔액 검증 실패 ✗
  → PaymentFailedEvent (INSUFFICIENT_BALANCE)
  → EventStore 저장
  → 조기 종료

GET /orders/{id}/history
  → 3개 이벤트 반환
  → 실패 원인 확인 가능
```

### ❌ 실패 플로우 (할인율 초과)
```
POST /orders (60% 할인)
  → OrderCreatedEvent 저장 ✓

POST /orders/{id}/payment
  → ProcessPaymentCommand
  → EventStore에서 복원
  → OrderAggregate.processPayment()
  → PaymentAttemptedEvent ✓
  → 할인율 검증 실패 ✗ (60% > 50%)
  → PaymentFailedEvent (INVALID_DISCOUNT_RATE)
  → EventStore 저장
  → 조기 종료 (잔액 검증까지 가지 않음)
```

---

## 🔍 디버깅 팁

### 이벤트 추적하기

콘솔에서 이벤트 저장을 실시간으로 확인할 수 있습니다:

```bash
# 서버 실행
pnpm run es:start:dev

# 요청 후 콘솔 확인
[이벤트 저장] OrderCreatedEvent: { orderId: 'ORDER-xxx', totalEvents: 1 }
[이벤트 저장] PaymentAttemptedEvent: { orderId: 'ORDER-xxx', totalEvents: 2 }
[이벤트 저장] PaymentFailedEvent: { orderId: 'ORDER-xxx', totalEvents: 3 }
```

### 이벤트 히스토리 분석

```bash
# 전체 히스토리 조회
GET /orders/{orderId}/history

# 응답에서 확인할 항목:
# 1. events.length - 총 이벤트 개수
# 2. 각 event.eventType - 어떤 이벤트가 발생했는지
# 3. 각 event.timestamp - 시간순 확인
# 4. PaymentFailedEvent.data.reason - 실패 원인
# 5. PaymentFailedEvent.data.additionalInfo - 상세 정보
```

---

## 📚 더 알아보기

- [README.md](./README.md) - 전체 프로젝트 개요
- [코드 구조 설명](./README.md#-프로젝트-구조)
- [실습 시나리오](./README.md#-실습-시나리오)
