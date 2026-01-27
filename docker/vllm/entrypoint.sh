#!/bin/bash
set -e

echo "=== vLLM Entrypoint ==="
echo "LLM Model: ${MODEL}"
echo "Embedding Model: ${EMBEDDING_MODEL:-Xenova/all-MiniLM-L6-v2}"

# Download LLM model
if [ -n "${MODEL}" ]; then
    echo "Downloading LLM model (this may take a while)..."
    huggingface-cli download "${MODEL}"
    echo "LLM model download complete."
fi

# Download embedding model (for the NestJS app to use via shared cache)
EMBEDDING_MODEL="${EMBEDDING_MODEL:-Xenova/all-MiniLM-L6-v2}"
if [ -n "${EMBEDDING_MODEL}" ]; then
    echo "Downloading embedding model: ${EMBEDDING_MODEL}..."
    huggingface-cli download "${EMBEDDING_MODEL}"
    echo "Embedding model download complete."
fi

echo "Starting vLLM server..."
exec "$@"
