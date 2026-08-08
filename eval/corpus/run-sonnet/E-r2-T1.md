---
kind: eval-artifact
run: sonnet
variant: E
replicate: r2
task: T1
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You have two packages that need different versions of the same library. Your package manager can't pick one version and satisfy both, so it either fails to install or silently hoists one version and breaks the package that wanted the other.

This shows up most in npm/yarn when hoisting picks a single version for the top-level `node_modules`, and one dependency ends up calling APIs that don't exist in that version.

**How to fix it:**

1. Run `npm ls <library>` (or `pnpm why <library>`) to see the full dependency tree and which packages want which version.
2. Check if the two required versions are actually compatible — sometimes a caret range (`^2.0.0`) will resolve fine once you bump the lockfile.
3. If they truly conflict, use pnpm or yarn's resolution/override field to pin one version everywhere, then test that both packages still work against it.
4. If one package pins a version too tightly or too loosely, that's worth a PR upstream — a bad `peerDependencies` range causes this class of bug for everyone who installs it.
5. As a last resort, pnpm supports multiple versions side by side without hoisting, so switching package managers can sidestep the conflict entirely.

Start with step 1. The dependency tree will tell you fast whether this is a real conflict or just a stale lockfile.
