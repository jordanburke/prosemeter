---
kind: eval-artifact
run: 4
variant: Et
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now want different versions of the same library, and the resolver can only put one of them where your code looks for it.

**What is happening**

Package A pins `lib@^1.4.0`. The new package B pins `lib@^2.0.0`. The lockfile used to have one copy of `lib`. Now it has to satisfy both.

Node handles this by nesting: it hoists one version to the top of `node_modules` and tucks the other inside the package that needs it. That works fine at runtime for most libraries. It breaks in three cases:

- **Types.** TypeScript sees two copies of the same declaration file. Two structurally identical types from different copies are not the same type, so you get `Type 'Foo' is not assignable to type 'Foo'`.
- **Singletons.** Anything holding module-level state — React, a DI container, an event bus — breaks when two copies exist. Each copy has its own state.
- **Peer deps.** If B declares `lib` as a peer dependency and your installed version does not match the range, pnpm errors out rather than guessing.

The exact error message tells you which case you are in. Paste it if you want me to narrow it down.

**How to find it**

```bash
pnpm why lib
```

That prints every path that pulls in `lib` and the version each one asked for. `npm ls lib` does the same thing.

**How to fix it, cheapest first**

1. **Bump the older package.** If A has a newer release that accepts `lib@^2`, upgrade A and the conflict disappears. Check the changelog first.
2. **Force one version.** Add a `pnpm.overrides` entry (or `resolutions` in yarn) pinning `lib` to a single version. This is a lie you are telling the resolver, so it only works when the two ranges are actually compatible in practice. Read the major-version changelog for breaking changes before you do this.
3. **Let both exist.** If nothing in the library holds state and the type clash is confined to one boundary, two copies are fine. Cast at the boundary and move on. Do not do this for React or anything with a plugin registry.

Start with 1. Fall back to 2 and write down why in the lockfile PR, because the next person will find the override and wonder.
