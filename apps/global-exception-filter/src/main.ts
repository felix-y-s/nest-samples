import { NestFactory } from '@nestjs/core';
import { GlobalExceptionFilterModule } from './global-exception-filter.module';

async function bootstrap() {
  const app = await NestFactory.create(GlobalExceptionFilterModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
