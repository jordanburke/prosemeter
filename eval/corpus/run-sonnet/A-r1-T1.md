---
kind: eval-artifact
run: sonnet
variant: A
replicate: r1
task: T1
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two packages now need different versions of the same library, and something in your toolchain can't reconcile them. That's a diamond dependency problem.

What's happening: normally npm/pnpm/yarn nest separate copies of a dependency in different `node_modules` folders, so two versions can coexist fine at runtime. It only becomes a build break when the library must be a *single shared instance* — common with things like React, RxJS, or anything using `instanceof` checks or global state — usually declared as a `peerDependency`. If both packages declare it as a peer but expect different majors, your bundler or type checker flags the conflict instead of silently nesting copies.

How to track it down:
- `pnpm why <package>` (or `npm ls <package>`) to see exactly which packages pull which versions.
- Check whether the conflicting dependency is a `peerDependency` for either package — that's the usual cause of hard breaks vs. just duplicate installs.

How to fix it:
- If it's a real peer conflict, get both teams on the same major version — that's the actual fix, not a workaround.
- If it's a regular dependency and duplication is just annoying (bundle size, type conflicts), use `overrides`/`resolutions` in your package.json to force one version, but only if both packages actually work with it.
- If the versions are genuinely incompatible and you can't upgrade the older package yet, hold off on the new package's version bump until someone can do the migration properly.
