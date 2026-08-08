---
id: TASK-28
title: Add pi (coding agent) conversation capture
status: In Progress
assignee: []
created_date: '2026-08-08 15:37'
labels: []
dependencies: []
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Pi stores full session data in ~/.pi/agent/sessions/ as JSONL with user prompts, assistant responses, tool calls. Read PI_SESSION_FILE env var or scan sessions directory.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Read PI_SESSION_FILE env var for current session
- [ ] #2 Parse JSONL: extract user prompts, assistant responses, tool calls
- [ ] #3 Include in session context when using -c flag
- [ ] #4 Detect pi as coding tool (PI_CODING_AGENT env var)
<!-- AC:END -->
