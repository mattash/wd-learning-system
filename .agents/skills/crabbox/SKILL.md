---
name: crabbox
description: Use Crabbox for remote Linux validation in the WD Learning System repo, including warmed reusable Hetzner boxes for lint, typecheck, unit, coverage, CI, and Playwright checks.
---

# Crabbox for WD Learning System

Use Crabbox when this Next.js learning system needs remote Linux verification on
Hetzner.

Run from `/Users/oshii/Projects/wd-learning-system`:

- Full CI-style check: `scripts/crabbox-validate.sh ci`
- Lint only: `scripts/crabbox-validate.sh lint`
- TypeScript only: `scripts/crabbox-validate.sh typecheck`
- Unit tests only: `scripts/crabbox-validate.sh test`
- Coverage tests: `scripts/crabbox-validate.sh coverage`
- Playwright e2e: `scripts/crabbox-validate.sh e2e`

The reusable lease settings live in `.crabbox.slug.conf`. The default slug is
`wd-learning-fast`.

For fast repeated Clawpatch validation, warm a box first:

```bash
scripts/crabbox-box.sh warm
scripts/crabbox-validate.sh ci
```

Subsequent validation runs should use `scripts/crabbox-validate.sh <job>` so
they reuse the configured slug with `--stop never`, then release it with:

```bash
scripts/crabbox-box.sh stop
```

The jobs call `scripts/crabbox-ensure-node-deps.sh`, which installs Node 20 if
needed and runs `npm ci` only when `package-lock.json` changes. This is what
gives warm boxes their speed advantage.
