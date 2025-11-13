// ============================================
// req 변수 참조 추적 - 단계별 상세 분석
// ============================================

type MiddlewareType = (req: any, res: any, next: any) => void;

class Middleware {
  private middlewares: Array<MiddlewareType> = [];
  private currentIndex = 0;

  use(middleware: MiddlewareType) {
    this.middlewares.push(middleware);
  }

  // 🔍 이 메서드의 req 파라미터를 추적합니다
  next(req: any, res: any, err?: any) {
    // ============================================
    // 📌 STEP: next 메서드 시작
    // ============================================
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📍 next() 메서드 진입 (currentIndex: ${this.currentIndex})`);
    console.log(`${'='.repeat(60)}`);
    console.log(`🔍 이 시점의 req 파라미터:`, req);
    console.log(`   메모리 주소 (가정): 0x1234`);
    console.log(`   내용:`, JSON.stringify(req));

    if (err) {
      return this.errorHandler(err, req, res);
    }

    if (this.currentIndex >= this.middlewares.length) {
      console.log('\n✅ 모든 미들웨어 실행 완료!');
      return this.routeHandler(req, res);
    }

    const currentMiddleware = this.middlewares[this.currentIndex];
    this.currentIndex++;

    // ============================================
    // 🔥 핵심: nextFunction 생성 시점
    // ============================================
    console.log(`\n${'─'.repeat(60)}`);
    console.log('🔥 nextFunction 생성 중...');
    console.log(`${'─'.repeat(60)}`);
    console.log('📝 화살표 함수가 생성되는 순간:');
    console.log('   const nextFunction = (err?) => this.next(req, res, err)');
    console.log('');
    console.log('💾 JavaScript 엔진이 하는 일:');
    console.log('   1️⃣ 새로운 함수 객체 생성');
    console.log('   2️⃣ [[Scope]] 내부 슬롯에 외부 변수 저장:');
    console.log(`      - req: 0x1234 참조 저장 (현재 값: ${JSON.stringify(req)})`);
    console.log(`      - res: 0x5678 참조 저장`);
    console.log(`      - this: Middleware 인스턴스 참조 저장`);
    console.log('');
    console.log('⚠️  중요: req의 "값"이 아니라 "메모리 주소"를 저장!');
    console.log('   → 0x1234 주소의 객체가 변경되면 nextFunction도 변경된 값을 보게 됨');

    const nextFunction = (err?: any) => {
      // ============================================
      // 💡 nextFunction이 호출될 때
      // ============================================
      console.log(`\n${'─'.repeat(60)}`);
      console.log('💡 nextFunction() 호출됨!');
      console.log(`${'─'.repeat(60)}`);
      console.log('🔍 [[Scope]]에서 캡처된 변수 사용:');
      console.log(`   - req: 0x1234 주소를 참조`);
      console.log(`   - 현재 0x1234 주소의 객체 내용:`, JSON.stringify(req));
      console.log('');
      console.log('📞 this.next(req, res, err) 호출 준비');
      console.log(`   - req 파라미터로 전달할 값: 0x1234 주소 참조`);
      console.log(`   - 실제 객체 내용:`, JSON.stringify(req));

      this.next(req, res, err);
    };

    console.log(`\n${'─'.repeat(60)}`);
    console.log('🚀 미들웨어 실행 시작');
    console.log(`${'─'.repeat(60)}`);
    console.log('📤 미들웨어에 전달하는 인자들:');
    console.log(`   1. req: 0x1234 참조 (내용: ${JSON.stringify(req)})`);
    console.log(`   2. res: 0x5678 참조`);
    console.log(`   3. next: nextFunction (위에서 생성한 함수)`);

    try {
      currentMiddleware(req, res, nextFunction);
    } catch (error) {
      this.next(req, res, error);
    }
  }

  excute(req: any, res: any) {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                체인 실행 시작                              ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('🎬 excute() 호출됨');
    console.log(`   전달받은 req:`, req);
    console.log(`   메모리 주소 (가정): 0x1234`);
    console.log(`   내용:`, JSON.stringify(req));
    console.log('');
    console.log('📞 this.next(req, res) 호출 예정');

    this.currentIndex = 0;
    this.next(req, res);
  }

  errorHandler(err: any, req, res) {
    console.error('\n❌ 에러 발생:', err);
  }

  routeHandler(req: any, res: any) {
    console.log('\n✅ [routeHandler] 최종 req:', JSON.stringify(req));
  }
}

// ============================================
// 테스트 실행
// ============================================

const chain = new Middleware();

// 미들웨어 1 등록
chain.use((req, res, next) => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║               미들웨어 1 실행                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('📥 미들웨어1이 받은 파라미터들:');
  console.log(`   - req: 0x1234 참조 (내용: ${JSON.stringify(req)})`);
  console.log(`   - res: 0x5678 참조`);
  console.log(`   - next: nextFunction (함수)`);
  console.log('');

  console.log('🔧 req 객체 수정 시작...');
  console.log(`   이전 값: ${JSON.stringify(req)}`);

  req.user = { name: 'kim' };

  console.log(`   이후 값: ${JSON.stringify(req)}`);
  console.log('');
  console.log('💡 중요한 점:');
  console.log('   - 0x1234 주소의 객체를 직접 수정함');
  console.log('   - nextFunction의 [[Scope]]에 저장된 req도 0x1234를 참조');
  console.log('   - 따라서 nextFunction이 나중에 호출되면 수정된 값을 보게 됨!');
  console.log('');

  console.log('📞 next() 호출 (인자 없음!)');
  console.log('   → nextFunction() 실행');
  console.log('   → nextFunction 내부에서 [[Scope]]의 req(0x1234) 사용');
  next();

  console.log('\n🔙 미들웨어1로 돌아옴 (next() 이후)');
});

// 미들웨어 2 등록
chain.use((req, res, next) => {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║               미들웨어 2 실행                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('📥 미들웨어2가 받은 파라미터들:');
  console.log(`   - req: 0x1234 참조 (내용: ${JSON.stringify(req)})`);
  console.log(`   - res: 0x5678 참조`);
  console.log(`   - next: nextFunction (함수)`);
  console.log('');

  console.log('🎉 req.user 확인:');
  console.log(`   값: ${JSON.stringify(req.user)}`);
  console.log('');
  console.log('✅ 성공! 미들웨어1에서 추가한 req.user가 전달되었습니다!');
  console.log('');

  console.log('📞 next() 호출');
  next();
});

// 실행
console.log('\n\n');
console.log('█'.repeat(64));
console.log('  req 변수 참조 추적 - 실행 시작');
console.log('█'.repeat(64));

chain.excute({ user: {} }, {});

// ============================================
// 요약 정리
// ============================================
console.log('\n\n');
console.log('█'.repeat(64));
console.log('  요약: req 변수가 참조하는 것');
console.log('█'.repeat(64));
console.log(`
📝 흐름 정리:

1️⃣ chain.excute({ user: {} }, {})
   → req = 0x1234 주소의 { user: {} } 객체

2️⃣ next(req, res) 호출
   → next 메서드의 req 파라미터 = 0x1234 참조

3️⃣ nextFunction 생성
   → nextFunction.[[Scope]].req = 0x1234 참조 저장

4️⃣ 미들웨어1 실행
   → 미들웨어1의 req 파라미터 = 0x1234 참조
   → req.user = { name: 'kim' } 실행
   → 0x1234 주소의 객체가 { user: { name: 'kim' } }로 변경됨

5️⃣ 미들웨어1에서 next() 호출
   → nextFunction() 실행
   → [[Scope]].req (0x1234) 사용
   → this.next(0x1234, res) 호출
   → 0x1234 주소의 객체는 이미 { user: { name: 'kim' } }

6️⃣ next 메서드 재진입
   → next 메서드의 req 파라미터 = 0x1234 참조
   → 0x1234의 내용 = { user: { name: 'kim' } }

7️⃣ 새로운 nextFunction 생성 (미들웨어2용)
   → nextFunction.[[Scope]].req = 0x1234 참조 저장

8️⃣ 미들웨어2 실행
   → 미들웨어2의 req 파라미터 = 0x1234 참조
   → req.user 접근 → { name: 'kim' } 출력됨!

🎯 핵심:
   모든 단계에서 req는 "0x1234 주소"를 참조합니다!
   값을 복사하는 게 아니라 "같은 메모리 위치"를 가리킵니다.
   따라서 한 곳에서 수정하면 모든 곳에서 변경된 값을 보게 됩니다.
`);
