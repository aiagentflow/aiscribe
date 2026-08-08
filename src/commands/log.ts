import { getDiff, getBranchName } from "../git";
import { generateSummary } from "../llm";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";
import { saveSession } from "../storage";
import { captureContext, formatContextForPrompt } from "../context/capture";
import * as path from "path";
import {
  bold, dim, green, cyan, yellow, gray, red,
  createSpinner, boxTop, boxLine, boxMid, boxBot,
} from "../terminal";
import { jsonSuccess, jsonError } from "../json-output";

interface LogResult {
  branch: string;
  files: number;
  insertions: number;
  deletions: number;
  sessions: number;
  prompts: number;
  tool: string | null;
  file: string;
  summary: string;
}

export async function log(args: string[]): Promise<void> {
  const withContext = args.includes("--with-context") || args.includes("-c");
  const isJson = args.includes("--json");
  const isQuiet = args.includes("--quiet") || args.includes("-q");
  const isFull = args.includes("--full") || args.includes("-f");
  const cmdName = "log";

  // --name flag: custom session name
  let sessionName = getFlagValue(args, "--name");
  if (!sessionName) sessionName = getFlagValue(args, "-n");

  try {
    // 1. Get git info
    if (!isQuiet && !isJson) {
      console.log("");
      console.log(boxTop("git diff"));
    }

    const [diff, branch] = await Promise.all([getDiff(), getBranchName()]);

    // If no diff but we have --with-context, continue to capture context
    const hasGitDiff = diff.diff.trim().length > 0;

    if (!hasGitDiff && !withContext) {
      if (isJson) {
        jsonSuccess(cmdName, { branch, files: 0, message: "Working tree clean" });
      } else if (!isQuiet) {
        console.log(boxBot());
        console.log(green("\n  Nothing to record. Working tree is clean.\n"));
        console.log(gray("  Tip: Use -c flag to capture AI tool context without code changes."));
        console.log(gray("  Example: aiscribe log -c\n"));
      }
      return;
    }

    if (!isQuiet && !isJson) {
      console.log(boxLine("Branch", branch));
      console.log(boxLine("Files", String(diff.stats.filesChanged)));
      console.log(
        boxLine(
          "Changes",
          green("+" + diff.stats.insertions) + " " + red("-" + diff.stats.deletions)
        )
      );
    }

    // 2. Capture AI tool context
    let contextSection = "";
    let contextTool: string | null = null;
    let contextSessionCount = 0;
    let contextPromptCount = 0;

    if (withContext) {
      if (!isQuiet && !isJson) console.log(boxMid("context"));
      const cwd = process.cwd();
      const context = await captureContext(cwd);

      contextTool = context.tool;
      contextSessionCount = context.sessionCount;
      contextPromptCount = context.prompts.length;
      contextSection = formatContextForPrompt(context);

      if (!isQuiet && !isJson) {
        console.log(boxLine("Tool", contextTool || gray("none detected")));
        console.log(boxLine("Sessions", String(contextSessionCount)));
        console.log(boxLine("Prompts", String(contextPromptCount)));
      }
    }

    if (!isQuiet && !isJson) console.log(boxBot());

    // 3. Generate summary
    let spinner: ReturnType<typeof createSpinner> | null = null;
    if (!isQuiet && !isJson) {
      spinner = createSpinner("Generating session summary...");
      spinner.start();
    }

    const userPrompt = buildUserPrompt(branch, diff.files, diff.stats, diff.diff);
    const fullUserPrompt = contextSection ? userPrompt + "\n" + contextSection : userPrompt;

    // Allow context-only sessions (no git diff but AI prompts captured)
    const hasContent = diff.diff.trim() || contextSection;
    if (!hasContent) {
      if (spinner) spinner.stop("Nothing to record");
      if (!isQuiet && !isJson) {
        console.log(gray("\n  No changes and no AI context to record.\n"));
      }
      return;
    }

    const summary = isFull
      ? buildFullSummary(branch, diff, contextSection)
      : await generateSummary(SYSTEM_PROMPT, fullUserPrompt);

    // Append raw conversation log to the summary
    let fullSummary = summary;
    if (contextSection) {
      fullSummary += "\n\n## Conversation Log\n\n";
      fullSummary += contextSection;
    }

    if (spinner) spinner.stop(isFull ? "Session captured" : "Summary generated");

    // 4. Generate embedding
    let hasEmbedding = false;
    try {
      const { generateEmbedding } = await import("../embeddings");
      const emb = await generateEmbedding(summary);
      hasEmbedding = !!emb;
    } catch {}

    // 5. Save
    const filepath = saveSession(
      branch,
      summary,
      diff.stats,
      { tool: contextTool, customName: sessionName },
      hasEmbedding ? { vector: [], model: "", generated: "" } : null
    );

    // 6. Try to POST to server if running (Docker DB integration)
    try {
      const serverUrl = process.env.AISCRIBE_SERVER || "http://localhost:3848";
      const healthRes = await fetch(`${serverUrl}/api/health`);
      if (healthRes.ok) {
        await fetch(`${serverUrl}/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: path.basename(filepath).replace(".md", ""),
            branch,
            date: new Date().toISOString(),
            filesChanged: diff.stats.filesChanged,
            insertions: diff.stats.insertions,
            deletions: diff.stats.deletions,
            summary: summary,
            aiTool: contextTool,
          }),
        });
      }
    } catch {
      // Server not running, that's fine
    }

    // 7. Output
    if (isJson) {
      jsonSuccess(cmdName, {
        branch,
        files: diff.stats.filesChanged,
        insertions: diff.stats.insertions,
        deletions: diff.stats.deletions,
        sessions: contextSessionCount,
        prompts: contextPromptCount,
        tool: contextTool,
        file: filepath,
        summary: summary.slice(0, 500),
        hasEmbedding,
      } as LogResult);
    } else if (!isQuiet) {
      console.log("");
      console.log(green("  Session recorded!"));
      console.log(dim("  " + filepath));
      console.log("");
      console.log(dim("  View: ") + "cat " + filepath);
      console.log(dim("  Web:  ") + "aiscribe server");
      console.log("");
    } else {
      // Quiet mode: just print the file path
      console.log(filepath);
    }
  } catch (err: any) {
    if (isJson) {
      jsonError(cmdName, err.message);
    } else {
      if (!isQuiet) {
        console.log(red("  Failed: " + err.message));
        console.log(dim("\n  Tip: Run") + " aiscribe setup --reconfigure " + dim("to change provider."));
      }
    }
    process.exit(1);
  }
}

function getFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function buildFullSummary(
  branch: string,
  diff: { files: string[]; diff: string; stats: { insertions: number; deletions: number; filesChanged: number } },
  contextSection: string
): string {
  let out = "## Summary\n";
  out += `Session captured on branch "${branch}". `;
  if (diff.stats.filesChanged > 0) {
    out += `${diff.stats.filesChanged} file(s) changed (+${diff.stats.insertions}/-${diff.stats.deletions}). `;
  } else {
    out += "No code changes. ";
  }
  out += "See conversation log below for full details.\n";

  if (diff.files.length > 0) {
    out += "\n## Files Changed\n";
    for (const f of diff.files) out += `- ${f}\n`;
  }

  if (diff.diff.trim()) {
    out += "\n## Git Diff\n```diff\n";
    out += diff.diff.slice(0, 5000);
    out += "\n```\n";
  }

  return out;
}
