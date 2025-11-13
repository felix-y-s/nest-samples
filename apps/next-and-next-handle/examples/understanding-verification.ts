// ============================================
// 사고 과정 검증
// ============================================

console.log('\n' + '='.repeat(70));
console.log('당신의 사고 과정 검증');
console.log('='.repeat(70));

console.log(`
📝 당신의 사고 과정:

1️⃣ 처음 생각한 방식
   chain.use((req, res, next) => {
     next(req, res);  ← req, res를 명시적으로 전달
   });

   ✅ 평가: 맞습니다! 이 방식도 작동합니다.
   하지만 Express처럼 간결하지 않죠.

2️⃣ Express의 간결한 방식에 대한 의문
   "Express에서는 next()만으로도 값이 전달되는데?"

   ✅ 평가: 정확한 의문입니다!
   Express는 어떻게 next()만으로 req, res를 전달할까?

3️⃣ 참조 타입에 대한 추론
   "req는 매개변수이고 주소값이 전달되므로
    속성을 추가하면 반영되는 게 아닐까?"

   ✅ 평가: 이것도 맞습니다!
   req는 객체이므로 주소(참조)가 전달되고,
   속성을 수정하면 모든 곳에 반영됩니다.

   하지만... 여기서 핵심을 놓치셨습니다!

4️⃣ 핵심 문제 발견! 🎯
   "미들웨어에서 next()를 호출할 때
    매개변수를 전달하지 않으면 undefined로 전달되면서
    req가 undefined로 치환됨"

   ✅✅✅ 정확합니다! 이게 핵심입니다!

   참조 전달의 문제가 아니라,
   "인자를 전달하지 않았을 때 undefined가 되는" 문제였습니다!

5️⃣ 클로저를 통한 해결
   "클로저를 통해 this.next 함수를 호출하여
    이전 매개변수 req를 인자로 넘기도록 해결"

   ✅ 평가: 완벽합니다!
   클로저가 이전 req를 "기억"하고 있다가
   next()가 인자 없이 호출되어도
   자동으로 캡처된 req를 전달합니다!
`);

// ============================================
// 단계별 실제 코드 검증
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('단계별 실제 코드로 검증');
console.log('─'.repeat(70));

type MiddlewareType = (req: any, res: any, next: any) => void;

// ============================================
// 1단계: 명시적 전달 방식
// ============================================
console.log('\n1️⃣ 첫 번째 방식: 명시적으로 req, res 전달');

class Middleware1 {
  private middlewares: MiddlewareType[] = [];

  use(middleware: MiddlewareType) {
    this.middlewares.push(middleware);
  }

  next(req: any, res: any) {
    console.log('   next() 호출됨 - req:', req);
  }

  execute() {
    const req = { user: {} };
    const res = {};

    // 미들웨어에 this.next를 그대로 전달
    this.middlewares[0](req, res, this.next.bind(this));
  }
}

const test1 = new Middleware1();
test1.use((req, res, next) => {
  console.log('   미들웨어 실행');
  req.user = { name: 'kim' };
  next(req, res); // ← 명시적으로 전달
  console.log('   ✅ 작동함! 하지만 번거로움\n');
});
test1.execute();

// ============================================
// 2단계: Express 방식에 대한 의문
// ============================================
console.log('2️⃣ Express는 어떻게 next()만으로 작동할까?');
console.log('   → Express는 내부적으로 클로저를 사용합니다!\n');

// ============================================
// 3단계: 참조 타입에 대한 이해
// ============================================
console.log('3️⃣ req는 참조 타입 - 주소가 전달됨');

function demonstrateReference() {
  const req = { user: {} }; // 0x1234 주소

  function modify(r: any) {
    console.log('   함수 내부 - 받은 r:', r);
    r.user = { name: 'kim' };
    console.log('   함수 내부 - 수정 후 r:', r);
  }

  modify(req);
  console.log('   함수 외부 - req:', req);
  console.log('   ✅ 참조 전달 확인! 같은 객체를 가리킴\n');
}
demonstrateReference();

// ============================================
// 4단계: 핵심 문제 - undefined 전달
// ============================================
console.log('4️⃣ 핵심 문제: next()를 인자 없이 호출하면?');

class Middleware4 {
  next(req: any, res: any) {
    console.log('   next() 호출됨');
    console.log('   받은 req:', req);
    console.log('   받은 res:', res);
    console.log('   💥 문제! req와 res가 undefined!');
  }

  execute() {
    const req = { user: {} };
    const res = {};

    // this.next.bind(this)만 전달
    const boundNext = this.next.bind(this);

    const middleware = (req: any, res: any, next: any) => {
      console.log('   미들웨어 실행');
      req.user = { name: 'kim' };

      console.log('   next() 호출 (인자 없이)');
      next(); // ← 인자를 전달하지 않음!
    };

    middleware(req, res, boundNext);
    console.log('');
  }
}

const test4 = new Middleware4();
test4.execute();

