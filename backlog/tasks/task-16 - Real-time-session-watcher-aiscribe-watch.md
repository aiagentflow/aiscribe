---
id: TASK-16
title: 'Real-time session watcher: aiscribe watch'
status: To Do
assignee: []
created_date: '2026-08-08 13:06'
labels: []
dependencies: []
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add aiscribe watch command that auto-detects and captures AI coding sessions in real-time. Watches for Claude Code/Codex activity and auto-captures when sessions end.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Detects when a Claude Code session starts (new sessionId in ~/.claude/sessions/)
- [ ] #2 Polls for new prompts and git changes during session
- [ ] #3 Auto-generates summary when session status becomes 'complete' or 'failed'
- [ ] #4 Stores to .aiscribe/sessions/ (files) and POSTs to server if Docker running
- [ ] #5 aiscribe watch --daemon: run in background, notify on session end
<!-- AC:END -->
