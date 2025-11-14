# Microservices Communication with RxJS 🌐

> 마이크로서비스 간 RxJS 기반 비동기 통신 패턴

## 📚 NestJS Microservices Transporters

- **TCP**: 기본, 빠른 통신
- **Redis**: Pub/Sub 패턴
- **NATS**: 고성능 메시징
- **RabbitMQ**: 안정적 메시지 큐
- **Kafka**: 대용량 이벤트 스트리밍
- **gRPC**: 고성능 RPC

---

## 🚀 기본 구현

### TCP Microservice 설정

```typescript
// main.ts (마이크로서비스)
const app = await NestFactory.createMicroservice<MicroserviceOptions>(
  AppModule,
  {
    transport: Transport.TCP,
    options: {
      host: '127.0.0.1',
      port: 8877,
    },
  },
);
await app.listen();

// app.module.ts (클라이언트)
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'MATH_SERVICE',
        transport: Transport.TCP,
        options: {
          host: '127.0.0.1',
          port: 8877,
        },
      },
    ]),
  ],
})
export class AppModule {}
```

### 메시지 패턴 (Request-Response)

```typescript
// 마이크로서비스
@Controller()
export class MathController {
  @MessagePattern({ cmd: 'sum' })
  sum(data: number[]): Observable<number> {
    return of(data.reduce((a, b) => a + b, 0));
  }

  @MessagePattern({ cmd: 'multiply' })
  multiply(data: number[]): Observable<number> {
    return of(data.reduce((a, b) => a * b, 1));
  }
}

// 클라이언트
@Injectable()
export class AppService {
  constructor(@Inject('MATH_SERVICE') private client: ClientProxy) {}

  calculate(): Observable<number> {
    return this.client.send({ cmd: 'sum' }, [1, 2, 3, 4, 5]).pipe(
      timeout(5000),
      retry(3),
      catchError((error) => {
        console.error('Calculation failed:', error);
        return of(0);
      })
    );
  }
}
```

### 이벤트 패턴 (Fire and Forget)

```typescript
// 마이크로서비스
@Controller()
export class EventsController {
  @EventPattern('user_created')
  handleUserCreated(data: Record<string, unknown>) {
    console.log('User created:', data);
    // 이메일 발송, 알림 등
  }
}

// 클라이언트
@Injectable()
export class UserService {
  constructor(@Inject('NOTIFICATION_SERVICE') private client: ClientProxy) {}

  async createUser(dto: CreateUserDto) {
    const user = await this.userRepository.save(dto);
    
    // 이벤트 발행 (응답 대기 안 함)
    this.client.emit('user_created', user);
    
    return user;
  }
}
```

---

## 💡 실전 패턴

### Pattern 1: RabbitMQ with Retry

```typescript
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'ORDER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: 'orders_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
})
export class AppModule {}

@Injectable()
export class OrderClient {
  constructor(@Inject('ORDER_SERVICE') private client: ClientProxy) {}

  processOrder(order: Order): Observable<OrderResult> {
    return this.client.send('process_order', order).pipe(
      timeout(10000),
      retry({
        count: 3,
        delay: (error, retryCount) => {
          console.log(`Retry ${retryCount}: ${error.message}`);
          return timer(Math.pow(2, retryCount) * 1000);
        },
      }),
      catchError((error) => {
        // Dead Letter Queue로 전송
        this.client.emit('order_failed', { order, error: error.message });
        return throwError(() => error);
      })
    );
  }
}
```

### Pattern 2: 분산 트랜잭션 (Saga)

```typescript
@Injectable()
export class OrderSagaService {
  constructor(
    @Inject('PAYMENT_SERVICE') private paymentClient: ClientProxy,
    @Inject('INVENTORY_SERVICE') private inventoryClient: ClientProxy,
    @Inject('SHIPPING_SERVICE') private shippingClient: ClientProxy,
  ) {}

  executeOrderSaga(order: Order): Observable<OrderResult> {
    return of(order).pipe(
      // 1. 결제 처리
      switchMap((order) =>
        this.paymentClient.send('process_payment', order).pipe(
          map((payment) => ({ order, payment }))
        )
      ),
      // 2. 재고 확인 및 차감
      switchMap(({ order, payment }) =>
        this.inventoryClient.send('reserve_stock', order.items).pipe(
          map((inventory) => ({ order, payment, inventory }))
        )
      ),
      // 3. 배송 준비
      switchMap(({ order, payment, inventory }) =>
        this.shippingClient.send('prepare_shipment', order).pipe(
          map((shipment) => ({ order, payment, inventory, shipment }))
        )
      ),
      // 에러 발생 시 보상 트랜잭션
      catchError((error, caught) => {
        console.error('Saga failed, executing compensation:', error);
        // 역순으로 롤백
        return this.executeCompensation(error.lastSuccessfulStep);
      })
    );
  }

  private executeCompensation(step: string): Observable<any> {
    // 보상 트랜잭션 로직
    return EMPTY;
  }
}
```

### Pattern 3: 병렬 마이크로서비스 호출

```typescript
@Injectable()
export class AggregatorService {
  constructor(
    @Inject('USER_SERVICE') private userClient: ClientProxy,
    @Inject('ORDER_SERVICE') private orderClient: ClientProxy,
    @Inject('RECOMMENDATION_SERVICE') private recommendationClient: ClientProxy,
  ) {}

  getUserDashboard(userId: string): Observable<Dashboard> {
    return forkJoin({
      user: this.userClient.send('get_user', userId),
      orders: this.orderClient.send('get_recent_orders', { userId, limit: 10 }),
      recommendations: this.recommendationClient.send('get_recommendations', userId),
    }).pipe(
      map(({ user, orders, recommendations }) => ({
        userName: user.name,
        recentOrders: orders,
        recommendations: recommendations.slice(0, 5),
      })),
      timeout(5000),
      catchError((error) => {
        console.error('Dashboard aggregation failed:', error);
        return of(this.getDefaultDashboard());
      })
    );
  }
}
```

---

## 📝 실습 과제

### 과제 1: TCP 마이크로서비스 ⭐⭐
기본 TCP 통신, 재시도 로직, 타임아웃 처리

### 과제 2: RabbitMQ 이벤트 ⭐⭐⭐
이벤트 기반 통신, Dead Letter Queue

### 과제 3: Saga 패턴 ⭐⭐⭐⭐
분산 트랜잭션 및 보상 트랜잭션

### 과제 4: 서비스 Aggregator ⭐⭐⭐
여러 마이크로서비스를 병렬 호출하여 데이터 조합

---

## 🎓 학습 정리

**핵심 개념:**
- ClientProxy: 마이크로서비스 클라이언트
- send(): Request-Response 패턴
- emit(): Event 패턴 (Fire and Forget)
- Saga: 분산 트랜잭션 패턴

**다음:** [07-sse.md](./07-sse.md)
