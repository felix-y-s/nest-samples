# 종합 프로젝트: 실시간 주문 처리 시스템 🎯

> 8가지 RxJS 패턴을 모두 활용한 실전 프로젝트

## 🎯 프로젝트 개요

### 시스템 구성

```
┌─────────────────────────────────────────────────┐
│          클라이언트 (React/Vue)                   │
│  - 주문 생성                                      │
│  - 실시간 상태 업데이트 (WebSocket)               │
│  - 진행 상황 모니터링 (SSE)                       │
└─────────────────────────────────────────────────┘
                      ↕
┌─────────────────────────────────────────────────┐
│          API Gateway (NestJS)                    │
│  - HTTP Interceptors (로깅, 타임아웃)            │
│  - Guards (인증/인가)                            │
│  - Data Pipeline (여러 API 조합)                 │
└─────────────────────────────────────────────────┘
                      ↕
┌──────────────────┬──────────────┬───────────────┐
│   Order Service  │Payment Service│ Inventory    │
│   (WebSocket)    │(Microservice)│  Service      │
└──────────────────┴──────────────┴───────────────┘
                      ↕
┌─────────────────────────────────────────────────┐
│          Event Bus (RxJS)                        │
│  - 도메인 이벤트 발행/구독                        │
│  - 이벤트 히스토리                                │
└─────────────────────────────────────────────────┘
```

---

## 📋 요구사항

### 1. HTTP Interceptors
- [x] 모든 요청/응답 로깅
- [x] 5초 타임아웃
- [x] 3번 재시도 (500번대 에러)
- [x] 표준 응답 포맷

### 2. WebSocket Gateway
- [x] 주문 상태 실시간 업데이트
- [x] 고객별 알림 전송
- [x] 관리자 대시보드 스트리밍

### 3. Guards
- [x] JWT 인증
- [x] Role 기반 인가 (customer, admin)
- [x] Rate Limiting (분당 100회)
- [x] 인증 결과 캐싱

### 4. Event-Driven Architecture
- [x] 도메인 이벤트 (ORDER_CREATED, PAYMENT_COMPLETED 등)
- [x] Saga 패턴 (주문 워크플로우)
- [x] 이벤트 히스토리 (감사 추적)

### 5. Data Pipeline
- [x] 주문 정보 + 사용자 정보 + 재고 정보 병렬 조회
- [x] 결제 처리 순차 실행
- [x] 에러 시 Fallback

### 6. Microservices
- [x] 결제 서비스 (TCP)
- [x] 알림 서비스 (RabbitMQ)
- [x] 재고 서비스 (Redis)

### 7. SSE
- [x] 주문 진행 상황 스트리밍
- [x] 관리자 대시보드 통계

### 8. Caching
- [x] 상품 정보 캐싱 (TTL 5분)
- [x] 사용자 정보 캐싱
- [x] shareReplay로 중복 요청 방지

---

## 🔨 구현 가이드

### Step 1: 프로젝트 구조

```
src/
├── modules/
│   ├── auth/
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   ├── roles.guard.ts
│   │   │   └── rate-limit.guard.ts
│   │   └── auth.service.ts
│   ├── orders/
│   │   ├── orders.controller.ts
│   │   ├── orders.service.ts
│   │   ├── orders.gateway.ts
│   │   └── events/
│   │       ├── order-created.event.ts
│   │       └── order-saga.service.ts
│   ├── payments/
│   │   ├── payments.microservice.ts
│   │   └── payments.service.ts
│   ├── inventory/
│   │   ├── inventory.service.ts
│   │   └── inventory.cache.ts
│   ├── notifications/
│   │   └── notifications.service.ts
│   └── events/
│       ├── event-bus.service.ts
│       └── event-history.service.ts
├── common/
│   ├── interceptors/
│   │   ├── logging.interceptor.ts
│   │   ├── timeout.interceptor.ts
│   │   └── transform.interceptor.ts
│   └── cache/
│       └── cache.service.ts
└── main.ts
```

### Step 2: 핵심 기능 구현

#### 주문 생성 API

