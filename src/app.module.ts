import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './infrastructure/database/database.module';
import { DomainLoggingModule } from './domain/logging/logging.module';
import { LoggingModule } from './infrastructure/logging/logging.module';
import { HealthModule } from './health/health.module';
import { ChatModule } from './domain/chat/chat.module';
import { DocumentModule } from './domain/document/document.module';
import { AgentModule } from './domain/agent/agent.module';
import databaseConfig from './config/database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    DatabaseModule,
    DomainLoggingModule,
    LoggingModule,
    HealthModule,
    ChatModule,
    DocumentModule,
    AgentModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
