// Pattern detection across sessions
// Hotspot detection, file change frequency, risk patterns

import * as fs from "fs";
import * as path from "path";
import { loadIndex, type SessionEntry } from "./storage";
import type { EmbeddingData } from "./embeddings";

export interface HotspotFile {
  file: string;
  sessions: number;
  lastChanged: string;
  totalChanges: number;
  relatedSessions: string[];
}

export interface TimelineEntry {
  date: string;
  session: string;
  branch: string;
  snippet: string;
}

export interface RiskPattern {
  pattern: string;
  description: string;
  count: number;
  sessions: string[];
}

// Find files that change most frequently across sessions
export function detectHotspots(
  sessions: SessionEntry[],
  topK: number = 10
): HotspotFile[] {
  // Parse file lists from session files
  const fileMap = new Map<string, HotspotFile>();

  for (const s of sessions) {
    const files = getSessionFiles(s);
    for (const f of files) {
      const existing = fileMap.get(f);
      if (existing) {
        existing.sessions++;
        existing.totalChanges += s.insertions + s.deletions;
        existing.relatedSessions.push(s.id);
        if (s.date > existing.lastChanged) {
          existing.lastChanged = s.date;
        }
      } else {
        fileMap.set(f, {
          file: f,
          sessions: 1,
          lastChanged: s.date,
          totalChanges: s.insertions + s.deletions,
          relatedSessions: [s.id],
        });
      }
    }
  }

  return Array.from(fileMap.values())
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, topK);
}

// Get timeline of changes for a specific file
export function fileTimeline(
  filePath: string,
  sessions: SessionEntry[]
): TimelineEntry[] {
  const timeline: TimelineEntry[] = [];

  for (const s of sessions) {
    const files = getSessionFiles(s);
    if (files.some((f) => f.includes(filePath) || filePath.includes(f))) {
      const snippet = getSessionSnippet(s);
      timeline.push({
        date: s.date,
        session: s.id,
        branch: s.branch,
        snippet: snippet.slice(0, 150),
      });
    }
  }

  return timeline.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

// Detect common risk patterns across sessions
export function detectRiskPatterns(
  sessions: SessionEntry[]
): RiskPattern[] {
  const patterns: RiskPattern[] = [];
  const configFiles = [
    ".env",
    "package.json",
    "tsconfig.json",
    "docker-compose",
    ".gitignore",
    "config",
  ];
  const testPatterns = [".test.", ".spec.", "__tests__"];

  // Pattern: config file changes
  const configChanges: string[] = [];
  for (const s of sessions) {
    const files = getSessionFiles(s);
    if (files.some((f) => configFiles.some((cf) => f.includes(cf)))) {
      configChanges.push(s.id);
    }
  }
  if (configChanges.length > 0) {
    patterns.push({
      pattern: "config-mutations",
      description: "Config/env files changed without related code changes",
      count: configChanges.length,
      sessions: configChanges,
    });
  }

  // Pattern: changes without tests
  const noTestChanges: string[] = [];
  for (const s of sessions) {
    const files = getSessionFiles(s);
    const hasTests = files.some((f) =>
      testPatterns.some((tp) => f.includes(tp))
    );
    const hasCode = files.some(
      (f) =>
        f.endsWith(".ts") ||
        f.endsWith(".js") ||
        f.endsWith(".py") ||
        f.endsWith(".go")
    );
    if (hasCode && !hasTests) {
      noTestChanges.push(s.id);
    }
  }
  if (noTestChanges.length > 0) {
    patterns.push({
      pattern: "missing-tests",
      description: "Sessions with code changes but no test files modified",
      count: noTestChanges.length,
      sessions: noTestChanges,
    });
  }

  // Pattern: large single-file changes (potential god objects)
  const largeChanges: string[] = [];
  for (const s of sessions) {
    const files = getSessionFiles(s);
    if (files.length === 1 && s.insertions + s.deletions > 100) {
      largeChanges.push(s.id);
    }
  }
  if (largeChanges.length > 0) {
    patterns.push({
      pattern: "large-single-file",
      description:
        "Sessions modifying only one file with 100+ line changes (potential god object)",
      count: largeChanges.length,
      sessions: largeChanges,
    });
  }

  return patterns;
}

// Helper: parse file list from a session entry
function getSessionFiles(session: SessionEntry): string[] {
  // Prefer the actual changed-file list captured from the git diff. Older
  // sessions predate this field, so fall back to parsing the markdown.
  if (session.changedFiles !== undefined) return session.changedFiles;

  const sessionPath = path.join(
    process.cwd(),
    ".aiscribe",
    "sessions",
    session.file
  );
  if (!fs.existsSync(sessionPath)) return [];

  try {
    const content = fs.readFileSync(sessionPath, "utf-8");
    // Extract files from the "Files changed:" section or from bullet points
    const files: string[] = [];
    const lines = content.split("\n");
    let inFileSection = false;

    for (const line of lines) {
      if (line.startsWith("## Files Changed") || line.startsWith("## Files")) {
        inFileSection = true;
        continue;
      }
      if (inFileSection && line.startsWith("## ")) {
        inFileSection = false;
        continue;
      }
      if (inFileSection && line.trim().startsWith("- ")) {
        const file = line.trim().replace(/^-\s+/, "").replace(/`/g, "").trim();
        if (file) files.push(file);
      }
      // Also check bullet points with file paths
      if (
        line.trim().startsWith("- ") &&
        (line.includes("/") || line.includes("."))
      ) {
        const file = line.trim().replace(/^-\s+/, "").replace(/`/g, "").trim();
        if (
          file.match(
            /\.(ts|js|py|go|rs|java|rb|php|css|html|json|yaml|yml|md|sql)$/
          )
        ) {
          if (!files.includes(file)) files.push(file);
        }
      }
    }

    return files;
  } catch {
    return [];
  }
}

function getSessionSnippet(session: SessionEntry): string {
  const sessionPath = path.join(
    process.cwd(),
    ".aiscribe",
    "sessions",
    session.file
  );
  if (!fs.existsSync(sessionPath)) return "";

  try {
    const content = fs.readFileSync(sessionPath, "utf-8");
    const sepIdx = content.indexOf("---");
    if (sepIdx >= 0) {
      return content.slice(sepIdx + 3).trim();
    }
    return content.slice(0, 200);
  } catch {
    return "";
  }
}
