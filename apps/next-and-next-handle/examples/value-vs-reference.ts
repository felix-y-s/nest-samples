// ============================================
// JavaScript 값 전달 vs 참조 전달
// ============================================

console.log('\n' + '='.repeat(70));
console.log('JavaScript의 매개변수 전달 방식');
console.log('='.repeat(70));

console.log(`
📌 핵심 개념:
   JavaScript는 항상 "값으로 전달(Pass by Value)"합니다.
   하지만 객체의 경우, 전달되는 "값"이 "메모리 주소(참조)"입니다!
`);

// ============================================
// 1. 원시 타입 (Primitive Types) - 값 복사
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('1️⃣ 원시 타입 (Primitive Types) - 값이 복사됨');
console.log('─'.repeat(70));

console.log('\n📝 원시 타입 종류:');
console.log('   - number (숫자)');
console.log('   - string (문자열)');
console.log('   - boolean (불리언)');
console.log('   - undefined');
console.log('   - null');
console.log('   - symbol');
console.log('   - bigint');

console.log('\n🔍 예제 1: 숫자 (number)');
function modifyNumber(num: number) {
  console.log('   함수 내부 - 받은 num:', num);
  num = 999;
  console.log('   함수 내부 - 수정 후 num:', num);
}

let myNum = 5;
console.log('   함수 호출 전 myNum:', myNum);
modifyNumber(myNum);
console.log('   함수 호출 후 myNum:', myNum);
console.log('   ✅ myNum은 변하지 않음! (값이 복사되었기 때문)');

console.log('\n🔍 예제 2: 문자열 (string)');
function modifyString(str: string) {
  console.log('   함수 내부 - 받은 str:', str);
  str = 'changed';
  console.log('   함수 내부 - 수정 후 str:', str);
}

let myStr = 'original';
console.log('   함수 호출 전 myStr:', myStr);
modifyString(myStr);
console.log('   함수 호출 후 myStr:', myStr);
console.log('   ✅ myStr은 변하지 않음! (값이 복사되었기 때문)');

console.log('\n💡 왜 그럴까?');
console.log(`
   메모리 구조:

   ┌─────────────────────────┐
   │ 스택 메모리             │
   ├─────────────────────────┤
   │ myNum: 5                │ ← 원본 변수
   │ num: 5 (복사본)         │ ← 함수 파라미터 (독립적인 복사본)
   └─────────────────────────┘

   함수에 전달할 때:
   1. myNum의 값(5)을 복사
   2. num이라는 새로운 변수에 저장
   3. num을 수정해도 myNum과는 완전히 별개!
`);

// ============================================
// 2. 참조 타입 (Reference Types) - 참조 복사
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('2️⃣ 참조 타입 (Reference Types) - 참조(주소)가 복사됨');
console.log('─'.repeat(70));

console.log('\n📝 참조 타입 종류:');
console.log('   - object (객체)');
console.log('   - array (배열)');
console.log('   - function (함수)');
console.log('   - Date, RegExp 등 모든 객체');

console.log('\n🔍 예제 3: 객체 (object) - 속성 수정');
function modifyObject(obj: any) {
  console.log('   함수 내부 - 받은 obj:', obj);
  console.log('   함수 내부 - obj의 메모리 주소: 0x1234 (가정)');

  obj.name = 'changed';

  console.log('   함수 내부 - 수정 후 obj:', obj);
  console.log('   함수 내부 - 여전히 0x1234 주소의 객체를 수정함');
}

let myObj = { name: 'original' };
console.log('   함수 호출 전 myObj:', myObj);
console.log('   myObj의 메모리 주소: 0x1234 (가정)');
modifyObject(myObj);
console.log('   함수 호출 후 myObj:', myObj);
console.log('   ❌ myObj가 변했다! (같은 메모리 주소를 참조하기 때문)');

