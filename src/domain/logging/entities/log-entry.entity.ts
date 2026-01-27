import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  VERBOSE = 'verbose',
}

export interface LogContext {
  service?: string;
  method?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  duration?: number;
  [key: string]: unknown;
}

export interface LogError {
  name?: string;
  message?: string;
  stack?: string;
}

@Entity('application_logs')
export class LogEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 20 })
  level: LogLevel;

  @Column('text')
  message: string;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  context: string | null;

  @Column('jsonb', { default: {} })
  metadata: LogContext;

  @Column('jsonb', { nullable: true })
  error: LogError | null;

  @Index()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // === Domain Behavior ===

  static create(
    level: LogLevel,
    message: string,
    context?: string,
    metadata?: LogContext,
    error?: LogError,
  ): LogEntry {
    const entry = new LogEntry();
    entry.level = level;
    entry.message = message;
    entry.context = context || null;
    entry.metadata = metadata || {};
    entry.error = error || null;
    return entry;
  }

  static createError(
    message: string,
    error: Error,
    context?: string,
    metadata?: LogContext,
  ): LogEntry {
    return LogEntry.create(LogLevel.ERROR, message, context, metadata, {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }

  static createInfo(
    message: string,
    context?: string,
    metadata?: LogContext,
  ): LogEntry {
    return LogEntry.create(LogLevel.INFO, message, context, metadata);
  }

  static createWarn(
    message: string,
    context?: string,
    metadata?: LogContext,
  ): LogEntry {
    return LogEntry.create(LogLevel.WARN, message, context, metadata);
  }

  isError(): boolean {
    return this.level === LogLevel.ERROR;
  }

  hasError(): boolean {
    return this.error !== null;
  }

  getService(): string | undefined {
    return this.metadata?.service;
  }

  getRequestId(): string | undefined {
    return this.metadata?.requestId;
  }
}
