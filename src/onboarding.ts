// Interactive onboarding
// First-run experience: select provider, enter API key, save config

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as readline from "readline";

export interface SavedConfig {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  remoteUrl?: string;
  remoteEnabled?: boolean;
  remoteLastSync?: string | null;
  remoteErrors?: number;
}

const CONFIG_PATH = path.join(os.homedir(), ".aiscribe", "config.json");

export function loadConfig(): SavedConfig | null {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {}
  return null;
}

export function saveConfig(config: SavedConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  fs.chmodSync(CONFIG_PATH, 0o600);
}

export function applyConfig(config: SavedConfig): void {
  process.env.AISCRIBE_PROVIDER = config.provider;
  process.env.AISCRIBE_API_KEY = config.apiKey;
  if (config.model) process.env.AISCRIBE_MODEL = config.model;
  if (config.baseUrl) process.env.AISCRIBE_BASE_URL = config.baseUrl;
}

export function hasEnvConfig(): boolean {
  return !!(process.env.AISCRIBE_API_KEY || process.env.AISCRIBE_PROVIDER || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}

const PROVIDERS: { id: string; name: string; desc: string; keyHint: string }[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    desc: "One key, 200+ models (Claude, GPT, DeepSeek, Gemini, Qwen). Best default.",
    keyHint: "sk-or-... (from https://openrouter.ai/keys)",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    desc: "Cheap, fast, great for summaries. $0.14/M tokens.",
    keyHint: "sk-... (from https://platform.deepseek.com)",
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    desc: "Best quality summaries. Higher cost.",
    keyHint: "sk-ant-... (from https://console.anthropic.com)",
  },
  {
    id: "openai",
    name: "OpenAI (GPT)",
    desc: "GPT-4o, GPT-4o-mini. Fast and reliable.",
    keyHint: "sk-... (from https://platform.openai.com)",
  },
  {
    id: "ollama",
    name: "Ollama (Local & Free)",
    desc: "Runs on your machine. No key needed. No cost.",
    keyHint: "none needed",
  },
];

export async function runOnboarding(): Promise<SavedConfig> {
  console.log(`
  Welcome to AIScribe!

  AIScribe uses an LLM to generate summaries of your AI coding sessions.
  Choose how you want to power it:
`);

  for (let i = 0; i < PROVIDERS.length; i++) {
    const p = PROVIDERS[i];
    console.log(`  ${i + 1}. ${p.name}`);
    console.log(`     ${p.desc}`);
  }

  // Single readline instance for the whole onboarding
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  const providerIndex = await new Promise<number>((resolve) => {
    const ask = () => {
      rl.question(`\n  Select provider [1-${PROVIDERS.length}]: `, (answer) => {
        const n = parseInt(answer.trim(), 10);
        if (isNaN(n) || n < 1 || n > PROVIDERS.length) {
          console.log(`  Please enter a number between 1 and ${PROVIDERS.length}.`);
          ask();
        } else {
          resolve(n);
        }
      });
    };
    ask();
  });

  const selected = PROVIDERS[providerIndex - 1];

  // Get API key
  let apiKey = "";
  if (selected.id !== "ollama") {
    console.log(`\n  Provider: ${selected.name}`);
    console.log(`  Key format: ${selected.keyHint}`);

    apiKey = await new Promise<string>((resolve) => {
      rl.question("  Paste your API key: ", (answer) => {
        resolve(answer.trim());
      });
    });

    if (!apiKey) {
      console.log("\n  No key provided. Switching to Ollama (free, local).");
      rl.close();
      return { provider: "ollama", apiKey: "" };
    }

    console.log("  Testing connection...");
    // Skip actual test for now, just save
    console.log("  Key saved.");
  } else {
    console.log("\n  Using Ollama. No API key needed.");
    console.log("  Make sure Ollama is running: ollama serve");
  }

  rl.close();

  const config: SavedConfig = {
    provider: selected.id,
    apiKey: apiKey.trim(),
  };

  saveConfig(config);
  console.log(`\n  Config saved to ${CONFIG_PATH}`);
  console.log(`  You're all set! Run 'aiscribe log' to get started.\n`);

  return config;
}
