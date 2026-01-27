import { Injectable } from '@nestjs/common';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { DocumentRepository } from '../../domain/document/repositories/document.repository';
import { EmbeddingsService } from './embeddings.service';
import { DocumentMetadata } from '../../domain/document/entities/document.entity';

export interface VectorSearchResult {
  document: LangChainDocument;
  score: number;
}

@Injectable()
export class VectorStoreAdapter {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  async addDocuments(
    documents: LangChainDocument[],
    options?: { ids?: string[] },
  ): Promise<string[]> {
    const texts = documents.map((doc) => doc.pageContent);
    const embeddings = await this.embeddingsService.embedDocuments(texts);

    const ids: string[] = [];
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      const embedding = embeddings[i];
      const metadata: DocumentMetadata = {
        ...doc.metadata,
        source: doc.metadata?.source as string | undefined,
        title: doc.metadata?.title as string | undefined,
      };

      const saved = await this.documentRepository.createDocumentWithEmbedding(
        doc.pageContent,
        embedding,
        metadata,
      );
      ids.push(saved.id);
    }

    return options?.ids || ids;
  }

  async similaritySearch(
    query: string,
    k: number = 5,
    threshold: number = 0.7,
  ): Promise<LangChainDocument[]> {
    const queryEmbedding = await this.embeddingsService.embedQuery(query);
    const results = await this.documentRepository.similaritySearch(
      queryEmbedding,
      k,
      threshold,
    );

    return results.map(
      (result) =>
        new LangChainDocument({
          pageContent: result.document.content,
          metadata: {
            ...result.document.metadata,
            id: result.document.id,
            similarity: result.similarity,
          },
        }),
    );
  }

  async similaritySearchWithScore(
    query: string,
    k: number = 5,
    threshold: number = 0.7,
  ): Promise<VectorSearchResult[]> {
    const queryEmbedding = await this.embeddingsService.embedQuery(query);
    const results = await this.documentRepository.similaritySearch(
      queryEmbedding,
      k,
      threshold,
    );

    return results.map((result) => ({
      document: new LangChainDocument({
        pageContent: result.document.content,
        metadata: {
          ...result.document.metadata,
          id: result.document.id,
        },
      }),
      score: result.similarity,
    }));
  }

  async addDocument(
    content: string,
    metadata?: DocumentMetadata,
  ): Promise<string> {
    const embedding = await this.embeddingsService.embedQuery(content);
    const doc = await this.documentRepository.createDocumentWithEmbedding(
      content,
      embedding,
      metadata,
    );
    return doc.id;
  }

  async deleteBySource(source: string): Promise<void> {
    await this.documentRepository.deleteBySource(source);
  }
}
