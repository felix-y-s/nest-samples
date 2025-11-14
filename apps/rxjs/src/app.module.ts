import { Module } from '@nestjs/common';
import { RxjsModule } from './modules/rxjs/rxjs.module';

@Module({
  imports: [RxjsModule]
})
export class AppModule {}