console.log('   🔍 원인 분석:');
console.log('      - boundNext()가 호출됨');
console.log('      - boundNext = this.next.bind(this)');
console.log('      - this만 고정되어 있고, req/res는 없음');
console.log('      - next()에 인자가 전달되지 않음');
console.log('      - 따라서 req = undefined, res = undefined\n');

// ============================================
// 5단계: 클로저로 해결
// ============================================
console.log('5️⃣ 해결: 클로저로 이전 req를 캡처');

class Middleware5 {
  private middlewares: MiddlewareType[] = [];
  private currentIndex = 0;

  use(middleware: MiddlewareType) {
    this.middlewares.push(middleware);
  }

  next(req: any, res: any) {
    console.log('   next() 호출됨 - req:', req);

    if (this.currentIndex >= this.middlewares.length) {
      console.log('   ✅ 완료!\n');
      return;
    }

    const currentMiddleware = this.middlewares[this.currentIndex];
    this.currentIndex++;

    // 🔑 핵심: 클로저로 req, res를 캡처
    console.log('   📦 nextFunction 생성 - req를 캡처함');
    const nextFunction = () => {
      console.log('   💡 nextFunction 호출됨');
      console.log('      [[Scope]]에서 캡처된 req 사용:', req);
      this.next(req, res);
    };

    currentMiddleware(req, res, nextFunction);
  }

  execute() {
    this.currentIndex = 0;
    const req = { user: {} };
    const res = {};

    console.log('   🎬 체인 실행 시작\n');
    this.next(req, res);
  }
}

const test5 = new Middleware5();

test5.use((req, res, next) => {
  console.log('   🔵 미들웨어1 실행');
  req.user = { name: 'kim' };
  console.log('      req.user 설정:', req.user);
  console.log('      next() 호출 (인자 없이)\n');
  next(); // ← 인자 없이 호출!
});

test5.use((req, res, next) => {
  console.log('   🟢 미들웨어2 실행');
  console.log('      req.user 확인:', req.user);
  console.log('      ✅ 성공! 값이 전달됨\n');
  next();
});

test5.execute();

// ============================================
// 핵심 정리
// ============================================
console.log('\n' + '='.repeat(70));
console.log('🎯 핵심 정리');
console.log('='.repeat(70));

console.log(`
당신의 이해가 100% 정확합니다! 👏

✅ 1단계: next(req, res) - 명시적 전달 방식
   → 작동하지만 번거로움

✅ 2단계: Express의 next() 방식에 대한 의문
   → 좋은 질문!

✅ 3단계: 참조 타입에 대한 이해
   → req는 주소가 전달되므로 수정사항이 반영됨
   → 이 부분은 맞지만, 문제의 핵심은 아니었음

✅✅ 4단계: 핵심 문제 발견! 🎯
   → next()를 인자 없이 호출하면 undefined가 전달됨
   → 이게 진짜 문제였음!
   → "참조 전달"의 문제가 아니라 "인자 전달"의 문제!

✅✅✅ 5단계: 클로저로 해결! 🏆
   → 클로저가 이전 req를 "기억"
   → next()를 인자 없이 호출해도
   → 캡처된 req가 자동으로 전달됨

🎓 학습 포인트:

   문제: Express 스타일 구현 방법?

   잘못된 접근: "참조 전달을 활용하면 되지 않나?"
   → 참조 전달은 이미 되고 있음
   → 문제는 "인자를 전달하지 않았을 때"

   올바른 접근: "인자 없이 호출할 방법은?"
   → 클로저로 req를 캡처
   → next()만 호출해도 자동 전달

🏆 결론:

   당신은 문제의 본질을 정확히 파악했고,
   단계별로 논리적으로 분석했으며,
   올바른 해결책을 찾았습니다!

   완벽한 사고 과정입니다! 🎉
`);

// ============================================
// 보너스: 메모리 다이어그램
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('📊 메모리 다이어그램으로 이해하기');
console.log('─'.repeat(70));

console.log(`
❌ this.next.bind(this) 방식:

   스택 메모리:                    힙 메모리:
   ┌─────────────────────┐         ┌──────────────────┐
   │ req: 0x1234 ────────┼────────→│ 0x1234:          │
   │ boundNext:          │         │   { user: {} }   │
   │   [[BoundThis]]: ✅ │         └──────────────────┘
   │   [[BoundArgs]]: ❌ │
   └─────────────────────┘

   next() 호출 시:
   → boundNext()
   → this.next(undefined, undefined) ❌


✅ 클로저 방식:

   스택 메모리:                    힙 메모리:
   ┌─────────────────────┐         ┌──────────────────┐
   │ req: 0x1234 ────────┼────────→│ 0x1234:          │
   │ nextFunction:       │         │   { user: {} }   │
   │   [[Scope]]:        │         └──────────────────┘
   │     - this: ✅      │
   │     - req: 0x1234 ✅│
   │     - res: 0x5678 ✅│
   └─────────────────────┘

   next() 호출 시:
   → nextFunction()
   → [[Scope]]에서 req(0x1234), res 가져옴
   → this.next(0x1234, 0x5678) ✅


🎯 차이점:

   bind: this만 저장
   클로저: this + req + res 모두 저장
`);
