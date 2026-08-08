---
id: TASK-2
title: 'Phase 4: Vector embeddings + semantic search'
status: To Do
assignee: []
created_date: '2026-08-08 12:34'
labels: []
dependencies: []
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add pgvector-based semantic search. Generate embeddings for session summaries and enable similarity queries.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Generate embeddings for new sessions (OpenAI or local model)
- [ ] #2 Semantic search endpoint: find similar sessions by meaning
- [ ] #3 Rebuild index command for existing sessions
- [ ] #4 Fallback gracefully when no API key (skip embeddings)
<!-- AC:END -->
