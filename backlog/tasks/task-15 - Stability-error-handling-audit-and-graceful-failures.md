---
id: TASK-15
title: 'Stability: error handling audit and graceful failures'
status: Done
assignee: []
created_date: '2026-08-08 12:58'
updated_date: '2026-08-08 13:03'
labels: []
dependencies: []
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Audit every code path for error handling. Every error must be user-friendly with a suggested fix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No uncaught exceptions reach the user
- [ ] #2 Every error message suggests a concrete action
- [ ] #3 Network errors retry once before failing
- [ ] #4 Git errors explain what to check
- [ ] #5 LLM errors suggest checking key/provider
<!-- AC:END -->
