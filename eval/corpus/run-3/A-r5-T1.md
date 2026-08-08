---
kind: eval-artifact
run: 3
variant: A
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
What you're hitting is a **version conflict in the dependency graph** — two packages in the workspace each want a different version of the same library, and the resolver can't collapse them into one.

Whether that's fatal depends on how it resolved. Two cases:

**Case 1: two copies got installed.** npm/pnpm/yarn will happily nest a second copy (`node_modules/pkg-a/node_modules/lodash@3` alongside a top-level `lodash@4`). Install succeeds, build breaks later in weird ways:

- **Duplicate type identities.** TypeScript sees two distinct declarations of the same class/interface and refuses to unify them — `Type 'Foo' is not assignable to type 'Foo'`, which reads like a typo but isn't.
- **`instanceof` fails at runtime.** An object made by copy A is not an instance of copy B's class.
- **Broken singletons.** Anything relying on module-level state — React, a DI container, a logger registry, an event bus — now has two independent states. React's "invalid hook call / more than one copy of React" is the classic.
- **Bundle bloat**, if it doesn't crash outright.

**Case 2: it hoisted to one version and something broke.** The resolver picked one version to satisfy both, and the package expecting the other version is now calling an API that moved or changed shape. This is the more common one when the two ranges overlap (`^2.1.0` and `^2.4.0` → both get 2.4.x, and the first package trips over a behavior change).

### How to find out which

```bash
pnpm why <library>     # or: npm ls <library> / yarn why <library>
```

That prints the tree and shows you every version present and who asked for it. If you see the library listed more than once, you're in case 1.

### Fixing it

Roughly in order of preference:

1. **Align the ranges.** Bump whichever package has the older constraint so both land on a compatible version. Cleanest fix, and usually just a version bump plus whatever migration the changed API needs.

2. **Make it a peer dependency** if the library is genuinely singleton-shaped (React, a state store, an ORM client). The package declares "I need one of these, the app provides it" rather than bringing its own. This is the right structural answer for the `instanceof`/singleton failures — it makes duplication impossible instead of merely unlikely.

3. **Force one version** if you can't move fast:
   - pnpm: `overrides` in the root `package.json`
   - npm: `overrides`
   - yarn: `resolutions`

   This is a hammer. It tells the resolver "everyone gets this version, I don't care what they asked for." It works, and it silently breaks things if the package that wanted the other version actually needed it. Use it to unblock yourself now, then do #1 or #2 properly. Leave a comment saying why the override exists.

4. **Vendor or isolate** — last resort. If the two packages genuinely cannot share a version and you can't change either, you're stuck with two copies and you have to make sure their objects never cross the boundary.

For a monorepo specifically, #1 is almost always the answer, and it's worth setting up a check so this doesn't recur — pnpm has `dedupe --check` you can run in CI, or use syncpack to enforce that a given dependency has the same range in every workspace package. Getting a fast CI failure on "these two packages disagree about a version" is much nicer than debugging `Type 'Foo' is not assignable to type 'Foo'` at 6pm.
