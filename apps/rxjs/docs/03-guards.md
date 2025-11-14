# Guards & Authentication with RxJS 🛡️

> Observable 기반 비동기 인증/인가 처리 및 캐싱 전략

## 📚 목차

1. [개념 이해](#개념-이해)
2. [Guard에서 RxJS를 사용하는 이유](#guard에서-rxjs를-사용하는-이유)
3. [기본 구현](#기본-구현)
4. [실전 패턴](#실전-패턴)
5. [실습 과제](#실습-과제)

---

## 🎯 개념 이해

### Guard란?

Guard는 **라우트 핸들러 실행 전**에 권한을 확인하는 게이트키퍼입니다.

```
Client Request
    ↓
[Guard - 권한 체크] ← Observable로 비동기 검증
    ↓
✅ 통과 → Controller Handler
❌ 차단 → 403 Forbidden
```

### Guard 실행 순서

```
Request
  ↓
1. Guards (인증/인가)
  ↓
2. Interceptors (Before)
  ↓
3. Pipes (유효성 검사)
  ↓
4. Controller Handler
  ↓
5. Interceptors (After)
  ↓
Response
```

### Guard의 반환 타입

```typescript
interface CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean>;
}
```

**3가지 반환 타입 지원:**
- `boolean`: 동기적 검증
- `Promise<boolean>`: async/await 비동기
- `Observable<boolean>`: RxJS 스트림 (⭐ 이번 학습 주제)

---

## 🤔 Guard에서 RxJS를 사용하는 이유

### 1. 외부 API 호출 (토큰 검증)

```typescript
// ❌ Promise 방식
async canActivate(context: ExecutionContext): Promise<boolean> {
  const token = this.extractToken(context);
  const isValid = await this.authService.validateToken(token);
  return isValid;
}

// ✅ Observable 방식 - 더 강력한 에러 처리
canActivate(context: ExecutionContext): Observable<boolean> {
  const token = this.extractToken(context);
  return this.authService.validateToken(token).pipe(
    timeout(3000),           // 3초 타임아웃
    retry(2),                // 2번 재시도
    catchError(() => of(false)) // 에러 시 false 반환
  );
}
```

### 2. 여러 조건 조합

```typescript
// 사용자 정보 + 권한 정보를 동시에 확인
canActivate(context: ExecutionContext): Observable<boolean> {
  return forkJoin({
    user: this.getUser(userId),
    permissions: this.getPermissions(userId),
    subscription: this.checkSubscription(userId)
  }).pipe(
    map(({ user, permissions, subscription }) => {
      return user.isActive &&
             permissions.includes('admin') &&
             subscription.isValid;
    })
  );
}
```

### 3. 캐싱 전략

```typescript
// BehaviorSubject로 인증 결과 캐싱
private authCache$ = new BehaviorSubject<Map<string, boolean>>(new Map());

canActivate(context: ExecutionContext): Observable<boolean> {
  const token = this.extractToken(context);

  return this.authCache$.pipe(
    switchMap(cache => {
      if (cache.has(token)) {
        return of(cache.get(token)!); // 캐시 히트
      }
      return this.validateAndCache(token); // 캐시 미스
    })
  );
}
```

---

## 🚀 기본 구현

### 1. 기본 인증 Guard

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('토큰이 없습니다');
    }

    // 토큰 검증 (Observable 반환)
    return this.validateToken(token).pipe(
      map((isValid) => {
        if (!isValid) {
          throw new UnauthorizedException('유효하지 않은 토큰입니다');
        }
        return true;
      }),
      catchError((error) => {
        throw new UnauthorizedException('인증 실패: ' + error.message);
      })
    );
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : null;
  }

  private validateToken(token: string): Observable<boolean> {
    // 실제로는 JWT 라이브러리나 외부 API 사용
    return of(token.length > 10); // 예제용 간단한 검증
  }
}
```

### 2. Guard 적용 방법

#### 컨트롤러 레벨
```typescript
@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  @Get()
  findAll() {
    return this.usersService.findAll();
  }
}
```

#### 메서드 레벨
```typescript
@Controller('users')
export class UsersController {
  @Get()
  @UseGuards(AuthGuard)
  findAll() {
    return this.usersService.findAll();
  }

  @Get('public')
  // Guard 없이 공개 API
  getPublicData() {
    return { message: 'Public data' };
  }
}
```

#### 전역 Guard
```typescript
// main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalGuards(new AuthGuard());
  await app.listen(3000);
}
```

---

## 💡 실전 패턴

### Pattern 1: JWT 토큰 검증 with Observable

```typescript
import { JwtService } from '@nestjs/jwt';
import { from, Observable } from 'rxjs';
import { map, catchError, timeout } from 'rxjs/operators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('토큰이 없습니다');
    }

    // JwtService.verifyAsync()를 Observable로 변환
    return from(this.jwtService.verifyAsync(token)).pipe(
      timeout(2000), // 2초 타임아웃
      map((payload) => {
        // 토큰 페이로드를 request에 저장
        request.user = payload;
        return true;
      }),
      catchError((error) => {
        if (error.name === 'TokenExpiredError') {
          throw new UnauthorizedException('토큰이 만료되었습니다');
        }
        throw new UnauthorizedException('유효하지 않은 토큰입니다');
      })
    );
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) return null;
    return authHeader.replace('Bearer ', '');
  }
}
```

**학습 포인트:**
- `from()`: Promise를 Observable로 변환
- `timeout()`: 검증 시간 제한
- `request.user`: 검증된 사용자 정보를 request에 저장

### Pattern 2: Role 기반 인가 (RBAC)

```typescript
import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// 커스텀 데코레이터
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): Observable<boolean> {
    // 메서드에 지정된 역할 가져오기
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles) {
      return of(true); // 역할 제한 없음
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user; // AuthGuard에서 저장된 사용자 정보

    if (!user) {
      throw new UnauthorizedException('인증이 필요합니다');
    }

    // 사용자의 역할을 DB나 외부 서비스에서 조회
    return this.getUserRoles(user.id).pipe(
      map((userRoles) => {
        const hasRole = requiredRoles.some((role) => userRoles.includes(role));
        if (!hasRole) {
          throw new ForbiddenException('권한이 없습니다');
        }
        return true;
      }),
      catchError(() => {
        throw new ForbiddenException('권한 확인 중 오류 발생');
      })
    );
  }

  private getUserRoles(userId: string): Observable<string[]> {
    // 실제로는 DB 조회
    return of(['user', 'admin']); // 예제용
  }
}

