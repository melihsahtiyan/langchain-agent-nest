import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { DocumentRepository } from '../../document/repositories/document.repository';

export function createDocumentRetentionTool(
  documentRepository: DocumentRepository,
) {
  return new DynamicStructuredTool({
    name: 'promote_document_to_knowledge',
    description: `Call this tool to permanently save a document that contains valuable reference material to the knowledge base.

USE this tool when the attached document is:
- Reference documentation or manuals
- Technical guides or tutorials
- Important policies or procedures
- Educational materials worth keeping
- Any content the user explicitly wants to keep permanently

DO NOT use this tool when the document is:
- A one-time task (summarizing a receipt, extracting specific data)
- A temporary file the user won't need again
- Content that's already been fully processed for the user's request

The document will be promoted from temporary (24h TTL) to permanent storage.`,
    schema: z.object({
      documentGroupId: z
        .string()
        .describe(
          'The documentGroupId of the attached document to promote to permanent storage',
        ),
      reason: z
        .string()
        .describe(
          'Brief explanation of why this document should be kept permanently (e.g., "User manual with valuable reference information")',
        ),
    }),
    func: async ({ documentGroupId, reason }) => {
      try {
        // Find all chunks belonging to this document group
        const documents =
          await documentRepository.findByDocumentGroupId(documentGroupId);

        if (documents.length === 0) {
          return `No documents found with group ID: ${documentGroupId}. The document may have already expired or been deleted.`;
        }

        // Promote all chunks to permanent storage
        const ids = documents.map((doc) => doc.id);
        await documentRepository.promoteToKnowledge(ids);

        const title = documents[0].metadata?.title || 'Untitled';
        return `Successfully promoted "${title}" (${documents.length} chunks) to permanent knowledge base. Reason: ${reason}`;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return `Failed to promote document: ${errorMessage}`;
      }
    },
  });
}
