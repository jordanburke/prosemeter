---
kind: eval-artifact
run: 3
variant: A
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Nothing you wrote broke — the tree under you changed shape.

Your package asks for `libfoo@^1.4.0`. The new package asks for `libfoo@^2.0.0`. Those ranges don't overlap, so the package manager can't pick one version that satisfies both. Instead it installs both: one hoisted at the top of `node_modules`, one nested under whichever package asked for the odd version out. Now which copy you get depends on where you're resolving from, and two things go wrong:

- **Type errors** — if `libfoo` ships types, TypeScript may be seeing v1 types in your file and v2 types through a dependency's public API. Same-named types from two copies are not assignable to each other, and the error message is maddening because it says `Type 'Widget' is not assignable to type 'Widget'`.
- **Runtime identity breaks** — `instanceof` checks, singletons, registries, `Symbol` keys, React context, anything that depends on "there is exactly one of these in the process" quietly stops matching, because there are now two module instances.

First thing to do is confirm that's actually what's happening:

```bash
pnpm why libfoo      # npm ls libfoo / yarn why libfoo
```

If you see two version blocks, that's your answer.

Fixes, roughly in order of how much I'd like them:

1. **Converge on one version.** Bump yours to v2 (or ask the other team to hold at v1 for a release). This is the real fix — the others are ways of surviving until you can do it.
2. **Force one copy** with a resolution override, if the two versions are actually compatible in practice and the major bump was for something you don't touch:
   ```json
   // package.json — pnpm
   "pnpm": { "overrides": { "libfoo": "2.1.0" } }
   // npm: "overrides"; yarn: "resolutions"
   ```
   This is a real risk, not a free lunch — you're telling the package manager that a dependency's declared range is wrong. Test the other team's code paths, not just yours.
3. **Make it a peer dependency** if `libfoo` is the kind of library that must be a singleton (React, a DI container, an ORM client). Peer deps say "the app supplies this, there is one" instead of each package dragging in its own.

If it's genuinely fine to have two copies — a leaf utility with no shared state, no `instanceof`, no types crossing package boundaries — you can also just leave it, and the cost is bundle size. Worth checking before anyone spends a day on a migration.
