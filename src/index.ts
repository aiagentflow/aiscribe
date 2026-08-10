#!/usr/bin/env node

import { log } from "./commands/log";
import { startServer } from "./server";
import { setupDocker } from "./setup/docker";
import { loadConfig, applyConfig, hasEnvConfig, runOnboarding } from "./onboarding";
import { VERSION } from "./version";
import { bold, dim, green, red } from "./terminal";

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
  if (args[1] === "--help" || args[1] === "-h") {
    showCommandHelp(command);
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
    case "remote":
      await runRemote(args.slice(1));
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
  // No config? Don't block. Let log.ts handle fallback.
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

async function runRemote(args: string[]) {
  const { setRemote, disableRemote, remoteStatus } = await import("./remote");
  const sub = args[0];

  if (sub === "set" && args[1]) {
    await setRemote(args[1]);
  } else if (sub === "disable") {
    await disableRemote();
  } else {
    const status = remoteStatus();
    console.log("");
    console.log(`  Remote: ${status.configured ? status.url : "not configured"}`);
    if (status.configured) {
      console.log(`  Last sync: ${status.lastSync || "never"}`);
      console.log(`  Errors: ${status.errors}`);
    }
    console.log("");
    console.log("  Commands:");
    console.log("    aiscribe remote set <git-url>   Configure backup repo");
    console.log("    aiscribe remote disable         Disable remote backup");
    console.log("");
  }
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
    context     Export session history for AI agents
    remote      Configure git remote backup repo
    status      Show active AI coding sessions
    watch       Watch for AI sessions and auto-capture
    export      Export sessions in JSON/CSV/AI format
    sync        Push local sessions to server/DB
    server      Start the web UI server (localhost:3848)
    setup       Generate Docker files or reconfigure provider
    doctor      Check your setup for issues
    help        Show this help

  ${bold("Examples:")}
    aiscribe log                    Summarize current changes
    aiscribe log -c -n "my-feature" Capture AI context with custom name
    aiscribe search payment         Find sessions related to payment
    aiscribe history package.json   See every session touching this file
    aiscribe hotspots               What files change most often?
    aiscribe context --last 5       Export recent session history
    aiscribe export --format json   Export all sessions as JSON
    aiscribe remote set <git-url>   Configure git backup repo
    aiscribe status                 See active AI coding sessions
    aiscribe watch                  Auto-detect when sessions complete
    aiscribe server                 Browse sessions in web UI
    aiscribe doctor                 Validate your setup
    aiscribe setup --reconfigure    Change LLM provider or API key

  ${bold("Global flags:")}
    --version, -v    Show version
    --help, -h       Show help
    --json           Output as JSON
    --quiet, -q      Suppress non-essential output
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
    -c, --with-context    Capture AI tool conversation history
    -f, --full            Store raw conversation without LLM summary
    -n, --name <name>     Custom session name for the journal entry
    --since <when>        Capture context since: today, yesterday, week, 2026-08-11
    --json                Output as JSON
    --quiet, -q           Suppress progress output
    -h, --help            Show this help

  ${bold("What it does:")}
    1. Reads your git diff (staged + unstaged)
    2. Optionally captures full AI conversation (prompts, responses, tool calls)
    3. Sends to LLM for structured summarization (if API key configured)
    4. Saves as markdown in .aiscribe/sessions/
    5. Auto-generates .aiscribe/CONTEXT.md for AI agents

  ${bold("Examples:")}
    aiscribe log                Basic session journal
    aiscribe log -c             Include AI tool context
    aiscribe log -c -n "stripe" Custom name with context
    aiscribe log -f             Raw capture, no LLM needed

  ${bold("Configuration:")}
    Zero config works out of the box. Add an LLM for AI summaries:
    aiscribe setup --reconfigure    Choose provider and enter API key
    ${dim("Or set: AISCRIBE_API_KEY and AISCRIBE_PROVIDER env vars.")}
`);
}

function showSearchHelp() {
  console.log(`
  ${bold("aiscribe search")} — Find sessions by meaning

  ${bold("Usage:")}
    aiscribe search <query> [--json]

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

function showCommandHelp(cmd: string) {
  const helps: Record<string, string> = {
    context: "aiscribe context — Export session history for AI agents\n  Usage: aiscribe context [--last N] [--format plain|json]\n  aiscribe context --last 5 --format plain",
    export: "aiscribe export — Export sessions in various formats\n  Usage: aiscribe export --format json|csv|ai [--session id] [--output file]",
    sync: "aiscribe sync — Push local sessions to server\n  Usage: aiscribe sync [--dry-run] [--force]",
    remote: "aiscribe remote — Git remote backup\n  Usage: aiscribe remote              Show status\n         aiscribe remote set <url>    Configure backup repo\n         aiscribe remote disable       Turn off backup",
    doctor: "aiscribe doctor — Validate your setup\n  Checks: Node.js, Git, git repo, API key, storage, config file",
    server: "aiscribe server — Start web UI\n  Usage: aiscribe server [--docker]\n  Opens http://localhost:3848",
    hotspots: "aiscribe hotspots — Files that change most often\n  Usage: aiscribe hotspots [count]",
    history: "aiscribe history — Timeline for a file\n  Usage: aiscribe history <file-path>",
    watch: "aiscribe watch — Auto-detect AI sessions\n  Usage: aiscribe watch [--interval 30]",
    status: "aiscribe status — Active AI coding sessions\n  Usage: aiscribe status",
  };
  console.log(`\n  ${bold(helps[cmd] || `No detailed help for '${cmd}'. Run 'aiscribe help' for all commands.`)}\n`);
}

main().catch((err) => {
  console.error(red("aiscribe failed: ") + err.message);
  process.exit(1);
});
