---
id: TASK-19
title: 'Optimize aiscribe watch: reduce CPU/disk usage'
status: Done
assignee: []
created_date: '2026-08-08 13:09'
updated_date: '2026-08-08 13:10'
labels: []
dependencies: []
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Current watch polls every 5s with full directory reads. Too heavy. Use fs.stat mtime checks, increase interval, cache results.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Use mtime comparison instead of reading all files every poll
- [ ] #2 Increase default poll interval to 15s (configurable)
- [ ] #3 Cache session data between polls, only re-read changed files
- [ ] #4 Memory: keep cache under 10MB
- [ ] #5 Provide --interval flag for user control
<!-- AC:END -->
