# Express 미들웨어 체인의 클로저 동작 원리

## 목차
1. [초기 문제](#초기-문제)
2. [문제 분석](#문제-분석)
3. [JavaScript 값 전달 방식](#javascript-값-전달-방식)
4. [클로저를 사용한 해결](#클로저를-사용한-해결)
5. [핵심 정리](#핵심-정리)

---

## 초기 문제

문제 코드
```ts
class Middleware {
  private middlewares: Array<
    (
      req: { user: { name?: string; age?: number } },
      res: any,
      next: any,
    ) => void
  > = [];
  private currentIndex = 0;

  constructor() {}

  use(
    middleware: (
      req: { user: { name?: string; age?: number } },
      res: any,
      next: any,
    ) => void,
  ) {
    this.middlewares.push(middleware);
  }

  next(req: { user: { name?: string; age?: number } }, res: any, err?: any) {
    if (err) {
      return this.errorHandler(err, req, res);
    }

    if (this.currentIndex >= this.middlewares.length) {
      return this.routeHandler(req, res);
    }

    const currentMiddleware = this.middlewares[this.currentIndex];
    this.currentIndex++;

    // 클로저를 활용하여 req, res를 자동으로 전달하는 next 함수 생성
    // const nextFunction = (err?: any) => {
    //   this.next(req, res, err);
    // };

    try {
      currentMiddleware(req, res, this.next.bind(this));
    } catch (error) {
      this.next(req, res, error);
    }
  }

  excute(req: { user: { name?: string; age?: number } }, res: any) {
    this.currentIndex = 0;
    this.next(req, res);
  }

  errorHandler(err: any, req, res) {
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(err);
    }
  }

  routeHandler(req: any, res: any) {
    console.log(`✅ [routeHandler] req:`, req);
    console.log(`✅ [routeHandler] res:`, res);
  }
}

const chain = new Middleware();

chain.use((req, res, next) => {
  console.log('1️⃣ middleware before');
  req.user = { name: 'kim' };
  next();
  console.log('1️⃣ middleware after');
});

chain.use((req, res, next) => {
  console.log('2️⃣ middleware before');
  console.log('2️⃣ req.user:', req.user);
  next();
  console.log('2️⃣ middleware after');
});

chain.excute({ user: {} }, {});
```

Express 미들웨어를 구현하면서 발생한 문제:

```typescript
// 문제 상황
chain.use((req, res, next) => {
  req.user = { name: 'kim' };
  next(); // 인자 없이 호출
});

chain.use((req, res, next) => {
  console.log(req.user); // undefined 발생!
});
```

### 실행 결과
```
🚀 0/2
1️⃣ middleware before
🚀 1/2
2️⃣ middleware before
Cannot read properties of undefined (reading 'user')
1️⃣ middleware after
```

**문제**: 미들웨어1에서 설정한 `req.user`가 미들웨어2로 전달되지 않음

---

## 문제 분석

### 사고 과정

1. **초기 접근**: `next(req, res)`로 명시적으로 전달하면 작동함
   ```typescript
   next(req, res); // ✅ 작동하지만 번거로움
   ```

2. **의문**: Express는 `next()`만으로 작동하는데?
   ```typescript
   next(); // ← Express 스타일
   ```

3. **가설**: req는 참조 타입이니까 주소가 전달되면 속성 수정이 반영되는 거 아닐까?
   - 이 부분은 맞지만, 문제의 핵심은 아니었음

4. **진짜 문제 발견**: `next()`를 인자 없이 호출하면 `undefined`가 전달됨
   ```typescript
   // this.next.bind(this)만 사용한 경우
   next(); // → this.next(undefined, undefined) ❌
   ```

5. **해결책**: 클로저로 이전 `req`를 캡처하여 자동 전달

---

## JavaScript 값 전달 방식

### 원시 타입 (Primitive Types) - 값 복사

```typescript
let num = 5;
function modify(n) {
  n = 999;
}
modify(num);
console.log(num); // 5 (변하지 않음!)
```

**특징**:
- 종류: `number`, `string`, `boolean`, `undefined`, `null`, `symbol`, `bigint`
- 전달 방식: 값 자체가 복사됨
- 수정 영향: 원본에 영향 없음

### 참조 타입 (Reference Types) - 참조(주소) 복사

```typescript
let obj = { name: 'kim' };
function modify(o) {
  o.name = 'lee'; // 속성 수정
}
modify(obj);
console.log(obj.name); // 'lee' (변했다!)
```

**특징**:
- 종류: `object`, `array`, `function`, `Date`, `RegExp` 등
- 전달 방식: 메모리 주소(참조)가 복사됨
- 수정 영향:
  - 속성 수정 시: 원본에 영향 있음 ❌
  - 재할당 시: 원본에 영향 없음 ✅

### 메모리 구조

```
원시 타입:
┌─────────────┐
│ 스택 메모리    │
├─────────────┤
│ num: 5      │ ← 원본
│ n: 5        │ ← 복사본 (독립적)
└─────────────┘

참조 타입:
┌─────────────┐     ┌──────────────────┐
│ 스택 메모리    │     │ 힙 메모리          │
├─────────────┤     ├──────────────────┤
│ obj: 0x1234 ─────→│ 0x1234:          │
│ o: 0x1234 ───────→│   { name: 'lee' }│
└─────────────┘     └──────────────────┘
```

---

## 클로저를 사용한 해결

### ❌ 실패: `this.next.bind(this)`만 사용

```typescript
next(req, res) {
  const currentMiddleware = this.middlewares[this.currentIndex];
  this.currentIndex++;

  // this만 바인딩
  currentMiddleware(req, res, this.next.bind(this));
}
```

**문제점**:
```typescript
// 미들웨어에서
next(); // → this.next(undefined, undefined) ❌
```

`bind(this)`는 **`this`만 고정**하고, `req`, `res`는 캡처하지 않음!

### ✅ 성공: 클로저로 `req`, `res` 캡처

```typescript
next(req, res) {
  const currentMiddleware = this.middlewares[this.currentIndex];
  this.currentIndex++;

  // 클로저로 req, res를 캡처
  const nextFunction = (err?: any) => {
    this.next(req, res, err);
  };

  currentMiddleware(req, res, nextFunction);
}
```

**작동 원리**:
```typescript
// 미들웨어에서
next(); // → nextFunction()
        // → [[Scope]]에서 req, res 가져옴
        // → this.next(req, res) ✅
```

### 클로저란?

**클로저(Closure)**: 함수가 생성될 때 외부 스코프의 변수를 "기억"하는 메커니즘

```typescript
const nextFunction = (err?) => this.next(req, res, err);
```

이 코드가 실행될 때 JavaScript 엔진은:

1. 새로운 함수 객체 생성
2. `[[Scope]]` 내부 슬롯에 외부 변수 저장:
   - `req`: 0x1234 참조
   - `res`: 0x5678 참조
   - `this`: Middleware 인스턴스

⚠️ **중요**: `req`의 "값"이 아니라 "메모리 주소"를 저장!

### 단계별 실행 흐름

```
1️⃣ chain.excute({ user: {} }, {})
   → req = 0x1234 주소의 { user: {} } 객체

2️⃣ next(req, res) 호출
   → next 메서드의 req 파라미터 = 0x1234 참조

3️⃣ nextFunction 생성
   → nextFunction.[[Scope]].req = 0x1234 참조 저장

4️⃣ 미들웨어1 실행
   → 미들웨어1의 req 파라미터 = 0x1234 참조
   → req.user = { name: 'kim' } 실행
   → 0x1234 주소의 객체가 { user: { name: 'kim' } }로 변경

5️⃣ 미들웨어1에서 next() 호출
   → nextFunction() 실행
   → [[Scope]].req (0x1234) 사용
   → this.next(0x1234, res) 호출

6️⃣ next 메서드 재진입
   → 0x1234의 내용 = { user: { name: 'kim' } }

7️⃣ 새로운 nextFunction 생성 (미들웨어2용)
   → nextFunction.[[Scope]].req = 0x1234 참조 저장

8️⃣ 미들웨어2 실행
   → req.user 접근 → { name: 'kim' } 출력됨! ✅
```

---

## 핵심 정리

### 문제의 본질

```
Express 스타일: next()      ← 인자 없이 호출
일반 스타일: next(req, res) ← 인자를 명시적으로 전달
```

Express 스타일을 구현하려면:
- 미들웨어에서 `next()`만 호출해도
- 내부적으로 `req`, `res`가 자동으로 전달되어야 함!

### bind의 한계

```typescript
this.next.bind(this)
```

- **고정되는 것**: `this`만
- **캡처되는 것**: 없음
- **호출 방법**: `boundNext(req, res)` ← 인자를 직접 전달해야 함
- **문제점**: `next()`만 호출하면 `req`, `res`가 `undefined`

### 클로저의 장점

```typescript
const nextFunction = () => this.next(req, res)
```

- **고정되는 것**: `this`
- **캡처되는 것**: `this`, `req`, `res`
- **호출 방법**: `nextFunction()` ← 인자 없이 호출 가능!
- **장점**: `next()`만 호출해도 `req`, `res`가 자동 전달

### 비교 표

| 구분 | bind | 클로저 |
|------|------|--------|
| this 고정 | ✅ | ✅ |
| req 캡처 | ❌ | ✅ |
| res 캡처 | ❌ | ✅ |
| 인자 없이 호출 | ❌ | ✅ |

### 메모리 다이어그램

#### ❌ bind 방식
```
스택 메모리:              힙 메모리:
┌───────────────┐         ┌──────────────┐
│ req: 0x1234 ──┼────────→│ 0x1234:      │
│ boundNext:    │         │   {user: {}} │
│   [[This]]: ✅│         └──────────────┘
│   req: ❌     │
│   res: ❌     │
└───────────────┘

next() → this.next(undefined, undefined) ❌
```

#### ✅ 클로저 방식
```
스택 메모리:              힙 메모리:
┌───────────────┐         ┌──────────────┐
│ req: 0x1234 ──┼────────→│ 0x1234:      │
│ nextFunction: │         │   {user: {}} │
│   [[Scope]]:  │         └──────────────┘
│     this: ✅  │
│     req: ✅   │
│     res: ✅   │
└───────────────┘

next() → this.next(req, res) ✅
```

### 최종 결론

```
참조 타입 전달: 메모리 주소를 복사하는 "방식"
클로저 필요성: 인자 없이 호출 가능하게 하는 "메커니즘"

→ 완전히 다른 개념이며, 둘 다 필요합니다!
```

1. **참조 타입**: `req`가 객체이므로 주소가 전달되고, 속성 수정 시 모든 곳에 반영됨
2. **클로저**: `next()`를 인자 없이 호출해도 `req`, `res`가 자동으로 전달되게 함

**Express 스타일 구현에는 클로저가 필수입니다!** 🎉

---

## 참고 코드

### 완성된 미들웨어 체인 구현

```typescript
class Middleware {
  private middlewares: Array<MiddlewareType> = [];
  private currentIndex = 0;

  use(middleware: MiddlewareType) {
    this.middlewares.push(middleware);
  }

  next(req: any, res: any, err?: any) {
    if (err) {
      return this.errorHandler(err, req, res);
    }

    if (this.currentIndex >= this.middlewares.length) {
      return this.routeHandler(req, res);
    }

    const currentMiddleware = this.middlewares[this.currentIndex];
    this.currentIndex++;

    // 🔑 핵심: 클로저로 req, res를 캡처
    const nextFunction = (err?: any) => {
      this.next(req, res, err);
    };

    try {
      currentMiddleware(req, res, nextFunction);
    } catch (error) {
      this.next(req, res, error);
    }
  }

  excute(req: any, res: any) {
    this.currentIndex = 0;
    this.next(req, res);
  }

  errorHandler(err: any, req, res) {
    console.error(err);
  }

  routeHandler(req: any, res: any) {
    console.log('✅ [routeHandler] req:', req);
  }
}
```

### 사용 예제

```typescript
const chain = new Middleware();

chain.use((req, res, next) => {
  console.log('1️⃣ middleware before');
  req.user = { name: 'kim' };
  next(); // ← 인자 없이 호출!
  console.log('1️⃣ middleware after');
});

chain.use((req, res, next) => {
  console.log('2️⃣ middleware before');
  console.log('2️⃣ req.user:', req.user); // { name: 'kim' } ✅
  next();
  console.log('2️⃣ middleware after');
});

chain.excute({ user: {} }, {});
```

### 실행 결과

```
🚀 0/2
1️⃣ middleware before
🚀 1/2
2️⃣ middleware before
2️⃣ req.user: { name: 'kim' }
🚀 2/2
✅ [routeHandler] req: { user: { name: 'kim' } }
2️⃣ middleware after
1️⃣ middleware after
```

---

## 학습 포인트

### 좋은 질문들

1. "Express는 왜 `next()`만으로 작동하지?"
2. "req는 참조 타입이니까 주소가 전달되면 되는 거 아닌가?"
3. "왜 클로저가 필요한가?"

### 핵심 깨달음

- **참조 전달**은 이미 작동 중이었음 (req는 객체)
- 진짜 문제는 **"인자 없이 호출할 방법"**이었음
- **클로저**가 이 문제를 해결함 (외부 변수를 "기억")

### 사고 과정

```
1. 명시적 전달 (next(req, res)) → 작동하지만 번거로움
2. Express 방식 의문 (next()만으로?) → 좋은 질문
3. 참조 타입 가설 → 맞지만 문제의 핵심은 아님
4. 진짜 문제 발견 → undefined 전달 문제!
5. 클로저로 해결 → 완벽한 해결책! ✅
```
