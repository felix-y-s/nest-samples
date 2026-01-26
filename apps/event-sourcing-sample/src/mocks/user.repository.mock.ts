import { Injectable } from '@nestjs/common';

@Injectable()
export class UserRepositoryMock {
  findUserById(userId: string) {
    return {
      userId: 'testuserid',
      age: 30,
      balance: 1300,
    }
  }
}