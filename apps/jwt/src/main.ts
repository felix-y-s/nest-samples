import { NestFactory } from '@nestjs/core';
import { JwtModule } from './app.module';

async function bootstrap() {
  console.log('✅ JWT App Start');
  const app = await NestFactory.create(JwtModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
