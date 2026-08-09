# AIScribe CLI Reference

## Global Flags

| Flag | Description |
|------|-------------|
| `--version`, `-v` | Show version number |
| `--help`, `-h` | Show global help |
| `<cmd> --help` | Show help for a specific command |

## Commands

### `aiscribe log`

Journal the current git diff as a structured session.

```bash
aiscribe log                # Basic session journal
aiscribe log -c             # Include AI tool context
aiscribe log --with-context # Same as -c
aiscribe log --json         # Output as JSON
aiscribe log --quiet        # Print only the file path
```

**What it does:**
1. Reads staged and unstaged git diff
2. Optionally captures prompt history from Claude Code/Codex/Aider
3. Sends to LLM for structured summarization
4. Saves as markdown in `.aiscribe/sessions/`

**Output:** Markdown file at `.aiscribe/sessions/YYYY-MM-DD-branch-name.md`

---

### `aiscribe search`

Search sessions by meaning (semantic) or keyword.

```bash
aiscribe search "payment refund"    # Semantic search (with API key)
aiscribe search "auth bug"          # Keyword search (without API key)
aiscribe search "api" --json        # Output as JSON
aiscribe search "api" --quiet       # Print only session IDs
```

**How it works:**
- With API key: generates embedding for your query, finds similar sessions via cosine similarity
- Without API key: falls back to keyword matching on branch names and file paths

---

### `aiscribe hotspots`

Show files that change most frequently across sessions.

```bash
aiscribe hotspots           # Top 10 files
aiscribe hotspots 20        # Top 20 files
aiscribe hotspots --json    # Output as JSON
```

**Output includes:**
- File path with color-coded frequency (green/yellow/red)
- Session count and total changes
- Last modified date

---

### `aiscribe history`

Show every session that touched a specific file.

```bash
aiscribe history src/payment.ts
aiscribe history package.json
```

**Warns if** a file changes in >50% of sessions (potential god object).

---

### `aiscribe server`

Start the web UI server.

```bash
aiscribe server              # Start on localhost:3848
aiscribe server --docker     # Start with Docker config
PORT=4000 aiscribe server    # Custom port
```

**Web UI features:**
- Paginated session list
- Full-text search
- Sort by date/files/changes
- Session detail with markdown rendering
- Dark theme

---

### `aiscribe remote`

Configure git remote backup. Every `aiscribe log` auto-pushes sessions to your private repo.

```bash
aiscribe remote                    # Show current remote status
aiscribe remote set <git-url>      # Configure backup repo
aiscribe remote disable            # Turn off automatic backup
```

**What it does:**
1. Clones your private repo to `~/.aiscribe/remote/`
2. On every `aiscribe log`, copies the session file + index into the repo
3. Commits and pushes automatically, organized by project name
4. Tracks errors and pauses if too many failures

**Example:**
```bash
aiscribe remote set git@github.com:you/ai-sessions.git
# Now every aiscribe log auto-pushes
```

**Backup repo structure:**
```
ai-sessions/
├── my-project/
│   ├── 2026-08-08-stripe-refunds.md
│   └── index.json
├── other-project/
│   ├── 2026-08-09-auth-fix.md
│   └── index.json
└── ...
```

---

### `aiscribe doctor`

Validate your setup. Checks 7 things:

1. Node.js version (>= 20)
2. Git installed
3. Current directory is a git repo
4. API key configured
5. `.aiscribe/` directory healthy
6. Config file exists
7. Provider connectivity

```bash
aiscribe doctor
```

---

### `aiscribe setup`

```bash
aiscribe setup                       # Generate Docker files
aiscribe setup --reconfigure         # Change LLM provider or API key
```

---

### `aiscribe help`

```bash
aiscribe help             # All commands
aiscribe log --help       # Log-specific help
aiscribe search --help    # Search-specific help
```

## Configuration

### Interactive (recommended)

Run `aiscribe log` for the first time. Select a provider and enter your API key. Saved to `~/.aiscribe/config.json`.

To change later: `aiscribe setup --reconfigure`

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `AISCRIBE_PROVIDER` | LLM provider | `openrouter`, `anthropic`, `openai`, `deepseek`, `custom`, `ollama` |
| `AISCRIBE_API_KEY` | API key | `sk-or-...` |
| `AISCRIBE_MODEL` | Override model | `gpt-4o-mini` |
| `AISCRIBE_BASE_URL` | Custom endpoint URL | `https://your-api.com/v1` |
| `OLLAMA_HOST` | Ollama server | `http://localhost:11434` |
| `PORT` | Server port | `3848` |
| `AISCRIBE_SERVER` | Sync target server | `http://localhost:3848` |

### Config File

`~/.aiscribe/config.json`:
```json
{
  "provider": "openrouter",
  "apiKey": "sk-or-...",
  "model": "anthropic/claude-sonnet-4",
  "remoteUrl": "git@github.com:you/ai-sessions.git",
  "remoteEnabled": true,
  "remoteLastSync": "2026-08-08T14:32:00Z",
  "remoteErrors": 0
}
```

## File Structure

```
.aiscribe/
├── sessions/           # Session markdown files
│   └── 2026-08-08-feature-name.md
├── embeddings/         # Vector embedding JSON files
│   └── 2026-08-08-feature-name.json
├── index.json          # Session index for quick lookups
├── docker-compose.yml  # Docker setup (generated)
├── init.sql            # Database schema (generated)
├── Dockerfile          # Container config (generated)
└── sync-state.json     # Sync tracking (generated)

~/.aiscribe/
├── config.json         # Global provider + remote configuration
└── remote/             # Git backup repo clone
```
