import { timer, tap, map } from 'rxjs';

/**
 * RxJS 파이프라인의 실행 순서 상세 분석
 * next vs complete 이벤트 전파 순서
 */

console.log('===== RxJS 파이프라인 실행 순서 =====\n');

// ===== 예제 1: 기본 실행 순서 =====
console.log('--- 예제 1: next와 complete의 순서 ---\n');

timer(1000).pipe(
  tap({
    next: (value) => console.log(`1️⃣ tap next: ${value}`),
    complete: () => console.log('1️⃣ tap complete')
  }),
  map((value) => {
    console.log(`2️⃣ map 실행: ${value}`);
    return value * 10;
  }),
  tap({
    next: (value) => console.log(`3️⃣ tap next: ${value}`),
    complete: () => console.log('3️⃣ tap complete')
  })
).subscribe({
  next: (value) => console.log(`4️⃣ subscribe next: ${value}`),
  complete: () => console.log('4️⃣ subscribe complete')
});

// 출력 순서:
// (1초 후)
// 1️⃣ tap next: 0           ← 값이 파이프라인을 통과 시작
// 2️⃣ map 실행: 0
// 3️⃣ tap next: 0
// 4️⃣ subscribe next: 0    ← 값이 최종 구독자 도착
// 1️⃣ tap complete         ← 이제 complete 이벤트 전파 시작
// 3️⃣ tap complete
// 4️⃣ subscribe complete


console.log('\n\n===== 값 방출과 완료의 관계 =====\n');

console.log(`
Observable의 생명주기:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1단계: 값 방출 (next 이벤트)
  timer(1000)
    → tap({ next })        // 값 통과
    → map()                // 값 변환
    → tap({ next })        // 값 통과
    → subscribe({ next })  // 값 출력 ✨

2단계: 값 처리 완료
  (모든 next 핸들러 실행 완료)

3단계: 완료 신호 (complete 이벤트)
  timer(1000).complete()
    → tap({ complete })    // 완료 처리
    → map (완료 전파)
    → tap({ complete })    // 완료 처리
    → subscribe({ complete }) // 완료 출력


왜 이런 순서인가?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

next와 complete는 별개의 이벤트!

next:
  - 값을 전달하는 이벤트
  - 파이프라인을 따라 순차적으로 전달
  - 모든 연산자와 구독자를 거침

complete:
  - 스트림 종료를 알리는 이벤트
  - next 이벤트가 모두 처리된 후에 전파
  - 값은 포함하지 않음


예시:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

timer(1000)이 완료될 때:

1. timer가 값 0 방출 (next 이벤트)
   → 값이 파이프라인 통과
   → subscribe의 next() 실행
   → "✨ 최종 카운트: 0" 출력

2. timer가 완료 신호 (complete 이벤트)
   → tap의 complete() 실행
   → "[내부] timer 완료" 출력
   → subscribe의 complete() 실행
`);


// ===== 예제 2: 더 명확한 시연 =====
console.log('\n\n--- 예제 2: 시간차를 두고 확인 ---\n');

timer(1000).pipe(
  tap({
    next: (value) => {
      console.log(`[tap next] 값 받음: ${value}`);
      console.log('[tap next] 값 처리 중...');
    },
    complete: () => {
      console.log('[tap complete] 완료 신호 받음');
    }
  }),
  map((value) => {
    console.log(`[map] 값 변환 중: ${value} → ${value * 10}`);
    return value * 10;
  })
).subscribe({
  next: (value) => {
    console.log(`[subscribe next] 최종 값: ${value}`);
    console.log('[subscribe next] 값 처리 완료!\n');
  },
  complete: () => {
    console.log('[subscribe complete] 스트림 완료!');
  }
});


// ===== 예제 3: switchMap에서의 실행 순서 =====
console.log('\n\n--- 예제 3: switchMap 내부 Observable ---\n');

import { Subject, switchMap, scan } from 'rxjs';

const click$ = new Subject<void>();

const counter$ = click$.pipe(
  scan(count => count + 1, 0),
  tap(count => console.log(`\n[외부] scan 결과: ${count}`)),
  switchMap((count) => {
    console.log(`[외부] switchMap 시작`);

    return timer(1000).pipe(
      tap({
        next: (timerValue) => console.log(`[내부] timer next: ${timerValue}`),
        complete: () => console.log('[내부] timer complete')
      }),
      map(() => {
        console.log(`[내부] map: timer값을 ${count}로 변환`);
        return count;
      })
    );
  })
);

counter$.subscribe({
  next: (count) => console.log(`[구독] ✨ 최종 카운트: ${count}`),
  complete: () => console.log('[구독] 완료')
});

// 시뮬레이션
setTimeout(() => {
  console.log('\n========== 클릭! ==========');
  click$.next();
}, 100);

setTimeout(() => {
  click$.complete();
}, 3000);

// 출력:
// ========== 클릭! ==========
// [외부] scan 결과: 1
// [외부] switchMap 시작
// (1초 후)
// [내부] timer next: 0           ← timer가 값 방출
// [내부] map: timer값을 1로 변환
// [구독] ✨ 최종 카운트: 1       ← next 이벤트 끝
// [내부] timer complete          ← complete 이벤트 시작


console.log('\n\n===== 핵심 정리 =====\n');

console.log(`
실행 순서 규칙:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. next 이벤트가 먼저 파이프라인을 통과
   source
     → operator1 (next)
     → operator2 (next)
     → subscribe (next)  ← "✨ 최종 값" 출력

2. next 처리가 완전히 끝난 후 complete 이벤트 전파
   source (complete)
     → operator1 (complete)
     → operator2 (complete)
     → subscribe (complete)  ← "완료" 출력


왜 이렇게 설계되었나?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 값 처리가 우선
   → 값이 완전히 처리되어야 다음 단계 진행

2. 완료는 정리 작업
   → 모든 값 처리가 끝난 후 리소스 정리

3. 명확한 구분
   → next: 데이터 처리
   → complete: 종료 신호


실제 코드에서:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

timer(1000).pipe(
  tap({ complete: () => console.log('A') }),
  map(x => x * 10),
  tap({ complete: () => console.log('B') })
).subscribe({
  next: (x) => console.log('값:', x),      // ← 먼저!
  complete: () => console.log('C')         // ← 나중!
});

// 출력 순서:
// 값: 0   ← next 이벤트 완료
// A       ← complete 이벤트 시작
// B
// C


비유:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

택배 배송과 비슷합니다:

1. 택배 전달 (next)
   물류센터 → 트럭 → 집배원 → 고객
   "택배 받았어요!" ← 고객이 먼저 확인

2. 배송 완료 처리 (complete)
   고객 확인 → 시스템 업데이트
   "배송 완료!" ← 시스템 처리는 나중

값이 먼저 도착하고, 완료 처리는 그 다음!
`);

export {};
