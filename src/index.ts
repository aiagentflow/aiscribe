#!/usr/bin/env node

import { log } from "./commands/log";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(`
aiscribe — Your AI's scribe. Every session, recorded.

Usage:
  aiscribe log          Journal the current git diff as a session
  aiscribe help         Show this help

Examples:
  aiscribe log          # Summarize and store current changes
`);
    process.exit(0);
  }

  switch (command) {
    case "log":
      await log(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error(`Run 'aiscribe help' for usage.`);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("aiscribe failed:", err.message);
  process.exit(1);
});
