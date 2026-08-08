---
id: TASK-5
title: 'Fix: DeepSeek and custom provider support'
status: Done
assignee: []
created_date: '2026-08-08 12:38'
updated_date: '2026-08-08 12:41'
labels: []
dependencies: []
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Keys from OpenAI, DeepSeek, Groq, and other providers all start with sk-. Current detection can't tell them apart. Need explicit provider support.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Add deepseek provider (OpenAI-compatible, api.deepseek.com)
- [ ] #2 Add AISCRIBE_BASE_URL for custom OpenAI-compatible endpoints
- [ ] #3 Better error when key type is ambiguous: suggest setting AISCRIBE_PROVIDER
- [ ] #4 Auto-detect: if key fails with OpenAI, try DeepSeek as fallback
<!-- AC:END -->
