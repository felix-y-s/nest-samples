// ============================================
// 왜 nextFunction(클로저)이 필요한가?
// ============================================

console.log('\n' + '='.repeat(70));
console.log('문제: this.next.bind(this)만으로는 왜 안 되는가?');
console.log('='.repeat(70));

console.log(`
🤔 질문:
   req는 참조 타입이고 주소(0x1234)가 복사되는데,
   this.next.bind(this)를 전달하면 안 되나요?
   왜 nextFunction을 만들어야 하나요?

🔑 답:
   문제는 "req를 어떻게 전달하느냐"가 아니라
   "미들웨어에서 next()를 인자 없이 호출할 수 있느냐"입니다!
`);

// ============================================
// 시나리오 1: this.next.bind(this)만 사용 (실패)
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('❌ 시나리오 1: this.next.bind(this)만 사용 (실패)');
console.log('─'.repeat(70));

type MiddlewareType = (req: any, res: any, next: any) => void;

class Middleware1 {
  next(req: any, res: any) {
    console.log('🔵 next 메서드 호출됨');
    console.log('   받은 req:', req);
    console.log('   받은 res:', res);
  }

  execute(req: any, res: any) {
    console.log('\n📌 Middleware1 실행');
    console.log('   req (0x1234):', req);

    // this.next.bind(this)만 전달
    const boundNext = this.next.bind(this);

    console.log('\n📦 미들웨어에 전달:');
    console.log('   - req: 0x1234 참조');
    console.log('   - res: 0x5678 참조');
    console.log('   - next: boundNext (this만 바인딩된 함수)');

    // 미들웨어 실행
    const middleware = (req: any, res: any, next: any) => {
      console.log('\n🟢 미들웨어 내부:');
      console.log('   req 수정 전:', req);
      req.user = { name: 'kim' };
      console.log('   req 수정 후:', req);

      console.log('\n📞 next() 호출 (인자 없이!)');
      console.log('   → boundNext() 실행');
      console.log('   → this.next() 호출');
      console.log('   → this.next(???, ???) ← req, res가 뭐야?');

      next(); // ❌ 문제 발생!
    };

    middleware(req, res, boundNext);
  }
}

const test1 = new Middleware1();
test1.execute({ user: {} }, {});

console.log('\n💥 문제 발생:');
console.log('   boundNext()를 호출하면:');
console.log('   → this.next(undefined, undefined) 호출됨!');
console.log('   → req, res를 어떻게 전달하지?');

console.log('\n❓ 왜?');
console.log(`
   this.next.bind(this)는 "this만 고정"합니다.
   req, res는 전혀 캡처하지 않습니다!

   바인딩된 함수 구조:
   ┌─────────────────────────┐
   │ boundNext               │
   ├─────────────────────────┤
   │ this: Middleware 인스턴스 │  ← this만 고정
   │ req: ??? (없음!)        │
   │ res: ??? (없음!)        │
   └─────────────────────────┘

   미들웨어에서 next()를 호출하면:
   → boundNext() 실행
   → this.next(undefined, undefined) 호출
   → req, res가 전달되지 않음!
`);

// ============================================
// 시나리오 2: nextFunction(클로저) 사용 (성공)
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('✅ 시나리오 2: nextFunction(클로저) 사용 (성공)');
console.log('─'.repeat(70));

class Middleware2 {
  next(req: any, res: any) {
    console.log('🔵 next 메서드 호출됨');
    console.log('   받은 req:', req);
    console.log('   받은 res:', res);
  }

  execute(req: any, res: any) {
    console.log('\n📌 Middleware2 실행');
    console.log('   req (0x1234):', req);

    // 클로저로 req, res를 캡처하는 함수 생성
    console.log('\n📦 nextFunction 생성:');
    console.log('   const nextFunction = () => this.next(req, res)');
    console.log('   캡처되는 것:');
    console.log('   - this: Middleware 인스턴스');
    console.log('   - req: 0x1234 참조');
    console.log('   - res: 0x5678 참조');

    const nextFunction = () => {
      console.log('\n💡 nextFunction 내부:');
      console.log('   [[Scope]]에서 캡처된 변수 사용');
      console.log('   - req: 0x1234 참조');
      console.log('   - res: 0x5678 참조');
      this.next(req, res);
    };

    console.log('\n📦 미들웨어에 전달:');
    console.log('   - req: 0x1234 참조');
    console.log('   - res: 0x5678 참조');
    console.log('   - next: nextFunction (req, res를 캡처한 함수)');

    // 미들웨어 실행
    const middleware = (req: any, res: any, next: any) => {
      console.log('\n🟢 미들웨어 내부:');
      console.log('   req 수정 전:', req);
      req.user = { name: 'kim' };
      console.log('   req 수정 후:', req);

      console.log('\n📞 next() 호출 (인자 없이!)');
      console.log('   → nextFunction() 실행');
      console.log('   → [[Scope]]에서 req(0x1234), res 가져옴');
      console.log('   → this.next(0x1234, res) 호출 ✅');

      next(); // ✅ 성공!
    };

    middleware(req, res, nextFunction);
  }
}

const test2 = new Middleware2();
test2.execute({ user: {} }, {});

console.log('\n✅ 성공:');
console.log('   nextFunction()을 호출하면:');
console.log('   → [[Scope]]에서 req, res를 가져옴');
console.log('   → this.next(req, res) 호출');
console.log('   → req, res가 제대로 전달됨!');

// ============================================
// 비교: bind vs 클로저
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('📊 비교: bind vs 클로저');
console.log('─'.repeat(70));

