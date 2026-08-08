---
id: TASK-8
title: 'CLI: add doctor command for setup validation'
status: In Progress
assignee: []
created_date: '2026-08-08 12:58'
updated_date: '2026-08-08 12:58'
labels: []
dependencies: []
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add 'aiscribe doctor' that checks: git installed, Node version, API key valid, provider reachable, .aiscribe/ directory healthy
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Check git is installed and repo detected
- [ ] #2 Check Node.js version >= 20
- [ ] #3 Validate API key with a test call to the provider
- [ ] #4 Check .aiscribe/ directory structure is intact
- [ ] #5 Report: all good, or list issues to fix
<!-- AC:END -->
