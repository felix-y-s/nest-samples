import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { UserNotFoundException } from '../exceptions/user-not-found.exception';
import { Response } from 'express';

/**
 * 특정 커스텀 예외를 처리하도록 설계된 필터
 * - @Catch(): 모든 오류를 캐치
 */
@Catch(UserNotFoundException)
export class UserNotFoundFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    response.status(404).json({
      statusCode: 404,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}