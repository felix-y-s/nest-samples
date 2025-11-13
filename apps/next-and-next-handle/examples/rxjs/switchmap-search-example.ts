import {
  fromEvent,
  switchMap,
  map,
  debounceTime,
  distinctUntilChanged,
  tap,
  of,
  delay,
  catchError
} from 'rxjs';

/**
 * switchMap을 사용한 검색 기능 구현
 *
 * 핵심 기능:
 * 1. 이전 검색 요청 자동 취소 (switchMap)
 * 2. 입력 지연 처리 (debounceTime)
 * 3. 중복 검색어 방지 (distinctUntilChanged)
 */

// ===== 1. 기본 switchMap 예제 =====
console.log('===== 기본 switchMap 동작 =====\n');

// 가짜 API 호출 함수
const searchAPI = (query: string) => {
  console.log(`🔍 API 호출 시작: "${query}"`);
  return of(`"${query}"에 대한 검색 결과`).pipe(
    delay(2000), // 2초 지연 (API 응답 시뮬레이션)
    tap(() => console.log(`✅ API 호출 완료: "${query}"`))
  );
};

// switchMap 없이 (문제 있는 코드)
console.log('--- switchMap 없이 (모든 요청 처리) ---');
const withoutSwitchMap$ = of('react', 'reactjs', 'react native').pipe(
  tap(query => console.log(`입력: ${query}`)),
  // concatMap을 사용하면 모든 요청이 순차적으로 처리됨
  // map(() => searchAPI(query)) // 이렇게 하면 모든 API 호출이 실행됨
);

// switchMap 사용 (올바른 코드)
console.log('\n--- switchMap 사용 (최신 요청만 처리) ---');
const withSwitchMap$ = of('react', 'reactjs', 'react native').pipe(
  tap(query => console.log(`입력: ${query}`)),
  switchMap(query => searchAPI(query)) // 새 요청이 오면 이전 요청 취소
);

// withSwitchMap$.subscribe({
//   next: result => console.log(`📦 결과: ${result}`),
//   complete: () => console.log('✨ 완료\n')
// });


// ===== 2. 실전 검색창 구현 예제 =====
console.log('\n===== 실전 검색창 구현 =====\n');

// HTML의 input 요소가 있다고 가정
// <input id="search-input" type="text" placeholder="검색어 입력...">

interface SearchResult {
  id: number;
  title: string;
  description: string;
}

// 가짜 검색 API
const mockSearchAPI = (query: string): Promise<SearchResult[]> => {
  console.log(`🌐 API 요청: "${query}"`);

  return new Promise((resolve) => {
    setTimeout(() => {
      const results: SearchResult[] = [
        { id: 1, title: `${query} 결과 1`, description: '설명 1' },
        { id: 2, title: `${query} 결과 2`, description: '설명 2' },
        { id: 3, title: `${query} 결과 3`, description: '설명 3' },
      ];
      console.log(`✅ API 응답: "${query}" (${results.length}개 결과)`);
      resolve(results);
    }, 1500);
  });
};

// 검색 스트림 구현
const setupSearchStream = () => {
  // 실제 브라우저 환경이라면 이렇게 사용:
  // const searchInput = document.getElementById('search-input') as HTMLInputElement;
  // const search$ = fromEvent(searchInput, 'input');

  // 여기서는 시뮬레이션을 위해 수동으로 검색어 스트림 생성
  const simulateUserTyping = () => {
    const searchQueries = [
      'r',           // 0ms
      're',          // 100ms
      'rea',         // 200ms
      'reac',        // 300ms
      'react',       // 400ms (마지막 입력)
      'n',           // 1000ms (새로운 검색)
      'ne',          // 1100ms
      'nex',         // 1200ms
      'next',        // 1300ms
    ];

    return of(...searchQueries).pipe(
      // 각 검색어를 순차적으로 방출 (사용자 타이핑 시뮬레이션)
      map((query, index) => ({
        query,
        timestamp: Date.now() + (index * 100)
      })),
      tap(({ query }) => console.log(`⌨️  사용자 입력: "${query}"`))
    );
  };

  const userInput$ = simulateUserTyping();

  const searchResults$ = userInput$.pipe(
    map(({ query }) => query), // query만 추출

    // 1. 300ms 동안 추가 입력이 없으면 검색 실행 (디바운스)
    debounceTime(300),
    tap(query => console.log(`⏱️  디바운스 통과: "${query}"`)),

    // 2. 이전과 같은 검색어면 스킵 (중복 방지)
    distinctUntilChanged(),
    tap(query => console.log(`🔄 중복 체크 통과: "${query}"`)),

    // 3. 검색어가 2글자 이상일 때만 검색
    map(query => query.trim()),
    tap(query => {
      if (query.length < 2) {
        console.log(`❌ 검색어 너무 짧음: "${query}"`);
      }
    }),

    // 4. switchMap으로 이전 검색 취소하고 새 검색 실행
    switchMap(query => {
      if (query.length < 2) {
        return of([]); // 빈 결과 반환
      }

      console.log(`🚀 검색 시작: "${query}"`);

      // Promise를 Observable로 변환
      return from(mockSearchAPI(query)).pipe(
        // 에러 처리
        catchError(error => {
          console.error(`🔥 검색 실패: ${error.message}`);
          return of([]); // 에러 시 빈 배열 반환
        })
      );
    })
  );

  return searchResults$;
};

