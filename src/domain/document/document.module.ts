import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from './entities/document.entity';
import { DocumentRepository } from './repositories/document.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  providers: [DocumentRepository],
  exports: [DocumentRepository],
})
export class DocumentModule {}
