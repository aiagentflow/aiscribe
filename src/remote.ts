// Git remote backup: push sessions to a private git repo
// Every session auto-syncs to your configured remote

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { loadConfig, saveConfig, type SavedConfig } from "./onboarding";

const REMOTE_DIR = path.join(os.homedir(), ".aiscribe", "remote");
const LOCK_FILE = path.join(os.homedir(), ".aiscribe", "remote.lock");

export interface RemoteConfig {
  url: string;
  enabled: boolean;
  lastSync: string | null;
  errors: number;
}

export function getRemoteConfig(): RemoteConfig | null {
  const cfg = loadConfig();
  if (!cfg?.remoteUrl) return null;
  return {
    url: cfg.remoteUrl,
    enabled: cfg.remoteEnabled !== false,
    lastSync: cfg.remoteLastSync || null,
    errors: cfg.remoteErrors || 0,
  };
}

export async function setRemote(url: string): Promise<void> {
  const cfg = loadConfig() || { provider: "", apiKey: "" };
  cfg.remoteUrl = url;
  cfg.remoteEnabled = true;
  cfg.remoteErrors = 0;
  saveConfig(cfg);

  console.log(`\n  Remote configured: ${url}`);

  // Try initial clone
  try {
    await initRemote(url);
    console.log("  Repository ready.");
  } catch (err: any) {
    console.log(`  Clone failed (will retry on next log): ${err.message}`);
  }
}

export async function disableRemote(): Promise<void> {
  const cfg = loadConfig();
  if (cfg) {
    cfg.remoteEnabled = false;
    saveConfig(cfg);
  }
  console.log("Remote backup disabled.");
}

async function initRemote(url: string): Promise<void> {
  if (fs.existsSync(REMOTE_DIR)) {
    // Already cloned, just pull
    try {
      execSync("git pull --rebase", { cwd: REMOTE_DIR, stdio: "pipe", timeout: 15000 });
    } catch {
      // Pull failed, continue with what we have
    }
    return;
  }

  // Clone the repo
  fs.mkdirSync(path.dirname(REMOTE_DIR), { recursive: true });
  execSync(`git clone "${url}" "${REMOTE_DIR}"`, { stdio: "pipe", timeout: 30000 });
}

export async function pushSession(sessionFile: string, projectName: string): Promise<boolean> {
  const cfg = getRemoteConfig();
  if (!cfg || !cfg.enabled) return false;

  // Don't push if too many recent errors
  if (cfg.errors > 5) return false;

  // Prevent concurrent pushes
  if (fs.existsSync(LOCK_FILE)) return false;

  try {
    fs.writeFileSync(LOCK_FILE, Date.now().toString(), "utf-8");

    // Init/clone if needed
    if (!fs.existsSync(REMOTE_DIR)) {
      await initRemote(cfg.url);
    }

    // Pull latest
    try {
      execSync("git pull --rebase", { cwd: REMOTE_DIR, stdio: "pipe", timeout: 10000 });
    } catch {
      // Continue even if pull fails
    }

    // Create project directory
    const projectDir = path.join(REMOTE_DIR, projectName);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Copy session file
    const destFile = path.join(projectDir, path.basename(sessionFile));
    fs.copyFileSync(sessionFile, destFile);

    // Also copy index.json
    const localIndex = path.join(process.cwd(), ".aiscribe", "index.json");
    if (fs.existsSync(localIndex)) {
      fs.copyFileSync(localIndex, path.join(projectDir, "index.json"));
    }

    // Git add + commit + push
    execSync("git add -A", { cwd: REMOTE_DIR, stdio: "pipe" });
    
    const date = new Date().toISOString().split("T")[0];
    // Filename is YYYY-MM-DD-HHMM-slug; drop the date + time to recover the name.
    const branch = path.basename(sessionFile, ".md").split("-").slice(4).join("-") || "session";
    execSync(`git commit -m "[${projectName}] ${branch} - ${date}" --allow-empty`, {
      cwd: REMOTE_DIR, stdio: "pipe",
    });

    execSync("git push", { cwd: REMOTE_DIR, stdio: "pipe", timeout: 15000 });

    // Update config
    const savedCfg = loadConfig() || { provider: "", apiKey: "" };
    savedCfg.remoteLastSync = new Date().toISOString();
    savedCfg.remoteErrors = 0;
    saveConfig(savedCfg);

    return true;
  } catch (err) {
    // Track errors
    const savedCfg = loadConfig() || { provider: "", apiKey: "" };
    savedCfg.remoteErrors = (savedCfg.remoteErrors || 0) + 1;
    saveConfig(savedCfg);
    return false;
  } finally {
    try { fs.unlinkSync(LOCK_FILE); } catch {}
  }
}

export function remoteStatus(): { configured: boolean; url: string | null; lastSync: string | null; errors: number } {
  const cfg = getRemoteConfig();
  return {
    configured: !!cfg,
    url: cfg?.url || null,
    lastSync: cfg?.lastSync || null,
    errors: cfg?.errors || 0,
  };
}
