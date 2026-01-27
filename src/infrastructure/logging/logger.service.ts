import {
  Injectable,
  LoggerService as NestLoggerService,
  Inject,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { LogEntryRepository } from '../../domain/logging/repositories/log-entry.repository';
import {
  LogEntry,
  LogLevel,
  LogContext,
} from '../../domain/logging/entities/log-entry.entity';

@Injectable()
export class AppLoggerService implements NestLoggerService {
  private readonly winston: winston.Logger;
  private context?: string;
  private isDbReady = false;
  private readonly logToDb: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    @Inject(LogEntryRepository)
    private readonly logRepository?: LogEntryRepository,
  ) {
    this.logToDb =
      this.configService.get<string>('LOG_TO_DB', 'true') === 'true';
    this.winston = this.createWinstonLogger();
    this.initializeDbTransport();
  }

  private createWinstonLogger(): winston.Logger {
    const logLevel = this.configService.get<string>('LOG_LEVEL', 'info');
    const logDir = this.configService.get<string>('LOG_DIR', 'logs');

    return winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports: [
        // Console transport with colors
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize({ all: true }),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf((info) => {
              const timestamp =
                typeof info.timestamp === 'string' ? info.timestamp : '';
              const level = typeof info.level === 'string' ? info.level : '';
              const message =
                typeof info.message === 'string' ? info.message : '';
              const context =
                typeof info.context === 'string' ? info.context : undefined;
              const ctx = context ? `[${context}]` : '';

              // Extract remaining metadata
              const knownKeys = new Set([
                'timestamp',
                'level',
                'message',
                'context',
              ]);
              const meta: Record<string, unknown> = {};
              for (const key of Object.keys(info)) {
                if (!knownKeys.has(key)) {
                  meta[key] = info[key];
                }
              }
              const metaStr = Object.keys(meta).length
                ? JSON.stringify(meta)
                : '';
              return `${timestamp} ${level} ${ctx} ${message} ${metaStr}`;
            }),
          ),
        }),
        // Daily rotate file transport
        new winston.transports.DailyRotateFile({
          dirname: logDir,
          filename: 'app-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
        // Error-specific file
        new winston.transports.DailyRotateFile({
          dirname: logDir,
          filename: 'error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          level: 'error',
          maxSize: '20m',
          maxFiles: '30d',
        }),
      ],
    });
  }

  private initializeDbTransport(): void {
    // Delay DB writes until connection is established
    setTimeout(() => {
      this.isDbReady = true;
    }, 5000);
  }

  setContext(context: string): void {
    this.context = context;
  }

  private async persistToDb(
    level: LogLevel,
    message: string,
    metadata?: LogContext,
    error?: Error,
  ): Promise<void> {
    if (!this.isDbReady || !this.logToDb || !this.logRepository) return;

    try {
      const entry = error
        ? LogEntry.createError(message, error, this.context, metadata)
        : LogEntry.create(level, message, this.context, metadata);

      await this.logRepository.save(entry);
    } catch {
      // Fail silently - don't let logging break the app
      this.winston.warn('Failed to persist log to database');
    }
  }

  log(message: string, context?: string | LogContext): void {
    const ctx = typeof context === 'string' ? context : this.context;
    const meta = typeof context === 'object' ? context : undefined;

    this.winston.info(message, { context: ctx, ...meta });
    void this.persistToDb(LogLevel.INFO, message, meta);
  }

  error(message: string, trace?: string, context?: string): void {
    const error = trace ? { name: 'Error', message, stack: trace } : undefined;
    this.winston.error(message, {
      context: context || this.context,
      stack: trace,
    });
    void this.persistToDb(
      LogLevel.ERROR,
      message,
      { service: context },
      error as Error | undefined,
    );
  }

  warn(message: string, context?: string | LogContext): void {
    const ctx = typeof context === 'string' ? context : this.context;
    const meta = typeof context === 'object' ? context : undefined;

    this.winston.warn(message, { context: ctx, ...meta });
    void this.persistToDb(LogLevel.WARN, message, meta);
  }

  debug(message: string, context?: string | LogContext): void {
    const ctx = typeof context === 'string' ? context : this.context;
    const meta = typeof context === 'object' ? context : undefined;

    this.winston.debug(message, { context: ctx, ...meta });
    // Only persist debug in development
    if (this.configService.get('NODE_ENV') !== 'production') {
      void this.persistToDb(LogLevel.DEBUG, message, meta);
    }
  }

  verbose(message: string, context?: string | LogContext): void {
    const ctx = typeof context === 'string' ? context : this.context;
    const meta = typeof context === 'object' ? context : undefined;

    this.winston.verbose(message, { context: ctx, ...meta });
  }
}
