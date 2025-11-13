import { interval, map, scan, Subject, switchMap, takeUntil, tap, timer } from 'rxjs';

/**
 * complete 콜백이 언제 호출되는지 명확하게 이해하기
 */

console.log('===== 1. 내부 Observable vs 외부 Observable의 complete =====\n');

// ===== 예제 1: 기본 동작 =====
console.log('--- 예제 1: timer의 자동 완료 ---\n');

const simpleTimer$ = timer(1000);

simpleTimer$.pipe(
  tap({
    next: (value) => console.log(`값 방출: ${value}`),
    complete: () => console.log('✅ timer 완료!')  // ← 1초 후 자동 호출
  })
).subscribe({
  next: (value) => console.log(`구독에서 받음: ${value}`),
  complete: () => console.log('✅ 구독 완료!')  // ← 1초 후 자동 호출
});

// 출력:
// 값 방출: 0
// 구독에서 받음: 0
// ✅ timer 완료!
// ✅ 구독 완료!


// ===== 예제 2: Subject는 완료되지 않음 =====
console.log('\n--- 예제 2: Subject는 영원히 살아있음 ---\n');

const click$ = new Subject<void>();

const counter$ = click$.pipe(
  scan(count => count + 1, 0),
  tap({
    next: (count) => console.log(`카운트: ${count}`),
    complete: () => console.log('❌ 이건 절대 호출 안 됨!')
  })
);

counter$.subscribe({
  next: (count) => console.log(`구독에서 받음: ${count}`),
  complete: () => console.log('🔥 이것도 절대 호출 안 됨!')
});

// 클릭 시뮬레이션
setTimeout(() => click$.next(), 100);
setTimeout(() => click$.next(), 200);
setTimeout(() => click$.next(), 300);

// 출력:
// 카운트: 1
// 구독에서 받음: 1
// 카운트: 2
// 구독에서 받음: 2
// 카운트: 3
// 구독에서 받음: 3
// (complete는 절대 호출 안 됨!)


// ===== 예제 3: Subject를 명시적으로 완료 =====
console.log('\n--- 예제 3: Subject.complete() 호출 ---\n');

const click2$ = new Subject<void>();

const counter2$ = click2$.pipe(
  scan(count => count + 1, 0),
  tap({
    next: (count) => console.log(`카운트: ${count}`),
    complete: () => console.log('✅ tap의 complete 호출됨!')
  })
);

counter2$.subscribe({
  next: (count) => console.log(`구독에서 받음: ${count}`),
  complete: () => console.log('✅ 구독 complete 호출됨!')
});

// 클릭 시뮬레이션
setTimeout(() => click2$.next(), 100);
setTimeout(() => click2$.next(), 200);
setTimeout(() => {
  click2$.complete();  // ← 명시적으로 완료!
  console.log('Subject 완료 신호 전송!');
}, 300);

// 출력:
// 카운트: 1
// 구독에서 받음: 1
// 카운트: 2
// 구독에서 받음: 2
// Subject 완료 신호 전송!
// ✅ tap의 complete 호출됨!
// ✅ 구독 complete 호출됨!


console.log('\n\n===== 2. switchMap 내부 Observable의 complete =====\n');

// ===== 예제 4: switchMap 내부 complete vs 외부 complete =====
console.log('--- 예제 4: 내부와 외부의 차이 ---\n');

const click3$ = new Subject<void>();

const counter3$ = click3$.pipe(
  scan(count => count + 1, 0),
  switchMap((count) => {
    console.log(`\n[switchMap] 카운트 ${count} 처리 시작`);

    return timer(1000).pipe(
      map(() => count),
      tap({
        complete: () => console.log(`[내부] timer Observable 완료 (카운트 ${count})`)
      })
    );
  }),
  tap({
    complete: () => console.log('[외부] 전체 스트림 완료')
  })
);

counter3$.subscribe({
  next: (count) => console.log(`✨ 최종 카운트: ${count}`),
  complete: () => console.log('🔥 구독 완료')
});

// 시뮬레이션
setTimeout(() => {
  console.log('\n👆 클릭 1');
  click3$.next();
}, 100);

setTimeout(() => {
  console.log('\n👆 클릭 2');
  click3$.next();
}, 500);

setTimeout(() => {
  console.log('\n🛑 Subject 완료');
  click3$.complete();
}, 2500);