// 사용 예시
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  @Get('users')
  @Roles('admin')
  getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Delete('user/:id')
  @Roles('admin', 'super-admin')
  deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }
}
```

**학습 포인트:**
- 여러 Guard 조합 (`AuthGuard` → `RolesGuard`)
- 커스텀 데코레이터 (`@Roles()`)
- `Reflector`: 메타데이터 읽기

### Pattern 3: 인증 결과 캐싱

```typescript
import { BehaviorSubject, Observable, of } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';

interface CacheEntry {
  isValid: boolean;
  expiresAt: number;
}

@Injectable()
export class CachedAuthGuard implements CanActivate {
  private cache$ = new BehaviorSubject<Map<string, CacheEntry>>(new Map());
  private readonly CACHE_TTL = 300000; // 5분

  canActivate(context: ExecutionContext): Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('토큰이 없습니다');
    }

    return this.cache$.pipe(
      switchMap((cache) => {
        const cached = cache.get(token);
        const now = Date.now();

        // 캐시 히트 & 유효기간 내
        if (cached && cached.expiresAt > now) {
          console.log('캐시 히트:', token.substring(0, 10));
          return of(cached.isValid);
        }

        // 캐시 미스 또는 만료 → 검증 후 캐싱
        console.log('캐시 미스:', token.substring(0, 10));
        return this.validateAndCache(token);
      }),
      catchError(() => of(false))
    );
  }

  private validateAndCache(token: string): Observable<boolean> {
    return from(this.validateToken(token)).pipe(
      tap((isValid) => {
        const cache = this.cache$.value;
        cache.set(token, {
          isValid,
          expiresAt: Date.now() + this.CACHE_TTL,
        });
        this.cache$.next(cache);

        // 캐시 크기 제한 (최대 1000개)
        if (cache.size > 1000) {
          const firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
      })
    );
  }

  private async validateToken(token: string): Promise<boolean> {
    // 실제 토큰 검증 로직 (외부 API, DB, JWT 등)
    await new Promise((resolve) => setTimeout(resolve, 100)); // 시뮬레이션
    return token.length > 10;
  }

  private extractToken(request: any): string | null {
    return request.headers.authorization?.replace('Bearer ', '') || null;
  }
}
```

**학습 포인트:**
- `BehaviorSubject`: 캐시 상태 관리
- `switchMap`: 캐시 확인 → 검증 흐름
- TTL 기반 캐시 무효화
- 캐시 크기 제한

### Pattern 4: 여러 조건 동시 확인

```typescript
import { forkJoin, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable()
export class ComplexAuthGuard implements CanActivate {
  constructor(
    private userService: UserService,
    private subscriptionService: SubscriptionService,
    private permissionService: PermissionService,
  ) {}

  canActivate(context: ExecutionContext): Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException('인증이 필요합니다');
    }

    // 3가지 조건을 동시에 확인
    return forkJoin({
      user: this.userService.findById(userId),
      subscription: this.subscriptionService.checkStatus(userId),
      permissions: this.permissionService.getPermissions(userId),
    }).pipe(
      map(({ user, subscription, permissions }) => {
        // 모든 조건 검증
        if (!user.isActive) {
          throw new ForbiddenException('비활성화된 계정입니다');
        }

        if (!subscription.isValid) {
          throw new ForbiddenException('구독이 만료되었습니다');
        }

        if (!permissions.includes('access')) {
          throw new ForbiddenException('접근 권한이 없습니다');
        }

        return true;
      }),
      catchError((error) => {
        throw new ForbiddenException('권한 확인 실패: ' + error.message);
      })
    );
  }
}
```

**학습 포인트:**
- `forkJoin`: 여러 Observable을 병렬 실행
- 모든 조건을 동시에 확인하여 성능 향상
- 단계별 에러 처리

### Pattern 5: API Rate Limiting Guard

```typescript
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private limits$ = new BehaviorSubject<Map<string, RateLimitEntry>>(
    new Map()
  );
  private readonly MAX_REQUESTS = 10;
  private readonly WINDOW_MS = 60000; // 1분

  canActivate(context: ExecutionContext): Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const clientId = this.getClientId(request);

    return this.limits$.pipe(
      map((limits) => {
        const now = Date.now();
        let entry = limits.get(clientId);

        // 시간 윈도우 만료 → 초기화
        if (!entry || entry.resetAt < now) {
          entry = {
            count: 0,
            resetAt: now + this.WINDOW_MS,
          };
        }

        // 요청 수 증가
        entry.count++;
        limits.set(clientId, entry);
        this.limits$.next(limits);

        // 제한 초과 확인
        if (entry.count > this.MAX_REQUESTS) {
          throw new TooManyRequestsException(
            `요청 제한 초과. ${Math.ceil((entry.resetAt - now) / 1000)}초 후 재시도하세요.`
          );
        }

        return true;
      }),
      catchError((error) => throwError(() => error))
    );
  }

  private getClientId(request: any): string {
    // IP 또는 사용자 ID 기반
    return request.user?.id || request.ip;
  }
}
```

**학습 포인트:**
- 요청 수 제한 (Rate Limiting)
- 시간 윈도우 기반 초기화
- 클라이언트별 독립적 제한

### Pattern 6: 조건부 Guard 적용

```typescript
@Injectable()
export class ConditionalAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authGuard: AuthGuard,
  ) {}

  canActivate(context: ExecutionContext): Observable<boolean> {
    // @Public() 데코레이터가 있으면 인증 생략
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return of(true);
    }

    // 인증 필요
    return this.authGuard.canActivate(context);
  }
}

