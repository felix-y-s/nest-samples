# RxJS 메모리 관리 완벽 가이드 💾

> 캐싱 인터셉터에서 발생하는 메모리 누수 방지 및 최적화 전략
[해결책 3에 집중할 것!](#-해결책-3-ttl--lru-결합-최고의-방법)

## 🚨 문제 상황: 메모리 누수

### ❌ 나쁜 예: 무한정 증가하는 캐시

```typescript
@Injectable()
export class BadCacheInterceptor implements NestInterceptor {
  // 문제: 캐시가 무한정 증가
  private cache = new Map<string, Observable<any>>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = `${request.method}:${request.url}`;

    // 캐시 확인
    if (this.cache.has(cacheKey)) {
      console.log('캐시 히트:', cacheKey);
      return this.cache.get(cacheKey)!;
    }

    // 캐시 미스 → 실행 후 저장
    const result$ = next.handle().pipe(shareReplay(1));
    this.cache.set(cacheKey, result$); // ⚠️ 계속 쌓임!

    return result$;
  }
}
```

### 🔥 문제점

1. **무제한 증가**: 요청할 때마다 캐시 추가
2. **메모리 부족**: 시간이 지나면 메모리 고갈
3. **성능 저하**: Map 크기가 커지면 검색 느려짐
4. **서버 다운**: OutOfMemory 에러로 서버 크래시

### 📊 시나리오 예시

```typescript
// 시간이 지나면서...
시작: cache.size = 0개, 메모리 0MB
1시간 후: cache.size = 1,000개, 메모리 10MB
6시간 후: cache.size = 10,000개, 메모리 100MB
24시간 후: cache.size = 50,000개, 메모리 500MB
1주일 후: cache.size = 300,000개, 메모리 3GB ⚠️
→ 서버 크래시 💥
```

---

## ✅ 해결책 1: TTL (Time To Live) 기반 캐싱

### 구현 코드

```typescript
interface CacheEntry {
  data$: Observable<any>;
  expiresAt: number; // 만료 시간 (타임스탬프)
}

@Injectable()
export class TtlCacheInterceptor implements NestInterceptor {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 300000; // 5분 (밀리초)

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = `${request.method}:${request.url}`;
    const now = Date.now();

    // 1. 캐시 확인 및 만료 체크
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      console.log('✅ 캐시 히트 (유효):', cacheKey);
      return cached.data$;
    }

    // 2. 만료되었으면 삭제
    if (cached && cached.expiresAt <= now) {
      console.log('🗑️ 캐시 만료 삭제:', cacheKey);
      this.cache.delete(cacheKey);
    }

    // 3. 캐시 미스 → 실행 후 저장
    console.log('❌ 캐시 미스:', cacheKey);
    const result$ = next.handle().pipe(
      shareReplay(1),
      finalize(() => {
        // Observable 완료 시 정리 (선택적)
        console.log('📡 Observable 완료:', cacheKey);
      })
    );

    this.cache.set(cacheKey, {
      data$: result$,
      expiresAt: now + this.TTL,
    });

    return result$;
  }

  // 주기적으로 만료된 캐시 정리 (선택적)
  @Cron('0 */5 * * * *') // 5분마다
  cleanExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    console.log(`🧹 만료된 캐시 ${cleanedCount}개 정리`);
  }
}
```

### 장점
- ✅ 오래된 데이터는 자동으로 제거
- ✅ 메모리 사용량 일정하게 유지
- ✅ 데이터 신선도 보장

### 동작 원리

```
요청 1: /api/users
└─ 캐시 저장 (만료: 5분 후)

3분 경과...
요청 2: /api/users
└─ 캐시 히트 ✅ (아직 유효)

6분 경과...
요청 3: /api/users
└─ 캐시 만료 🗑️ → 새로 요청 → 다시 캐시
```

---

## ✅ 해결책 2: LRU (Least Recently Used) 캐싱

### 구현 코드

```typescript
@Injectable()
export class LruCacheInterceptor implements NestInterceptor {
  private cache = new Map<string, Observable<any>>();
  private readonly MAX_SIZE = 100; // 최대 100개만 보관

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = `${request.method}:${request.url}`;

    // 1. 캐시 확인
    if (this.cache.has(cacheKey)) {
      console.log('✅ 캐시 히트:', cacheKey);
      const cached = this.cache.get(cacheKey)!;

      // LRU: 사용된 항목을 맨 뒤로 이동 (재정렬)
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);

      return cached;
    }

    // 2. 캐시 크기 제한 체크
    if (this.cache.size >= this.MAX_SIZE) {
      // 가장 오래된 항목 (맨 앞) 제거
      const oldestKey = this.cache.keys().next().value;
      console.log('🗑️ LRU 제거:', oldestKey);
      this.cache.delete(oldestKey);
    }

    // 3. 새 데이터 캐싱
    console.log('❌ 캐시 미스:', cacheKey);
    const result$ = next.handle().pipe(shareReplay(1));
    this.cache.set(cacheKey, result$);

    return result$;
  }
}
```

### 장점
- ✅ 캐시 크기 고정 (100개)
- ✅ 자주 사용되는 데이터만 유지
- ✅ 메모리 사용량 예측 가능

### 동작 원리

```
초기: []
요청 A → [A]
요청 B → [A, B]
요청 C → [A, B, C]
...
요청 100번째 → [A, B, C, ..., Z] (100개)

101번째 요청 (새 데이터)
└─ A 제거 (가장 오래됨)
└─ [B, C, ..., Z, NEW] (100개 유지)

B 재요청
└─ B를 맨 뒤로 이동 (최근 사용)
└─ [C, ..., Z, NEW, B]
```

---

## ✅ 해결책 3: TTL + LRU 결합 (최고의 방법)

### 구현 코드

```typescript
interface CacheEntry {
  data$: Observable<any>;
  expiresAt: number;
  accessCount: number; // 접근 횟수 추적
}

@Injectable()
export class OptimizedCacheInterceptor implements NestInterceptor {
  private cache = new Map<string, CacheEntry>();
  private readonly MAX_SIZE = 100;
  private readonly TTL = 300000; // 5분

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = `${request.method}:${request.url}`;
    const now = Date.now();

    // 1. 캐시 확인 및 TTL 체크
    const cached = this.cache.get(cacheKey);
    if (cached) {
      // TTL 체크
      if (cached.expiresAt > now) {
        console.log('✅ 캐시 히트:', cacheKey, `(${cached.accessCount}번째)`);

        // 접근 횟수 증가
        cached.accessCount++;

        // LRU: 맨 뒤로 이동
        this.cache.delete(cacheKey);
        this.cache.set(cacheKey, cached);

        return cached.data$;
      } else {
        // 만료됨
        console.log('⏰ 캐시 만료:', cacheKey);
        this.cache.delete(cacheKey);
      }
    }

    // 2. 크기 제한 체크
    if (this.cache.size >= this.MAX_SIZE) {
      // 가장 오래된 항목 제거
      const oldestKey = this.cache.keys().next().value;
      const oldest = this.cache.get(oldestKey);
      console.log(`🗑️ LRU 제거: ${oldestKey} (접근 ${oldest?.accessCount}번)`);
      this.cache.delete(oldestKey);
    }

    // 3. 새 데이터 캐싱
    console.log('❌ 캐시 미스:', cacheKey);
    const result$ = next.handle().pipe(
      shareReplay(1),
      catchError((error) => {
        // 에러 발생 시 캐시에서 제거
        this.cache.delete(cacheKey);
        return throwError(() => error);
      })
    );

    this.cache.set(cacheKey, {
      data$: result$,
      expiresAt: now + this.TTL,
      accessCount: 0,
    });

    return result$;
  }

  // 통계 및 모니터링
  getCacheStats() {
    const now = Date.now();
    let validCount = 0;
    let expiredCount = 0;
    let totalAccessCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt > now) {
        validCount++;
        totalAccessCount += entry.accessCount;
      } else {
        expiredCount++;
      }
    }

    return {
      size: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
      avgAccessCount: validCount > 0 ? totalAccessCount / validCount : 0,
    };
  }

  // 수동 정리
  clearCache() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`🧹 캐시 전체 정리: ${size}개 제거`);
  }
}
```

### 장점
- ✅ 시간 기반 + 크기 기반 제한
- ✅ 가장 안전하고 효율적
- ✅ 프로덕션 환경 추천

---

## 📊 성능 비교

### 시나리오: 1일 운영 (10,000 요청)

| 방식 | 최종 캐시 크기 | 메모리 사용량 | 히트율 |
|------|---------------|--------------|--------|
| **무제한 (❌)** | 10,000개 | 100MB | 40% |
| **TTL만** | 100-1,000개 | 1-10MB | 35% |
| **LRU만** | 100개 | 1MB | 50% |
| **TTL + LRU (✅)** | 100개 | 1MB | 60% |

---

## 🛠️ 실전 설정 가이드

### 1. API 타입별 설정

```typescript
// 자주 변경되는 데이터 (짧은 TTL)
@UseInterceptors(
  new OptimizedCacheInterceptor({
    maxSize: 50,
    ttl: 60000, // 1분
  })
)
@Get('live-prices')
getLivePrices() {}

// 거의 변경 안 되는 데이터 (긴 TTL)
@UseInterceptors(
  new OptimizedCacheInterceptor({
    maxSize: 200,
    ttl: 3600000, // 1시간
  })
)
@Get('categories')
getCategories() {}

// 정적 데이터 (매우 긴 TTL)
@UseInterceptors(
  new OptimizedCacheInterceptor({
    maxSize: 500,
    ttl: 86400000, // 24시간
  })
)
@Get('static-config')
getStaticConfig() {}
```

### 2. 서버 사양별 설정

```typescript
// 작은 서버 (RAM 512MB)
{
  maxSize: 50,
  ttl: 300000, // 5분
}

// 중간 서버 (RAM 2GB)
{
  maxSize: 200,
  ttl: 600000, // 10분
}

// 큰 서버 (RAM 8GB+)
{
  maxSize: 1000,
  ttl: 1800000, // 30분
}
```

### 3. 트래픽별 설정

```typescript
// 낮은 트래픽 (< 100 req/min)
{
  maxSize: 100,
  ttl: 600000, // 10분
}

// 중간 트래픽 (100-1000 req/min)
{
  maxSize: 500,
  ttl: 300000, // 5분
}

// 높은 트래픽 (> 1000 req/min)
{
  maxSize: 1000,
  ttl: 60000, // 1분
}
```

---

## 🔍 디버깅 및 모니터링

### 캐시 통계 엔드포인트

```typescript
@Controller('admin')
export class AdminController {
  constructor(
    @Inject('CACHE_INTERCEPTOR')
    private cacheInterceptor: OptimizedCacheInterceptor,
  ) {}

  @Get('cache-stats')
  getCacheStats() {
    return this.cacheInterceptor.getCacheStats();
  }

  @Post('cache-clear')
  clearCache() {
    this.cacheInterceptor.clearCache();
    return { message: '캐시가 초기화되었습니다' };
  }
}

// 응답 예시
{
  "size": 85,
  "validEntries": 82,
  "expiredEntries": 3,
  "avgAccessCount": 4.2
}
```

### 로그 추가

```typescript
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const cacheKey = this.getCacheKey(context);

  // 주기적으로 통계 로깅
  if (Math.random() < 0.01) { // 1% 확률
    const stats = this.getCacheStats();
    console.log('📊 캐시 통계:', {
      size: stats.size,
      hitRate: `${stats.validEntries}/${stats.size}`,
      avgAccess: stats.avgAccessCount.toFixed(2),
    });
  }

  // ... 캐시 로직
}
```

---

## 🚨 주의사항

### 1. shareReplay 사용 시 주의

```typescript
// ❌ 나쁜 예: refCount 없음 (메모리 누수)
const result$ = next.handle().pipe(
  shareReplay(1) // 구독자가 없어도 계속 메모리에 유지
);

// ✅ 좋은 예: refCount 사용
const result$ = next.handle().pipe(
  shareReplay({
    bufferSize: 1,
    refCount: true, // 구독자 없으면 자동 해제
  })
);
```

### 2. 에러 응답 캐싱 방지

```typescript
const result$ = next.handle().pipe(
  shareReplay(1),
  catchError((error) => {
    // 에러는 캐시하지 않음
    this.cache.delete(cacheKey);
    return throwError(() => error);
  })
);
```

### 3. POST/PUT/DELETE는 캐싱 안 함

```typescript
intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
  const request = context.switchToHttp().getRequest();

  // GET 요청만 캐싱
  if (request.method !== 'GET') {
    return next.handle();
  }

  // 캐싱 로직...
}
```

---

## 🎓 핵심 정리

### 메모리 누수 방지 3원칙

1. **TTL 설정**: 오래된 데이터는 자동 삭제
2. **크기 제한**: 최대 개수 제한 (LRU)
3. **주기적 정리**: Cron으로 만료된 캐시 제거

### 추천 설정

```typescript
// 일반적인 프로덕션 설정
{
  maxSize: 100-500,        // 서버 메모리에 따라
  ttl: 300000-600000,      // 5-10분
  cleanupInterval: 300000, // 5분마다 정리
}
```

### 체크리스트

- [ ] TTL 설정 (5-10분 권장)
- [ ] 최대 크기 제한 (100-500개)
- [ ] shareReplay refCount 활성화
- [ ] 에러 응답 캐싱 방지
- [ ] GET 요청만 캐싱
- [ ] 캐시 통계 모니터링
- [ ] 주기적 정리 작업 (Cron)

---

## 📚 추가 학습 자료

### 관련 문서
- [01-interceptors.md](./01-interceptors.md) - 기본 인터셉터 패턴
- [08-caching.md](./08-caching.md) - 고급 캐싱 전략

### RxJS 공식 문서
- [shareReplay](https://rxjs.dev/api/operators/shareReplay)
- [finalize](https://rxjs.dev/api/operators/finalize)

---

**결론:** TTL + LRU 조합으로 안전하고 효율적인 캐싱을 구현하세요! 🚀
