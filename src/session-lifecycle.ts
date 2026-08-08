// Session lifecycle detector
// Reads AI agent session state from disk to detect active sessions
// Optimized: uses mtime comparison and caching to minimize disk I/O

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface AgentSession {
  sessionId: string;
  tool: string;
  cwd: string;
  name: string;
  status: "waiting" | "running" | "complete" | "failed" | "unknown";
  startedAt: number;
  updatedAt: number;
  prompts: string[];
}

export interface SessionStatus {
  activeSessions: AgentSession[];
  recentSessions: AgentSession[];
  lastCheck: string;
}

// Cache: avoid re-reading files that haven't changed
const fileCache = new Map<string, { mtime: number; data: string }>();
const sessionCache = new Map<string, AgentSession>();
const processedSessions = new Set<string>();
let lastFullScan = 0;
const FULL_SCAN_INTERVAL = 30000; // Full scan every 30s

function readFileIfChanged(filepath: string): string | null {
  try {
    const stat = fs.statSync(filepath);
    const cached = fileCache.get(filepath);
    if (cached && cached.mtime === stat.mtimeMs) {
      return null; // Not changed
    }
    const data = fs.readFileSync(filepath, "utf-8");
    fileCache.set(filepath, { mtime: stat.mtimeMs, data });
    return data;
  } catch {
    fileCache.delete(filepath);
    return null;
  }
}

// Read Claude Code sessions from ~/.claude/sessions/
function readClaudeSessions(): AgentSession[] {
  const sessionsDir = path.join(os.homedir(), ".claude", "sessions");
  if (!fs.existsSync(sessionsDir)) return [];

  const sessions: AgentSession[] = [];
  const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    try {
      const raw = JSON.parse(
        fs.readFileSync(path.join(sessionsDir, file), "utf-8")
      );

      // Skip non-project sessions
      if (!raw.cwd) continue;

      // Map Claude Code status
      let status: AgentSession["status"] = "unknown";
      if (raw.status === "waiting") status = "waiting";
      else if (raw.status === "running") status = "running";
      else if (raw.status === "complete" || raw.status === "completed")
        status = "complete";
      else if (raw.status === "failed") status = "failed";

      const session: AgentSession = {
        sessionId: raw.sessionId || file.replace(".json", ""),
        tool: "claude-code",
        cwd: raw.cwd,
        name: raw.name || "unnamed",
        status,
        startedAt: raw.startedAt || raw.updatedAt || 0,
        updatedAt: raw.updatedAt || 0,
        prompts: [],
      };

      sessions.push(session);
    } catch {
      // Skip malformed files
    }
  }

  return sessions;
}

// Read Claude Code prompts for a given project
function readClaudePrompts(cwd: string): string[] {
  const historyPath = path.join(os.homedir(), ".claude", "history.jsonl");
  if (!fs.existsSync(historyPath)) return [];

  const prompts: string[] = [];
  const content = fs.readFileSync(historyPath, "utf-8");

  for (const line of content.trim().split("\n")) {
    try {
      const entry = JSON.parse(line);
      if (
        entry.project === cwd ||
        cwd.startsWith(entry.project) ||
        entry.project?.startsWith(cwd)
      ) {
        prompts.push(entry.display || "");
      }
    } catch {}
  }

  return prompts;
}

// Get sessions for the current project directory
export function getCurrentProjectSessions(): AgentSession[] {
  const cwd = process.cwd();
  const allSessions = readClaudeSessions();

  return allSessions
    .filter((s) => {
      // Match by cwd
      return (
        s.cwd === cwd ||
        cwd.startsWith(s.cwd) ||
        s.cwd.startsWith(cwd)
      );
    })
    .map((s) => ({
      ...s,
      prompts: readClaudePrompts(s.cwd),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// Get session status for display
export function getSessionStatus(): SessionStatus {
  const allSessions = readClaudeSessions();
  const projectSessions = getCurrentProjectSessions();

  return {
    activeSessions: projectSessions.filter(
      (s) => s.status === "running" || s.status === "waiting"
    ),
    recentSessions: projectSessions.slice(0, 5),
    lastCheck: new Date().toISOString(),
  };
}

// Watch for newly completed sessions that haven't been processed yet
export function getNewlyCompletedSessions(): AgentSession[] {
  const projectSessions = getCurrentProjectSessions();
  const newlyCompleted: AgentSession[] = [];

  for (const s of projectSessions) {
    // Skip sessions we've already seen
    if (!seenSessions.has(s.sessionId)) {
      seenSessions.add(s.sessionId);
    }

    // Return sessions that just completed and haven't been processed
    if (
      (s.status === "complete" || s.status === "failed") &&
      !processedSessions.has(s.sessionId)
    ) {
      processedSessions.add(s.sessionId);
      newlyCompleted.push(s);
    }
  }

  return newlyCompleted;
}

// Reset processed cache (for testing or re-processing)
export function resetProcessedCache(): void {
  processedSessions.clear();
}