// 커스텀 데코레이터
export const Public = () => SetMetadata('isPublic', true);

// 사용 예시
@Controller('posts')
@UseGuards(ConditionalAuthGuard)
export class PostsController {
  @Get()
  @Public() // 인증 없이 접근 가능
  findAll() {
    return this.postsService.findAll();
  }

  @Post()
  // 인증 필요
  create(@Body() createPostDto: CreatePostDto) {
    return this.postsService.create(createPostDto);
  }
}
```

---

## 📝 실습 과제

### 과제 1: 기본 JWT 인증 Guard ⭐

**요구사항:**
- JWT 토큰 추출 (Authorization 헤더)
- 토큰 검증 (JwtService 사용)
- 유효한 토큰이면 request.user에 저장
- 에러 처리 (만료, 유효하지 않음)

**체크리스트:**
- [ ] `JwtAuthGuard` 클래스 생성
- [ ] `extractToken` 메서드 구현
- [ ] Observable 기반 토큰 검증
- [ ] 타임아웃 및 재시도 추가
- [ ] Postman으로 테스트

**테스트 시나리오:**
```bash
# 성공: 유효한 토큰
curl -H "Authorization: Bearer valid-token" http://localhost:3000/users

# 실패: 토큰 없음
curl http://localhost:3000/users

