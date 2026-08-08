---
kind: eval-artifact
run: 3
variant: B
replicate: r1
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build didn't break because of anything you did — the new package pulled in a different version of a library you were already using, and now the two versions are fighting.

Here's what's happening. When two packages ask for different versions of the same dependency, the package manager has to decide what to install. Usually it installs both: one at the top level, one nested inside the package that needs it. That's fine for most libraries, but it breaks in two situations:

1. **The library has shared state.** Two copies of React, or a validation library that uses `instanceof` checks, will silently misbehave — an object created by copy A won't be recognized by copy B.
2. **The types don't line up.** TypeScript resolves each copy separately, so `Foo` from v2 isn't assignable to `Foo` from v3, even if the shapes are identical. That's usually what causes a sudden wall of type errors.

To find out which one you have, run `pnpm why <library-name>`. It'll show you every package that depends on it and which version each one wants.

Then pick a fix:

- **Best case: align the versions.** If the two required ranges actually overlap, bump the older package so both land on one version. Problem gone.
- **If they don't overlap:** upgrade whichever package is behind, or ask the other team to widen their range. A library that pins an exact version (`"react": "18.2.0"` rather than `^18.2.0`) is usually just being sloppy and will happily loosen it.
- **Escape hatch: force a single version.** In pnpm, add a `resolutions`/`overrides` entry in the root `package.json` to make everything use one version. This works, but you're overriding what a package said it needs — so test it, and leave a comment saying why it's there and when it can go.

If it's a library where two copies genuinely can't coexist (React, anything with a plugin registry), it should probably be a peer dependency rather than a regular one. Worth raising with the other team if that's the case here.
