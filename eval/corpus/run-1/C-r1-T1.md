---
kind: eval-artifact
run: 1
variant: C
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: major
  foundBy: "opus"
  error: "Tells the reader to delete the lockfile after an overrides change. Changing package.json already invalidates the affected entries; deleting the lockfile re-resolves every unrelated dependency."
---
Two packages in your tree now ask for different major versions of the same lib. That's the whole story.

Run one of these to see it:

```bash
pnpm why <lib-name>
# or
npm ls <lib-name>
```

You'll get a tree with the same name twice, at two versions.

Why the build dies: if the lib ships types, TypeScript sees two copies of one type. It treats them as two different types. And if the lib holds state at module scope — React, a logger, a DB pool — the two copies don't share it. Either way the errors look nothing like a version clash.

Three ways out, best first:

1. **Bump the older one.** Find whichever package pins the stale range and move it up. One version in the tree, and you're done.
2. **Force one version.** If you can't touch that package, add `pnpm.overrides` (or `resolutions` for yarn) to the root `package.json`. Fast, but you're lying to one of them, so skim the changelog for breaks.
3. **Make it a peer.** If the lib must be one shared copy, the package should list it under `peerDependencies`, not `dependencies`. Then the app owns the copy and there's only ever one.

After any of these, delete `node_modules` and the lock file, then install fresh. A stale lock file will hide your fix and make you think it didn't work.
