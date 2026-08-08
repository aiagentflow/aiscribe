import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { saveSession, loadIndex } from "./storage";

describe("Session storage", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiscribe-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves a session and loads from index", () => {
    const filepath = saveSession(
      "test-branch",
      "## Summary\nTest session summary",
      { filesChanged: 5, insertions: 100, deletions: 20 },
      { tool: "claude-code" }
    );

    expect(fs.existsSync(filepath)).toBe(true);

    const content = fs.readFileSync(filepath, "utf-8");
    expect(content).toContain("# Session: test-branch");
    expect(content).toContain("## Summary");
    expect(content).toContain("Test session summary");

    const index = loadIndex();
    expect(index.sessions).toHaveLength(1);
    expect(index.sessions[0].branch).toBe("test-branch");
    expect(index.sessions[0].files).toBe(5);
  });

  it("handles empty branch name gracefully", () => {
    const filepath = saveSession(
      "",
      "## Summary\nEmpty branch",
      { filesChanged: 1, insertions: 10, deletions: 0 }
    );

    expect(fs.existsSync(filepath)).toBe(true);
    const content = fs.readFileSync(filepath, "utf-8");
    expect(content).toContain("# Session: unknown");
  });

  it("deduplicates sessions in index by id", () => {
    saveSession(
      "branch-a",
      "First save",
      { filesChanged: 3, insertions: 30, deletions: 5 }
    );

    // Save again with same branch today — same id generated
    const filepath = saveSession(
      "branch-a",
      "Second save",
      { filesChanged: 3, insertions: 30, deletions: 5 }
    );

    const index = loadIndex();
    expect(index.sessions).toHaveLength(1);
    expect(index.sessions[0].file).toBe(path.basename(filepath));
  });
});