console.log(`
┌────────────────────────────────────────────────────────────────┐
│               this.next.bind(this)                             │
├────────────────────────────────────────────────────────────────┤
│ 고정되는 것: this만                                            │
│ 캡처되는 것: 없음                                              │
│ 호출 방법: boundNext(req, res) ← 인자를 직접 전달해야 함      │
│ 문제점: 미들웨어에서 next()만 호출하면 req, res가 undefined   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│         const nextFunction = () => this.next(req, res)         │
├────────────────────────────────────────────────────────────────┤
│ 고정되는 것: this                                              │
│ 캡처되는 것: this, req, res                                    │
│ 호출 방법: nextFunction() ← 인자 없이 호출 가능!              │
│ 장점: 미들웨어에서 next()만 호출해도 req, res가 자동 전달     │
└────────────────────────────────────────────────────────────────┘
`);

// ============================================
// 핵심 차이점 시각화
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('🔑 핵심 차이점');
console.log('─'.repeat(70));

console.log(`
문제의 본질:
   Express 방식: next()      ← 인자 없이 호출
   일반 방식: next(req, res) ← 인자를 직접 전달

Express 스타일을 구현하려면:
   미들웨어에서 next()만 호출해도
   내부적으로 req, res가 자동으로 전달되어야 함!

❌ this.next.bind(this):
   function middleware(req, res, next) {
     next();  // → this.next(undefined, undefined) ❌
   }

✅ nextFunction (클로저):
   function middleware(req, res, next) {
     next();  // → this.next(req, res) ✅ (캡처된 값 사용)
   }
`);

// ============================================
// 실제 코드로 증명
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('🧪 실제 코드로 증명');
console.log('─'.repeat(70));

class ProofMiddleware {
  private middlewares: MiddlewareType[] = [];
  private currentIndex = 0;

  use(middleware: MiddlewareType) {
    this.middlewares.push(middleware);
  }

  // ❌ 실패하는 버전
  nextWithBind(req: any, res: any) {
    if (this.currentIndex >= this.middlewares.length) {
      console.log('✅ 완료');
      return;
    }

    const currentMiddleware = this.middlewares[this.currentIndex];
    this.currentIndex++;

    // this만 바인딩
    currentMiddleware(req, res, this.nextWithBind.bind(this));
  }

  // ✅ 성공하는 버전
  nextWithClosure(req: any, res: any) {
    if (this.currentIndex >= this.middlewares.length) {
      console.log('✅ 완료 - req:', req);
      return;
    }

    const currentMiddleware = this.middlewares[this.currentIndex];
    this.currentIndex++;

    // req, res를 캡처하는 클로저
    const nextFunction = () => this.nextWithClosure(req, res);

    currentMiddleware(req, res, nextFunction);
  }

  executeWithBind(req: any, res: any) {
    console.log('\n❌ bind 버전 실행:');
    this.currentIndex = 0;
    try {
      this.nextWithBind(req, res);
    } catch (error) {
      console.log('💥 에러:', error instanceof Error ? error.message : error);
    }
  }

  executeWithClosure(req: any, res: any) {
    console.log('\n✅ 클로저 버전 실행:');
    this.currentIndex = 0;
    this.nextWithClosure(req, res);
  }
}

const proof = new ProofMiddleware();

proof.use((req, res, next) => {
  console.log('미들웨어1: req.user 설정');
  req.user = { name: 'kim' };
  next(); // ← 인자 없이 호출!
});

proof.use((req, res, next) => {
  console.log('미들웨어2: req.user 확인 -', req.user);
  next();
});

// bind 버전 테스트
proof.executeWithBind({ user: {} }, {});

// 새로운 인스턴스로 클로저 버전 테스트
const proof2 = new ProofMiddleware();
proof2.use((req, res, next) => {
  console.log('미들웨어1: req.user 설정');
  req.user = { name: 'kim' };
  next(); // ← 인자 없이 호출!
});

proof2.use((req, res, next) => {
  console.log('미들웨어2: req.user 확인 -', req.user);
  next();
});

proof2.executeWithClosure({ user: {} }, {});

// ============================================
// 최종 정리
// ============================================
console.log('\n' + '='.repeat(70));
console.log('🎯 최종 정리');
console.log('='.repeat(70));

console.log(`
❓ 원래 질문:
   "req는 참조 타입이고 주소가 복사되는데,
    this.next.bind(this)로 전달하면 안 되나요?"

💡 답변:
   1. req가 참조 타입이라는 것은 맞습니다.
   2. 주소(0x1234)가 복사되는 것도 맞습니다.
   3. 하지만 문제는 "전달 방식"입니다!

🔍 핵심 문제:
   Express 스타일: next()      ← 인자 없이 호출
   일반 스타일: next(req, res) ← 인자를 명시적으로 전달

🎯 해결책:
   미들웨어에서 next()만 호출해도
   내부적으로 req, res가 자동으로 전달되려면
   → 클로저로 req, res를 "캡처"해야 함!

📌 bind의 한계:
   this.next.bind(this)
   → this만 고정
   → req, res는 캡처하지 않음
   → next()만 호출하면 undefined 전달

✅ 클로저의 장점:
   const nextFunction = () => this.next(req, res)
   → this, req, res 모두 캡처
   → next()만 호출해도 req, res 자동 전달
   → Express 스타일 구현 가능!

🏆 결론:
   req가 참조 타입이라는 것과
   클로저가 필요한 것은 별개의 문제입니다!

   - 참조 타입: 메모리 주소를 복사하는 방식
   - 클로저: 인자 없이 호출할 수 있게 하는 메커니즘
`);
