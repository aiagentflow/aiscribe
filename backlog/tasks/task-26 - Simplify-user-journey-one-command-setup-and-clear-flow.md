---
id: TASK-26
title: 'Simplify user journey: one-command setup and clear flow'
status: Done
assignee: []
created_date: '2026-08-08 13:53'
labels: []
dependencies: []
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Current journey is fragmented. aiscribe setup generates files but doesn't start anything. Make it feel like one product.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 aiscribe setup --docker starts Docker containers automatically
- [x] #2 aiscribe server auto-loads all existing .aiscribe sessions on startup
- [x] #3 aiscribe log shows where session was saved and how to view it
- [ ] #4 First-run experience: guided flow from install to first session
- [ ] #5 Document the three paths: file-only, server-only, Docker+DB
<!-- AC:END -->
