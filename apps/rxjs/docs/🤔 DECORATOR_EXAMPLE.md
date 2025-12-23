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

## 7. Parameter Decorator (@Param, @Body, @Query 등)

### NestJS Parameter Decorator의 동작 원리

```typescript
// NestJS가 제공하는 Parameter Decorator 예시
export class UserController {
  @Get(':id')
  getUser(
    @Param('id') id: string,           // 1. URL 파라미터
    @Query('search') search: string,   // 2. 쿼리 스트링
    @Body() body: CreateUserDto,       // 3. Request Body
    @Headers('authorization') auth: string, // 4. HTTP 헤더
    @Req() request: Request            // 5. 전체 Request 객체
  ) {
    return { id, search, body, auth };
  }
}
```

### Parameter Decorator 실행 순서

```typescript
// 실제 동작 원리 시뮬레이션

function Param(paramName?: string) {
  return function (target: any, propertyKey: string, parameterIndex: number) {
    console.log('Param Decorator 실행');
    console.log('  - target:', target.constructor.name);      // "UserController"
    console.log('  - propertyKey:', propertyKey);             // "getUser"
    console.log('  - parameterIndex:', parameterIndex);       // 0 (첫 번째 파라미터)
    console.log('  - paramName:', paramName);                 // "id"

    // NestJS는 이 정보를 메타데이터에 저장
    Reflect.defineMetadata(
      'params',
      { index: parameterIndex, name: paramName, type: 'param' },
      target,
      propertyKey
    );
  };
}
```

### 실행 흐름 시각화

```
HTTP 요청: GET /users/123?search=john

  ↓

1. NestJS Router가 요청을 받음

  ↓

2. 메타데이터 조회
   - Reflect.getMetadata('params', UserController, 'getUser')
   - 결과: [
       { index: 0, name: 'id', type: 'param' },
       { index: 1, name: 'search', type: 'query' },
       { index: 2, type: 'body' },
       ...
     ]

  ↓

3. 파라미터 추출 및 변환
   - params[0] = request.params.id        → "123"
   - params[1] = request.query.search     → "john"
   - params[2] = request.body             → { ... }

  ↓

4. 메서드 호출
   controller.getUser("123", "john", {...}, ...)

  ↓

5. 응답 반환
```

### 모든 Parameter Decorator 종류

```typescript
@Controller('users')
export class UserController {
  @Post()
  createUser(
    // 1. HTTP 요청 관련
    @Body() body: CreateUserDto,                    // Request Body 전체
    @Body('email') email: string,                   // Body의 특정 필드
    @Param('id') id: string,                        // URL 파라미터 (/users/:id)
    @Query('page') page: number,                    // 쿼리 스트링 (?page=1)
    @Headers('authorization') auth: string,         // HTTP 헤더

    // 2. Request/Response 객체
    @Req() request: Request,                        // Express Request 전체
    @Res() response: Response,                      // Express Response 전체
    @Next() next: NextFunction,                     // Express Next 함수

    // 3. Session & Cookie
    @Session() session: Record<string, any>,        // 세션 데이터
    @Cookies('token') token: string,                // 특정 쿠키

    // 4. IP & Host
    @Ip() ip: string,                               // 클라이언트 IP
    @HostParam('subdomain') subdomain: string,      // 서브도메인

    // 5. 커스텀 데코레이터
    @User() user: UserEntity,                       // 커스텀 데코레이터
  ) {
    // ...
  }
}
```

### 커스텀 Parameter Decorator 만들기

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// 1. 간단한 커스텀 데코레이터
export const User = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // JWT Guard에서 설정한 user 객체
  },
);

// 사용
@Get('profile')
getProfile(@User() user: UserEntity) {
  return user;
}

// 2. 특정 필드만 추출하는 데코레이터
export const UserId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.id;
  },
);

// 사용
@Get('orders')
getOrders(@UserId() userId: number) {
  return this.orderService.findByUserId(userId);
}

// 3. 파라미터를 받는 커스텀 데코레이터
export const UserField = createParamDecorator(
  (fieldName: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user?.[fieldName];
  },
);

