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
    name: "Ollama (Local and Free)",
    desc: "Runs on your machine. No key needed. No cost.",
    keyHint: "none needed",
  },
];

// Interactive arrow-key selector
function selectProvider(rl: readline.Interface): Promise<number> {
  return new Promise((resolve) => {
    let selected = 0;

    const render = () => {
      // Clear previous render
      for (let i = 0; i < PROVIDERS.length + 2; i++) {
        process.stdout.write("\x1b[1A\x1b[2K");
      }
      for (let i = 0; i < PROVIDERS.length; i++) {
        const p = PROVIDERS[i];
        const prefix = i === selected ? "\x1b[1;36m❯\x1b[0m" : " ";
        const name = i === selected ? `\x1b[1;37m${p.name}\x1b[0m` : `\x1b[2m${p.name}\x1b[0m`;
        const desc = i === selected ? `\x1b[36m${p.desc}\x1b[0m` : `\x1b[2m${p.desc}\x1b[0m`;
        process.stdout.write(`  ${prefix} ${name}\n     ${desc}\n`);
      }
      process.stdout.write("\n  \x1b[2m↑↓ to move, enter to select\x1b[0m\n");
    };

    const onData = (key: Buffer) => {
      const k = key.toString();
      if (k === "\x1b[A" || k === "k") {
        // Up arrow
        selected = selected > 0 ? selected - 1 : PROVIDERS.length - 1;
        render();
      } else if (k === "\x1b[B" || k === "j") {
        // Down arrow
        selected = selected < PROVIDERS.length - 1 ? selected + 1 : 0;
        render();
      } else if (k === "\r" || k === "\n") {
        // Enter
        process.stdin.removeListener("data", onData);
        process.stdin.setRawMode(false);
        resolve(selected + 1);
      } else if (k === "\x03") {
        // Ctrl+C
        process.exit(0);
      }
    };

    process.stdin.setRawMode(true);
    process.stdin.on("data", onData);
    render();
  });
}

export async function runOnboarding(): Promise<SavedConfig> {
  console.log(`
  Welcome to AIScribe!

  AIScribe uses an LLM to generate summaries of your AI coding sessions.
  Choose how you want to power it:
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const providerIndex = await selectProvider(rl);
  const selected = PROVIDERS[providerIndex - 1];

  console.log(`\n  Selected: ${selected.name}`);

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
