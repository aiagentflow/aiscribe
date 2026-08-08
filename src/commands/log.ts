import { getDiff, getBranchName } from "../git";
import { generateSummary } from "../llm";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";
import { saveSession } from "../storage";
import { captureContext, formatContextForPrompt } from "../context/capture";

export async function log(args: string[]): Promise<void> {
  const withContext = args.includes("--with-context") || args.includes("-c");

  // 1. Get git info
  console.log("Scanning git diff...");
  const [diff, branch] = await Promise.all([getDiff(), getBranchName()]);

  if (!diff.diff.trim()) {
    console.log("No changes to record. Working tree is clean.");
    return;
  }

  console.log(`   Branch: ${branch}`);
  console.log(`   Files: ${diff.stats.filesChanged}`);
  console.log(`   Changes: +${diff.stats.insertions} / -${diff.stats.deletions}`);

  // 2. Capture AI tool context if requested
  let contextSection = "";
  if (withContext) {
    console.log("\nCapturing AI tool context...");
    const cwd = process.cwd();
    const context = await captureContext(cwd);

    if (context.tool) {
      console.log(`   Detected: ${context.tool}`);
      console.log(`   Sessions: ${context.sessionCount}`);
      console.log(`   Prompts: ${context.prompts.length}`);
      contextSection = formatContextForPrompt(context);
    } else {
      console.log("   No AI tool history detected for this project.");
    }
  }

  // 3. Generate summary via LLM
  console.log("\nGenerating session summary...");
  const userPrompt = buildUserPrompt(branch, diff.files, diff.stats, diff.diff);
  const fullUserPrompt = contextSection ? userPrompt + "\n" + contextSection : userPrompt;

  const summary = await generateSummary(SYSTEM_PROMPT, fullUserPrompt);

  // 4. Save to disk
  const filepath = saveSession(branch, summary, diff.stats, {
    tool: withContext ? (await captureContext(process.cwd())).tool : null,
  });

  console.log(`\nSession recorded!`);
  console.log(`   ${filepath}`);
  if (withContext) {
    console.log(`   AI tool context included.`);
  }
  console.log(`\nView: cat ${filepath}`);
}
