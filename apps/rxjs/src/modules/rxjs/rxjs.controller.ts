import {
  Controller,
  Get,
  Logger,
  Param,
  UseInterceptors,
} from '@nestjs/common';
import { RxjsService } from './rxjs.service';
import {
  LoggingInterceptor,
  SmartRetryInterceptor,
  TimeoutInterceptor,
  TransformInterceptor,
} from '../../interceptors';
import { RetryInterceptor } from '../../interceptors/retry.interceptor';

@Controller()
export class RxjsController {
  private readonly logger = new Logger(RxjsController.name);
  constructor(private readonly rxjsService: RxjsService) {}

  @Get()
  @UseInterceptors(
    LoggingInterceptor,
    TimeoutInterceptor,
    RetryInterceptor,
    SmartRetryInterceptor,
    TransformInterceptor,
  )
  async getHello(): Promise<Object> {
    this.logger.debug('getHello called');
    await new Promise((res) =>
      setTimeout(() => {
        res(0);
      }, 10),
    );
    // throw new Error('강제 에러 발생');
    return this.rxjsService.getHello();
  }
}
