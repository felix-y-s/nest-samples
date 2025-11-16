# HTTP Interceptors with RxJS 🔌

> NestJS에서 가장 자주 사용되는 RxJS 패턴 - HTTP 요청/응답을 가로채서 처리하는 인터셉터

## 📚 목차

1. [개념 이해](#개념-이해)
2. [왜 RxJS를 사용하는가?](#왜-rxjs를-사용하는가)
3. [기본 구현](#기본-구현)
4. [실전 패턴](#실전-패턴)
5. [실습 과제](#실습-과제)

---

## 🎯 개념 이해

### Interceptor란?

인터셉터는 **요청이 컨트롤러에 도달하기 전**과 **응답이 클라이언트로 전송되기 전**에 실행되는 미들웨어입니다.

```
Client Request
    ↓
[Interceptor - Before]
    ↓
Controller Handler
    ↓
[Interceptor - After] ← RxJS Observable 처리
    ↓
Client Response
```

### 주요 사용 사례

- ✅ 요청/응답 로깅
- ✅ 타임아웃 처리
- ✅ 에러 변환 및 처리
- ✅ 응답 데이터 변환 (Response Transform)
- ✅ 캐싱 전략
- ✅ 성능 측정

---

## 🤔 왜 RxJS를 사용하는가?

### NestJS 인터셉터의 특징

```typescript
interface NestInterceptor {
  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<any> | Promise<Observable<any>>;
}
```

**핵심:** `next.handle()` 메서드가 **Observable을 반환**합니다!

### RxJS의 장점

1. **선언적 체이닝**: 여러 작업을 파이프라인으로 연결
2. **강력한 에러 처리**: catchError, retry
3. **시간 제어**: timeout, delay, debounce
4. **데이터 변환**: map, tap, switchMap
5. **조합 가능**: 여러 인터셉터를 쉽게 조합

---

## 🚀 기본 구현

### 1. 기본 로깅 인터셉터

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const now = Date.now();

    this.logger.log(`[Request] ${method} ${url}`);

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - now;
          this.logger.log(
            `[Response] ${method} ${url} - ${responseTime}ms`
          );
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          this.logger.error(
            `[Error] ${method} ${url} - ${responseTime}ms - ${error.message}`
          );
        },
      })
    );
  }
}
```

**핵심 포인트:**
- `tap`: Observable의 값에 사이드 이펙트 수행 (로깅)
- `next`, `error` 콜백으로 성공/실패 모두 처리

### 2. 적용 방법

#### 전역 적용
```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new LoggingInterceptor());
  await app.listen(3000);
}
```

#### 컨트롤러 레벨
```typescript
@Controller('users')
@UseInterceptors(LoggingInterceptor)
export class UsersController {
  // ...
}
```

#### 메서드 레벨
```typescript
@Get()
@UseInterceptors(LoggingInterceptor)
findAll() {
  return this.usersService.findAll();
}
```

---

## 💡 실전 패턴

### Pattern 1: 타임아웃 처리

```typescript
import { timeout, catchError } from 'rxjs/operators';
import { throwError, TimeoutError } from 'rxjs';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000), // 5초 타임아웃
      catchError((error) => {
        if (error instanceof TimeoutError) {
          return throwError(
            () => new RequestTimeoutException('요청 시간이 초과되었습니다')
          );
        }
        return throwError(() => error);
      })
    );
  }
}
```

**학습 포인트:**
- `timeout(ms)`: 지정 시간 내 응답 없으면 TimeoutError 발생
- `catchError`: 에러를 감지하고 변환

### Pattern 2: 재시도 로직

```typescript
import { retry, catchError } from 'rxjs/operators';

@Injectable()
export class RetryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      retry({
        count: 3, // 최대 3번 재시도
        delay: 1000, // 1초 대기 후 재시도
      }),
      catchError((error) => {
        // 3번 재시도 후에도 실패하면 에러 발생
        return throwError(() => new Error('재시도 실패: ' + error.message));
      })
    );
  }
}
```

**학습 포인트:**
- `retry`: 에러 발생 시 자동 재시도
- `count`, `delay` 옵션으로 제어

### Pattern 3: 조건부 재시도

```typescript
import { retryWhen, mergeMap, throwError, timer } from 'rxjs';

