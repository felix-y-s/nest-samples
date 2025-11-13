import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';

/**
 * ============================================
 * 미들웨어 next() vs 인터셉터 next.handle()
 * ============================================
 *
 * 이전에 공부한 내용:
 * - 미들웨어의 next()는 매개변수를 전달할 수 없음 (오류만 가능)
 * - next(data) 형태로 호출하면 data가 오류로 인식됨
 * - 데이터 전달은 req.customData나 res.locals 사용
 */

/**
 * ============================================
 * 1. 인터셉터의 next.handle()은 뭐가 다른가?
 * ============================================
 *
 * 핵심 차이점:
 * - next.handle()은 Observable을 반환함
 * - 라우트 핸들러의 실행을 제어할 수 있음
 * - 반환값을 변환하거나 처리할 수 있음
 * - RxJS 연산자로 강력한 전/후처리 가능
 */

@Injectable()
export class BasicInterceptorExample implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('=== 인터셉터 동작 흐름 ===');
    console.log('1. next.handle() 호출 전 - 라우트 핸들러 실행 전');

    // next.handle()을 호출하면:
    // - Observable<any>를 반환
    // - 이 Observable이 구독되면 라우트 핸들러가 실행됨
    // - 라우트 핸들러의 반환값이 Observable을 통해 전달됨
    return next.handle().pipe(
      tap((data) => {
        console.log('2. 라우트 핸들러 실행 완료');
        console.log('3. 라우트 핸들러 반환값:', data);
      }),
    );
  }
}

/**
 * 컨트롤러 예제:
 * @Get('example')
 * getExample() {
 *   return { message: 'Hello' };
 * }
 *
 * 실행 결과:
 * 1. next.handle() 호출 전 - 라우트 핸들러 실행 전
 * 2. 라우트 핸들러 실행 완료
 * 3. 라우트 핸들러 반환값: { message: 'Hello' }
 */

/**
 * ============================================
 * 2. 핵심 개념: Observable이란?
 * ============================================
 *
 * Observable은 비동기 데이터 스트림:
 * - 데이터를 "구독(subscribe)"하기 전까지는 실행되지 않음
 * - pipe()를 사용해서 데이터를 변환하거나 처리 가능
 * - tap, map, catchError 등 다양한 연산자 사용 가능
 */

@Injectable()
export class ObservableFlowExample implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('\n--- Observable 흐름 시작 ---');

    // next.handle()은 Observable을 반환하지만,
    // 아직 라우트 핸들러가 실행되지는 않음!
    const handler$ = next.handle();
    console.log('Observable 생성됨 (아직 실행 안됨)');

    // pipe()로 Observable을 가공
    return handler$.pipe(
      tap(() => console.log('Observable 구독됨 → 라우트 핸들러 실행!')),
      tap((data) => console.log('반환된 데이터:', data)),
      tap(() => console.log('--- Observable 흐름 종료 ---\n')),
    );
  }
}

/**
 * ============================================
 * 3. 미들웨어 vs 인터셉터 비교
 * ============================================
 */

// 미들웨어 방식 (이전에 공부한 내용):
// export class LoggerMiddleware implements NestMiddleware {
//   use(req: Request, res: Response, next: NextFunction) {
//     console.log('미들웨어: 전처리');
//
//     // ❌ next(data) - 매개변수 전달 불가! (오류로 인식됨)
//     // ✅ req.customData = data - Request 객체에 저장해야 함
//
//     next(); // 다음 미들웨어로 전달 (반환값 없음)
//
//     console.log('미들웨어: 후처리');
//   }
// }

// 인터셉터 방식 (지금 배우는 내용):
@Injectable()
export class ComparisonInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('인터셉터: 전처리');

    // ✅ next.handle()은 Observable을 반환
    // ✅ 라우트 핸들러의 반환값을 직접 처리 가능!
    return next.handle().pipe(
      tap((data) => {
        console.log('인터셉터: 후처리');
        console.log('라우트 핸들러 반환값 접근:', data);
        // 여기서 data를 자유롭게 사용할 수 있음!
      }),
    );
  }
}

