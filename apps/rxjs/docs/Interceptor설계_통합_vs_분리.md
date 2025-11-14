# Interceptor 설계 패턴: 통합 vs 분리 🎨

> 하나의 인터셉터에 여러 기능 vs 기능별로 분리된 인터셉터

## 🎯 핵심 답변
분리된 인터셉터가 통상적이고 더 좋은 방식입니다! ✅

**📊 빠른 비교**
항목	통합 인터셉터	분리된 인터셉터 ⭐
재사용성	❌ 낮음	✅ 높음
유연성	❌ 제한적	✅ 자유로운 조합
테스트	❌ 복잡	✅ 간단
유지보수	❌ 어려움	✅ 쉬움
설정	❌ 고정	✅ 라우트별 다름
실무 추천도	⚠️ 10%	✅ 90%

**🎓 핵심 정리**
기본 원칙: 하나의 인터셉터는 하나의 기능 (단일 책임)
조합: 필요한 인터셉터를 자유롭게 조합
설정: 라우트별로 다른 설정 가능하게
실무: 90% 이상은 분리된 방식 사용

**🎨 추천 프로젝트 구조**
src/
├── common/
│   └── interceptors/
│       ├── timeout.interceptor.ts       ⭐ 독립적
│       ├── retry.interceptor.ts         ⭐ 독립적
│       ├── error-transform.interceptor.ts ⭐ 독립적
│       ├── logging.interceptor.ts       ⭐ 독립적
│       └── cache.interceptor.ts         ⭐ 독립적
├── modules/
│   └── api/
│       └── api.controller.ts
│           ↓
│       // 필요한 것만 조합해서 사용
│       @UseInterceptors(TimeoutInterceptor, RetryInterceptor)


## 📊 두 가지 접근법 비교

### 접근법 1: 통합 인터셉터 (All-in-One)

```typescript
@Injectable()
export class ErrorTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(5000),           // 타임아웃
      retry({                  // 재시도
        count: 3,
        delay: (error, retryCount) => {
          if (error.status >= 500) {
            return timer(Math.pow(2, retryCount) * 1000);
          }
          return throwError(() => error);
        },
      }),
      catchError((error) => {  // 에러 변환
        if (!(error instanceof HttpException)) {
          return throwError(
            () => new InternalServerErrorException('서버 내부 오류')
          );
        }
        return throwError(() => error);
      })
    );
  }
}

// 사용
@UseInterceptors(ErrorTransformInterceptor)
@Controller('api')
export class ApiController {}
```

### 접근법 2: 분리된 인터셉터 (Separated)

```typescript
// timeout.interceptor.ts
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(@Inject('TIMEOUT_MS') private timeout: number = 5000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeout),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          return throwError(
            () => new RequestTimeoutException('요청 시간 초과')
          );
        }
        return throwError(() => error);
      })
    );
  }
}

// retry.interceptor.ts
@Injectable()
export class RetryInterceptor implements NestInterceptor {
  constructor(
    @Inject('RETRY_COUNT') private retryCount: number = 3,
    @Inject('RETRY_DELAY') private retryDelay: number = 1000,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      retry({
        count: this.retryCount,
        delay: (error, retryCount) => {
          // 500번대 에러만 재시도
          if (error.status >= 500) {
            return timer(this.retryDelay * Math.pow(2, retryCount));
          }
          return throwError(() => error);
        },
      })
    );
  }
}

// error-transform.interceptor.ts
@Injectable()
export class ErrorTransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        if (!(error instanceof HttpException)) {
          return throwError(
            () => new InternalServerErrorException('서버 내부 오류')
          );
        }
        return throwError(() => error);
      })
    );
  }
}

// 사용
@UseInterceptors(TimeoutInterceptor, RetryInterceptor, ErrorTransformInterceptor)
@Controller('api')
export class ApiController {}
```

---

## 🎯 상황별 추천

### ✅ 분리된 인터셉터 추천 (권장)

**언제 사용:**
- ✅ 기능이 **독립적**이고 재사용 가능할 때
- ✅ 다른 조합이 필요한 경우
- ✅ 설정이 **라우트별로 다를** 때
- ✅ 테스트하기 쉽게 만들고 싶을 때
- ✅ **대부분의 실무 프로젝트**

