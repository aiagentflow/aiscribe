---
id: TASK-25
title: Session retrieval API for coding agents
status: Done
assignee: []
created_date: '2026-08-08 13:16'
updated_date: '2026-08-08 13:29'
labels: []
dependencies: []
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build API endpoints and CLI commands specifically designed for AI agents to retrieve session history programmatically.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 GET /api/context: returns last N session summaries as plain text
- [ ] #2 GET /api/sessions/recent: returns metadata for quick lookup
- [ ] #3 CLI output flag: --plain for no ANSI, --compact for reduced output
- [ ] #4 Document how agents should call these before starting a new task
<!-- AC:END -->
