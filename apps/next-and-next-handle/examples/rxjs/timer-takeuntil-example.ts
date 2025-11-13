import {
  timer,
  interval,
  takeUntil,
  Subject,
  fromEvent,
  map,
  tap,
  take,
  switchMap,
  scan
} from 'rxjs';

/**
 * timer와 takeUntil 연산자 완벽 가이드
 */

console.log('===== 1. timer 연산자 =====\n');

// ===== timer 기본 사용법 =====

/**
 * timer(dueTime): 지정된 시간 후 한 번만 값 방출
 * timer(dueTime, intervalTime): 지정된 시간 후 시작해서 주기적으로 값 방출
 */

// 예제 1: 단순 지연 (한 번만 방출)
console.log('--- 예제 1: timer(3000) - 3초 후 한 번 ---');
const singleTimer$ = timer(3000);

// singleTimer$.subscribe({
//   next: (value) => console.log(`✅ 3초 후 값 방출: ${value}`),
//   complete: () => console.log('완료\n')
// });

// 출력:
// (3초 대기...)
// ✅ 3초 후 값 방출: 0
// 완료


// 예제 2: 주기적 방출
console.log('\n--- 예제 2: timer(1000, 500) - 1초 후 시작, 0.5초마다 ---');
const intervalTimer$ = timer(1000, 500).pipe(take(5));

// intervalTimer$.subscribe({
//   next: (value) => console.log(`📍 값: ${value}, 시간: ${Date.now() - startTime}ms`),
//   complete: () => console.log('완료\n')
// });

// 출력:
// (1초 대기...)
// 📍 값: 0, 시간: 1000ms
// 📍 값: 1, 시간: 1500ms
// 📍 값: 2, 시간: 2000ms
// 📍 값: 3, 시간: 2500ms
// 📍 값: 4, 시간: 3000ms
// 완료


// 예제 3: 즉시 시작
console.log('\n--- 예제 3: timer(0, 1000) - 즉시 시작, 1초마다 ---');
const immediateTimer$ = timer(0, 1000).pipe(take(3));

// immediateTimer$.subscribe({
//   next: (value) => console.log(`⚡ 즉시 시작: ${value}`),
//   complete: () => console.log('완료\n')
// });

// 출력:
// ⚡ 즉시 시작: 0  (즉시)
// ⚡ 즉시 시작: 1  (1초 후)
// ⚡ 즉시 시작: 2  (2초 후)
// 완료


// ===== timer vs interval 비교 =====
console.log('\n--- timer vs interval 비교 ---\n');

console.log(`
timer(3000):
  → 3초 후 한 번만 값 방출 (0)
  → 자동 완료

timer(1000, 500):
  → 1초 후 첫 값 방출 (0)
  → 이후 500ms마다 값 방출 (1, 2, 3...)
  → 수동으로 중지해야 함

interval(500):
  → 즉시 시작하지 않고 500ms 후 첫 값
  → 이후 500ms마다 값 방출
  → 수동으로 중지해야 함

// 동일한 효과
timer(0, 500) ≈ interval(500)
timer(1000) ≈ delay(1000)
`);


console.log('\n\n===== 2. takeUntil 연산자 =====\n');

// ===== takeUntil 기본 사용법 =====

/**
 * takeUntil(notifier$): notifier$가 값을 방출할 때까지만 값을 받음
 * notifier$가 방출하면 즉시 구독 종료
 */

// 예제 1: 시간 기반 종료
console.log('--- 예제 1: 5초 동안만 카운트 ---');
const stopSignal$ = timer(5000); // 5초 후 신호

const counting$ = interval(1000).pipe(
  tap(n => console.log(`카운트: ${n}`)),
  takeUntil(stopSignal$) // stopSignal$이 방출하면 종료
);

// counting$.subscribe({
//   next: (value) => console.log(`✅ 값: ${value}`),
//   complete: () => console.log('🛑 카운팅 종료\n')
// });

// 출력:
// 카운트: 0  (1초)
// ✅ 값: 0
// 카운트: 1  (2초)
// ✅ 값: 1
// 카운트: 2  (3초)
// ✅ 값: 2
// 카운트: 3  (4초)
// ✅ 값: 3
// 🛑 카운팅 종료  (5초에 stopSignal$ 방출로 종료)


// 예제 2: Subject를 사용한 수동 종료
console.log('\n--- 예제 2: 버튼 클릭 시 종료 ---');

const destroy$ = new Subject<void>();

const autoSave$ = interval(2000).pipe(
  tap(() => console.log('💾 자동 저장 중...')),
  takeUntil(destroy$) // destroy$가 신호 보내면 종료
);

