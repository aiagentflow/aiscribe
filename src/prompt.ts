// Prompt template for AI session summarization
export const SYSTEM_PROMPT = `You are an AI session scribe. Document what happened in an AI coding session.

The Conversation Context (if present) shows the raw chat log. Use it to understand the session.

Output format:

## Summary
[2-3 sentences capturing what was discussed and what code changed]

## Chunks
[Group CODE changes by domain. If no code changes, write "No code changes."]
- **[Name]** (N files, Risk: Low/Medium/High)
  - Purpose: [1 sentence]
  - Files: [comma-separated]

## Key Decisions
[Bullet points. Include decisions from conversation even without code changes.]

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

  return `Session: ${branch}
Files changed: ${stats.filesChanged}
Lines: +${stats.insertions} / -${stats.deletions}

Changed files:
${files.map((f) => `  - ${f}`).join("\n")}

Code diff:
\`\`\`diff
${diff}
\`\`\``;
}
