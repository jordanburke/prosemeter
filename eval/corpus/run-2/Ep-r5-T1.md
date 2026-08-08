---
kind: eval-artifact
run: 2
variant: Ep
replicate: r5
task: T1
model: claude-opus-5
generated: 2026-08-02
note: "trap tasks added"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two copies of the same library are now in the tree, and something in your code expects there to be only one.

The new package depends on a version range that does not overlap with yours. pnpm cannot pick one version that satisfies both, so it installs both — one at the top of `node_modules`, one nested under the package that asked for it. Each copy has its own module instance, its own classes, and its own module-level state.

That breaks things in three common ways:

- **`instanceof` fails.** An object built by copy A is not an instance of the class from copy B, even though the code looks identical.
- **Singletons split.** Registries, context objects, and caches that assume one instance become two, and neither sees the other's writes.
- **Types conflict.** TypeScript sees two declarations of the same type and refuses to treat them as compatible.

To find out which case you have, run:

```bash
pnpm why <library-name>
```

That prints every package asking for it and the version each one resolved to.

To fix it, pick one of these:

1. **Align the ranges.** Bump your version, or ask the other team to widen theirs, so one version satisfies both. This is the real fix — do it if you can.
2. **Force one version.** Add a `pnpm.overrides` entry in the root `package.json` pinning the library to a single version. This works only if the two versions are actually compatible; if the API changed between them, you have traded a build error for a runtime error.
3. **Make it a peer dependency.** If the library is meant to be a singleton, both packages should declare it under `peerDependencies` rather than `dependencies`, which pushes the choice up to the app.

Start with `pnpm why`. The output usually makes the right option obvious.
