# Server-Sent Events (SSE) with RxJS 📡

> 서버에서 클라이언트로 실시간 데이터 스트리밍

## 📚 SSE vs WebSocket

| 특성 | SSE | WebSocket |
|------|-----|-----------|
| 방향 | 단방향 (서버 → 클라이언트) | 양방향 |
| 프로토콜 | HTTP | WebSocket |
| 재연결 | 자동 | 수동 구현 필요 |
| 브라우저 지원 | 모든 브라우저 | IE 미지원 |
| 사용 사례 | 실시간 알림, 진행 상황 | 채팅, 게임 |

---

## 🚀 기본 구현

### NestJS SSE 엔드포인트

```typescript
import { Controller, Sse } from '@nestjs/common';
import { interval, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Controller('events')
export class EventsController {
  @Sse('stream')
  sendEvents(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map((num) => ({
        data: { count: num, timestamp: new Date() },
        type: 'count',
      }))
    );
  }
}

// 클라이언트 (JavaScript)
const eventSource = new EventSource('http://localhost:3000/events/stream');

eventSource.addEventListener('count', (event) => {
  const data = JSON.parse(event.data);
  console.log('Count:', data.count);
});

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

---

## 💡 실전 패턴

### Pattern 1: 진행 상황 스트리밍

```typescript
@Controller('upload')
export class UploadController {
  @Sse('progress/:taskId')
  streamUploadProgress(@Param('taskId') taskId: string): Observable<MessageEvent> {
    return this.uploadService.getProgressStream(taskId).pipe(
      map((progress) => ({
        data: {
          taskId,
          progress: progress.percentage,
          uploadedBytes: progress.uploadedBytes,
          totalBytes: progress.totalBytes,
          status: progress.status,
        },
        type: 'progress',
      })),
      finalize(() => {
        console.log(`Progress stream closed for task: ${taskId}`);
      })
    );
  }
}

@Injectable()
export class UploadService {
  private progressStreams = new Map<string, BehaviorSubject<ProgressInfo>>();

  getProgressStream(taskId: string): Observable<ProgressInfo> {
    if (!this.progressStreams.has(taskId)) {
      this.progressStreams.set(taskId, new BehaviorSubject({ percentage: 0 }));
    }
    return this.progressStreams.get(taskId)!.asObservable();
  }

  updateProgress(taskId: string, progress: ProgressInfo) {
    const stream = this.progressStreams.get(taskId);
    if (stream) {
      stream.next(progress);
    }
  }
}
```

### Pattern 2: 실시간 알림 스트림

```typescript
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationService: NotificationService) {}

  @Sse('subscribe')
  subscribeToNotifications(@Req() request: Request): Observable<MessageEvent> {
    const userId = request.user.id;

    return this.notificationService.getNotificationStream(userId).pipe(
      map((notification) => ({
        data: {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          createdAt: notification.createdAt,
        },
        type: 'notification',
        id: notification.id, // 클라이언트가 마지막 이벤트 추적 가능
      })),
      catchError((error) => {
        console.error('Notification stream error:', error);
        return EMPTY;
      })
    );
  }
}

@Injectable()
export class NotificationService {
  private notificationStreams = new Map<string, Subject<Notification>>();

  getNotificationStream(userId: string): Observable<Notification> {
    if (!this.notificationStreams.has(userId)) {
      this.notificationStreams.set(userId, new Subject());
    }
    return this.notificationStreams.get(userId)!.asObservable();
  }

  sendNotification(userId: string, notification: Notification) {
    const stream = this.notificationStreams.get(userId);
    if (stream) {
      stream.next(notification);
    }
  }
}
```

### Pattern 3: 실시간 대시보드

```typescript
@Controller('dashboard')
export class DashboardController {
  @Sse('stats')
  streamDashboardStats(): Observable<MessageEvent> {
    return interval(5000).pipe(
      switchMap(() =>
        forkJoin({
          serverStats: this.getServerStats(),
          activeUsers: this.getActiveUsers(),
          requestsPerMinute: this.getRequestRate(),
        })
      ),
      map((stats) => ({
        data: stats,
        type: 'stats',
      }))
    );
  }

  private getServerStats(): Observable<ServerStats> {
    return of({
      cpu: process.cpuUsage(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    });
  }
}
```

### Pattern 4: 주식 가격 스트리밍

```typescript
@Controller('stocks')
export class StocksController {
  constructor(private stockService: StockService) {}

  @Sse('price/:symbol')
  streamStockPrice(@Param('symbol') symbol: string): Observable<MessageEvent> {
    return this.stockService.getPriceStream(symbol).pipe(
      distinctUntilChanged((prev, curr) => prev.price === curr.price),
      map((quote) => ({
        data: {
          symbol: quote.symbol,
          price: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          timestamp: new Date(),
        },
        type: 'quote',
      })),
      catchError((error) => {
        console.error(`Stock stream error for ${symbol}:`, error);
        return of({
          data: { error: 'Failed to fetch stock data' },
          type: 'error',
        });
      })
    );
  }
}

@Injectable()
export class StockService {
  getPriceStream(symbol: string): Observable<StockQuote> {
    // 실제로는 외부 API나 WebSocket 연결
    return interval(2000).pipe(
      map(() => ({
        symbol,
        price: 100 + Math.random() * 10,
        change: (Math.random() - 0.5) * 5,
        changePercent: (Math.random() - 0.5) * 2,
      }))
    );
  }
}
```

### Pattern 5: 로그 스트리밍

```typescript
@Controller('logs')
export class LogsController {
  @Sse('tail/:level')
  streamLogs(@Param('level') level: string): Observable<MessageEvent> {
    return this.logService.getLogStream(level).pipe(
      filter((log) => log.level === level || level === 'all'),
      map((log) => ({
        data: {
          timestamp: log.timestamp,
          level: log.level,
          message: log.message,
          context: log.context,
        },
        type: 'log',
      })),
      catchError((error) => {
        console.error('Log stream error:', error);
        return EMPTY;
      })
    );
  }
}
```

---

## 📝 실습 과제

### 과제 1: 기본 SSE 엔드포인트 ⭐
interval로 카운터 스트리밍

### 과제 2: 파일 업로드 진행률 ⭐⭐
BehaviorSubject로 진행 상황 관리

### 과제 3: 실시간 알림 시스템 ⭐⭐⭐
사용자별 알림 스트림, Subject 활용

### 과제 4: 라이브 대시보드 ⭐⭐⭐
서버 통계, 활성 사용자 등 실시간 표시

### 과제 5: 로그 모니터링 ⭐⭐⭐⭐
필터링 가능한 실시간 로그 스트림

---

## 🎓 핵심 정리

**SSE 사용 시기:**
- ✅ 서버 → 클라이언트 단방향
- ✅ 실시간 알림, 진행 상황
- ✅ 자동 재연결 필요
- ❌ 양방향 통신 → WebSocket

**핵심 Operator:**
- `interval`: 주기적 이벤트
- `distinctUntilChanged`: 중복 제거
- `switchMap`: 최신 데이터로 전환
- `finalize`: 스트림 종료 시 정리

**다음:** [08-caching.md](./08-caching.md)
