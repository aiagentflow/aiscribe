import { loadIndex } from "../storage";
import { detectHotspots, fileTimeline, detectRiskPatterns } from "../patterns";
import { bold, dim, green, yellow, red, gray, cyan } from "../terminal";
import { jsonSuccess } from "../json-output";
import * as path from "path";

export async function hotspots(args: string[]): Promise<void> {
  const isJson = args.includes("--json");
  const index = loadIndex();
  if (index.sessions.length === 0) {
    if (isJson) jsonSuccess("hotspots", []);
    else console.log(gray("\n  No sessions found. Run 'aiscribe log' first.\n"));
    return;
 }

  const topK = parseInt(args.filter(a => a !== "--json")[0]) || 10;
  const hot = detectHotspots(index.sessions, topK);

  if (isJson) {
    jsonSuccess("hotspots", hot.map(h => ({
      file: h.file, sessions: h.sessions, totalChanges: h.totalChanges,
      lastChanged: h.lastChanged,
    })));
    return;
  }

  if (hot.length === 0) {
    console.log(gray("\n  No file patterns detected yet. More sessions needed.\n"));
    return;
  }

  console.log("");
  console.log(bold("  File Hotspots"));
  console.log(dim("  Files that change most often across sessions"));
  console.log("");

  for (let i = 0; i < hot.length; i++) {
    const h = hot[i];
    const bar = "█".repeat(Math.min(h.sessions, 20));
    const label = h.sessions >= 5 ? red : h.sessions >= 3 ? yellow : green;
    console.log(
      `  ${dim(String(i + 1).padStart(2))}. ${label(h.file)}`
    );
    console.log(
      `     ${bar} ${h.sessions} sessions, ${h.totalChanges} changes`
    );
    console.log(
      `     ${dim("Last: " + new Date(h.lastChanged).toLocaleDateString())}`
    );
    console.log("");
  }

  // Risk patterns
  const risks = detectRiskPatterns(index.sessions);
  if (risks.length > 0) {
    console.log(bold("  Risk Patterns"));
    console.log(dim("  Common issues detected across sessions"));
    console.log("");

    for (const r of risks) {
      const icon =
        r.pattern === "config-mutations"
          ? "⚙"
          : r.pattern === "missing-tests"
            ? "🧪"
            : "📄";
      console.log(
        `  ${icon}  ${bold(r.pattern)} ${dim("(" + r.count + " sessions)")}`
      );
      console.log(`     ${gray(r.description)}`);
      console.log("");
    }
  }
}

export async function history(args: string[]): Promise<void> {
  const isJson = args.includes("--json");
  const filterArgs = args.filter(a => a !== "--json");
  const filePath = filterArgs.join(" ").trim();

  if (!filePath) {
    if (isJson) { jsonSuccess("history", { error: "No file path provided" }); return; }
    console.log(`
${bold("aiscribe history <file>")}

See every session that touched a file.

Examples:
  ${cyan("aiscribe history src/payment.ts")}
  ${cyan("aiscribe history package.json")}
`);
    return;
  }

  const index = loadIndex();
  if (index.sessions.length === 0) {
    if (isJson) jsonSuccess("history", []);
    else console.log(gray("\n  No sessions found.\n"));
    return;
  }

  const timeline = fileTimeline(filePath, index.sessions);

  if (timeline.length === 0) {
    if (isJson) jsonSuccess("history", []);
    else console.log(gray(`\n  No sessions touched "${filePath}".\n`));
    return;
  }

  if (isJson) {
    jsonSuccess("history", { file: filePath, sessions: timeline, total: index.sessions.length });
    return;
  }

  console.log("");
  console.log(bold(`  ${filePath}`));
  console.log(dim(`  Changed in ${timeline.length} of ${index.sessions.length} sessions`));
  console.log("");

  for (const t of timeline) {
    const date = new Date(t.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    console.log(`  ${dim(date)}  ${bold(t.branch)}`);
    if (t.snippet) {
      console.log(`           ${gray(t.snippet.slice(0, 120))}`);
    }
    console.log("");
  }

  const percent = Math.round(
    (timeline.length / index.sessions.length) * 100
  );
  if (percent > 50) {
    console.log(
      `  ${yellow("⚠")}  This file changes in ${percent}% of sessions. Consider splitting it.`
    );
    console.log("");
  }
}
