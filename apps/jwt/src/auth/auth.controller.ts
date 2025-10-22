import { LoginDto } from '@app/shared/dto/login.dto';
import { Body, Controller, Get, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from './get-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('잘못된 자격 증명입니다.');
    }
    return this.authService.login(user);
  }

  @UseGuards(AuthGuard('nada')) // 'jwt'는 JwtStrategy에서 사용된 전략 이름
  @Get('profile')
  getProfile(@GetUser() user: any) {
    return { message: '보호된 프로필 데이터', user };
  }
}
