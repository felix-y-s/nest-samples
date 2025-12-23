# NestJS + RxJS 패턴 프로덕션 사용 여부 검토

실제 프로덕션 환경에서 사용되는 패턴과 학습용 패턴 구분

---

## 02-websocket.md - WebSocket Gateway with RxJS Subject

### ❌ **프로덕션에서 거의 안 씀 (20%)**

**학습용 패턴 (실무에서 안 씀):**
1. ❌ **Subject 기반 채팅방 구현 (Pattern 1)**
   ```typescript
   private messages$ = new Subject<ChatMessage>();

   getRoomMessages(roomId: string): Observable<ChatMessage> {
     return this.messages$.pipe(
       filter((msg) => msg.roomId === roomId)
     );
   }
   ```
   - 실무: **Redis Pub/Sub + Socket.IO Room** 사용
   - 메모리 기반은 서버 재시작 시 메시지 손실
   - 분산 환경(여러 서버)에서 작동 불가

2. ❌ **BehaviorSubject로 온라인 사용자 관리 (Pattern 2)**
   ```typescript
   private onlineUsers$ = new BehaviorSubject<OnlineUsers>({});

   handleConnection(client: Socket) {
     const currentUsers = this.onlineUsers$.value;
     this.onlineUsers$.next({
       ...currentUsers,
       [client.id]: userData
     });
   }
   ```
   - 실무: **Redis Set + Hash** 사용
   - 문제점:
     - 메모리 누수 위험 (사용자 수 증가 시)
     - O(n) 성능 (사용자 추가/삭제)
     - 서버 재시작 시 데이터 손실
     - 분산 환경에서 작동 불가

3. ❌ **전체 사용자 목록 브로드캐스트 (Pattern 2)**
   ```typescript
   private broadcastOnlineUsers() {
     const users = Object.values(this.onlineUsers$.value);
     this.server.emit('onlineUsers', { count: users.length, users });
   }
   ```
   - 실무: **증분 업데이트(Incremental Update)** 사용
   - 문제점:
     - 비효율적 네트워크 사용 (1000명 × 1KB = 1MB 매번 전송)
     - 실무에서는 변경된 사용자만 전송
   - 올바른 방식:
     ```typescript
     // ✅ 입장 시
     this.server.emit('userJoined', { userId, username });

     // ✅ 퇴장 시
     this.server.emit('userLeft', { userId });

     // ✅ 전체 목록은 초기 연결 시에만
     client.emit('onlineUsers', { users: [...] });
     ```

4. ❌ **ReplaySubject로 메시지 히스토리 (Pattern 3)**
   ```typescript
   private messageHistory$ = new ReplaySubject<ChatMessage>(100);
   ```
   - 실무: **PostgreSQL/MongoDB + 페이지네이션** 사용
   - 문제점:
     - 메모리에만 저장 (서버 재시작 시 손실)
     - 100개 제한 (실제로는 수천/수만 개 필요)
     - 검색 기능 불가능

5. ❌ **Observable 반환 실시간 업데이트 (Pattern 4)**
   ```typescript
   @SubscribeMessage('subscribeToStock')
   handleSubscribeStock(@MessageBody() symbol: string): Observable<any> {
     return interval(1000).pipe(
       map(() => ({ symbol, price: Math.random() * 1000 }))
     );
   }
   ```
   - 실무에서는 사용하지만 **외부 데이터 소스 연동 필요**
   - 학습용 `interval()` 대신 실제 WebSocket/API 연동

6. ❌ **여러 Subject 조합 (Pattern 5)**
   ```typescript
   private messages$ = new Subject<ChatMessage>();
   private typing$ = new Subject<TypingEvent>();
   private reactions$ = new Subject<ReactionEvent>();

   merge(
     this.messages$.pipe(map(msg => ({ type: 'message', data: msg }))),
     this.reactions$.pipe(map(r => ({ type: 'reaction', data: r })))
   ).subscribe(event => this.server.emit('timeline', event));
   ```
   - 실무: **Redis Streams + Bull Queue** 사용
   - RxJS 조합은 복잡도만 증가

