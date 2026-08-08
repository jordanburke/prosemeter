---
kind: eval-artifact
run: 1
variant: B
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "4 tasks, 7 variants"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Nothing you wrote is broken — the new package pulled in a different version of a library you were already using, and now two versions of it exist in the same build.

Usually that's harmless: package managers happily install both copies, each package gets the version it asked for, and everything works. It breaks when the two copies have to be the *same* copy. Common cases:

- **Shared state.** Things like React, a store, or a database client keep internal state in module scope. Two copies means two separate states, and they don't see each other. (This is where "invalid hook call" and "two instances of X detected" errors come from.)
- **Types.** TypeScript sees two sets of declarations for what should be one type, so a value from package A isn't assignable to the same-named type from package B.
- **Identity checks.** `instanceof` and `===` fail across copies, so error handling or class checks silently stop matching.

How to find out which you have:

```bash
pnpm why <library>       # npm ls <library> / yarn why <library>
```

That prints the tree of who depends on what version. Once you see it:

1. **Bump to a compatible version.** If both packages can accept one version, upgrading the older dependent is the real fix and needs no config.
2. **Force one version** if you can't change the packages. In pnpm, add to the root `package.json`:
   ```json
   "pnpm": { "overrides": { "<library>": "^3.2.0" } }
   ```
   npm uses `overrides`, yarn uses `resolutions`. This is a lie you're telling the resolver, so check the changelog between the two versions for breaking changes before you do it.
3. **Make it a peer dependency** if the library is one that's *supposed* to be a singleton (React, a UI kit, an ORM client). Packages should declare it as a peer, not a regular dependency, so there's only ever one copy at the top of the tree. This is the durable fix if the other team owns the package.

Send me the `pnpm why` output and I can tell you which of the three applies.
