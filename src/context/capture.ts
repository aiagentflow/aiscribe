// AI tool context capture
// Detects and reads conversation history from Claude Code, Codex, etc.
// Matches sessions to the current git repository.

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── Types ──

export interface CapturedPrompt {
  text: string;
  timestamp: number;
  sessionId: string;
  tool: string;
}

export interface CapturedSession {
  sessionId: string;
  tool: string;
  startedAt?: number;
  prompts: CapturedPrompt[];
  projectPath: string;
}

// ── Claude Code ──

function getClaudeHistoryPath(): string {
  return path.join(os.homedir(), ".claude", "history.jsonl");
}

// ── Pi (this agent) ──

function getPiSessionFile(): string | null {
  return process.env.PI_SESSION_FILE || null;
}

function getPiSessionsDir(): string {
  return path.join(os.homedir(), ".pi", "agent", "sessions");
}

async function readPiHistory(cwd: string): Promise<CapturedPrompt[]> {
  const prompts: CapturedPrompt[] = [];

  // Pi stores sessions in ~/.pi/agent/sessions/<project-path-encoded>/
  const sessionsDir = getPiSessionsDir();
  if (!fs.existsSync(sessionsDir)) return [];

  // Find session directory that matches current project
  // Pi encodes paths: /media/raj/Work1/aiscribe becomes --media-raj-Work1-aiscribe--
  let matchingDir: string | null = null;
  const dirs = fs.readdirSync(sessionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dir of dirs) {
    const decoded = dir.name
      .replace(/^--/, "")      // Remove leading --
      .replace(/--$/, "")      // Remove trailing --
      .replace(/-/g, "/");     // Convert dashes back to slashes
    if (cwd === decoded || cwd.startsWith(decoded) || decoded.startsWith(cwd)) {
      matchingDir = path.join(sessionsDir, dir.name);
      break;
    }
  }

  // If no matching project dir, try PI_SESSION_FILE as fallback
  const sessionFile = matchingDir
    ? getLatestSessionFile(matchingDir)
    : (getPiSessionFile() && fs.existsSync(getPiSessionFile()!) ? getPiSessionFile()! : null);

  if (!sessionFile) return [];

  const sessionId = path.basename(sessionFile, ".jsonl");
  const content = fs.readFileSync(sessionFile, "utf-8");

  for (const line of content.trim().split("\n")) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (!msg || msg.role !== "user" || !msg.content) continue;
      const text = extractPiText(msg.content);
      if (text) {
        prompts.push({
          text,
          timestamp: msg.timestamp || 0,
          sessionId,
          tool: "pi",
        });
      }
    } catch {}
  }

  return prompts;
}

