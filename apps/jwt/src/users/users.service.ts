import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private users = [
    {
      id: 'testUser',
      email: 'test@example.com',
      password: '$2b$10$BvTGtU57AAeP3SdaQD9hyeC8cMztUFWDFrihvm.XEdIPi0/juLv5u', // 비밀번호: "password"
    },
  ];

  async findByEmail(email: string): Promise<any> {
    return this.users.find((user) => user.email === email);
  }

  async createUser(email: string, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { id: this.users.length + 1, email, password: hashedPassword };
    this.users.push(user);
    return user;
  }
}
