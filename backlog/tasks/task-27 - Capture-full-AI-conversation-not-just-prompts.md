---
id: TASK-27
title: 'Capture full AI conversation, not just prompts'
status: To Do
assignee: []
created_date: '2026-08-08 13:57'
labels: []
dependencies: []
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently -c only captures user prompts from ~/.claude/history.jsonl. Need the full conversation: Claude responses, tool calls, file reads. Read from ~/.claude/sessions/ or Claude's transcript storage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Read Claude Code session transcripts for full conversation
- [ ] #2 Include Claude's responses and tool calls in session summary
- [ ] #3 Show what files Claude read during the session
- [ ] #4 Show what commands Claude ran
- [ ] #5 Store full transcript in session markdown file
<!-- AC:END -->
