import { Test } from '@nestjs/testing';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of, throwError } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

/**
 * 테스트 실행:
 *  npm test -- test-interceptor.spec.ts
 */

// Mock ExecutionContext 생성 헬퍼 함수
function createMockExecutionContext(): ExecutionContext {
  const mockRequest = {
    method: 'GET',
    url: '/test',
    route: { path: '/test' },
  };

  return {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
      getResponse: jest.fn().mockReturnValue({}),
      getNext: jest.fn(),
    }),
    getClass: jest.fn().mockReturnValue(LoggingInterceptor),
    getHandler: jest.fn(),
    getArgs: jest.fn().mockReturnValue([]),
    getArgByIndex: jest.fn().mockReturnValue({}),
    switchToRpc: jest.fn().mockReturnValue({
      getData: jest.fn().mockReturnValue({}),
      getContext: jest.fn().mockReturnValue({}),
    }),
    switchToWs: jest.fn().mockReturnValue({
      getData: jest.fn().mockReturnValue({}),
      getClient: jest.fn().mockReturnValue({}),
      getPattern: jest.fn().mockReturnValue(''),
    }),
    getType: jest.fn().mockReturnValue('http'),
  } as ExecutionContext;
}

// Mock CallHandler 생성 헬퍼 함수
function createMockCallHandler(result: Observable<any>): CallHandler {
  return {
    handle: () => result,
  };
}

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [LoggingInterceptor],
    }).compile();

    interceptor = module.get<LoggingInterceptor>(LoggingInterceptor);
  });

  it('정의되어야 함', () => {
    expect(interceptor).toBeDefined();
  });

  it('성공적인 요청을 로깅해야 함', (done) => {
    const context = createMockExecutionContext();
    const next = createMockCallHandler(of({ data: 'test' }));

    const result = interceptor.intercept(context, next) as Observable<any>;

    result.subscribe({
      next: (value: any) => {
        expect(value).toEqual({ data: 'test' });
        done();
      },
      error: done,
    });
  });

  it('에러를 로깅하고 재발생시켜야 함', (done) => {
    const context = createMockExecutionContext();
    const error = new Error('Test error');
    const next = createMockCallHandler(throwError(() => error));

    const result = interceptor.intercept(context, next) as Observable<any>;

    result.subscribe({
      next: () => {
        done(new Error('Should not succeed'));
      },
      error: (err: any) => {
        expect(err.message).toBe('Test error');
        done();
      },
    });
  });
});