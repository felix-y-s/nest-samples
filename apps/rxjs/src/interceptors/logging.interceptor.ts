import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { catchError, Observable, tap, throwError } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(this.constructor.name);

  intercept(context: ExecutionContext, next: CallHandler<any>): Observable<any> | Promise<Observable<any>> {
    const now = Date.now();
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.logger.debug(`data: ${JSON.stringify(data)} - duration time: ${Date.now() - now}ms`);
        },
        error: (err) => this.logger.error(err.message)
      }),
      catchError((err) => {
        this.logger.error(`err: ${err.message} - duration time: ${Date.now() - now}ms`);
        return throwError(() => err);
      })
    )
  }
}