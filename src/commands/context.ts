// aiscribe context: expose session history to AI agents
// Outputs recent session summaries in various formats

import { loadIndex } from "../storage";
import * as fs from "fs";
import * as path from "path";
import { bold, dim, gray, cyan } from "../terminal";
import { jsonSuccess } from "../json-output";

interface SessionSummary {
  id: string;
  date: string;
  branch: string;
  files: number;
  insertions: number;
  deletions: number;
  tool: string | null;
  summary: string;
  decisions: string[];
}

export async function context(args: string[]): Promise<void> {
  const isJson = args.includes("--json");
  const isPlain = args.includes("--format") && args[args.indexOf("--format") + 1] === "plain";
  const lastN = getFlagValue(args, "--last") || 5;

  const index = loadIndex();
  if (index.sessions.length === 0) {
    console.log(gray("No session history for this project."));
    return;
  }

  const recentSessions = index.sessions.slice(0, lastN);
  const summaries = recentSessions.map((s) => readSessionSummary(s.id, s.file, s.branch, s.date));

  if (isJson) {
    jsonSuccess("context", {
      project: path.basename(process.cwd()),
      sessionCount: index.sessions.length,
      recent: summaries,
    });
    return;
  }

  if (isPlain) {
    // Optimized for AI context windows: compact, no markup
    console.log(`Project: ${path.basename(process.cwd())}`);
    console.log(`Recent sessions: ${summaries.length} of ${index.sessions.length} total`);
    console.log("");

    for (const s of summaries) {
      console.log(`## ${s.branch} (${formatDate(s.date)})`);
      console.log(`Files: ${s.files} | Changes: +${s.insertions}/-${s.deletions}`);
      if (s.tool) console.log(`Tool: ${s.tool}`);
      console.log(s.summary.slice(0, 500));
      if (s.decisions.length > 0) {
        console.log("Decisions:");
        s.decisions.forEach((d) => console.log(`- ${d}`));
      }
      console.log("");
    }
    return;
  }

  // Default: styled terminal output
  console.log("");
  console.log(bold("  Project Context"));
  console.log(
    dim(`  ${path.basename(process.cwd())} — ${index.sessions.length} sessions total`)
  );
  console.log("");

  for (const s of summaries) {
    console.log(`  ${bold(s.branch)}`);
    console.log(
      `  ${dim(formatDate(s.date))}  ${dim(s.files + " files")}  ${dim("+" + s.insertions + "/-" + s.deletions)}`
    );
    if (s.tool) console.log(`  ${dim("Tool:")} ${cyan(s.tool)}`);
    console.log(`  ${gray(s.summary.slice(0, 200))}`);
    console.log("");
  }

  console.log(dim("  Tip: Use --format plain for AI agent consumption"));
  console.log(dim("  Tip: Use --last 10 to see more sessions"));
  console.log("");
}

function readSessionSummary(
  id: string,
  file: string,
  branch: string,
  date: string
): SessionSummary {
  const filepath = path.join(process.cwd(), ".aiscribe", "sessions", file);

  let summary = "";
  let tool: string | null = null;
  let files = 0;
  let insertions = 0;
  let deletions = 0;
  const decisions: string[] = [];

  try {
    const content = fs.readFileSync(filepath, "utf-8");

    // Parse files/lines
    const filesMatch = content.match(/\*\*Files changed:\*\*\s*(\d+)/);
    if (filesMatch) files = parseInt(filesMatch[1]);

    const linesMatch = content.match(/\*\*Lines:\*\*\s*\+(\d+)\s*\/\s*-(\d+)/);
    if (linesMatch) {
      insertions = parseInt(linesMatch[1]);
      deletions = parseInt(linesMatch[2]);
    }

    // Parse tool
    const toolMatch = content.match(/\*\*AI Tool:\*\*\s*(.+)/);
    if (toolMatch) tool = toolMatch[1].trim();

    // Extract summary (between --- and ## Chunks)
    const sepIdx = content.indexOf("---");
    if (sepIdx >= 0) {
      const after = content.slice(sepIdx + 3);
      const chunksIdx = after.indexOf("## Chunks");
      const decisionsIdx = after.indexOf("## Key Decisions");
      summary =
        chunksIdx >= 0
          ? after.slice(0, chunksIdx).trim()
          : after.slice(0, 500).trim();

      // Extract decisions
      if (decisionsIdx >= 0) {
        const decisionsSection = after.slice(decisionsIdx);
        const lines = decisionsSection.split("\n");
        for (const line of lines) {
          if (line.trim().startsWith("- ")) {
            decisions.push(line.trim().replace(/^-\s+/, ""));
          }
        }
      }
    } else {
      summary = content.slice(0, 500);
    }
  } catch {}

  return {
    id,
    date,
    branch,
    files,
    insertions,
    deletions,
    tool,
    summary: summary.replace(/^#+\s+/gm, "").trim(),
    decisions,
  };
}

function getFlagValue(args: string[], flag: string): number | null {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) {
    const v = parseInt(args[idx + 1]);
    return isNaN(v) ? null : v;
  }
  return null;
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
