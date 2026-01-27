import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/huggingface_transformers';

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsService.name);
  private embeddings: HuggingFaceTransformersEmbeddings;

  constructor(private configService: ConfigService) {
    // Use a small, fast embedding model that runs locally
    // all-MiniLM-L6-v2 is a good balance of speed and quality
    const modelName = this.configService.get<string>(
      'EMBEDDING_MODEL',
      'Xenova/all-MiniLM-L6-v2',
    );

    this.embeddings = new HuggingFaceTransformersEmbeddings({
      model: modelName,
    });
  }

  async onModuleInit() {
    // Warm up the model by running a test embedding
    this.logger.log('Initializing embedding model...');
    try {
      await this.embeddings.embedQuery('warmup');
      this.logger.log('Embedding model initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize embedding model', error);
    }
  }

  getEmbeddings(): HuggingFaceTransformersEmbeddings {
    return this.embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(documents);
  }
}
