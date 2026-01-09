import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PaymentGateway } from './mocks';
import { PaymentStartedHandler } from './events/handlers/payment-started.handler';
import { PaymentSuccessedHandler } from './events/handlers/payment-successed.handler';
import { OrderRepository } from '@order/repositories/order.repository';
import { PaymentRepository } from './repositories/payment.repository';

@Module({
  imports: [CqrsModule],
  providers: [
    // 리포지토리
    PaymentRepository,
    OrderRepository,
    // 이벤트 핸들러
    PaymentStartedHandler,
    PaymentSuccessedHandler,
    // 테스트용 모듈
    PaymentGateway,
  ],
  exports: [PaymentRepository],
})
export class PaymentModule {}