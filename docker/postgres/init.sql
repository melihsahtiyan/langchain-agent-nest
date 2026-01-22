-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid-ossp for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Chat history table for storing conversation logs
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_created_at ON chat_history(created_at);

-- Documents table for storing document chunks with embeddings
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
