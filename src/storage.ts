import * as fs from "fs";
import * as path from "path";
import * as os from "os";

import type { EmbeddingData } from "./embeddings";

function aiscribeDir(): string {
  return path.join(process.cwd(), ".aiscribe");
}

function sessionsDir(): string {
  return path.join(aiscribeDir(), "sessions");
}

function indexFile(): string {
  return path.join(aiscribeDir(), "index.json");
}

function embeddingsDir(): string {
  return path.join(aiscribeDir(), "embeddings");
}

export interface SessionEntry {
  id: string;
  date: string;
  branch: string;
  project: string;
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
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function saveSession(
  branch: string,
  summary: string,
  stats: { filesChanged: number; insertions: number; deletions: number },
  meta?: { tool: string | null; customName?: string },
  embedding?: EmbeddingData | null
): string {
  ensureDir(sessionsDir());

  const date = todaySlug();
  const nameForSlug = meta?.customName || branch || "session";
  const slug = slugify(nameForSlug);
  const id = `${date}-${slug}`;
  const filename = `${id}.md`;
  const filepath = path.join(sessionsDir(), filename);

  const displayName = meta?.customName || branch || "unknown";
  const content = `# Session: ${displayName}

**Date:** ${new Date().toISOString()}
**Branch:** ${branch || "unknown"}
**Files changed:** ${stats.filesChanged}
**Lines:** +${stats.insertions} / -${stats.deletions}${meta?.tool ? `\n**AI Tool:** ${meta.tool}` : ""}

---

${summary}
`;

  fs.writeFileSync(filepath, content, "utf-8");

  // Update index
  const entry: SessionEntry = {
    id,
    date: new Date().toISOString(),
    branch: displayName,
    project: path.basename(process.cwd()),
    files: stats.filesChanged,
    insertions: stats.insertions,
    deletions: stats.deletions,
    file: filename,
    tool: meta?.tool || null,
  };

  updateIndex(entry);

  // Save embedding if generated
  if (embedding) {
    ensureDir(embeddingsDir());
    const embPath = path.join(embeddingsDir(), `${id}.json`);
    fs.writeFileSync(embPath, JSON.stringify(embedding, null, 2), "utf-8");
  }

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
  fs.writeFileSync(indexFile(), JSON.stringify(index, null, 2), "utf-8");
}

export function loadIndex(): IndexFile {
  if (!fs.existsSync(indexFile())) {
    return { sessions: [], generated: new Date().toISOString() };
  }
  return JSON.parse(fs.readFileSync(indexFile(), "utf-8"));
}
