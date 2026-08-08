---
kind: eval-artifact
run: 1
variant: A
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Short version: nothing is "broken" in the other team's package — your dependency graph just stopped being able to collapse two version ranges into one, and something downstream can't tolerate the split.

**What's actually happening**

Your package manager resolves each dependency to a version that satisfies *every* range asking for it. When package A wants `foo@^2.3.0` and the newly added package B wants `foo@^3.0.0`, there's no single version that satisfies both, so the resolver installs both — usually as a nested copy (`node_modules/B/node_modules/foo`) or two entries in the lockfile.

Two copies is legal and often fine. It breaks when:

- **Bundle size / duplicate code** — you're now shipping `foo` twice. Annoying, not fatal.
- **Type conflicts** — TypeScript sees two different `foo` type definitions and complains that `Foo` from one isn't assignable to `Foo` from the other, even though they look identical. This is the most common "my build broke" symptom.
- **Singleton assumptions** — some libraries only work if exactly one instance exists in the process: React (hooks), any library with module-level registries or context, `zod` schemas compared across boundaries, DI containers, event buses. Two copies means two separate registries and things silently fail or throw at runtime.
- **Peer dependency violations** — if `foo` is declared as a peer dep somewhere, the resolver may now warn or hard-fail because it can't satisfy the peer range.

Read the actual error text — it tells you which of these you're in. `Type 'X' is not assignable to type 'X'` = duplicate types. `Invalid hook call` / `Cannot read X of undefined` at runtime = singleton violation.

**Diagnose it**

```bash
pnpm why foo        # or: npm ls foo / yarn why foo
```

That prints the tree of who's asking for what. You'll see the two ranges immediately.

**How to fix, in order of preference**

1. **Align the ranges.** Bump whichever package is behind so both land on a compatible major. This is the real fix — do this if the upgrade is small. Check the changelog for the major bump; often it's a two-line migration.

2. **Hoist it to a shared dependency.** If this is a monorepo, declare `foo` once at the root (or in a shared internal package) at a version both consumers accept, and make the leaf packages depend on it as a `peerDependency` rather than a direct `dependency`. Peer deps are exactly the mechanism for "I need the app's copy, not my own."

3. **Force a single version.** Escape hatch when you can't change the upstream package. In pnpm:

   ```json
   "pnpm": { "overrides": { "foo": "^3.0.0" } }
   ```

   npm uses `"overrides"`, yarn uses `"resolutions"`. This tells the resolver "I don't care what the ranges say, install exactly this." Only do this when you've actually verified the older consumer works against the newer version — you're overriding a constraint the author wrote for a reason. Leave a comment saying why and when it can be removed.

4. **Accept the duplication** if it's genuinely a leaf library with no shared state and the only cost is bundle size. Then the fix is deduping later, not now.

If it's a TS-only failure and the library is a true singleton concern, options 2 and 3 are the ones that matter. If it's just bundle bloat, option 1 whenever the upgrade lands naturally.

**The prevention step:** whatever you land, make sure the lockfile change is in the same PR and CI runs a clean install (`--frozen-lockfile`). Half of these breakages are really "someone's local `node_modules` had a stale hoisted copy that happened to work."
