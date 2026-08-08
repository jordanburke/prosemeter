---
kind: eval-artifact
run: sonnet
variant: A
replicate: r2
task: T1
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You've hit a diamond dependency conflict. Your package depends on `lib@1.x`. The other team's package depends on `lib@2.x`. Your package manager now has to pick one version to satisfy both, or it installs two copies side by side.

Two ways this breaks a build:

- **Hoisting picks the wrong version.** npm/Yarn hoist one copy to the top of `node_modules`. Whichever package didn't get its expected version calls a method that moved, or a type that changed shape, and it fails at runtime or at typecheck.
- **Two copies end up installed.** This is worse for anything that does identity checks — React, RxJS, and similar libraries break here, because `instanceof` checks or singleton state fail across the two copies even though the code "compiles fine."

To fix it:

1. Run `pnpm why lib` (or `npm ls lib`) to see who wants which version.
2. Check whether the two required ranges actually overlap. If `^1.5.0` and `^1.8.0` are both in play, a normal install resolves to one shared version — no conflict.
3. If the ranges truly clash (`^1.x` vs `^2.x`), someone needs to bump. Talk to the other team about upgrading their side, since majors usually carry breaking changes worth tracking down anyway.
4. If you can't wait on that, pin a single version for everyone with `pnpm.overrides` (or `resolutions` in Yarn) in the root `package.json`. This forces one version across the tree until the real upgrade lands.

Overrides are a stopgap, not a fix — flag it so someone circles back and removes the override once both packages agree on a version.
