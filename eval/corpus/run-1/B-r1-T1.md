---
kind: eval-artifact
run: 1
variant: B
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
reviewerFinding:
  severity: minor
  foundBy: "opus"
  error: "Same hoisting misconception as A-r2-T1, stated as one of two branches."
---
Two packages in the repo each ask for a different version of the same library, so the installer can't satisfy both with one copy. Depending on your setup, one of two things happens:

- **You get two copies.** Both installs succeed, but now there are two separate instances of the library in memory. Anything that relies on there being exactly one — `instanceof` checks, a shared registry, React hooks, a singleton client — breaks. This is the "works locally, weird runtime error" flavor.
- **You get one copy that's wrong for someone.** The installer hoists a single version to the top, and whichever package expected the other version hits a missing or changed API. This is the "type errors" or "X is not a function" flavor.

To see which you have:

```bash
pnpm why <library>      # npm ls <library> / yarn why <library>
```

That prints who's asking for what.

**The fix, in order of preference:**

1. **Align the versions.** Bump the package that's behind so both depend on the same range. This is the real fix and usually takes five minutes if the gap is a minor version.
2. **If it's a peer dependency** (React, a UI kit, a client SDK — anything that must be a singleton), it should be listed under `peerDependencies` in both packages, not `dependencies`. Then the app installs one copy and both packages use it.
3. **Force it temporarily** while you wait on an upstream bump. In pnpm, add to the root `package.json`:

   ```json
   "pnpm": { "overrides": { "<library>": "^2.4.0" } }
   ```

   npm uses `overrides`, yarn uses `resolutions`. Treat this as a stopgap — you're telling the installer to ignore a constraint someone declared, so pin it with a comment or a linked issue and revisit.

What I'd avoid: deleting the lockfile and reinstalling until it works. That sometimes makes the symptom go away by luck and leaves the conflict in place for the next person.
