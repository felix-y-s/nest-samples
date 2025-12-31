# 이벤트 소싱 예제 (Event Sourcing Sample)

NestJS CQRS 패턴을 활용한 **이벤트 소싱** 구현 예제입니다.

## 📚 이벤트 소싱이란?

**이벤트 소싱**은 애플리케이션의 상태 변화를 **이벤트**의 시퀀스로 저장하는 아키텍처 패턴입니다.

### 전통적인 방식 vs 이벤트 소싱

```
전통적인 방식:
┌──────────────────┐
│ 주문 ID: ORDER-1 │
│ 상태: COMPLETED  │
│ 금액: 90,000원   │
└──────────────────┘
→ 현재 상태만 저장, 과거 이력 불명확

이벤트 소싱:
┌────────────────────────────────────────┐
│ 1. OrderCreated (100,000원, 10% 할인)  │
│ 2. PaymentAttempted (90,000원)         │
│ 3. PaymentSucceeded (TXN-12345)        │
│ 4. OrderCompleted                      │
└────────────────────────────────────────┘
→ 모든 변화를 이벤트로 기록, 완전한 감사 추적
```

## 📚 학습 가이드

### 🔄 [EVENT_FLOW.md](./EVENT_FLOW.md)
**이벤트 흐름 로드맵** - 사용자 요청부터 이벤트 발생, 저장, 조회까지의 전체 흐름을 단계별로 상세히 설명합니다.

### 🚌 [COMMAND_QUERY_BUS.md](./COMMAND_QUERY_BUS.md)
**Command Bus & Query Bus 가이드** - CQRS 패턴의 핵심인 Command Bus와 Query Bus의 동작 원리, 차이점, 사용법을 상세히 설명합니다.

## 🎯 구현 시나리오

주문/결제 시스템을 통해 다음 상황들을 학습합니다:

### ✅ 성공 케이스
1. 주문 생성
2. 충분한 잔액으로 결제 성공
3. 주문 완료

### ❌ 실패 케이스
1. **잔액 부족**: 사용자 잔액이 결제 금액보다 적은 경우
2. **할인율 초과**: 할인율이 최대 허용치(50%)를 초과한 경우

## 📁 프로젝트 구조

```
src/order/
├── events/                # 이벤트 정의 (과거형)
│   ├── order-created.event.ts
│   ├── payment-attempted.event.ts
│   ├── payment-failed.event.ts
│   ├── payment-succeeded.event.ts
│   ├── order-completed.event.ts
│   └── order-cancelled.event.ts
├── commands/              # 커맨드 정의 (명령형)
│   ├── create-order.command.ts
│   └── process-payment.command.ts
├── aggregates/            # Aggregate Root
│   └── order.aggregate.ts
├── handlers/              # 커맨드 핸들러
│   ├── create-order.handler.ts
│   └── process-payment.handler.ts
├── queries/               # 쿼리 및 핸들러
│   ├── get-order-status.query.ts
│   ├── get-order-history.query.ts
│   └── handlers/
├── services/              # 이벤트 스토어
│   └── event-store.service.ts
├── order.controller.ts    # HTTP API
└── order.module.ts        # 모듈 설정
```

## 🚀 실행 방법

### 1. 개발 서버 실행

```bash
# 개발 모드 실행
pnpm run es:start:dev

# 또는 일반 실행
pnpm run start event-sourcing-sample
```

서버가 실행되면 `http://localhost:3000`에서 API를 사용할 수 있습니다.

### 2. E2E 테스트 실행

```bash
pnpm run es:test:e2e
```

## 📡 API 엔드포인트

### 1. 주문 생성

```bash
POST http://localhost:3000/orders
Content-Type: application/json

{
  "userId": "USER-001",
  "productId": "PROD-001",
  "productName": "노트북",
  "quantity": 1,
  "price": 1000000,
  "discountRate": 10
}

# 응답
{
  "success": true,
  "orderId": "ORDER-1735621234567-abc123",
  "message": "주문이 생성되었습니다"
}
```

### 2. 결제 처리

```bash
POST http://localhost:3000/orders/ORDER-1735621234567-abc123/payment
Content-Type: application/json

{
  "userBalance": 1000000
}

# 응답 (성공)
{
  "success": true,
  "message": "결제 처리가 완료되었습니다"
}
```

### 3. 주문 상태 조회

```bash
GET http://localhost:3000/orders/ORDER-1735621234567-abc123/status

# 응답
{
  "success": true,
  "data": {
    "orderId": "ORDER-1735621234567-abc123",
    "status": "COMPLETED",
    "finalAmount": 900000,
    "eventCount": 4
  }
}
```

### 4. 이벤트 히스토리 조회

```bash
GET http://localhost:3000/orders/ORDER-1735621234567-abc123/history

# 응답
{
  "success": true,
  "data": {
    "orderId": "ORDER-1735621234567-abc123",
    "events": [
      {
        "eventType": "OrderCreatedEvent",
        "timestamp": "2025-12-31T10:00:00.000Z",
        "data": { ... }
      },
      {
        "eventType": "PaymentAttemptedEvent",
        "timestamp": "2025-12-31T10:00:05.000Z",
        "data": { ... }
      },
      {
        "eventType": "PaymentSucceededEvent",
        "timestamp": "2025-12-31T10:00:06.000Z",
        "data": { ... }
      },
      {
        "eventType": "OrderCompletedEvent",
        "timestamp": "2025-12-31T10:00:07.000Z",
        "data": { ... }
      }
    ],
    "totalEvents": 4
  }
}
```

