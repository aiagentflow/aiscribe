---
id: TASK-17
title: 'Docker DB integration: POST sessions to server'
status: To Do
assignee: []
created_date: '2026-08-08 13:06'
labels: []
dependencies: []
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When Docker is running (aiscribe server active), aiscribe log also POSTs session data to the API for PostgreSQL storage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Detect if aiscribe server is running on localhost:3848
- [ ] #2 POST /api/sessions with full session data after local save
- [ ] #3 Session appears in web UI immediately after recording
- [ ] #4 Graceful fallback: if server not reachable, just save locally
<!-- AC:END -->
