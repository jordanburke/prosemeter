---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r1
task: T1
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two packages need different versions of the same library, and your package manager can't give them both what they want in one flat tree. Depending on the manager, you get either duplicate copies of the library nested inside each dependency, or one hoisted version that only satisfies one of the two callers. Duplicates waste bytes but usually work. A single mismatched version does not — you get type errors, "instance of" checks that fail, or silent bugs when the library holds internal state (React and RxJS both break this way).

To fix it:

1. Run `npm ls <library>` (or `pnpm why`, `yarn why`) to see who wants which version.
2. Check if the older package has a newer release that supports the shared version — upgrade that package first. This is the real fix.
3. If no upgrade path exists yet, pin a single version with `overrides` (npm), `resolutions` (yarn), or `pnpm.overrides`, and confirm both packages still pass their tests against it.
4. If the library is a peer dependency, check the peer range in each package's `package.json` — you may need to bump the peer range, not just the resolved version.

Avoid just deleting `node_modules` and reinstalling. That masks the conflict instead of resolving it, and it comes back the next time someone adds a package.
