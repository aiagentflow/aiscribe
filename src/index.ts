#!/usr/bin/env node

import { log } from "./commands/log";
import { startServer } from "./server";
import { setupDocker } from "./setup/docker";
import { loadConfig, applyConfig, hasEnvConfig, runOnboarding, saveConfig } from "./onboarding";
import { VERSION } from "./version";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  // Global flags
  if (command === "--version" || command === "-V" || command === "-v") {
    console.log(`aiscribe v${VERSION}`);
    process.exit(0);
  }

  if (!command || command === "help" || command === "--help" || command === "-h") {
    showGlobalHelp();
    process.exit(0);
  }

  // Command-specific help
  if (command === "log" && (args[1] === "--help" || args[1] === "-h")) {
    showLogHelp();
    process.exit(0);
  }
  if (command === "search" && (args[1] === "--help" || args[1] === "-h")) {
    showSearchHelp();
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
    case "hotspots":
      const { hotspots } = await import("./commands/patterns");
      await hotspots(args.slice(1));
      break;
    case "history":
      const { history } = await import("./commands/patterns");
      await history(args.slice(1));
      break;
    case "doctor":
      const { doctor } = await import("./commands/doctor");
      await doctor();
      break;
    case "status":
      const { status } = await import("./commands/watch");
      await status();
      break;
    case "watch":
      const { watch } = await import("./commands/watch");
      await watch();
      break;
    case "context":
      const { context } = await import("./commands/context");
      await context(args.slice(1));
      break;
    case "sync":
      const { sync } = await import("./commands/sync");
      await sync(args.slice(1));
      break;
    case "export":
      const { exportSessions } = await import("./commands/export");
      await exportSessions(args.slice(1));
      break;
    case "setup":
      if (args.includes("--reconfigure")) {
        const cfg = await runOnboarding();
        applyConfig(cfg);
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
  if (hasEnvConfig()) return;
  const saved = loadConfig();
  if (saved) { applyConfig(saved); return; }
  const cfg = await runOnboarding();
  applyConfig(cfg);
}

function ensureConfigOrWarn(): void {
  if (hasEnvConfig()) return;
  const saved = loadConfig();
  if (saved) { applyConfig(saved); return; }
  console.log("No API key. Run 'aiscribe setup --reconfigure' to configure.");
}

async function runSetup() {
  console.log("Setting up AIScribe Docker environment...\n");
  const result = setupDocker();
  console.log("Generated files:");
  for (const f of result.files) console.log(`  ${f}`);
  console.log(`\nNext steps:`);
  console.log(`  1. cd .aiscribe && docker-compose up -d`);
  console.log(`  2. aiscribe server`);
  console.log(`  3. Open http://localhost:3848`);
  console.log(`\nTo change LLM provider: aiscribe setup --reconfigure`);
}

async function runServer(args: string[]) {
  const isDocker = args.includes("--docker");
  const port = parseInt(process.env.PORT || "3848", 10);
  await startServer(port, isDocker);
}

// ── Help ──

function showGlobalHelp() {
  console.log(`
  aiscribe v${VERSION} — Your AI's scribe. Every session, recorded.

  ${bold("Usage:")}
    aiscribe <command> [options]

  ${bold("Commands:")}
    log         Journal the current git diff as a session
    search      Search sessions by meaning or keyword
    hotspots    Show files that change most often
    history     Show session timeline for a file
    status      Show active AI coding sessions
    watch       Watch for AI sessions and auto-capture
    server      Start the web UI server (localhost:3848)
    setup       Generate Docker files or reconfigure provider
    doctor      Check your setup for issues
    help        Show this help

  ${bold("Examples:")}
    aiscribe log                    Summarize current changes
    aiscribe log -c                 Include AI tool prompt history
    aiscribe search payment         Find sessions related to payment
    aiscribe history payment.ts     See every session touching this file
    aiscribe hotspots               What files change most often?
    aiscribe status                 See active Claude Code sessions
    aiscribe watch                  Auto-detect when sessions complete
    aiscribe server                 Browse sessions in web UI
    aiscribe doctor                 Validate your setup
    aiscribe setup --reconfigure    Change LLM provider or API key

  ${bold("Global flags:")}
    --version, -v    Show version
    --help, -h       Show help
    <command> --help Show help for a specific command

  ${dim("Run 'aiscribe doctor' to check your setup.")}
`);
}

function showLogHelp() {
  console.log(`
  ${bold("aiscribe log")} — Journal the current git diff

  ${bold("Usage:")}
    aiscribe log [flags]

  ${bold("Flags:")}
    -c, --with-context    Capture AI tool prompt history
    --json                Output as JSON (not yet implemented)
    -h, --help            Show this help

  ${bold("What it does:")}
    1. Reads your git diff (staged + unstaged)
    2. Optionally captures prompts from Claude Code, Codex, or Aider
    3. Sends to LLM for structured summarization
    4. Saves as markdown in .aiscribe/sessions/

  ${bold("Examples:")}
    aiscribe log                Basic session journal
    aiscribe log -c             Include AI tool context
    aiscribe log --with-context Same as -c

  ${bold("Configuration:")}
    First run asks you to select a provider and enter an API key.
    Saved to ~/.aiscribe/config.json — never asked again.
    Or set: AISCRIBE_API_KEY and AISCRIBE_PROVIDER env vars.
`);
}

function showSearchHelp() {
  console.log(`
  ${bold("aiscribe search")} — Find sessions by meaning

  ${bold("Usage:")}
    aiscribe search <query>

  ${bold("How it works:")}
    With API key: semantic search using vector embeddings
    Without API key: keyword search across branches and files

  ${bold("Examples:")}
    aiscribe search payment      Find payment-related sessions
    aiscribe search auth bug     Find auth bug fix sessions

  ${bold("Tip:")}
    Add an API key for smarter semantic search that finds
    related sessions even without matching keywords.
`);
}

// ── Hacks ──

// Quick bold/dim helpers for help text (no terminal module needed)
function bold(s: string): string { return `\x1b[1m${s}\x1b[0m`; }
function dim(s: string): string { return `\x1b[2m${s}\x1b[0m`; }
function green(s: string): string { return `\x1b[32m${s}\x1b[0m`; }
function red(s: string): string { return `\x1b[31m${s}\x1b[0m`; }

main().catch((err) => {
  console.error(red("aiscribe failed: ") + err.message);
  process.exit(1);
});
