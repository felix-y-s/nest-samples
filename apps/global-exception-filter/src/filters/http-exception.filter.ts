import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

/**
 * HTTP 오류를 처리하도록 설계된 필터
 * - @Catch(): 모든 오류를 캐치
 */
@Catch(HttpException) // http 오류만 캐치
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    response.status(status).json({
      statusCode: status,
      message: exceptionResponse.message || '알수없는 오류 발생',
      timestamp: new Date().toISOString(),
    });
  }
}