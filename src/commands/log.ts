import { getDiff, getBranchName } from "../git";
import { generateSummary } from "../llm";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";
import { saveSession } from "../storage";
import { captureContext, formatContextForPrompt, readPiFullTranscript } from "../context/capture";
import { writeContextFile } from "./context";
import { hasEnvConfig, loadConfig } from "../onboarding";
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
  const hasKey = hasEnvConfig() || !!loadConfig();
  // Auto-fallback: no API key? use full mode without LLM summary
  let effectiveFull = isFull || !hasKey;
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
    let fullTranscript: import("../context/capture").FullTranscript | null = null;

    if (withContext) {
      if (!isQuiet && !isJson) console.log(boxMid("context"));
      const cwd = process.cwd();
      const context = await captureContext(cwd);

      contextTool = context.tool;
      contextSessionCount = context.sessionCount;
      contextPromptCount = context.prompts.length;
      contextSection = formatContextForPrompt(context);

      // Capture full transcript if available (pi sessions)
      try {
        fullTranscript = readPiFullTranscript(cwd);
      } catch {}

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

    const summary = effectiveFull
      ? buildFullSummary(branch, diff, contextSection)
      : await generateSummary(SYSTEM_PROMPT, fullUserPrompt);

    // Append raw conversation log to the summary
    let fullSummary = summary;
    if (contextSection) {
      fullSummary += "\n\n## Conversation Log\n\n";
      fullSummary += contextSection;
    }

    // Append full transcript as clean chat conversation
    if (fullTranscript && fullTranscript.messages.length > 0) {
      fullSummary += "\n\n## Session Conversation\n\n";

      if (fullTranscript.filesRead.length > 0) {
        fullSummary += "**Files read:** ";
        fullSummary += fullTranscript.filesRead.map(f => "`" + f.replace(process.cwd(), "") + "`").join(", ");
        fullSummary += "\n\n";
      }
      if (fullTranscript.commandsRun.length > 0) {
        fullSummary += "**Commands run:** ";
        fullSummary += fullTranscript.commandsRun.map(c => "`" + c.slice(0, 80) + "`").join(", ");
        fullSummary += "\n\n";
      }

      fullSummary += "---\n\n";
      for (const msg of fullTranscript.messages) {
        const time = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        if (msg.role === "user") {
          fullSummary += `<div class="chat-user">\n\n**You** _${time}_\n\n${msg.content.slice(0, 800)}\n\n</div>\n\n`;
        } else if (msg.role === "assistant") {
          fullSummary += `<div class="chat-assistant">\n\n**AiScribe** _${time}_\n\n${msg.content.slice(0, 800)}\n\n</div>\n\n`;
        } else {
          fullSummary += `<div class="chat-tool">\n\n_${msg.toolName || "tool"}_ _${time}_\n\n\`\`\`\n${msg.content.slice(0, 500)}\n\`\`\`\n\n</div>\n\n`;
        }
      }
    }

    if (spinner) spinner.stop(effectiveFull ? "Session captured" : "Summary generated");

    // 4. Generate embedding
    let hasEmbedding = false;
    try {
      const { generateEmbedding } = await import("../embeddings");
      const emb = await generateEmbedding(fullSummary);
      hasEmbedding = !!emb;
    } catch {}

    // 5. Save
    const filepath = saveSession(
      branch,
      fullSummary,
      diff.stats,
      { tool: contextTool, customName: sessionName },
      hasEmbedding ? { vector: [], model: "", generated: "" } : null
    );

    // 6. Auto-generate context file for AI agents
    try { writeContextFile(); } catch {}

    // 7. Try to POST to server if running (Docker DB integration)
    try {
      const serverUrl = process.env.AISCRIBE_SERVER || "http://localhost:3848";
      const healthRes = await fetch(`${serverUrl}/api/health`);
      if (healthRes.ok) {
        await fetch(`${serverUrl}/api/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: path.basename(filepath).replace(".md", ""),
            branch: sessionName || branch,
            date: new Date().toISOString(),
            filesChanged: diff.stats.filesChanged,
            insertions: diff.stats.insertions,
            deletions: diff.stats.deletions,
            summary: fullSummary,
            aiTool: contextTool,
          }),
        });
      }
    } catch {
      // Server not running, that's fine
    }

    // 8. Output
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

      // Git remote backup (non-blocking)
      try {
        const { pushSession } = await import("../remote");
        const projectName = path.basename(process.cwd());
        const pushed = await pushSession(filepath, projectName);
        if (pushed) console.log(dim("  Synced to remote repo."));
      } catch {}

      console.log("");
      console.log(dim("  View: ") + "cat " + filepath);
      console.log(dim("  Web:  ") + "aiscribe server");
      if (!hasKey && !isFull) {
        console.log("");
        console.log(dim("  Tip: ") + "Run " + cyan("aiscribe setup --reconfigure") + dim(" to add an LLM for AI summaries."));
      }
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
