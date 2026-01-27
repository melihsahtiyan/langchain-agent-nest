import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';

@Injectable()
export class LlmService {
  private readonly chatModel: ChatOpenAI;

  constructor(private configService: ConfigService) {
    const baseURL = this.configService.get<string>(
      'VLLM_BASE_URL',
      'http://vllm:8000/v1',
    );
    const modelName =
      this.configService.get<string>('VLLM_MODEL_NAME') ||
      this.configService.get<string>('MODEL', 'default');
    const maxTokens = this.configService.get<number>('LLM_MAX_TOKENS', 1024);
    const temperature = this.configService.get<number>('LLM_TEMPERATURE', 0.7);

    this.chatModel = new ChatOpenAI({
      openAIApiKey: 'not-needed',
      configuration: {
        baseURL,
      },
      modelName,
      temperature,
      maxTokens,
    });
  }

  getChatModel(): ChatOpenAI {
    return this.chatModel;
  }

  async invoke(prompt: string): Promise<string> {
    const response = await this.chatModel.invoke(prompt);
    return response.content as string;
  }
}
