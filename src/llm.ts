// LLM provider abstraction
// Supports: OpenRouter, Anthropic, OpenAI, DeepSeek, Ollama, custom endpoints
//
// Config via env vars:
//   AISCRIBE_PROVIDER=openrouter|anthropic|openai|deepseek|custom|ollama
//   AISCRIBE_API_KEY=...          (universal key)
//   AISCRIBE_MODEL=<model-id>     (optional, overrides default)
//   AISCRIBE_BASE_URL=<url>       (for custom provider)
//   OLLAMA_HOST=http://localhost:11434  (for ollama)

import * as https from "https";
import * as http from "http";

// Types

type ProviderName = "openrouter" | "anthropic" | "openai" | "deepseek" | "custom" | "ollama";

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface ProviderConfig {
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

// Defaults

const DEFAULTS: Record<ProviderName, { model: string; baseUrl: string }> = {
  openrouter:  { model: "anthropic/claude-sonnet-4", baseUrl: "https://openrouter.ai/api/v1" },
  anthropic:   { model: "claude-sonnet-4-20250514",  baseUrl: "https://api.anthropic.com/v1" },
  openai:      { model: "gpt-4o-mini",               baseUrl: "https://api.openai.com/v1" },
  deepseek:    { model: "deepseek-chat",              baseUrl: "https://api.deepseek.com/v1" },
  custom:      { model: "gpt-4o-mini",               baseUrl: process.env.AISCRIBE_BASE_URL || "https://api.openai.com/v1" },
  ollama:      { model: "llama3.1:8b",               baseUrl: "http://localhost:11434/api" },
};

// Auto-detect provider

export function detectProvider(): ProviderName {
  const explicit = process.env.AISCRIBE_PROVIDER as ProviderName | undefined;
  if (explicit && Object.keys(DEFAULTS).includes(explicit)) return explicit;

  const key = process.env.AISCRIBE_API_KEY;
  if (key) {
    if (key.startsWith("sk-ant-")) return "anthropic";
    if (key.startsWith("sk-or-")) return "openrouter";
    if (key.startsWith("sk-")) return "openai"; // ambiguous: could be DeepSeek too. Falls back.
    return "openrouter";
  }

  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "ollama";
}

function getApiKey(provider: ProviderName): string | undefined {
  switch (provider) {
    case "openrouter": case "deepseek": case "custom":
      return process.env.AISCRIBE_API_KEY;
    case "openai":
      return process.env.AISCRIBE_API_KEY || process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.AISCRIBE_API_KEY || process.env.ANTHROPIC_API_KEY;
    case "ollama":
      return undefined;
  }
}

function buildProviderFallbackChain(detected: ProviderName): ProviderName[] {
  // If user explicitly set a provider, trust it. No fallback.
  const explicit = process.env.AISCRIBE_PROVIDER;
  if (explicit && explicit === detected) {
    return [detected];
  }

  // Only fallback when auto-detected (ambiguous sk- prefix)
  const chain = [detected];
  if (detected === "openai") chain.push("deepseek", "custom");
  else if (detected === "deepseek") chain.push("openai", "custom");
  else if (detected === "custom") chain.push("openai", "deepseek");
  return chain;
}

// Public API

export async function generateSummary(
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const provider = detectProvider();
  const apiKey = getApiKey(provider);

  if (provider !== "ollama" && !apiKey) {
    throw new Error(
      `No API key found. Set AISCRIBE_API_KEY for ${provider}.\n` +
      `Or use Ollama: AISCRIBE_PROVIDER=ollama`
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const providersToTry = buildProviderFallbackChain(provider);
  let lastError: Error | null = null;
  const tried: string[] = [];

  for (const p of providersToTry) {
    const pKey = getApiKey(p);
    if (p !== "ollama" && !pKey) continue;

    try {
      tried.push(p);
      switch (p) {
        case "openrouter": case "openai": case "deepseek": case "custom":
          return openAICompatibleChat(messages, {
            apiKey: pKey,
            model: process.env.AISCRIBE_MODEL || DEFAULTS[p].model,
            baseUrl: p === "custom" ? (process.env.AISCRIBE_BASE_URL || DEFAULTS.custom.baseUrl) : DEFAULTS[p].baseUrl,
          });
        case "anthropic":
          return anthropicChat(messages, { apiKey: pKey, model: process.env.AISCRIBE_MODEL || DEFAULTS.anthropic.model });
        case "ollama":
          return ollamaChat(messages, { model: process.env.AISCRIBE_MODEL || DEFAULTS.ollama.model });
      }
    } catch (err: any) {
      lastError = err;
      if (err.message && (err.message.includes("401") || err.message.includes("403"))) {
        continue; // fallback to next provider
      }
      throw err;
    }
  }

  const hint = `
Provider: ${tried.join(" → ")}
Tip: Verify your API key for ${provider}. Set AISCRIBE_PROVIDER=${provider} or run aiscribe setup --reconfigure.`;
  throw new Error((lastError?.message || "All providers failed") + hint);
}

// OpenAI-compatible chat (OpenAI, OpenRouter, DeepSeek, custom)

async function openAICompatibleChat(
  messages: ChatMessage[],
  config: ProviderConfig
): Promise<string> {
  if (!config.apiKey) {
    throw new Error("AISCRIBE_API_KEY is required.");
  }

  const body = JSON.stringify({
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: 2000,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  if (config.baseUrl?.includes("openrouter.ai")) {
    headers["HTTP-Referer"] = "https://github.com/aiagentflow/aiscribe";
    headers["X-Title"] = "aiscribe";
  }

  const data = await fetchJSON(config.baseUrl + "/chat/completions", {
    method: "POST",
    headers,
    body,
  });

  return data.choices[0].message.content;
}

// Anthropic (native API)

async function anthropicChat(
  messages: ChatMessage[],
  config: ProviderConfig
): Promise<string> {
  if (!config.apiKey) throw new Error("API key required for Anthropic.");

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

// Ollama (local)

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

// HTTP helper

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
      { method: options.method, headers: options.headers },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`API error (${res.statusCode}): ${body.slice(0, 300)}`));
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
      reject(new Error(
        `Network error: ${err.message}\n` +
        `Provider may be unreachable. Try a different AISCRIBE_PROVIDER.`
      ));
    });

    req.write(options.body);
    req.end();
  });
}
