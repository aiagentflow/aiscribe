# Contributing to AIScribe

## For AI Coding Agents

If you are an AI agent contributing to this project, follow these rules:

### Boundaries

1. **Read before writing.** Read REVIEW.md, docs/VERSIONING.md, and the backlog before making changes.

2. **One task at a time.** Pick one task from the backlog (`backlog/tasks/`). Finish it completely before starting another.

3. **Never break the tests.** Run `npm test` before every commit. If a test fails, fix it. Do not delete tests to make them pass.

4. **Keep the README in sync.** If you add a command, add it to README.md. If you add an env var, document it.

5. **No feature without acceptance criteria.** Every feature starts as a backlog task with clear AC. Ask before implementing anything not in the backlog.

6. **Single responsibility per file.** `src/commands/` has one command per file. `src/` has one module per concern. Do not add logic to `index.ts`.

7. **Error messages must be actionable.** Every error must suggest a fix. "API error (401)" is not enough. "API key rejected. Run 'aiscribe setup --reconfigure' to fix." is.

8. **No external dependencies without discussion.** Current deps: simple-git, fastify, @fastify/static. Adding new deps requires justification.

9. **Use ANSI colors, not chalk.** We have our own `src/terminal.ts`. Use it. Don't add chalk, kleur, or similar.

10. **Commit messages describe the "what" not the "how".** "Add doctor command" not "Created src/commands/doctor.ts with check functions".

### Commit Format

```
<area>: <short description>

<optional body with details>
```

Examples:
```
cli: add doctor command for setup validation
server: add pagination to session list endpoint
fix: detect DeepSeek keys properly
docs: update README with provider configuration
```

### Review Checklist (Before Push)

- [ ] `npm test` passes (13+ tests)
- [ ] `npm run build` passes with no errors
- [ ] No `any` types added without good reason
- [ ] Error messages are helpful and actionable
- [ ] README updated if user-facing behavior changed
- [ ] Backlog task updated with status

---

## For Human Contributors

### Getting Started

```bash
git clone https://github.com/aiagentflow/aiscribe.git
cd aiscribe
npm install
npm test        # 13 tests should pass
npm run build   # Should produce dist/
```

### Project Structure

```
aiscribe/
├── src/
│   ├── index.ts           # CLI entry point
│   ├── commands/          # One file per command
│   │   ├── log.ts         # aiscribe log
│   │   ├── search.ts      # aiscribe search
│   │   ├── patterns.ts    # aiscribe hotspots, history
│   │   └── doctor.ts      # aiscribe doctor
│   ├── git.ts             # Git operations
│   ├── llm.ts             # LLM provider abstraction
│   ├── storage.ts         # .aiscribe/ file storage
│   ├── embeddings.ts      # Vector embeddings
│   ├── patterns.ts        # Pattern detection
│   ├── onboarding.ts      # First-run setup
│   ├── terminal.ts        # ANSI terminal styling
│   └── json-output.ts     # JSON output helper
├── web/
│   └── index.html         # Web UI
├── assets/                # Logo, screenshots
├── backlog/               # Task tracking
├── docs/                  # Documentation
├── REVIEW.md              # Review checklist
└── CONTRIBUTING.md        # This file
```

### Submitting Changes

1. Check the backlog (`backlog/tasks/`) for available tasks
2. Comment on the task you want to work on
3. Create a branch: `git checkout -b task-<number>-description`
4. Implement with tests
5. Run `npm test` and `npm run build`
6. Submit a PR against `main`
7. Update the backlog task status

### Code Standards

- TypeScript strict mode
- Single responsibility per module
- Functions under 50 lines when possible
- No `any` without comment explaining why
- Prefer pure functions over side effects
- Use `src/terminal.ts` for all CLI output styling

---

## For Everyone

### Communication

- Backlog is the source of truth for what's being worked on
- GitHub Issues for bug reports and feature requests
- PRs should reference a backlog task or issue

### License

MIT. By contributing, you agree that your contributions will be licensed under the MIT License.