console.log('\n💡 왜 그럴까?');
console.log(`
   메모리 구조:

   ┌─────────────────────────┐     ┌─────────────────────────┐
   │ 스택 메모리             │     │ 힙 메모리               │
   ├─────────────────────────┤     ├─────────────────────────┤
   │ myObj: 0x1234 ─────────────→ │ 0x1234:                 │
   │ obj: 0x1234 ───────────────→ │   { name: 'changed' }   │
   └─────────────────────────┘     └─────────────────────────┘

   함수에 전달할 때:
   1. myObj의 값(0x1234 주소)을 복사
   2. obj라는 새로운 변수에 0x1234 저장
   3. obj도 myObj도 같은 0x1234를 가리킴!
   4. obj로 속성을 수정하면 0x1234의 객체가 변경됨
   5. myObj도 0x1234를 보고 있으므로 변경사항이 보임!
`);

console.log('\n🔍 예제 4: 객체 (object) - 재할당');
function reassignObject(obj: any) {
  console.log('   함수 내부 - 받은 obj:', obj);
  console.log('   함수 내부 - obj의 메모리 주소: 0x1234 (가정)');

  obj = { name: 'completely new' };  // 새로운 객체 할당!

  console.log('   함수 내부 - 재할당 후 obj:', obj);
  console.log('   함수 내부 - obj의 새 메모리 주소: 0x9999 (가정)');
}

let myObj2 = { name: 'original' };
console.log('   함수 호출 전 myObj2:', myObj2);
console.log('   myObj2의 메모리 주소: 0x1234 (가정)');
reassignObject(myObj2);
console.log('   함수 호출 후 myObj2:', myObj2);
console.log('   ✅ myObj2는 변하지 않음! (obj가 새 객체를 가리키게 되었기 때문)');

console.log('\n💡 왜 그럴까?');
console.log(`
   메모리 구조:

   처음:
   ┌─────────────────────────┐     ┌─────────────────────────┐
   │ 스택 메모리             │     │ 힙 메모리               │
   ├─────────────────────────┤     ├─────────────────────────┤
   │ myObj2: 0x1234 ────────────→ │ 0x1234:                 │
   │ obj: 0x1234 ───────────────→ │   { name: 'original' }  │
   └─────────────────────────┘     └─────────────────────────┘

   obj = { name: 'completely new' } 실행 후:
   ┌─────────────────────────┐     ┌─────────────────────────┐
   │ 스택 메모리             │     │ 힙 메모리               │
   ├─────────────────────────┤     ├─────────────────────────┤
   │ myObj2: 0x1234 ────────────→ │ 0x1234:                 │
   │                         │     │   { name: 'original' }  │
   │ obj: 0x9999 ───────────────→ │ 0x9999:                 │
   │                         │     │   { name: 'new' }       │
   └─────────────────────────┘     └─────────────────────────┘

   obj 변수만 새로운 주소(0x9999)를 가리키게 됨!
   myObj2는 여전히 0x1234를 가리킴!
`);

console.log('\n🔍 예제 5: 배열 (array)');
function modifyArray(arr: any[]) {
  console.log('   함수 내부 - 받은 arr:', arr);
  arr.push('new item');
  console.log('   함수 내부 - 수정 후 arr:', arr);
}

let myArr = ['item1', 'item2'];
console.log('   함수 호출 전 myArr:', myArr);
modifyArray(myArr);
console.log('   함수 호출 후 myArr:', myArr);
console.log('   ❌ myArr가 변했다! (배열도 객체이므로 참조가 전달됨)');

// ============================================
// 3. 비교: 원시 타입 vs 참조 타입
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('3️⃣ 비교: 원시 타입 vs 참조 타입');
console.log('─'.repeat(70));

console.log(`
┌─────────────────────────────────────────────────────────────────┐
│                    원시 타입 (Primitive)                        │
├─────────────────────────────────────────────────────────────────┤
│ 저장 위치: 스택 메모리                                          │
│ 전달 방식: 값 자체가 복사됨                                     │
│ 수정 영향: 원본에 영향 없음 ✅                                  │
│ 예시: number, string, boolean, undefined, null, symbol, bigint │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    참조 타입 (Reference)                        │
├─────────────────────────────────────────────────────────────────┤
│ 저장 위치: 힙 메모리 (실제 데이터), 스택 메모리 (주소)         │
│ 전달 방식: 메모리 주소(참조)가 복사됨                          │
│ 수정 영향: 원본에 영향 있음 ❌ (속성 수정 시)                   │
│           원본에 영향 없음 ✅ (재할당 시)                       │
│ 예시: object, array, function, Date, RegExp 등                 │
└─────────────────────────────────────────────────────────────────┘
`);

