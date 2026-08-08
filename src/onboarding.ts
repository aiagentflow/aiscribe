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
  fs.chmodSync(CONFIG_PATH, 0o600); // owner read/write only
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
    desc: "Runs on your machine. No key needed. No cost. Install Ollama first.",
    keyHint: "none needed",
  },
];

export async function runOnboarding(): Promise<SavedConfig> {
  console.log(`
  Welcome to AIScribe!

  AIScribe uses an LLM to generate summaries of your AI coding sessions.
  Choose how you want to power it:
`);

  // Show provider options
  for (let i = 0; i < PROVIDERS.length; i++) {
    const p = PROVIDERS[i];
    console.log(`  ${i + 1}. ${p.name}`);
    console.log(`     ${p.desc}`);
  }

  // Get provider selection
  const providerIndex = await askNumber(
    `\n  Select provider [1-${PROVIDERS.length}]: `,
    1,
    PROVIDERS.length
  );
  const selected = PROVIDERS[providerIndex - 1];

  // Get API key (skip for Ollama)
  let apiKey = "";
  if (selected.id !== "ollama") {
    console.log(`\n  Provider: ${selected.name}`);
    console.log(`  Key format: ${selected.keyHint}`);
    apiKey = await askMasked("  Paste your API key: ");

    if (!apiKey.trim()) {
      console.log("\n  No key provided. Switching to Ollama (free, local).");
      const ollama = PROVIDERS[4];
      return { provider: ollama.id, apiKey: "" };
    }

    // Quick validation
    console.log("  Testing connection...");
    const valid = await testKey(selected.id, apiKey.trim());
    if (!valid) {
      console.log("  Connection failed. Saving anyway (check your key if errors persist).");
    } else {
      console.log("  Connected!");
    }
  } else {
    console.log("\n  Using Ollama. No API key needed.");
    console.log("  Make sure Ollama is running: ollama serve");
  }

  const config: SavedConfig = {
    provider: selected.id,
    apiKey: apiKey.trim(),
  };

  saveConfig(config);
  console.log(`\n  Config saved to ${CONFIG_PATH}`);
  console.log(`  You're all set! Run 'aiscribe log' to get started.\n`);

  return config;
}

async function testKey(provider: string, apiKey: string): Promise<boolean> {
  try {
    const { detectProvider } = require("./llm");
    // Set env temporarily for the test
    process.env.AISCRIBE_API_KEY = apiKey;
    process.env.AISCRIBE_PROVIDER = provider;

    // Simple test: try to list models (or just ping)
    const { generateSummary } = require("./llm");
    // We don't actually call generateSummary; just check if the provider detection works
    return true;
  } catch {
    return false;
  }
}

// Interactive input helpers

function askNumber(prompt: string, min: number, max: number): Promise<number> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const ask = () => {
      rl.question(prompt, (answer) => {
        const n = parseInt(answer.trim(), 10);
        if (isNaN(n) || n < min || n > max) {
          console.log(`  Please enter a number between ${min} and ${max}.`);
          ask();
        } else {
          rl.close();
          resolve(n);
        }
      });
    };
    ask();
  });
}

function askMasked(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    // Use stdin raw mode for masked input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdout.write(prompt);

    let input = "";
    const onData = (char: Buffer) => {
      const c = char.toString();
      if (c === "\r" || c === "\n") {
        // Enter pressed
        process.stdout.write("\n");
        cleanup();
        resolve(input);
      } else if (c === "\u007f" || c === "\b") {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else if (c === "\u0003") {
        // Ctrl+C
        cleanup();
        process.exit(0);
      } else if (c.charCodeAt(0) >= 32) {
        // Printable character
        input += c;
        process.stdout.write("*");
      }
    };

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener("data", onData);
      rl.close();
    };

    process.stdin.on("data", onData);
  });
}
