import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { setupDocker } from "./docker";

describe("Docker setup", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "aiscribe-docker-test-"));
    process.chdir(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("generates docker-compose.yml with required services", () => {
    setupDocker();

    const compose = fs.readFileSync(
      path.join(tmpDir, ".aiscribe", "docker-compose.yml"),
      "utf-8"
    );

    expect(compose).toContain("pgvector/pgvector:pg16");
    expect(compose).toContain("aiscribe-db");
    expect(compose).toContain("aiscribe-server");
    expect(compose).toContain("3848");
  });

  it("generates init.sql with vector extension and tables", () => {
    setupDocker();

    const sql = fs.readFileSync(
      path.join(tmpDir, ".aiscribe", "init.sql"),
      "utf-8"
    );

    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS vector");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS sessions");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS prompts");
    expect(sql).toContain("embedding vector(1536)");
  });

  it("generates Dockerfile with aiscribe install", () => {
    setupDocker();

    const dockerfile = fs.readFileSync(
      path.join(tmpDir, ".aiscribe", "Dockerfile"),
      "utf-8"
    );

    expect(dockerfile).toContain("FROM node:20-alpine");
    expect(dockerfile).toContain("aiscribe");
  });

  it("returns list of generated files", () => {
    const result = setupDocker();
    expect(result.files).toHaveLength(3);
    expect(result.files.every((f: string) => fs.existsSync(f))).toBe(true);
  });
});
