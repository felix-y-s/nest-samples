import { Controller, Get, NotFoundException } from '@nestjs/common';
import { UserNotFoundException } from './exceptions/user-not-found.exception';

@Controller()
export class AppController {

  @Get()
  getHello(): string {
    throw new NotFoundException('@리소스를 찾을 수 없습니다.');
  }
  @Get('user')
  getUser(): string {
    throw new UserNotFoundException();
  }
}