// autoSave$.subscribe({
//   next: () => console.log('✅ 저장 완료'),
//   complete: () => console.log('🛑 자동 저장 중지\n')
// });

// 5초 후 수동으로 종료
// setTimeout(() => {
//   console.log('👆 사용자가 종료 버튼 클릭!');
//   destroy$.next(); // 종료 신호!
//   destroy$.complete();
// }, 5000);


// 예제 3: 여러 스트림 관리
console.log('\n--- 예제 3: 컴포넌트 생명주기 관리 ---');

class Component {
  private destroy$ = new Subject<void>();

  ngOnInit() {
    console.log('🎬 컴포넌트 초기화\n');

    // 스트림 1: 데이터 폴링
    interval(3000).pipe(
      tap(() => console.log('📡 API 호출...')),
      takeUntil(this.destroy$)
    ).subscribe(() => console.log('✅ 데이터 업데이트'));

    // 스트림 2: 타이머
    interval(1000).pipe(
      tap(n => console.log(`⏱️  타이머: ${n}초`)),
      takeUntil(this.destroy$)
    ).subscribe();

    // 스트림 3: 이벤트 처리
    timer(2000, 2000).pipe(
      tap(() => console.log('🔔 알림 체크')),
      takeUntil(this.destroy$)
    ).subscribe();
  }

