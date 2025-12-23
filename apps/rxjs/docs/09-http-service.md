# HttpService with RxJS Operators 🌐

> 외부 API 호출 시 타임아웃, 재시도, 에러 처리를 위한 RxJS 패턴

## 📚 목차

1. [개념 이해](#개념-이해)
2. [HttpService vs Axios](#httpservice-vs-axios)
3. [기본 구현](#기본-구현)
4. [실전 패턴](#실전-패턴)
5. [실습 과제](#실습-과제)

---

## 🎯 개념 이해

### HttpService란?

NestJS가 제공하는 HTTP 클라이언트 서비스로, Axios를 래핑하여 **Observable을 반환**합니다.

```typescript
// Axios (Promise)
const response = await axios.get('/api/users');

// HttpService (Observable)
this.httpService.get('/api/users').subscribe(
  response => console.log(response.data)
);
```

### 왜 HttpService를 사용하나?

| 기능 | Axios (Promise) | HttpService (Observable) |
|------|----------------|------------------------|
| 타임아웃 | 별도 설정 | `timeout()` 연산자 |
| 재시도 | 수동 구현 | `retry()` 연산자 |
| 에러 변환 | try-catch | `catchError()` 연산자 |
| 응답 변환 | 수동 매핑 | `map()` 연산자 |
| 취소 | AbortController | `takeUntil()` 연산자 |
| 병렬 호출 | Promise.all() | `forkJoin()` 연산자 |

---

## 🔄 HttpService vs Axios

### Axios 직접 사용 (Promise)

```typescript
@Injectable()
export class UserService {
  async getUser(id: number): Promise<User> {
    try {
      const response = await axios.get(`/api/users/${id}`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }
}
```

### HttpService 사용 (Observable)

```typescript
@Injectable()
export class UserService {
  constructor(private httpService: HttpService) {}

  getUser(id: number): Observable<User> {
    return this.httpService.get(`/api/users/${id}`).pipe(
      timeout(5000),
      map(response => response.data),
      catchError(error => {
        if (error.name === 'TimeoutError') {
          throw new Error('Request timeout');
        }
        throw error;
      })
    );
  }
}
```

**장점:**
- 선언적 에러 처리
- 연산자 체인으로 가독성 향상
- 취소, 재시도 등 추가 기능 쉽게 구현

---

## 🚀 기본 구현

### 1. 패키지 설치 및 모듈 등록

```bash
pnpm add @nestjs/axios axios
```

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { UserService } from './user.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
  ],
  providers: [UserService],
})
export class UserModule {}
```

### 2. 기본 HTTP 요청

```typescript
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class UserService {
  constructor(private httpService: HttpService) {}

  // GET 요청
  getUsers(): Observable<User[]> {
    return this.httpService.get<User[]>('https://api.example.com/users').pipe(
      map(response => response.data)
    );
  }

  // POST 요청
  createUser(userData: CreateUserDto): Observable<User> {
    return this.httpService.post<User>('https://api.example.com/users', userData).pipe(
      map(response => response.data)
    );
  }

  // PUT 요청
  updateUser(id: number, userData: UpdateUserDto): Observable<User> {
    return this.httpService.put<User>(`https://api.example.com/users/${id}`, userData).pipe(
      map(response => response.data)
    );
  }

  // DELETE 요청
  deleteUser(id: number): Observable<void> {
    return this.httpService.delete(`https://api.example.com/users/${id}`).pipe(
      map(() => undefined)
    );
  }
}
```

---

## 💡 실전 패턴

### Pattern 1: 타임아웃과 재시도 ⭐⭐⭐⭐⭐

```typescript
import { timeout, retry, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class PaymentService {
  constructor(private httpService: HttpService) {}

  processPayment(paymentData: PaymentDto): Observable<PaymentResult> {
    return this.httpService.post('/api/payments', paymentData).pipe(
      // 5초 타임아웃
      timeout(5000),

      // 실패 시 3번 재시도 (지수 백오프)
      retry({
        count: 3,
        delay: (error, retryCount) => {
          console.log(`Retry attempt ${retryCount}`);
          return timer(Math.pow(2, retryCount) * 1000); // 2초, 4초, 8초
        }
      }),

      // 응답 데이터 추출
      map(response => response.data),

      // 에러 처리
      catchError(error => {
        if (error.name === 'TimeoutError') {
          return throwError(() => new Error('Payment timeout'));
        }
        return throwError(() => new Error('Payment failed'));
      })
    );
  }
}
```

**실무 사용:**
- ✅ 결제 API 호출
- ✅ 외부 서비스 연동
- ✅ 불안정한 네트워크 환경

---

### Pattern 2: 조건부 재시도 (상태 코드별 처리) ⭐⭐⭐⭐

```typescript
import { retry, timer } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

@Injectable()
export class ApiService {
  constructor(private httpService: HttpService) {}

  getData(): Observable<any> {
    return this.httpService.get('/api/data').pipe(
      map(response => response.data),

      // 5xx 에러만 재시도, 4xx는 즉시 실패
      retry({
        count: 3,
        delay: (error, retryCount) => {
          const statusCode = error.response?.status;

          // 500번대 에러만 재시도
          if (statusCode >= 500 && statusCode < 600) {
            const delayTime = 1000 * retryCount; // 1초, 2초, 3초
            console.log(`Server error ${statusCode}, retrying in ${delayTime}ms... (attempt ${retryCount})`);
            return timer(delayTime);
          }

          // 4xx 에러는 재시도하지 않고 즉시 에러 발생
          throw error;
        }
      }),

      catchError(error => {
        const statusCode = error.response?.status;
        if (statusCode === 404) {
          return throwError(() => new NotFoundException('Data not found'));
        }
        if (statusCode === 401) {
          return throwError(() => new UnauthorizedException('Unauthorized'));
        }
        if (statusCode >= 500) {
          return throwError(() => new InternalServerErrorException('Server error after retries'));
        }
        return throwError(() => new BadRequestException('Bad request'));
      })
    );
  }
}
```

**학습 포인트:**
- `retry` 연산자의 `delay` 옵션으로 조건부 재시도
- 상태 코드별 다른 처리 (5xx만 재시도, 4xx는 즉시 실패)
- 선형 백오프 (1초, 2초, 3초)
- RxJS 7+ 권장 방식 (~~retryWhen~~ deprecated)

---

### Pattern 3: 병렬 API 호출 (forkJoin) ⭐⭐⭐⭐

```typescript
import { forkJoin } from 'rxjs';

@Injectable()
export class DashboardService {
  constructor(private httpService: HttpService) {}

  getDashboardData(userId: number): Observable<DashboardData> {
    return forkJoin({
      user: this.httpService.get(`/api/users/${userId}`).pipe(
        map(res => res.data)
      ),
      orders: this.httpService.get(`/api/orders?userId=${userId}`).pipe(
        map(res => res.data)
      ),
      stats: this.httpService.get(`/api/stats/${userId}`).pipe(
        map(res => res.data)
      ),
    }).pipe(
      timeout(10000),
      map(({ user, orders, stats }) => ({
        user,
        orders,
        stats,
        lastUpdated: new Date()
      })),
      catchError(error => {
        console.error('Dashboard data fetch failed:', error);
        return throwError(() => new Error('Failed to load dashboard'));
      })
    );
  }
}
```

**실무 사용:**
- ✅ 대시보드 데이터 로딩
- ✅ 여러 API 병렬 호출
- ✅ 초기 페이지 로딩 최적화

---

### Pattern 4: 순차 API 호출 (switchMap) ⭐⭐⭐⭐

```typescript
import { switchMap } from 'rxjs/operators';

@Injectable()
export class OrderService {
  constructor(private httpService: HttpService) {}

  createOrderWithPayment(orderData: CreateOrderDto): Observable<OrderResult> {
    // 1단계: 주문 생성
    return this.httpService.post('/api/orders', orderData).pipe(
      map(response => response.data),

      // 2단계: 주문 ID로 결제 처리
      switchMap(order =>
        this.httpService.post('/api/payments', {
          orderId: order.id,
          amount: order.totalAmount
        }).pipe(
          map(paymentResponse => ({
            order,
            payment: paymentResponse.data
          }))
        )
      ),

      // 3단계: 재고 차감
      switchMap(({ order, payment }) =>
        this.httpService.post('/api/inventory/deduct', {
          orderId: order.id,
          items: order.items
        }).pipe(
          map(inventoryResponse => ({
            order,
            payment,
            inventory: inventoryResponse.data
          }))
        )
      ),

      timeout(15000),
      catchError(error => {
        console.error('Order process failed:', error);
        return throwError(() => new Error('Order creation failed'));
      })
    );
  }
}
```

**학습 포인트:**
- `switchMap`: 이전 결과를 다음 요청에 사용
- 순차적 API 호출 체인
- 각 단계별 에러 처리

---

### Pattern 5: 캐싱 (shareReplay) ⚠️ 단일 서버만

```typescript
import { shareReplay } from 'rxjs/operators';

@Injectable()
export class ConfigService {
  private config$: Observable<Config>;

  constructor(private httpService: HttpService) {
    // 앱 시작 시 한 번만 호출, 결과 캐싱
    this.config$ = this.httpService.get('/api/config').pipe(
      map(response => response.data),
      shareReplay(1) // 마지막 1개 값 캐싱
    );
  }

  getConfig(): Observable<Config> {
    return this.config$; // 캐싱된 값 반환
  }
}
```

**⚠️ 주의:**
- 단일 서버 환경에서만 사용
- 실무에서는 **Redis 캐싱** 권장
- 서버 재시작 시 캐시 손실

---

### Pattern 6: 요청 취소 (takeUntil) ⭐⭐⭐

```typescript
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable()
export class SearchService {
  private cancelPreviousSearch$ = new Subject<void>();

  constructor(private httpService: HttpService) {}

  search(query: string): Observable<SearchResult[]> {
    // 이전 검색 취소
    this.cancelPreviousSearch$.next();

    return this.httpService.get(`/api/search?q=${query}`).pipe(
      map(response => response.data),
      takeUntil(this.cancelPreviousSearch$), // 취소 시그널 대기
      timeout(3000),
      catchError(() => of([]))
    );
  }

  ngOnDestroy() {
    this.cancelPreviousSearch$.next();
    this.cancelPreviousSearch$.complete();
  }
}
```

**실무 사용:**
- ✅ 검색 자동완성 (이전 검색 취소)
- ✅ 페이지 전환 시 요청 취소
- ✅ 불필요한 네트워크 요청 방지

---

### Pattern 7: 에러 로깅 및 모니터링 ⭐⭐⭐⭐⭐

```typescript
import { tap, catchError } from 'rxjs/operators';

@Injectable()
export class MonitoredApiService {
  constructor(
    private httpService: HttpService,
    private logger: Logger,
    private metricsService: MetricsService
  ) {}

  getDataWithMonitoring(endpoint: string): Observable<any> {
    const startTime = Date.now();

    return this.httpService.get(endpoint).pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.metricsService.recordApiCall(endpoint, duration, 'success');
        this.logger.log(`API call to ${endpoint} succeeded in ${duration}ms`);
      }),

      map(response => response.data),

      catchError(error => {
        const duration = Date.now() - startTime;
        this.metricsService.recordApiCall(endpoint, duration, 'error');
        this.logger.error(`API call to ${endpoint} failed in ${duration}ms`, error);

        // Sentry 등 에러 추적 서비스에 전송
        // Sentry.captureException(error);

        return throwError(() => error);
      })
    );
  }
}
```

**실무 필수:**
- API 호출 성공/실패 로깅
- 응답 시간 모니터링
- 에러 추적 서비스 연동

---

### Pattern 8: 전역 Interceptor 설정 ⭐⭐⭐⭐

```typescript
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { of } from 'rxjs';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  ],
})
export class AppModule {}

