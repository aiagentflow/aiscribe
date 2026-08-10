import { getDiff, getBranchName } from "../git";
import { generateSummary } from "../llm";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";
import { saveSession } from "../storage";
import { captureContext, formatContextForPrompt, readPiFullTranscript } from "../context/capture";
import type { EmbeddingData } from "../embeddings";
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
  paths: string[];
  batches: number;
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

    // Date range for context capture
    const sinceArg = getFlagValue(args, "--since");
    let sinceDate: Date | null = null;
    let batchMode: string = "exchange"; // exchange | lines | none
    let batchLines: number = 800;

    if (sinceArg) {
      sinceDate = parseDateRange(sinceArg);
    } else if (withContext && !isQuiet && !isJson && process.stdin.isTTY) {
      const result = await askDateRange();
      sinceDate = result.date;
      batchMode = result.batchMode;
      batchLines = result.batchLines;
    } else {
      sinceDate = parseDateRange("today");
    }

    if (withContext) {
      if (!isQuiet && !isJson) console.log(boxMid("context"));
      const cwd = process.cwd();
      const context = await captureContext(cwd);

      // Filter prompts by date range
      if (sinceDate) {
        const cutoff = sinceDate.getTime();
        context.prompts = context.prompts.filter(p => p.timestamp >= cutoff);
        context.sessionCount = new Set(context.prompts.map(p => p.sessionId)).size;
        context.fullContext = context.prompts.map(p => `[${new Date(p.timestamp).toISOString().split("T")[0]}] ${p.text}`).join("\n");
        contextSection = formatContextForPrompt(context);
      } else {
        contextSection = formatContextForPrompt(context);
      }

      contextTool = context.tool;
      contextSessionCount = context.sessionCount;
      contextPromptCount = context.prompts.length;

      // Capture full transcript if available (pi sessions), filtered by date
      try {
        fullTranscript = readPiFullTranscript(cwd);
        if (fullTranscript && sinceDate) {
          const cutoff = sinceDate.getTime();
          fullTranscript.messages = fullTranscript.messages.filter(m => m.timestamp >= cutoff);
        }
      } catch {}

      if (!isQuiet && !isJson) {
        console.log(boxLine("Tool", contextTool || gray("none detected")));
        console.log(boxLine("Sessions", String(contextSessionCount)));
        console.log(boxLine("Prompts", String(contextPromptCount)));
        if (sinceDate) console.log(boxLine("Since", sinceDate.toISOString().split("T")[0]));
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

    // Append raw conversation log
    let fullSummary = summary;
    if (contextSection) {
      fullSummary += "\n\n## Conversation Log\n\n";
      fullSummary += contextSection;
    }

    // Append file/command metadata from full transcript
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
    }

    // Remove old inline chat formatting - now handled by batching below
    let baseSummary = fullSummary; // Summary without individual messages

    if (spinner) spinner.stop(effectiveFull ? "Session captured" : "Summary generated");

    // 4. Smart batching
    const fullLines = fullSummary.split("\n");
    const batches: string[] = [];

    if (batchMode === "exchange" && fullTranscript && fullTranscript.messages.length > 0) {
      // Batch by conversation exchange: one user prompt + all responses = one batch
      let currentBatch = baseSummary; // Summary + files read + commands run
      let exchangeCount = 0;
      for (const msg of fullTranscript.messages) {
        const isNewExchange = msg.role === "user";
        if (isNewExchange && currentBatch.split("\n").length > 100) {
          // Save previous batch, start new one
          if (exchangeCount > 0) {
            const header = `# ${sessionName || branch} (Exchange ${exchangeCount + 1})\n\n` +
              `**Date:** ${new Date().toISOString()}\n**Branch:** ${branch}\n\n---\n\n`;
            batches.push(currentBatch);
            currentBatch = header;
          }
          exchangeCount++;
        }
        const time = new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        if (msg.role === "user") {
          currentBatch += `<div class="chat-user">\n\n**You** _${time}_\n\n${detectAndFormatCode(msg.content.slice(0, 2000))}\n\n</div>\n\n`;
        } else if (msg.role === "assistant") {
          currentBatch += `<div class="chat-assistant">\n\n**AiScribe** _${time}_\n\n${detectAndFormatCode(msg.content.slice(0, 2000))}\n\n</div>\n\n`;
        } else {
          currentBatch += `<div class="chat-tool">\n\n_${msg.toolName || "tool"}_ _${time}_\n\n\`\`\`\n${msg.content.slice(0, 1000)}\n\`\`\`\n\n</div>\n\n`;
        }
      }
      batches.push(currentBatch);
    } else if (fullLines.length <= batchLines) {
      batches.push(fullSummary);
    } else {
      // Line-based batching
      const batchCount = Math.ceil(fullLines.length / batchLines);
      for (let i = 0; i < batchCount; i++) {
        const start = i * batchLines;
        const end = start + batchLines;
        let chunk = fullLines.slice(start, end).join("\n");
        if (i > 0) {
          chunk = `# ${sessionName || branch} (Part ${i + 1}/${batchCount})\n\n` +
            `**Date:** ${new Date().toISOString()}\n**Branch:** ${branch}\n\n---\n\n` + chunk;
        }
        batches.push(chunk);
      }
    }

    // Embed the full session once for semantic search. The real vector is
    // attached to the first saved file so `aiscribe search` can match it.
    let embedding: EmbeddingData | null = null;
    try {
      const { generateEmbedding } = await import("../embeddings");
      embedding = await generateEmbedding(fullSummary);
    } catch {}

    // Save each batch. Only the first file carries the embedding; extra
    // parts (exchanges) are saved without one to avoid duplicate matches.
    const filepaths: string[] = [];
    for (let i = 0; i < batches.length; i++) {
      const suffix = batches.length > 1 && i > 0
        ? `-exchange${i + 1}`
        : undefined;
      const batchName = suffix ? `${sessionName || branch}${suffix}` : (sessionName || undefined);
      const fp = saveSession(
        branch,
        batches[i],
        diff.stats,
        { tool: contextTool, customName: batchName, files: i === 0 ? diff.files : [] },
        i === 0 ? embedding : null
      );
      filepaths.push(fp);
    }

    // Primary file (first batch) — used for the optional server POST below.
    const filepath = filepaths[0];

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

    // 5. Output
    if (isJson) {
      jsonSuccess(cmdName, {
        branch,
        files: diff.stats.filesChanged,
        insertions: diff.stats.insertions,
        deletions: diff.stats.deletions,
        sessions: contextSessionCount,
        prompts: contextPromptCount,
        tool: contextTool,
        paths: filepaths,
        batches: filepaths.length,
        summary: summary.slice(0, 500),
      } as LogResult);
    } else if (!isQuiet) {
      console.log("");
      if (filepaths.length === 1) {
        console.log(green("  Session recorded!"));
        console.log(dim("  " + filepaths[0]));
      } else {
        console.log(green(`  Session recorded in ${filepaths.length} parts!`));
        for (const fp of filepaths) console.log(dim("  " + fp));
      }

      // Git remote backup (non-blocking)
      try {
        const { pushSession } = await import("../remote");
        const projectName = path.basename(process.cwd());
        for (const fp of filepaths) {
          try { await pushSession(fp, projectName); } catch {}
        }
      } catch {}

      console.log("");
      if (filepaths.length === 1) {
        console.log(dim("  View: ") + "cat " + filepaths[0]);
      }
      console.log(dim("  Web:  ") + "aiscribe server");
      if (!hasKey && !isFull) {
        console.log("");
        console.log(dim("  Tip: ") + "Run " + cyan("aiscribe setup --reconfigure") + dim(" to add an LLM for AI summaries."));
      }
      console.log("");
    } else {
      // Quiet mode: just print the file paths
      console.log(filepaths.join("\n"));
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

function parseDateRange(input: string): Date | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = input.toLowerCase().trim();
  if (t === "today") return now;
  if (t === "yesterday" || t === "yday") { const d = new Date(now); d.setDate(d.getDate() - 1); return d; }
  if (t === "week" || t === "last week" || t === "7") { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
  if (t === "2weeks" || t === "2 weeks" || t === "14") { const d = new Date(now); d.setDate(d.getDate() - 14); return d; }
  if (t === "3weeks" || t === "3 weeks" || t === "21") { const d = new Date(now); d.setDate(d.getDate() - 21); return d; }
  if (t === "month" || t === "30") { const d = new Date(now); d.setDate(d.getDate() - 30); return d; }
  if (t === "all" || t === "*") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return now;
}

function detectAndFormatCode(text: string): string {
  if (!text) return text;
  // If text already contains markdown code blocks, leave as-is
  if (text.includes("\`\`\`")) return text;
  // Detect common code patterns: indentation, brackets, semicolons, keywords
  const codeIndicators = ["function ", "const ", "let ", "var ", "import ", "export ", "class ", "interface ", "type ", "def ", "#!/", "<?php", "<html", "{", "}"];
  const lines = text.split("\n");
  const codeLines = lines.filter(l => codeIndicators.some(k => l.trim().startsWith(k)) || l.trim().match(/^[{}\[\];]/));
  if (codeLines.length > 3 || (codeLines.length > 0 && codeLines.length / lines.length > 0.5)) {
    // It's code - wrap in code block with auto-detected language
    const lang = detectLanguage(text);
    return "\`\`\`" + lang + "\n" + text + "\n\`\`\`";
  }
  return text;
}

function detectLanguage(text: string): string {
  const t = text.slice(0, 500);
  if (t.includes("import React") || t.includes("export default") || t.includes("useState")) return "tsx";
  if (t.includes("interface ") || t.includes(": string") || t.includes(": number")) return "typescript";
  if (t.includes("function ") || t.includes("const ") || t.includes("=>")) return "javascript";
  if (t.includes("def ") || t.includes("import ") && t.includes(":")) return "python";
  if (t.includes("#!/bin/") || t.includes("echo ") || t.includes("$")) return "bash";
  if (t.includes("package ") && t.includes("{")) return "json";
  if (t.includes("<html") || t.includes("<div")) return "html";
  return "";
}

async function askDateRange(): Promise<{ date: Date; batchMode: string; batchLines: number }> {
  const rl = (await import("readline")).createInterface({ input: process.stdin, output: process.stdout });
  console.log("");
  console.log(dim("  Capture conversation context since?"));
  console.log(dim("  [1] Today  [2] Yesterday  [3] This week  [4] Last week  [5] All"));
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  console.log(dim(`  Or type a date like ${yesterday} or ${today}`));

  const date = await new Promise<Date>((resolve) => {
    rl.question(dim("  Select [1-5] or date: "), (a) => {
      const t = a.trim();
      if (t === "1") resolve(parseDateRange("today")!);
      else if (t === "2") resolve(parseDateRange("yesterday")!);
      else if (t === "3") { const d = new Date(); d.setDate(d.getDate() - 7); resolve(d); }
      else if (t === "4") { const d = new Date(); d.setDate(d.getDate() - 14); resolve(d); }
      else if (t === "5") resolve(parseDateRange("all")!);
      else if (t) resolve(parseDateRange(t) || parseDateRange("today")!);
      else resolve(parseDateRange("today")!);
    });
  });

  console.log(dim("\n  Batch mode for long conversations?"));
  console.log(dim("  [1] Per exchange  [2] Per ~800 lines  [3] Single file"));

  const mode = await new Promise<string>((resolve) => {
    rl.question(dim("  Select [1-3]: "), (a) => {
      if (a.trim() === "2") resolve("lines");
      else if (a.trim() === "3") resolve("none");
      else resolve("exchange");
    });
  });

  let lines = 800;
  if (mode === "lines") {
    lines = await new Promise<number>((resolve) => {
      rl.question(dim("  Lines per file (default 800): "), (a) => {
        const n = parseInt(a.trim());
        resolve(n > 0 ? n : 800);
      });
    });
  }

  rl.close();
  return { date, batchMode: mode, batchLines: lines };
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
