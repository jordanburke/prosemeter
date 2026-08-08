---
kind: eval-artifact
run: 4
variant: A
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Short version: your build isn't broken because of anything you did. The other team's package pulled in a version of a shared dependency that's incompatible with the one your package already resolves to, and now the package manager has to pick — or has picked two, and something downstream can't cope with that.

There are two different failure shapes here and it's worth knowing which one you have:

**Two copies installed.** npm/pnpm will happily install `lib@1.x` nested under your package and `lib@2.x` under theirs. Usually fine. It breaks when the library has identity or global state — React hooks, a singleton registry, `instanceof` checks across the boundary, anything with a module-level cache. Two copies means two registries, and objects made by one don't satisfy checks in the other. Symptom is usually a weird runtime error, not a compile error.

**One copy hoisted, and it's the wrong one for someone.** The resolver flattened to a single version that satisfies one package's range but not really the other's, and you get type errors or missing exports at build time. Symptom is usually the compile error you're staring at.

To find out which:

```bash
pnpm why <library>       # or npm ls <library>
```

That prints the tree and shows you every version present and who asked for it.

Fixing it, roughly in order of preference:

1. **Align the ranges.** If both packages can live on the same major, bump the lagging one and you're done. This is the right fix most of the time and everything below is a workaround.
2. **Check whether it should be a peer dependency.** If the library is the kind that must be a singleton, the internal packages consuming it should declare it as a `peerDependency`, not a regular one, and it should be a direct dependency of the app. That's the structural fix and it prevents this recurring.
3. **Force a single version** with `pnpm.overrides` (or `resolutions` in yarn/npm). This is a real tool, but it's a lie you're telling the resolver — you're asserting the package will work against a version it didn't declare support for. Fine as a short-term unblock, but leave a comment saying why and what would let you remove it.
4. **Let the duplication stand** if the library genuinely has no shared state. Two copies of a pure utility library costs you bundle size and nothing else.

What I'd actually do right now: run `pnpm why`, post the output, and let's decide between (1) and (2). If the other team just added this yesterday it's probably cheapest to have them match your version rather than for you to chase theirs.
