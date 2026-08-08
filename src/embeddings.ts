// Vector embeddings for semantic search
// Uses OpenAI-compatible embeddings API (works with OpenRouter, OpenAI, etc.)

import { detectProvider, generateSummary } from "./llm";

export interface EmbeddingData {
  vector: number[];
  model: string;
  generated: string; // ISO timestamp
}

// Generate embedding for a text
// Falls back gracefully if no API key or embedding support
export async function generateEmbedding(text: string): Promise<EmbeddingData | null> {
  const provider = detectProvider();

  // Only attempt embeddings if we have an API key (skip Ollama)
  if (provider === "ollama") return null;

  try {
    const apiKey = process.env.AISCRIBE_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    // Use OpenAI-compatible embeddings endpoint
    // Works with: OpenAI, OpenRouter, DeepSeek
    const baseUrl = getEmbeddingBaseUrl(provider);
    const model = "text-embedding-3-small"; // 1536 dimensions, cheap

    const response = await fetch(baseUrl + "/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(baseUrl.includes("openrouter.ai")
          ? { "HTTP-Referer": "https://github.com/aiagentflow/aiscribe", "X-Title": "aiscribe" }
          : {}),
      },
      body: JSON.stringify({
        model,
        input: text.slice(0, 8000), // Truncate to safe length
      }),
    });

    if (!response.ok) {
      // Silently skip if embeddings aren't available
      return null;
    }

    const data = await response.json() as {
      data: [{ embedding: number[] }];
    };

    return {
      vector: data.data[0].embedding,
      model,
      generated: new Date().toISOString(),
    };
  } catch {
    // Embeddings are optional. Never fail the session for this.
    return null;
  }
}

function getEmbeddingBaseUrl(provider: string): string {
  switch (provider) {
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "deepseek":
      return "https://api.deepseek.com/v1";
    case "openai":
      return "https://api.openai.com/v1";
    default:
      return "https://api.openai.com/v1";
  }
}

// Cosine similarity between two vectors
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Search sessions by semantic similarity
export interface SearchResult {
  id: string;
  score: number;
  branch: string;
  date: string;
  snippet: string;
}

export function semanticSearch(
  queryEmbedding: number[],
  sessions: Array<{
    id: string;
    branch: string;
    date: string;
    summarySnippet: string;
    embedding?: number[] | null;
  }>,
  topK: number = 5
): SearchResult[] {
  return sessions
    .filter((s) => s.embedding && s.embedding.length > 0)
    .map((s) => ({
      id: s.id,
      score: cosineSimilarity(queryEmbedding, s.embedding!),
      branch: s.branch,
      date: s.date,
      snippet: s.summarySnippet.slice(0, 200),
    }))
    .filter((s) => s.score > 0.3) // Minimum relevance threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
