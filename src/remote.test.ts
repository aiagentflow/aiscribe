import { describe, it, expect } from "vitest";
import { remoteStatus, pushSession, getRemoteConfig } from "./remote";

describe("Remote backup", () => {
  it("getRemoteConfig is callable", () => {
    const cfg = getRemoteConfig();
    expect(typeof cfg === "object" || cfg === null).toBe(true);
  });

  it("remoteStatus returns structured data", () => {
    const status = remoteStatus();
    expect(status).toHaveProperty("configured");
    expect(status).toHaveProperty("url");
    expect(status).toHaveProperty("lastSync");
    expect(status).toHaveProperty("errors");
    expect(typeof status.configured).toBe("boolean");
  });

  it("pushSession returns false when no remote configured", async () => {
    const result = await pushSession("/tmp/nonexistent.md", "test-project");
    expect(result).toBe(false);
  });
});
