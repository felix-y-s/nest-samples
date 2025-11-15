import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, Observable, tap, throwError } from 'rxjs';

@Injectable()
export class SmartRetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger(this.constructor.name);

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    this.logger.debug('🍏 처리 전');
    return next.handle().pipe(
      tap(() => this.logger.debug('🍎 처리 후')),
      catchError((err) => {
        this.logger.debug(err.message);
        return throwError(() => err);
      })
    )
  }
}