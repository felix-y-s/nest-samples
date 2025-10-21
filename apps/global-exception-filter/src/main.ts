import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './filters/http-exception.filter';
import { UserNotFoundFilter } from './filters/user-not-found.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(
    new UserNotFoundFilter(), 
    new HttpExceptionFilter()
  );

  await app.listen(process.env.port ?? 3000);
}
bootstrap();
