import { Injectable } from '@nestjs/common';

@Injectable()
export class GlobalExceptionFilterService {
  getHello(): string {
    return 'Hello World!';
  }
}