@Injectable()
export class SmartRetryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      retry({
        count: 3, // 최대 3번 재시도
        delay: (error, retryCount) => {
          // 500번대 에러만 재시도
          if (error.status >= 500) {
            const delayTime = Math.pow(2, retryCount - 1) * 1000; // 지수 백오프: 1초, 2초, 4초
            this.logger.warn(
              `🔄 재시도 ${retryCount}번째 (${delayTime}ms 대기) | Status: ${error.status} | ${error.message}`
            );
            return timer(delayTime);
          }

          // 400번대 에러는 재시도하지 않음 (즉시 에러 throw)
          this.logger.error(
            `⛔ 재시도 불가능 | Status: ${error.status} | ${error.message}`
          );
          throw error;
        },
      })
    );
  }
}
```

**학습 포인트:**
- `retryWhen`: 재시도 조건과 타이밍 세밀 제어
- **지수 백오프(Exponential Backoff)**: 재시도마다 대기 시간 증가

### Pattern 4: 응답 데이터 변환

```typescript
import { map } from 'rxjs/operators';

interface StandardResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>
  ): Observable<StandardResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data,
        timestamp: new Date().toISOString(),
      }))
    );
  }
}
```

**학습 포인트:**
- `map`: 응답 데이터를 변환
- 모든 API 응답을 표준 형식으로 통일

### Pattern 5: 에러 변환 및 로깅

```typescript
import { catchError, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest();
        const { method, url, body, params, query } = request;

        // 에러 상세 로깅
        this.logger.error({
          message: error.message,
          stack: error.stack,
          method,
          url,
          body,
          params,
          query,
        });

        // 클라이언트 친화적 에러 메시지로 변환
        if (error instanceof HttpException) {
          return throwError(() => error);
        }

        return throwError(
          () =>
            new InternalServerErrorException(
              '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
            )
        );
      })
    );
  }
}
```

### Pattern 6: 여러 인터셉터 조합

```typescript
@Controller('users')
@UseInterceptors(
  LoggingInterceptor,      // 1. 로깅
  TimeoutInterceptor,      // 2. 타임아웃
  RetryInterceptor,        // 3. 재시도
  TransformInterceptor,    // 4. 응답 변환
)
export class UsersController {
  // ...
}
```

**실행 순서:**
```
Request → Logging → Timeout → Retry → Controller
                                         ↓
Response ← Transform ← Retry ← Timeout ← Logging
```

---

## 📝 실습 과제

### 과제 1: 기본 로깅 인터셉터 ⭐

**요구사항:**
- 요청 시작 시 메서드, URL, 타임스탬프 로깅
- 응답 완료 시 상태 코드, 소요 시간 로깅
- 에러 발생 시 에러 메시지와 스택 로깅

**체크리스트:**
- [ ] `LoggingInterceptor` 클래스 생성
- [ ] `tap` 연산자로 로깅 구현
- [ ] 전역 인터셉터로 등록
- [ ] Postman으로 테스트

### 과제 2: 타임아웃 & 재시도 ⭐⭐

**요구사항:**
- 5초 타임아웃 설정
- 타임아웃 발생 시 사용자 친화적 에러 메시지
- 500번대 에러는 3번 재시도 (지수 백오프)
- 400번대 에러는 재시도 없이 즉시 반환

**체크리스트:**
- [ ] `TimeoutInterceptor` 구현
- [ ] `SmartRetryInterceptor` 구현
- [ ] 인터셉터 조합 테스트
- [ ] 각 시나리오별 동작 확인

### 과제 3: 표준 응답 포맷 ⭐⭐

**요구사항:**
```typescript
// 모든 성공 응답을 아래 형식으로 변환
{
  "success": true,
  "data": { /* 실제 데이터 */ },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "meta": {
    "path": "/api/users",
    "method": "GET"
  }
}
```

**체크리스트:**
- [ ] `StandardResponseInterceptor` 구현
- [ ] 메타데이터 추가 (path, method)
- [ ] 페이지네이션 정보 포함 (선택)
- [ ] 전체 API에 적용 및 테스트

### 과제 4: 캐싱 인터셉터 ⭐⭐⭐

**요구사항:**
- GET 요청 결과를 메모리에 캐싱
- TTL(Time To Live) 설정 (예: 60초)
- Cache-Control 헤더 추가
- 캐시 히트/미스 로깅

**구현 방법 (3가지):**

#### 방법 1: 데이터 저장 방식 (실무 추천 ✅)
```typescript
// TTL 기반 캐싱에 적합
interface Cache<T> {
  data: T;  // 실제 데이터 저장
  timestamp: number;
  ttl: number;
}

intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  // 캐시 히트
  if (this.cache.has(key) && !this.isExpired(key)) {
    return of(this.cache.get(key).data);  // 저장된 데이터 반환
  }

  // 캐시 미스
  return next.handle().pipe(
    tap(data => {
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl: 60000,
      });
    })
  );
}
```

**장점:**
- ✅ TTL 완전 제어 가능
- ✅ 메모리 효율적
- ✅ 디버깅 용이 (Map에 직접 접근 가능)
- ✅ Redis/Memcached 통합 쉬움

---

#### 방법 2: shareReplay 방식 (RxJS 학습용 📚)
```typescript
import { shareReplay } from 'rxjs/operators';

// 동시 요청 중복 제거에 적합
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  if (!this.cache.has(key)) {
    const request$ = next.handle().pipe(
      shareReplay({ bufferSize: 1, refCount: true })
    );
    this.cache.set(key, request$);
  }
  return this.cache.get(key);
}
```

**장점:**
- ✅ RxJS 멀티캐스팅 학습
- ✅ 동시 요청 중복 제거
- ✅ 코드 간결함

**단점:**
- ❌ TTL 제어 어려움
- ❌ 영구 캐싱 위험 (첫 응답 계속 재생)
- ❌ 메모리 누수 가능성

---

### ⚠️ 중요: Observable 캐싱 주의사항

**Cold Observable의 함정:**

RxJS Observable은 기본적으로 Cold Observable입니다. 이는 각 구독(`subscribe()`)마다 새로운 실행 컨텍스트가 생성된다는 의미입니다.

```typescript
// ❌ 잘못된 방법 - 캐싱이 전혀 작동하지 않음!
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const cacheKey = this.getCacheKey(context);

  if (this.cache.has(cacheKey)) {
    this.logger.debug('캐시 사용');
    return this.cache.get(cacheKey)!;  // ⚠️ 구독 시마다 비즈니스 로직 재실행!
  }

  const result = next.handle();  // Cold Observable
  this.cache.set(cacheKey, result);

  return result;
}
```

**문제점:**
- `next.handle()`은 Cold Observable을 반환
- Observable 참조만 저장했을 뿐, 실제 데이터는 저장되지 않음
- 캐시된 Observable을 구독할 때마다 `next.handle()`이 재실행됨
- 결과: 비즈니스 로직이 매번 실행되고, 캐시 값으로 대체되며, 비즈니스 결과값은 버려지는 구조

**해결 방법:**

```typescript
// ✅ 방법 1: shareReplay 사용 (Hot Observable로 변환)
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const cacheKey = this.getCacheKey(context);

  if (this.cache.has(cacheKey)) {
    return this.cache.get(cacheKey)!;
  }

  const result = next.handle().pipe(
    shareReplay(1)  // ✅ 첫 구독 결과를 모든 구독자에게 공유
  );
  this.cache.set(cacheKey, result);

  return result;
}

