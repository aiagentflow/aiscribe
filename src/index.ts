#!/usr/bin/env node

import { log } from "./commands/log";
import { startServer } from "./server";
import { setupDocker } from "./setup/docker";
import { loadConfig, applyConfig, hasEnvConfig, runOnboarding, saveConfig } from "./onboarding";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    showHelp();
    process.exit(0);
  }

  switch (command) {
    case "log":
      await ensureConfig();
      await log(args.slice(1));
      break;
    case "search":
      await ensureConfigOrWarn();
      const { search } = await import("./commands/search");
      await search(args.slice(1));
      break;
    case "setup":
      if (args.includes("--reconfigure")) {
        const config = await runOnboarding();
        applyConfig(config);
        console.log("Reconfigured. Run 'aiscribe log' to get started.");
      } else {
        await runSetup();
      }
      break;
    case "server":
      ensureConfigOrWarn();
      await runServer(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error("Run 'aiscribe help' for usage.");
      process.exit(1);
  }
}

async function ensureConfig(): Promise<void> {
  // Already have env vars set
  if (hasEnvConfig()) return;

  // Load saved config
  const saved = loadConfig();
  if (saved) {
    applyConfig(saved);
    return;
  }

  // First run: onboard
  console.log("First time setup: configure your LLM provider.\n");
  const config = await runOnboarding();
  applyConfig(config);
}

function ensureConfigOrWarn(): void {
  if (hasEnvConfig()) return;
  const saved = loadConfig();
  if (saved) {
    applyConfig(saved);
    return;
  }
  console.log("No API key configured. The web UI will work but summaries need a key.");
  console.log("Run 'aiscribe setup --reconfigure' to configure.");
}

async function runSetup() {
  console.log("Setting up AIScribe Docker environment...\n");
  const result = setupDocker();
  console.log("Generated files:");
  for (const f of result.files) {
    console.log(`  ${f}`);
  }
  console.log(`\nNext steps:`);
  console.log(`  1. cd .aiscribe && docker-compose up -d`);
  console.log(`  2. aiscribe server       (starts the web UI)`);
  console.log(`  3. Open http://localhost:3848`);
  console.log(`\nTo change LLM provider: aiscribe setup --reconfigure`);
  console.log(`\nOr use without Docker: just run 'aiscribe log' anytime.`);
}

async function runServer(args: string[]) {
  const isDocker = args.includes("--docker");
  const port = parseInt(process.env.PORT || "3848", 10);
  await startServer(port, isDocker);
}

function showHelp() {
  console.log(`
aiscribe - Your AI's scribe. Every session, recorded.

Usage:
  aiscribe log              Journal the current git diff as a session
  aiscribe log -c           Also capture AI tool prompt history
  aiscribe search <query>   Search sessions by meaning or keyword
  aiscribe setup            Generate Docker + database + web UI files
  aiscribe setup --reconfigure  Change LLM provider or API key
  aiscribe server           Start the web UI server (localhost:3848)
  aiscribe help             Show this help

Examples:
  aiscribe log              Summarize and store current changes
  aiscribe log -c           Include Claude Code/Cursor/Codex context
  aiscribe search payment   Find sessions related to payment code
  aiscribe server           Start the session book web UI

Configuration:
  On first run, AIScribe will ask you to select a provider and enter
  your API key. Config is saved to ~/.aiscribe/config.json
  Or use env vars: AISCRIBE_PROVIDER and AISCRIBE_API_KEY
`);
}

main().catch((err) => {
  console.error("aiscribe failed:", err.message);
  process.exit(1);
});
