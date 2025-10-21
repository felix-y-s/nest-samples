## `useGlobalFilters` 핵심 키워드 요약

- **전역 예외 처리**: 애플리케이션 전체에 걸쳐 예외를 중앙화된 방식으로 관리.
- **예외 필터**: `ExceptionFilter`를 구현해 특정 예외(`HttpException`, 커스텀 예외 등) 처리.
- **일관된 응답**: 에러 응답 형식을 표준화하여 클라이언트 경험 개선.
- **코드 중복 감소**: 각 컨트롤러/메서드별 예외 처리 로직 반복 제거.
- **커스텀 필터**: 예외 외에 요청/응답 조작(예: 로깅, 헤더 추가) 가능.
- **등록 방식**: `main.ts`에서 `app.useGlobalFilters`로 인스턴스화 또는 `APP_FILTER`로 모듈 제공.
- **의존성 주입**: `APP_FILTER` 사용 시 의존성 주입 가능, `new` 인스턴스화 시 제한.
- **필터 우선순위**: 여러 필터 등록 시 순서대로 실행, 특정 예외 필터가 우선.
- **제한점**: 주로 예외 처리용, 요청 전처리는 미들웨어/인터셉터 권장.
- **활용 사례**: HTTP 에러 처리, 커스텀 예외 관리, 로깅, 응답 헤더 추가.


## 주의사항
- 필터 우선순위: 여러 전역 필터를 등록하면 등록 순서대로 실행. 특정 예외를 처리하는 필터가 먼저 와야 함.
- 제한: useGlobalFilters는 주로 예외 필터를 위해 설계됨. 요청 전처리(예: 인증)는 미들웨어(useGlobalPipes, useGlobalInterceptors)가 더 적합할 수 있음.
- 의존성 주입: 전역 필터를 new로 인스턴스화하면 의존성 주입이 불가능. 의존성 주입이 필요하면 모듈에서 제공:

**의존성 주입(LoggerService) 예**
HttpExceptionFilter 클래스에서 LoggerService 클래스를 이용해 로깅, 디비 저장 등의 작업 진행 가능하다.
```ts
// src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { LoggerService } from './services/logger.service';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  providers: [
    LoggerService,
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
```