// ✅ 방법 2: 데이터 직접 저장 (권장)
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const cacheKey = this.getCacheKey(context);

  // 캐시 히트
  if (this.cache.has(cacheKey)) {
    const cached = this.cache.get(cacheKey)!;
    return of(cached.data);  // ✅ 실제 데이터 반환
  }

  // 캐시 미스
  return next.handle().pipe(
    tap(data => {
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
        ttl: 60000
      });
    })
  );
}
```

**핵심 차이:**
- **Cold Observable**: 각 구독마다 독립적인 실행 (매번 API 호출)
- **Hot Observable** (`shareReplay`): 한 번 실행하고 결과를 모든 구독자에게 공유
- **데이터 저장**: Observable 대신 실제 데이터를 저장하여 재실행 방지

---

### 💡 shareReplay는 왜 캐시 체크 없이는 작동하지 않는가?

**핵심 이해:**

`shareReplay(1)`을 사용해도 **캐시 체크를 주석 처리하면** 2번째 호출부터 비즈니스 로직이 실행되지 않을 것 같지만, **실제로는 매번 실행됩니다**.

```typescript
// ❌ 캐시 체크 주석 처리 - shareReplay가 있어도 캐싱 안됨!
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const cacheKey = method + ':' + path;

  // if (this.cache.has(cacheKey)) {
  //   return this.cache.get(cacheKey)!;
  // }

  const result = next.handle().pipe(shareReplay(1));  // ⚠️ 매번 새로운 Observable!
  this.cache.set(cacheKey, result);

  return result;  // 매번 새로운 Observable 반환
}
```

**왜 작동하지 않는가?**

호출할 때마다 **새로운 Observable 객체가 생성**되기 때문입니다!

```typescript
// 첫 번째 요청
const obs1 = next.handle().pipe(shareReplay(1));  // Observable 객체 A 생성
cache.set('GET:/weather', obs1);
return obs1;  // 객체 A 반환 → 비즈니스 로직 실행

// 두 번째 요청
const obs2 = next.handle().pipe(shareReplay(1));  // Observable 객체 B 생성 (새로운 객체!)
cache.set('GET:/weather', obs2);  // 객체 B로 덮어씀
return obs2;  // 객체 B 반환 → 비즈니스 로직 다시 실행!
```

**shareReplay는 Observable 인스턴스 레벨에서 작동:**

```typescript
// ✅ 같은 Observable을 여러 번 구독 → shareReplay 효과 발생
const observable$ = next.handle().pipe(shareReplay(1));

observable$.subscribe(v => console.log('첫 구독:', v));     // 비즈니스 로직 실행
observable$.subscribe(v => console.log('두번째 구독:', v));  // 캐시된 결과 재사용 ✅

// ❌ 새로운 Observable을 매번 생성 → shareReplay 효과 없음
const obs1$ = next.handle().pipe(shareReplay(1));
obs1$.subscribe();  // 비즈니스 로직 실행

