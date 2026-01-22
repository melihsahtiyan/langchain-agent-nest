import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { ChatMessage, MessageRole } from '../entities/chat-message.entity';

@Injectable()
export class ChatHistoryRepository extends Repository<ChatMessage> {
  constructor(private dataSource: DataSource) {
    super(ChatMessage, dataSource.createEntityManager());
  }

  async findBySessionId(sessionId: string): Promise<ChatMessage[]> {
    return this.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  async findRecentBySessionId(
    sessionId: string,
    limit: number = 10,
  ): Promise<ChatMessage[]> {
    return this.find({
      where: { sessionId },
      order: { createdAt: 'DESC' },
      take: limit,
    }).then((messages) => messages.reverse());
  }

  async findBySessionIdAndRole(
    sessionId: string,
    role: MessageRole,
  ): Promise<ChatMessage[]> {
    return this.find({
      where: { sessionId, role },
      order: { createdAt: 'ASC' },
    });
  }

  async getSessionIds(): Promise<string[]> {
    const result = await this.createQueryBuilder('chat')
      .select('DISTINCT chat.session_id', 'sessionId')
      .getRawMany<{ sessionId: string }>();
    return result.map((r) => r.sessionId);
  }

  async countBySessionId(sessionId: string): Promise<number> {
    return this.count({ where: { sessionId } });
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await this.delete({ sessionId });
  }

  async getConversationContext(
    sessionId: string,
    maxMessages: number = 20,
  ): Promise<ChatMessage[]> {
    const messages = await this.findRecentBySessionId(sessionId, maxMessages);
    return messages;
  }

  async addUserMessage(
    sessionId: string,
    content: string,
  ): Promise<ChatMessage> {
    const message = ChatMessage.createUserMessage(sessionId, content);
    return this.save(message);
  }

  async addAssistantMessage(
    sessionId: string,
    content: string,
    metadata?: { model?: string; tokens?: number; latencyMs?: number },
  ): Promise<ChatMessage> {
    const message = ChatMessage.createAssistantMessage(
      sessionId,
      content,
      metadata,
    );
    return this.save(message);
  }

  async addSystemMessage(
    sessionId: string,
    content: string,
  ): Promise<ChatMessage> {
    const message = ChatMessage.createSystemMessage(sessionId, content);
    return this.save(message);
  }
}
