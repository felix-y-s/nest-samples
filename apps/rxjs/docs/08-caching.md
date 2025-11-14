# Advanced Caching with RxJS 🚀

> shareReplay와 ReplaySubject를 활용한 고급 캐싱 전략

## 📚 캐싱 기법

### 1. shareReplay - HTTP 요청 캐싱

```typescript
@Injectable()
export class UserService {
  private userCache$ = new Map<string, Observable<User>>();

  getUser(id: string): Observable<User> {
    if (!this.userCache$.has(id)) {
      const user$ = this.http.get<User>(`/api/users/${id}`).pipe(
        shareReplay({
          bufferSize: 1,
          refCount: true, // 구독자 없으면 캐시 해제
        }),
        catchError((error) => {
          this.userCache$.delete(id); // 에러 시 캐시 제거
          return throwError(() => error);
        })
      );
      this.userCache$.set(id, user$);
    }
    return this.userCache$.get(id)!;
  }

  // 캐시 무효화
  invalidateCache(id: string) {
    this.userCache$.delete(id);
  }
}
```

### 2. TTL 기반 캐싱

```typescript
interface CacheEntry<T> {
  data$: Observable<T>;
  expiresAt: number;
}

@Injectable()
export class CacheService {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 300000; // 5분

  get<T>(key: string, factory: () => Observable<T>, ttl?: number): Observable<T> {
    const now = Date.now();
    const entry = this.cache.get(key);

    // 캐시 히트 & 유효
    if (entry && entry.expiresAt > now) {
      console.log('Cache HIT:', key);
      return entry.data$;
    }

    // 캐시 미스 또는 만료
    console.log('Cache MISS:', key);
    const data$ = factory().pipe(
      shareReplay({
        bufferSize: 1,
        refCount: true,
      }),
      finalize(() => {
        // 구독 종료 시 캐시에서 제거
        this.cache.delete(key);
      })
    );

    this.cache.set(key, {
      data$,
      expiresAt: now + (ttl || this.DEFAULT_TTL),
    });

    return data$;
  }

  invalidate(key: string) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

// 사용 예시
@Injectable()
export class ProductService {
  constructor(
    private http: HttpClient,
    private cacheService: CacheService,
  ) {}

  getProduct(id: string): Observable<Product> {
    return this.cacheService.get(
      `product:${id}`,
      () => this.http.get<Product>(`/api/products/${id}`),
      300000 // 5분 TTL
    );
  }
}
```

### 3. 멀티 레벨 캐싱

```typescript
@Injectable()
export class MultiLevelCacheService {
  private l1Cache = new Map<string, any>(); // 메모리
  private l2Cache: RedisClient; // Redis

  constructor(private http: HttpClient) {
    this.l2Cache = createRedisClient();
  }

  get<T>(key: string, factory: () => Observable<T>): Observable<T> {
    // L1: 메모리 캐시 확인
    if (this.l1Cache.has(key)) {
      console.log('L1 Cache HIT:', key);
      return of(this.l1Cache.get(key));
    }

    // L2: Redis 캐시 확인
    return from(this.l2Cache.get(key)).pipe(
      switchMap((cachedData) => {
        if (cachedData) {
          console.log('L2 Cache HIT:', key);
          const data = JSON.parse(cachedData);
          this.l1Cache.set(key, data); // L1에 저장
          return of(data);
        }

        // 캐시 미스: 원본 조회
        console.log('Cache MISS:', key);
        return factory().pipe(
          tap((data) => {
            // L1, L2 모두 저장
            this.l1Cache.set(key, data);
            this.l2Cache.set(key, JSON.stringify(data), 'EX', 300);
          })
        );
      })
    );
  }
}
```

### 4. 조건부 캐싱

```typescript
@Injectable()
export class ConditionalCacheService {
  private cache = new Map<string, Observable<any>>();

  get<T>(
    key: string,
    factory: () => Observable<T>,
    options: {
      shouldCache?: (data: T) => boolean;
      ttl?: number;
    } = {}
  ): Observable<T> {
    if (this.cache.has(key)) {
      return this.cache.get(key)!;
    }

    const data$ = factory().pipe(
      tap((data) => {
        // 조건부 캐싱
        if (!options.shouldCache || options.shouldCache(data)) {
          console.log('Caching data for:', key);
        } else {
          console.log('Skipping cache for:', key);
          this.cache.delete(key);
        }
      }),
      shareReplay(1)
    );

    this.cache.set(key, data$);

    // TTL 설정
    if (options.ttl) {
      setTimeout(() => this.cache.delete(key), options.ttl);
    }

    return data$;
  }
}

// 사용 예시: 에러 응답은 캐싱하지 않음
this.cache.get('api-key', () => this.http.get('/api'), {
  shouldCache: (data) => !data.error,
  ttl: 60000,
});
```

### 5. 백그라운드 리프레시

```typescript
@Injectable()
export class AutoRefreshCacheService {
  private cache$ = new BehaviorSubject<Map<string, any>>(new Map());

  constructor(private http: HttpClient) {}

  get<T>(
    key: string,
    factory: () => Observable<T>,
    refreshInterval: number
  ): Observable<T> {
    // 초기 데이터 로드
    factory()
      .pipe(take(1))
      .subscribe((data) => {
        const cache = this.cache$.value;
        cache.set(key, data);
        this.cache$.next(cache);
      });

    // 백그라운드에서 주기적 리프레시
    interval(refreshInterval)
      .pipe(
        switchMap(() => factory()),
        tap((data) => {
          const cache = this.cache$.value;
          cache.set(key, data);
          this.cache$.next(cache);
        })
      )
      .subscribe();

    // 캐시 스트림 반환
    return this.cache$.pipe(
      map((cache) => cache.get(key)),
      filter((data) => data !== undefined),
      distinctUntilChanged()
    );
  }
}
```

---

## 📝 실습 과제

### 과제 1: shareReplay 캐싱 ⭐⭐
HTTP 요청 결과 캐싱, 중복 요청 방지

### 과제 2: TTL 캐싱 ⭐⭐⭐
시간 기반 캐시 만료, 자동 갱신

### 과제 3: 멀티 레벨 캐시 ⭐⭐⭐⭐
메모리 + Redis 2단계 캐싱

### 과제 4: 조건부 캐싱 ⭐⭐⭐
특정 조건에서만 캐싱 (에러 제외 등)

### 과제 5: 자동 리프레시 캐시 ⭐⭐⭐⭐
백그라운드에서 주기적으로 데이터 갱신

---

## 🎓 성능 최적화

### 캐싱 전 vs 후 비교

```
캐싱 전:
- API 호출: 10번
- 평균 응답 시간: 200ms
- 총 시간: 2000ms

캐싱 후:
- API 호출: 1번
- 평균 응답 시간: 200ms (첫 번째), 1ms (캐시 히트)
- 총 시간: 209ms
- 성능 향상: 90% ↑
```

### 메모리 관리

```typescript
// ❌ 나쁜 예: 무한정 증가
private cache = new Map<string, Observable<any>>();

// ✅ 좋은 예: 크기 제한
private cache = new LRUCache<string, Observable<any>>({
  max: 1000,
  ttl: 300000,
});
```

**다음:** [09-final-project.md](./09-final-project.md)
