---
id: TASK-30
title: 'Git remote backup: push sessions to private repo'
status: Done
assignee: []
created_date: '2026-08-08 17:00'
labels: []
dependencies: []
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Configure a private git repo as backup. Every aiscribe log auto-pushes the session to repo. Project-organized folders.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 aiscribe remote set <git-url>: configure backup repo
- [x] #2 aiscribe remote status: show remote config
- [ ] #3 Auto-clone/pull remote on first use
- [ ] #4 Organize by project: repo/project-name/sessions/
- [ ] #5 Auto-commit + push after each aiscribe log
- [ ] #6 Handles: no network, merge conflicts, first-time setup
<!-- AC:END -->
