import { describe, it, expect } from "vitest";
import {
  assignTurnNumbers,
  formatTranscriptForPrompt,
  formatTranscriptForStorage,
} from "./capture";
import type { CapturedMessage } from "./capture";

function msg(
  role: CapturedMessage["role"],
  content: string,
  timestamp: number
): CapturedMessage {
  return { role, content, timestamp };
}

describe("assignTurnNumbers", () => {
  it("starts a new turn at each user message", () => {
    const messages = [
      msg("user", "first", 1),
      msg("assistant", "a1", 2),
      msg("tool", "t1", 3),
      msg("user", "second", 4),
      msg("assistant", "a2", 5),
    ];
    expect(assignTurnNumbers(messages).map((m) => m.turn)).toEqual([1, 1, 1, 2, 2]);
  });

  it("does not mutate the input", () => {
    const messages = [msg("user", "hi", 1)];
    assignTurnNumbers(messages);
    expect(messages[0].turn).toBeUndefined();
  });
});

describe("formatTranscriptForPrompt", () => {
  it("emits numbered turn headings for the LLM", () => {
    const out = formatTranscriptForPrompt([
      msg("user", "hello", 1),
      msg("assistant", "world", 2),
      msg("user", "again", 3),
    ]);
    expect(out).toContain("### Turn 1");
    expect(out).toContain("### Turn 2");
    expect(out).toContain("hello");
    expect(out).toContain("again");
  });

  it("stops after maxTurns", () => {
    const messages = Array.from({ length: 100 }, (_, i) => msg("user", `p${i}`, i));
    const out = formatTranscriptForPrompt(messages, 5);
    expect(out).toContain("continues past Turn 5");
    expect(out).not.toContain("### Turn 6");
  });

  it("returns empty string for no messages", () => {
    expect(formatTranscriptForPrompt([])).toBe("");
  });
});

describe("formatTranscriptForStorage", () => {
  it("keeps turn anchors for the saved file", () => {
    const out = formatTranscriptForStorage([
      msg("user", "u", 1),
      msg("assistant", "a", 2),
    ]);
    expect(out).toContain("### Turn 1");
    expect(out).toContain("**You**");
    expect(out).toContain("**Assistant**");
  });

  it("groups assistant messages under their user turn", () => {
    const out = formatTranscriptForStorage([
      msg("user", "q1", 1),
      msg("assistant", "r1", 2),
      msg("user", "q2", 3),
    ]);
    // Turn 2 should appear exactly once (from the second user message)
    expect(out.match(/### Turn 2/g)).toHaveLength(1);
  });
});