  ngOnDestroy() {
    console.log('\n🗑️  컴포넌트 파괴 - 모든 구독 정리!');
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// const component = new Component();
// component.ngOnInit();
// setTimeout(() => component.ngOnDestroy(), 8000);


console.log('\n\n===== 3. 실전 예제: 클릭 카운터 with 리셋 =====\n');

/**
 * 시나리오:
 * - 클릭마다 카운트 증가
 * - 3초 동안 클릭 없으면 자동 리셋
 * - 새로운 클릭이 오면 타이머 취소
 */

const createClickCounterWithReset = () => {
  const click$ = new Subject<void>();

  const counter$ = click$.pipe(
    tap(() => console.log('👆 클릭!')),

    // 각 클릭마다 카운트 증가
    scan((count) => count + 1, 0),
    tap(count => console.log(`📊 현재 카운트: ${count}`)),

    // 3초 타이머 시작
    switchMap((count) => {
      console.log('⏳ 3초 타이머 시작...');

      return timer(3000).pipe(
        // 3초 후 0으로 리셋
        map(() => {
          console.log('🔄 3초 경과 → 리셋!');
          return 0;
        }),
        // 새로운 클릭이 오면 타이머 취소!
        takeUntil(click$),
        // 타이머가 취소되면 현재 카운트 유지
        tap({
          complete: () => console.log('❌ 타이머 취소됨 (새 클릭)')
        }),
        // 취소되면 원래 카운트 반환
        map(resetValue => resetValue === 0 ? resetValue : count)
      );
    })
  );

  return { click$, counter$ };
};

// 사용 예제
console.log('=== 클릭 시뮬레이션 시작 ===\n');

// const { click$, counter$ } = createClickCounterWithReset();

// counter$.subscribe(count => {
//   console.log(`\n✨ 최종 카운트: ${count}\n`);
// });

// // 시뮬레이션
// setTimeout(() => click$.next(), 500);   // 클릭 1
// setTimeout(() => click$.next(), 1000);  // 클릭 2
// setTimeout(() => click$.next(), 1500);  // 클릭 3
// setTimeout(() => click$.next(), 2000);  // 클릭 4 (3초 안에 클릭 → 타이머 리셋)
// // 이후 3초 동안 클릭 없음 → 카운트 리셋


console.log('\n\n===== 4. timer와 takeUntil 조합 패턴 =====\n');

// 패턴 1: 타임아웃 구현
console.log('--- 패턴 1: 타임아웃 ---');
const apiCall$ = timer(5000).pipe( // 5초 걸리는 API
  map(() => '응답 데이터')
);

const timeout$ = timer(3000); // 3초 타임아웃

const apiWithTimeout$ = apiCall$.pipe(
  takeUntil(timeout$) // 3초 후 자동 취소
);

console.log(`
API 호출 시작
3초 후: takeUntil이 구독 종료 → API 취소
5초 후: API 응답 도착 (하지만 이미 취소됨)
`);


// 패턴 2: 폴링 (주기적 데이터 조회)
console.log('\n--- 패턴 2: 폴링 ---');
const stopPolling$ = timer(10000); // 10초 후 폴링 중지

const polling$ = interval(2000).pipe(
  tap(() => console.log('🔄 데이터 새로고침')),
  takeUntil(stopPolling$)
);

console.log(`
0초: 폴링 시작
2초: 데이터 조회
4초: 데이터 조회
6초: 데이터 조회
8초: 데이터 조회
10초: 폴링 중지 (stopPolling$ 방출)
`);


// 패턴 3: 디바운스 취소
console.log('\n--- 패턴 3: 검색 디바운스 with 취소 ---');

const searchInput$ = new Subject<string>();
const cancelSearch$ = new Subject<void>();

const search$ = searchInput$.pipe(
  switchMap(query => {
    console.log(`입력: "${query}"`);

    // 300ms 후 검색 실행
    return timer(300).pipe(
      map(() => query),
      takeUntil(cancelSearch$), // 취소 신호 오면 중단
      tap(() => console.log(`🔍 검색 실행: "${query}"`))
    );
  })
);

console.log(`
사용자 입력 → 300ms 디바운스 → 검색
취소 버튼 클릭 → cancelSearch$.next() → 검색 취소
`);


console.log('\n\n===== 5. 핵심 정리 =====\n');

console.log(`
🔥 timer 연산자
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
timer(3000)
  → 3초 후 값 0 방출 → 자동 완료
  → 용도: 지연, 타임아웃, 단발성 작업

timer(1000, 500)
  → 1초 후 시작, 이후 500ms마다 방출
  → 용도: 폴링, 주기적 작업

timer(0, 1000)
  → 즉시 시작, 이후 1초마다 방출
  → interval(1000)과 동일


🛑 takeUntil 연산자
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
stream$.pipe(takeUntil(notifier$))
  → notifier$가 값을 방출하면 즉시 종료
  → 용도: 타임아웃, 수동 취소, 생명주기 관리

특징:
  - notifier$의 값은 중요하지 않음 (방출 여부만 중요)
  - 방출 즉시 원본 스트림 완료
  - 메모리 누수 방지에 필수적


📋 실전 패턴
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 타임아웃:
   api$.pipe(takeUntil(timer(5000)))

2. 컴포넌트 정리:
   destroy$ = new Subject();
   ngOnDestroy() { destroy$.next(); }
   stream$.pipe(takeUntil(destroy$))

3. 자동 리셋:
   click$.pipe(
     switchMap(() =>
       timer(3000).pipe(takeUntil(click$))
     )
   )

4. 폴링 with 중지:
   interval(1000).pipe(takeUntil(stop$))


⚠️  주의사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. takeUntil은 파이프 마지막에 배치
   ✅ pipe(map(), filter(), takeUntil(destroy$))
   ❌ pipe(takeUntil(destroy$), map(), filter())

2. Subject는 반드시 complete() 호출
   destroy$.next();
   destroy$.complete(); // ← 필수!

3. timer는 자동으로 완료되지만 interval은 안 됨
   timer(3000) → 자동 완료 ✅
   interval(1000) → 수동 중지 필요 ❌
`);


console.log('\n\n===== 6. 선택된 코드 분석 =====\n');

console.log(`
코드:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
switchMap((timestamp) => {
  return timer(3000).pipe(
    map(() => ({ type: 'reset' as const, timestamp })),
    takeUntil(click$)
  );
})


동작 설명:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 클릭 발생 → switchMap 실행
2. timer(3000) 시작 → 3초 카운트다운
3. 3초 안에 새 클릭 없으면:
   → timer가 값 방출
   → { type: 'reset', timestamp } 반환
   → 카운터 리셋

4. 3초 안에 새 클릭 발생하면:
   a) takeUntil(click$)이 감지
   b) timer 즉시 종료 (값 방출 안 함)
   c) switchMap이 새로운 timer(3000) 시작
   → 타이머 리셋!


타임라인 예시:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
0ms:    클릭 1 → timer(3000) 시작
2000ms: 클릭 2 → 이전 timer 취소 (takeUntil)
              → 새 timer(3000) 시작
3000ms: 클릭 3 → 이전 timer 취소
              → 새 timer(3000) 시작
6000ms: (3초 경과, 클릭 없음)
        → timer 완료
        → { type: 'reset' } 방출
        → 카운터 0으로 리셋


핵심 포인트:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ timer(3000): "3초 후 리셋" 타이머
✅ takeUntil(click$): "새 클릭 오면 타이머 취소"
✅ switchMap: "새 클릭마다 이전 타이머 버리고 새로 시작"

→ 결과: 마지막 클릭 후 3초 동안 클릭 없으면 리셋!
`);

export { createClickCounterWithReset };
