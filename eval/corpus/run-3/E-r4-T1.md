---
kind: eval-artifact
run: 3
variant: E
replicate: r4
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for versions of the same library that the package manager cannot merge into one copy.

The resolver installs both copies. One lands at the top level, the other nests under the package that asked for it. Anything that depends on the two copies sharing state now breaks: `instanceof` checks fail, singletons come out doubled, and TypeScript sees two different declarations of what should be one type. Peer dependencies make it louder, because the resolver refuses to pick and warns or errors instead.

Find the split first:

```bash
pnpm why <library>
```

That prints every package asking for it and the version each one wants.

Then pick a fix:

- **Bump the older consumer.** This is the real fix when the newer version is compatible. Update the package that lags and let both land on one version.
- **Hoist the library to a workspace dependency** and mark it a peer in the packages that use it. The root then owns the version, and no package can drift on its own.
- **Force one version** with a `pnpm.overrides` entry in the root `package.json`. This works, but it lies to the package that wanted the other version, so treat it as a bridge and leave a comment saying when it goes away.

Reach for overrides last. They hide the mismatch instead of removing it, and the next person hits the same wall with less to go on.