**실무에서 사용하는 WebSocket 패턴:**
1. ✅ **Socket.IO 기본 패턴 (단일 서버)**
   ```typescript
   @WebSocketGateway({ cors: { origin: '*' } })
   export class ChatGateway {
     @WebSocketServer() server: Server;

     @SubscribeMessage('message')
     handleMessage(@MessageBody() data: string, @ConnectedSocket() client: Socket) {
       // 특정 룸에만 전송
       this.server.to(roomId).emit('message', data);
     }
   }
   ```
   - RxJS Subject 없이 Socket.IO 자체 기능 사용
   - Room 기능으로 채널 분리

2. ✅ **Redis Adapter (다중 서버 분산 환경)**
   ```typescript
   import { createAdapter } from '@socket.io/redis-adapter';
   import { createClient } from 'redis';

   const pubClient = createClient({ url: 'redis://localhost:6379' });
   const subClient = pubClient.duplicate();

   io.adapter(createAdapter(pubClient, subClient));
   ```
   - 여러 서버 간 WebSocket 메시지 동기화
   - Redis Pub/Sub으로 브로드캐스트

3. ✅ **상태 저장은 Redis 사용**
   ```typescript
   // 온라인 사용자 저장
   await redis.sadd(`room:${roomId}:users`, userId);
   await redis.hset(`user:${userId}`, { username, socketId });

   // 조회
   const users = await redis.smembers(`room:${roomId}:users`);
   ```

4. ✅ **메시지 히스토리는 DB 저장**
   ```typescript
   // PostgreSQL 저장
   await this.messageRepository.save({
     roomId,
     userId,
     message,
     createdAt: new Date()
   });

   // 최근 메시지 조회 (페이지네이션)
   const messages = await this.messageRepository.find({
     where: { roomId },
     order: { createdAt: 'DESC' },
     take: 50,
     skip: page * 50
   });
   ```

### 성능 비교

| 기능 | RxJS Subject (학습용) | 프로덕션 패턴 | 성능 차이 |
|------|----------------------|---------------|----------|
| 온라인 사용자 | BehaviorSubject | Redis Set | 100배 ⬆️ |
| 메시지 전송 | Subject.next() | Redis Pub/Sub | 10배 ⬆️ |
| 히스토리 저장 | ReplaySubject(100) | PostgreSQL | 무한 확장 |
| 전체 목록 전송 | 1MB/이벤트 | 100bytes/이벤트 | 1000배 ⬆️ |

### 결론
- **WebSocket Gateway 자체는 프로덕션 필수**
- **RxJS Subject 패턴은 100% 학습용**
- **실무: Socket.IO + Redis + PostgreSQL**
- **분산 환경에서는 Redis Adapter 필수**

---

## 03-guards.md - Guards & Authentication

### ✅ **프로덕션에서 사용됨 (70%)**

**실무에서 사용하는 패턴:**
1. **JWT 토큰 검증 (Pattern 1)** - ✅ 매우 일반적
   ```typescript
   // ✅ 실무 사용: Promise 방식이 더 일반적
   async canActivate(context: ExecutionContext): Promise<boolean> {
     const token = this.extractToken(context);
     const payload = await this.jwtService.verifyAsync(token);
     request.user = payload;
     return true;
   }
   ```
   - RxJS Observable 방식은 **학습용**
   - 실무에서는 **async/await (Promise)** 방식 선호

2. **Role 기반 인가 (Pattern 2)** - ✅ 필수 패턴
   ```typescript
   @Roles('admin')
   @UseGuards(JwtAuthGuard, RolesGuard)
   ```
   - Guard 조합은 실무에서 필수
   - 하지만 역할 조회도 **Promise** 방식 선호