/**
 * ============================================
 * 4. 실전 예제: 응답 데이터 변환
 * ============================================
 *
 * 미들웨어로는 불가능하고, 인터셉터로만 가능한 작업!
 */

interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: number;
}

@Injectable()
export class TransformResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    // next.handle()이 반환하는 Observable의 데이터를 변환
    return next.handle().pipe(
      map((data) => ({
        success: true,
        data, // 라우트 핸들러의 원본 반환값
        timestamp: Date.now(),
      })),
    );
  }
}

/**
 * 컨트롤러:
 * @Get('users')
 * getUsers() {
 *   return [{ id: 1, name: 'John' }];
 * }
 *
 * 인터셉터 적용 전 응답:
 * [{ id: 1, name: 'John' }]
 *
 * 인터셉터 적용 후 응답:
 * {
 *   success: true,
 *   data: [{ id: 1, name: 'John' }],
 *   timestamp: 1234567890
 * }
 *
 * 👉 미들웨어로는 이런 응답 변환이 불가능!
 */

/**
 * ============================================
 * 5. next.handle()을 호출하지 않으면?
 * ============================================
 *
 * 라우트 핸들러가 실행되지 않음!
 * 캐싱이나 조건부 실행에 활용 가능
 */

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, any>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const url = request.url;

    // 캐시에 데이터가 있으면 next.handle() 호출 안함
    if (this.cache.has(url)) {
      console.log('캐시 히트! 라우트 핸들러 실행 생략');
      // Observable을 직접 생성해서 반환
      return new Observable((subscriber) => {
        subscriber.next(this.cache.get(url));
        subscriber.complete();
      });
    }

    // 캐시 미스: 라우트 핸들러 실행
    console.log('캐시 미스! 라우트 핸들러 실행');
    return next.handle().pipe(
      tap((data) => {
        this.cache.set(url, data);
        console.log('결과를 캐시에 저장');
      }),
    );
  }
}

/**
 * ============================================
 * 6. 여러 인터셉터 체인
 * ============================================
 */

@Injectable()
export class FirstInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('→ First: 전처리');
    return next.handle().pipe(tap(() => console.log('← First: 후처리')));
  }
}

@Injectable()
export class SecondInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('  → Second: 전처리');
    return next.handle().pipe(tap(() => console.log('  ← Second: 후처리')));
  }
}

@Injectable()
export class ThirdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    console.log('    → Third: 전처리');
    return next.handle().pipe(tap(() => console.log('    ← Third: 후처리')));
  }
}

/**
 * 실행 순서:
 * → First: 전처리
 *   → Second: 전처리
 *     → Third: 전처리
 *       [라우트 핸들러 실행]
 *     ← Third: 후처리
 *   ← Second: 후처리
 * ← First: 후처리
 *
 * 각 인터셉터의 next.handle()이 다음 인터셉터를 호출하고,
 * 최종적으로 라우트 핸들러가 실행됨
 */

/**
 * ============================================
 * 7. 핵심 정리
 * ============================================
 *
 * 미들웨어의 next():
 * ❌ 매개변수 전달 불가 (오류만 가능)
 * ❌ 반환값 없음 (void)
 * ❌ 라우트 핸들러 반환값 접근 불가
 * ✅ 요청/응답 객체 조작 가능
 * ✅ req.customData로 데이터 전달
 *
 * 인터셉터의 next.handle():
 * ✅ Observable<any> 반환
 * ✅ 라우트 핸들러 반환값 접근/변환 가능
 * ✅ RxJS 연산자로 강력한 전/후처리
 * ✅ 조건부 실행 가능 (next.handle() 호출 안할 수도 있음)
 * ✅ 응답 데이터 변환/캐싱 등 고급 기능
 *
 * 언제 무엇을 사용할까?
 * - 요청 전처리만 필요: 미들웨어
 * - 응답 변환/후처리 필요: 인터셉터
 * - 라우트 핸들러 반환값 처리: 인터셉터
 * - 캐싱/조건부 실행: 인터셉터
 */
