import { switchMap, fromEvent, debounceTime } from 'rxjs';
import { Observable } from 'rxjs';

/**
 * switchMap + AbortController를 사용한 진짜 HTTP 요청 취소
 */

// ===== 1. 기본 switchMap (응답만 무시) =====
console.log('===== 기본 switchMap: 응답만 무시 =====\n');

const searchAPIBasic = (query: string) => {
  return new Observable(subscriber => {
    console.log(`🌐 HTTP 요청 시작: "${query}"`);

    fetch(`https://jsonplaceholder.typicode.com/posts?q=${query}`)
      .then(res => res.json())
      .then(data => {
        console.log(`📦 HTTP 응답 도착: "${query}"`);
        subscriber.next(data);
        subscriber.complete();
      })
      .catch(err => subscriber.error(err));
  });
};

// 문제점: 모든 HTTP 요청이 서버까지 도달하고 응답도 받음
// 단지 switchMap이 응답을 무시할 뿐


// ===== 2. AbortController를 사용한 진짜 취소 =====
console.log('\n===== AbortController: 진짜 HTTP 요청 취소 =====\n');

const searchAPIWithAbort = (query: string, signal: AbortSignal) => {
  return new Observable(subscriber => {
    console.log(`🌐 HTTP 요청 시작: "${query}"`);

    fetch(`https://jsonplaceholder.typicode.com/posts?q=${query}`, {
      signal // AbortSignal 전달
    })
      .then(res => res.json())
      .then(data => {
        console.log(`📦 HTTP 응답 도착: "${query}"`);
        subscriber.next(data);
        subscriber.complete();
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          console.log(`🚫 HTTP 요청 취소됨: "${query}"`);
          subscriber.complete(); // 에러가 아닌 정상 완료로 처리
        } else {
          subscriber.error(err);
        }
      });

    // 구독 취소 시 실행될 teardown 로직
    return () => {
      console.log(`🗑️  구독 취소: "${query}"`);
      // 여기서 AbortController.abort() 호출하면 됨
    };
  });
};

// switchMap과 함께 사용
const searchWithAbort$ = new Observable<string>(subscriber => {
  // 검색어 시뮬레이션
  const queries = ['r', 're', 'rea', 'react'];

  queries.forEach((query, index) => {
    setTimeout(() => {
      subscriber.next(query);
      if (index === queries.length - 1) {
        setTimeout(() => subscriber.complete(), 100);
      }
    }, index * 100);
  });
});


// ===== 3. 완전한 구현: switchMap + AbortController =====
console.log('\n===== 완전한 구현 =====\n');

interface SearchAPIOptions {
  query: string;
  signal?: AbortSignal;
}

class SearchService {
  // AbortController를 관리하는 검색 함수
  searchWithCancellation(query: string): Observable<any> {
    return new Observable(subscriber => {
      const controller = new AbortController();

      console.log(`🚀 검색 시작: "${query}"`);

      fetch(`https://jsonplaceholder.typicode.com/posts?q=${query}`, {
        signal: controller.signal
      })
        .then(res => res.json())
        .then(data => {
          console.log(`✅ 검색 완료: "${query}" (${data.length}개 결과)`);
          subscriber.next(data);
          subscriber.complete();
        })
        .catch(err => {
          if (err.name === 'AbortError') {
            console.log(`❌ 검색 취소: "${query}"`);
            subscriber.complete();
          } else {
            console.error(`🔥 검색 에러: "${query}"`, err);
            subscriber.error(err);
          }
        });

      // Observable이 unsubscribe 될 때 실행
      return () => {
        console.log(`🛑 취소 신호 전송: "${query}"`);
        controller.abort(); // 실제 HTTP 요청 취소!
      };
    });
  }
}

const searchService = new SearchService();

// 사용 예제
const setupRealCancellation = () => {
  const userInput$ = new Observable<string>(subscriber => {
    // 사용자 타이핑 시뮬레이션
    const inputs = [
      { query: 'r', delay: 0 },
      { query: 're', delay: 100 },
      { query: 'rea', delay: 200 },
      { query: 'reac', delay: 300 },
      { query: 'react', delay: 400 },
    ];

    inputs.forEach(({ query, delay }) => {
      setTimeout(() => {
        console.log(`⌨️  사용자 입력: "${query}"`);
        subscriber.next(query);
      }, delay);
    });

    setTimeout(() => subscriber.complete(), 500);
  });

  return userInput$.pipe(
    debounceTime(50), // 짧은 디바운스 (테스트용)
    switchMap(query => searchService.searchWithCancellation(query))
  );
};

// 실행 (주석 해제하여 테스트)
// setupRealCancellation().subscribe({
//   next: results => console.log(`\n📋 최종 결과: ${results.length}개\n`),
//   complete: () => console.log('✨ 완료')
// });


// ===== 4. 비교 정리 =====
console.log('\n===== 비교 정리 =====\n');

console.log(`
🔍 switchMap만 사용한 경우:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
클라이언트:
  - Observable 구독 취소 ✅
  - 응답 무시 ✅
  - 메모리 정리 ✅

네트워크:
  - HTTP 요청은 계속 진행 ❌
  - 서버는 처리 계속 ❌
  - 응답 데이터 전송 ❌
  - 대역폭 낭비 ❌

결과:
  → 사용자는 최신 결과만 보지만
  → 서버/네트워크 리소스는 낭비됨


🛑 switchMap + AbortController 사용:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
클라이언트:
  - Observable 구독 취소 ✅
  - 응답 무시 ✅
  - 메모리 정리 ✅

네트워크:
  - HTTP 요청 취소 ✅
  - 서버 처리 중단 (가능하면) ✅
  - 응답 데이터 전송 중단 ✅
  - 대역폭 절약 ✅

결과:
  → 완전한 리소스 절약
  → 서버 부하 감소


📊 실제 영향:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
검색어 "react" 입력 시 (6번 타이핑):

switchMap만:
  - 6개 HTTP 요청 전송
  - 6개 응답 수신
  - 5개 응답 무시
  - 1개 응답 사용
  → 83% 리소스 낭비

switchMap + AbortController:
  - 6개 HTTP 요청 시작
  - 5개 요청 취소
  - 1개 응답만 수신
  - 1개 응답 사용
  → 최소 리소스 사용


⚠️  주의사항:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. AbortController는 fetch API에서만 작동
2. axios 등은 자체 취소 토큰 사용
3. 서버가 중단을 지원해야 완전한 취소 가능
4. 네트워크 상황에 따라 이미 전송된 데이터는 도착할 수 있음


🎯 언제 사용해야 하나?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
switchMap만으로 충분한 경우:
  - 가벼운 요청
  - 빠른 응답
  - 개발 편의성 우선

AbortController 추가해야 하는 경우:
  - 무거운 데이터 전송 (이미지, 비디오)
  - 느린 API 응답 (>1초)
  - 서버 부하 최소화 필요
  - 네트워크 대역폭 절약 필요
`);

export { SearchService, searchAPIWithAbort };
