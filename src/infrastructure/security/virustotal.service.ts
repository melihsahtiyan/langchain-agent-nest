import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

export interface VirusTotalScanResult {
  hash: string;
  isClean: boolean;
  positives: number;
  total: number;
  scanDate?: string;
  error?: string;
}

export interface VirusTotalUrlResult {
  url: string;
  isClean: boolean;
  positives: number;
  total: number;
  scanDate?: string;
  error?: string;
}

interface VirusTotalAnalysisStats {
  malicious?: number;
  suspicious?: number;
  undetected?: number;
  harmless?: number;
}

interface VirusTotalFileResponse {
  data?: {
    id?: string;
    attributes?: {
      last_analysis_stats?: VirusTotalAnalysisStats;
      last_analysis_date?: number;
      status?: string;
      stats?: VirusTotalAnalysisStats;
    };
  };
}

interface VirusTotalUrlResponse {
  data?: {
    attributes?: {
      last_analysis_stats?: VirusTotalAnalysisStats;
      last_analysis_date?: number;
    };
  };
}

@Injectable()
export class VirusTotalService {
  private readonly logger = new Logger(VirusTotalService.name);
  private readonly apiKey: string | undefined;
  private readonly baseUrl = 'https://www.virustotal.com/api/v3';

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('VIRUSTOTAL_API_KEY');
    if (!this.apiKey) {
      this.logger.warn(
        'VIRUSTOTAL_API_KEY not set - file scanning will be skipped',
      );
    }
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private computeSha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async scanFile(buffer: Buffer): Promise<VirusTotalScanResult> {
    const hash = this.computeSha256(buffer);

    if (!this.apiKey) {
      this.logger.debug('VirusTotal not configured, skipping scan');
      return {
        hash,
        isClean: true,
        positives: 0,
        total: 0,
        error: 'VirusTotal not configured',
      };
    }

    try {
      // First, check if file has been analyzed before
      const existingResult = await this.getFileReport(hash);
      if (!existingResult.error) {
        return existingResult;
      }

      // If not found, upload the file for scanning
      return await this.uploadAndScanFile(buffer, hash);
    } catch (error) {
      this.logger.error(`VirusTotal scan failed: ${error}`);
      return {
        hash,
        isClean: true, // Fail open - allow file but log warning
        positives: 0,
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getFileReport(hash: string): Promise<VirusTotalScanResult> {
    const response = await fetch(`${this.baseUrl}/files/${hash}`, {
      method: 'GET',
      headers: {
        'x-apikey': this.apiKey!,
      },
    });

    if (response.status === 404) {
      return {
        hash,
        isClean: true,
        positives: 0,
        total: 0,
        error: 'File not found in VirusTotal database',
      };
    }

    if (!response.ok) {
      throw new Error(`VirusTotal API error: ${response.status}`);
    }

    const data = (await response.json()) as VirusTotalFileResponse;
    const stats = data.data?.attributes?.last_analysis_stats ?? {};
    const positives = (stats.malicious ?? 0) + (stats.suspicious ?? 0);
    const total =
      (stats.malicious ?? 0) +
      (stats.suspicious ?? 0) +
      (stats.undetected ?? 0) +
      (stats.harmless ?? 0);

    return {
      hash,
      isClean: positives === 0,
      positives,
      total,
      scanDate: data.data?.attributes?.last_analysis_date
        ? new Date(data.data.attributes.last_analysis_date * 1000).toISOString()
        : undefined,
    };
  }

  private async uploadAndScanFile(
    buffer: Buffer,
    hash: string,
  ): Promise<VirusTotalScanResult> {
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(buffer)]), 'file');

    const response = await fetch(`${this.baseUrl}/files`, {
      method: 'POST',
      headers: {
        'x-apikey': this.apiKey!,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`VirusTotal upload error: ${response.status}`);
    }

    const data = (await response.json()) as VirusTotalFileResponse;
    const analysisId = data.data?.id;

    if (!analysisId) {
      throw new Error('No analysis ID returned');
    }

    // Wait for analysis to complete (poll with timeout)
    return await this.waitForAnalysis(analysisId, hash);
  }

  private async waitForAnalysis(
    analysisId: string,
    hash: string,
    maxAttempts: number = 10,
  ): Promise<VirusTotalScanResult> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      const response = await fetch(`${this.baseUrl}/analyses/${analysisId}`, {
        method: 'GET',
        headers: {
          'x-apikey': this.apiKey!,
        },
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as VirusTotalFileResponse;
      const status = data.data?.attributes?.status;

      if (status === 'completed') {
        const stats = data.data?.attributes?.stats ?? {};
        const positives = (stats.malicious ?? 0) + (stats.suspicious ?? 0);
        const total =
          (stats.malicious ?? 0) +
          (stats.suspicious ?? 0) +
          (stats.undetected ?? 0) +
          (stats.harmless ?? 0);

        return {
          hash,
          isClean: positives === 0,
          positives,
          total,
          scanDate: new Date().toISOString(),
        };
      }
    }

    // Timeout - fail open but warn
    this.logger.warn(`VirusTotal analysis timeout for hash ${hash}`);
    return {
      hash,
      isClean: true,
      positives: 0,
      total: 0,
      error: 'Analysis timeout',
    };
  }

  async scanUrl(url: string): Promise<VirusTotalUrlResult> {
    if (!this.apiKey) {
      return {
        url,
        isClean: true,
        positives: 0,
        total: 0,
        error: 'VirusTotal not configured',
      };
    }

    try {
      // URL ID is base64url encoded URL
      const urlId = Buffer.from(url).toString('base64url');

      const response = await fetch(`${this.baseUrl}/urls/${urlId}`, {
        method: 'GET',
        headers: {
          'x-apikey': this.apiKey,
        },
      });

      if (response.status === 404) {
        // URL not in database, submit for scanning
        return await this.submitUrlForScan(url);
      }

      if (!response.ok) {
        throw new Error(`VirusTotal API error: ${response.status}`);
      }

      const data = (await response.json()) as VirusTotalUrlResponse;
      const stats = data.data?.attributes?.last_analysis_stats ?? {};
      const positives = (stats.malicious ?? 0) + (stats.suspicious ?? 0);
      const total =
        (stats.malicious ?? 0) +
        (stats.suspicious ?? 0) +
        (stats.undetected ?? 0) +
        (stats.harmless ?? 0);

      return {
        url,
        isClean: positives === 0,
        positives,
        total,
        scanDate: data.data?.attributes?.last_analysis_date
          ? new Date(
              data.data.attributes.last_analysis_date * 1000,
            ).toISOString()
          : undefined,
      };
    } catch (error) {
      this.logger.error(`VirusTotal URL scan failed: ${error}`);
      return {
        url,
        isClean: true,
        positives: 0,
        total: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async submitUrlForScan(url: string): Promise<VirusTotalUrlResult> {
    const formData = new URLSearchParams();
    formData.append('url', url);

    const response = await fetch(`${this.baseUrl}/urls`, {
      method: 'POST',
      headers: {
        'x-apikey': this.apiKey!,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      throw new Error(`VirusTotal URL submit error: ${response.status}`);
    }

    // For now, return clean since we just submitted
    // In production, you'd want to wait for the analysis
    return {
      url,
      isClean: true,
      positives: 0,
      total: 0,
      scanDate: new Date().toISOString(),
      error: 'Submitted for scanning - results pending',
    };
  }

  isClean(result: VirusTotalScanResult | VirusTotalUrlResult): boolean {
    return result.isClean;
  }
}
