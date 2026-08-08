// Prompt template for AI session summarization
export const SYSTEM_PROMPT = `You are an AI session scribe. Your job is to analyze a git diff and produce a clear, concise session summary.

Output format (use exactly this structure):

## Summary
[2-3 sentences describing what this session accomplished]

## Chunks
[Group the changes into logical chunks by domain/feature. For each chunk:]
- **[Chunk Name]** (N files, Risk: Low/Medium/High)
  - Purpose: [1 sentence]
  - Files: [comma-separated list]

## Key Decisions
[Bullet points of architectural or design decisions visible in the diff. If none obvious, write "No major decisions detected."]

## Suspicious Changes
[Flag anything unusual: files changed outside the main domain, config files touched unexpectedly, deleted code without replacement, hardcoded values. If nothing suspicious, write "Nothing suspicious detected."]

## Files Changed
[Full list of changed files]

Keep it concise. Focus on what a developer needs to remember next week.`;

export function buildUserPrompt(
  branch: string,
  files: string[],
  stats: { insertions: number; deletions: number; filesChanged: number },
  diff: string
): string {
  return `Session: ${branch}
Files changed: ${stats.filesChanged}
Lines: +${stats.insertions} / -${stats.deletions}

Changed files:
${files.map((f) => `  - ${f}`).join("\n")}

Full diff:
\`\`\`diff
${diff}
\`\`\``;
}
