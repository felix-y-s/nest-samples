# Interceptor vs Exception Filter 에러 처리 비교 🔍

> NestJS에서 에러를 처리하는 두 가지 방법의 차이점과 사용 시나리오

## 📊 실행 순서

```
Client Request
    ↓
[Exception Filter - 전역 캐치] ← ⚠️ 여기서 에러 잡으면 Interceptor 도달 안 함
    ↓
[Guard]
    ↓
[Interceptor - Before]
    ↓
[Pipe]
    ↓
[Controller Handler] ← 💥 에러 발생 지점
    ↓
[Interceptor - After] ← 🎯 여기서 먼저 에러 처리 가능
    ↓
[Exception Filter] ← 🎯 Interceptor에서 처리 안 하면 여기서 처리
    ↓
Client Response
```

---

## 🔄 Interceptor 에러 처리

### 특징
- **위치**: Interceptor의 `catchError` operator
- **시점**: Controller 실행 후, Exception Filter 전
- **범위**: 특정 라우트/컨트롤러 레벨
- **목적**: 에러 **변환, 재시도, 복구**

### 코드 예시

```typescript
// Interceptor에서 에러 처리
@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const request = context.switchToHttp().getRequest();

        // 1. 에러 로깅
        console.error({
          message: error.message,
          stack: error.stack,
          url: request.url,
          method: request.method,
        });

        // 2. 에러 변환
        if (error instanceof HttpException) {
          return throwError(() => error);
        }

        // 3. 클라이언트 친화적 에러로 변환
        return throwError(
          () => new InternalServerErrorException(
            '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
          )
        );
      })
    );
  }
}
```

### 장점
- ✅ **RxJS Operator 활용**: retry, timeout 등과 조합 가능
- ✅ **에러 변환**: 내부 에러를 외부용 에러로 변환
- ✅ **재시도 로직**: 특정 에러는 자동 재시도
- ✅ **비즈니스 로직과 통합**: 에러 발생 시 대체 로직 실행

### 사용 시나리오
```typescript
// 시나리오 1: 외부 API 호출 재시도
@UseInterceptors(RetryInterceptor)
@Get('external-data')
getExternalData() {
  return this.externalService.fetchData(); // 실패 시 3번 재시도
}

// 시나리오 2: 에러를 기본값으로 대체
@UseInterceptors(FallbackInterceptor)
@Get('recommendations')
getRecommendations() {
  return this.recommendationService.get(); // 실패 시 기본 추천 반환
}
```

---

## 🛡️ Exception Filter 에러 처리

### 특징
- **위치**: NestJS Exception Filter 레이어
- **시점**: Interceptor 이후, 최종 에러 처리
- **범위**: 전역 또는 컨트롤러 레벨
- **목적**: 에러 **포맷팅, 최종 응답 생성**

### 코드 예시

```typescript
// Exception Filter에서 에러 처리
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // 표준 에러 응답 포맷
    response.status(status).json({
      statusCode: status,
      message: exceptionResponse.message || '알수없는 오류 발생',
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    });
  }
}
```

### 장점
- ✅ **일관된 에러 포맷**: 모든 에러를 동일한 형식으로 반환
- ✅ **전역 적용**: 앱 전체에 한 번에 적용
- ✅ **최종 안전망**: Interceptor에서 처리 안 된 에러 캐치
- ✅ **간단한 구현**: RxJS 없이 간단하게 구현

### 사용 시나리오
```typescript
// 시나리오 1: 전역 에러 포맷 통일
app.useGlobalFilters(new HttpExceptionFilter());

// 시나리오 2: 특정 에러 타입별 처리
@Catch(UnauthorizedException)
export class UnauthorizedExceptionFilter implements ExceptionFilter {
  catch(exception: UnauthorizedException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    response.status(401).json({
      statusCode: 401,
      message: '인증이 필요합니다',
      redirectTo: '/login',
    });
  }
}
```

---

## 🔀 두 가지를 함께 사용하기

### 추천 패턴

