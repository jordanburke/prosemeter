---
kind: eval-artifact
run: 3
variant: B
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two of your dependencies want different versions of the same library, and the package manager can't satisfy both with one copy. So one of two things happens, and both break builds:

1. **It installs both copies.** Now you have two separate instances of the library in memory. If that library keeps internal state — a React context, a singleton client, a class used in `instanceof` checks — the two copies don't recognize each other. You get errors like "invalid hook call" or "X is not an instance of X" that make no sense until you realize there are two X's.
2. **It hoists one version to the top and both packages share it.** Now whichever package wanted the *other* version is running against an API it wasn't written for. Missing export, changed signature, silent behavior difference.

**First, confirm it.** This is the whole diagnosis:

```
pnpm why <library-name>
```

That prints every package that depends on it and the version each one asked for. You'll see the conflict immediately.

**Then pick a fix, roughly in this order:**

- **Bump the older dependency.** If the package pinning the old version has a newer release that accepts the new one, this is the real fix. Everything else is a workaround.
- **Force one version.** In pnpm, add a `resolutions` (or `overrides`) entry in the root `package.json` pinning the library to a single version. This is safe when the two ranges are actually compatible and someone just has a too-narrow constraint. It is *not* safe across a real major version — you're telling the build to ignore a genuine incompatibility, and you'll find out at runtime.
- **Make it a peer dependency.** If it's a library that must be a singleton, the correct long-term shape is for your packages to declare it as a peer dep rather than a regular dep, so there's structurally only one copy.

One thing worth checking before you spend time on it: if the library in question is something like React, a state store, or a database client, go straight to the singleton framing — the duplicate-copy problem is almost certainly what you're hitting, and `resolutions` will fix it today. If it's a leaf utility with no state, two copies are usually harmless and your break is probably the API-mismatch case instead.
