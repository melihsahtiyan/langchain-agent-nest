import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system',
}

export interface ChatMessageMetadata {
  model?: string;
  tokens?: number;
  latencyMs?: number;
  [key: string]: unknown;
}

@Entity('chat_history')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'session_id', length: 255 })
  sessionId: string;

  @Column({ length: 50 })
  role: MessageRole;

  @Column('text')
  content: string;

  @Column('jsonb', { default: {} })
  metadata: ChatMessageMetadata;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // === Domain Behavior ===

  static createUserMessage(sessionId: string, content: string): ChatMessage {
    const message = new ChatMessage();
    message.sessionId = sessionId;
    message.role = MessageRole.USER;
    message.content = content;
    message.metadata = {};
    return message;
  }

  static createAssistantMessage(
    sessionId: string,
    content: string,
    metadata?: ChatMessageMetadata,
  ): ChatMessage {
    const message = new ChatMessage();
    message.sessionId = sessionId;
    message.role = MessageRole.ASSISTANT;
    message.content = content;
    message.metadata = metadata || {};
    return message;
  }

  static createSystemMessage(sessionId: string, content: string): ChatMessage {
    const message = new ChatMessage();
    message.sessionId = sessionId;
    message.role = MessageRole.SYSTEM;
    message.content = content;
    message.metadata = {};
    return message;
  }

  isFromUser(): boolean {
    return this.role === MessageRole.USER;
  }

  isFromAssistant(): boolean {
    return this.role === MessageRole.ASSISTANT;
  }

  isSystemMessage(): boolean {
    return this.role === MessageRole.SYSTEM;
  }

  getTokenCount(): number | undefined {
    return this.metadata?.tokens;
  }

  getLatencyMs(): number | undefined {
    return this.metadata?.latencyMs;
  }

  truncate(maxLength: number): string {
    if (this.content.length <= maxLength) {
      return this.content;
    }
    return this.content.substring(0, maxLength - 3) + '...';
  }

  toPromptFormat(): string {
    return `${this.role}: ${this.content}`;
  }
}