3. **조건부 Guard (Pattern 6)** - ✅ 실무 필수
   ```typescript
   @Public()  // 인증 생략
   ```

**학습용 패턴 (실무에서 안 씀):**
1. ❌ **Observable 기반 인증 캐싱 (Pattern 3)** - BehaviorSubject 사용
   - 실무: **Redis 캐시** 사용
   - 메모리 기반 캐시는 분산 환경에서 불가

2. ❌ **forkJoin 기반 복합 권한 확인 (Pattern 4)**
   - 실무: **Promise.all()** 사용
   - RxJS는 불필요한 복잡도

3. ❌ **Rate Limiting Guard with BehaviorSubject (Pattern 5)**
   - 실무: **Redis + @nestjs/throttler** 패키지 사용

### 결론
- **Guard 자체는 프로덕션 필수**
- **RxJS Observable 반환은 학습용**
- **실무: Promise<boolean> 반환 방식 사용**

---

## 04-events.md - Event-Driven Architecture

### △ **혼용 (50% 프로덕션 / 50% 학습용)**

**실무에서 사용하는 패턴:**
1. **EventEmitter2 기본 사용 (Pattern 기본)** - ✅ 실무 일반적
   ```typescript
   @OnEvent('order.created')
   handleOrderCreated(event: OrderCreatedEvent) {
     // 이벤트 처리
   }
   ```
   - NestJS 공식 패턴
   - 간단한 이벤트 처리에 적합

**학습용 패턴 (실무에서 안 씀):**
1. ❌ **RxJS Subject 기반 EventBus (Pattern 기본)** - 메모리 저장
   ```typescript
   private eventStream$ = new Subject<DomainEvent>();
   ```
   - 실무: **Redis Pub/Sub** 또는 **RabbitMQ** 사용
   - 단일 서버에서만 작동

2. ❌ **Saga 패턴 with RxJS (Pattern 1)**
   - 실무: **Bull Queue + Worker** 패턴 사용
   - 또는 **Temporal.io**, **Camunda** 같은 워크플로우 엔진

3. ❌ **ReplaySubject 기반 이벤트 히스토리 (Pattern 4)**
   - 실무: **PostgreSQL/MongoDB** 이벤트 저장
   - 메모리 기반은 서버 재시작 시 손실

4. ❌ **Dead Letter Queue with Subject (Pattern 5)**
   - 실무: **Bull Queue + DLQ** 또는 **SQS + DLQ**

### 결론
- **EventEmitter2는 프로덕션 사용**
- **RxJS Subject 기반 패턴은 학습용**
- **실무: Redis/RabbitMQ/Kafka 사용**

---

## 05-data-pipeline.md - Data Pipeline Processing

### ✅ **프로덕션에서 사용됨 (80%)**

**실무에서 사용하는 패턴:**
1. **병렬 API 호출 (forkJoin - Pattern 1)** - ✅ 실무 일반적
   ```typescript
   return forkJoin({
     user: this.userService.getUser(userId),
     orders: this.orderService.getRecentOrders(userId),
   });
   ```
   - **하지만**: `Promise.all()` 방식도 동등하게 많이 사용됨
   - RxJS는 추가 변환이 필요할 때만 사용

2. **의존적 순차 호출 (switchMap - Pattern 2)** - ✅ 실무 사용
   ```typescript
   return this.cartService.getCart(cartId).pipe(
     switchMap((cart) => this.paymentService.process(cart))
   );
   ```
   - **하지만**: `async/await` 방식이 더 읽기 쉬움
   - RxJS는 스트림 변환이 복잡할 때만 사용

3. **실시간 데이터 조합 (combineLatest - Pattern 3)** - ✅ 실무 사용
   ```typescript
   combineLatest([stockPrice$, exchangeRate$, userSettings$])
   ```
   - **WebSocket/SSE 실시간 데이터**에서 유용
   - HTTP API만 사용하면 불필요