## 🎓 실습 시나리오

### 시나리오 1: 정상 주문 및 결제

```bash
# 1. 주문 생성 (할인율 10%)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER-001",
    "productId": "PROD-001",
    "productName": "노트북",
    "quantity": 1,
    "price": 1000000,
    "discountRate": 10
  }'
# → orderId 복사

# 2. 결제 처리 (충분한 잔액)
curl -X POST http://localhost:3000/orders/{orderId}/payment \
  -H "Content-Type: application/json" \
  -d '{"userBalance": 1000000}'

# 3. 상태 확인
curl http://localhost:3000/orders/{orderId}/status
# → status: "COMPLETED"

# 4. 이벤트 히스토리 확인
curl http://localhost:3000/orders/{orderId}/history
# → 4개의 이벤트 확인
```

### 시나리오 2: 잔액 부족으로 결제 실패

```bash
# 1. 주문 생성 (50만원 상품, 10% 할인 → 45만원)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER-002",
    "productId": "PROD-002",
    "productName": "태블릿",
    "quantity": 1,
    "price": 500000,
    "discountRate": 10
  }'

# 2. 결제 시도 (잔액 30만원 - 부족!)
curl -X POST http://localhost:3000/orders/{orderId}/payment \
  -H "Content-Type: application/json" \
  -d '{"userBalance": 300000}'

# 3. 상태 확인
curl http://localhost:3000/orders/{orderId}/status
# → status: "PAYMENT_FAILED"

# 4. 실패 이유 확인 (이벤트 히스토리)
curl http://localhost:3000/orders/{orderId}/history
# → PaymentFailedEvent에서 reason: "INSUFFICIENT_BALANCE" 확인
```

### 시나리오 3: 할인율 초과로 결제 실패

```bash
# 1. 주문 생성 (할인율 60% - 최대 50% 초과!)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER-003",
    "productId": "PROD-003",
    "productName": "헤드폰",
    "quantity": 1,
    "price": 200000,
    "discountRate": 60
  }'

# 2. 결제 시도 (충분한 잔액)
curl -X POST http://localhost:3000/orders/{orderId}/payment \
  -H "Content-Type: application/json" \
  -d '{"userBalance": 1000000}'

# 3. 이벤트 히스토리 확인
curl http://localhost:3000/orders/{orderId}/history
# → PaymentFailedEvent에서:
#   - reason: "INVALID_DISCOUNT_RATE"
#   - additionalInfo.requestedDiscountRate: 60
#   - additionalInfo.maxAllowedDiscountRate: 50
```

## 💡 핵심 개념

### 1. Event (이벤트)
- **과거형 명명**: OrderCreated, PaymentFailed
- **불변성**: 한 번 발생한 이벤트는 수정 불가
- **완전한 정보**: 상태 재구성에 필요한 모든 데이터 포함

### 2. Command (커맨드)
- **명령형**: CreateOrder, ProcessPayment
- **검증**: 비즈니스 규칙 위반 시 예외 발생
- **이벤트 발행**: 성공 시 이벤트 발행

### 3. Aggregate
- **일관성 경계**: 비즈니스 규칙 적용
- **이벤트 소싱**: apply() 메서드로 이벤트 적용
- **상태 복원**: 이벤트 재생으로 현재 상태 복원

### 4. Event Store
- **이벤트 저장**: 시간순으로 모든 이벤트 보관
- **상태 복원**: 저장된 이벤트로 Aggregate 상태 재구성
- **감사 추적**: 완벽한 이력 조회 가능

## 🔍 이벤트 소싱의 장점

1. **완벽한 감사 추적**: 모든 변경 이력을 추적 가능
2. **시간 여행**: 과거 특정 시점의 상태 복원 가능
3. **디버깅 용이**: 문제 발생 시 이벤트 히스토리로 추적
4. **이벤트 기반 아키텍처**: 마이크로서비스 간 통신에 유리
5. **CQRS 자연스러운 구현**: Command와 Query 분리

## ⚠️ 주의사항

1. **이벤트 불변성**: 발생한 이벤트는 절대 수정 불가
2. **보상 이벤트**: 실수를 수정하려면 새로운 이벤트 발행
3. **스키마 진화**: 이벤트 구조 변경 시 버전 관리 필요
4. **저장소 크기**: 모든 이벤트 저장으로 인한 저장 공간 증가

## 📖 더 학습하기

- [NestJS CQRS 공식 문서](https://docs.nestjs.com/recipes/cqrs)
- [이벤트 소싱 패턴 (Martin Fowler)](https://martinfowler.com/eaaDev/EventSourcing.html)
- [CQRS 패턴](https://docs.microsoft.com/en-us/azure/architecture/patterns/cqrs)
