import { Controller, Get } from '@nestjs/common';
import { GlobalExceptionFilterService } from './global-exception-filter.service';
import { UserDto } from '@app/shared';

@Controller()
export class GlobalExceptionFilterController {
  constructor(private readonly globalExceptionFilterService: GlobalExceptionFilterService) {}

  @Get()
  getHello(): string {
    return this.globalExceptionFilterService.getHello();
  }
  @Get('user')
  getUser(): UserDto {
    return {
      id: 1,
      name: 'John Doe',
    };
  }
}
