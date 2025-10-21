import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { Role } from './enums/role.enum';

@Controller()
export class AppController {
  constructor(private readonly quardService: AppService) {}

  @Get()
  getHello(): string {
    return 'AAAA'; //this.quardService.getHello();
  }

  @Post('admin')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  getAdminData() {
    return { message: '관리자 전용 데이터' };
  }

  @Get('user')
  @UseGuards(RolesGuard)
  @Roles(Role.USER)
  getUserData() {
    return { message: '사용자 데이터' };
  }
}