**장점:**
- 🎯 **재사용성**: 필요한 곳에만 적용
- 🔧 **유연성**: 조합 자유롭게 변경
- 🧪 **테스트 용이**: 각 기능 독립 테스트
- 📝 **유지보수**: 한 기능 수정 시 다른 기능 영향 없음
- 🎛️ **설정 자유**: 라우트별로 다른 타임아웃/재시도 횟수

**실무 예시:**
```typescript
// 일반 API: 타임아웃만
@UseInterceptors(TimeoutInterceptor)
@Get('users')
getUsers() {}

// 외부 API: 타임아웃 + 재시도
@UseInterceptors(TimeoutInterceptor, RetryInterceptor)
@Get('external-data')
getExternalData() {}

// 중요 API: 타임아웃 + 재시도 + 에러 변환 + 로깅
@UseInterceptors(
  TimeoutInterceptor,
  RetryInterceptor,
  ErrorTransformInterceptor,
  LoggingInterceptor,
)
@Post('payment')
processPayment() {}

// 실시간 API: 타임아웃 없음 (WebSocket처럼)
@UseInterceptors(RetryInterceptor)
@Get('stream')
streamData() {}
```

### ⚠️ 통합 인터셉터 사용 (제한적)

**언제 사용:**
- ✅ 기능들이 **강하게 결합**되어 있을 때
- ✅ **항상 함께** 사용되는 경우
- ✅ 작은 프로젝트나 프로토타입
- ✅ 성능이 매우 중요한 경우 (인터셉터 수 최소화)

**장점:**
- 🚀 **성능**: 인터셉터 체인이 짧음
- 📦 **간단함**: 하나만 등록
- 🔗 **일관성**: 모든 곳에서 동일한 동작 보장

**단점:**
- ❌ **재사용 불가**: 일부 기능만 필요해도 전체 적용
- ❌ **유연성 부족**: 라우트별로 다른 설정 어려움
- ❌ **테스트 복잡**: 모든 기능 함께 테스트
- ❌ **유지보수 어려움**: 한 기능 수정 시 전체 영향

**제한적 사용 예시:**
```typescript
// 특정 도메인 전용 (항상 함께 사용)
@Injectable()
export class PaymentInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      // 결제는 항상 이 3가지를 함께 사용
      timeout(10000),        // 결제는 10초
      retry({ count: 1 }),   // 결제는 1번만 재시도
      tap(() => this.auditLog()), // 결제는 항상 감사 로그
      catchError((error) => {
        this.rollbackPayment(); // 결제 실패 시 롤백
        return throwError(() => error);
      })
    );
  }
}

// 모든 결제 API에 동일하게 적용
@UseInterceptors(PaymentInterceptor)
@Controller('payments')
export class PaymentsController {}
```

---

## 🏗️ 실무 권장 구조

### 계층적 인터셉터 구조

```typescript
// 1. 전역 인터셉터 (모든 라우트)
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalInterceptors(
    new LoggingInterceptor(),           // 모든 요청 로깅
    new TransformResponseInterceptor(), // 응답 포맷 통일
  );

  await app.listen(3000);
}

// 2. 컨트롤러 레벨 인터셉터 (특정 컨트롤러)
@UseInterceptors(
  TimeoutInterceptor,      // API 전체 타임아웃
  CacheInterceptor,        // 읽기 전용 캐싱
)
@Controller('api')
export class ApiController {

  // 3. 메서드 레벨 인터셉터 (특정 라우트)
  @UseInterceptors(RetryInterceptor, ErrorTransformInterceptor)
  @Get('external')
  getExternalData() {
    // 외부 API 호출만 재시도
  }

  @UseInterceptors(CacheInterceptor)
  @Get('users')
  getUsers() {
    // 캐싱만 적용
  }

  @Post('orders')
  createOrder() {
    // 컨트롤러 레벨 인터셉터만 (타임아웃)
  }
}
```

---

## 📦 모듈화 패턴

### Pattern 1: 재사용 가능한 인터셉터 모듈

```typescript
// interceptors/resilience/resilience.module.ts
@Module({
  providers: [
    {
      provide: 'TIMEOUT_MS',
      useValue: 5000,
    },
    {
      provide: 'RETRY_COUNT',
      useValue: 3,
    },
    TimeoutInterceptor,
    RetryInterceptor,
    ErrorTransformInterceptor,
  ],
  exports: [TimeoutInterceptor, RetryInterceptor, ErrorTransformInterceptor],
})
export class ResilienceModule {}

// 사용하는 모듈
@Module({
  imports: [ResilienceModule],
  controllers: [ApiController],
})
export class ApiModule {}
```

