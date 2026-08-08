import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { detectProvider } from "./llm";

describe("LLM provider detection", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.AISCRIBE_PROVIDER;
    delete process.env.AISCRIBE_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("detects anthropic when AISCRIBE_API_KEY starts with sk-ant-", () => {
    process.env.AISCRIBE_API_KEY = "sk-ant-test123";
    expect(detectProvider()).toBe("anthropic");
  });

  it("detects openrouter when AISCRIBE_API_KEY starts with sk-or-", () => {
    process.env.AISCRIBE_API_KEY = "sk-or-test123";
    expect(detectProvider()).toBe("openrouter");
  });

  it("detects openai when AISCRIBE_API_KEY starts with sk- (not ant or or)", () => {
    process.env.AISCRIBE_API_KEY = "sk-proj-test123";
    expect(detectProvider()).toBe("openai");
  });

  it("detects deepseek when AISCRIBE_PROVIDER is set to deepseek", () => {
    process.env.AISCRIBE_API_KEY = "sk-test123"; // ambiguous, would be openai
    process.env.AISCRIBE_PROVIDER = "deepseek";
    expect(detectProvider()).toBe("deepseek");
  });

  it("respects AISCRIBE_PROVIDER override", () => {
    process.env.AISCRIBE_PROVIDER = "ollama";
    process.env.AISCRIBE_API_KEY = "sk-or-test123";
    expect(detectProvider()).toBe("ollama");
  });

  it("falls back to ollama when no keys set", () => {
    expect(detectProvider()).toBe("ollama");
  });
});
