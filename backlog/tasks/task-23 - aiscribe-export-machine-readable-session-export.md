---
id: TASK-23
title: 'aiscribe export: machine-readable session export'
status: In Progress
assignee: []
created_date: '2026-08-08 13:16'
updated_date: '2026-08-08 13:28'
labels: []
dependencies: []
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Export sessions in various formats for other tools and AI agents to consume.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 aiscribe export --format json: all sessions as JSON array
- [ ] #2 aiscribe export --format csv: session metadata only
- [ ] #3 aiscribe export --format ai: compact format optimized for LLM context window
- [ ] #4 aiscribe export --session <id>: export single session
<!-- AC:END -->