### Pattern 2: 설정 가능한 인터셉터

```typescript
// timeout.interceptor.ts
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject('TIMEOUT_CONFIG')
    private config?: { default: number; routes?: Record<string, number> }
  ) {
    this.config = config || { default: 5000 };
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const route = request.route.path;

    // 라우트별 다른 타임아웃
    const timeoutMs = this.config.routes?.[route] || this.config.default;

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((error) => {
        if (error instanceof TimeoutError) {
          return throwError(
            () => new RequestTimeoutException(`${timeoutMs}ms 초과`)
          );
        }
        return throwError(() => error);
      })
    );
  }
}

// app.module.ts
@Module({
  providers: [
    {
      provide: 'TIMEOUT_CONFIG',
      useValue: {
        default: 5000,
        routes: {
          '/api/external': 10000,  // 외부 API는 10초
          '/api/upload': 30000,    // 업로드는 30초
          '/api/quick': 1000,      // 빠른 API는 1초
        },
      },
    },
    TimeoutInterceptor,
  ],
})
export class AppModule {}
```

### Pattern 3: 조합 가능한 인터셉터 팩토리

```typescript
// interceptors/factory/interceptor-factory.service.ts
@Injectable()
export class InterceptorFactory {
  createResilientInterceptor(options: {
    timeout?: number;
    retry?: number;
    transform?: boolean;
  }): NestInterceptor[] {
    const interceptors: NestInterceptor[] = [];

    if (options.timeout) {
      interceptors.push(new TimeoutInterceptor(options.timeout));
    }

    if (options.retry) {
      interceptors.push(new RetryInterceptor(options.retry));
    }

    if (options.transform) {
      interceptors.push(new ErrorTransformInterceptor());
    }

    return interceptors;
  }
}

// 사용
@Controller('api')
export class ApiController {
  constructor(private interceptorFactory: InterceptorFactory) {}

  @UseInterceptors(
    ...this.interceptorFactory.createResilientInterceptor({
      timeout: 5000,
      retry: 3,
      transform: true,
    })
  )
  @Get('data')
  getData() {}
}
```

---

## 🧪 테스트 용이성 비교

### 분리된 인터셉터: 쉬운 테스트

```typescript
describe('TimeoutInterceptor', () => {
  let interceptor: TimeoutInterceptor;

  beforeEach(() => {
    interceptor = new TimeoutInterceptor(1000); // 1초만 테스트
  });

  it('타임아웃 시 에러 발생', (done) => {
    const context = createMockContext();
    const next = createMockCallHandler(
      // 2초 걸리는 작업
      timer(2000).pipe(map(() => 'result'))
    );

    interceptor.intercept(context, next).subscribe({
      error: (error) => {
        expect(error).toBeInstanceOf(RequestTimeoutException);
        done();
      },
    });
  });
});

describe('RetryInterceptor', () => {
  let interceptor: RetryInterceptor;

  it('500 에러만 재시도', (done) => {
    let attemptCount = 0;
    const next = {
      handle: () => {
        attemptCount++;
        return throwError(() => ({ status: 500 }));
      },
    };

    interceptor.intercept(context, next).subscribe({
      error: () => {
        expect(attemptCount).toBe(4); // 1번 + 3번 재시도
        done();
      },
    });
  });
});
```

### 통합 인터셉터: 복잡한 테스트

```typescript
describe('ErrorTransformInterceptor (All-in-One)', () => {
  it('타임아웃, 재시도, 변환 모두 테스트', (done) => {
    // 😰 어떤 기능을 테스트하는지 불명확
    // 😰 모든 경우의 수를 테스트해야 함
    // 😰 한 기능만 수정해도 전체 테스트 영향
  });
});
```

---

## 📊 성능 비교

### 분리된 인터셉터

```
Request → Logging → Timeout → Retry → Transform → Controller
(4개 인터셉터 체인)

평균 오버헤드: ~1ms
메모리: 약간 많음 (4개 인스턴스)
```

### 통합 인터셉터

```
Request → ErrorTransform(All-in-One) → Controller
(1개 인터셉터)

평균 오버헤드: ~0.5ms
메모리: 적음 (1개 인스턴스)
```

**결론:** 성능 차이는 **미미함** (0.5ms). 대부분의 경우 무시 가능.

---

## 💡 실무 Best Practices

