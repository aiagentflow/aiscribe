# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## About AIScribe

AIScribe is a CLI tool that journals AI coding sessions. It reads git diffs and AI tool history to generate structured, searchable session summaries. Part of the aiagentflow suite.

## Before Starting Work

Read the auto-generated context file to understand what was recently done on this project:

```bash
cat .aiscribe/CONTEXT.md
```

Or for the full CLI: `aiscribe context --format plain --last 5`

## After Making Changes

The user will run one of these to capture the session:

```bash
aiscribe log -c      # Manual capture
aiscribe watch       # Auto-detect and capture
```

## Architecture

`src/index.ts` is a hand-rolled arg parser (no commander/yargs) that switches on
`args[0]` and lazily `import()`s each command module, then calls it with the
remaining argv slice. Global help text and per-command `--help` text are also
hardcoded here — when adding or renaming a command, update the `switch` block
*and* `showGlobalHelp()` (and add a `show<Cmd>Help()` if the command warrants
its own `--help`).

Commands: `log`, `search`, `hotspots`, `history`, `doctor`, `status`, `watch`,
`context`, `sync`, `export`, `setup` (`--reconfigure` to change provider/key),
`server`.

Config resolution order, used by `ensureConfig()`/`ensureConfigOrWarn()` in
`index.ts`: env vars (`hasEnvConfig()`) → saved `~/.aiscribe/config.json`
(`loadConfig()`) → interactive `runOnboarding()`. `log` requires config and
will onboard if missing; `search`/`server` warn and degrade instead of
blocking (keyword search / no embeddings).

```
aiscribe/
├── src/
│   ├── index.ts            # CLI entry point: arg parsing, dispatch, help text
│   ├── commands/           # One file per command (log, search, hotspots,
│   │                       # history, context, sync, export, doctor, watch)
│   ├── context/capture.ts  # AI tool prompt-history capture (Claude Code, Codex, Aider)
│   ├── server/index.ts     # Web UI server (aiscribe server, localhost:3848)
│   ├── setup/docker.ts     # `aiscribe setup` Docker + Postgres scaffold
│   ├── git.ts              # Git operations (simple-git)
│   ├── llm.ts              # LLM providers (OpenRouter, Anthropic, OpenAI, DeepSeek, Ollama)
│   ├── storage.ts          # .aiscribe/ file storage
│   ├── embeddings.ts       # Vector embeddings + semantic search
│   ├── patterns.ts         # Hotspot + risk pattern detection
│   ├── onboarding.ts       # Interactive first-run setup, config load/save
│   ├── terminal.ts         # ANSI terminal styling (zero deps)
│   ├── session-lifecycle.ts # AI session state detection (used by watch/status)
│   ├── json-output.ts      # --json flag support
│   └── version.ts          # VERSION read from package.json at build time
├── web/
│   ├── index.html          # Web UI (session book)
│   └── landing.html        # Marketing landing page
├── backlog/                # Task tracking (Backlog.md)
├── docs/                   # CLI.md, VERSIONING.md
└── assets/                 # Logo, screenshots
```

## Build & Test Commands

```bash
npm test                    # Run full vitest suite
npx vitest run src/llm.test.ts   # Run a single test file
npm run build                # TypeScript compilation (tsc) to dist/
npm run dev                  # Run CLI from source via ts-node
node dist/index.js <command> # Run built CLI directly
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
