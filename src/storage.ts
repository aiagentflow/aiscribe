import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const AISCRIBE_DIR = path.join(process.cwd(), ".aiscribe");
const SESSIONS_DIR = path.join(AISCRIBE_DIR, "sessions");
const INDEX_FILE = path.join(AISCRIBE_DIR, "index.json");

export interface SessionEntry {
  id: string;
  date: string;
  branch: string;
  files: number;
  insertions: number;
  deletions: number;
  file: string;
  tool?: string | null;
}

export interface IndexFile {
  sessions: SessionEntry[];
  generated: string;
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function todaySlug(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function saveSession(
  branch: string,
  summary: string,
  stats: { filesChanged: number; insertions: number; deletions: number },
  meta?: { tool: string | null }
): string {
  ensureDir(SESSIONS_DIR);

  const date = todaySlug();
  const slug = slugify(branch || "session");
  const id = `${date}-${slug}`;
  const filename = `${id}.md`;
  const filepath = path.join(SESSIONS_DIR, filename);

  // Add metadata header to the summary
  const content = `# Session: ${branch || "unknown"}

**Date:** ${new Date().toISOString()}
**Files changed:** ${stats.filesChanged}
**Lines:** +${stats.insertions} / -${stats.deletions}

---

${summary}
`;

  fs.writeFileSync(filepath, content, "utf-8");

  // Update index
  const entry: SessionEntry = {
    id,
    date: new Date().toISOString(),
    branch: branch || "unknown",
    files: stats.filesChanged,
    insertions: stats.insertions,
    deletions: stats.deletions,
    file: filename,
    tool: meta?.tool || null,
  };

  updateIndex(entry);

  return filepath;
}

function updateIndex(entry: SessionEntry): void {
  const index: IndexFile = loadIndex();
  
  // Avoid duplicates — replace if same id exists
  const existingIdx = index.sessions.findIndex((s) => s.id === entry.id);
  if (existingIdx >= 0) {
    index.sessions[existingIdx] = entry;
  } else {
    index.sessions.unshift(entry);
  }

  index.generated = new Date().toISOString();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
}

export function loadIndex(): IndexFile {
  if (!fs.existsSync(INDEX_FILE)) {
    return { sessions: [], generated: new Date().toISOString() };
  }
  return JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
}
