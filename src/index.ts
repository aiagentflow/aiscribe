#!/usr/bin/env node

import { log } from "./commands/log";
import { startServer } from "./server";
import { setupDocker } from "./setup/docker";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(`
aiscribe - Your AI's scribe. Every session, recorded.

Usage:
  aiscribe log              Journal the current git diff as a session
  aiscribe log -c           Also capture AI tool prompt history
  aiscribe setup            Generate Docker + database + web UI files
  aiscribe server           Start the web UI server (localhost:3848)
  aiscribe help             Show this help

Examples:
  aiscribe log              Summarize and store current changes
  aiscribe log -c           Include Claude Code/Cursor/Codex context
  aiscribe setup            Create .aiscribe/docker-compose.yml + init.sql
  aiscribe server           Start the session book web UI
`);
    process.exit(0);
  }

  switch (command) {
    case "log":
      await log(args.slice(1));
      break;
    case "setup":
      await runSetup();
      break;
    case "server":
      await runServer(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error(`Run 'aiscribe help' for usage.`);
      process.exit(1);
  }
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
  console.log(`\nOr use without Docker: just run 'aiscribe log' anytime.`);
}

async function runServer(args: string[]) {
  const isDocker = args.includes("--docker");
  const port = parseInt(process.env.PORT || "3848", 10);
  await startServer(port, isDocker);
}

main().catch((err) => {
  console.error("aiscribe failed:", err.message);
  process.exit(1);
});
