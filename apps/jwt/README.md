## keyword
```ts 
import { AuthGuard } from '@nestjs/passport';
@UseGuards(AuthGuard('custom-jwt'))
```
검사할 엔드포인트(클래스, 함수)에 데코레이터 적용, `'custom-jwt'`는 `JwtStrategy`에서 사용된 전략 이름

```ts
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
export class JwtStrategy extends PassportStrategy(Strategy, 'custom-jwt')
```
`JwtStrategy`를 적용할 모듈의 providers로 포함시켜야 함

```ts
import { GetUser } from './get-user.decorator';
@GetUser()
```
Param 데코레이터로 위 `JwtStrategy` 클래스의 `validate` 함수를 통해 검증된 토큰값 받아옴

## 모듈 정의
```ts
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    JwtModule.register({
      secret: 'secretKey', // 🚨 프로덕션에서는 환경 변수로 대체
      signOptions: { expiresIn: '1h' },
    }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
```

## 프로세스

### 토큰 발급
- `POST /auth/login`
- `jwtService.sign(payload)`
  - jwtService는 JwtModule.register()에서 정의한 secretKey를 사용하여 토큰을 생성
```ts
JwtModule.register({
      secret: 'secretKey', // 🚨 프로덕션에서는 환경 변수로 대체
      signOptions: { expiresIn: '1h' },
    }),
```

### 토큰 검증
- `AuthGuard('custom-jwt')`
- JwtStrategy에 의해 검증
```ts
@Module({
  ...
  controllers: [AuthController],
  providers: [JwtStrategy],
})
```

### 토큰 갱신
- ❌ auth 앱에서 다룰 예정

## JwtStrategy
```ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'custom-jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'secretKey', // 프로덕션에서는 환경 변수로 대체
    });
  }

  async validate(payload: any): Promise<any> {
    return { userId: payload.sub, username: payload.username };
  }
}
```

## AuthGuard의 데이터 가져오기
```ts
export const GetUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // JwtStrategy의 🔑validate 메서드에서 반환된 사용자 정보
  }
)
```