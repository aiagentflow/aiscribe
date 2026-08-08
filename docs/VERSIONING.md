# Versioning Strategy

AIScribe follows [Semantic Versioning](https://semver.org) strictly.

## Version Format

```
MAJOR.MINOR.PATCH
  0  .  0  .  1
```

| Bump | When | Example |
|------|------|---------|
| **PATCH** (0.0.x) | Bug fixes, internal improvements, no API changes | `0.0.10` → `0.0.11` |
| **MINOR** (0.x.0) | New command, new flag, new feature (backward compatible) | `0.0.11` → `0.1.0` |
| **MAJOR** (x.0.0) | Breaking change: removed command, changed flag behavior, changed output format | `0.x.x` → `1.0.0` |

## Current State: 0.x.x (Pre-1.0)

We are in pre-release. Everything can change. PATCH is used for all changes until we hit stability.

## When to go 1.0.0

- All planned commands are stable
- API output formats are finalized
- Configuration file format is locked
- 2 weeks without a breaking change request
- 100+ installs

## Publishing Rules

```bash
# Bug fix
npm version patch   # 0.0.11 → 0.0.12

# New feature
npm version minor   # 0.0.11 → 0.1.0

# Breaking change
npm version major   # 0.1.0 → 1.0.0
```

After version bump, always:
1. Update `src/version.ts` to match
2. Run `npm test`
3. Run `npm publish --access public`
4. Push to GitHub with tag: `git push origin main --tags`

## Never

- Bump version manually in package.json (use `npm version`)
- Publish without passing tests
- Skip the git tag
- Mix features and fixes in the same version bump
