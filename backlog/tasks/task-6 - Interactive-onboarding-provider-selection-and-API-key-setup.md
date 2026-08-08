---
id: TASK-6
title: 'Interactive onboarding: provider selection and API key setup'
status: Done
assignee: []
created_date: '2026-08-08 12:39'
updated_date: '2026-08-08 12:41'
labels: []
dependencies: []
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace env var setup with a clean interactive onboarding. First time user runs aiscribe log, gets prompted to select provider and paste API key. Saved to ~/.aiscribe/config.json for persistence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 First run: detect no config, show interactive provider picker
- [ ] #2 Provider descriptions: OpenRouter (all models, one key), Anthropic, OpenAI, DeepSeek, Ollama (free)
- [ ] #3 API key input (masked), validate with a test call
- [ ] #4 Save to ~/.aiscribe/config.json, never ask again
- [ ] #5 aiscribe setup --reconfigure to change provider/key
<!-- AC:END -->
