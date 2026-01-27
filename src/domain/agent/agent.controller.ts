import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AgentService,
  ChatResponse,
  DocumentUploadResult,
} from './agent.service';

class ChatRequestDto {
  sessionId: string;
  message: string;
}

class AddDocumentDto {
  content: string;
  metadata?: {
    source?: string;
    title?: string;
  };
}

class AddDocumentsDto {
  documents: Array<{
    content: string;
    metadata?: Record<string, unknown>;
  }>;
}

class PdfUrlUploadDto {
  url: string;
  title?: string;
}

interface HistoryResponse {
  messages: Array<{ role: string; content: string; createdAt: Date }>;
}

@Controller('agent')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post('chat')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async chat(
    @Body() body: ChatRequestDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<ChatResponse> {
    if (file) {
      // Validate file type
      if (file.mimetype !== 'application/pdf') {
        throw new BadRequestException('Only PDF files are supported');
      }
      return this.agentService.chatWithDocument(
        body.sessionId,
        body.message,
        file.buffer,
        file.originalname,
      );
    }
    return this.agentService.chat(body.sessionId, body.message);
  }

  @Get('sessions/:sessionId/history')
  async getHistory(
    @Param('sessionId') sessionId: string,
  ): Promise<HistoryResponse> {
    const messages = await this.agentService.getSessionHistory(sessionId);
    return { messages };
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearSession(@Param('sessionId') sessionId: string): Promise<void> {
    await this.agentService.clearSession(sessionId);
  }

  @Post('documents')
  @HttpCode(HttpStatus.CREATED)
  async addDocument(@Body() body: AddDocumentDto): Promise<{ id: string }> {
    const id = await this.agentService.addDocument(body.content, body.metadata);
    return { id };
  }

  @Post('documents/batch')
  @HttpCode(HttpStatus.CREATED)
  async addDocuments(
    @Body() body: AddDocumentsDto,
  ): Promise<{ ids: string[] }> {
    const ids = await this.agentService.addDocuments(body.documents);
    return { ids };
  }

  @Post('documents/pdf')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
    @Body('title') title?: string,
  ): Promise<DocumentUploadResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Only PDF files are supported');
    }
    return this.agentService.uploadPdfToKnowledge(file.buffer, title);
  }

  @Post('documents/pdf/url')
  @HttpCode(HttpStatus.CREATED)
  async uploadPdfFromUrl(
    @Body() body: PdfUrlUploadDto,
  ): Promise<DocumentUploadResult> {
    if (!body.url) {
      throw new BadRequestException('URL is required');
    }
    return this.agentService.uploadPdfFromUrl(body.url, body.title);
  }
}
