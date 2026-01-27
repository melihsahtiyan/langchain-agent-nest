import { Injectable } from '@nestjs/common';
import { DataSource, Repository, LessThan } from 'typeorm';
import { LogEntry, LogLevel } from '../entities/log-entry.entity';

@Injectable()
export class LogEntryRepository extends Repository<LogEntry> {
  constructor(private dataSource: DataSource) {
    super(LogEntry, dataSource.createEntityManager());
  }

  async findByLevel(level: LogLevel, limit = 100): Promise<LogEntry[]> {
    return this.find({
      where: { level },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findByContext(context: string, limit = 100): Promise<LogEntry[]> {
    return this.find({
      where: { context },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findRecentErrors(limit = 50): Promise<LogEntry[]> {
    return this.find({
      where: { level: LogLevel.ERROR },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findByRequestId(requestId: string): Promise<LogEntry[]> {
    return this.createQueryBuilder('log')
      .where("log.metadata->>'requestId' = :requestId", { requestId })
      .orderBy('log.createdAt', 'ASC')
      .getMany();
  }

  async deleteOlderThan(days: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.delete({
      createdAt: LessThan(cutoffDate),
    });

    return result.affected || 0;
  }

  async getLogStats(): Promise<{ level: LogLevel; count: string }[]> {
    return this.createQueryBuilder('log')
      .select('log.level', 'level')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.level')
      .getRawMany();
  }
}