// ============================================
// 4. 실전 예제: Express 미들웨어
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('4️⃣ 실전 예제: Express 미들웨어에서 req가 전달되는 방식');
console.log('─'.repeat(70));

console.log('\n📝 상황:');
console.log('   req는 객체(object)입니다!');
console.log('   따라서 참조(메모리 주소)가 전달됩니다.');

function simulateMiddleware() {
  const req = { user: {} };  // 0x1234 주소라고 가정

  console.log('\n🎬 시작:');
  console.log('   req 생성:', req);
  console.log('   메모리 주소: 0x1234 (가정)');

  // nextFunction 생성
  const nextFunction = () => {
    console.log('\n💡 nextFunction 호출:');
    console.log('   캡처된 req (0x1234):', req);
    middleware2(req);
  };

  console.log('\n📦 nextFunction 생성:');
  console.log('   [[Scope]].req = 0x1234 참조 저장');

  // 미들웨어1 실행
  middleware1(req, nextFunction);
}

function middleware1(req: any, next: any) {
  console.log('\n🔵 미들웨어1 실행:');
  console.log('   받은 req (0x1234):', req);

  // 속성 수정 (0x1234 주소의 객체 수정)
  req.user = { name: 'kim' };

  console.log('   수정 후 req:', req);
  console.log('   0x1234 주소의 객체가 변경됨!');

  console.log('\n📞 next() 호출:');
  next();
}

function middleware2(req: any) {
  console.log('\n🟢 미들웨어2 실행:');
  console.log('   받은 req (0x1234):', req);
  console.log('   req.user:', req.user);
  console.log('   ✅ 미들웨어1의 수정사항이 전달됨!');
}

simulateMiddleware();

// ============================================
// 5. 주의사항과 팁
// ============================================
console.log('\n' + '─'.repeat(70));
console.log('5️⃣ 주의사항과 팁');
console.log('─'.repeat(70));

console.log(`
⚠️  주의사항:

1. 객체 속성 수정 vs 재할당의 차이
   obj.name = 'changed'   ← 원본 객체 수정 (영향 있음)
   obj = { name: 'new' }  ← 새 객체 할당 (영향 없음)

2. 배열도 객체다
   arr.push()   ← 원본 배열 수정 (영향 있음)
   arr = []     ← 새 배열 할당 (영향 없음)

3. 중첩 객체도 참조
   const obj = { nested: { value: 1 } };
   function modify(o) {
     o.nested.value = 2;  ← 원본의 nested 객체 수정 (영향 있음)
   }

💡 팁:

1. 객체를 복사하고 싶다면:
   const copy = { ...obj };           // 얕은 복사
   const deepCopy = JSON.parse(JSON.stringify(obj));  // 깊은 복사

2. 원본을 보호하고 싶다면:
   Object.freeze(obj);  // 객체를 불변으로 만듦

3. 클로저에서 참조를 캡처하면:
   const captured = obj;  // 주소를 캡처
   obj를 수정하면 captured도 변경된 값을 보게 됨!
`);

// ============================================
// 최종 요약
// ============================================
console.log('\n' + '='.repeat(70));
console.log('🎯 최종 요약');
console.log('='.repeat(70));

console.log(`
JavaScript는 항상 "값으로 전달"하지만:

✅ 원시 타입: 값 자체가 복사됨
   → 함수 내부에서 수정해도 원본에 영향 없음

❌ 참조 타입: 메모리 주소가 복사됨
   → 함수 내부에서 속성을 수정하면 원본에 영향 있음!
   → 하지만 재할당하면 원본에 영향 없음

🔑 핵심:
   "무엇이 복사되는가?"
   - 원시 타입: 값 자체
   - 참조 타입: 메모리 주소 (포인터)

🎓 Express 미들웨어에서:
   req는 객체 → 주소가 전달 → 속성 수정 시 모든 곳에서 변경사항 보임!
`);
