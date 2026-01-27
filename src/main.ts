import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppLoggerService } from './infrastructure/logging/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use custom logger globally
  const logger = app.get(AppLoggerService);
  logger.setContext('Bootstrap');
  app.useLogger(logger);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  logger.log(`Application started on port ${port}`);
}
void bootstrap();
