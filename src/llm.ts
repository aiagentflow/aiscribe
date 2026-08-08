// LLM provider abstraction
// Supports: Anthropic, OpenAI, OpenRouter (200+ models), Ollama (local)
//
// Config via env vars:
//   AISCRIBE_PROVIDER=openrouter|anthropic|openai|ollama
//   AISCRIBE_API_KEY=...          (for openrouter/anthropic/openai)
//   AISCRIBE_MODEL=<model-id>     (optional, overrides default)
//   OLLAMA_HOST=http://localhost:11434  (for ollama)

import * as https from "https";
import * as http from "http";

// ── Types ──

type ProviderName = "openrouter" | "anthropic" | "openai" | "ollama";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface ProviderConfig {
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

// ── Defaults ──

const DEFAULTS: Record<ProviderName, { model: string; baseUrl: string }> = {
  openrouter: {
    model: "anthropic/claude-sonnet-4",
    baseUrl: "https://openrouter.ai/api/v1",
  },
  anthropic: {
    model: "claude-sonnet-4-20250514",
    baseUrl: "https://api.anthropic.com/v1",
  },
  openai: {
    model: "gpt-4o-mini",
    baseUrl: "https://api.openai.com/v1",
  },
  ollama: {
    model: "llama3.1:8b",
    baseUrl: "http://localhost:11434/api",
  },
};

// ── Auto-detect provider ──

export function detectProvider(): ProviderName {
  const explicit = process.env.AISCRIBE_PROVIDER as ProviderName | undefined;
  if (explicit && Object.keys(DEFAULTS).includes(explicit)) return explicit;

  // Detect by AISCRIBE_API_KEY prefix
  const key = process.env.AISCRIBE_API_KEY;
  if (key) {
    if (key.startsWith("sk-ant-")) return "anthropic";
    if (key.startsWith("sk-or-")) return "openrouter";
    if (key.startsWith("sk-")) return "openai";
    return "openrouter"; // default for unknown prefixes
  }

  // Fallback to legacy env vars
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";

  return "ollama";
}

function getApiKey(provider: ProviderName): string | undefined {
  switch (provider) {
    case "openrouter":
      return process.env.AISCRIBE_API_KEY;
    case "anthropic":
      return process.env.AISCRIBE_API_KEY || process.env.ANTHROPIC_API_KEY;
    case "openai":
      return process.env.AISCRIBE_API_KEY || process.env.OPENAI_API_KEY;
    case "ollama":
      return undefined; // No key needed
  }
}

// ── Public API ──

export async function generateSummary(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const provider = detectProvider();
  const model = process.env.AISCRIBE_MODEL || DEFAULTS[provider].model;
  const apiKey = getApiKey(provider);

  // Validate key for non-Ollama providers
  if (provider !== "ollama" && !apiKey) {
    throw new Error(
      `No API key found for ${provider}.\n` +
      `Set AISCRIBE_API_KEY (for OpenRouter) or ANTHROPIC_API_KEY or OPENAI_API_KEY.\n` +
      `Or use Ollama: AISCRIBE_PROVIDER=ollama`
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  switch (provider) {
    case "openrouter":
      return openRouterChat(messages, { apiKey, model, baseUrl: DEFAULTS.openrouter.baseUrl });
    case "anthropic":
      return anthropicChat(messages, { apiKey, model });
    case "openai":
      return openAIChat(messages, { apiKey, model });
    case "ollama":
      return ollamaChat(messages, { model });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ── OpenRouter (OpenAI-compatible) ──
// Covers: Claude, GPT, DeepSeek, Qwen, Gemini, Llama, Mistral, etc.
// Model IDs: https://openrouter.ai/models

async function openRouterChat(
  messages: ChatMessage[],
  config: ProviderConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(
      "AISCRIBE_API_KEY is required for OpenRouter.\n" +
        "Get a key: https://openrouter.ai/keys\n" +
        "Then: export AISCRIBE_API_KEY=sk-or-..."
    );
  }

  const body = JSON.stringify({
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: 2000,
  });

  const data = await fetchJSON(config.baseUrl + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
      "HTTP-Referer": "https://github.com/aiagentflow/aiscribe",
      "X-Title": "aiscribe",
    },
    body,
  });

  return data.choices[0].message.content;
}

// ── Anthropic (native API) ──

async function anthropicChat(
  messages: ChatMessage[],
  config: ProviderConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(
      "AISCRIBE_API_KEY or ANTHROPIC_API_KEY is required.\n" +
        "Then: export AISCRIBE_API_KEY=sk-ant-..."
    );
  }

  const systemMsg = messages.find((m) => m.role === "system")?.content || "";
  const userMsgs = messages.filter((m) => m.role === "user");

  const body = JSON.stringify({
    model: config.model,
    max_tokens: 2000,
    system: systemMsg,
    messages: userMsgs.map((m) => ({ role: "user", content: m.content })),
  });

  const data = await fetchJSON(DEFAULTS.anthropic.baseUrl + "/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  return data.content[0].text;
}

// ── OpenAI (native API) ──

async function openAIChat(
  messages: ChatMessage[],
  config: ProviderConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error(
      "AISCRIBE_API_KEY or OPENAI_API_KEY is required.\n" +
        "Then: export AISCRIBE_API_KEY=sk-..."
    );
  }

  const body = JSON.stringify({
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: 2000,
  });

  const data = await fetchJSON(DEFAULTS.openai.baseUrl + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body,
  });

  return data.choices[0].message.content;
}

// ── Ollama (local) ──

async function ollamaChat(
  messages: ChatMessage[],
  config: ProviderConfig
): Promise<string> {
  const baseUrl = process.env.OLLAMA_HOST || DEFAULTS.ollama.baseUrl;

  const body = JSON.stringify({
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: false,
  });

  const data = await fetchJSON(baseUrl + "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  return data.message.content;
}

// ── HTTP helper ──

async function fetchJSON(
  url: string,
  options: { method: string; headers: Record<string, string>; body: string }
): Promise<any> {
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === "https:";
  const transport = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      {
        method: options.method,
        headers: options.headers,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `API error (${res.statusCode}): ${body.slice(0, 300)}`
              )
            );
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error(`Invalid JSON response: ${body.slice(0, 200)}`));
          }
        });
      }
    );

    req.on("error", (err: Error) => {
      reject(
        new Error(
          `Network error: ${err.message}\n` +
          `Provider may be unreachable. Check your network or try a different provider.\n` +
          `Set AISCRIBE_PROVIDER to change: openrouter | anthropic | openai | ollama`
        )
      );
    });

    req.write(options.body);
    req.end();
  });
}
