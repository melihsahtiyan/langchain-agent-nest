import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { VectorStoreAdapter } from '../../../infrastructure/langchain/vector-store.adapter';

export function createDocumentSearchTool(
  vectorStore: VectorStoreAdapter,
  similarityThreshold: number = 0.7,
) {
  return new DynamicStructuredTool({
    name: 'search_documents',
    description:
      'Search the knowledge base for relevant documents. Use this when you need to find information from stored documents.',
    schema: z.object({
      query: z.string().describe('The search query to find relevant documents'),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe('Maximum number of documents to return'),
    }),
    func: async ({ query, limit }) => {
      const results = await vectorStore.similaritySearchWithScore(
        query,
        limit,
        similarityThreshold,
      );

      if (results.length === 0) {
        return 'No relevant documents found.';
      }

      const formattedResults = results
        .map((result, index) => {
          const metadata = result.document.metadata as Record<string, unknown>;
          const source =
            typeof metadata?.source === 'string' ? metadata.source : 'Unknown';
          const title =
            typeof metadata?.title === 'string' ? metadata.title : 'Untitled';
          const score = (result.score * 100).toFixed(1);
          return `[${index + 1}] (${score}% match) ${title} (${source})\n${result.document.pageContent}`;
        })
        .join('\n\n---\n\n');

      return formattedResults;
    },
  });
}