const obs2$ = next.handle().pipe(shareReplay(1));  // 다른 Observable 객체!
obs2$.subscribe();  // 비즈니스 로직 다시 실행 ❌
```

**올바른 구현:**

```typescript
// ✅ 캐시 체크 필수 - 같은 Observable 객체 재사용
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const cacheKey = method + ':' + path;

  // 캐시된 Observable 객체 반환 (필수!)
  if (this.cache.has(cacheKey)) {
    this.logger.debug(`💾 캐시 사용`);
    return this.cache.get(cacheKey)!;  // 같은 Observable 객체 반환
  }

  // 새로운 Observable 생성 및 저장
  const result = next.handle().pipe(shareReplay(1));
  this.cache.set(cacheKey, result);

  return result;
}
```

**정리:**
- `shareReplay`는 **한 Observable 인스턴스** 내에서 여러 구독자가 결과를 공유
- 매번 새로운 Observable을 생성하면 `shareReplay`는 무의미함
- **캐시 체크는 필수** - 같은 Observable 객체를 재사용해야 함
- 호출마다 새 Observable 객체가 생성되므로 캐시 체크 없이는 캐싱 효과가 전혀 없음

---

#### 방법 3: 하이브리드 방식 (고급 🚀)
```typescript
// 단기 캐시 (shareReplay) + 장기 캐시 (데이터 저장) 조합
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  // 단기 캐시: 동시 요청 중복 제거
  if (this.pendingRequests.has(key)) {
    return this.pendingRequests.get(key);
  }

  // 장기 캐시: TTL 기반
  if (this.cache.has(key) && !this.isExpired(key)) {
    return of(this.cache.get(key).data);
  }

  // 새 요청
  const request$ = next.handle().pipe(
    shareReplay({ bufferSize: 1, refCount: true }),
    tap(data => {
      this.cache.set(key, { data, timestamp: Date.now(), ttl: 60000 });
    }),
    finalize(() => {
      this.pendingRequests.delete(key);  // 완료 후 단기 캐시 삭제
    })
  );

  this.pendingRequests.set(key, request$);
  return request$;
}
```

**장점:**
- ✅ 동시 요청 최적화 (shareReplay)
- ✅ TTL 완전 제어 (데이터 저장)
- ✅ 최고의 성능

**단점:**
- ❌ 복잡도 증가

---

**추천 학습 순서:**
1. **방법 2 (shareReplay)** → RxJS 개념 이해
2. **문제점 발견** → TTL 제어 불가, 영구 캐싱 문제
3. **방법 1 (데이터 저장)** → 실무 적합 방식 학습
4. **방법 3 (하이브리드)** → 고급 최적화 (선택)

**체크리스트:**
- [ ] `CacheInterceptor` 구현 (방법 1 또는 2 선택)
- [ ] Map으로 캐시 저장소 구현
- [ ] TTL 만료 체크 로직
- [ ] 캐시 무효화 로직
- [ ] Cache-Control, X-Cache 헤더 설정
- [ ] 캐시 히트/미스 로깅
- [ ] 성능 개선 확인
****
### 과제 5: 종합 프로젝트 ⭐⭐⭐

**시나리오:** 외부 날씨 API를 호출하는 서비스

당신은 불안정한 외부 날씨 API를 사용하는 서비스를 개발합니다.
5개의 인터셉터를 조합하여 안정적이고 빠른 서비스를 만드세요.

---

#### 📋 상세 시나리오

**배경:**
- 외부 날씨 API: `GET /api/weather/:city`
- API 특징:
  - 가끔 느림 (5-15초 소요)
  - 간헐적 500 에러 (10% 확률)
  - 동일 도시 데이터는 1시간마다 갱신

**문제 상황:**
```
사용자 요청: GET /weather/seoul

❌ 문제 1: API 응답이 15초 걸림 → 사용자 이탈
❌ 문제 2: 500 에러 발생 → 서비스 실패
❌ 문제 3: 같은 요청 반복 → 불필요한 API 호출
❌ 문제 4: 응답 형식 불일치 → 프론트엔드 혼란
❌ 문제 5: 에러 추적 불가 → 디버깅 어려움
```

**해결 방법 (인터셉터 조합):**
```typescript
@Controller('weather')
@UseInterceptors(
  LoggingInterceptor,        // 1. 모든 요청/응답 로깅
  TimeoutInterceptor,         // 2. 10초 타임아웃
  SmartRetryInterceptor,      // 3. 500 에러 시 3회 재시도
  CacheInterceptor,           // 4. 60초 캐싱
  StandardResponseInterceptor // 5. 표준 형식 변환
)
export class WeatherController {
  @Get(':city')
  async getWeather(@Param('city') city: string) {
    // 외부 API 호출
    return this.weatherService.fetchWeather(city);
  }
}
```

**실행 흐름:**
```
1. [Logging] 📥 요청 로그: GET /weather/seoul
2. [Cache] 캐시 확인 → MISS (첫 요청)
3. [Timeout] 타이머 시작 (10초)
4. [Retry] 외부 API 호출
   → 500 에러 → 1초 대기 → 재시도 (1/3)
   → 500 에러 → 2초 대기 → 재시도 (2/3)
   → 200 성공 → 데이터 수신
5. [Cache] 📦 캐시 저장 (60초 TTL)
6. [Standard] 표준 형식 변환
7. [Logging] ✅ 응답 로그: 200 OK (3.5초)

