---
kind: eval-artifact
run: 3
variant: E
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for versions of the same library that the package manager cannot satisfy with one copy.

Here is what happens under the hood. Your package manager tries to hoist a single copy of a shared dependency to the top of `node_modules`. When the version ranges overlap, it picks one copy and everyone uses it. When they do not overlap, it installs a second copy nested under the package that needs it. Two copies means two separate module instances, and code that compares types, instanceofs, or singletons across those instances breaks. TypeScript sees it as two different declarations of the same type, so you get errors like "Type X is not assignable to type X".

Start by finding the conflict:

```bash
pnpm why <library-name>
```

That prints every dependent and the version each one wants.

Then pick a fix, cheapest first:

1. **Bump the older package.** If the team that lagged behind can move to the newer range, the conflict disappears. This is the right fix when you control both packages.
2. **Ask the new package's owner to widen its range.** A dependency pinned to `1.4.2` instead of `^1.4.0` causes conflicts for no gain. Peer dependencies are the right tool when a library must share an instance with its host.
3. **Force one version.** Add a `pnpm.overrides` entry in the root `package.json`:

```json
{
  "pnpm": {
    "overrides": {
      "<library-name>": "^2.1.0"
    }
  }
}
```

Use overrides only after you check the changelog for breaking changes. You are telling the package manager to ignore what a package asked for, so you own the outcome if it misbehaves at runtime.

One warning. If the library holds state — a React instance, a database driver pool, a validation registry — two copies fail silently at runtime rather than at build time. Those are worse than the build break you have now, so fix the version rather than working around the type error with a cast.
