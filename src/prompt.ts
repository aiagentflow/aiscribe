// Prompt template for AI session summarization
export const SYSTEM_PROMPT = `You are an AI session scribe. Your job is to document what happened in an AI coding session by analyzing both the git diff AND the conversation context.

IMPORTANT: The conversation context shows what the human and AI actually discussed. Use it to understand the session's real purpose. The git diff shows what code changed as a result.

Output format:

## Summary
[2-3 sentences capturing: what was discussed, what decisions were made, and what code changed]

## Conversation
[A brief summary of the main topics discussed in this session, based on the conversation context]

## Chunks
[Group CODE changes by domain/feature:]
- **[Chunk Name]** (N files, Risk: Low/Medium/High)
  - Purpose: [1 sentence]
  - Files: [comma-separated]

## Key Decisions
[Decisions made during the session. If conversation context shows decisions, include them even if no code reflects them yet.]

## Suspicious Changes
[Flag anything unusual: files changed outside the main domain, config mutations, deleted code without replacement.]

## Files Changed
[Full list of changed files from git diff]

If there are NO code changes but conversation context exists, still write a meaningful summary of what was discussed.`;

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
