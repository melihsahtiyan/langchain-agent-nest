import { Injectable } from '@nestjs/common';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  SystemMessage,
} from '@langchain/core/messages';
import { ChatHistoryRepository } from '../../domain/chat/repositories/chat-history.repository';
import {
  ChatMessage,
  MessageRole,
} from '../../domain/chat/entities/chat-message.entity';

@Injectable()
export class MemoryAdapter {
  constructor(private readonly chatHistoryRepository: ChatHistoryRepository) {}

  async getMessages(sessionId: string): Promise<BaseMessage[]> {
    const messages =
      await this.chatHistoryRepository.findBySessionId(sessionId);
    return messages.map((msg) => this.toBaseMessage(msg));
  }

  async getRecentMessages(
    sessionId: string,
    limit: number = 20,
  ): Promise<BaseMessage[]> {
    const messages = await this.chatHistoryRepository.findRecentBySessionId(
      sessionId,
      limit,
    );
    return messages.map((msg) => this.toBaseMessage(msg));
  }

  async addUserMessage(sessionId: string, content: string): Promise<void> {
    await this.chatHistoryRepository.addUserMessage(sessionId, content);
  }

  async addAIMessage(
    sessionId: string,
    content: string,
    metadata?: { model?: string; tokens?: number; latencyMs?: number },
  ): Promise<void> {
    await this.chatHistoryRepository.addAssistantMessage(
      sessionId,
      content,
      metadata,
    );
  }

  async addSystemMessage(sessionId: string, content: string): Promise<void> {
    await this.chatHistoryRepository.addSystemMessage(sessionId, content);
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.chatHistoryRepository.deleteBySessionId(sessionId);
  }

  async getSessionHistory(
    sessionId: string,
  ): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
    const messages =
      await this.chatHistoryRepository.findBySessionId(sessionId);
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      createdAt: msg.createdAt,
    }));
  }

  private toBaseMessage(message: ChatMessage): BaseMessage {
    switch (message.role) {
      case MessageRole.USER:
        return new HumanMessage(message.content);
      case MessageRole.ASSISTANT:
        return new AIMessage(message.content);
      case MessageRole.SYSTEM:
        return new SystemMessage(message.content);
      default:
        return new HumanMessage(message.content);
    }
  }
}
