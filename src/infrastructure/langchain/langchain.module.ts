import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChatModule } from '../../domain/chat/chat.module';
import { DocumentModule } from '../../domain/document/document.module';
import { LlmService } from './llm.service';
import { EmbeddingsService } from './embeddings.service';
import { VectorStoreAdapter } from './vector-store.adapter';
import { MemoryAdapter } from './memory.adapter';

@Module({
  imports: [ConfigModule, ChatModule, DocumentModule],
  providers: [LlmService, EmbeddingsService, VectorStoreAdapter, MemoryAdapter],
  exports: [LlmService, EmbeddingsService, VectorStoreAdapter, MemoryAdapter],
})
export class LangChainModule {}
