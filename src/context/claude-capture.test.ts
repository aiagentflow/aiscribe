import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { encodeClaudeDir, readClaudeFullTranscript } from "./capture";

describe("encodeClaudeDir", () => {
  it("encodes absolute paths the way Claude Code does", () => {
    expect(encodeClaudeDir("/media/raj/Work1/aiscribe")).toBe("-media-raj-Work1-aiscribe");
    expect(encodeClaudeDir("/home/raj")).toBe("-home-raj");
  });
});

describe("readClaudeFullTranscript", () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "claude-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  function writeSession(sessionId: string, lines: string[]) {
    const dir = path.join(tmpHome, ".claude", "projects", "-tmp-aiscribe-test");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, sessionId + ".jsonl"), lines.join("\n"), "utf-8");
  }

  it("parses prompts, responses, and tool calls", () => {
    const lines: string[] = [];
    lines.push(JSON.stringify({ type: "user", message: { role: "user", content: "Fix the auth bug" }, timestamp: "2026-08-01T10:00:00.000Z", sessionId: "s1" }));
    lines.push(JSON.stringify({
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "the bug is in session.ts" },
          { type: "text", text: "I found it." },
          { type: "tool_use", name: "Read", input: { file_path: "/tmp/aiscribe-test/src/auth.ts" } },
          { type: "tool_use", name: "Bash", input: { command: "npm test" } },
        ],
      },
      timestamp: "2026-08-01T10:00:05.000Z",
      sessionId: "s1",
    }));
    lines.push(JSON.stringify({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "42 tests passed" }] }, timestamp: "2026-08-01T10:00:06.000Z", sessionId: "s1" }));
    lines.push(JSON.stringify({ type: "user", isMeta: true, message: { role: "user", content: "<system-reminder>named session</system-reminder>" }, timestamp: "2026-08-01T10:00:07.000Z", sessionId: "s1" }));

    writeSession("s1", lines);

    const t = readClaudeFullTranscript("/tmp/aiscribe-test", tmpHome);
    expect(t).not.toBeNull();
    expect(t!.tool).toBe("claude-code");
    expect(t!.sessionId).toBe("s1");

    expect(t!.messages.map((m) => m.role)).toEqual(["user", "assistant", "tool"]);
    expect(t!.messages[1].content).toContain("session.ts");
    expect(t!.filesRead).toEqual(["/tmp/aiscribe-test/src/auth.ts"]);
    expect(t!.commandsRun).toEqual(["npm test"]);
  });

  it("skips meta system-reminder messages", () => {
    const lines = [
      JSON.stringify({ type: "user", isMeta: true, message: { role: "user", content: "<system-reminder>named session</system-reminder>" }, timestamp: "2026-08-01T10:00:00.000Z", sessionId: "s2" }),
      JSON.stringify({ type: "user", message: { role: "user", content: "real prompt" }, timestamp: "2026-08-01T10:00:01.000Z", sessionId: "s2" }),
    ];
    writeSession("s2", lines);

    const t = readClaudeFullTranscript("/tmp/aiscribe-test", tmpHome);
    expect(t!.messages.map((m) => m.role)).toEqual(["user"]);
    expect(t!.messages[0].content).toBe("real prompt");
  });

  it("returns null when no project directory exists", () => {
    expect(readClaudeFullTranscript("/tmp/nope", tmpHome)).toBeNull();
  });
});
