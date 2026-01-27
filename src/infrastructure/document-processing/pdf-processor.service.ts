import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { v4 as uuidv4 } from 'uuid';

interface PdfParseResult {
  numpages: number;
  text: string;
  info?: {
    Title?: string;
    Author?: string;
    Subject?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
  };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  buffer: Buffer,
) => Promise<PdfParseResult>;

export interface ProcessedChunk {
  content: string;
  metadata: {
    source: string;
    title?: string;
    chunkIndex: number;
    totalChunks: number;
    documentGroupId: string;
    pageNumber?: number;
  };
}

export interface PdfProcessingOptions {
  source?: string;
  title?: string;
  chunkSize?: number;
  chunkOverlap?: number;
}

export interface PdfMetadata {
  pageCount: number;
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
}

@Injectable()
export class PdfProcessorService {
  private readonly logger = new Logger(PdfProcessorService.name);
  private readonly defaultChunkSize: number;
  private readonly defaultChunkOverlap: number;

  constructor(private readonly configService: ConfigService) {
    this.defaultChunkSize = this.configService.get<number>(
      'PDF_CHUNK_SIZE',
      1000,
    );
    this.defaultChunkOverlap = this.configService.get<number>(
      'PDF_CHUNK_OVERLAP',
      200,
    );
  }

  async processFromBuffer(
    buffer: Buffer,
    options: PdfProcessingOptions = {},
  ): Promise<{ chunks: ProcessedChunk[]; metadata: PdfMetadata }> {
    this.logger.debug('Processing PDF from buffer');

    const pdfData = await pdfParse(buffer);

    const metadata: PdfMetadata = {
      pageCount: pdfData.numpages,
      title: pdfData.info?.Title,
      author: pdfData.info?.Author,
      subject: pdfData.info?.Subject,
      creator: pdfData.info?.Creator,
      producer: pdfData.info?.Producer,
      creationDate: pdfData.info?.CreationDate
        ? this.parsePdfDate(pdfData.info.CreationDate)
        : undefined,
      modificationDate: pdfData.info?.ModDate
        ? this.parsePdfDate(pdfData.info.ModDate)
        : undefined,
    };

    const text = pdfData.text;
    const chunks = await this.splitText(text, options, metadata);

    this.logger.debug(
      `Processed PDF: ${metadata.pageCount} pages, ${chunks.length} chunks`,
    );

    return { chunks, metadata };
  }

  async processFromUrl(
    url: string,
    options: PdfProcessingOptions = {},
  ): Promise<{ chunks: ProcessedChunk[]; metadata: PdfMetadata }> {
    this.logger.debug(`Fetching PDF from URL: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && !contentType.includes('application/pdf')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return this.processFromBuffer(buffer, {
      ...options,
      source: options.source || url,
    });
  }

  private async splitText(
    text: string,
    options: PdfProcessingOptions,
    pdfMetadata: PdfMetadata,
  ): Promise<ProcessedChunk[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunkSize || this.defaultChunkSize,
      chunkOverlap: options.chunkOverlap || this.defaultChunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });

    const docs = await splitter.createDocuments([text]);
    const documentGroupId = uuidv4();
    const title = options.title || pdfMetadata.title || 'Untitled PDF';
    const source = options.source || 'uploaded-file';

    return docs.map((doc, index) => ({
      content: doc.pageContent,
      metadata: {
        source,
        title,
        chunkIndex: index,
        totalChunks: docs.length,
        documentGroupId,
      },
    }));
  }

  private parsePdfDate(dateString: string): Date | undefined {
    try {
      // PDF dates are in format: D:YYYYMMDDHHmmSSOHH'mm'
      if (dateString.startsWith('D:')) {
        dateString = dateString.substring(2);
      }

      const year = parseInt(dateString.substring(0, 4), 10);
      const month = parseInt(dateString.substring(4, 6), 10) - 1;
      const day = parseInt(dateString.substring(6, 8), 10);
      const hour = parseInt(dateString.substring(8, 10), 10) || 0;
      const minute = parseInt(dateString.substring(10, 12), 10) || 0;
      const second = parseInt(dateString.substring(12, 14), 10) || 0;

      return new Date(year, month, day, hour, minute, second);
    } catch {
      return undefined;
    }
  }

  async extractPlainText(buffer: Buffer): Promise<string> {
    const data = await pdfParse(buffer);
    return data.text;
  }

  async getPageCount(buffer: Buffer): Promise<number> {
    const data = await pdfParse(buffer);
    return data.numpages;
  }
}
