# aiscribe

> Your AI's scribe. Every session, recorded.

Part of the [aiagentflow](https://aiagentflow.com) suite.

## Install

```bash
npm install -g aiscribe
```

**Requirements:**
- Node.js >= 20
- Git repo (any AI coding tool — Claude Code, Cursor, Codex, etc.)
- An LLM API key (see [Configuration](#configuration))

## Usage

```bash
# After any AI coding session:
aiscribe log
```

That's it. AIScribe reads your git diff, generates a structured summary via LLM, and stores it in `.aiscribe/sessions/`.

## What You Get

```
.aiscribe/
├── sessions/
│   ├── 2026-08-08-stripe-refunds.md
│   └── 2026-08-09-fix-auth-bug.md
└── index.json
```

Each session file looks like:

```markdown
# Session: stripe-refunds
**Date:** 2026-08-08T14:32:00.000Z
**Files changed:** 47
**Lines:** +892 / -156

## Summary
Implemented Stripe refund processing with webhook support...

## Chunks
- **Payment API** (6 files, Risk: Medium)
  - Purpose: ...
  - Files: payment/refund.ts, payment/webhook.ts, ...

## Key Decisions
- Used Stripe webhooks instead of polling for refund status

## Suspicious Changes
- auth.ts — touched but unrelated to refunds

## Files Changed
[full list]
```

## Configuration

### Quick start — OpenRouter (recommended)

One key, 200+ models:

```bash
export AISCRIBE_API_KEY=sk-or-...    # https://openrouter.ai/keys
```

### Or use any provider

| Env Var | Description | Example |
|---------|-------------|---------|
| `AISCRIBE_PROVIDER` | Provider override | `openrouter`, `anthropic`, `openai`, `ollama` |
| `AISCRIBE_API_KEY` | API key | `sk-or-...` or `sk-ant-...` or `sk-...` |
| `AISCRIBE_MODEL` | Model override | See below |
| `OLLAMA_HOST` | Ollama host (if using Ollama) | `http://localhost:11434` |

### Model examples

| Provider | Model |
|----------|-------|
| openrouter | `anthropic/claude-sonnet-4`, `openai/gpt-4o-mini`, `deepseek/deepseek-chat`, `qwen/qwen-2.5-72b`, `google/gemini-2.0-flash` |
| anthropic | `claude-sonnet-4-20250514`, `claude-3-opus-20240229` |
| openai | `gpt-4o`, `gpt-4o-mini` |
| ollama | `llama3.1:8b`, `qwen2.5:7b`, `deepseek-r1:8b`, `mistral:7b` |

## Roadmap

- [ ] `aiscribe history <file>` — cross-session file history
- [ ] `aiscribe decisions` — extracted decisions across sessions
- [ ] `aiscribe sessions` — list recent sessions
- [ ] Hotspot detection — files that change too often
- [ ] Ollama support for local LLMs

## License

MIT