4. **데이터 변환 파이프라인 (Pattern 4)** - ✅ 실무 사용
   - RxJS Operators를 활용한 복잡한 변환
   - **하지만**: 간단한 변환은 `map()` 함수로 충분

### 결론
- **RxJS Operators는 프로덕션에서 사용**
- **하지만 Promise/async-await으로 대체 가능**
- **실시간 스트림 처리에서만 진가 발휘**

---

## 06-microservices.md - Microservices Communication

### ✅ **프로덕션에서 사용됨 (90%)**

**실무에서 사용하는 패턴:**
1. **NestJS Microservices (TCP, RabbitMQ, Kafka 등)** - ✅ 프로덕션 필수
   ```typescript
   @MessagePattern({ cmd: 'sum' })
   sum(data: number[]): Observable<number> {
     return of(data.reduce((a, b) => a + b, 0));
   }
   ```
   - **NestJS 공식 마이크로서비스 패턴**
   - Observable 반환은 NestJS 표준

2. **ClientProxy 사용 (Pattern 기본)** - ✅ 프로덕션 필수
   ```typescript
   this.client.send({ cmd: 'sum' }, [1, 2, 3])
   ```
   - RxJS Observable 반환
   - NestJS에서 권장하는 방식

3. **Saga 패턴 (Pattern 2)** - ✅ 프로덕션 사용 (하지만...)
   - 실무: **Bull Queue + Worker** 방식이 더 일반적
   - RxJS Saga는 코드가 복잡해질 수 있음

### 결론
- **NestJS Microservices는 프로덕션 필수**
- **Observable 반환은 NestJS 표준**
- **하지만 Bull Queue가 더 일반적**

---

## 07-sse.md - Server-Sent Events

### ✅ **프로덕션에서 사용됨 (95%)**

**실무에서 사용하는 패턴:**
1. **SSE 엔드포인트 (모든 Pattern)** - ✅ 프로덕션 필수
   ```typescript
   @Sse('stream')
   sendEvents(): Observable<MessageEvent> {
     return interval(1000).pipe(
       map((num) => ({ data: { count: num }, type: 'count' }))
     );
   }
   ```
   - **NestJS SSE는 Observable 반환 필수**
   - 실시간 알림, 진행 상황, 대시보드에 사용

2. **진행 상황 스트리밍 (Pattern 1)** - ✅ 실무 일반적
   - 파일 업로드, 데이터 처리 진행률

3. **실시간 알림 (Pattern 2)** - ✅ 실무 일반적
   - BehaviorSubject 사용은 괜찮음 (SSE는 단일 서버)

4. **라이브 대시보드 (Pattern 3)** - ✅ 실무 일반적
   - 실시간 메트릭, 모니터링

### 결론
- **SSE는 프로덕션에서 매우 일반적**
- **RxJS Observable은 SSE에서 필수**
- **거의 모든 패턴이 실무용**

---

## 08-caching.md - Advanced Caching

### ❌ **프로덕션에서 거의 안 씀 (20%)**

**학습용 패턴 (실무에서 안 씀):**
1. ❌ **shareReplay 기반 HTTP 캐싱 (Pattern 1)**
   ```typescript
   const user$ = this.http.get<User>(`/api/users/${id}`).pipe(
     shareReplay({ bufferSize: 1, refCount: true })
   );
   ```
   - 실무: **Redis 캐시** 또는 **HTTP Cache-Control 헤더** 사용
   - 메모리 기반은 분산 환경 불가

2. ❌ **TTL 기반 메모리 캐싱 (Pattern 2)**
   - 실무: **@nestjs/cache-manager + Redis** 사용

3. ❌ **멀티 레벨 캐싱 (Pattern 3)**
   - 실무: **Redis만 사용** (L1 메모리 캐시 불필요)

4. ❌ **BehaviorSubject 기반 자동 리프레시 (Pattern 5)**
   - 실무: **Redis TTL + Background Job** 사용

