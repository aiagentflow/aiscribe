// Prompt template for AI session summarization
export const SYSTEM_PROMPT = `You are an AI session scribe. Document what happened in an AI coding session.

The conversation (if present) is shown as a Numbered Conversation, where each "Turn N" begins at a user message. Use these turn numbers to cite which turns motivated each change.

Output format:

## Summary
[2-3 sentences capturing what was discussed and what code changed]

## Chunks
[Group CODE changes by domain. If no code changes, write "No code changes."]
- **[Name]** (N files, Risk: Low/Medium/High)
  - Purpose: [1 sentence]
  - Files: [comma-separated]
  - Turns: [source turn numbers, e.g. "3-4" or "2"; use "—" when not tied to a turn]

## Key Decisions
[Bullet points. Include decisions from conversation even without code changes.]
- [Decision] — Turns: [source turn numbers, e.g. "2, 5"]

## Suspicious Changes
[Flag anything unusual, or write "Nothing suspicious."]

## Files Changed
[Full list, or "No files changed."]

Keep it concise. The raw conversation is included separately in the session file.`;

export function buildUserPrompt(
  branch: string,
  files: string[],
  stats: { insertions: number; deletions: number; filesChanged: number },
  diff: string
): string {
  // If no diff, focus on conversation
  if (!diff.trim()) {
    return `Session: ${branch}\nNo code changes were made. The conversation context below describes what was discussed.`;
  }

  // Cap the diff so a huge session can't overflow the model context or cost.
  const MAX_DIFF = 12000;
  const clippedDiff =
    diff.length > MAX_DIFF
      ? diff.slice(0, MAX_DIFF) + "\n... [diff truncated]"
      : diff;

  return `Session: ${branch}
Files changed: ${stats.filesChanged}
Lines: +${stats.insertions} / -${stats.deletions}

Changed files:
${files.map((f) => `  - ${f}`).join("\n")}

Code diff:
\`\`\`diff
${clippedDiff}
\`\`\``;
}
