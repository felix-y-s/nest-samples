# NestJS RxJS 학습 가이드 📚

> NestJS에서 RxJS를 활용하는 실전 패턴을 단계별로 학습하는 종합 가이드입니다.

## 📋 목차

1. [학습 목표](#학습-목표)
2. [학습 로드맵](#학습-로드맵)
3. [사전 준비](#사전-준비)
4. [학습 계획](#학습-계획)
5. [실습 체크리스트](#실습-체크리스트)

---

## 🎯 학습 목표

이 학습 과정을 통해 다음을 달성합니다:

- ✅ NestJS에서 RxJS가 사용되는 8가지 핵심 시나리오 이해
- ✅ 각 시나리오별 실전 구현 능력 습득
- ✅ Observable, Subject, Operator의 실무 활용법 마스터
- ✅ 에러 처리, 재시도, 타임아웃 등 고급 패턴 구현
- ✅ 성능 최적화와 메모리 관리 Best Practices 학습

---

## 🗺️ 학습 로드맵

```
Level 1: 기초 (1-2주)
├── 1. HTTP Interceptors
│   └── 요청/응답 로깅, 에러 처리, 타임아웃
└── 2. WebSocket Gateway
    └── 실시간 채팅, 이벤트 브로드캐스팅

Level 2: 중급 (2-3주)
├── 3. Guards & Authentication
│   └── 비동기 인증, 캐싱 전략
├── 4. Event-Driven Architecture
│   └── 도메인 이벤트, EventEmitter2 통합
└── 5. Data Pipeline
    └── 병렬 API 호출, 데이터 조합 및 가공

Level 3: 고급 (2-3주)
├── 6. Microservices Communication
│   └── 메시지 큐, 재시도 로직, 서비스 간 통신
├── 7. Server-Sent Events (SSE)
│   └── 실시간 스트리밍, 진행 상황 업데이트
└── 8. Advanced Caching
    └── ReplaySubject, shareReplay, TTL 캐싱
```

**총 학습 기간:** 5-8주 (주 10-15시간 투자 기준)

---

## 📚 사전 준비

### 필수 지식
- ✅ TypeScript 기본 문법
- ✅ NestJS 기초 (Module, Controller, Service, Decorator)
- ✅ RxJS 기본 개념 (Observable, Observer, Subscription)
- ✅ Promise와 async/await 이해

### 선택 지식 (도움이 됨)
- 🔹 REST API 설계
- 🔹 WebSocket 기본 개념
- 🔹 이벤트 기반 아키텍처
- 🔹 마이크로서비스 아키텍처

### 개발 환경
```bash
Node.js: v18 이상
NestJS: v10 이상
TypeScript: v5 이상
```

### 설치된 패키지
```bash
npm install @nestjs/websockets @nestjs/platform-socket.io
npm install @nestjs/microservices
npm install @nestjs/event-emitter
npm install rxjs
```

---

## 📅 학습 계획

### Week 1-2: HTTP Interceptors & WebSocket 🟢

**목표:** 가장 자주 사용되는 RxJS 패턴 2가지 마스터

#### 1. HTTP Interceptors (3-4일)
- 📖 이론: [01-interceptors.md](./01-interceptors.md)
- 💻 실습:
  - [ ] 기본 로깅 인터셉터 구현
  - [ ] 타임아웃 처리 추가
  - [ ] 에러 변환 및 재시도 로직
  - [ ] 응답 데이터 가공 (transform)
  - [ ] 여러 인터셉터 조합하기

#### 2. WebSocket Gateway (3-4일)
- 📖 이론: [02-websocket.md](./02-websocket.md)
- 💻 실습:
  - [ ] 기본 WebSocket 서버 구축
  - [ ] Subject를 활용한 채팅방 구현
  - [ ] 실시간 알림 시스템
  - [ ] 연결 상태 관리
  - [ ] 에러 처리 및 재연결 로직

---

### Week 3-4: Guards & Events & Data Pipeline 🟡

**목표:** 비즈니스 로직에 RxJS 통합하기

#### 3. Guards & Authentication (2-3일)
- 📖 이론: [03-guards.md](./03-guards.md)
- 💻 실습:
  - [ ] 비동기 인증 Guard 구현
  - [ ] JWT 토큰 검증 with Observable
  - [ ] Role 기반 인가 처리
  - [ ] 인증 결과 캐싱 전략

#### 4. Event-Driven Architecture (2-3일)
- 📖 이론: [04-events.md](./04-events.md)
- 💻 실습:
  - [ ] EventEmitter2 통합
  - [ ] 도메인 이벤트 설계 및 발행
  - [ ] Subject를 활용한 이벤트 스트림
  - [ ] 여러 이벤트 구독 및 조합
  - [ ] 이벤트 기반 워크플로우 구현

#### 5. Data Pipeline Processing (2-3일)
- 📖 이론: [05-data-pipeline.md](./05-data-pipeline.md)
- 💻 실습:
  - [ ] forkJoin으로 병렬 API 호출
  - [ ] combineLatest로 실시간 데이터 조합
  - [ ] switchMap으로 의존적 API 호출
  - [ ] mergeMap으로 순차 처리
  - [ ] 복잡한 데이터 변환 파이프라인

---

### Week 5-6: Microservices & SSE 🟠

**목표:** 분산 시스템과 실시간 통신 패턴

#### 6. Microservices Communication (3-4일)
- 📖 이론: [06-microservices.md](./06-microservices.md)
- 💻 실습:
  - [ ] TCP 마이크로서비스 구현
  - [ ] RabbitMQ 메시지 큐 연동
  - [ ] 재시도 및 타임아웃 전략
  - [ ] 서비스 간 이벤트 전파
  - [ ] 분산 트랜잭션 패턴

#### 7. Server-Sent Events (2-3일)
- 📖 이론: [07-sse.md](./07-sse.md)
- 💻 실습:
  - [ ] 기본 SSE 엔드포인트 구현
  - [ ] interval을 활용한 주기적 업데이트
  - [ ] 실시간 진행 상황 스트리밍
  - [ ] 여러 클라이언트 관리
  - [ ] 에러 처리 및 재연결

---

### Week 7-8: Advanced Patterns 🔴

**목표:** 성능 최적화와 고급 패턴

#### 8. Advanced Caching Strategies (3-4일)
- 📖 이론: [08-caching.md](./08-caching.md)
- 💻 실습:
  - [ ] ReplaySubject 캐싱 구현
  - [ ] shareReplay로 HTTP 요청 최적화
  - [ ] TTL 기반 캐시 무효화
  - [ ] 멀티 레벨 캐싱 전략
  - [ ] 메모리 누수 방지 패턴

#### 종합 프로젝트 (3-4일)
- 📖 가이드: [09-final-project.md](./09-final-project.md)
- 💻 실습:
  - [ ] 실시간 주문 처리 시스템
  - [ ] 8가지 패턴 모두 활용
  - [ ] 성능 모니터링 및 최적화
  - [ ] 에러 처리 및 복구 전략
  - [ ] 테스트 코드 작성

---

## ✅ 실습 체크리스트

### 학습 진행 상황

#### Level 1: 기초
- [ ] **Week 1-2 완료**
  - [ ] HTTP Interceptors 모든 실습 완료
  - [ ] WebSocket Gateway 모든 실습 완료
  - [ ] 코드 리뷰 및 리팩토링
  - [ ] 학습 노트 정리

#### Level 2: 중급
- [ ] **Week 3-4 완료**
  - [ ] Guards & Authentication 실습 완료
  - [ ] Event-Driven Architecture 실습 완료
  - [ ] Data Pipeline Processing 실습 완료
  - [ ] 통합 테스트 작성
  - [ ] 학습 노트 정리

#### Level 3: 고급
- [ ] **Week 5-6 완료**
  - [ ] Microservices Communication 실습 완료
  - [ ] Server-Sent Events 실습 완료
  - [ ] 성능 테스트 및 최적화
  - [ ] 학습 노트 정리

- [ ] **Week 7-8 완료**
  - [ ] Advanced Caching 실습 완료
  - [ ] 종합 프로젝트 완료
  - [ ] 최종 리뷰 및 문서화
  - [ ] 포트폴리오 정리

---

## 📊 학습 평가 기준

각 시나리오별로 다음을 확인하세요:

### 이론 이해도
- ✅ RxJS Operator의 동작 원리 설명 가능
- ✅ 각 패턴의 장단점 이해
- ✅ 언제 사용해야 하는지 판단 가능

### 구현 능력
- ✅ 스스로 코드 작성 가능
- ✅ 에러 처리 및 엣지 케이스 고려
- ✅ 테스트 코드 작성 가능

### 최적화
- ✅ 메모리 누수 방지
- ✅ 성능 병목 지점 파악 및 개선
- ✅ Best Practices 적용

---

## 🔗 참고 자료

### 공식 문서
- [NestJS Official Docs](https://docs.nestjs.com/)
- [RxJS Official Docs](https://rxjs.dev/)
- [RxJS Marbles](https://rxmarbles.com/) - Visual Interactive Diagrams

### 추천 학습 자료
- [Learn RxJS](https://www.learnrxjs.io/)
- [RxJS Operators Decision Tree](https://rxjs.dev/operator-decision-tree)
- [NestJS Advanced Concepts](https://docs.nestjs.com/fundamentals/async-providers)

### 유용한 도구
- [RxJS Visualizer](https://rxviz.com/) - Observable 흐름 시각화
- [Postman](https://www.postman.com/) - API 테스트
- [Socket.io Client](https://socket.io/docs/v4/client-api/) - WebSocket 테스트

---

## 💡 학습 팁

### DO ✅
- 매일 조금씩이라도 꾸준히 학습하기
- 코드를 직접 타이핑하며 실습하기
- 에러가 발생하면 해결 과정을 기록하기
- 학습한 내용을 자신만의 언어로 정리하기
- 이해가 안 되면 RxJS Marbles로 시각화하기

### DON'T ❌
- 복사/붙여넣기로만 학습하지 않기
- 이론만 공부하고 실습 건너뛰지 않기
- 에러가 나면 바로 답을 찾지 말고 먼저 고민하기
- 한 번에 모든 것을 이해하려 하지 않기
- 메모리 누수 체크를 잊지 않기

---

## 📝 다음 단계

1. **[01-interceptors.md](./01-interceptors.md)** 문서를 열어 HTTP Interceptors 학습 시작
2. 실습 코드는 `apps/rxjs/src/modules/` 하위에 시나리오별로 작성
3. 각 실습 완료 후 체크리스트 업데이트
4. 질문이나 막히는 부분은 학습 노트에 기록

---

**화이팅! 🚀**

> 이 학습 과정을 끝내면 NestJS에서 RxJS를 자유자재로 활용할 수 있게 됩니다!
