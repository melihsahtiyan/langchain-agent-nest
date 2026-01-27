import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VirusTotalService } from './virustotal.service';

@Module({
  imports: [ConfigModule],
  providers: [VirusTotalService],
  exports: [VirusTotalService],
})
export class SecurityModule {}
