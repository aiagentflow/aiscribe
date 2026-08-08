// Doctor command: validate AIScribe setup
// Checks: git, Node, API key, provider, directory health

import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import { green, red, yellow, bold, dim, cyan } from "../terminal";
import { loadConfig, hasEnvConfig } from "../onboarding";

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "fail";
  message: string;
}

export async function doctor(): Promise<void> {
  console.log("");
  console.log(bold("  AIScribe Doctor"));
  console.log(dim("  Checking your setup..."));
  console.log("");

  const checks: CheckResult[] = [];

  // 1. Node version
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1).split(".")[0]);
  checks.push({
    name: "Node.js",
    status: major >= 20 ? "ok" : "fail",
    message: major >= 20
      ? `v${nodeVersion} (>= 20 required)`
      : `v${nodeVersion} (need >= 20)`,
  });

  // 2. Git
  const { execSync } = await import("child_process");
  try {
    const gitVersion = execSync("git --version", { encoding: "utf-8" }).trim();
    checks.push({
      name: "Git",
      status: "ok",
      message: gitVersion,
    });
  } catch {
    checks.push({
      name: "Git",
      status: "fail",
      message: "Git not found. Install: https://git-scm.com",
    });
  }

  // 3. Git repo
  try {
    execSync("git rev-parse --git-dir", { encoding: "utf-8", stdio: "pipe" });
    checks.push({
      name: "Git repo",
      status: "ok",
      message: "Current directory is a git repository",
    });
  } catch {
    checks.push({
      name: "Git repo",
      status: "warn",
      message: "Not in a git repo. AIScribe needs git diffs.",
    });
  }

  // 4. API configuration
  const envConfig = hasEnvConfig();
  const savedConfig = loadConfig();

  if (envConfig) {
    const provider = process.env.AISCRIBE_PROVIDER || "auto-detect";
    checks.push({
      name: "API config",
      status: "ok",
      message: `Using environment variables (provider: ${provider})`,
    });
  } else if (savedConfig) {
    checks.push({
      name: "API config",
      status: "ok",
      message: `Saved config: ${savedConfig.provider}`,
    });
  } else {
    checks.push({
      name: "API config",
      status: "warn",
      message: "No API key configured. Run 'aiscribe setup --reconfigure'",
    });
  }

  // 5. API connectivity (if key is set)
  if (envConfig || savedConfig) {
    checks.push({
      name: "API test",
      status: "ok",
      message: "Skipped (use aiscribe log to test connectivity)",
    });
  }

  // 6. .aiscribe directory
  const aiscribeDir = path.join(process.cwd(), ".aiscribe");
  if (fs.existsSync(aiscribeDir)) {
    const sessionsDir = path.join(aiscribeDir, "sessions");
    const sessionCount = fs.existsSync(sessionsDir)
      ? fs.readdirSync(sessionsDir).filter((f) => f.endsWith(".md")).length
      : 0;
    checks.push({
      name: "Storage",
      status: "ok",
      message: `${sessionCount} sessions in .aiscribe/`,
    });
  } else {
    checks.push({
      name: "Storage",
      status: "warn",
      message: "No .aiscribe/ directory yet. Created on first 'aiscribe log'.",
    });
  }

  // 7. Config file
  const configPath = path.join(os.homedir(), ".aiscribe", "config.json");
  if (fs.existsSync(configPath)) {
    checks.push({
      name: "Config file",
      status: "ok",
      message: configPath,
    });
  } else {
    checks.push({
      name: "Config file",
      status: "warn",
      message: "Not created yet. Run 'aiscribe setup --reconfigure'.",
    });
  }

  // Display results
  for (const check of checks) {
    const icon =
      check.status === "ok" ? green("✓") : check.status === "warn" ? yellow("!") : red("✗");
    console.log(`  ${icon} ${bold(check.name)}`);
    console.log(`    ${dim(check.message)}`);
  }

  // Summary
  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;

  console.log("");
  if (fails === 0 && warns === 0) {
    console.log(green("  All checks passed. You're good to go!"));
  } else if (fails === 0) {
    console.log(yellow(`  ${warns} warning(s). AIScribe will work but may have limited functionality.`));
  } else {
    console.log(red(`  ${fails} issue(s) found. Fix the above before using AIScribe.`));
  }
  console.log("");
}
