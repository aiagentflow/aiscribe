// aiscribe watch: auto-detect and capture AI coding sessions

import { getSessionStatus, getNewlyCompletedSessions, type AgentSession } from "../session-lifecycle";
import { bold, dim, green, yellow, red, cyan, gray } from "../terminal";

export async function status(): Promise<void> {
  const status = getSessionStatus();

  console.log("");
  console.log(bold("  AI Session Status"));
  console.log(dim(`  Checked: ${status.lastCheck}`));
  console.log("");

  if (status.activeSessions.length === 0 && status.recentSessions.length === 0) {
    console.log(gray("  No AI sessions detected for this project."));
    console.log(gray("  Start a Claude Code / Codex session to see activity."));
    console.log("");
    return;
  }

  if (status.activeSessions.length > 0) {
    console.log(green(`  ${status.activeSessions.length} active session(s):`));
    for (const s of status.activeSessions) {
      const dur = Math.round((Date.now() - s.startedAt) / 60000);
      console.log(`    ${cyan(s.name)} ${dim(`(${s.status}, ${dur}m ago)`)}`);
      console.log(`    ${dim(s.cwd)}`);
      if (s.prompts.length > 0) {
        console.log(
          `    ${dim("Latest:")} ${s.prompts[s.prompts.length - 1].slice(0, 80)}`
        );
      }
    }
    console.log("");
  }

  if (status.recentSessions.length > 0) {
    console.log(dim(`  Recent sessions:`));
    for (const s of status.recentSessions) {
      const icon =
        s.status === "complete"
          ? green("✓")
          : s.status === "failed"
            ? red("✗")
            : yellow("●");
      const dur = Math.round((Date.now() - s.updatedAt) / 60000);
      console.log(
        `    ${icon} ${s.name} ${dim(`(${s.status}, ${dur}m ago)`)}`
      );
    }
    console.log("");
  }
}

export async function watch(): Promise<void> {
  console.log("");
  console.log(bold("  AIScribe Watch"));
  console.log(dim("  Watching for AI coding sessions..."));
  console.log("");
  console.log(gray("  Waiting for sessions to complete. Press Ctrl+C to stop."));
  console.log("");

  // Show current active sessions
  const initial = getSessionStatus();
  if (initial.activeSessions.length > 0) {
    for (const s of initial.activeSessions) {
      console.log(
        `  ${yellow("●")} Active: ${bold(s.name)} ${dim(`(${s.status})`)}`
      );
    }
    console.log("");
  }

  // Poll for completed sessions
  const interval = setInterval(async () => {
    const newlyCompleted = getNewlyCompletedSessions();

    for (const s of newlyCompleted) {
      const dur = Math.round((s.updatedAt - s.startedAt) / 60000);
      console.log(`\n  ${green("✓")} Session completed: ${bold(s.name)}`);
      console.log(`  ${dim(`Duration: ${dur} min | Prompts: ${s.prompts.length}`)}`);
      console.log(`  ${dim("Run 'aiscribe log -c' to capture this session.")}`);
    }
  }, 5000); // Poll every 5 seconds

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log(`\n${gray("  Watching stopped.")}`);
    process.exit(0);
  });

  // Keep running
  await new Promise(() => {}); // Never resolves, process stays alive
}