// 출력:
// 👆 클릭 1
// [switchMap] 카운트 1 처리 시작
//
// 👆 클릭 2
// [switchMap] 카운트 2 처리 시작
// ❌ [내부] timer Observable 완료 (카운트 1) - 호출 안 됨!
//    → switchMap이 unsubscribe함 (complete가 아님!)
// (1500ms) ✨ 최종 카운트: 2
// (1500ms) [내부] timer Observable 완료 (카운트 2) ← 자연 완료
//
// 🛑 Subject 완료
// [외부] 전체 스트림 완료
// 🔥 구독 완료


console.log('\n\n===== 3. takeUntil과 complete =====\n');

// ===== 예제 5: takeUntil이 Observable을 완료시킴 =====
console.log('--- 예제 5: takeUntil의 완료 효과 ---\n');

const click4$ = new Subject<void>();

const counter4$ = click4$.pipe(
  scan(count => count + 1, 0),
  switchMap((count) => {
    console.log(`\n[카운트 ${count}] timer 시작`);

    return timer(2000).pipe(
      map(() => count),
      takeUntil(click4$),  // ← 새 클릭 오면 강제 완료!
      tap({
        next: () => console.log(`[카운트 ${count}] timer 값 방출`),
        complete: () => console.log(`[카운트 ${count}] timer 완료 (takeUntil 또는 자연 완료)`)
      })
    );
  })
);

counter4$.subscribe({
  next: (count) => console.log(`✨ 최종: ${count}`),
  complete: () => console.log('🔥 전체 완료')
});

// 시뮬레이션
setTimeout(() => {
  console.log('👆 클릭 1');
  click4$.next();
}, 100);

setTimeout(() => {
  console.log('\n👆 클릭 2 (1초 후) - 이전 timer 취소!');
  click4$.next();
}, 1100);

setTimeout(() => {
  console.log('\n⏰ 3.1초 경과 - timer 자연 완료');
}, 3100);

// 출력:
// 👆 클릭 1
// [카운트 1] timer 시작
//
// 👆 클릭 2 (1초 후) - 이전 timer 취소!
// [카운트 1] timer 완료 (takeUntil 또는 자연 완료) ← takeUntil로 강제 완료!
// [카운트 2] timer 시작
//
// ⏰ 3.1초 경과 - timer 자연 완료
// [카운트 2] timer 값 방출
// ✨ 최종: 2
// [카운트 2] timer 완료 (takeUntil 또는 자연 완료) ← 자연 완료!


console.log('\n\n===== 4. 원본 코드 분석 =====\n');

console.log(`
원본 코드:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const click$ = new Subject<void>();

const counter$ = click$.pipe(
  scan((count) => count + 1, 0),
  switchMap((count) => {
    return timer(3000).pipe(
      map(() => 0),
      takeUntil(click$),
      tap({
        complete: () => console.log('❌ 타이머 취소됨')  // ← 34번 줄
      }),
    );
  })
);

counter$.subscribe({
  next: (count) => { ... },
  complete: () => console.log('🔥 complete')  // ← 54번 줄
});


각 complete의 역할:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 34번 줄: tap({ complete: () => ... })
  → timer(3000).pipe(...)의 완료를 감지
  → 호출되는 경우:
    1. timer가 3초 후 자동 완료 ✅
    2. takeUntil(click$)이 강제 완료 ✅
  → 매 클릭마다 호출됨!

📍 54번 줄: subscribe({ complete: () => ... })
  → counter$ 전체 스트림의 완료를 기다림
  → 호출되는 경우:
    1. click$가 complete() 호출될 때만! ❌
  → 현재 코드에서는 절대 호출 안 됨!


타임라인:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

0ms:    시작
500ms:  클릭 1 → timer(3000) 시작
1000ms: 클릭 2 → takeUntil이 이전 timer 완료 → 34번 줄 호출 ✅
                → 새 timer(3000) 시작
1500ms: 클릭 3 → takeUntil이 이전 timer 완료 → 34번 줄 호출 ✅
                → 새 timer(3000) 시작
2000ms: 클릭 4 → takeUntil이 이전 timer 완료 → 34번 줄 호출 ✅
                → 새 timer(3000) 시작
5000ms: timer 자연 완료 (3초 경과) → 34번 줄 호출 ✅
        → 카운트 리셋

... 프로그램 계속 실행 중 ...
click$는 여전히 살아있음!
counter$도 여전히 살아있음!
54번 줄은 절대 호출 안 됨! ❌


54번 줄을 호출하려면:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

setTimeout(() => {
  console.log('🛑 스트림 종료!');
  click$.complete();  // ← 명시적으로 완료!
}, 10000);

→ 이제 54번 줄이 호출됨! ✅
`);


