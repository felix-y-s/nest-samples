import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'nada') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'secretKey', // 프로덕션에서는 환경 변수로 대체
    });
  }

  async validate(payload: any): Promise<any> {
    console.log('🚀 | JwtStrategy | validate | payload:', payload);
    return { userId: payload.sub, username: payload.username };
  }
}