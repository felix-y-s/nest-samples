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
2. **강력한 에러 처리**: catchError, retry, retryWhen
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
      retryWhen((errors) =>
        errors.pipe(
          mergeMap((error, index) => {
            // 500번대 에러만 재시도
            if (error.status >= 500 && index < 3) {
              const delayTime = Math.pow(2, index) * 1000; // 지수 백오프
              console.log(`재시도 ${index + 1}번째 (${delayTime}ms 대기)`);
              return timer(delayTime);
            }
            // 재시도 불가능한 에러
            return throwError(() => error);
          })
        )
      )
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

**힌트:**
```typescript
import { shareReplay } from 'rxjs/operators';

// shareReplay(1)을 사용하여 결과를 캐시하고 재사용
```

**체크리스트:**
- [ ] `CacheInterceptor` 구현
- [ ] Map으로 캐시 저장소 구현
- [ ] TTL 타이머 설정
- [ ] 캐시 무효화 로직
- [ ] 성능 개선 확인

### 과제 5: 종합 프로젝트 ⭐⭐⭐

**시나리오:** 외부 API를 호출하는 서비스

**요구사항:**
1. 로깅 (모든 요청/응답)
2. 타임아웃 (10초)
3. 재시도 (3번, 지수 백오프)
4. 응답 변환 (표준 포맷)
5. 캐싱 (60초 TTL)

**체크리스트:**
- [ ] 5개 인터셉터 모두 구현
- [ ] 올바른 순서로 적용
- [ ] 각 기능별 단위 테스트
- [ ] 통합 시나리오 테스트
- [ ] 성능 측정 및 개선

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
| `retryWhen` | 조건부 재시도 | `retryWhen(errors => ...)` |
| `shareReplay` | 결과 캐싱 | `shareReplay(1)` |

### 다음 단계

✅ HTTP Interceptors 완료 후:
- **[02-websocket.md](./02-websocket.md)** - WebSocket Gateway with Subject
- 실시간 통신과 이벤트 스트림 학습

---

**잘했습니다! 🎉**

> 인터셉터는 NestJS에서 가장 강력한 기능 중 하나입니다.
> 실습 과제를 모두 완료하면 실무에서 바로 활용할 수 있습니다!