// 사용
@Get('info')
getInfo(
  @UserField('email') email: string,
  @UserField('name') name: string
) {
  return { email, name };
}
```

### Parameter Decorator 실행 시점

```typescript
// Parameter Decorator는 클래스 정의 시점에 실행됨!

console.log('1. 파일 로딩 시작');

export class UserController {
  @Get(':id')
  getUser(
    @Param('id') id: string  // ← 2. 여기서 Param Decorator 실행!
  ) {
    console.log('4. getUser 메서드 실행');
    return { id };
  }
}

console.log('3. 클래스 정의 완료');

// 실행 순서:
// 1. 파일 로딩 시작
// 2. @Param('id') 실행 → 메타데이터 저장
// 3. 클래스 정의 완료
// ... (HTTP 요청 대기)
// 4. getUser 메서드 실행 (메타데이터를 바탕으로 파라미터 주입)
```

### Parameter Decorator와 Pipe 조합

```typescript
import { ParseIntPipe, ValidationPipe } from '@nestjs/common';

@Controller('users')
export class UserController {
  @Get(':id')
  getUser(
    @Param('id', ParseIntPipe) id: number  // 문자열 → 숫자 변환
  ) {
    return this.userService.findById(id);
  }

  @Post()
  createUser(
    @Body(ValidationPipe) body: CreateUserDto  // DTO 유효성 검증
  ) {
    return this.userService.create(body);
  }
}

// Pipe 실행 순서:
// 1. @Param이 메타데이터 등록 (클래스 정의 시)
// 2. HTTP 요청 수신
// 3. request.params.id 추출 → "123"
// 4. ParseIntPipe 실행 → 123 (number)
// 5. getUser(123) 호출
```

### Parameter Decorator 내부 구현 (간략화)

```typescript
// NestJS의 실제 구현을 단순화한 버전

function Param(property?: string) {
  return (target: Object, propertyKey: string, parameterIndex: number) => {
    // 기존 메타데이터 가져오기
    const existingParams = Reflect.getMetadata('params', target, propertyKey) || [];

    // 새 파라미터 정보 추가
    existingParams.push({
      index: parameterIndex,
      property,
      type: 'param',
    });

    // 메타데이터 저장
    Reflect.defineMetadata('params', existingParams, target, propertyKey);
  };
}

// NestJS가 메서드 호출 시 하는 일:
function callControllerMethod(controller: any, methodName: string, request: any) {
  // 1. 메타데이터 조회
  const paramsMetadata = Reflect.getMetadata('params', controller, methodName) || [];

  // 2. 파라미터 배열 생성
  const args = [];
  paramsMetadata.forEach((param) => {
    if (param.type === 'param') {
      args[param.index] = request.params[param.property];
    } else if (param.type === 'query') {
      args[param.index] = request.query[param.property];
    } else if (param.type === 'body') {
      args[param.index] = request.body;
    }
    // ... 기타 타입 처리
  });

  // 3. 메서드 호출
  return controller[methodName](...args);
}
```

---

## 8. 실전 사용 시 고려사항

### 장점
- 반복 코드 제거
- 선언적(declarative) 방식
- **Parameter Decorator**: NestJS에서 필수, 표준 패턴

### 단점
1. **프로토타입 공유**: 모든 인스턴스가 같은 객체 참조
2. **디버깅 어려움**: logger가 어디서 왔는지 코드만으로 불명확
3. **IDE 지원 약함**: logger 정의로 점프 불가
4. **테스트 복잡**: Mock 설정 어려움

### Property/Method Decorator는 추천하지 않음

```typescript
// ❌ Property Decorator 방식
@WithLogger()
class Foo {
  private logger!: Logger;  // 어디서 왔는지 불명확
}

// ✅ 명시적 방식 (더 낫다!)
class Foo {
  private readonly logger = createLogger(Foo.name);  // 명확!
}
```

### Parameter Decorator는 NestJS 표준

```typescript
// ✅ Parameter Decorator는 필수이자 표준!
@Controller('users')
export class UserController {
  @Get(':id')
  getUser(@Param('id') id: string) {  // NestJS 표준 방식
    return this.userService.findById(id);
  }
}
```
