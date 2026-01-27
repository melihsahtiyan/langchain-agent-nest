import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';

interface VllmModelsResponse {
  data: Array<{ id: string; object: string }>;
}

interface VllmMetrics {
  gpuCacheUsagePercent: number | null;
  requestsWaiting: number | null;
  requestsRunning: number | null;
}

@Injectable()
export class VllmHealthIndicator extends HealthIndicator {
  private readonly baseUrl: string;
  private readonly modelName: string;
  private readonly timeout: number;

  constructor(private configService: ConfigService) {
    super();
    this.baseUrl = this.configService.get<string>(
      'VLLM_BASE_URL',
      'http://vllm:8000/v1',
    );
    this.modelName =
      this.configService.get<string>('VLLM_MODEL_NAME') ||
      this.configService.get<string>('MODEL', 'default');
    this.timeout = this.configService.get<number>('VLLM_HEALTH_TIMEOUT', 5000);
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Check if model is available
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`vLLM returned status ${response.status}`);
      }

      const data = (await response.json()) as VllmModelsResponse;
      const models = data.data || [];
      const modelAvailable = models.some((m) => m.id === this.modelName);

      if (!modelAvailable) {
        throw new Error(`Model ${this.modelName} not available`);
      }

      // Try to fetch vLLM metrics
      const metrics = await this.fetchMetrics();

      return this.getStatus(key, true, {
        model: this.modelName,
        modelLoaded: true,
        url: this.baseUrl,
        availableModels: models.map((m) => m.id),
        metrics,
      });
    } catch (error) {
      clearTimeout(timeoutId);

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const result = this.getStatus(key, false, {
        model: this.modelName,
        modelLoaded: false,
        url: this.baseUrl,
        error: errorMessage,
      });

      throw new HealthCheckError('vLLM health check failed', result);
    }
  }

  private async fetchMetrics(): Promise<VllmMetrics> {
    try {
      // vLLM metrics endpoint is at the root, not /v1
      const metricsUrl = this.baseUrl.replace('/v1', '') + '/metrics';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(metricsUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          gpuCacheUsagePercent: null,
          requestsWaiting: null,
          requestsRunning: null,
        };
      }

      const text = await response.text();
      return this.parsePrometheusMetrics(text);
    } catch {
      return {
        gpuCacheUsagePercent: null,
        requestsWaiting: null,
        requestsRunning: null,
      };
    }
  }

  private parsePrometheusMetrics(text: string): VllmMetrics {
    const metrics: VllmMetrics = {
      gpuCacheUsagePercent: null,
      requestsWaiting: null,
      requestsRunning: null,
    };

    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('#') || !line.trim()) continue;

      // Parse vllm:gpu_cache_usage_perc
      if (line.includes('gpu_cache_usage_perc')) {
        const match = line.match(/(\d+\.?\d*)\s*$/);
        if (match) {
          metrics.gpuCacheUsagePercent = parseFloat(match[1]) * 100;
        }
      }

      // Parse vllm:num_requests_waiting
      if (line.includes('num_requests_waiting')) {
        const match = line.match(/(\d+\.?\d*)\s*$/);
        if (match) {
          metrics.requestsWaiting = parseInt(match[1], 10);
        }
      }

      // Parse vllm:num_requests_running
      if (line.includes('num_requests_running')) {
        const match = line.match(/(\d+\.?\d*)\s*$/);
        if (match) {
          metrics.requestsRunning = parseInt(match[1], 10);
        }
      }
    }

    return metrics;
  }
}
