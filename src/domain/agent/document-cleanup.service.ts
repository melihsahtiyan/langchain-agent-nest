import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentService } from './agent.service';

@Injectable()
export class DocumentCleanupService {
  private readonly logger = new Logger(DocumentCleanupService.name);

  constructor(private readonly agentService: AgentService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanup(): Promise<void> {
    this.logger.debug('Running expired document cleanup...');
    const deletedCount = await this.agentService.cleanupExpiredDocuments();
    if (deletedCount > 0) {
      this.logger.log(`Deleted ${deletedCount} expired documents`);
    }
  }
}
