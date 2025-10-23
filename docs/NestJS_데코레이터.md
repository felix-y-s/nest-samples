```mermaid

sequenceDiagram
    participant 클라이언트
    participant 앱 as NestJS 앱
    participant Module as @Module<br/>@Global
    participant ControllerDeco as @Controller<br/>@UseInterceptors<br/>@UseFilters
    participant MethodDeco as @Get/@Post<br/>@UseGuards<br/>@UsePipes<br/>@UseInterceptors
    participant Middleware
    participant Guards
    participant Interceptors as Interceptors<br/>(Pre)
    participant Pipes
    participant 컨트롤러
    participant 서비스
    participant InterceptorsPost as Interceptors<br/>(Post)
    participant ExceptionFilters as Exception<br/>Filters
    participant 최종응답

    Note over Module,MethodDeco: 📌 데코레이터 설정 단계

    rect rgb(80, 70, 100)
    note over Module: 모듈 레벨 데코레이터
    Module->>Module: @Global (전역 Exception Filters)
    Module->>Module: @Module (Providers)
    end

    rect rgb(80, 70, 100)
    note over ControllerDeco: 클래스 레벨 데코레이터
    ControllerDeco->>ControllerDeco: @Controller('/users')<br/>@UseInterceptors(LoggingInterceptor)<br/>@UseFilters(ExceptionFilter)
    end

    rect rgb(80, 70, 100)
    note over MethodDeco: 메서드 레벨 데코레이터
    MethodDeco->>MethodDeco: @Get(':id')<br/>@UseGuards(AuthGuard)<br/>@UsePipes(ValidationPipe)<br/>@UseInterceptors(CustomInterceptor)
    end

    Note over 클라이언트,최종응답: 🔄 런타임 요청 처리 흐름

    클라이언트->>앱: HTTP 요청<br/>(GET /users/:id)
    
    rect rgb(60, 90, 120)
    note over 앱: ① Middleware 단계
    앱->>Middleware: Middleware 실행
    note over Middleware: main.ts에서<br/>app.use() 등록
    Middleware->>Middleware: 로깅, CORS 등 처리
    opt Middleware에서 예외 발생
        Middleware->>ExceptionFilters: 예외 발생
    end
    Middleware-->>앱: next() 호출
    end

    rect rgb(60, 90, 120)
    note over 앱: ② Guards 단계<br/>(@UseGuards 데코레이터 적용)
    앱->>Guards: @UseGuards(AuthGuard) 실행
    Guards->>Guards: 인증/인가 확인
    alt Guards 통과 ✓
        Guards-->>앱: true 반환
    else Guards 실패 ✗
        Guards->>ExceptionFilters: UnauthorizedException
    end
    end

    rect rgb(60, 90, 120)
    note over 앱: ③ Interceptors (요청 사전처리)<br/>(@UseInterceptors 데코레이터 적용)
    앱->>Interceptors: @UseInterceptors() 진입
    Interceptors->>Interceptors: 요청 로깅, 변환 등
    opt Interceptors에서 예외 발생
        Interceptors->>ExceptionFilters: 예외 발생
    end
    Interceptors-->>앱: next.handle() 진행
    end

    rect rgb(60, 90, 120)
    note over 앱: ④ Pipes 단계<br/>(@UsePipes 데코레이터 적용)
    앱->>Pipes: @UsePipes(ValidationPipe) 실행
    Pipes->>Pipes: 데이터 변환/검증<br/>(@Param('id'), @Query 등)
    opt Pipes에서 검증 실패
        Pipes->>ExceptionFilters: BadRequestException
    end
    Pipes-->>앱: 검증된 데이터 전달
    end

    rect rgb(60, 90, 120)
    note over 앱: ⑤ Controller 단계<br/>(@Controller 데코레이터)
    앱->>컨트롤러: @Get(':id') 라우트 핸들러 실행
    note over 컨트롤러: @Controller('/users')<br/>클래스 레벨 데코레이터<br/>적용됨
    opt Controller에서 예외 발생
        컨트롤러->>ExceptionFilters: 예외 발생
    end
    컨트롤러->>서비스: 비즈니스 로직 호출
    end

    rect rgb(60, 90, 120)
    note over 서비스: ⑥ Service 단계
    서비스->>서비스: DB 조회, 로직 처리
    opt Service에서 예외 발생
        서비스->>ExceptionFilters: 예외 발생
    end
    서비스-->>컨트롤러: 데이터 반환
    end

    rect rgb(60, 90, 120)
    note over 앱: ⑦ Interceptors (응답 사후처리)<br/>(@UseInterceptors 데코레이터 적용)
    컨트롤러-->>InterceptorsPost: 응답 데이터
    InterceptorsPost->>InterceptorsPost: 응답 변환, 로깅 등
    opt Interceptors에서 예외 발생
        InterceptorsPost->>ExceptionFilters: 예외 발생
    end
    InterceptorsPost-->>앱: 최종 응답 데이터
    end

    rect rgb(100, 80, 60)
    note over ExceptionFilters: 예외 처리 통합<br/>(@UseFilters / @Catch 데코레이터)
    ExceptionFilters->>ExceptionFilters: 예외 타입별 처리<br/>(상태코드, 메시지 등)
    ExceptionFilters-->>최종응답: 에러 응답 반환
    end

    alt 정상 처리
        앱-->>최종응답: HTTP 응답<br/>(200, 데이터)
    else 예외 발생
        최종응답-->>클라이언트: HTTP 에러<br/>(400, 401, 403, 500 등)
    end

    최종응답-->>클라이언트: 최종 응답 전송
```

