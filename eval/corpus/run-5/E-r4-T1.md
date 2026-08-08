---
kind: eval-artifact
run: 5
variant: E
replicate: r4
task: T1
model: claude-opus-5
generated: 2026-08-08
note: "BLUF label + explanation rules"
warning: Experiment output, not reference material. Generated to measure a writing instruction, never fact-checked as documentation.
---
Your build broke because two packages now ask for two different versions of the same library, and the tool that installs them can only pick one shape for the code that runs.

Here is what happens under the hood. Each package lists a version range for the library. When those ranges overlap, the package manager picks one version and both packages share it. When the ranges do not overlap, the package manager installs both copies — one nested under each dependent.

Two copies break things in ways a single copy never does.

- Types clash. Your compiler sees two declarations of the same type and treats them as different types, so passing a value from one package to the other fails to check.
- Instance checks fail. `instanceof` and class-identity checks compare against the copy the caller loaded, not the copy the callee loaded.
- Singletons split. A library that holds shared state — a registry, a context, a connection pool — now holds two of it, and each half sees only its own.
- Bundles grow. You ship both copies to the browser.

First find out which version won and where the copies live.

```bash
npm ls <library>          # or: pnpm why <library>, yarn why <library>
```

That prints the tree and shows you which package pulled which version.

Then pick a fix.

**Upgrade the lagging package.** This is the real fix. If the new package needs v3 and yours pins v2, move yours to v3. You get one copy, no overrides, and no explaining later.

**Force one version.** If you cannot upgrade yet, tell the package manager to collapse both to one version. npm and yarn call it `overrides` and `resolutions`; pnpm calls it `pnpm.overrides`. Add it, reinstall, and run your tests. This lies to one of the packages about what it is getting, so it only holds while the versions stay compatible in practice.

**Make it a peer dependency.** If the library must be a singleton — a framework runtime, a state container, a plugin host — the packages should declare it as a peer, not a direct dependency. Then the app supplies the one copy and the packages use it.

**Keep both copies.** Sometimes two copies are fine. If the library is stateless and the two packages never hand its values to each other, you can pay the bundle size and move on.

Pick the upgrade if you can. Reach for an override only as a dated stopgap, and write down the date.
