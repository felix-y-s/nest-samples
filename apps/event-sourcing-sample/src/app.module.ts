import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { OrderModule } from './order/order.module';
import { EventStoreModule } from './shared/event-store/event-store.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    CqrsModule, // CQRS 및 이벤트 소싱을 위한 모듈
    EventStoreModule, // 중앙 집중형 이벤트 스토어
    OrderModule,
    PaymentModule,
  ],
})
export class AppModule {}
