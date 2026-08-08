---
id: TASK-22
title: 'aiscribe context: expose session history to AI agents'
status: Done
assignee: []
created_date: '2026-08-08 13:16'
updated_date: '2026-08-08 13:18'
labels: []
dependencies: []
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Command that outputs session context in AI-readable format. Coding agents can call this to get project history before starting work.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 aiscribe context: output last 5 session summaries
- [ ] #2 aiscribe context --last 10: configurable count
- [ ] #3 aiscribe context --format plain: plain text for AI context window
- [ ] #4 aiscribe context --format md: markdown format
- [ ] #5 aiscribe context --project: show all sessions for current project
<!-- AC:END -->
