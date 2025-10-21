import { Module } from '@nestjs/common';
import { GlobalExceptionFilterController } from './global-exception-filter.controller';
import { GlobalExceptionFilterService } from './global-exception-filter.service';

@Module({
  imports: [],
  controllers: [GlobalExceptionFilterController],
  providers: [GlobalExceptionFilterService],
})
export class GlobalExceptionFilterModule {}
