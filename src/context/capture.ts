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

export interface CapturedMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  toolName?: string;
  toolCallId?: string;
}

export interface FullTranscript {
  sessionId: string;
  tool: string;
  messages: CapturedMessage[];
  filesRead: string[];
  commandsRun: string[];
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
  const sessionFile = getPiSessionFile();

  // If PI_SESSION_FILE is set (pi's terminal), use it directly
  if (sessionFile && fs.existsSync(sessionFile)) {
    const sessionId = process.env.PI_SESSION_ID || path.basename(sessionFile, ".jsonl");
    return readPiSessionFile(sessionFile, sessionId);
  }

  // Otherwise, scan sessions directory for matching project
  const sessionsDir = getPiSessionsDir();
  if (!fs.existsSync(sessionsDir)) return [];

  // Try to match by project name (last directory component)
  const projectName = path.basename(cwd);

  let matchingDir: string | null = null;
  const dirs = fs.readdirSync(sessionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  // First: exact cwd match
  for (const dir of dirs) {
    const decoded = dir.name
      .replace(/^--/, "")
      .replace(/--$/, "")
      .replace(/-/g, "/");
    if (cwd === decoded) { matchingDir = path.join(sessionsDir, dir.name); break; }
  }

  // Second: project name match (for different terminals)
  if (!matchingDir) {
    for (const dir of dirs) {
      const decoded = dir.name.toLowerCase();
      if (decoded.includes(projectName.toLowerCase().replace(/\//g, "-"))) {
        matchingDir = path.join(sessionsDir, dir.name);
        break;
      }
    }
  }

  const matchedFile = matchingDir ? getLatestSessionFile(matchingDir) : null;
  if (matchedFile) {
    return readPiSessionFile(matchedFile, path.basename(matchedFile, ".jsonl"));
  }

  return [];
}

function readPiSessionFile(filepath: string, sessionId: string): CapturedPrompt[] {
  const prompts: CapturedPrompt[] = [];
  const content = fs.readFileSync(filepath, "utf-8");

  for (const line of content.trim().split("\n")) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (!msg || !msg.content) continue;

      // Capture user messages
      if (msg.role === "user") {
        const text = extractPiText(msg.content);
        if (text) {
          prompts.push({
            text,
            timestamp: msg.timestamp || entry.timestamp || 0,
            sessionId,
            tool: "pi",
          });
        }
      }

      // Capture assistant thinking (append to context)
      if (msg.role === "assistant") {
        const thinking = extractPiThinking(msg.content);
        if (thinking) {
          prompts.push({
            text: `[thinking] ${thinking.slice(0, 300)}`,
            timestamp: msg.timestamp || entry.timestamp || 0,
            sessionId,
            tool: "pi",
          });
        }
        // Capture tool calls as actions
        const toolCalls = extractPiToolCalls(msg.content);
        for (const tc of toolCalls) {
          prompts.push({
            text: `[tool:${tc.name}] ${tc.args?.command || tc.args?.path || JSON.stringify(tc).slice(0, 200)}`,
            timestamp: msg.timestamp || entry.timestamp || 0,
            sessionId,
            tool: "pi",
          });
        }
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

function extractPiThinking(content: Array<{ type: string; thinking?: string }>): string {
  if (!Array.isArray(content)) return "";
  const thinkBlock = content.find((c) => c.type === "thinking" && c.thinking);
  return thinkBlock?.thinking?.trim() || "";
}

function extractPiToolCalls(content: Array<Record<string, unknown>>): Array<{ name: string; args: Record<string, unknown> }> {
  if (!Array.isArray(content)) return [];
  return content
    .filter((c) => c.type === "toolCall" && c.name && c.arguments)
    .map((c) => ({
      name: c.name as string,
      args: c.arguments as Record<string, unknown>,
    }));
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

// ── Full Transcript Capture ──

/** Read the full session transcript from pi session file */
export function readPiFullTranscript(cwd: string): FullTranscript | null {
  const sessionFile = getPiSessionFile();
  let filepath = sessionFile;

  if (!filepath || !fs.existsSync(filepath)) {
    // Find by project match
    const sessionsDir = getPiSessionsDir();
    if (!fs.existsSync(sessionsDir)) return null;

    const projectName = path.basename(cwd);
    const dirs = fs.readdirSync(sessionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    let matchingDir: string | null = null;
    for (const dir of dirs) {
      const decoded = dir.name.replace(/^--/, "").replace(/--$/, "").replace(/-/g, "/");
      if (cwd === decoded) { matchingDir = path.join(sessionsDir, dir.name); break; }
    }
    if (!matchingDir) {
      for (const dir of dirs) {
        if (dir.name.toLowerCase().includes(projectName.toLowerCase().replace(/\//g, "-"))) {
          matchingDir = path.join(sessionsDir, dir.name);
          break;
        }
      }
    }

    const latestFile = matchingDir ? getLatestSessionFile(matchingDir) : null;
    if (!latestFile) return null;
    filepath = latestFile;
  }

  const content = fs.readFileSync(filepath, "utf-8");
  const sessionId = process.env.PI_SESSION_ID || path.basename(filepath, ".jsonl");
  const messages: CapturedMessage[] = [];
  const filesRead = new Set<string>();
  const commandsRun = new Set<string>();

  for (const line of content.trim().split("\n")) {
    try {
      const entry = JSON.parse(line);
      if (entry.type !== "message") continue;
      const msg = entry.message;
      if (!msg || !msg.content) continue;

      const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : 0;

      if (msg.role === "user") {
        const text = extractPiText(msg.content);
        if (text) messages.push({ role: "user", content: text, timestamp: ts });
      } else if (msg.role === "assistant") {
        const textParts: string[] = [];
        const thinking = extractPiThinking(msg.content);
        if (thinking) textParts.push(`[thinking] ${thinking.slice(0, 500)}`);
        const text = extractPiText(msg.content);
        if (text) textParts.push(text);
        const toolCalls = extractPiToolCalls(msg.content);
        for (const tc of toolCalls) {
          textParts.push(`[tool:${tc.name}] ${JSON.stringify(tc.args).slice(0, 300)}`);
          if (tc.name === "read") filesRead.add(String(tc.args.path || ""));
          if (tc.name === "bash") commandsRun.add(String(tc.args.command || "").slice(0, 100));
        }
        if (textParts.length) messages.push({ role: "assistant", content: textParts.join("\n"), timestamp: ts });
      } else if (msg.role === "toolResult") {
        const text = extractPiText(msg.content);
        if (text) messages.push({
          role: "tool",
          content: text.slice(0, 1000),
          timestamp: ts,
          toolName: (msg as Record<string, unknown>).toolName as string,
          toolCallId: (msg as Record<string, unknown>).toolCallId as string,
        });
      }
    } catch {}
  }

  if (messages.length === 0) return null;

  return {
    sessionId,
    tool: "pi",
    messages,
    filesRead: [...filesRead],
    commandsRun: [...commandsRun],
  };
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

  // If PI_CODING_AGENT is set OR pi has the most prompts, prioritize pi
  if (process.env.PI_CODING_AGENT === "true" || (toolCounts["pi"] || 0) >= (toolCounts[detectedTool || ""] || 0)) {
    if (toolCounts["pi"] && toolCounts["pi"] > 0) detectedTool = "pi";
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

  let output = "\n## Session Conversation\n\n";
  output += `AI tool: ${context.tool || "unknown"}\n`;
  output += `Total prompts captured: ${context.prompts.length}\n\n`;
  output += "---\n\n";
  for (const p of context.prompts) {
    const d = new Date(p.timestamp).toISOString().split("T")[0];
    const time = new Date(p.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    if (p.text.startsWith("[thinking]")) {
      output += `> _Thinking (${d} ${time})_\n> ${p.text.replace("[thinking] ", "").slice(0, 500)}\n\n`;
    } else if (p.text.startsWith("[tool:")) {
      output += `> _Tool (${d} ${time})_\n> \`${p.text.replace("[tool:", "").slice(0, 300)}\`\n\n`;
    } else {
      output += `**You** _${d} ${time}_\n\n${p.text.slice(0, 500)}\n\n`;
    }
  }
  return output;
}
