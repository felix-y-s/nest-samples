import { Injectable } from '@nestjs/common';

@Injectable()
export class RxjsService {
  constructor() {}
  getHello(): string {
    return 'Hello World!';
  }  
}