# 실패: 만료된 토큰
curl -H "Authorization: Bearer expired-token" http://localhost:3000/users
```

### 과제 2: Role 기반 인가 ⭐⭐

**요구사항:**
- `@Roles()` 커스텀 데코레이터 생성
- `RolesGuard` 구현
- 사용자 역할 확인 (DB 또는 Mock)
- 여러 역할 조합 지원

**체크리스트:**
- [ ] `Roles` 데코레이터 생성
- [ ] `RolesGuard` 구현
- [ ] `Reflector`로 메타데이터 읽기
- [ ] Observable 기반 역할 조회
- [ ] 여러 Guard 조합 테스트

**사용 예시:**
```typescript
@Get('admin')
@Roles('admin')
getAdminData() {}

@Delete(':id')
@Roles('admin', 'super-admin')
deleteResource() {}
```

### 과제 3: 인증 결과 캐싱 ⭐⭐⭐

**요구사항:**
- BehaviorSubject로 캐시 구현
- TTL 5분 설정
- 캐시 크기 제한 (최대 1000개)
- 캐시 히트/미스 로깅

**체크리스트:**
- [ ] `CachedAuthGuard` 구현
- [ ] `BehaviorSubject<Map>` 캐시 생성
- [ ] TTL 기반 만료 처리
- [ ] 캐시 크기 제한 구현
- [ ] 성능 개선 측정

**성능 비교:**
```
캐시 없이: 평균 100ms
캐시 적용: 평균 1ms (100배 향상)
```

### 과제 4: Rate Limiting Guard ⭐⭐⭐

**요구사항:**
- 클라이언트별 요청 수 제한
- 1분에 10번 제한
- 제한 초과 시 429 에러
- 재시도 가능 시간 안내

**체크리스트:**
- [ ] `RateLimitGuard` 구현
- [ ] 요청 수 카운팅
- [ ] 시간 윈도우 관리
- [ ] TooManyRequestsException 처리
- [ ] 여러 클라이언트 동시 테스트

### 과제 5: 복합 권한 확인 Guard ⭐⭐⭐

**요구사항:**
- 사용자 활성 상태 확인
- 구독 상태 확인
- 권한 확인
- forkJoin으로 병렬 처리

**체크리스트:**
- [ ] `ComplexAuthGuard` 구현
- [ ] 3가지 서비스 주입
- [ ] forkJoin으로 병렬 조회
- [ ] 각 조건별 에러 처리
- [ ] 성능 측정 (순차 vs 병렬)

### 과제 6: 종합 프로젝트 - 다단계 인증 시스템 ⭐⭐⭐⭐

**시나리오:** 엔터프라이즈급 인증/인가 시스템

**요구사항:**
1. JWT 토큰 인증
2. Role 기반 인가
3. 인증 결과 캐싱
4. Rate Limiting
5. IP 화이트리스트
6. 2FA (Two-Factor Authentication)

**체크리스트:**
- [ ] 6가지 Guard 모두 구현
- [ ] Guard 실행 순서 최적화
- [ ] 통합 테스트 작성
- [ ] 성능 최적화
- [ ] 보안 감사 로그

---

## 🧪 테스트 예제

### Guard 단위 테스트

```typescript
import { Test } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('유효한 토큰으로 통과해야 함', (done) => {
    const mockContext = createMockExecutionContext({
      headers: { authorization: 'Bearer valid-token' },
    });

    jest.spyOn(jwtService, 'verifyAsync').mockResolvedValue({ userId: 1 });

    guard.canActivate(mockContext).subscribe({
      next: (result) => {
        expect(result).toBe(true);
        done();
      },
    });
  });

  it('유효하지 않은 토큰으로 에러 발생', (done) => {
    const mockContext = createMockExecutionContext({
      headers: { authorization: 'Bearer invalid-token' },
    });

    jest.spyOn(jwtService, 'verifyAsync').mockRejectedValue(new Error('Invalid token'));

    guard.canActivate(mockContext).subscribe({
      error: (error) => {
        expect(error).toBeInstanceOf(UnauthorizedException);
        done();
      },
    });
  });
});
```

---

## 📊 성능 최적화

### 1. 캐싱 전략 비교

| 전략 | 장점 | 단점 | 사용 시기 |
|------|------|------|-----------|
| **캐시 없음** | 항상 최신 정보 | 느림 | 보안이 최우선 |
| **메모리 캐시** | 매우 빠름 | 서버 재시작 시 손실 | 일반적 |
| **Redis 캐시** | 영구 저장, 분산 | 약간 느림 | 멀티 서버 |

### 2. Guard 실행 순서 최적화

```typescript
// ✅ 좋은 순서: 빠른 검증 → 느린 검증
@UseGuards(
  PublicGuard,        // 1. 가장 빠름 (메타데이터만 확인)
  RateLimitGuard,     // 2. 빠름 (메모리 조회)
  JwtAuthGuard,       // 3. 중간 (토큰 검증)
  RolesGuard,         // 4. 느림 (DB 조회)
)

