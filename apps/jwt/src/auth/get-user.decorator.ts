import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; //! JwtStrategy의 validate 메서드에서 반환된 사용자 정보(👍 AuthGuard('jwt')는 JwtStrategy에서 정의한 전략 이름을 참조)
  }
)