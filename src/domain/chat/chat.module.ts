import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatHistoryRepository } from './repositories/chat-history.repository';

@Module({
  imports: [TypeOrmModule.forFeature([ChatMessage])],
  providers: [ChatHistoryRepository],
  exports: [ChatHistoryRepository],
})
export class ChatModule {}
