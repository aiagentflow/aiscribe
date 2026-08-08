// aiscribe sync: push local sessions to the running server/DB

import { loadIndex } from "../storage";
import * as fs from "fs";
import * as path from "path";
import { bold, dim, green, yellow, red, gray } from "../terminal";

const SERVER_URL = process.env.AISCRIBE_SERVER || "http://localhost:3848";

export async function sync(args: string[]): Promise<void> {
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  console.log("");
  console.log(bold("  AIScribe Sync"));
  console.log(dim(`  Server: ${SERVER_URL}`));
  console.log("");

  // Check server health
  let serverOk = false;
  try {
    const res = await fetch(`${SERVER_URL}/api/health`);
    const data = await res.json() as { status: string; sessions: number };
    serverOk = data.status === "ok";
    if (serverOk) {
      console.log(green(`  Server online (${data.sessions} sessions in DB)`));
    }
  } catch {
    console.log(red("  Server not reachable. Start it: aiscribe server"));
    console.log("");
    return;
  }

  // Read local sessions
  const index = loadIndex();
  if (index.sessions.length === 0) {
    console.log(gray("  No local sessions to sync."));
    console.log("");
    return;
  }

  // Determine which sessions need syncing
  const syncStatePath = path.join(process.cwd(), ".aiscribe", "sync-state.json");
  const syncedIds = loadSyncedIds(syncStatePath);

  const toSync = force
    ? index.sessions
    : index.sessions.filter((s) => !syncedIds.has(s.id));

  if (toSync.length === 0) {
    console.log(green("  All sessions already synced."));
    console.log("");
    return;
  }

  console.log(`  ${toSync.length} session(s) to sync`);
  console.log("");

  if (dryRun) {
    for (const s of toSync) {
      console.log(`  ${dim("Would sync:")} ${s.branch} ${dim("(" + formatDate(s.date) + ")")}`);
    }
    console.log(`\n  ${dim("Run without --dry-run to sync.")}`);
    console.log("");
    return;
  }

  // Sync each session
  let synced = 0;
  let failed = 0;

  for (const s of toSync) {
    try {
      const sessionData = readSessionFile(s.file);
      const res = await fetch(`${SERVER_URL}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionData),
      });

      if (res.ok) {
        syncedIds.add(s.id);
        synced++;
        console.log(`  ${green("✓")} ${s.branch}`);
      } else {
        failed++;
        console.log(`  ${red("✗")} ${s.branch} (${res.status})`);
      }
    } catch {
      failed++;
      console.log(`  ${red("✗")} ${s.branch} (network error)`);
    }
  }

  // Save sync state
  saveSyncedIds(syncStatePath, syncedIds);

  console.log("");
  if (failed === 0) {
    console.log(green(`  Synced ${synced} session(s).`));
  } else {
    console.log(
      yellow(`  Synced ${synced}, ${failed} failed. Run again to retry.`)
    );
  }
  console.log("");
}

function readSessionFile(filename: string): Record<string, unknown> {
  const filepath = path.join(process.cwd(), ".aiscribe", "sessions", filename);
  try {
    const content = fs.readFileSync(filepath, "utf-8");
    return {
      id: filename.replace(".md", ""),
      file: filename,
      branch: extractMeta(content, "Session:"),
      date: extractMeta(content, "Date:"),
      filesChanged: parseInt(extractMeta(content, "Files changed:") || "0"),
      insertions: parseInt(
        extractMetaPair(content, "Lines:", 0)?.replace("+", "") || "0"
      ),
      deletions: parseInt(
        extractMetaPair(content, "Lines:", 1)?.replace("-", "") || "0"
      ),
      summary: content.split("---")[1]?.trim() || content.slice(0, 500),
      rawContent: content,
    };
  } catch {
    return { id: filename, branch: "unknown", error: "Could not read" };
  }
}

function extractMeta(content: string, key: string): string {
  const match = content.match(new RegExp(`\\*\\*${key}\\*\\*\\s*(.+)`));
  return match ? match[1].trim() : "";
}

function extractMetaPair(
  content: string,
  key: string,
  index: number
): string | null {
  const match = content.match(new RegExp(`\\*\\*${key}\\*\\*\\s*(.+)`));
  if (!match) return null;
  const parts = match[1].split("/");
  return parts[index]?.trim() || null;
}

function loadSyncedIds(filepath: string): Set<string> {
  try {
    if (fs.existsSync(filepath)) {
      const data = JSON.parse(fs.readFileSync(filepath, "utf-8"));
      return new Set(data.ids || []);
    }
  } catch {}
  return new Set();
}

function saveSyncedIds(filepath: string, ids: Set<string>): void {
  fs.writeFileSync(
    filepath,
    JSON.stringify({ ids: Array.from(ids), updated: new Date().toISOString() }),
    "utf-8"
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
