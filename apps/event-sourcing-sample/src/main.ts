import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
  console.log('🚀 Event Sourcing Sample 애플리케이션이 3000 포트에서 실행 중입니다');
}
bootstrap();
