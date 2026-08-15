# Supported AI Tools

AIScribe captures conversation context from the following AI coding tools. Detection is automatic when you use `-c` or `--with-context`.

## Full Support (conversation + responses)

| Tool | What's Captured | Source |
|------|----------------|--------|
| **pi (Harness)** | Full conversation: user prompts, assistant responses, tool calls, timestamps | `~/.pi/agent/sessions/` |
| **Claude Code** | Full conversation: user prompts, assistant responses, tool calls, timestamps | `~/.claude/projects/<project>/` |

pi and Claude Code store complete session transcripts on disk. Every message (user, assistant, tool calls) is captured with timestamps.

## Partial Support (user prompts only)

| Tool | What's Captured | Source | Limitation |
|------|----------------|--------|------------|
| **Codex (OpenAI)** | User prompts only | `~/.codex/history.jsonl` | Does not persist assistant responses or tool calls. Only the prompts you typed are stored. |
| **Aider** | User prompts only | `.aider.chat.history.md` | Same limitation. |

## Not Supported

| Tool | Reason |
|------|--------|
| **Cursor** | No known local history file. Cursor stores data in its Electron app database (SQLite), which is not easily accessible. |
| **Windsurf** | No known local history file. |
| **GitHub Copilot** | No local history storage. |
| **Gemini CLI** | Detected but no history reader implemented yet. Sessions may exist in `~/.gemini/`. |
| **Continue.dev** | Stores in local SQLite database. Reader not yet implemented. |

## How Claude Code Captures Full Conversations

Claude Code writes every message to `~/.claude/projects/<encoded-project-path>/<session-id>.jsonl`. AIScribe reads the most recently modified session file for the current project and reconstructs the conversation: user prompts, assistant responses (text and thinking), and tool calls (Read, Bash, Edit, Write) with timestamps and file/command metadata.

When AIScribe captures a Claude Code session, you get:
- Git diff (what files changed)
- Full conversation (your prompts, Claude's responses, tool calls)
- LLM-generated summary connecting the two, with each decision citing its source turns

## How pi Captures Full Conversations

pi writes every message to `~/.pi/agent/sessions/` as JSONL files during the session. Each line contains:

```json
{"type": "message", "message": {"role": "user", "content": [...], "timestamp": 123456789}}
{"type": "message", "message": {"role": "assistant", "content": [...], "timestamp": 123456790}}
{"type": "message", "message": {"role": "toolResult", "toolName": "bash", "content": [...]}}
```

This allows AIScribe to reconstruct the exact conversation with timestamps.

## Adding Support for a New Tool

If you want AIScribe to support your AI coding tool:

1. Find where the tool stores its conversation history (a JSONL file, SQLite database, or text log)
2. Add a reader function in `src/context/capture.ts`
3. Register it in the `captureContext()` function
4. Test with `aiscribe log -c`

For tools that don't persist history: AIScribe can still capture the git diff. Use `aiscribe log` without `-c` for a code-only session summary.

## Session Modes

| Flag | What You Get | Needs API Key |
|------|-------------|---------------|
| `aiscribe log` | Git diff + LLM summary | Yes |
| `aiscribe log -c` | Git diff + conversation context + LLM summary | Yes |
| `aiscribe log -c -f` | Git diff + raw conversation log (no LLM) | No |
| `aiscribe log -f` | Git diff only (no LLM) | No |

## Train Your Own Local LLM

Every AIScribe session captures your real coding conversations: what you asked, what the AI did, what files changed, what decisions were made. Over weeks and months, this becomes a personalized dataset of YOUR development patterns.

**What you can do with this data:**

1. **Fine-tune a local model** (Llama, Qwen, Mistral) on your own coding style
2. **Build project-specific skills** for AI agents based on your past decisions
3. **Create a "second brain"** that remembers every architectural choice you've made

**How to export your data for training:**

```bash
# Export all sessions as AI-friendly text
aiscribe export --format ai --output training-data.txt

# Export as JSON for programmatic use
aiscribe export --format json --output sessions.json

# Export single project
cd /your/project && aiscribe export --format ai
```

The `--format ai` export is optimized for LLM context windows: compact, chronological, with prompts and decisions.

**Privacy:** All data stays local. Your `.aiscribe/` directory is on your machine. Nothing is sent anywhere unless you choose to.
