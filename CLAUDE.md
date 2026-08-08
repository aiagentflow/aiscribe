# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## About AIScribe

AIScribe is a CLI tool that journals AI coding sessions. It reads git diffs and AI tool history to generate structured, searchable session summaries. Part of the aiagentflow suite.

## Before Starting Work

Run this to understand what was recently done on this project:

```bash
aiscribe context --format plain --last 5
```

## After Making Changes

The user will run one of these to capture the session:

```bash
aiscribe log -c      # Manual capture
aiscribe watch       # Auto-detect and capture
```

## Project Structure

```
aiscribe/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── commands/          # One file per command
│   │   ├── log.ts         # aiscribe log
│   │   ├── context.ts     # aiscribe context
│   │   ├── search.ts      # aiscribe search
│   │   ├── watch.ts       # aiscribe watch/status
│   │   ├── patterns.ts    # aiscribe hotspots/history
│   │   ├── sync.ts        # aiscribe sync
│   │   └── doctor.ts      # aiscribe doctor
│   ├── git.ts             # Git operations (simple-git)
│   ├── llm.ts             # LLM providers (OpenRouter, Anthropic, OpenAI, DeepSeek, Ollama)
│   ├── storage.ts         # .aiscribe/ file storage
│   ├── embeddings.ts      # Vector embeddings + semantic search
│   ├── patterns.ts        # Hotspot + risk pattern detection
│   ├── onboarding.ts      # Interactive first-run setup
│   ├── terminal.ts        # ANSI terminal styling (zero deps)
│   ├── session-lifecycle.ts  # AI session state detection
│   └── json-output.ts     # --json flag support
├── web/
│   ├── index.html         # Web UI (session book)
│   └── landing.html       # Marketing landing page
├── backlog/               # Task tracking (Backlog.md)
├── docs/                  # CLI.md, VERSIONING.md
└── assets/                # Logo, screenshots
```

## Build & Test Commands

```bash
npm test              # 13 tests (vitest)
npm run build         # TypeScript compilation
node dist/index.js    # Run built CLI
```

## Code Standards

- TypeScript strict mode, no `any` without comment
- One command per file in `src/commands/`
- Use `src/terminal.ts` for all CLI output styling (no chalk)
- No new dependencies without discussion
- Error messages must suggest a concrete fix
- Tests required for new logic

## Key Design Decisions

- CLI is `aiscribe` binary, not `@aiagentflow/aiscribe`
- Local-first: sessions stored in `.aiscribe/` directory
- Docker/PostgreSQL is optional, not required
- LLM provider auto-detection by API key prefix
- Interactive onboarding on first run (saved to `~/.aiscribe/config.json`)
- Version reads from `package.json` at runtime
