import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CreateOrderCommand, ProcessPaymentCommand } from './commands';
import {
  GetOrderStatusQuery,
  GetOrderHistoryQuery,
  GetHighValueOrderQuery,
} from './queries';
import { GetOrderStatusHandler } from './queries/handlers';

/**
 * 주문 생성 DTO
 */
export class CreateOrderDto {
  userId: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  discountRate: number;
}

/**
 * 결제 처리 DTO
 */
export class ProcessPaymentDto {
  userBalance: number;
}

/**
 * 주문 컨트롤러
 * - 주문 관련 HTTP API 제공
 */
@Controller('orders')
export class OrderController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  /**
   * 주문 생성
   * POST /orders
   */
  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
    try {
      // 주문 ID 생성
      const orderId = `ORDER-${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // CreateOrderCommand 발행
      await this.commandBus.execute(
        new CreateOrderCommand(
          orderId,
          dto.userId,
          dto.productId,
          dto.productName,
          dto.quantity,
          dto.price,
          dto.discountRate,
        ),
      );

      return {
        success: true,
        orderId,
        message: '주문이 생성되었습니다',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 결제 처리
   * POST /orders/:orderId/payment
   */
  @Post(':orderId/payment')
  async processPayment(
    @Param('orderId') orderId: string,
    @Body() dto: ProcessPaymentDto,
  ) {
    try {
      // ProcessPaymentCommand 발행
      await this.commandBus.execute(
        new ProcessPaymentCommand(orderId, dto.userBalance),
      );

      return {
        success: true,
        message: '결제 처리가 완료되었습니다',
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error.message,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 주문 상태 조회
   * GET /orders/:orderId/status
   */
  @Get(':orderId/status')
  async getOrderStatus(@Param('orderId') orderId: string) {
    const result = await this.queryBus.execute(
      new GetOrderStatusQuery(orderId),
    );

    if (!result) {
      throw new HttpException(
        {
          success: false,
          message: '주문을 찾을 수 없습니다',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 주문 이벤트 히스토리 조회
   * GET /orders/:orderId/history
   */
  @Get(':orderId/history')
  async getOrderHistory(@Param('orderId') orderId: string) {
    const result = await this.queryBus.execute(
      new GetOrderHistoryQuery(orderId),
    );

    if (!result) {
      throw new HttpException(
        {
          success: false,
          message: '주문을 찾을 수 없습니다',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 최고 주문 금액 조회
   * GET /orders/highest-value
   */
  @Get('highest-value')
  async getHighestValueOrder() {
    return this.queryBus.execute(new GetHighValueOrderQuery());
  }
}
