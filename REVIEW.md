# Review Checklist

> Run before every push. Keep it short.

## Before Push

- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Every new function has a purpose that aligns with the goal
- [ ] No dead code, no commented-out blocks
- [ ] Error messages are helpful (not just "error")
- [ ] README is updated if user-facing behavior changed

## Goal Alignment Test

Every PR must answer YES to at least one:

- Does this help a developer understand what their AI did?
- Does this reduce friction in the review workflow?
- Does this make session context searchable or retrievable?
- Does this reduce the gap between "AI wrote code" and "human approved it"?

If none, the feature is out of scope.

## Code Standards

- Single responsibility per function
- No magic strings (use constants or config)
- Types over `any`
- Prefer pure functions where possible
- Tests for new logic (1-3 tests per module, not exhaustive)
