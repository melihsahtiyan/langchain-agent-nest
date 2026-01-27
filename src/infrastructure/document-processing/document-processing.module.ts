import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PdfProcessorService } from './pdf-processor.service';

@Module({
  imports: [ConfigModule],
  providers: [PdfProcessorService],
  exports: [PdfProcessorService],
})
export class DocumentProcessingModule {}
