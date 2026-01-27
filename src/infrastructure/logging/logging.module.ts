import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DomainLoggingModule } from '../../domain/logging/logging.module';
import { AppLoggerService } from './logger.service';

@Global()
@Module({
  imports: [ConfigModule, DomainLoggingModule],
  providers: [AppLoggerService],
  exports: [AppLoggerService],
})
export class LoggingModule {}
