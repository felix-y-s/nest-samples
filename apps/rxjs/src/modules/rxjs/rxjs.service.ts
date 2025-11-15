import { Injectable } from '@nestjs/common';

@Injectable()
export class RxjsService {
  constructor() {}
  getHello() {
    console.log('🚀 | RxjsService | getHello | getHello:');
    return {a:'Hello World!'};
  }
}
