// aiscribe export: machine-readable session export

import { loadIndex } from "../storage";
import * as fs from "fs";
import * as path from "path";

export async function exportSessions(args: string[]): Promise<void> {
  const format = getFlag(args, "--format") || "json";
  const sessionId = getFlag(args, "--session");
  const outputFile = getFlag(args, "--output");

  const index = loadIndex();
  if (index.sessions.length === 0) {
    console.log("No sessions to export.");
    return;
  }

  let sessions;

  if (sessionId) {
    // Export single session
    const s = index.sessions.find((x) => x.id === sessionId);
    if (!s) {
      console.error(`Session not found: ${sessionId}`);
      process.exit(1);
    }
    sessions = [readFullSession(s.id, s.file)];
  } else {
    sessions = index.sessions.map((s) => readFullSession(s.id, s.file));
  }

  let output = "";

  switch (format) {
    case "json":
      output = JSON.stringify(sessions, null, 2);
      break;

    case "csv":
      output = "id,date,branch,files,insertions,deletions,tool\n";
      for (const s of sessions) {
        output += [
          s.id,
          s.date,
          `"${(s.branch || "").replace(/"/g, '""')}"`,
          s.files,
          s.insertions,
          s.deletions,
          s.tool || "",
        ].join(",") + "\n";
      }
      break;

    case "ai":
      // Compact format optimized for LLM context windows
      for (const s of sessions) {
        output += `[${s.id}] ${s.branch} | ${formatDate(s.date)} | ${s.files}f +${s.insertions}/-${s.deletions}`;
        if (s.tool) output += ` | ${s.tool}`;
        output += "\n";
        output += (s.summary || "").replace(/^#+\s+/gm, "").trim().slice(0, 400);
        output += "\n\n";
      }
      break;

    default:
      console.error(`Unknown format: ${format}. Use json, csv, or ai.`);
      process.exit(1);
  }

  if (outputFile) {
    fs.writeFileSync(outputFile, output, "utf-8");
    console.log(`Exported ${sessions.length} session(s) to ${outputFile}`);
  } else {
    console.log(output);
  }
}

function readFullSession(id: string, file: string): any {
  const filepath = path.join(process.cwd(), ".aiscribe", "sessions", file);
  try {
    const content = fs.readFileSync(filepath, "utf-8");

    const branch = extractMeta(content, "Session:") || "unknown";
    const date = extractMeta(content, "Date:") || "";
    const files = parseInt(extractMeta(content, "Files changed:") || "0");
    const linesStr = extractMeta(content, "Lines:") || "+0 / -0";
    const [ins, del] = linesStr.replace(/[+]/g, "").split("/").map((s) =>
      parseInt(s.trim().replace("-", "")) || 0
    );
    const tool = extractMeta(content, "AI Tool:") || null;

    const sepIdx = content.indexOf("---");
    const summary = sepIdx >= 0 ? content.slice(sepIdx + 3).trim() : content;

    return { id, date: date || new Date().toISOString(), branch, files,
      insertions: ins, deletions: del, tool, summary };
  } catch {
    return { id, branch: "unknown", error: "Could not read session file" };
  }
}

function extractMeta(content: string, key: string): string {
  const match = content.match(new RegExp(`\\*\\*${key}\\*\\*\\s*(.+)`));
  return match ? match[1].trim() : "";
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}
