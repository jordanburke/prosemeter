---
kind: eval-artifact
run: 4
variant: E
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two copies of the same library now live in `node_modules`, and they are not interchangeable.

The new package pinned a version range that does not overlap with yours. The package manager cannot pick one copy that satisfies both, so it installs both and nests one under the dependent package. Anything that relies on a single shared instance then breaks: `instanceof` checks fail, module-level singletons split in two, and TypeScript sees two versions of the same type and calls them incompatible.

Confirm it first. Run `pnpm why <library>` — you will see the two ranges and who asked for each.

Then fix it in this order:

1. **Bump the lagging package.** If the other team's range is newer and yours can move, widen or raise your dependency so both land on one version. This is the real fix.
2. **Force one version with an override.** Add `pnpm.overrides` in the root `package.json` if you cannot bump yet. This works only when the versions are actually compatible — read the changelog for breaking changes before you do it.
3. **Make it a peer dependency.** If the library is meant to be a singleton (React, a logging client, an ORM), the package should declare it as a peer, not a direct dependency. That pushes the choice up to the app and makes the conflict a loud warning instead of a silent duplicate.

Skip the override if the versions have a real breaking change between them. You will just move the failure from build time to runtime.
