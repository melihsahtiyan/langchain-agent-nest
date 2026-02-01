import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { LoggerService } from '@nestjs/common';

export interface WebSearchLogger {
  log(message: string, context?: string): void;
  warn(message: string, context?: string): void;
  error(message: string, trace?: string, context?: string): void;
}

interface DuckDuckGoResult {
  title: string;
  link: string;
  snippet: string;
}

function parseHtmlResults(
  html: string,
  maxResults: number,
): DuckDuckGoResult[] {
  const results: DuckDuckGoResult[] = [];

  // Split HTML into result blocks (each starts with result__body)
  const blockRegex =
    /<div[^>]*class="[^"]*result__body[^"]*"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*result__body|$)/gi;

  let blockMatch: RegExpExecArray | null;
  while (
    (blockMatch = blockRegex.exec(html)) !== null &&
    results.length < maxResults
  ) {
    const block = blockMatch[1];

    // Extract link and title from result__a
    // Title may contain HTML tags like <b>
    const titleMatch =
      /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i.exec(
        block,
      );
    if (!titleMatch) continue;

    const link = titleMatch[1];
    const titleHtml = titleMatch[2];
    const title = titleHtml.replace(/<[^>]*>/g, '').trim();

    // Skip DuckDuckGo internal links
    if (!link || link.includes('duckduckgo.com')) continue;

    // Extract snippet from result__snippet
    const snippetMatch =
      /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
    const snippetHtml = snippetMatch ? snippetMatch[1] : '';
    const snippet = snippetHtml.replace(/<[^>]*>/g, '').trim();

    results.push({
      title: decodeHtmlEntities(title),
      link: link,
      snippet: decodeHtmlEntities(snippet),
    });
  }

  return results;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export function createWebSearchTool(logger: WebSearchLogger | LoggerService) {
  return new DynamicStructuredTool({
    name: 'web_search',
    description:
      'Search the internet using DuckDuckGo. Use this when you need current information, news, or facts that might not be in your knowledge base. Good for: latest news, current events, real-time data, recent updates, external information.',
    schema: z.object({
      query: z.string().describe('The search query to look up on the internet'),
      maxResults: z
        .number()
        .optional()
        .default(5)
        .describe('Maximum number of search results to return (default: 5)'),
    }),
    func: async ({ query, maxResults }) => {
      const context = 'DuckDuckGoSearchTool';
      logger.log(
        `Executing DuckDuckGo search for query: "${query}" (maxResults: ${maxResults})`,
        context,
      );

      try {
        const url = new URL('https://html.duckduckgo.com/html/');
        const body = new URLSearchParams({ q: query });

        logger.log('Sending request to DuckDuckGo HTML endpoint...', context);

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          body: body.toString(),
        });

        if (!response.ok) {
          logger.error(
            `DuckDuckGo request failed with status: ${response.status}`,
            undefined,
            context,
          );
          return `Search failed: HTTP ${response.status}. Please try again.`;
        }

        const html = await response.text();
        const results = parseHtmlResults(html, maxResults);

        if (results.length === 0) {
          logger.warn(`No results found for query: "${query}"`, context);
          return `No search results found for: "${query}"`;
        }

        logger.log(
          `Search successful for query: "${query}", got ${results.length} results`,
          context,
        );

        const formattedResults = results
          .map(
            (item, index) =>
              `${index + 1}. **${item.title}**\n   ${item.link}${item.snippet ? `\n   ${item.snippet}` : ''}`,
          )
          .join('\n\n');

        return `Web search results for "${query}":\n\n${formattedResults}`;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;

        logger.error(
          `DuckDuckGo search failed for query: "${query}" - ${errorMessage}`,
          errorStack,
          context,
        );

        return `Search failed: ${errorMessage}. Please try a different query or rephrase your search.`;
      }
    },
  });
}