// 실행 예제 (주석 해제하여 테스트)
// console.log('검색 스트림 시작...\n');
// setupSearchStream().subscribe({
//   next: results => {
//     console.log(`\n📋 화면에 표시할 검색 결과 (${results.length}개):`);
//     results.forEach(r => console.log(`  - ${r.title}`));
//     console.log('');
//   },
//   error: err => console.error('에러 발생:', err),
//   complete: () => console.log('검색 완료')
// });


// ===== 3. switchMap vs concatMap vs mergeMap 비교 =====
console.log('\n===== switchMap vs 다른 연산자 비교 =====\n');

const compareOperators = () => {
  const queries = ['react', 'vue', 'angular'];

  console.log('--- concatMap (모든 요청 순차 처리) ---');
  // from(queries).pipe(
  //   concatMap(q => searchAPI(q))
  // ).subscribe({
  //   next: r => console.log(`결과: ${r}`),
  //   complete: () => console.log('완료\n')
  // });

  console.log('--- mergeMap (모든 요청 병렬 처리) ---');
  // from(queries).pipe(
  //   mergeMap(q => searchAPI(q))
  // ).subscribe({
  //   next: r => console.log(`결과: ${r}`),
  //   complete: () => console.log('완료\n')
  // });

  console.log('--- switchMap (최신 요청만 처리) ---');
  // from(queries).pipe(
  //   switchMap(q => searchAPI(q))
  // ).subscribe({
  //   next: r => console.log(`결과: ${r}`),
  //   complete: () => console.log('완료\n')
  // });
};

// ===== 4. 실전 사용 패턴 =====

/**
 * 검색창 컴포넌트에서 사용하는 완전한 예제
 */
class SearchComponent {
  private searchQuery$ = new Subject<string>();
  private searchResults$ = this.searchQuery$.pipe(
    debounceTime(300),           // 300ms 디바운스
    distinctUntilChanged(),      // 중복 검색어 방지
    tap(query => console.log(`검색 쿼리: ${query}`)),
    switchMap(query => {
      if (!query || query.length < 2) {
        return of([]); // 빈 결과
      }

      return this.performSearch(query).pipe(
        catchError(err => {
          console.error('검색 에러:', err);
          return of([]); // 에러 시 빈 결과
        })
      );
    }),
    shareReplay(1) // 결과 캐싱
  );

  constructor() {
    // 검색 결과 구독
    this.searchResults$.subscribe(results => {
      this.updateUI(results);
    });
  }

  // 사용자 입력 처리
  onSearchInput(query: string) {
    this.searchQuery$.next(query);
  }

  private performSearch(query: string) {
    return from(mockSearchAPI(query));
  }

  private updateUI(results: SearchResult[]) {
    console.log(`UI 업데이트: ${results.length}개 결과`);
    // 실제로는 DOM 업데이트
  }
}

// ===== 5. 핵심 포인트 정리 =====
console.log('\n===== switchMap 핵심 정리 =====\n');
console.log(`
🎯 switchMap의 핵심 특징:
1. 새로운 값이 들어오면 이전 내부 Observable을 즉시 취소
2. 항상 최신 값만 처리 (검색창에 최적)
3. 불필요한 API 호출 방지 → 성능 향상

📝 검색 기능 최적화 패턴:
input$.pipe(
  debounceTime(300),        // 입력 완료 대기
  distinctUntilChanged(),   // 중복 방지
  switchMap(api.search)     // 이전 검색 취소
)

✅ 사용하면 좋은 경우:
- 검색 기능 (자동완성, 검색창)
- 실시간 필터링
- 타이핑에 따른 미리보기
- 최신 데이터만 필요한 경우

❌ 사용하면 안 되는 경우:
- 모든 요청을 처리해야 하는 경우 (예: 결제)
- 순서가 중요한 경우 → concatMap 사용
- 병렬 처리가 필요한 경우 → mergeMap 사용
`);

// Subject 추가 import
import { Subject, from, shareReplay } from 'rxjs';

export { setupSearchStream, SearchComponent };
