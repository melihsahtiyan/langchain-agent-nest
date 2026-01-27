import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogEntry } from './entities/log-entry.entity';
import { LogEntryRepository } from './repositories/log-entry.repository';

@Module({
  imports: [TypeOrmModule.forFeature([LogEntry])],
  providers: [LogEntryRepository],
  exports: [LogEntryRepository],
})
export class DomainLoggingModule {}