// 또는 동적 설정
@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        timeout: configService.get('HTTP_TIMEOUT'),
        baseURL: configService.get('API_BASE_URL'),
        headers: {
          'Authorization': `Bearer ${configService.get('API_TOKEN')}`,
        },
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule {}
```

---

## 📝 실습 과제

### 과제 1: 타임아웃과 재시도 구현 ⭐

**요구사항:**
- 외부 API 호출 서비스 구현
- 3초 타임아웃 설정
- 실패 시 3번 재시도
- 재시도 간격: 1초, 2초, 4초 (지수 백오프)

**체크리스트:**
- [ ] HttpService 주입
- [ ] `timeout(3000)` 연산자 적용
- [ ] `retry()` 연산자로 재시도 구현
- [ ] 지수 백오프 로직 추가
- [ ] 에러 처리 및 로깅

---

### 과제 2: 병렬 API 호출 ⭐⭐

**요구사항:**
- 사용자 대시보드 데이터 로딩
- 사용자 정보, 주문 목록, 통계 데이터 병렬 호출
- 10초 타임아웃
- 하나라도 실패하면 전체 실패

**힌트:**
```typescript
forkJoin({
  user: this.httpService.get(...),
  orders: this.httpService.get(...),
  stats: this.httpService.get(...)
})
```

---

### 과제 3: 순차 API 호출 체인 ⭐⭐⭐

**요구사항:**
- 회원가입 → 이메일 인증 → 환영 이메일 발송
- 각 단계는 이전 단계 성공 시에만 실행
- 각 단계별 타임아웃 5초
- 실패 시 어느 단계에서 실패했는지 로깅

**힌트:**
```typescript
this.signup(userData).pipe(
  switchMap(user => this.sendVerificationEmail(user.email)),
  switchMap(verification => this.sendWelcomeEmail(verification))
)
```

---

### 과제 4: 검색 자동완성 (취소 기능) ⭐⭐⭐

**요구사항:**
- 검색어 입력 시 API 호출
- 새 검색 시 이전 검색 취소
- 300ms 디바운스 적용
- 빈 문자열은 검색하지 않음

**힌트:**
```typescript
searchSubject$.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  switchMap(query => this.search(query)),
  takeUntil(this.destroy$)
)
```

---

## 🎓 학습 정리

### 핵심 RxJS 연산자

| 연산자 | 용도 | 사용 빈도 |
|--------|------|----------|
| **timeout** | 타임아웃 설정 | ⭐⭐⭐⭐⭐ |
| **retry** | 재시도 | ⭐⭐⭐⭐⭐ |
| **catchError** | 에러 처리 | ⭐⭐⭐⭐⭐ |
| **map** | 응답 변환 | ⭐⭐⭐⭐⭐ |
| **forkJoin** | 병렬 호출 | ⭐⭐⭐⭐ |
| **switchMap** | 순차 호출 | ⭐⭐⭐⭐ |
| **takeUntil** | 요청 취소 | ⭐⭐⭐ |
| **tap** | 로깅/모니터링 | ⭐⭐⭐⭐ |
| **shareReplay** | 캐싱 (단일 서버) | ⭐⭐ |

---

### HttpService vs Axios 선택 가이드

**HttpService 사용 (Observable):**
- ✅ 타임아웃, 재시도가 필요한 경우
- ✅ 여러 API 호출을 조합해야 하는 경우
- ✅ 요청 취소가 필요한 경우
- ✅ 복잡한 에러 처리가 필요한 경우

**Axios 직접 사용 (Promise):**
- ✅ 단순한 API 호출
- ✅ async/await 스타일 선호
- ✅ RxJS 학습 곡선을 피하고 싶을 때

---

### 다음 단계

✅ HttpService 완료 후:
- **[04-events.md](./04-events.md)** - Event-Driven Architecture
- **[07-sse.md](./07-sse.md)** - Server-Sent Events

---

**수고하셨습니다! 🎉**

> 이제 외부 API 호출 시 타임아웃, 재시도, 에러 처리를 효율적으로 구현할 수 있습니다!
