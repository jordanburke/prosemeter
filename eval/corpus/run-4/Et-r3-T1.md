---
kind: eval-artifact
run: 4
variant: Et
replicate: r3
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "10 tasks, mixed registers"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Two packages want different versions of the same library, and your package manager can only put one of them where the code looks for it. That is a version conflict — sometimes called a diamond dependency, because both branches point back to one shared node.

**What breaks.** The resolver picks one version and hoists it. The package that expected the other version calls a function that moved, changed shape, or no longer exists. You get a runtime `undefined is not a function`, a type error at build, or — the nastiest case — two copies loaded at once, so `instanceof` checks fail across the boundary.

**Find it first.** Run `npm ls <library>` (or `pnpm why <library>`). It prints the tree and shows who asked for what. Do that before you change anything, because the fix depends on whether the two ranges actually overlap.

**Then pick a fix, cheapest first:**

1. **Bump the older package.** If a newer release of it accepts the newer library version, the ranges overlap and the resolver settles on one copy. This is the real fix.
2. **Widen or pin in your own manifest.** If you depend on the library directly too, line your range up with theirs.
3. **Force one version.** pnpm has `overrides`, npm has `overrides`, yarn has `resolutions`. This says "everyone gets this version, I'll take the risk." It works when the breaking change does not touch the code paths you use.
4. **Let both copies exist.** Sometimes correct — two independent libraries each keep their own copy and never pass objects to each other. It costs bundle size. It fails badly for anything with global state: a React, a database driver, a singleton client.

Check whether the library is one that must be a singleton. If it is, options 3 and 4 change meaning — 4 is off the table and 3 becomes mandatory.

Tell the other team either way. They added the dependency and they may not know it collides.
