---
id: TASK-21
title: 'aiscribe sync: push local sessions to Docker DB'
status: In Progress
assignee: []
created_date: '2026-08-08 13:16'
updated_date: '2026-08-08 13:16'
labels: []
dependencies: []
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Sync command that pushes .aiscribe/sessions/ to the running server/DB. Ensures data is backed up before clearing sessions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Detect if aiscribe server is running on localhost:3848
- [ ] #2 POST all unsynced sessions to /api/sessions/bulk
- [ ] #3 Track sync state: mark sessions as synced in index.json
- [ ] #4 aiscribe sync --dry-run: show what would be synced
- [ ] #5 aiscribe sync --force: re-sync all even if already synced
<!-- AC:END -->
