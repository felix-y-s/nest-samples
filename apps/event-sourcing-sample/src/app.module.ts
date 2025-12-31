import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { OrderModule } from './order/order.module';

@Module({
  imports: [
    CqrsModule, // CQRS 및 이벤트 소싱을 위한 모듈
    OrderModule,
  ],
})
export class AppModule {}
