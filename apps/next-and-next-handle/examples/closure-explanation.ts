// ============================================
// 클로저 동작 원리 상세 설명
// ============================================

console.log('\n=== 1단계: 첫 번째 미들웨어 실행 시작 ===\n');

// next 메서드가 호출될 때의 상황을 시뮬레이션
function simulateNextMethod() {
  // 이 시점의 req 객체 (메모리 주소: 0x1234라고 가정)
  const req = { user: {} };
  const res = {};

  console.log('📌 next 메서드 내부:');
  console.log('   req 객체 생성:', req);
  console.log('   req의 메모리 주소: 0x1234 (가정)\n');

  // ============================================
  // 핵심: nextFunction 생성 시점
  // ============================================
  const nextFunction = (err?: any) => {
    console.log('\n🔥 nextFunction 호출됨!');
    console.log('   이 함수가 생성될 때 캡처된 req:', req);
    console.log('   이 함수가 생성될 때 캡처된 req의 메모리 주소: 0x1234');
    console.log('   현재 req.user:', req.user);
  };

  console.log('✅ nextFunction 생성 완료');
  console.log('   nextFunction은 다음 변수들을 "기억"하고 있음:');
  console.log('   - req (메모리 주소: 0x1234)');
  console.log('   - res');
  console.log('   - this (Middleware 인스턴스)\n');

  // ============================================
  // 미들웨어에 nextFunction 전달
  // ============================================
  console.log('=== 2단계: 미들웨어 실행 ===\n');

  const middleware1 = (req: any, res: any, next: any) => {
    console.log('📍 미들웨어1 내부:');
    console.log('   받은 req:', req);
    console.log('   받은 req의 메모리 주소: 0x1234 (동일!)\n');

    console.log('🔧 req.user 수정 중...');
    req.user = { name: 'kim' };
    console.log('   수정 후 req.user:', req.user);
    console.log('   메모리 주소 0x1234의 객체가 수정됨\n');

    console.log('📞 next() 호출 (인자 없이!)');
    next(); // nextFunction이 호출됨
  };

  // 미들웨어 실행
  middleware1(req, res, nextFunction);
}

simulateNextMethod();

console.log('\n' + '='.repeat(60));
console.log('클로저가 없다면 어떻게 될까?');
console.log('='.repeat(60) + '\n');

// ============================================
// 비교: 클로저 없이 this.next.bind(this)만 사용한 경우
// ============================================
function withoutClosure() {
  const req = { user: {} };
  const res = {};

  class Middleware {
    next(req: any, res: any, err?: any) {
      console.log('❌ next 메서드 호출됨');
      console.log('   전달받은 req:', req);
      console.log('   전달받은 res:', res);
    }
  }

  const middleware = new Middleware();

  // this.next.bind(this)만 전달
  const boundNext = middleware.next.bind(middleware);

  const middleware1 = (req: any, res: any, next: any) => {
    console.log('📍 미들웨어1 내부:');
    req.user = { name: 'kim' };
    console.log('   req.user 수정:', req.user);

    console.log('📞 next() 호출 (인자 없이!)');
    next(); // boundNext() → middleware.next(undefined, undefined) 호출됨!
  };

  middleware1(req, res, boundNext);
}

withoutClosure();

console.log('\n' + '='.repeat(60));
console.log('메모리 참조 시각화');
console.log('='.repeat(60) + '\n');

// ============================================
// 메모리 참조 시각화
// ============================================
function memoryVisualization() {
  console.log('📊 메모리 상태:');
  console.log(`
┌─────────────────────────────────────────┐
│ 힙(Heap) 메모리                         │
├─────────────────────────────────────────┤
│ 0x1234: { user: {} }         ← req 객체 │
│                                         │
│ nextFunction의 [[Scope]]:               │
│   ├─ req: 0x1234 참조                   │
│   ├─ res: 0x5678 참조                   │
│   └─ this: Middleware 인스턴스          │
└─────────────────────────────────────────┘

실행 흐름:
1️⃣ nextFunction 생성 시:
   → req(0x1234), res(0x5678)를 [[Scope]]에 저장

2️⃣ 미들웨어에서 req.user 수정:
   → 0x1234 주소의 객체를 수정
   → nextFunction의 [[Scope]]에 있는 req는 같은 0x1234를 참조!

3️⃣ next() 호출 시:
   → nextFunction이 [[Scope]]에서 req(0x1234), res(0x5678)를 가져옴
   → this.next(req, res) 호출
   → 수정된 req.user가 전달됨!
  `);
}

memoryVisualization();

console.log('\n' + '='.repeat(60));
console.log('실제 코드 흐름');
console.log('='.repeat(60) + '\n');

// ============================================
// 실제 코드 흐름 재현
// ============================================
type MiddlewareType = (req: any, res: any, next: any) => void;

class Middleware {
  private middlewares: Array<MiddlewareType> = [];
  private currentIndex = 0;

  use(middleware: MiddlewareType) {
    this.middlewares.push(middleware);
  }

  next(req: any, res: any, err?: any) {
    console.log(`\n🚀 next 메서드 호출 (index: ${this.currentIndex})`);
    console.log('   받은 req:', req);
    console.log('   받은 res:', res);

    if (this.currentIndex >= this.middlewares.length) {
      console.log('✅ 모든 미들웨어 완료!');
      return;
    }

    const currentMiddleware = this.middlewares[this.currentIndex];
    this.currentIndex++;

    console.log('\n📦 nextFunction 생성 중...');
    console.log('   이 시점의 req를 캡처:', req);
    console.log('   이 시점의 res를 캡처:', res);

    // 🔥 여기가 핵심!
    const nextFunction = (err?: any) => {
      console.log('\n   💡 nextFunction 내부에서:');
      console.log('      캡처된 req 사용:', req);
      console.log('      캡처된 res 사용:', res);
      this.next(req, res, err);
    };

    console.log('✅ nextFunction 생성 완료');
    console.log('   nextFunction.[[Scope]]에 저장된 변수들:');
    console.log('   - req:', req);
    console.log('   - res:', res);
    console.log('   - this:', 'Middleware 인스턴스');

    currentMiddleware(req, res, nextFunction);
  }

  excute(req: any, res: any) {
    this.currentIndex = 0;
    this.next(req, res);
  }
}

const chain = new Middleware();

chain.use((req, res, next) => {
  console.log('\n╔═══════════════════════════════════╗');
  console.log('║   미들웨어 1 실행                 ║');
  console.log('╚═══════════════════════════════════╝');
  console.log('받은 req:', req);
  console.log('받은 next 함수:', typeof next);

  console.log('\n🔧 req.user 수정 중...');
  req.user = { name: 'kim' };
  console.log('수정 후 req:', req);

  console.log('\n📞 next() 호출 (인자 없음!)');
  next();
});

chain.use((req, res, next) => {
  console.log('\n╔═══════════════════════════════════╗');
  console.log('║   미들웨어 2 실행                 ║');
  console.log('╚═══════════════════════════════════╝');
  console.log('받은 req:', req);
  console.log('🎉 req.user 값:', req.user);

  next();
});

console.log('╔═══════════════════════════════════╗');
console.log('║   체인 실행 시작                  ║');
console.log('╚═══════════════════════════════════╝');
chain.excute({ user: {} }, {});
