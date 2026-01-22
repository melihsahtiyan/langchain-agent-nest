import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export interface DocumentMetadata {
  source?: string;
  title?: string;
  chunkIndex?: number;
  totalChunks?: number;
  [key: string]: unknown;
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Index()
  @Column('vector', { nullable: true, array: false })
  embedding: string | null;

  @Column('jsonb', { default: {} })
  metadata: DocumentMetadata;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  // === Domain Behavior ===

  static create(content: string, metadata?: DocumentMetadata): Document {
    const doc = new Document();
    doc.content = content;
    doc.metadata = metadata || {};
    doc.embedding = null;
    return doc;
  }

  static createWithEmbedding(
    content: string,
    embedding: number[],
    metadata?: DocumentMetadata,
  ): Document {
    const doc = new Document();
    doc.content = content;
    doc.setEmbedding(embedding);
    doc.metadata = metadata || {};
    return doc;
  }

  isEmbedded(): boolean {
    return this.embedding !== null;
  }

  setEmbedding(embedding: number[]): void {
    this.embedding = `[${embedding.join(',')}]`;
  }

  getEmbeddingVector(): number[] | null {
    if (!this.embedding) return null;
    const cleaned = this.embedding.replace(/[[\]]/g, '');
    return cleaned.split(',').map(Number);
  }

  getEmbeddingDimension(): number | null {
    const vector = this.getEmbeddingVector();
    return vector ? vector.length : null;
  }

  getSource(): string | undefined {
    return this.metadata?.source;
  }

  getTitle(): string | undefined {
    return this.metadata?.title;
  }

  isChunked(): boolean {
    return (
      this.metadata?.totalChunks !== undefined && this.metadata.totalChunks > 1
    );
  }

  getChunkInfo(): { index: number; total: number } | null {
    if (!this.isChunked()) return null;
    return {
      index: this.metadata.chunkIndex || 0,
      total: this.metadata.totalChunks || 1,
    };
  }

  summarize(maxLength: number = 100): string {
    if (this.content.length <= maxLength) {
      return this.content;
    }
    return this.content.substring(0, maxLength - 3) + '...';
  }

  getWordCount(): number {
    return this.content.split(/\s+/).filter(Boolean).length;
  }

  getCharacterCount(): number {
    return this.content.length;
  }
}