console.log('\n\n===== 5. 핵심: unsubscribe vs complete =====\n');

console.log(`
⚠️  중요한 차이점!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. switchMap의 동작:
   - 새 값이 오면 이전 Observable을 unsubscribe
   - unsubscribe는 complete 콜백을 호출하지 않음! ❌
   - 그냥 구독을 끊을 뿐

2. takeUntil의 동작:
   - notifier$가 값을 방출하면 Observable을 complete
   - complete는 complete 콜백을 호출함! ✅
   - 정상 종료 처리


시각적 비교:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

switchMap 사용:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
click$.pipe(
  switchMap(() =>
    timer(1000).pipe(
      tap({
        complete: () => console.log('완료') // ← 이전 timer는 호출 안 됨!
      })
    )
  )
)

타임라인:
0ms:   클릭 1 → timer 1 시작
500ms: 클릭 2 → timer 1 unsubscribe (complete 콜백 ❌)
              → timer 2 시작
1500ms: timer 2 자연 완료 (complete 콜백 ✅)


takeUntil 사용:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
click$.pipe(
  switchMap(() =>
    timer(3000).pipe(
      takeUntil(click$), // ← 새 클릭 오면 complete 호출!
      tap({
        complete: () => console.log('완료') // ← 항상 호출됨!
      })
    )
  )
)

타임라인:
0ms:   클릭 1 → timer 1 시작
2000ms: 클릭 2 → timer 1 complete (complete 콜백 ✅)
              → timer 2 시작
5000ms: timer 2 자연 완료 (complete 콜백 ✅)


핵심 정리:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

unsubscribe (switchMap이 이전 Observable 처리):
  - 구독 즉시 종료
  - complete 콜백 호출 안 됨 ❌
  - 리소스 정리만 수행
  - finalize()는 호출됨 (cleanup)

complete (takeUntil, 자연 완료):
  - 정상 종료 신호
  - complete 콜백 호출됨 ✅
  - finalize()도 호출됨 (cleanup)


실전 패턴:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 리소스 정리가 필요하면 finalize() 사용
click$.pipe(
  switchMap(() =>
    timer(3000).pipe(
      tap({
        complete: () => console.log('완료')  // unsubscribe 시 호출 안 됨
      }),
      finalize(() => console.log('정리'))    // 항상 호출됨! ✅
    )
  )
)

// complete 콜백이 필요하면 takeUntil 사용
click$.pipe(
  switchMap(() =>
    timer(3000).pipe(
      takeUntil(click$),  // complete를 호출함!
      tap({
        complete: () => console.log('완료')  // 항상 호출됨! ✅
      })
    )
  )
)
`);


console.log('\n\n===== 6. Subject 생명주기 정리 =====\n');

console.log(`
Subject의 특징:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Subject는 Hot Observable
   → 구독자가 없어도 살아있음
   → 명시적으로 complete()를 호출해야 종료

2. Subject를 완료하지 않으면:
   → 메모리 누수 발생 가능
   → complete 콜백 절대 호출 안 됨
   → 구독이 계속 살아있음

3. 컴포넌트에서 사용 시:
   ✅ ngOnDestroy() { this.destroy$.complete(); }
   ✅ useEffect(() => { return () => subject$.complete(); })


Observable 종류별 완료:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

timer(3000)          → 자동 완료 ✅
of(1, 2, 3)          → 자동 완료 ✅
from([1, 2, 3])      → 자동 완료 ✅
interval(1000)       → 수동 완료 필요 ❌
fromEvent(el, 'click') → 수동 완료 필요 ❌
Subject              → 수동 완료 필요 ❌


권장 패턴:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class Component {
  private destroy$ = new Subject<void>();
  private click$ = new Subject<void>();

  ngOnInit() {
    this.click$.pipe(
      takeUntil(this.destroy$)  // 컴포넌트 파괴 시 자동 정리
    ).subscribe(...);
  }

  ngOnDestroy() {
    this.destroy$.next();     // 종료 신호
    this.destroy$.complete();  // Subject 완료
    this.click$.complete();    // 다른 Subject도 완료
  }
}
`);

export {};