```typescript
@Controller('orders')
@UseGuards(JwtAuthGuard, RateLimitGuard)
@UseInterceptors(LoggingInterceptor, TimeoutInterceptor, TransformInterceptor)
export class OrdersController {
  constructor(
    private ordersService: OrdersService,
    private eventBus: EventBusService,
  ) {}

  @Post()
  @Roles('customer')
  async createOrder(@Body() dto: CreateOrderDto, @Req() req): Promise<Order> {
    // 1. 데이터 파이프라인: 병렬 조회
    const orderData = await firstValueFrom(
      forkJoin({
        user: this.usersService.getUser(req.user.id),
        product: this.productsService.getProduct(dto.productId),
        inventory: this.inventoryService.checkStock(dto.productId),
      })
    );

    // 2. 주문 생성
    const order = await this.ordersService.create({
      ...dto,
      userId: orderData.user.id,
      amount: orderData.product.price * dto.quantity,
    });

    // 3. 이벤트 발행
    this.eventBus.publish('ORDER_CREATED', order);

    return order;
  }

  @Sse('status/:orderId')
  streamOrderStatus(@Param('orderId') orderId: string): Observable<MessageEvent> {
    return this.ordersService.getStatusStream(orderId).pipe(
      map((status) => ({
        data: { orderId, status, timestamp: new Date() },
        type: 'status',
      }))
    );
  }
}
```

#### Saga 패턴 워크플로우

```typescript
@Injectable()
export class OrderSagaService implements OnModuleInit {
  constructor(
    private eventBus: EventBusService,
    private paymentClient: ClientProxy,
    private inventoryService: InventoryService,
    private notificationService: NotificationService,
  ) {}

  onModuleInit() {
    // 주문 생성 → 결제 처리
    this.eventBus.on('ORDER_CREATED')
      .pipe(
        switchMap((event) =>
          this.paymentClient.send('process_payment', event.payload).pipe(
            map((payment) => ({ order: event.payload, payment }))
          )
        ),
        tap(({ order, payment }) => {
          this.eventBus.publish('PAYMENT_COMPLETED', { order, payment });
        }),
        retry(3),
        catchError((error) => {
          this.eventBus.publish('PAYMENT_FAILED', error);
          return EMPTY;
        })
      )
      .subscribe();

    // 결제 완료 → 재고 차감
    this.eventBus.on('PAYMENT_COMPLETED')
      .pipe(
        switchMap(({ order }) =>
          this.inventoryService.reduceStock(order.productId, order.quantity)
        ),
        tap(() => {
          this.eventBus.publish('STOCK_REDUCED', { orderId });
        })
      )
      .subscribe();

    // 재고 차감 → 배송 준비 알림
    this.eventBus.on('STOCK_REDUCED')
      .pipe(
        tap(({ orderId }) => {
          this.notificationService.notify(orderId, '배송 준비 중입니다');
          this.eventBus.publish('ORDER_COMPLETED', { orderId });
        })
      )
      .subscribe();
  }
}
```

---

## 📝 체크리스트

### 개발 단계
- [ ] 프로젝트 구조 설정
- [ ] 8가지 모듈 모두 구현
- [ ] 통합 테스트 작성
- [ ] API 문서화 (Swagger)

### 테스트
- [ ] 단위 테스트 (커버리지 >80%)
- [ ] E2E 테스트
- [ ] 성능 테스트
- [ ] 부하 테스트

### 배포
- [ ] Docker 컨테이너화
- [ ] CI/CD 파이프라인
- [ ] 모니터링 (Prometheus, Grafana)
- [ ] 로깅 (ELK Stack)

---

## 🎓 학습 목표 달성도

### 8가지 패턴 체크
- [ ] HTTP Interceptors - 로깅, 타임아웃, 재시도
- [ ] WebSocket Gateway - 실시간 알림
- [ ] Guards - JWT, Role, Rate Limiting
- [ ] Event-Driven - Saga, 이벤트 버스
- [ ] Data Pipeline - forkJoin, switchMap
- [ ] Microservices - TCP, RabbitMQ
- [ ] SSE - 진행 상황 스트리밍
- [ ] Caching - shareReplay, TTL

### 성능 지표
- [ ] 평균 응답 시간 < 200ms
- [ ] 동시 사용자 1000명 이상 처리
- [ ] 캐시 히트율 > 80%
- [ ] 에러율 < 0.1%

---

## 🏆 완성 후 다음 단계

1. **포트폴리오 작성**
   - GitHub README 작성
   - 데모 영상 녹화
   - 기술 블로그 포스팅

2. **실전 적용**
   - 개인 프로젝트에 패턴 적용
   - 회사 프로젝트에 제안
   - 오픈소스 기여

3. **심화 학습**
   - RxJS 고급 패턴
   - Custom Operators 작성
   - GraphQL Subscriptions
   - React/Angular에서 RxJS

---

**축하합니다! 🎉**

> 8주간의 여정을 완료했습니다!
> 이제 여러분은 NestJS와 RxJS의 고수입니다!

**마지막 조언:**
- 지속적으로 실습하세요
- 커뮤니티에 질문하고 답변하세요
- 자신만의 패턴을 만들어보세요
- 즐기면서 코딩하세요! 🚀
