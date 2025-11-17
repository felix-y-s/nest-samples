# TypeScript Decorator 동작 원리 예시

## 1. Decorator가 주입하는 방식

```typescript
// logger.decorator.ts
export function WithLogger() {
  console.log('1. Decorator factory 호출');

  return function (target: any) {
    console.log('2. 실제 Decorator 함수 실행');
    console.log('   target.name:', target.name); // "LoggingInterceptor"

    // 프로토타입에 logger 속성 추가
    target.prototype.logger = new Logger(target.name);
    console.log('3. Logger가 프로토타입에 주입됨');
  };
}

// logging.interceptor.ts
console.log('0. 파일 로딩 시작');

@WithLogger()  // ← 여기서 1, 2, 3이 순차 실행!
export class LoggingInterceptor implements NestInterceptor {
  private logger!: Logger;  // TypeScript 타입 선언

  intercept() {
    // 4. 인스턴스 메서드 실행 시
    console.log('4. intercept 실행, logger 사용');
    this.logger.debug('...');  // 프로토타입 체인으로 접근
  }
}

console.log('5. 클래스 정의 완료 (인스턴스는 아직 생성 전)');
```

## 2. 실행 순서

```
프로그램 시작
  ↓
0. 파일 로딩 시작
  ↓
1. Decorator factory 호출 (@WithLogger())
  ↓
2. 실제 Decorator 함수 실행
   - target = LoggingInterceptor 클래스
   - target.name = "LoggingInterceptor"
  ↓
3. Logger가 프로토타입에 주입됨
   - LoggingInterceptor.prototype.logger = new Logger(...)
  ↓
5. 클래스 정의 완료
  ↓
... (나중에 NestJS가 인스턴스 생성)
  ↓
const interceptor = new LoggingInterceptor();
  ↓
4. intercept 실행, logger 사용
   - this.logger 접근
   - 프로토타입 체인 검색: interceptor.__proto__.logger 발견!
```

## 3. 프로토타입 체인 시각화

```typescript
// Decorator 실행 후 메모리 구조

┌─────────────────────────────────────┐
│ LoggingInterceptor (클래스)          │
│  - constructor: function            │
│  - prototype: ───────────────┐      │
└──────────────────────────────│──────┘
                               │
                               ↓
        ┌──────────────────────────────────────┐
        │ LoggingInterceptor.prototype         │
        │  - logger: Logger { context: "..." } │ ← Decorator가 주입!
        │  - intercept: function               │
        └──────────────────────────────────────┘
                               ↑
                               │
        ┌──────────────────────┼──────────┐
        │ interceptor (인스턴스)            │
        │  __proto__: ──────────┘          │
        │  (logger는 인스턴스에 없음!)       │
        └──────────────────────────────────┘

// interceptor.logger 접근 시:
// 1. interceptor 객체에서 logger 찾기 → 없음
// 2. interceptor.__proto__ (프로토타입)에서 찾기 → 있음! ✅
```

## 4. 주의사항: 프로토타입 공유 문제

```typescript
// 문제: 모든 인스턴스가 같은 logger를 공유!

const interceptor1 = new LoggingInterceptor();
const interceptor2 = new LoggingInterceptor();

// 둘 다 같은 프로토타입의 logger를 참조
interceptor1.logger === interceptor2.logger; // true! ⚠️

// 만약 logger가 상태를 가진다면 문제 발생 가능
```

## 5. 개선된 Decorator (인스턴스마다 독립적인 logger)

```typescript
export function WithLogger() {
  return function (target: any) {
    // 원본 constructor 저장
    const original = target;

    // 새로운 constructor 정의
    const newConstructor: any = function (...args: any[]) {
      // 원본 constructor 실행
      const instance = new original(...args);

      // 각 인스턴스마다 독립적인 logger 할당
      instance.logger = new Logger(target.name);

      return instance;
    };

    // 프로토타입 복사
    newConstructor.prototype = original.prototype;

    return newConstructor;
  };
}

// 이제 각 인스턴스가 독립적인 logger를 가짐
const interceptor1 = new LoggingInterceptor();
const interceptor2 = new LoggingInterceptor();

interceptor1.logger === interceptor2.logger; // false ✅
```

## 6. TypeScript의 `!` (non-null assertion) 의미

```typescript
export class LoggingInterceptor {
  private logger!: Logger;
  //            ↑ 느낌표의 의미:
  // "이 속성은 초기화 안 되어 보이지만,
  //  런타임에 반드시 값이 있을 거니까
  //  TypeScript야 에러 내지 마!"

  // 만약 !가 없다면:
  // Error: Property 'logger' has no initializer
  //        and is not definitely assigned in the constructor.
}
```

## 7. 실전 사용 시 고려사항

### 장점
- 반복 코드 제거
- 선언적(declarative) 방식

### 단점
1. **프로토타입 공유**: 모든 인스턴스가 같은 객체 참조
2. **디버깅 어려움**: logger가 어디서 왔는지 코드만으로 불명확
3. **IDE 지원 약함**: logger 정의로 점프 불가
4. **테스트 복잡**: Mock 설정 어려움

### 추천하지 않는 이유
```typescript
// ❌ Decorator 방식
@WithLogger()
class Foo {
  private logger!: Logger;  // 어디서 왔는지 불명확
}

// ✅ 명시적 방식 (더 낫다!)
class Foo {
  private readonly logger = createLogger(Foo.name);  // 명확!
}
```
