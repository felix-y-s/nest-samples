import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PaymentStartedHandler } from './events/handlers/payment-started.handler';
import { PaymentSuccessedHandler } from './events/handlers/payment-successed.handler';
import { OrderRepository } from '@order/repositories/order.repository';
import { PaymentRepository } from './repositories/payment.repository';
import { MockModule } from '@/mocks/mock.module';
import { PaymentProcessingHandler } from './events/handlers/payment-processing.handler';
import { PaymentFailedHandler } from './events/handlers/payment-failed.handler';

@Module({
  imports: [CqrsModule, MockModule],
  providers: [
    // 리포지토리
    PaymentRepository,
    OrderRepository,
    // 이벤트 핸들러
    PaymentStartedHandler,
    PaymentProcessingHandler,
    PaymentSuccessedHandler,
    PaymentFailedHandler,
  ],
  exports: [PaymentRepository],
})
export class PaymentModule {}