**실무에서 사용하는 패턴:**
1. ✅ **Redis 기반 캐싱**
   ```typescript
   @Injectable()
   export class CacheService {
     constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

     async get(key: string): Promise<any> {
       return await this.cacheManager.get(key);
     }

     async set(key: string, value: any, ttl: number) {
       await this.cacheManager.set(key, value, { ttl });
     }
   }
   ```

### 결론
- **RxJS 기반 캐싱은 거의 학습용**
- **실무: Redis + @nestjs/cache-manager 사용**
- **shareReplay는 프론트엔드에서만 유용**

---

## 종합 결론

### ✅ **프로덕션에서 사용되는 RxJS 패턴**

1. **SSE (Server-Sent Events)** - ⭐⭐⭐⭐⭐
   - Observable 반환 필수
   - 실시간 알림, 진행 상황, 대시보드

2. **NestJS Microservices** - ⭐⭐⭐⭐
   - Observable 반환 표준
   - TCP, RabbitMQ, Kafka 통신

3. **Data Pipeline (조건부)** - ⭐⭐⭐
   - 실시간 스트림 처리 시에만 유용
   - 단순 HTTP API는 Promise로 충분

4. **EventEmitter2** - ⭐⭐⭐
   - 간단한 이벤트 처리
   - 단일 서버 환경

---

### ❌ **학습용 패턴 (프로덕션에서 안 씀)**

1. **RxJS Subject 기반 온라인 사용자 관리** - ❌
   - 실무: Redis 사용

2. **BehaviorSubject 기반 이벤트 버스** - ❌
   - 실무: Redis Pub/Sub, RabbitMQ

3. **ReplaySubject 이벤트 히스토리** - ❌
   - 실무: PostgreSQL/MongoDB

4. **shareReplay HTTP 캐싱** - ❌
   - 실무: Redis 캐시

5. **Observable 기반 Guard 캐싱** - ❌
   - 실무: Promise + Redis

6. **RxJS Saga 패턴** - ❌
   - 실무: Bull Queue + Worker

---

## 실무 권장 기술 스택

### **이벤트/메시징**
- ✅ Redis Pub/Sub (단순 이벤트)
- ✅ Bull Queue (작업 큐)
- ✅ RabbitMQ (메시지 큐)
- ✅ Kafka (대용량 스트리밍)

### **캐싱**
- ✅ Redis (@nestjs/cache-manager)
- ✅ HTTP Cache-Control 헤더
- ❌ RxJS shareReplay (프론트엔드에서만)

### **인증/인가**
- ✅ Promise 기반 Guard
- ✅ Redis 세션 저장
- ✅ JWT + @nestjs/jwt
- ❌ Observable 기반 Guard

### **실시간 통신**
- ✅ WebSocket (Socket.IO)
- ✅ SSE (Server-Sent Events) + RxJS ⭐
- ✅ NestJS Microservices + RxJS ⭐

---

## 최종 정리

| 문서 | 프로덕션 사용도 | 추천 대안 |
|------|----------------|-----------|
| **02-websocket.md** | 20% (구조만) | Socket.IO + Redis Adapter + PostgreSQL |
| **03-guards.md** | 30% (구조만) | Promise 기반 Guard |
| **04-events.md** | 50% (EventEmitter2만) | Redis Pub/Sub, Bull Queue |
| **05-data-pipeline.md** | 60% (조건부) | Promise.all(), async/await |
| **06-microservices.md** | 90% ⭐ | NestJS 표준 (그대로 사용) |
| **07-sse.md** | 95% ⭐ | 그대로 사용 |
| **08-caching.md** | 10% | Redis + @nestjs/cache-manager |

**핵심 결론:**
- **SSE와 Microservices에서만 RxJS가 필수**
- **WebSocket은 Socket.IO 기본 기능만 사용 (RxJS Subject 불필요)**
- **나머지는 Promise/async-await으로 충분**
- **Subject 기반 상태 관리는 100% 학습용**
