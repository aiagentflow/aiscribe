import { getDiff, getBranchName } from "../git";
import { generateSummary } from "../llm";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";
import { saveSession } from "../storage";
import { captureContext, formatContextForPrompt } from "../context/capture";
import {
  bold, dim, green, cyan, yellow, gray, red,
  statsBar, createSpinner, boxTop, boxLine, boxMid, boxBot,
} from "../terminal";

export async function log(args: string[]): Promise<void> {
  const withContext = args.includes("--with-context") || args.includes("-c");

  // 1. Get git info
  console.log("");
  console.log(boxTop("git diff"));
  const [diff, branch] = await Promise.all([getDiff(), getBranchName()]);

  if (!diff.diff.trim()) {
    console.log(boxBot());
    console.log(green("\n  Nothing to record. Working tree is clean.\n"));
    return;
  }

  console.log(boxLine("Branch", branch));
  console.log(boxLine("Files", String(diff.stats.filesChanged)));
  console.log(
    boxLine(
      "Changes",
      green("+" + diff.stats.insertions) + " " + red("-" + diff.stats.deletions)
    )
  );

  // 2. Capture AI tool context if requested
  let contextSection = "";
  if (withContext) {
    console.log(boxMid("context"));
    const cwd = process.cwd();
    const context = await captureContext(cwd);

    if (context.tool) {
      console.log(boxLine("Tool", context.tool));
      console.log(boxLine("Sessions", String(context.sessionCount)));
      console.log(boxLine("Prompts", String(context.prompts.length)));
      contextSection = formatContextForPrompt(context);
    } else {
      console.log(boxLine("Tool", gray("none detected")));
    }
  }

  console.log(boxBot());

  // 3. Generate summary via LLM
  const spinner = createSpinner("Generating session summary via LLM...");
  spinner.start();

  try {
    const userPrompt = buildUserPrompt(branch, diff.files, diff.stats, diff.diff);
    const fullUserPrompt = contextSection ? userPrompt + "\n" + contextSection : userPrompt;
    const summary = await generateSummary(SYSTEM_PROMPT, fullUserPrompt);

    spinner.stop("Summary generated");

    // 4. Save to disk
    const filepath = saveSession(branch, summary, diff.stats, {
      tool: withContext ? (await captureContext(process.cwd())).tool : null,
    });

    console.log("");
    console.log(green("  Session recorded!"));
    console.log(dim("  " + filepath));
    console.log("");
    console.log(dim("  View: ") + "cat " + filepath);
    console.log(dim("  Web:  ") + "aiscribe server");
    console.log("");
  } catch (err: any) {
    spinner.fail("Summary failed");
    console.log(red("  " + err.message));
    console.log("");
    console.log(dim("  Tip: Run") + " aiscribe setup --reconfigure " + dim("to change provider or key."));
    console.log("");
    process.exit(1);
  }
}
