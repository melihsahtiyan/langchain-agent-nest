import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { DuckDuckGoSearch } from '@langchain/community/tools/duckduckgo_search';

export function createWebSearchTool() {
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
      try {
        const searchTool = new DuckDuckGoSearch({ maxResults });
        const results: string = (await searchTool.invoke(query)) as string;

        if (!results || results.trim() === '') {
          return `No search results found for: "${query}"`;
        }

        return `Web search results for "${query}":\n\n${results}`;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return `Search failed: ${errorMessage}. Please try a different query or rephrase your search.`;
      }
    },
  });
}
