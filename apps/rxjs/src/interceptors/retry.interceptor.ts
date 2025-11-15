import { CallHandler, ExecutionContext, Inject, Injectable, Logger, NestInterceptor, Optional } from '@nestjs/common';
import { catchError, Observable, retry, tap, throwError } from 'rxjs';

@Injectable()
export class RetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(this.constructor.name);

  private readonly config: { retry: number, delay: number };

  constructor(
    @Optional() @Inject('RETRY_CONFIG') config?: {retry: number, delay: number}
  ) {
    this.config = config || { retry: 0, delay: 0 };
  }

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    this.logger.debug('🍏 처리 전');
    return next.handle().pipe(
      tap(() => this.logger.debug('🍎 처리 후')),
      retry({
        count: this.config.retry,
        delay: this.config.delay,
      }),
      catchError((err) => {
        this.logger.debug(err.message);
        return throwError(() => new Error('재시도 실패: ' + err.message));
      })
    )
  }
}