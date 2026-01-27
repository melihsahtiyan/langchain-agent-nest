import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Document, DocumentMetadata } from '../entities/document.entity';

export interface SimilaritySearchResult {
  document: Document;
  similarity: number;
}

@Injectable()
export class DocumentRepository extends Repository<Document> {
  constructor(private dataSource: DataSource) {
    super(Document, dataSource.createEntityManager());
  }

  async findBySource(source: string): Promise<Document[]> {
    return this.createQueryBuilder('doc')
      .where("doc.metadata->>'source' = :source", { source })
      .orderBy('doc.created_at', 'ASC')
      .getMany();
  }

  async findEmbedded(): Promise<Document[]> {
    return this.createQueryBuilder('doc')
      .where('doc.embedding IS NOT NULL')
      .orderBy('doc.created_at', 'DESC')
      .getMany();
  }

  async findNotEmbedded(): Promise<Document[]> {
    return this.createQueryBuilder('doc')
      .where('doc.embedding IS NULL')
      .orderBy('doc.created_at', 'ASC')
      .getMany();
  }

  async similaritySearch(
    embedding: number[],
    limit: number = 5,
    threshold: number = 0.7,
  ): Promise<SimilaritySearchResult[]> {
    const embeddingStr = `[${embedding.join(',')}]`;

    const results = await this.createQueryBuilder('doc')
      .select([
        'doc.id',
        'doc.content',
        'doc.metadata',
        'doc.created_at',
        `1 - (doc.embedding <=> '${embeddingStr}'::vector) as similarity`,
      ])
      .where('doc.embedding IS NOT NULL')
      .andWhere(
        `1 - (doc.embedding <=> '${embeddingStr}'::vector) >= :threshold`,
        {
          threshold,
        },
      )
      .orderBy('similarity', 'DESC')
      .limit(limit)
      .getRawAndEntities();

    return results.raw.map((raw: { similarity: string }, index: number) => ({
      document: results.entities[index],
      similarity: parseFloat(raw.similarity),
    }));
  }

  async findSimilarByContent(
    embedding: number[],
    limit: number = 5,
  ): Promise<Document[]> {
    const results = await this.similaritySearch(embedding, limit, 0);
    return results.map((r) => r.document);
  }

  async createDocument(
    content: string,
    metadata?: DocumentMetadata,
  ): Promise<Document> {
    const doc = Document.create(content, metadata);
    return this.save(doc);
  }

  async createDocumentWithEmbedding(
    content: string,
    embedding: number[],
    metadata?: DocumentMetadata,
  ): Promise<Document> {
    const doc = Document.createWithEmbedding(content, embedding, metadata);
    return this.save(doc);
  }

  async updateEmbedding(id: string, embedding: number[]): Promise<void> {
    const embeddingStr = `[${embedding.join(',')}]`;
    await this.createQueryBuilder()
      .update(Document)
      .set({ embedding: embeddingStr })
      .where('id = :id', { id })
      .execute();
  }

  async deleteBySource(source: string): Promise<void> {
    await this.createQueryBuilder()
      .delete()
      .from(Document)
      .where("metadata->>'source' = :source", { source })
      .execute();
  }

  async countEmbedded(): Promise<number> {
    return this.createQueryBuilder('doc')
      .where('doc.embedding IS NOT NULL')
      .getCount();
  }

  async countNotEmbedded(): Promise<number> {
    return this.createQueryBuilder('doc')
      .where('doc.embedding IS NULL')
      .getCount();
  }

  // === TTL Management ===

  async findExpired(): Promise<Document[]> {
    return this.createQueryBuilder('doc')
      .where('doc.expires_at IS NOT NULL')
      .andWhere('doc.expires_at < NOW()')
      .getMany();
  }

  async deleteExpired(): Promise<number> {
    const result = await this.createQueryBuilder()
      .delete()
      .from(Document)
      .where('expires_at IS NOT NULL')
      .andWhere('expires_at < NOW()')
      .execute();
    return result.affected || 0;
  }

  async findTemporary(): Promise<Document[]> {
    return this.createQueryBuilder('doc')
      .where('doc.is_temporary = true')
      .orderBy('doc.created_at', 'DESC')
      .getMany();
  }

  async findPermanent(): Promise<Document[]> {
    return this.createQueryBuilder('doc')
      .where('doc.is_temporary = false')
      .orderBy('doc.created_at', 'DESC')
      .getMany();
  }

  async promoteToKnowledge(ids: string[]): Promise<void> {
    await this.createQueryBuilder()
      .update(Document)
      .set({
        isTemporary: false,
        expiresAt: null,
        promotedAt: () => 'NOW()',
      })
      .whereInIds(ids)
      .execute();
  }

  async findByDocumentGroupId(groupId: string): Promise<Document[]> {
    return this.createQueryBuilder('doc')
      .where("doc.metadata->>'documentGroupId' = :groupId", { groupId })
      .orderBy("(doc.metadata->>'chunkIndex')::int", 'ASC')
      .getMany();
  }

  async createDocumentWithTtl(
    content: string,
    embedding: number[],
    metadata: DocumentMetadata,
    ttlHours: number,
  ): Promise<Document> {
    const doc = Document.createWithEmbedding(content, embedding, metadata, {
      isTemporary: true,
      ttlHours,
    });
    return this.save(doc);
  }

  async createPermanentDocument(
    content: string,
    embedding: number[],
    metadata: DocumentMetadata,
  ): Promise<Document> {
    const doc = Document.createPermanent(content, embedding, metadata);
    return this.save(doc);
  }

  async similaritySearchPermanent(
    embedding: number[],
    limit: number = 5,
    threshold: number = 0.7,
  ): Promise<SimilaritySearchResult[]> {
    const embeddingStr = `[${embedding.join(',')}]`;

    const results = await this.createQueryBuilder('doc')
      .select([
        'doc.id',
        'doc.content',
        'doc.metadata',
        'doc.created_at',
        `1 - (doc.embedding <=> '${embeddingStr}'::vector) as similarity`,
      ])
      .where('doc.embedding IS NOT NULL')
      .andWhere('doc.is_temporary = false')
      .andWhere(
        `1 - (doc.embedding <=> '${embeddingStr}'::vector) >= :threshold`,
        { threshold },
      )
      .orderBy('similarity', 'DESC')
      .limit(limit)
      .getRawAndEntities();

    return results.raw.map((raw: { similarity: string }, index: number) => ({
      document: results.entities[index],
      similarity: parseFloat(raw.similarity),
    }));
  }
}