function getLatestSessionFile(projectDir: string): string | null {
  const files = fs.readdirSync(projectDir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort();
  return files.length > 0 ? path.join(projectDir, files[files.length - 1]) : null;
}

function extractPiText(content: Array<{ type: string; text?: string }>): string {
  if (!Array.isArray(content)) return "";
  const textBlock = content.find((c) => c.type === "text" && c.text);
  return textBlock?.text?.trim() || "";
}

function getClaudeSessionsDir(): string {
  return path.join(os.homedir(), ".claude", "sessions");
}

async function readClaudeHistory(cwd: string): Promise<CapturedPrompt[]> {
  const historyPath = getClaudeHistoryPath();
  if (!fs.existsSync(historyPath)) return [];

  const content = fs.readFileSync(historyPath, "utf-8");
  const lines = content.trim().split("\n");

  const prompts: CapturedPrompt[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      // Match by project path
      if (entry.project === cwd || cwd.startsWith(entry.project) || entry.project?.startsWith(cwd)) {
        prompts.push({
          text: entry.display || "",
          timestamp: entry.timestamp || 0,
          sessionId: entry.sessionId || "unknown",
          tool: "claude-code",
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return prompts;
}

// ── Codex (OpenAI) ──

function getCodexHistoryPath(): string {
  return path.join(os.homedir(), ".codex", "history.jsonl");
}

async function readCodexHistory(cwd: string): Promise<CapturedPrompt[]> {
  const historyPath = getCodexHistoryPath();
  if (!fs.existsSync(historyPath)) return [];

  const content = fs.readFileSync(historyPath, "utf-8");
  const lines = content.trim().split("\n");

  const prompts: CapturedPrompt[] = [];

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      // Codex stores cwd or project field
      const projectPath = entry.project || entry.cwd || "";
      if (projectPath === cwd || cwd.startsWith(projectPath) || projectPath.startsWith(cwd)) {
        prompts.push({
          text: entry.prompt || entry.display || entry.message || "",
          timestamp: entry.timestamp || 0,
          sessionId: entry.sessionId || entry.session_id || "unknown",
          tool: "codex",
        });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return prompts;
}

// ── Aider ──

function getAiderHistoryPath(cwd: string): string {
  // Aider stores .aider.chat.history.md in the project directory
  return path.join(cwd, ".aider.chat.history.md");
}

async function readAiderHistory(cwd: string): Promise<CapturedPrompt[]> {
  const historyPath = getAiderHistoryPath(cwd);
  if (!fs.existsSync(historyPath)) return [];

  const content = fs.readFileSync(historyPath, "utf-8");
  // Aider history is markdown, each prompt is a section
  const prompts: CapturedPrompt[] = [];
  const lines = content.split("\n");

  let currentPrompt = "";
  for (const line of lines) {
    if (line.startsWith("#### ") || line.startsWith("## ")) {
      if (currentPrompt.trim()) {
        prompts.push({
          text: currentPrompt.trim(),
          timestamp: 0,
          sessionId: "aider-session",
          tool: "aider",
        });
      }
      currentPrompt = "";
    } else if (line.trim()) {
      currentPrompt += line + "\n";
    }
  }

  // Last prompt
  if (currentPrompt.trim()) {
    prompts.push({
      text: currentPrompt.trim(),
      timestamp: 0,
      sessionId: "aider-session",
      tool: "aider",
    });
  }

  return prompts;
}

// ── Main API ──

export interface ContextResult {
  tool: string | null;
  prompts: CapturedPrompt[];
  sessionCount: number;
  recentPrompt: string | null;
  fullContext: string; // Full conversation context for LLM prompt
}

export async function captureContext(cwd: string): Promise<ContextResult> {
  const allPrompts: CapturedPrompt[] = [];

  // Try each tool
  const claudePrompts = await readClaudeHistory(cwd);
  const codexPrompts = await readCodexHistory(cwd);
  const aiderPrompts = await readAiderHistory(cwd);
  const piPrompts = await readPiHistory(cwd);

  allPrompts.push(...claudePrompts, ...codexPrompts, ...aiderPrompts, ...piPrompts);

  // Sort by timestamp (most recent first)
  allPrompts.sort((a, b) => b.timestamp - a.timestamp);

  // Deduplicate by text
  const seen = new Set<string>();
  const unique: CapturedPrompt[] = [];
  for (const p of allPrompts) {
    const key = p.text.slice(0, 100);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(p);
    }
  }

  // Detect which tool was used
  const toolCounts: Record<string, number> = {};
  for (const p of unique) {
    toolCounts[p.tool] = (toolCounts[p.tool] || 0) + 1;
  }

  let detectedTool: string | null = null;
  let maxCount = 0;
  for (const [tool, count] of Object.entries(toolCounts)) {
    if (count > maxCount) {
      maxCount = count;
      detectedTool = tool;
    }
  }

  // Get unique session IDs
  const sessionIds = new Set(unique.map((p) => p.sessionId));

  return {
    tool: detectedTool,
    prompts: unique.slice(0, 20),
    sessionCount: sessionIds.size,
    recentPrompt: unique.length > 0 ? unique[0].text : null,
    fullContext: unique.map((p) => `[${new Date(p.timestamp).toISOString().split("T")[0]}] ${p.text}`).join("\n"),
  };
}

// For the prompt template
export function formatContextForPrompt(context: ContextResult): string {
  if (context.prompts.length === 0) return "";

  let output = "\n## Conversation Context\n";
  output += `AI tool: ${context.tool || "unknown"}\n`;
  output += `Sessions detected: ${context.sessionCount}\n`;
  output += `Recent prompts and actions:\n`;
  output += context.fullContext;
  return output;
}
