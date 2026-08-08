---
kind: eval-artifact
run: 1
variant: F
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus"
  error: "Given non-overlapping ranges, no package manager hands a ^1.2.0 dependent a v2 copy. Verified by reading the file: 'it either hoists one version to the top and gives it to both'."
---
Your build broke because two packages now ask for different versions of the same library, and only one version can win.

**What's happening**

The package manager builds one dependency tree. When your package wants `lib@^1.2.0` and the new package wants `lib@^2.0.0`, it has to pick. Depending on the tool and where the conflict sits, it either hoists one version to the top and gives it to both, or installs both copies in nested folders.

Both outcomes break things:

- **One version wins.** Your code calls an API that moved or changed shape in v2. You get a `TypeError` or a missing export at build time.
- **Both versions install.** Now two copies of the library live in memory. Anything relying on shared state breaks — `instanceof` checks fail, singletons duplicate, React hooks throw "invalid hook call", and type declarations conflict during `tsc`.

The second case is nastier because the error rarely names the real cause.

**How to confirm it**

```bash
pnpm why <library>       # npm ls <library> / yarn why <library>
```

That prints every path that pulls the library in, with the version each one asked for. Look for two different resolved versions.

**How to fix it**

Pick one, in this order:

1. **Upgrade the lagging package.** If your dependency has a release that accepts v2, bump it. Both ranges then overlap and the tree collapses to one copy. This is the real fix.

2. **Force a single version.** Add an override so the whole tree resolves to one:

   ```json
   { "pnpm": { "overrides": { "lib": "^2.0.0" } } }
   ```

   npm uses `overrides`, yarn uses `resolutions`. Do this only when you've checked the pinned version works for both consumers. You are overruling a maintainer's stated range.

3. **Make it a peer dependency.** If the library must be a singleton — React, a state store, an ORM client — declare it as a peer in your internal packages instead of a direct dependency. The app then owns the single copy.

Skip nested installs as a strategy. They hide the conflict until runtime.

**In this repo**

You're in a pnpm workspace, so also check whether the two packages should share the version through the workspace root. Pinning shared libraries at the root, with workspace packages declaring them as peers, prevents this class of break from recurring.
