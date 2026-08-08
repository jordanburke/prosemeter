---
kind: eval-artifact
run: 5
variant: F
replicate: r2
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
## What is happening?

Two copies of the same library are now in your build, and something is loading the wrong one.

The new package asked for a different version than yours did. Your package manager could not pick a single version that satisfies both, so it installed both. Node then resolves each import to whichever copy sits nearest that importer in the folder tree.

Duplicate copies break code in ways a version mismatch alone would not. An `instanceof` check fails, because the class from copy A is not the class from copy B. Module-level state splits, so a registry or a cache written by one copy is invisible to the other. A type error appears at build time, because the bundler pulled types from one copy and values from the other.

Bundlers make this louder. Two copies of a library both land in the output, so the bundle grows, and any singleton inside it exists twice.

## How do I fix it?

Pick one version and force the whole tree onto it.

First, see what you actually have. Run `npm ls <library>` (or `pnpm why <library>`) — it prints every path that depends on the library and the version each one got.

Then choose a fix:

- **Widen a range.** If the two ranges are close, bump your dependency so one version satisfies both. This is the honest fix, because nothing is being overridden.
- **Override the resolution.** Use `overrides` in npm, `resolutions` in Yarn, or `pnpm.overrides` in pnpm to pin every copy to one version. Do this when you cannot change the other package.
- **Make it a peer dependency.** If the library is meant to be shared — React, a logging client, anything holding state — the packages that use it should declare it under `peerDependencies`, not `dependencies`. A peer dependency says "give me the one the app already has" instead of "install me my own".

Override with care. Forcing a package onto a version it never declared support for can break it at runtime rather than at build time, so run the tests afterward.

If both versions must coexist, the shared state has to move. Put the registry or cache in a small package that both depend on, and let the library stay duplicated around it.
