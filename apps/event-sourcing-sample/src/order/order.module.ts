import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { OrderController } from './order.controller';
import { OrderRepository } from './repositories/order.repository';
import { HighValueOrderRepository } from './repositories/high-value-order.repository';

// 커맨드 핸들러
import { CreateOrderHandler, ProcessPaymentHandler } from './commands/handlers';
import { OrderCreatedHandler } from './events/handlers/order-created.handler';

// 쿼리 핸들러
import {
  GetOrderStatusHandler,
  GetOrderHistoryHandler,
  GetHighValueOrderHandler,
} from './queries/handlers';

// ... (imports)

@Module({
  imports: [CqrsModule],
  controllers: [OrderController],
  providers: [
    // 리포지토리
    OrderRepository,
    HighValueOrderRepository,

    // 커맨드 핸들러
    CreateOrderHandler,
    ProcessPaymentHandler,

    // 이벤트 핸들러
    OrderCreatedHandler,

    // 쿼리 핸들러
    GetOrderStatusHandler,
    GetOrderHistoryHandler,
    GetHighValueOrderHandler,
  ],
  exports: [OrderRepository],
})
export class OrderModule {}
