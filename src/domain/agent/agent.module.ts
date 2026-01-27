import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LangChainModule } from '../../infrastructure/langchain/langchain.module';
import { SecurityModule } from '../../infrastructure/security/security.module';
import { DocumentProcessingModule } from '../../infrastructure/document-processing/document-processing.module';
import { DocumentModule } from '../document/document.module';
import { AgentService } from './agent.service';
import { AgentController } from './agent.controller';
import { DocumentCleanupService } from './document-cleanup.service';

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    LangChainModule,
    SecurityModule,
    DocumentProcessingModule,
    DocumentModule,
  ],
  controllers: [AgentController],
  providers: [AgentService, DocumentCleanupService],
  exports: [AgentService],
})
export class AgentModule {}
