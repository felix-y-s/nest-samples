import { catchError, Observable, retry, switchMap, timer, of, map, interval, withLatestFrom } from 'rxjs';

interface ApiResponse {
  data: string;
  timestamp: number;
}

interface RetryConfig {
  maxRetries: number; // 최대 재시도 횟수
  initialDelayMs: number; // 첫 번째 재시도 대기 시간
  backoffMultiplier: number; // 대기 시간 배수 (2면 2배씩 증가)
  maxDelayMs: number; // 최대 대기 시간 (무한 증가 방지)
}

let attemptCount = 0;

(function fn() {
  interval(100)
  of(1).pipe(
    map((value1) => {
      console.log('🚀 | fn | value1:', value1); // 1 (observable 아님)
      return value1;
    }),
    switchMap((value2) => {
      console.log('🚀 | fn | value2:', value2); // 1 (observable 아님)
      return of(value2);
    }),
  ).subscribe(console.log)
})()

// 이 함수를 구현하세요
const createApiCallWithRetry = (
  apiCall: () => Observable<ApiResponse>,
  config: RetryConfig,
): Observable<ApiResponse> => {
  // 구현
  return apiCall().pipe(
    retry({
      count: config.maxRetries,
      delay: (error, retryCount) => {
        if (error.message.includes('503')) {
          throw error;
        }
        const backoff = Math.min(
          config.initialDelayMs * Math.pow(config.backoffMultiplier, retryCount - 1),
          config.maxDelayMs,
        );
        return timer(backoff);
      },
    }),
    catchError((err) => {
      console.log('🚀 | createApiCallWithRetry | err:', err.message);
      // 503 에러 후 다시 재시도하려면 새로운 Observable 반환
      return timer(config.initialDelayMs).pipe(
        switchMap(() => createApiCallWithRetry(apiCall, config))
      );
    })
  )
};

// 사용 예시
// createApiCallWithRetry(() => unstableApi(), {
//   maxRetries: 3,
//   initialDelayMs: 1000,
//   backoffMultiplier: 2,
//   maxDelayMs: 10000,
// }).subscribe({
//   next: (response) => console.log('✅ 성공:', response),
//   error: (error) => console.error('❌ 최종 실패:', error),
//   complete: () => console.log('완료'),
// });


function unstableApi(): Observable<ApiResponse> {
  return new Observable((subscribe) => {
    attemptCount++;
    console.log(`📡 API 호출 시도 #${attemptCount}`);

    setTimeout(() => {
      if (attemptCount < 3) {
        // 처음 2번은 실패
        subscribe.error(new Error('503: Service Unavailable'));
      } else {
        // 3번째 시도에 성공
        subscribe.next({
          data: 'Success!',
          timestamp: Date.now(),
        });
        subscribe.complete();
      }
    }, 100);
  });
}