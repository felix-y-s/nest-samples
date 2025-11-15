import { CallHandler, ExecutionContext, Inject, Injectable, Logger, NestInterceptor, Optional, RequestTimeoutException } from '@nestjs/common';
import { catchError, Observable, throwError, timeout, TimeoutError } from 'rxjs';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly logger = new Logger(this.constructor.name);

  // 생성자에서 항상 값을 설정하므로 non-optional 타입 사용
  private readonly config: { default: number; route?: Record<string, number> };

  constructor(
    @Optional() @Inject('TIMEOUT_CONFIG') config?: { default: number; route?: Record<string, number> }
  ) {
    // 기본값 보장
    this.config = config || { default: 3000 };
  }

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const path = request.route.path;

    // 라우트별 타임아웃이 있으면 사용, 없으면 기본값 사용
    const timeoutMs = this.config.route?.[path] ?? this.config.default;

    return next.handle().pipe(
      timeout(timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException(`요청시간 초과 - ${timeoutMs}ms`))
        }
        return throwError(() => err);
      })
    )
  }
}