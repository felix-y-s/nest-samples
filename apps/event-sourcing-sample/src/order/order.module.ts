import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { OrderController } from './order.controller';
import { EventStoreService } from './services/event-store.service';

// 커맨드 핸들러
import { CreateOrderHandler, ProcessPaymentHandler } from './handlers';

// 쿼리 핸들러
import {
  GetOrderStatusHandler,
  GetOrderHistoryHandler,
} from './queries/handlers';

/**
 * 주문 모듈
 * - 이벤트 소싱 패턴을 적용한 주문 관리 모듈
 */
@Module({
  imports: [CqrsModule],
  controllers: [OrderController],
  providers: [
    // 서비스
    EventStoreService,

    // 커맨드 핸들러
    CreateOrderHandler,
    ProcessPaymentHandler,

    // 쿼리 핸들러
    GetOrderStatusHandler,
    GetOrderHistoryHandler,
  ],
  exports: [EventStoreService],
})
export class OrderModule {}