---

## 📌 데코레이터 적용 가이드

### **모듈 레벨 데코레이터**

```typescript
@Global()  // 전역 범위로 설정
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,  // 모든 요청에 적용
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: GlobalLoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: GlobalAuthGuard,
    },
  ],
})
export class AppModule {}
```

### **클래스 레벨 데코레이터**

```typescript
@UseFilters(ExceptionFilter)  // 이 컨트롤러의 모든 라우트
@UseInterceptors(LoggingInterceptor)  // 이 컨트롤러의 모든 라우트
@Controller('users')
export class UsersController {
  // ...
}
```

### **메서드 레벨 데코레이터**

```typescript
@UseGuards(AuthGuard)  // 이 메서드만
@UsePipes(new ValidationPipe())  // 이 메서드만
@UseInterceptors(CustomInterceptor)  // 이 메서드만
@Get(':id')
async getUser(@Param('id') id: string) {
  return this.usersService.findById(id);
}
```

---

## 🔗 데코레이터 적용 범위 (우선순위 역순)

| 적용 범위 | 우선순위 | 설명 |
|---------|---------|------|
| **메서드** | 1순위 (높음) | 가장 구체적, 해당 메서드에만 적용 |
| **클래스** | 2순위 | 해당 컨트롤러의 모든 메서드에 적용 |
| **모듈** | 3순위 | 전역(@Global) 또는 제한된 범위 |

---

## 💡 실전 완전 예제

```typescript
// =========== app.module.ts ===========
@Global()
@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,  // 모든 요청의 예외 처리
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: GlobalLoggingInterceptor,
    },
  ],
})
export class AppModule {}

// =========== users.controller.ts ===========
@UseFilters(CustomExceptionFilter)  // 클래스 레벨
@UseInterceptors(TransformInterceptor)  // 클래스 레벨
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get(':id')
  @UseGuards(AuthGuard)  // 메서드 레벨 - 인증 검사
  @UsePipes(new ValidationPipe())  // 메서드 레벨 - 데이터 검증
  @UseInterceptors(CacheInterceptor)  // 메서드 레벨 - 캐싱
  async getUser(@Param('id') id: string) {
    // 실행 순서:
    // 1. Global Guards (모듈 레벨)
    // 2. @UseGuards(AuthGuard) - 메서드 레벨
    // 3. Global Interceptors Pre
    // 4. @UseInterceptors(CacheInterceptor) - 메서드 레벨 Pre
    // 5. @UsePipes(ValidationPipe) - 메서드 레벨
    // 6. Controller 메서드 실행
    // 7. Service 로직
    // 8. @UseInterceptors(CacheInterceptor) - 메서드 레벨 Post
    // 9. Global Interceptors Post
    
    return this.usersService.findById(id);
  }
}

// =========== global-exception.filter.ts ===========
@Catch()  // 모든 예외 처리
@Injectable()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: Exception, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : 500;
    
    response.status(status).json({
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## 🎯 데코레이터 적용 우선순위

```
모듈 레벨 데코레이터 (가장 먼저 적용)
    ↓
클래스 레벨 데코레이터
    ↓
메서드 레벨 데코레이터 (가장 나중에 적용, 가장 높은 우선순위)
```