// ❌ 나쁜 순서: 느린 검증을 먼저 실행
@UseGuards(
  RolesGuard,         // DB 조회 후 Public이면 불필요한 작업
  JwtAuthGuard,
  RateLimitGuard,
  PublicGuard,
)
```

### 3. 병렬 처리로 성능 향상

```typescript
// ❌ 순차 처리: 300ms
const user = await this.userService.findById(userId);        // 100ms
const subscription = await this.subscriptionService.check(); // 100ms
const permissions = await this.permissionService.get();      // 100ms

// ✅ 병렬 처리: 100ms
forkJoin({
  user: this.userService.findById(userId),
  subscription: this.subscriptionService.check(),
  permissions: this.permissionService.get(),
}).subscribe(...);
```

---

## 🎓 학습 정리

### 핵심 Operator

| Operator | 용도 | 예제 |
|----------|------|------|
| `from` | Promise → Observable | `from(jwtService.verify())` |
| `of` | 단일 값 Observable | `of(true)` |
| `forkJoin` | 병렬 실행 | `forkJoin({ user, roles })` |
| `switchMap` | 순차 실행 (캐시 확인 → 검증) | `switchMap(cache => ...)` |
| `map` | 데이터 변환 | `map(payload => true)` |
| `catchError` | 에러 처리 | `catchError(() => of(false))` |
| `timeout` | 타임아웃 | `timeout(3000)` |
| `retry` | 재시도 | `retry(2)` |

### Guard vs Interceptor

| 특성 | Guard | Interceptor |
|------|-------|-------------|
| 목적 | 권한 확인 | 요청/응답 변환 |
| 반환 | boolean | Observable<any> |
| 실행 시점 | 핸들러 전 | 핸들러 전후 |
| 사용 사례 | 인증/인가 | 로깅, 캐싱, 변환 |

### 다음 단계

✅ Guards & Authentication 완료 후:
- **[04-events.md](./04-events.md)** - Event-Driven Architecture
- 도메인 이벤트와 이벤트 소싱 패턴 학습

---

**잘하셨습니다! 🎉**

> 인증/인가는 모든 애플리케이션의 핵심입니다!
> Observable 기반 Guard로 강력하고 유연한 보안 시스템을 구축할 수 있습니다!
