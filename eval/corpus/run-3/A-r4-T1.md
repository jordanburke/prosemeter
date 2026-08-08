---
kind: eval-artifact
run: 3
variant: A
replicate: r4
task: T1
model: claude-opus-5
generated: 2026-08-03
note: "control arm added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
What you're hitting is a version conflict in the dependency tree. The new package declares a dependency on, say, `some-lib@^3`, and your package already depended on `some-lib@^2`. The package manager can't satisfy both with one copy, so one of two things happens:

- **It installs both.** npm/pnpm nest the second copy so each package gets the version it asked for. Usually fine, but it breaks badly when the library holds state or identity that has to be shared — a singleton registry, a React instance, a class you `instanceof` against, a context object. Two copies means two registries, and code that passes values across the boundary starts failing type checks or silently missing state.
- **It picks one.** With a flat resolution (or a peer dep, or a `resolutions`/`overrides` entry someone added), one version wins and the other package gets a version it wasn't written against. Then you get missing exports, changed signatures, or runtime `undefined is not a function`.

The error message usually tells you which case you're in. Duplicate-instance problems say things like "invalid hook call" or "two copies of X detected." Wrong-version problems say a named export doesn't exist.

**To diagnose**, ask the tree who wants what:

```bash
pnpm why some-lib      # or: npm ls some-lib
```

That prints every path that pulls it in and the version each one resolved to. If you see two versions listed, that's your answer.

**To fix**, in rough order of preference:

1. **Align the ranges.** Bump your package to the same major the other team is on, or ask them to stay on yours. This is the only fix that actually removes the conflict rather than papering over it. Do this if the major bump is small.
2. **Widen a range if it's over-tight.** Sometimes one side pinned `2.4.1` exactly when `^2.4.1` would have worked and let the resolver dedupe on its own.
3. **Force a single version** with `pnpm.overrides` (pnpm) or `overrides` (npm) in the root `package.json`. This says "everyone gets this version, I take responsibility." Correct when the two ranges are actually compatible in practice and the resolver is just being conservative — and it's the *required* fix for libraries that must be a singleton. Wrong when the majors genuinely differ in API, because you're just moving the breakage to runtime.
4. **Make it a peer dependency** if it's the singleton kind of library. That pushes the choice up to the app and makes the conflict a loud install-time warning instead of a silent duplicate.

One thing worth flagging: in a monorepo, "two versions" can also come from a stale lockfile or a partial install rather than a real disagreement. Before you go editing manifests, try a clean `pnpm install` at the root and re-check `pnpm why`. I've lost afternoons to a conflict that didn't exist.
