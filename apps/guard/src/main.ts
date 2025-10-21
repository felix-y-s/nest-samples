import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('✅ Guard App Start');
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
