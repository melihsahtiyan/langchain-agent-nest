import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { LlmService } from '../../infrastructure/langchain/llm.service';
import { VectorStoreAdapter } from '../../infrastructure/langchain/vector-store.adapter';
import { MemoryAdapter } from '../../infrastructure/langchain/memory.adapter';
import { EmbeddingsService } from '../../infrastructure/langchain/embeddings.service';
import { createDocumentSearchTool } from './tools/document-search.tool';
import { createWebSearchTool } from './tools/web-search.tool';
import { createDocumentRetentionTool } from './tools/document-retention.tool';
import { Document as LangChainDocument } from '@langchain/core/documents';
import { PdfProcessorService } from '../../infrastructure/document-processing/pdf-processor.service';
import { VirusTotalService } from '../../infrastructure/security/virustotal.service';
import { DocumentRepository } from '../document/repositories/document.repository';

export interface ChatResponse {
  sessionId: string;
  response: string;
  documentGroupId?: string;
  sources?: Array<{
    content: string;
    metadata: Record<string, unknown>;
    score: number;
  }>;
}

export interface DocumentUploadResult {
  documentGroupId: string;
  chunkCount: number;
  title: string;
  isTemporary: boolean;
}

const SYSTEM_PROMPT = `You are a helpful AI assistant with access to multiple tools:

1. **search_documents** - Search your permanent knowledge base for stored documents
2. **web_search** - Search the internet via DuckDuckGo for current information
3. **promote_document_to_knowledge** - Save valuable documents permanently

When a user attaches a document to their message:
- The document content is provided in the context below
- Answer their question using the document content
- After answering, evaluate if this document should be kept permanently:
  - KNOWLEDGE (keep): Reference documentation, manuals, guides, policies, educational materials
  - FAVOR (discard): One-time tasks like summarizing a receipt, extracting specific data, temporary files
- Only call promote_document_to_knowledge for true knowledge worth retaining

Always be helpful, accurate, and cite your sources. For web searches, mention that the information comes from the internet.`;

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private readonly maxContextMessages: number;
  private readonly similarityThreshold: number;
  private readonly documentTtlHours: number;

  constructor(
    private readonly llmService: LlmService,
    private readonly vectorStore: VectorStoreAdapter,
    private readonly memoryAdapter: MemoryAdapter,
    private readonly configService: ConfigService,
    private readonly pdfProcessor: PdfProcessorService,
    private readonly virusTotal: VirusTotalService,
    private readonly documentRepository: DocumentRepository,
    private readonly embeddingsService: EmbeddingsService,
  ) {
    this.maxContextMessages = this.configService.get<number>(
      'AGENT_MAX_CONTEXT_MESSAGES',
      20,
    );
    this.similarityThreshold = this.configService.get<number>(
      'AGENT_SIMILARITY_THRESHOLD',
      0.7,
    );
    this.documentTtlHours = this.configService.get<number>(
      'DOCUMENT_TTL_HOURS',
      24,
    );
  }

  async chat(sessionId: string, message: string): Promise<ChatResponse> {
    const startTime = Date.now();

    await this.memoryAdapter.addUserMessage(sessionId, message);

    const chatHistory = await this.memoryAdapter.getRecentMessages(
      sessionId,
      this.maxContextMessages,
    );

    const tools = [
      createDocumentSearchTool(this.vectorStore, this.similarityThreshold),
      createWebSearchTool(),
      createDocumentRetentionTool(this.documentRepository),
    ];

    const chatModel = this.llmService.getChatModel();

    const agent = createReactAgent({
      llm: chatModel,
      tools,
    });

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      ...chatHistory.slice(0, -1),
      new HumanMessage(message),
    ];

    const result = await agent.invoke({
      messages,
    });

    const lastMessage = result.messages[result.messages.length - 1];
    const responseContent =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const latencyMs = Date.now() - startTime;

    await this.memoryAdapter.addAIMessage(sessionId, responseContent, {
      latencyMs,
    });

    return {
      sessionId,
      response: responseContent,
    };
  }

  async getSessionHistory(
    sessionId: string,
  ): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
    return this.memoryAdapter.getSessionHistory(sessionId);
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.memoryAdapter.clearSession(sessionId);
  }

  async addDocument(
    content: string,
    metadata?: { source?: string; title?: string },
  ): Promise<string> {
    return this.vectorStore.addDocument(content, metadata);
  }

  async addDocuments(
    documents: Array<{ content: string; metadata?: Record<string, unknown> }>,
  ): Promise<string[]> {
    const langchainDocs = documents.map(
      (doc) =>
        new LangChainDocument({
          pageContent: doc.content,
          metadata: doc.metadata,
        }),
    );
    return this.vectorStore.addDocuments(langchainDocs);
  }

  async chatWithDocument(
    sessionId: string,
    message: string,
    file: Buffer,
    filename: string,
  ): Promise<ChatResponse> {
    const startTime = Date.now();

    // Step 1: Virus scan
    this.logger.debug(`Scanning file: ${filename}`);
    const scanResult = await this.virusTotal.scanFile(file);
    if (!scanResult.isClean) {
      throw new BadRequestException(
        `File failed security scan: ${scanResult.positives}/${scanResult.total} detections`,
      );
    }

    // Step 2: Process PDF
    this.logger.debug(`Processing PDF: ${filename}`);
    const { chunks, metadata: pdfMetadata } =
      await this.pdfProcessor.processFromBuffer(file, {
        title: filename,
        source: 'chat-attachment',
      });

    // Step 3: Embed and store as temporary documents
    const documentGroupId = chunks[0]?.metadata.documentGroupId;
    const contents = chunks.map((c) => c.content);
    const embeddings = await this.embeddingsService.embedDocuments(contents);

    for (let i = 0; i < chunks.length; i++) {
      await this.documentRepository.createDocumentWithTtl(
        chunks[i].content,
        embeddings[i],
        chunks[i].metadata,
        this.documentTtlHours,
      );
    }

    this.logger.debug(
      `Stored ${chunks.length} chunks with TTL of ${this.documentTtlHours}h, groupId: ${documentGroupId}`,
    );

    // Step 4: Build context with document content
    const documentContext = chunks
      .map((c, i) => `[Chunk ${i + 1}/${chunks.length}]\n${c.content}`)
      .join('\n\n---\n\n');

    const enhancedMessage = `[ATTACHED DOCUMENT: "${filename}" (${pdfMetadata.pageCount} pages, documentGroupId: ${documentGroupId})]\n\nDocument content:\n${documentContext}\n\n---\n\nUser question: ${message}`;

    // Step 5: Run agent with enhanced message
    await this.memoryAdapter.addUserMessage(sessionId, message);

    const chatHistory = await this.memoryAdapter.getRecentMessages(
      sessionId,
      this.maxContextMessages,
    );

    const tools = [
      createDocumentSearchTool(this.vectorStore, this.similarityThreshold),
      createWebSearchTool(),
      createDocumentRetentionTool(this.documentRepository),
    ];

    const chatModel = this.llmService.getChatModel();

    const agent = createReactAgent({
      llm: chatModel,
      tools,
    });

    const messages = [
      new SystemMessage(SYSTEM_PROMPT),
      ...chatHistory.slice(0, -1),
      new HumanMessage(enhancedMessage),
    ];

    const result = await agent.invoke({
      messages,
    });

    const lastMessage = result.messages[result.messages.length - 1];
    const responseContent =
      typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const latencyMs = Date.now() - startTime;

    await this.memoryAdapter.addAIMessage(sessionId, responseContent, {
      latencyMs,
    });

    return {
      sessionId,
      response: responseContent,
      documentGroupId,
    };
  }

  async uploadPdfToKnowledge(
    file: Buffer,
    title?: string,
  ): Promise<DocumentUploadResult> {
    // Step 1: Virus scan
    this.logger.debug(`Scanning file for knowledge base upload`);
    const scanResult = await this.virusTotal.scanFile(file);
    if (!scanResult.isClean) {
      throw new BadRequestException(
        `File failed security scan: ${scanResult.positives}/${scanResult.total} detections`,
      );
    }

    // Step 2: Process PDF
    const { chunks, metadata: pdfMetadata } =
      await this.pdfProcessor.processFromBuffer(file, {
        title: title || 'Uploaded Document',
        source: 'direct-upload',
      });

    // Step 3: Embed and store as permanent documents
    const documentGroupId = chunks[0]?.metadata.documentGroupId;
    const contents = chunks.map((c) => c.content);
    const embeddings = await this.embeddingsService.embedDocuments(contents);

    for (let i = 0; i < chunks.length; i++) {
      await this.documentRepository.createPermanentDocument(
        chunks[i].content,
        embeddings[i],
        chunks[i].metadata,
      );
    }

    this.logger.log(
      `Uploaded ${chunks.length} chunks to permanent knowledge base, groupId: ${documentGroupId}`,
    );

    return {
      documentGroupId,
      chunkCount: chunks.length,
      title: title || pdfMetadata.title || 'Uploaded Document',
      isTemporary: false,
    };
  }

  async uploadPdfFromUrl(
    url: string,
    title?: string,
  ): Promise<DocumentUploadResult> {
    // Step 1: URL scan
    this.logger.debug(`Scanning URL: ${url}`);
    const urlScanResult = await this.virusTotal.scanUrl(url);
    if (!urlScanResult.isClean) {
      throw new BadRequestException(
        `URL failed security scan: ${urlScanResult.positives}/${urlScanResult.total} detections`,
      );
    }

    // Step 2: Fetch and process PDF
    const { chunks, metadata: pdfMetadata } =
      await this.pdfProcessor.processFromUrl(url, {
        title,
        source: url,
      });

    // Step 3: Embed and store as permanent documents
    const documentGroupId = chunks[0]?.metadata.documentGroupId;
    const contents = chunks.map((c) => c.content);
    const embeddings = await this.embeddingsService.embedDocuments(contents);

    for (let i = 0; i < chunks.length; i++) {
      await this.documentRepository.createPermanentDocument(
        chunks[i].content,
        embeddings[i],
        chunks[i].metadata,
      );
    }

    this.logger.log(
      `Uploaded ${chunks.length} chunks from URL to knowledge base, groupId: ${documentGroupId}`,
    );

    return {
      documentGroupId,
      chunkCount: chunks.length,
      title: title || pdfMetadata.title || 'Document from URL',
      isTemporary: false,
    };
  }

  async cleanupExpiredDocuments(): Promise<number> {
    const deletedCount = await this.documentRepository.deleteExpired();
    if (deletedCount > 0) {
      this.logger.log(`Cleaned up ${deletedCount} expired documents`);
    }
    return deletedCount;
  }
}
