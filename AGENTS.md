# Agent Instructions

## Versioning Rule

**Every change request must increment the minor version in `package.json`.**

The app version is displayed in the Settings modal so users can verify they are running the latest deployed version and not a stale cached copy.

### How to bump the version

Edit `package.json` and increment the middle number (minor version):

```plaintext
1.1.0 → 1.2.0   (next change)
1.2.0 → 1.3.0   (change after that)
```

Use **patch** (`1.1.0 → 1.1.1`) only for hotfixes that do not add or modify any feature. Use **major** (`1.x.y → 2.0.0`) only for breaking changes.

The version is injected at build time via `vite.config.ts` → `define.__APP_VERSION__` and rendered in the Settings modal (`src/components/Layout.tsx`).