```typescript
// 1. Interceptor: 에러 변환 및 재시도
@Injectable()
export class ErrorTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000),
      retry({
        count: 3,
        delay: (error, retryCount) => {
          // 500번대 에러만 재시도
          if (error.status >= 500) {
            return timer(Math.pow(2, retryCount) * 1000);
          }
          return throwError(() => error);
        },
      }),
      catchError((error) => {
        // 내부 에러를 HttpException으로 변환
        if (!(error instanceof HttpException)) {
          return throwError(
            () => new InternalServerErrorException(
              '서버 내부 오류가 발생했습니다'
            )
          );
        }
        return throwError(() => error);
      })
    );
  }
}

// 2. Exception Filter: 최종 응답 포맷팅
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Interceptor에서 변환된 에러를 표준 포맷으로 응답
    response.status(status).json({
      success: false,
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}

// 3. 적용
@Controller('orders')
@UseInterceptors(ErrorTransformInterceptor) // 에러 변환 및 재시도
@UseFilters(HttpExceptionFilter)            // 최종 포맷팅
export class OrdersController {
  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }
}
```

---

## 📋 비교표

| 항목 | Interceptor | Exception Filter |
|------|-------------|------------------|
| **실행 시점** | Controller 실행 후 | Interceptor 이후 |
| **주요 목적** | 에러 변환, 재시도, 복구 | 에러 포맷팅, 최종 응답 |
| **RxJS 사용** | ✅ 필수 (Observable) | ❌ 불필요 |
| **재시도** | ✅ retry operator | ❌ 불가능 |
| **타임아웃** | ✅ timeout operator | ❌ 불가능 |
| **에러 변환** | ✅ 강력 | ⚠️ 제한적 |
| **전역 적용** | ⚠️ 가능하지만 복잡 | ✅ 간단 |
| **복잡도** | ⚠️ 높음 (RxJS 필요) | ✅ 낮음 |
| **적용 범위** | 메서드/컨트롤러 레벨 | 전역/컨트롤러 레벨 |

---

## 🎯 사용 가이드

### Interceptor를 사용해야 할 때

1. **외부 API 호출 재시도**
   ```typescript
   @UseInterceptors(RetryInterceptor)
   @Get('external')
   getExternalData() {
     return this.externalApi.call(); // 실패 시 3번 재시도
   }
   ```

2. **타임아웃 처리**
   ```typescript
   @UseInterceptors(TimeoutInterceptor)
   @Get('slow-operation')
   slowOperation() {
     return this.service.longRunning(); // 5초 초과 시 에러
   }
   ```

3. **에러 발생 시 대체 값 반환**
   ```typescript
   return next.handle().pipe(
     catchError(() => of({ data: [], message: '기본값 사용' }))
   );
   ```

4. **에러 로깅 및 메트릭 수집**
   ```typescript
   return next.handle().pipe(
     catchError((error) => {
       this.logger.error(error);
       this.metrics.recordError(error);
       return throwError(() => error);
     })
   );
   ```

### Exception Filter를 사용해야 할 때

1. **전역 에러 응답 포맷 통일**
   ```typescript
   // 모든 에러를 동일한 형식으로
   app.useGlobalFilters(new GlobalExceptionFilter());
   ```

2. **HTTP 상태 코드별 처리**
   ```typescript
   @Catch(HttpException)
   export class HttpExceptionFilter {
     catch(exception: HttpException, host: ArgumentsHost) {
       const status = exception.getStatus();
       // 상태 코드별 다른 처리
     }
   }
   ```

3. **특정 에러 타입별 커스텀 응답**
   ```typescript
   @Catch(UnauthorizedException)
   export class UnauthorizedFilter {
     catch(exception, host) {
       // 인증 에러 전용 처리
     }
   }
   ```

4. **에러 응답에 추가 정보 포함**
   ```typescript
   response.json({
     statusCode: status,
     message: exception.message,
     timestamp: new Date().toISOString(),
     path: request.url,
     requestId: request.headers['x-request-id'],
   });
   ```

---

## 💡 Best Practices

### 1. 역할 분리

```typescript
// ✅ 좋은 예: 역할 분리
// Interceptor: 비즈니스 로직 (재시도, 변환)
@UseInterceptors(RetryInterceptor, ErrorTransformInterceptor)
// Filter: 응답 포맷팅
@UseFilters(HttpExceptionFilter)
@Controller('users')
export class UsersController {}

// ❌ 나쁜 예: 모든 걸 Filter에서 처리
@UseFilters(ComplexExceptionFilter) // 재시도, 변환, 포맷팅 모두
@Controller('users')
export class UsersController {}
```

