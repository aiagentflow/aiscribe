import { getDiff, getBranchName } from "../git";
import { generateSummary } from "../llm";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompt";
import { saveSession } from "../storage";

export async function log(args: string[]): Promise<void> {
  // 1. Get git info
  console.log("📋 Scanning git diff...");
  const [diff, branch] = await Promise.all([getDiff(), getBranchName()]);

  if (!diff.diff.trim()) {
    console.log("✅ No changes to record. Working tree is clean.");
    return;
  }

  console.log(`   Branch: ${branch}`);
  console.log(`   Files: ${diff.stats.filesChanged}`);
  console.log(`   Changes: +${diff.stats.insertions} / -${diff.stats.deletions}`);

  // 2. Generate summary via LLM
  console.log("\n🤖 Generating session summary...");
  const userPrompt = buildUserPrompt(branch, diff.files, diff.stats, diff.diff);
  const summary = await generateSummary(SYSTEM_PROMPT, userPrompt);

  // 3. Save to disk
  const filepath = saveSession(branch, summary, {
    files: diff.files,
    insertions: diff.stats.insertions,
    deletions: diff.stats.deletions,
    filesChanged: diff.stats.filesChanged,
  });

  console.log(`\n✅ Session recorded!`);
  console.log(`   ${filepath}`);
  console.log(`\n📖 View: cat ${filepath}`);
}
