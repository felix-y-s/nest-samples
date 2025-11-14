# WebSocket Gateway with RxJS Subject 🔄

> 실시간 양방향 통신을 위한 WebSocket과 RxJS Subject를 활용한 이벤트 스트림 관리

## 📚 목차

1. [개념 이해](#개념-이해)
2. [Subject란?](#subject란)
3. [기본 구현](#기본-구현)
4. [실전 패턴](#실전-패턴)
5. [실습 과제](#실습-과제)

---

## 🎯 개념 이해

### WebSocket vs HTTP

| 특성 | HTTP | WebSocket |
|------|------|-----------|
| 통신 방식 | 단방향 (요청/응답) | 양방향 |
| 연결 | 매 요청마다 연결 | 지속적 연결 |
| 오버헤드 | 높음 (헤더 반복) | 낮음 |
| 실시간성 | 폴링 필요 | 즉시 전달 |
| 사용 사례 | REST API | 채팅, 알림, 실시간 업데이트 |

### WebSocket 흐름

```
Client A                Server                 Client B
   |                      |                        |
   |--[connect]---------->|                        |
   |                      |<------[connect]--------|
   |                      |                        |
   |--[message: "Hi"]---->|                        |
   |                      |---[broadcast]--------->|
   |                      |                        |
   |<-----[ack]-----------|                        |
   |                      |                        |
```

---

## 🧩 Subject란?

### Observable vs Subject

```typescript
// Observable: 단방향 (읽기 전용)
const observable$ = new Observable(subscriber => {
  subscriber.next(1);
  subscriber.next(2);
});

// Subject: 양방향 (읽기 + 쓰기)
const subject$ = new Subject();
subject$.next(1);        // 값 발행
subject$.subscribe(...); // 구독
```

### Subject의 종류

| 종류 | 특징 | 사용 사례 |
|------|------|-----------|
| **Subject** | 기본형, 구독 후 값만 받음 | 실시간 이벤트 |
| **BehaviorSubject** | 최신 값 1개 저장 | 상태 관리 |
| **ReplaySubject** | 여러 값 저장 후 재생 | 이벤트 히스토리 |
| **AsyncSubject** | 완료 시 마지막 값만 | 단일 비동기 결과 |

### WebSocket에서 Subject 사용 이유

```typescript
// ✅ Subject: 여러 클라이언트에게 동시 브로드캐스트
private messages$ = new Subject<Message>();

// 클라이언트 A가 메시지 발송
this.messages$.next({ user: 'A', text: 'Hello' });

// 모든 구독자(클라이언트 B, C, D...)가 동시에 수신
this.messages$.subscribe(msg => {
  this.server.emit('message', msg); // 브로드캐스트
});
```

---

## 🚀 기본 구현

### 1. 패키지 설치

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io
npm install @types/socket.io --save-dev
```

### 2. 기본 WebSocket Gateway

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // 프로덕션에서는 특정 도메인만 허용
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger(ChatGateway.name);

  // 클라이언트 연결 시
  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  // 클라이언트 연결 해제 시
  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // 메시지 수신
  @SubscribeMessage('message')
  handleMessage(
    @MessageBody() data: string,
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`Message from ${client.id}: ${data}`);

    // 모든 클라이언트에게 브로드캐스트
    this.server.emit('message', {
      clientId: client.id,
      message: data,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### 3. Module 등록

```typescript
import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';

@Module({
  providers: [ChatGateway],
})
export class ChatModule {}
```

---

## 💡 실전 패턴

### Pattern 1: Subject로 채팅방 구현

```typescript
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface ChatMessage {
  roomId: string;
  userId: string;
  message: string;
  timestamp: Date;
}

@WebSocketGateway()
export class ChatRoomGateway {
  @WebSocketServer()
  server: Server;

  // 전체 메시지 스트림
  private messages$ = new Subject<ChatMessage>();

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() roomId: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.join(roomId);
    this.logger.log(`Client ${client.id} joined room ${roomId}`);

    // 해당 방의 메시지만 구독
    this.getRoomMessages(roomId).subscribe((msg) => {
      client.emit('message', msg);
    });
  }

  @SubscribeMessage('sendMessage')
  handleSendMessage(
    @MessageBody() data: { roomId: string; userId: string; message: string },
    @ConnectedSocket() client: Socket,
  ) {
    const chatMessage: ChatMessage = {
      ...data,
      timestamp: new Date(),
    };

    // Subject에 메시지 발행
    this.messages$.next(chatMessage);
  }

  // 특정 방의 메시지만 필터링
  private getRoomMessages(roomId: string): Observable<ChatMessage> {
    return this.messages$.pipe(
      filter((msg) => msg.roomId === roomId),
      map((msg) => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      }))
    );
  }
}
```

**학습 포인트:**
- `Subject`: 모든 메시지를 중앙에서 관리
- `filter`: 특정 조건(방 ID)에 맞는 메시지만 전달
- `map`: 데이터 변환 (Date → ISO String)

### Pattern 2: BehaviorSubject로 온라인 사용자 관리

```typescript
import { BehaviorSubject } from 'rxjs';

interface OnlineUsers {
  [socketId: string]: {
    userId: string;
    username: string;
    joinedAt: Date;
  };
}

@WebSocketGateway()
export class PresenceGateway {
  @WebSocketServer()
  server: Server;

  // 현재 온라인 사용자 상태 (항상 최신 상태 유지)
  private onlineUsers$ = new BehaviorSubject<OnlineUsers>({});

  handleConnection(client: Socket) {
    const userId = client.handshake.auth.userId;
    const username = client.handshake.auth.username;

    // 사용자 추가
    const currentUsers = this.onlineUsers$.value;
    this.onlineUsers$.next({
      ...currentUsers,
      [client.id]: {
        userId,
        username,
        joinedAt: new Date(),
      },
    });

    // 모든 클라이언트에게 업데이트된 사용자 목록 전송
    this.broadcastOnlineUsers();
  }

  handleDisconnect(client: Socket) {
    // 사용자 제거
    const currentUsers = this.onlineUsers$.value;
    const { [client.id]: removed, ...remainingUsers } = currentUsers;
    this.onlineUsers$.next(remainingUsers);

    this.broadcastOnlineUsers();
  }

  private broadcastOnlineUsers() {
    const users = Object.values(this.onlineUsers$.value);
    this.server.emit('onlineUsers', {
      count: users.length,
      users: users.map(u => ({
        userId: u.userId,
        username: u.username,
      })),
    });
  }

  // 현재 온라인 사용자 조회
  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers(@ConnectedSocket() client: Socket) {
    client.emit('onlineUsers', {
      count: Object.keys(this.onlineUsers$.value).length,
      users: Object.values(this.onlineUsers$.value),
    });
  }
}
```

**학습 포인트:**
- `BehaviorSubject`: 항상 현재 상태(최신 값) 유지
- `.value`: 현재 상태에 즉시 접근
- 새 클라이언트 접속 시 최신 상태 즉시 전송 가능

### Pattern 3: ReplaySubject로 메시지 히스토리

```typescript
import { ReplaySubject } from 'rxjs';
import { take } from 'rxjs/operators';

@WebSocketGateway()
export class ChatHistoryGateway {
  @WebSocketServer()
  server: Server;

  // 최근 100개 메시지 저장
  private messageHistory$ = new ReplaySubject<ChatMessage>(100);

  @SubscribeMessage('sendMessage')
  handleMessage(@MessageBody() data: ChatMessage) {
    // 메시지 저장
    this.messageHistory$.next(data);

    // 브로드캐스트
    this.server.emit('message', data);
  }

  // 새 클라이언트 접속 시 최근 메시지 전송
  handleConnection(client: Socket) {
    this.logger.log(`Client ${client.id} connected`);

    // 최근 50개 메시지 전송
    this.messageHistory$
      .pipe(take(50))
      .subscribe((msg) => {
        client.emit('history', msg);
      });
  }
}
```

**학습 포인트:**
- `ReplaySubject(n)`: 최근 n개의 값 저장
- 새 구독자에게 히스토리 자동 재생
- `take(n)`: 처음 n개만 가져오기

### Pattern 4: Observable 반환으로 실시간 업데이트

```typescript
import { interval, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@WebSocketGateway()
export class LiveDataGateway {
  @SubscribeMessage('subscribeToStock')
  handleSubscribeStock(
    @MessageBody() symbol: string,
  ): Observable<any> {
    // 1초마다 주식 가격 업데이트 (시뮬레이션)
    return interval(1000).pipe(
      map(() => ({
        symbol,
        price: Math.random() * 1000,
        timestamp: new Date().toISOString(),
      }))
    );
  }

  @SubscribeMessage('subscribeToServerStats')
  handleServerStats(): Observable<any> {
    return interval(5000).pipe(
      map(() => ({
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        uptime: process.uptime(),
      }))
    );
  }
}
```

**학습 포인트:**
- `@SubscribeMessage` 핸들러가 `Observable` 반환 가능
- `interval`: 주기적으로 값 발행
- 클라이언트는 자동으로 스트림 구독

### Pattern 5: 여러 Subject 조합

```typescript
import { Subject, combineLatest, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

interface TypingEvent {
  userId: string;
  roomId: string;
  isTyping: boolean;
}

@WebSocketGateway()
export class AdvancedChatGateway {
  @WebSocketServer()
  server: Server;

  private messages$ = new Subject<ChatMessage>();
  private typing$ = new Subject<TypingEvent>();
  private reactions$ = new Subject<ReactionEvent>();

  constructor() {
    // 타이핑 이벤트는 디바운스 적용 (500ms)
    this.typing$
      .pipe(
        debounceTime(500),
        distinctUntilChanged((prev, curr) =>
          prev.userId === curr.userId && prev.isTyping === curr.isTyping
        )
      )
      .subscribe((event) => {
        this.server.to(event.roomId).emit('typing', event);
      });

    // 메시지와 반응을 합쳐서 타임라인 생성
    merge(
      this.messages$.pipe(map(msg => ({ type: 'message', data: msg }))),
      this.reactions$.pipe(map(reaction => ({ type: 'reaction', data: reaction })))
    ).subscribe((event) => {
      this.server.emit('timeline', event);
    });
  }

  @SubscribeMessage('typing')
  handleTyping(@MessageBody() event: TypingEvent) {
    this.typing$.next(event);
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() message: ChatMessage) {
    this.messages$.next(message);
  }

  @SubscribeMessage('reaction')
  handleReaction(@MessageBody() reaction: ReactionEvent) {
    this.reactions$.next(reaction);
  }
}
```

**학습 포인트:**
- `debounceTime`: 연속 이벤트 처리 최적화
- `distinctUntilChanged`: 중복 이벤트 필터링
- `merge`: 여러 스트림을 하나로 합치기
- `combineLatest`: 여러 스트림의 최신 값 조합

---

## 📝 실습 과제

### 과제 1: 기본 채팅 시스템 ⭐

**요구사항:**
- 클라이언트 연결/해제 로깅
- 메시지 송수신
- 모든 클라이언트에게 브로드캐스트
- 타임스탬프 포함

**체크리스트:**
- [ ] `ChatGateway` 생성
- [ ] 연결/해제 핸들러 구현
- [ ] 메시지 이벤트 핸들러 구현
- [ ] Socket.io 클라이언트로 테스트

**테스트 클라이언트 (HTML):**
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.socket.io/4.5.4/socket.io.min.js"></script>
</head>
<body>
  <input id="messageInput" type="text" />
  <button onclick="sendMessage()">전송</button>
  <div id="messages"></div>

  <script>
    const socket = io('http://localhost:3000');

    socket.on('message', (data) => {
      const div = document.getElementById('messages');
      div.innerHTML += `<p>${data.message}</p>`;
    });

    function sendMessage() {
      const input = document.getElementById('messageInput');
      socket.emit('message', input.value);
      input.value = '';
    }
  </script>
</body>
</html>
```

### 과제 2: 채팅방 시스템 ⭐⭐

**요구사항:**
- 여러 채팅방 생성 가능
- 방 입장/퇴장 기능
- 특정 방에만 메시지 전송
- Subject로 메시지 필터링

**체크리스트:**
- [ ] `ChatRoomGateway` 구현
- [ ] `joinRoom`, `leaveRoom` 이벤트 핸들러
- [ ] Room별 메시지 필터링 (filter operator)
- [ ] 여러 클라이언트로 동시 테스트

### 과제 3: 온라인 사용자 표시 ⭐⭐

**요구사항:**
- 현재 접속 중인 사용자 목록
- 실시간 업데이트 (입장/퇴장)
- 사용자 정보 (ID, 이름, 접속 시간)
- BehaviorSubject로 상태 관리

**체크리스트:**
- [ ] `PresenceGateway` 구현
- [ ] `BehaviorSubject<OnlineUsers>` 생성
- [ ] 입장/퇴장 시 상태 업데이트
- [ ] 실시간 사용자 목록 브로드캐스트

### 과제 4: 메시지 히스토리 ⭐⭐⭐

**요구사항:**
- 최근 100개 메시지 저장
- 새 사용자 접속 시 최근 50개 전송
- 메시지 검색 기능
- ReplaySubject 활용

**체크리스트:**
- [ ] `ChatHistoryGateway` 구현
- [ ] `ReplaySubject(100)` 생성
- [ ] 새 클라이언트에게 히스토리 전송
- [ ] 메시지 검색 API 추가

### 과제 5: 타이핑 인디케이터 ⭐⭐⭐

**요구사항:**
- "홍길동님이 입력 중..." 표시
- 500ms 디바운스 적용
- 중복 이벤트 필터링
- 여러 사용자 동시 타이핑 지원

**힌트:**
```typescript
this.typing$.pipe(
  debounceTime(500),
  distinctUntilChanged()
).subscribe(...);
```

**체크리스트:**
- [ ] 타이핑 이벤트 핸들러
- [ ] debounceTime 적용
- [ ] distinctUntilChanged로 중복 제거
- [ ] UI에서 타이핑 상태 표시

### 과제 6: 종합 프로젝트 - 실시간 협업 도구 ⭐⭐⭐⭐

**시나리오:** Slack 같은 실시간 협업 툴

**요구사항:**
1. 여러 채팅방 (워크스페이스)
2. 온라인 사용자 표시
3. 메시지 히스토리
4. 타이핑 인디케이터
5. 메시지 반응 (이모지)
6. 읽음 표시

**체크리스트:**
- [ ] 6가지 기능 모두 통합
- [ ] Subject 3종류 모두 활용
- [ ] RxJS Operator 5가지 이상 사용
- [ ] 에러 처리 및 재연결 로직
- [ ] 성능 최적화 (디바운스, 캐싱)
- [ ] E2E 테스트 작성

---

## 🧪 테스트 예제

### Gateway 테스트

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Socket, io } from 'socket.io-client';

describe('ChatGateway (e2e)', () => {
  let app: INestApplication;
  let client1: Socket;
  let client2: Socket;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      providers: [ChatGateway],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(3000);

    client1 = io('http://localhost:3000');
    client2 = io('http://localhost:3000');
  });

  afterAll(async () => {
    client1.disconnect();
    client2.disconnect();
    await app.close();
  });

  it('메시지를 브로드캐스트해야 함', (done) => {
    client2.on('message', (data) => {
      expect(data.message).toBe('Hello');
      done();
    });

    client1.emit('message', 'Hello');
  });

  it('특정 방에만 메시지를 전송해야 함', (done) => {
    const roomId = 'room1';

    client1.emit('joinRoom', roomId);
    client2.emit('joinRoom', roomId);

    client2.on('message', (data) => {
      expect(data.roomId).toBe(roomId);
      done();
    });

    client1.emit('sendMessage', {
      roomId,
      userId: 'user1',
      message: 'Hello Room1',
    });
  });
});
```

---

## 📊 성능 최적화

### 1. 메모리 관리

```typescript
// ❌ 나쁜 예: 무한정 저장
private messages$ = new ReplaySubject<Message>();

// ✅ 좋은 예: 크기 제한
private messages$ = new ReplaySubject<Message>(100);

// ✅ 더 좋은 예: TTL 추가
private messages$ = new ReplaySubject<Message>(100, 3600000); // 1시간
```

### 2. 이벤트 디바운싱

```typescript
// 타이핑, 마우스 이동 등 빈번한 이벤트는 디바운스
this.typing$.pipe(
  debounceTime(300),
  distinctUntilChanged()
).subscribe(...);
```

### 3. 연결 관리

```typescript
// 클라이언트 수 제한
private readonly MAX_CLIENTS = 1000;

handleConnection(client: Socket) {
  if (this.getClientCount() >= this.MAX_CLIENTS) {
    client.disconnect(true);
    return;
  }
  // ...
}
```

---

## 🎓 학습 정리

### 핵심 개념

| 개념 | 설명 | 사용 시기 |
|------|------|-----------|
| **Subject** | 기본 이벤트 스트림 | 실시간 메시지, 이벤트 |
| **BehaviorSubject** | 현재 상태 유지 | 온라인 사용자, 설정 |
| **ReplaySubject** | 히스토리 저장 | 메시지 히스토리, 로그 |
| **filter** | 조건 필터링 | 채팅방별 메시지 분리 |
| **debounceTime** | 이벤트 제한 | 타이핑, 검색 |
| **merge** | 스트림 합치기 | 여러 이벤트 통합 |

### 다음 단계

✅ WebSocket Gateway 완료 후:
- **[03-guards.md](./03-guards.md)** - Guards & Authentication with Observable
- 비동기 인증과 인가 패턴 학습

---

**수고하셨습니다! 🎉**

> 실시간 통신의 핵심을 배웠습니다!
> 이제 채팅, 알림, 협업 도구 등 다양한 실시간 기능을 구현할 수 있습니다!
