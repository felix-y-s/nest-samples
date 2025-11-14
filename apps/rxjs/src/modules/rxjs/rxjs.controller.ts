import { Controller, Get, Param } from '@nestjs/common';
import { RxjsService } from './rxjs.service';
import { Observable } from 'rxjs';
import { UserProfile } from './interfaces';

@Controller()
export class RxjsController {
  constructor(private readonly rxjsService: RxjsService) {}

  @Get()
  getHello(): string {
    return this.rxjsService.getHello();
  }

  @Get(':id/profile')
  getUserProfile(@Param('id') userId: string): Observable<UserProfile> {
    return this.rxjsService.getUserProfile(userId);
  }
}
