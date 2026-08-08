---
id: TASK-18
title: 'Session lifecycle: detect start, active, end states'
status: Done
assignee: []
created_date: '2026-08-08 13:06'
updated_date: '2026-08-08 13:08'
labels: []
dependencies: []
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build a session lifecycle detector. Know when a coding agent session starts, is active, and ends. Read from ~/.claude/sessions/ state files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Read ~/.claude/sessions/*.json for session state
- [ ] #2 Map session states: waiting, running, complete, failed
- [ ] #3 Cache seen sessions to avoid re-processing
- [ ] #4 Provide 'aiscribe status' command to show current session state
<!-- AC:END -->