다음 요청 (30초 후):
1. [Cache] 캐시 확인 → HIT ⚡
2. [Standard] 표준 형식 변환
3. [Logging] ✅ 응답 로그: 200 OK (5ms)
```

---

**요구사항:**
1. **로깅**: 모든 요청/응답 기록 (시간, 상태, 에러)
2. **타임아웃**: 10초 초과 시 `RequestTimeoutException`
3. **재시도**: 500번대 에러만 3회 재시도 (1초, 2초, 4초 간격)
4. **캐싱**: GET 요청만 60초 캐싱, Cache-Control 헤더
5. **표준 응답**: 모든 응답을 `{ success, data, timestamp, meta }` 형식

**성공 기준:**
- ✅ API 응답 시간: 평균 100ms 이하 (캐시 히트 시)
- ✅ 에러 복구율: 95% 이상 (재시도로 500 에러 복구)
- ✅ 타임아웃 방지: 10초 이내 응답 보장
- ✅ 일관된 응답: 모든 API가 동일한 형식

**체크리스트:**
- [ ] 5개 인터셉터 모두 구현
- [ ] 올바른 순서로 적용 (순서 중요!)
- [ ] 각 기능별 단위 테스트
- [ ] 통합 시나리오 테스트 (전체 흐름)
- [ ] 성능 측정 (캐시 히트율, 평균 응답 시간)
- [ ] 에러 복구 검증 (500 에러 → 재시도 → 성공)

---

## 🧪 테스트 예제

### 인터셉터 단위 테스트

```typescript
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  it('성공적인 요청을 로깅해야 함', (done) => {
    const context = createMockExecutionContext();
    const next = createMockCallHandler(of({ data: 'test' }));

    interceptor.intercept(context, next).subscribe({
      next: (value) => {
        expect(value).toEqual({ data: 'test' });
        done();
      },
    });
  });

  it('에러를 로깅하고 재발생시켜야 함', (done) => {
    const context = createMockExecutionContext();
    const error = new Error('Test error');
    const next = createMockCallHandler(throwError(() => error));

    interceptor.intercept(context, next).subscribe({
      error: (err) => {
        expect(err.message).toBe('Test error');
        done();
      },
    });
  });
});
```

---

## 📊 성능 고려사항

### 메모리 관리

```typescript
// ❌ 나쁜 예: 메모리 누수 가능
private cache = new Map<string, Observable<any>>();

// ✅ 좋은 예: TTL과 최대 크기 제한
private cache = new Map<string, CacheEntry>();
private readonly MAX_CACHE_SIZE = 100;
```

### 에러 처리 Best Practices

```typescript
// ✅ 항상 catchError로 에러 처리
return next.handle().pipe(
  timeout(5000),
  retry(3),
  catchError((error) => {
    // 에러 로깅 및 변환
    this.logger.error(error);
    return throwError(() => new HttpException('에러 발생', 500));
  })
);

// ❌ catchError 없이 에러 방치하지 않기
return next.handle().pipe(
  timeout(5000),
  retry(3)
);
```

---

## 🎓 학습 정리

### 핵심 Operator

| Operator | 용도 | 예제 |
|----------|------|------|
| `tap` | 사이드 이펙트 (로깅) | `tap(() => console.log())` |
| `map` | 데이터 변환 | `map(data => ({ success: true, data }))` |
| `catchError` | 에러 처리 | `catchError(err => throwError(() => err))` |
| `timeout` | 타임아웃 | `timeout(5000)` |
| `retry` | 재시도 | `retry({ count: 3, delay: 1000 })` |
| `shareReplay` | 결과 캐싱 | `shareReplay(1)` |

### 다음 단계

✅ HTTP Interceptors 완료 후:
- **[02-websocket.md](./02-websocket.md)** - WebSocket Gateway with Subject
- 실시간 통신과 이벤트 스트림 학습

---

**잘했습니다! 🎉**

> 인터셉터는 NestJS에서 가장 강력한 기능 중 하나입니다.
> 실습 과제를 모두 완료하면 실무에서 바로 활용할 수 있습니다!