### 1. 단일 책임 원칙 (SRP) 준수

```typescript
// ✅ 좋은 예: 각각 하나의 책임
class TimeoutInterceptor {}     // 타임아웃만
class RetryInterceptor {}       // 재시도만
class LoggingInterceptor {}     // 로깅만

// ❌ 나쁜 예: 여러 책임
class SuperInterceptor {
  // 타임아웃 + 재시도 + 로깅 + 변환 + 캐싱
}
```

### 2. 조합 가능성 (Composability)

```typescript
// ✅ 좋은 예: 필요한 것만 조합
@UseInterceptors(TimeoutInterceptor, RetryInterceptor)
@Get('external')
getExternal() {}

@UseInterceptors(CacheInterceptor)
@Get('static')
getStatic() {}

// ❌ 나쁜 예: 항상 모든 기능
@UseInterceptors(AllInOneInterceptor)
@Get('external')
getExternal() {} // 캐싱도 같이 적용됨 (불필요)
```

### 3. 설정 외부화

```typescript
// ✅ 좋은 예: 설정은 모듈에서
@Module({
  providers: [
    { provide: 'TIMEOUT_MS', useValue: 5000 },
    { provide: 'RETRY_COUNT', useValue: 3 },
    TimeoutInterceptor,
    RetryInterceptor,
  ],
})
export class ConfigModule {}

// ❌ 나쁜 예: 하드코딩
class TimeoutInterceptor {
  intercept() {
    return next.handle().pipe(timeout(5000)); // 변경 불가
  }
}
```

### 4. 명확한 네이밍

```typescript
// ✅ 좋은 예: 기능이 명확
TimeoutInterceptor
RetryInterceptor
CacheInterceptor
LoggingInterceptor

// ❌ 나쁜 예: 무엇을 하는지 불명확
ErrorInterceptor        // 에러를 어떻게?
RequestInterceptor      // 요청을 어떻게?
CommonInterceptor       // 무엇이 공통?
```

---

## 🎯 결론 및 권장사항

### 대부분의 경우: 분리된 인터셉터 ✅

```typescript
// 추천 구조
@Module({
  providers: [
    // 기본 인터셉터 (재사용 가능)
    TimeoutInterceptor,
    RetryInterceptor,
    ErrorTransformInterceptor,
    LoggingInterceptor,
    CacheInterceptor,
  ],
  exports: [/* 필요한 것만 export */],
})
export class InterceptorsModule {}

// 사용
@UseInterceptors(
  TimeoutInterceptor,    // 필요한 것만
  RetryInterceptor,      // 조합
)
@Controller('api')
export class ApiController {}
```

**이유:**
1. ✅ **재사용성**: 다른 조합으로 자유롭게 사용
2. ✅ **테스트**: 각 기능 독립적으로 테스트
3. ✅ **유지보수**: 한 기능 수정 시 다른 기능 영향 없음
4. ✅ **유연성**: 라우트별로 다른 설정 가능
5. ✅ **확장성**: 새 인터셉터 추가 쉬움

### 예외적인 경우: 통합 인터셉터

```typescript
// 도메인 특화 (항상 함께 사용)
@Injectable()
export class PaymentSecurityInterceptor {
  // 결제 도메인에서만 사용하는 특수 로직
  // - 암호화
  // - 감사 로그
  // - 트랜잭션 관리
  // (이 3가지는 항상 함께)
}
```

---

## 📚 학습 정리

### 핵심 원칙

1. **단일 책임**: 인터셉터 하나당 하나의 기능
2. **조합 가능**: 필요한 것만 자유롭게 조합
3. **설정 외부화**: 하드코딩 피하기
4. **명확한 네이밍**: 무엇을 하는지 이름으로 알 수 있게

### 의사결정 트리

```
인터셉터 설계 필요?
│
├─ 여러 기능 필요?
│  ├─ 항상 함께 사용?
│  │  ├─ YES → 통합 인터셉터 (드물게)
│  │  └─ NO → 분리된 인터셉터 (추천) ✅
│  └─ 기능 하나만?
│     └─ 분리된 인터셉터 ✅
│
└─ 특정 도메인 전용?
   ├─ YES → 도메인 인터셉터 (통합 가능)
   └─ NO → 분리된 인터셉터 (추천) ✅
```

**최종 답변:** **분리된 인터셉터가 통상적이고 더 좋은 방식**입니다! 🎉
