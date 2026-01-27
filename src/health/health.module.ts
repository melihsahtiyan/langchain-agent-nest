import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { VllmHealthIndicator } from './indicators/vllm.indicator';

@Module({
  imports: [TerminusModule, ConfigModule],
  controllers: [HealthController],
  providers: [VllmHealthIndicator],
})
export class HealthModule {}