### 2. 에러 전파

```typescript
// ✅ 좋은 예: Interceptor에서 변환 후 전파
return next.handle().pipe(
  catchError((error) => {
    // 에러 로깅
    this.logger.error(error);

    // 변환 후 전파 (Filter가 받음)
    return throwError(() => new InternalServerErrorException('서버 오류'));
  })
);

// ❌ 나쁜 예: Interceptor에서 직접 응답 반환
return next.handle().pipe(
  catchError((error) => {
    return of({ error: true }); // Filter를 우회
  })
);
```

### 3. 중복 처리 방지

```typescript
// ✅ 좋은 예: Interceptor는 변환만, Filter는 포맷만
@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      retry(3),
      catchError((error) => {
        // 변환만 하고 전파
        return throwError(() => this.transformError(error));
      })
    );
  }
}

@Catch(HttpException)
export class HttpFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    // 포맷팅만
    const response = host.switchToHttp().getResponse();
    response.status(exception.getStatus()).json({
      statusCode: exception.getStatus(),
      message: exception.message,
    });
  }
}

// ❌ 나쁜 예: 두 곳에서 모두 포맷팅
// Interceptor와 Filter 둘 다 JSON 응답 생성
```

---

## 🔧 실습 예제

### 예제 1: 재시도 + 포맷팅

```typescript
// interceptors/retry.interceptor.ts
@Injectable()
export class RetryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      retry({
        count: 3,
        delay: (error, retryCount) => {
          console.log(`Retry attempt ${retryCount}`);
          return timer(1000 * retryCount);
        },
      }),
      catchError((error) => {
        console.error('Failed after 3 retries:', error);
        return throwError(() => error);
      })
    );
  }
}

// filters/http-exception.filter.ts
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
      retriedTimes: 3, // Interceptor에서 3번 재시도했음
    });
  }
}

// 사용
@Controller('data')
@UseInterceptors(RetryInterceptor)
@UseFilters(HttpExceptionFilter)
export class DataController {
  @Get()
  getData() {
    return this.dataService.fetch(); // 실패 시 3번 재시도 후 Filter로
  }
}
```

### 예제 2: 타임아웃 + 커스텀 에러

```typescript
// interceptors/timeout.interceptor.ts
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000),
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

// filters/timeout-exception.filter.ts
@Catch(RequestTimeoutException)
export class TimeoutExceptionFilter implements ExceptionFilter {
  catch(exception: RequestTimeoutException, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    response.status(408).json({
      statusCode: 408,
      message: exception.message,
      timestamp: new Date().toISOString(),
      suggestion: '잠시 후 다시 시도해주세요',
    });
  }
}
```

---

## 🎓 핵심 정리

### 언제 무엇을 사용할까?

```
┌─────────────────────────────────────────┐
│ 에러 처리가 필요한가?                     │
└────────────┬────────────────────────────┘
             │
             ├─ 재시도/타임아웃 필요?
             │  └─ YES → Interceptor
             │
             ├─ 에러 변환/대체값 필요?
             │  └─ YES → Interceptor
             │
             ├─ RxJS Operator 활용?
             │  └─ YES → Interceptor
             │
             └─ 단순 응답 포맷팅?
                └─ YES → Exception Filter
```

### 추천 구조

```typescript
// 1단계: Interceptor (비즈니스 로직)
@UseInterceptors(
  LoggingInterceptor,      // 로깅
  TimeoutInterceptor,      // 타임아웃
  RetryInterceptor,        // 재시도
  ErrorTransformInterceptor // 에러 변환
)

// 2단계: Exception Filter (응답 포맷)
@UseFilters(
  HttpExceptionFilter,     // HTTP 에러 포맷
  AllExceptionsFilter      // 모든 에러 포맷 (최종 안전망)
)
```

---

**결론:**
- **Interceptor**: 에러 발생 시 **어떻게 처리**할지 (비즈니스 로직)
- **Exception Filter**: 에러를 **어떻게 보여줄지** (프레젠테이션)

두 가지를 함께 사용하면 **강력하고 유연한** 에러 처리 시스템을 구축할 수 있습니다! 🚀
