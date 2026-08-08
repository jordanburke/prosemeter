---
kind: eval-artifact
run: sonnet
variant: Et
replicate: r3
task: T1
model: claude-sonnet-5
generated: 2026-08-03
note: "model transfer check"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
You have a dependency conflict. The other team added a package that pulls in a different version of a library your code already depends on, and now two parts of the tree want two versions at once.

What happens next depends on your package manager. npm and pnpm can often install both versions side by side, nested under each dependent — that works until something expects a single shared instance (React, a database driver, anything with global state). Then you get the classic symptoms: "invalid hook call," duplicate class instances, `instanceof` checks failing, or a type mismatch that makes no sense from the code alone.

To fix it:

1. **Find the conflict.** Run `npm ls <package>` or `pnpm why <package>` to see every version in the tree and who requires each one.
2. **Pick one version.** Check both teams' requirements and see if a single version satisfies both. Bump the older dependency if you can.
3. **Force alignment if needed.** Use `overrides` (npm) or `pnpm.overrides` to pin the whole tree to one version.
4. **Reinstall and test.** Delete the lockfile changes you don't understand, reinstall clean, and run the suite.

Talk to the other team before you pin anything — they may need the newer version for a reason, and you want one fix, not two teams overriding each other.
